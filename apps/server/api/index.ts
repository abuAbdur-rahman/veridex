import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

let app: ReturnType<typeof buildApp> | undefined;

function getApp() {
	if (!app) {
		app = buildApp();
	}
	return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
	const fastify = getApp();
	await fastify.ready();
	fastify.server.emit("request", req, res);
}
