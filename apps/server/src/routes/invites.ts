import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession, requireTeamRole } from "../lib/auth.js";
import { ForbiddenError, ValidationError } from "../lib/errors.js";
import {
	acceptInvite,
	createInvite,
	validateInvite,
} from "../services/invite.service.js";

const teamParamsSchema = z.object({ teamId: z.string().uuid() });
const inviteParamsSchema = z.object({
	token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
const createInviteSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email()),
	teamRole: z.enum(["owner", "admin", "member"]),
});

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (!result.success) throw new ValidationError(z.treeifyError(result.error));
	return result.data;
}

export async function inviteRoutes(fastify: FastifyInstance) {
	fastify.post("/api/teams/:teamId/invites", async (request, reply) => {
		const { teamId } = parseInput(teamParamsSchema, request.params);
		const input = parseInput(createInviteSchema, request.body);
		const { session, membership } = await requireTeamRole(request, teamId, [
			"owner",
			"admin",
		]);

		if (
			input.teamRole === "owner" ||
			(membership.teamRole === "admin" && input.teamRole !== "member")
		) {
			throw new ForbiddenError("Cannot grant requested team role");
		}

		const invite = await createInvite(fastify.db, {
			teamId,
			invitedBy: session.user.id,
			email: input.email,
			teamRole: input.teamRole,
		});
		return reply.status(201).send(invite);
	});

	fastify.get("/api/invites/:token/validate", async (request) => {
		const { token } = parseInput(inviteParamsSchema, request.params);
		return validateInvite(fastify.db, token);
	});

	fastify.post("/api/invites/:token/accept", async (request) => {
		const { token } = parseInput(inviteParamsSchema, request.params);
		const session = await requireSession(request);
		return acceptInvite(fastify.db, token, {
			userId: session.user.id,
			email: session.user.email,
			emailVerified: session.user.emailVerified,
		});
	});
}
