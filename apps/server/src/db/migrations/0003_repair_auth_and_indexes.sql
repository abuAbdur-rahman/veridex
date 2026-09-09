ALTER TABLE "auth"."user" ALTER COLUMN "username" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "auth"."user" ALTER COLUMN "default_role" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "team_member_user_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invites_pending_team_idx" ON "invites" USING btree ("team_id") WHERE "invites"."accepted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "project_member_user_idx" ON "project_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "issue_status_history_issue_changed_at_idx" ON "issue_status_history" USING btree ("issue_id","changed_at");--> statement-breakpoint
CREATE INDEX "issue_status_history_mcp_activity_idx" ON "issue_status_history" USING btree ("changed_by","changed_at") WHERE "issue_status_history"."source" = 'mcp';--> statement-breakpoint
CREATE INDEX "issues_project_status_idx" ON "issues" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "issues_assignee_idx" ON "issues" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "issues_qa_assignee_idx" ON "issues" USING btree ("qa_assignee_id");--> statement-breakpoint
CREATE INDEX "comments_active_issue_idx" ON "comments" USING btree ("issue_id") WHERE "comments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "api_tokens_user_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "auth"."user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "auth"."user" ADD CONSTRAINT "user_default_role_check" CHECK ("auth"."user"."default_role" IS NULL OR "auth"."user"."default_role" IN ('dev', 'qa', 'tester', 'admin'));