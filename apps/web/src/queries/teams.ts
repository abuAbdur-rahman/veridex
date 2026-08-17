import { queryOptions, useQuery } from "@tanstack/react-query";
import { listTeamMembers, listTeams } from "@/api/teams";

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

export function useTeams() {
	return useQuery(teamsQueryOptions);
}

export function useTeamMembers(teamId: string) {
	return useQuery(teamMembersQueryOptions(teamId));
}
