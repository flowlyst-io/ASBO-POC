/**
 * Text-quality heuristic for extracted PDF page text.
 *
 * The Davenport IA sample has a degraded/custom-encoded text layer that
 * extracts as garbage (e.g. "'DYHQSRUW" — a Caesar-shifted "Davenport").
 * This scorer flags such pages as needs_ocr so the pipeline surfaces them
 * as needs-human instead of hallucinating judgments over garbage text.
 */

export interface PageQuality {
  /** 0..1 — higher is better. */
  score: number;
  needsOcr: boolean;
}

/** Pages scoring below this are flagged needs_ocr. */
export const QUALITY_THRESHOLD = 0.55;

/** Non-divider pages with fewer chars than this are suspicious. */
const MIN_CHARS_PER_PAGE = 200;

// Control chars (except tab/newline/CR) + unicode replacement char.
const BAD_CHARS_RE = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFD]", "g");

export function scorePageText(text: string): PageQuality {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    // Truly empty pages (section dividers) are common; don't OCR-flag them,
    // but give a neutral-low score.
    return { score: 0.5, needsOcr: false };
  }

  const len = trimmed.length;

  // 1. Ratio of characters inside recognizable word tokens (3+ latin letters).
  const wordMatches = trimmed.match(/[a-zA-Z]{3,}/g) ?? [];
  const wordChars = wordMatches.reduce((n, w) => n + w.length, 0);
  const wordCoverage = wordChars / len;

  // 2. Ratio of control/replacement/unmappable characters.
  const badChars = (trimmed.match(BAD_CHARS_RE) ?? []).length;
  const badRatio = badChars / len;

  // 3. Dictionary-signal: presence of very common English words.
  const commonHits = (
    trimmed.toLowerCase().match(/\b(the|and|of|to|in|for|financial|district|school|fund)\b/g) ?? []
  ).length;
  const commonSignal = Math.min(1, commonHits / 10);

  // 4. Char-count floor for substantive pages.
  const lengthSignal = Math.min(1, len / MIN_CHARS_PER_PAGE);

  const score = Math.max(
    0,
    Math.min(1, 0.45 * wordCoverage + 0.35 * commonSignal + 0.2 * lengthSignal - badRatio),
  );

  return { score, needsOcr: score < QUALITY_THRESHOLD };
}

/** Whole-document quality from per-page scores. */
export function documentTextQuality(pages: PageQuality[]): "clean" | "degraded" {
  if (pages.length === 0) return "degraded";
  const flagged = pages.filter((p) => p.needsOcr).length;
  return flagged / pages.length > 0.3 ? "degraded" : "clean";
}
