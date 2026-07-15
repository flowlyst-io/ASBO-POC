import {
  bigserial,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  index,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums — single source of truth for every status vocabulary in the system.
// lib/types.ts re-exports these as TS unions for the UI/pipeline contract.
// ---------------------------------------------------------------------------

export const sectionEnum = pgEnum("section", [
  "introductory",
  "financial",
  "statistical",
  "compliance",
]);

export const documentKindEnum = pgEnum("document_kind", [
  "acfr",
  "application_form",
  "checklist",
]);

export const textQualityEnum = pgEnum("text_quality", [
  "clean",
  "degraded",
  "unknown",
]);

export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "awaiting_review",
  "complete",
  "failed",
  "canceled",
  "rejected",
]);

export const stepKeyEnum = pgEnum("step_key", [
  "extract",
  "tables",
  "segment",
  "gate",
  "checklist",
  "verify",
  "classify",
]);

export const stepStatusEnum = pgEnum("step_status", [
  "pending",
  "running",
  "done",
  "failed",
  "skipped",
]);

export const gateCheckKeyEnum = pgEnum("gate_check_key", [
  "clean_opinion",
  "mdna_present",
  "basic_statements",
  "statistical_section",
  "coe_checklist_attached",
  "application_form_fee",
]);

export const gateStatusEnum = pgEnum("gate_status", [
  "pending",
  "pass",
  "fail",
  "needs_human",
]);

export const findingStatusEnum = pgEnum("finding_status", [
  "met",
  "not_met",
  "partial",
  "na",
  "cannot_determine",
]);

export const confidenceEnum = pgEnum("confidence", ["high", "medium", "low"]);

export const verifierStatusEnum = pgEnum("verifier_status", [
  "pending",
  "confirmed",
  "flagged",
]);

export const reviewStateEnum = pgEnum("review_state", [
  "accepted",
  "rejected",
  "edited",
]);

export const classificationEnum = pgEnum("classification", [
  "best",
  "better",
  "good",
  "poor",
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const reviewers = pgTable(
  "reviewers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    state: text("state").notNull(), // 2-letter; ASBO reviewers recuse from own-state applications
    title: text("title").notNull(),
    isDemo: boolean("is_demo").notNull().default(false), // the persona behind the top-bar avatar
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviewers_name_uq").on(t.name)],
);

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  districtName: text("district_name").notNull(),
  state: text("state").notNull(),
  fiscalYearEnd: date("fiscal_year_end").notNull(),
  status: text("status").notNull().default("intake"),
  // Assignment lives on the application (not the run) so it survives re-runs.
  assignedReviewerId: uuid("assigned_reviewer_id").references(() => reviewers.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id),
  kind: documentKindEnum("kind").notNull(),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  pageCount: integer("page_count"),
  textQuality: textQualityEnum("text_quality").notNull().default("unknown"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentPages = pgTable(
  "document_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    pageNumber: integer("page_number").notNull(),
    text: text("text").notNull(),
    charCount: integer("char_count").notNull(),
    qualityScore: real("quality_score").notNull(),
    needsOcr: boolean("needs_ocr").notNull().default(false),
    section: sectionEnum("section"),
  },
  (t) => [
    uniqueIndex("document_pages_doc_page_uq").on(t.documentId, t.pageNumber),
    index("document_pages_doc_idx").on(t.documentId),
  ],
);

export const criteria = pgTable(
  "criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checklistVersion: text("checklist_version").notNull(),
    num: text("num").notNull(), // e.g. "1.2"
    section: sectionEnum("section").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [uniqueIndex("criteria_version_num_uq").on(t.checklistVersion, t.num)],
);

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  status: runStatusEnum("status").notNull().default("queued"),
  currentStep: stepKeyEnum("current_step"),
  gatePassed: boolean("gate_passed"),
  // Human chose "Override & proceed" after a gate failure — review steps run anyway.
  gateOverride: boolean("gate_override").notNull().default(false),
  classification: classificationEnum("classification"),
  classificationRationale: text("classification_rationale"),
  checklistVersion: text("checklist_version").notNull().default("v2025.1"),
  error: text("error"),
  // Copy of lib/ai/models.ts at run start — audit requirement (PRD F7).
  modelSnapshot: jsonb("model_snapshot"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runSteps = pgTable(
  "run_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    step: stepKeyEnum("step").notNull(),
    status: stepStatusEnum("status").notNull().default("pending"),
    // Cursor + metrics, e.g. { cursor: 15, total: 40, inputTokens: 1234, outputTokens: 567 }
    detail: jsonb("detail"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("run_steps_run_step_uq").on(t.runId, t.step),
    index("run_steps_run_idx").on(t.runId),
  ],
);

export const gateChecks = pgTable(
  "gate_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    checkKey: gateCheckKeyEnum("check_key").notNull(),
    status: gateStatusEnum("status").notNull().default("pending"),
    explanation: text("explanation"),
    page: integer("page"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("gate_checks_run_check_uq").on(t.runId, t.checkKey),
    index("gate_checks_run_idx").on(t.runId),
  ],
);

export const findings = pgTable(
  "findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => criteria.id),
    num: text("num").notNull(),
    section: sectionEnum("section").notNull(),
    title: text("title").notNull(),
    status: findingStatusEnum("status").notNull(),
    confidence: confidenceEnum("confidence").notNull(),
    comment: text("comment").notNull(), // AI draft reviewer comment
    cite: text("cite"), // e.g. "p. 3 — Letter of transmittal"
    page: integer("page"),
    pageTitle: text("page_title"),
    hlText: text("hl_text"), // exact passage relied on (highlighted in viewer)
    lines: jsonb("lines"), // string[] page excerpt with literal '@hl' marker
    verifierStatus: verifierStatusEnum("verifier_status").notNull().default("pending"),
    verifierReason: text("verifier_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("findings_run_idx").on(t.runId)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    findingId: uuid("finding_id")
      .notNull()
      .references(() => findings.id),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    state: reviewStateEnum("state").notNull(),
    comment: text("comment"), // reviewer-edited comment (when state = edited)
    reviewer: text("reviewer").notNull().default("reviewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_finding_uq").on(t.findingId),
    index("reviews_run_idx").on(t.runId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: uuid("run_id").references(() => runs.id),
    // "system" | "agent:extract" | "agent:gate" | "agent:checklist" | "agent:verify"
    // | "agent:classify" | "agent:segment" | "human"
    actor: text("actor").notNull(),
    event: text("event").notNull(),
    // model id, prompt version, token usage, input hash, verdict, ...
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_run_idx").on(t.runId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Inferred row types
// ---------------------------------------------------------------------------

export type ReviewerRow = typeof reviewers.$inferSelect;
export type ApplicationRow = typeof applications.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type DocumentPageRow = typeof documentPages.$inferSelect;
export type CriterionRow = typeof criteria.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type RunStepRow = typeof runSteps.$inferSelect;
export type GateCheckRow = typeof gateChecks.$inferSelect;
export type FindingRow = typeof findings.$inferSelect;
export type ReviewRow = typeof reviews.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
