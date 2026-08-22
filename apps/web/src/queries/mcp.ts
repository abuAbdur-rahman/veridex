import { queryOptions, useQuery } from "@tanstack/react-query";
import { getMcpAccessSummary, getMcpActivity } from "@/api/mcp";

export const mcpAccessQueryOptions = queryOptions({
	queryKey: ["mcp", "access-summary"] as const,
	queryFn: getMcpAccessSummary,
	retry: false,
});

export const mcpActivityQueryOptions = queryOptions({
	queryKey: ["mcp", "activity"] as const,
	queryFn: getMcpActivity,
	retry: false,
});

export function useMcpAccessSummary() {
	return useQuery(mcpAccessQueryOptions);
}

export function useMcpActivity() {
	return useQuery(mcpActivityQueryOptions);
}
