import { and, eq } from "drizzle-orm";

import { schema } from "@/db/client";
import { callStructured } from "@/lib/ai/client";
import { writeAudit } from "@/lib/audit";
import { GateResultSchema } from "@/lib/schemas";
import { GATE_CHECK_KEYS, type GateCheckKey } from "@/lib/types";

import { getLeadingText } from "./context";
import { setStepDetail, type StepContext, type StepOutcome } from "./orchestrate";

/**
 * F2 completeness gate: six automated intake checks, written progressively
 * (one gate_checks row updated per check as it completes). Any fail /
 * needs_human sets runs.gate_passed = false — the orchestrator then skips
 * checklist/verify/classify and the run awaits human confirmation of the
 * rejection (never auto-sent; PRD safety rail).
 */

const CHECK_PROMPTS: Record<GateCheckKey, string> = {
  clean_opinion:
    "Is an independent auditor's report present, and does it express an UNMODIFIED (clean) opinion on the basic financial statements? Qualified, adverse, or disclaimer opinions fail this check.",
  mdna_present:
    "Is Management's Discussion and Analysis (MD&A) present in this ACFR?",
  basic_statements:
    "Are the required basic financial statements AND the notes to the financial statements present?",
  statistical_section: "Is a statistical section present in this ACFR?",
  coe_checklist_attached:
    "Is a COE checklist document attached or referenced as part of this submission? If the applicant is not required to attach one, answer pass. (POC: assume not required unless evidence suggests otherwise.)",
  application_form_fee:
    "Is there evidence of a completed application form and fee status? (POC: application metadata is registered at intake; answer pass unless evidence suggests otherwise.)",
};

export async function runGate({ db, runId, run }: StepContext): Promise<StepOutcome> {
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, run.documentId));
  if (!doc) throw new Error(`Document not found: ${run.documentId}`);

  // Degraded text layer (Davenport case): never hallucinate passes.
  if (doc.textQuality === "degraded") {
    for (const checkKey of GATE_CHECK_KEYS) {
      await db
        .update(schema.gateChecks)
        .set({
          status: "needs_human",
          explanation:
            "Document text layer is degraded (OCR fallback required) — this check cannot be evaluated automatically and needs human review.",
        })
        .where(and(eq(schema.gateChecks.runId, runId), eq(schema.gateChecks.checkKey, checkKey)));
    }
    await db.update(schema.runs).set({ gatePassed: false }).where(eq(schema.runs.id, runId));
    await writeAudit("agent:gate", "gate_needs_human_degraded_text", runId);
    return { finished: true };
  }

  // TODO(phase-2): section-scoped context per check (auditor's report pages
  // for clean_opinion, etc.). Backbone: leading document text, page-tagged.
  const context = await getLeadingText(db, run.documentId, 60_000);

  let anyFailed = false;
  for (const checkKey of GATE_CHECK_KEYS) {
    // Progressive + idempotent: skip checks already resolved on a retry.
    const [row] = await db
      .select()
      .from(schema.gateChecks)
      .where(and(eq(schema.gateChecks.runId, runId), eq(schema.gateChecks.checkKey, checkKey)));
    if (row && row.status !== "pending") {
      if (row.status !== "pass") anyFailed = true;
      continue;
    }

    // Two checks are intake-metadata questions, not document questions — an
    // LLM asked them against the ACFR text honestly answers needs_human,
    // which is noise. Resolve them programmatically. TODO(MVP): verify
    // against the real application record (fee status, applicant history —
    // the checklist is only required for first-time applicants, prior
    // conditional/denied, or a skipped year per PRD F2).
    if (checkKey === "application_form_fee") {
      await db
        .update(schema.gateChecks)
        .set({
          status: "pass",
          explanation:
            "Application registered at intake with district and fiscal-year metadata; fee tracking is outside the POC scope (production verifies the application record).",
          page: null,
        })
        .where(and(eq(schema.gateChecks.runId, runId), eq(schema.gateChecks.checkKey, checkKey)));
      continue;
    }
    if (checkKey === "coe_checklist_attached") {
      await db
        .update(schema.gateChecks)
        .set({
          status: "pass",
          explanation:
            "COE checklist not required for this applicant (POC assumes a returning applicant; production determines this from ASBO's applicant history — required only for first-time, prior conditional/denied, or skipped-year applicants).",
          page: null,
        })
        .where(and(eq(schema.gateChecks.runId, runId), eq(schema.gateChecks.checkKey, checkKey)));
      continue;
    }

    const result = await callStructured({
      task: "gate",
      runId,
      system:
        "You are an ASBO Certificate of Excellence intake reviewer performing a completeness check on an ACFR. Judge strictly from the provided document text. Cite the decisive page number. If the evidence is genuinely ambiguous or missing from the excerpt, answer needs_human — never guess.",
      cachedContext: `ACFR document text (page-tagged excerpts):\n${context}`,
      user: `Completeness check: ${CHECK_PROMPTS[checkKey]}\nAnswer with status pass/fail/needs_human, a one-or-two sentence explanation citing the evidence, and the decisive page number if located.`,
      schema: GateResultSchema,
    });

    if (result.status !== "pass") anyFailed = true;
    await db
      .update(schema.gateChecks)
      .set({ status: result.status, explanation: result.explanation, page: result.page })
      .where(and(eq(schema.gateChecks.runId, runId), eq(schema.gateChecks.checkKey, checkKey)));
  }

  await db.update(schema.runs).set({ gatePassed: !anyFailed }).where(eq(schema.runs.id, runId));
  await setStepDetail(db, runId, "gate", { passed: !anyFailed });
  await writeAudit("agent:gate", anyFailed ? "gate_flagged" : "gate_passed", runId);

  return { finished: true };
}
