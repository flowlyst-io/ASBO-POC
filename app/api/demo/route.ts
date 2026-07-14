import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { DemoRequestSchema } from "@/lib/schemas";

/**
 * POST /api/demo — register a pre-loaded sample ACFR as the active
 * application (one-click demo, PRD F1). The sample applications/documents
 * are created by db:seed with storage keys "samples/<file>".
 */
export async function POST(request: Request) {
  const body = DemoRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Unknown sampleId" }, { status: 400 });
  }

  const db = await getDb();
  const storageKey = `samples/${body.data.sampleId}.pdf`;
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.storageKey, storageKey));
  if (!doc) {
    return NextResponse.json(
      { error: "Sample not seeded — run npm run db:seed" },
      { status: 404 },
    );
  }

  await writeAudit("human", "demo_sample_selected", null, { sampleId: body.data.sampleId });

  return NextResponse.json({ applicationId: doc.applicationId });
}
