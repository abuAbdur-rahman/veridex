import { queryOptions, useQuery } from "@tanstack/react-query";
import type { OnboardingResult } from "@/api/onboarding";
import { fetchMe, type MeResponse, type MeTeam } from "@/api/session";

export const meQueryKey = ["me"] as const;

export const meQueryOptions = queryOptions({
	queryKey: meQueryKey,
	queryFn: fetchMe,
	staleTime: 60_000,
	retry: false,
});

export function applyOnboardingResult(
	current: MeResponse | null | undefined,
	result: OnboardingResult,
) {
	if (!current) return current;

	const personalTeam: MeTeam = { ...result.team, teamRole: "owner" };
	const teams = current.teams.some((team) => team.id === personalTeam.id)
		? current.teams.map((team) => (team.id === personalTeam.id ? personalTeam : team))
		: [...current.teams, personalTeam];

	return {
		...current,
		user: { ...current.user, username: result.user.username },
		hasPersonalTeam: true,
		teams,
	};
}

export function useMe() {
	return useQuery(meQueryOptions);
}
