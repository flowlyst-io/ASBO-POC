"use client";

import * as React from "react";
import Link from "next/link";
import {
  Box,
  Breadcrumbs,
  Chip,
  Divider,
  LinearProgress,
  Link as MuiLink,
  Typography,
} from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
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
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Screen 2 application context bar: breadcrumb, district, sub line, stats. */
export default function ContextBar({ run, findings, reviewers, onAssigned }: ContextBarProps) {
  const total = findings.length;
  const reviewed = findings.filter((f) => f.review !== null).length;
  const flagged = findings.filter((f) => f.verifierStatus === "flagged").length;
  const progress = total > 0 ? (reviewed / total) * 100 : 0;

  const { application } = run;

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        px: 3,
        py: 1.75,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 3,
      }}
    >
      <Box sx={{ minWidth: 0, flex: "1 1 380px" }}>
        <Breadcrumbs sx={{ fontSize: 13 }}>
          <MuiLink component={Link} href="/" underline="hover" sx={{ fontSize: 13 }}>
            Applications
          </MuiLink>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Review cycle</Typography>
          <Typography noWrap sx={{ fontSize: 13, color: "text.primary" }}>
            {application.districtName}
          </Typography>
        </Breadcrumbs>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mt: 0.25 }}>
          <Typography noWrap component="h1" sx={{ fontSize: 22, fontWeight: 500 }}>
            {application.districtName}
          </Typography>
          {run.classification && (
            <Chip
              size="small"
              icon={<WorkspacePremiumIcon />}
              label={CLASSIFICATION_LABEL[run.classification]}
              color={classificationColor(run.classification)}
            />
          )}
        </Box>
        <Typography noWrap sx={{ fontSize: 13, color: "text.secondary", mt: 0.25 }}>
          {application.filename} · Fiscal Year ended {formatFiscalYearEnd(application.fiscalYearEnd)} ·{" "}
          {application.state} · {application.pageCount ?? "—"} pages · COE checklist{" "}
          {run.checklistVersion}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {run.gatePassed ? (
              <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
            ) : (
              <PendingIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            )}
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
              {run.gatePassed ? "Completeness passed" : "Completeness pending"}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
            {run.gatePassed ? "Intake gate cleared" : "Gate not yet cleared"}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ height: 34, alignSelf: "center" }} />

        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <VerifiedIcon sx={{ fontSize: 16, color: "info.main" }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
              Verifier: {run.verifierConfirmedCount}/{run.findingsCount} confirmed
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
            {flagged > 0
              ? `${flagged} citation${flagged === 1 ? "" : "s"} downgraded`
              : "All citations verified"}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ height: 34, alignSelf: "center" }} />

        <Box sx={{ minWidth: 130 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
            {reviewed} of {total} reviewed
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
          />
        </Box>

        {reviewers && (
          <>
            <Divider orientation="vertical" flexItem sx={{ height: 34, alignSelf: "center" }} />
            <Box>
              <Typography sx={{ fontSize: 11.5, color: "text.secondary", mb: 0.25 }}>
                Reviewer
              </Typography>
              <AssignMenu
                application={{
                  id: run.applicationId,
                  state: application.state,
                  assignedReviewer: application.assignedReviewer,
                }}
                reviewers={reviewers}
                onAssigned={onAssigned ?? (() => undefined)}
              />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
