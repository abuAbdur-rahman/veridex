import type { Queue } from "../jobs/queue.js";
import type { Database } from "../db/client.js";
import { importJobs } from "../db/schema/index.js";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ForbiddenError, ValidationError } from "../lib/errors.js";
import { projectMember } from "../db/schema/project.js";
import {
	parseExcelFileForImport,
	parseCsvFileForImport,
	type StoredParsedRows,
	readParsedRows,
	normalizeImportStatus,
	normalizeStatusAssigneeMapping,
} from "../jobs/import.worker.js";

export interface UploadResult {
	importJobId: string;
}

export interface PreviewResult {
	id: string;
	fileType: string;
	originalName: string;
	totalRows: number | null;
	headers: string[];
	sampleRows: Record<string, unknown>[];
	columnMapping: Record<string, string> | null;
	colorMapping: Record<string, string> | null;
	colorCounts: Record<string, number>;
	status: string;
	error: string | null;
	worksheets: Array<{ index: number; name: string; totalRows: number }>;
	selectedWorksheetIndex: number;
}

export interface ConfirmResult {
	importJobId: string;
}

export interface ImportErrorsResult {
	importJobId: string;
	status: string;
	totalRows: number | null;
	importedRows: number;
	failedRows: number;
	errors: Array<{ row: number; error: string }> | null;
}

export function expectedRoleForStatus(status: string): "dev" | "qa" {
	return status === "in_qa" || status === "verified" ? "qa" : "dev";
}

async function verifyProjectMembership(
	db: Database,
	projectId: string,
	userId: string,
): Promise<void> {
	const rows = await db
		.select({ userId: projectMember.userId })
		.from(projectMember)
		.where(
			and(
				eq(projectMember.projectId, projectId),
				eq(projectMember.userId, userId),
			),
		)
		.limit(1);
	if (rows.length === 0) {
		throw new ForbiddenError("Not a member of this project");
	}
}

export async function uploadSpreadsheet(
	db: Database,
	projectId: string,
	userId: string,
	file: { buffer: Buffer; filename: string; mimetype: string },
): Promise<UploadResult> {
	await verifyProjectMembership(db, projectId, userId);

	const normalizedFilename = file.filename.toLowerCase();
	const fileType = file.mimetype.includes("spreadsheet") ||
		normalizedFilename.endsWith(".xlsx")
		? "xlsx"
		: "csv";

	if (fileType === "csv" && !normalizedFilename.endsWith(".csv")) {
		throw new ValidationError({ file: ["File must be .xlsx or .csv"] });
	}

	const parseResult = fileType === "xlsx"
		? await parseExcelFileForImport(file.buffer)
		: parseCsvFileForImport(file.buffer.toString("utf-8"));

	const [importJob] = await db
		.insert(importJobs)
		.values({
			filename: file.filename,
			originalName: file.filename,
			fileType,
			status: "completed",
			totalRows: parseResult.totalRows,
			columnMapping: parseResult.columnMapping,
			colorMapping: parseResult.colorMapping,
			parsedRows: fileType === "xlsx"
				? { version: 2, worksheets: parseResult.worksheets }
				: parseResult.allRows,
			projectId,
			createdBy: userId,
			completedAt: new Date(),
		})
		.returning();

	return { importJobId: importJob.id };
}

export async function getPreview(
	db: Database,
	projectId: string,
	importJobId: string,
	userId: string,
	worksheetIndex = 0,
): Promise<PreviewResult> {
	await verifyProjectMembership(db, projectId, userId);

	const [job] = await db
		.select()
		.from(importJobs)
		.where(
			and(
				eq(importJobs.id, importJobId),
				eq(importJobs.projectId, projectId),
			),
		)
		.limit(1);

	if (!job) throw new NotFoundError("Import job");

	if (job.status === "pending") {
		throw new ValidationError({
			status: ["Import is still being parsed"],
		});
	}

	const stored = job.parsedRows as StoredParsedRows;
	const { rows, worksheet, isLegacy } = readParsedRows(stored, worksheetIndex);
	if (!isLegacy && !worksheet) throw new ValidationError({ worksheetIndex: ["Worksheet not found"] });
	const parsedRows = rows ?? [];
	const selectedWorksheetIndex = isLegacy ? 0 : worksheetIndex;
	const headers = isLegacy ? (job.columnMapping ? Object.keys(job.columnMapping) : []) : worksheet?.header ?? [];
	const sampleRows = parsedRows.slice(0, 5).map((row) => row.data);
	const selectedColumnMapping = isLegacy
		? (job.columnMapping as Record<string, string> | null)
		: worksheet?.columnMapping ?? null;
	const selectedColorMapping = isLegacy
		? (job.colorMapping as Record<string, string> | null)
		: worksheet?.colorMapping ?? null;
	const colorCounts = parsedRows.reduce<Record<string, number>>((counts, row) => {
		if (row.colorHex) counts[row.colorHex] = (counts[row.colorHex] ?? 0) + 1;
		return counts;
	}, {});

	return {
		id: job.id,
		fileType: job.fileType,
		originalName: job.originalName,
		totalRows: isLegacy ? job.totalRows : worksheet?.totalRows ?? 0,
		headers,
		sampleRows,
		columnMapping: selectedColumnMapping,
		colorMapping: selectedColorMapping,
		colorCounts,
		status: job.status,
		error:
			job.status === "failed"
				? ((job.errorLog as Array<{ row: number; error: string }> | null)?.[0]?.error ??
					"Import failed")
				: null,
		worksheets: isLegacy
			? [{ index: 0, name: job.originalName, totalRows: parsedRows.length }]
			: (!Array.isArray(stored) ? stored?.worksheets ?? [] : []).map(
				({ index, name, totalRows }) => ({ index, name, totalRows }),
			),
		selectedWorksheetIndex,
	};
}

export async function confirmImport(
	db: Database,
	queue: Queue,
	projectId: string,
	importJobId: string,
	userId: string,
	columnMapping: Record<string, string>,
	colorMapping?: Record<string, string>,
	defaultStatus?: string,
	worksheetIndex = 0,
	statusAssigneeMapping?: Record<string, string[]>,
): Promise<ConfirmResult> {
	await verifyProjectMembership(db, projectId, userId);

	const [job] = await db
		.select()
		.from(importJobs)
		.where(
			and(
				eq(importJobs.id, importJobId),
				eq(importJobs.projectId, projectId),
			),
		)
		.limit(1);

	if (!job) throw new NotFoundError("Import job");

	if (job.status !== "completed") {
		throw new ValidationError({
			status: ["Import must be parsed before confirming"],
		});
	}
	const stored = job.parsedRows as StoredParsedRows;
	if (!stored) {
		throw new ValidationError({ status: ["Import has already been consumed"] });
	}
	const { rows: selectedRows, worksheet, isLegacy } = readParsedRows(stored, worksheetIndex);
	if (!isLegacy && !worksheet) {
		throw new ValidationError({ worksheetIndex: ["Worksheet not found"] });
	}
	if (selectedRows?.length === 0) {
		throw new ValidationError({ worksheetIndex: ["Worksheet has no importable rows"] });
	}
	if (statusAssigneeMapping && Object.keys(statusAssigneeMapping).length > 0) {
		const memberRows = await db
			.select({ userId: projectMember.userId, role: projectMember.role })
			.from(projectMember)
			.where(eq(projectMember.projectId, projectId));
		const membersById = new Map(memberRows.map((row) => [row.userId, row.role]));
		for (const [status, assigneeIds] of Object.entries(normalizeStatusAssigneeMapping(statusAssigneeMapping))) {
			for (const assigneeId of assigneeIds) {
				const expectedRole = expectedRoleForStatus(status);
				if (membersById.get(assigneeId) !== expectedRole) {
					throw new ValidationError({
						statusAssigneeMapping: ["Assignee must have the matching project role"],
					});
				}
			}
		}
	}

	const normalizedStatusAssigneeMapping = normalizeStatusAssigneeMapping(
		statusAssigneeMapping ?? {},
	);
	const payload: {
		importJobId: string;
		columnMapping: Record<string, string>;
		colorMapping?: Record<string, string>;
		defaultStatus?: string;
		worksheetIndex?: number;
		statusAssigneeMapping?: Record<string, string[]>;
	} = {
		importJobId,
		columnMapping,
		colorMapping: (colorMapping ?? job.colorMapping ?? undefined) as
			| Record<string, string>
			| undefined,
		defaultStatus: normalizeImportStatus(defaultStatus),
	};
	if (worksheetIndex !== 0) payload.worksheetIndex = worksheetIndex;
	if (Object.keys(normalizedStatusAssigneeMapping).length > 0) {
		payload.statusAssigneeMapping = normalizedStatusAssigneeMapping;
	}
	await queue.send("import-insert", payload);
	await db
		.update(importJobs)
		.set({
			status: "pending",
			columnMapping,
			colorMapping: colorMapping ?? job.colorMapping,
		})
		.where(eq(importJobs.id, importJobId));

	return { importJobId };
}

export async function getImportErrors(
	db: Database,
	projectId: string,
	importJobId: string,
	userId: string,
): Promise<ImportErrorsResult> {
	await verifyProjectMembership(db, projectId, userId);

	const [job] = await db
		.select()
		.from(importJobs)
		.where(
			and(
				eq(importJobs.id, importJobId),
				eq(importJobs.projectId, projectId),
			),
		)
		.limit(1);

	if (!job) throw new NotFoundError("Import job");

	return {
		importJobId: job.id,
		status: job.status,
		totalRows: job.totalRows,
		importedRows: job.importedRows,
		failedRows: job.failedRows,
		errors: job.errorLog as Array<{ row: number; error: string }> | null,
	};
}
