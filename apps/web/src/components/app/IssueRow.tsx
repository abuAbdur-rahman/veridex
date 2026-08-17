import type { ReactNode } from "react";
import type { Issue } from "@/lib/veridex-types";
import { StatusPill } from "@/components/app/StatusPill";
import { SeverityDot } from "@/components/app/severity";
import { Avatar } from "@/components/app/Avatar";

interface IssueRowProps {
	issue: Issue;
	trailing?: ReactNode;
	onClick?: () => void;
}

export function IssueRow({ issue, trailing, onClick }: IssueRowProps) {
	return (
		<tr className={cnRow()}>
			<td className="py-3 pl-4">
				<div className="flex items-center gap-2.5">
					<SeverityDot severity={issue.severity} />
					{onClick ? (
						<button
							type="button"
							onClick={onClick}
							className="font-[var(--mono)] text-xs text-[var(--accent-strong)] underline-offset-4 hover:underline"
						>
							{issue.ticketRef}
						</button>
					) : (
						<span className="font-[var(--mono)] text-xs text-[var(--ink-soft)]">
							{issue.ticketRef}
						</span>
					)}
				</div>
			</td>
			<td className="max-w-[420px] px-3 py-3">
				<p className="truncate text-[13px] leading-[1.4] text-[var(--ink)]">{issue.title}</p>
			</td>
			<td className="px-3 py-3">
				<StatusPill status={issue.status} />
			</td>
			<td className="hidden px-3 py-3 lg:table-cell">
				{issue.assignee ? (
					<div className="flex items-center gap-2">
						<Avatar
							initials={issue.assignee.initials}
							gradient={issue.assignee.gradient}
							name={issue.assignee.name}
							className="size-5 text-[9px]"
						/>
						<span className="text-xs text-[var(--ink-soft)]">{issue.assignee.name}</span>
					</div>
				) : (
					<span className="text-xs text-[var(--ink-soft)]">Unassigned</span>
				)}
			</td>
			<td className="py-3 pl-3 pr-4 text-right">{trailing}</td>
		</tr>
	);
}

function cnRow() {
	return "border-b border-[var(--line-soft)] transition-colors duration-150 hover:bg-[var(--bg-alt)]";
}
