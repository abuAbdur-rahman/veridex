import "dotenv/config";
import { buildApp } from "./app.js";
import { parseEnvironment } from "./config.js";
import { createQueue } from "./jobs/queue.js";
import {
	VERIFIED_ISSUE_CLEANUP_QUEUE,
	VERIFIED_ISSUE_CLEANUP_SCHEDULE,
} from "./jobs/verified-issue-cleanup.worker.js";
import {
	attachBroadcastPublisher,
	BROADCAST_CHANNEL,
	handleRemoteBroadcast,
} from "./ws/broadcaster.js";
import { createPostgresEventBus } from "./ws/event-bus.js";

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

const eventBus = await createPostgresEventBus(environment.DATABASE_URL_UNPOOLED, {
	channel: BROADCAST_CHANNEL,
	onPayload: (payload) => handleRemoteBroadcast(payload),
	onError: (error) => app.log.error({ error }, "websocket event bus error"),
});
attachBroadcastPublisher((payload) => {
	void eventBus.publish(payload).catch((error) =>
		app.log.error({ error }, "websocket broadcast publish failed"),
	);
});

try {
	await app.listen({ host: environment.HOST, port: environment.PORT });
} catch (error) {
	app.log.error(error);
	process.exitCode = 1;
}

const shutdown = async (signal: string) => {
	app.log.info({ signal }, "shutting down");
	await app.close();
	await eventBus.close();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
