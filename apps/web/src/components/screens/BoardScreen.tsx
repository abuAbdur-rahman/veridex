import {
	closestCorners,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragStartEvent,
	type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import type { Issue, IssueStatus } from "@/lib/veridex-types";
import { ISSUE_STATUSES } from "@/lib/veridex-types";
import { KanbanColumn } from "@/components/app/KanbanColumn";
import { getAllowedTransitions } from "@/stores/demo-store";

const COLUMNS: { title: string; status: IssueStatus; accent?: boolean }[] = [
	{ title: "Backlog", status: "backlog" },
	{ title: "In Progress", status: "in_progress", accent: true },
	{ title: "In QA", status: "in_qa" },
	{ title: "Verified", status: "verified" },
];

function belongsToColumn(issue: Issue, status: IssueStatus) {
	return issue.status === status;
}

interface BoardScreenProps {
	issues: Issue[];
	onOpenIssue?: (issue: Issue) => void;
	onMoveIssue?: (issue: Issue, status: IssueStatus) => void;
}

export function BoardScreen({ issues, onOpenIssue, onMoveIssue }: BoardScreenProps) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const [activeIssue, setActiveIssue] = useState<Issue>();

	function handleDragStart(event: DragStartEvent) {
		setActiveIssue(issues.find((issue) => issue.id === String(event.active.id)));
	}

	function handleDragEnd(event: DragEndEvent) {
		setActiveIssue(undefined);
		if (!onMoveIssue || !event.over) return;
		const issue = issues.find((item) => item.id === String(event.active.id));
		const targetStatus = event.over.data.current?.status;
		if (
			!issue ||
			typeof targetStatus !== "string" ||
			!ISSUE_STATUSES.includes(targetStatus as IssueStatus)
		)
			return;
		if (issue.status !== targetStatus) onMoveIssue(issue, targetStatus as IssueStatus);
	}

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCorners}
			onDragStart={handleDragStart}
			onDragCancel={() => setActiveIssue(undefined)}
			onDragEnd={handleDragEnd}
		>
			<div className="kanban-scroll flex h-full gap-4 overflow-x-auto pb-4">
				{COLUMNS.map((column) => (
					<KanbanColumn
						key={column.status}
						status={column.status}
						title={column.title}
						accent={column.accent}
						count={issues.filter((issue) => belongsToColumn(issue, column.status)).length}
						issues={issues.filter((issue) => belongsToColumn(issue, column.status))}
						onOpenIssue={onOpenIssue}
						onMoveIssue={onMoveIssue}
						dropDisabled={Boolean(
							activeIssue &&
								activeIssue.status !== column.status &&
								!getAllowedTransitions(activeIssue.status).includes(column.status),
						)}
					/>
				))}
			</div>
			<DragOverlay dropAnimation={{ duration: 120, easing: "ease-out" }}>
				{activeIssue ? (
					<div className="w-[288px] rounded-[10px] border border-[var(--accent)] bg-[var(--surface)] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
						<span className="font-[var(--mono)] text-[11px] text-[var(--ink-soft)]">
							{activeIssue.ticketRef}
						</span>
						<p className="mt-1 text-sm font-semibold">{activeIssue.title}</p>
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}

export function filterBoard(issues: Issue[], mode: "all" | "mine" | "unassigned") {
	switch (mode) {
		case "mine":
			return issues.filter((issue) =>
				issue.developerAssignees.some((assignee) => assignee.name === "Marcus Lee"),
			);
		case "unassigned":
			return issues.filter((issue) => issue.developerAssignees.length === 0);
		default:
			return issues;
	}
}
