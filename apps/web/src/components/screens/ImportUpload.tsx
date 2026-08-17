import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";

interface ImportUploadProps {
	onFile?: (file: File) => void;
}

export function ImportUpload({ onFile }: ImportUploadProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [error, setError] = useState<string>();

	function handleFiles(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;

		const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
		if (extension !== ".csv" && extension !== ".xlsx") {
			setError("Choose a .csv or .xlsx file.");
			return;
		}

		setError(undefined);
		onFile?.(file);
	}

	return (
		<div>
			<PageHeader title="Import Issues" />
			<div
				aria-describedby={error ? "import-file-error import-file-help" : "import-file-help"}
				onDragOver={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragging(false);
					handleFiles(e.dataTransfer.files);
				}}
				className={`flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed px-8 py-20 text-center transition-colors duration-150 ${
					dragging ? "border-[var(--accent)] bg-[var(--accent-bg)]" : "border-[var(--line)]"
				}`}
			>
				<UploadCloud
					className="size-10 text-[var(--ink-soft)]"
					aria-hidden="true"
					strokeWidth={1.5}
				/>
				<p className="text-base font-semibold text-[var(--ink)]">
					Drop your .xlsx or .csv file here
				</p>
				<p className="text-sm text-[var(--ink-soft)]">or</p>
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
				>
					Browse files
				</button>
				<input
					id="import-file"
					ref={inputRef}
					type="file"
					accept=".xlsx,.csv"
					className="sr-only"
					onChange={(e) => {
						handleFiles(e.target.files);
						e.currentTarget.value = "";
					}}
				/>
			</div>
			{error ? (
				<p
					id="import-file-error"
					role="alert"
					className="mt-3 text-center text-sm font-medium text-[var(--block)]"
				>
					{error}
				</p>
			) : null}
			<p id="import-file-help" className="mt-4 text-center text-xs text-[var(--ink-soft)]">
				Creates a demo preview using fixture columns and issues. CSV files use a default status;
				Excel files preview row-color mappings.
			</p>
		</div>
	);
}
