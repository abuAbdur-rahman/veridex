import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Issue, IssueStatus } from "@/lib/veridex-types";
import { KanbanCard } from "@/components/app/KanbanCard";

interface KanbanColumnProps {
	status: IssueStatus;
	title: string;
	issues: Issue[];
	count: number;
	accent?: boolean;
	onOpenIssue?: (issue: Issue) => void;
	onMoveIssue?: (issue: Issue, status: IssueStatus) => void;
	dropDisabled?: boolean;
	children?: ReactNode;
}

export function KanbanColumn({
	status,
	title,
	issues,
	count,
	accent,
	onOpenIssue,
	onMoveIssue,
	dropDisabled,
	children,
}: KanbanColumnProps) {
	const { isOver, setNodeRef } = useDroppable({
		id: status,
		data: { status },
		disabled: dropDisabled,
	});
	return (
		<section
			ref={setNodeRef}
			aria-label={`${title} column`}
			className={`flex w-[320px] shrink-0 flex-col gap-3 rounded-[10px] border bg-[var(--bg-alt)] p-3 transition-colors ${isOver ? "border-[var(--accent)] bg-[var(--accent-bg)]" : dropDisabled ? "border-[var(--line)] opacity-45" : "border-[var(--line)]"}`}
		>
			<header className="flex items-center justify-between px-1">
				<h3 className="font-[var(--mono)] text-xs font-semibold uppercase tracking-[0.02em] text-[var(--ink-soft)]">
					{title}
				</h3>
				<span className={cnCount(accent)} title={`${count} issues`}>
					{count}
				</span>
			</header>
			{children}
			<div className="flex flex-col gap-3">
				{issues.map((issue) => (
					<KanbanCard
						key={issue.id}
						issue={issue}
						onOpen={onOpenIssue ? () => onOpenIssue(issue) : undefined}
						onMove={onMoveIssue ? (status) => onMoveIssue(issue, status) : undefined}
					/>
				))}
				{issues.length === 0 ? (
					<p className="py-6 text-center text-xs text-[var(--ink-soft)]">Nothing here</p>
				) : null}
			</div>
		</section>
	);
}

function cnCount(accent?: boolean) {
	return accent
		? "rounded-full bg-[var(--accent-bg)] px-2 py-0.5 font-[var(--mono)] text-[11px] text-[var(--accent-strong)]"
		: "rounded-full bg-[var(--bg)] px-2 py-0.5 font-[var(--mono)] text-[11px] text-[var(--ink-soft)]";
}
