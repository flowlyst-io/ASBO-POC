"use client";

import * as React from "react";
import { Paper, Typography } from "@mui/material";

export interface StatTileProps {
  /** Sentence case, no trailing colon. */
  label: string;
  /** Pre-formatted headline value (e.g. "24", "$4.21", "—"). */
  value: string;
  caption?: string;
}

/**
 * KPI stat tile (dataviz stat-tile contract): overline label, large semibold
 * value in the app sans (proportional figures — not tabular — at display
 * size), quiet caption.
 */
export default function StatTile({ label, value, caption }: StatTileProps) {
  return (
    <Paper elevation={1} sx={{ p: 2.5, flex: "1 1 200px", minWidth: 180 }}>
      <Typography
        variant="overline"
        sx={{
          display: "block",
          fontSize: 11,
          letterSpacing: 1,
          color: "text.secondary",
          lineHeight: 1.6,
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 32, fontWeight: 600, lineHeight: 1.25, mt: 0.25 }}>
        {value}
      </Typography>
      {caption && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
          {caption}
        </Typography>
      )}
    </Paper>
  );
}
