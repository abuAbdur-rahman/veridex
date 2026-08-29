import "dotenv/config";
import Fastify from "fastify";
import { buildApp } from "./app-factory.js";
import { parseEnvironment } from "./config.js";
import { createQueue } from "./jobs/queue.js";
import {
	attachBroadcastPublisher,
	BROADCAST_CHANNEL,
	handleRemoteBroadcast,
} from "./ws/broadcaster.js";
import { createPostgresEventBus } from "./ws/event-bus.js";

// Canonical Vercel Fastify entrypoint: must live at src/server.ts (or app.ts/index.ts)
// and directly import 'fastify' + call listen. See https://vercel.com/kb/guide/ship-a-fastify-app-on-vercel
// and https://vercel.com/docs/frameworks/backend/fastify

const environment = parseEnvironment(process.env);

const queue = await createQueue(environment.DATABASE_URL_UNPOOLED);
await queue.createQueue("import-insert");

// Build Fastify app (factory mirrors `const fastify = Fastify({ logger: true })` from docs)
const fastify = buildApp(environment, { queue });

// Purge lingering schedule from removed verified-issue cleanup job
await queue.unschedule("verified-issue-cleanup").catch((error) => {
	fastify.log.warn({ error }, "failed to unschedule verified-issue-cleanup");
});

// Keep Fastify import referenced so Vercel's framework detector sees it (buildApp already imports it)
void Fastify;

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

// Docs pattern: fastify.listen({ port: 3000 })
// Use Vercel-compatible host/port (Vercel sets PORT; local uses env HOST/PORT)
const listenPort = environment.NODE_ENV === "production" ? Number(process.env.PORT) || 3000 : environment.PORT;
const listenHost = environment.NODE_ENV === "production" ? "0.0.0.0" : environment.HOST;

try {
	await fastify.listen({ host: listenHost, port: listenPort });
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
