import { Check, Radar, RotateCcw } from "lucide-react";
import type { Issue } from "@/lib/veridex-types";
import { IssueRow } from "@/components/app/IssueRow";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";

interface QaTriageScreenProps {
	issues: Issue[];
	onQuickVerify?: (issue: Issue) => void;
	onReject?: (issue: Issue, note: string) => void;
	onOpenIssue?: (issue: Issue) => void;
}

export function QaTriageScreen({ issues, onQuickVerify, onReject, onOpenIssue }: QaTriageScreenProps) {
	const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
	const sortedIssues = issues.toSorted((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
	if (issues.length === 0) {
		return (
			<>
				<PageHeader title="Awaiting QA" count="0" />
				<EmptyState
					icon={Radar}
					title="Nothing awaiting verification"
					description="Nice work. New issues land here when they enter QA."
				/>
			</>
		);
	}
	return (
		<>
			<PageHeader title="Awaiting QA" count={String(issues.length)} />
			<div className="overflow-x-auto rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
				<table className="w-full border-collapse">
					<thead>
						<tr className="border-b border-[var(--line)] text-left font-[var(--mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--ink-soft)]">
							<th scope="col" className="px-4 py-2.5 font-medium">
								Ref
							</th>
							<th scope="col" className="px-3 py-2.5 font-medium">
								Title
							</th>
							<th scope="col" className="px-3 py-2.5 font-medium">
								Status
							</th>
							<th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">
								Assignee
							</th>
							<th scope="col" className="px-3 py-2.5 text-right font-medium">
								<span className="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{sortedIssues.map((issue) => (
							<IssueRow
								key={issue.id}
								issue={issue}
								onClick={onOpenIssue ? () => onOpenIssue(issue) : undefined}
								trailing={
									<QaActions issue={issue} onQuickVerify={onQuickVerify} onReject={onReject} />
								}
							/>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}

function QaActions({ issue, onQuickVerify, onReject }: { issue: Issue; onQuickVerify?: (issue: Issue) => void; onReject?: (issue: Issue, note: string) => void }) {
	return (
		<div className="flex items-center justify-end gap-2">
			<button
				type="button"
				onClick={onQuickVerify ? () => onQuickVerify(issue) : undefined}
				disabled={!onQuickVerify}
				className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--ink)] transition-colors duration-150 hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
			>
				<Check className="size-3" aria-hidden="true" strokeWidth={1.5} />
				Verify
			</button>
			<button type="button" disabled={!onReject} onClick={() => {
				const note = window.prompt("What still needs work?");
				if (note?.trim()) onReject?.(issue, note);
			}} className="inline-flex min-h-8 items-center gap-1.5 rounded-[6px] border border-[var(--line)] px-2.5 text-xs font-semibold text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--ink)] disabled:opacity-40">
				<RotateCcw className="size-3" aria-hidden="true" /> Send back
			</button>
		</div>
	);
}
