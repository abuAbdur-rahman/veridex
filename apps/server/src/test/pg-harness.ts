import { exec as nodeExec, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import postgres from "postgres";
import { createDb, type Database } from "../db/client.js";

const exec = promisify(nodeExec);
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../db/migrations");

const IMAGE = "postgres:16-alpine";
const USER = "test";
const PASSWORD = "test";
const DATABASE = "veridex_test";

export interface PgHarness {
	db: Database;
	url: string;
	sql: postgres.Sql;
	reset: () => Promise<void>;
	stop: () => Promise<void>;
}

let harnessPromise: Promise<PgHarness> | undefined;

function migrationFiles(): Array<{ tag: string; sql: string }> {
	const journal = JSON.parse(
		readFileSync(join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8"),
	) as { entries: Array<{ tag: string }> };
	return journal.entries.map(({ tag }) => ({
		tag,
		sql: readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), "utf8"),
	}));
}

async function waitForReady(containerName: string) {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		try {
			await exec(
				`docker exec ${containerName} pg_isready -U ${USER} -d ${DATABASE}`,
			);
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}
	throw new Error(`PostgreSQL container ${containerName} never became ready`);
}

async function start(): Promise<PgHarness> {
	const containerName = `veridex-it-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
	const cleanup = () => {
		try {
			execSync(`docker rm -f ${containerName}`, { stdio: "ignore" });
		} catch {
			// Container already gone; nothing to clean up.
		}
	};
	process.once("exit", cleanup);

	let containerId: string;
	try {
		const { stdout } = await exec(
			`docker run -d --name ${containerName} ` +
				`-e POSTGRES_USER=${USER} -e POSTGRES_PASSWORD=${PASSWORD} -e POSTGRES_DB=${DATABASE} ` +
				`-P ${IMAGE}`,
			{ timeout: 120_000 },
		);
		containerId = stdout.trim();
	} catch (error) {
		cleanup();
		throw new Error(
			"Could not start PostgreSQL Docker container. Is Docker running? Integration tests require Docker.",
			{ cause: error },
		);
	}

	async function stop() {
		process.removeListener("exit", cleanup);
		cleanup();
	}

	try {
		await waitForReady(containerName);
		const { stdout } = await exec(`docker port ${containerName} 5432/tcp`);
		const match = /:(\d+)\s*$/.exec(stdout.trim());
		if (!match?.[1]) throw new Error(`Could not resolve mapped port: ${stdout.trim()}`);
		const url = `postgres://${USER}:${PASSWORD}@127.0.0.1:${match[1]}/${DATABASE}`;

		const sql = postgres(url, { prepare: false });
		const db = createDb(url);

		async function reset() {
			const tables = await sql`
				SELECT schemaname, tablename FROM pg_tables
				WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'drizzle')
			`;
			if (tables.length === 0) return;
			const qualified = tables
				.map((row) => `"${row.schemaname}"."${row.tablename}"`)
				.join(", ");
			await sql.unsafe(`TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE`);
		}

		await applyMigrations(sql);
		void containerId;

		return { db, url, sql, reset, stop };
	} catch (error) {
		await stop();
		throw error;
	}
}

async function applyMigrations(sql: postgres.Sql) {
	await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
	await sql`
		CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
			id serial PRIMARY KEY,
			hash text NOT NULL,
			created_at bigint
		)
	`;
	for (const file of migrationFiles()) {
		for (const statement of file.sql.split("--> statement-breakpoint")) {
			if (statement.trim()) await sql.unsafe(statement);
		}
		await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${file.tag}, 0)`;
	}
}

export function getPgHarness(): Promise<PgHarness> {
	harnessPromise ??= start();
	return harnessPromise;
}
