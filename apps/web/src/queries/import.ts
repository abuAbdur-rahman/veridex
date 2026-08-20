import { useMutation, useQuery } from "@tanstack/react-query";
import {
	uploadSpreadsheet,
	getImportPreview,
	confirmImport,
	getImportErrors,
} from "@/api/import";

export const importPreviewQueryKey = (
	projectId: string,
	importJobId: string,
	worksheetIndex = 0,
) => ["import", projectId, importJobId, "preview", worksheetIndex] as const;

export const importErrorsQueryKey = (
	projectId: string,
	importJobId: string,
) => ["import", projectId, importJobId, "errors"] as const;

export function useUploadSpreadsheet(projectId: string) {
	return useMutation({
		mutationFn: (file: File) => uploadSpreadsheet(projectId, file),
	});
}

export function useImportPreview(
	projectId: string,
	importJobId: string,
	enabled = true,
	worksheetIndex = 0,
) {
	return useQuery({
		queryKey: importPreviewQueryKey(projectId, importJobId, worksheetIndex),
		queryFn: () => getImportPreview(projectId, importJobId, worksheetIndex),
		enabled: enabled && Boolean(projectId) && Boolean(importJobId),
		refetchInterval: (query) => {
			const data = query.state.data;
			if (!data) return 1000;
			return false;
		},
	});
}

export function useConfirmImport(projectId: string) {
	return useMutation({
		mutationFn: ({
			importJobId,
			columnMapping,
			colorMapping,
			defaultStatus,
			worksheetIndex,
			statusAssigneeMapping,
		}: {
			importJobId: string;
			columnMapping: Record<string, string>;
			colorMapping?: Record<string, string>;
			defaultStatus?: string;
			worksheetIndex: number;
			statusAssigneeMapping?: Record<string, string[]>;
		}) => confirmImport(projectId, importJobId, columnMapping, colorMapping, defaultStatus, worksheetIndex, statusAssigneeMapping),
	});
}

export function useImportErrors(
	projectId: string,
	importJobId: string,
	enabled = true,
) {
	return useQuery({
		queryKey: importErrorsQueryKey(projectId, importJobId),
		queryFn: () => getImportErrors(projectId, importJobId),
		enabled: enabled && Boolean(projectId) && Boolean(importJobId),
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (status === "processing" || status === "pending") return 1000;
			return false;
		},
	});
}
