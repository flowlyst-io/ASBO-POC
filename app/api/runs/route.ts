import { NextResponse } from "next/server";
import { count, gte } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { getEnv } from "@/lib/config";
import { createRunForApplication } from "@/lib/pipeline/createRun";
import { triggerAdvance } from "@/lib/pipeline/trigger";
import { CreateRunRequestSchema } from "@/lib/schemas";

/**
 * POST /api/runs — create a run for an application's ACFR document (run +
 * step + gate skeleton rows via createRunForApplication), then fire-and-forget
 * the advance chain. Responds 202 immediately; the client polls
 * GET /api/runs/[id].
 *
 * Enforces DAILY_RUN_CAP: caps runs created since UTC midnight to keep POC LLM
 * spend bounded.
 */
export async function POST(request: Request) {
  const body = CreateRunRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "applicationId (uuid) is required" }, { status: 400 });
  }

  // Daily cap: count runs created since 00:00 UTC today.
  const cap = getEnv().DAILY_RUN_CAP;
  const db = await getDb();
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.runs)
    .where(gte(schema.runs.createdAt, startOfDayUtc));
  if (n >= cap) {
    return NextResponse.json(
      { error: `Daily run limit reached (${cap} runs/day). Try again tomorrow.` },
      { status: 429 },
    );
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
