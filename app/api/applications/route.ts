import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import type { ApplicationListItem, ApplicationsPayload } from "@/lib/types";

/**
 * GET /api/applications — list applications with their latest run summary,
 * classification, gate result, and assigned reviewer.
 */
export async function GET() {
  const db = await getDb();

  const apps = await db
    .select()
    .from(schema.applications)
    .orderBy(desc(schema.applications.createdAt));

  // One fetch of all reviewers; tiny table at POC scale.
  const reviewerRows = await db.select().from(schema.reviewers);
  const reviewersById = new Map(reviewerRows.map((r) => [r.id, r]));

  const items: ApplicationListItem[] = [];
  for (const app of apps) {
    const [latestRun] = await db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.applicationId, app.id))
      .orderBy(desc(schema.runs.createdAt))
      .limit(1);

    const reviewer = app.assignedReviewerId
      ? reviewersById.get(app.assignedReviewerId) ?? null
      : null;

    items.push({
      id: app.id,
      districtName: app.districtName,
      state: app.state,
      fiscalYearEnd: app.fiscalYearEnd,
      status: app.status,
      latestRunId: latestRun?.id ?? null,
      latestRunStatus: latestRun?.status ?? null,
      classification: latestRun?.classification ?? null,
      gatePassed: latestRun?.gatePassed ?? null,
      createdAt: app.createdAt.toISOString(),
      assignedReviewer: reviewer
        ? { id: reviewer.id, name: reviewer.name, state: reviewer.state }
        : null,
    });
  }

  const payload: ApplicationsPayload = { applications: items };
  return NextResponse.json(payload);
}
