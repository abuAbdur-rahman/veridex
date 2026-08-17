# Server State

Last updated: 2026-08-17

## Current Boundary

The backend foundation, onboarding, teams/invites, projects/membership, and issues/status-history vertical slices are implemented in `apps/server/`. WebSockets, spreadsheet import, API tokens, and MCP tools are not implemented yet.

The active implementation plan is sourced from:

1. `apps/server/AGENTS.md`
2. `.agents/veridex-backend-spec.md`
3. `.agents/veridex-db-schema.md`
4. `.agents/veridex-app-flow.md`

## Implemented Foundation

- Fastify application factory and server entry point, with configurable `trustProxy`.
- Zod-validated environment contract (`TRUST_PROXY`, PostgreSQL-only database URLs, trimmed `R2_BUCKET_NAME`, OAuth pairing checks). `PUBLIC_MCP_URL` remains planned configuration until MCP tools are implemented.
- Helmet, CORS, rate limiting, Swagger (non-production), Better Auth, and health plugins/routes.
- Shared error envelope: `{ error: { code, message, details? } }`. Fastify schema failures and manual Zod failures both surface as `422 VALIDATION_ERROR`.
- Better Auth Drizzle adapter with optional Google/GitHub providers and `useSecureCookies` in production only.
- Session, team-role, and project-role authorization helpers; role helpers validate resource IDs as UUIDs before querying.
- Drizzle schema for all planned auth and public tables.
- Migrations `0000` through `0007`.
- `GET /health`.
- `GET /api/me` returns a session projection (`{ id, expiresAt, userId }`); the raw auth token is never exposed.

## Implemented Onboarding Slice

Registered in `apps/server/src/app.ts` and implemented by:

- `apps/server/src/routes/onboarding.ts`
- `apps/server/src/services/onboarding.service.ts`

Routes:

- `GET /api/me`
  - Requires a Better Auth session.
  - Returns the projected session, current user, team memberships, and `hasPersonalTeam`.
- `GET /api/users/check-username?q=`
  - Requires a session.
  - Normalizes to trimmed lowercase.
  - Validates `^[a-z0-9][a-z0-9_-]{2,29}$`.
  - Checks both `auth.user.username` and globally unique `team.slug` reservations.
- `POST /api/onboarding/complete`
  - Requires a session.
  - Returns `201` with the provisioned user, team, and project.
  - Returns `409 ONBOARDING_COMPLETED` on repeat completion.
  - Returns `409 USERNAME_TAKEN` for `user_username_unique` or `team_slug_unique` conflicts.

Provisioning uses one Drizzle/PostgreSQL transaction:

1. Lock the current `auth.user` row with `FOR UPDATE`.
2. Set `auth.user.username`.
3. Create the personal team.
4. Add the user as team owner.
5. Create `My Project` with slug `my-project`.
6. Add the user as project admin.

`auth.user` is part of the same Drizzle schema and PostgreSQL database, so the username update participates in the same transaction as public-table provisioning.

## Implemented Teams And Invites Slice

Registered in `apps/server/src/app.ts` and implemented by:

- `apps/server/src/routes/teams.ts`
- `apps/server/src/routes/invites.ts`
- `apps/server/src/services/team.service.ts`
- `apps/server/src/services/invite.service.ts`

Routes:

- `GET /api/teams` lists the caller's team memberships.
- `POST /api/teams` creates a non-personal team and owner membership atomically.
- `GET /api/teams/:teamId/members` requires team owner or admin access.
- `POST /api/teams/:teamId/invites` requires team owner or admin access; owners may grant `admin` or `member`, while admins may grant only `member`.
- `GET /api/invites/:token/validate` publicly validates invite state and returns safe invite metadata.
- `POST /api/invites/:token/accept` requires a verified authenticated email matching the normalized invite email.

Invite bearer tokens are random URL-safe values returned once. Only the SHA-256 hash and a safe prefix are persisted. Personal teams cannot issue or accept invites. Invite acceptance locks the invite and atomically inserts membership and marks the invite accepted.

Request logging redacts invite tokens: the Fastify `req` serializer masks the 43-character token segment in `/api/invites/:token/*` logged URLs (`apps/server/src/app.ts`, `redactInviteTokenUrl`), honoring the db-schema "never stored or logged" contract.

## Implemented Projects And Membership Slice

Registered in `apps/server/src/app.ts` and implemented by:

- `apps/server/src/routes/projects.ts`
- `apps/server/src/services/project.service.ts`

Routes:

- `GET /api/teams/:teamId/projects` lists the caller's project memberships in a team (requires team owner/admin/member).
- `POST /api/teams/:teamId/projects` creates a project and the creator's admin membership atomically (requires team owner/admin).
- `GET /api/projects/:projectId` returns project detail for any project member.
- `GET /api/projects/:projectId/members` lists members for any project member.
- `POST /api/projects/:projectId/members` adds a member (requires project admin); the target must already be a team member, else `409 USER_NOT_TEAM_MEMBER`, and must not already be a project member, else `409 MEMBER_ALREADY_EXISTS`.
- `PATCH /api/projects/:projectId/members/:userId` updates a member role (requires project admin); a target who is not a project member returns `404 Project member not found`.
- `DELETE /api/projects/:projectId/members/:userId` removes a member (requires project admin); a target who is not a project member returns `404 Project member not found`.

Project role authorization uses `requireProjectRole(request, projectId, [...])`. Service rules:

- Project creator is added as `admin` at creation, so at least one admin always exists.
- The creator (`project.createdBy`) cannot be demoted or removed; attempts return `409 CREATOR_PROTECTED`.
- No actor/owner parameter: project admins may grant `admin`, and there are no last-admin or self-removal checks.
- Slug conflicts map to `409 PROJECT_SLUG_TAKEN` (constraint `project_team_slug_unique`).
- Adding a user who is already a project member maps to `409 MEMBER_ALREADY_EXISTS` (the `project_member` primary key would otherwise surface as an untyped 500).
- Role updates and removals verify the target row exists via `.returning()`; a non-member target returns `404 NOT_FOUND` instead of silently succeeding.

## Implemented Issues And Status History Slice

Registered in `apps/server/src/app.ts` and implemented by:

- `apps/server/src/routes/issues.ts`
- `apps/server/src/services/issue.service.ts`

Routes:

- `GET/POST /api/projects/:projectId/issues`
- `GET/PATCH/DELETE /api/projects/:projectId/issues/:issueId`
- `PATCH /api/projects/:projectId/issues/:issueId/status`
- `PATCH /api/projects/:projectId/issues/:issueId/assign`
- `GET /api/projects/:projectId/issues/:issueId/history`

Issue list filtering supports status, developer assignee, QA assignee, severity, search, limit, and offset. Status transitions enforce the four-state lifecycle, reject unchanged/invalid transitions, require notes for backward transitions, and write issue status plus history atomically with `source: "web"`. Assignment targets must be project members. Admin role is required for deletion; QA or admin is required for the dedicated assignment endpoint.

## Database State

- Migration `0007` adds query-driven indexes `idx_project_team` (`project(team_id)`) and `idx_project_member_project` (`project_member(project_id)`). The generated SQL has been reviewed; apply it with `pnpm db:migrate` in each environment.
- Migration `0006` replaces plaintext invite-token storage with unique `token_hash` and safe `token_prefix` columns. The generated SQL has been reviewed; apply it with `pnpm db:migrate` in each environment.
- Migration `0005` removes `'closed'` from the `issue_status` enum, matching the product lifecycle `backlog <-> in_progress <-> in_qa <-> verified`. The `issues.closed_at` column remains per the spec.
- `auth.user`, `team`, `team_member`, `project`, and `project_member` exist.
- `user_username_unique`, `user_default_role_check`, `team_slug_unique`, and `project_team_slug_unique` exist.
- Query-driven indexes from the repair migrations exist.

## Tests And Verification

Current verified commands from `apps/server/`:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm db:generate   # after any schema change, then review the migration SQL
pnpm db:migrate
```

Latest results:

- Vitest: 15 files, 188 tests passed.
- Typecheck: passed.
- Build: passed.
- `pnpm db:generate`: no schema changes after migration `0007`.

Focused tests:

- `apps/server/src/routes/onboarding.test.ts`
- `apps/server/src/services/onboarding.service.test.ts`
- `apps/server/src/routes/teams.test.ts`
- `apps/server/src/routes/invites.test.ts`
- `apps/server/src/services/team.service.test.ts`
- `apps/server/src/services/invite.service.test.ts`
- `apps/server/src/routes/projects.test.ts`
- `apps/server/src/services/project.service.test.ts`
- `apps/server/src/routes/issues.test.ts`
- `apps/server/src/services/issue.service.test.ts`
- `apps/server/src/lib/auth.test.ts`
- `apps/server/src/config.test.ts`
- `apps/server/src/app.test.ts`
- `apps/server/src/auth/index.test.ts`

Rollback and concurrency behavior currently use a stateful transaction double. Add a dedicated real-PostgreSQL integration-test harness before relying on these tests as full transaction/concurrency proof.

## Task Record

Completed task:

- Server onboarding vertical slice (migrations `0002`–`0004`, `GET /api/me`, `GET /api/users/check-username`, `POST /api/onboarding/complete`), committed in `dc94eaf` and verified with 64 passing tests.
- Server maintenance: aligned Vitest coverage tooling, restricted database URL schemes, documented planned MCP configuration, and limited the optional Compose database port to host loopback.
- Teams and invites vertical slice: six team/invite routes, shared team-role authorization, hashed one-time invite tokens, atomic team creation and invite acceptance, and focused route/service tests.
- Projects and membership vertical slice (migration `0007`, seven project routes, project service, creator-protection and team-membership rules, and focused route/service tests).
- Issues and status-history vertical slice (eight issue routes, list filters, create/detail/edit/status/assignment/history/delete services, atomic status history, and focused route/service tests).

## Next Recommended Slice

Implement WebSocket project rooms and post-commit issue broadcasts, or spreadsheet import parsing/jobs, while reusing the established project authorization and issue service boundaries. Keep authorization scoped to team/project membership, validate all route input with Zod, pass `source: 'web' | 'mcp' | 'import'` at every status-changing call site, and broadcast WebSocket events only after transactions commit.
