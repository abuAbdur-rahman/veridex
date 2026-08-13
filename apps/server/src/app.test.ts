import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Veridex server", () => {
	it("reports service health", async () => {
		const app = buildApp({
			HOST: "127.0.0.1",
			PORT: 3001,
			NODE_ENV: "test",
		});
		apps.push(app);

		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			status: "ok",
			service: "veridex-server",
		});
	});

	it("adds security headers", async () => {
		const app = buildApp({
			HOST: "127.0.0.1",
			PORT: 3001,
			NODE_ENV: "test",
		});
		apps.push(app);

		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.headers["x-content-type-options"]).toBe("nosniff");
		expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
	});
});
