CREATE TYPE "public"."issue_assignment_role" AS ENUM('dev', 'qa');--> statement-breakpoint
CREATE TABLE "issue_assignments" (
	"issue_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "issue_assignment_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "issue_assignments_issue_id_user_id_role_pk" PRIMARY KEY("issue_id","user_id","role")
);
--> statement-breakpoint
ALTER TABLE "issue_assignments" ADD CONSTRAINT "issue_assignments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_assignments_user_role_idx" ON "issue_assignments" USING btree ("user_id","role");