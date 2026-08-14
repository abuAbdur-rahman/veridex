import { useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBoard } from "@/components/screens/AdminBoard";
import { BoardScreen } from "@/components/screens/BoardScreen";
import { IssueDetailPanel } from "@/components/screens/IssueDetailPanel";
import { QaTriageScreen } from "@/components/screens/QaTriageScreen";
import { ReportIssueModal, type ReportValues } from "@/components/screens/ReportIssueModal";
import { TesterViewScreen } from "@/components/screens/TesterViewScreen";
import { isBackwardTransition, useDemoStore } from "@/lib/demo-store";
import type { Issue, IssueStatus, RoleView } from "@/lib/veridex-types";

interface ProjectHomeScreenProps {
	projectId: string;
	view?: RoleView;
	query: string;
	issueId?: string;
}

export function ProjectHomeScreen({ projectId, view, query, issueId }: ProjectHomeScreenProps) {
	const navigate = useNavigate();
	const project = useDemoStore((state) => state.projects.find((item) => item.id === projectId));
	const storedIssues = useDemoStore((state) => state.issues);
	const currentUser = useDemoStore((state) => state.currentUser);
	const selectedIssue = useDemoStore((state) => state.issues.find((issue) => issue.id === issueId && issue.projectId === projectId));
	const issueHistory = useDemoStore((state) => state.issueHistory);
	const issueComments = useDemoStore((state) => state.issueComments);
	const createIssue = useDemoStore((state) => state.createIssue);
	const changeStatus = useDemoStore((state) => state.changeIssueStatus);
	const updateIssue = useDemoStore((state) => state.updateIssue);
	const addComment = useDemoStore((state) => state.addComment);
	const [reportOpen, setReportOpen] = useState(false);
	const allIssues = storedIssues.filter((issue) => issue.projectId === projectId);
	const history = issueId ? issueHistory[issueId] ?? [] : [];
	const comments = issueId ? issueComments[issueId] ?? [] : [];
	const effectiveView: RoleView = view ?? (project?.role === "admin" ? "all" : project?.role ?? "dev");
	const normalizedQuery = query.trim().toLowerCase();
	const issues = normalizedQuery ? allIssues.filter((issue) => `${issue.ticketRef} ${issue.title}`.toLowerCase().includes(normalizedQuery)) : allIssues;

	function updateSearch(next: { view?: RoleView; issue?: string }) {
		void navigate({ to: "/projects/$projectId", params: { projectId }, search: (previous) => ({ ...previous, ...next }) });
	}
	function openIssue(issue: Issue) { updateSearch({ issue: issue.id }); }
	function moveIssue(issue: Issue, status: IssueStatus) {
		let note: string | undefined;
		if (isBackwardTransition(issue.status, status)) {
			note = window.prompt("Why is this issue moving backward?") ?? undefined;
			if (!note) return;
		}
		changeStatus(issue.id, status, note);
	}
	function report(values: ReportValues) {
		const result = createIssue({
			projectId,
			title: values.title,
			severity: values.severity,
			environment: values.environment,
			stepsToReproduce: values.steps.split("\n"),
			testCaseRef: values.testCaseRef,
		});
		if (result.ok) { setReportOpen(false); openIssue(result.value); }
		return result;
	}

	if (!project) return <EmptyState icon={Search} title="Project not found" description="Choose another project from the workspace navigation." />;

	return (
		<div className="flex min-h-0 flex-col">
			<PageHeader title={effectiveView === "dev" ? "Issue board" : effectiveView === "qa" ? "QA queue" : effectiveView === "tester" ? "Testing desk" : "All issues"} count={String(issues.length)} actions={
				<button type="button" onClick={() => setReportOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-3.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"><Plus className="size-4" /> Report issue</button>
			} />
			{effectiveView === "qa" ? <QaTriageScreen issues={issues.filter((issue) => issue.status === "in_qa")} onQuickVerify={(issue) => changeStatus(issue.id, "verified")} onReject={(issue, note) => changeStatus(issue.id, "in_progress", note)} onOpenIssue={openIssue} />
			: effectiveView === "tester" ? <TesterViewScreen retestIssues={issues.filter((issue) => issue.status === "in_progress" && (issueHistory[issue.id] ?? []).some((entry) => entry.fromStatus === "in_qa" && entry.toStatus === "in_progress"))} recentIssues={issues.filter((issue) => issue.reporter.id === currentUser.id)} onReport={() => setReportOpen(true)} onOpenIssue={openIssue} />
			: effectiveView === "all" ? <AdminBoard issues={issues} view={effectiveView} onOpenIssue={openIssue} onMoveIssue={moveIssue} />
			: <BoardScreen issues={issues.filter((issue) => !issue.assignee || issue.assignee.id === currentUser.id)} onOpenIssue={openIssue} onMoveIssue={moveIssue} />}
			<ReportIssueModal open={reportOpen} onClose={() => setReportOpen(false)} onSubmit={report} />
			{selectedIssue ? <IssueDetailPanel issue={selectedIssue} history={history} comments={comments} onClose={() => updateSearch({ issue: undefined })} onUpdate={(input) => updateIssue(selectedIssue.id, input)} onStatusChange={(status, note) => changeStatus(selectedIssue.id, status, note)} onComment={(body) => addComment(selectedIssue.id, body)} /> : null}
		</div>
	);
}
