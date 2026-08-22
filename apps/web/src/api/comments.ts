import { apiRequest, isRecord } from "@/api/client";

export interface ServerComment {
	id: string;
	issueId: string;
	authorId: string;
	body: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

function isComment(value: unknown): value is ServerComment {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.issueId === "string" &&
		typeof value.authorId === "string" &&
		typeof value.body === "string" &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string" &&
		(value.deletedAt === null || typeof value.deletedAt === "string")
	);
}

export function listComments(projectId: string, issueId: string) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments`,
		(value): value is ServerComment[] => Array.isArray(value) && value.every(isComment),
	);
}

export function createComment(projectId: string, issueId: string, body: string) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments`,
		isComment,
		{ method: "POST", body: JSON.stringify({ body }) },
	);
}
