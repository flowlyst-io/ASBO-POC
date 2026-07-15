"use client";

import * as React from "react";
import Link from "next/link";
import { Alert, Box, Button, CircularProgress, Snackbar, Typography } from "@mui/material";

import AppShell from "@/components/shell/AppShell";
import ContextBar from "@/components/review/ContextBar";
import FindingsPanel, {
  matchesFilter,
  type FindingFilter,
} from "@/components/review/FindingsPanel";
import CitationViewer from "@/components/review/CitationViewer";
import BottomBar from "@/components/review/BottomBar";
import ConfirmRejectionDialog from "@/components/intake/ConfirmRejectionDialog";
import { CHECK_LABELS, GateCheckIcon } from "@/components/intake/gateCheckLabels";
import { useRunStatus } from "@/lib/hooks/useRunStatus";
import { useFindings } from "@/lib/hooks/useFindings";
import { useReviewers } from "@/lib/hooks/useReviewers";
import { postGateDecision, type GateDecisionAction } from "@/lib/gateDecision";

/** Screen 2 — reviewer workspace for one run. */
export default function ReviewPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = React.use(params);

  const { run, error: runError, refresh } = useRunStatus(runId);
  const { findings, streaming, error: findingsError, review } = useFindings(runId);
  const { data: reviewersData } = useReviewers();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FindingFilter>("all");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [markedReady, setMarkedReady] = React.useState(false);
  const [readyError, setReadyError] = React.useState<string | null>(null);
  const [readyToast, setReadyToast] = React.useState(false);
  // On a laptop-sized window start with the document viewer hidden so the
  // criteria get the full width. Lazy init is hydration-safe here: the
  // panels only render after the client-side run fetch resolves.
  const [viewerCollapsed, setViewerCollapsed] = React.useState(
    () => typeof window !== "undefined" && window.innerWidth < 1280,
  );
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [gateActionPending, setGateActionPending] = React.useState(false);
  const [gateActionError, setGateActionError] = React.useState<string | null>(null);

  const handleGateDecision = async (action: GateDecisionAction) => {
    setGateActionPending(true);
    setGateActionError(null);
    try {
      await postGateDecision(runId, action);
    } catch (err) {
      setGateActionError(err instanceof Error ? err.message : String(err));
    } finally {
      // Sync with the outcome either way; after an override the hook resumes
      // polling and this page flows into the normal streaming view.
      await refresh();
      setGateActionPending(false);
      setRejectDialogOpen(false);
    }
  };

  const filtered = findings.filter((f) => matchesFilter(f, filter));
  const selected =
    findings.find((f) => f.id === selectedId) ?? filtered[0] ?? findings[0] ?? null;

  // Citation-link click: select + expand the finding AND bring the viewer back.
  const openCitation = (id: string) => {
    setSelectedId(id);
    setExpandedId(id);
    setViewerCollapsed(false);
  };

  /** Accordion toggle from a card header — selecting drives the viewer too. */
  const toggleExpand = (id: string) => {
    setSelectedId(id);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  /** Force select + expand (used by "Next unreviewed"). */
  const reveal = (id: string) => {
    setSelectedId(id);
    setExpandedId(id);
  };

  /** Editing implies the card is open. */
  const startEdit = (id: string) => {
    setExpandedId(id);
    setEditingId(id);
  };

  const markReady = async () => {
    setReadyError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/ready`, { method: "POST" });
      if (!res.ok) {
        let message = `Mark ready failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // non-JSON error body — keep the status message
        }
        throw new Error(message);
      }
      setMarkedReady(true);
      setReadyToast(true);
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

  // Gate-blocked runs have no prepared findings: a confirmed rejection is
  // read-only; a flagged-but-undecided run gets the same confirm/override
  // actions as the intake screen so it isn't a dead end from the list view.
  const gateBlocked =
    run.status === "rejected" || (run.gatePassed === false && !run.gateOverride);
  if (gateBlocked) {
    const flaggedChecks = run.gateChecks.filter(
      (c) => c.status === "fail" || c.status === "needs_human",
    );
    const rejected = run.status === "rejected";
    return (
      <AppShell>
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            p: 4,
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity={rejected ? "error" : "warning"}>
              {rejected
                ? `${run.application.districtName} was rejected at the completeness gate — the rejection was confirmed by a reviewer.`
                : `${run.application.districtName} was flagged by the completeness gate and has no prepared findings. Confirm the rejection or override to proceed with review preparation.`}
            </Alert>
            {gateActionError && <Alert severity="error">{gateActionError}</Alert>}

            <Box sx={{ bgcolor: "background.paper", borderRadius: "8px", p: 2.5, boxShadow: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 500, mb: 0.5 }}>
                Flagged completeness checks
              </Typography>
              {flaggedChecks.map((check) => (
                <Box
                  key={check.checkKey}
                  sx={{ display: "flex", gap: 1.25, py: 1, borderTop: 1, borderColor: "divider" }}
                >
                  <Box sx={{ pt: 0.2 }}>
                    <GateCheckIcon status={check.status} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                      {CHECK_LABELS[check.checkKey]}
                    </Typography>
                    {check.explanation && (
                      <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>
                        {check.explanation}
                        {check.page !== null ? ` (p. ${check.page})` : ""}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              {!rejected && (
                <>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={gateActionPending}
                  >
                    Confirm rejection
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => void handleGateDecision("override")}
                    disabled={gateActionPending}
                  >
                    Override &amp; proceed to review
                  </Button>
                </>
              )}
              <Button component={Link} href="/" variant="text">
                Back to applications
              </Button>
            </Box>
          </Box>
        </Box>

        <ConfirmRejectionDialog
          open={rejectDialogOpen}
          districtName={run.application.districtName}
          checks={flaggedChecks}
          confirming={gateActionPending}
          onClose={() => setRejectDialogOpen(false)}
          onConfirm={() => void handleGateDecision("confirm_rejection")}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ContextBar
        run={run}
        findings={findings}
        reviewers={reviewersData?.reviewers}
        onAssigned={() => void refresh()}
      />

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
          expandedId={expandedId}
          onToggleExpand={toggleExpand}
          onReveal={reveal}
          onOpenCitation={openCitation}
          editingId={editingId}
          onEditStart={startEdit}
          onEditCancel={() => setEditingId(null)}
          review={review}
          streaming={streaming}
          viewerCollapsed={viewerCollapsed}
          onToggleViewer={() => setViewerCollapsed((v) => !v)}
        />
        {!viewerCollapsed && (
          <CitationViewer
            run={run}
            finding={selected}
            onCollapse={() => setViewerCollapsed(true)}
          />
        )}
      </Box>

      <BottomBar
        findings={findings}
        onMarkReady={() => void markReady()}
        markedReady={markedReady}
        streaming={streaming}
      />

      <Snackbar
        open={readyToast}
        autoHideDuration={5000}
        onClose={() => setReadyToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setReadyToast(false)} sx={{ width: "100%" }}>
          Marked ready for decision — sent to the decision queue
        </Alert>
      </Snackbar>
    </AppShell>
  );
}
