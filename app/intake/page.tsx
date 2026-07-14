"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Breadcrumbs, Link as MuiLink, Typography } from "@mui/material";

import AppShell from "@/components/shell/AppShell";
import UploadCard, { type SampleId } from "@/components/intake/UploadCard";
import UploadedFilesCard, {
  type UploadedFile,
  type UploadedFileKind,
} from "@/components/intake/UploadedFilesCard";
import PipelineCard from "@/components/intake/PipelineCard";
import GateCard from "@/components/intake/GateCard";
import { useRunStatus } from "@/lib/hooks/useRunStatus";

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

  const { run, error: runError } = useRunStatus(runId);

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
      setApplicationId(demo.applicationId);

      const runRes = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId: demo.applicationId }),
      });
      if (!runRes.ok) throw new Error(`Run start failed (${runRes.status})`);
      const started = (await runRes.json()) as { runId: string };
      setRunId(started.runId);
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

          {(startError || runError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {startError ?? runError}
            </Alert>
          )}

          {run?.status === "awaiting_review" && run.gatePassed !== false && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Findings are prepared and ready for human review.
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
                onOpenReview={openReview}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </AppShell>
  );
}
