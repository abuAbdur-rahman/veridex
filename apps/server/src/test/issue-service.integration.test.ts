import { execSync } from "node:child_process";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { PgHarness } from "./pg-harness.js";
import { getPgHarness } from "./pg-harness.js";
import {
	issueStatusHistory,
	issues,
	project,
	projectMember,
} from "../db/schema/index.js";
import { team } from "../db/schema/team.js";
import { createIssue, updateStatus } from "../services/issue.service.js";

function dockerAvailable() {
	try {
		execSync("docker info", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

const canRun = dockerAvailable();

let harness: PgHarness;
let db: PgHarness["db"];

beforeAll(async () => {
	if (!canRun) return;
	harness = await getPgHarness();
	db = harness.db;
}, 180_000);

afterAll(async () => {
	await harness?.stop();
});

afterEach(async () => {
	if (harness) await harness.reset();
});

interface SeedOptions {
	users?: string[];
	devUsers?: string[];
}

async function seedProject(options: SeedOptions = {}) {
	const users = options.users ?? ["usr_admin"];
	const devUsers = options.devUsers ?? [];
	const projectId = crypto.randomUUID();
	const teamId = crypto.randomUUID();

	for (const id of users) {
		await db.execute(
			sql`INSERT INTO auth."user" (id, name, email) VALUES (${id}, ${"User " + id}, ${id + "@test.local"})`,
		);
	}
	await db.insert(team).values({
		id: teamId,
		name: "Team",
		slug: `team-${teamId.slice(0, 8)}`,
		ownerId: users[0]!,
	});
	await db.insert(project).values({
		id: projectId,
		teamId,
		name: "Project",
		slug: "project",
		createdBy: users[0]!,
		nextTicketNumber: 1,
	});
	for (const id of users) {
		await db.insert(projectMember).values({
			projectId,
			userId: id,
			role: devUsers.includes(id) ? "dev" : "admin",
		});
	}
	return { projectId };
}

describe.skipIf(!canRun)("issue service integration (real PostgreSQL)", () => {
	it("runs the full migration chain on an empty database", async () => {
		const applied = await harness.sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
		expect(Number((applied[0] as { count: number }).count)).toBe(13);
	});

	it("enforces the case-insensitive duplicate-title constraint and rolls back cleanly", async () => {
		const { projectId } = await seedProject({ users: ["usr_a"], devUsers: ["usr_a"] });
		await createIssue(db, projectId, "usr_a", { title: "Checkout broken" });

		await expect(
			createIssue(db, projectId, "usr_a", { title: "checkout BROKEN" }),
		).rejects.toMatchObject({ code: "DUPLICATE_ISSUE", statusCode: 409 });

		const rows = await db.select().from(issues).where(eq(issues.projectId, projectId));
		expect(rows).toHaveLength(1);
	});

	it("writes status and history atomically when transitioning", async () => {
		const { projectId } = await seedProject({ users: ["usr_a"], devUsers: ["usr_a"] });
		const issue = await createIssue(db, projectId, "usr_a", { title: "Atomic" });

		await updateStatus(
			db,
			projectId,
			issue.id,
			"usr_a",
			"in_progress",
			"web",
			"starting work",
			"dev",
		);

		const [row] = await db.select().from(issues).where(eq(issues.id, issue.id));
		expect(row?.status).toBe("in_progress");
		const history = await db
			.select()
			.from(issueStatusHistory)
			.where(eq(issueStatusHistory.issueId, issue.id));
		expect(history).toHaveLength(2);
		expect(history.find((entry) => entry.toStatus === "in_progress")).toMatchObject({
			fromStatus: "backlog",
			toStatus: "in_progress",
			source: "web",
		});
	});

	it("lets exactly one concurrent backward transition win", async () => {
		const { projectId } = await seedProject({ users: ["usr_a"], devUsers: ["usr_a"] });
		const issue = await createIssue(db, projectId, "usr_a", { title: "Race" });
		await updateStatus(
			db,
			projectId,
			issue.id,
			"usr_a",
			"in_progress",
			"web",
			"starting work",
			"dev",
		);

		const attempts = Array.from({ length: 5 }, () =>
			updateStatus(
				db,
				projectId,
				issue.id,
				"usr_a",
				"backlog",
				"web",
				"reopening",
				"dev",
			).then(
				() => "ok" as const,
				() => "conflict" as const,
			),
		);
		const results = await Promise.all(attempts);
		expect(results.filter((result) => result === "ok")).toHaveLength(1);

		const [row] = await db.select().from(issues).where(eq(issues.id, issue.id));
		expect(row?.status).toBe("backlog");
		const history = await db
			.select()
			.from(issueStatusHistory)
			.where(eq(issueStatusHistory.issueId, issue.id));
		expect(history.filter((entry) => entry.toStatus === "backlog" && entry.fromStatus !== null))
			.toHaveLength(1);
	});
});
