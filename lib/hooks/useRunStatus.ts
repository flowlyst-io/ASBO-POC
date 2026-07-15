"use client";

import { useCallback, useEffect, useState } from "react";

import type { RunStatusPayload } from "@/lib/types";

const TERMINAL: ReadonlyArray<string> = ["awaiting_review", "complete", "failed", "canceled"];
const POLL_MS = 2000;

interface RunState {
  key: string | null;
  run: RunStatusPayload | null;
  error: string | null;
}

/**
 * Polls GET /api/runs/[runId] every 2s until the run reaches a terminal
 * status. Pass null to disable (no run started yet).
 */
export function useRunStatus(runId: string | null) {
  const [state, setState] = useState<RunState>({ key: runId, run: null, error: null });

  // Derived reset when runId changes (setState-during-render pattern).
  if (state.key !== runId) {
    setState({ key: runId, run: null, error: null });
  }

  // One-shot fetch, shared by the poll loop and manual refresh (e.g. after
  // assigning a reviewer once polling has stopped at a terminal status).
  const fetchRun = useCallback(async (): Promise<RunStatusPayload | null> => {
    if (!runId) return null;
    const res = await fetch(`/api/runs/${runId}`);
    if (res.status === 404) throw new Error("Run not found");
    if (!res.ok) throw new Error(`Run status ${res.status}`);
    return (await res.json()) as RunStatusPayload;
  }, [runId]);

  const refresh = useCallback(async () => {
    try {
      const payload = await fetchRun();
      if (!payload) return;
      setState((prev) => (prev.key === runId ? { ...prev, run: payload, error: null } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => (prev.key === runId ? { ...prev, error: message } : prev));
    }
  }, [fetchRun, runId]);

  useEffect(() => {
    if (!runId) return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const payload = await fetchRun();
        if (stopped || !payload) return;
        setState((prev) => (prev.key === runId ? { ...prev, run: payload, error: null } : prev));
        if (TERMINAL.includes(payload.status) && timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch (err) {
        if (!stopped) {
          // Run doesn't exist (stale URL) — report once and stop polling.
          if (err instanceof Error && err.message === "Run not found" && timer) {
            clearInterval(timer);
            timer = null;
          }
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
  }, [runId, fetchRun]);

  const run = state.key === runId ? state.run : null;
  return {
    run,
    error: state.key === runId ? state.error : null,
    isTerminal: run ? TERMINAL.includes(run.status) : false,
    refresh,
  };
}
