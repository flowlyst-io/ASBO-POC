import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { AssignRequestSchema } from "@/lib/schemas";

/**
 * POST /api/applications/[applicationId]/assign — assign (or unassign, with
 * reviewerId: null) a reviewer to an application. Enforces the ASBO recusal
 * rule: a reviewer cannot be assigned to an application from their own state.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const { applicationId } = await params;
  const body = AssignRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid assign request" }, { status: 400 });
  }
  const { reviewerId } = body.data;

  const db = await getDb();
  const [application] = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.id, applicationId));
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let reviewerName: string | undefined;
  if (reviewerId !== null) {
    const [reviewer] = await db
      .select()
      .from(schema.reviewers)
      .where(eq(schema.reviewers.id, reviewerId));
    if (!reviewer) {
      return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });
    }
    if (reviewer.state === application.state) {
      return NextResponse.json(
        { error: "Reviewer is recused from applications in their own state" },
        { status: 409 },
      );
    }
    reviewerName = reviewer.name;
  }

  await db
    .update(schema.applications)
    .set({
      assignedReviewerId: reviewerId,
      assignedAt: reviewerId === null ? null : new Date(),
    })
    .where(eq(schema.applications.id, applicationId));

  const [latestRun] = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.applicationId, applicationId))
    .orderBy(desc(schema.runs.createdAt))
    .limit(1);

  await writeAudit("human", "assign_reviewer", latestRun?.id ?? null, {
    applicationId,
    reviewerId,
    ...(reviewerName ? { reviewerName } : {}),
  });

  return NextResponse.json({ ok: true });
}
