import type { Issue, IssueStatus } from "@/lib/veridex-types";
import { BoardScreen } from "@/components/screens/BoardScreen";
import type { RoleView } from "@/lib/veridex-types";
import { useDemoStore } from "@/lib/demo-store";

interface AdminBoardProps {
	issues: Issue[];
	view: RoleView;
	onOpenIssue?: (issue: Issue) => void;
	onMoveIssue?: (issue: Issue, status: IssueStatus) => void;
}

export function AdminBoard({ issues, view, onOpenIssue, onMoveIssue }: AdminBoardProps) {
	const currentUserId = useDemoStore((state) => state.currentUser.id);
	const shown = view === "dev"
		? issues.filter((issue) => !issue.assignee || issue.assignee.id === currentUserId)
		: view === "qa"
			? issues.filter((issue) => issue.status === "in_qa")
			: view === "tester"
			? issues.filter((issue) => issue.reporter.id === currentUserId)
			: issues;
	return (
		<div className="flex h-full flex-col">
			<div className="mb-4 flex items-center justify-between">
				<p className="text-[13px] text-[var(--ink-soft)]">
					Previewing as <span className="font-[var(--mono)] text-[var(--ink)]">{view === "all" ? "all members" : view}</span>
				</p>
			</div>
			<BoardScreen issues={shown} onOpenIssue={onOpenIssue} onMoveIssue={onMoveIssue} />
		</div>
	);
}
