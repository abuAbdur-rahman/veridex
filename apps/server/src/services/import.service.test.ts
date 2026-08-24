import { describe, it, expect, beforeEach, vi } from "vitest";
import ExcelJS from "exceljs";
import type { Database } from "../db/client.js";
import type { Queue } from "../jobs/queue.js";
import {
	uploadSpreadsheet,
	getPreview,
	confirmImport,
	getImportErrors,
} from "./import.service.js";

const projectId = "22222222-2222-4222-8222-222222222222";
const userId = "user-1";
const importJobId = "33333333-3333-4333-8333-333333333333";

function createMemberSelect(hasMember: boolean) {
	return vi.fn(() => ({
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(async () => (hasMember ? [{ userId }] : [])),
			})),
		})),
	})) as unknown as Database["select"];
}

function createJobSelect(job: Record<string, unknown> | undefined) {
	return vi.fn(() => ({
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(async () => (job ? [job] : [])),
			})),
		})),
	})) as unknown as Database["select"];
}

function createInsertMock(result: Record<string, unknown>) {
	return vi.fn(() => ({
		values: vi.fn(() => ({
			returning: vi.fn(async () => [result]),
		})),
	})) as unknown as Database["insert"];
}

function createUpdateMock(claimed: boolean = true) {
	return vi.fn(() => ({
		set: vi.fn(() => ({
			where: vi.fn(() => ({
				returning: vi.fn(async () => (claimed ? [{ id: importJobId }] : [])),
			})),
		})),
	})) as unknown as Database["update"];
}

describe("import.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("uploadSpreadsheet", () => {
		it("parses CSV, stores parsedRows, and creates import job as completed", async () => {
			const db = {
				select: createMemberSelect(true),
				insert: createInsertMock({ id: importJobId }),
			} as unknown as Database;

			const result = await uploadSpreadsheet(
				db,
				projectId,
				userId,
				{ buffer: Buffer.from("Title,Description\nBug1,Desc1\nBug2,Desc2"), filename: "bugs.csv", mimetype: "text/csv" },
			);

			expect(result).toEqual({ importJobId });
		});

		it("parses XLSX and stores parsedRows", async () => {
			const db = {
				select: createMemberSelect(true),
				insert: createInsertMock({ id: importJobId }),
			} as unknown as Database;

			const workbook = new ExcelJS.Workbook();
			const sheet = workbook.addWorksheet("Sheet1");
			sheet.addRow(["Title", "Description"]);
			sheet.addRow(["Bug 1", "Desc 1"]);
			const xlsxBuffer = await workbook.xlsx.writeBuffer();

			const result = await uploadSpreadsheet(
				db,
				projectId,
				userId,
				{ buffer: Buffer.from(xlsxBuffer), filename: "bugs.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
			);

			expect(result).toEqual({ importJobId });
		});

		it("accepts uppercase CSV extensions", async () => {
			const db = {
				select: createMemberSelect(true),
				insert: createInsertMock({ id: importJobId }),
			} as unknown as Database;

			await expect(uploadSpreadsheet(
				db,
				projectId,
				userId,
				{ buffer: Buffer.from("Title,Description\nBug 1,Desc 1"), filename: "bugs.CSV", mimetype: "text/csv" },
			)).resolves.toEqual({ importJobId });
		});

		it("rejects non-member users", async () => {
			const db = {
				select: createMemberSelect(false),
			} as unknown as Database;

			await expect(
				uploadSpreadsheet(
					db,
					projectId,
					userId,
					{ buffer: Buffer.from("test"), filename: "bugs.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
				),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});
	});

	describe("getPreview", () => {
		it("returns preview data with sampleRows from parsedRows", async () => {
			const sampleData = [
				{ Title: "Bug 1", Description: "Desc 1" },
				{ Title: "Bug 2", Description: "Desc 2" },
			];
			const job = {
				id: importJobId,
				fileType: "xlsx",
				originalName: "bugs.xlsx",
				totalRows: 10,
				columnMapping: { Title: "title" },
				colorMapping: {},
				parsedRows: sampleData.map((data) => ({ data, colorHex: null })),
				status: "completed",
			};
			const db = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => [job]),
						})),
					})),
				})),
			} as unknown as Database;

			const result = await getPreview(db, projectId, importJobId, userId);

			expect(result.id).toBe(importJobId);
			expect(result.totalRows).toBe(10);
			expect(result.headers).toEqual(["Title"]);
			expect(result.sampleRows).toEqual(sampleData);
		});

		it("throws for pending status", async () => {
			const db = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => [{ status: "pending" }]),
						})),
					})),
				})),
			} as unknown as Database;

			await expect(getPreview(db, projectId, importJobId, userId))
				.rejects.toMatchObject({ code: "VALIDATION_ERROR" });
		});

		it("throws for missing job", async () => {
			let callCount = 0;
			const db = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => {
								callCount++;
								if (callCount === 1) return [{ userId }];
								return [];
							}),
						})),
					})),
				})),
			} as unknown as Database;

			await expect(getPreview(db, projectId, importJobId, userId))
				.rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("confirmImport", () => {
		it("updates mapping and sends insert task", async () => {
			const db = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => [{ status: "completed", colorMapping: {}, parsedRows: [{ data: { Title: "Bug" }, colorHex: null }] }]),
						})),
					})),
				})),
				update: createUpdateMock(),
			} as unknown as Database;
			const queue = { send: vi.fn() } as unknown as Queue;

			const mapping = { Title: "title", Description: "description" };
			const result = await confirmImport(
				db, queue, projectId, importJobId, userId, mapping, undefined, "backlog",
			);

			expect(result).toEqual({ importJobId });
			expect(queue.send).toHaveBeenCalledWith("import-insert", {
				importJobId,
				columnMapping: mapping,
				colorMapping: {},
				defaultStatus: "backlog",
			});
		});

		it("throws if job is not completed", async () => {
			const db = {
				select: createJobSelect({ status: "processing" }),
			} as unknown as Database;

			await expect(
				confirmImport(db, {} as Queue, projectId, importJobId, userId, {}, undefined, undefined),
			).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
		});

		it("throws if completed job has already been consumed", async () => {
			const db = {
				select: createJobSelect({ status: "completed", parsedRows: null }),
			} as unknown as Database;

			await expect(
				confirmImport(db, {} as Queue, projectId, importJobId, userId, {}),
			).rejects.toMatchObject({
				code: "VALIDATION_ERROR",
				details: { status: ["Import has already been consumed"] },
			});
		});

		it("does not persist mapping when enqueue fails", async () => {
			const update = createUpdateMock();
			const db = {
				select: createJobSelect({ status: "completed", colorMapping: {}, parsedRows: [{ data: { Title: "Bug" }, colorHex: null }] }),
				update,
			} as unknown as Database;
			const queue = {
				send: vi.fn().mockRejectedValue(new Error("queue unavailable")),
			} as unknown as Queue;

			await expect(confirmImport(
				db,
				queue,
				projectId,
				importJobId,
				userId,
				{ Title: "title" },
			)).rejects.toThrow("queue unavailable");
			expect(update).toHaveBeenCalledTimes(2);
		});

		it("throws if a concurrent confirm already claimed the job", async () => {
			const update = createUpdateMock(false);
			const db = {
				select: createJobSelect({ status: "completed", colorMapping: {}, parsedRows: [{ data: { Title: "Bug" }, colorHex: null }] }),
				update,
			} as unknown as Database;

			await expect(confirmImport(
				db,
				{} as Queue,
				projectId,
				importJobId,
				userId,
				{ Title: "title" },
			)).rejects.toMatchObject({
				code: "IMPORT_ALREADY_CONFIRMED",
				statusCode: 409,
			});
		});
	});

	describe("getImportErrors", () => {
		it("returns error summary", async () => {
			const job = {
				id: importJobId,
				totalRows: 10,
				importedRows: 8,
				failedRows: 2,
				errorLog: [{ row: 3, error: "Missing title" }],
			};
			const db = {
				select: createJobSelect(job),
			} as unknown as Database;

			const result = await getImportErrors(db, projectId, importJobId, userId);

			expect(result.importedRows).toBe(8);
			expect(result.failedRows).toBe(2);
			expect(result.errors).toHaveLength(1);
		});

		it("throws for missing job", async () => {
			let callCount = 0;
			const db = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => {
								callCount++;
								if (callCount === 1) return [{ userId }];
								return [];
							}),
						})),
					})),
				})),
			} as unknown as Database;

			await expect(getImportErrors(db, projectId, importJobId, userId))
				.rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});
});
