import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import type { ReviewerSummary, ReviewersPayload } from "@/lib/types";

/**
 * GET /api/reviewers — reviewer roster with per-reviewer workload counts:
 * assignedCount = assigned applications whose latest run is not complete
 * (including apps with no run yet); completedCount = assigned applications
 * whose latest run is complete.
 */
export async function GET() {
  const db = await getDb();

  const reviewerRows = await db
    .select()
    .from(schema.reviewers)
    .orderBy(schema.reviewers.name);
  const apps = await db.select().from(schema.applications);
  const allRuns = await db
    .select()
    .from(schema.runs)
    .orderBy(desc(schema.runs.createdAt));

  // Latest run per application (rows are newest-first, keep the first seen).
  const latestRunByApp = new Map<string, (typeof allRuns)[number]>();
  for (const run of allRuns) {
    if (!latestRunByApp.has(run.applicationId)) {
      latestRunByApp.set(run.applicationId, run);
    }
  }

  const reviewers: ReviewerSummary[] = reviewerRows.map((reviewer) => {
    let assignedCount = 0;
    let completedCount = 0;
    for (const app of apps) {
      if (app.assignedReviewerId !== reviewer.id) continue;
      const latestRun = latestRunByApp.get(app.id);
      if (latestRun?.status === "complete") completedCount += 1;
      else assignedCount += 1;
    }
    return {
      id: reviewer.id,
      name: reviewer.name,
      state: reviewer.state,
      title: reviewer.title,
      isDemo: reviewer.isDemo,
      assignedCount,
      completedCount,
    };
  });

  const payload: ReviewersPayload = { reviewers };
  return NextResponse.json(payload);
}
