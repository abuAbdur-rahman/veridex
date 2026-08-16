import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { teamRoleEnum } from "./enums.js";
import { team } from "./team.js";

export const invites = pgTable(
	"invites",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		token: text("token").unique().notNull(),
		teamId: uuid("team_id")
			.notNull()
			.references(() => team.id, { onDelete: "cascade" }),
		invitedBy: text("invited_by").notNull(), // FK -> auth.user.id (app-level only)
		email: text("email").notNull(),
		teamRole: teamRoleEnum("team_role").notNull().default("member"),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => ({
		pendingTeamIdx: index("invites_pending_team_idx")
			.on(table.teamId)
			.where(sql`${table.acceptedAt} IS NULL`),
	}),
);