---
name: verify-backbone
description: Executable verification checklist proving the architecture backbone (and later, features) is sound — typecheck, lint, migrate, seed, dev boot, and the MOCK_AI end-to-end stub run. Run this after any significant change; it is the qa-verifier agent's playbook.
---

# Verify Backbone

Run from the repo root. All steps must be green. Windows notes at the bottom.

## 1. Install & static checks

```
npm install          # clean install on Node 22
npm run typecheck    # tsc --noEmit, strict — zero errors
npm run lint         # eslint — zero errors
```

## 2. Database

```
npm run db:migrate   # applies drizzle migrations (creates ./.data/pg PGlite dir when DATABASE_URL unset)
npm run db:seed      # idempotent
```

Expected after seed: **3 `applications`**, **3 `documents`** (one per sample PDF),
**~40 `criteria`** rows (checklist_version v2025.1). The seed script prints counts; verify them.

## 3. Dev server boots

```
npm run dev
```

- `GET http://localhost:3000/` → 200, renders the intake screen shell (app bar, nav rail,
  upload card, pipeline card, gate card).
- `GET http://localhost:3000/review/00000000-0000-0000-0000-000000000000` → renders the
  workspace shell with a "run not found"/empty state (must not crash).

## 4. End-to-end stub run (no API key needed)

**Stop the dev server first** — the stub run opens the embedded PGlite database in-process, and
PGlite is single-process (the dev server's lock would block it). With `MOCK_AI=1` (default):

```
npm run stub-run
```

The script creates a run for the Rockford sample (same code path as `POST /api/runs`), drives
the advance chain in-process (stand-in for the HTTP self-trigger), then asserts:

- run status = `awaiting_review`
- 7 `run_steps` with status `done` (or gate-fail path: later steps `skipped`)
- 6 `gate_checks` resolved (mock: all `pass`)
- ≥ 8 `findings`, every one with `page` and `cite` populated
- `audit_log` has ≥ 1 row per mocked LLM call
- it then POSTs one review action and asserts the `reviews` row exists

Exit code 0 + printed summary = pass.

## 5. Manual click-through (when UI is wired)

Intake → Load sample → pipeline steps advance from real polling → gate passes → Open prepared
review → select a finding → citation viewer shows the page with the yellow highlight → Accept a
finding → progress updates → all reviewed → "Mark ready for decision" enables.

## Windows gotchas

- PGlite holds a file lock on `./.data/pg` — stop the dev server before deleting `.data/`.
- Port 3000 in use: `Get-NetTCPConnection -LocalPort 3000` then stop the owning process.
- If `npm run dev` is started from a background shell, give it ~10s before curling.
- Kill stray node processes between full re-verifications if PGlite complains about locks.
