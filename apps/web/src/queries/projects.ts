import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	addProjectMember,
	createProject,
	getProject,
	listProjectMembers,
	listProjects,
	removeProjectMember,
	updateProjectMemberRole,
} from "@/api/projects";
import type { ProjectRole } from "@/lib/veridex-types";

export const projectsQueryKey = (teamId: string) => ["projects", teamId] as const;
export const projectQueryKey = (projectId: string) => ["project", projectId] as const;
export const projectMembersQueryKey = (projectId: string) =>
	["project", projectId, "members"] as const;
export const projectsQueryOptions = (teamId: string) =>
	queryOptions({
		queryKey: projectsQueryKey(teamId),
		queryFn: () => listProjects(teamId),
		enabled: Boolean(teamId),
		retry: false,
	});
export const projectQueryOptions = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKey(projectId),
		queryFn: () => getProject(projectId),
		enabled: Boolean(projectId),
		retry: false,
	});
export const projectMembersQueryOptions = (projectId: string) =>
	queryOptions({
		queryKey: projectMembersQueryKey(projectId),
		queryFn: () => listProjectMembers(projectId),
		enabled: Boolean(projectId),
		retry: false,
	});
export function useProjects(teamId: string) {
	return useQuery(projectsQueryOptions(teamId));
}
export function useProject(projectId: string) {
	return useQuery(projectQueryOptions(projectId));
}
export function useProjectMembers(projectId: string) {
	return useQuery(projectMembersQueryOptions(projectId));
}
export function useCreateProject(teamId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: { name: string; slug: string; description?: string }) =>
			createProject(teamId, input),
		onSuccess: () => qc.invalidateQueries({ queryKey: projectsQueryKey(teamId) }),
	});
}
export function useAddProjectMember(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: { userId: string; role: ProjectRole }) =>
			addProjectMember(projectId, input),
		onSuccess: () => qc.invalidateQueries({ queryKey: projectMembersQueryKey(projectId) }),
	});
}
export function useUpdateProjectMemberRole(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) =>
			updateProjectMemberRole(projectId, userId, role),
		onSuccess: () => qc.invalidateQueries({ queryKey: projectMembersQueryKey(projectId) }),
	});
}
export function useRemoveProjectMember(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (userId: string) => removeProjectMember(projectId, userId),
		onSuccess: () => qc.invalidateQueries({ queryKey: projectMembersQueryKey(projectId) }),
	});
}
