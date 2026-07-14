import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { getDb, schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { putBlob } from "@/lib/storage";
import { UPLOAD_MAX_BYTES } from "@/lib/types";

/**
 * POST /api/upload — multipart ACFR upload. Enforces PDF-only + 25MB cap
 * (the 350-page cap is enforced during extraction, where the page count is
 * known). Creates the application + document rows and returns applicationId.
 *
 * Expected multipart fields: file (PDF), districtName, state, fiscalYearEnd.
 *
 * TODO(phase-5/7): switch to Vercel Blob client uploads (browser → signed
 * token from this route → direct upload) to bypass the ~4.5MB serverless
 * request-body limit in production. The local multipart path below is the
 * dev-friendly backbone version.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)}MB cap` },
      { status: 413 },
    );
  }

  const districtName = String(form.get("districtName") ?? "Uploaded district");
  const state = String(form.get("state") ?? "—");
  const fiscalYearEnd = String(form.get("fiscalYearEnd") ?? "2025-06-30");

  const storageKey = `acfr/${randomUUID()}.pdf`;
  await putBlob(storageKey, Buffer.from(await file.arrayBuffer()));

  const db = await getDb();
  const [app] = await db
    .insert(schema.applications)
    .values({ districtName, state, fiscalYearEnd, status: "intake" })
    .returning();
  await db.insert(schema.documents).values({
    applicationId: app.id,
    kind: "acfr",
    filename: file.name,
    storageKey,
    sizeBytes: file.size,
    textQuality: "unknown",
  });

  await writeAudit("human", "acfr_uploaded", null, {
    applicationId: app.id,
    filename: file.name,
    sizeBytes: file.size,
  });

  return NextResponse.json({ applicationId: app.id }, { status: 201 });
}
