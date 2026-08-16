import { sql } from "drizzle-orm";
import {
	pgTable,
	uuid,
	text,
	jsonb,
	timestamp,
	unique,
	index,
} from "drizzle-orm/pg-core";
import { issueSeverityEnum, issueStatusEnum, changeSourceEnum } from "./enums.js";
import { project } from "./project.js";
import { testCases } from "./test-cases.js";
import { importJobs } from "./imports.js";

export const issues = pgTable(
	"issues",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ticketRef: text("ticket_ref").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		severity: issueSeverityEnum("severity").notNull().default("medium"),
		status: issueStatusEnum("status").notNull().default("backlog"),
		environment: jsonb("environment"), // { browser, os, device, version, page }
		stepsToReproduce: text("steps_to_reproduce"),
		expectedResult: text("expected_result"),
		actualResult: text("actual_result"),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		reporterId: text("reporter_id").notNull(), // FK -> auth.user.id (app-level only)
		assigneeId: text("assignee_id"), // FK -> auth.user.id (app-level only), nullable
		qaAssigneeId: text("qa_assignee_id"), // FK -> auth.user.id (app-level only), nullable
		testCaseId: uuid("test_case_id").references(() => testCases.id),
		importJobId: uuid("import_job_id").references(() => importJobs.id),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
		closedAt: timestamp("closed_at", { withTimezone: true }),
	},
	(table) => ({
		projectStatusIdx: index("issues_project_status_idx").on(
			table.projectId,
			table.status,
		),
		assigneeIdx: index("issues_assignee_idx").on(table.assigneeId),
		qaAssigneeIdx: index("issues_qa_assignee_idx").on(table.qaAssigneeId),
		projectTicketRefUnique: unique("issues_project_ticket_ref_unique").on(
			table.projectId,
			table.ticketRef,
		),
	}),
);

export const issueStatusHistory = pgTable(
	"issue_status_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		issueId: uuid("issue_id")
			.notNull()
			.references(() => issues.id, { onDelete: "cascade" }),
		changedBy: text("changed_by").notNull(), // FK -> auth.user.id (app-level only)
		fromStatus: issueStatusEnum("from_status"),
		toStatus: issueStatusEnum("to_status").notNull(),
		note: text("note"),
		source: changeSourceEnum("source").notNull().default("web"),
		changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow(),
	},
	(table) => ({
		issueTimelineIdx: index("issue_status_history_issue_changed_at_idx").on(
			table.issueId,
			table.changedAt,
		),
		mcpActivityIdx: index("issue_status_history_mcp_activity_idx")
			.on(table.changedBy, table.changedAt.desc())
			.where(sql`${table.source} = 'mcp'`),
	}),
);