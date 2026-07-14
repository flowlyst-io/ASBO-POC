import { and, eq } from "drizzle-orm";

import { getDb, schema } from "../db/client";
import { advanceRun } from "../lib/pipeline/orchestrate";
import { createRunForApplication } from "../lib/pipeline/createRun";
import { writeAudit } from "../lib/audit";

/**
 * End-to-end backbone verification (verify-backbone skill, step 4).
 *
 * Runs IN-PROCESS (PGlite is single-process — this script must NOT run while
 * the dev server is up when DATABASE_URL is unset): picks the Rockford IL
 * sample (clean text layer), creates a run, drives the advance chain to
 * completion with MOCK_AI, then asserts rows exist in every table and
 * exercises one review action.
 *
 * Run: npm run stub-run   (exit 0 = pass)
 */

process.env.MOCK_AI = process.env.MOCK_AI ?? "1";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function main() {
  const db = await getDb();

  // 1. Find the seeded Rockford sample (clean text layer — happy path).
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.storageKey, "samples/rockford_il_fy2023.pdf"));
  assert(doc, "Rockford sample not seeded — run `npm run db:migrate && npm run db:seed` first");

  // 2. Create the run (same code path as POST /api/runs).
  const runId = await createRunForApplication(doc.applicationId);
  console.log(`Run created: ${runId}`);

  // 3. Drive the advance chain in-process (stand-in for the HTTP self-trigger).
  const MAX_ADVANCES = 60;
  let advances = 0;
  for (; advances < MAX_ADVANCES; advances++) {
    const result = await advanceRun(runId);
    console.log(`  advance ${advances + 1}: step=${result.step ?? "-"} status=${result.status}`);
    if (result.done) break;
  }
  assert(advances < MAX_ADVANCES, `Run did not terminate within ${MAX_ADVANCES} advances`);

  // 4. Assertions.
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
  assert(run.status === "awaiting_review", `Run status is ${run.status}, expected awaiting_review`);
  assert(run.gatePassed === true, "Gate did not pass on the clean Rockford sample");
  assert(run.classification != null, "Run has no classification");

  const steps = await db
    .select()
    .from(schema.runSteps)
    .where(eq(schema.runSteps.runId, runId));
  const doneSteps = steps.filter((s) => s.status === "done");
  assert(steps.length === 7, `Expected 7 run_steps, got ${steps.length}`);
  assert(doneSteps.length === 7, `Expected 7 done steps, got ${doneSteps.length} (${steps.map((s) => `${s.step}=${s.status}`).join(", ")})`);

  const gate = await db
    .select()
    .from(schema.gateChecks)
    .where(eq(schema.gateChecks.runId, runId));
  assert(gate.length === 6, `Expected 6 gate_checks, got ${gate.length}`);
  assert(
    gate.every((g) => g.status !== "pending"),
    "Some gate checks are still pending",
  );

  const pages = await db
    .select({ id: schema.documentPages.id })
    .from(schema.documentPages)
    .where(eq(schema.documentPages.documentId, doc.id));
  assert(pages.length > 100, `Expected >100 extracted pages for Rockford, got ${pages.length}`);

  const findings = await db
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.runId, runId));
  assert(findings.length >= 8, `Expected >= 8 findings, got ${findings.length}`);
  const cited = findings.filter((f) => f.page != null && f.cite != null);
  assert(cited.length > 0, "No findings carry a citation");
  assert(
    findings.every((f) => f.verifierStatus !== "pending"),
    "Some findings were not verified",
  );

  const audit = await db
    .select({ id: schema.auditLog.id })
    .from(schema.auditLog)
    .where(eq(schema.auditLog.runId, runId));
  assert(audit.length >= findings.length, `Expected >= ${findings.length} audit rows, got ${audit.length}`);

  // 5. Exercise one review action (same effect as POST /api/findings/[id]/review).
  const target = findings[0];
  await db.insert(schema.reviews).values({
    findingId: target.id,
    runId,
    state: "accepted",
  });
  await writeAudit("human", "review_accept", runId, { findingId: target.id, source: "stub-run" });
  const [review] = await db
    .select()
    .from(schema.reviews)
    .where(and(eq(schema.reviews.runId, runId), eq(schema.reviews.findingId, target.id)));
  assert(review?.state === "accepted", "Review row was not written");

  console.log("");
  console.log("STUB RUN PASSED ✅");
  console.log(`  pages extracted: ${pages.length}`);
  console.log(`  gate checks:     ${gate.map((g) => `${g.checkKey}=${g.status}`).join(", ")}`);
  console.log(`  findings:        ${findings.length} (${cited.length} cited)`);
  console.log(`  verifier:        ${findings.filter((f) => f.verifierStatus === "confirmed").length} confirmed / ${findings.filter((f) => f.verifierStatus === "flagged").length} flagged`);
  console.log(`  classification:  ${run.classification}`);
  console.log(`  audit rows:      ${audit.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
