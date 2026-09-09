import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiToken, listApiTokens, revokeApiToken } from "@/api/tokens";

export const apiTokensQueryKey = ["api-tokens"] as const;

export const apiTokensQueryOptions = () =>
	queryOptions({
		queryKey: apiTokensQueryKey,
		queryFn: listApiTokens,
		retry: false,
	});

export function useApiTokens() {
	return useQuery(apiTokensQueryOptions());
}

export function useCreateApiToken() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createApiToken,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: apiTokensQueryKey }),
	});
}

export function useRevokeApiToken() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: revokeApiToken,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: apiTokensQueryKey }),
	});
}
