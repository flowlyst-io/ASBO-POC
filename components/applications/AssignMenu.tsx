"use client";

import * as React from "react";
import { Alert, Button, ListItemText, Menu, MenuItem, Snackbar } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import type { ReviewerSummary } from "@/lib/types";

/** Minimal application shape needed to assign — satisfied by ApplicationListItem. */
export interface AssignTarget {
  id: string;
  state: string;
  assignedReviewer: { id: string; name: string } | null;
}

export interface AssignMenuProps {
  application: AssignTarget;
  reviewers: ReviewerSummary[];
  onAssigned: () => void;
}

/**
 * Assignment control for one application row. Reviewers from the same state
 * as the district are recused (disabled). Clicks are stopped so the table
 * row's navigation doesn't fire.
 */
export default function AssignMenu({ application, reviewers, onAssigned }: AssignMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const assigned = application.assignedReviewer;

  const assign = async (reviewerId: string | null) => {
    setAnchorEl(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${application.id}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewerId }),
      });
      if (!res.ok) {
        let message = `Assignment failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // non-JSON error body — keep the status message
        }
        throw new Error(message);
      }
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={assigned ? <PersonIcon /> : <PersonAddIcon />}
        endIcon={<ArrowDropDownIcon />}
        disabled={submitting}
        sx={{ textTransform: "none", whiteSpace: "nowrap", fontSize: 12, py: 0.25, px: 1 }}
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}
      >
        {assigned ? assigned.name : "Assign"}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        onClose={() => setAnchorEl(null)}
        onClick={(e) => e.stopPropagation()}
      >
        {reviewers.map((reviewer) => {
          const recused = reviewer.state === application.state;
          return (
            <MenuItem
              key={reviewer.id}
              disabled={recused}
              selected={assigned?.id === reviewer.id}
              onClick={() => void assign(reviewer.id)}
            >
              <ListItemText
                primary={reviewer.name}
                secondary={recused ? "Recused — same state" : reviewer.title}
              />
            </MenuItem>
          );
        })}
        {assigned && (
          <MenuItem onClick={() => void assign(null)}>
            <ListItemText primary="Unassign" />
          </MenuItem>
        )}
      </Menu>
      <Snackbar
        open={error !== null}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError(null)} sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
