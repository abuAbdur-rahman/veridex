import { createRoute, useNavigate } from "@tanstack/react-router";
import { ImportUpload } from "@/components/screens/ImportUpload";
import { ImportProgress } from "@/components/screens/ImportProgress";
import { ImportMapping } from "@/components/screens/ImportMapping";
import { ImportComplete } from "@/components/screens/ImportComplete";
import { useEffect, useState } from "react";
import type { IssueStatus } from "@/lib/veridex-types";
import { rootRoute } from "@/routes/__root";
import {
	useUploadSpreadsheet,
	useImportPreview,
	useConfirmImport,
	useImportErrors,
} from "@/queries/import";
import { useProjectMembers } from "@/queries/projects";

type ImportStep = "upload" | "progress" | "mapping" | "importing" | "complete";

export const ProjectImportRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/projects/$projectId/import",
	component: ProjectImportView,
});

function ProjectImportView() {
	const { projectId } = ProjectImportRoute.useParams();
	const navigate = useNavigate();
	const [step, setStep] = useState<ImportStep>("upload");
	const [importJobId, setImportJobId] = useState<string>("");
	const [fileName, setFileName] = useState("");
	const [progress, setProgress] = useState(0);
	const [importedCount, setImportedCount] = useState(0);
	const [importError, setImportError] = useState<string>();
	const [columnMappings, setColumnMappings] = useState<
		Array<{ spreadsheetColumn: string; targetField: string }>
	>([]);
	const [rowColorMappings, setRowColorMappings] = useState<
		Array<{ color: string; hex: string; rows: number; targetStatus: IssueStatus }>
	>([]);
	const [defaultStatus, setDefaultStatus] = useState<IssueStatus>("backlog");
	const [worksheetIndex, setWorksheetIndex] = useState(0);
	const [statusAssigneeMapping, setStatusAssigneeMapping] = useState<Record<string, string[]>>({});

	const uploadMutation = useUploadSpreadsheet(projectId);
	const previewQuery = useImportPreview(projectId, importJobId, step === "progress" || step === "mapping", worksheetIndex);
	const membersQuery = useProjectMembers(projectId);
	const confirmMutation = useConfirmImport(projectId);
	const errorsQuery = useImportErrors(projectId, importJobId, step === "importing" || step === "complete");

	const isCsv = fileName.toLowerCase().endsWith(".csv");

	useEffect(() => {
		if (step !== "progress") return;

		setProgress(18);
		const timer = window.setTimeout(() => setProgress(35), 200);
		return () => window.clearTimeout(timer);
	}, [step]);

	useEffect(() => {
		if ((step !== "progress" && step !== "mapping") || !previewQuery.isError) return;
		setImportError(previewQuery.error instanceof Error ? previewQuery.error.message : "Import preview failed");
		setStep("upload");
	}, [step, previewQuery.isError, previewQuery.error]);

	useEffect(() => {
		if ((step !== "progress" && step !== "mapping") || !previewQuery.data) return;

		if (previewQuery.data.status === "failed") {
			setImportError(previewQuery.data.error ?? "Import parsing failed");
			setStep("upload");
			return;
		}
		if (previewQuery.data.status === "pending" || previewQuery.data.status === "processing") return;

		if (previewQuery.data.selectedWorksheetIndex !== worksheetIndex) return;

		const preview = previewQuery.data;
		const applyPreviewMappings = () => {
			setColumnMappings(preview.headers.map((header) => ({
				spreadsheetColumn: header,
				targetField: preview.columnMapping?.[header] ?? "",
			})));
			setRowColorMappings(
				Object.entries(preview.colorMapping ?? {}).map(([hex, status]) => ({
					color: hex,
					hex: `#${hex}`,
					rows: preview.colorCounts[hex] ?? 0,
					targetStatus: status as IssueStatus,
				})),
			);
		};

		if (step === "mapping") {
			applyPreviewMappings();
			return;
		}

		setProgress(100);
		const timer = window.setTimeout(() => {
			applyPreviewMappings();
			setStep("mapping");
		}, 400);

		return () => window.clearTimeout(timer);
	}, [step, previewQuery.data, worksheetIndex]);

	useEffect(() => {
		if (step !== "importing" || !errorsQuery.data) return;
		if (errorsQuery.data.status === "failed") {
			setImportError(errorsQuery.data.errors?.[0]?.error ?? "Import failed");
			setStep("mapping");
			return;
		}
		if (errorsQuery.data.status !== "completed") return;
		setImportedCount(errorsQuery.data.importedRows);
		setStep("complete");
	}, [step, errorsQuery.data]);

	function returnToUpload() {
		setStep("upload");
		setImportJobId("");
		setFileName("");
		setProgress(0);
		setImportError(undefined);
		setColumnMappings([]);
		setRowColorMappings([]);
		setWorksheetIndex(0);
		setStatusAssigneeMapping({});
	}

	async function handleFile(file: File) {
		setFileName(file.name);
		setProgress(0);
		setImportError(undefined);
		setStep("progress");

		try {
			const result = await uploadMutation.mutateAsync(file);
			setImportJobId(result.importJobId);
		} catch (err) {
			setImportError(err instanceof Error ? err.message : "Upload failed");
			setStep("upload");
		}
	}

	async function confirmImport() {
		setImportError(undefined);

		const columnMapping: Record<string, string> = {};
		for (const col of columnMappings) {
			if (col.targetField) {
				columnMapping[col.spreadsheetColumn] = col.targetField;
			}
		}

		const colorMapping: Record<string, string> = {};
		for (const color of rowColorMappings) {
			const hex = color.hex.startsWith("#") ? color.hex.slice(1) : color.hex;
			colorMapping[hex] = color.targetStatus;
		}

		try {
			await confirmMutation.mutateAsync({
				importJobId,
				columnMapping,
				colorMapping: Object.keys(colorMapping).length > 0 ? colorMapping : undefined,
				defaultStatus,
				worksheetIndex,
				statusAssigneeMapping: Object.keys(statusAssigneeMapping).length > 0 ? statusAssigneeMapping : undefined,
			});
			setStep("importing");
		} catch (err) {
			setImportError(err instanceof Error ? err.message : "Import failed");
		}
	}

	const errors = errorsQuery.data?.errors
		? errorsQuery.data.errors.map((e) => ({ row: e.row, message: e.error }))
		: [];

	return (
		<>
			{step === "upload" ? (
				<ImportUpload onFile={handleFile} error={importError} />
			) : step === "progress" ? (
				<ImportProgress
					fileName={fileName}
					progress={progress}
					stage={isCsv ? "Parsing CSV file..." : "Parsing spreadsheet..."}
					onCancel={returnToUpload}
				/>
			) : step === "mapping" ? (
				<ImportMapping
					columns={columnMappings}
					rowColors={rowColorMappings}
					isCsv={isCsv}
					defaultStatus={defaultStatus}
					error={importError}
					sampleRows={previewQuery.data?.sampleRows}
					worksheets={previewQuery.data?.worksheets}
					selectedWorksheetIndex={worksheetIndex}
					members={membersQuery.data}
					statusAssigneeMapping={statusAssigneeMapping}
					onWorksheetChange={(index) => { setWorksheetIndex(index); setColumnMappings([]); setRowColorMappings([]); }}
					onStatusAssigneeChange={(status, userId) => setStatusAssigneeMapping((current) => { const next = { ...current }; if (userId) next[status] = [userId]; else delete next[status]; return next; })}
					onColumnChange={(index, targetField) => {
						setColumnMappings((current) =>
							current.map((column, columnIndex) =>
								columnIndex === index ? { ...column, targetField } : column,
							),
						);
					}}
					onRowColorChange={(index, targetStatus) => {
						setRowColorMappings((current) =>
							current.map((color, colorIndex) =>
								colorIndex === index ? { ...color, targetStatus } : color,
							),
						);
					}}
					onDefaultStatusChange={setDefaultStatus}
					onCancel={returnToUpload}
					onConfirm={confirmImport}
				/>
			) : step === "importing" ? (
				<ImportProgress
					fileName={fileName}
					progress={errorsQuery.data?.status === "processing" ? 75 : 50}
					stage="Importing issues..."
					onCancel={returnToUpload}
				/>
			) : (
				<ImportComplete
					importedCount={importedCount}
					failedCount={errors.length}
					errors={errors}
					onRestart={returnToUpload}
					onViewBoard={() =>
						navigate({
							to: "/projects/$projectId",
							params: { projectId },
						})
					}
				/>
			)}
		</>
	);
}
