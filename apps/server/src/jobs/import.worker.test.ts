import { describe, expect, it, vi, beforeEach } from "vitest";
import {
	resolveCellColor,
	hexToStatus,
	parseCsvFileForImport,
	parseExcelFileForImport,
	resolveRowStatus,
	normalizeImportSeverity,
	normalizeStatusAssigneeMapping,
	resolveImportAssignments,
	validateMappedImportAssignments,
	isExternalScreenshotUrl,
} from "./import.worker.js";
import ExcelJS from "exceljs";

describe("resolveCellColor", () => {
	it("returns null for undefined", () => {
		expect(resolveCellColor(undefined)).toBeNull();
	});

	it("returns rgb value when present", () => {
		expect(resolveCellColor({ rgb: "FF0000" })).toBe("FF0000");
	});

	it("normalizes ExcelJS ARGB values", () => {
		expect(resolveCellColor({ rgb: "FFFF9900" })).toBe("FF9900");
	});

	it("resolves theme colors", () => {
		expect(resolveCellColor({ theme: 0 })).toBe("FFFFFF");
		expect(resolveCellColor({ theme: 1 })).toBe("000000");
	});

	it("applies tint to theme colors", () => {
		const result = resolveCellColor({ theme: 2, tint: 0.3 });
		expect(result).toBeTruthy();
		expect(result).not.toBe("E7E6E6");
	});

	it("returns null for unknown theme index", () => {
		expect(resolveCellColor({ theme: 99 })).toBeNull();
	});
});

describe("hexToStatus", () => {
	it("returns null for null input", () => {
		expect(hexToStatus(null)).toBeNull();
	});

	it("detects rejected color (red-ish)", () => {
		expect(hexToStatus("FF6666")).toBe("rejected");
	});

	it("detects in_progress color (orange-ish)", () => {
		expect(hexToStatus("FF9900")).toBe("in_progress");
	});

	it("detects in_qa color (yellow-ish)", () => {
		expect(hexToStatus("E8E800")).toBe("in_qa");
	});

	it("detects verified color (green-ish)", () => {
		expect(hexToStatus("50C878")).toBe("verified");
	});

	it("returns null for unmatched colors", () => {
		expect(hexToStatus("0000FF")).toBeNull();
	});
});

describe("parseCsvFileForImport", () => {
	it("parses basic CSV", () => {
		const result = parseCsvFileForImport("Title,Description\nBug1,Desc1\nBug2,Desc2");
		expect(result.headers).toEqual(["Title", "Description"]);
		expect(result.totalRows).toBe(2);
		expect(result.allRows).toHaveLength(2);
	});

	it("auto-maps columns", () => {
		const result = parseCsvFileForImport(
			"Bug Title,Priority,Status\nFix login,High,Open",
		);
		expect(result.columnMapping).toEqual({
			"Bug Title": "title",
			Priority: "severity",
			Status: "",
		});
	});

	it("skips empty lines", () => {
		const result = parseCsvFileForImport("Title,Description\nBug1,Desc1\n\nBug2,Desc2\n");
		expect(result.totalRows).toBe(2);
	});

	it("returns empty result for no data", () => {
		const result = parseCsvFileForImport("Title,Description\n");
		expect(result.totalRows).toBe(0);
		expect(result.allRows).toHaveLength(0);
	});
});

describe("normalizeImportSeverity", () => {
	it("normalizes title-case and padded spreadsheet values", () => {
		expect(normalizeImportSeverity("High")).toBe("high");
		expect(normalizeImportSeverity(" LOW ")).toBe("low");
		expect(normalizeImportSeverity("Critical")).toBe("critical");
	});

	it("defaults blank and unsupported values to medium", () => {
		expect(normalizeImportSeverity("")).toBe("medium");
		expect(normalizeImportSeverity("urgent")).toBe("medium");
	});
});

describe("parseExcelFileForImport", () => {
	it("counts only non-empty rows", async () => {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet("Sheet1");
		sheet.addRow(["Title"]);
		sheet.addRow(["Bug 1"]);
		sheet.getRow(10).getCell(1).value = "";

		const result = await parseExcelFileForImport(
			Buffer.from(await workbook.xlsx.writeBuffer()),
		);

		expect(result.totalRows).toBe(1);
		expect(result.allRows).toHaveLength(1);
	});

	it("detects ARGB row colors first seen after row 20", async () => {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet("Sheet1");
		sheet.addRow(["Title"]);
		for (let row = 1; row <= 25; row++) sheet.addRow([`Bug ${row}`]);
		sheet.getRow(25).getCell(1).fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFFF9900" },
		};

		const result = await parseExcelFileForImport(
			Buffer.from(await workbook.xlsx.writeBuffer()),
		);

		expect(result.colorMapping).toEqual({ "FF9900": "in_progress" });
		expect(result.allRows[23]?.colorHex).toBe("FF9900");
	});
});

describe("resolveRowStatus", () => {
	const colorMapping = { FF6666: "rejected", "50C878": "verified" };

	it("uses a recognized row color before an explicit status column", () => {
		expect(
			resolveRowStatus({
				mappedStatus: "in_qa",
				colorHex: "FF6666",
				colorMapping,
				defaultStatus: "backlog",
			}),
		).toBe("rejected");
	});

	it("uses the row color mapping when no explicit status", () => {
		expect(
			resolveRowStatus({
				mappedStatus: null,
				colorHex: "FF6666",
				colorMapping,
				defaultStatus: "backlog",
			}),
		).toBe("rejected");
	});

	it("falls back to defaultStatus when color is unmapped", () => {
		expect(
			resolveRowStatus({
				mappedStatus: null,
				colorHex: "ABCDEF",
				colorMapping,
				defaultStatus: "in_progress",
			}),
		).toBe("in_progress");
	});

	it("defaults to backlog when nothing resolves", () => {
		expect(
			resolveRowStatus({
				mappedStatus: "open",
				colorHex: null,
				colorMapping,
				defaultStatus: "invalid",
			}),
		).toBe("backlog");
	});

	it("ignores invalid status column values", () => {
		expect(
			resolveRowStatus({
				mappedStatus: "Done",
				colorHex: null,
				colorMapping: {},
				defaultStatus: "verified",
			}),
		).toBe("verified");
	});
});

describe("normalizeStatusAssigneeMapping", () => {
	it("normalizes pending and preserves multiple assignees", () => {
		expect(
			normalizeStatusAssigneeMapping({
				pending: ["dev-1", "dev-2"],
				in_qa: ["qa-1", "qa-2"],
			}),
		).toEqual({
				in_progress: ["dev-1", "dev-2"],
				in_qa: ["qa-1", "qa-2"],
			});
	});
});

describe("import assignment rules", () => {
	it("assigns the sole developer to development issues by default", () => {
		expect(
			resolveImportAssignments({
				status: "backlog",
				defaultDeveloperAssigneeIds: ["dev-1"],
				defaultQaAssigneeIds: [],
			}),
		).toEqual({
			developerAssigneeIds: ["dev-1"],
			qaAssigneeIds: [],
		});
		expect(
			resolveImportAssignments({
				status: "in_progress",
				defaultDeveloperAssigneeIds: ["dev-1"],
				defaultQaAssigneeIds: [],
			}),
		).toEqual({
			developerAssigneeIds: ["dev-1"],
			qaAssigneeIds: [],
		});
	});

	it("assigns every QA member to issues entering QA by default", () => {
		expect(resolveImportAssignments({ status: "in_qa", defaultQaAssigneeIds: ["qa-1", "qa-2"] })).toEqual({
			developerAssigneeIds: [],
			qaAssigneeIds: ["qa-1", "qa-2"],
		});
	});

	it("prefers a mapped QA assignee before the default QA set", () => {
		expect(resolveImportAssignments({
			status: "in_qa",
			defaultQaAssigneeIds: ["qa-1", "qa-2"],
			mappedQaAssigneeId: "qa-2",
		})).toEqual({
			developerAssigneeIds: [],
			qaAssigneeIds: ["qa-2"],
		});
	});

	it("rejects mapped assignees without the matching project role", () => {
		expect(() => validateMappedImportAssignments({
			mappedAssigneeId: "qa-1",
			mappedQaAssigneeId: "dev-1",
			developerIds: new Set(["dev-1"]),
			qaIds: new Set(["qa-1"]),
		})).toThrow("Mapped assignee must be a project developer");
	});

	it("does not assign verified issues even when mappings exist", () => {
		expect(
			resolveImportAssignments({
				status: "verified",
				defaultDeveloperAssigneeIds: ["dev-1"],
				defaultQaAssigneeIds: ["qa-1"],
				statusAssigneeMapping: { verified: ["qa-2"] },
				mappedQaAssigneeId: "qa-3",
			}),
		).toEqual({
			developerAssigneeIds: [],
			qaAssigneeIds: [],
		});
	});

	it("does not assign rejected issues", () => {
		expect(resolveImportAssignments({ status: "rejected", defaultQaAssigneeIds: ["qa-1"] })).toEqual({
			developerAssigneeIds: [],
			qaAssigneeIds: [],
		});
	});
});

describe("isExternalScreenshotUrl", () => {
	it("accepts HTTPS URLs and rejects local or invalid values", () => {
		expect(isExternalScreenshotUrl("https://example.com/shot.png")).toBe(true);
		expect(isExternalScreenshotUrl("/uploads/shot.png")).toBe(false);
		expect(isExternalScreenshotUrl("not a URL")).toBe(false);
	});
});

describe("import worker registration", () => {
	it("registers import-insert handler only", async () => {
		const work = vi.fn().mockResolvedValue("worker-id");
		const registerImportWorker = (
			await import("./import.worker.js")
		).registerImportWorker;

		await registerImportWorker({
			db: {} as never,
			boss: { work } as never,
		});

		expect(work).toHaveBeenCalledTimes(1);
		expect(work.mock.calls[0][0]).toBe("import-insert");
	});
});
