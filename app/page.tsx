"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Chip } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import AppShell from "@/components/shell/AppShell";
import PageContainer from "@/components/shell/PageContainer";
import ApplicationsTable from "@/components/applications/ApplicationsTable";
import { useApplications } from "@/lib/hooks/useApplications";
import { useReviewers } from "@/lib/hooks/useReviewers";

/** Applications list body — reads ?q= (top-bar search), so needs Suspense. */
function ApplicationsPageInner() {
  const router = useRouter();
  const q = (useSearchParams().get("q") ?? "").trim();
  const { data, error, loading, refresh } = useApplications();
  const { data: reviewersData } = useReviewers();

  const lower = q.toLowerCase();
  const rows = (data?.applications ?? []).filter(
    (a) =>
      !lower ||
      a.districtName.toLowerCase().includes(lower) ||
      a.state.toLowerCase().includes(lower),
  );

  return (
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
      {q && (
        <Chip
          label={`Showing results for “${q}”`}
          onDelete={() => router.push("/")}
          sx={{ mb: 2 }}
        />
      )}
      <ApplicationsTable
        rows={rows}
        reviewers={reviewersData?.reviewers}
        showAssign
        onAssigned={refresh}
        emptyLabel={
          loading
            ? "Loading applications…"
            : q
              ? `No applications match “${q}”.`
              : "No applications yet — start a new intake to load one."
        }
      />
    </PageContainer>
  );
}

/** Applications list — the workspace home screen. */
export default function ApplicationsPage() {
  return (
    <AppShell>
      <React.Suspense>
        <ApplicationsPageInner />
      </React.Suspense>
    </AppShell>
  );
}
