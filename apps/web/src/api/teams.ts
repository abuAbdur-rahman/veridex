import { apiRequest, isRecord } from "@/api/client";
import type { TeamRole } from "@/lib/veridex-types";

export interface ServerTeam {
	id: string;
	name: string;
	slug: string;
	isPersonal: boolean;
	teamRole: TeamRole;
}

export interface ServerTeamMember {
	id: string;
	name: string;
	email: string;
	image: string | null;
	username: string | null;
	teamRole: TeamRole;
	invitedBy: string | null;
	joinedAt: string;
}

export interface TeamInvite {
	id: string;
	teamId: string;
	email: string;
	teamRole: TeamRole;
	token: string;
	expiresAt: string;
}

export interface PendingTeamInvite {
	id: string;
	email: string;
	teamRole: TeamRole;
	invitedBy: string;
	expiresAt: string;
	createdAt: string;
}

const TEAM_ROLES = new Set<TeamRole>(["owner", "admin", "member"]);

function isTeamRole(value: unknown): value is TeamRole {
	return typeof value === "string" && TEAM_ROLES.has(value as TeamRole);
}

export function isServerTeam(value: unknown): value is ServerTeam {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		typeof value.slug === "string" &&
		typeof value.isPersonal === "boolean" &&
		isTeamRole(value.teamRole)
	);
}

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === "string";
}

function isServerTeamMember(value: unknown): value is ServerTeamMember {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		typeof value.email === "string" &&
		isNullableString(value.image) &&
		isNullableString(value.username) &&
		isTeamRole(value.teamRole) &&
		isNullableString(value.invitedBy) &&
		typeof value.joinedAt === "string"
	);
}

function isTeamInvite(value: unknown): value is TeamInvite {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.teamId === "string" &&
		typeof value.email === "string" &&
		isTeamRole(value.teamRole) &&
		typeof value.token === "string" &&
		typeof value.expiresAt === "string"
	);
}

function isPendingTeamInvite(value: unknown): value is PendingTeamInvite {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.email === "string" &&
		isTeamRole(value.teamRole) &&
		typeof value.invitedBy === "string" &&
		typeof value.expiresAt === "string" &&
		typeof value.createdAt === "string"
	);
}

export function listTeams() {
	return apiRequest(
		"/api/teams",
		(value): value is ServerTeam[] => Array.isArray(value) && value.every(isServerTeam),
	);
}

export function createTeam(input: { name: string; slug: string }) {
	return apiRequest("/api/teams", isServerTeam, {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function listTeamMembers(teamId: string) {
	return apiRequest(
		`/api/teams/${encodeURIComponent(teamId)}/members`,
		(value): value is ServerTeamMember[] => Array.isArray(value) && value.every(isServerTeamMember),
	);
}

export function createTeamInvite(
	teamId: string,
	input: { email: string; teamRole: Exclude<TeamRole, "owner"> },
) {
	return apiRequest(`/api/teams/${encodeURIComponent(teamId)}/invites`, isTeamInvite, {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function listPendingTeamInvites(teamId: string) {
	return apiRequest(
		`/api/teams/${encodeURIComponent(teamId)}/invites`,
		(value): value is PendingTeamInvite[] =>
			Array.isArray(value) && value.every(isPendingTeamInvite),
	);
}

export function revokeTeamInvite(teamId: string, inviteId: string) {
	return apiRequest(
		`/api/teams/${encodeURIComponent(teamId)}/invites/${encodeURIComponent(inviteId)}`,
		(value): value is null => value === null,
		{ method: "DELETE" },
	);
}
