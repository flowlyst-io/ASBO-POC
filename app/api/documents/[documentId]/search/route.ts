import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import type { DocumentSearchMatch, DocumentSearchPayload } from "@/lib/types";

/** Max matching pages returned; one extra row is fetched to detect capping. */
const MAX_MATCH_PAGES = 50;
const SNIPPET_RADIUS = 60;

/** Snippet of ~2×SNIPPET_RADIUS chars centered on the first hit. */
function makeSnippet(text: string, index: number, termLength: number): string {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + termLength + SNIPPET_RADIUS);
  const core = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${core}${end < text.length ? "…" : ""}`;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) return count;
    count += 1;
    from = idx + needle.length;
  }
}

/**
 * GET /api/documents/[documentId]/search?q=… — case-insensitive full-text
 * search over the document's extracted page texts, for the citation viewer's
 * find-in-document. POC-scale: ILIKE over ≤350 document_pages rows.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const q = new URL(request.url).searchParams.get("q");
  if (q === null) {
    return NextResponse.json({ error: "Missing query parameter q" }, { status: 400 });
  }

  const db = await getDb();
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId));
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const term = q.trim();
  const empty: DocumentSearchPayload = {
    documentId,
    query: term,
    matches: [],
    totalMatches: 0,
    capped: false,
  };
  if (term.length < 2) {
    return NextResponse.json(empty);
  }

  // Escape ILIKE wildcards so the term is matched literally.
  const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await db
    .select({
      pageNumber: schema.documentPages.pageNumber,
      text: schema.documentPages.text,
    })
    .from(schema.documentPages)
    .where(
      and(
        eq(schema.documentPages.documentId, documentId),
        sql`${schema.documentPages.text} ILIKE ${`%${escaped}%`} ESCAPE '\\'`,
      ),
    )
    .orderBy(asc(schema.documentPages.pageNumber))
    .limit(MAX_MATCH_PAGES + 1);

  const capped = rows.length > MAX_MATCH_PAGES;
  const lowerTerm = term.toLowerCase();
  const matches: DocumentSearchMatch[] = rows.slice(0, MAX_MATCH_PAGES).map((row) => {
    const lowerText = row.text.toLowerCase();
    const firstIndex = lowerText.indexOf(lowerTerm);
    return {
      pageNumber: row.pageNumber,
      snippet: firstIndex === -1 ? "" : makeSnippet(row.text, firstIndex, term.length),
      hitCount: countOccurrences(lowerText, lowerTerm),
    };
  });

  const payload: DocumentSearchPayload = {
    documentId,
    query: term,
    matches,
    totalMatches: matches.length,
    capped,
  };
  return NextResponse.json(payload);
}
