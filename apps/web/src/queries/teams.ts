import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTeamInvite, listPendingTeamInvites, listTeamMembers, listTeams, revokeTeamInvite } from "@/api/teams";
import type { TeamRole } from "@/lib/veridex-types";

export const teamsQueryKey = ["teams"] as const;

export const teamsQueryOptions = queryOptions({
	queryKey: teamsQueryKey,
	queryFn: listTeams,
	staleTime: 60_000,
	retry: false,
});

export function teamMembersQueryOptions(teamId: string) {
	return queryOptions({
		queryKey: ["teams", teamId, "members"] as const,
		queryFn: () => listTeamMembers(teamId),
		staleTime: 30_000,
		retry: false,
		enabled: Boolean(teamId),
	});
}

export function pendingTeamInvitesQueryOptions(teamId: string) {
	return queryOptions({
		queryKey: ["teams", teamId, "invites"] as const,
		queryFn: () => listPendingTeamInvites(teamId),
		staleTime: 30_000,
		retry: false,
		enabled: Boolean(teamId),
	});
}

export function useTeams() {
	return useQuery(teamsQueryOptions);
}

export function useTeamMembers(teamId: string) {
	return useQuery(teamMembersQueryOptions(teamId));
}

export function usePendingTeamInvites(teamId: string) {
	return useQuery(pendingTeamInvitesQueryOptions(teamId));
}

export function useCreateTeamInvite(teamId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: { email: string; teamRole: Exclude<TeamRole, "owner"> }) =>
			createTeamInvite(teamId, input),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams", teamId, "invites"] }),
	});
}

export function useRevokeTeamInvite(teamId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (inviteId: string) => revokeTeamInvite(teamId, inviteId),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams", teamId, "invites"] }),
	});
}
