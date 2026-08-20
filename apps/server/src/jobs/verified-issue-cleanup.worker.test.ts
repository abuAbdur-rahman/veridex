import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
	registerVerifiedIssueCleanupWorker,
	runVerifiedIssueCleanup,
} from "./verified-issue-cleanup.worker.js";

describe("verified issue cleanup worker", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("deletes only verified issues closed at least 24 hours ago", async () => {
		const where = vi.fn().mockResolvedValue([{ id: "issue-1" }]);
		const db = { delete: vi.fn().mockReturnValue({ where }) };

		await runVerifiedIssueCleanup(db as never);

		expect(db.delete).toHaveBeenCalledTimes(1);
		expect(where).toHaveBeenCalledTimes(1);
		const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
		expect(query.sql).toContain('"issues"."status" = $1');
		expect(query.sql).toContain(
			'"issues"."closed_at" <= now() - interval \'24 hours\'',
		);
		expect(query.params).toEqual(["verified"]);
	});

	it("registers the cleanup worker", () => {
		const work = vi.fn();

		registerVerifiedIssueCleanupWorker({
			db: {} as never,
			boss: { work } as never,
		});

		expect(work).toHaveBeenCalledTimes(1);
		expect(work.mock.calls[0][0]).toBe("verified-issue-cleanup");
	});
});
