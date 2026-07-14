import { and, asc, eq } from "drizzle-orm";

import { schema, type Db } from "@/db/client";
import type { Section } from "@/lib/types";

/**
 * Context-selection helpers shared by the gate / checklist / verifier stages.
 * Haiku 4.5 has a 200K-token context — always send section-scoped text,
 * never the whole ACFR (pipeline-architecture skill rule).
 */

/**
 * Join a document section's page texts, page-tagged, truncated to maxChars.
 * Haiku 4.5 has a 200K-token context (~800K chars); 300K chars (~75K tokens)
 * covers a full ACFR financial section, and prompt caching makes the repeat
 * reads cheap (~$0.1/MTok) across the per-criterion calls.
 */
export async function getSectionText(
  db: Db,
  documentId: string,
  section: Section,
  maxChars = 300_000,
): Promise<string> {
  const pages = await db
    .select()
    .from(schema.documentPages)
    .where(
      and(
        eq(schema.documentPages.documentId, documentId),
        eq(schema.documentPages.section, section),
      ),
    )
    .orderBy(asc(schema.documentPages.pageNumber));
  return joinPages(pages, maxChars);
}

/** Join the first N pages regardless of section (used before segmentation exists). */
export async function getLeadingText(db: Db, documentId: string, maxChars = 150_000): Promise<string> {
  const pages = await db
    .select()
    .from(schema.documentPages)
    .where(eq(schema.documentPages.documentId, documentId))
    .orderBy(asc(schema.documentPages.pageNumber));
  return joinPages(pages, maxChars);
}

export async function getPage(
  db: Db,
  documentId: string,
  pageNumber: number,
): Promise<typeof schema.documentPages.$inferSelect | null> {
  const [page] = await db
    .select()
    .from(schema.documentPages)
    .where(
      and(
        eq(schema.documentPages.documentId, documentId),
        eq(schema.documentPages.pageNumber, pageNumber),
      ),
    );
  return page ?? null;
}

/**
 * Build the citation-viewer excerpt: a window of page lines with the literal
 * '@hl' marker where the highlighted passage belongs (design data model).
 */
export function buildExcerptLines(pageText: string, hlText: string | null): string[] {
  const lines = pageText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return ["@hl"];

  let hlIndex = -1;
  if (hlText) {
    const probe = hlText.slice(0, 60).toLowerCase();
    hlIndex = lines.findIndex((l) => l.toLowerCase().includes(probe.slice(0, 30)));
  }
  if (hlIndex === -1) hlIndex = Math.floor(lines.length / 2);

  const before = lines.slice(Math.max(0, hlIndex - 3), hlIndex);
  const after = lines.slice(hlIndex + 1, hlIndex + 4);
  return [...before, "@hl", ...after];
}

function joinPages(
  pages: Array<typeof schema.documentPages.$inferSelect>,
  maxChars: number,
): string {
  const parts: string[] = [];
  let total = 0;
  for (const page of pages) {
    if (page.needsOcr) continue; // never feed garbage text to the model
    const tagged = `\n\n[Page ${page.pageNumber}]\n${page.text}`;
    if (total + tagged.length > maxChars) break;
    parts.push(tagged);
    total += tagged.length;
  }
  return parts.join("");
}
