"use client";

import { createTheme } from "@mui/material/styles";

/**
 * Flowlyst COE Review theme — exact tokens from the design handoff
 * (.claude/skills/design-handoff). Do not hard-code these values in
 * components; consume them via the theme.
 */
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1976D2", dark: "#1565C0" },
    success: { main: "#2E7D32", dark: "#1B5E20" },
    error: { main: "#D32F2F" },
    warning: { main: "#ED6C02" },
    info: { main: "#0288D1" },
    background: { default: "#F4F5F7", paper: "#FFFFFF" },
    text: {
      primary: "rgba(0,0,0,0.87)",
      secondary: "rgba(0,0,0,0.6)",
      disabled: "rgba(0,0,0,0.38)",
    },
    divider: "rgba(0,0,0,0.12)",
  },
  typography: {
    fontFamily: "var(--font-roboto), Roboto, Helvetica, Arial, sans-serif",
  },
  shape: {
    borderRadius: 4, // MUI default; cards use 8 via component overrides below
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 8 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
});

/** Viewer-specific tokens that are not part of the MUI palette. */
export const viewerTokens = {
  viewerBg: "#E9EBEF",
  dropzoneBg: "#FAFAFA",
  citationHighlightBg: "#FFF2A8",
  citationHighlightRing: "0 0 0 2px #F9C200",
  cardBorder: "rgba(0,0,0,0.06)",
  warningTextOnLight: "#B35300",
} as const;
