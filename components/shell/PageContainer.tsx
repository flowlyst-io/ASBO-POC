"use client";

import * as React from "react";
import { Box, Typography } from "@mui/material";

export interface PageContainerProps {
  title: string;
  subtitle?: string;
  /** Rendered above the H1 (pass a fully-built <Breadcrumbs> element). */
  breadcrumbs?: React.ReactNode;
  /** Right-aligned next to the H1 (e.g. a primary action Button). */
  action?: React.ReactNode;
  maxWidth?: number;
  children: React.ReactNode;
}

/**
 * Shared page scaffold: outer scroll area + centered column (the intake
 * screen's scroll pattern, extracted). H1 matches intake: h5 / weight 500.
 */
export default function PageContainer({
  title,
  subtitle,
  breadcrumbs,
  action,
  maxWidth = 1080,
  children,
}: PageContainerProps) {
  return (
    <Box sx={{ flex: 1, overflowY: "auto" }}>
      <Box sx={{ maxWidth, mx: "auto", px: 3, py: 3.5 }}>
        {breadcrumbs}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Box>
        <Box sx={{ mt: 3 }}>{children}</Box>
      </Box>
    </Box>
  );
}
