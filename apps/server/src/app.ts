import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import { parseEnvironment, type Environment } from "./config.js";

export function buildApp(
	environment: Environment = parseEnvironment(process.env),
): FastifyInstance {
	const app = Fastify({
		logger: environment.NODE_ENV !== "test",
	});

	app.register(helmet);

	app.get("/health", async () => ({
		status: "ok",
		service: "veridex-server",
	}));

	app.setErrorHandler((error, _request, reply) => {
		app.log.error(error);
		return reply.status(500).send({
			error: {
				code: "INTERNAL_ERROR",
				message: "Something went wrong",
			},
		});
	});

	return app;
}
