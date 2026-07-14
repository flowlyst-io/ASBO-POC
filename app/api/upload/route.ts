import { NextResponse } from "next/server";

import { isBlobEnabled, putBlob } from "@/lib/storage";
import {
  newAcfrStorageKey,
  readUploadMetadata,
  recordAcfrUpload,
  validatePdfUpload,
} from "@/lib/upload";

/**
 * GET /api/upload — tells the client which upload path to use:
 *  - "direct": Vercel Blob is configured, so the browser uploads straight to
 *    Blob (POST /api/upload/token → upload() → POST /api/upload/complete),
 *    bypassing the ~4.5MB serverless request-body limit.
 *  - "server": no Blob token, so the browser posts multipart to this route
 *    (the dev-friendly PGlite + local-fs backbone).
 */
export function GET() {
  return NextResponse.json({ mode: isBlobEnabled() ? "direct" : "server" });
}

/**
 * POST /api/upload — multipart ACFR upload (server mode). Enforces PDF-only +
 * 25MB cap (the 350-page cap is enforced during extraction, where the page
 * count is known). Creates the application + document rows and returns
 * applicationId. In production with Blob configured the client uses the direct
 * path instead; this route stays as the local/no-Blob fallback.
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

  const invalid = validatePdfUpload({
    filename: file.name,
    contentType: file.type,
    size: file.size,
  });
  if (invalid) {
    return NextResponse.json({ error: invalid.error }, { status: invalid.status });
  }

  const metadata = readUploadMetadata((k) => form.get(k));

  const storageKey = newAcfrStorageKey();
  await putBlob(storageKey, Buffer.from(await file.arrayBuffer()));

  const { applicationId } = await recordAcfrUpload({
    storageKey,
    filename: file.name,
    sizeBytes: file.size,
    metadata,
  });

  return NextResponse.json({ applicationId }, { status: 201 });
}
