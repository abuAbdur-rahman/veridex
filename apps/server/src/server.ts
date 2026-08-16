import "dotenv/config";
import { buildApp } from "./app.js";
import { parseEnvironment } from "./config.js";

const environment = parseEnvironment(process.env);
const app = buildApp(environment);

try {
	await app.listen({ host: environment.HOST, port: environment.PORT });
} catch (error) {
	app.log.error(error);
	process.exitCode = 1;
}

const shutdown = async (signal: string) => {
	app.log.info({ signal }, "shutting down");
	await app.close();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
