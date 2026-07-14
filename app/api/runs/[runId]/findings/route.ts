import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import type { Finding, FindingsPayload } from "@/lib/types";

/**
 * GET /api/runs/[runId]/findings — findings + review states, progressively
 * populated while the checklist/verify steps run (streaming: true until both
 * steps are terminal).
 */
export async function GET(
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
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.runId, runId))
    .orderBy(asc(schema.findings.createdAt));

  const reviewRows = await db
    .select()
    .from(schema.reviews)
    .where(eq(schema.reviews.runId, runId));
  const reviewByFinding = new Map(reviewRows.map((r) => [r.findingId, r]));

  const findings: Finding[] = findingRows.map((f) => {
    const review = reviewByFinding.get(f.id);
    return {
      id: f.id,
      num: f.num,
      section: f.section,
      title: f.title,
      status: f.status,
      confidence: f.confidence,
      comment: f.comment,
      cite: f.cite,
      page: f.page,
      pageTitle: f.pageTitle,
      hlText: f.hlText,
      lines: (f.lines as string[] | null) ?? null,
      verifierStatus: f.verifierStatus,
      verifierReason: f.verifierReason,
      review: review ? { state: review.state, comment: review.comment } : null,
    };
  });

  const stepRows = await db
    .select()
    .from(schema.runSteps)
    .where(eq(schema.runSteps.runId, runId));
  const producing = stepRows.filter((s) => s.step === "checklist" || s.step === "verify");
  const streaming =
    !["awaiting_review", "complete", "failed", "canceled"].includes(run.status) &&
    producing.some((s) => s.status === "pending" || s.status === "running");

  const payload: FindingsPayload = { runId, findings, streaming };
  return NextResponse.json(payload);
}
