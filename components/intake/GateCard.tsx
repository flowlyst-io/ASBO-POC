"use client";

import * as React from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, Button, Chip, Paper, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import {
  GATE_CHECK_KEYS,
  type GateCheckKey,
  type GateCheckResult,
  type GateStatus,
  type RunStatus,
} from "@/lib/types";

import { CHECK_LABELS, GateCheckIcon } from "./gateCheckLabels";

export interface GateCardProps {
  gateChecks: GateCheckResult[];
  /** Latest run status; null when no run has been started. */
  runStatus: RunStatus | null;
  /** RunStatusPayload.gatePassed for the current run (null while pending). */
  gatePassed?: boolean | null;
  /** RunStatusPayload.gateOverride — human chose to proceed despite the flag. */
  gateOverride?: boolean;
  /** True while a confirm/override request is in flight. */
  actionPending?: boolean;
  onOpenReview: () => void;
  onConfirmRejection?: () => void;
  onOverride?: () => void;
}

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

/** Screen 1 completeness gate card: status chip, six check rows, and the
 * flagged-state banner where a human confirms or overrides the rejection. */
export default function GateCard({
  gateChecks,
  runStatus,
  gatePassed = null,
  gateOverride = false,
  actionPending = false,
  onOpenReview,
  onConfirmRejection,
  onOverride,
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
  if (runStatus === "rejected") {
    chip = { label: "Rejected", color: "error" };
  } else if (gateOverride) {
    chip = { label: "Overridden", color: "warning" };
  } else if (runStatus === null) {
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

  const showPassedBanner =
    gatePassed !== false &&
    allPassed &&
    (runStatus === "awaiting_review" || runStatus === "complete" || runStatus === "running");
  const showFlaggedBanner =
    runStatus === "awaiting_review" && gatePassed === false && !gateOverride;
  const showRejectedBanner = runStatus === "rejected";
  const showOverrideBanner =
    gateOverride && (runStatus === "awaiting_review" || runStatus === "complete");
  // Once the gate has settled on a failure, surface each generated explanation.
  const showExplanations = gatePassed === false;

  const bannerBoxSx = (color: string, tint: number) => ({
    display: "flex",
    alignItems: "center",
    gap: 1,
    p: 1.5,
    borderRadius: "6px",
    bgcolor: alpha(color, tint),
  });

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>Completeness gate</Typography>
        <Chip label={chip.label} color={chip.color} size="small" />
      </Box>

      {GATE_CHECK_KEYS.map((key) => {
        const check = byKey.get(key);
        const status = check?.status ?? "pending";
        const flaggedRow = status === "fail" || status === "needs_human";
        return (
          <Box key={key} sx={{ py: 0.9, borderTop: 1, borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <GateCheckIcon status={status} />
              <Typography sx={{ flex: 1, fontSize: 13 }}>{CHECK_LABELS[key]}</Typography>
              <CheckRowStatus status={status} />
            </Box>
            {showExplanations && flaggedRow && check?.explanation && (
              <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5, ml: 3.75 }}>
                {check.explanation}
                {check.page !== null && (
                  <Box component="span" sx={{ color: "text.disabled" }}>
                    {" "}
                    (p. {check.page})
                  </Box>
                )}
              </Typography>
            )}
          </Box>
        );
      })}

      <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 1.5 }}>
        If any check fails, the submission is auto-flagged for rejection with a generated
        explanation — a human confirms before it&apos;s sent.
      </Typography>

      {showPassedBanner && (
        <Box sx={{ mt: 2 }}>
          <Box sx={bannerBoxSx(theme.palette.success.main, 0.1)}>
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

      {showFlaggedBanner && (
        <Box sx={{ mt: 2 }}>
          <Box sx={bannerBoxSx(theme.palette.error.main, 0.12)}>
            <CancelIcon sx={{ fontSize: 18, color: "error.main" }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: "error.dark" }}>
              Completeness flagged — a human must confirm the rejection
            </Typography>
          </Box>
          <Button
            fullWidth
            variant="contained"
            color="error"
            onClick={onConfirmRejection}
            disabled={actionPending}
            sx={{ mt: 1.5 }}
          >
            Confirm rejection
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={onOverride}
            disabled={actionPending}
            sx={{ mt: 1 }}
          >
            Override &amp; proceed to review
          </Button>
        </Box>
      )}

      {showRejectedBanner && (
        <Box sx={{ ...bannerBoxSx(theme.palette.error.main, 0.12), mt: 2 }}>
          <CancelIcon sx={{ fontSize: 18, color: "error.main" }} />
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: "error.dark" }}>
            Rejection confirmed — application marked rejected
          </Typography>
        </Box>
      )}

      {showOverrideBanner && (
        <Box sx={{ mt: 2 }}>
          <Box sx={bannerBoxSx(theme.palette.warning.main, 0.14)}>
            <CheckCircleIcon sx={{ fontSize: 18, color: "warning.main" }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#B35300" }}>
              Gate overridden — findings prepared for review
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
