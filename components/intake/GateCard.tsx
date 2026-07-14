"use client";

import * as React from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, Button, Chip, Paper, Typography } from "@mui/material";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import {
  GATE_CHECK_KEYS,
  type GateCheckKey,
  type GateCheckResult,
  type GateStatus,
  type RunStatus,
} from "@/lib/types";

export interface GateCardProps {
  gateChecks: GateCheckResult[];
  /** Latest run status; null when no run has been started. */
  runStatus: RunStatus | null;
  /** RunStatusPayload.gatePassed for the current run (null while pending). */
  gatePassed?: boolean | null;
  onOpenReview: () => void;
}

const CHECK_LABELS: Record<GateCheckKey, string> = {
  clean_opinion: "Auditor's report — unmodified (clean) opinion",
  mdna_present: "MD&A present",
  basic_statements: "Required basic financial statements & notes",
  statistical_section: "Statistical section present",
  coe_checklist_attached: "COE checklist attached",
  application_form_fee: "Application form & fee status",
};

function CheckRowStatus({ status }: { status: GateStatus }) {
  switch (status) {
    case "pass":
      return (
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "success.main" }}>Pass</Typography>
      );
    case "fail":
      return (
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "error.main" }}>Fail</Typography>
      );
    case "needs_human":
      return (
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "warning.main" }}>
          Needs human
        </Typography>
      );
    default:
      return <Typography sx={{ fontSize: 12, color: "text.disabled" }}>—</Typography>;
  }
}

function CheckRowIcon({ status }: { status: GateStatus }) {
  const sx = { fontSize: 18 } as const;
  switch (status) {
    case "pass":
      return <CheckCircleIcon sx={{ ...sx, color: "success.main" }} />;
    case "fail":
      return <CancelIcon sx={{ ...sx, color: "error.main" }} />;
    case "needs_human":
      return <HelpOutlineIcon sx={{ ...sx, color: "warning.main" }} />;
    default:
      return <RadioButtonUncheckedIcon sx={{ ...sx, color: "rgba(0,0,0,0.28)" }} />;
  }
}

/** Screen 1 completeness gate card: status chip, six check rows, pass banner. */
export default function GateCard({
  gateChecks,
  runStatus,
  gatePassed = null,
  onOpenReview,
}: GateCardProps) {
  const theme = useTheme();

  const byKey = new Map<GateCheckKey, GateCheckResult>(
    gateChecks.map((c) => [c.checkKey, c]),
  );
  const statuses = GATE_CHECK_KEYS.map((key) => byKey.get(key)?.status ?? "pending");
  const allPassed = statuses.every((s) => s === "pass");
  const anyFlagged = statuses.some((s) => s === "fail" || s === "needs_human");
  const anyPending = statuses.some((s) => s === "pending");

  let chip: { label: string; color: "default" | "warning" | "success" | "error" };
  if (runStatus === null) {
    chip = { label: "Awaiting files", color: "default" };
  } else if (runStatus === "queued") {
    chip = { label: "Queued", color: "default" };
  } else if (gatePassed === false || (anyFlagged && !anyPending)) {
    chip = { label: "Flagged", color: "error" };
  } else if (allPassed || gatePassed === true) {
    chip = { label: "Passed", color: "success" };
  } else {
    chip = { label: "Checking…", color: "warning" };
  }

  const showBanner =
    gatePassed !== false &&
    allPassed &&
    (runStatus === "awaiting_review" || runStatus === "complete" || runStatus === "running");

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>Completeness gate</Typography>
        <Chip label={chip.label} color={chip.color} size="small" />
      </Box>

      {GATE_CHECK_KEYS.map((key) => {
        const status = byKey.get(key)?.status ?? "pending";
        return (
          <Box
            key={key}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              py: 0.9,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <CheckRowIcon status={status} />
            <Typography sx={{ flex: 1, fontSize: 13 }}>{CHECK_LABELS[key]}</Typography>
            <CheckRowStatus status={status} />
          </Box>
        );
      })}

      <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 1.5 }}>
        If any check fails, the submission is auto-flagged for rejection with a generated
        explanation — a human confirms before it&apos;s sent.
      </Typography>

      {showBanner && (
        <Box sx={{ mt: 2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1.5,
              borderRadius: "6px",
              bgcolor: alpha(theme.palette.success.main, 0.1),
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: "success.dark" }}>
              Completeness passed — ready for review
            </Typography>
          </Box>
          <Button
            fullWidth
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={onOpenReview}
            sx={{ mt: 1.5 }}
          >
            Open prepared review
          </Button>
        </Box>
      )}
    </Paper>
  );
}
