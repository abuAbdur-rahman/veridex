import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import type { Environment } from "./config.js";
import { createDb } from "./db/client.js";
import { AppError } from "./lib/errors.js";

const testEnvironment: Environment = {
	HOST: "127.0.0.1",
	PORT: 3001,
	NODE_ENV: "test",
	WEB_ORIGIN: "http://localhost:5173",
	PUBLIC_MCP_URL: "http://localhost:3001/mcp",
	DATABASE_URL: "postgresql://veridex:veridex@localhost:5432/veridex_dev",
	DATABASE_URL_UNPOOLED:
		"postgresql://veridex:veridex@localhost:5432/veridex_dev",
	BETTER_AUTH_SECRET: "test-secret-that-is-long-enough",
	BETTER_AUTH_URL: "http://localhost:3001",
	R2_BUCKET_NAME: "veridex-uploads",
	TRUST_PROXY: false,
};

const apps: Array<ReturnType<typeof buildApp>> = [];

function createApp(environment: Environment = testEnvironment) {
	const app = buildApp(environment);
	apps.push(app);
	return app;
}

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
	vi.restoreAllMocks();
});

describe("Veridex server", () => {
	it("reports service health", async () => {
		const response = await createApp().inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			status: "ok",
			service: "veridex-server",
		});
	});

	it("adds security headers", async () => {
		const response = await createApp().inject({ method: "GET", url: "/health" });

		expect(response.headers["x-content-type-options"]).toBe("nosniff");
		expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
	});

	it("returns the standard error shape for unknown routes", async () => {
		const response = await createApp().inject({
			method: "GET",
			url: "/does-not-exist",
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toEqual({
			error: {
				code: "NOT_FOUND",
				message: "Route GET:/does-not-exist not found",
			},
		});
	});

	it("mounts auth without disabled-provider warnings", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const response = await createApp().inject({
			method: "GET",
			url: "/api/auth/get-session",
		});
		const warningText = warn.mock.calls.flat().join(" ");

		expect(response.statusCode).toBe(200);
		expect(response.json()).toBeNull();
		expect(warningText).not.toContain("Social provider");
	});

	it("allows only the configured browser origin with credentials", async () => {
		const app = createApp();
		const allowed = await app.inject({
			method: "OPTIONS",
			url: "/health",
			headers: {
				origin: testEnvironment.WEB_ORIGIN,
				"access-control-request-method": "GET",
			},
		});
		const untrusted = await app.inject({
			method: "OPTIONS",
			url: "/health",
			headers: {
				origin: "https://untrusted.example",
				"access-control-request-method": "GET",
			},
		});

		expect(allowed.headers["access-control-allow-origin"]).toBe(
			testEnvironment.WEB_ORIGIN,
		);
		expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
		expect(untrusted.headers["access-control-allow-origin"]).toBeUndefined();
	});

	it("closes the underlying PostgreSQL client exactly once", async () => {
		const db = createDb(testEnvironment.DATABASE_URL);
		const end = vi.spyOn(db.$client, "end");
		const app = buildApp(testEnvironment, { db });

		await app.close();
		await app.close();

		expect(end).toHaveBeenCalledTimes(1);
	});

	it("preserves explicit application errors and safe details", async () => {
		const app = createApp();
		app.get("/app-error", async () => {
			throw new AppError("CONFLICT", "Already exists", 409, {
				field: "username",
			});
		});

		const response = await app.inject({ method: "GET", url: "/app-error" });

		expect(response.statusCode).toBe(409);
		expect(response.json()).toEqual({
			error: {
				code: "CONFLICT",
				message: "Already exists",
				details: { field: "username" },
			},
		});
	});

	it("maps Fastify validation failures to a sanitized 422 envelope", async () => {
		const app = createApp();
		app.post(
			"/validated",
			{
				schema: {
					body: {
						type: "object",
						required: ["name"],
						properties: { name: { type: "string", minLength: 1 } },
					},
				},
			},
			async () => ({ ok: true }),
		);

		const response = await app.inject({
			method: "POST",
			url: "/validated",
			payload: {},
		});
		const body = response.json();

		expect(response.statusCode).toBe(422);
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toBe("Invalid input");
		expect(body.error.details).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ keyword: "required" }),
			]),
		);
	});

	it("maps malformed JSON to a recognized Fastify client error", async () => {
		const app = createApp();
		app.post("/json", async () => ({ ok: true }));

		const response = await app.inject({
			method: "POST",
			url: "/json",
			headers: { "content-type": "application/json" },
			payload: "{broken",
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: { code: "MALFORMED_JSON", message: "Malformed JSON body" },
		});
	});

	it("returns the shared rate-limit envelope", async () => {
		const app = createApp();
		const responses = await Promise.all(
			Array.from({ length: 201 }, () =>
				app.inject({ method: "GET", url: "/health" }),
			),
		);
		const response = responses.at(-1);

		expect(response?.statusCode).toBe(429);
		expect(response?.json()).toEqual({
			error: { code: "RATE_LIMITED", message: "Too many requests" },
		});
	});

	it.each([
		["unexpected exception", new Error("private database detail")],
		[
			"unrecognized statusCode property",
			Object.assign(new Error("private forged detail"), { statusCode: 418 }),
		],
		[
			"unrecognized validation property",
			Object.assign(new Error("private forged validation"), {
				validation: [{ message: "forged" }],
			}),
		],
	])("returns an opaque 500 for an %s", async (_label, thrownError) => {
		const app = createApp();
		app.get("/unexpected", async () => {
			throw thrownError;
		});

		const response = await app.inject({ method: "GET", url: "/unexpected" });

		expect(response.statusCode).toBe(500);
		expect(response.json()).toEqual({
			error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
		});
		expect(response.body).not.toContain(thrownError.message);
	});
});
