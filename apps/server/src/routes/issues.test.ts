import Fastify from "fastify";
import type { Database } from "../db/client.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { issueRoutes } from "./issues.js";

const {
	requireSession,
	requireProjectRole,
	createIssue,
	getIssue,
	listIssues,
	updateIssue,
	updateStatus,
	assignIssue,
	getIssueStatusHistory,
	deleteIssue,
	getProjectMemberDirectory,
} = vi.hoisted(() => ({
	requireSession: vi.fn(),
	requireProjectRole: vi.fn(),
	createIssue: vi.fn(),
	getIssue: vi.fn(),
	listIssues: vi.fn(),
	updateIssue: vi.fn(),
	updateStatus: vi.fn(),
	assignIssue: vi.fn(),
	getIssueStatusHistory: vi.fn(),
	deleteIssue: vi.fn(),
	getProjectMemberDirectory: vi.fn(),
}));

vi.mock("../lib/auth.js", () => ({
	requireSession,
	requireProjectRole,
}));
vi.mock("../services/issue.service.js", () => ({
	createIssue,
	getIssue,
	listIssues,
	updateIssue,
	updateStatus,
	assignIssue,
	getIssueStatusHistory,
	deleteIssue,
	getProjectMemberDirectory,
	withMemberProjection: vi.fn((_directory: unknown, issue: unknown) => issue),
}));

const apps: Array<ReturnType<typeof Fastify>> = [];
const projectId = "22222222-2222-4222-8222-222222222222";
const issueId = "33333333-3333-4333-8333-333333333333";

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
	await app.register(issueRoutes);
	apps.push(app);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	requireSession.mockResolvedValue({ user: { id: "user-1" } });
	requireProjectRole.mockResolvedValue({
		session: { user: { id: "user-1" } },
		membership: { role: "admin" },
	});
	getProjectMemberDirectory.mockResolvedValue(new Map());
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("issue routes", () => {
	it.each([
		["GET", `/api/projects/${projectId}/issues`],
		["POST", `/api/projects/${projectId}/issues`],
		["GET", `/api/projects/${projectId}/issues/${issueId}`],
		["PATCH", `/api/projects/${projectId}/issues/${issueId}`],
		["PATCH", `/api/projects/${projectId}/issues/${issueId}/status`],
		["PATCH", `/api/projects/${projectId}/issues/${issueId}/assign`],
		["GET", `/api/projects/${projectId}/issues/${issueId}/history`],
		["DELETE", `/api/projects/${projectId}/issues/${issueId}`],
	] as const)("requires a session for %s %s", async (method, url) => {
		requireSession.mockRejectedValue(new UnauthorizedError());

		const response = await (await createApp()).inject({ method, url });

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({
			error: { code: "UNAUTHORIZED", message: "Session required" },
		});
	});

	it.each([
		["GET", `/api/projects/${projectId}/issues`],
		["POST", `/api/projects/${projectId}/issues`],
		["GET", `/api/projects/${projectId}/issues/${issueId}`],
		["PATCH", `/api/projects/${projectId}/issues/${issueId}`],
		["PATCH", `/api/projects/${projectId}/issues/${issueId}/status`],
		["PATCH", `/api/projects/${projectId}/issues/${issueId}/assign`],
		["GET", `/api/projects/${projectId}/issues/${issueId}/history`],
		["DELETE", `/api/projects/${projectId}/issues/${issueId}`],
	] as const)("requires project membership for %s %s", async (method, url) => {
		requireProjectRole.mockRejectedValue(new ForbiddenError());

		const response = await (await createApp()).inject({ method, url });

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({
			error: { code: "FORBIDDEN", message: "Insufficient permissions" },
		});
	});

	it("rejects malformed project IDs before authorization", async () => {
		const response = await (await createApp()).inject({
			method: "GET",
			url: "/api/projects/not-a-uuid/issues",
		});

		expect(response.statusCode).toBe(422);
		expect(response.json()).toMatchObject({
			error: { code: "VALIDATION_ERROR", message: "Invalid input" },
		});
		expect(requireProjectRole).not.toHaveBeenCalled();
	});

	it("creates an issue with 201", async () => {
		const issue = {
			id: issueId,
			projectId,
			ticketRef: "MYP-001",
			title: "Test",
			status: "backlog",
		};
		createIssue.mockResolvedValue(issue);

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/projects/${projectId}/issues`,
			payload: { title: " Test " },
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual(issue);
		expect(createIssue).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			"user-1",
			{ title: "Test" },
		);
	});

	it("accepts an HTTPS image URL when creating an issue", async () => {
		createIssue.mockResolvedValue({ id: issueId, imageUrl: "https://drive.google.com/image.png" });

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/projects/${projectId}/issues`,
			payload: {
				title: "Screenshot attached",
				imageUrl: "https://drive.google.com/image.png",
			},
		});

		expect(response.statusCode).toBe(201);
		expect(createIssue).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			"user-1",
			{
				title: "Screenshot attached",
				imageUrl: "https://drive.google.com/image.png",
			},
		);
	});

	it("rejects insecure issue image URLs", async () => {
		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/projects/${projectId}/issues`,
			payload: { title: "Screenshot attached", imageUrl: "http://example.com/image.png" },
		});

		expect(response.statusCode).toBe(422);
		expect(createIssue).not.toHaveBeenCalled();
	});

	it("lists issues with parsed filters", async () => {
		listIssues.mockResolvedValue([]);

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/projects/${projectId}/issues?status=in_progress&limit=10`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual([]);
		expect(listIssues).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			"user-1",
			{ status: "in_progress", limit: 10 },
		);
	});

	it("returns a single issue", async () => {
		getIssue.mockResolvedValue({ id: issueId, title: "Test" });

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/projects/${projectId}/issues/${issueId}`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ id: issueId, title: "Test" });
		expect(getIssue).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			issueId,
			"user-1",
		);
	});

	it("updates an issue", async () => {
		updateIssue.mockResolvedValue({ id: issueId, title: "Updated" });

		const response = await (await createApp()).inject({
			method: "PATCH",
			url: `/api/projects/${projectId}/issues/${issueId}`,
			payload: { title: "Updated", description: null },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ id: issueId, title: "Updated" });
		expect(updateIssue).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			issueId,
			"user-1",
			{ title: "Updated", description: null },
		);
	});

	it("accepts a generated image path and permits removing it", async () => {
		const imageUrl = `/api/projects/${projectId}/issue-images/44444444-4444-4444-8444-444444444444.png`;
		updateIssue.mockResolvedValue({ id: issueId, imageUrl });

		const app = await createApp();
		const setResponse = await app.inject({
			method: "PATCH",
			url: `/api/projects/${projectId}/issues/${issueId}`,
			payload: { imageUrl },
		});
		const removeResponse = await app.inject({
			method: "PATCH",
			url: `/api/projects/${projectId}/issues/${issueId}`,
			payload: { imageUrl: null },
		});

		expect(setResponse.statusCode).toBe(200);
		expect(removeResponse.statusCode).toBe(200);
		expect(updateIssue).toHaveBeenNthCalledWith(
			1,
			expect.anything(),
			projectId,
			issueId,
			"user-1",
			{ imageUrl },
		);
		expect(updateIssue).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			projectId,
			issueId,
			"user-1",
			{ imageUrl: null },
		);
	});

	it("passes source 'web' and note to updateStatus", async () => {
		updateStatus.mockResolvedValue({ id: issueId, status: "in_progress" });

		const response = await (await createApp()).inject({
			method: "PATCH",
			url: `/api/projects/${projectId}/issues/${issueId}/status`,
			payload: { status: "in_progress", note: "Starting work" },
		});

		expect(response.statusCode).toBe(200);
		expect(updateStatus).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			issueId,
			"user-1",
			"in_progress",
			"web",
			"Starting work",
			"admin",
		);
	});

	const assigneeId = "44444444-4444-4444-8444-444444444444";
	const qaAssigneeId = "55555555-5555-4555-8555-555555555555";

	it("requires qa or admin role to assign", async () => {
		assignIssue.mockResolvedValue({
			id: issueId,
			developerAssigneeIds: [assigneeId],
			qaAssigneeIds: [qaAssigneeId],
		});

		const response = await (await createApp()).inject({
			method: "PATCH",
			url: `/api/projects/${projectId}/issues/${issueId}/assign`,
			payload: {
				developerAssigneeIds: [assigneeId],
				qaAssigneeIds: [qaAssigneeId],
			},
		});

		expect(response.statusCode).toBe(200);
		expect(requireProjectRole).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			["qa", "admin"],
		);
		expect(assignIssue).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			issueId,
			"user-1",
			[assigneeId],
			[qaAssigneeId],
			"web",
		);
	});

	it("returns issue status history", async () => {
		getIssueStatusHistory.mockResolvedValue([]);

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/projects/${projectId}/issues/${issueId}/history`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual([]);
		expect(getIssueStatusHistory).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			issueId,
			"user-1",
		);
	});

	it("deletes an issue with 204", async () => {
		deleteIssue.mockResolvedValue(undefined);

		const response = await (await createApp()).inject({
			method: "DELETE",
			url: `/api/projects/${projectId}/issues/${issueId}`,
		});

		expect(response.statusCode).toBe(204);
		expect(requireProjectRole).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			["admin"],
		);
		expect(deleteIssue).toHaveBeenCalledWith(
			expect.anything(),
			projectId,
			issueId,
			"user-1",
		);
	});
});
