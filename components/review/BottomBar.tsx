"use client";

import * as React from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import type { Finding } from "@/lib/types";

export interface BottomBarProps {
  findings: Finding[];
  /** POSTs /api/runs/[runId]/ready in the parent. */
  onMarkReady: () => void;
  /** True once the run has been marked ready (disables the button). */
  markedReady?: boolean;
}

/** Screen 2 fixed bottom action bar: review progress + route-for-decision. */
export default function BottomBar({ findings, onMarkReady, markedReady = false }: BottomBarProps) {
  const total = findings.length;
  const reviewed = findings.filter((f) => f.review !== null).length;
  const accepted = findings.filter(
    (f) => f.review?.state === "accepted" || f.review?.state === "edited",
  ).length;
  const allReviewed = total > 0 && reviewed === total;

  return (
    <Paper
      elevation={4}
      square
      sx={{
        height: 60,
        flexShrink: 0,
        borderTop: 1,
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 3,
        zIndex: 10,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
        {allReviewed ? (
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
              {reviewed} of {total} findings confirmed — review the rest to enable the
              decision step.
            </Typography>
          </>
        )}
      </Box>

      <Button variant="outlined" size="small" startIcon={<ChatBubbleOutlineIcon />}>
        Add general note
      </Button>
      <Button
        variant="contained"
        size="small"
        endIcon={<ArrowForwardIcon />}
        disabled={!allReviewed || markedReady}
        onClick={onMarkReady}
      >
        {markedReady ? "Marked ready" : "Mark ready for decision"}
      </Button>
    </Paper>
  );
}
