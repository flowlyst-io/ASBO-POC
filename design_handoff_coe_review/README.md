# Handoff: ASBO COE Review — Intake & Reviewer Workspace

## Overview
This is the front-end design for Flowlyst's **ASBO Certificate of Excellence (COE) Review Automation** module. It covers two screens of the pipeline described in the PRD:

1. **New application intake** (PRD F1 Ingestion + F2 Completeness gate) — upload the ACFR + application materials, watch the extraction pipeline run, and see the automated completeness gate result.
2. **Reviewer workspace** (PRD F6 Human-in-the-loop review UI) — a volunteer expert works through AI-prepared, page-cited checklist findings and accepts / edits / rejects each one, with a side-by-side ACFR citation viewer.

The two screens live in one app shell (top bar + left nav rail) and switch in place. It is designed as a module inside the existing Flowlyst product, built on the **Material UI (MUI)** design language.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype that shows the intended look, layout, states, and interactions. **They are not production code to copy directly.** The task is to **recreate these designs in the target codebase** using its existing environment and patterns. This design is pure MUI, so in a React app the natural implementation is **`@mui/material`** components with the same props called out below; the prototype's hand-rolled surfaces (app bar, nav rail, cards, PDF page) map onto MUI `AppBar`, `Drawer`, `Paper`/`Card`, etc. If no front-end exists yet, Next.js + MUI (the PRD's stated stack) is the right choice.

### How to open the prototype
- `COE_Review_prototype_standalone.html` — a single self-contained file. **Double-click to open in any browser**, no server or install needed. Start on the intake screen → click **"Load sample (Davenport IA)"** → the pipeline runs (~7s) → click **"Open prepared review"** to reach the reviewer workspace. The **"Applications"** breadcrumb/nav item returns to intake.
- `source/COE Review Workspace.dc.html` — the authored source (a streaming component format). Read it for exact markup and the logic class (sample data lives in the `raw`, `steps`, `gateItems`, `sampleFiles` arrays). It requires the bound design-system assets to run, so prefer the standalone file for viewing.

## Fidelity
**High-fidelity.** Final colors, MUI typography (Roboto), spacing, elevation, and interactions. Recreate pixel-close using the codebase's MUI theme. All hex values and sizes below are exact. Sample content (Davenport CSD FY2025 ACFR, checklist criteria, findings, citation excerpts) is **plausible placeholder data** — replace with real COE checklist criteria and real extracted findings from the pipeline.

---

## Design Tokens

Standard MUI default theme with primary `#1976D2`. Use the codebase's MUI theme; do not hard-code these if a theme exists.

- **Font:** Roboto (300/400/500/700). Monospace `Roboto Mono` for the simulated PDF page body.
- **Primary** `#1976D2` (dark `#1565C0`, 10% tint `rgba(25,118,210,0.1)`)
- **Success** `#2E7D32` (dark `#1B5E20`, 12% tint `rgba(46,125,50,0.12)`)
- **Error** `#D32F2F` (12% tint `rgba(211,47,47,0.12)`)
- **Warning** `#ED6C02` (text on light: `#B35300`; 14% tint `rgba(237,108,2,0.14)`)
- **Info** `#0288D1`
- **Text** primary `rgba(0,0,0,0.87)`, secondary `rgba(0,0,0,0.6)`, hint `rgba(0,0,0,0.5)`, disabled `rgba(0,0,0,0.38)`
- **Surfaces** page bg `#F4F5F7`, paper `#FFF`, viewer bg `#E9EBEF`, dropzone bg `#FAFAFA`
- **Divider** `rgba(0,0,0,0.12)`; card border `rgba(0,0,0,0.06)`
- **Radius** 8px cards, 4px MUI default, 14–16px pills/chips, 50% circles
- **Elevation** MUI scale — app bar `elevation-2`, cards `elevation-1`, selected finding card `elevation-6`, PDF page `elevation-8`, bottom bar `elevation-4`
- **Citation highlight** background `#FFF2A8`, ring `0 0 0 2px #F9C200`
- **Icons** Material Icons (`<span class="material-icons">name</span>`; use `@mui/icons-material` in React)

---

## App shell (both screens)

- **Top app bar** — fixed, height 60px, white, `elevation-2`, `z-index 20`. Left: hamburger (`menu`), Flowlyst logo (28px rounded-6 `#1976D2` square with white `stream` icon) + "Flowlyst" (20px/500), a light "/" divider, "COE Review" (16px/500, `rgba(0,0,0,0.72)`). Right: 300px search `TextField` (small, outlined, `search` startAdornment, placeholder "Search applications, districts…"), `help_outline` IconButton, `notifications_none` IconButton with a red 8px dot badge, and a 34px secondary-color Avatar ("RM").
- **Left nav rail** — fixed width 232px, white, right divider. Overline "WORKSPACE" then items (16px gap, icon 22px + 14px label, 10px/20px padding, hover `rgba(0,0,0,0.04)`): Dashboard (`dashboard`), **Applications** (`fact_check`, active), Reviewers (`groups`), Metrics (`insights`). Active item: text `#1565C0`, bg `rgba(25,118,210,0.1)`, 3px left accent bar `#1976D2`, trailing count badge "24" (white on `#1976D2`, pill). Overline "MY QUEUE": Assigned to me (`rate_review`, trailing "6"), Completed (`history`). Bottom: a `#F4F5F7` info card — `verified_user` (info) + "Human-in-the-loop / AI prepares findings. You decide every outcome."
- Clicking **Applications** navigates to the intake screen.

---

## Screen 1 — New application intake (F1 + F2)

**Purpose:** staff/district uploads the ACFR + materials; the system extracts and runs the completeness gate before any reviewer time is spent.

**Layout:** scrollable main area, inner `max-width: 1080px` centered, 28px/24px padding. Breadcrumb (Applications › FY2025 cycle › New intake) → H1 "New application intake" (24px/500) → 14px subtitle. Below: a wrapping flex row, `gap: 24px`, `align-items: flex-start`:
- **Left column** `flex: 1 1 460px; min-width: 320px`
- **Right column** `flex: 0 1 380px; min-width: 300px`

### Components — left column
- **Upload card** (`Paper`, radius 8, `elevation-1`, 24px padding):
  - **Dropzone** — dashed border (2px), radius 10, 40px/24px padding, centered. Idle: border `rgba(0,0,0,0.25)`, bg `#FAFAFA`. **Dragging over:** border `#1976D2`, bg `rgba(25,118,210,0.06)` (transition 150ms). Contains `cloud_upload` (52px, primary), "Drag & drop the ACFR and application files" (17px/500), 13px helper, then two buttons: **Browse files** (`Button` contained primary, `upload_file` startIcon, no elevation — triggers a hidden `<input type=file multiple accept=".pdf">`) and **Load sample (Davenport IA)** (`Button` outlined primary, `folder_special` startIcon).
  - **Info strip** below dropzone — `#F4F5F7`, radius 6, `info` icon + note: "The POC ships with pre-loaded public ACFRs. Production supports presigned direct-to-S3 uploads so large ACFRs bypass request-size limits. All documents stay inside Flowlyst's AWS account." (PRD's Vercel 4.5MB cap → presigned S3 detail.)
- **Uploaded files card** (only once files are chosen): header "Uploaded files" + **Reset** text button (`restart_alt`). One row per file: `picture_as_pdf` (26px, `#D32F2F`), name (13px/500, ellipsis) + size (12px hint), a type `Chip` (outlined small — ACFR=primary, Application=info, Checklist=secondary), and a right-aligned status: `hourglass_top` "Uploading…" (primary) → `check_circle` "Extracted" (success) once stage ≥ 1.

### Components — right column
- **Processing pipeline card** — header "Processing pipeline" + 12px caption "Runs asynchronously — findings stream in as workers finish" (PRD's Vercel-timeout async pattern). 5 step rows, each: a 30px circle + step icon, label (13px/500) + sub (11.5px hint), right status text. Step state drives circle: **done** → bg `#2E7D32`, white `check`; **active** → bg `#1976D2`, white step icon, status "Processing…"; **pending** → bg `#E0E0E0`, grey icon, "Pending". Steps: `cloud_upload` Upload & secure storage / "Files written to encrypted S3 (Flowlyst AWS)"; `description` Text extraction & OCR / "Native PDF text layer, OCR fallback"; `table_chart` Table extraction / "Financial-statement pages only"; `segment` Section segmentation / "Introductory · Financial · Statistical · Compliance"; `verified_user` Completeness gate / "Six intake checks (F2)".
- **Completeness gate card** — header "Completeness gate" + a status `Chip`: "Awaiting files" (default) → "Queued" (default) → "Checking…" (warning) → "Passed" (success). Six check rows, each: icon + label + right status. Pending: `radio_button_unchecked` (grey `rgba(0,0,0,0.28)`), "—". Passed: `check_circle` (success), "Pass". Rows: Auditor's report — unmodified (clean) opinion; MD&A present; Required basic financial statements & notes; Statistical section present; COE checklist attached (required for this applicant); Application form & fee status. Footer caption: "If any check fails, the submission is auto-flagged for rejection with a generated explanation — a human confirms before it's sent." When done: green banner `rgba(46,125,50,0.1)` `check_circle` "Completeness passed — ready for review" + full-width **Open prepared review** button (contained primary, `arrow_forward` endIcon) → navigates to Screen 2.

---

## Screen 2 — Reviewer workspace (F6)

**Purpose:** the volunteer expert reviews each AI-prepared checklist finding and confirms the outcome; the AI never issues the final Award/Conditional/Denied decision.

**Layout:** vertical stack inside main — (a) application context bar, (b) split findings|viewer, (c) bottom action bar.

### (a) Application context bar
White, bottom divider, 14px/24px padding. Breadcrumb (**Applications** is a clickable primary-colored link back to intake › FY2025 cycle › Davenport CSD). Row: H1 "Davenport Community School District" (22px/500) + a quality badge `Chip` "Better" (success small, `workspace_premium` icon); 13px sub "ACFR · Fiscal Year ended June 30, 2025 · Iowa · 214 pages · COE checklist v2025.1 (pre-GASB 103)". Right cluster (three stats separated by 34px vertical dividers): **Completeness passed** (`check_circle` success + "Intake gate cleared"), **Verifier: 7/8 confirmed** (`verified` info + "1 citation downgraded"), and **N of 8 reviewed** with a 6px primary progress bar. The quality badge (best/better/good/poor) and verifier stat come from PRD F5/F4.

### (b) Split: findings | citation viewer
Flex row, `min-height: 0`. **Findings panel** `flex: 0 1 440px; min-width: 340px; max-width: 520px` (the constrained pane), right divider, bg `#F4F5F7`. **Viewer** `flex: 1 1 0; min-width: 0` (takes remaining space), bg `#E9EBEF`. Both `min-height: 0` with internal scroll.

**Findings panel:**
- Header (white): "Checklist findings" (15px/500) + "AI-prepared · reviewer confirms each"; below, a wrapping row of filter `Chip`s (small; active = filled primary, inactive = outlined default): All (8) / Needs human (1) / Not met (1) / Partial (1) / Met (4). Clicking filters the list.
- Scrolling list of **finding cards** (white, radius 8, 4px left accent, 16px/18px padding, `elevation-1`; **selected** → accent `#1976D2` + `elevation-6`; clicking a card selects it and drives the viewer):
  - Overline "{SECTION} · Criterion {n}" + title (15px/500).
  - **Status pill** (top-right, 14px radius, tinted bg + colored icon+label): **Met** `check_circle` `#2E7D32`; **Not met** `cancel` `#D32F2F`; **Partially met** `error` `#B35300`; **Not applicable** `remove_circle_outline` `#616161`; **Cannot determine** `help_outline` `#616161`. The left accent bar uses the same status color when the card is unselected (`#2E7D32/#D32F2F/#ED6C02/#9E9E9E/#757575`).
  - Meta row: **confidence** (icon `signal_cellular_alt`/`_2_bar`/`_1_bar` + "High/Medium/Low confidence" in success/warning/error) and a **citation link** (primary: `description` + "p. N — …" + `open_in_new`) that selects the finding.
  - **Needs-human banner** (only when the verifier flagged it, PRD F4): warning box `rgba(237,108,2,0.1)` + `report_problem`, "**Verifier flagged — needs human.** {reason}".
  - **AI draft comment** box (`#F7F9FC`, 6px radius): `auto_awesome` + overline "AI DRAFT COMMENT" (or "REVIEWER COMMENT (EDITED)"), then the comment text (13px). In **edit mode** this is replaced by a multiline `TextField` ("Reviewer comment", 4 rows) + **Cancel** (text) / **Save comment** (contained primary, `save`).
  - **Action row** — before review: **Accept** (contained success, `check`, no elevation) / **Edit** (outlined primary, `edit`) / **Reject** (text error, `close`). After review: a state pill (Accepted `check_circle` success / Rejected `cancel` error / Edited & accepted `edit` primary) + **Edit** and **Undo** text buttons.

**Citation viewer:**
- Toolbar (white, wraps at narrow widths): `picture_as_pdf` (`#D32F2F`) + truncating "Davenport_CSD_ACFR_FY2025.pdf · {section} section"; right: `navigate_before`, "{page} / 214", `navigate_next`, divider, `zoom_in`, `download` (all IconButtons small).
- **Page surface** — 620px `Paper`, `elevation-8`, 52px/56px padding, `min-height: 720px`, `Roboto Mono` body. Running header (district / SECTION), page title, then the passage lines. The **cited line is highlighted** (bg `#FFF2A8`, ring `#F9C200`) — this is the NotebookLM-style click-through-to-source. Footer "— {page} —".
- **Citation link-back bar** (white, top divider): `my_location` + "Source for {Criterion n — title}" (single-line ellipsis) + **Jump to citation** button (outlined primary, `center_focus_strong`) which smooth-scrolls the page to the highlight.

### (c) Bottom action bar
Fixed height 60px, white, top divider, `elevation-4`. Left: a status icon + single-line message. While incomplete: `pending_actions` (grey) + "N of 8 findings confirmed — review the rest to enable the decision step." When all reviewed: `task_alt` (success) + "All 8 findings confirmed · M accepted. Ready to route for the Award / Conditional / Denied decision." Right: **Add general note** (outlined, `chat_bubble_outline`) and **Mark ready for decision** (contained primary, `arrow_forward` endIcon, **disabled until all findings reviewed**).

---

## Interactions & Behavior
- **Screen switch:** `screen` = `upload | review`. Applications nav + intake breadcrumb → upload; "Open prepared review" → review.
- **Upload pipeline (simulated in prototype):** choosing files or "Load sample" starts a staged run — files upload (stage 0) → extraction → tables → segmentation → gate; gate checks reveal one by one; then `done`. **In production this is the real async pipeline** (PRD §7): kick off a run, workers write findings to Postgres progressively, the client polls/streams status. Do not block on a long synchronous request.
- **Drag & drop:** dropzone highlights on dragover; drop reads `dataTransfer.files`.
- **Finding selection:** clicking a card (or its citation link) sets `selectedId`, which re-renders the viewer with that finding's page, title, section, page number, and highlighted line.
- **Accept / Reject / Edit / Undo:** per-finding; button clicks `stopPropagation` so they don't also trigger card-select. Edit opens the inline TextField; Save stores the edited comment and marks "Edited & accepted".
- **Filters:** status chips filter the findings list; counts are live.
- **Gating:** "Mark ready for decision" is disabled until every finding has a review outcome. **The AI never issues the final decision** (PRD non-goal) — this button only routes to the human decision step.
- **Jump to citation:** smooth-scrolls the viewer to the highlighted passage (avoid `scrollIntoView` if it conflicts with the app's scroll container; scroll the container to the anchor offset).
- **Transitions:** card shadow 150ms; dropzone border/bg 150ms; MUI standard easing `cubic-bezier(0.4,0,0.2,1)`.

## State Management
- **App:** `screen`.
- **Intake:** `files[]`, `stage` (-1 idle … 4 gate), `gateRevealed` (0–6), `done`, `dragging`. Replace the timer simulation with real run status from the backend (run id → poll/stream findings + gate results).
- **Review:** `selectedId`, `filter`, `editingId`, `editText`, `reviews` (map of findingId → `{ state: 'accepted'|'rejected'|'edited', comment }`). Derived: reviewed count, progress %, verifier-confirmed count, ready flag.
- **Data model per finding** (see `source` file's `raw` array): `id, num, section, status (met|not_met|partial|na|cannot_determine), confidence (high|medium|low), title, comment, cite, page, pageTitle, hlText, lines[] (with an "@hl" marker for the highlighted line), verifier (reason string when downgraded to needs-human)`. Each finding's judgment must carry a page citation; findings without a locatable citation are marked needs-human, never shown as confident (PRD F3/F4).

## Assets
- **Icons:** Google Material Icons (loaded via web font in the prototype). Use `@mui/icons-material` in React — names map 1:1 (e.g. `fact_check` → `FactCheckIcon`).
- **Fonts:** Roboto + Roboto Mono (Google Fonts).
- No raster images or logos; the Flowlyst mark is a simple rounded square + `stream` icon (replace with the real brand mark).
- No proprietary assets included.

## Files
- `COE_Review_prototype_standalone.html` — self-contained runnable prototype (open in a browser).
- `source/COE Review Workspace.dc.html` — authored source with markup + logic class + all sample data arrays.
- `README.md` — this document.
