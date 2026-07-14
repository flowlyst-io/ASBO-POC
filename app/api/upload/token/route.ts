import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { UPLOAD_MAX_BYTES } from "@/lib/types";

/**
 * POST /api/upload/token — Vercel Blob client-upload handshake. The browser's
 * upload() helper calls this to get a short-lived client token, then uploads
 * the PDF straight to Blob (bypassing the ~4.5MB serverless body limit).
 *
 * Tokens are restricted to application/pdf, capped at UPLOAD_MAX_BYTES, and get
 * a random suffix so keys under the uploads/ prefix never collide.
 *
 * This route is exempt from the access-code middleware: Vercel Blob signs the
 * upload-completed callback and handleUpload verifies it. Row creation does NOT
 * depend on onUploadCompleted (it may not fire locally) — the client calls
 * POST /api/upload/complete after a successful direct upload instead.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: UPLOAD_MAX_BYTES,
        addRandomSuffix: true,
      }),
      // No-op: rows are created by POST /api/upload/complete, not here.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
