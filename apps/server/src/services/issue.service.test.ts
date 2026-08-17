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
} from "./issue.service.js";
import { issues, project, projectMember, issueStatusHistory } from "../db/schema/index.js";

const mockDb = {
	transaction: vi.fn(),
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
} as unknown as Database;

function createSelectMock(result: Array<Record<string, unknown>>) {
	return vi.fn(() => ({
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(async () => result),
			})),
		})),
	})) as unknown as typeof mockDb.select;
}

function memberSelectMock() {
	return createSelectMock([{ userId: "user-1" }]);
}

describe("issue.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createIssue", () => {
		it("generates ticket_ref atomically using project.nextTicketNumber", async () => {
			mockDb.select = memberSelectMock();

			const mockTx = {
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
			};

			mockDb.transaction = vi.fn(async (fn) => fn(mockTx));

			await expect(
				createIssue(mockDb, "project-1", "user-1", {
					title: "Test Issue",
				}),
			).rejects.toMatchObject({ code: "TICKET_REF_CONFLICT" });
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
	});

	describe("assignIssue", () => {
		it("validates assignee is project member", async () => {
			const limit = vi
				.fn()
				.mockResolvedValueOnce([{ userId: "user-1" }])
				.mockResolvedValueOnce([]);
			mockDb.select = vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ limit })),
				})),
			})) as unknown as typeof mockDb.select;

			await expect(
				assignIssue(
					mockDb,
					"project-1",
					"issue-1",
					"user-1",
					"non-member",
					null,
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

			const result = await assignIssue(
				mockDb,
				"project-1",
				"issue-1",
				"user-1",
				null,
				null,
				"web",
			);

			expect(result.assigneeId).toBeNull();
		});
	});
});