import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireProjectRole, requireSession } from "../lib/auth.js";
import { ValidationError } from "../lib/errors.js";
import {
	assignIssue,
	createIssue,
	deleteIssue,
	getIssue,
	getIssueStatusHistory,
	listIssues,
	updateIssue,
	updateStatus,
} from "../services/issue.service.js";

const projectParamsSchema = z.object({ projectId: z.string().uuid() });
const issueParamsSchema = z.object({ issueId: z.string().uuid() });
const internalImageUrlPattern = /^\/api\/projects\/[0-9a-f-]{36}\/issue-images\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/i;
const imageUrlSchema = z.string().trim().max(2048).refine((value) => {
	if (internalImageUrlPattern.test(value)) return true;
	try {
		const url = new URL(value);
		return url.protocol === "https:" && url.username === "" && url.password === "";
	} catch {
		return false;
	}
}, "Image URL must use HTTPS");

const createIssueSchema = z.object({
	title: z.string().trim().min(1).max(200),
	description: z.string().trim().max(10000).optional(),
	severity: z.enum(["low", "medium", "high", "critical"]).optional(),
	environment: z
		.object({
			browser: z.string().optional(),
			os: z.string().optional(),
			device: z.string().optional(),
			version: z.string().optional(),
			page: z.string().optional(),
		})
		.optional(),
	stepsToReproduce: z.string().trim().max(10000).optional(),
	expectedResult: z.string().trim().max(5000).optional(),
	actualResult: z.string().trim().max(5000).optional(),
	assigneeId: z.string().uuid().optional(),
	qaAssigneeId: z.string().uuid().optional(),
	developerAssigneeIds: z.array(z.string().uuid()).max(100).optional(),
	qaAssigneeIds: z.array(z.string().uuid()).max(100).optional(),
	testCaseId: z.string().uuid().optional(),
	imageUrl: imageUrlSchema.optional(),
});

const updateIssueSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	description: z.string().trim().max(10000).nullable().optional(),
	severity: z.enum(["low", "medium", "high", "critical"]).optional(),
	environment: z
		.object({
			browser: z.string().optional(),
			os: z.string().optional(),
			device: z.string().optional(),
			version: z.string().optional(),
			page: z.string().optional(),
		})
		.nullable()
		.optional(),
	stepsToReproduce: z.string().trim().max(10000).optional(),
	expectedResult: z.string().trim().max(5000).optional(),
	actualResult: z.string().trim().max(5000).optional(),
	assigneeId: z.string().uuid().nullable().optional(),
	qaAssigneeId: z.string().uuid().nullable().optional(),
	developerAssigneeIds: z.array(z.string().uuid()).max(100).optional(),
	qaAssigneeIds: z.array(z.string().uuid()).max(100).optional(),
	testCaseId: z.string().uuid().nullable().optional(),
	imageUrl: imageUrlSchema.nullable().optional(),
});

const listIssuesQuerySchema = z.object({
	status: z.enum(["backlog", "in_progress", "in_qa", "verified", "rejected"]).optional(),
	assigneeId: z.string().uuid().optional(),
	qaAssigneeId: z.string().uuid().optional(),
	severity: z.enum(["low", "medium", "high", "critical"]).optional(),
	search: z.string().trim().max(100).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	offset: z.coerce.number().int().min(0).optional(),
});

const updateStatusSchema = z.object({
	status: z.enum(["backlog", "in_progress", "in_qa", "verified", "rejected"]),
	note: z.string().trim().max(1000).optional(),
});

const assignIssueSchema = z.object({
	developerAssigneeIds: z.array(z.string().uuid()).max(100).default([]),
	qaAssigneeIds: z.array(z.string().uuid()).max(100).default([]),
});

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (!result.success) throw new ValidationError(z.treeifyError(result.error));
	return result.data;
}

export async function issueRoutes(fastify: FastifyInstance) {
	fastify.post(
		"/api/projects/:projectId/issues",
		async (request, reply) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			await requireProjectRole(request, projectId, [
				"dev",
				"qa",
				"tester",
				"admin",
			]);
			const session = await requireSession(request);
			const input = parseInput(createIssueSchema, request.body);
			const issue = await createIssue(
				fastify.db,
				projectId,
				session.user.id,
				input,
			);
			return reply.status(201).send(issue);
		},
	);

	fastify.get(
		"/api/projects/:projectId/issues",
		async (request) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			await requireProjectRole(request, projectId, [
				"dev",
				"qa",
				"tester",
				"admin",
			]);
			const session = await requireSession(request);
			const filters = parseInput(listIssuesQuerySchema, request.query);
			return listIssues(fastify.db, projectId, session.user.id, filters);
		},
	);

	fastify.get(
		"/api/projects/:projectId/issues/:issueId",
		async (request) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			await requireProjectRole(request, projectId, [
				"dev",
				"qa",
				"tester",
				"admin",
			]);
			const session = await requireSession(request);
			const { issueId } = parseInput(issueParamsSchema, request.params);
			const issue = await getIssue(
				fastify.db,
				projectId,
				issueId,
				session.user.id,
			);
			if (!issue) {
				throw new (await import("../lib/errors.js")).NotFoundError("Issue");
			}
			return issue;
		},
	);

	fastify.patch(
		"/api/projects/:projectId/issues/:issueId",
		async (request) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			await requireProjectRole(request, projectId, ["dev", "qa", "admin"]);
			const session = await requireSession(request);
			const { issueId } = parseInput(issueParamsSchema, request.params);
			const input = parseInput(updateIssueSchema, request.body);
			return updateIssue(
				fastify.db,
				projectId,
				issueId,
				session.user.id,
				input,
			);
		},
	);

	fastify.patch(
		"/api/projects/:projectId/issues/:issueId/status",
		async (request) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			const { membership, session } = await requireProjectRole(request, projectId, ["dev", "qa", "tester", "admin"]);
			await requireSession(request);
			const { issueId } = parseInput(issueParamsSchema, request.params);
			const input = parseInput(updateStatusSchema, request.body);
			return updateStatus(
				fastify.db,
				projectId,
				issueId,
				session.user.id,
				input.status,
				"web",
				input.note,
				membership.role,
			);
		},
	);

	fastify.patch(
		"/api/projects/:projectId/issues/:issueId/assign",
		async (request) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			await requireProjectRole(request, projectId, ["qa", "admin"]);
			const session = await requireSession(request);
			const { issueId } = parseInput(issueParamsSchema, request.params);
			const input = parseInput(assignIssueSchema, request.body);
			return assignIssue(
				fastify.db,
				projectId,
				issueId,
				session.user.id,
				input.developerAssigneeIds,
				input.qaAssigneeIds,
				"web",
			);
		},
	);

	fastify.get(
		"/api/projects/:projectId/issues/:issueId/history",
		async (request) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			await requireProjectRole(request, projectId, [
				"dev",
				"qa",
				"tester",
				"admin",
			]);
			const session = await requireSession(request);
			const { issueId } = parseInput(issueParamsSchema, request.params);
			return getIssueStatusHistory(
				fastify.db,
				projectId,
				issueId,
				session.user.id,
			);
		},
	);

	fastify.delete(
		"/api/projects/:projectId/issues/:issueId",
		async (request, reply) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			await requireProjectRole(request, projectId, ["admin"]);
			const session = await requireSession(request);
			const { issueId } = parseInput(issueParamsSchema, request.params);
			await deleteIssue(fastify.db, projectId, issueId, session.user.id);
			return reply.status(204).send();
		},
	);
}
