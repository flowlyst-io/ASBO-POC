"use client";

import * as React from "react";
import { Alert, Box, Paper, Stack, Typography } from "@mui/material";

import AppShell from "@/components/shell/AppShell";
import PageContainer from "@/components/shell/PageContainer";
import StatTile from "@/components/metrics/StatTile";
import RateBar from "@/components/metrics/RateBar";
import CostTable from "@/components/metrics/CostTable";
import { useMetrics } from "@/lib/hooks/useMetrics";
import type { RunStatus } from "@/lib/types";

const STATUS_ORDER: readonly RunStatus[] = [
  "queued",
  "running",
  "awaiting_review",
  "complete",
  "failed",
  "canceled",
  "rejected",
];

const STATUS_LABEL: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  awaiting_review: "Awaiting review",
  complete: "Complete",
  failed: "Failed",
  canceled: "Canceled",
  rejected: "Rejected",
};

/** PRD F7 metrics: processing volume, quality rates, and AI usage. */
export default function MetricsPage() {
  const { data, error, loading } = useMetrics();

  const statusRows = STATUS_ORDER.map((status) => ({
    status,
    count: data?.runsByStatus[status] ?? 0,
  })).filter((row) => row.count > 0);
  const maxStatusCount = Math.max(1, ...statusRows.map((r) => r.count));

  return (
    <AppShell>
      <PageContainer
        maxWidth={1280}
        title="Metrics"
        subtitle="PRD F7 · processing volume, quality rates, and AI usage per application"
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <StatTile
            label="Applications processed"
            value={data ? String(data.applicationsProcessed) : "—"}
            caption="Runs that reached the pipeline"
          />
          <StatTile
            label="Total findings"
            value={data ? String(data.totalFindings) : "—"}
            caption="AI-prepared, page-cited findings"
          />
          <StatTile
            label="Total reviews"
            value={data ? String(data.totalReviews) : "—"}
            caption="Human decisions on findings"
          />
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mt: 3, alignItems: "flex-start" }}>
          <Paper elevation={1} sx={{ flex: "1 1 420px", minWidth: 320, p: 2.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 500 }}>Quality rates</Typography>
            <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 2 }}>
              How the gate, reviewers, and verifier interact with AI findings
            </Typography>
            <Stack spacing={2.5}>
              <RateBar
                label="Completeness rejection rate"
                value={data?.completenessRejectionRate ?? null}
                caption="Share of runs stopped at the completeness gate"
              />
              <RateBar
                label="Human overturn rate"
                value={data?.humanOverturnRate ?? null}
                caption="AI findings rejected or edited by a reviewer"
              />
              <RateBar
                label="Verifier catch rate"
                value={data?.verifierCatchRate ?? null}
                caption="Citations the verifier flagged for a second look"
              />
            </Stack>
            <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 2.5 }}>
              Avg findings per application:{" "}
              <Box component="span" sx={{ fontWeight: 500, color: "text.primary" }}>
                {data?.avgFindingsPerApplication != null
                  ? data.avgFindingsPerApplication.toFixed(1)
                  : "—"}
              </Box>
            </Typography>
          </Paper>

          <Paper elevation={1} sx={{ flex: "1 1 360px", minWidth: 300, p: 2.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 500 }}>Runs by status</Typography>
            <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 2 }}>
              Pipeline runs across the cycle
            </Typography>
            {statusRows.length === 0 ? (
              <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
                {loading ? "Loading…" : "No runs yet."}
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {statusRows.map((row) => (
                  <Box key={row.status} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography sx={{ fontSize: 13, width: 118, flexShrink: 0 }}>
                      {STATUS_LABEL[row.status]}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          height: 8,
                          width: `${(row.count / maxStatusCount) * 100}%`,
                          minWidth: 4,
                          bgcolor: "primary.main",
                          borderRadius: "0 4px 4px 0",
                        }}
                      />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontVariantNumeric: "tabular-nums",
                        width: 28,
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {row.count}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>

        <Box sx={{ mt: 3 }}>
          <CostTable rows={data?.runCosts ?? []} />
        </Box>
      </PageContainer>
    </AppShell>
  );
}
