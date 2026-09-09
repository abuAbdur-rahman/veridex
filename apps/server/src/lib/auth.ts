import { and, eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import type { createAuth } from "../auth/index.js";
import type { Database } from "../db/client.js";
import { projectMember } from "../db/schema/project.js";
import type { projectRoleEnum, teamRoleEnum } from "../db/schema/enums.js";
import { teamMember } from "../db/schema/team.js";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "./errors.js";

export type ProjectRole = (typeof projectRoleEnum.enumValues)[number];
export type TeamRole = (typeof teamRoleEnum.enumValues)[number];

interface AuthorizationRequest {
	server: {
		auth: ReturnType<typeof createAuth>;
		db: Database;
	};
	headers: FastifyRequest["headers"];
}

function toHeaders(headers: FastifyRequest["headers"]): Headers {
	const result = new Headers();
	for (const [key, value] of Object.entries(headers)) {
		if (typeof value === "string") {
			result.set(key, value);
		} else if (Array.isArray(value)) {
			for (const item of value) result.append(key, item);
		}
	}
	return result;
}

export async function requireSession(request: AuthorizationRequest) {
	const session = await request.server.auth.api.getSession({
		headers: toHeaders(request.headers),
	});
	if (!session) throw new UnauthorizedError();
	return session;
}

export async function requireProjectRole(
	request: AuthorizationRequest,
	projectId: string,
	allowedRoles: readonly ProjectRole[],
) {
	const session = await requireSession(request);
	const projectIdResult = z.string().uuid().safeParse(projectId);
	if (!projectIdResult.success) {
		throw new NotFoundError("Project");
	}
	const [membership] = await request.server.db
		.select({
			projectId: projectMember.projectId,
			userId: projectMember.userId,
			role: projectMember.role,
			addedAt: projectMember.addedAt,
		})
		.from(projectMember)
		.where(
			and(
				eq(projectMember.projectId, projectId),
				eq(projectMember.userId, session.user.id),
			),
		)
		.limit(1);

	if (!membership || !allowedRoles.includes(membership.role)) {
		throw new ForbiddenError();
	}

	return { session, membership };
}

export async function requireTeamRole(
	request: AuthorizationRequest,
	teamId: string,
	allowedRoles: readonly TeamRole[],
) {
	const session = await requireSession(request);
	const teamIdResult = z.string().uuid().safeParse(teamId);
	if (!teamIdResult.success) {
		throw new NotFoundError("Team");
	}
	const [membership] = await request.server.db
		.select({
			teamId: teamMember.teamId,
			userId: teamMember.userId,
			teamRole: teamMember.teamRole,
			invitedBy: teamMember.invitedBy,
			joinedAt: teamMember.joinedAt,
		})
		.from(teamMember)
		.where(
			and(
				eq(teamMember.teamId, teamId),
				eq(teamMember.userId, session.user.id),
			),
		)
		.limit(1);

	if (!membership || !allowedRoles.includes(membership.teamRole)) {
		throw new ForbiddenError();
	}

	return { session, membership };
}
