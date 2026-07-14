---
name: coe-domain
description: Domain knowledge for ASBO's Certificate of Excellence (COE) ACFR review — the four ACFR sections, the six completeness-gate checks, finding statuses, citation rules, verifier semantics, quality triage, and the humans-decide non-goal. Read this before implementing or modifying any pipeline stage, prompt, gate check, or finding logic.
---

# COE / ACFR Review Domain

## What this system does

ASBO International runs the Certificate of Excellence in Financial Reporting (COE): US school
districts submit their Annual Comprehensive Financial Report (ACFR, 100–300 pages) and volunteer
expert reviewers evaluate it against a checklist of ~40 criteria, then issue **Award**,
**Conditional Award**, or **Denied**. This POC automates the preparation work: completeness
gating, checklist verification with page citations, a hallucination-guard verifier pass, and
quality triage. Full detail: `PRD_ASBO_COE_Review_Automation.md` at the repo root.

## Non-negotiable rules

1. **The AI never issues the final Award / Conditional / Denied decision.** UI copy and API
   naming must frame outputs as *findings*, never *verdicts*. The final action a reviewer takes
   is "Mark ready for decision" — routing to a human decision step.
2. **Every judgment must carry a page citation** to the exact page and passage it relied on.
   A finding whose citation cannot be located in the extracted document text is downgraded to
   **needs-human** (`verifier_status = 'flagged'`) — it is never presented as confident.
3. **Every LLM call is audit-logged** (model id, prompt version, token usage, verdict) to
   `audit_log`. Required for the appeal process and client trust.
4. **Failing completeness submissions are auto-FLAGGED, not auto-rejected.** A human confirms
   the rejection before it is sent.

## The four ACFR sections

Every page is segmented into exactly one of: `introductory`, `financial`, `statistical`,
`compliance`. Typical contents:

- **Introductory** — cover, table of contents, letter of transmittal (signed by Superintendent /
  CFO), organizational chart, list of officials, prior COE certificate.
- **Financial** — independent auditor's report, MD&A (Management's Discussion & Analysis),
  basic financial statements (government-wide + fund statements), notes to the financial
  statements, required supplementary information (RSI, incl. budgetary comparison schedules),
  combining/individual fund statements.
- **Statistical** — ten-year trend tables: financial trends, revenue capacity, debt capacity,
  demographic/economic info, operating info.
- **Compliance** — single audit / Uniform Guidance reports, schedule of expenditures of federal
  awards (SEFA), findings and questioned costs.

## The six completeness-gate checks (F2)

Exact `check_key` values (see `db/schema.ts`) and pass criteria:

| check_key | Passes when |
|---|---|
| `clean_opinion` | Independent auditor's report is present AND expresses an **unmodified (clean) opinion**. Qualified, adverse, or disclaimer opinions fail. |
| `mdna_present` | MD&A is present (in the financial section, preceding the basic financial statements). |
| `basic_statements` | Required basic financial statements AND notes to the financial statements are present. |
| `statistical_section` | A statistical section is present. |
| `coe_checklist_attached` | The COE checklist document is attached — required for first-time applicants, prior conditional/denied, or a skipped year. If not required for this applicant, the check passes as not-required. |
| `application_form_fee` | Application form present and fee status confirmed. |

Gate statuses: `pending | pass | fail | needs_human`. Degraded document text (see the Davenport
sample) must produce `needs_human` with an explanation — never a hallucinated `pass`.
If any check fails, the run stops before checklist work with a generated explanation listing
exactly what is missing.

## Findings (F3)

Per checklist criterion the pipeline produces one finding:

- `status`: `met | not_met | partial | na | cannot_determine`
- `confidence`: `high | medium | low`
- `comment`: a reviewer-style draft comment (professional, specific, references the evidence)
- Citation: `page` (1-based), `cite` label (e.g. `p. 3 — Letter of transmittal`), `page_title`,
  `hl_text` (the exact passage relied on), `lines` (surrounding page lines with the literal
  string `'@hl'` marking where the highlighted line goes — this drives the citation viewer)
- Checklist criteria are **versioned by fiscal year** (`criteria.checklist_version`, e.g.
  `v2025.1`). GASB 103 changes MD&A requirements from FY2026 — grade each ACFR against the
  standards in force for ITS year.

## Verifier (F4)

A second, independent LLM pass re-checks each finding against the cited source text:
does the citation exist in `document_pages`, does it say what the finding claims, does the
judgment follow? Outcomes: `confirmed` or `flagged` (+ `verifier_reason`). Flagged findings
render the needs-human banner in the UI and count against the "N/M confirmed" header stat.

## Quality triage (F5)

Whole-application classification: `best | better | good | poor`, with a rationale.
Routing intent: best/better → light review; good → standard; poor → senior reviewer with the
full flag list. In the POC this is grounded in gate results + finding summary (historical
ASBO data arrives post-POC).

## Sample documents (`samples/manifest.json`)

- **Rockford IL FY2023** (168pp) — clean text layer, happy path.
- **Davenport IA FY2023** (179pp) — **partially degraded text layer** (custom font encoding;
  pypdf extracts garbage, unpdf/pdf.js decodes most pages). Measured: 43/179 pages flagged
  `needs_ocr` (24% — below the 30% whole-document "degraded" threshold, so the gate runs on
  the clean pages; flagged pages are excluded from LLM context). Remains the OCR-fallback
  test case for phase 6. A document with >30% flagged pages goes `needs_human` at the gate.
- **Griffin-Spalding GA FY2023** (180pp) — clean text layer, happy path.

Note: the design prototype labels Davenport as "FY2025 / 214 pages" — that is placeholder
fiction; the real file is FY2023 / 179 pages.
