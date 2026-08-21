import { apiRequest, isRecord } from "@/api/client";

export interface ImportJob {
	importJobId: string;
}

export interface ImportPreview {
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

export interface ImportErrors {
	importJobId: string;
	status: string;
	totalRows: number | null;
	importedRows: number;
	failedRows: number;
	errors: Array<{ row: number; error: string }> | null;
}

function isImportJob(value: unknown): value is ImportJob {
	return isRecord(value) && typeof value.importJobId === "string";
}

function isImportPreview(value: unknown): value is ImportPreview {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.fileType === "string" &&
		typeof value.originalName === "string" &&
		(value.totalRows === null || typeof value.totalRows === "number") &&
		Array.isArray(value.headers) &&
		Array.isArray(value.sampleRows) &&
		(value.columnMapping === null || isRecord(value.columnMapping)) &&
		(value.colorMapping === null || isRecord(value.colorMapping)) &&
		isRecord(value.colorCounts) &&
		Object.values(value.colorCounts).every((count) => typeof count === "number") &&
		typeof value.status === "string" &&
		(value.error === null || typeof value.error === "string")
		&& Array.isArray(value.worksheets)
		&& value.worksheets.every((sheet) => isRecord(sheet) && typeof sheet.index === "number" && typeof sheet.name === "string" && typeof sheet.totalRows === "number")
		&& typeof value.selectedWorksheetIndex === "number"
	);
}

function isImportErrors(value: unknown): value is ImportErrors {
	return (
		isRecord(value) &&
		typeof value.importJobId === "string" &&
		typeof value.status === "string" &&
		(value.totalRows === null || typeof value.totalRows === "number") &&
		typeof value.importedRows === "number" &&
		typeof value.failedRows === "number" &&
		(value.errors === null ||
			(Array.isArray(value.errors) &&
				value.errors.every(
					(e: unknown) =>
						isRecord(e) &&
						typeof e.row === "number" &&
						typeof e.error === "string",
				)))
	);
}

export function uploadSpreadsheet(
	projectId: string,
	file: File,
): Promise<ImportJob> {
	const formData = new FormData();
	formData.append("file", file);
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/import/upload`,
		isImportJob,
		{ method: "POST", body: formData },
	);
}

export function getImportPreview(
	projectId: string,
	importJobId: string,
	worksheetIndex = 0,
): Promise<ImportPreview> {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/import/${encodeURIComponent(importJobId)}/preview?worksheetIndex=${worksheetIndex}`,
		isImportPreview,
	);
}

export function confirmImport(
	projectId: string,
	importJobId: string,
	columnMapping: Record<string, string>,
	colorMapping?: Record<string, string>,
	defaultStatus?: string,
	worksheetIndex = 0,
	statusAssigneeMapping?: Record<string, string[]>,
): Promise<ImportJob> {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/import/${encodeURIComponent(importJobId)}/confirm`,
		isImportJob,
		{
			method: "PATCH",
			body: JSON.stringify({ columnMapping, colorMapping, defaultStatus, worksheetIndex, statusAssigneeMapping }),
		},
	);
}

export function getImportErrors(
	projectId: string,
	importJobId: string,
): Promise<ImportErrors> {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/import/${encodeURIComponent(importJobId)}/errors`,
		isImportErrors,
	);
}
