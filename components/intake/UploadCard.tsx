"use client";

import * as React from "react";
import { Alert, Box, Button, Paper, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import InfoIcon from "@mui/icons-material/Info";

import { viewerTokens } from "@/lib/theme";
import { UPLOAD_MAX_BYTES } from "@/lib/types";

/** Demo sample identifiers accepted by POST /api/demo. */
export type SampleId =
  | "rockford_il_fy2023"
  | "davenport_ia_fy2023"
  | "griffin_spalding_ga_fy2023";

export interface UploadCardProps {
  onLoadSample: (sampleId: SampleId) => void;
  onFiles: (files: File[]) => void;
  /** Called with the new applicationId once an uploaded ACFR is stored. */
  onUploaded?: (applicationId: string) => void;
  disabled?: boolean;
}

/** Which upload path the server wants; fetched from GET /api/upload. */
type UploadMode = "direct" | "server";

/**
 * Screen 1 upload card: dashed dropzone with drag-over highlight, hidden
 * multi-PDF file input behind "Browse files", and "Load sample" buttons for
 * the three pre-loaded demo ACFRs. Info strip below the dropzone.
 *
 * On file selection it stores the ACFR: in "direct" mode (Vercel Blob
 * configured) it uploads straight to Blob and then confirms via
 * /api/upload/complete; otherwise it posts multipart to /api/upload.
 */
export default function UploadCard({
  onLoadSample,
  onFiles,
  onUploaded,
  disabled = false,
}: UploadCardProps) {
  const [dragging, setDragging] = React.useState(false);
  const [mode, setMode] = React.useState<UploadMode>("server");
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let active = true;
    fetch("/api/upload")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { mode?: UploadMode } | null) => {
        if (active && (data?.mode === "direct" || data?.mode === "server")) {
          setMode(data.mode);
        }
      })
      .catch(() => {
        /* fall back to server mode */
      });
    return () => {
      active = false;
    };
  }, []);

  const uploadFile = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF files are accepted");
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      throw new Error(`File exceeds the ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)}MB cap`);
    }

    if (mode === "direct") {
      // Direct-to-Blob: bypasses the ~4.5MB serverless request-body limit.
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`uploads/${file.name}`, file, {
        access: "public",
        contentType: "application/pdf",
        handleUploadUrl: "/api/upload/token",
      });
      const res = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pathname: blob.pathname,
          filename: file.name,
          contentType: file.type || "application/pdf",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Upload failed (${res.status})`);
      }
      return ((await res.json()) as { applicationId: string }).applicationId;
    }

    // Server mode: multipart POST straight to /api/upload.
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? `Upload failed (${res.status})`);
    }
    return ((await res.json()) as { applicationId: string }).applicationId;
  };

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return;
    onFiles(files);
    setUploadError(null);
    setUploading(true);
    // The ACFR is the first selected PDF; store it and report its application.
    uploadFile(files[0])
      .then((applicationId) => onUploaded?.(applicationId))
      .catch((err: unknown) =>
        setUploadError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setUploading(false));
  };

  const busy = disabled || uploading;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) handleFiles(files);
    e.target.value = "";
  };

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        sx={{
          border: "2px dashed",
          borderColor: dragging ? "primary.main" : "rgba(0,0,0,0.25)",
          bgcolor: dragging ? "rgba(25,118,210,0.06)" : viewerTokens.dropzoneBg,
          borderRadius: "10px",
          px: 3,
          py: 5,
          textAlign: "center",
          transition: "border-color 150ms cubic-bezier(0.4,0,0.2,1), background-color 150ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <CloudUploadIcon sx={{ fontSize: 52, color: "primary.main" }} />
        <Typography sx={{ fontSize: 17, fontWeight: 500, mt: 1 }}>
          Drag &amp; drop the ACFR and application files
        </Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>
          PDF up to 25MB · ACFR, application form, and COE checklist
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            justifyContent: "center",
            flexWrap: "wrap",
            mt: 2.5,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            hidden
            onChange={handleInputChange}
          />
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Browse files"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderSpecialIcon />}
            disabled={busy}
            onClick={() => onLoadSample("davenport_ia_fy2023")}
          >
            Load sample (Davenport IA)
          </Button>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            justifyContent: "center",
            flexWrap: "wrap",
            mt: 1,
          }}
        >
          <Button
            size="small"
            disabled={busy}
            onClick={() => onLoadSample("rockford_il_fy2023")}
          >
            Sample: Rockford IL
          </Button>
          <Button
            size="small"
            disabled={busy}
            onClick={() => onLoadSample("griffin_spalding_ga_fy2023")}
          >
            Sample: Griffin-Spalding GA
          </Button>
        </Box>
      </Box>

      {uploadError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {uploadError}
        </Alert>
      )}

      <Box
        sx={{
          mt: 2,
          bgcolor: "background.default",
          borderRadius: "6px",
          p: 1.5,
          display: "flex",
          gap: 1.25,
          alignItems: "flex-start",
        }}
      >
        <InfoIcon sx={{ fontSize: 18, color: "info.main", mt: "1px" }} />
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
          The POC ships with pre-loaded public ACFRs. Production supports presigned
          direct-to-S3 uploads so large ACFRs bypass request-size limits. All documents
          stay inside Flowlyst&apos;s AWS account.
        </Typography>
      </Box>
    </Paper>
  );
}
