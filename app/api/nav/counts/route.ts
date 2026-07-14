import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import type { NavCountsPayload } from "@/lib/types";

/** "Jordan Ellis" -> "JE"; single word -> first letter. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/**
 * GET /api/nav/counts — badge counts for the nav rail plus the demo persona
 * ("me") behind the top-bar avatar (the reviewers row with isDemo = true).
 */
export async function GET() {
  const db = await getDb();

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

  const [demoReviewer] = await db
    .select()
    .from(schema.reviewers)
    .where(eq(schema.reviewers.isDemo, true))
    .limit(1);

  const me = demoReviewer
    ? {
        id: demoReviewer.id,
        name: demoReviewer.name,
        initials: initialsOf(demoReviewer.name),
      }
    : { id: "", name: "Reviewer", initials: "R" };

  let assignedToMe = 0;
  let completed = 0;
  for (const app of apps) {
    const latestRun = latestRunByApp.get(app.id);
    const isComplete = latestRun?.status === "complete";
    if (isComplete) completed += 1;
    if (demoReviewer && app.assignedReviewerId === demoReviewer.id && !isComplete) {
      assignedToMe += 1;
    }
  }

  const payload: NavCountsPayload = {
    applications: apps.length,
    assignedToMe,
    completed,
    me,
  };
  return NextResponse.json(payload);
}
