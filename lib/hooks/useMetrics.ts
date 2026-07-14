"use client";

import { useEffect, useState } from "react";

import type { MetricsPayload } from "@/lib/types";

/** One-shot fetch of GET /api/metrics (PRD F7 dashboard numbers). */
export function useMetrics() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/metrics");
        if (!res.ok) throw new Error(`Metrics failed (${res.status})`);
        const payload = (await res.json()) as MetricsPayload;
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
  }, []);

  return { data, error, loading };
}
