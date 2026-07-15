"use client";

import * as React from "react";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";

import type { GateCheckKey, GateStatus } from "@/lib/types";

/** Shared by GateCard, ConfirmRejectionDialog, and the review-page gate guard. */
export const CHECK_LABELS: Record<GateCheckKey, string> = {
  clean_opinion: "Auditor's report — unmodified (clean) opinion",
  mdna_present: "MD&A present",
  basic_statements: "Required basic financial statements & notes",
  statistical_section: "Statistical section present",
  coe_checklist_attached: "COE checklist attached",
  application_form_fee: "Application form & fee status",
};

export function GateCheckIcon({ status }: { status: GateStatus }) {
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
