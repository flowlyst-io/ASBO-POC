"use client";

import * as React from "react";
import { Alert } from "@mui/material";

import AppShell from "@/components/shell/AppShell";
import PageContainer from "@/components/shell/PageContainer";
import ApplicationsTable from "@/components/applications/ApplicationsTable";
import { useApplications } from "@/lib/hooks/useApplications";
import { useNavCounts } from "@/lib/hooks/useNavCounts";

/** My queue — open applications assigned to the demo reviewer. */
export default function AssignedQueuePage() {
  const { data, error, loading } = useApplications();
  const { data: counts } = useNavCounts();

  const me = counts?.me;
  const rows = (data?.applications ?? []).filter(
    (app) =>
      me !== undefined &&
      app.assignedReviewer?.id === me.id &&
      app.latestRunStatus !== "complete",
  );

  return (
    <AppShell>
      <PageContainer
        maxWidth={1280}
        title="Assigned to me"
        subtitle="Open applications in your queue — findings are AI-prepared; every outcome is yours."
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
            loading || (me === undefined && !error)
              ? "Loading your queue…"
              : "Nothing assigned to you yet — assign applications from the Applications list."
          }
        />
      </PageContainer>
    </AppShell>
  );
}
