import "dotenv/config";
import { buildApp } from "./app-factory.js";
import { parseEnvironment } from "./config.js";
import { createQueue } from "./jobs/queue.js";
import {
	attachBroadcastPublisher,
	BROADCAST_CHANNEL,
	handleRemoteBroadcast,
} from "./ws/broadcaster.js";
import { createPostgresEventBus } from "./ws/event-bus.js";

const environment = parseEnvironment(process.env);

const queue = await createQueue(environment.DATABASE_URL_UNPOOLED);
await queue.createQueue("import-insert");

const fastify = buildApp(environment, { queue });

// Purge lingering schedule from removed verified-issue cleanup job
await queue.unschedule("verified-issue-cleanup").catch((error) => {
	fastify.log.warn({ error }, "failed to unschedule verified-issue-cleanup");
});

const eventBus = await createPostgresEventBus(environment.DATABASE_URL_UNPOOLED, {
	channel: BROADCAST_CHANNEL,
	onPayload: (payload) => handleRemoteBroadcast(payload),
	onError: (error) => fastify.log.error({ error }, "websocket event bus error"),
});
attachBroadcastPublisher((payload) => {
	void eventBus.publish(payload).catch((error) =>
		fastify.log.error({ error }, "websocket broadcast publish failed"),
	);
});

try {
	await fastify.listen({ host: environment.HOST, port: environment.PORT });
} catch (error) {
	fastify.log.error(error);
	process.exitCode = 1;
}

const shutdown = async (signal: string) => {
	fastify.log.info({ signal }, "shutting down");
	await fastify.close();
	await eventBus.close();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
