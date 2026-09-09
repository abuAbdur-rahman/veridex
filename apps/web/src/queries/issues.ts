import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	assignIssue,
	createIssue,
	deleteIssue,
	getIssue,
	getIssueHistory,
	listIssues,
	updateIssue,
	updateIssueStatus,
	uploadIssueImage,
	type CreateIssueInput,
	type IssueFilters,
	type UpdateIssueInput,
} from "@/api/issues";
import type { IssueStatus } from "@/lib/veridex-types";
import { createComment, deleteComment, listComments, updateComment } from "@/api/comments";

export const issuesQueryKey = (projectId: string) => ["projects", projectId, "issues"] as const;
export const issueQueryKey = (projectId: string, issueId: string) =>
	["projects", projectId, "issues", issueId] as const;
export const issueHistoryQueryKey = (projectId: string, issueId: string) =>
	["projects", projectId, "issues", issueId, "history"] as const;
export const issueCommentsQueryKey = (projectId: string, issueId: string) =>
	["projects", projectId, "issues", issueId, "comments"] as const;
export const issuesQueryOptions = (projectId: string, filters: IssueFilters = {}) =>
	queryOptions({
		queryKey: [...issuesQueryKey(projectId), filters] as const,
		queryFn: () => listIssues(projectId, filters),
		enabled: Boolean(projectId),
		retry: false,
	});
export const issueQueryOptions = (projectId: string, issueId: string) =>
	queryOptions({
		queryKey: issueQueryKey(projectId, issueId),
		queryFn: () => getIssue(projectId, issueId),
		enabled: Boolean(projectId && issueId),
		retry: false,
	});
export const issueHistoryQueryOptions = (projectId: string, issueId: string) =>
	queryOptions({
		queryKey: issueHistoryQueryKey(projectId, issueId),
		queryFn: () => getIssueHistory(projectId, issueId),
		enabled: Boolean(projectId && issueId),
		retry: false,
	});
export const issueCommentsQueryOptions = (projectId: string, issueId: string) =>
	queryOptions({
		queryKey: issueCommentsQueryKey(projectId, issueId),
		queryFn: () => listComments(projectId, issueId),
		enabled: Boolean(projectId && issueId),
		retry: false,
	});
export function useIssues(projectId: string, filters: IssueFilters = {}) {
	return useQuery(issuesQueryOptions(projectId, filters));
}
export function useIssue(projectId: string, issueId: string) {
	return useQuery(issueQueryOptions(projectId, issueId));
}
export function useIssueHistory(projectId: string, issueId: string) {
	return useQuery(issueHistoryQueryOptions(projectId, issueId));
}
export function useIssueComments(projectId: string, issueId: string) {
	return useQuery(issueCommentsQueryOptions(projectId, issueId));
}
export function useCreateIssueComment(projectId: string, issueId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: string) => createComment(projectId, issueId, body),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: issueCommentsQueryKey(projectId, issueId) }),
	});
}
export function useUpdateIssueComment(projectId: string, issueId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
			updateComment(projectId, commentId, body),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: issueCommentsQueryKey(projectId, issueId) }),
	});
}
export function useDeleteIssueComment(projectId: string, issueId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (commentId: string) => deleteComment(projectId, commentId),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: issueCommentsQueryKey(projectId, issueId) }),
	});
}
function useRefresh(projectId: string) {
	const qc = useQueryClient();
	return (issueId?: string) =>
		Promise.all([
			qc.invalidateQueries({ queryKey: issuesQueryKey(projectId) }),
			...(issueId ? [qc.invalidateQueries({ queryKey: issueQueryKey(projectId, issueId) })] : []),
		]);
}
export function useCreateIssue(projectId: string) {
	const refresh = useRefresh(projectId);
	return useMutation({
		mutationFn: (input: CreateIssueInput) => createIssue(projectId, input),
		onSuccess: () => refresh(),
	});
}
export function useUploadIssueImage(projectId: string) {
	return useMutation({
		mutationFn: (file: File) => uploadIssueImage(projectId, file),
	});
}
export function useUpdateIssue(projectId: string, issueId: string) {
	const refresh = useRefresh(projectId);
	return useMutation({
		mutationFn: (input: UpdateIssueInput) => updateIssue(projectId, issueId, input),
		onSuccess: () => refresh(issueId),
	});
}
export function useUpdateIssueStatus(projectId: string) {
	const qc = useQueryClient();
	const refresh = useRefresh(projectId);
	return useMutation({
		mutationFn: ({
			issueId,
			status,
			note,
		}: {
			issueId: string;
			status: IssueStatus;
			note?: string;
		}) => updateIssueStatus(projectId, issueId, status, note),
		onSuccess: (_data, { issueId }) =>
			Promise.all([
				refresh(issueId),
				qc.invalidateQueries({ queryKey: issueHistoryQueryKey(projectId, issueId) }),
			]),
	});
}
export function useAssignIssue(projectId: string, issueId: string) {
	const refresh = useRefresh(projectId);
	return useMutation({
		mutationFn: (input: { developerAssigneeIds: string[]; qaAssigneeIds: string[] }) =>
			assignIssue(projectId, issueId, input),
		onSuccess: () => refresh(issueId),
	});
}
export function useDeleteIssue(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (issueId: string) => deleteIssue(projectId, issueId),
		onSuccess: (_data, issueId) => {
			qc.removeQueries({ queryKey: issueQueryKey(projectId, issueId) });
			qc.removeQueries({ queryKey: issueHistoryQueryKey(projectId, issueId) });
			return qc.invalidateQueries({ queryKey: issuesQueryKey(projectId) });
		},
	});
}
