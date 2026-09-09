import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession } from "../lib/auth.js";
import { ValidationError } from "../lib/errors.js";
import {
	createApiToken,
	listApiTokens,
	revokeApiToken,
} from "../services/api-token.service.js";

const tokenParamsSchema = z.object({ id: z.string().uuid() });
const createTokenSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (!result.success) throw new ValidationError(z.treeifyError(result.error));
	return result.data;
}

export async function apiTokenRoutes(fastify: FastifyInstance) {
	fastify.get("/api/tokens", async (request) => {
		const session = await requireSession(request);
		return listApiTokens(fastify.db, session.user.id);
	});

	fastify.post("/api/tokens", async (request, reply) => {
		const session = await requireSession(request);
		const { name } = parseInput(createTokenSchema, request.body);
		const token = await createApiToken(fastify.db, session.user.id, name);
		return reply.status(201).send(token);
	});

	fastify.delete("/api/tokens/:id", async (request, reply) => {
		const session = await requireSession(request);
		const { id } = parseInput(tokenParamsSchema, request.params);
		await revokeApiToken(fastify.db, session.user.id, id);
		return reply.status(204).send();
	});
}
