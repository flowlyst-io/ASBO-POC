"use client";

import * as React from "react";
import { Box, Button, Divider, IconButton, Paper, Typography } from "@mui/material";
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

import { viewerTokens } from "@/lib/theme";
import type { Finding, RunStatusPayload } from "@/lib/types";

export interface CitationViewerProps {
  run: RunStatusPayload | null;
  finding: Finding | null;
  /** Hides the viewer (findings panel goes full-width). */
  onCollapse?: () => void;
}

/**
 * Screen 2 right pane: simulated ACFR page rendering the selected finding's
 * excerpt lines with the cited passage highlighted (NotebookLM-style
 * click-through-to-source).
 */
export default function CitationViewer({ run, finding, onCollapse }: CitationViewerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const highlightRef = React.useRef<HTMLSpanElement>(null);

  const jumpToCitation = () => {
    const container = scrollRef.current;
    const highlight = highlightRef.current;
    if (!container || !highlight) return;
    // Smooth-scroll the scroll CONTAINER (not scrollIntoView) to the highlight.
    const top =
      highlight.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      160;
    container.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
  };

  const pageCount = run?.application.pageCount ?? null;
  const districtName = run?.application.districtName ?? "";
  const sectionLabel = finding
    ? finding.section.charAt(0).toUpperCase() + finding.section.slice(1)
    : null;

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
          <IconButton size="small" disabled aria-label="previous page">
            <NavigateBeforeIcon fontSize="small" />
          </IconButton>
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", mx: 0.5 }}>
            {finding?.page ?? "—"} / {pageCount ?? "—"}
          </Typography>
          <IconButton size="small" disabled aria-label="next page">
            <NavigateNextIcon fontSize="small" />
          </IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 0.5 }} />
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
        {finding === null ? (
          <Box sx={{ alignSelf: "center", textAlign: "center", color: "text.secondary" }}>
            <DescriptionIcon sx={{ fontSize: 44, color: "text.disabled" }} />
            <Typography sx={{ fontSize: 14, mt: 1 }}>
              Select a finding to view its cited source page.
            </Typography>
          </Box>
        ) : finding.lines === null ? (
          <Box sx={{ alignSelf: "center", textAlign: "center", color: "text.secondary", maxWidth: 380 }}>
            <HelpOutlineIcon sx={{ fontSize: 44, color: "warning.main" }} />
            <Typography sx={{ fontSize: 14, mt: 1 }}>
              No locatable citation — needs human review.
            </Typography>
          </Box>
        ) : (
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

            {finding.pageTitle && (
              <Typography
                sx={{ fontFamily: "inherit", fontSize: 15, fontWeight: 700, mb: 2.5 }}
              >
                {finding.pageTitle}
              </Typography>
            )}

            <Box sx={{ fontSize: 12.5, lineHeight: 1.9, color: "text.primary" }}>
              {finding.lines.map((line, i) =>
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
                      {finding.hlText ?? ""}
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
              — {finding.page ?? "—"} —
            </Typography>
          </Paper>
        )}
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
          disabled={!finding || finding.lines === null}
          onClick={jumpToCitation}
        >
          Jump to citation
        </Button>
      </Box>
    </Box>
  );
}
