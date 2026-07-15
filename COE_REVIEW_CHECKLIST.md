# ASBO Certificate of Excellence (COE) — ACFR Review Checklist

**Checklist version: v2025.1** (placeholder set pending the official ASBO checklist; criteria are versioned by fiscal year — GASB 103 changes MD&A requirements from FY2026, so grade each ACFR against the standards in force for **its** fiscal year).

## Purpose and how to use this document

You are reviewing a US school district's **Annual Comprehensive Financial Report (ACFR**, typically 100–300 pages) for ASBO International's Certificate of Excellence program. Work through this document top to bottom:

1. Run the **completeness gate** (6 checks). If any check fails, stop and report exactly what is missing — do not proceed to the checklist.
2. Evaluate every **checklist criterion** and produce one finding per criterion in the output format specified at the end.
3. Finish with the **quality triage** classification and rationale.

### Non-negotiable rules

1. **Never issue the final Award / Conditional Award / Denied decision.** Your outputs are *findings* that a human reviewer confirms — not verdicts.
2. **Every judgment must carry a page citation**: the 1-based page number and the exact passage relied upon, quoted verbatim from the document. If you cannot point to a specific page and passage, the finding's status must be `cannot_determine` — never a confident `met`.
3. **Never hallucinate evidence.** If a page is unreadable or the document text is degraded, say so explicitly rather than guessing.
4. A submission that fails completeness is **flagged for a human, not auto-rejected**.

## The four ACFR sections

Every page belongs to exactly one section:

- **Introductory** — cover, table of contents, letter of transmittal (signed by Superintendent/CFO), organizational chart, list of officials, prior COE certificate.
- **Financial** — independent auditor's report, MD&A, basic financial statements (government-wide + fund statements), notes, required supplementary information (RSI, incl. budgetary comparison schedules), combining/individual fund statements.
- **Statistical** — ten-year trend tables: financial trends, revenue capacity, debt capacity, demographic/economic info, operating info.
- **Compliance** — single audit / Uniform Guidance reports, schedule of expenditures of federal awards (SEFA), findings and questioned costs.

## Step 1 — Completeness gate (run first)

| # | Check | Passes when |
|---|---|---|
| G1 | `clean_opinion` | The independent auditor's report is present AND expresses an **unmodified (clean) opinion**. Qualified, adverse, or disclaimer opinions fail. |
| G2 | `mdna_present` | MD&A is present in the financial section, preceding the basic financial statements. |
| G3 | `basic_statements` | The required basic financial statements AND the notes to the financial statements are present. |
| G4 | `statistical_section` | A statistical section is present. |
| G5 | `coe_checklist_attached` | The completed COE checklist document is attached — required only for first-time applicants, prior conditional/denied applicants, or after a skipped year. If not required for this applicant, pass as "not required". |
| G6 | `application_form_fee` | Application form present and fee status confirmed (assume pass if reviewing the ACFR alone). |

Gate statuses: `pass | fail | needs_human`. Cite the page for each pass/fail. If the document text is substantially degraded/unreadable, report `needs_human` with an explanation — never a guessed `pass`. **If any check fails, stop here** and list exactly what is missing.

## Step 2 — Checklist criteria (one finding each)

### 1. Introductory section

| # | Criterion | What to verify |
|---|---|---|
| 1.1 | Report cover and title page identify the district and fiscal year | The cover/title page states the district's legal name, state, and the fiscal year covered, and labels the report an Annual Comprehensive Financial Report. |
| 1.2 | Letter of transmittal is present and signed | A letter of transmittal is included, signed by appropriate officials (e.g., Superintendent and Chief Financial Officer), and dated. |
| 1.3 | Table of contents covers all four report sections | A table of contents lists the introductory, financial, statistical, and (when applicable) compliance sections with page references. |
| 1.4 | Organizational chart and list of principal officials included | The introductory section presents an organizational chart and a list of elected/appointed officials. |
| 1.5 | Prior COE certificate reproduced when previously awarded | If the district received the Certificate of Excellence for the prior year, the certificate is reproduced in the introductory section. |

### 2. Independent auditor's report

| # | Criterion | What to verify |
|---|---|---|
| 2.1 | Auditor's report expresses an unmodified (clean) opinion | The independent auditor's report is present and expresses an unmodified opinion on the basic financial statements. |
| 2.2 | Auditor's report identifies opinion units and audit standards | The report identifies the opinion units and states the audit was conducted in accordance with GAAS (and Government Auditing Standards where applicable). |

### 3. Management's Discussion & Analysis (MD&A)

| # | Criterion | What to verify |
|---|---|---|
| 3.1 | MD&A is presented as required supplementary information | MD&A is presented before the basic financial statements as RSI. |
| 3.2 | MD&A includes condensed government-wide comparative data | MD&A presents condensed financial information derived from government-wide statements comparing the current and prior year. |
| 3.3 | MD&A analyzes overall financial position and results | MD&A discusses whether the district's overall financial position improved or deteriorated and explains significant changes. |
| 3.4 | MD&A is present and precedes the basic financial statements | MD&A appears in the correct location, immediately preceding the basic financial statements. |

### 4. Basic financial statements

| # | Criterion | What to verify |
|---|---|---|
| 4.1 | Government-wide statement of net position is presented | A statement of net position is presented for governmental and business-type activities using the economic resources measurement focus. |
| 4.2 | Government-wide statement of activities is presented | A statement of activities presents expenses by function with program revenues, showing net (expense) revenue. |
| 4.3 | Governmental funds balance sheet is presented with reconciliation | The governmental funds balance sheet is presented and reconciled to the government-wide statement of net position. |
| 4.4 | Statement of revenues, expenditures, and changes in fund balances with reconciliation | The governmental funds operating statement is presented and reconciled to the statement of activities. |
| 4.5 | Major funds are properly identified and presented | Major governmental and enterprise funds are identified per GASB 34 criteria and presented in separate columns. |
| 4.6 | Proprietary fund statements presented where applicable | If the district has proprietary funds, the required statements (net position, revenues/expenses, cash flows) are presented. |
| 4.7 | Fiduciary fund statements presented where applicable | If the district has fiduciary activities, statements of fiduciary net position and changes therein are presented. |
| 4.8 | Fund balance classifications follow GASB 54 | Governmental fund balances are classified as nonspendable, restricted, committed, assigned, and unassigned. |
| 4.9 | Discretely presented component units reported per GASB 61 | Component units are evaluated and, where required, discretely presented in accordance with GASB 61. *(compliance-section criterion)* |

### 5. Notes to the financial statements

| # | Criterion | What to verify |
|---|---|---|
| 5.1 | Summary of significant accounting policies is complete | The first note describes the reporting entity, basis of presentation, measurement focus, and significant policies. |
| 5.2 | Cash deposits and investments note discloses custodial risk | Notes disclose deposit and investment balances, credit risk, custodial credit risk, and interest-rate risk. |
| 5.3 | Interfund balances and transfers are disclosed and explained | Notes disclose interfund receivables/payables and transfers with purposes explained. |
| 5.4 | Long-term debt note rolls forward balances and shows maturities | Notes present changes in long-term liabilities and debt-service requirements to maturity. |
| 5.5 | OPEB disclosures comply with GASB 75 | If the district provides OPEB, notes and RSI present the required GASB 75 disclosures. |
| 5.6 | Pension disclosures comply with GASB 68 | Notes disclose the pension plan description, net pension liability, assumptions, and changes therein per GASB 68. |
| 5.7 | Pension note discloses the discount-rate sensitivity analysis (GASB 68) | The pension note presents the net pension liability calculated at the discount rate and at rates 1% higher and lower. |
| 5.8 | Commitments and contingencies are disclosed | Notes disclose significant commitments, litigation, and contingent liabilities. |
| 5.9 | Subsequent events are evaluated and disclosed | Notes disclose material subsequent events through the report issuance date. |
| 5.10 | Tax abatement disclosures comply with GASB 77 where applicable | If taxes are abated under agreements affecting the district, GASB 77 disclosures are presented. |
| 5.11 | Capital-asset note discloses depreciation methods and useful lives | The capital assets note discloses beginning/ending balances by class, depreciation methods, and estimated useful lives. |

### 6. Budgetary reporting

| # | Criterion | What to verify |
|---|---|---|
| 6.1 | Budgetary comparison presented for the General Fund and major special revenue funds | Budgetary comparison schedules (or statements) present original budget, final budget, and actual amounts. |
| 6.2 | Budgetary comparison schedule for the General Fund is present | A budgetary comparison schedule for the General Fund is presented as RSI or a basic statement. |
| 6.3 | Budget-to-GAAP reconciliation presented where bases differ | If the budgetary basis differs from GAAP, a reconciliation is presented. |

### 7. Statistical section

| # | Criterion | What to verify |
|---|---|---|
| 7.1 | Financial trends information | Schedules present net position and changes in net position trend data. |
| 7.2 | Revenue capacity information | Schedules present assessed value, tax rates, principal taxpayers, and levies/collections. |
| 7.3 | Ten years of trend data | Required statistical schedules present ten fiscal years of data (or all years available for newer requirements, with explanation). |
| 7.4 | Debt capacity information | Schedules present ratios of outstanding debt, direct and overlapping debt, and legal debt margin. |
| 7.5 | Demographic and operating information | Schedules present demographic/economic indicators and operating data such as enrollment and staffing. |

### 8. Compliance section

| # | Criterion | What to verify |
|---|---|---|
| 8.1 | Single audit reports included when federal expenditures exceed the threshold | If required by Uniform Guidance, the compliance section includes the auditor's reports on internal control and compliance and the SEFA. |
| 8.2 | Schedule of findings and questioned costs is presented | When a single audit is required, the schedule of findings and questioned costs (and corrective action plans, if findings exist) is presented. |

## Step 3 — Output format (one finding per criterion)

For **every** criterion above, report:

- **Criterion**: number and title (e.g. `5.7 Pension note discloses the discount-rate sensitivity analysis`)
- **Status**: exactly one of `met | not_met | partial | na | cannot_determine`
  - `na` is for criteria whose precondition doesn't apply (e.g. no proprietary funds → 4.6 is `na`)
  - `cannot_determine` when the evidence can't be located or the text is unreadable
- **Confidence**: `high | medium | low`
- **Citation**: page number (1-based) + a short verbatim quote of the exact passage relied on. No citation → status must be `cannot_determine`.
- **Comment**: a 1–3 sentence reviewer-style draft comment — professional, specific, referencing the evidence (what was found, where, and any gaps).

Present the findings as a markdown table:

| # | Criterion | Status | Confidence | Page | Evidence quote | Comment |
|---|---|---|---|---|---|---|

## Step 4 — Quality triage

After all findings, classify the whole application as `best | better | good | poor` with a 2–4 sentence rationale grounded in the gate results and the findings summary (counts of met / not met / partial / cannot_determine, and any recurring weakness). Routing intent: best/better → light-touch review; good → standard review; poor → senior reviewer with the full list of flags.

**Reminder:** end with the findings and classification only — the Award / Conditional Award / Denied decision belongs to the human reviewer.
