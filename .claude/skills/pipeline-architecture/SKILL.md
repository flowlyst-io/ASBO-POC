---
name: pipeline-architecture
description: The async pipeline contract for this repo — self-advancing step chain, idempotent claiming, progressive writes, cursor format, and the Anthropic API usage rules (Haiku-only, structured outputs, prompt caching, MOCK_AI, audit logging). Read this before touching lib/pipeline/*, lib/ai/*, or app/api/runs/*.
---

# Pipeline Architecture

## The step chain (Vercel-timeout-safe, works identically locally)

1. `POST /api/runs` creates a `runs` row (status `queued`), 7 `run_steps` rows (`pending`),
   6 `gate_checks` rows (`pending`), writes an audit row, then **fire-and-forget** triggers
   `POST {origin}/api/runs/{id}/advance` with header `x-internal-secret: INTERNAL_RUN_SECRET`
   (do not await the body; on Vercel wrap in `after()` so the trigger survives response end).
   Responds `202 { runId }`.
2. `advance` (`export const maxDuration = 300`) calls `advanceRun(runId)` in
   `lib/pipeline/orchestrate.ts`, which executes **exactly one bounded unit of work**:
   a whole step for cheap steps (extract, tables, segment, gate, verify, classify) or **one
   batch** of a long step (checklist processes ~5 criteria per invocation).
3. After persisting, if work remains → fire-and-forget re-trigger itself. If not → set run
   status `awaiting_review` (gate passed, findings ready) / `awaiting_review` with gate-fail
   flag / `failed`.
4. The client never waits on a long request: `useRunStatus` polls `GET /api/runs/[id]` every 2s;
   the review screen polls `GET /api/runs/[id]/findings` while checklist/verify are live.

## Step order & keys

`extract → tables → segment → gate → checklist → verify → classify`
(enum `step_key` in `db/schema.ts`). Gate failure short-circuits: checklist/verify/classify are
marked `skipped`.

## Rules

- **Idempotent claiming**: claim work with
  `UPDATE run_steps SET status='running', started_at=now() WHERE run_id=? AND step=? AND status IN ('pending','running') RETURNING *` —
  concurrent or duplicate triggers must be harmless. Re-POSTing `advance` after a dropped chain
  link resumes from persisted state.
- **Progressive writes**: `gate.ts` inserts each gate_check result as computed; `checklist.ts`
  inserts findings batch-by-batch. Never buffer everything until the end — the UI streams.
- **Cursors** live in `run_steps.detail` (jsonb), e.g. `{ "cursor": 15, "total": 40 }` for
  checklist. Also record per-step metrics there (token usage, durations).
- **Every LLM call writes an `audit_log` row**: actor `agent:<step>`, model id, prompt version,
  token usage, and (for verifier) the verdict.
- Degraded text (`document_pages.needs_ocr` majority / `documents.text_quality='degraded'`)
  must flow through as `needs_human` gate results and `cannot_determine` findings — never
  hallucinated passes. See the coe-domain skill.

## Anthropic API rules for this repo (HARD constraints)

- **Only `lib/ai/client.ts` may import `@anthropic-ai/sdk`.** Pipeline stages call
  `callStructured(task, {system, user, schema})` — nothing else.
- **Model IDs exist ONLY in `lib/ai/models.ts`**, and every entry is `claude-haiku-4-5`
  (user decision: cheapest model only; the PRD's Opus workers are NOT used). Never hardcode a
  model string anywhere else; never add a non-Haiku model without an explicit user decision.
- **Structured outputs**: use `client.messages.parse()` with `zodOutputFormat(schema)` from
  `@anthropic-ai/sdk/helpers/zod` — schemas live in `lib/schemas.ts`. No hand-rolled JSON parsing.
- **Prompt caching**: the shared document-text prefix (section pages reused across checklist
  calls) gets `cache_control: { type: "ephemeral" }`. Haiku 4.5 minimum cacheable prefix is
  4096 tokens.
- **Context discipline**: Haiku 4.5 has a 200K context — send section-scoped page text, never
  the whole ACFR.
- **`MOCK_AI=1`** (default in dev): `client.ts` delegates to `lib/ai/mock.ts`, which returns
  deterministic canned outputs typed against the same zod schemas. The entire pipeline must run
  end-to-end in mock mode with no API key.
- Server-only: `client.ts` throws if imported in a browser context (a runtime guard instead of
  the `server-only` package, so tsx scripts like stub-run can drive the pipeline in-process);
  the key is never exposed to the client bundle.

## Env (`lib/config.ts`, zod-validated)

`ANTHROPIC_API_KEY` (optional when MOCK_AI=1) · `DATABASE_URL` (unset → embedded PGlite at
`./.data/pg`) · `BLOB_READ_WRITE_TOKEN` (unset → local fs blobs at `./.data/blobs`) ·
`APP_ACCESS_CODE` · `INTERNAL_RUN_SECRET` · `MOCK_AI` · `DAILY_RUN_CAP`.
Caps: 25MB / 350 pages per upload.
