CREATE TABLE "reviewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"title" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "assigned_reviewer_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "reviewers_name_uq" ON "reviewers" USING btree ("name");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_reviewer_id_reviewers_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."reviewers"("id") ON DELETE no action ON UPDATE no action;