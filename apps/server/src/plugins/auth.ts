import type { FastifyInstance } from "fastify";
import { toNodeHandler } from "better-auth/node";

interface NodeRequestWithBody {
	body?: unknown;
}

export async function authPlugin(fastify: FastifyInstance) {
	fastify.all("/api/auth/*", async (request, reply) => {
		if (request.body !== undefined) {
			(request.raw as NodeRequestWithBody).body = request.body;
		}
		return toNodeHandler(fastify.auth)(request.raw, reply.raw);
	});
}