import { and, eq, lte, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import type { Database } from "../db/client.js";
import { issues } from "../db/schema/index.js";
import { broadcast } from "../ws/broadcaster.js";

export const VERIFIED_ISSUE_CLEANUP_QUEUE = "verified-issue-cleanup";
export const VERIFIED_ISSUE_CLEANUP_SCHEDULE = "0 * * * *";

export async function runVerifiedIssueCleanup(db: Database): Promise<void> {
	const deleted = await db
		.delete(issues)
		.where(
			and(
				eq(issues.status, "verified"),
				lte(issues.closedAt, sql`now() - interval '24 hours'`),
			),
		)
		.returning({ id: issues.id, projectId: issues.projectId });

	for (const issue of deleted) {
		broadcast(issue.projectId, {
			type: "issue:deleted",
			payload: { issueId: issue.id, projectId: issue.projectId },
		});
	}
}

export function registerVerifiedIssueCleanupWorker(deps: {
	db: Database;
	boss: PgBoss;
}) {
	return deps.boss.work(VERIFIED_ISSUE_CLEANUP_QUEUE, async () => {
		await runVerifiedIssueCleanup(deps.db);
	});
}
