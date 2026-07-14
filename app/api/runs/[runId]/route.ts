import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { STALL_THRESHOLD_MS } from "@/lib/config";
import { runLastActivityMs } from "@/lib/pipeline/orchestrate";
import { triggerAdvance } from "@/lib/pipeline/trigger";
import type { GateCheckResult, RunStatusPayload, RunStepState, StepKey } from "@/lib/types";
import { STEP_ORDER } from "@/lib/types";

const NON_TERMINAL: ReadonlyArray<string> = ["queued", "running"];

/**
 * GET /api/runs/[runId] — the client poll payload (useRunStatus).
 * Shape contract: RunStatusPayload in lib/types.ts.
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

  const [application] = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.id, run.applicationId));
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, run.documentId));

  const stepRows = await db
    .select()
    .from(schema.runSteps)
    .where(eq(schema.runSteps.runId, runId));

  // Auto-resume backstop: the self-advance chain can drop (dev-server restart,
  // serverless kill, a 401/500 on the internal POST) and strand a run as
  // 'queued'/'running' forever. The UI polls this endpoint every 2s, so if a
  // non-terminal run has shown NO progress for STALL_THRESHOLD_MS we
  // fire-and-forget a re-trigger. The threshold (not every poll) is essential:
  // re-triggering on every poll would spawn concurrent chains — the hardened
  // claim in orchestrate.ts only allows re-claiming a stale 'running' step, so
  // this kick is idempotent-safe (a fresh in-flight step is left alone).
  if (
    NON_TERMINAL.includes(run.status) &&
    Date.now() - runLastActivityMs(run, stepRows) > STALL_THRESHOLD_MS
  ) {
    triggerAdvance(run.id);
  }

  const stepByKey = new Map(stepRows.map((s) => [s.step, s]));
  const steps: RunStepState[] = STEP_ORDER.map((key: StepKey) => {
    const row = stepByKey.get(key);
    return {
      step: key,
      status: row?.status ?? "pending",
      detail: (row?.detail as Record<string, unknown> | null) ?? null,
    };
  });

  const gateRows = await db
    .select()
    .from(schema.gateChecks)
    .where(eq(schema.gateChecks.runId, runId));
  const gateChecks: GateCheckResult[] = gateRows.map((g) => ({
    checkKey: g.checkKey,
    status: g.status,
    explanation: g.explanation,
    page: g.page,
  }));

  const findingRows = await db
    .select({ verifierStatus: schema.findings.verifierStatus })
    .from(schema.findings)
    .where(eq(schema.findings.runId, runId));

  const payload: RunStatusPayload = {
    id: run.id,
    applicationId: run.applicationId,
    documentId: run.documentId,
    status: run.status,
    currentStep: run.currentStep,
    gatePassed: run.gatePassed,
    classification: run.classification,
    classificationRationale: run.classificationRationale,
    checklistVersion: run.checklistVersion,
    error: run.error,
    steps,
    gateChecks,
    findingsCount: findingRows.length,
    verifierConfirmedCount: findingRows.filter((f) => f.verifierStatus === "confirmed").length,
    application: {
      districtName: application?.districtName ?? "Unknown district",
      state: application?.state ?? "",
      fiscalYearEnd: application?.fiscalYearEnd ?? "",
      pageCount: document?.pageCount ?? null,
      filename: document?.filename ?? "",
      textQuality: document?.textQuality ?? "unknown",
    },
  };

  return NextResponse.json(payload);
}
