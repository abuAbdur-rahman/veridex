import type { FastifyInstance, FastifyReply } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { issueStatusHistory, issues, project, projectMember } from "../db/schema/index.js";
import { requireSession, type ProjectRole } from "../lib/auth.js";
import { AppError, ForbiddenError, ValidationError } from "../lib/errors.js";
import { authenticateApiToken } from "../services/api-token.service.js";
import {
	assignIssue,
	createIssue,
	getIssue,
	listIssues,
	updateIssue,
	updateStatus,
} from "../services/issue.service.js";
import { broadcast } from "../ws/broadcaster.js";

const tools = {
	list_issues: ["tester", "qa", "dev", "admin"],
	get_issue: ["tester", "qa", "dev", "admin"],
	create_issue: ["tester", "qa", "dev", "admin"],
	update_issue: ["dev", "admin"],
	change_status: ["dev", "admin"],
	assign_issue: ["qa", "admin"],
} as const satisfies Record<string, readonly ProjectRole[]>;

const projectIdSchema = z.string().uuid();
const toolCallSchema = z.object({
	name: z.string(),
	arguments: z.record(z.string(), z.unknown()).default({}),
});

const toolInputSchemas: Record<ToolName, Record<string, unknown>> = {
	list_issues: {
		type: "object",
		properties: {
			projectId: { type: "string", format: "uuid" },
			status: { type: "string", enum: ["backlog", "in_progress", "in_qa", "verified", "rejected"] },
			severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
			search: { type: "string", maxLength: 100 },
			limit: { type: "integer", minimum: 1, maximum: 100 },
			offset: { type: "integer", minimum: 0 },
		},
		required: ["projectId"],
	},
	get_issue: {
		type: "object",
		properties: {
			projectId: { type: "string", format: "uuid" },
			issueId: { type: "string", format: "uuid" },
		},
		required: ["projectId", "issueId"],
	},
	create_issue: {
		type: "object",
		properties: {
			projectId: { type: "string", format: "uuid" },
			title: { type: "string", minLength: 1, maxLength: 200 },
			description: { type: "string", maxLength: 10000 },
			severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
		},
		required: ["projectId", "title"],
	},
	update_issue: {
		type: "object",
		properties: {
			projectId: { type: "string", format: "uuid" },
			issueId: { type: "string", format: "uuid" },
			title: { type: "string", minLength: 1, maxLength: 200 },
			description: { type: ["string", "null"], maxLength: 10000 },
			severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
		},
		required: ["projectId", "issueId"],
	},
	change_status: {
		type: "object",
		properties: {
			projectId: { type: "string", format: "uuid" },
			issueId: { type: "string", format: "uuid" },
			status: { type: "string", enum: ["backlog", "in_progress", "in_qa", "verified", "rejected"] },
			note: { type: "string", maxLength: 1000 },
		},
		required: ["projectId", "issueId", "status"],
	},
	assign_issue: {
		type: "object",
		properties: {
			projectId: { type: "string", format: "uuid" },
			issueId: { type: "string", format: "uuid" },
			developerAssigneeIds: { type: "array", items: { type: "string", format: "uuid" }, maxItems: 100 },
			qaAssigneeIds: { type: "array", items: { type: "string", format: "uuid" }, maxItems: 100 },
		},
		required: ["projectId", "issueId"],
	},
};

type ToolName = keyof typeof tools;

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
	const result = schema.safeParse(input);
	if (!result.success) throw new ValidationError(z.treeifyError(result.error));
	return result.data;
}

function toolDefinitions() {
	return Object.keys(tools).map((name) => ({
		name,
		inputSchema: toolInputSchemas[name as ToolName],
	}));
}

function roleIsAllowed(roles: readonly ProjectRole[], role: ProjectRole) {
	return roles.some((allowedRole) => allowedRole === role);
}

function toolError(message: string) {
	return {
		content: [{ type: "text" as const, text: message }],
		isError: true,
	};
}

function errorMessage(error: unknown) {
	if (error instanceof AppError) return error.message;
	return "Tool execution failed";
}

function createMcpServer(fastify: FastifyInstance, userId: string): Server {
	const server = new Server(
		{ name: "veridex-mcp", version: "0.1.0" },
		{ capabilities: { tools: {} } },
	);

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: toolDefinitions(),
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const params = toolCallSchema.safeParse(request.params);
		if (!params.success) throw new McpError(-32602, "Invalid tool call");
		try {
			const result = await callTool(
				fastify,
				userId,
				params.data.name,
				params.data.arguments,
			);
			return {
				content: [{ type: "text" as const, text: JSON.stringify(result) }],
			};
		} catch (error) {
			return toolError(errorMessage(error));
		}
	});

	return server;
}

export async function mcpRoutes(fastify: FastifyInstance) {
	fastify.get("/api/mcp/access-summary", async (request) => {
		const session = await requireSession(request);
		const rows = await fastify.db
			.select({
				projectId: projectMember.projectId,
				projectName: project.name,
				role: projectMember.role,
			})
			.from(projectMember)
			.innerJoin(project, eq(project.id, projectMember.projectId))
			.where(eq(projectMember.userId, session.user.id));

		return {
			summary: rows.map((row) => ({
				...row,
				availableTools: Object.entries(tools)
					.filter(([, roles]) => roleIsAllowed(roles, row.role))
					.map(([name]) => name),
				totalTools: Object.keys(tools).length,
			})),
		};
	});

	fastify.get("/api/mcp/activity", async (request) => {
		const session = await requireSession(request);
		const activity = await fastify.db
			.select({
				id: issueStatusHistory.id,
				issueId: issueStatusHistory.issueId,
				fromStatus: issueStatusHistory.fromStatus,
				toStatus: issueStatusHistory.toStatus,
				note: issueStatusHistory.note,
				changedAt: issueStatusHistory.changedAt,
				ticketRef: issues.ticketRef,
				title: issues.title,
			})
			.from(issueStatusHistory)
			.innerJoin(issues, eq(issues.id, issueStatusHistory.issueId))
			.where(
				and(
					eq(issueStatusHistory.changedBy, session.user.id),
					eq(issueStatusHistory.source, "mcp"),
				),
			)
			.orderBy(desc(issueStatusHistory.changedAt))
			.limit(20);
		return { activity };
	});

	fastify.post("/mcp", async (request, reply) => {
		const auth = await authenticateApiToken(
			fastify.db,
			request.headers.authorization,
		);

		const server = createMcpServer(fastify, auth.userId);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		await server.connect(transport);

		reply.hijack();
		try {
			await transport.handleRequest(request.raw, reply.raw, request.body);
		} catch (error) {
			request.log.error(error, "MCP transport request failed");
			if (!reply.raw.headersSent) {
				reply.raw.writeHead(500, { "content-type": "application/json" });
				reply.raw.end(
					JSON.stringify({
						jsonrpc: "2.0",
						error: { code: -32603, message: "Internal error" },
						id: null,
					}),
				);
			} else {
				reply.raw.destroy();
			}
		} finally {
			void server.close().catch(() => {});
		}
	});

	fastify.get("/mcp", async (request, reply) => {
		await authenticateApiToken(fastify.db, request.headers.authorization);
		return methodNotAllowed(reply);
	});

	fastify.delete("/mcp", async (request, reply) => {
		await authenticateApiToken(fastify.db, request.headers.authorization);
		return methodNotAllowed(reply);
	});
}

function methodNotAllowed(reply: FastifyReply) {
	return reply.status(405).header("allow", "POST").send({
		jsonrpc: "2.0",
		error: { code: -32000, message: "Method not allowed." },
		id: null,
	});
}

async function callTool(
	fastify: FastifyInstance,
	userId: string,
	name: string,
	args: Record<string, unknown>,
): Promise<unknown> {
	const common = parseInput(z.object({ projectId: projectIdSchema }), args);
	const [membership] = await fastify.db
		.select({ role: projectMember.role })
		.from(projectMember)
		.where(
			and(
				eq(projectMember.projectId, common.projectId),
				eq(projectMember.userId, userId),
			),
		)
		.limit(1);
	const allowedRoles = tools[name as ToolName];
	if (!allowedRoles) throw new ValidationError({ name: "Unknown tool" });
	if (!membership || !roleIsAllowed(allowedRoles ?? [], membership.role)) {
		throw new ForbiddenError("Tool is not available for this project role");
	}

	switch (name) {
		case "list_issues":
			return listIssues(
				fastify.db,
				common.projectId,
				userId,
				parseInput(
					z.object({
						status: z.enum(["backlog", "in_progress", "in_qa", "verified", "rejected"]).optional(),
						severity: z.enum(["low", "medium", "high", "critical"]).optional(),
						search: z.string().trim().max(100).optional(),
						limit: z.number().int().min(1).max(100).optional(),
						offset: z.number().int().min(0).optional(),
					}),
					args,
				),
			);
		case "get_issue": {
			const input = parseInput(z.object({ issueId: z.string().uuid() }), args);
			return getIssue(fastify.db, common.projectId, input.issueId, userId);
		}
		case "create_issue": {
			const issue = await createIssue(
				fastify.db,
				common.projectId,
				userId,
				parseInput(
					z.object({
						title: z.string().trim().min(1).max(200),
						description: z.string().trim().max(10000).optional(),
						severity: z.enum(["low", "medium", "high", "critical"]).optional(),
					}),
					args,
				),
			);
			broadcast(common.projectId, {
				type: "issue:created",
				payload: { issueId: issue.id, projectId: common.projectId },
			});
			return issue;
		}
		case "update_issue": {
			const input = parseInput(
				z.object({
					issueId: z.string().uuid(),
					title: z.string().trim().min(1).max(200).optional(),
					description: z.string().trim().max(10000).nullable().optional(),
					severity: z.enum(["low", "medium", "high", "critical"]).optional(),
				}),
				args,
			);
			const issue = await updateIssue(
				fastify.db,
				common.projectId,
				input.issueId,
				userId,
				{
					title: input.title,
					description: input.description,
					severity: input.severity,
				},
			);
			broadcast(common.projectId, {
				type: "issue:updated",
				payload: { issueId: issue.id, projectId: common.projectId },
			});
			return issue;
		}
		case "change_status": {
			const input = parseInput(
				z.object({
					issueId: z.string().uuid(),
					status: z.enum(["backlog", "in_progress", "in_qa", "verified", "rejected"]),
					note: z.string().trim().max(1000).optional(),
				}),
				args,
			);
			const updated = await updateStatus(
				fastify.db,
				common.projectId,
				input.issueId,
				userId,
				input.status,
				"mcp",
				input.note,
				membership.role,
			);
			broadcast(common.projectId, {
				type: "issue:status_changed",
				payload: {
					issueId: updated.id,
					projectId: common.projectId,
					toStatus: updated.status,
					source: "mcp",
				},
			});
			return updated;
		}
		case "assign_issue": {
			const input = parseInput(
				z.object({
					issueId: z.string().uuid(),
					developerAssigneeIds: z.array(z.string().uuid()).max(100).optional(),
					qaAssigneeIds: z.array(z.string().uuid()).max(100).optional(),
				}),
				args,
			);
			const issue = await assignIssue(
				fastify.db,
				common.projectId,
				input.issueId,
				userId,
				input.developerAssigneeIds,
				input.qaAssigneeIds,
				"mcp",
			);
			broadcast(common.projectId, {
				type: "issue:assigned",
				payload: { issueId: issue.id, projectId: common.projectId },
			});
			return issue;
		}
	}
	throw new ValidationError({ name: "Unknown tool" });
}
