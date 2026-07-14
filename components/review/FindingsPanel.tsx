"use client";

import * as React from "react";
import { Box, Chip, LinearProgress, Typography } from "@mui/material";

import FindingCard from "@/components/review/FindingCard";
import type { Finding, ReviewAction } from "@/lib/types";

export type FindingFilter = "all" | "needs_human" | "not_met" | "partial" | "met";

const FILTERS: { key: FindingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_human", label: "Needs human" },
  { key: "not_met", label: "Not met" },
  { key: "partial", label: "Partial" },
  { key: "met", label: "Met" },
];

export function matchesFilter(finding: Finding, filter: FindingFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "needs_human":
      return finding.verifierStatus === "flagged";
    case "not_met":
      return finding.status === "not_met";
    case "partial":
      return finding.status === "partial";
    case "met":
      return finding.status === "met";
  }
}

export interface FindingsPanelProps {
  findings: Finding[];
  filter: FindingFilter;
  onFilter: (filter: FindingFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  editingId: string | null;
  onEditStart: (id: string) => void;
  onEditCancel: () => void;
  review: (findingId: string, action: ReviewAction, comment?: string) => Promise<void>;
  /** True while the pipeline is still streaming findings in. */
  streaming?: boolean;
}

/** Screen 2 left pane: filter chips + scrolling list of finding cards. */
export default function FindingsPanel({
  findings,
  filter,
  onFilter,
  selectedId,
  onSelect,
  editingId,
  onEditStart,
  onEditCancel,
  review,
  streaming = false,
}: FindingsPanelProps) {
  const filtered = findings.filter((f) => matchesFilter(f, filter));

  return (
    <Box
      sx={{
        flex: "0 1 440px",
        minWidth: 340,
        maxWidth: 520,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ bgcolor: "background.paper", px: 2, pt: 1.5, pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>Checklist findings</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          AI-prepared · reviewer confirms each
          {streaming ? " · streaming in…" : ""}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
          {FILTERS.map(({ key, label }) => {
            const count = findings.filter((f) => matchesFilter(f, key)).length;
            const active = filter === key;
            return (
              <Chip
                key={key}
                size="small"
                label={`${label} (${count})`}
                color={active ? "primary" : "default"}
                variant={active ? "filled" : "outlined"}
                onClick={() => onFilter(key)}
              />
            );
          })}
        </Box>
        {streaming && <LinearProgress sx={{ mt: 1.25, height: 3, borderRadius: 2 }} />}
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {filtered.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary", textAlign: "center", mt: 4 }}>
            {findings.length === 0
              ? streaming
                ? "Findings will stream in as the checklist workers finish…"
                : "No findings for this run."
              : "No findings match this filter."}
          </Typography>
        ) : (
          filtered.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              selected={finding.id === selectedId}
              editing={finding.id === editingId}
              onSelect={() => onSelect(finding.id)}
              onEditStart={() => onEditStart(finding.id)}
              onEditCancel={onEditCancel}
              review={review}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
