import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = (name: string) => new URL(`./${name}`, import.meta.url);

async function readMigration(name: string) {
	return readFile(migrationPath(name), "utf8");
}

describe("backend repair migrations", () => {
	it("normalizes auth data before adding constraints", async () => {
		const cleanup = await readMigration("0002_normalize_auth_users.sql");
		const constraints = await readMigration("0003_repair_auth_and_indexes.sql");

		expect(cleanup).toContain("Invalid auth.user default_role values");
		expect(cleanup).toContain('SET "username" = NULLIF(btrim("username"), \'\')');
		expect(cleanup).toContain(
			'row_number() OVER (PARTITION BY "username" ORDER BY "id")',
		);
		expect(cleanup).toContain("Cleared duplicate usernames for auth.user IDs");
		expect(constraints).toContain(
			'ALTER COLUMN "username" DROP DEFAULT',
		);
		expect(constraints).toContain(
			'ALTER COLUMN "default_role" DROP DEFAULT',
		);
		expect(constraints).toContain("user_username_unique");
		expect(constraints).toContain("user_default_role_check");
	});

	it("adds exactly the ten query-driven indexes", async () => {
		const indexMigration = await readMigration(
			"0003_repair_auth_and_indexes.sql",
		);
		const orderMigration = await readMigration(
			"0004_repair_auth_and_indexes.sql",
		);
		const indexNames = [
			"issues_project_status_idx",
			"issues_assignee_idx",
			"issues_qa_assignee_idx",
			"issue_status_history_issue_changed_at_idx",
			"issue_status_history_mcp_activity_idx",
			"comments_active_issue_idx",
			"team_member_user_idx",
			"project_member_user_idx",
			"invites_pending_team_idx",
			"api_tokens_user_idx",
		];

		for (const indexName of indexNames) {
			expect(indexMigration).toContain(`CREATE INDEX "${indexName}"`);
		}
		expect(indexMigration.match(/CREATE INDEX /g)).toHaveLength(10);
		expect(indexMigration).toContain(
			'WHERE "comments"."deleted_at" IS NULL',
		);
		expect(indexMigration).toContain(
			'WHERE "invites"."accepted_at" IS NULL',
		);
		expect(indexMigration).toContain(
			`WHERE "issue_status_history"."source" = 'mcp'`,
		);
		expect(orderMigration).toContain(
			'("changed_by","changed_at" DESC NULLS LAST)',
		);
	});

	it("does not add indexes already covered by stronger constraints", async () => {
		const migrations = [
			await readMigration("0003_repair_auth_and_indexes.sql"),
			await readMigration("0004_repair_auth_and_indexes.sql"),
		].join("\n");
		const omittedIndexNames = [
			"team_member_team_idx",
			"project_member_project_idx",
			"project_team_idx",
			"invites_token_idx",
			"issues_project_ticket_ref_idx",
			"api_tokens_active_hash_idx",
		];

		for (const indexName of omittedIndexNames) {
			expect(migrations).not.toContain(indexName);
		}
	});
});
