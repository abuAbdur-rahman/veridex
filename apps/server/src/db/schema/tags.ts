import {
	pgTable,
	uuid,
	text,
	timestamp,
	primaryKey,
} from "drizzle-orm/pg-core";
import { project } from "./project.js";
import { issues } from "./issues.js";

export const tags = pgTable("tags", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	color: text("color").notNull(), // accent/neutral only, never status colors
	projectId: uuid("project_id")
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const issueTags = pgTable(
	"issue_tags",
	{
		issueId: uuid("issue_id")
			.notNull()
			.references(() => issues.id, { onDelete: "cascade" }),
		tagId: uuid("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.issueId, table.tagId] }),
	}),
);