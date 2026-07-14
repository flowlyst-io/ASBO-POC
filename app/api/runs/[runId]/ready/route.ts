import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";

/**
 * POST /api/runs/[runId]/ready — mark the application ready for the human
 * Award / Conditional / Denied decision. Guard: every finding must carry a
 * review outcome. The AI never issues the decision (PRD non-goal) — this
 * only routes to the human decision step.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const db = await getDb();

  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const findingRows = await db
    .select({ id: schema.findings.id })
    .from(schema.findings)
    .where(eq(schema.findings.runId, runId));
  const reviewRows = await db
    .select({ findingId: schema.reviews.findingId })
    .from(schema.reviews)
    .where(eq(schema.reviews.runId, runId));

  if (findingRows.length === 0 || reviewRows.length < findingRows.length) {
    return NextResponse.json(
      { error: "All findings must be reviewed before marking ready for decision" },
      { status: 409 },
    );
  }

  await db.update(schema.runs).set({ status: "complete" }).where(eq(schema.runs.id, runId));
  await db
    .update(schema.applications)
    .set({ status: "ready_for_decision" })
    .where(eq(schema.applications.id, run.applicationId));
  await writeAudit("human", "marked_ready_for_decision", runId);

  return NextResponse.json({ ok: true });
}
