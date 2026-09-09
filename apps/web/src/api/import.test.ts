import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import {
	uploadSpreadsheet,
	getImportPreview,
	confirmImport,
	getImportErrors,
} from "@/api/import";

const preview = {
	id: "job-1",
	fileType: "xlsx",
	originalName: "bugs.xlsx",
	totalRows: 10,
	headers: ["Title", "Description"],
	sampleRows: [{ Title: "Bug 1", Description: "Desc" }],
	columnMapping: { Title: "title" },
	colorMapping: {},
	colorCounts: {},
	status: "completed",
	error: null,
	worksheets: [{ index: 0, name: "Sheet1", totalRows: 10 }],
	selectedWorksheetIndex: 0,
};

const errors = {
	importJobId: "job-1",
	status: "completed",
	totalRows: 10,
	importedRows: 8,
	failedRows: 2,
	errors: [
		{ row: 3, error: "Missing title" },
		{ row: 7, error: "Invalid severity" },
	],
};

describe("import API", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("uploads spreadsheet via FormData", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			Response.json({ importJobId: "job-1" }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const file = new File(["content"], "bugs.xlsx", {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});
		const result = await uploadSpreadsheet("p1", file);

		expect(result).toEqual({ importJobId: "job-1" });
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/projects/p1/import/upload",
			expect.objectContaining({ method: "POST" }),
		);
		const body = fetchMock.mock.calls[0][1].body as FormData;
		expect(body.get("file")).toBe(file);
	});

	it("fetches import preview", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(preview)));

		const result = await getImportPreview("p1", "job-1");
		expect(result).toEqual(preview);
	});

	it("confirms import with mapping", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ importJobId: "job-1" }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await confirmImport(
			"p1",
			"job-1",
			{ Title: "title" },
			{ Status: "in_progress" },
			"backlog",
			0,
			{ backlog: ["dev-1"], in_qa: ["qa-1", "qa-2"] },
		);
		expect(result).toEqual({ importJobId: "job-1" });
		expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
			statusAssigneeMapping: {
				backlog: ["dev-1"],
				in_qa: ["qa-1", "qa-2"],
			},
		});
	});

	it("fetches import errors", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(errors)));

		const result = await getImportErrors("p1", "job-1");
		expect(result).toEqual(errors);
	});

	it("rejects malformed preview response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(Response.json({ id: "job-1" })),
		);

		await expect(getImportPreview("p1", "job-1")).rejects.toMatchObject({
			code: "INVALID_RESPONSE",
		} satisfies Partial<ApiError>);
	});

	it("rejects malformed errors response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(Response.json({ importJobId: "job-1" })),
		);

		await expect(getImportErrors("p1", "job-1")).rejects.toMatchObject({
			code: "INVALID_RESPONSE",
		} satisfies Partial<ApiError>);
	});

	it("encodes project ID with special characters", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json(preview));
		vi.stubGlobal("fetch", fetchMock);

		await getImportPreview("project with spaces", "job-1");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("project%20with%20spaces"),
			expect.anything(),
		);
	});
});
