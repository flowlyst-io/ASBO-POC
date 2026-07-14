"use client";

import * as React from "react";
import { Box, Button, Chip, Paper, Typography } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export type UploadedFileKind = "ACFR" | "Application" | "Checklist";

export interface UploadedFile {
  name: string;
  size: string;
  kind: UploadedFileKind;
}

export interface UploadedFilesCardProps {
  files: UploadedFile[];
  /** True once the extraction step has completed for the current run. */
  extracted: boolean;
  onReset: () => void;
}

const KIND_CHIP_COLOR: Record<UploadedFileKind, "primary" | "info" | "secondary"> = {
  ACFR: "primary",
  Application: "info",
  Checklist: "secondary",
};

/** Screen 1 list of chosen/loaded files with kind chip and extraction status. */
export default function UploadedFilesCard({ files, extracted, onReset }: UploadedFilesCardProps) {
  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>Uploaded files</Typography>
        <Button size="small" startIcon={<RestartAltIcon />} onClick={onReset}>
          Reset
        </Button>
      </Box>

      {files.map((file) => (
        <Box
          key={file.name}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1.25,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <PictureAsPdfIcon sx={{ fontSize: 26, color: "error.main" }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>
              {file.name}
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{file.size}</Typography>
          </Box>
          <Chip
            label={file.kind}
            size="small"
            variant="outlined"
            color={KIND_CHIP_COLOR[file.kind]}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {extracted ? (
              <>
                <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
                <Typography sx={{ fontSize: 12, color: "success.main", fontWeight: 500 }}>
                  Extracted
                </Typography>
              </>
            ) : (
              <>
                <HourglassTopIcon sx={{ fontSize: 16, color: "primary.main" }} />
                <Typography sx={{ fontSize: 12, color: "primary.main", fontWeight: 500 }}>
                  Uploading…
                </Typography>
              </>
            )}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}
