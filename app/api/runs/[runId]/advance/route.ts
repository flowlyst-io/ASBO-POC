import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { getEnv } from "@/lib/config";
import { advanceRun } from "@/lib/pipeline/orchestrate";
import { triggerAdvance } from "@/lib/pipeline/trigger";

/**
 * POST /api/runs/[runId]/advance — internal-only step-chain link.
 * Executes exactly one bounded unit of pipeline work, then re-triggers
 * itself if work remains. Idempotent: re-POSTing after a dropped link
 * resumes from persisted state.
 */
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (request.headers.get("x-internal-secret") !== getEnv().INTERNAL_RUN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { runId } = await params;

  try {
    const result = await advanceRun(runId);
    if (!result.done) {
      triggerAdvance(runId);
    }
    return NextResponse.json(result);
  } catch (err) {
    // advanceRun() guards its step handlers internally, so reaching here means
    // the SCAFFOLD threw (queued->running flip, step lookup, claim, currentStep
    // write, or finalize). A scaffold throw must never leave the run
    // non-terminal — otherwise it strands in 'running'/'queued' forever. Mark
    // it failed best-effort so the UI and auto-resume both stop.
    const message = err instanceof Error ? err.message : String(err);
    try {
      const db = await getDb();
      await db
        .update(schema.runs)
        .set({ status: "failed", error: message, finishedAt: new Date() })
        .where(eq(schema.runs.id, runId));
      await writeAudit("system", "run_failed", runId, { error: message, scope: "advance_route" });
    } catch {
      // Best-effort: the DB may itself be the failure. The error is still
      // surfaced in the 500 response and server logs.
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
