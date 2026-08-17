import "fastify";
import type { Environment } from "../config.js";
import type { createAuth } from "../auth/index.js";
import type { createDb } from "../db/client.js";
import type { ImageStorage } from "../lib/r2.js";

declare module "fastify" {
	interface FastifyInstance {
		config: Environment;
		auth: ReturnType<typeof createAuth>;
		db: ReturnType<typeof createDb>;
		imageStorage: ImageStorage;
	}
}
