import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession, requireTeamRole } from "../lib/auth.js";
import { ValidationError } from "../lib/errors.js";
import {
	createTeam,
	listTeamMembers,
	listTeams,
} from "../services/team.service.js";

const slugPattern = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const teamParamsSchema = z.object({ teamId: z.string().uuid() });
const createTeamSchema = z.object({
	name: z.string().trim().min(1).max(100),
	slug: z.string().trim().toLowerCase().regex(slugPattern),
});

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (!result.success) throw new ValidationError(z.treeifyError(result.error));
	return result.data;
}

export async function teamRoutes(fastify: FastifyInstance) {
	fastify.get("/api/teams", async (request) => {
		const session = await requireSession(request);
		return listTeams(fastify.db, session.user.id);
	});

	fastify.post("/api/teams", async (request, reply) => {
		const session = await requireSession(request);
		const input = parseInput(createTeamSchema, request.body);
		const createdTeam = await createTeam(fastify.db, session.user.id, input);
		return reply.status(201).send(createdTeam);
	});

	fastify.get("/api/teams/:teamId/members", async (request) => {
		const { teamId } = parseInput(teamParamsSchema, request.params);
		await requireTeamRole(request, teamId, ["owner", "admin"]);
		return listTeamMembers(fastify.db, teamId);
	});
}
