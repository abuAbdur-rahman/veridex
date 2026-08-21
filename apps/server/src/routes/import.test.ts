import multipart from "@fastify/multipart";
import Fastify from "fastify";
import type { Database } from "../db/client.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "../lib/errors.js";
import { importRoutes } from "./import.js";

const {
	requireSession,
	requireProjectRole,
	uploadSpreadsheet,
	getPreview,
	confirmImport,
	getImportErrors,
} = vi.hoisted(() => ({
	requireSession: vi.fn(),
	requireProjectRole: vi.fn(),
	uploadSpreadsheet: vi.fn(),
	getPreview: vi.fn(),
	confirmImport: vi.fn(),
	getImportErrors: vi.fn(),
}));

vi.mock("../lib/auth.js", () => ({
	requireSession,
	requireProjectRole,
}));
vi.mock("../services/import.service.js", () => ({
	uploadSpreadsheet,
	getPreview,
	confirmImport,
	getImportErrors,
}));

const apps: Array<ReturnType<typeof Fastify>> = [];
const projectId = "22222222-2222-4222-8222-222222222222";
const importJobId = "33333333-3333-4333-8333-333333333333";

function multipartXlsx(content: Buffer) {
	const boundary = "veridex-test-boundary";
	return {
		headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
		payload: Buffer.concat([
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="bugs.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
			),
			content,
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]),
	};
}

function multipartCsv(content: string) {
	const boundary = "veridex-test-boundary";
	const buf = Buffer.from(content, "utf-8");
	return {
		headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
		payload: Buffer.concat([
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="bugs.csv"\r\nContent-Type: text/csv\r\n\r\n`,
			),
			buf,
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]),
	};
}

function multipartInvalid() {
	const boundary = "veridex-test-boundary";
	return {
		headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
		payload: Buffer.concat([
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="file.txt"\r\nContent-Type: text/plain\r\n\r\n`,
			),
			Buffer.from("not a spreadsheet"),
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]),
	};
}

async function createApp() {
	const app = Fastify({ logger: false });
	app.decorate("db", {} as Database);
	app.decorate("queue", { publish: vi.fn(), work: vi.fn() } as never);
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
	await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
	await app.register(importRoutes);
	apps.push(app);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	requireSession.mockResolvedValue({ user: { id: "user-1" } });
	requireProjectRole.mockResolvedValue({
		session: { user: { id: "user-1" } },
		membership: { projectRole: "admin" },
	});
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("import routes", () => {
	describe("POST /api/projects/:projectId/import/upload", () => {
		it("requires project membership", async () => {
			requireProjectRole.mockRejectedValue(new ForbiddenError());
			const response = await (
				await createApp()
			).inject({
				method: "POST",
				url: `/api/projects/${projectId}/import/upload`,
				...multipartXlsx(Buffer.from("fake")),
			});

			expect(response.statusCode).toBe(403);
			expect(uploadSpreadsheet).not.toHaveBeenCalled();
		});

		it("rejects non-spreadsheet files", async () => {
			const response = await (
				await createApp()
			).inject({
				method: "POST",
				url: `/api/projects/${projectId}/import/upload`,
				...multipartInvalid(),
			});

			expect(response.statusCode).toBe(422);
		});

		it("accepts CSV files and calls uploadSpreadsheet", async () => {
			uploadSpreadsheet.mockResolvedValue({ importJobId });
			const response = await (
				await createApp()
			).inject({
				method: "POST",
				url: `/api/projects/${projectId}/import/upload`,
				...multipartCsv("Title,Description\nBug1,Desc1"),
			});

			expect(response.statusCode).toBe(201);
			expect(response.json()).toEqual({ importJobId });
			expect(uploadSpreadsheet).toHaveBeenCalledWith(
				expect.anything(),
				projectId,
				"user-1",
				expect.objectContaining({ filename: "bugs.csv" }),
			);
		});

		it("accepts XLSX files and calls uploadSpreadsheet", async () => {
			uploadSpreadsheet.mockResolvedValue({ importJobId });
			const response = await (
				await createApp()
			).inject({
				method: "POST",
				url: `/api/projects/${projectId}/import/upload`,
				...multipartXlsx(Buffer.from("fake-xlsx")),
			});

			expect(response.statusCode).toBe(201);
			expect(uploadSpreadsheet).toHaveBeenCalledWith(
				expect.anything(),
				projectId,
				"user-1",
				expect.objectContaining({ filename: "bugs.xlsx" }),
			);
		});
	});

	describe("GET /api/projects/:projectId/import/:importJobId/preview", () => {
		it("returns preview data", async () => {
			getPreview.mockResolvedValue({
				id: importJobId,
				fileType: "xlsx",
				originalName: "bugs.xlsx",
				totalRows: 10,
				headers: ["Title", "Description"],
				sampleRows: [],
				columnMapping: { Title: "title" },
				colorMapping: {},
			});

			const response = await (
				await createApp()
			).inject({
				method: "GET",
				url: `/api/projects/${projectId}/import/${importJobId}/preview`,
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual(
				expect.objectContaining({ id: importJobId, totalRows: 10 }),
			);
		});

		it("requires valid UUID params", async () => {
			const response = await (
				await createApp()
			).inject({
				method: "GET",
				url: `/api/projects/not-a-uuid/import/${importJobId}/preview`,
			});

			expect(response.statusCode).toBe(422);
		});
	});

	describe("PATCH /api/projects/:projectId/import/:importJobId/confirm", () => {
		it("confirms import with column mapping", async () => {
			confirmImport.mockResolvedValue({ importJobId });

			const response = await (
				await createApp()
			).inject({
				method: "PATCH",
				url: `/api/projects/${projectId}/import/${importJobId}/confirm`,
				payload: {
					columnMapping: { Title: "title", Description: "description" },
					defaultStatus: "backlog",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({ importJobId });
			expect(confirmImport).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				projectId,
				importJobId,
				"user-1",
				{ Title: "title", Description: "description" },
				undefined,
				"backlog",
				0,
				undefined,
			);
		});

		it("rejects invalid default status", async () => {
			const response = await (
				await createApp()
			).inject({
				method: "PATCH",
				url: `/api/projects/${projectId}/import/${importJobId}/confirm`,
				payload: {
					columnMapping: { Title: "title" },
					defaultStatus: "invalid",
				},
			});

			expect(response.statusCode).toBe(422);
		});
	});

	describe("GET /api/projects/:projectId/import/:importJobId/errors", () => {
		it("returns error data", async () => {
			getImportErrors.mockResolvedValue({
				importJobId,
				totalRows: 10,
				importedRows: 8,
				failedRows: 2,
				errors: [
					{ row: 3, error: "Missing title" },
					{ row: 7, error: "Invalid severity" },
				],
			});

			const response = await (
				await createApp()
			).inject({
				method: "GET",
				url: `/api/projects/${projectId}/import/${importJobId}/errors`,
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual(
				expect.objectContaining({
					importedRows: 8,
					failedRows: 2,
					errors: expect.arrayContaining([
						expect.objectContaining({ row: 3 }),
					]),
				}),
			);
		});
	});
});
