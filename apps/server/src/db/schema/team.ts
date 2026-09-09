import {
	pgTable,
	uuid,
	text,
	boolean,
	timestamp,
	primaryKey,
	index,
} from "drizzle-orm/pg-core";
import { teamRoleEnum } from "./enums.js";

export const team = pgTable("team", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	slug: text("slug").unique().notNull(),
	ownerId: text("owner_id").notNull(), // FK -> auth.user.id (app-level only)
	isPersonal: boolean("is_personal").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const teamMember = pgTable(
	"team_member",
	{
		teamId: uuid("team_id")
			.notNull()
			.references(() => team.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(), // FK -> auth.user.id (app-level only)
		teamRole: teamRoleEnum("team_role").notNull().default("member"),
		invitedBy: text("invited_by"), // FK -> auth.user.id (app-level only), nullable
		joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.teamId, table.userId] }),
		userIdx: index("team_member_user_idx").on(table.userId),
	}),
);