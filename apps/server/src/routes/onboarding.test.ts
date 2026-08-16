import Fastify from "fastify";
import type { Database } from "../db/client.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, UnauthorizedError } from "../lib/errors.js";
import { onboardingRoutes } from "./onboarding.js";

const {
	requireSession,
	getCurrentUser,
	isUsernameAvailable,
	completeOnboarding,
} = vi.hoisted(() => ({
	requireSession: vi.fn(),
	getCurrentUser: vi.fn(),
	isUsernameAvailable: vi.fn(),
	completeOnboarding: vi.fn(),
}));

vi.mock("../lib/auth.js", () => ({ requireSession }));
vi.mock("../services/onboarding.service.js", async (importOriginal) => {
	const original = await importOriginal<
		typeof import("../services/onboarding.service.js")
	>();
	return {
		...original,
		getCurrentUser,
		isUsernameAvailable,
		completeOnboarding,
	};
});

const apps: Array<ReturnType<typeof Fastify>> = [];

async function createApp() {
	const app = Fastify({ logger: false });
	app.decorate("db", {} as Database);
	app.setErrorHandler((error, _request, reply) => {
		if (error instanceof AppError) {
			return reply.status(error.statusCode).send({
				error: {
					code: error.code,
					message: error.message,
					...(error.details === undefined ? {} : { details: error.details }),
				},
			});
		}
		return reply.status(500).send({
			error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
		});
	});
	await app.register(onboardingRoutes);
	apps.push(app);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	requireSession.mockResolvedValue({
		session: {
			id: "session-1",
			token: "secret-token",
			expiresAt: new Date("2030-01-01T00:00:00.000Z"),
			userId: "user-1",
		},
		user: { id: "user-1" },
	});
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("onboarding routes", () => {
	it.each([
		["GET", "/api/me"],
		["GET", "/api/users/check-username?q=alice"],
		["POST", "/api/onboarding/complete"],
	] as const)("requires a session for %s %s", async (method, url) => {
		requireSession.mockRejectedValue(new UnauthorizedError());
		const response = await (await createApp()).inject({
			method,
			url,
			...(method === "POST" ? { payload: { username: "alice" } } : {}),
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({
			error: { code: "UNAUTHORIZED", message: "Session required" },
		});
	});

	it("returns session, user, and personal-team state from /api/me", async () => {
		getCurrentUser.mockResolvedValue({
			user: { id: "user-1", username: "alice" },
			hasPersonalTeam: true,
			teams: [{ id: "team-1", isPersonal: true, teamRole: "owner" }],
		});

		const response = await (await createApp()).inject({
			method: "GET",
			url: "/api/me",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			session: {
				id: "session-1",
				expiresAt: "2030-01-01T00:00:00.000Z",
				userId: "user-1",
			},
			user: { id: "user-1", username: "alice" },
			hasPersonalTeam: true,
			teams: [{ id: "team-1", isPersonal: true, teamRole: "owner" }],
		});
		expect(JSON.stringify(response.json())).not.toContain("secret-token");
		expect(getCurrentUser).toHaveBeenCalledWith(expect.anything(), "user-1");
	});

	it("normalizes username availability queries", async () => {
		isUsernameAvailable.mockResolvedValue(true);

		const response = await (await createApp()).inject({
			method: "GET",
			url: "/api/users/check-username?q=%20Alice_1%20",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ username: "alice_1", available: true });
		expect(isUsernameAvailable).toHaveBeenCalledWith(
			expect.anything(),
			"alice_1",
			"user-1",
		);
	});

	it("returns a shared validation envelope for malformed usernames", async () => {
		const response = await (await createApp()).inject({
			method: "POST",
			url: "/api/onboarding/complete",
			payload: { username: "no spaces" },
		});

		expect(response.statusCode).toBe(422);
		expect(response.json()).toMatchObject({
			error: { code: "VALIDATION_ERROR", message: "Invalid input" },
		});
		expect(completeOnboarding).not.toHaveBeenCalled();
	});

	it("returns the provisioned workspace with a 201 status", async () => {
		const provisioned = {
			user: { username: "alice" },
			team: { id: "team-1", slug: "alice", isPersonal: true },
			project: { id: "project-1", slug: "my-project" },
		};
		completeOnboarding.mockResolvedValue(provisioned);

		const response = await (await createApp()).inject({
			method: "POST",
			url: "/api/onboarding/complete",
			payload: { username: "Alice" },
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual(provisioned);
		expect(completeOnboarding).toHaveBeenCalledWith(
			expect.anything(),
			"user-1",
			"alice",
		);
	});
});
