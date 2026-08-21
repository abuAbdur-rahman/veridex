import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireProjectRole } from "../lib/auth.js";
import { ValidationError } from "../lib/errors.js";

const allProjectRoles = ["dev", "qa", "tester", "admin"] as const;
const uploadParamsSchema = z.object({ projectId: z.string().uuid() });
const imageParamsSchema = uploadParamsSchema.extend({
	imageId: z.string().uuid(),
	extension: z.enum(["png", "jpg", "webp"]),
});

const imageTypes = {
	"image/png": {
		extension: "png",
		matches: (body: Buffer) =>
			body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
	},
	"image/jpeg": {
		extension: "jpg",
		matches: (body: Buffer) => body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff,
	},
	"image/webp": {
		extension: "webp",
		matches: (body: Buffer) =>
			body.length >= 12 && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP",
	},
} as const;

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (!result.success) throw new ValidationError(z.treeifyError(result.error));
	return result.data;
}

export async function issueImageRoutes(fastify: FastifyInstance) {
	fastify.post("/api/projects/:projectId/issue-images", async (request, reply) => {
		const { projectId } = parseInput(uploadParamsSchema, request.params);
		await requireProjectRole(request, projectId, allProjectRoles);
		const file = await request.file();
		if (!file || !Object.hasOwn(imageTypes, file.mimetype)) {
			throw new ValidationError({ image: ["Upload a PNG, JPEG, or WebP image"] });
		}

		const body = await file.toBuffer();
		const imageType = imageTypes[file.mimetype as keyof typeof imageTypes];
		if (!imageType.matches(body)) {
			throw new ValidationError({ image: ["File contents do not match the selected image type"] });
		}

		const imageId = crypto.randomUUID();
		const filename = `${imageId}.${imageType.extension}`;
		await fastify.imageStorage.put(
			`projects/${projectId}/issue-images/${filename}`,
			body,
			file.mimetype,
		);
		return reply.status(201).send({
			imageUrl: `/api/projects/${projectId}/issue-images/${filename}`,
		});
	});

	fastify.get(
		"/api/projects/:projectId/issue-images/:imageId.:extension",
		async (request, reply) => {
			const { projectId, imageId, extension } = parseInput(imageParamsSchema, request.params);
			await requireProjectRole(request, projectId, allProjectRoles);
			const image = await fastify.imageStorage.get(
				`projects/${projectId}/issue-images/${imageId}.${extension}`,
			);
			return reply.type(image.contentType).send(image.body);
		},
	);
}
