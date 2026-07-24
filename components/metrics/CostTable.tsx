"use client";

import * as React from "react";
import {
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

import type { RunCostRow } from "@/lib/types";
import { ClassificationChip } from "@/components/applications/statusChips";

export interface CostTableProps {
  rows: RunCostRow[];
}

const numberCellSx = {
  fontVariantNumeric: "tabular-nums",
  fontSize: 13,
} as const;

/** Per-run LLM call counts with a Total footer row. */
export default function CostTable({ rows }: CostTableProps) {
  const totalCalls = rows.reduce((sum, r) => sum + r.llmCalls, 0);

  return (
    <Paper elevation={1} sx={{ overflow: "hidden" }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>AI usage per run</Typography>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
          LLM call counts derived from the audit log
        </Typography>
      </Box>
      <Table size="small" sx={{ "& td, & th": { py: 1 } }}>
        <TableHead>
          <TableRow>
            <TableCell>District</TableCell>
            <TableCell>Classification</TableCell>
            <TableCell align="right">Calls</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                  No runs recorded yet.
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.runId} hover>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>
                    {row.districtName}
                  </Typography>
                  {row.mock && <Chip size="small" variant="outlined" label="mock" />}
                </Box>
              </TableCell>
              <TableCell>
                <ClassificationChip classification={row.classification} />
              </TableCell>
              <TableCell align="right" sx={numberCellSx}>
                {row.llmCalls}
              </TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow sx={{ "& td": { borderBottom: 0, fontWeight: 500 } }}>
              <TableCell>Total</TableCell>
              <TableCell />
              <TableCell align="right" sx={numberCellSx}>
                {totalCalls}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}
