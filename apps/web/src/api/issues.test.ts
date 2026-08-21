import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import {
	assignIssue,
	createIssue,
	deleteIssue,
	getIssueHistory,
	listIssues,
	updateIssueStatus,
} from "@/api/issues";

const issue = {
	id: "i1",
	ticketRef: "WEB-001",
	title: "Broken",
	description: null,
	severity: "high",
	status: "backlog",
	environment: { browser: "Chrome" },
	stepsToReproduce: null,
	expectedResult: null,
	actualResult: null,
	imageUrl: null,
	projectId: "p1",
	reporterId: "u1",
	assigneeId: null,
	qaAssigneeId: null,
	developerAssigneeIds: [],
	qaAssigneeIds: [],
	testCaseId: null,
	importJobId: null,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
	closedAt: null,
};
const history = {
	id: "h1",
	issueId: "i1",
	changedBy: "u1",
	fromStatus: null,
	toStatus: "backlog",
	note: null,
	source: "web",
	changedAt: "2026-01-01T00:00:00Z",
};
describe("issues API", () => {
	afterEach(() => vi.unstubAllGlobals());
	it("encodes filters and validates issue lists", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json([issue]));
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			listIssues("p1", { status: "backlog", search: "checkout flow", limit: 20 }),
		).resolves.toEqual([issue]);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/projects/p1/issues?status=backlog&search=checkout+flow&limit=20",
			expect.anything(),
		);
	});
	it("sends create, status, assignment, history, and delete contracts", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify(issue), { status: 201 }))
			.mockResolvedValueOnce(Response.json({ ...issue, status: "in_progress" }))
			.mockResolvedValueOnce(Response.json({ ...issue, assigneeId: "u2" }))
			.mockResolvedValueOnce(Response.json([history]))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);
		await createIssue("p1", {
			title: "Broken",
			severity: "high",
			environment: { browser: "Chrome" },
		});
		await updateIssueStatus("p1", "i1", "in_progress", "Starting work");
		await assignIssue("p1", "i1", { developerAssigneeIds: ["u2"], qaAssigneeIds: [] });
		await expect(getIssueHistory("p1", "i1")).resolves.toEqual([history]);
		await expect(deleteIssue("p1", "i1")).resolves.toBeNull();
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"/api/projects/p1/issues/i1/status",
			expect.objectContaining({
				body: JSON.stringify({ status: "in_progress", note: "Starting work" }),
			}),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			"/api/projects/p1/issues/i1/assign",
			expect.objectContaining({ body: JSON.stringify({ developerAssigneeIds: ["u2"], qaAssigneeIds: [] }) }),
		);
	});
	it("rejects malformed issue history", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([{ id: "h1" }])));
		await expect(getIssueHistory("p1", "i1")).rejects.toMatchObject({
			code: "INVALID_RESPONSE",
		} satisfies Partial<ApiError>);
	});
});
