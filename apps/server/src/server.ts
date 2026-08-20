import "dotenv/config";
import { buildApp } from "./app.js";
import { parseEnvironment } from "./config.js";
import { createQueue } from "./jobs/queue.js";
import {
	VERIFIED_ISSUE_CLEANUP_QUEUE,
	VERIFIED_ISSUE_CLEANUP_SCHEDULE,
} from "./jobs/verified-issue-cleanup.worker.js";

const environment = parseEnvironment(process.env);
const queue = await createQueue(environment.DATABASE_URL_UNPOOLED);
await queue.createQueue("import-insert");
await queue.createQueue(VERIFIED_ISSUE_CLEANUP_QUEUE);
await queue.schedule(
	VERIFIED_ISSUE_CLEANUP_QUEUE,
	VERIFIED_ISSUE_CLEANUP_SCHEDULE,
	null,
);
const app = buildApp(environment, { queue });

try {
	await app.listen({ host: environment.HOST, port: environment.PORT });
} catch (error) {
	app.log.error(error);
	process.exitCode = 1;
}

const shutdown = async (signal: string) => {
	app.log.info({ signal }, "shutting down");
	await app.close();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
