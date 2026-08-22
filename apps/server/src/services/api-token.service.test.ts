import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../db/client.js";
import {
	authenticateApiToken,
	createApiToken,
	listApiTokens,
	revokeApiToken,
} from "./api-token.service.js";

describe("API token service", () => {
	it("lists only safe metadata for the current user", async () => {
		const createdAt = new Date("2026-08-21T00:00:00.000Z");
		const tokens = [
			{
				id: "11111111-1111-4111-8111-111111111111",
				name: "Local MCP",
				tokenPrefix: "vrx_example1",
				lastUsedAt: null,
				expiresAt: null,
				revokedAt: null,
				createdAt,
			},
		];
		const where = vi.fn(() => ({ orderBy: vi.fn(async () => tokens) }));
		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({ where })),
			})),
		} as unknown as Database;

		await expect(listApiTokens(db, "user-1")).resolves.toEqual(tokens);
		expect(where).toHaveBeenCalledOnce();
	});

	it("returns plaintext once while persisting only its SHA-256 hash", async () => {
		let inserted: Record<string, unknown> | undefined;
		const db = {
			insert: vi.fn(() => ({
				values: vi.fn((values: Record<string, unknown>) => {
					inserted = values;
					return {
						returning: vi.fn(async () => [
							{
								id: "11111111-1111-4111-8111-111111111111",
								name: values.name,
								tokenPrefix: values.tokenPrefix,
								lastUsedAt: null,
								expiresAt: null,
								revokedAt: null,
								createdAt: new Date("2026-08-21T00:00:00.000Z"),
							},
						]),
					};
				}),
			})),
		} as unknown as Database;

		const created = await createApiToken(db, "user-1", "Local MCP");

		expect(created.token).toMatch(/^vrx_[A-Za-z0-9_-]{32}$/);
		expect(created.tokenPrefix).toBe(created.token.slice(0, 12));
		expect(inserted).toEqual({
			userId: "user-1",
			name: "Local MCP",
			tokenPrefix: created.token.slice(0, 12),
			tokenHash: createHash("sha256").update(created.token).digest("hex"),
		});
		expect(Object.values(inserted ?? {})).not.toContain(created.token);
	});

	it("soft-revokes a token only when owned by the current user", async () => {
		const revokedAt = new Date("2026-08-21T01:00:00.000Z");
		const returning = vi.fn(async () => [{ id: "token-1" }]);
		const where = vi.fn(() => ({ returning }));
		const set = vi.fn(() => ({ where }));
		const db = {
			update: vi.fn(() => ({ set })),
		} as unknown as Database;

		await expect(
			revokeApiToken(db, "user-1", "11111111-1111-4111-8111-111111111111", revokedAt),
		).resolves.toBeUndefined();
		expect(set).toHaveBeenCalledWith({ revokedAt });
		expect(where).toHaveBeenCalledOnce();
	});

	it("returns not found when the token is missing or belongs to another user", async () => {
		const db = {
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({ returning: vi.fn(async () => []) })),
				})),
			})),
		} as unknown as Database;

		await expect(
			revokeApiToken(db, "user-1", "11111111-1111-4111-8111-111111111111"),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "API token not found",
			statusCode: 404,
		});
	});

	it("authenticates an active token and updates last-used time", async () => {
		const token = `vrx_${"a".repeat(32)}`;
		const tokenRow = { id: "token-1", userId: "user-1" };
		const limit = vi.fn(async () => [tokenRow]);
		const where = vi.fn(() => ({ limit }));
		const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({ where })),
			})),
			update: vi.fn(() => ({ set })),
		} as unknown as Database;

		await expect(authenticateApiToken(db, `Bearer ${token}`)).resolves.toEqual({
			userId: "user-1",
			tokenId: "token-1",
		});
		expect(limit).toHaveBeenCalledOnce();
		expect(set).toHaveBeenCalledWith({ lastUsedAt: expect.any(Date) });
	});

	it.each([undefined, "Basic credentials", "Bearer vrx_short"]) (
		"rejects malformed authorization header %s",
		async (authorizationHeader) => {
			const db = {} as Database;
			await expect(authenticateApiToken(db, authorizationHeader)).rejects.toMatchObject({
				code: "UNAUTHORIZED",
				statusCode: 401,
			});
		},
	);
});
