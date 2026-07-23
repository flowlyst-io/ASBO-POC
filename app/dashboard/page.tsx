"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Paper, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RateReviewIcon from "@mui/icons-material/RateReview";

import AppShell from "@/components/shell/AppShell";
import PageContainer from "@/components/shell/PageContainer";
import ApplicationsTable from "@/components/applications/ApplicationsTable";
import { ClassificationChip } from "@/components/applications/statusChips";
import StatTile from "@/components/metrics/StatTile";
import { useApplications } from "@/lib/hooks/useApplications";
import { useMetrics } from "@/lib/hooks/useMetrics";
import type { ApplicationListItem } from "@/lib/types";

function sectionTitle(text: string, caption: string) {
  return (
    <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{text}</Typography>
      <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{caption}</Typography>
    </Box>
  );
}

/** Compact token count for stat tiles: 12_340 → "12.3k", 2_400_000 → "2.4M". */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Workspace dashboard: KPI row, needs-attention queue, recent applications. */
export default function DashboardPage() {
  const router = useRouter();
  const { data: appsData, error: appsError, loading } = useApplications();
  const { data: metrics } = useMetrics();

  const applications = appsData?.applications ?? [];
  const awaiting = applications.filter((a) => a.latestRunStatus === "awaiting_review");
  const completed = applications.filter((a) => a.latestRunStatus === "complete");
  const recent = [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const openReview = (app: ApplicationListItem) => {
    if (app.latestRunId) router.push(`/review/${app.latestRunId}`);
  };

  return (
    <AppShell>
      <PageContainer
        maxWidth={1280}
        title="Dashboard"
        subtitle="FY2023 review cycle at a glance — AI prepares findings, reviewers decide."
      >
        {appsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {appsError}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <StatTile
            label="Applications"
            value={loading ? "—" : String(applications.length)}
            caption="FY2023 cycle submissions"
          />
          <StatTile
            label="Awaiting review"
            value={loading ? "—" : String(awaiting.length)}
            caption="Findings prepared, needs a human"
          />
          <StatTile
            label="Completed"
            value={loading ? "—" : String(completed.length)}
            caption="Reviews marked ready for decision"
          />
          <StatTile
            label="Total AI tokens"
            value={metrics ? formatTokens(metrics.totalTokens) : "—"}
            caption="All pipeline runs, audited LLM calls"
          />
        </Box>

        <Paper elevation={1} sx={{ mt: 3, overflow: "hidden" }}>
          {sectionTitle("Needs attention", "Applications with prepared findings awaiting human review")}
          {awaiting.length === 0 ? (
            <Typography sx={{ px: 2.5, pb: 2.5, fontSize: 13.5, color: "text.secondary" }}>
              {loading ? "Loading…" : "Nothing awaiting review right now."}
            </Typography>
          ) : (
            <Box sx={{ pb: 1 }}>
              {awaiting.map((app) => (
                <Box
                  key={app.id}
                  onClick={() => openReview(app)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2.5,
                    py: 1.25,
                    cursor: "pointer",
                    borderTop: 1,
                    borderColor: "divider",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <RateReviewIcon sx={{ fontSize: 20, color: "primary.main" }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
                      {app.districtName}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 12, color: "text.secondary" }}>
                      {app.state} · {app.assignedReviewer ? `Assigned to ${app.assignedReviewer.name}` : "Unassigned"}
                    </Typography>
                  </Box>
                  <ClassificationChip classification={app.classification} />
                  <ChevronRightIcon sx={{ fontSize: 20, color: "text.disabled" }} />
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 500, mb: 1 }}>
            Recent applications
          </Typography>
          <ApplicationsTable
            rows={recent}
            limit={5}
            showAssign={false}
            emptyLabel={loading ? "Loading applications…" : "No applications yet."}
          />
        </Box>
      </PageContainer>
    </AppShell>
  );
}
