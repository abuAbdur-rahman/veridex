import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireProjectRole } from "../lib/auth.js";
import { ValidationError } from "../lib/errors.js";
import { createComment, deleteComment, listComments, updateComment } from "../services/comment.service.js";
import { broadcast } from "../ws/broadcaster.js";

const paramsSchema = z.object({ projectId: z.string().uuid(), issueId: z.string().uuid() });
const commentParamsSchema = z.object({ projectId: z.string().uuid(), commentId: z.string().uuid() });
const bodySchema = z.object({ body: z.string().trim().min(1).max(5000) });

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (!result.success) throw new ValidationError(z.treeifyError(result.error));
	return result.data;
}

const roles = ["dev", "qa", "tester", "admin"] as const;

export async function commentRoutes(fastify: FastifyInstance) {
	fastify.get("/api/projects/:projectId/issues/:issueId/comments", async (request) => {
		const { projectId, issueId } = parseInput(paramsSchema, request.params);
		const { session } = await requireProjectRole(request, projectId, roles);
		return listComments(fastify.db, projectId, issueId, session.user.id);
	});

	fastify.post("/api/projects/:projectId/issues/:issueId/comments", async (request, reply) => {
		const { projectId, issueId } = parseInput(paramsSchema, request.params);
		const { session } = await requireProjectRole(request, projectId, roles);
		const { body } = parseInput(bodySchema, request.body);
		const comment = await createComment(fastify.db, projectId, issueId, session.user.id, body);
		broadcast(projectId, {
			type: "comment:created",
			payload: { commentId: comment.id, issueId: comment.issueId, projectId },
		});
		return reply.status(201).send(comment);
	});

	fastify.patch("/api/projects/:projectId/comments/:commentId", async (request) => {
		const { projectId, commentId } = parseInput(commentParamsSchema, request.params);
		const { session } = await requireProjectRole(request, projectId, roles);
		const { body } = parseInput(bodySchema, request.body);
		const comment = await updateComment(fastify.db, projectId, commentId, session.user.id, body);
		broadcast(projectId, {
			type: "comment:updated",
			payload: { commentId: comment.id, issueId: comment.issueId, projectId },
		});
		return comment;
	});

	fastify.delete("/api/projects/:projectId/comments/:commentId", async (request, reply) => {
		const { projectId, commentId } = parseInput(commentParamsSchema, request.params);
		const { session } = await requireProjectRole(request, projectId, roles);
		const deleted = await deleteComment(fastify.db, projectId, commentId, session.user.id);
		broadcast(projectId, {
			type: "comment:deleted",
			payload: { commentId: deleted.id, issueId: deleted.issueId, projectId },
		});
		return reply.status(204).send();
	});
}
