import { apiRequest, isRecord } from "@/api/client";
import { isServerTeam, type ServerTeam } from "@/api/teams";
import type { TeamRole } from "@/lib/veridex-types";

export interface ValidatedInvite {
	id: string;
	teamId: string;
	teamName: string;
	teamSlug: string;
	email: string;
	teamRole: TeamRole;
	expiresAt: string;
}

function isValidatedInvite(value: unknown): value is ValidatedInvite {
	return isRecord(value)
		&& typeof value.id === "string"
		&& typeof value.teamId === "string"
		&& typeof value.teamName === "string"
		&& typeof value.teamSlug === "string"
		&& typeof value.email === "string"
		&& (value.teamRole === "owner" || value.teamRole === "admin" || value.teamRole === "member")
		&& typeof value.expiresAt === "string";
}

export function validateInvite(token: string) {
	return apiRequest(
		`/api/invites/${encodeURIComponent(token)}/validate`,
		isValidatedInvite,
	);
}

export function acceptInvite(token: string): Promise<ServerTeam> {
	return apiRequest(
		`/api/invites/${encodeURIComponent(token)}/accept`,
		isServerTeam,
		{ method: "POST" },
	);
}
