"use client";

import * as React from "react";
import { Box, Paper, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DescriptionIcon from "@mui/icons-material/Description";
import TableChartIcon from "@mui/icons-material/TableChart";
import SegmentIcon from "@mui/icons-material/Segment";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import CheckIcon from "@mui/icons-material/Check";

import type { RunStepState, StepKey, StepStatus } from "@/lib/types";

export interface PipelineCardProps {
  /** Polled run steps (empty until a run exists). */
  steps: RunStepState[];
  /** True once a run has been created (drives the synthetic upload row). */
  hasRun: boolean;
}

type RowState = "done" | "active" | "pending" | "failed";

interface DisplayRow {
  key: string;
  /** Backend step this row mirrors; null = synthetic upload row. */
  step: StepKey | null;
  icon: React.ReactElement;
  label: string;
  sub: string;
}

const ROWS: DisplayRow[] = [
  {
    key: "upload",
    step: null,
    icon: <CloudUploadIcon />,
    label: "Upload & secure storage",
    sub: "Files written to encrypted S3 (Flowlyst AWS)",
  },
  {
    key: "extract",
    step: "extract",
    icon: <DescriptionIcon />,
    label: "Text extraction & OCR",
    sub: "Native PDF text layer, OCR fallback",
  },
  {
    key: "tables",
    step: "tables",
    icon: <TableChartIcon />,
    label: "Table extraction",
    sub: "Financial-statement pages only",
  },
  {
    key: "segment",
    step: "segment",
    icon: <SegmentIcon />,
    label: "Section segmentation",
    sub: "Introductory · Financial · Statistical · Compliance",
  },
  {
    key: "gate",
    step: "gate",
    icon: <VerifiedUserIcon />,
    label: "Completeness gate",
    sub: "Six intake checks (F2)",
  },
];

function toRowState(status: StepStatus | undefined): RowState {
  if (status === "done" || status === "skipped") return "done";
  if (status === "running") return "active";
  if (status === "failed") return "failed";
  return "pending";
}

const STATUS_LABEL: Record<RowState, string> = {
  done: "Done",
  active: "Processing…",
  pending: "Pending",
  failed: "Failed",
};

/** Screen 1 processing pipeline card: 5 display rows driven by run_steps. */
export default function PipelineCard({ steps, hasRun }: PipelineCardProps) {
  const byStep = new Map<StepKey, StepStatus>(steps.map((s) => [s.step, s.status]));

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 500 }}>Processing pipeline</Typography>
      <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1.5 }}>
        Runs asynchronously — findings stream in as workers finish
      </Typography>

      {ROWS.map((row) => {
        const state: RowState =
          row.step === null
            ? hasRun
              ? "done"
              : "pending"
            : toRowState(byStep.get(row.step));

        const circleBg =
          state === "done"
            ? "success.main"
            : state === "active"
              ? "primary.main"
              : state === "failed"
                ? "error.main"
                : "grey.300";

        return (
          <Box
            key={row.key}
            sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: circleBg,
                color: state === "pending" ? "text.disabled" : "common.white",
                "& svg": { fontSize: 17 },
              }}
            >
              {state === "done" ? <CheckIcon /> : row.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{row.label}</Typography>
              <Typography noWrap sx={{ fontSize: 11.5, color: "text.secondary" }}>
                {row.sub}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 500,
                color:
                  state === "done"
                    ? "success.main"
                    : state === "active"
                      ? "primary.main"
                      : state === "failed"
                        ? "error.main"
                        : "text.disabled",
              }}
            >
              {STATUS_LABEL[state]}
            </Typography>
          </Box>
        );
      })}
    </Paper>
  );
}
