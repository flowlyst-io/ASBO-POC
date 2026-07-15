"use client";

import * as React from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import type { Finding } from "@/lib/types";

export interface BottomBarProps {
  findings: Finding[];
  /** POSTs /api/runs/[runId]/ready in the parent. */
  onMarkReady: () => void;
  /** True once the run has been marked ready (disables the button). */
  markedReady?: boolean;
  /** True while the pipeline is still streaming findings in. */
  streaming?: boolean;
}

/** Screen 2 fixed bottom action bar: review progress + route-for-decision. */
export default function BottomBar({
  findings,
  onMarkReady,
  markedReady = false,
  streaming = false,
}: BottomBarProps) {
  const total = findings.length;
  const reviewed = findings.filter((f) => f.review !== null).length;
  const accepted = findings.filter(
    (f) => f.review?.state === "accepted" || f.review?.state === "edited",
  ).length;
  const remaining = total - reviewed;
  const allReviewed = total > 0 && reviewed === total;
  // Never enable while findings are still arriving — the total isn't final yet.
  const canMarkReady = allReviewed && !streaming;

  return (
    <Paper
      elevation={4}
      square
      sx={{
        height: 44,
        flexShrink: 0,
        borderTop: 1,
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 1.5,
        zIndex: 10,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
        {streaming ? (
          <>
            <PendingActionsIcon sx={{ fontSize: 20, color: "text.disabled" }} />
            <Typography noWrap sx={{ fontSize: 13.5, color: "text.secondary" }}>
              Findings are still streaming in… {reviewed} of {total} confirmed so far.
            </Typography>
          </>
        ) : allReviewed ? (
          <>
            <TaskAltIcon sx={{ fontSize: 20, color: "success.main" }} />
            <Typography noWrap sx={{ fontSize: 13.5 }}>
              All {total} findings confirmed · {accepted} accepted. Ready to route for the
              Award / Conditional / Denied decision.
            </Typography>
          </>
        ) : (
          <>
            <PendingActionsIcon sx={{ fontSize: 20, color: "text.disabled" }} />
            <Typography noWrap sx={{ fontSize: 13.5, color: "text.secondary" }}>
              {remaining} finding{remaining === 1 ? "" : "s"} still need
              {remaining === 1 ? "s" : ""} review — use the Unreviewed filter to find
              {remaining === 1 ? " it" : " them"} ({reviewed} of {total} confirmed).
            </Typography>
          </>
        )}
      </Box>

      <Button
        variant="contained"
        size="small"
        endIcon={<ArrowForwardIcon />}
        disabled={!canMarkReady || markedReady}
        onClick={onMarkReady}
      >
        {markedReady ? "Marked ready" : "Mark ready for decision"}
      </Button>
    </Paper>
  );
}
