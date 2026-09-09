import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession } from "../lib/auth.js";
import { ValidationError } from "../lib/errors.js";
import {
	completeOnboarding,
	getCurrentUser,
	isUsernameAvailable,
	normalizeUsername,
	usernamePattern,
} from "../services/onboarding.service.js";

const usernameSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(usernamePattern, "Username must be 3-30 lowercase letters, numbers, underscores, or hyphens");

const usernameQuerySchema = z.object({ q: usernameSchema });
const completeOnboardingSchema = z.object({ username: usernameSchema });

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (!result.success) {
		throw new ValidationError(z.treeifyError(result.error));
	}
	return result.data;
}

export async function onboardingRoutes(fastify: FastifyInstance) {
	fastify.get("/api/me", async (request) => {
		const session = await requireSession(request);
		const currentUser = await getCurrentUser(fastify.db, session.user.id);
		return {
			session: {
				id: session.session.id,
				expiresAt: session.session.expiresAt,
				userId: session.session.userId,
			},
			...currentUser,
		};
	});

	fastify.get("/api/users/check-username", async (request) => {
		const session = await requireSession(request);
		const { q } = parseInput(usernameQuerySchema, request.query);
		return {
			username: normalizeUsername(q),
			available: await isUsernameAvailable(fastify.db, q, session.user.id),
		};
	});

	fastify.post("/api/onboarding/complete", async (request, reply) => {
		const session = await requireSession(request);
		const { username } = parseInput(completeOnboardingSchema, request.body);
		const result = await completeOnboarding(
			fastify.db,
			session.user.id,
			username,
		);
		return reply.status(201).send(result);
	});
}
