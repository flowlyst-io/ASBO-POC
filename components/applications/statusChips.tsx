"use client";

import * as React from "react";
import { Chip } from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";

import type { Classification, RunStatus } from "@/lib/types";

type ChipColor = "default" | "primary" | "success" | "error" | "warning";

const RUN_STATUS_CHIP: Record<RunStatus, { label: string; color: ChipColor }> = {
  queued: { label: "Processing", color: "default" },
  running: { label: "Processing", color: "default" },
  awaiting_review: { label: "Awaiting review", color: "primary" },
  complete: { label: "Complete", color: "success" },
  failed: { label: "Failed", color: "error" },
  canceled: { label: "Canceled", color: "default" },
  rejected: { label: "Rejected", color: "error" },
};

/** Pipeline-run status pill for list rows; null renders an outlined "No run". */
export function RunStatusChip({ status }: { status: RunStatus | null }) {
  if (status === null) {
    return <Chip size="small" variant="outlined" label="No run" />;
  }
  const { label, color } = RUN_STATUS_CHIP[status];
  return <Chip size="small" color={color} label={label} />;
}

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  best: "Best",
  better: "Better",
  good: "Good",
  poor: "Poor",
};

function classificationColor(c: Classification): "success" | "default" | "warning" {
  if (c === "best" || c === "better") return "success";
  if (c === "good") return "default";
  return "warning";
}

/** Quality-classification badge (same mapping as the review ContextBar). */
export function ClassificationChip({
  classification,
}: {
  classification: Classification | null;
}) {
  if (!classification) return null;
  return (
    <Chip
      size="small"
      icon={<WorkspacePremiumIcon />}
      label={CLASSIFICATION_LABEL[classification]}
      color={classificationColor(classification)}
    />
  );
}
