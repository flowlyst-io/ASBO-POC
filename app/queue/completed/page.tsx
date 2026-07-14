"use client";

import * as React from "react";
import { Alert } from "@mui/material";

import AppShell from "@/components/shell/AppShell";
import PageContainer from "@/components/shell/PageContainer";
import ApplicationsTable from "@/components/applications/ApplicationsTable";
import { useApplications } from "@/lib/hooks/useApplications";

/** My queue — applications whose review run is complete. */
export default function CompletedQueuePage() {
  const { data, error, loading } = useApplications();

  const rows = (data?.applications ?? []).filter(
    (app) => app.latestRunStatus === "complete",
  );

  return (
    <AppShell>
      <PageContainer
        maxWidth={1280}
        title="Completed"
        subtitle="Reviews marked ready for decision — the AI never issues the decision."
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <ApplicationsTable
          rows={rows}
          showAssign={false}
          emptyLabel={
            loading ? "Loading…" : "No completed reviews yet."
          }
        />
      </PageContainer>
    </AppShell>
  );
}
