import { createRoute, useNavigate } from "@tanstack/react-router";
import { ImportUpload } from "@/components/screens/ImportUpload";
import { ImportProgress } from "@/components/screens/ImportProgress";
import { ImportMapping } from "@/components/screens/ImportMapping";
import { ImportComplete } from "@/components/screens/ImportComplete";
import { useEffect, useState } from "react";
import { importColumns, importErrors, importRowColors } from "@/lib/veridex-fixtures";
import { useDemoStore } from "@/stores/demo-store";
import type { IssueStatus } from "@/lib/veridex-types";
import { rootRoute } from "@/routes/__root";

type ImportStep = "upload" | "progress" | "mapping" | "complete";

export const ProjectImportRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/projects/$projectId/import",
	component: ProjectImportView,
});

function ProjectImportView() {
	const { projectId } = ProjectImportRoute.useParams();
	const navigate = useNavigate();
	const importDemoIssues = useDemoStore((state) => state.importDemoIssues);
	const [step, setStep] = useState<ImportStep>("upload");
	const [fileName, setFileName] = useState("");
	const [progress, setProgress] = useState(0);
	const [importedCount, setImportedCount] = useState(0);
	const [importError, setImportError] = useState<string>();
	const [columnMappings, setColumnMappings] = useState(() =>
		importColumns.map((column) => ({ ...column })),
	);
	const [rowColorMappings, setRowColorMappings] = useState(() =>
		importRowColors.map((color) => ({ ...color })),
	);
	const [defaultStatus, setDefaultStatus] = useState<IssueStatus>("backlog");
	const isCsv = fileName.toLowerCase().endsWith(".csv");

	useEffect(() => {
		if (step !== "progress") return;

		setProgress(18);
		const previewTimer = window.setTimeout(() => setProgress(62), 200);
		const readyTimer = window.setTimeout(() => setProgress(100), 450);
		const mappingTimer = window.setTimeout(() => setStep("mapping"), 650);

		return () => {
			window.clearTimeout(previewTimer);
			window.clearTimeout(readyTimer);
			window.clearTimeout(mappingTimer);
		};
	}, [step]);

	function returnToUpload() {
		setStep("upload");
		setFileName("");
		setProgress(0);
		setImportError(undefined);
	}

	function confirmImport() {
		setImportError(undefined);
		const result = importDemoIssues(projectId, {
			fileName,
			targetStatuses: isCsv
				? [defaultStatus]
				: rowColorMappings.map((mapping) => mapping.targetStatus),
		});
		if (!result.ok) {
			setImportError(result.error);
			return;
		}

		setImportedCount(result.value.length);
		setStep("complete");
	}

	return (
		<>
			{step === "upload" ? (
				<ImportUpload
					onFile={(file) => {
						setFileName(file.name);
						setProgress(0);
						setImportError(undefined);
						setStep("progress");
					}}
				/>
			) : step === "progress" ? (
				<ImportProgress
					fileName={fileName}
					progress={progress}
					stage={isCsv ? "Preparing CSV demo preview..." : "Preparing spreadsheet demo preview..."}
					onCancel={returnToUpload}
				/>
			) : step === "mapping" ? (
				<ImportMapping
					columns={columnMappings}
					rowColors={rowColorMappings}
					isCsv={isCsv}
					defaultStatus={defaultStatus}
					error={importError}
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
			) : (
				<ImportComplete
					importedCount={importedCount}
					failedCount={importErrors.length}
					errors={importErrors}
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
