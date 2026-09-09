import { describe, expect, it, vi } from "vitest";
import type { Database } from "../db/client.js";
import { project, projectMember, teamMember } from "../db/schema/index.js";
import {
	addProjectMember,
	createProject,
	getProject,
	listProjectMembers,
	listProjects,
	removeProjectMember,
	deleteProject,
	updateProjectName,
	updateProjectMemberRole,
} from "./project.service.js";

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

function createLookupDatabase(result: Array<Record<string, unknown>>) {
	return {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => result),
				})),
			})),
		})),
	} as unknown as Database;
}

type ProjectState = {
	projects: Array<Record<string, unknown>>;
	members: Array<Record<string, unknown>>;
};

function createProjectDatabase(failure?: "missing" | "member" | "slug") {
	const state: ProjectState = { projects: [], members: [] };
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
										constraint_name: "project_team_slug_unique",
									});
								}
								const created: Record<string, unknown> & { id: string } = {
									id: "project-1",
									...values,
								};
								const returned = {
									id: created.id,
									name: created.name,
									slug: created.slug,
									description: created.description,
									teamId: created.teamId,
								};
								if (failure !== "missing") draft.projects.push(created);
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

function createProjectMemberDatabase(options: {
	projectRef?: Array<Record<string, unknown>>;
	teamMembers?: Array<Record<string, unknown>>;
	existingMembers?: Array<Record<string, unknown>>;
	updateReturns?: Array<Record<string, unknown>>;
	deleteReturns?: Array<Record<string, unknown>>;
	updateProjectReturns?: Array<Record<string, unknown>>;
	adminCount?: number;
} = {}) {
	const projectRef = options.projectRef ?? [
		{ teamId: "team-1", createdBy: "creator-1" },
	];
	const teamMembers = options.teamMembers ?? [{ userId: "user-2" }];
	const existingMembers = options.existingMembers ?? [];
	const updateReturns = options.updateReturns ?? [{ userId: "user-2" }];
	const deleteReturns = options.deleteReturns ?? [{ userId: "user-2" }];
	const updateProjectReturns = options.updateProjectReturns ?? [{ id: "project-1", name: "Renamed" }];
	const adminCount = options.adminCount ?? 3;
	const addedAt = new Date("2026-08-01T00:00:00.000Z");
	return {
		select: vi.fn((selection?: Record<string, unknown>) => ({
			from: vi.fn((table: unknown) => {
				if (table === project) {
					return {
						where: vi.fn(() => ({
							limit: vi.fn(async () => projectRef),
						})),
					};
				}
				if (table === teamMember) {
					return {
						where: vi.fn(() => ({
							limit: vi.fn(async () => teamMembers),
						})),
					};
				}
				if (table === projectMember) {
					if (selection && "value" in selection) {
						return {
							where: vi.fn(async () => [{ value: adminCount }]),
						};
					}
					return {
						where: vi.fn(() => ({
							limit: vi.fn(async () => existingMembers),
						})),
					};
				}
				throw new Error("unexpected table in select");
			}),
		})),
		insert: vi.fn(() => ({
			values: vi.fn((values: Record<string, unknown>) => ({
				returning: vi.fn(async () => [{ ...values, addedAt }]),
			})),
		})),
		update: vi.fn(() => ({
			set: vi.fn((values: Record<string, unknown>) => ({
				where: vi.fn(() => ({
					returning: vi.fn(async () =>
						"name" in values ? updateProjectReturns : updateReturns,
					),
				})),
			})),
		})),
		delete: vi.fn(() => ({
			where: vi.fn(() => ({
				returning: vi.fn(async () => deleteReturns),
			})),
		})),
	} as unknown as Database;
}

describe("project service", () => {
	it("returns the caller's project membership projection", async () => {
		const projects = [
			{
				id: "project-1",
				name: "QA Portal",
				slug: "qa-portal",
				description: null,
				projectRole: "qa",
			},
		];

		await expect(
			listProjects(createQueryDatabase(projects), "team-1", "user-1"),
		).resolves.toEqual(projects);
	});

	it("returns a single project detail row", async () => {
		const createdAt = new Date("2026-08-01T00:00:00.000Z");
		const updatedAt = new Date("2026-08-01T00:00:00.000Z");
		const projectRow = [
			{
				id: "project-1",
				teamId: "team-1",
				name: "QA Portal",
				slug: "qa-portal",
				description: null,
				nextTicketNumber: 0,
				createdBy: "user-1",
				createdAt,
				updatedAt,
			},
		];

		await expect(
			getProject(createLookupDatabase(projectRow), "project-1"),
		).resolves.toEqual(projectRow[0]);
	});

	it("returns project members with identity and membership fields", async () => {
		const addedAt = new Date("2026-08-01T00:00:00.000Z");
		const members = [
			{
				id: "user-1",
				name: "Creator",
				email: "creator@example.com",
				image: null,
				username: "creator",
				role: "admin",
				addedAt,
			},
		];

		await expect(
			listProjectMembers(createQueryDatabase(members), "project-1"),
		).resolves.toEqual(members);
	});

	it("creates a project and the creator's admin membership atomically", async () => {
		const { db, state } = createProjectDatabase();

		const result = await createProject(db, "team-1", "user-1", {
			name: "QA Portal",
			slug: "qa-portal",
		});

		expect(result).toEqual({
			id: "project-1",
			name: "QA Portal",
			slug: "qa-portal",
			teamId: "team-1",
			projectRole: "admin",
		});
		expect(state.projects).toEqual([
			{
				id: "project-1",
				teamId: "team-1",
				name: "QA Portal",
				slug: "qa-portal",
				createdBy: "user-1",
			},
		]);
		expect(state.members).toEqual([
			{
				projectId: "project-1",
				userId: "user-1",
				role: "admin",
			},
		]);
	});

	it("rolls back the project when admin membership creation fails", async () => {
		const { db, state } = createProjectDatabase("member");

		await expect(
			createProject(db, "team-1", "user-1", {
				name: "QA Portal",
				slug: "qa-portal",
			}),
		).rejects.toThrow("member failed");
		expect(state).toEqual({ projects: [], members: [] });
	});

	it("maps project slug uniqueness conflicts to a typed 409 error", async () => {
		const { db } = createProjectDatabase("slug");

		await expect(
			createProject(db, "team-1", "user-1", {
				name: "QA Portal",
				slug: "qa-portal",
			}),
		).rejects.toMatchObject({
			code: "PROJECT_SLUG_TAKEN",
			message: "Project slug is unavailable in this team",
			statusCode: 409,
		});
	});

	it("returns a typed error when project insertion returns no row", async () => {
		const { db, state } = createProjectDatabase("missing");

		await expect(
			createProject(db, "team-1", "user-1", {
				name: "QA Portal",
				slug: "qa-portal",
			}),
		).rejects.toMatchObject({
			code: "PROJECT_CREATE_FAILED",
			statusCode: 500,
		});
		expect(state).toEqual({ projects: [], members: [] });
	});

	it("adds a team member to the project", async () => {
		const db = createProjectMemberDatabase();

		const member = await addProjectMember(db, "project-1", {
			userId: "user-2",
			role: "qa",
		});

		expect(member).toEqual({
			projectId: "project-1",
			userId: "user-2",
			role: "qa",
			addedAt: new Date("2026-08-01T00:00:00.000Z"),
		});
	});

	it("rejects adding a user who is not a member of the project's team", async () => {
		const db = createProjectMemberDatabase({ teamMembers: [] });

		await expect(
			addProjectMember(db, "project-1", { userId: "user-2", role: "qa" }),
		).rejects.toMatchObject({
			code: "USER_NOT_TEAM_MEMBER",
			statusCode: 409,
		});
	});

	it("rejects adding a user who is already a project member", async () => {
		const db = createProjectMemberDatabase({
			existingMembers: [{ userId: "user-2" }],
		});

		await expect(
			addProjectMember(db, "project-1", { userId: "user-2", role: "qa" }),
		).rejects.toMatchObject({
			code: "MEMBER_ALREADY_EXISTS",
			statusCode: 409,
		});
	});

	it("updates a non-creator member's role", async () => {
		const db = createProjectMemberDatabase({
			existingMembers: [{ userId: "user-2", role: "qa" }],
		});

		await expect(
			updateProjectMemberRole(db, "project-1", "user-2", "qa"),
		).resolves.toEqual({ userId: "user-2" });
	});

	it("rejects updating a user who is not a project member", async () => {
		const db = createProjectMemberDatabase({ updateReturns: [] });

		await expect(
			updateProjectMemberRole(db, "project-1", "user-2", "qa"),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			statusCode: 404,
		});
	});

	it("rejects demoting the project creator", async () => {
		const db = createProjectMemberDatabase({
			projectRef: [{ teamId: "team-1", createdBy: "user-2" }],
		});

		await expect(
			updateProjectMemberRole(db, "project-1", "user-2", "qa"),
		).rejects.toMatchObject({
			code: "CREATOR_PROTECTED",
			statusCode: 409,
		});
	});

	it("rejects demoting the last remaining admin", async () => {
		const db = createProjectMemberDatabase({
			adminCount: 0,
			existingMembers: [{ userId: "user-2", role: "admin" }],
		});

		await expect(
			updateProjectMemberRole(db, "project-1", "user-2", "qa"),
		).rejects.toMatchObject({
			code: "LAST_ADMIN_PROTECTED",
			statusCode: 409,
		});
	});

	it("lets an admin demote a non-admin even when they are the only admin", async () => {
		const db = createProjectMemberDatabase({
			adminCount: 1,
			existingMembers: [{ userId: "user-2", role: "qa" }],
		});

		await expect(
			updateProjectMemberRole(db, "project-1", "user-2", "tester"),
		).resolves.toEqual({ userId: "user-2" });
	});

	it("removes a non-creator member", async () => {
		const db = createProjectMemberDatabase({
			existingMembers: [{ userId: "user-2", role: "qa" }],
		});

		await expect(
			removeProjectMember(db, "project-1", "user-2"),
		).resolves.toBeUndefined();
	});

	it("rejects removing a user who is not a project member", async () => {
		const db = createProjectMemberDatabase({ deleteReturns: [] });

		await expect(
			removeProjectMember(db, "project-1", "user-2"),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			statusCode: 404,
		});
	});

	it("rejects removing the project creator", async () => {
		const db = createProjectMemberDatabase({
			projectRef: [{ teamId: "team-1", createdBy: "user-2" }],
		});

		await expect(
			removeProjectMember(db, "project-1", "user-2"),
		).rejects.toMatchObject({
			code: "CREATOR_PROTECTED",
			statusCode: 409,
		});
	});

	it("rejects removing the last remaining admin", async () => {
		const db = createProjectMemberDatabase({
			adminCount: 0,
			existingMembers: [{ userId: "user-2", role: "admin" }],
		});

		await expect(
			removeProjectMember(db, "project-1", "user-2"),
		).rejects.toMatchObject({
			code: "LAST_ADMIN_PROTECTED",
			statusCode: 409,
		});
	});

	it("updates a project's name", async () => {
		const db = createProjectMemberDatabase();

		await expect(updateProjectName(db, "project-1", "Renamed")).resolves.toEqual({
			id: "project-1",
			name: "Renamed",
		});
	});

	it("rejects updating a missing project", async () => {
		const db = createProjectMemberDatabase({ projectRef: [] });

		await expect(updateProjectName(db, "project-1", "Renamed")).rejects.toMatchObject({
			code: "NOT_FOUND",
			statusCode: 404,
		});
	});

	it("permanently deletes a project", async () => {
		const db = createProjectMemberDatabase({ deleteReturns: [{ id: "project-1" }] });

		await expect(deleteProject(db, "project-1")).resolves.toBeUndefined();
	});

	it("rejects deleting a missing project", async () => {
		const db = createProjectMemberDatabase({ projectRef: [] });

		await expect(deleteProject(db, "project-1")).rejects.toMatchObject({
			code: "NOT_FOUND",
			statusCode: 404,
		});
	});
});
