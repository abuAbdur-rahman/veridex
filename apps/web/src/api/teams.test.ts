import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { createTeam, createTeamInvite, listTeamMembers, listTeams } from "@/api/teams";

describe("teams API", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("lists validated teams using the session cookie", async () => {
		const teams = [{ id: "team-1", name: "Acme", slug: "acme", isPersonal: false, teamRole: "owner" }];
		const fetchMock = vi.fn().mockResolvedValue(Response.json(teams));
		vi.stubGlobal("fetch", fetchMock);

		await expect(listTeams()).resolves.toEqual(teams);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/teams",
			expect.objectContaining({ credentials: "include" }),
		);
	});

	it("rejects malformed member responses", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([{ id: "user-1" }])));

		await expect(listTeamMembers("team-1")).rejects.toMatchObject({
			code: "INVALID_RESPONSE",
			status: 200,
		} satisfies Partial<ApiError>);
	});

	it("creates teams and invitations with the server request shapes", async () => {
		const team = { id: "team-1", name: "Acme QA", slug: "acme-qa", isPersonal: false, teamRole: "owner" };
		const invite = {
			id: "invite-1",
			teamId: "team-1",
			email: "qa@acme.com",
			teamRole: "member",
			token: "a".repeat(43),
			expiresAt: "2026-08-23T12:00:00.000Z",
		};
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify(team), { status: 201 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(invite), { status: 201 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(createTeam({ name: "Acme QA", slug: "acme-qa" })).resolves.toEqual(team);
		await expect(createTeamInvite("team-1", { email: "qa@acme.com", teamRole: "member" })).resolves.toEqual(invite);
		expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/teams", expect.objectContaining({
			method: "POST",
			body: JSON.stringify({ name: "Acme QA", slug: "acme-qa" }),
		}));
		expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/teams/team-1/invites", expect.objectContaining({
			method: "POST",
			body: JSON.stringify({ email: "qa@acme.com", teamRole: "member" }),
		}));
	});
});
