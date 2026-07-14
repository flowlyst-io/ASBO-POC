"use client";

import * as React from "react";
import {
  Avatar,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import type { ReviewerSummary } from "@/lib/types";

export interface ReviewersTableProps {
  rows: ReviewerSummary[];
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Reviewer roster: identity, home state (recusal basis), workload counts. */
export default function ReviewersTable({ rows }: ReviewersTableProps) {
  return (
    <Paper elevation={1} sx={{ overflow: "hidden" }}>
      <Table size="small" sx={{ "& td, & th": { py: 1.25 } }}>
        <TableHead>
          <TableRow>
            <TableCell>Reviewer</TableCell>
            <TableCell>State</TableCell>
            <TableCell align="right">Assigned</TableCell>
            <TableCell align="right">Completed</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
                  No reviewers found.
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {rows.map((reviewer) => (
            <TableRow key={reviewer.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: 13 }}>
                    {initialsOf(reviewer.name)}
                  </Avatar>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                        {reviewer.name}
                      </Typography>
                      {reviewer.isDemo && <Chip size="small" color="primary" label="You" />}
                    </Box>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                      {reviewer.title}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
              <TableCell>
                <Chip size="small" variant="outlined" label={reviewer.state} />
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontSize: 13.5 }}>
                {reviewer.assignedCount}
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontSize: 13.5 }}>
                {reviewer.completedCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
