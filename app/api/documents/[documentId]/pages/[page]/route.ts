import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import type { PagePayload } from "@/lib/types";

/**
 * GET /api/documents/[documentId]/pages/[page] — raw page text + section for
 * the citation viewer's page navigation (the selected finding's excerpt lines
 * come embedded in the finding itself).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string; page: string }> },
) {
  const { documentId, page } = await params;
  const pageNumber = Number.parseInt(page, 10);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
  }

  const db = await getDb();
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId));
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const [row] = await db
    .select()
    .from(schema.documentPages)
    .where(
      and(
        eq(schema.documentPages.documentId, documentId),
        eq(schema.documentPages.pageNumber, pageNumber),
      ),
    );
  if (!row) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const payload: PagePayload = {
    documentId,
    pageNumber,
    pageCount: doc.pageCount ?? 0,
    text: row.text,
    section: row.section,
    needsOcr: row.needsOcr,
  };
  return NextResponse.json(payload);
}
