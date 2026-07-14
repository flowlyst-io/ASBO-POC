import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { ReviewActionRequestSchema } from "@/lib/schemas";

/**
 * POST /api/findings/[findingId]/review — human review action on one
 * finding: accept | reject | edit (with comment) | undo. Writes both the
 * reviews row (upsert; undo deletes) and an audit_log row (actor: human).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ findingId: string }> },
) {
  const { findingId } = await params;
  const body = ReviewActionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
  }
  const { action, comment } = body.data;

  const db = await getDb();
  const [finding] = await db
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.id, findingId));
  if (!finding) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  if (action === "undo") {
    await db.delete(schema.reviews).where(eq(schema.reviews.findingId, findingId));
  } else {
    const state = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "edited";
    const reviewComment = action === "edit" ? (comment ?? null) : null;
    const [existing] = await db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.findingId, findingId));
    if (existing) {
      await db
        .update(schema.reviews)
        .set({ state, comment: reviewComment, updatedAt: new Date() })
        .where(eq(schema.reviews.id, existing.id));
    } else {
      await db.insert(schema.reviews).values({
        findingId,
        runId: finding.runId,
        state,
        comment: reviewComment,
      });
    }
  }

  await writeAudit("human", `review_${action}`, finding.runId, {
    findingId,
    criterion: finding.num,
    ...(action === "edit" ? { commentLength: comment?.length ?? 0 } : {}),
  });

  return NextResponse.json({ ok: true });
}
