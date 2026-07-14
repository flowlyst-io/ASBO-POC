# PRD — ASBO Certificate of Excellence (COE) Review Automation MVP

**Author:** Cahid Ehmedi (Flowlyst)
**Stakeholders:** Aziz Aghayev (client relationship / product direction), Tural Novruzov (engineering), ASBO International (client)
**Status:** Draft v0.1 — for internal review
**Date:** July 2026

---

## 1. Background

ASBO International runs the Certificate of Excellence in Financial Reporting (COE), a peer-review award program in which US school districts submit their Annual Comprehensive Financial Report (ACFR) for evaluation. Volunteer expert reviewers check each ACFR — typically 100–300 pages of dense financial statements, notes, and schedules — against the COE checklist (40+ criteria), write comments, and issue one of three outcomes: **Award**, **Conditional Award**, or **Denied**. The review cycle currently takes **4–6 months** per submission, with hundreds of applications per year.

ASBO holds roughly 30 years of historical review data (applications, reviewer comments, decisions, and rejection reasons). Flowlyst has been asked to scope and build an AI-assisted review system, with an MVP target of **2–3 months**. Flowlyst's engagement with ASBO is currently under a sponsorship/consulting arrangement; planning hours are covered, and development pricing will be negotiated separately before build begins.

## 2. Problem Statement

The COE review process is expensive in expert time, slow, and inconsistent:

- **Reviewer scarcity.** Reviews depend on volunteer subject-matter experts who must recuse from their own state, making scheduling and coverage a constant bottleneck.
- **Slow turnaround.** 4–6 months from submission to decision; districts get feedback too late to act on it easily.
- **Manual completeness gating.** Staff manually verify that each submission is complete (unmodified audit opinion, MD&A present, checklist attached, required statements included) before any expert sees it.
- **Inconsistent review depth.** Every application gets roughly the same treatment regardless of quality, so clean reports consume as much expert time as risky ones.
- **Institutional knowledge is trapped.** Three decades of decisions and comments exist but are not systematically leveraged.

## 3. Goals

1. **Reduce reviewer time per application** by automating completeness checks, checklist verification, and comment drafting — target: reviewer works from AI-prepared findings instead of reading 100–300 pages cold.
2. **Cut cycle time** on the automated portion of the pipeline from weeks of queueing to hours.
3. **Enforce completeness at intake** — incomplete submissions are rejected automatically with a clear explanation before consuming any reviewer time.
4. **Triage by risk** — classify each application (best / better / good / poor) and route accordingly: light-touch review for clean submissions, deep review by senior reviewers for risky ones.
5. **Preserve human authority** — every AI finding is verifiable (page-cited), editable, and subject to human accept/reject. The AI never issues a final Award/Conditional/Denied decision.

## 4. Non-Goals (MVP)

- **No automated final decisions.** The system assists; humans decide. (This is also the client's stated preference — "we don't want to outsource our intelligence.")
- No appeal-process automation.
- No integration with district ERP systems (WinCap, nVision) — that belongs to the separate contracts/salary workstream.
- No chat interface over the corpus (explicitly rejected by the client in discovery).
- No coverage of the MBA (budget award) — COE/ACFR only. The design should not preclude adding MBA later, since the review mechanics are similar.

## 5. Users

| User | Role in system |
|---|---|
| **ASBO program staff** | Monitor intake, see completeness rejections, assign triaged applications to reviewers |
| **Volunteer expert reviewers** | Work through AI-prepared findings per checklist item; accept / edit / reject; write final comments |
| **Senior reviewers** | Receive "poor"-classified applications for deep review |
| **District submitting officials** (indirect) | Receive faster completeness feedback and, eventually, faster decisions |

## 6. Scope — MVP Feature Set

### F1. Ingestion & Extraction
- Users upload the ACFR PDF directly (POC: Vercel Blob client uploads with size/page caps; production: districts or ASBO staff via presigned S3 uploads). Pre-loaded public demo ACFRs also available in POC.
- Pipeline: blob/object storage → text extraction (native text layer where available; OCR fallback) → table extraction on financial-statement pages only → section segmentation into the four standard ACFR sections (Introductory / Financial / Statistical / Compliance).
- Output: structured document representation with page-level provenance for every extracted passage.

### F2. Completeness / Refusal Gate
- Automated checks before any review work:
  - Independent auditor's report present with **unmodified (clean) opinion**
  - **MD&A** present
  - Required basic financial statements and notes present
  - Statistical section present
  - COE checklist attached (when required: first-time applicants, prior conditional/denied, or skipped year)
  - Application form and fee status
- Failing submissions are auto-flagged for rejection with a generated explanation listing exactly what is missing. A human confirms the rejection before it is sent (MVP safety rail).

### F3. Checklist Verification Engine
- For each COE checklist criterion: locate the relevant passage(s) in the ACFR, judge compliance (met / not met / partially met / not applicable / cannot determine), and draft a reviewer-style comment.
- **Every judgment must carry a citation** to the exact page and passage it relied on. Findings without a locatable citation are marked "needs human" — never presented as confident.
- Checklist criteria are versioned by fiscal year (GASB 103 changes MD&A requirements from FY2026; the engine must grade each ACFR against the standards in force for its year).

### F4. Verifier Agent (Hallucination Guardrail)
- A second, independent agent re-checks each finding from F3 against the cited source text: does the citation exist, does it say what the reviewer agent claims, does the judgment follow?
- Discrepancies downgrade the finding to "needs human" and are logged.
- All agent inputs, outputs, and verifier verdicts are written to an audit log (required for the appeal process and client trust).

### F5. Quality Classification & Triage
- Classify each complete application: **best / better / good / poor**, grounded in historical decisions and comments (few-shot examples from ASBO's archive; retrieval of similar past cases via pgvector where useful).
- Routing rules: best/better → light review queue; good → standard; poor → senior reviewer queue with the full flag list attached.

### F6. Human-in-the-Loop Review UI
- Reviewer sees: per-criterion finding, draft comment, confidence, and a **click-through citation that opens the ACFR at the highlighted source passage** (NotebookLM-style).
- Actions: accept / edit / reject per finding; add own comments; mark application ready for decision.
- Design must follow the Flowlyst design system (Figma to be shared by Tural) — this becomes a module of the existing Flowlyst product, and must be visually and behaviorally consistent with it (e.g., established interaction patterns like double-click-to-open).
- The presentation principle from discovery: **same information reviewers see today, dramatically better presented** — intuitive, low-friction, hard to make mistakes in.

### F7. Logging, Audit & Metrics
- Full audit trail: who/what (human or agent) did what, when, on which document, with which model version and prompt version.
- Metrics dashboard (internal, simple): applications processed, completeness rejection rate, findings per application, human overturn rate of AI findings, verifier catch rate, reviewer time per application (self-reported or timed).

## 7. Technical Approach (summary)

### Model architecture: orchestrator + workers

- **Claude Fable 5 — the "brains" (orchestrator).** Runs in auto mode as the default coordinator: plans the review of each application, spawns and directs worker agents, handles routing decisions, resolves ambiguous/borderline findings, and synthesizes the final per-application summary. Fable 5 is deliberately invoked only at coordination and judgment points — **not** for bulk per-page work — so its usage limits are conserved.
- **Claude Opus 4.8 — the workers (agents).** Opus 4.8 instances execute the heavy per-document labor under Fable 5's direction: section segmentation, checklist-criterion verification, citation extraction, draft reviewer comments, and the verifier pass. Workers run in parallel per checklist group.
- **Cost note for production scale:** Opus 4.8 workers ($5/$25 per MTok) are appropriate for the POC and pilot. At production volume (hundreds of ACFRs/year), benchmark Sonnet 4.6 ($3/$15) on the mechanical checks and reserve Opus for judgment-heavy criteria — decide with measured accuracy data, not upfront.

### Stack

| Layer | POC choice | MVP / production path |
|---|---|---|
| Frontend & hosting | **Next.js on Vercel** — hosted link shared with client for hands-on testing | Web module inside Flowlyst product, per shared Figma |
| Database | **Neon Postgres** (documents, runs, findings, audit log) | Neon or AWS RDS; pgvector added for historical-precedent retrieval |
| LLM access | **Anthropic API (API keys, server-side only)** — Fable 5 orchestrator + Opus 4.8 workers | Same; prompt caching on checklist + few-shots; Batch API for non-urgent bulk runs |
| Extraction | Native PDF text layer (PyMuPDF or JS equivalent) — POC uses pre-loaded public ACFRs | Add **AWS Textract Tables** selectively on financial-statement pages; fallback: Docling / Azure Document Intelligence if table accuracy < ~90% |
| Storage | **Vercel Blob** — direct client uploads of arbitrary ACFR PDFs + pre-loaded demo documents | S3 with presigned direct uploads |
| Orchestration | Fable 5 auto mode + custom Anthropic SDK orchestration (orchestrator → parallel workers → verifier) | Same pattern; add a framework only if complexity demands |
| Development tooling | **Claude Code** for all build work | Same |

Estimated per-document processing cost: extraction well under $1; LLM pass low single-digit dollars with caching (Opus workers price above the earlier Sonnet-based $1–3 estimate; validate in the POC). LLM tokens, not OCR, dominate.

### POC deployment constraints (Vercel + Neon)

- **Full upload pipeline in POC:** users upload any ACFR PDF via **Vercel Blob client uploads** (browser → signed token from API route → direct upload to Blob), which bypasses Vercel's ~4.5MB serverless request-body limit. The processing pipeline reads the PDF from Blob. Pre-loaded public ACFRs (Davenport IA, Rockford IL) remain available as one-click demo documents alongside upload.
- **Upload guardrails:** PDF-only validation; file size cap (~25MB); page cap (~350 pages) to bound per-run Opus worker cost; clear error messages for rejected files.
- **Async processing pattern:** an upload/run is registered in Neon, workers write findings progressively, and the frontend polls/streams status — no long synchronous requests (Vercel function timeout limits). Progressive display of findings is also the better demo experience.
- **Access control:** simple access code / basic auth on the shared link plus a daily run cap, so a circulated URL cannot exhaust API credits.
- **Keys:** all API keys server-side only (API routes / server actions); never exposed to the client.

## 8. Data Requirements & Dependencies

**Blocking dependencies — needed from ASBO (via Aziz) before build:**
1. The **actual COE checklist** (current version + prior versions for historical grading).
2. **Historical corpus**: last ~5 years of applications with reviewer comments, decisions (Award / Conditional / Denied), and rejection reasons. This is the training/grounding data for F5 and comment style for F3; it is not public and cannot be substituted.
3. 2–3 ACFRs ASBO would label "clean" and 2–3 they'd label "problematic," for calibration.
4. Confirmation of real volumes: annual submissions, typical page counts, checklist length.

**Non-blocking:** public ACFRs (Davenport IA, Rockford IL, Dallas ISD, etc.) suffice for building and testing F1–F4 while the historical data is being obtained.

**Data handling:** ASBO's historical applications and comments are confidential. All processing stays inside Flowlyst's AWS account; no third-party parsing SaaS (e.g., LlamaCloud) that requires uploading client documents.

## 9. Milestones

| Phase | Weeks | Deliverable | Exit criterion |
|---|---|---|---|
| 0 — Discovery & hosted POC | 1–2 | Data requests submitted; **POC deployed on Vercel (Neon backend, Vercel Blob storage) and link shared with Aziz**: upload any ACFR (or pick a pre-loaded one) → completeness gate → 5–8 checklist findings with clickable page citations → quality badge; Fable 5 orchestrator + Opus 4.8 workers | Aziz can upload his own ACFR and run a live review end-to-end on the hosted link; cost/accuracy per document measured |
| 1 — Ingestion + completeness gate | 2–5 | F1 + F2 live on sample documents | Completeness gate matches human judgment on a test set of ≥10 ACFRs |
| 2 — Checklist engine + verifier | 4–8 | F3 + F4 + audit logging | ≥90% of findings carry valid, verifier-confirmed citations on test set |
| 3 — Triage + grounding | 7–11 | F5 using historical data | Classification agreement with historical outcomes measured on holdout |
| 4 — Review UI + pilot | 9–12 | F6 + F7; pilot run on historical holdout | Pilot report: agreement rate, verifier catch rate, estimated reviewer time saved |

Timeline assumes historical data arrives by end of Phase 1. If it slips, Phases 0–2 proceed on public ACFRs and Phase 3 shifts right accordingly.

## 10. Success Metrics (MVP)

- **Completeness gate accuracy:** ≥95% agreement with human completeness judgments; zero false rejections sent without human confirmation.
- **Citation validity:** ≥90% of AI findings carry a citation the verifier confirms.
- **Decision agreement:** AI triage/flags vs. actual historical outcomes on a holdout set — target to be set with ASBO after first measurement (this number is the client-facing credibility proof).
- **Reviewer time:** measurable reduction in time-per-application during pilot (baseline to be captured in discovery).
- **Human overturn rate** of AI findings trending down across the pilot.

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Historical data delayed or messy | Blocks F5; weakens comment quality in F3 | Start on public ACFRs; budget explicit data-cleaning time; escalate via Aziz early |
| Table extraction accuracy on financial statements | Wrong numbers → wrong findings | POC measures this first; fallback extractors identified (Docling, Azure DI) |
| LLM hallucination in findings | Client trust, appeal exposure | Mandatory citations + verifier agent + "needs human" downgrade path + full audit log |
| Scope creep toward auto-decisions | Timeline blowout; client resistance ("don't outsource our intelligence") | Non-goal stated in writing; UI frames AI output as findings, never verdicts |
| Checklist criteria are login-gated / assumptions wrong (checklist length, ~600/yr volume, page counts are unverified) | Mis-scoped engine | Blocking dependency #1 and #4; validate in discovery before Phase 2 |
| GASB 103 (FY2026) changes MD&A rules | Wrong grading for FY2026+ reports | Version checklist logic by fiscal year from day one |
| Per-document LLM cost exceeds budget (Opus 4.8 workers are premium-priced) | Unit economics | Fable 5 reserved for orchestration only (conserves its limits); caching + Batch API; benchmark Sonnet 4.6 for mechanical checks at scale; alert threshold at ~$5/document |
| Fable 5 usage limits exhausted mid-run | Pipeline stalls | Strict orchestrator-only role for Fable 5; bulk work always delegated to Opus 4.8 workers; graceful queueing if limits hit |

## 12. Open Questions

1. Exact COE checklist contents and how "must-pass" vs. advisory criteria are distinguished.
2. Real annual submission volume and the split of Award / Conditional / Denied outcomes.
3. Who confirms auto-rejections in MVP — ASBO staff or Flowlyst-side admin?
4. Does ASBO want districts to self-serve uploads in MVP, or staff-mediated intake first?
5. Reviewer comment tone/format standards — is there a style guide, or do we learn it from the historical corpus?
6. Development pricing and contract — to be negotiated with ASBO before Phase 1 begins (per current sponsorship arrangement, only planning is covered).
7. Salary-projection module integration (future Flowlyst roadmap) — architecture should not preclude it; confirm data-model expectations with Tural.

## 13. Future (post-MVP) Directions

- Extend to the MBA (budget award) review.
- District-facing pre-submission self-check ("run the completeness gate on your own ACFR before applying").
- Appeal-support tooling built on the audit log.
- Integration with Flowlyst's planned salary-projection module.
- Automated intake of the SurveyMonkey-replacement salary data workflow (separate workstream, shared platform).
