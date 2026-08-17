import { ArrowLeft, Plus, RotateCcw } from "lucide-react";
import type { Issue } from "@/lib/veridex-types";
import { IssueRow } from "@/components/app/IssueRow";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionLabel } from "@/components/app/FormField";

interface TesterViewScreenProps {
	retestIssues: Issue[];
	recentIssues: Issue[];
	onReport?: () => void;
	onOpenIssue?: (issue: Issue) => void;
}

export function TesterViewScreen({
	retestIssues,
	recentIssues,
	onReport,
	onOpenIssue,
}: TesterViewScreenProps) {
	return (
		<div className="flex flex-col gap-8">
			<PageHeader
				title="My Testing"
				actions={
					<button
						type="button"
						onClick={onReport}
						className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent)] px-3.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
					>
						<Plus className="size-4" aria-hidden="true" strokeWidth={1.5} />
						Report Issue
					</button>
				}
			/>

			<section aria-label="Needs retest">
				<SectionLabel>
					<RotateCcw className="size-3.5" aria-hidden="true" strokeWidth={1.5} />
					Needs Retest ({retestIssues.length})
				</SectionLabel>
				{retestIssues.length === 0 ? (
					<EmptyState
						icon={RotateCcw}
						title="Nothing needs retesting"
						description="Issues QA sends back to the dev team appear here."
					/>
				) : (
					<div className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
						<table className="w-full border-collapse">
							<tbody>
								{retestIssues.map((issue) => (
									<IssueRow
										key={issue.id}
										issue={issue}
										onClick={onOpenIssue ? () => onOpenIssue(issue) : undefined}
									/>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<section aria-label="Recent reports">
				<SectionLabel>
					<ArrowLeft className="size-3.5" aria-hidden="true" strokeWidth={1.5} />
					Your Recent Reports ({recentIssues.length})
				</SectionLabel>
				<div className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
					<table className="w-full border-collapse">
						<tbody>
							{recentIssues.map((issue) => (
								<IssueRow
									key={issue.id}
									issue={issue}
									onClick={onOpenIssue ? () => onOpenIssue(issue) : undefined}
								/>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
