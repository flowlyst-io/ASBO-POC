"use client";

import * as React from "react";
import { alpha, useTheme, type Theme } from "@mui/material/styles";
import { Box, Button, Link as MuiLink, Paper, TextField, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ErrorIcon from "@mui/icons-material/Error";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import SignalCellularAltIcon from "@mui/icons-material/SignalCellularAlt";
import SignalCellularAlt2BarIcon from "@mui/icons-material/SignalCellularAlt2Bar";
import SignalCellularAlt1BarIcon from "@mui/icons-material/SignalCellularAlt1Bar";
import DescriptionIcon from "@mui/icons-material/Description";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import { viewerTokens } from "@/lib/theme";
import type { Confidence, Finding, FindingStatus, ReviewAction } from "@/lib/types";

export interface FindingCardProps {
  finding: Finding;
  selected: boolean;
  /** Accordion state — fully controlled by the page (survives findings polling). */
  expanded: boolean;
  editing: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  /** Citation-link click: select AND reopen the document viewer if hidden. */
  onOpenCitation?: () => void;
  onEditStart: () => void;
  onEditCancel: () => void;
  review: (findingId: string, action: ReviewAction, comment?: string) => Promise<void>;
}

interface StatusMeta {
  label: string;
  icon: React.ReactElement;
  /** Icon + label color inside the pill. */
  color: string;
  /** Tinted pill background. */
  tint: string;
  /** Left accent bar color when the card is unselected. */
  accent: string;
}

function statusMeta(theme: Theme, status: FindingStatus): StatusMeta {
  const iconSx = { fontSize: 14 } as const;
  switch (status) {
    case "met":
      return {
        label: "Met",
        icon: <CheckCircleIcon sx={iconSx} />,
        color: theme.palette.success.main,
        tint: alpha(theme.palette.success.main, 0.12),
        accent: theme.palette.success.main,
      };
    case "not_met":
      return {
        label: "Not met",
        icon: <CancelIcon sx={iconSx} />,
        color: theme.palette.error.main,
        tint: alpha(theme.palette.error.main, 0.12),
        accent: theme.palette.error.main,
      };
    case "partial":
      return {
        label: "Partially met",
        icon: <ErrorIcon sx={iconSx} />,
        color: viewerTokens.warningTextOnLight,
        tint: alpha(theme.palette.warning.main, 0.14),
        accent: theme.palette.warning.main,
      };
    case "na":
      return {
        label: "Not applicable",
        icon: <RemoveCircleOutlineIcon sx={iconSx} />,
        color: theme.palette.grey[700],
        tint: alpha(theme.palette.grey[700], 0.12),
        accent: theme.palette.grey[500],
      };
    case "cannot_determine":
      return {
        label: "Cannot determine",
        icon: <HelpOutlineIcon sx={iconSx} />,
        color: theme.palette.grey[700],
        tint: alpha(theme.palette.grey[700], 0.12),
        accent: theme.palette.grey[600],
      };
  }
}

function confidenceMeta(confidence: Confidence): {
  label: string;
  icon: React.ReactElement;
  color: "success.main" | "warning.main" | "error.main";
} {
  const iconSx = { fontSize: 16 } as const;
  switch (confidence) {
    case "high":
      return { label: "High confidence", icon: <SignalCellularAltIcon sx={iconSx} />, color: "success.main" };
    case "medium":
      return { label: "Medium confidence", icon: <SignalCellularAlt2BarIcon sx={iconSx} />, color: "warning.main" };
    case "low":
      return { label: "Low confidence", icon: <SignalCellularAlt1BarIcon sx={iconSx} />, color: "error.main" };
  }
}

function CommentEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = React.useState(initial);
  return (
    <Box onClick={(e) => e.stopPropagation()} sx={{ mt: 1.5 }}>
      <TextField
        label="Reviewer comment"
        multiline
        rows={4}
        fullWidth
        size="small"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
        <Button size="small" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={() => onSave(text)}
        >
          Save comment
        </Button>
      </Box>
    </Box>
  );
}

/**
 * One AI-prepared checklist finding. Renders as a compact accordion row
 * (caret, #num, title, status, review indicator); expanding reveals the full
 * detail with the Confirm / Edit / Reject actions — reading before acting is
 * the deliberate gesture (coe-domain: humans decide).
 */
export default function FindingCard({
  finding,
  selected,
  expanded,
  editing,
  onSelect,
  onToggleExpand,
  onOpenCitation,
  onEditStart,
  onEditCancel,
  review,
}: FindingCardProps) {
  const theme = useTheme();
  const meta = statusMeta(theme, finding.status);
  const conf = confidenceMeta(finding.confidence);

  const edited = finding.review?.state === "edited";
  const commentText = edited && finding.review?.comment ? finding.review.comment : finding.comment;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const reviewPill = (() => {
    if (!finding.review) return null;
    switch (finding.review.state) {
      case "accepted":
        return { label: "Confirmed", icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, color: theme.palette.success.main, tint: alpha(theme.palette.success.main, 0.12) };
      case "rejected":
        return { label: "Rejected", icon: <CancelIcon sx={{ fontSize: 14 }} />, color: theme.palette.error.main, tint: alpha(theme.palette.error.main, 0.12) };
      case "edited":
        return { label: "Edited & confirmed", icon: <EditIcon sx={{ fontSize: 14 }} />, color: theme.palette.primary.main, tint: alpha(theme.palette.primary.main, 0.1) };
    }
  })();

  const showDetail = expanded || editing;

  // Compact-row review indicator (far right): reviewed state, verifier flag,
  // or hollow circle for "not yet reviewed".
  const compactIndicator = finding.review ? (
    finding.review.state === "accepted" ? (
      <CheckCircleIcon titleAccess="Confirmed" sx={{ fontSize: 18, color: "success.main" }} />
    ) : finding.review.state === "rejected" ? (
      <CancelIcon titleAccess="Rejected" sx={{ fontSize: 18, color: "error.main" }} />
    ) : (
      <EditIcon titleAccess="Edited & confirmed" sx={{ fontSize: 18, color: "primary.main" }} />
    )
  ) : finding.verifierStatus === "flagged" ? (
    <ReportProblemIcon titleAccess="Needs human" sx={{ fontSize: 18, color: "warning.main" }} />
  ) : (
    <RadioButtonUncheckedIcon titleAccess="Unreviewed" sx={{ fontSize: 18, color: "text.disabled" }} />
  );

  return (
    <Paper
      elevation={selected ? 6 : 1}
      onClick={onSelect}
      sx={{
        position: "relative",
        cursor: "pointer",
        px: 2,
        py: showDetail ? 2 : 1.25,
        overflow: "hidden",
        border: `1px solid ${viewerTokens.cardBorder}`,
        transition: "box-shadow 150ms cubic-bezier(0.4,0,0.2,1)",
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: selected ? "primary.main" : meta.accent,
        },
      }}
    >
      <Box
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
        sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
      >
        <ExpandMoreIcon
          sx={{
            fontSize: 20,
            color: "text.secondary",
            flexShrink: 0,
            transform: showDetail ? "rotate(180deg)" : "none",
            transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)",
          }}
        />
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary", flexShrink: 0 }}>
          #{finding.num}
        </Typography>
        <Typography
          noWrap={!showDetail}
          sx={{ fontSize: showDetail ? 16 : 14, fontWeight: 500, lineHeight: 1.3, flex: 1, minWidth: 0 }}
        >
          {finding.title}
        </Typography>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            px: 1,
            py: 0.4,
            borderRadius: "14px",
            bgcolor: meta.tint,
            color: meta.color,
            flexShrink: 0,
          }}
        >
          {meta.icon}
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "inherit" }}>
            {meta.label}
          </Typography>
        </Box>
        <Box sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
          {compactIndicator}
        </Box>
      </Box>

      {showDetail && (
        <>
      <Typography
        variant="overline"
        sx={{
          display: "block",
          fontSize: 10.5,
          letterSpacing: 0.8,
          color: "text.secondary",
          lineHeight: 1.6,
          mt: 1,
        }}
      >
        {finding.section.toUpperCase()} · CRITERION {finding.num}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mt: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: conf.color }}>
          {conf.icon}
          <Typography sx={{ fontSize: 12, fontWeight: 500, color: "inherit" }}>
            {conf.label}
          </Typography>
        </Box>
        {finding.cite && (
          <MuiLink
            component="button"
            type="button"
            underline="hover"
            onClick={(e) => {
              e.stopPropagation();
              (onOpenCitation ?? onSelect)();
            }}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: 12,
              fontWeight: 500,
              color: "primary.main",
            }}
          >
            <DescriptionIcon sx={{ fontSize: 14 }} />
            {finding.cite}
            <OpenInNewIcon sx={{ fontSize: 12 }} />
          </MuiLink>
        )}
      </Box>

      {finding.verifierStatus === "flagged" && (
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "flex-start",
            mt: 1.5,
            p: 1.25,
            borderRadius: "6px",
            bgcolor: alpha(theme.palette.warning.main, 0.1),
          }}
        >
          <ReportProblemIcon sx={{ fontSize: 16, color: "warning.main", mt: "1px" }} />
          <Typography sx={{ fontSize: 12.5, color: viewerTokens.warningTextOnLight }}>
            <Box component="span" sx={{ fontWeight: 600 }}>
              Verifier flagged — needs human.
            </Box>{" "}
            {finding.verifierReason ?? "Citation could not be independently confirmed."}{" "}
            Confirm, Edit, or Reject below once you&apos;ve checked the citation.
          </Typography>
        </Box>
      )}

      {editing ? (
        <CommentEditor
          initial={commentText}
          onCancel={onEditCancel}
          onSave={(text) => {
            void review(finding.id, "edit", text);
            onEditCancel();
          }}
        />
      ) : (
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: "6px", bgcolor: "#F7F9FC" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <AutoAwesomeIcon sx={{ fontSize: 14, color: "primary.main" }} />
            <Typography
              variant="overline"
              sx={{ fontSize: 10, letterSpacing: 0.8, color: "text.secondary", lineHeight: 1.6 }}
            >
              {edited ? "Reviewer comment (edited)" : "AI draft comment"}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 14, mt: 0.25 }}>{commentText}</Typography>
        </Box>
      )}

      {!editing && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          {finding.review && reviewPill ? (
            <>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1,
                  py: 0.4,
                  borderRadius: "14px",
                  bgcolor: reviewPill.tint,
                  color: reviewPill.color,
                }}
              >
                {reviewPill.icon}
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: "inherit" }}>
                  {reviewPill.label}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={(e) => {
                  stop(e);
                  onEditStart();
                }}
              >
                Edit
              </Button>
              <Button
                size="small"
                onClick={(e) => {
                  stop(e);
                  void review(finding.id, "undo");
                }}
              >
                Undo
              </Button>
            </>
          ) : (
            <>
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<CheckIcon />}
                onClick={(e) => {
                  stop(e);
                  void review(finding.id, "accept");
                }}
              >
                Confirm
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={(e) => {
                  stop(e);
                  onEditStart();
                }}
              >
                Edit
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<CloseIcon />}
                onClick={(e) => {
                  stop(e);
                  void review(finding.id, "reject");
                }}
              >
                Reject
              </Button>
            </>
          )}
        </Box>
      )}
        </>
      )}
    </Paper>
  );
}
