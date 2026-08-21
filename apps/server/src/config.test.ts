import { describe, expect, it } from "vitest";
import { parseEnvironment } from "./config.js";

const validEnvironment = {
	WEB_ORIGIN: "http://localhost:5173",
	DATABASE_URL: "postgresql://veridex:veridex@localhost:5432/veridex_dev",
	DATABASE_URL_UNPOOLED:
		"postgresql://veridex:veridex@localhost:5432/veridex_dev",
	BETTER_AUTH_SECRET: "test-secret-that-is-long-enough",
	BETTER_AUTH_URL: "http://localhost:3001",
};

describe("parseEnvironment", () => {
	it.each(["127.0.0.1", "localhost", "::1"])(
		"accepts enabled development authentication on loopback host %s",
		(HOST) => {
			expect(() =>
				parseEnvironment({
					...validEnvironment,
					HOST,
					NODE_ENV: "development",
					DEV_AUTH_ENABLED: "true",
				}),
			).not.toThrow();
		},
	);

	it("disables development authentication by default", () => {
		expect(parseEnvironment(validEnvironment).DEV_AUTH_ENABLED).toBe(false);
	});

	it("rejects development authentication outside development", () => {
		for (const NODE_ENV of ["test", "production"] as const) {
			expect(() =>
				parseEnvironment({ ...validEnvironment, NODE_ENV, DEV_AUTH_ENABLED: "true" }),
			).toThrow();
		}
	});

	it("rejects enabled development authentication on a non-loopback host", () => {
		expect(() =>
			parseEnvironment({
				...validEnvironment,
				HOST: "0.0.0.0",
				NODE_ENV: "development",
				DEV_AUTH_ENABLED: "true",
			}),
		).toThrow();
	});

	it.each([
		["http://localhost:5173", "http://localhost:5173"],
		["https://app.veridex.example/", "https://app.veridex.example"],
	])("normalizes the web origin %s", (origin, expected) => {
		expect(parseEnvironment({ ...validEnvironment, WEB_ORIGIN: origin }).WEB_ORIGIN).toBe(
			expected,
		);
	});

	it.each([
		"ftp://app.veridex.example",
		"https://user@app.veridex.example",
		"https://app.veridex.example/path",
		"https://app.veridex.example?preview=true",
		"https://app.veridex.example#fragment",
		"not-a-url",
	])("rejects invalid web origin %s", (origin) => {
		expect(() =>
			parseEnvironment({ ...validEnvironment, WEB_ORIGIN: origin }),
		).toThrow();
	});

	it("requires the web origin", () => {
		expect(() => parseEnvironment(validEnvironment)).not.toThrow();
		expect(() =>
			parseEnvironment({ ...validEnvironment, WEB_ORIGIN: undefined }),
		).toThrow();
	});

	it.each(["postgres://user:password@localhost:5432/veridex", "postgresql://user:password@localhost:5432/veridex"])(
		"accepts PostgreSQL database URL %s",
		(databaseUrl) => {
			expect(() =>
				parseEnvironment({
					...validEnvironment,
					DATABASE_URL: databaseUrl,
					DATABASE_URL_UNPOOLED: databaseUrl,
				}),
			).not.toThrow();
		},
	);

	it.each([
		"https://localhost:5432/veridex",
		"mysql://user:password@localhost:3306/veridex",
		"not-a-url",
	])("rejects unsupported database URL %s", (databaseUrl) => {
		expect(() =>
			parseEnvironment({
				...validEnvironment,
				DATABASE_URL: databaseUrl,
			}),
		).toThrow();
		expect(() =>
			parseEnvironment({
				...validEnvironment,
				DATABASE_URL_UNPOOLED: databaseUrl,
			}),
		).toThrow();
	});

	it.each([
		[undefined, undefined],
		["google-id", "google-secret"],
	])("accepts absent or complete OAuth pairs", (clientId, clientSecret) => {
		expect(() =>
			parseEnvironment({
				...validEnvironment,
				GOOGLE_CLIENT_ID: clientId,
				GOOGLE_CLIENT_SECRET: clientSecret,
			}),
		).not.toThrow();
	});

	it.each([
		{ GOOGLE_CLIENT_ID: "google-id" },
		{ GOOGLE_CLIENT_SECRET: "google-secret" },
		{ GITHUB_CLIENT_ID: "github-id", GITHUB_CLIENT_SECRET: " " },
		{ GITHUB_CLIENT_SECRET: "github-secret" },
	])("rejects partial OAuth pair %#", (oauthEnvironment) => {
		expect(() =>
			parseEnvironment({
				...validEnvironment,
				...oauthEnvironment,
			}),
		).toThrow();
	});

	it("normalizes blank OAuth credentials to missing", () => {
		const environment = parseEnvironment({
			...validEnvironment,
			GOOGLE_CLIENT_ID: " ",
			GOOGLE_CLIENT_SECRET: "",
		});

		expect(environment.GOOGLE_CLIENT_ID).toBeUndefined();
		expect(environment.GOOGLE_CLIENT_SECRET).toBeUndefined();
	});

	it("trims the R2 bucket name and rejects a blank one", () => {
		const trimmed = parseEnvironment({
			...validEnvironment,
			R2_BUCKET_NAME: "  uploads  ",
		});
		expect(trimmed.R2_BUCKET_NAME).toBe("uploads");

		expect(() =>
			parseEnvironment({ ...validEnvironment, R2_BUCKET_NAME: "   " }),
		).toThrow();
	});

	it.each([
		[undefined, false],
		["true", true],
		["1", true],
		["false", false],
		["0", false],
	])("parses TRUST_PROXY %s", (raw, expected) => {
		const environment = parseEnvironment({
			...validEnvironment,
			TRUST_PROXY: raw,
		});
		expect(environment.TRUST_PROXY).toBe(expected);
	});
});
