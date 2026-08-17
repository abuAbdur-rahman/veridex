import { describe, expect, it, vi } from "vitest";
import type { Database } from "../db/client.js";
import { createTeam, listTeamMembers, listTeams } from "./team.service.js";

function createQueryDatabase(result: Array<Record<string, unknown>>) {
	return {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(async () => result),
				})),
			})),
		})),
	} as unknown as Database;
}

type TeamState = {
	teams: Array<Record<string, unknown>>;
	members: Array<Record<string, unknown>>;
};

function createTeamDatabase(failure?: "missing" | "member" | "slug") {
	const state: TeamState = { teams: [], members: [] };
	const db = {
		transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
			const draft = structuredClone(state);
			let insertCount = 0;
			const tx = {
				insert: vi.fn(() => {
					insertCount += 1;
					return {
						values: vi.fn((values: Record<string, unknown>) => {
							if (insertCount === 1) {
								if (failure === "slug") {
									throw Object.assign(new Error("duplicate"), {
										code: "23505",
										constraint_name: "team_slug_unique",
									});
								}
								const created: Record<string, unknown> & { id: string } = {
									id: "team-1",
									...values,
								};
								const returned = {
									id: created.id,
									name: created.name,
									slug: created.slug,
									isPersonal: created.isPersonal,
								};
								if (failure !== "missing") draft.teams.push(created);
								return {
									returning: vi.fn(async () =>
										failure === "missing" ? [] : [returned],
									),
								};
							}
							if (failure === "member") throw new Error("member failed");
							draft.members.push(values);
							return Promise.resolve();
						}),
					};
				}),
			};
			const result = await callback(tx);
			Object.assign(state, draft);
			return result;
		}),
	} as unknown as Database;

	return { db, state };
}

describe("team service", () => {
	it("returns the caller's team membership projection", async () => {
		const teams = [
			{
				id: "team-1",
				name: "Quality",
				slug: "quality",
				isPersonal: false,
				teamRole: "admin",
			},
		];

		await expect(listTeams(createQueryDatabase(teams), "user-1")).resolves.toEqual(
			teams,
		);
	});

	it("returns team members with identity and membership fields", async () => {
		const joinedAt = new Date("2026-08-01T00:00:00.000Z");
		const members = [
			{
				id: "user-1",
				name: "Owner",
				email: "owner@example.com",
				image: null,
				username: "owner",
				teamRole: "owner",
				invitedBy: null,
				joinedAt,
			},
		];

		await expect(
			listTeamMembers(createQueryDatabase(members), "team-1"),
		).resolves.toEqual(members);
	});

	it("creates a non-personal team and owner membership atomically", async () => {
		const { db, state } = createTeamDatabase();

		const result = await createTeam(db, "user-1", {
			name: "Quality",
			slug: "quality",
		});

		expect(result).toEqual({
			id: "team-1",
			name: "Quality",
			slug: "quality",
			isPersonal: false,
			teamRole: "owner",
		});
		expect(state.teams).toEqual([
			{
				id: "team-1",
				name: "Quality",
				slug: "quality",
				ownerId: "user-1",
				isPersonal: false,
			},
		]);
		expect(state.members).toEqual([
			{
				teamId: "team-1",
				userId: "user-1",
				teamRole: "owner",
				invitedBy: null,
			},
		]);
	});

	it("rolls back the team when owner membership creation fails", async () => {
		const { db, state } = createTeamDatabase("member");

		await expect(
			createTeam(db, "user-1", { name: "Quality", slug: "quality" }),
		).rejects.toThrow("member failed");
		expect(state).toEqual({ teams: [], members: [] });
	});

	it("maps team slug uniqueness conflicts to a typed 409 error", async () => {
		const { db } = createTeamDatabase("slug");

		await expect(
			createTeam(db, "user-1", { name: "Quality", slug: "quality" }),
		).rejects.toMatchObject({
			code: "TEAM_SLUG_TAKEN",
			message: "Team slug is unavailable",
			statusCode: 409,
		});
	});

	it("returns a typed error when team insertion returns no row", async () => {
		const { db, state } = createTeamDatabase("missing");

		await expect(
			createTeam(db, "user-1", { name: "Quality", slug: "quality" }),
		).rejects.toMatchObject({ code: "TEAM_CREATE_FAILED", statusCode: 500 });
		expect(state).toEqual({ teams: [], members: [] });
	});
});
