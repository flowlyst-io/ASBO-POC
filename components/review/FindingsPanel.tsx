"use client";

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import ArticleIcon from "@mui/icons-material/Article";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SearchIcon from "@mui/icons-material/Search";

import FindingCard from "@/components/review/FindingCard";
import type { Finding, ReviewAction } from "@/lib/types";

export type FindingFilter =
  | "all"
  | "unreviewed"
  | "needs_human"
  | "not_met"
  | "partial"
  | "met";

const FILTERS: { key: FindingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unreviewed", label: "Unreviewed" },
  { key: "needs_human", label: "Needs human" },
  { key: "not_met", label: "Not met" },
  { key: "partial", label: "Partial" },
  { key: "met", label: "Met" },
];

const INTRO_DISMISSED_KEY = "coe.review.introBanner.dismissed";

// Tiny external store around localStorage so the one-time intro banner can be
// read via useSyncExternalStore (SSR-safe: hidden during server render, shown
// after hydration if not yet dismissed).
const introListeners = new Set<() => void>();
function subscribeIntro(listener: () => void): () => void {
  introListeners.add(listener);
  return () => introListeners.delete(listener);
}
function readIntroDismissed(): boolean {
  return localStorage.getItem(INTRO_DISMISSED_KEY) === "1";
}
function dismissIntro(): void {
  localStorage.setItem(INTRO_DISMISSED_KEY, "1");
  introListeners.forEach((listener) => listener());
}

export function matchesFilter(finding: Finding, filter: FindingFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unreviewed":
      return finding.review === null;
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

/** Case-insensitive keyword match over num / title / comment / cite. */
function matchesKeyword(finding: Finding, keyword: string): boolean {
  if (!keyword) return true;
  const kw = keyword.toLowerCase();
  return (
    finding.num.toLowerCase().includes(kw) ||
    finding.title.toLowerCase().includes(kw) ||
    finding.comment.toLowerCase().includes(kw) ||
    (finding.cite ?? "").toLowerCase().includes(kw)
  );
}

export interface FindingsPanelProps {
  findings: Finding[];
  filter: FindingFilter;
  onFilter: (filter: FindingFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Accordion: id of the expanded card (page-owned). */
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  /** Force select + expand (used by "Next unreviewed"). */
  onReveal: (id: string) => void;
  /** Citation-link click on a card: select + reopen the document viewer. */
  onOpenCitation?: (id: string) => void;
  editingId: string | null;
  onEditStart: (id: string) => void;
  onEditCancel: () => void;
  review: (findingId: string, action: ReviewAction, comment?: string) => Promise<void>;
  /** True while the pipeline is still streaming findings in. */
  streaming?: boolean;
  /** True when the document viewer is hidden and the panel goes full-width. */
  viewerCollapsed?: boolean;
  onToggleViewer?: () => void;
}

/** Screen 2 left pane: filter chips + scrolling list of finding cards. */
export default function FindingsPanel({
  findings,
  filter,
  onFilter,
  selectedId,
  onSelect,
  expandedId,
  onToggleExpand,
  onReveal,
  onOpenCitation,
  editingId,
  onEditStart,
  onEditCancel,
  review,
  streaming = false,
  viewerCollapsed = false,
  onToggleViewer,
}: FindingsPanelProps) {
  const [keyword, setKeyword] = React.useState("");
  const kw = keyword.trim();

  const keywordFiltered = findings.filter((f) => matchesKeyword(f, kw));
  const filtered = keywordFiltered.filter((f) => matchesFilter(f, filter));

  const introDismissed = React.useSyncExternalStore(
    subscribeIntro,
    readIntroDismissed,
    () => true,
  );
  const showIntro = !introDismissed;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<Map<string, HTMLElement>>(new Map());

  // Next unreviewed card after the selected one, within the visible filter
  // (keeps the target mounted); wraps to the start.
  const nextUnreviewedId = (() => {
    const start = filtered.findIndex((f) => f.id === selectedId);
    for (let offset = 1; offset <= filtered.length; offset += 1) {
      const candidate = filtered[(start + offset) % filtered.length];
      if (candidate && candidate.review === null) return candidate.id;
    }
    return null;
  })();

  const goToNextUnreviewed = () => {
    if (!nextUnreviewedId) return;
    onReveal(nextUnreviewedId);
    const el = cardRefs.current.get(nextUnreviewedId);
    const container = scrollRef.current;
    if (!el || !container) return;
    // Smooth-scroll the scroll CONTAINER (not scrollIntoView) to the card.
    const top =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      12;
    container.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
  };

  return (
    <Box
      sx={{
        // Deviates from the design-handoff's pinned 440px column when the
        // document viewer is collapsed: the panel takes the full width so
        // criteria are readable (user decision).
        flex: viewerCollapsed ? "1 1 auto" : "0 1 440px",
        minWidth: 340,
        maxWidth: viewerCollapsed ? "none" : 520,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderRight: viewerCollapsed ? 0 : 1,
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ bgcolor: "background.paper", px: 1.5, pt: 0.75, pb: 0.75, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600, flexShrink: 0 }}>
            Checklist findings
          </Typography>
          {streaming && (
            <Typography sx={{ fontSize: 11.5, color: "text.secondary", flexShrink: 0 }}>
              · streaming in…
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            startIcon={<SkipNextIcon sx={{ fontSize: 16 }} />}
            disabled={!nextUnreviewedId}
            onClick={goToNextUnreviewed}
            sx={{ flexShrink: 0, fontSize: 12, py: 0.25, px: 0.75, minWidth: 0 }}
          >
            Next unreviewed
          </Button>
          {onToggleViewer && (
            <Button
              size="small"
              variant="outlined"
              startIcon={viewerCollapsed ? <ArticleIcon sx={{ fontSize: 16 }} /> : <MenuOpenIcon sx={{ fontSize: 16 }} />}
              onClick={onToggleViewer}
              sx={{ flexShrink: 0, fontSize: 12, py: 0.25, px: 0.75, minWidth: 0 }}
            >
              {viewerCollapsed ? "Show document" : "Hide document"}
            </Button>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
          <FilterListIcon sx={{ fontSize: 15, color: "text.secondary" }} />
          {FILTERS.map(({ key, label }) => {
            const count = keywordFiltered.filter((f) => matchesFilter(f, key)).length;
            const active = filter === key;
            return (
              <Chip
                key={key}
                size="small"
                label={`${label} (${count})`}
                color={active ? "primary" : "default"}
                variant={active ? "filled" : "outlined"}
                onClick={() => onFilter(key)}
                sx={{ height: 22, fontSize: 11.5 }}
              />
            );
          })}
          <TextField
            size="small"
            placeholder="Keyword…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            sx={{ flex: 1, minWidth: 110, maxWidth: 180 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 15 }} />
                  </InputAdornment>
                ),
                sx: { fontSize: 12.5, "& input": { py: 0.4 } },
              },
            }}
          />
        </Box>
        {streaming && <LinearProgress sx={{ mt: 0.75, height: 3, borderRadius: 2 }} />}
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          p: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            // Comfortable centered reading width when the panel is full-width.
            maxWidth: viewerCollapsed ? 820 : "none",
            width: "100%",
            mx: "auto",
          }}
        >
          {showIntro && findings.length > 0 && (
            <Alert severity="info" onClose={dismissIntro}>
              Each criterion below was pre-checked by AI — read it, then{" "}
              <strong>Confirm</strong>, <strong>Edit</strong>, or <strong>Reject</strong> it. All{" "}
              {findings.length} must be reviewed before the application can be marked ready.
            </Alert>
          )}
          {filtered.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: "text.secondary", textAlign: "center", mt: 4 }}>
              {findings.length === 0
                ? streaming
                  ? "Findings will stream in as the checklist workers finish…"
                  : "No findings for this run."
                : kw
                  ? `No findings match “${kw}”.`
                  : "No findings match this filter."}
            </Typography>
          ) : (
            filtered.map((finding) => (
              <Box
                key={finding.id}
                ref={(el: HTMLElement | null) => {
                  if (el) cardRefs.current.set(finding.id, el);
                  else cardRefs.current.delete(finding.id);
                }}
              >
                <FindingCard
                  finding={finding}
                  selected={finding.id === selectedId}
                  expanded={finding.id === expandedId}
                  editing={finding.id === editingId}
                  onSelect={() => onSelect(finding.id)}
                  onToggleExpand={() => onToggleExpand(finding.id)}
                  onOpenCitation={
                    onOpenCitation ? () => onOpenCitation(finding.id) : undefined
                  }
                  onEditStart={() => onEditStart(finding.id)}
                  onEditCancel={onEditCancel}
                  review={review}
                />
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}
