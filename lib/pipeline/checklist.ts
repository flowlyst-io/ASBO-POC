import { asc, eq } from "drizzle-orm";

import { schema } from "@/db/client";
import { callStructured } from "@/lib/ai/client";
import { writeAudit } from "@/lib/audit";
import { CriterionFindingSchema } from "@/lib/schemas";
import { CHECKLIST_BATCH_SIZE } from "@/lib/types";

import { buildExcerptLines, getPage, getSectionText } from "./context";
import { getStepDetail, setStepDetail, type StepContext, type StepOutcome } from "./orchestrate";

/**
 * F3 checklist verification engine — the long step. Each advance invocation
 * processes ONE batch of CHECKLIST_BATCH_SIZE criteria (cursor persisted in
 * run_steps.detail) and inserts findings progressively so the reviewer UI
 * streams them in.
 *
 * Citation rule (coe-domain skill): a finding whose citation cannot be
 * located in document_pages is stored with status/verifier semantics that
 * keep it out of the "confident" bucket — the verifier stage enforces this.
 */
export async function runChecklist({ db, runId, run }: StepContext): Promise<StepOutcome> {
  const criteria = await db
    .select()
    .from(schema.criteria)
    .where(eq(schema.criteria.checklistVersion, run.checklistVersion))
    .orderBy(asc(schema.criteria.sortOrder));

  if (criteria.length === 0) {
    throw new Error(
      `No criteria found for checklist version ${run.checklistVersion} — run db:seed`,
    );
  }

  const detail = await getStepDetail<{ cursor: number }>(db, runId, "checklist");
  const cursor = detail?.cursor ?? 0;
  const batch = criteria.slice(cursor, cursor + CHECKLIST_BATCH_SIZE);

  // Cache per-section context within the batch (prompt-cache-friendly too).
  const sectionText = new Map<string, string>();

  for (const criterion of batch) {
    if (!sectionText.has(criterion.section)) {
      sectionText.set(
        criterion.section,
        await getSectionText(db, run.documentId, criterion.section),
      );
    }
    const context = sectionText.get(criterion.section) ?? "";

    const result = await callStructured({
      task: "checklist",
      runId,
      system:
        "You are an expert ASBO Certificate of Excellence reviewer verifying one checklist criterion against an ACFR. Judge strictly from the provided section text. Every judgment must cite the exact page and quote the passage relied on, verbatim. If you cannot locate supporting text, answer cannot_determine with a null page — NEVER fabricate a citation.",
      cachedContext: `ACFR ${criterion.section} section text (page-tagged):\n${context}`,
      user: `Criterion ${criterion.num} (${criterion.section} section): ${criterion.title}\n${criterion.description}\n\nJudge compliance (met / not_met / partial / na / cannot_determine), state your confidence, draft a reviewer-style comment, and cite the decisive page and verbatim passage.`,
      schema: CriterionFindingSchema,
    });

    // Build citation-viewer fields from the cited page's real text.
    let cite: string | null = null;
    let lines: string[] | null = null;
    let pageTitle = result.pageTitle;
    if (result.page != null) {
      const page = await getPage(db, run.documentId, result.page);
      if (page) {
        lines = buildExcerptLines(page.text, result.hlText);
        cite = `p. ${result.page}${pageTitle ? ` — ${pageTitle}` : ""}`;
      } else {
        // Cited page doesn't exist — treat as uncitable.
        pageTitle = null;
        cite = null;
      }
    }

    await db.insert(schema.findings).values({
      runId,
      criterionId: criterion.id,
      num: criterion.num,
      section: criterion.section,
      title: criterion.title,
      status: result.status,
      confidence: result.confidence,
      comment: result.comment,
      cite,
      page: result.page,
      pageTitle,
      hlText: result.hlText,
      lines,
      verifierStatus: "pending",
    });
  }

  const nextCursor = cursor + batch.length;
  const finished = nextCursor >= criteria.length;
  await setStepDetail(db, runId, "checklist", { cursor: nextCursor, total: criteria.length });
  if (finished) {
    await writeAudit("agent:checklist", "checklist_complete", runId, { criteria: criteria.length });
  }
  return { finished };
}
