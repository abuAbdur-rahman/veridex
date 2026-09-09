import { describe, expect, it } from "vitest";
import { importPreviewQueryKey, importErrorsQueryKey } from "@/queries/import";

describe("import query key helpers", () => {
	it("generates preview query key", () => {
		expect(importPreviewQueryKey("p1", "j1", 0)).toEqual([
			"import", "p1", "j1", "preview",
			0,
		]);
	});

	it("generates errors query key", () => {
		expect(importErrorsQueryKey("p1", "j1")).toEqual([
			"import", "p1", "j1", "errors",
		]);
	});
});
