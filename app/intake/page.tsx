"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Breadcrumbs, Link as MuiLink, Snackbar, Typography } from "@mui/material";

import AppShell from "@/components/shell/AppShell";
import UploadCard, { type SampleId } from "@/components/intake/UploadCard";
import UploadedFilesCard, {
  type UploadedFile,
  type UploadedFileKind,
} from "@/components/intake/UploadedFilesCard";
import PipelineCard from "@/components/intake/PipelineCard";
import GateCard from "@/components/intake/GateCard";
import ConfirmRejectionDialog from "@/components/intake/ConfirmRejectionDialog";
import { useRunStatus } from "@/lib/hooks/useRunStatus";
import type { GateDecisionAction } from "@/lib/gateDecision";
import { postGateDecision } from "@/lib/gateDecision";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function guessKind(name: string): UploadedFileKind {
  const lower = name.toLowerCase();
  if (lower.includes("checklist")) return "Checklist";
  if (lower.includes("application") || lower.includes("form")) return "Application";
  return "ACFR";
}

/** Screen 1 — new application intake (upload + pipeline + completeness gate). */
export default function IntakePage() {
  const router = useRouter();
  const [localFiles, setLocalFiles] = React.useState<UploadedFile[]>([]);
  const [applicationId, setApplicationId] = React.useState<string | null>(null);
  const [runId, setRunId] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [gateActionPending, setGateActionPending] = React.useState(false);
  const [gateActionError, setGateActionError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const { run, error: runError, refresh } = useRunStatus(runId);

  const handleGateDecision = async (action: GateDecisionAction) => {
    if (!runId) return;
    setGateActionPending(true);
    setGateActionError(null);
    try {
      await postGateDecision(runId, action);
      setToast(
        action === "confirm_rejection"
          ? "Rejection confirmed and recorded to the audit trail"
          : "Gate overridden — resuming review preparation",
      );
    } catch (err) {
      setGateActionError(err instanceof Error ? err.message : String(err));
    } finally {
      // Refresh regardless: on success it picks up the new status (and
      // restarts polling after an override); on a 409 it syncs the UI with
      // whatever decision won the race.
      await refresh();
      setGateActionPending(false);
      setRejectDialogOpen(false);
    }
  };

  const startRun = async (appId: string) => {
    setApplicationId(appId);
    const runRes = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: appId }),
    });
    if (!runRes.ok) {
      const data = (await runRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? `Run start failed (${runRes.status})`);
    }
    const started = (await runRes.json()) as { runId: string };
    setRunId(started.runId);
  };

  const startDemo = async (sampleId: SampleId) => {
    setStarting(true);
    setStartError(null);
    try {
      const demoRes = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sampleId }),
      });
      if (!demoRes.ok) throw new Error(`Sample load failed (${demoRes.status})`);
      const demo = (await demoRes.json()) as { applicationId: string };
      await startRun(demo.applicationId);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const handleUploaded = async (appId: string) => {
    setStarting(true);
    setStartError(null);
    try {
      await startRun(appId);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const handleFiles = (files: File[]) => {
    setLocalFiles(
      files.map((f) => ({
        name: f.name,
        size: formatBytes(f.size),
        kind: guessKind(f.name),
      })),
    );
  };

  const handleReset = () => {
    setLocalFiles([]);
    setApplicationId(null);
    setRunId(null);
    setStartError(null);
    setRejectDialogOpen(false);
    setGateActionError(null);
  };

  // Displayed files: real run document once polling returns, else local picks.
  const files: UploadedFile[] = run
    ? [
        {
          name: run.application.filename,
          size: run.application.pageCount ? `${run.application.pageCount} pages` : "PDF",
          kind: "ACFR",
        },
      ]
    : localFiles;

  const extracted =
    run?.steps.some((s) => s.step === "extract" && s.status === "done") ?? false;

  const hasIntake = applicationId !== null || files.length > 0;

  const openReview = () => {
    if (runId) router.push(`/review/${runId}`);
  };

  return (
    <AppShell>
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        <Box sx={{ maxWidth: 1080, mx: "auto", px: 3, py: 3.5 }}>
          <Breadcrumbs sx={{ fontSize: 13, mb: 1 }}>
            <MuiLink component={Link} href="/" underline="hover" sx={{ fontSize: 13 }}>
              Applications
            </MuiLink>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>FY2023 cycle</Typography>
            <Typography sx={{ fontSize: 13, color: "text.primary" }}>New intake</Typography>
          </Breadcrumbs>
          <Typography component="h1" sx={{ fontSize: 24, fontWeight: 500 }}>
            New application intake
          </Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5, mb: 3 }}>
            Upload the ACFR and application materials. The pipeline extracts, segments, and
            runs the completeness gate before any reviewer time is spent.
          </Typography>

          {(startError || runError || gateActionError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {startError ?? runError ?? gateActionError}
            </Alert>
          )}

          {run?.status === "awaiting_review" && run.gatePassed !== false && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Findings are prepared and ready for human review.
            </Alert>
          )}

          {run?.status === "rejected" && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Completeness rejection confirmed — recorded to the audit trail. Nothing is sent
              automatically in the POC.
            </Alert>
          )}

          {run?.status === "awaiting_review" && run.gatePassed === false && run.gateOverride && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Gate overridden by reviewer — findings are prepared for review.
            </Alert>
          )}

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 3,
              alignItems: "flex-start",
            }}
          >
            <Box
              sx={{
                flex: "1 1 460px",
                minWidth: 320,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <UploadCard
                onLoadSample={(sampleId) => void startDemo(sampleId)}
                onFiles={handleFiles}
                onUploaded={(appId) => void handleUploaded(appId)}
                disabled={starting || runId !== null}
              />
              {hasIntake && files.length > 0 && (
                <UploadedFilesCard files={files} extracted={extracted} onReset={handleReset} />
              )}
            </Box>

            <Box
              sx={{
                flex: "0 1 380px",
                minWidth: 300,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <PipelineCard steps={run?.steps ?? []} hasRun={runId !== null} />
              <GateCard
                gateChecks={run?.gateChecks ?? []}
                runStatus={run?.status ?? (starting ? "queued" : null)}
                gatePassed={run?.gatePassed ?? null}
                gateOverride={run?.gateOverride ?? false}
                actionPending={gateActionPending}
                onOpenReview={openReview}
                onConfirmRejection={() => setRejectDialogOpen(true)}
                onOverride={() => void handleGateDecision("override")}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      <ConfirmRejectionDialog
        open={rejectDialogOpen}
        districtName={run?.application.districtName ?? "this application"}
        checks={
          run?.gateChecks.filter((c) => c.status === "fail" || c.status === "needs_human") ?? []
        }
        confirming={gateActionPending}
        onClose={() => setRejectDialogOpen(false)}
        onConfirm={() => void handleGateDecision("confirm_rejection")}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </AppShell>
  );
}
