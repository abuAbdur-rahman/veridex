# Spec: Projects + Project Membership Slice

## Objective
Implement the Projects and Project Members CRUD slice for the Veridex backend following the established teams slice patterns. This enables users to list/create projects under a team, get project details, and manage project members (add, role change, remove) with proper authorization.

**User Stories:**
- As a team member, I can list all projects in my team so I can navigate to them.
- As a team admin/owner, I can create a new project under my team.
- As a project member, I can view project details and see all project members.
- As a project admin, I can add team members to the project with a role (dev/qa/tester/admin).
- As a project admin, I can change a member's role on the project.
- As a project admin, I can remove a member from the project.

**Success Criteria:**
- All 7 API routes from route map implemented and tested
- Service layer with DI'd db, transactions for multi-row ops
- Zod validation at route boundary with shared validation envelope
- Typed error mapping (e.g., project_team_slug_unique → 409 PROJECT_SLUG_TAKEN)
- Tests: stateful transaction double pattern (mirror team.service.test.ts), route mocks (mirror teams.test.ts)
- Routes registered in apps/server/src/app.ts
- Migration adding idx_project_team ON project(team_id) and idx_project_member_project ON project_member(project_id)

## Tech Stack
- Node.js LTS, Fastify 5, TypeScript
- Zod for validation, Drizzle ORM, postgres.js
- Better Auth (mounted via toNodeHandler)
- Vitest for testing

## Commands
```bash
# From apps/server/
pnpm test          # Run tests
pnpm typecheck     # TypeScript check
pnpm build         # Build
pnpm db:generate   # Generate migration after schema changes
pnpm dev           # Dev server (http://127.0.0.1:3001)
```

## Project Structure
```
apps/server/src/
├── routes/
│   ├── projects.ts          # NEW: Project routes
│   └── projects.test.ts     # NEW: Route tests
├── services/
│   ├── project.service.ts   # NEW: Business logic
│   └── project.service.test.ts # NEW: Service tests
├── db/
│   └── schema/
│       └── project.ts       # EXISTING: Already has tables
└── app.ts                   # MODIFY: Register project routes
```

## Code Style

**Service Function Pattern** (mirror team.service.ts):
```typescript
import { eq, and } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { project, projectMember, user, team } from "../db/schema/index.js";
import { AppError } from "../lib/errors.js";

function isProjectSlugConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    ("constraint_name" in error || "constraint" in error) &&
    ("constraint_name" in error ? error.constraint_name : error.constraint) ===
      "project_team_slug_unique"
  );
}

export async function listProjects(db: Database, teamId: string, userId: string) {
  // Verify user is team member first (done by route via requireTeamRole)
  return db
    .select({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      projectRole: projectMember.role,
    })
    .from(projectMember)
    .innerJoin(project, eq(project.id, projectMember.projectId))
    .where(and(eq(projectMember.userId, userId), eq(project.teamId, teamId)));
}

export async function createProject(
  db: Database,
  teamId: string,
  userId: string,
  input: { name: string; slug: string; description?: string },
) {
  try {
    return await db.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(project)
        .values({
          teamId,
          name: input.name,
          slug: input.slug,
          description: input.description,
          createdBy: userId,
        })
        .returning({
          id: project.id,
          name: project.name,
          slug: project.slug,
          description: project.description,
          teamId: project.teamId,
        });

      if (!createdProject) {
        throw new AppError("PROJECT_CREATE_FAILED", "Could not create project", 500);
      }

      await tx.insert(projectMember).values({
        projectId: createdProject.id,
        userId,
        role: "admin",
      });

      return { ...createdProject, projectRole: "admin" as const };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isProjectSlugConflict(error)) {
      throw new AppError("PROJECT_SLUG_TAKEN", "Project slug is unavailable in this team", 409);
    }
    throw error;
  }
}
```

**Route Pattern** (mirror teams.ts):
```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession, requireTeamRole, requireProjectRole } from "../lib/auth.js";
import { ValidationError } from "../lib/errors.js";
import {
  listProjects,
  createProject,
  getProject,
  listProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
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
const updateMemberRoleSchema = z.object({
  role: z.enum(["dev", "qa", "tester", "admin"]),
});

function parseInput<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(z.treeifyError(result.error));
  return result.data;
}

export async function projectRoutes(fastify: FastifyInstance) {
  // GET /api/teams/:teamId/projects (team member)
  fastify.get("/api/teams/:teamId/projects", async (request) => {
    const { teamId } = parseInput(teamParamsSchema, request.params);
    await requireTeamRole(request, teamId, ["owner", "admin", "member"]);
    const session = await requireSession(request);
    return listProjects(fastify.db, teamId, session.user.id);
  });

  // POST /api/teams/:teamId/projects (team owner/admin)
  fastify.post("/api/teams/:teamId/projects", async (request, reply) => {
    const { teamId } = parseInput(teamParamsSchema, request.params);
    await requireTeamRole(request, teamId, ["owner", "admin"]);
    const session = await requireSession(request);
    const input = parseInput(createProjectSchema, request.body);
    const created = await createProject(fastify.db, teamId, session.user.id, input);
    return reply.status(201).send(created);
  });

  // GET /api/projects/:projectId (project member)
  fastify.get("/api/projects/:projectId", async (request) => {
    const { projectId } = parseInput(projectParamsSchema, request.params);
    await requireProjectRole(request, projectId, ["dev", "qa", "tester", "admin"]);
    return getProject(fastify.db, projectId);
  });

  // GET /api/projects/:projectId/members (project member)
  fastify.get("/api/projects/:projectId/members", async (request) => {
    const { projectId } = parseInput(projectParamsSchema, request.params);
    await requireProjectRole(request, projectId, ["dev", "qa", "tester", "admin"]);
    return listProjectMembers(fastify.db, projectId);
  });

  // POST /api/projects/:projectId/members (project admin)
  fastify.post("/api/projects/:projectId/members", async (request, reply) => {
    const { projectId } = parseInput(projectParamsSchema, request.params);
    await requireProjectRole(request, projectId, ["admin"]);
    const input = parseInput(addMemberSchema, request.body);
    const member = await addProjectMember(fastify.db, projectId, input);
    return reply.status(201).send(member);
  });

  // PATCH /api/projects/:projectId/members/:userId (project admin)
  fastify.patch("/api/projects/:projectId/members/:userId", async (request) => {
    const { projectId } = parseInput(projectParamsSchema, request.params);
    await requireProjectRole(request, projectId, ["admin"]);
    const { userId } = parseInput(z.object({ userId: z.string().uuid() }), request.params);
    const input = parseInput(updateMemberRoleSchema, request.body);
    return updateProjectMemberRole(fastify.db, projectId, userId, input.role);
  });

  // DELETE /api/projects/:projectId/members/:userId (project admin)
  fastify.delete("/api/projects/:projectId/members/:userId", async (request, reply) => {
    const { projectId } = parseInput(projectParamsSchema, request.params);
    await requireProjectRole(request, projectId, ["admin"]);
    const { userId } = parseInput(z.object({ userId: z.string().uuid() }), request.params);
    await removeProjectMember(fastify.db, projectId, userId);
    return reply.status(204).send();
  });
}
```

## Testing Strategy
- **Framework**: Vitest
- **Service Tests**: Stateful transaction double pattern (mirror team.service.test.ts)
  - `createQueryDatabase` for read operations
  - `createProjectDatabase` with `state` mutation for write operations
  - Test: list projects, get project, list members, create project, add member, update role, remove member
  - Test: rollback on member creation failure, slug conflict → 409, missing row → 500
- **Route Tests**: Mock service + auth helpers (mirror teams.test.ts)
  - `vi.hoisted` for mocks, `vi.mock` for modules
  - Test: auth required, validation envelope, authorization checks, typed error preservation
  - Test: malformed UUID rejected before auth

## Boundaries
- **Always**: Run tests before commits, follow naming conventions, validate inputs at route boundary, throw AppError subclasses
- **Ask first**: Database schema changes (indexes require migration), adding dependencies, changing CI config
- **Never**: Commit secrets, edit vendor directories, remove failing tests without approval, use `any` type

## Open Questions (Require Decisions)

### 1. Can project admin grant another user 'admin' role?
- **Teams slice**: Only owners can grant 'admin' role (teamMember.teamRole = 'admin' requires owner)
- **Options**:
  - A) Restrict to owners only (consistent with teams)
  - B) Allow project admins to grant admin (more flexible for project-level delegation)
- **Impact**: Affects `addProjectMember` and `updateProjectMemberRole` authorization logic
- **Recommendation**: Option A (restrict to owners) for consistency, but projects are more granular than teams

### 2. Prevent removing/demoting the last admin?
- **Risk**: Project becomes unmanageable if no admin remains
- **Options**:
  - A) Block removal/demotion if it would leave zero admins (return 409 LAST_ADMIN)
  - B) Allow it (caller responsibility)
- **Impact**: Affects `removeProjectMember` and `updateProjectMemberRole` service logic
- **Recommendation**: Option A (block with typed error)

### 3. Prevent self-removal by admin?
- **Risk**: Admin accidentally removes themselves
- **Options**:
  - A) Block self-removal (return 409 SELF_REMOVAL)
  - B) Allow it (caller responsibility)
- **Impact**: Affects `removeProjectMember` service logic
- **Recommendation**: Option A (block with typed error)

### 4. Add-member requires target user to be team member first?
- **Context**: Project invite flow in veridex-app-flow.md: "Enter username (must already be a team member)"
- **Options**:
  - A) Validate target user has team_member row for project's team; return 409 USER_NOT_TEAM_MEMBER if not
  - B) Allow adding any user (create team membership implicitly?)
- **Impact**: Affects `addProjectMember` service logic
- **Recommendation**: Option A (enforce team membership prerequisite with typed error)

## Success Criteria (Verification Checklist)
- [ ] `apps/server/src/services/project.service.ts` implemented with all 7 functions
- [ ] `apps/server/src/services/project.service.test.ts` passes (all service tests)
- [ ] `apps/server/src/routes/projects.ts` implemented with all 7 routes
- [ ] `apps/server/src/routes/projects.test.ts` passes (all route tests)
- [ ] Routes registered in `apps/server/src/app.ts`
- [ ] Migration generated adding `idx_project_team` and `idx_project_member_project`
- [ ] `pnpm test` passes from apps/server/
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes

## Migration (to be generated after schema index addition)
```sql
-- Add indexes for query performance (project lookups by team, project_member by project)
CREATE INDEX IF NOT EXISTS idx_project_team ON project(team_id);
CREATE INDEX IF NOT EXISTS idx_project_member_project ON project_member(project_id);
```
