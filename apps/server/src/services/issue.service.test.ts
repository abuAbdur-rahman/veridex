import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Database } from "../db/client.js";
import {
	assignIssue,
	createIssue,
	deleteIssue,
	getIssue,
	getIssueStatusHistory,
	listIssues,
	updateIssue,
	updateStatus,
	withMemberProjection,
} from "./issue.service.js";
import {
	issues,
	project,
	projectMember,
	issueStatusHistory,
	issueAssignments,
} from "../db/schema/index.js";

const mockDb = {
	transaction: vi.fn(),
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
} as unknown as Database;

function createSelectMock(result: Array<Record<string, unknown>>) {
	const limitFn = vi.fn(async () => result);
	return vi.fn(() => ({
		from: vi.fn(() => ({
			where: vi.fn(() => Object.assign(Promise.resolve(result), { limit: limitFn })),
			limit: limitFn,
		})),
	})) as unknown as typeof mockDb.select;
}

function memberSelectMock() {
	return createSelectMock([{ userId: "user-1", role: "dev" }]);
}

describe("issue.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createIssue", () => {
		it("generates ticket_ref atomically using project.nextTicketNumber", async () => {
			mockDb.select = memberSelectMock();

			const mockTx = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => []),
						})),
					})),
				})),
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(() =>
								Promise.resolve([
									{ nextTicketNumber: 1, slug: "my-project" },
								]),
							),
						})),
					})),
				})),
				insert: vi.fn(() => ({
					values: vi.fn(() => ({
						returning: vi.fn(() =>
							Promise.resolve([{ id: "issue-1", ticketRef: "MYP-001" }]),
						),
					})),
				})),
				delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
			};

			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			const result = await createIssue(mockDb, "project-1", "user-1", {
				title: "Test Issue",
			});

			expect(result.ticketRef).toBe("MYP-001");
			expect(mockTx.update).toHaveBeenCalledWith(project);
			expect(mockTx.insert).toHaveBeenCalledWith(issues);
			expect(mockTx.insert).toHaveBeenCalledWith(issueStatusHistory);
		});

		it("throws TICKET_REF_CONFLICT on ticket_ref collision", async () => {
			mockDb.select = memberSelectMock();

			let callCount = 0;
			const mockTx = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => []),
						})),
					})),
				})),
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(() =>
								Promise.resolve([
									{ nextTicketNumber: ++callCount, slug: "my-project" },
								]),
							),
						})),
					})),
				})),
				insert: vi.fn(() => ({
					values: vi.fn(() => ({
						returning: vi.fn(() =>
							Promise.reject({
								code: "23505",
								constraint_name:
									"issues_project_ticket_ref_unique",
							}),
						),
					})),
				})),
				delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
			};

			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			await expect(
				createIssue(mockDb, "project-1", "user-1", {
					title: "Test Issue",
				}),
			).rejects.toMatchObject({ code: "TICKET_REF_CONFLICT" });
		});

		it("assigns backlog issues to the sole project member", async () => {
			mockDb.select = memberSelectMock();
			const insertedValues: unknown[] = [];
			const mockTx = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })),
				})),
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(async () => [{ nextTicketNumber: 1, slug: "solo" }]),
						})),
					})),
				})),
				insert: vi.fn((table) => ({
					values: vi.fn((values) => {
						insertedValues.push({ table, values });
						return { returning: vi.fn(async () => [{ id: "issue-1", ticketRef: "SOL-001" }]) };
					}),
				})),
				delete: vi.fn(() => ({ where: vi.fn(async () => {}) })),
			};
			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			const result = await createIssue(mockDb, "project-1", "user-1", { title: "Solo issue" });

			expect(result.developerAssigneeIds).toEqual(["user-1"]);
			expect(insertedValues).toContainEqual({
				table: issueAssignments,
				values: [{ issueId: "issue-1", userId: "user-1", role: "dev" }],
			});
		});
	});

	describe("getIssueStatusHistory", () => {
		it("rejects an issue outside the supplied project", async () => {
			const limit = vi.fn()
				.mockResolvedValueOnce([{ userId: "user-1" }])
				.mockResolvedValueOnce([]);
			mockDb.select = vi.fn(() => ({
				from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })),
			})) as unknown as typeof mockDb.select;

			await expect(getIssueStatusHistory(
				mockDb,
				"project-1",
				"other-project-issue",
				"user-1",
			)).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("updateStatus", () => {
		it("allows a valid forward transition to verified without a note", async () => {
			mockDb.select = createSelectMock([{ status: "in_qa" }]);

			const mockTx = {
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(() =>
								Promise.resolve([{ id: "issue-1", status: "verified" }]),
							),
						})),
					})),
				})),
				insert: vi.fn(() => ({
					values: vi.fn(() => Promise.resolve()),
				})),
				delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
			};

			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			const result = await updateStatus(
				mockDb,
				"project-1",
				"issue-1",
				"user-1",
				"verified",
				"web",
			);

			expect(result.status).toBe("verified");
		});

		it("rejects invalid transitions (backlog -> verified)", async () => {
			mockDb.select = createSelectMock([{ status: "backlog" }]);

			await expect(
				updateStatus(
					mockDb,
					"project-1",
					"issue-1",
					"user-1",
					"verified",
					"web",
				),
			).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
		});

		it("requires a note when moving into in_progress or backlog", async () => {
			mockDb.select = createSelectMock([{ status: "in_qa" }]);

			await expect(
				updateStatus(
					mockDb,
					"project-1",
					"issue-1",
					"user-1",
					"in_progress",
					"web",
				),
			).rejects.toMatchObject({ code: "NOTE_REQUIRED" });
		});

		it("accepts a note for a transition into in_progress", async () => {
			mockDb.select = createSelectMock([{ status: "in_qa" }]);

			const mockTx = {
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(() =>
								Promise.resolve([{ id: "issue-1", status: "in_progress" }]),
							),
						})),
					})),
				})),
				insert: vi.fn(() => ({
					values: vi.fn(() => Promise.resolve()),
				})),
				delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
			};

			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			const result = await updateStatus(
				mockDb,
				"project-1",
				"issue-1",
				"user-1",
				"in_progress",
				"web",
				"Moving back for more work",
			);

			expect(result.status).toBe("in_progress");
			expect(mockTx.insert).toHaveBeenCalledWith(issueStatusHistory);
			expect(mockTx.insert.mock.results[0].value.values).toHaveBeenCalledWith(
				expect.objectContaining({ note: "Moving back for more work" }),
			);
		});

		it("records the source in status history", async () => {
			mockDb.select = createSelectMock([{ status: "in_qa" }]);

			const mockTx = {
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(() =>
								Promise.resolve([{ id: "issue-1", status: "in_progress" }]),
							),
						})),
					})),
				})),
				insert: vi.fn(() => ({
					values: vi.fn(() => Promise.resolve()),
				})),
				delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
			};

			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			await updateStatus(
				mockDb,
				"project-1",
				"issue-1",
				"user-1",
				"in_progress",
				"mcp",
				"Moving back",
			);

			expect(mockTx.insert).toHaveBeenCalledWith(issueStatusHistory);
			expect(mockTx.insert.mock.results[0].value.values).toHaveBeenCalledWith(
				expect.objectContaining({ source: "mcp" }),
			);
		});

		it("allows dev rejection to persist as rejected", async () => {
			mockDb.select = createSelectMock([{ status: "in_qa" }]);

			const mockTx = {
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(() =>
								Promise.resolve([{ id: "issue-1", status: "rejected" }]),
							),
						})),
					})),
				})),
				insert: vi.fn(() => ({
					values: vi.fn(() => Promise.resolve()),
				})),
				delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
			};

			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			const result = await updateStatus(
				mockDb,
				"project-1",
				"issue-1",
				"user-1",
				"rejected",
				"web",
				undefined,
				"dev",
			);

			expect(result.status).toBe("rejected");
			expect(mockTx.insert.mock.results[0].value.values).toHaveBeenCalledWith(
				expect.objectContaining({ toStatus: "rejected" }),
			);
		});

		it("converts QA rejection to backlog", async () => {
			mockDb.select = createSelectMock([{ status: "in_qa" }]);

			const mockTx = {
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(() =>
								Promise.resolve([{ id: "issue-1", status: "backlog" }]),
							),
						})),
					})),
				})),
				insert: vi.fn(() => ({
					values: vi.fn(() => Promise.resolve()),
				})),
				delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
			};

			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			const result = await updateStatus(
				mockDb,
				"project-1",
				"issue-1",
				"user-1",
				"rejected",
				"web",
				"Found critical regression",
				"qa",
			);

			expect(result.status).toBe("backlog");
			expect(mockTx.insert.mock.results[0].value.values).toHaveBeenCalledWith(
				expect.objectContaining({ toStatus: "backlog" }),
			);
		});

		it("allows reopening from rejected to backlog", async () => {
			mockDb.select = createSelectMock([{ status: "rejected" }]);

			const mockTx = {
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(() =>
								Promise.resolve([{ id: "issue-1", status: "backlog" }]),
							),
						})),
					})),
				})),
				insert: vi.fn(() => ({
					values: vi.fn(() => Promise.resolve()),
				})),
				delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
			};

			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			const result = await updateStatus(
				mockDb,
				"project-1",
				"issue-1",
				"user-1",
				"backlog",
				"web",
				"Reopening for retry",
			);

			expect(result.status).toBe("backlog");
		});
	});

	describe("assignIssue", () => {
		it("validates assignee is project member", async () => {
			const results = [
				[{ userId: "user-1", role: "dev" }],
				[],
			];
			let callIdx = 0;
			const whereFn = vi.fn(() => {
				const r = results[callIdx++] ?? [];
				return Object.assign(Promise.resolve(r), {
					limit: vi.fn(async () => r),
				});
			});
			mockDb.select = vi.fn(() => ({
				from: vi.fn(() => ({
					where: whereFn,
					limit: vi.fn(async () => results[callIdx++] ?? []),
				})),
			})) as unknown as typeof mockDb.select;

			await expect(
				assignIssue(
					mockDb,
					"project-1",
					"issue-1",
					"user-1",
					["non-member"],
					[],
					"web",
				),
			).rejects.toMatchObject({ code: "NOT_PROJECT_MEMBER" });
		});

		it("allows null assignee (unassign)", async () => {
			mockDb.select = memberSelectMock();

			mockDb.update = vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn(() =>
							Promise.resolve([{ id: "issue-1", assigneeId: null }]),
						),
					})),
				})),
			})) as unknown as typeof mockDb.update;
			mockDb.transaction = vi.fn(async (fn) =>
				fn({
					update: mockDb.update,
					delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
					insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
				} as unknown as Parameters<Parameters<Database["transaction"]>[0]>[0]),
			);

			const result = await assignIssue(
				mockDb,
				"project-1",
				"issue-1",
				"user-1",
				[],
				[],
				"web",
			);

			expect(result.assigneeId).toBeNull();
			expect(result.developerAssigneeIds).toEqual([]);
			expect(result.qaAssigneeIds).toEqual([]);
		});
	});
});

describe("withMemberProjection", () => {
	const baseIssue = {
		id: "issue-1",
		reporterId: "user-1",
		developerAssigneeIds: ["user-1", "user-2"],
		qaAssigneeIds: [],
	} as unknown as Parameters<typeof withMemberProjection>[1];

	it("resolves member refs from the directory", () => {
		const directory = new Map([
			["user-1", { id: "user-1", name: "Ada", image: "a.png" }],
			["user-2", { id: "user-2", name: "Ben", image: null }],
		]);
		const result = withMemberProjection(directory, baseIssue);
		expect(result.reporter).toEqual({ id: "user-1", name: "Ada", image: "a.png" });
		expect(result.developerAssignees).toEqual([
			{ id: "user-1", name: "Ada", image: "a.png" },
			{ id: "user-2", name: "Ben", image: null },
		]);
		expect(result.qaAssignees).toEqual([]);
	});

	it("falls back to Unknown member when an id is missing from the directory", () => {
		const result = withMemberProjection(new Map(), baseIssue);
		expect(result.reporter?.name).toBe("Unknown member");
		expect(result.developerAssignees[1]).toEqual({
			id: "user-2",
			name: "Unknown member",
			image: null,
		});
	});

	it("returns a null reporter when reporterId is absent", () => {
		const result = withMemberProjection(new Map(), {
			...baseIssue,
			reporterId: null,
		} as unknown as typeof baseIssue);
		expect(result.reporter).toBeNull();
	});
});
