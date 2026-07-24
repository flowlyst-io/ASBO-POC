import { NextResponse } from "next/server";
import { and, inArray, isNotNull } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import type { MetricsPayload, RunCostRow, RunStatus } from "@/lib/types";

/**
 * GET /api/metrics — PRD F7 dashboard numbers: run throughput, gate rejection
 * rate, human overturn rate, verifier catch rate, and per-run LLM call counts
 * derived from audit_log llm_call events. Token counts and dollar cost are
 * intentionally not computed or returned.
 */
export async function GET() {
  const db = await getDb();

  const allRuns = await db.select().from(schema.runs);
  const apps = await db.select().from(schema.applications);
  const allFindings = await db.select().from(schema.findings);
  const allReviews = await db.select().from(schema.reviews);

  // --- Run status distribution + throughput -------------------------------
  const runsByStatus: Partial<Record<RunStatus, number>> = {};
  for (const run of allRuns) {
    runsByStatus[run.status] = (runsByStatus[run.status] ?? 0) + 1;
  }
  const applicationsProcessed = allRuns.filter(
    (r) => r.status === "awaiting_review" || r.status === "complete",
  ).length;

  // --- Completeness gate rejection rate ------------------------------------
  const gated = allRuns.filter((r) => r.gatePassed !== null);
  const completenessRejectionRate =
    gated.length > 0
      ? gated.filter((r) => r.gatePassed === false).length / gated.length
      : null;

  // --- Findings / reviews / verifier ---------------------------------------
  const runsWithFindings = new Set(allFindings.map((f) => f.runId));
  const avgFindingsPerApplication =
    runsWithFindings.size > 0 ? allFindings.length / runsWithFindings.size : null;

  const overturned = allReviews.filter(
    (r) => r.state === "rejected" || r.state === "edited",
  ).length;
  const humanOverturnRate = allReviews.length > 0 ? overturned / allReviews.length : null;

  const flagged = allFindings.filter((f) => f.verifierStatus === "flagged").length;
  const verifierCatchRate = allFindings.length > 0 ? flagged / allFindings.length : null;

  // --- Per-run LLM call counts from audit_log -------------------------------
  const llmEvents = await db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        inArray(schema.auditLog.event, ["llm_call", "llm_call_mock"]),
        isNotNull(schema.auditLog.runId),
      ),
    );

  const runById = new Map(allRuns.map((r) => [r.id, r]));
  const appById = new Map(apps.map((a) => [a.id, a]));

  interface CostAccumulator {
    llmCalls: number;
    realCalls: number;
  }
  const byRun = new Map<string, CostAccumulator>();
  for (const row of llmEvents) {
    if (!row.runId) continue;
    let acc = byRun.get(row.runId);
    if (!acc) {
      acc = { llmCalls: 0, realCalls: 0 };
      byRun.set(row.runId, acc);
    }
    acc.llmCalls += 1;
    if (row.event === "llm_call") acc.realCalls += 1;
  }

  const runCosts: RunCostRow[] = [];
  for (const [runId, acc] of byRun) {
    const run = runById.get(runId);
    const app = run ? appById.get(run.applicationId) : undefined;
    runCosts.push({
      runId,
      districtName: app?.districtName ?? "Unknown district",
      classification: run?.classification ?? null,
      llmCalls: acc.llmCalls,
      mock: acc.realCalls === 0,
    });
  }
  runCosts.sort((a, b) => b.llmCalls - a.llmCalls);

  const payload: MetricsPayload = {
    runsByStatus,
    applicationsProcessed,
    completenessRejectionRate,
    avgFindingsPerApplication,
    humanOverturnRate,
    verifierCatchRate,
    totalReviews: allReviews.length,
    totalFindings: allFindings.length,
    runCosts,
  };
  return NextResponse.json(payload);
}
