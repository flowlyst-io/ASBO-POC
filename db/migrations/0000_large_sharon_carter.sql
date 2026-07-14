CREATE TYPE "public"."classification" AS ENUM('best', 'better', 'good', 'poor');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('acfr', 'application_form', 'checklist');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('met', 'not_met', 'partial', 'na', 'cannot_determine');--> statement-breakpoint
CREATE TYPE "public"."gate_check_key" AS ENUM('clean_opinion', 'mdna_present', 'basic_statements', 'statistical_section', 'coe_checklist_attached', 'application_form_fee');--> statement-breakpoint
CREATE TYPE "public"."gate_status" AS ENUM('pending', 'pass', 'fail', 'needs_human');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('accepted', 'rejected', 'edited');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'awaiting_review', 'complete', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."section" AS ENUM('introductory', 'financial', 'statistical', 'compliance');--> statement-breakpoint
CREATE TYPE "public"."step_key" AS ENUM('extract', 'tables', 'segment', 'gate', 'checklist', 'verify', 'classify');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('pending', 'running', 'done', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."text_quality" AS ENUM('clean', 'degraded', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."verifier_status" AS ENUM('pending', 'confirmed', 'flagged');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_name" text NOT NULL,
	"state" text NOT NULL,
	"fiscal_year_end" date NOT NULL,
	"status" text DEFAULT 'intake' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid,
	"actor" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_version" text NOT NULL,
	"num" text NOT NULL,
	"section" "section" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"text" text NOT NULL,
	"char_count" integer NOT NULL,
	"quality_score" real NOT NULL,
	"needs_ocr" boolean DEFAULT false NOT NULL,
	"section" "section"
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"page_count" integer,
	"text_quality" text_quality DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"num" text NOT NULL,
	"section" "section" NOT NULL,
	"title" text NOT NULL,
	"status" "finding_status" NOT NULL,
	"confidence" "confidence" NOT NULL,
	"comment" text NOT NULL,
	"cite" text,
	"page" integer,
	"page_title" text,
	"hl_text" text,
	"lines" jsonb,
	"verifier_status" "verifier_status" DEFAULT 'pending' NOT NULL,
	"verifier_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gate_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"check_key" "gate_check_key" NOT NULL,
	"status" "gate_status" DEFAULT 'pending' NOT NULL,
	"explanation" text,
	"page" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"state" "review_state" NOT NULL,
	"comment" text,
	"reviewer" text DEFAULT 'reviewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step" "step_key" NOT NULL,
	"status" "step_status" DEFAULT 'pending' NOT NULL,
	"detail" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"current_step" "step_key",
	"gate_passed" boolean,
	"classification" "classification",
	"classification_rationale" text,
	"checklist_version" text DEFAULT 'v2025.1' NOT NULL,
	"error" text,
	"model_snapshot" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_checks" ADD CONSTRAINT "gate_checks_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_run_idx" ON "audit_log" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "criteria_version_num_uq" ON "criteria" USING btree ("checklist_version","num");--> statement-breakpoint
CREATE UNIQUE INDEX "document_pages_doc_page_uq" ON "document_pages" USING btree ("document_id","page_number");--> statement-breakpoint
CREATE INDEX "document_pages_doc_idx" ON "document_pages" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "findings_run_idx" ON "findings" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gate_checks_run_check_uq" ON "gate_checks" USING btree ("run_id","check_key");--> statement-breakpoint
CREATE INDEX "gate_checks_run_idx" ON "gate_checks" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_finding_uq" ON "reviews" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "reviews_run_idx" ON "reviews" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_run_step_uq" ON "run_steps" USING btree ("run_id","step");--> statement-breakpoint
CREATE INDEX "run_steps_run_idx" ON "run_steps" USING btree ("run_id");