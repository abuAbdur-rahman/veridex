import type { FormEvent } from "react";
import { FormField } from "@/components/app/FormField";
import type { IssueEnvironment } from "@/api/issues";
import type { Severity } from "@/lib/veridex-types";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ReportIssueModalProps {
	open: boolean;
	pending?: boolean;
	error?: string;
	onClose?: () => void;
	onSubmit?: (values: ReportValues) => void | Promise<void>;
}
export interface ReportValues {
	title: string;
	description?: string;
	severity: Severity;
	environment?: IssueEnvironment;
	stepsToReproduce?: string;
}

export function ReportIssueModal({
	open,
	pending = false,
	error,
	onClose,
	onSubmit,
}: ReportIssueModalProps) {
	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const browser = String(data.get("browser") ?? "").trim();
		const os = String(data.get("os") ?? "").trim();
		const page = String(data.get("page") ?? "").trim();
		void onSubmit?.({
			title: String(data.get("title") ?? "").trim(),
			description: String(data.get("description") ?? "").trim() || undefined,
			severity: String(data.get("severity") ?? "medium") as Severity,
			environment:
				browser || os || page
					? { browser: browser || undefined, os: os || undefined, page: page || undefined }
					: undefined,
			stepsToReproduce: String(data.get("steps") ?? "").trim() || undefined,
		});
	}
	const inputClass =
		"w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]";
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next && !pending) onClose?.();
			}}
		>
			<DialogContent className="w-full max-w-[560px] gap-0 overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] sm:max-w-[560px]">
				<DialogHeader className="border-b border-[var(--line)] px-6 py-4 pr-14">
					<DialogTitle className="font-[var(--mono)] text-base font-semibold">
						Report an Issue
					</DialogTitle>
					<DialogDescription className="sr-only">
						Create an issue in this project.
					</DialogDescription>
				</DialogHeader>
				<form className="flex flex-col gap-5 p-6" onSubmit={handleSubmit}>
					{error ? (
						<p
							role="alert"
							className="rounded-md border border-[var(--block)] bg-[var(--block-bg)] px-3 py-2 text-sm text-[var(--block)]"
						>
							{error}
						</p>
					) : null}
					<FormField label="Title" htmlFor="report-title-input" required>
						<input
							id="report-title-input"
							name="title"
							required
							maxLength={200}
							placeholder="What went wrong?"
							className={inputClass}
						/>
					</FormField>
					<FormField label="Description" htmlFor="report-description">
						<textarea
							id="report-description"
							name="description"
							rows={3}
							placeholder="Describe the observed problem"
							className={inputClass}
						/>
					</FormField>
					<div className="grid gap-4 sm:grid-cols-2">
						<FormField label="Severity" htmlFor="report-severity">
							<select
								id="report-severity"
								name="severity"
								defaultValue="medium"
								className={inputClass}
							>
								{["low", "medium", "high", "critical"].map((value) => (
									<option key={value}>{value}</option>
								))}
							</select>
						</FormField>
						<FormField label="Page" htmlFor="report-page">
							<input id="report-page" name="page" placeholder="/checkout" className={inputClass} />
						</FormField>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<FormField label="Browser" htmlFor="report-browser">
							<input
								id="report-browser"
								name="browser"
								placeholder="Chrome 126"
								className={inputClass}
							/>
						</FormField>
						<FormField label="Operating system" htmlFor="report-os">
							<input id="report-os" name="os" placeholder="macOS 15" className={inputClass} />
						</FormField>
					</div>
					<FormField label="Steps to reproduce" htmlFor="report-steps" hint="One step per line.">
						<textarea
							id="report-steps"
							name="steps"
							rows={4}
							placeholder={"Open the page\nSubmit the form\nObserve the error"}
							className={`${inputClass} font-[var(--mono)]`}
						/>
					</FormField>
					<div className="flex justify-end gap-3 border-t border-[var(--line)] pt-5">
						<button
							type="button"
							disabled={pending}
							onClick={onClose}
							className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--line)] px-4 text-sm font-semibold disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={pending}
							className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
						>
							{pending ? "Creating..." : "Create Issue"}
						</button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
