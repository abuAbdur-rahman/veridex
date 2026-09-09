import { apiRequest, isRecord } from "@/api/client";
import type { ProjectRole, IssueStatus } from "@/lib/veridex-types";

export interface McpAccessSummary {
	projectId: string;
	projectName: string;
	role: ProjectRole;
	availableTools: string[];
	totalTools: number;
}

export interface McpActivityEntry {
	id: string;
	issueId: string;
	fromStatus: IssueStatus | null;
	toStatus: IssueStatus;
	note: string | null;
	changedAt: string | null;
	ticketRef: string;
	title: string;
}

const roles = new Set<ProjectRole>(["dev", "qa", "tester", "admin"]);
const statuses = new Set<IssueStatus>(["backlog", "in_progress", "in_qa", "verified", "rejected"]);

function isAccess(value: unknown): value is McpAccessSummary {
	return (
		isRecord(value) &&
		typeof value.projectId === "string" &&
		typeof value.projectName === "string" &&
		typeof value.role === "string" &&
		roles.has(value.role as ProjectRole) &&
		Array.isArray(value.availableTools) &&
		value.availableTools.every((tool): tool is string => typeof tool === "string") &&
		typeof value.totalTools === "number"
	);
}

function isActivity(value: unknown): value is McpActivityEntry {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.issueId === "string" &&
		(value.fromStatus === null || (typeof value.fromStatus === "string" && statuses.has(value.fromStatus as IssueStatus))) &&
		typeof value.toStatus === "string" &&
		statuses.has(value.toStatus as IssueStatus) &&
		(value.note === null || typeof value.note === "string") &&
		(value.changedAt === null || typeof value.changedAt === "string") &&
		typeof value.ticketRef === "string" &&
		typeof value.title === "string"
	);
}

export function getMcpAccessSummary() {
	return apiRequest(
		"/api/mcp/access-summary",
		(value): value is { summary: McpAccessSummary[] } =>
			isRecord(value) && Array.isArray(value.summary) && value.summary.every(isAccess),
	);
}

export function getMcpActivity() {
	return apiRequest(
		"/api/mcp/activity",
		(value): value is { activity: McpActivityEntry[] } =>
			isRecord(value) && Array.isArray(value.activity) && value.activity.every(isActivity),
	);
}
