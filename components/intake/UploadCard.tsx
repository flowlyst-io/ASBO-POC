"use client";

import * as React from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import InfoIcon from "@mui/icons-material/Info";

import { viewerTokens } from "@/lib/theme";

/** Demo sample identifiers accepted by POST /api/demo. */
export type SampleId =
  | "rockford_il_fy2023"
  | "davenport_ia_fy2023"
  | "griffin_spalding_ga_fy2023";

export interface UploadCardProps {
  onLoadSample: (sampleId: SampleId) => void;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Screen 1 upload card: dashed dropzone with drag-over highlight, hidden
 * multi-PDF file input behind "Browse files", and "Load sample" buttons for
 * the three pre-loaded demo ACFRs. Info strip below the dropzone.
 */
export default function UploadCard({ onLoadSample, onFiles, disabled = false }: UploadCardProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) onFiles(files);
    e.target.value = "";
  };

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
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
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Browse files
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderSpecialIcon />}
            disabled={disabled}
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
            disabled={disabled}
            onClick={() => onLoadSample("rockford_il_fy2023")}
          >
            Sample: Rockford IL
          </Button>
          <Button
            size="small"
            disabled={disabled}
            onClick={() => onLoadSample("griffin_spalding_ga_fy2023")}
          >
            Sample: Griffin-Spalding GA
          </Button>
        </Box>
      </Box>

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
