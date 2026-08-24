import { apiRequest, isRecord } from "@/api/client";
import type { IssueStatus, Severity } from "@/lib/veridex-types";

export interface IssueEnvironment {
	browser?: string;
	os?: string;
	device?: string;
	version?: string;
	page?: string;
}
export interface ServerMemberRef {
	id: string;
	name: string;
	image: string | null;
}

export interface ServerIssue {
	id: string;
	ticketRef: string;
	title: string;
	description: string | null;
	severity: Severity;
	status: IssueStatus;
	environment: IssueEnvironment | null;
	stepsToReproduce: string | null;
	expectedResult: string | null;
	actualResult: string | null;
	imageUrl: string | null;
	projectId: string;
	reporterId: string;
	assigneeId: string | null;
	qaAssigneeId: string | null;
	developerAssigneeIds: string[];
	qaAssigneeIds: string[];
	testCaseId: string | null;
	importJobId: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	closedAt: string | null;
	reporter?: ServerMemberRef | null;
	developerAssignees?: ServerMemberRef[];
	qaAssignees?: ServerMemberRef[];
}
export interface ServerIssueHistory {
	id: string;
	issueId: string;
	changedBy: string;
	fromStatus: IssueStatus | null;
	toStatus: IssueStatus;
	note: string | null;
	source: "web" | "mcp" | "import";
	changedAt: string | null;
}
export interface IssueFilters {
	status?: IssueStatus;
	assigneeId?: string;
	qaAssigneeId?: string;
	severity?: Severity;
	search?: string;
	limit?: number;
	offset?: number;
}
export interface CreateIssueInput {
	title: string;
	description?: string;
	severity?: Severity;
	environment?: IssueEnvironment;
	stepsToReproduce?: string;
	expectedResult?: string;
	actualResult?: string;
	assigneeId?: string;
	qaAssigneeId?: string;
	testCaseId?: string;
	imageUrl?: string;
}
export interface UpdateIssueInput
	extends Partial<
		Omit<
			CreateIssueInput,
			"assigneeId" | "qaAssigneeId" | "testCaseId" | "description" | "environment" | "imageUrl"
		>
	> {
	assigneeId?: string | null;
	qaAssigneeId?: string | null;
	developerAssigneeIds?: string[];
	qaAssigneeIds?: string[];
	testCaseId?: string | null;
	description?: string | null;
	environment?: IssueEnvironment | null;
	imageUrl?: string | null;
}

const statuses = new Set<IssueStatus>(["backlog", "in_progress", "in_qa", "verified", "rejected"]);
const severities = new Set<Severity>(["low", "medium", "high", "critical"]);
const nullableString = (v: unknown): v is string | null => v === null || typeof v === "string";
const isEnvironment = (v: unknown): v is IssueEnvironment | null => {
	if (v === null) return true;
	if (!isRecord(v)) return false;
	return ["browser", "os", "device", "version", "page"].every(
		(key) => v[key] === undefined || typeof v[key] === "string",
	);
};
const isServerMemberRef = (v: unknown): v is ServerMemberRef =>
	isRecord(v) &&
	typeof v.id === "string" &&
	typeof v.name === "string" &&
	v.image === null;
const nullableServerMemberRef = (v: unknown): v is ServerMemberRef | null =>
	v === null || isServerMemberRef(v);
const serverMemberRefArray = (v: unknown): v is ServerMemberRef[] =>
	Array.isArray(v) && v.every(isServerMemberRef);

export function isServerIssue(v: unknown): v is ServerIssue {
	if (!isRecord(v)) return false;
	return (
		typeof v.id === "string" &&
		typeof v.ticketRef === "string" &&
		typeof v.title === "string" &&
		nullableString(v.description) &&
		typeof v.severity === "string" &&
		severities.has(v.severity as Severity) &&
		typeof v.status === "string" &&
		statuses.has(v.status as IssueStatus) &&
		isEnvironment(v.environment) &&
		nullableString(v.stepsToReproduce) &&
		nullableString(v.expectedResult) &&
		nullableString(v.actualResult) &&
		nullableString(v.imageUrl) &&
		typeof v.projectId === "string" &&
		typeof v.reporterId === "string" &&
		nullableString(v.assigneeId) &&
		nullableString(v.qaAssigneeId) &&
		Array.isArray(v.developerAssigneeIds) &&
		v.developerAssigneeIds.every((id): id is string => typeof id === "string") &&
		Array.isArray(v.qaAssigneeIds) &&
		v.qaAssigneeIds.every((id): id is string => typeof id === "string") &&
		nullableString(v.testCaseId) &&
		nullableString(v.importJobId) &&
		nullableString(v.createdAt) &&
		nullableString(v.updatedAt) &&
		nullableString(v.closedAt) &&
		(v.reporter === undefined || nullableServerMemberRef(v.reporter)) &&
		(v.developerAssignees === undefined || serverMemberRefArray(v.developerAssignees)) &&
		(v.qaAssignees === undefined || serverMemberRefArray(v.qaAssignees))
	);
}
export function isServerHistory(v: unknown): v is ServerIssueHistory {
	return (
		isRecord(v) &&
		typeof v.id === "string" &&
		typeof v.issueId === "string" &&
		typeof v.changedBy === "string" &&
		(v.fromStatus === null ||
			(typeof v.fromStatus === "string" && statuses.has(v.fromStatus as IssueStatus))) &&
		typeof v.toStatus === "string" &&
		statuses.has(v.toStatus as IssueStatus) &&
		nullableString(v.note) &&
		(v.source === "web" || v.source === "mcp" || v.source === "import") &&
		nullableString(v.changedAt)
	);
}
function query(filters: IssueFilters) {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(filters))
		if (value !== undefined && value !== "") params.set(key, String(value));
	const suffix = params.toString();
	return suffix ? `?${suffix}` : "";
}
export function listIssues(projectId: string, filters: IssueFilters = {}) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issues${query(filters)}`,
		(v): v is ServerIssue[] => Array.isArray(v) && v.every(isServerIssue),
	);
}
export function createIssue(projectId: string, input: CreateIssueInput) {
	return apiRequest(`/api/projects/${encodeURIComponent(projectId)}/issues`, isServerIssue, {
		method: "POST",
		body: JSON.stringify(input),
	});
}
export function uploadIssueImage(projectId: string, file: File) {
	const body = new FormData();
	body.append("image", file);
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issue-images`,
		(value): value is { imageUrl: string } =>
			isRecord(value) && typeof value.imageUrl === "string",
		{ method: "POST", body },
	);
}
export function getIssue(projectId: string, issueId: string) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}`,
		isServerIssue,
	);
}
export function updateIssue(projectId: string, issueId: string, input: UpdateIssueInput) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}`,
		isServerIssue,
		{ method: "PATCH", body: JSON.stringify(input) },
	);
}
export function updateIssueStatus(
	projectId: string,
	issueId: string,
	status: IssueStatus,
	note?: string,
) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/status`,
		isServerIssue,
		{ method: "PATCH", body: JSON.stringify({ status, note }) },
	);
}
export function assignIssue(
	projectId: string,
	issueId: string,
	input: { developerAssigneeIds: string[]; qaAssigneeIds: string[] },
) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/assign`,
		isServerIssue,
		{ method: "PATCH", body: JSON.stringify(input) },
	);
}
export function getIssueHistory(projectId: string, issueId: string) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/history`,
		(v): v is ServerIssueHistory[] => Array.isArray(v) && v.every(isServerHistory),
	);
}
export function deleteIssue(projectId: string, issueId: string) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}`,
		(value): value is null => value === null,
		{ method: "DELETE" },
	);
}
