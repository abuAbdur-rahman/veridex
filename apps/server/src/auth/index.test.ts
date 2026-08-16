import { describe, expect, it, vi } from "vitest";
import { createAuth } from "./index.js";
import type { Environment } from "../config.js";
import type { Database } from "../db/client.js";

vi.mock("better-auth", () => ({
	betterAuth: vi.fn((options: unknown) => options),
}));

const environment: Environment = {
	HOST: "127.0.0.1",
	PORT: 3001,
	NODE_ENV: "test",
	WEB_ORIGIN: "http://localhost:5173",
	DATABASE_URL: "postgresql://veridex:veridex@localhost:5432/veridex_dev",
	DATABASE_URL_UNPOOLED:
		"postgresql://veridex:veridex@localhost:5432/veridex_dev",
	BETTER_AUTH_SECRET: "test-secret-that-is-long-enough",
	BETTER_AUTH_URL: "http://localhost:3001",
	R2_BUCKET_NAME: "veridex-uploads",
	TRUST_PROXY: false,
};

const db = {} as Database;

describe("createAuth", () => {
	it("omits disabled social providers and trusts only the web origin", () => {
		const options = createAuth(db, environment) as unknown as {
			trustedOrigins: string[];
			socialProviders: Record<string, unknown>;
			user: { additionalFields: Record<string, { defaultValue?: unknown }> };
			advanced: { useSecureCookies: boolean };
		};

		expect(options.trustedOrigins).toEqual([environment.WEB_ORIGIN]);
		expect(options.socialProviders).toEqual({});
		expect(options.user.additionalFields.username).not.toHaveProperty(
			"defaultValue",
		);
		expect(options.user.additionalFields.defaultRole).not.toHaveProperty(
			"defaultValue",
		);
	});

	it.each([
		["test", false],
		["development", false],
		["production", true],
	] as const)("uses secure cookies only in %s", (nodeEnv, expected) => {
		const options = createAuth(db, {
			...environment,
			NODE_ENV: nodeEnv,
		}) as unknown as { advanced: { useSecureCookies: boolean } };

		expect(options.advanced.useSecureCookies).toBe(expected);
	});

	it("registers only providers with complete credentials", () => {
		const options = createAuth(db, {
			...environment,
			GOOGLE_CLIENT_ID: "google-id",
			GOOGLE_CLIENT_SECRET: "google-secret",
		}) as unknown as { socialProviders: Record<string, unknown> };

		expect(options.socialProviders).toEqual({
			google: {
				clientId: "google-id",
				clientSecret: "google-secret",
			},
		});
	});
});
