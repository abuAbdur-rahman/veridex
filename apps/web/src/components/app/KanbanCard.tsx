import { ChevronDown, FlaskConical, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Issue } from "@/lib/veridex-types";
import { Avatar } from "@/components/app/Avatar";
import { SeverityBadge } from "@/components/app/SeverityBadge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllowedTransitions } from "@/stores/demo-store";
import { formatRelativeTime } from "@/lib/format-time";
import type { IssueStatus } from "@/lib/veridex-types";

interface KanbanCardProps {
	issue: Issue;
	active?: boolean;
	onOpen?: () => void;
	onMove?: (status: IssueStatus) => void;
	className?: string;
}

export function KanbanCard({ issue, active, onOpen, onMove, className }: KanbanCardProps) {
	const {
		attributes,
		isDragging,
		listeners,
		setNodeRef,
		transform,
	} = useDraggable({
		id: issue.id,
		data: { issue, status: issue.status },
	});
	return (
		<article
			ref={setNodeRef}
			style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
			className={cn(
				"group block w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition-[border-color,background,box-shadow] duration-150",
				isDragging && "opacity-20",
				active &&
					"border-l-[3px] border-l-[var(--accent)] shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
				!active &&
					"hover:border-[var(--line)] hover:border-l-[3px] hover:border-l-[var(--accent)]",
				className,
			)}
		>
			<div className="flex items-start gap-2">
			<button type="button" onClick={onOpen} aria-label={`Open ${issue.ticketRef}: ${issue.title}`} className="min-w-0 flex-1 text-left">
			<div className="flex items-baseline justify-between gap-2">
				<span className="font-[var(--mono)] text-[11px] font-medium text-[var(--ink-soft)]">
					{issue.ticketRef}
				</span>
				{issue.testCaseRef ? (
					<span
						className="inline-flex items-center gap-1 font-[var(--mono)] text-[11px] text-[var(--ink-soft)]"
						title="Linked test case"
					>
						<FlaskConical className="size-3" aria-hidden="true" strokeWidth={1.5} />
						{issue.testCaseRef}
					</span>
				) : null}
			</div>
			<p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-[1.35] text-[var(--ink)]">
				{issue.title}
			</p>
			<div className="mt-3 flex items-center gap-2">
				<SeverityBadge severity={issue.severity} />
				{issue.environment ? (
					<span className="rounded-[6px] bg-[var(--bg-alt)] px-[10px] py-1 font-[var(--mono)] text-xs text-[var(--ink-soft)]">
						{issue.environment.split(" ")[0]}
					</span>
				) : null}
			</div>
			</button>
			<button
				type="button"
				aria-label={`Drag ${issue.ticketRef}`}
				className="grid size-8 shrink-0 touch-none place-items-center rounded-md text-[var(--ink-soft)] hover:bg-[var(--bg-alt)] hover:text-[var(--ink)] active:cursor-grabbing"
				{...attributes}
				{...listeners}
			>
				<GripVertical className="size-4" aria-hidden="true" />
			</button>
			</div>
			<div className="mt-3 flex items-center gap-2 border-t border-[var(--line-soft)] pt-3">
				<span className="font-[var(--mono)] text-[11px] text-[var(--ink-soft)]">
					{formatRelativeTime(issue.updatedAt)}
				</span>
				<div className="ml-auto" />
				{issue.assignee ? (
					<Avatar
						initials={issue.assignee.initials}
						gradient={issue.assignee.gradient}
						name={issue.assignee.name}
					/>
				) : null}
				{onMove && getAllowedTransitions(issue.status).length > 0 ? (
					<DropdownMenu>
						<DropdownMenuTrigger aria-label={`Move ${issue.ticketRef}`} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[var(--line)] px-2 text-xs font-medium hover:border-[var(--accent)]">
							Move <ChevronDown className="size-3" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-40">
							{getAllowedTransitions(issue.status).map((status) => (
								<DropdownMenuItem key={status} onClick={() => onMove(status)}>{status.replaceAll("_", " ")}</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
		</article>
	);
}
