import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBoard } from "@/components/screens/AdminBoard";
import { BoardScreen } from "@/components/screens/BoardScreen";
import { IssueDetailPanel } from "@/components/screens/IssueDetailPanel";
import { QaTriageScreen } from "@/components/screens/QaTriageScreen";
import { ReportIssueModal, type ReportValues } from "@/components/screens/ReportIssueModal";
import { TesterViewScreen } from "@/components/screens/TesterViewScreen";
import { requiresAuditNote } from "@/lib/veridex-types";
import { mapServerHistory, mapServerIssue } from "@/lib/server-mappers";
import { connectProjectWebSocket } from "@/lib/project-websocket";
import { useMe } from "@/queries/session";
import { useProject, useProjectMembers } from "@/queries/projects";
import {
	useAssignIssue,
	useCreateIssue,
	useDeleteIssue,
	useCreateIssueComment,
	useDeleteIssueComment,
	useIssue,
	useIssueComments,
	useIssueHistory,
	useIssues,
	useUpdateIssue,
	useUpdateIssueComment,
	useUpdateIssueStatus,
	useUploadIssueImage,
} from "@/queries/issues";
import type { Issue, IssueStatus, ProjectRole, RoleView } from "@/lib/veridex-types";

interface ProjectHomeScreenProps {
	projectId: string;
	view?: RoleView;
	query: string;
	issueId?: string;
}
export function ProjectHomeScreen({ projectId, view, query, issueId }: ProjectHomeScreenProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: me } = useMe();
	const projectQuery = useProject(projectId);
	const membersQuery = useProjectMembers(projectId);
	const issuesQuery = useIssues(
		projectId,
		query.trim() ? { search: query.trim(), limit: 100 } : { limit: 100 },
	);
	const selectedQuery = useIssue(projectId, issueId ?? "");
	const historyQuery = useIssueHistory(projectId, issueId ?? "");
	const commentsQuery = useIssueComments(projectId, issueId ?? "");
	const commentMutation = useCreateIssueComment(projectId, issueId ?? "");
	const commentUpdateMutation = useUpdateIssueComment(projectId, issueId ?? "");
	const commentDeleteMutation = useDeleteIssueComment(projectId, issueId ?? "");
	const createMutation = useCreateIssue(projectId);
	const uploadMutation = useUploadIssueImage(projectId);
	const statusMutation = useUpdateIssueStatus(projectId);
	const updateMutation = useUpdateIssue(projectId, issueId ?? "");
	const assignMutation = useAssignIssue(projectId, issueId ?? "");
	const deleteMutation = useDeleteIssue(projectId);
	const [reportOpen, setReportOpen] = useState(false);
	const [reportError, setReportError] = useState("");
	const [pageError, setPageError] = useState("");
	const [commentError, setCommentError] = useState("");
	useEffect(
		() =>
			connectProjectWebSocket(projectId, queryClient, () => {
				void navigate({ to: "/login", search: { redirect: window.location.pathname } });
			}),
		[projectId, queryClient, navigate],
	);
	const user = me?.user;
	const role: ProjectRole =
		membersQuery.data?.find((member) => member.id === user?.id)?.role ?? "tester";
	const members = membersQuery.data ?? [];
	const effectiveView: RoleView = view ?? (role === "admin" ? "all" : role);
	const issues = (issuesQuery.data ?? []).map((item) => mapServerIssue(item));
	const selectedIssue = selectedQuery.data ? mapServerIssue(selectedQuery.data) : undefined;
	const history = (historyQuery.data ?? []).map((item) => mapServerHistory(item, members));
	function updateSearch(next: { view?: RoleView; issue?: string }) {
		void navigate({
			to: "/projects/$projectId",
			params: { projectId },
			search: (previous) => ({ ...previous, ...next }),
		});
	}
	function openIssue(issue: Issue) {
		updateSearch({ issue: issue.id });
	}
	async function moveIssue(issue: Issue, status: IssueStatus, suppliedNote?: string) {
		let note = suppliedNote;
		if (requiresAuditNote(status) && !note) {
			note = window.prompt("Add an audit note for this status change")?.trim();
			if (!note) return;
		}
		setPageError("");
		try {
			await statusMutation.mutateAsync({ issueId: issue.id, status, note });
		} catch (value) {
			setPageError(value instanceof Error ? value.message : "Could not update status.");
		}
	}
	async function report(values: ReportValues) {
		setReportError("");
		try {
			const { imageFile, imageUrl: suppliedImageUrl, ...issueValues } = values;
			const uploaded = imageFile ? await uploadMutation.mutateAsync(imageFile) : undefined;
			const created = await createMutation.mutateAsync({
				...issueValues,
				imageUrl: uploaded?.imageUrl ?? suppliedImageUrl,
			});
			setReportOpen(false);
			openIssue(mapServerIssue(created));
		} catch (value) {
			setReportError(value instanceof Error ? value.message : "Could not create issue.");
		}
	}
	if (projectQuery.isPending || membersQuery.isPending)
		return <p className="py-16 text-center text-sm text-[var(--ink-soft)]">Loading project...</p>;
	if (projectQuery.isError || membersQuery.isError || !projectQuery.data)
		return (
			<EmptyState
				icon={Search}
				title="Project could not load"
				description={
					(projectQuery.error ?? membersQuery.error)?.message ??
					"Choose another project from the workspace navigation."
				}
			/>
		);
	const busy =
		statusMutation.isPending ||
		updateMutation.isPending ||
		assignMutation.isPending ||
		deleteMutation.isPending;
	return (
		<div className="flex min-h-0 flex-col">
			<PageHeader
				title={
					effectiveView === "dev"
						? "Issue board"
						: effectiveView === "qa"
							? "QA queue"
							: effectiveView === "tester"
								? "Testing desk"
								: "All issues"
				}
				count={String(issues.length)}
				actions={
					<button
						type="button"
						onClick={() => setReportOpen(true)}
						className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-3.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
					>
						<Plus className="size-4" />
						Report issue
					</button>
				}
			/>
			{pageError ? (
				<p
					role="alert"
					className="mb-4 rounded-md border border-[var(--block)] bg-[var(--block-bg)] px-3 py-2 text-sm text-[var(--block)]"
				>
					{pageError}
				</p>
			) : null}
			{issuesQuery.isPending ? (
				<p className="py-16 text-center text-sm text-[var(--ink-soft)]">Loading issues...</p>
			) : issuesQuery.isError ? (
				<EmptyState
					icon={Search}
					title="Issues could not load"
					description={issuesQuery.error.message}
				/>
			) : effectiveView === "qa" ? (
				<QaTriageScreen
					issues={issues.filter((issue) => issue.status === "in_qa")}
					onQuickVerify={(issue) => void moveIssue(issue, "verified")}
					onReject={(issue, note) => void moveIssue(issue, "in_progress", note)}
					onOpenIssue={openIssue}
				/>
			) : effectiveView === "tester" ? (
				<TesterViewScreen
					retestIssues={issues.filter((issue) => issue.status === "in_progress")}
					recentIssues={issues.filter((issue) => issue.reporter?.id === user?.id)}
					onReport={() => setReportOpen(true)}
					onOpenIssue={openIssue}
				/>
			) : effectiveView === "all" ? (
				<AdminBoard
					issues={issues}
					view="all"
					currentUserId={user?.id}
					onOpenIssue={openIssue}
					onMoveIssue={(issue, status) => void moveIssue(issue, status)}
				/>
			) : (
				<BoardScreen
					issues={issues.filter(
					(issue) =>
						issue.developerAssignees.length === 0 ||
						issue.developerAssignees.some((assignee) => assignee.id === user?.id),
				)}
					onOpenIssue={openIssue}
					onMoveIssue={(issue, status) => void moveIssue(issue, status)}
				/>
			)}
			<ReportIssueModal
				open={reportOpen}
				pending={createMutation.isPending || uploadMutation.isPending}
				error={reportError}
				onClose={() => {
					setReportOpen(false);
					setReportError("");
				}}
				onSubmit={report}
			/>
			{issueId && selectedQuery.isPending ? (
				<p className="sr-only" role="status">
					Loading issue details
				</p>
			) : selectedQuery.isError ? (
				<p role="alert" className="mt-4 text-sm text-[var(--block)]">
					{selectedQuery.error.message}
				</p>
			) : selectedIssue ? (
				<IssueDetailPanel
					issue={selectedIssue}
					history={history}
					members={membersQuery.data ?? []}
					role={role}
					comments={commentsQuery.data ?? []}
					commentsPending={commentsQuery.isPending}
					commentPending={commentMutation.isPending}
					commentError={commentsQuery.isError ? commentsQuery.error.message : commentError}
					currentUserId={user?.id}
					commentUpdatePending={commentUpdateMutation.isPending}
					commentDeletePending={commentDeleteMutation.isPending}
					pending={busy}
					historyPending={historyQuery.isPending}
					onClose={() => updateSearch({ issue: undefined })}
					onUpdate={async (input) => {
						await updateMutation.mutateAsync(input);
					}}
					onStatusChange={async (status, note) => {
						await statusMutation.mutateAsync({ issueId: selectedIssue.id, status, note });
					}}
					onAssign={async (input) => {
						await assignMutation.mutateAsync(input);
					}}
					onDelete={async () => {
						await deleteMutation.mutateAsync(selectedIssue.id);
						updateSearch({ issue: undefined });
					}}
					onComment={async (body) => {
						setCommentError("");
						try {
							await commentMutation.mutateAsync(body);
						} catch (value) {
							setCommentError(value instanceof Error ? value.message : "Could not post comment.");
							throw value;
						}
					}}
					onUpdateComment={async (commentId, body) => {
						setCommentError("");
						try {
							await commentUpdateMutation.mutateAsync({ commentId, body });
						} catch (value) {
							setCommentError(value instanceof Error ? value.message : "Could not update comment.");
							throw value;
						}
					}}
					onDeleteComment={async (commentId) => {
						setCommentError("");
						try {
							await commentDeleteMutation.mutateAsync(commentId);
						} catch (value) {
							setCommentError(value instanceof Error ? value.message : "Could not delete comment.");
						}
					}}
				/>
			) : null}
		</div>
	);
}
