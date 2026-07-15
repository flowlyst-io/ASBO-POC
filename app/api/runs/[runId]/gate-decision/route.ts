import { NextResponse } from "next/server";
import { and, eq, inArray, ne } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { triggerAdvance } from "@/lib/pipeline/trigger";
import { GateDecisionRequestSchema } from "@/lib/schemas";

/**
 * POST /api/runs/[runId]/gate-decision — the human decision on a gate-flagged
 * run (PRD F2 safety rail: failing submissions are auto-FLAGGED, never
 * auto-rejected; a human confirms).
 *
 * - confirm_rejection: records the rejection (run + application -> 'rejected').
 *   Nothing is sent to the applicant in the POC — this records the decision.
 * - override: human proceeds despite the flag — the skipped review steps are
 *   reset and the pipeline resumes to prepare findings.
 *
 * Both actions guard atomically on (awaiting_review, gate_passed=false,
 * gate_override=false), so double-clicks and cross-tab races lose with a 409.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const parsed = GateDecisionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid gate decision" }, { status: 400 });
  }
  const { action } = parsed.data;
  const db = await getDb();

  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const guard = and(
    eq(schema.runs.id, runId),
    eq(schema.runs.status, "awaiting_review"),
    eq(schema.runs.gatePassed, false),
    eq(schema.runs.gateOverride, false),
  );

  const claimed =
    action === "confirm_rejection"
      ? await db.update(schema.runs).set({ status: "rejected" }).where(guard).returning()
      : await db
          .update(schema.runs)
          .set({ status: "queued", gateOverride: true, finishedAt: null, error: null })
          .where(guard)
          .returning();
  if (claimed.length === 0) {
    return NextResponse.json(
      { error: "Run is not awaiting gate confirmation" },
      { status: 409 },
    );
  }

  // The generated explanation the human just reviewed — into the audit trail.
  const flaggedChecks = await db
    .select({
      checkKey: schema.gateChecks.checkKey,
      status: schema.gateChecks.status,
      explanation: schema.gateChecks.explanation,
      page: schema.gateChecks.page,
    })
    .from(schema.gateChecks)
    .where(and(eq(schema.gateChecks.runId, runId), ne(schema.gateChecks.status, "pass")));

  if (action === "confirm_rejection") {
    await db
      .update(schema.applications)
      .set({ status: "rejected" })
      .where(eq(schema.applications.id, run.applicationId));
    await writeAudit("human", "gate_rejection_confirmed", runId, { checks: flaggedChecks });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Override: re-open the review steps the gate short-circuit skipped, then
  // resume the self-advance chain. Safe to flip the run first — it was
  // terminal, so no chain is in flight to observe the intermediate state.
  await db
    .update(schema.runSteps)
    .set({ status: "pending", startedAt: null, finishedAt: null, detail: null })
    .where(
      and(
        eq(schema.runSteps.runId, runId),
        inArray(schema.runSteps.step, ["checklist", "verify", "classify"]),
      ),
    );
  await writeAudit("human", "gate_overridden", runId, { checks: flaggedChecks });
  triggerAdvance(runId);

  return NextResponse.json({ ok: true, status: "queued" });
}
