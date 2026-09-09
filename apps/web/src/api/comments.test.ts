import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { createComment, deleteComment, listComments, updateComment } from "@/api/comments";

const comment = {
	id: "comment-1",
	issueId: "issue-1",
	authorId: "user-1",
	body: "Looks good",
	createdAt: "2026-08-24T10:00:00.000Z",
	updatedAt: "2026-08-24T10:00:00.000Z",
	deletedAt: null,
};

describe("comments API", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("lists validated comments for an issue", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json([comment]));
		vi.stubGlobal("fetch", fetchMock);

		await expect(listComments("project-1", "issue-1")).resolves.toEqual([comment]);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/projects/project-1/issues/issue-1/comments",
			expect.objectContaining({ credentials: "include" }),
		);
	});

	it("creates comments with the server request shape", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json(comment, { status: 201 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(createComment("project-1", "issue-1", "Looks good")).resolves.toEqual(comment);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/projects/project-1/issues/issue-1/comments",
			expect.objectContaining({ method: "POST", body: JSON.stringify({ body: "Looks good" }) }),
		);
	});

	it("patches comments at the project-scoped endpoint", async () => {
		const updated = { ...comment, body: "Updated", updatedAt: "2026-08-24T11:00:00.000Z" };
		const fetchMock = vi.fn().mockResolvedValue(Response.json(updated));
		vi.stubGlobal("fetch", fetchMock);

		await expect(updateComment("project-1", "comment-1", "Updated")).resolves.toEqual(updated);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/projects/project-1/comments/comment-1",
			expect.objectContaining({ method: "PATCH", body: JSON.stringify({ body: "Updated" }) }),
		);
	});

	it("deletes comments and tolerates the 204 empty response", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(deleteComment("project-1", "comment-1")).resolves.toBe(null);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/projects/project-1/comments/comment-1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("rejects malformed comment payloads", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "comment-1" })));

		await expect(updateComment("project-1", "comment-1", "x")).rejects.toMatchObject({
			code: "INVALID_RESPONSE",
		} satisfies Partial<ApiError>);
	});
});
