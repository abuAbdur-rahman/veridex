import Fastify from "fastify";
import type { Database } from "../db/client.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { projectRoutes } from "./projects.js";

const {
	requireSession,
	requireTeamRole,
	requireProjectRole,
	listProjects,
	createProject,
	getProject,
	listProjectMembers,
	addProjectMember,
	updateProjectMemberRole,
	removeProjectMember,
	updateProjectName,
	deleteProject,
} = vi.hoisted(() => ({
	requireSession: vi.fn(),
	requireTeamRole: vi.fn(),
	requireProjectRole: vi.fn(),
	listProjects: vi.fn(),
	createProject: vi.fn(),
	getProject: vi.fn(),
	listProjectMembers: vi.fn(),
	addProjectMember: vi.fn(),
	updateProjectMemberRole: vi.fn(),
	removeProjectMember: vi.fn(),
	updateProjectName: vi.fn(),
	deleteProject: vi.fn(),
}));

vi.mock("../lib/auth.js", () => ({
	requireSession,
	requireTeamRole,
	requireProjectRole,
}));
vi.mock("../services/project.service.js", () => ({
	listProjects,
	createProject,
	getProject,
	listProjectMembers,
	addProjectMember,
	updateProjectMemberRole,
	removeProjectMember,
	updateProjectName,
	deleteProject,
}));

const apps: Array<ReturnType<typeof Fastify>> = [];
const teamId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";

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
	await app.register(projectRoutes);
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
	requireProjectRole.mockResolvedValue({
		session: { user: { id: "user-1" } },
		membership: { projectRole: "admin" },
	});
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("project routes", () => {
	it.each([
		["GET", "/api/teams/:teamId/projects"],
		["POST", "/api/teams/:teamId/projects"],
	] as const)("requires a session for %s %s", async (method, url) => {
		requireSession.mockRejectedValue(new UnauthorizedError());

		const response = await (
			await createApp()
		).inject({ method, url: url.replace(":teamId", teamId) });

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({
			error: { code: "UNAUTHORIZED", message: "Session required" },
		});
	});

	it("lists the authenticated user's project memberships", async () => {
		const projects = [
			{
				id: projectId,
				name: "Veridex",
				slug: "veridex",
				description: "QA tracker",
				projectRole: "admin",
			},
		];
		listProjects.mockResolvedValue(projects);

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/teams/${teamId}/projects`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(projects);
		expect(listProjects).toHaveBeenCalledWith(expect.anything(), teamId, "user-1");
	});

	it("normalizes input and returns a created project with 201", async () => {
		const created = {
			id: projectId,
			name: "Veridex",
			slug: "veridex",
			description: "QA tracker",
			teamId,
			projectRole: "admin",
		};
		createProject.mockResolvedValue(created);

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/teams/${teamId}/projects`,
			payload: {
				name: "  Veridex  ",
				slug: "  VERIDEX  ",
				description: "  QA tracker  ",
			},
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual(created);
		expect(createProject).toHaveBeenCalledWith(
			expect.anything(),
			teamId,
			"user-1",
			{ name: "Veridex", slug: "veridex", description: "QA tracker" },
		);
	});

	it.each([
		{ name: "", slug: "veridex" },
		{ name: "Veridex", slug: "bad slug" },
		{ name: "Veridex", slug: "ab" },
	])("returns the shared validation envelope for invalid project input", async (payload) => {
		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/teams/${teamId}/projects`,
			payload,
		});

		expect(response.statusCode).toBe(422);
		expect(response.json()).toMatchObject({
			error: { code: "VALIDATION_ERROR", message: "Invalid input" },
		});
		expect(createProject).not.toHaveBeenCalled();
	});

	it("requires owner or admin access to create a project", async () => {
		requireTeamRole.mockRejectedValue(new ForbiddenError());

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/teams/${teamId}/projects`,
			payload: { name: "Veridex", slug: "veridex" },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({
			error: { code: "FORBIDDEN", message: "Insufficient permissions" },
		});
		expect(requireTeamRole).toHaveBeenCalledWith(expect.anything(), teamId, [
			"owner",
			"admin",
		]);
		expect(createProject).not.toHaveBeenCalled();
	});

	it("rejects malformed team IDs before authorization", async () => {
		const response = await (await createApp()).inject({
			method: "GET",
			url: "/api/teams/not-a-uuid/projects",
		});

		expect(response.statusCode).toBe(422);
		expect(requireTeamRole).not.toHaveBeenCalled();
	});

	it("returns the project detail for a member", async () => {
		const project = {
			id: projectId,
			teamId,
			name: "Veridex",
			slug: "veridex",
			description: null,
			nextTicketNumber: 0,
			createdBy: "user-1",
		};
		getProject.mockResolvedValue(project);

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/projects/${projectId}`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(project);
		expect(getProject).toHaveBeenCalledWith(expect.anything(), projectId);
		expect(requireProjectRole).toHaveBeenCalledWith(expect.anything(), projectId, [
			"dev",
			"qa",
			"tester",
			"admin",
		]);
	});

	it("lists the authorized project member projection", async () => {
		const members = [
			{
				id: "user-2",
				name: "QA User",
				email: "qa@example.com",
				role: "qa",
				addedAt: "2026-08-01T00:00:00.000Z",
			},
		];
		listProjectMembers.mockResolvedValue(members);

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/projects/${projectId}/members`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(members);
		expect(listProjectMembers).toHaveBeenCalledWith(expect.anything(), projectId);
	});

	it("rejects malformed project IDs before authorization", async () => {
		const response = await (await createApp()).inject({
			method: "GET",
			url: "/api/projects/not-a-uuid/members",
		});

		expect(response.statusCode).toBe(422);
		expect(requireProjectRole).not.toHaveBeenCalled();
	});

	it("requires admin access to add a project member", async () => {
		requireProjectRole.mockRejectedValue(new ForbiddenError());

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/projects/${projectId}/members`,
			payload: { userId: memberId, role: "qa" },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({
			error: { code: "FORBIDDEN", message: "Insufficient permissions" },
		});
		expect(requireProjectRole).toHaveBeenCalledWith(expect.anything(), projectId, [
			"admin",
		]);
		expect(addProjectMember).not.toHaveBeenCalled();
	});

	it("adds a project member with 201", async () => {
		const member = { projectId, userId: memberId, role: "qa" };
		addProjectMember.mockResolvedValue(member);

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/projects/${projectId}/members`,
			payload: { userId: memberId, role: "qa" },
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual(member);
		expect(addProjectMember).toHaveBeenCalledWith(expect.anything(), projectId, {
			userId: memberId,
			role: "qa",
		});
	});

	it("updates a project member role", async () => {
		updateProjectMemberRole.mockResolvedValue(undefined);

		const response = await (await createApp()).inject({
			method: "PATCH",
			url: `/api/projects/${projectId}/members/${memberId}`,
			payload: { role: "dev" },
		});

		expect(response.statusCode).toBe(200);
		expect(updateProjectMemberRole).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			memberId,
			"dev",
		);
	});

	it("removes a project member with 204", async () => {
		removeProjectMember.mockResolvedValue(undefined);

		const response = await (await createApp()).inject({
			method: "DELETE",
			url: `/api/projects/${projectId}/members/${memberId}`,
		});

		expect(response.statusCode).toBe(204);
		expect(removeProjectMember).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			memberId,
		);
	});

	it("updates only project name for admins", async () => {
		updateProjectName.mockResolvedValue({ id: projectId, name: "Renamed" });

		const response = await (await createApp()).inject({
			method: "PATCH",
			url: `/api/projects/${projectId}`,
			payload: { name: "  Renamed  " },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ id: projectId, name: "Renamed" });
		expect(updateProjectName).toHaveBeenCalledWith(expect.anything(), projectId, "Renamed");
	});

	it("rejects non-name project updates at the route boundary", async () => {
		const response = await (await createApp()).inject({
			method: "PATCH",
			url: `/api/projects/${projectId}`,
			payload: { name: "Renamed", slug: "renamed" },
		});

		expect(response.statusCode).toBe(422);
		expect(updateProjectName).not.toHaveBeenCalled();
	});

	it("deletes a project with 204 for admins", async () => {
		deleteProject.mockResolvedValue(undefined);

		const response = await (await createApp()).inject({
			method: "DELETE",
			url: `/api/projects/${projectId}`,
		});

		expect(response.statusCode).toBe(204);
		expect(deleteProject).toHaveBeenCalledWith(expect.anything(), projectId);
	});

	it("requires admin access to update or delete a project", async () => {
		requireProjectRole.mockRejectedValue(new ForbiddenError());

		for (const method of ["PATCH", "DELETE"] as const) {
			const response = await (await createApp()).inject({
				method,
				url: `/api/projects/${projectId}`,
				...(method === "PATCH" ? { payload: { name: "Renamed" } } : {}),
			});

			expect(response.statusCode).toBe(403);
		}
		expect(requireProjectRole).toHaveBeenCalledWith(expect.anything(), projectId, ["admin"]);
		expect(updateProjectName).not.toHaveBeenCalled();
		expect(deleteProject).not.toHaveBeenCalled();
	});

	it("preserves typed service errors in the shared envelope", async () => {
		addProjectMember.mockRejectedValue(
			new AppError(
				"USER_NOT_TEAM_MEMBER",
				"User is not a member of this project's team",
				409,
			),
		);

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/projects/${projectId}/members`,
			payload: { userId: memberId, role: "qa" },
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toEqual({
			error: {
				code: "USER_NOT_TEAM_MEMBER",
				message: "User is not a member of this project's team",
			},
		});
	});
});
