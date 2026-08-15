# Server Onboarding Vertical Slice

Status: complete

## Scope

- [x] Verify and apply migrations `0002`–`0004` against the local PostgreSQL database.
- [x] Add `GET /api/me` for the authenticated router guard.
- [x] Add `GET /api/users/check-username` with normalized username validation.
- [x] Add `POST /api/onboarding/complete`.
- [x] Provision username, personal team, team owner membership, default project, and project admin membership in one transaction.
- [x] Add route and service tests for authorization, validation, conflicts, and successful provisioning.
- [x] Run server test, typecheck, build, and migration verification commands.

## Decisions

- The Better Auth `auth.user` table is included in the Drizzle schema and uses the same PostgreSQL database, so the username update participates in the same Drizzle transaction as public-table provisioning.
- A completed onboarding attempt returns `409 ONBOARDING_COMPLETED`; it does not create duplicate personal teams or projects.
- Username availability is case-normalized and uses the database unique constraint as the final concurrency guard.

## Verification

- `cd apps/server && pnpm test`: 7 files, 54 tests passed.
- `cd apps/server && pnpm typecheck`: passed.
- `cd apps/server && pnpm build`: passed.
- `cd apps/server && pnpm db:migrate`: applied successfully; rerun was clean.
- PostgreSQL migration journal count: 5 entries (`0000` through `0004`).
- `git diff --check`: passed.
- Transaction rollback and uniqueness tests use a stateful transaction double. A dedicated concurrent real-PostgreSQL test remains follow-up work if database-backed integration testing is added.
