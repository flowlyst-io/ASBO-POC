/**
 * Shared domain contract between the pipeline, the API routes, and the UI.
 *
 * This file is the FROZEN CONTRACT: builders (pipeline-builder, api-builder,
 * ui-builder agents) consume it but do not edit it unilaterally. It mirrors
 * the design-handoff data model 1:1 (see .claude/skills/design-handoff).
 */

// --- Vocabularies (keep in sync with the pgEnums in db/schema.ts) -----------

export type Section = "introductory" | "financial" | "statistical" | "compliance";

export type DocumentKind = "acfr" | "application_form" | "checklist";

export type TextQuality = "clean" | "degraded" | "unknown";

export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_review"
  | "complete"
  | "failed"
  | "canceled";

export type StepKey =
  | "extract"
  | "tables"
  | "segment"
  | "gate"
  | "checklist"
  | "verify"
  | "classify";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type GateCheckKey =
  | "clean_opinion"
  | "mdna_present"
  | "basic_statements"
  | "statistical_section"
  | "coe_checklist_attached"
  | "application_form_fee";

export type GateStatus = "pending" | "pass" | "fail" | "needs_human";

export type FindingStatus = "met" | "not_met" | "partial" | "na" | "cannot_determine";

export type Confidence = "high" | "medium" | "low";

export type VerifierStatus = "pending" | "confirmed" | "flagged";

export type ReviewStateKind = "accepted" | "rejected" | "edited";

export type Classification = "best" | "better" | "good" | "poor";

export const STEP_ORDER: readonly StepKey[] = [
  "extract",
  "tables",
  "segment",
  "gate",
  "checklist",
  "verify",
  "classify",
] as const;

export const GATE_CHECK_KEYS: readonly GateCheckKey[] = [
  "clean_opinion",
  "mdna_present",
  "basic_statements",
  "statistical_section",
  "coe_checklist_attached",
  "application_form_fee",
] as const;

// --- API payload shapes ------------------------------------------------------

/** One checklist finding as consumed by the reviewer workspace. */
export interface Finding {
  id: string;
  num: string; // criterion number, e.g. "1.2"
  section: Section;
  title: string;
  status: FindingStatus;
  confidence: Confidence;
  comment: string; // AI draft reviewer comment
  cite: string | null; // e.g. "p. 3 — Letter of transmittal"
  page: number | null;
  pageTitle: string | null;
  hlText: string | null;
  /** Page excerpt lines; the literal string "@hl" marks where hlText is injected. */
  lines: string[] | null;
  verifierStatus: VerifierStatus;
  verifierReason: string | null;
  review: ReviewState | null;
}

/** Human review outcome for one finding. */
export interface ReviewState {
  state: ReviewStateKind;
  comment: string | null;
}

export type ReviewAction = "accept" | "reject" | "edit" | "undo";

export interface GateCheckResult {
  checkKey: GateCheckKey;
  status: GateStatus;
  explanation: string | null;
  page: number | null;
}

export interface RunStepState {
  step: StepKey;
  status: StepStatus;
  detail: Record<string, unknown> | null;
}

export interface ApplicationSummary {
  id: string;
  districtName: string;
  state: string;
  fiscalYearEnd: string; // ISO date
  status: string;
  latestRunId: string | null;
  latestRunStatus: RunStatus | null;
}

/** Enriched row for the Applications list and queue views. */
export interface ApplicationListItem extends ApplicationSummary {
  classification: Classification | null; // from latest run
  gatePassed: boolean | null; // from latest run
  createdAt: string; // ISO — "Received" column
  assignedReviewer: { id: string; name: string; state: string } | null;
}

export interface ApplicationsPayload {
  applications: ApplicationListItem[];
}

export interface ReviewerSummary {
  id: string;
  name: string;
  state: string;
  title: string;
  isDemo: boolean;
  /** Open assigned applications (latest run not complete). */
  assignedCount: number;
  /** Assigned applications whose latest run is complete. */
  completedCount: number;
}

export interface ReviewersPayload {
  reviewers: ReviewerSummary[];
}

/** Payload for GET /api/nav/counts — drives the nav-rail badges + avatar. */
export interface NavCountsPayload {
  applications: number;
  assignedToMe: number;
  completed: number;
  me: { id: string; name: string; initials: string };
}

/** Per-run LLM cost row derived from audit_log llm_call payloads. */
export interface RunCostRow {
  runId: string;
  districtName: string;
  classification: Classification | null;
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  /** True when the run only has mocked LLM calls (no token data). */
  mock: boolean;
}

/** Payload for GET /api/metrics — the PRD F7 dashboard numbers. */
export interface MetricsPayload {
  runsByStatus: Partial<Record<RunStatus, number>>;
  applicationsProcessed: number;
  completenessRejectionRate: number | null;
  avgFindingsPerApplication: number | null;
  humanOverturnRate: number | null;
  verifierCatchRate: number | null;
  totalReviews: number;
  totalFindings: number;
  runCosts: RunCostRow[];
  totalCostUsd: number;
}

// claude-haiku-4-5 pricing (USD per million tokens)
export const HAIKU_INPUT_USD_PER_MTOK = 1;
export const HAIKU_OUTPUT_USD_PER_MTOK = 5;
export const HAIKU_CACHE_READ_USD_PER_MTOK = 0.1; // ~0.1x input
export const HAIKU_CACHE_WRITE_USD_PER_MTOK = 1.25; // 1.25x input (5m TTL)

/** Poll payload for GET /api/runs/[runId]. */
export interface RunStatusPayload {
  id: string;
  applicationId: string;
  documentId: string;
  status: RunStatus;
  currentStep: StepKey | null;
  gatePassed: boolean | null;
  classification: Classification | null;
  classificationRationale: string | null;
  checklistVersion: string;
  error: string | null;
  steps: RunStepState[];
  gateChecks: GateCheckResult[];
  findingsCount: number;
  verifierConfirmedCount: number;
  application: {
    districtName: string;
    state: string;
    fiscalYearEnd: string;
    pageCount: number | null;
    filename: string;
    textQuality: TextQuality;
  };
}

/** Payload for GET /api/runs/[runId]/findings. */
export interface FindingsPayload {
  runId: string;
  findings: Finding[];
  /** True while checklist/verify steps are still producing findings. */
  streaming: boolean;
}

/** Payload for GET /api/documents/[documentId]/pages/[page]. */
export interface PagePayload {
  documentId: string;
  pageNumber: number;
  pageCount: number;
  text: string;
  section: Section | null;
  needsOcr: boolean;
}

// --- App constants ------------------------------------------------------------

export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // 25MB
export const UPLOAD_MAX_PAGES = 350;
export const CHECKLIST_BATCH_SIZE = 5; // criteria per advance invocation
