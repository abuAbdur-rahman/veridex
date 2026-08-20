import {
	pgTable,
	uuid,
	text,
	integer,
	jsonb,
	timestamp,
} from "drizzle-orm/pg-core";
import { importStatusEnum, fileTypeEnum } from "./enums.js";
import { project } from "./project.js";

export const importJobs = pgTable("import_jobs", {
	id: uuid("id").primaryKey().defaultRandom(),
	filename: text("filename").notNull(), // R2 storage key
	originalName: text("original_name").notNull(), // shown in UI
	fileType: fileTypeEnum("file_type").notNull(),
	status: importStatusEnum("status").notNull().default("pending"),
	totalRows: integer("total_rows"),
	importedRows: integer("imported_rows").notNull().default(0),
	failedRows: integer("failed_rows").notNull().default(0),
	columnMapping: jsonb("column_mapping"), // { "Bug Title": "title" }
	colorMapping: jsonb("color_mapping"), // .xlsx only
	parsedRows: jsonb("parsed_rows"), // ParsedRow[] for insert worker
	errorLog: jsonb("error_log"), // [{ row, error }]
	projectId: uuid("project_id")
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	createdBy: text("created_by").notNull(), // FK -> auth.user.id (app-level only)
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true }),
});