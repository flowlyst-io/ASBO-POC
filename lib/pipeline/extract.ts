import { eq } from "drizzle-orm";

import { schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { documentTextQuality, scorePageText } from "@/lib/ocr/detect";
import { getBlob } from "@/lib/storage";
import { UPLOAD_MAX_PAGES } from "@/lib/types";

import { setStepDetail, type StepContext, type StepOutcome } from "./orchestrate";

/**
 * F1 text extraction: read the ACFR PDF from blob storage, extract per-page
 * text with unpdf (serverless-safe pdf.js), score text quality, and write
 * document_pages rows. Degraded pages (Davenport IA case) are flagged
 * needs_ocr — the gate and checklist stages must treat them as needs-human.
 *
 * TODO(phase-6): OCR fallback — transcribe needs_ocr pages via Haiku PDF
 * input (base64 document blocks) and re-score.
 */
export async function runExtract({ db, runId, run }: StepContext): Promise<StepOutcome> {
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, run.documentId));
  if (!doc) throw new Error(`Document not found: ${run.documentId}`);

  // Idempotency: if pages already exist (retry after a dropped chain link), skip.
  const existing = await db
    .select({ id: schema.documentPages.id })
    .from(schema.documentPages)
    .where(eq(schema.documentPages.documentId, doc.id));
  if (existing.length > 0) {
    return { finished: true };
  }

  const pdfBytes = await getBlob(doc.storageKey);
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  if (totalPages > UPLOAD_MAX_PAGES) {
    throw new Error(`Document has ${totalPages} pages — exceeds the ${UPLOAD_MAX_PAGES}-page cap`);
  }

  const pageTexts: string[] = Array.isArray(text) ? text : [String(text)];
  const qualities = pageTexts.map((t) => scorePageText(t));

  const BATCH = 50;
  for (let i = 0; i < pageTexts.length; i += BATCH) {
    const rows = pageTexts.slice(i, i + BATCH).map((t, j) => ({
      documentId: doc.id,
      pageNumber: i + j + 1,
      text: t,
      charCount: t.length,
      qualityScore: qualities[i + j].score,
      needsOcr: qualities[i + j].needsOcr,
    }));
    await db.insert(schema.documentPages).values(rows);
  }

  const textQuality = documentTextQuality(qualities);
  await db
    .update(schema.documents)
    .set({ pageCount: totalPages, textQuality })
    .where(eq(schema.documents.id, doc.id));

  const flagged = qualities.filter((q) => q.needsOcr).length;
  await setStepDetail(db, runId, "extract", { pages: totalPages, needsOcr: flagged, textQuality });
  await writeAudit("agent:extract", "extraction_complete", runId, {
    pages: totalPages,
    needsOcr: flagged,
    textQuality,
  });

  return { finished: true };
}
