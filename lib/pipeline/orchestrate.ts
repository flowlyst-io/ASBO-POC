import { and, eq, inArray } from "drizzle-orm";

import { getDb, schema, type Db } from "@/db/client";
import { writeAudit } from "@/lib/audit";
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
  if (["awaiting_review", "complete", "failed", "canceled"].includes(run.status)) {
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
    await finalizeRun(db, runId, run.gatePassed !== false);
    return { done: true, status: "awaiting_review", step: null };
  }

  // Idempotent claim: only proceed if the step row is still claimable.
  const claimed = await db
    .update(schema.runSteps)
    .set({ status: "running", startedAt: byKey.get(next)?.startedAt ?? new Date() })
    .where(
      and(
        eq(schema.runSteps.runId, runId),
        eq(schema.runSteps.step, next),
        inArray(schema.runSteps.status, ["pending", "running"]),
      ),
    )
    .returning();
  if (claimed.length === 0) {
    // Another trigger got here first; nothing to do.
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
    }
    return { done: false, status: "running", step: next };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.runSteps)
      .set({ status: "failed", finishedAt: new Date() })
      .where(and(eq(schema.runSteps.runId, runId), eq(schema.runSteps.step, next)));
    await db
      .update(schema.runs)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(schema.runs.id, runId));
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
