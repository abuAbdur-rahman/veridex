import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { user } from "../db/schema/index.js";
import { AppError } from "../lib/errors.js";
import { completeOnboarding } from "../services/onboarding.service.js";

const testUser = {
	email: "dev-user@localhost.test",
	password: "veridex-local-dev-password",
	name: "Veridex Local Developer",
	username: "local-dev",
} as const;

function copySessionCookies(response: Response, reply: { header(name: string, value: string | string[]): void }) {
	const cookies = response.headers.getSetCookie();
	if (cookies.length > 0) reply.header("set-cookie", cookies);
}

export async function devAuthRoutes(fastify: FastifyInstance) {
	const isLoopbackHost = ["127.0.0.1", "localhost", "::1"].includes(
		fastify.config.HOST,
	);
	if (
		!fastify.config.DEV_AUTH_ENABLED ||
		fastify.config.NODE_ENV !== "development" ||
		!isLoopbackHost
	)
		return;

	fastify.post("/api/dev/test-session", async (_request, reply) => {
		let signUpResponse = await fastify.auth.api.signUpEmail({
			body: {
				name: testUser.name,
				email: testUser.email,
				password: testUser.password,
				callbackURL: fastify.config.WEB_ORIGIN,
			},
			asResponse: true,
		});

		if (!signUpResponse.ok) {
			signUpResponse = await fastify.auth.api.signInEmail({
			body: {
				email: testUser.email,
				password: testUser.password,
				callbackURL: fastify.config.WEB_ORIGIN,
			},
			asResponse: true,
		});
		}

		if (!signUpResponse.ok) {
			throw new AppError("DEV_AUTH_FAILED", "Could not create the local test session", 500);
		}

		copySessionCookies(signUpResponse, reply);

		const [localUser] = await fastify.db
			.select({ id: user.id, username: user.username, emailVerified: user.emailVerified })
			.from(user)
			.where(eq(user.email, testUser.email))
			.limit(1);

		if (!localUser) {
			throw new AppError("DEV_AUTH_FAILED", "Local test user was not created", 500);
		}

		if (!localUser.emailVerified) {
			await fastify.db
				.update(user)
				.set({ emailVerified: true })
				.where(eq(user.id, localUser.id));
		}

		if (!localUser.username) {
			await completeOnboarding(fastify.db, localUser.id, testUser.username);
		}

		return reply.send({
			user: { id: localUser.id, username: testUser.username },
			message: "Local development session created",
		});
	});
}
