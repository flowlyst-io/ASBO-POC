"use client";

import { useEffect, useState } from "react";

import type { ReviewersPayload } from "@/lib/types";

/** One-shot fetch of GET /api/reviewers. */
export function useReviewers() {
  const [data, setData] = useState<ReviewersPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/reviewers");
        if (!res.ok) throw new Error(`Reviewers failed (${res.status})`);
        const payload = (await res.json()) as ReviewersPayload;
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
