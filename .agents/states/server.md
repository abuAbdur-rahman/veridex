# Server State

Last updated: 2026-08-15

## Current Boundary

The backend foundation and onboarding vertical slice are implemented and committed in `apps/server/`. No teams/invites CRUD, general projects CRUD, issue workflows, WebSockets, spreadsheet import, API tokens, or MCP tools are implemented yet.

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
- Session and project-role authorization helpers; `requireProjectRole` validates `projectId` as a UUID before querying.
- Drizzle schema for all planned auth and public tables.
- Migrations `0000` through `0005`.
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

## Database State

- `drizzle.__drizzle_migrations` contains six rows for migrations `0000` through `0005`.
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

- Vitest: 7 files, 69 tests passed.
- Typecheck: passed.
- Build: passed.

Focused tests:

- `apps/server/src/routes/onboarding.test.ts`
- `apps/server/src/services/onboarding.service.test.ts`
- `apps/server/src/lib/auth.test.ts`
- `apps/server/src/config.test.ts`
- `apps/server/src/app.test.ts`
- `apps/server/src/auth/index.test.ts`

Rollback and concurrency behavior currently use a stateful transaction double. Add a dedicated real-PostgreSQL integration-test harness before relying on these tests as full transaction/concurrency proof.

## Task Record

Completed task:

- Server onboarding vertical slice (migrations `0002`–`0004`, `GET /api/me`, `GET /api/users/check-username`, `POST /api/onboarding/complete`), committed in `dc94eaf` and verified with 64 passing tests.
- Server maintenance: aligned Vitest coverage tooling, restricted database URL schemes, documented planned MCP configuration, and limited the optional Compose database port to host loopback.

## Next Recommended Slice

Implement teams and invites, while reusing the established route/service/session patterns:

- `GET /api/teams`
- `POST /api/teams`
- `GET /api/teams/:teamId/members`
- `POST /api/teams/:teamId/invites`
- `GET /api/invites/:token/validate`
- `POST /api/invites/:token/accept`

Invite acceptance must create membership and mark the invite accepted atomically, with authorization scoped to team membership and role.
