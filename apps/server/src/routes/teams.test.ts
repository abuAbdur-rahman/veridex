import Fastify from "fastify";
import type { Database } from "../db/client.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { teamRoutes } from "./teams.js";

const { requireSession, requireTeamRole, listTeams, createTeam, listTeamMembers } =
	vi.hoisted(() => ({
		requireSession: vi.fn(),
		requireTeamRole: vi.fn(),
		listTeams: vi.fn(),
		createTeam: vi.fn(),
		listTeamMembers: vi.fn(),
	}));

vi.mock("../lib/auth.js", () => ({ requireSession, requireTeamRole }));
vi.mock("../services/team.service.js", () => ({
	listTeams,
	createTeam,
	listTeamMembers,
}));

const apps: Array<ReturnType<typeof Fastify>> = [];
const teamId = "11111111-1111-4111-8111-111111111111";

async function createApp() {
	const app = Fastify({ logger: false });
	app.decorate("db", {} as Database);
	app.setErrorHandler((error, _request, reply) => {
		if (error instanceof AppError) {
			return reply.status(error.statusCode).send({
				error: {
					code: error.code,
					message: error.message,
					...(error.details === undefined ? {} : { details: error.details }),
				},
			});
		}
		return reply.status(500).send({
			error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
		});
	});
	await app.register(teamRoutes);
	apps.push(app);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	requireSession.mockResolvedValue({ user: { id: "user-1" } });
	requireTeamRole.mockResolvedValue({
		session: { user: { id: "user-1" } },
		membership: { teamRole: "owner" },
	});
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("team routes", () => {
	it.each([
		["GET", "/api/teams", undefined],
		["POST", "/api/teams", { name: "Quality", slug: "quality" }],
	] as const)("requires a session for %s %s", async (method, url, payload) => {
		requireSession.mockRejectedValue(new UnauthorizedError());

		const response = await (await createApp()).inject({ method, url, payload });

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({
			error: { code: "UNAUTHORIZED", message: "Session required" },
		});
	});

	it("lists the authenticated user's team memberships", async () => {
		const teams = [
			{
				id: teamId,
				name: "Quality",
				slug: "quality",
				isPersonal: false,
				teamRole: "admin",
			},
		];
		listTeams.mockResolvedValue(teams);

		const response = await (await createApp()).inject({
			method: "GET",
			url: "/api/teams",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(teams);
		expect(listTeams).toHaveBeenCalledWith(expect.anything(), "user-1");
	});

	it("normalizes input and returns a created team with 201", async () => {
		const created = {
			id: teamId,
			name: "Quality Team",
			slug: "quality_team",
			isPersonal: false,
			teamRole: "owner",
		};
		createTeam.mockResolvedValue(created);

		const response = await (await createApp()).inject({
			method: "POST",
			url: "/api/teams",
			payload: { name: "  Quality Team  ", slug: "  QUALITY_TEAM  " },
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual(created);
		expect(createTeam).toHaveBeenCalledWith(expect.anything(), "user-1", {
			name: "Quality Team",
			slug: "quality_team",
		});
	});

	it.each([
		{ name: "", slug: "quality" },
		{ name: "Quality", slug: "bad slug" },
		{ name: "Quality", slug: "ab" },
	])("returns the shared validation envelope for invalid team input", async (payload) => {
		const response = await (await createApp()).inject({
			method: "POST",
			url: "/api/teams",
			payload,
		});

		expect(response.statusCode).toBe(422);
		expect(response.json()).toMatchObject({
			error: { code: "VALIDATION_ERROR", message: "Invalid input" },
		});
		expect(createTeam).not.toHaveBeenCalled();
	});

	it("requires owner or admin access to list members", async () => {
		requireTeamRole.mockRejectedValue(new ForbiddenError());

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/teams/${teamId}/members`,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({
			error: { code: "FORBIDDEN", message: "Insufficient permissions" },
		});
		expect(requireTeamRole).toHaveBeenCalledWith(expect.anything(), teamId, [
			"owner",
			"admin",
		]);
		expect(listTeamMembers).not.toHaveBeenCalled();
	});

	it("rejects malformed team IDs before authorization", async () => {
		const response = await (await createApp()).inject({
			method: "GET",
			url: "/api/teams/not-a-uuid/members",
		});

		expect(response.statusCode).toBe(422);
		expect(requireTeamRole).not.toHaveBeenCalled();
	});

	it("returns the authorized team member projection", async () => {
		const members = [
			{
				id: "user-2",
				name: "QA User",
				email: "qa@example.com",
				teamRole: "member",
			},
		];
		listTeamMembers.mockResolvedValue(members);

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/teams/${teamId}/members`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(members);
		expect(listTeamMembers).toHaveBeenCalledWith(expect.anything(), teamId);
	});

	it("preserves typed service errors in the shared envelope", async () => {
		createTeam.mockRejectedValue(
			new AppError("TEAM_SLUG_TAKEN", "Team slug is unavailable", 409),
		);

		const response = await (await createApp()).inject({
			method: "POST",
			url: "/api/teams",
			payload: { name: "Quality", slug: "quality" },
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toEqual({
			error: {
				code: "TEAM_SLUG_TAKEN",
				message: "Team slug is unavailable",
			},
		});
	});
});
