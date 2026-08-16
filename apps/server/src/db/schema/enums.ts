import { pgEnum } from "drizzle-orm/pg-core";

export const teamRoleEnum = pgEnum("team_role", ["owner", "admin", "member"]);
export const projectRoleEnum = pgEnum("project_role", [
	"dev",
	"qa",
	"tester",
	"admin",
]);
export const issueSeverityEnum = pgEnum("issue_severity", [
	"low",
	"medium",
	"high",
	"critical",
]);
export const issueStatusEnum = pgEnum("issue_status", [
	"backlog",
	"in_progress",
	"in_qa",
	"verified",
]);
export const importStatusEnum = pgEnum("import_status", [
	"pending",
	"processing",
	"completed",
	"failed",
]);
export const fileTypeEnum = pgEnum("file_type", ["xlsx", "csv"]);
export const changeSourceEnum = pgEnum("change_source", ["web", "mcp", "import"]);
