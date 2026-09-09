import { afterEach, describe, expect, it, vi } from "vitest";
import { listApiTokens, createApiToken, revokeApiToken } from "@/api/tokens";

const token = {
	id: "t1",
	name: "CI",
	tokenPrefix: "vrx_12345678",
	lastUsedAt: null,
	expiresAt: null,
	revokedAt: null,
	createdAt: "2026-08-21T00:00:00.000Z",
};

describe("tokens API", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("lists and creates validated tokens", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(Response.json([token]))
			.mockResolvedValueOnce(new Response(JSON.stringify({ ...token, token: "vrx_secret" }), { status: 201 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(listApiTokens()).resolves.toEqual([token]);
		await expect(createApiToken(" CI ")).resolves.toMatchObject({ token: "vrx_secret" });
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"/api/tokens",
			expect.objectContaining({ method: "POST", body: JSON.stringify({ name: " CI " }) }),
		);
	});

	it("revokes a token", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(revokeApiToken("t1")).resolves.toBeNull();
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/tokens/t1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("rejects malformed token responses", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([{ id: "t1" }])));
		await expect(listApiTokens()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
	});
});
