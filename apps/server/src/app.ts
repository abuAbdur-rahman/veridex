import Fastify, {
	type FastifyInstance,
	type FastifyRequest,
} from "fastify";
import { parseEnvironment, type Environment } from "./config.js";
import { AppError } from "./lib/errors.js";
import { helmetPlugin } from "./plugins/helmet.js";
import { corsPlugin } from "./plugins/cors.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { swaggerPlugin, swaggerUiPlugin } from "./plugins/swagger.js";
import { authPlugin } from "./plugins/auth.js";
import { websocketPlugin } from "./plugins/websocket.js";
import { createAuth } from "./auth/index.js";
import { createDb, type Database } from "./db/client.js";
import { healthRoutes } from "./routes/health.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { teamRoutes } from "./routes/teams.js";
import { inviteRoutes } from "./routes/invites.js";
import { projectRoutes } from "./routes/projects.js";
import { issueRoutes } from "./routes/issues.js";
import multipart from "@fastify/multipart";
import { createImageStorage, type ImageStorage } from "./lib/r2.js";
import { issueImageRoutes } from "./routes/issue-images.js";
import { importRoutes } from "./routes/import.js";
import type { Queue } from "./jobs/queue.js";
import { registerImportWorker } from "./jobs/import.worker.js";
import { registerVerifiedIssueCleanupWorker } from "./jobs/verified-issue-cleanup.worker.js";
import { devAuthRoutes } from "./routes/dev-auth.js";
import { apiTokenRoutes } from "./routes/api-tokens.js";
import { commentRoutes } from "./routes/comments.js";
import { mcpRoutes } from "./routes/mcp.js";

export interface BuildAppOptions {
	db?: Database;
	imageStorage?: ImageStorage;
	queue?: Queue;
}

const fastifyClientErrors: Readonly<
	Record<string, { statusCode: number; code: string; message: string }>
> = {
	FST_ERR_CTP_INVALID_MEDIA_TYPE: {
		statusCode: 415,
		code: "UNSUPPORTED_MEDIA_TYPE",
		message: "Unsupported media type",
	},
	FST_ERR_CTP_BODY_TOO_LARGE: {
		statusCode: 413,
		code: "PAYLOAD_TOO_LARGE",
		message: "Request body is too large",
	},
	FST_ERR_CTP_EMPTY_JSON_BODY: {
		statusCode: 400,
		code: "MALFORMED_JSON",
		message: "Malformed JSON body",
	},
	FST_ERR_CTP_INVALID_JSON_BODY: {
		statusCode: 400,
		code: "MALFORMED_JSON",
		message: "Malformed JSON body",
	},
};

function getFastifyErrorCode(error: unknown) {
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string"
	) {
		return error.code;
	}
	return undefined;
}

function getValidationDetails(error: unknown) {
	if (typeof error !== "object" || error === null || !("validation" in error)) {
		return undefined;
	}
	if (!Array.isArray(error.validation)) return undefined;

	return error.validation.map((issue) => {
		if (typeof issue !== "object" || issue === null) return {};
		const record = issue as Record<string, unknown>;
		return Object.fromEntries(
			["instancePath", "schemaPath", "keyword", "message"]
				.filter((key) => typeof record[key] === "string")
				.map((key) => [key, record[key]]),
		);
	});
}

const inviteTokenPathPattern = /\/api\/invites\/[A-Za-z0-9_-]{43}/;

export function redactInviteTokenUrl(url: string) {
	return url.replace(inviteTokenPathPattern, "/api/invites/[REDACTED]");
}

function requestLogSerializer(request: FastifyRequest) {
	const acceptVersion = request.headers["accept-version"];
	return {
		method: request.method,
		url: redactInviteTokenUrl(request.url),
		version:
			typeof acceptVersion === "string" ? acceptVersion : undefined,
		host: request.host,
		remoteAddress: request.ip,
		remotePort: request.socket?.remotePort,
	};
}

export function buildApp(
	environment: Environment = parseEnvironment(process.env),
	options: BuildAppOptions = {},
): FastifyInstance {
	const app = Fastify({
		logger:
			environment.NODE_ENV === "test"
				? false
				: {
						serializers: {
							req: requestLogSerializer,
						},
					},
		trustProxy: environment.TRUST_PROXY,
	});

	const db = options.db ?? createDb(environment.DATABASE_URL);

	app.decorate("config", environment);
	app.decorate("db", db);
	app.decorate("auth", createAuth(db, environment));
	app.decorate("imageStorage", options.imageStorage ?? createImageStorage(environment));
	if (options.queue) {
		app.decorate("queue", options.queue);
	}
	app.addHook("onClose", async () => {
		if (options.queue) {
			await options.queue.stop();
		}
		await db.$client.end();
	});

	app.register(helmetPlugin);
	app.register(corsPlugin, {
		origin: (origin, callback) => {
			callback(null, origin === environment.WEB_ORIGIN);
		},
		credentials: true,
	});
	app.register(rateLimitPlugin, {
		max: 200,
		timeWindow: "1 minute",
		// @fastify/rate-limit throws whatever this builder returns; a plain object
		// would bypass the shared error handler and surface as a 500, so return an
		// AppError that the handler below serializes into the standard envelope.
		errorResponseBuilder: () =>
			new AppError("RATE_LIMITED", "Too many requests", 429),
	});
	if (environment.NODE_ENV !== "production") {
		app.register(swaggerPlugin, {
			openapi: {
				info: {
					title: "Veridex API",
					description: "QA-aware issue tracker backend",
					version: "0.1.0",
				},
			},
		});
		app.register(swaggerUiPlugin, {
			routePrefix: "/docs",
		});
	}
	app.register(authPlugin);
	app.register(websocketPlugin);
	app.register(multipart, {
		limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
	});
	app.register(healthRoutes);
	app.register(onboardingRoutes);
	app.register(teamRoutes);
	app.register(inviteRoutes);
	app.register(projectRoutes);
	app.register(issueRoutes);
	app.register(issueImageRoutes);

	app.register(importRoutes);
	app.register(apiTokenRoutes);
	app.register(commentRoutes);
	app.register(mcpRoutes);
	app.register(devAuthRoutes);

	if (options.queue) {
		const queue = options.queue;
		app.addHook("onReady", async () => {
			await registerImportWorker({
				db,
				boss: queue,
			});
			await registerVerifiedIssueCleanupWorker({
				db,
				boss: queue,
			});
		});
	}

	app.setNotFoundHandler((request, reply) => {
		return reply.status(404).send({
			error: {
				code: "NOT_FOUND",
				message: `Route ${request.method}:${request.url} not found`,
			},
		});
	});

	app.setErrorHandler((error, request, reply) => {
		if (error instanceof AppError) {
			return reply.status(error.statusCode).send({
				error: {
					code: error.code,
					message: error.message,
					...(error.details === undefined ? {} : { details: error.details }),
				},
			});
		}

		const fastifyCode = getFastifyErrorCode(error);
		if (fastifyCode === "FST_ERR_VALIDATION") {
			return reply.status(422).send({
				error: {
					code: "VALIDATION_ERROR",
					message: "Invalid input",
					details: getValidationDetails(error),
				},
			});
		}

		const mapping = fastifyCode ? fastifyClientErrors[fastifyCode] : undefined;
		if (mapping) {
			return reply.status(mapping.statusCode).send({
				error: {
					code: mapping.code,
					message: mapping.message,
				},
			});
		}

		request.log.error(error);
		return reply.status(500).send({
			error: {
				code: "INTERNAL_ERROR",
				message: "Something went wrong",
			},
		});
	});

	return app;
}
