import { NextResponse } from "next/server";

import { createRunForApplication } from "@/lib/pipeline/createRun";
import { triggerAdvance } from "@/lib/pipeline/trigger";
import { CreateRunRequestSchema } from "@/lib/schemas";

/**
 * POST /api/runs — create a run for an application's ACFR document (run +
 * step + gate skeleton rows via createRunForApplication), then fire-and-forget
 * the advance chain. Responds 202 immediately; the client polls
 * GET /api/runs/[id].
 *
 * TODO(phase-5): enforce DAILY_RUN_CAP here.
 */
export async function POST(request: Request) {
  const body = CreateRunRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "applicationId (uuid) is required" }, { status: 400 });
  }

  let runId: string;
  try {
    runId = await createRunForApplication(body.data.applicationId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 404 });
  }

  triggerAdvance(runId);

  return NextResponse.json({ runId }, { status: 202 });
}
