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
  /** Authoritative total from the API; falls back to summing rows. */
  totalCostUsd?: number;
}

/** Compact token count: 850 → "850", 12_340 → "12.3k". */
function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCost(v: number): string {
  return `$${v.toFixed(4)}`;
}

const numberCellSx = {
  fontVariantNumeric: "tabular-nums",
  fontSize: 13,
} as const;

/** Per-run LLM cost breakdown with a Total footer row. */
export default function CostTable({ rows, totalCostUsd }: CostTableProps) {
  const totals = rows.reduce(
    (acc, r) => ({
      llmCalls: acc.llmCalls + r.llmCalls,
      inputTokens: acc.inputTokens + r.inputTokens,
      outputTokens: acc.outputTokens + r.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + r.cacheReadTokens,
      costUsd: acc.costUsd + r.costUsd,
    }),
    { llmCalls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 },
  );
  const totalCost = totalCostUsd ?? totals.costUsd;

  return (
    <Paper elevation={1} sx={{ overflow: "hidden" }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>AI cost per run</Typography>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
          Derived from audited LLM calls · claude-haiku pricing
        </Typography>
      </Box>
      <Table size="small" sx={{ "& td, & th": { py: 1 } }}>
        <TableHead>
          <TableRow>
            <TableCell>District</TableCell>
            <TableCell>Classification</TableCell>
            <TableCell align="right">Calls</TableCell>
            <TableCell align="right">Input</TableCell>
            <TableCell align="right">Output</TableCell>
            <TableCell align="right">Cache read</TableCell>
            <TableCell align="right">Cost</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
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
              <TableCell align="right" sx={numberCellSx}>
                {formatTokens(row.inputTokens)}
              </TableCell>
              <TableCell align="right" sx={numberCellSx}>
                {formatTokens(row.outputTokens)}
              </TableCell>
              <TableCell align="right" sx={numberCellSx}>
                {formatTokens(row.cacheReadTokens)}
              </TableCell>
              <TableCell align="right" sx={numberCellSx}>
                {formatCost(row.costUsd)}
              </TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow sx={{ "& td": { borderBottom: 0, fontWeight: 500 } }}>
              <TableCell>Total</TableCell>
              <TableCell />
              <TableCell align="right" sx={numberCellSx}>
                {totals.llmCalls}
              </TableCell>
              <TableCell align="right" sx={numberCellSx}>
                {formatTokens(totals.inputTokens)}
              </TableCell>
              <TableCell align="right" sx={numberCellSx}>
                {formatTokens(totals.outputTokens)}
              </TableCell>
              <TableCell align="right" sx={numberCellSx}>
                {formatTokens(totals.cacheReadTokens)}
              </TableCell>
              <TableCell align="right" sx={numberCellSx}>
                {formatCost(totalCost)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}
