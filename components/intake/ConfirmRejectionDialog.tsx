"use client";

import * as React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import type { GateCheckResult } from "@/lib/types";

import { CHECK_LABELS, GateCheckIcon } from "./gateCheckLabels";

export interface ConfirmRejectionDialogProps {
  open: boolean;
  districtName: string;
  /** Non-pass gate checks only — pre-filtered by the caller. */
  checks: GateCheckResult[];
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * The human-confirmation step for a completeness rejection (PRD F2 safety
 * rail): shows the generated explanation per flagged check before the
 * reviewer records the rejection. The AI only flags — this decision is human.
 */
export default function ConfirmRejectionDialog({
  open,
  districtName,
  checks,
  confirming,
  onClose,
  onConfirm,
}: ConfirmRejectionDialogProps) {
  return (
    <Dialog open={open} onClose={confirming ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 18, fontWeight: 500 }}>
        Confirm completeness rejection
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
          The completeness gate flagged {checks.length}{" "}
          {checks.length === 1 ? "check" : "checks"} for {districtName}. Review the generated
          explanation below — confirming records the rejection decision.
        </Typography>

        {checks.map((check) => (
          <Box
            key={check.checkKey}
            sx={{ display: "flex", gap: 1.25, py: 1.1, borderTop: 1, borderColor: "divider" }}
          >
            <Box sx={{ pt: 0.2 }}>
              <GateCheckIcon status={check.status} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                {CHECK_LABELS[check.checkKey]}
              </Typography>
              {check.explanation && (
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>
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
          </Box>
        ))}

        <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 2 }}>
          Nothing is sent to the applicant in this POC — confirming records the human decision
          and the explanation to the audit trail.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={confirming}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={confirming}
          startIcon={confirming ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Confirm rejection
        </Button>
      </DialogActions>
    </Dialog>
  );
}
