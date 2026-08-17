import { apiRequest, ApiError, isRecord } from "@/api/client";
import type { ProjectRole, TeamRole } from "@/lib/veridex-types";

export interface MeSession {
	id: string;
	expiresAt: string;
	userId: string;
}

export interface MeUser {
	id: string;
	name: string;
	email: string;
	image: string | null;
	username: string | null;
	defaultRole: ProjectRole | null;
}

export interface MeTeam {
	id: string;
	name: string;
	slug: string;
	isPersonal: boolean;
	teamRole: TeamRole;
}

export interface MeResponse {
	session: MeSession;
	user: MeUser;
	hasPersonalTeam: boolean;
	teams: MeTeam[];
}

function isProjectRole(value: unknown): value is ProjectRole {
	return value === "dev" || value === "qa" || value === "tester" || value === "admin";
}

function isTeamRole(value: unknown): value is TeamRole {
	return value === "owner" || value === "admin" || value === "member";
}

function isMeResponse(value: unknown): value is MeResponse {
	if (!isRecord(value) || !isRecord(value.session) || !isRecord(value.user)) return false;
	const { session, user, teams } = value;
	return (
		typeof session.id === "string" &&
		typeof session.expiresAt === "string" &&
		typeof session.userId === "string" &&
		typeof user.id === "string" &&
		typeof user.name === "string" &&
		typeof user.email === "string" &&
		(user.image === null || typeof user.image === "string") &&
		(user.username === null || typeof user.username === "string") &&
		(user.defaultRole === null || isProjectRole(user.defaultRole)) &&
		typeof value.hasPersonalTeam === "boolean" &&
		Array.isArray(teams) &&
		teams.every(
			(team) =>
				isRecord(team) &&
				typeof team.id === "string" &&
				typeof team.name === "string" &&
				typeof team.slug === "string" &&
				typeof team.isPersonal === "boolean" &&
				isTeamRole(team.teamRole),
		)
	);
}

export async function fetchMe() {
	try {
		return await apiRequest("/api/me", isMeResponse);
	} catch (error) {
		if (error instanceof ApiError && error.status === 401) return null;
		throw error;
	}
}

const PROFILE_GRADIENTS = [
	"linear-gradient(135deg, #5FC9C9, #7FA0E0)",
	"linear-gradient(135deg, #7FA0E0, #B29DF0)",
	"linear-gradient(135deg, #B29DF0, #E491AC)",
	"linear-gradient(135deg, #E491AC, #F0B27A)",
	"linear-gradient(135deg, #7FC7B7, #8FB3E6)",
	"linear-gradient(135deg, #FF9A8B, #FAD3B2)",
	"linear-gradient(135deg, #A1C4FD, #C2E2FB)",
	"linear-gradient(135deg, #FBC2EB, #A6C1EE)",
	"linear-gradient(135deg, #845EC2, #A080E0)",
	"linear-gradient(135deg, #D9A7D7, #FFE066)",
] as const;

function hashToIndex(value: string) {
	let hash = 0;
	for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
	return Math.abs(hash) % PROFILE_GRADIENTS.length;
}

export function initialsFor(name: string) {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("")
		.slice(0, 2);
}

export interface DerivedProfile {
	id: string;
	name: string;
	username: string;
	email: string;
	initials: string;
	gradient: string;
	avatarUrl?: string;
}

export function deriveProfile(user: MeUser): DerivedProfile {
	return {
		id: user.id,
		name: user.name,
		username: user.username ?? "",
		email: user.email,
		initials: initialsFor(user.name),
		gradient: PROFILE_GRADIENTS[hashToIndex(user.id)],
		avatarUrl: user.image ?? undefined,
	};
}
