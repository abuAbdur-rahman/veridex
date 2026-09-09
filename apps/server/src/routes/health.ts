import type { FastifyInstance } from "fastify";

export async function healthRoutes(fastify: FastifyInstance) {
	fastify.get("/", async () => ({
		message: "Welcome to Veridex API",
		status: "ok",
		service: "veridex-server",
		docs: "/docs",
		health: "/health",
	}));
	fastify.get("/health", async () => ({
		status: "ok",
		service: "veridex-server",
	}));
}