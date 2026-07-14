"use client";

import { useCallback, useEffect, useState } from "react";

import type { Finding, FindingsPayload, ReviewAction } from "@/lib/types";

const POLL_MS = 2000;

interface FindingsState {
  key: string | null;
  findings: Finding[];
  streaming: boolean;
  error: string | null;
}

/**
 * Loads findings for a run, keeps polling while the pipeline is still
 * streaming them in, and exposes optimistic review mutations.
 */
export function useFindings(runId: string | null) {
  const [state, setState] = useState<FindingsState>({
    key: runId,
    findings: [],
    streaming: true,
    error: null,
  });

  // Derived reset when runId changes (setState-during-render pattern).
  if (state.key !== runId) {
    setState({ key: runId, findings: [], streaming: true, error: null });
  }

  useEffect(() => {
    if (!runId) return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}/findings`);
        if (!res.ok) throw new Error(`Findings ${res.status}`);
        const payload = (await res.json()) as FindingsPayload;
        if (stopped) return;
        setState((prev) => {
          if (prev.key !== runId) return prev;
          // Preserve optimistic review states the server hasn't caught up on.
          const optimistic = new Map(
            prev.findings.filter((f) => f.review).map((f) => [f.id, f.review]),
          );
          const merged = payload.findings.map((f) =>
            f.review === null && optimistic.has(f.id)
              ? { ...f, review: optimistic.get(f.id) ?? null }
              : f,
          );
          return { ...prev, findings: merged, streaming: payload.streaming, error: null };
        });
        if (!payload.streaming && timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch (err) {
        if (!stopped) {
          const message = err instanceof Error ? err.message : String(err);
          setState((prev) => (prev.key === runId ? { ...prev, error: message } : prev));
        }
      }
    }

    void poll();
    timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [runId]);

  /** Accept / reject / edit / undo a finding — optimistic, then persisted. */
  const review = useCallback(
    async (findingId: string, action: ReviewAction, comment?: string) => {
      setState((prev) => ({
        ...prev,
        findings: prev.findings.map((f) =>
          f.id === findingId
            ? {
                ...f,
                review:
                  action === "undo"
                    ? null
                    : {
                        state:
                          action === "accept"
                            ? "accepted"
                            : action === "reject"
                              ? "rejected"
                              : "edited",
                        comment: action === "edit" ? (comment ?? null) : null,
                      },
              }
            : f,
        ),
      }));
      const res = await fetch(`/api/findings/${findingId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });
      if (!res.ok) {
        setState((prev) => ({ ...prev, error: `Review action failed (${res.status})` }));
      }
    },
    [],
  );

  return {
    findings: state.key === runId ? state.findings : [],
    streaming: state.key === runId ? state.streaming : true,
    error: state.key === runId ? state.error : null,
    review,
  };
}
