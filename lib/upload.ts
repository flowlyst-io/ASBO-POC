import { randomUUID } from "crypto";

import { getDb, schema } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { UPLOAD_MAX_BYTES } from "@/lib/types";

/**
 * Shared ACFR-upload logic used by both the server multipart route
 * (POST /api/upload) and the direct-to-blob completion route
 * (POST /api/upload/complete). Keeps validation, row creation, and the audit
 * write in one place so the two entry points stay in lock-step.
 */

export interface UploadMetadata {
  districtName: string;
  state: string;
  fiscalYearEnd: string;
}

/**
 * Default district name for uploads with no metadata. The gate step treats it
 * as "identity unknown" and auto-detects the real district from the document
 * (lib/pipeline/gate.ts) — keep the two in sync via this constant.
 */
export const PLACEHOLDER_DISTRICT_NAME = "Uploaded district";

/** Random blob key for an uploaded ACFR (kept under the acfr/ prefix). */
export function newAcfrStorageKey(): string {
  return `acfr/${randomUUID()}.pdf`;
}

/** Coerce raw form/JSON fields into upload metadata with the same defaults. */
export function readUploadMetadata(get: (key: string) => unknown): UploadMetadata {
  return {
    districtName: String(get("districtName") ?? PLACEHOLDER_DISTRICT_NAME),
    state: String(get("state") ?? "—"),
    fiscalYearEnd: String(get("fiscalYearEnd") ?? "2025-06-30"),
  };
}

/**
 * Validate a candidate PDF upload. Returns an error message + HTTP status when
 * invalid, or null when acceptable. The 350-page cap is enforced later during
 * extraction, where the page count is known.
 */
export function validatePdfUpload(input: {
  filename: string;
  contentType?: string | null;
  size: number;
}): { error: string; status: number } | null {
  const { filename, contentType, size } = input;
  const looksPdf =
    contentType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
  if (!looksPdf) {
    return { error: "Only PDF files are accepted", status: 400 };
  }
  if (size > UPLOAD_MAX_BYTES) {
    return {
      error: `File exceeds the ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)}MB cap`,
      status: 413,
    };
  }
  return null;
}

/**
 * Create the application + document rows for a stored ACFR blob and write the
 * human audit row. Returns the new applicationId.
 */
export async function recordAcfrUpload(input: {
  storageKey: string;
  filename: string;
  sizeBytes: number;
  metadata: UploadMetadata;
}): Promise<{ applicationId: string }> {
  const { storageKey, filename, sizeBytes, metadata } = input;
  const db = await getDb();
  const [app] = await db
    .insert(schema.applications)
    .values({
      districtName: metadata.districtName,
      state: metadata.state,
      fiscalYearEnd: metadata.fiscalYearEnd,
      status: "intake",
    })
    .returning();
  await db.insert(schema.documents).values({
    applicationId: app.id,
    kind: "acfr",
    filename,
    storageKey,
    sizeBytes,
    textQuality: "unknown",
  });

  await writeAudit("human", "acfr_uploaded", null, {
    applicationId: app.id,
    filename,
    sizeBytes,
  });

  return { applicationId: app.id };
}
