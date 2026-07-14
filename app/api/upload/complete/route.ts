import { NextResponse } from "next/server";

import { statBlob } from "@/lib/storage";
import {
  readUploadMetadata,
  recordAcfrUpload,
  validatePdfUpload,
} from "@/lib/upload";

/**
 * POST /api/upload/complete — called by the browser after a successful
 * direct-to-Blob upload. Verifies the blob actually exists (head), validates
 * it, then runs the shared post-store logic (application + document rows +
 * audit). We do NOT rely on Blob's onUploadCompleted webhook for row creation
 * because it may not fire in local/preview environments.
 *
 * Body: { pathname, filename, contentType?, districtName?, state?, fiscalYearEnd? }
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const storageKey = typeof body.pathname === "string" ? body.pathname : "";
  const filename = typeof body.filename === "string" ? body.filename : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : null;
  if (!storageKey || !filename) {
    return NextResponse.json(
      { error: "pathname and filename are required" },
      { status: 400 },
    );
  }

  // The blob must really exist before we create rows — this is the trust
  // boundary (the client claims the upload succeeded; we verify).
  const stat = await statBlob(storageKey);
  if (!stat) {
    return NextResponse.json(
      { error: "Uploaded file not found in storage" },
      { status: 404 },
    );
  }

  const invalid = validatePdfUpload({ filename, contentType, size: stat.size });
  if (invalid) {
    return NextResponse.json({ error: invalid.error }, { status: invalid.status });
  }

  const metadata = readUploadMetadata((k) => body[k]);

  const { applicationId } = await recordAcfrUpload({
    storageKey,
    filename,
    sizeBytes: stat.size,
    metadata,
  });

  return NextResponse.json({ applicationId }, { status: 201 });
}
