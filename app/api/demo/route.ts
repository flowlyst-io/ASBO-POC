import path from "path";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { DemoRequestSchema } from "@/lib/schemas";
import { blobExists, isBlobEnabled, putBlobFromFile } from "@/lib/storage";

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

  // On Vercel the sample PDF bytes live in ./samples (bundled with this
  // function, see next.config.ts outputFileTracingIncludes) but not yet in
  // Blob — extract reads via getBlob(head()), so copy the bytes into Blob the
  // first time a sample is selected. Locally (no Blob token) getBlob falls back
  // to reading ./samples directly, so there is nothing to do.
  if (isBlobEnabled() && !(await blobExists(storageKey))) {
    const localPath = path.join(process.cwd(), "samples", `${body.data.sampleId}.pdf`);
    try {
      await putBlobFromFile(storageKey, localPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`demo sample blob copy failed for ${storageKey}:`, message);
      return NextResponse.json(
        { error: `Sample blob copy failed: ${message}` },
        { status: 500 },
      );
    }
  }

  await writeAudit("human", "demo_sample_selected", null, { sampleId: body.data.sampleId });

  return NextResponse.json({ applicationId: doc.applicationId });
}
