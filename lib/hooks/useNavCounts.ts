"use client";

import { useEffect, useState } from "react";

import type { NavCountsPayload } from "@/lib/types";

/** One-shot fetch of GET /api/nav/counts (nav-rail badges + avatar). */
export function useNavCounts() {
  const [data, setData] = useState<NavCountsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/nav/counts");
        if (!res.ok) throw new Error(`Nav counts failed (${res.status})`);
        const payload = (await res.json()) as NavCountsPayload;
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
