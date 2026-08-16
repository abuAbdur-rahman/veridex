ALTER TABLE "issue_status_history" ALTER COLUMN "from_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "issue_status_history" ALTER COLUMN "to_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "status" SET DEFAULT 'backlog'::text;--> statement-breakpoint
DROP TYPE "public"."issue_status";--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('backlog', 'in_progress', 'in_qa', 'verified');--> statement-breakpoint
ALTER TABLE "issue_status_history" ALTER COLUMN "from_status" SET DATA TYPE "public"."issue_status" USING "from_status"::"public"."issue_status";--> statement-breakpoint
ALTER TABLE "issue_status_history" ALTER COLUMN "to_status" SET DATA TYPE "public"."issue_status" USING "to_status"::"public"."issue_status";--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "status" SET DEFAULT 'backlog'::"public"."issue_status";--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "status" SET DATA TYPE "public"."issue_status" USING "status"::"public"."issue_status";