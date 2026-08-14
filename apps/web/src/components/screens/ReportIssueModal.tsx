import type { FormEvent } from "react";
import { FormField } from "@/components/app/FormField";
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
	onClose?: () => void;
	onSubmit?: (values: ReportValues) => void;
}

export interface ReportValues {
	title: string;
	severity: Severity;
	environment: string;
	steps: string;
	testCaseRef?: string;
}

export function ReportIssueModal({ open, onClose, onSubmit }: ReportIssueModalProps) {
	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		onSubmit?.({
			title: String(data.get("title") ?? ""),
			severity: (data.get("severity") as Severity) ?? "medium",
			environment: String(data.get("environment") ?? ""),
			steps: String(data.get("steps") ?? ""),
			testCaseRef: String(data.get("testCaseRef") ?? "") || undefined,
		});
	}

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.(); }}>
			<DialogContent className="w-full max-w-[560px] gap-0 overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,0.4)] sm:max-w-[560px]">
				<DialogHeader className="border-b border-[var(--line)] px-6 py-4 pr-14">
					<DialogTitle className="font-[var(--mono)] text-base font-semibold">Report an Issue</DialogTitle>
					<DialogDescription className="sr-only">Create a fixture-backed issue in this project.</DialogDescription>
				</DialogHeader>
				<form className="flex flex-col gap-5 p-6" onSubmit={handleSubmit}>
					<FormField label="Title" htmlFor="report-title-input" required>
						<input
							id="report-title-input"
							name="title"
							required
							placeholder="What went wrong?"
							className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
						/>
					</FormField>
					<div className="grid gap-4 sm:grid-cols-2">
						<FormField label="Severity" htmlFor="report-severity">
							<select
								id="report-severity"
								name="severity"
								defaultValue="medium"
								className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
							>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
								<option value="critical">Critical</option>
							</select>
						</FormField>
						<FormField label="Environment" htmlFor="report-environment">
							<input
								id="report-environment"
								name="environment"
								placeholder="Chrome / macOS / Desktop"
								className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
							/>
						</FormField>
					</div>
					<FormField
						label="Steps to reproduce"
						htmlFor="report-steps"
						hint="One step per line."
					>
						<textarea
							id="report-steps"
							name="steps"
							rows={4}
							placeholder={"1. Open the page\n2. Tap submit\n3. Nothing happens"}
							className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 font-[var(--mono)] text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
						/>
					</FormField>
					<FormField
						label="Link test case (optional)"
						htmlFor="report-testcase"
						hint="Search by test case reference."
					>
						<input
							id="report-testcase"
							name="testCaseRef"
							placeholder="TC-118"
							className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 font-[var(--mono)] text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
						/>
					</FormField>
					<div className="flex justify-end gap-3 border-t border-[var(--line)] pt-5">
						<button
							type="button"
							onClick={onClose}
							className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--bg-alt)]"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
						>
							Create Issue
						</button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
