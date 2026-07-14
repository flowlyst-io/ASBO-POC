import { asc, eq } from "drizzle-orm";

import { schema } from "@/db/client";
import { callStructured } from "@/lib/ai/client";
import { writeAudit } from "@/lib/audit";
import { SegmentResultSchema } from "@/lib/schemas";
import type { Section } from "@/lib/types";

import { setStepDetail, type StepContext, type StepOutcome } from "./orchestrate";

/**
 * F1 section segmentation: classify every page into the four standard ACFR
 * sections (introductory / financial / statistical / compliance).
 *
 * One cheap Haiku call over a per-page digest (page number + the first lines
 * of each page) locates the three section boundaries. Keyword heuristics
 * proved brittle across real PDFs (TOC pages and divider-page variants kept
 * mis-firing), so the model call is the primary path; a marker heuristic
 * remains as the fallback if the call fails.
 */

const DIGEST_CHARS_PER_PAGE = 180;

export async function runSegment({ db, runId, run }: StepContext): Promise<StepOutcome> {
  const pages = await db
    .select()
    .from(schema.documentPages)
    .where(eq(schema.documentPages.documentId, run.documentId))
    .orderBy(asc(schema.documentPages.pageNumber));

  const digest = pages
    .map((p) => {
      const head = p.needsOcr
        ? "[degraded text]"
        : p.text.trim().replace(/\s+/g, " ").slice(0, DIGEST_CHARS_PER_PAGE);
      return `p.${p.pageNumber}: ${head}`;
    })
    .join("\n");

  let boundaries: { financialStartPage: number; statisticalStartPage: number | null; complianceStartPage: number | null };
  try {
    boundaries = await callStructured({
      task: "segment",
      runId,
      system:
        "You are segmenting a US school district ACFR into its four standard sections: introductory (cover, transmittal letter, TOC, officials), financial (independent auditor's report, MD&A, basic financial statements, notes, RSI, supplementary schedules), statistical (ten-year trend tables), and compliance (single audit / Uniform Guidance reports), in that order. You are given a digest with the first words of every page. Report the FIRST page of the financial, statistical, and compliance sections. Table-of-contents pages listing section titles are still part of the introductory section — the financial section starts at the independent auditor's report (or the auditor's transmittal preceding it), not at a TOC mention.",
      user: `Page digest (${pages.length} pages):\n${digest}`,
      schema: SegmentResultSchema,
    });
  } catch {
    boundaries = heuristicBoundaries(pages);
    await writeAudit("agent:segment", "segmentation_fallback_heuristic", runId);
  }

  // Sanity: enforce ordering; drop out-of-order boundaries.
  const fin = Math.max(2, boundaries.financialStartPage);
  let stat = boundaries.statisticalStartPage;
  let comp = boundaries.complianceStartPage;
  if (stat != null && stat <= fin) stat = null;
  if (comp != null && (comp <= fin || (stat != null && comp <= stat))) comp = null;

  const counts: Record<Section, number> = {
    introductory: 0,
    financial: 0,
    statistical: 0,
    compliance: 0,
  };

  for (const page of pages) {
    let section: Section = "introductory";
    if (comp != null && page.pageNumber >= comp) section = "compliance";
    else if (stat != null && page.pageNumber >= stat) section = "statistical";
    else if (page.pageNumber >= fin) section = "financial";
    counts[section] += 1;
    await db
      .update(schema.documentPages)
      .set({ section })
      .where(eq(schema.documentPages.id, page.id));
  }

  await setStepDetail(db, runId, "segment", {
    counts,
    boundaries: { financial: fin, statistical: stat, compliance: comp },
  });
  await writeAudit("agent:segment", "segmentation_complete", runId, { counts });

  return { finished: true };
}

/** Fallback: first heading-position marker match wins (forward-only). */
function heuristicBoundaries(
  pages: Array<typeof schema.documentPages.$inferSelect>,
): { financialStartPage: number; statisticalStartPage: number | null; complianceStartPage: number | null } {
  let financial: number | null = null;
  let statistical: number | null = null;
  let compliance: number | null = null;

  for (const page of pages) {
    const head = page.text.slice(0, 600);
    const looksLikeToc =
      /table of contents/i.test(page.text) || (page.text.match(/\.{5,}/g) ?? []).length >= 3;
    if (looksLikeToc) continue;
    if (financial === null && /(independent auditor'?s report|management'?s discussion and analysis)/i.test(head)) {
      financial = page.pageNumber;
    } else if (financial !== null && statistical === null && /statistical section/i.test(head)) {
      statistical = page.pageNumber;
    } else if (
      statistical !== null &&
      compliance === null &&
      /(single audit|uniform guidance|schedule of expenditures of federal awards)/i.test(head)
    ) {
      compliance = page.pageNumber;
    }
  }

  return {
    financialStartPage: financial ?? Math.min(15, Math.max(2, Math.floor(pages.length * 0.1))),
    statisticalStartPage: statistical,
    complianceStartPage: compliance,
  };
}
