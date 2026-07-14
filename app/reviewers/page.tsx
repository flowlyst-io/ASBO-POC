"use client";

import * as React from "react";
import { Alert } from "@mui/material";

import AppShell from "@/components/shell/AppShell";
import PageContainer from "@/components/shell/PageContainer";
import ReviewersTable from "@/components/reviewers/ReviewersTable";
import { useReviewers } from "@/lib/hooks/useReviewers";

/** Reviewer roster with workload counts; same-state assignments are recused. */
export default function ReviewersPage() {
  const { data, error } = useReviewers();

  return (
    <AppShell>
      <PageContainer
        maxWidth={1080}
        title="Reviewers"
        subtitle="State association reviewers — assignments recuse reviewers from their own state."
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <ReviewersTable rows={data?.reviewers ?? []} />
      </PageContainer>
    </AppShell>
  );
}
