import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { acceptInvite, validateInvite } from "@/api/invites";

describe("invites API", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("validates public invite tokens", async () => {
		const token = "a".repeat(43);
		const invite = {
			id: "invite-1",
			teamId: "team-1",
			teamName: "Acme",
			teamSlug: "acme",
			email: "qa@acme.com",
			teamRole: "member",
			expiresAt: "2026-08-23T12:00:00.000Z",
		};
		const fetchMock = vi.fn().mockResolvedValue(Response.json(invite));
		vi.stubGlobal("fetch", fetchMock);

		await expect(validateInvite(token)).resolves.toEqual(invite);
		expect(fetchMock).toHaveBeenCalledWith(
			`/api/invites/${token}/validate`,
			expect.objectContaining({ credentials: "include" }),
		);
	});

	it("accepts an invite using the authenticated session", async () => {
		const token = "b".repeat(43);
		const team = {
			id: "team-1",
			name: "Acme",
			slug: "acme",
			isPersonal: false,
			teamRole: "member",
		};
		const fetchMock = vi.fn().mockResolvedValue(Response.json(team));
		vi.stubGlobal("fetch", fetchMock);

		await expect(acceptInvite(token)).resolves.toEqual(team);
		expect(fetchMock).toHaveBeenCalledWith(
			`/api/invites/${token}/accept`,
			expect.objectContaining({ method: "POST", credentials: "include" }),
		);
	});

	it("rejects malformed successful validation responses", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ teamName: "Acme" })));

		await expect(validateInvite("c".repeat(43))).rejects.toMatchObject({
			code: "INVALID_RESPONSE",
			status: 200,
		} satisfies Partial<ApiError>);
	});
});
