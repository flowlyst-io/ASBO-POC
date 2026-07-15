"use client";

import * as React from "react";
import Link from "next/link";
import {
  Box,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import VerifiedIcon from "@mui/icons-material/Verified";

import AssignMenu from "@/components/applications/AssignMenu";
import type { Classification, Finding, ReviewerSummary, RunStatusPayload } from "@/lib/types";

export interface ContextBarProps {
  run: RunStatusPayload;
  findings: Finding[];
  /** Reviewer roster for the assignment menu; omit to hide the control. */
  reviewers?: ReviewerSummary[];
  /** Called after a successful (un)assign so the caller can refetch the run. */
  onAssigned?: () => void;
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

function formatFiscalYearEnd(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Screen 2 application context bar — a single compact row so the criteria
 *  and the document get the vertical space. */
export default function ContextBar({ run, findings, reviewers, onAssigned }: ContextBarProps) {
  const total = findings.length;
  const reviewed = findings.filter((f) => f.review !== null).length;
  const flagged = findings.filter((f) => f.verifierStatus === "flagged").length;
  const progress = total > 0 ? (reviewed / total) * 100 : 0;

  const { application } = run;
  const meta = `${application.filename} · FYE ${formatFiscalYearEnd(application.fiscalYearEnd)} · ${application.state} · ${application.pageCount ?? "—"} pages · ${run.checklistVersion}`;

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        px: 1.5,
        py: 0.5,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flex: "1 1 340px" }}>
        <IconButton
          size="small"
          component={Link}
          href="/"
          aria-label="back to applications"
          sx={{ color: "text.secondary", flexShrink: 0 }}
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Typography noWrap component="h1" sx={{ fontSize: 15, fontWeight: 600, flexShrink: 0, maxWidth: 320 }}>
          {application.districtName}
        </Typography>
        {run.classification && (
          <Chip
            size="small"
            icon={<WorkspacePremiumIcon />}
            label={CLASSIFICATION_LABEL[run.classification]}
            color={classificationColor(run.classification)}
            sx={{ height: 22, fontSize: 11.5, flexShrink: 0 }}
          />
        )}
        <Tooltip title={meta}>
          <Typography noWrap sx={{ fontSize: 11.5, color: "text.secondary", minWidth: 0 }}>
            {meta}
          </Typography>
        </Tooltip>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0 }}>
        <Tooltip
          title={
            run.gatePassed
              ? "Completeness gate cleared at intake"
              : run.gateOverride
                ? "Completeness gate flagged — overridden by reviewer"
                : "Completeness gate not yet cleared"
          }
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {run.gatePassed ? (
              <CheckCircleIcon sx={{ fontSize: 15, color: "success.main" }} />
            ) : run.gateOverride ? (
              <ReportProblemOutlinedIcon sx={{ fontSize: 15, color: "warning.main" }} />
            ) : (
              <PendingIcon sx={{ fontSize: 15, color: "text.disabled" }} />
            )}
            <Typography sx={{ fontSize: 12, fontWeight: 500 }}>
              {run.gatePassed ? "Gate passed" : run.gateOverride ? "Gate overridden" : "Gate pending"}
            </Typography>
          </Box>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ height: 18, alignSelf: "center" }} />

        <Tooltip
          title={
            flagged > 0
              ? `${flagged} citation${flagged === 1 ? "" : "s"} downgraded — needs human`
              : "All citations independently verified"
          }
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <VerifiedIcon sx={{ fontSize: 15, color: "info.main" }} />
            <Typography sx={{ fontSize: 12, fontWeight: 500 }}>
              {run.verifierConfirmedCount}/{run.findingsCount} verified
              {flagged > 0 ? ` · ${flagged} flagged` : ""}
            </Typography>
          </Box>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ height: 18, alignSelf: "center" }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>
            {reviewed}/{total} reviewed
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 5, borderRadius: 3, width: 64 }}
          />
        </Box>

        {reviewers && (
          <>
            <Divider orientation="vertical" flexItem sx={{ height: 18, alignSelf: "center" }} />
            <AssignMenu
              application={{
                id: run.applicationId,
                state: application.state,
                assignedReviewer: application.assignedReviewer,
              }}
              reviewers={reviewers}
              onAssigned={onAssigned ?? (() => undefined)}
            />
          </>
        )}
      </Box>
    </Box>
  );
}
