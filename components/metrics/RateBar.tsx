"use client";

import * as React from "react";
import { Box, LinearProgress, Typography } from "@mui/material";

export interface RateBarProps {
  label: string;
  /** Rate as a fraction 0..1; null renders an em-dash "no data yet" state. */
  value: number | null;
  numerator?: number;
  denominator?: number;
  caption?: string;
}

/**
 * Labeled rate meter (dataviz meter contract: primary-hue fill on the same
 * ramp's lighter track via LinearProgress). Null value = no data yet.
 */
export default function RateBar({ label, value, numerator, denominator, caption }: RateBarProps) {
  const percent = value === null ? 0 : Math.round(value * 100);
  const detail =
    numerator !== undefined && denominator !== undefined
      ? `${numerator} of ${denominator}${caption ? ` — ${caption}` : ""}`
      : caption;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>{label}</Typography>
        <Typography
          sx={{
            fontSize: 13.5,
            fontWeight: 500,
            color: value === null ? "text.disabled" : "text.primary",
          }}
        >
          {value === null ? "—" : `${percent}%`}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value === null ? 0 : Math.min(100, Math.max(0, value * 100))}
        sx={{ height: 6, borderRadius: 3, mt: 0.75 }}
      />
      <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
        {value === null ? "No data yet" : detail ?? ""}
      </Typography>
    </Box>
  );
}
