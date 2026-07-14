---
name: design-handoff
description: Distilled build spec for the two-screen MUI UI (intake + reviewer workspace) — design tokens, app shell, per-component specs, interactions, and MUI/icon mapping. Read this before creating or modifying anything in app/ pages, components/, or lib/theme.ts.
---

# Design Handoff — COE Review UI

Full source: `design_handoff_coe_review/README.md`. Visual reference: open
`design_handoff_coe_review/COE_Review_prototype_standalone.html` in a browser
(intake → "Load sample" → pipeline runs → "Open prepared review").
The prototype's sample content is **placeholder** — real data comes from the API.

High-fidelity: recreate pixel-close with `@mui/material` + `@mui/icons-material`.
Icon names map 1:1 (`fact_check` → `FactCheckIcon`). Fonts: Roboto + Roboto Mono via `next/font`.

## Design tokens (`lib/theme.ts` — never hard-code in components)

- Primary `#1976D2` (dark `#1565C0`, 10% tint `rgba(25,118,210,0.1)`)
- Success `#2E7D32` (dark `#1B5E20`, 12% tint), Error `#D32F2F` (12% tint),
  Warning `#ED6C02` (text-on-light `#B35300`, 14% tint), Info `#0288D1`
- Text: primary `rgba(0,0,0,0.87)`, secondary `rgba(0,0,0,0.6)`, disabled `rgba(0,0,0,0.38)`
- Surfaces: page bg `#F4F5F7`, paper `#FFF`, viewer bg `#E9EBEF`, dropzone bg `#FAFAFA`
- Divider `rgba(0,0,0,0.12)`; card border `rgba(0,0,0,0.06)`
- Radius: 8px cards, 4px MUI default, 14–16px pills/chips
- Elevation: app bar 2, cards 1, selected finding card 6, PDF page 8, bottom bar 4
- **Citation highlight**: bg `#FFF2A8`, ring `0 0 0 2px #F9C200`
- Transitions 150ms, easing `cubic-bezier(0.4,0,0.2,1)`

## App shell (`components/shell/AppShell.tsx`, both screens)

- **Top bar**: fixed 60px, white, elevation-2. Left: menu icon, Flowlyst mark (28px rounded-6
  `#1976D2` square + white `stream` icon) + "Flowlyst" (20px/500), "/" divider, "COE Review"
  (16px/500). Right: 300px small outlined search TextField ("Search applications, districts…"),
  help + notifications (red 8px dot) IconButtons, 34px Avatar.
- **Nav rail**: fixed 232px, white, right divider. Overline "WORKSPACE": Dashboard, **Applications**
  (active: text `#1565C0`, bg primary-10%, 3px left accent, count badge "24"), Reviewers, Metrics.
  Overline "MY QUEUE": Assigned to me ("6"), Completed. Bottom `#F4F5F7` info card:
  `verified_user` + "Human-in-the-loop / AI prepares findings. You decide every outcome."
- Applications nav item → intake screen.

## Screen 1 — Intake (`app/page.tsx`)

Centered `max-width: 1080px`; breadcrumb → H1 "New application intake" (24px/500) → subtitle.
Wrapping flex row gap 24: left `flex: 1 1 460px`, right `flex: 0 1 380px`.

- **UploadCard**: dashed dropzone (idle border `rgba(0,0,0,0.25)` bg `#FAFAFA`; dragover border
  `#1976D2` bg primary-6%), `cloud_upload` 52px, "Drag & drop the ACFR and application files",
  **Browse files** (contained, `upload_file`, hidden multi-PDF input) + **Load sample** (outlined,
  `folder_special`). Info strip below (`#F4F5F7`): POC pre-loaded ACFRs / production presigned S3.
- **UploadedFilesCard** (after files chosen): rows of `picture_as_pdf` (red), name+size, kind Chip
  (ACFR=primary, Application=info, Checklist=secondary), status `hourglass_top` "Uploading…" →
  `check_circle` "Extracted". Header has **Reset** text button.
- **PipelineCard**: caption "Runs asynchronously — findings stream in as workers finish".
  5 step rows (30px circle: done=green+check, active=primary+icon, pending=grey), driven by
  polled `run_steps`. Steps: Upload & secure storage / Text extraction & OCR / Table extraction /
  Section segmentation / Completeness gate.
- **GateCard**: status Chip "Awaiting files"→"Queued"→"Checking…"(warning)→"Passed"(success).
  6 check rows (pending `radio_button_unchecked` "—"; passed `check_circle` "Pass"). Footer
  caption about human-confirmed rejection. When passed: green banner + full-width
  **Open prepared review** (contained, `arrow_forward` end icon) → `/review/[runId]`.

## Screen 2 — Reviewer workspace (`app/review/[runId]/page.tsx`)

Vertical stack: ContextBar / split FindingsPanel|CitationViewer / BottomBar.

- **ContextBar**: breadcrumb (Applications is a link back), H1 district name (22px/500) + quality
  badge Chip (`workspace_premium`), sub line "ACFR · FY … · State · N pages · checklist version".
  Right stats with vertical dividers: Completeness passed / Verifier: N/M confirmed / N of M
  reviewed + 6px progress bar.
- **FindingsPanel** (`flex: 0 1 440px`, min 340 max 520, bg `#F4F5F7`): header + filter Chips
  (All / Needs human / Not met / Partial / Met — live counts, active=filled primary). Scrolling
  **FindingCard** list.
- **FindingCard** (white, radius 8, 4px left accent = status color; selected → accent primary +
  elevation-6): overline "{SECTION} · Criterion {num}", title, status pill top-right
  (Met `check_circle` `#2E7D32` / Not met `cancel` `#D32F2F` / Partially met `error` `#B35300` /
  Not applicable `remove_circle_outline` `#616161` / Cannot determine `help_outline` `#616161`),
  confidence row (`signal_cellular_alt*` icons, High/Medium/Low in success/warning/error),
  citation link (`description` + "p. N — …" + `open_in_new`), needs-human warning banner when
  verifier-flagged, AI draft comment box (`#F7F9FC`, `auto_awesome`, overline "AI DRAFT COMMENT"
  or "REVIEWER COMMENT (EDITED)"), action row: **Accept** (contained success) / **Edit** (outlined) /
  **Reject** (text error); after review → state pill + Edit/Undo text buttons. Edit mode swaps the
  comment box for a 4-row TextField + Cancel/Save.
- **CitationViewer** (remaining space, bg `#E9EBEF`): toolbar (pdf icon, filename · section,
  page nav, zoom, download), 620px Paper elevation-8, 52/56px padding, Roboto Mono body, running
  header, the cited line highlighted (`#FFF2A8` + `#F9C200` ring), footer "— {page} —". Link-back
  bar: `my_location` + "Source for {criterion}" + **Jump to citation** (smooth-scroll the
  container, NOT `scrollIntoView`).
- **BottomBar**: fixed 60px, elevation-4. Incomplete: `pending_actions` + "N of M findings
  confirmed…". Complete: `task_alt` + "All M findings confirmed · K accepted. Ready to route…".
  Right: **Add general note** (outlined) + **Mark ready for decision** (contained, disabled until
  all findings reviewed). The AI never issues the decision.

## State & behavior

- Intake state: `files[]`, run id, polled run/steps/gate via `useRunStatus` (2s poll, stop on
  terminal). No timer simulation — real backend status.
- Review state: `selectedId`, `filter`, `editingId`, `editText`, reviews map
  findingId → `{ state: accepted|rejected|edited, comment }` (persisted via API, optimistic UI).
- Card click selects finding → viewer re-renders page/highlight. Action buttons `stopPropagation`.
- Findings stream in progressively while the checklist/verify steps run — the list grows.
