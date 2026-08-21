import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireProjectRole, requireSession, requireTeamRole } from "../lib/auth.js";
import { ValidationError } from "../lib/errors.js";
import {
	addProjectMember,
	createProject,
	deleteProject,
	getProject,
	listProjectMembers,
	listProjects,
	removeProjectMember,
	updateProjectName,
	updateProjectMemberRole,
} from "../services/project.service.js";

const slugPattern = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const projectParamsSchema = z.object({ projectId: z.string().uuid() });
const teamParamsSchema = z.object({ teamId: z.string().uuid() });
const createProjectSchema = z.object({
	name: z.string().trim().min(1).max(100),
	slug: z.string().trim().toLowerCase().regex(slugPattern),
	description: z.string().trim().max(500).optional(),
});
const addMemberSchema = z.object({
	userId: z.string().uuid(),
	role: z.enum(["dev", "qa", "tester", "admin"]),
});
const memberParamsSchema = z.object({ userId: z.string().uuid() });
const updateMemberRoleSchema = z.object({
	role: z.enum(["dev", "qa", "tester", "admin"]),
});
const updateProjectNameSchema = z
	.object({ name: z.string().trim().min(1).max(100) })
	.strict();

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (!result.success) throw new ValidationError(z.treeifyError(result.error));
	return result.data;
}

export async function projectRoutes(fastify: FastifyInstance) {
	fastify.get("/api/teams/:teamId/projects", async (request) => {
		const { teamId } = parseInput(teamParamsSchema, request.params);
		await requireTeamRole(request, teamId, ["owner", "admin", "member"]);
		const session = await requireSession(request);
		return listProjects(fastify.db, teamId, session.user.id);
	});

	fastify.post("/api/teams/:teamId/projects", async (request, reply) => {
		const { teamId } = parseInput(teamParamsSchema, request.params);
		await requireTeamRole(request, teamId, ["owner", "admin"]);
		const session = await requireSession(request);
		const input = parseInput(createProjectSchema, request.body);
		const created = await createProject(fastify.db, teamId, session.user.id, input);
		return reply.status(201).send(created);
	});

	fastify.get("/api/projects/:projectId", async (request) => {
		const { projectId } = parseInput(projectParamsSchema, request.params);
		await requireProjectRole(request, projectId, ["dev", "qa", "tester", "admin"]);
		return getProject(fastify.db, projectId);
	});

	fastify.patch("/api/projects/:projectId", async (request) => {
		const { projectId } = parseInput(projectParamsSchema, request.params);
		await requireProjectRole(request, projectId, ["admin"]);
		const { name } = parseInput(updateProjectNameSchema, request.body);
		return updateProjectName(fastify.db, projectId, name);
	});

	fastify.delete("/api/projects/:projectId", async (request, reply) => {
		const { projectId } = parseInput(projectParamsSchema, request.params);
		await requireProjectRole(request, projectId, ["admin"]);
		await deleteProject(fastify.db, projectId);
		return reply.status(204).send();
	});

	fastify.get("/api/projects/:projectId/members", async (request) => {
		const { projectId } = parseInput(projectParamsSchema, request.params);
		await requireProjectRole(request, projectId, ["dev", "qa", "tester", "admin"]);
		return listProjectMembers(fastify.db, projectId);
	});

	fastify.post("/api/projects/:projectId/members", async (request, reply) => {
		const { projectId } = parseInput(projectParamsSchema, request.params);
		await requireProjectRole(request, projectId, ["admin"]);
		const input = parseInput(addMemberSchema, request.body);
		const member = await addProjectMember(fastify.db, projectId, input);
		return reply.status(201).send(member);
	});

	fastify.patch(
		"/api/projects/:projectId/members/:userId",
		async (request) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			await requireProjectRole(request, projectId, ["admin"]);
			const { userId } = parseInput(memberParamsSchema, request.params);
			const input = parseInput(updateMemberRoleSchema, request.body);
			return updateProjectMemberRole(fastify.db, projectId, userId, input.role);
		},
	);

	fastify.delete(
		"/api/projects/:projectId/members/:userId",
		async (request, reply) => {
			const { projectId } = parseInput(projectParamsSchema, request.params);
			await requireProjectRole(request, projectId, ["admin"]);
			const { userId } = parseInput(memberParamsSchema, request.params);
			await removeProjectMember(fastify.db, projectId, userId);
			return reply.status(204).send();
		},
	);
}
