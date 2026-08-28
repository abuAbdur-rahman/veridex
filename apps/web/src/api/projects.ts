import { apiRequest, isRecord } from "@/api/client";
import type { ProjectRole } from "@/lib/veridex-types";

export interface ServerProject {
	id: string;
	teamId?: string;
	name: string;
	slug: string;
	description: string | null;
	projectRole?: ProjectRole;
	nextTicketNumber?: number;
	createdBy?: string;
}

export interface ServerProjectMember {
	id: string;
	name: string;
	email: string;
	image: string | null;
	username: string | null;
	role: ProjectRole;
	addedAt: string | null;
}

export interface ServerProjectMemberRef {
	projectId: string;
	userId: string;
	role: ProjectRole;
	addedAt: string | null;
}

const roles = new Set<ProjectRole>(["dev", "qa", "tester", "admin"]);
const stringOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";
const optionalString = (v: unknown): v is string | undefined =>
	v === undefined || typeof v === "string";
const optionalNumber = (v: unknown): v is number | undefined =>
	v === undefined || (typeof v === "number" && Number.isInteger(v));
const isRole = (v: unknown): v is ProjectRole =>
	typeof v === "string" && roles.has(v as ProjectRole);

export function isServerProject(value: unknown): value is ServerProject {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		typeof value.slug === "string" &&
		stringOrNull(value.description) &&
		optionalString(value.teamId) &&
		optionalNumber(value.nextTicketNumber) &&
		optionalString(value.createdBy) &&
		(value.projectRole === undefined || isRole(value.projectRole))
	);
}

function isMember(value: unknown): value is ServerProjectMember {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		typeof value.email === "string" &&
		stringOrNull(value.image) &&
		stringOrNull(value.username) &&
		isRole(value.role) &&
		stringOrNull(value.addedAt)
	);
}
function isMemberRef(value: unknown): value is ServerProjectMemberRef {
	return (
		isRecord(value) &&
		typeof value.projectId === "string" &&
		typeof value.userId === "string" &&
		isRole(value.role) &&
		stringOrNull(value.addedAt)
	);
}

export function listProjects(teamId: string) {
	return apiRequest(
		`/api/teams/${encodeURIComponent(teamId)}/projects`,
		(v): v is ServerProject[] => Array.isArray(v) && v.every(isServerProject),
	);
}
export function createProject(
	teamId: string,
	input: { name: string; slug: string; description?: string },
) {
	return apiRequest(`/api/teams/${encodeURIComponent(teamId)}/projects`, isServerProject, {
		method: "POST",
		body: JSON.stringify(input),
	});
}
export function getProject(projectId: string) {
	return apiRequest(`/api/projects/${encodeURIComponent(projectId)}`, isServerProject);
}
export function deleteProject(projectId: string) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}`,
		(value): value is null => value === null,
		{ method: "DELETE" },
	);
}
export function listProjectMembers(projectId: string) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/members`,
		(v): v is ServerProjectMember[] => Array.isArray(v) && v.every(isMember),
	);
}
export function addProjectMember(projectId: string, input: { userId: string; role: ProjectRole }) {
	return apiRequest(`/api/projects/${encodeURIComponent(projectId)}/members`, isMemberRef, {
		method: "POST",
		body: JSON.stringify(input),
	});
}
export function updateProjectMemberRole(projectId: string, userId: string, role: ProjectRole) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
		(value): value is { userId: string } =>
			isRecord(value) && typeof value.userId === "string",
		{ method: "PATCH", body: JSON.stringify({ role }) },
	);
}
export function removeProjectMember(projectId: string, userId: string) {
	return apiRequest(
		`/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
		(value): value is null => value === null,
		{ method: "DELETE" },
	);
}
