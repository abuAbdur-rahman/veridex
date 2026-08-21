import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireProjectRole, requireSession } from "../lib/auth.js";
import { ValidationError } from "../lib/errors.js";
import {
	uploadSpreadsheet,
	getPreview,
	confirmImport,
	getImportErrors,
} from "../services/import.service.js";

const paramsSchema = z.object({
	projectId: z.string().uuid(),
	importJobId: z.string().uuid(),
});

const confirmSchema = z.object({
	columnMapping: z.record(z.string(), z.string()),
	colorMapping: z.record(z.string(), z.string()).optional(),
	defaultStatus: z
		.enum(["backlog", "pending", "in_progress", "in_qa", "verified", "rejected"])
		.optional(),
	worksheetIndex: z.number().int().min(0).default(0),
	statusAssigneeMapping: z.record(
		z.enum(["backlog", "pending", "in_progress", "in_qa", "verified", "rejected"]),
		z.array(z.string().min(1)).min(1),
	).optional(),
});

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (!result.success) throw new ValidationError(z.treeifyError(result.error));
	return result.data;
}

export async function importRoutes(fastify: FastifyInstance) {
	fastify.post(
		"/api/projects/:projectId/import/upload",
		async (request, reply) => {
			const { projectId } = parseInput(
				z.object({ projectId: z.string().uuid() }),
				request.params,
			);
			await requireProjectRole(request, projectId, ["qa", "admin"]);

			const file = await request.file();
			if (!file) {
				throw new ValidationError({ file: ["File is required"] });
			}

			const allowedMimes = [
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"text/csv",
				"application/csv",
			];
			const allowedExts = [".xlsx", ".csv"];
			const ext = file.filename.toLowerCase();

			if (
				!allowedMimes.includes(file.mimetype) &&
				!allowedExts.some((e) => ext.endsWith(e))
			) {
				throw new ValidationError({
					file: ["File must be .xlsx or .csv"],
				});
			}

			const buffer = await file.toBuffer();
			const session = await requireSession(request);
			const result = await uploadSpreadsheet(
				fastify.db,
				projectId,
				session.user.id,
				{ buffer, filename: file.filename, mimetype: file.mimetype },
			);

			return reply.status(201).send(result);
		},
	);

	fastify.get(
		"/api/projects/:projectId/import/:importJobId/preview",
		async (request) => {
			const { projectId, importJobId } = parseInput(paramsSchema, request.params);
			const { worksheetIndex } = parseInput(z.object({ worksheetIndex: z.coerce.number().int().min(0).default(0) }), request.query);
			await requireProjectRole(request, projectId, ["qa", "admin"]);
			const session = await requireSession(request);
			return getPreview(fastify.db, projectId, importJobId, session.user.id, worksheetIndex);
		},
	);

	fastify.patch(
		"/api/projects/:projectId/import/:importJobId/confirm",
		async (request) => {
			const { projectId, importJobId } = parseInput(paramsSchema, request.params);
			await requireProjectRole(request, projectId, ["qa", "admin"]);
			const session = await requireSession(request);
			const input = parseInput(confirmSchema, request.body);
			if (!fastify.queue) {
				throw new ValidationError({ queue: ["Import queue is unavailable"] });
			}
			return confirmImport(
				fastify.db,
				fastify.queue,
				projectId,
				importJobId,
				session.user.id,
				input.columnMapping,
				input.colorMapping,
				input.defaultStatus,
				input.worksheetIndex,
				input.statusAssigneeMapping,
			);
		},
	);

	fastify.get(
		"/api/projects/:projectId/import/:importJobId/errors",
		async (request) => {
			const { projectId, importJobId } = parseInput(paramsSchema, request.params);
			await requireProjectRole(request, projectId, ["qa", "admin"]);
			const session = await requireSession(request);
			return getImportErrors(
				fastify.db,
				projectId,
				importJobId,
				session.user.id,
			);
		},
	);
}
