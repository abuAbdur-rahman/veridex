import multipart from "@fastify/multipart";
import Fastify from "fastify";
import type { Database } from "../db/client.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import type { ImageStorage } from "../lib/r2.js";
import { issueImageRoutes } from "./issue-images.js";

const { requireProjectRole } = vi.hoisted(() => ({
	requireProjectRole: vi.fn(),
}));

vi.mock("../lib/auth.js", () => ({ requireProjectRole }));

const apps: Array<ReturnType<typeof Fastify>> = [];
const projectId = "22222222-2222-4222-8222-222222222222";
const imageId = "33333333-3333-4333-8333-333333333333";
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function multipartImage(content: Buffer, contentType = "image/png") {
	const boundary = "veridex-test-boundary";
	return {
		headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
		payload: Buffer.concat([
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="issue.png"\r\nContent-Type: ${contentType}\r\n\r\n`,
			),
			content,
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]),
	};
}

async function createApp(storage: ImageStorage) {
	const app = Fastify({ logger: false });
	app.decorate("db", {} as Database);
	app.decorate("imageStorage", storage);
	app.setErrorHandler((error, _request, reply) => {
		if (error instanceof AppError) {
			return reply.status(error.statusCode).send({
				error: { code: error.code, message: error.message },
			});
		}
		return reply.status(500).send({
			error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
		});
	});
	await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
	await app.register(issueImageRoutes);
	apps.push(app);
	return app;
}

function storage(): ImageStorage {
	return {
		put: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue({ body: png, contentType: "image/png" }),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	requireProjectRole.mockResolvedValue({ membership: { projectRole: "tester" } });
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("issue image routes", () => {
	it("requires project membership before uploading", async () => {
		requireProjectRole.mockRejectedValue(new ForbiddenError());
		const imageStorage = storage();
		const response = await (await createApp(imageStorage)).inject({
			method: "POST",
			url: `/api/projects/${projectId}/issue-images`,
			...multipartImage(png),
		});

		expect(response.statusCode).toBe(403);
		expect(imageStorage.put).not.toHaveBeenCalled();
	});

	it("stores a validated PNG and returns its project-scoped path", async () => {
		const imageStorage = storage();
		const response = await (await createApp(imageStorage)).inject({
			method: "POST",
			url: `/api/projects/${projectId}/issue-images`,
			...multipartImage(png),
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual({
			imageUrl: expect.stringMatching(
				new RegExp(`^/api/projects/${projectId}/issue-images/[0-9a-f-]+\\.png$`),
			),
		});
		expect(imageStorage.put).toHaveBeenCalledWith(
			expect.stringMatching(new RegExp(`^projects/${projectId}/issue-images/[0-9a-f-]+\\.png$`)),
			png,
			"image/png",
		);
	});

	it("rejects content whose bytes do not match its declared image type", async () => {
		const imageStorage = storage();
		const response = await (await createApp(imageStorage)).inject({
			method: "POST",
			url: `/api/projects/${projectId}/issue-images`,
			...multipartImage(Buffer.from("not an image")),
		});

		expect(response.statusCode).toBe(422);
		expect(imageStorage.put).not.toHaveBeenCalled();
	});

	it("rechecks membership before serving a private image", async () => {
		requireProjectRole.mockRejectedValue(new UnauthorizedError());
		const imageStorage = storage();
		const response = await (await createApp(imageStorage)).inject({
			method: "GET",
			url: `/api/projects/${projectId}/issue-images/${imageId}.png`,
		});

		expect(response.statusCode).toBe(401);
		expect(imageStorage.get).not.toHaveBeenCalled();
	});

	it("serves a private image with its stored content type", async () => {
		const imageStorage = storage();
		const response = await (await createApp(imageStorage)).inject({
			method: "GET",
			url: `/api/projects/${projectId}/issue-images/${imageId}.png`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("image/png");
		expect(response.rawPayload).toEqual(png);
		expect(imageStorage.get).toHaveBeenCalledWith(
			`projects/${projectId}/issue-images/${imageId}.png`,
		);
	});
});
