"use client";

import * as React from "react";
import Link from "next/link";
import { Alert, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import AppShell from "@/components/shell/AppShell";
import PageContainer from "@/components/shell/PageContainer";
import ApplicationsTable from "@/components/applications/ApplicationsTable";
import { useApplications } from "@/lib/hooks/useApplications";
import { useReviewers } from "@/lib/hooks/useReviewers";

/** Applications list — the workspace home screen. */
export default function ApplicationsPage() {
  const { data, error, loading, refresh } = useApplications();
  const { data: reviewersData } = useReviewers();

  return (
    <AppShell>
      <PageContainer
        maxWidth={1280}
        title="Applications"
        subtitle="FY2023 cycle · all submissions"
        action={
          <Button
            component={Link}
            href="/intake"
            variant="contained"
            startIcon={<AddIcon />}
          >
            New application
          </Button>
        }
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <ApplicationsTable
          rows={data?.applications ?? []}
          reviewers={reviewersData?.reviewers}
          showAssign
          onAssigned={refresh}
          emptyLabel={
            loading
              ? "Loading applications…"
              : "No applications yet — start a new intake to load one."
          }
        />
      </PageContainer>
    </AppShell>
  );
}
