import { and, asc, eq } from "drizzle-orm";

import { schema } from "@/db/client";
import { callStructured } from "@/lib/ai/client";
import { writeAudit } from "@/lib/audit";
import { VerifierVerdictSchema } from "@/lib/schemas";

import { getPage } from "./context";
import { setStepDetail, type StepContext, type StepOutcome } from "./orchestrate";

const VERIFY_BATCH_SIZE = 10;

/**
 * F4 verifier agent (hallucination guardrail): independently re-check each
 * finding's citation against the stored page text — does the citation exist,
 * does it say what the finding claims, does the judgment follow?
 * Discrepancies downgrade the finding to needs-human (verifier_status =
 * 'flagged'), never silently accepted. Batched per advance invocation.
 */
export async function runVerifier({ db, runId }: StepContext): Promise<StepOutcome> {
  const [runRow] = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
  if (!runRow) throw new Error(`Run not found: ${runId}`);

  const pending = await db
    .select()
    .from(schema.findings)
    .where(and(eq(schema.findings.runId, runId), eq(schema.findings.verifierStatus, "pending")))
    .orderBy(asc(schema.findings.createdAt));

  const batch = pending.slice(0, VERIFY_BATCH_SIZE);

  for (const finding of batch) {
    // A finding with no locatable citation is auto-flagged — no LLM needed.
    if (finding.page == null || finding.hlText == null) {
      if (finding.status === "na" || finding.status === "cannot_determine") {
        // N/A and explicit cannot-determine findings legitimately lack citations.
        await db
          .update(schema.findings)
          .set({ verifierStatus: "confirmed", updatedAt: new Date() })
          .where(eq(schema.findings.id, finding.id));
      } else {
        await db
          .update(schema.findings)
          .set({
            verifierStatus: "flagged",
            verifierReason: "Finding carries no locatable citation — needs human review.",
            updatedAt: new Date(),
          })
          .where(eq(schema.findings.id, finding.id));
      }
      continue;
    }

    const page = await getPage(db, runRow.documentId, finding.page);
    const pageText = page?.text ?? "";

    const verdict = await callStructured({
      task: "verifier",
      runId,
      system:
        "You are an independent verification agent auditing another reviewer's finding about an ACFR. You are skeptical: confirm ONLY if the quoted passage actually appears in the page text (allowing whitespace differences), actually supports the claim, and the judgment follows from it. Otherwise refute with a specific reason.",
      user: `Finding under audit:\n- Criterion: ${finding.num} — ${finding.title}\n- Judgment: ${finding.status} (${finding.confidence} confidence)\n- Draft comment: ${finding.comment}\n- Cited page: ${finding.page}\n- Quoted passage: "${finding.hlText}"\n\nActual text of page ${finding.page}:\n${pageText.slice(0, 12_000)}\n\nDoes the citation exist, does it say what is claimed, and does the judgment follow?`,
      schema: VerifierVerdictSchema,
    });

    await db
      .update(schema.findings)
      .set({
        verifierStatus: verdict.confirmed ? "confirmed" : "flagged",
        verifierReason: verdict.confirmed ? null : (verdict.reason ?? "Verifier could not confirm the citation."),
        updatedAt: new Date(),
      })
      .where(eq(schema.findings.id, finding.id));

    await writeAudit("agent:verify", verdict.confirmed ? "finding_confirmed" : "finding_flagged", runId, {
      findingId: finding.id,
      criterion: finding.num,
      reason: verdict.reason,
    });
  }

  const remaining = pending.length - batch.length;
  await setStepDetail(db, runId, "verify", { remaining });
  return { finished: remaining <= 0 };
}
