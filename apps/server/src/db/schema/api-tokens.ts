import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

export const apiTokens = pgTable(
	"api_tokens",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id").notNull(), // FK -> auth.user.id (app-level only)
		tokenHash: text("token_hash").unique().notNull(), // SHA-256, never plaintext
		tokenPrefix: text("token_prefix").notNull(), // first 12 chars, for display
		name: text("name").notNull(), // user-provided label
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }), // null = no expiry
		revokedAt: timestamp("revoked_at", { withTimezone: true }), // soft revoke
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => ({
		userIdx: index("api_tokens_user_idx").on(table.userId),
	}),
);