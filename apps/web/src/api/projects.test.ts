import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import {
	addProjectMember,
	createProject,
	deleteProject,
	listProjectMembers,
	listProjects,
	removeProjectMember,
	updateProjectMemberRole,
} from "@/api/projects";

const project = {
	id: "p1",
	teamId: "t1",
	name: "Web",
	slug: "web",
	description: null,
	projectRole: "admin",
};
const member = {
	id: "u1",
	name: "Ada",
	email: "ada@example.com",
	image: null,
	username: "ada",
	role: "admin",
	addedAt: "2026-01-01T00:00:00Z",
};
describe("projects API", () => {
	afterEach(() => vi.unstubAllGlobals());
	it("lists and creates validated projects", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(Response.json([project]))
			.mockResolvedValueOnce(new Response(JSON.stringify(project), { status: 201 }));
		vi.stubGlobal("fetch", fetchMock);
		await expect(listProjects("t1")).resolves.toEqual([project]);
		await expect(createProject("t1", { name: "Web", slug: "web" })).resolves.toEqual(project);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"/api/teams/t1/projects",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ name: "Web", slug: "web" }),
			}),
		);
	});
	it("validates member projections and sends membership mutations", async () => {
		const ref = { projectId: "p1", userId: "u2", role: "qa", addedAt: null };
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(Response.json([member]))
			.mockResolvedValueOnce(new Response(JSON.stringify(ref), { status: 201 }))
			.mockResolvedValueOnce(new Response(null, { status: 200 }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);
		await expect(listProjectMembers("p1")).resolves.toEqual([member]);
		await expect(addProjectMember("p1", { userId: "u2", role: "qa" })).resolves.toEqual(ref);
		await expect(updateProjectMemberRole("p1", "u2", "dev")).resolves.toBeNull();
		await expect(removeProjectMember("p1", "u2")).resolves.toBeNull();
	});
	it("deletes a project", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(deleteProject("p1")).resolves.toBeNull();
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/projects/p1",
			expect.objectContaining({ method: "DELETE", headers: {} }),
		);
	});
	it("rejects malformed project responses", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([{ id: "p1" }])));
		await expect(listProjects("t1")).rejects.toMatchObject({
			code: "INVALID_RESPONSE",
		} satisfies Partial<ApiError>);
	});
});
