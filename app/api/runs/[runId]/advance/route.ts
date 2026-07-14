import { NextResponse } from "next/server";

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

  const result = await advanceRun(runId);
  if (!result.done) {
    triggerAdvance(runId);
  }

  return NextResponse.json(result);
}
