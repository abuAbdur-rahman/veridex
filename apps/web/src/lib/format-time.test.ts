import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/format-time";

describe("formatRelativeTime", () => {
	it("formats fresh ISO timestamps relative to now", () => {
		const now = Date.parse("2026-08-14T12:00:00.000Z");
		expect(formatRelativeTime("2026-08-14T11:59:45.000Z", now)).toBe("just now");
		expect(formatRelativeTime("2026-08-14T11:55:00.000Z", now)).toBe("5 minutes ago");
		expect(formatRelativeTime("2026-08-14T11:59:10.000Z", now)).toBe("1 minute ago");
		expect(formatRelativeTime("2026-08-14T12:05:00.000Z", now)).toBe("in 5 minutes");
	});

	it("preserves fixture labels that are already relative", () => {
		expect(formatRelativeTime("2 days ago")).toBe("2 days ago");
	});
});
