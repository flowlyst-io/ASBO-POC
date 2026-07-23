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

/** Compact token count: 850 → "850", 12_340 → "12.3k". */
function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const numberCellSx = {
  fontVariantNumeric: "tabular-nums",
  fontSize: 13,
} as const;

/** Per-run LLM token usage breakdown with a Total footer row. */
export default function CostTable({ rows }: CostTableProps) {
  const totals = rows.reduce(
    (acc, r) => ({
      llmCalls: acc.llmCalls + r.llmCalls,
      inputTokens: acc.inputTokens + r.inputTokens,
      outputTokens: acc.outputTokens + r.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + r.cacheReadTokens,
    }),
    { llmCalls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
  );

  return (
    <Paper elevation={1} sx={{ overflow: "hidden" }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>AI usage per run</Typography>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
          Token usage derived from audited LLM calls
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
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
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
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}
