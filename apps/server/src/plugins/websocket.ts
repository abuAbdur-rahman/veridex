import type { FastifyInstance } from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { websocketHandler } from "../ws/handler.js";

export async function websocketPlugin(fastify: FastifyInstance) {
	await fastify.register(fastifyWebsocket);
	fastify.get("/ws", { websocket: true }, websocketHandler);
}
