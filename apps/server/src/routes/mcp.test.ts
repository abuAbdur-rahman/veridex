import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../db/client.js";
import { AppError, UnauthorizedError } from "../lib/errors.js";
import { mcpRoutes } from "./mcp.js";

const { authenticateApiToken, listIssues } = vi.hoisted(() => ({
	authenticateApiToken: vi.fn(),
	listIssues: vi.fn(),
}));

vi.mock("../services/api-token.service.js", () => ({ authenticateApiToken }));
vi.mock("../services/issue.service.js", () => ({
	assignIssue: vi.fn(),
	createIssue: vi.fn(),
	getIssue: vi.fn(),
	listIssues,
	updateIssue: vi.fn(),
	updateStatus: vi.fn(),
}));
vi.mock("../lib/auth.js", () => ({
	requireSession: vi.fn(),
}));

const apps: Array<ReturnType<typeof Fastify>> = [];
const projectId = "11111111-1111-4111-8111-111111111111";

function createDb(membership: { role: "dev" | "qa" | "tester" | "admin" } | undefined) {
	return {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => (membership ? [membership] : [])),
				})),
			})),
		})),
	} as unknown as Database;
}

async function createApp(db: Database) {
	const app = Fastify({ logger: false });
	app.decorate("db", db);
	app.setErrorHandler((error, _request, reply) => {
		if (error instanceof AppError) {
			return reply.status(error.statusCode).send({
				error: { code: error.code, message: error.message },
			});
		}
		return reply.status(500).send({ error: { code: "INTERNAL_ERROR" } });
	});
	await app.register(mcpRoutes);
	apps.push(app);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	authenticateApiToken.mockResolvedValue({ userId: "user-1", tokenId: "token-1" });
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("MCP route", () => {
	it("lists the six MCP tools for an authenticated bearer token", async () => {
		const response = await (await createApp(createDb(undefined))).inject({
			method: "POST",
			url: "/mcp",
			headers: { authorization: "Bearer vrx_token" },
			payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
		});

		expect(response.statusCode).toBe(200);
		const tools = response.json().result.tools;
		expect(tools).toHaveLength(6);
		for (const tool of tools) {
			expect(tool.inputSchema).toMatchObject({ type: "object" });
			expect(tool.inputSchema.required).toContain("projectId");
		}
		expect(authenticateApiToken).toHaveBeenCalledWith(expect.anything(), "Bearer vrx_token");
	});

	it("answers the initialize handshake with protocol version and capabilities", async () => {
		const response = await (await createApp(createDb(undefined))).inject({
			method: "POST",
			url: "/mcp",
			headers: { authorization: "Bearer vrx_token" },
			payload: {
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: { protocolVersion: "2025-06-18", capabilities: {} },
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().result).toMatchObject({
			protocolVersion: "2025-06-18",
			capabilities: { tools: {} },
			serverInfo: { name: "veridex-mcp" },
		});
	});

	it("accepts id-less notifications without a JSON-RPC response", async () => {
		const response = await (await createApp(createDb(undefined))).inject({
			method: "POST",
			url: "/mcp",
			headers: { authorization: "Bearer vrx_token" },
			payload: { jsonrpc: "2.0", method: "notifications/initialized" },
		});

		expect(response.statusCode).toBe(202);
		expect(response.body).toBe("");
	});

	it("returns a tool error when the project role is not allowed", async () => {
		const response = await (await createApp(createDb({ role: "tester" }))).inject({
			method: "POST",
			url: "/mcp",
			payload: {
				jsonrpc: "2.0",
				id: "status",
				method: "tools/call",
				params: {
					name: "change_status",
					arguments: { projectId, issueId: projectId, status: "verified" },
				},
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().result).toMatchObject({ isError: true });
		expect(listIssues).not.toHaveBeenCalled();
	});

	it("maps invalid bearer credentials to the shared unauthorized error", async () => {
		authenticateApiToken.mockRejectedValue(new UnauthorizedError());
		const response = await (await createApp(createDb(undefined))).inject({
			method: "POST",
			url: "/mcp",
			payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({
			error: { code: "UNAUTHORIZED", message: "Session required" },
		});
	});
});
