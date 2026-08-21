import { PgBoss } from "pg-boss";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
	importJobs,
	issueAssignments,
	issues,
	issueStatusHistory,
	project,
	projectMember,
} from "../db/schema/index.js";
import type { IssueStatus } from "../services/issue.service.js";
import { expectedRoleForStatus } from "../services/import.service.js";

const THEME_COLORS = [
	"FFFFFF",
	"000000",
	"E7E6E6",
	"44546A",
	"4472C4",
	"ED7D31",
	"A5A5A5",
	"FFC000",
	"5B9BD5",
	"70AD47",
];

function applyTint(hex: string, tint: number): string {
	const rgb = Number.parseInt(hex, 16);
	const r = (rgb >> 16) & 0xff;
	const g = (rgb >> 8) & 0xff;
	const b = rgb & 0xff;
	const adjust = (channel: number) =>
		tint < 0
			? Math.round(channel * (1 + tint))
			: Math.round(channel * (1 - tint) + 255 * tint);
	return [adjust(r), adjust(g), adjust(b)]
		.map((c) => c.toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase();
}

export function resolveCellColor(
	fgColor: { rgb?: string; argb?: string; theme?: number; tint?: number } | undefined,
): string | null {
	if (!fgColor) return null;
	const rgb = fgColor.rgb ?? fgColor.argb;
	if (rgb) return rgb.length === 8 ? rgb.slice(2).toUpperCase() : rgb.toUpperCase();
	if (fgColor.theme !== undefined) {
		const base = THEME_COLORS[fgColor.theme] ?? null;
		if (!base) return null;
		return fgColor.tint ? applyTint(base, fgColor.tint) : base;
	}
	return null;
}

export function hexToStatus(
	hex: string | null,
): "backlog" | "in_progress" | "in_qa" | "verified" | "rejected" | null {
	if (!hex) return null;
	const r = Number.parseInt(hex.slice(0, 2), 16);
	const g = Number.parseInt(hex.slice(2, 4), 16);
	const b = Number.parseInt(hex.slice(4, 6), 16);

	if (r > 180 && g < 120 && b < 120) return "rejected";
	if (r > 200 && g > 150 && g < 220 && b < 100) return "in_progress";
	if (r > 200 && g > 200 && b < 120) return "in_qa";
	if (r < 120 && g > 150 && b < 150) return "verified";
	return null;
}

export interface ParsedRow {
	[key: string]: string | number | boolean | null;
}

export interface ParsedRowWithColor {
	data: ParsedRow;
	colorHex: string | null;
}

export interface ImportWorksheet {
	index: number;
	name: string;
	header: string[];
	rows: ParsedRowWithColor[];
	columnMapping: Record<string, string>;
	colorMapping: Record<string, string>;
	totalRows: number;
}

export interface ParseForImportResult {
	headers: string[];
	allRows: ParsedRowWithColor[];
	columnMapping: Record<string, string>;
	colorMapping: Record<string, string>;
	totalRows: number;
	worksheets: ImportWorksheet[];
}

export type StoredParsedRows =
	| ParsedRowWithColor[]
	| { version: number; worksheets: ImportWorksheet[] }
	| null;

export function readParsedRows(
	stored: StoredParsedRows,
	worksheetIndex: number,
): {
	rows: ParsedRowWithColor[] | null;
	worksheet: ImportWorksheet | null;
	isLegacy: boolean;
} {
	if (Array.isArray(stored)) {
		return { rows: stored, worksheet: null, isLegacy: true };
	}
	const worksheet = stored?.version === 2
		? stored.worksheets[worksheetIndex] ?? null
		: null;
	return { rows: worksheet?.rows ?? null, worksheet, isLegacy: false };
}

function autoMapColumns(headers: string[]): Record<string, string> {
	const columnMapping: Record<string, string> = {};
	for (const header of headers) {
		columnMapping[header] = "";
		const lower = header.toLowerCase();
		if (lower.includes("title") || lower.includes("bug") || lower.includes("summary"))
			columnMapping[header] = "title";
		else if (lower.includes("description") || lower.includes("detail"))
			columnMapping[header] = "description";
		else if (lower.includes("severity") || lower.includes("priority"))
			columnMapping[header] = "severity";
		else if (lower.includes("environment") || lower.includes("browser"))
			columnMapping[header] = "environment";
		else if (lower.includes("step")) columnMapping[header] = "stepsToReproduce";
		else if (lower.includes("expected")) columnMapping[header] = "expectedResult";
		else if (lower.includes("actual")) columnMapping[header] = "actualResult";
		else if (lower.includes("screenshot") || lower.includes("image"))
			columnMapping[header] = "imageUrl";
	}
	return columnMapping;
}

function findRowColorHex(
	sheetRow: ExcelJS.Row,
	headerCount: number,
): string | null {
	for (let c = 1; c <= headerCount; c++) {
		const fill = sheetRow.getCell(c).fill;
		if (fill && fill.type === "pattern" && "fgColor" in fill && fill.fgColor) {
			const hex = resolveCellColor(
				fill.fgColor as { rgb?: string; argb?: string; theme?: number; tint?: number },
			);
			if (hex && hexToStatus(hex)) return hex;
		}
	}
	return null;
}

export async function parseExcelFileForImport(fileBuffer: Uint8Array): Promise<ParseForImportResult> {
	const workbook = new ExcelJS.Workbook();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ExcelJS load() Buffer type incompatible with Node 20+ Buffer
	await workbook.xlsx.load(fileBuffer as any);

	const worksheets = workbook.worksheets.map((sheet, index): ImportWorksheet => {
		const headers: string[] = [];
		sheet.getRow(1).eachCell((cell, colNumber) => {
			headers[colNumber - 1] = String(cell.value ?? "");
		});
		const colorMapping: Record<string, string> = {};
		for (let r = 2; r <= sheet.rowCount; r++) {
			const sheetRow = sheet.getRow(r);
			for (let c = 1; c <= headers.length; c++) {
				const fill = sheetRow.getCell(c).fill;
				const hex = fill && fill.type === "pattern" && "fgColor" in fill && fill.fgColor
					? resolveCellColor(fill.fgColor as { rgb?: string; argb?: string; theme?: number; tint?: number })
					: null;
				const status = hexToStatus(hex);
				if (status && hex && colorMapping[hex] === undefined) colorMapping[hex] = status;
			}
		}
		const rows: ParsedRowWithColor[] = [];
		for (let r = 2; r <= sheet.rowCount; r++) {
			const sheetRow = sheet.getRow(r);
			const rowData: ParsedRow = {};
			let hasData = false;
			for (let c = 1; c <= headers.length; c++) {
				const val = sheetRow.getCell(c).value as string | number | boolean | null;
				rowData[headers[c - 1]] = val;
				if (val !== null && val !== undefined && val !== "") hasData = true;
			}
			if (hasData) rows.push({ data: rowData, colorHex: findRowColorHex(sheetRow, headers.length) });
		}
		return { index, name: sheet.name, header: headers, rows, columnMapping: autoMapColumns(headers), colorMapping, totalRows: rows.length };
	});
	const selected = worksheets[0] ?? { index: 0, name: "Sheet 1", header: [], rows: [], columnMapping: {}, colorMapping: {}, totalRows: 0 };
	return { headers: selected.header, allRows: selected.rows, columnMapping: selected.columnMapping, colorMapping: selected.colorMapping, totalRows: selected.totalRows, worksheets };
}

export function parseCsvFileForImport(csvText: string): ParseForImportResult {
	const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
		header: true,
		skipEmptyLines: true,
	});

	if (errors.length > 0) {
		const criticalErrors = errors.filter((e) => e.type === "Quotes" || e.type === "Delimiter");
		if (criticalErrors.length > 0) {
			throw new Error(`CSV parsing failed: ${criticalErrors.map((e) => e.message).join(", ")}`);
		}
	}

	const headers = data.length > 0 ? Object.keys(data[0]) : [];
	const totalRows = data.length;
	const allRows: ParsedRowWithColor[] = data.map((row) => ({ data: row, colorHex: null }));

	const columnMapping = autoMapColumns(headers);
	return { headers, allRows, columnMapping, colorMapping: {}, totalRows, worksheets: [{ index: 0, name: "CSV", header: headers, rows: allRows, columnMapping, colorMapping: {}, totalRows }] };
}

interface ImportWorkerDeps {
	db: Database;
	boss: PgBoss;
}

const ISSUE_STATUSES = [
	"backlog",
	"in_progress",
	"in_qa",
	"verified",
	"rejected",
] as const;

export function isIssueStatus(
	value: string | null | undefined,
): value is IssueStatus {
	return ISSUE_STATUSES.includes(value as IssueStatus);
}

export function normalizeImportStatus(value: string | undefined | null): string | undefined {
	return value === "pending" ? "in_progress" : value ?? undefined;
}

export function normalizeImportSeverity(
	value: unknown,
): "low" | "medium" | "high" | "critical" {
	const normalized = String(value ?? "").trim().toLowerCase();
	return ["low", "medium", "high", "critical"].includes(normalized)
		? (normalized as "low" | "medium" | "high" | "critical")
		: "medium";
}

export function normalizeStatusAssigneeMapping(
	mapping: Record<string, string | string[]>,
): Record<string, string[]> {
	return Object.fromEntries(
		Object.entries(mapping).map(([status, assignees]) => [
			normalizeImportStatus(status),
			Array.isArray(assignees) ? assignees : [assignees],
		]),
	);
}

export function isExternalScreenshotUrl(value: unknown): value is string {
	if (typeof value !== "string") return false;
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}

export function resolveImportAssignments(input: {
	status: IssueStatus;
	statusAssigneeMapping?: Record<string, string[]>;
	defaultDeveloperAssigneeIds?: string[];
	defaultQaAssigneeIds: string[];
	mappedAssigneeId?: string;
	mappedQaAssigneeId?: string;
}): { developerAssigneeIds: string[]; qaAssigneeIds: string[] } {
	const {
		status,
		statusAssigneeMapping = {},
		defaultDeveloperAssigneeIds = [],
		defaultQaAssigneeIds,
		mappedAssigneeId,
		mappedQaAssigneeId,
	} = input;
	if (status === "rejected" || status === "verified") {
		return { developerAssigneeIds: [], qaAssigneeIds: [] };
	}

	const statusAssigneeIds = [...new Set(statusAssigneeMapping[status] ?? [])];
	if (status === "in_qa") {
		return {
			developerAssigneeIds: [],
			qaAssigneeIds:
				statusAssigneeIds.length > 0
					? statusAssigneeIds
					: mappedQaAssigneeId
						? [mappedQaAssigneeId]
					: [...new Set(defaultQaAssigneeIds)],
		};
	}

	return {
		developerAssigneeIds:
			statusAssigneeIds.length > 0
				? statusAssigneeIds
				: mappedAssigneeId
					? [mappedAssigneeId]
					: [...new Set(defaultDeveloperAssigneeIds)],
		qaAssigneeIds: [],
	};
}

export function validateMappedImportAssignments(input: {
	mappedAssigneeId?: string;
	mappedQaAssigneeId?: string;
	developerIds: ReadonlySet<string>;
	qaIds: ReadonlySet<string>;
}): void {
	const { mappedAssigneeId, mappedQaAssigneeId, developerIds, qaIds } = input;
	if (mappedAssigneeId && !developerIds.has(mappedAssigneeId)) {
		throw new Error("Mapped assignee must be a project developer");
	}
	if (mappedQaAssigneeId && !qaIds.has(mappedQaAssigneeId)) {
		throw new Error("Mapped QA assignee must be a project QA member");
	}
}

export function resolveRowStatus(input: {
	mappedStatus: string | null;
	colorHex: string | null;
	colorMapping?: Record<string, string>;
	defaultStatus?: string;
}): IssueStatus {
	const { mappedStatus, colorHex, colorMapping, defaultStatus } = input;
	const colorStatus = colorHex ? normalizeImportStatus(colorMapping?.[colorHex]) : undefined;
	if (isIssueStatus(colorStatus)) return colorStatus;
	const normalizedMappedStatus = normalizeImportStatus(mappedStatus);
	if (isIssueStatus(normalizedMappedStatus)) return normalizedMappedStatus;
	const normalizedDefaultStatus = normalizeImportStatus(defaultStatus);
	if (isIssueStatus(normalizedDefaultStatus)) return normalizedDefaultStatus;
	return "backlog";
}

async function markImportFailed(db: Database, importJobId: string, error: unknown) {
	await db
		.update(importJobs)
		.set({
			status: "failed",
			errorLog: [
				{ row: 0, error: error instanceof Error ? error.message : "Import failed" },
			],
		})
		.where(eq(importJobs.id, importJobId));
}

export function registerImportWorker(deps: ImportWorkerDeps) {
	const { db, boss } = deps;

	return boss.work("import-insert", async (jobs: Array<{ data: { importJobId: string; worksheetIndex?: number; columnMapping: Record<string, string>; colorMapping?: Record<string, string>; defaultStatus?: string; statusAssigneeMapping?: Record<string, string[]> } }>) => {
		for (const job of jobs) {
			const { importJobId, worksheetIndex = 0, columnMapping, colorMapping, defaultStatus, statusAssigneeMapping } = job.data;

			const [importJob] = await db
				.select()
				.from(importJobs)
				.where(eq(importJobs.id, importJobId))
				.limit(1);

			if (!importJob) continue;

			try {
				await db
					.update(importJobs)
					.set({ status: "processing" })
					.where(eq(importJobs.id, importJobId));

				const { rows } = readParsedRows(
					importJob.parsedRows as StoredParsedRows,
					worksheetIndex,
				);
				if (!rows || rows.length === 0) {
					throw new Error("No parsed rows found for import job");
				}

				let imported = 0;
				let failed = 0;
				const errors: Array<{ row: number; error: string }> = [];
				const seenTitles = new Set<string>();
				const normalizedAssignments = normalizeStatusAssigneeMapping(statusAssigneeMapping ?? {});
				const allMembers = await db
					.select({ userId: projectMember.userId, role: projectMember.role })
					.from(projectMember)
					.where(eq(projectMember.projectId, importJob.projectId));
				const devMembers = allMembers.filter((member) => member.role === "dev");
				const qaMembers = allMembers.filter((member) => member.role === "qa");
				const developerIds = new Set(devMembers.map((member) => member.userId));
				const qaIds = new Set(qaMembers.map((member) => member.userId));
				for (const [status, assigneeIds] of Object.entries(normalizedAssignments)) {
					const validIds = expectedRoleForStatus(status) === "qa" ? qaIds : developerIds;
					if (assigneeIds.some((userId) => !validIds.has(userId))) {
						throw new Error("Status assignee must have the matching project role");
					}
				}
				const defaultDeveloperAssigneeIds = allMembers.length === 1
					? [allMembers[0].userId]
					: devMembers.length === 1
						? [devMembers[0].userId]
						: [];
				const defaultQaAssigneeIds = qaMembers.map((member) => member.userId);

				for (let i = 0; i < rows.length; i++) {
					const { data: row, colorHex } = rows[i];
					const mapped: Record<string, unknown> = {};
					for (const [sourceCol, targetField] of Object.entries(columnMapping)) {
						if (targetField && row[sourceCol] !== undefined) {
							mapped[targetField] = row[sourceCol];
						}
					}

					const title = String(mapped.title ?? "").trim();
					if (!title) {
						failed++;
						errors.push({ row: i + 2, error: "Missing title" });
						continue;
					}
					const titleKey = title.toLowerCase();

					try {
						const inserted = await db.transaction(async (tx) => {
							const [existingIssue] = await tx
								.select({ id: issues.id })
								.from(issues)
								.where(
									and(
										eq(issues.projectId, importJob.projectId),
										sql`lower(${issues.title}) = lower(${title})`,
									),
								)
								.limit(1);
							if (existingIssue || seenTitles.has(titleKey)) return false;

							const [projectRow] = await tx
								.update(project)
								.set({ nextTicketNumber: sql`${project.nextTicketNumber} + 1` })
								.where(eq(project.id, importJob.projectId))
								.returning({
									nextTicketNumber: project.nextTicketNumber,
									slug: project.slug,
								});

							if (!projectRow) {
								throw new Error("Project not found");
							}

							const ticketRef = `${projectRow.slug.slice(0, 3).toUpperCase()}-${String(projectRow.nextTicketNumber).padStart(3, "0")}`;

							const severity = normalizeImportSeverity(mapped.severity);

							const status = resolveRowStatus({
								mappedStatus: mapped.status ? String(mapped.status).trim() : null,
								colorHex,
								colorMapping,
								defaultStatus,
							});

							const mappedAssigneeId = mapped.assigneeId ? String(mapped.assigneeId) : undefined;
							const mappedQaAssigneeId = mapped.qaAssigneeId ? String(mapped.qaAssigneeId) : undefined;
							validateMappedImportAssignments({
								mappedAssigneeId,
								mappedQaAssigneeId,
								developerIds,
								qaIds,
							});
							const assignments = resolveImportAssignments({
								status,
								statusAssigneeMapping: normalizedAssignments,
								defaultDeveloperAssigneeIds,
								defaultQaAssigneeIds,
								mappedAssigneeId,
								mappedQaAssigneeId,
							});
							const [issue] = await tx
								.insert(issues)
								.values({
									projectId: importJob.projectId,
									importJobId,
									reporterId: importJob.createdBy,
									ticketRef,
									title,
									description: mapped.description ? String(mapped.description) : undefined,
									severity,
									status,
									assigneeId: assignments.developerAssigneeIds[0] ?? null,
									qaAssigneeId: assignments.qaAssigneeIds[0] ?? null,
									imageUrl: isExternalScreenshotUrl(mapped.imageUrl) ? mapped.imageUrl : null,
									environment: mapped.environment ? { browser: String(mapped.environment) } : undefined,
									stepsToReproduce: mapped.stepsToReproduce ? String(mapped.stepsToReproduce) : undefined,
									expectedResult: mapped.expectedResult ? String(mapped.expectedResult) : undefined,
									actualResult: mapped.actualResult ? String(mapped.actualResult) : undefined,
								})
								.returning();

							const assignmentRows = [
								...assignments.developerAssigneeIds.map((userId) => ({ issueId: issue.id, userId, role: "dev" as const })),
								...assignments.qaAssigneeIds.map((userId) => ({ issueId: issue.id, userId, role: "qa" as const })),
							];
							if (assignmentRows.length > 0) await tx.insert(issueAssignments).values(assignmentRows);

							await tx.insert(issueStatusHistory).values({
								issueId: issue.id,
								changedBy: importJob.createdBy,
								fromStatus: null,
								toStatus: status,
								source: "import",
							});
							return true;
						});

						if (inserted) {
							seenTitles.add(titleKey);
							imported++;
						}
					} catch (err) {
						console.error("Import row failed", err);
						failed++;
						errors.push({ row: i + 2, error: err instanceof Error ? err.message : "Unknown error" });
					}
				}

				await db
					.update(importJobs)
					.set({
						status: "completed",
						importedRows: imported,
						failedRows: failed,
						errorLog: errors.length > 0 ? errors : null,
						parsedRows: null,
						completedAt: new Date(),
					})
					.where(eq(importJobs.id, importJobId));
			} catch (err) {
				console.error("Import job failed", err);
				try {
					await markImportFailed(db, importJobId, err);
				} catch (markFailedError) {
					console.error("Failed to mark import job as failed", markFailedError);
				}
			}
		}
	});
}
