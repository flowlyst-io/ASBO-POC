"use client";

import * as React from "react";
import Link from "next/link";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";

import AppShell from "@/components/shell/AppShell";
import ContextBar from "@/components/review/ContextBar";
import FindingsPanel, {
  matchesFilter,
  type FindingFilter,
} from "@/components/review/FindingsPanel";
import CitationViewer from "@/components/review/CitationViewer";
import BottomBar from "@/components/review/BottomBar";
import { useRunStatus } from "@/lib/hooks/useRunStatus";
import { useFindings } from "@/lib/hooks/useFindings";

/** Screen 2 — reviewer workspace for one run. */
export default function ReviewPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = React.use(params);

  const { run, error: runError } = useRunStatus(runId);
  const { findings, streaming, error: findingsError, review } = useFindings(runId);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FindingFilter>("all");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [markedReady, setMarkedReady] = React.useState(false);
  const [readyError, setReadyError] = React.useState<string | null>(null);

  const filtered = findings.filter((f) => matchesFilter(f, filter));
  const selected =
    findings.find((f) => f.id === selectedId) ?? filtered[0] ?? findings[0] ?? null;

  const markReady = async () => {
    setReadyError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/ready`, { method: "POST" });
      if (!res.ok) throw new Error(`Mark ready failed (${res.status})`);
      setMarkedReady(true);
    } catch (err) {
      setReadyError(err instanceof Error ? err.message : String(err));
    }
  };

  // Run not found / failed to load — render a friendly state, never crash.
  if (!run) {
    return (
      <AppShell>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            p: 4,
          }}
        >
          {runError ? (
            <>
              <Alert severity="warning" sx={{ maxWidth: 480 }}>
                This review run could not be loaded ({runError}). It may not exist yet, or
                the link is out of date.
              </Alert>
              <Button component={Link} href="/" variant="outlined">
                Back to applications
              </Button>
            </>
          ) : (
            <>
              <CircularProgress size={28} />
              <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
                Loading prepared review…
              </Typography>
            </>
          )}
        </Box>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ContextBar run={run} findings={findings} />

      {(findingsError || readyError) && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {findingsError ?? readyError}
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
        <FindingsPanel
          findings={findings}
          filter={filter}
          onFilter={(next) => setFilter(next)}
          selectedId={selected?.id ?? null}
          onSelect={(id) => setSelectedId(id)}
          editingId={editingId}
          onEditStart={(id) => setEditingId(id)}
          onEditCancel={() => setEditingId(null)}
          review={review}
          streaming={streaming}
        />
        <CitationViewer run={run} finding={selected} />
      </Box>

      <BottomBar findings={findings} onMarkReady={() => void markReady()} markedReady={markedReady} />
    </AppShell>
  );
}
