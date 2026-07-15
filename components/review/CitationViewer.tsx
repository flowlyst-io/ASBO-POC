"use client";

import * as React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import DownloadIcon from "@mui/icons-material/Download";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import DescriptionIcon from "@mui/icons-material/Description";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";

import { viewerTokens } from "@/lib/theme";
import type {
  DocumentSearchPayload,
  Finding,
  PagePayload,
  RunStatusPayload,
} from "@/lib/types";

export interface CitationViewerProps {
  run: RunStatusPayload | null;
  finding: Finding | null;
  /** Hides the viewer (findings panel goes full-width). */
  onCollapse?: () => void;
}

interface HighlightRange {
  start: number;
  end: number;
  kind: "cite" | "search";
}

/** Lowercased, whitespace-collapsed copy of `text` plus a map from each
 *  normalized index back to the original raw index. Extracted PDF text is
 *  full of hard line breaks the AI's quoted passage doesn't have — matching
 *  in normalized space is what makes citations findable. */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!lastWasSpace) {
        norm += " ";
        map.push(i);
        lastWasSpace = true;
      }
    } else {
      norm += ch.toLowerCase();
      map.push(i);
      lastWasSpace = false;
    }
  }
  return { norm, map };
}

/** First whitespace-insensitive occurrence of `needle`, as raw-text offsets. */
function findNormalizedRange(
  normText: { norm: string; map: number[] },
  needle: string,
): { start: number; end: number } | null {
  const normNeedle = needle.toLowerCase().replace(/\s+/g, " ").trim();
  if (normNeedle.length === 0) return null;
  const idx = normText.norm.indexOf(normNeedle);
  if (idx === -1) return null;
  return { start: normText.map[idx], end: normText.map[idx + normNeedle.length - 1] + 1 };
}

/**
 * Cited-passage ranges via a tolerant cascade: whole passage
 * (whitespace-normalized), then sentence-sized fragments of it, so a
 * partially-mismatched extraction still highlights what it can.
 */
function findCiteRanges(text: string, hlText: string): HighlightRange[] {
  const normText = normalizeWithMap(text);

  const whole = findNormalizedRange(normText, hlText);
  if (whole) return [{ ...whole, kind: "cite" }];

  const fragments = hlText
    .split(/(?<=[.;:])\s+|\n+/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 12);
  const ranges: HighlightRange[] = [];
  for (const fragment of fragments) {
    const hit = findNormalizedRange(normText, fragment);
    if (hit && !ranges.some((r) => hit.start < r.end && hit.end > r.start)) {
      ranges.push({ ...hit, kind: "cite" });
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** Merge cite ranges with every occurrence of the active search term. */
function buildRanges(text: string, citeRanges: HighlightRange[], term: string): HighlightRange[] {
  const ranges = [...citeRanges];
  const needle = term.toLowerCase();
  if (needle.length >= 2) {
    const lower = text.toLowerCase();
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      if (!citeRanges.some((r) => idx < r.end && end > r.start)) {
        ranges.push({ start: idx, end, kind: "search" });
      }
      from = end;
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/**
 * Screen 2 right pane: the run's ACFR rendered page-by-page from the stored
 * extraction (document_pages), with prev/next + jump-to-page navigation,
 * find-in-document search, and the selected finding's cited passage
 * highlighted (NotebookLM-style click-through-to-source).
 */
export default function CitationViewer({ run, finding, onCollapse }: CitationViewerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const highlightRef = React.useRef<HTMLSpanElement>(null);

  const documentId = run?.documentId ?? null;
  const pageCount = run?.application.pageCount ?? null;
  const findingId = finding?.id ?? null;
  const findingPage = finding?.page ?? null;

  const [currentPage, setCurrentPage] = React.useState<number | null>(null);
  const [pageData, setPageData] = React.useState<PagePayload | null>(null);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [pageInput, setPageInput] = React.useState("");
  const cacheRef = React.useRef<Map<string, PagePayload>>(new Map());

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState<DocumentSearchPayload | null>(null);
  const [matchIndex, setMatchIndex] = React.useState(0);
  const [searchLoading, setSearchLoading] = React.useState(false);

  const goToPage = React.useCallback(
    (page: number) => {
      const max = pageCount && pageCount > 0 ? pageCount : Number.MAX_SAFE_INTEGER;
      setCurrentPage(Math.min(Math.max(1, page), max));
    },
    [pageCount],
  );

  // Page (±1 of the cited one) where the cited passage was actually found
  // when it isn't on the cited page itself — citations are often off by one.
  const [nearbyHit, setNearbyHit] = React.useState<number | null>(null);

  // Follow the selected finding to its cited page (derived reset via the
  // setState-during-render pattern, same as useRunStatus).
  const [lastFindingId, setLastFindingId] = React.useState<string | null>(null);
  if (findingId !== lastFindingId) {
    setLastFindingId(findingId);
    setNearbyHit(null);
    if (findingId) setCurrentPage(findingPage ?? 1);
  }

  // New document: drop any stale search (cache entries are keyed by
  // document, so they never leak across documents).
  const [lastDocumentId, setLastDocumentId] = React.useState<string | null>(null);
  if (documentId !== lastDocumentId) {
    setLastDocumentId(documentId);
    setSearch(null);
    setSearchInput("");
    setMatchIndex(0);
  }

  // Fetch the current page (cached per document+page). Depends only on
  // documentId + currentPage so the 2s findings poll never re-triggers it.
  React.useEffect(() => {
    if (!documentId || currentPage === null) return;
    const cacheKey = `${documentId}:${currentPage}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setPageData(cached);
      setPageError(null);
      return;
    }
    let stale = false;
    setPageLoading(true);
    fetch(`/api/documents/${documentId}/pages/${currentPage}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? "Page not available" : `Page load failed (${res.status})`,
          );
        }
        return (await res.json()) as PagePayload;
      })
      .then((payload) => {
        if (stale) return;
        cacheRef.current.set(cacheKey, payload);
        setPageData(payload);
        setPageError(null);
      })
      .catch((err: unknown) => {
        if (!stale) {
          setPageData(null);
          setPageError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!stale) setPageLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [documentId, currentPage]);

  const scrollToHighlight = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const highlight = highlightRef.current;
    if (!highlight) {
      // No text-level match on this page — show it from the top.
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Smooth-scroll the scroll CONTAINER (not scrollIntoView) to the highlight.
    const top =
      highlight.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      160;
    container.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
  }, []);

  // When the cited page (or a nearby page holding the passage) finishes
  // rendering, bring the citation into view.
  React.useEffect(() => {
    if (
      pageData &&
      (pageData.pageNumber === findingPage || (nearbyHit !== null && pageData.pageNumber === nearbyHit))
    ) {
      const raf = requestAnimationFrame(scrollToHighlight);
      return () => cancelAnimationFrame(raf);
    }
  }, [pageData, findingPage, nearbyHit, scrollToHighlight]);

  const hlText = finding?.hlText ?? null;

  // When the cited page is showing but the passage can't be text-matched on
  // it, probe the adjacent pages — extraction page numbering is often off by
  // one. Only a real text hit sets nearbyHit; we never fake evidence.
  React.useEffect(() => {
    if (!documentId || !pageData || !hlText || findingPage === null) return;
    if (pageData.pageNumber !== findingPage) return;
    if (findCiteRanges(pageData.text, hlText).length > 0) return;
    let stale = false;
    const probe = async () => {
      for (const neighbor of [findingPage - 1, findingPage + 1]) {
        if (neighbor < 1 || (pageCount !== null && neighbor > pageCount)) continue;
        const cacheKey = `${documentId}:${neighbor}`;
        let payload = cacheRef.current.get(cacheKey);
        if (!payload) {
          try {
            const res = await fetch(`/api/documents/${documentId}/pages/${neighbor}`);
            if (!res.ok) continue;
            payload = (await res.json()) as PagePayload;
            cacheRef.current.set(cacheKey, payload);
          } catch {
            continue;
          }
        }
        if (findCiteRanges(payload.text, hlText).length > 0) {
          if (!stale) setNearbyHit(neighbor);
          return;
        }
      }
    };
    void probe();
    return () => {
      stale = true;
    };
  }, [documentId, pageData, hlText, findingPage, pageCount]);

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) goToPage(parsed);
    setPageInput("");
  };

  const runSearch = async () => {
    if (!documentId) return;
    const term = searchInput.trim();
    if (term.length < 2) {
      setSearch(null);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/search?q=${encodeURIComponent(term)}`,
      );
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const payload = (await res.json()) as DocumentSearchPayload;
      setSearch(payload);
      setMatchIndex(0);
      if (payload.matches.length > 0) goToPage(payload.matches[0].pageNumber);
    } catch {
      setSearch(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const stepMatch = (delta: number) => {
    if (!search || search.matches.length === 0) return;
    const count = search.matches.length;
    const next = (matchIndex + delta + count) % count;
    setMatchIndex(next);
    goToPage(search.matches[next].pageNumber);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearch(null);
    setSearchInput("");
    setMatchIndex(0);
  };

  const districtName = run?.application.districtName ?? "";
  const sectionLabel = finding
    ? finding.section.charAt(0).toUpperCase() + finding.section.slice(1)
    : null;

  /** Real page text with citation + search highlights. */
  const renderPageBody = (page: PagePayload) => {
    // Cite highlighting is attempted on the cited page and its neighbors —
    // extraction numbering is often off by one; further pages stay clean.
    const inCiteWindow = findingPage !== null && Math.abs(page.pageNumber - findingPage) <= 1;
    const citeRanges = hlText && inCiteWindow ? findCiteRanges(page.text, hlText) : [];
    const onCitedPage = findingPage !== null && page.pageNumber === findingPage;
    const ranges = buildRanges(page.text, citeRanges, search?.query ?? "");
    const firstCiteIndex = ranges.findIndex((r) => r.kind === "cite");

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    ranges.forEach((range, i) => {
      if (range.start > cursor) nodes.push(page.text.slice(cursor, range.start));
      const slice = page.text.slice(range.start, range.end);
      nodes.push(
        range.kind === "cite" ? (
          <Box
            key={`hl-${i}`}
            component="span"
            ref={i === firstCiteIndex ? highlightRef : undefined}
            sx={{
              bgcolor: viewerTokens.citationHighlightBg,
              boxShadow: viewerTokens.citationHighlightRing,
              borderRadius: "2px",
              px: 0.25,
            }}
          >
            {slice}
          </Box>
        ) : (
          <Box key={`hl-${i}`} component="span" sx={{ bgcolor: "#FFF2A8", borderRadius: "2px" }}>
            {slice}
          </Box>
        ),
      );
      cursor = range.end;
    });
    if (cursor < page.text.length) nodes.push(page.text.slice(cursor));

    return (
      <Paper
        elevation={8}
        square={false}
        sx={{
          width: 620,
          maxWidth: "100%",
          minHeight: 720,
          flexShrink: 0,
          alignSelf: "flex-start",
          px: 7,
          py: 6.5,
          fontFamily: "var(--font-roboto-mono), 'Roboto Mono', monospace",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10.5,
            color: "text.disabled",
            letterSpacing: 1,
            textTransform: "uppercase",
            fontFamily: "inherit",
            mb: 3,
          }}
        >
          <span>{districtName}</span>
          <span>{page.section ? `${page.section} section` : ""}</span>
        </Box>

        {(page.needsOcr || page.text.trim().length === 0) && (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              mb: 2,
              p: 1,
              borderRadius: "6px",
              bgcolor: "rgba(237,108,2,0.08)",
            }}
          >
            <ReportProblemIcon sx={{ fontSize: 16, color: "warning.main" }} />
            <Typography sx={{ fontSize: 12, color: viewerTokens.warningTextOnLight, fontFamily: "inherit" }}>
              Scanned page — OCR pending; text may be incomplete.
            </Typography>
          </Box>
        )}

        {onCitedPage && hlText && citeRanges.length === 0 && (
          <Box
            sx={{
              mb: 2.5,
              p: 1.25,
              borderRadius: "6px",
              bgcolor: viewerTokens.citationHighlightBg,
              boxShadow: viewerTokens.citationHighlightRing,
            }}
          >
            <Typography sx={{ fontSize: 12, fontFamily: "inherit", color: "text.primary" }}>
              {finding
                ? `Evidence for Criterion ${finding.num} was cited on this page`
                : "The cited evidence is on this page"}
              {nearbyHit !== null
                ? `, and the quoted passage was found on page ${nearbyHit}.`
                : ", but the exact passage couldn't be matched to the extracted text — review the full page."}
            </Typography>
            {nearbyHit !== null && (
              <Button size="small" sx={{ mt: 0.5, fontSize: 12 }} onClick={() => goToPage(nearbyHit)}>
                Go to page {nearbyHit}
              </Button>
            )}
          </Box>
        )}

        <Box
          sx={{
            fontSize: 12.5,
            lineHeight: 1.8,
            color: "text.primary",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {nodes}
        </Box>

        <Typography
          sx={{
            fontFamily: "inherit",
            fontSize: 11,
            color: "text.disabled",
            textAlign: "center",
            mt: 4,
          }}
        >
          — {page.pageNumber} —
        </Typography>
      </Paper>
    );
  };

  /** Legacy excerpt render — fallback when the cited page can't be fetched. */
  const renderExcerptBody = (f: Finding) => (
    <Paper
      elevation={8}
      square={false}
      sx={{
        width: 620,
        maxWidth: "100%",
        minHeight: 720,
        flexShrink: 0,
        alignSelf: "flex-start",
        px: 7,
        py: 6.5,
        fontFamily: "var(--font-roboto-mono), 'Roboto Mono', monospace",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10.5,
          color: "text.disabled",
          letterSpacing: 1,
          textTransform: "uppercase",
          fontFamily: "inherit",
          mb: 3,
        }}
      >
        <span>{districtName}</span>
        <span>{sectionLabel ? `${sectionLabel} section` : ""}</span>
      </Box>

      {f.pageTitle && (
        <Typography sx={{ fontFamily: "inherit", fontSize: 15, fontWeight: 700, mb: 2.5 }}>
          {f.pageTitle}
        </Typography>
      )}

      <Box sx={{ fontSize: 12.5, lineHeight: 1.9, color: "text.primary" }}>
        {(f.lines ?? []).map((line, i) =>
          line === "@hl" ? (
            <Box key={i} component="p" sx={{ m: 0, mb: 1 }}>
              <Box
                component="span"
                ref={highlightRef}
                sx={{
                  bgcolor: viewerTokens.citationHighlightBg,
                  boxShadow: viewerTokens.citationHighlightRing,
                  borderRadius: "2px",
                  px: 0.25,
                }}
              >
                {f.hlText ?? ""}
              </Box>
            </Box>
          ) : (
            <Box key={i} component="p" sx={{ m: 0, mb: 1 }}>
              {line}
            </Box>
          ),
        )}
      </Box>

      <Typography
        sx={{
          fontFamily: "inherit",
          fontSize: 11,
          color: "text.disabled",
          textAlign: "center",
          mt: 4,
        }}
      >
        — {f.page ?? "—"} —
      </Typography>
    </Paper>
  );

  const body = (() => {
    if (pageLoading && !pageData) {
      return (
        <Box sx={{ alignSelf: "center", textAlign: "center", color: "text.secondary" }}>
          <CircularProgress size={26} />
          <Typography sx={{ fontSize: 13, mt: 1 }}>Loading page…</Typography>
        </Box>
      );
    }
    if (pageData) return renderPageBody(pageData);
    if (pageError) {
      // Fallback: never regress the working citation view.
      if (finding && findingPage !== null && currentPage === findingPage && finding.lines) {
        return renderExcerptBody(finding);
      }
      return (
        <Box sx={{ alignSelf: "center", textAlign: "center", color: "text.secondary", maxWidth: 380 }}>
          <HelpOutlineIcon sx={{ fontSize: 44, color: "warning.main" }} />
          <Typography sx={{ fontSize: 14, mt: 1 }}>
            Page {currentPage ?? "—"} is not available. Use the arrows to try another page.
          </Typography>
        </Box>
      );
    }
    if (finding === null) {
      return (
        <Box sx={{ alignSelf: "center", textAlign: "center", color: "text.secondary" }}>
          <DescriptionIcon sx={{ fontSize: 44, color: "text.disabled" }} />
          <Typography sx={{ fontSize: 14, mt: 1 }}>
            Select a finding to view its cited source page.
          </Typography>
        </Box>
      );
    }
    if (finding.lines === null) {
      return (
        <Box sx={{ alignSelf: "center", textAlign: "center", color: "text.secondary", maxWidth: 380 }}>
          <HelpOutlineIcon sx={{ fontSize: 44, color: "warning.main" }} />
          <Typography sx={{ fontSize: 14, mt: 1 }}>
            No locatable citation — needs human review. Use the arrows or search to browse the
            document.
          </Typography>
        </Box>
      );
    }
    return renderExcerptBody(finding);
  })();

  return (
    <Box
      sx={{
        flex: "1 1 0",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: viewerTokens.viewerBg,
      }}
    >
      <Box
        sx={{
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          px: 2,
          py: 0.75,
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <PictureAsPdfIcon sx={{ fontSize: 20, color: "error.main" }} />
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 120 }}>
          {run ? run.application.filename : "—"}
          {sectionLabel ? ` · ${sectionLabel} section` : ""}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <IconButton
            size="small"
            aria-label="previous page"
            disabled={currentPage === null || currentPage <= 1}
            onClick={() => goToPage((currentPage ?? 1) - 1)}
          >
            <NavigateBeforeIcon fontSize="small" />
          </IconButton>
          <TextField
            size="small"
            value={pageInput}
            placeholder={currentPage !== null ? String(currentPage) : "—"}
            onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commitPageInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPageInput();
            }}
            slotProps={{
              htmlInput: {
                inputMode: "numeric",
                "aria-label": "go to page",
                style: { textAlign: "center", padding: "2px 4px", fontSize: 12.5, width: 40 },
              },
            }}
          />
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", mx: 0.5 }}>
            / {pageCount ?? "—"}
          </Typography>
          <IconButton
            size="small"
            aria-label="next page"
            disabled={currentPage === null || (pageCount !== null && currentPage >= pageCount)}
            onClick={() => goToPage((currentPage ?? 1) + 1)}
          >
            <NavigateNextIcon fontSize="small" />
          </IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 0.5 }} />
          <IconButton
            size="small"
            aria-label="find in document"
            color={searchOpen ? "primary" : "default"}
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" disabled aria-label="zoom in">
            <ZoomInIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" disabled aria-label="download">
            <DownloadIcon fontSize="small" />
          </IconButton>
          {onCollapse && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 0.5 }} />
              <IconButton size="small" onClick={onCollapse} aria-label="hide document viewer">
                <CloseFullscreenIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Box>
      </Box>

      {searchOpen && (
        <Box
          sx={{
            bgcolor: "background.paper",
            borderBottom: 1,
            borderColor: "divider",
            px: 2,
            py: 0.75,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <TextField
            size="small"
            autoFocus
            fullWidth
            placeholder="Find in document… (Enter to search)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
            sx={{ maxWidth: 320 }}
            slotProps={{ htmlInput: { style: { fontSize: 13, padding: "4px 8px" } } }}
          />
          {searchLoading && <CircularProgress size={16} />}
          {search && (
            <Typography sx={{ fontSize: 12.5, color: "text.secondary", whiteSpace: "nowrap" }}>
              {search.matches.length === 0
                ? "No matches"
                : `Page ${matchIndex + 1} of ${search.matches.length}${search.capped ? "+" : ""} matching`}
            </Typography>
          )}
          <IconButton
            size="small"
            aria-label="previous match"
            disabled={!search || search.matches.length === 0}
            onClick={() => stepMatch(-1)}
          >
            <KeyboardArrowUpIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="next match"
            disabled={!search || search.matches.length === 0}
            onClick={() => stepMatch(1)}
          >
            <KeyboardArrowDownIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="close search" onClick={closeSearch}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          justifyContent: "center",
          py: 3,
          px: 2,
        }}
      >
        {body}
      </Box>

      <Box
        sx={{
          bgcolor: "background.paper",
          borderTop: 1,
          borderColor: "divider",
          px: 2,
          py: 1,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <MyLocationIcon sx={{ fontSize: 18, color: "primary.main", flexShrink: 0 }} />
        <Typography noWrap sx={{ fontSize: 13, flex: 1, minWidth: 0, color: "text.secondary" }}>
          {finding
            ? `Source for Criterion ${finding.num} — ${finding.title}`
            : "No finding selected"}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<CenterFocusStrongIcon />}
          disabled={!finding || findingPage === null}
          onClick={() => {
            if (findingPage === null) return;
            if (currentPage === findingPage) scrollToHighlight();
            else goToPage(findingPage);
          }}
        >
          Jump to citation
        </Button>
      </Box>
    </Box>
  );
}
