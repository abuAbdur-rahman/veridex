import "fastify";
import type { Environment } from "../config.js";
import type { createAuth } from "../auth/index.js";
import type { createDb } from "../db/client.js";

declare module "fastify" {
	interface FastifyInstance {
		config: Environment;
		auth: ReturnType<typeof createAuth>;
		db: ReturnType<typeof createDb>;
	}
}