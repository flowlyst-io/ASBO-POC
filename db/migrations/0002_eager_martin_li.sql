ALTER TYPE "public"."run_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "gate_override" boolean DEFAULT false NOT NULL;