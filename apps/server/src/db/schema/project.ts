import {
	pgTable,
	uuid,
	text,
	integer,
	timestamp,
	unique,
	primaryKey,
	index,
} from "drizzle-orm/pg-core";
import { projectRoleEnum } from "./enums.js";
import { team } from "./team.js";

export const project = pgTable(
	"project",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		teamId: uuid("team_id")
			.notNull()
			.references(() => team.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		description: text("description"),
		nextTicketNumber: integer("next_ticket_number").notNull().default(0),
		createdBy: text("created_by").notNull(), // FK -> auth.user.id (app-level only)
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => ({
		teamSlugUnique: unique("project_team_slug_unique").on(
			table.teamId,
			table.slug,
		),
	}),
);

export const projectMember = pgTable(
	"project_member",
	{
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(), // FK -> auth.user.id (app-level only)
		role: projectRoleEnum("role").notNull(),
		addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.projectId, table.userId] }),
		userIdx: index("project_member_user_idx").on(table.userId),
	}),
);