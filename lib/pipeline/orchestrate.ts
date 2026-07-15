import { and, eq, inArray, lt } from "drizzle-orm";

import { getDb, schema, type Db } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { STALL_THRESHOLD_MS } from "@/lib/config";
import { STEP_ORDER, type StepKey } from "@/lib/types";

import { runExtract } from "./extract";
import { runTables } from "./tables";
import { runSegment } from "./segment";
import { runGate } from "./gate";
import { runChecklist } from "./checklist";
import { runVerifier } from "./verifier";
import { runClassify } from "./classify";

/**
 * The step-chain contract (see .claude/skills/pipeline-architecture):
 * advanceRun() executes exactly ONE bounded unit of work — a whole cheap step
 * or one batch of a long step — persists it, and reports whether more work
 * remains. The API route re-triggers itself while `more` is true.
 */

export interface StepContext {
  db: Db;
  runId: string;
  run: typeof schema.runs.$inferSelect;
}

export interface StepOutcome {
  /** true = the step is fully done; false = same step has more batches. */
  finished: boolean;
}

type StepHandler = (ctx: StepContext) => Promise<StepOutcome>;

const HANDLERS: Record<StepKey, StepHandler> = {
  extract: runExtract,
  tables: runTables,
  segment: runSegment,
  gate: runGate,
  checklist: runChecklist,
  verify: runVerifier,
  classify: runClassify,
};

export interface AdvanceResult {
  /** true when the run reached a terminal state (no more triggers needed). */
  done: boolean;
  status: string;
  step: StepKey | null;
}

export async function advanceRun(runId: string): Promise<AdvanceResult> {
  const db = await getDb();

  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
  if (!run) throw new Error(`Run not found: ${runId}`);
  if (["awaiting_review", "complete", "failed", "canceled", "rejected"].includes(run.status)) {
    return { done: true, status: run.status, step: null };
  }

  if (run.status === "queued") {
    await db
      .update(schema.runs)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(schema.runs.id, runId));
    await writeAudit("system", "run_started", runId);
  }

  // Find the next step that still has work, in pipeline order.
  const steps = await db
    .select()
    .from(schema.runSteps)
    .where(eq(schema.runSteps.runId, runId));
  const byKey = new Map(steps.map((s) => [s.step, s]));
  const next = STEP_ORDER.find((key) => {
    const s = byKey.get(key);
    return s && (s.status === "pending" || s.status === "running");
  });

  if (!next) {
    await finalizeRun(db, runId, run.gatePassed !== false || run.gateOverride);
    return { done: true, status: "awaiting_review", step: null };
  }

  // Idempotent, race-safe claim. A step's startedAt doubles as its activity
  // heartbeat: it is stamped at claim and again after every item of a batched
  // step (touchStepActivity), so a healthy in-flight step always has a fresh
  // startedAt.
  const nextRow = byKey.get(next);
  const now = new Date();
  let claimed;
  if (!nextRow || nextRow.status === "pending") {
    // Normal path (first claim, or a batched step released back to 'pending'
    // between batches): atomically flip pending -> running. Two concurrent
    // triggers serialize on the row; only the one that still sees 'pending'
    // wins, so a batch is never double-processed.
    claimed = await db
      .update(schema.runSteps)
      .set({ status: "running", startedAt: now })
      .where(
        and(
          eq(schema.runSteps.runId, runId),
          eq(schema.runSteps.step, next),
          eq(schema.runSteps.status, "pending"),
        ),
      )
      .returning();
  } else {
    // The step is already 'running' — owned by an in-flight advance. Only
    // re-claim it if its activity is STALE (owner's chain dropped mid-step,
    // the resume path). `startedAt < staleBefore` makes this atomic: two
    // concurrent resumes cannot both win, and it never fires on a healthy
    // batch that is still bumping its heartbeat.
    const staleBefore = new Date(Date.now() - STALL_THRESHOLD_MS);
    claimed = await db
      .update(schema.runSteps)
      .set({ status: "running", startedAt: now })
      .where(
        and(
          eq(schema.runSteps.runId, runId),
          eq(schema.runSteps.step, next),
          eq(schema.runSteps.status, "running"),
          lt(schema.runSteps.startedAt, staleBefore),
        ),
      )
      .returning();
  }
  if (claimed.length === 0) {
    // Lost the claim race, or a fresh owner is still processing this step.
    return { done: false, status: run.status, step: next };
  }

  await db.update(schema.runs).set({ currentStep: next }).where(eq(schema.runs.id, runId));

  try {
    const outcome = await HANDLERS[next]({ db, runId, run });

    if (outcome.finished) {
      await db
        .update(schema.runSteps)
        .set({ status: "done", finishedAt: new Date() })
        .where(and(eq(schema.runSteps.runId, runId), eq(schema.runSteps.step, next)));

      // Gate failure short-circuits the review steps.
      if (next === "gate") {
        const [fresh] = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
        if (fresh && fresh.gatePassed === false) {
          await db
            .update(schema.runSteps)
            .set({ status: "skipped", finishedAt: new Date() })
            .where(
              and(
                eq(schema.runSteps.runId, runId),
                inArray(schema.runSteps.step, ["checklist", "verify", "classify"]),
              ),
            );
          await finalizeRun(db, runId, false);
          return { done: true, status: "awaiting_review", step: next };
        }
      }
    } else {
      // A batched step (checklist/verify) has more work. Release the lease back
      // to 'pending' so the next trigger re-claims it through the atomic
      // pending path and processes the next batch. startedAt stays fresh (last
      // touched during this batch), so a concurrent duplicate trigger sees a
      // non-stale owner and is correctly ignored until the release lands.
      await db
        .update(schema.runSteps)
        .set({ status: "pending" })
        .where(and(eq(schema.runSteps.runId, runId), eq(schema.runSteps.step, next)));
    }
    return { done: false, status: "running", step: next };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Terminal-beats-torn: mark the RUN failed FIRST. If the second write (or
    // the process) then dies, the run is already terminal — advanceRun()
    // early-returns on terminal status, so a step left 'running'/'failed'
    // can't strand a non-terminal run. (A transaction would roll BOTH writes
    // back on failure, re-introducing the non-terminal stall we are fixing.)
    await db
      .update(schema.runs)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(schema.runs.id, runId));
    await db
      .update(schema.runSteps)
      .set({ status: "failed", finishedAt: new Date() })
      .where(and(eq(schema.runSteps.runId, runId), eq(schema.runSteps.step, next)));
    await writeAudit("system", "run_failed", runId, { step: next, error: message });
    return { done: true, status: "failed", step: next };
  }
}

async function finalizeRun(db: Db, runId: string, gatePassed: boolean): Promise<void> {
  await db
    .update(schema.runs)
    .set({ status: "awaiting_review", finishedAt: new Date() })
    .where(eq(schema.runs.id, runId));
  await writeAudit("system", gatePassed ? "run_ready_for_review" : "run_flagged_gate_failure", runId);
}

/** Read/write helper for step cursors stored in run_steps.detail (jsonb). */
export async function getStepDetail<T extends Record<string, unknown>>(
  db: Db,
  runId: string,
  step: StepKey,
): Promise<T | null> {
  const [row] = await db
    .select()
    .from(schema.runSteps)
    .where(and(eq(schema.runSteps.runId, runId), eq(schema.runSteps.step, step)));
  return (row?.detail as T | null) ?? null;
}

export async function setStepDetail(
  db: Db,
  runId: string,
  step: StepKey,
  detail: Record<string, unknown>,
): Promise<void> {
  await db
    .update(schema.runSteps)
    .set({ detail })
    .where(and(eq(schema.runSteps.runId, runId), eq(schema.runSteps.step, step)));
}

/**
 * Heartbeat a running step by bumping its startedAt (which doubles as the
 * step's activity timestamp — see the claim logic). Long batched steps call
 * this after every item so a healthy-but-slow batch is never mistaken for a
 * stalled owner by the stale-reclaim path or by GET auto-resume.
 */
export async function touchStepActivity(db: Db, runId: string, step: StepKey): Promise<void> {
  await db
    .update(schema.runSteps)
    .set({ startedAt: new Date() })
    .where(and(eq(schema.runSteps.runId, runId), eq(schema.runSteps.step, step)));
}

/**
 * Most recent progress timestamp (ms) across a run and its steps. Used by GET
 * auto-resume to decide whether a non-terminal run has stalled. There is no
 * dedicated runs.updatedAt column, so we take the max of the createdAt/started/
 * finished timestamps plus every step's activity heartbeat (startedAt) and
 * finishedAt.
 */
export function runLastActivityMs(
  run: { startedAt: Date | null; finishedAt: Date | null; createdAt: Date },
  steps: ReadonlyArray<{ startedAt: Date | null; finishedAt: Date | null }>,
): number {
  const times: number[] = [run.createdAt.getTime()];
  if (run.startedAt) times.push(run.startedAt.getTime());
  if (run.finishedAt) times.push(run.finishedAt.getTime());
  for (const s of steps) {
    if (s.startedAt) times.push(s.startedAt.getTime());
    if (s.finishedAt) times.push(s.finishedAt.getTime());
  }
  return Math.max(...times);
}
