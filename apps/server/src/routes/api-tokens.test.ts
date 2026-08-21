import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../db/client.js";
import { AppError, UnauthorizedError } from "../lib/errors.js";
import { apiTokenRoutes } from "./api-tokens.js";

const { requireSession, listApiTokens, createApiToken, revokeApiToken } = vi.hoisted(
	() => ({
		requireSession: vi.fn(),
		listApiTokens: vi.fn(),
		createApiToken: vi.fn(),
		revokeApiToken: vi.fn(),
	}),
);

vi.mock("../lib/auth.js", () => ({ requireSession }));
vi.mock("../services/api-token.service.js", () => ({
	listApiTokens,
	createApiToken,
	revokeApiToken,
}));

const apps: Array<ReturnType<typeof Fastify>> = [];
const tokenId = "11111111-1111-4111-8111-111111111111";

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
	await app.register(apiTokenRoutes);
	apps.push(app);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	requireSession.mockResolvedValue({ user: { id: "user-1" } });
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("API token routes", () => {
	it.each([
		["GET", "/api/tokens", undefined],
		["POST", "/api/tokens", { name: "Local MCP" }],
		["DELETE", `/api/tokens/${tokenId}`, undefined],
	] as const)("requires a session for %s %s", async (method, url, payload) => {
		requireSession.mockRejectedValue(new UnauthorizedError());

		const response = await (await createApp()).inject({ method, url, payload });

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({
			error: { code: "UNAUTHORIZED", message: "Session required" },
		});
	});

	it("lists the current user's token metadata", async () => {
		const tokens = [{ id: tokenId, name: "Local MCP", tokenPrefix: "vrx_example1" }];
		listApiTokens.mockResolvedValue(tokens);

		const response = await (await createApp()).inject({ method: "GET", url: "/api/tokens" });

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(tokens);
		expect(listApiTokens).toHaveBeenCalledWith(expect.anything(), "user-1");
	});

	it("normalizes the name and returns a newly generated token with 201", async () => {
		const created = {
			id: tokenId,
			name: "Local MCP",
			tokenPrefix: "vrx_example1",
			token: "vrx_example1234567890123456789012345678",
		};
		createApiToken.mockResolvedValue(created);

		const response = await (await createApp()).inject({
			method: "POST",
			url: "/api/tokens",
			payload: { name: "  Local MCP  " },
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual(created);
		expect(createApiToken).toHaveBeenCalledWith(expect.anything(), "user-1", "Local MCP");
	});

	it.each([{ name: "" }, { name: "x".repeat(101) }, { name: "valid", extra: true }])(
		"rejects invalid creation input",
		async (payload) => {
			const response = await (await createApp()).inject({
				method: "POST",
				url: "/api/tokens",
				payload,
			});

			expect(response.statusCode).toBe(422);
			expect(createApiToken).not.toHaveBeenCalled();
		},
	);

	it("rejects malformed token IDs before revocation", async () => {
		const response = await (await createApp()).inject({
			method: "DELETE",
			url: "/api/tokens/not-a-uuid",
		});

		expect(response.statusCode).toBe(422);
		expect(revokeApiToken).not.toHaveBeenCalled();
	});

	it("revokes the current user's token with 204", async () => {
		revokeApiToken.mockResolvedValue(undefined);

		const response = await (await createApp()).inject({
			method: "DELETE",
			url: `/api/tokens/${tokenId}`,
		});

		expect(response.statusCode).toBe(204);
		expect(revokeApiToken).toHaveBeenCalledWith(expect.anything(), "user-1", tokenId);
	});
});
