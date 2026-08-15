# Server State

Last updated: 2026-08-13

## Current Boundary

The backend foundation and onboarding vertical slice are implemented in `apps/server/`. No teams/invites CRUD, general projects CRUD, issue workflows, WebSockets, spreadsheet import, API tokens, or MCP tools are implemented yet.

The active implementation plan is sourced from:

1. `apps/server/AGENTS.md`
2. `.agents/veridex-backend-spec.md`
3. `.agents/veridex-db-schema.md`
4. `.agents/veridex-app-flow.md`
5. `.agents/tasks/server/`

## Implemented Foundation

- Fastify application factory and server entry point.
- Environment validation.
- Helmet, CORS, rate limiting, Swagger, Better Auth, and health plugins/routes.
- Shared error envelope: `{ error: { code, message, details? } }`.
- Better Auth Drizzle adapter and optional Google/GitHub providers.
- Session and project-role authorization helpers.
- Drizzle schema for all planned auth and public tables.
- Migrations `0000` through `0004`.
- `GET /health`.

## Implemented Onboarding Slice

Registered in `apps/server/src/app.ts` and implemented by:

- `apps/server/src/routes/onboarding.ts`
- `apps/server/src/services/onboarding.service.ts`

Routes:

- `GET /api/me`
  - Requires a Better Auth session.
  - Returns session, current user, team memberships, and `hasPersonalTeam`.
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

Verified through the `psql` CLI:

- `drizzle.__drizzle_migrations` contains five rows for migrations `0000` through `0004`.
- `auth.user`, `team`, `team_member`, `project`, and `project_member` exist.
- `user_username_unique`, `user_default_role_check`, `team_slug_unique`, and `project_team_slug_unique` exist.
- Query-driven indexes from the repair migrations exist.
- A transaction smoke test successfully created the complete onboarding graph and rolled it back.
- No audit rows remain after the smoke test.

The current development database had zero real users, teams, projects, or memberships at the time of verification.

## Tests And Verification

Current verified commands from `apps/server/`:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm db:migrate
```

Latest results:

- Vitest: 7 files, 54 tests passed.
- Typecheck: passed.
- Build: passed.
- Migration apply and clean rerun: passed.
- `git diff --check`: passed.

Focused tests:

- `apps/server/src/routes/onboarding.test.ts`
- `apps/server/src/services/onboarding.service.test.ts`

Rollback and concurrency behavior currently use a stateful transaction double. Add a dedicated real-PostgreSQL integration-test harness before relying on these tests as full transaction/concurrency proof.

## Task Record

Completed task:

- `.agents/tasks/server/01-onboarding-vertical-slice.md`

## Next Recommended Slice

Implement teams and invites, while reusing the established route/service/session patterns:

- `GET /api/teams`
- `POST /api/teams`
- `GET /api/teams/:teamId/members`
- `POST /api/teams/:teamId/invites`
- `GET /api/invites/:token/validate`
- `POST /api/invites/:token/accept`

Create the next task file under `.agents/tasks/server/` before implementation. Invite acceptance must create membership and mark the invite accepted atomically, with authorization scoped to team membership and role.

## Working Tree Note

The repository contains broad pre-existing uncommitted work across server and web files. Do not revert unrelated changes. The onboarding files and server task directory are currently untracked or part of the broader dirty working tree.
