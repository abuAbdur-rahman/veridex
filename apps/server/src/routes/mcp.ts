import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
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

const tools = {
 list_issues: ["tester", "qa", "dev", "admin"],
 get_issue: ["tester", "qa", "dev", "admin"],
 create_issue: ["tester", "qa", "dev", "admin"],
 update_issue: ["dev", "admin"],
 change_status: ["dev", "admin"],
 assign_issue: ["qa", "admin"],
} as const satisfies Record<string, readonly ProjectRole[]>;

const projectIdSchema = z.string().uuid();
const rpcRequestSchema = z.object({
 jsonrpc: z.literal("2.0"),
 id: z.union([z.string(), z.number(), z.null()]),
 method: z.string(),
 params: z.record(z.string(), z.unknown()).optional(),
});
const toolCallSchema = z.object({
 name: z.string(),
 arguments: z.record(z.string(), z.unknown()).default({}),
});

type RpcRequest = z.infer<typeof rpcRequestSchema>;
type ToolName = keyof typeof tools;
type ToolResult = Record<string, unknown> | unknown[] | null;

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
 const result = schema.safeParse(input);
 if (!result.success) throw new ValidationError(z.treeifyError(result.error));
 return result.data;
}

function toolDefinitions() {
	return Object.keys(tools).map((name) => ({ name }));
}

function roleIsAllowed(roles: readonly ProjectRole[], role: ProjectRole) {
	return roles.some((allowedRole) => allowedRole === role);
}

function rpcError(id: RpcRequest["id"], code: number, message: string) {
 return { jsonrpc: "2.0" as const, id, error: { code, message } };
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
  const parsed = rpcRequestSchema.safeParse(request.body);
  if (!parsed.success) {
   return reply.send(rpcError(null, -32600, "Invalid Request"));
  }

  const body = parsed.data;
  if (body.method === "tools/list") {
   return reply.send({
    jsonrpc: "2.0",
    id: body.id,
    result: { tools: toolDefinitions() },
   });
  }
  if (body.method !== "tools/call") {
   return reply.send(rpcError(body.id, -32601, "Method not found"));
  }

  const params = toolCallSchema.safeParse(body.params);
  if (!params.success) {
   return reply.send(rpcError(body.id, -32602, "Invalid tool call"));
  }

  try {
   const result = await callTool(
    fastify,
    auth.userId,
    params.data.name,
    params.data.arguments,
   );
   return reply.send({
    jsonrpc: "2.0",
    id: body.id,
    result: {
     content: [{ type: "text", text: JSON.stringify(result) }],
    },
   });
  } catch (error) {
   return reply.send({
    jsonrpc: "2.0",
    id: body.id,
    result: toolError(errorMessage(error)),
   });
  }
 });
}

async function callTool(
 fastify: FastifyInstance,
 userId: string,
 name: string,
 args: Record<string, unknown>,
): Promise<ToolResult> {
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
  case "create_issue":
   return createIssue(
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
   return updateIssue(fastify.db, common.projectId, input.issueId, userId, input);
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
   return updateStatus(
    fastify.db,
    common.projectId,
    input.issueId,
    userId,
    input.status,
    "mcp",
    input.note,
    membership.role,
   );
  }
	case "assign_issue": {
   const input = parseInput(
    z.object({
     issueId: z.string().uuid(),
     developerAssigneeIds: z.array(z.string().uuid()).max(100).default([]),
     qaAssigneeIds: z.array(z.string().uuid()).max(100).default([]),
    }),
    args,
   );
		return assignIssue(
    fastify.db,
    common.projectId,
    input.issueId,
    userId,
    input.developerAssigneeIds,
    input.qaAssigneeIds,
    "mcp",
		);
	}
	}
	throw new ValidationError({ name: "Unknown tool" });
}
