import { and, eq } from "drizzle-orm";

import { getDb, schema } from "../db/client";
import { advanceRun } from "../lib/pipeline/orchestrate";
import { createRunForApplication } from "../lib/pipeline/createRun";

/**
 * End-to-end verification of the gate-failure confirm/override flow (PRD F2
 * safety rail). Requires the dev server to be running (default
 * http://localhost:3000, override with BASE_URL) so the HTTP endpoint and the
 * override's self-advance chain are exercised for real. Start the server with
 * MOCK_AI=1 unless you intend to spend real API money on the override run.
 *
 * Flow: force a REAL gate failure twice (flip the Griffin sample's text
 * quality to 'degraded' between the segment and gate steps — the same code
 * path the Davenport OCR case hits), then over HTTP: confirm one rejection,
 * override the other, and assert statuses, guards (400/404/409), audit rows,
 * and the resumed pipeline's findings. Restores the sample's document/
 * application rows afterwards; the two test runs are left behind (same as
 * stub-run).
 *
 * Run: npm run dev  (in another terminal, MOCK_AI=1)
 *      npx tsx scripts/gate-decision-e2e.ts
 */

process.env.MOCK_AI = "1"; // in-process steps (extract/tables/segment) never spend
// In-process pipeline reads only the local ./samples PDFs; unset the Blob
// token so lib/storage uses the filesystem fallback (the token in .env.local
// can go stale when the Vercel store is recreated — it did once already).
process.env.BLOB_READ_WRITE_TOKEN = "";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ACCESS_COOKIE = `coe_access=${process.env.APP_ACCESS_CODE ?? "letmein"}`;
const STORAGE_KEY = "samples/griffin_spalding_ga_fy2023.pdf";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function postDecision(runId: string, body: unknown): Promise<Response> {
  return fetch(`${BASE_URL}/api/runs/${runId}/gate-decision`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ACCESS_COOKIE },
    body: JSON.stringify(body),
  });
}

async function main() {
  const db = await getDb();

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.storageKey, STORAGE_KEY));
  assert(doc, "Griffin-Spalding sample not seeded — run db:migrate + db:seed first");
  const [app] = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.id, doc.applicationId));
  assert(app, "Griffin-Spalding application missing");
  const originalQuality = doc.textQuality;
  const originalAppStatus = app.status;

  const serverUp = await fetch(`${BASE_URL}/api/nav/counts`, {
    headers: { cookie: ACCESS_COOKIE },
  }).catch(() => null);
  assert(serverUp?.ok, `Dev server not reachable at ${BASE_URL} — start it first (MOCK_AI=1)`);

  /** Drive a run to a real gate failure: degrade the text layer after the
   * segment step so the gate's degraded branch fires (all checks needs_human). */
  async function makeFlaggedRun(): Promise<string> {
    const runId = await createRunForApplication(doc.applicationId);
    for (let i = 0; i < 40; i++) {
      const steps = await db
        .select()
        .from(schema.runSteps)
        .where(eq(schema.runSteps.runId, runId));
      const segmentDone = steps.some((s) => s.step === "segment" && s.status === "done");
      const gatePending = steps.some((s) => s.step === "gate" && s.status === "pending");
      if (segmentDone && gatePending) {
        await db
          .update(schema.documents)
          .set({ textQuality: "degraded" })
          .where(eq(schema.documents.id, doc.id));
      }
      const result = await advanceRun(runId);
      if (result.done) break;
    }
    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
    assert(run.status === "awaiting_review", `Flagged run status ${run.status}`);
    assert(run.gatePassed === false, "Gate unexpectedly passed on degraded text");
    const checks = await db
      .select()
      .from(schema.gateChecks)
      .where(eq(schema.gateChecks.runId, runId));
    assert(
      checks.every((c) => c.status === "needs_human" && c.explanation),
      "Expected all six checks needs_human with explanations",
    );
    const steps = await db
      .select()
      .from(schema.runSteps)
      .where(eq(schema.runSteps.runId, runId));
    assert(
      steps
        .filter((s) => ["checklist", "verify", "classify"].includes(s.step))
        .every((s) => s.status === "skipped"),
      "Review steps were not skipped after the gate failure",
    );
    return runId;
  }

  try {
    console.log("Creating two gate-flagged runs (real degraded-text path)…");
    const runA = await makeFlaggedRun();
    const runB = await makeFlaggedRun();
    console.log(`  flagged runs: A=${runA} (confirm), B=${runB} (override)`);
    // Restore before the override chain re-runs anything against the document.
    await db
      .update(schema.documents)
      .set({ textQuality: originalQuality })
      .where(eq(schema.documents.id, doc.id));

    // --- Request validation guards ------------------------------------------
    const bad = await postDecision(runA, { action: "nuke" });
    assert(bad.status === 400, `Invalid action: expected 400, got ${bad.status}`);
    const missing = await postDecision("00000000-0000-4000-8000-000000000000", {
      action: "override",
    });
    assert(missing.status === 404, `Unknown run: expected 404, got ${missing.status}`);

    // --- Confirm rejection (run A) -------------------------------------------
    const confirm = await postDecision(runA, { action: "confirm_rejection" });
    assert(confirm.status === 200, `Confirm: expected 200, got ${confirm.status}`);
    const [rejectedRun] = await db.select().from(schema.runs).where(eq(schema.runs.id, runA));
    assert(rejectedRun.status === "rejected", `Run A status ${rejectedRun.status}`);
    assert(rejectedRun.gateOverride === false, "Run A should not be overridden");
    const [appAfterConfirm] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, doc.applicationId));
    assert(appAfterConfirm.status === "rejected", `App status ${appAfterConfirm.status}`);
    const confirmAudit = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.runId, runA),
          eq(schema.auditLog.event, "gate_rejection_confirmed"),
        ),
      );
    assert(confirmAudit.length === 1 && confirmAudit[0].actor === "human", "Confirm audit row missing");
    const auditChecks = (confirmAudit[0].payload as { checks?: unknown[] })?.checks;
    assert(auditChecks?.length === 6, "Confirm audit should carry the six flagged checks");

    // Double-confirm and confirm-then-override must both lose with 409.
    assert((await postDecision(runA, { action: "confirm_rejection" })).status === 409, "Double confirm not 409");
    assert((await postDecision(runA, { action: "override" })).status === 409, "Override after confirm not 409");

    // Rejected payload over HTTP.
    const getA = await fetch(`${BASE_URL}/api/runs/${runA}`, { headers: { cookie: ACCESS_COOKIE } });
    const payloadA = (await getA.json()) as { status: string; gateOverride: boolean };
    assert(payloadA.status === "rejected", `GET run A status ${payloadA.status}`);

    // --- Override (run B) -----------------------------------------------------
    const override = await postDecision(runB, { action: "override" });
    assert(override.status === 200, `Override: expected 200, got ${override.status}`);
    assert((await postDecision(runB, { action: "confirm_rejection" })).status === 409, "Confirm after override not 409");

    console.log("  override accepted — waiting for the resumed pipeline…");
    let resumed: typeof schema.runs.$inferSelect | undefined;
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      [resumed] = await db.select().from(schema.runs).where(eq(schema.runs.id, runB));
      if (resumed && ["awaiting_review", "failed"].includes(resumed.status)) break;
      // The dev server's chain can drop links; GET triggers the auto-resume backstop.
      await fetch(`${BASE_URL}/api/runs/${runB}`, { headers: { cookie: ACCESS_COOKIE } });
    }
    assert(resumed?.status === "awaiting_review", `Run B ended ${resumed?.status ?? "unknown"}`);
    assert(resumed.gateOverride === true, "Run B gateOverride not set");
    assert(resumed.gatePassed === false, "Run B gatePassed should stay false (metrics)");

    const stepsB = await db
      .select()
      .from(schema.runSteps)
      .where(eq(schema.runSteps.runId, runB));
    assert(
      stepsB.every((s) => s.status === "done"),
      `Run B steps not all done: ${stepsB.map((s) => `${s.step}=${s.status}`).join(", ")}`,
    );
    const findingsB = await db
      .select({ id: schema.findings.id })
      .from(schema.findings)
      .where(eq(schema.findings.runId, runB));
    assert(findingsB.length >= 8, `Run B expected findings, got ${findingsB.length}`);

    const auditB = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.runId, runB));
    assert(auditB.some((a) => a.event === "gate_overridden" && a.actor === "human"), "Override audit missing");
    assert(auditB.some((a) => a.event === "run_ready_for_review"), "Resumed run did not audit run_ready_for_review");
    assert(
      auditB.filter((a) => a.event === "run_flagged_gate_failure").length === 1,
      "Resumed run re-audited a gate failure",
    );

    const getB = await fetch(`${BASE_URL}/api/runs/${runB}`, { headers: { cookie: ACCESS_COOKIE } });
    const payloadB = (await getB.json()) as { status: string; gateOverride: boolean; findingsCount: number };
    assert(payloadB.gateOverride === true, "GET run B payload missing gateOverride");

    // --- District-metadata detection (placeholder-named upload) --------------
    // Simulate a metadata-less direct upload: a placeholder application over
    // the Rockford sample blob. The gate step must detect the identity (mock
    // value under MOCK_AI) and replace the placeholder. Left behind like the
    // other test runs.
    console.log("Creating a placeholder-named application (metadata detection)…");
    const [rockfordDoc] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.storageKey, "samples/rockford_il_fy2023.pdf"));
    assert(rockfordDoc, "Rockford sample not seeded");
    const [cloneApp] = await db
      .insert(schema.applications)
      .values({
        districtName: "Uploaded district",
        state: "—",
        fiscalYearEnd: "2025-06-30",
        status: "intake",
      })
      .returning();
    await db.insert(schema.documents).values({
      applicationId: cloneApp.id,
      kind: "acfr",
      filename: rockfordDoc.filename,
      storageKey: rockfordDoc.storageKey,
      sizeBytes: rockfordDoc.sizeBytes,
      textQuality: "unknown",
    });
    const runC = await createRunForApplication(cloneApp.id);
    for (let i = 0; i < 60; i++) {
      const result = await advanceRun(runC);
      if (result.done) break;
    }
    const [runCRow] = await db.select().from(schema.runs).where(eq(schema.runs.id, runC));
    assert(runCRow.status === "awaiting_review", `Run C ended ${runCRow.status}`);
    const [detectedApp] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, cloneApp.id));
    assert(
      detectedApp.districtName === "Mockville Community School District",
      `District name not detected: "${detectedApp.districtName}"`,
    );
    assert(detectedApp.state === "IA", `State not detected: "${detectedApp.state}"`);
    assert(
      detectedApp.fiscalYearEnd === "2023-06-30",
      `Fiscal year end not detected: "${detectedApp.fiscalYearEnd}"`,
    );
    const metaAudit = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(eq(schema.auditLog.runId, runC), eq(schema.auditLog.event, "district_metadata_detected")),
      );
    assert(metaAudit.length === 1 && metaAudit[0].actor === "agent:metadata", "Metadata audit row missing");

    console.log("");
    console.log("GATE-DECISION E2E PASSED ✅");
    console.log(`  run A (confirm):  status=rejected, app=rejected, audit=gate_rejection_confirmed`);
    console.log(`  run B (override): status=awaiting_review, findings=${findingsB.length}, gateOverride=true`);
    console.log(`  run C (metadata): district="${detectedApp.districtName}" state=${detectedApp.state} fye=${detectedApp.fiscalYearEnd}`);
    console.log(`  guards:           400 invalid body, 404 unknown run, 409 double/crossed decisions`);
  } finally {
    // Leave the two test runs (stub-run precedent) but restore the shared rows.
    await db
      .update(schema.documents)
      .set({ textQuality: originalQuality })
      .where(eq(schema.documents.id, doc.id));
    await db
      .update(schema.applications)
      .set({ status: originalAppStatus })
      .where(eq(schema.applications.id, doc.applicationId));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
