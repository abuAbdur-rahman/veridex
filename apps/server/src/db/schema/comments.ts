import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { issues } from "./issues.js";

export const comments = pgTable(
	"comments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		issueId: uuid("issue_id")
			.notNull()
			.references(() => issues.id, { onDelete: "cascade" }),
		authorId: text("author_id").notNull(), // FK -> auth.user.id (app-level only)
		body: text("body").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete
	},
	(table) => ({
		activeIssueIdx: index("comments_active_issue_idx")
			.on(table.issueId)
			.where(sql`${table.deletedAt} IS NULL`),
	}),
);