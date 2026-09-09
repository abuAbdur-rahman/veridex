import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { project } from "./project.js";

export const testCases = pgTable("test_cases", {
	id: uuid("id").primaryKey().defaultRandom(),
	title: text("title").notNull(),
	description: text("description"),
	preconditions: text("preconditions"),
	steps: jsonb("steps"), // [{ step, expected }]
	expectedResult: text("expected_result"),
	projectId: uuid("project_id")
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	createdBy: text("created_by").notNull(), // FK -> auth.user.id (app-level only)
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});