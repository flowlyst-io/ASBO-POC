# ASBO COE Review Automation — POC

AI-assisted review for ASBO's Certificate of Excellence (COE) program: upload a school
district's ACFR (Annual Comprehensive Financial Report), run automated completeness gating,
page-cited checklist findings with a verifier guardrail, and quality triage — reviewed by a
human in a NotebookLM-style workspace. **The AI never issues the Award / Conditional / Denied
decision.** Full product spec: `PRD_ASBO_COE_Review_Automation.md`.

## Quickstart

```bash
npm install
copy .env.example .env.local     # defaults work out of the box (mock AI, embedded DB)
npm run db:migrate               # creates the embedded PGlite DB at ./.data/pg
npm run db:seed                  # ~40 checklist criteria + 3 sample ACFR applications
npm run dev                      # http://localhost:3000
```

Click **Load sample** on the intake screen → the pipeline runs → **Open prepared review**.

- `MOCK_AI=1` (default): the whole pipeline runs with deterministic mock LLM outputs — no API
  key needed. Set `ANTHROPIC_API_KEY` in `.env.local` and `MOCK_AI=0` for real
  `claude-haiku-4-5` calls.
- `DATABASE_URL` empty → embedded PGlite; set a Neon/Postgres URL for shared environments.
- `BLOB_READ_WRITE_TOKEN` empty → local file storage; set for Vercel Blob.

## Verify the backbone

```bash
npm run typecheck && npm run lint
npm run db:migrate && npm run db:seed
npm run stub-run        # in-process E2E: extract → segment → gate → checklist → verify → classify
                        # (stop the dev server first — PGlite is single-process)
```

Full checklist: `.claude/skills/verify-backbone/SKILL.md`.

## Architecture

- **Next.js 15 (App Router) + MUI** — two screens per the design handoff
  (`design_handoff_coe_review/`): intake (upload → pipeline → completeness gate) and reviewer
  workspace (findings | citation viewer).
- **Async step chain** — `POST /api/runs` registers a run; `/api/runs/[id]/advance` executes one
  bounded unit of work and re-triggers itself (Vercel-timeout-safe); the client polls. Steps:
  `extract → tables → segment → gate → checklist → verify → classify`.
- **Drizzle ORM, Postgres dialect** — embedded PGlite locally, Neon in production. Schema:
  `db/schema.ts`.
- **LLM layer** — `lib/ai/models.ts` is the ONLY place model IDs exist (all `claude-haiku-4-5`
  by user decision); `lib/ai/client.ts` is the only SDK touchpoint (structured outputs via zod,
  prompt caching, full audit logging); `lib/ai/mock.ts` powers key-free dev.
- **Every finding is page-cited**; uncitable findings are downgraded to needs-human by the
  verifier stage — never presented as confident.

## Claude Code development setup

This repo is built by Claude Code with **Fable 5 as the orchestrator** spawning worker
subagents. `.claude/settings.json` sets `bypassPermissions` (no permission prompts — user
decision). Knowledge lives in skills, ownership seams in agents:

- Skills: `coe-domain` (what the checks mean), `design-handoff` (pixel spec),
  `pipeline-architecture` (step-chain contract + Anthropic rules), `verify-backbone`
  (verification playbook).
- Agents: `pipeline-builder`, `api-builder`, `ui-builder`, `qa-verifier`.

## Samples

`samples/` holds three public ACFRs (see `samples/manifest.json`). **Davenport IA has a
partially degraded text layer** — the OCR-fallback test case: 43/179 pages get flagged
`needs_ocr` and are excluded from LLM context. A document with >30% flagged pages is marked
degraded and the gate reports needs-human instead of hallucinating passes.
