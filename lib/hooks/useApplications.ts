"use client";

import { useCallback, useEffect, useState } from "react";

import type { ApplicationsPayload } from "@/lib/types";

/**
 * One-shot fetch of GET /api/applications with a `refresh()` escape hatch
 * (bumps a counter in the effect deps to refetch, e.g. after assignment).
 */
export function useApplications() {
  const [data, setData] = useState<ApplicationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/applications");
        if (!res.ok) throw new Error(`Applications failed (${res.status})`);
        const payload = (await res.json()) as ApplicationsPayload;
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { data, error, loading, refresh };
}
