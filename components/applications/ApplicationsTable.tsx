"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import type { ApplicationListItem, ReviewerSummary } from "@/lib/types";
import AssignMenu from "@/components/applications/AssignMenu";
import { ClassificationChip, RunStatusChip } from "@/components/applications/statusChips";

export interface ApplicationsTableProps {
  rows: ApplicationListItem[];
  reviewers?: ReviewerSummary[];
  onAssigned?: () => void;
  emptyLabel: string;
  showAssign?: boolean;
  limit?: number;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Applications list table (Applications page, queues, dashboard). Row click
 * opens the prepared review when a run exists, else the intake screen.
 */
export default function ApplicationsTable({
  rows,
  reviewers,
  onAssigned,
  emptyLabel,
  showAssign = false,
  limit,
}: ApplicationsTableProps) {
  const router = useRouter();
  const visible = limit !== undefined ? rows.slice(0, limit) : rows;

  const openRow = (row: ApplicationListItem) => {
    if (row.latestRunId) router.push(`/review/${row.latestRunId}`);
    else router.push("/intake");
  };

  return (
    <Paper elevation={1} sx={{ overflow: "hidden" }}>
      <Table size="small" sx={{ "& td, & th": { py: 1.25 } }}>
        <TableHead>
          <TableRow>
            <TableCell>District</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Gate</TableCell>
            <TableCell>Classification</TableCell>
            <TableCell>Assignee</TableCell>
            <TableCell>Received</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
                  {emptyLabel}
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {visible.map((row) => (
            <TableRow
              key={row.id}
              hover
              onClick={() => openRow(row)}
              sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}
            >
              <TableCell>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                  {row.districtName}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                  {row.state} · FY ending {formatDate(row.fiscalYearEnd)}
                </Typography>
              </TableCell>
              <TableCell>
                <RunStatusChip status={row.latestRunStatus} />
              </TableCell>
              <TableCell>
                {row.gatePassed === true ? (
                  <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
                ) : row.gatePassed === false ? (
                  <CancelIcon sx={{ fontSize: 18, color: "error.main" }} />
                ) : (
                  <Typography sx={{ fontSize: 13, color: "text.disabled" }}>—</Typography>
                )}
              </TableCell>
              <TableCell>
                <ClassificationChip classification={row.classification} />
              </TableCell>
              <TableCell>
                {showAssign && reviewers ? (
                  <AssignMenu
                    application={row}
                    reviewers={reviewers}
                    onAssigned={onAssigned ?? (() => undefined)}
                  />
                ) : (
                  <Typography sx={{ fontSize: 13.5 }}>
                    {row.assignedReviewer?.name ?? "—"}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                  {formatDate(row.createdAt)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
