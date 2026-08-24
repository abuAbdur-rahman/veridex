# Server State

Last updated: 2026-08-24

## Current Boundary

The backend foundation, onboarding, teams/invites, projects/membership, issues/status-history, spreadsheet import, realtime WebSocket, API-token REST, comments, and MCP vertical slices are implemented in `apps/server/`. The `/mcp` endpoint now uses the `@modelcontextprotocol/sdk` `StreamableHTTPServerTransport` (stateless, JSON responses) with the same bearer-token auth and scoped tool callbacks. The WebSocket broadcaster is now multi-instance via Postgres `LISTEN`/`NOTIFY` (`event-bus.ts`) behind the unchanged `joinRoom`/`leaveRoom`/`broadcast` surface.

## Implemented API Token Slice

The authenticated REST lifecycle is registered in `apps/server/src/app.ts` and implemented by:

- `apps/server/src/routes/api-tokens.ts`
- `apps/server/src/services/api-token.service.ts`
- `apps/server/src/routes/api-tokens.test.ts`
- `apps/server/src/services/api-token.service.test.ts`

1. `GET /api/tokens` lists only the current user's token metadata.
2. `POST /api/tokens` validates `{ name }`, generates `vrx_${randomBytes(24).toString("base64url")}`, persists only its SHA-256 hash and first 12-character prefix, and returns the plaintext token once with `201`.
3. `DELETE /api/tokens/:id` validates the UUID, enforces user ownership, and soft-revokes the token with `204`.
4. Focused tests cover session enforcement, validation, one-time token return, hash-only persistence, ownership, and soft revocation.

The MCP SDK `StreamableHTTPServerTransport` migration is complete: `/mcp` serves the same six scoped tools over the stateless SDK transport with the same bearer-token format and service authorization rules.

The active implementation plan is sourced from:

1. `apps/server/AGENTS.md`
2. `.agents/veridex-backend-spec.md`
3. `.agents/veridex-db-schema.md`
4. `.agents/veridex-app-flow.md`

- A development-only local test-user session is available when `DEV_AUTH_ENABLED=true`, `NODE_ENV=development`, and `HOST` is loopback. `POST /api/dev/test-session` creates or signs in `dev-user@localhost.test`, provisions onboarding if needed, and sets a normal Better Auth cookie. The route plugin repeats the loopback guard so direct `buildApp()` callers cannot expose it accidentally; production configuration rejects the flag.


- Fastify application factory and server entry point, with configurable `trustProxy`.
- Zod-validated environment contract (`TRUST_PROXY`, PostgreSQL-only database URLs, trimmed `R2_BUCKET_NAME`, OAuth pairing checks). `PUBLIC_MCP_URL` remains planned configuration until MCP tools are implemented.
- Helmet, CORS, rate limiting, Swagger (non-production), Better Auth, and health plugins/routes.
- Shared error envelope: `{ error: { code, message, details? } }`. Fastify schema failures and manual Zod failures both surface as `422 VALIDATION_ERROR`.
- Better Auth Drizzle adapter with optional Google/GitHub providers and `useSecureCookies` in production only.
- Session, team-role, and project-role authorization helpers; role helpers validate resource IDs as UUIDs before querying.
- Drizzle schema for all planned auth and public tables.
- Migrations through the current generated migration set; review `src/db/migrations/` after schema changes.
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
- `GET /api/teams/:teamId/invites` lists pending invites for owners/admins; `DELETE /api/teams/:teamId/invites/:inviteId` hard-deletes pending invites because the schema has no revocation column.

## Implemented Comments And MCP Slice

Registered in `apps/server/src/app.ts` and implemented by:

- `apps/server/src/routes/comments.ts`
- `apps/server/src/services/comment.service.ts`
- `apps/server/src/routes/mcp.ts`
- `apps/server/src/services/api-token.service.ts`

Routes:

- `GET/POST /api/projects/:projectId/issues/:issueId/comments` lists and creates comments for project members.
- `PATCH/DELETE /api/projects/:projectId/comments/:commentId` allows comment authors or project admins to edit/soft-delete comments.
- `GET /api/mcp/access-summary` returns project memberships and the six tools available for each role.
- `GET /api/mcp/activity` returns the caller's latest MCP-sourced status changes.
- `POST /mcp` requires an active, nonexpired, nonrevoked `vrx_` bearer token and supports `tools/list` plus the six scoped issue tools over the MCP SDK `StreamableHTTPServerTransport` (stateless, `enableJsonResponse: true`). `GET`/`DELETE /mcp` return `405` JSON-RPC errors. Tool failures are returned as `CallToolResult.isError`; bearer authentication failures retain the shared HTTP error envelope.

MCP tool permissions are `tester+` for list/get/create, `dev+` for update/status, and `qa+` for assignment. Status and assignment calls pass `source: "mcp"`.

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

### Implemented Issue Images Slice

Registered in `apps/server/src/app.ts` and implemented by:

- `apps/server/src/routes/issue-images.ts`
- `apps/server/src/lib/r2.ts`

Routes:

- `POST /api/projects/:projectId/issue-images` requires any project role, accepts a single multipart file (`image`) up to 5 MB, restricts to PNG/JPEG/WebP by both declared MIME and verified magic bytes, and returns the same-origin relative path `/api/projects/:projectId/issue-images/{key}` for storage under `projects/{projectId}/issue-images/{uuid}.{ext}` in Cloudflare R2.
- `GET /api/projects/:projectId/issue-images/:key` requires any project role and streams the private object bytes and content type from R2. Membership is rechecked on every read.

The Zod validators on issue `POST`/`PATCH` accept either an `https:` URL or the generated internal image path. R2 credentials are all-or-none; when absent, upload returns `503 IMAGE_STORAGE_UNAVAILABLE` so the API still boots in local/test environments without secrets.

## Implemented Spreadsheet Import Slice

Registered in `apps/server/src/app.ts` and implemented by:

- `apps/server/src/routes/import.ts`
- `apps/server/src/services/import.service.ts`
- `apps/server/src/jobs/queue.ts`
- `apps/server/src/jobs/import.worker.ts`

Routes:

- `POST /api/projects/:projectId/import/upload` requires qa or admin role, accepts multipart `.xlsx` or `.csv` file, parses synchronously in-memory, stores parsed rows as JSONB on `import_jobs`, returns `completed` immediately. XLSX stores versioned `{version:2, worksheets}` object; CSV stores legacy row array.
- `GET /api/projects/:projectId/import/:importJobId/preview` requires qa or admin, returns parsed headers, sample rows (first 5 from selected worksheet), auto-mapped columns, hex-keyed color mappings, worksheet metadata (`worksheets`, `selectedWorksheetIndex`), project members, and the job `status` plus an `error` message when parsing failed. Accepts optional nonnegative `worksheetIndex` query param.
- `PATCH /api/projects/:projectId/import/:importJobId/confirm` requires qa or admin, accepts `columnMapping`, optional `colorMapping`, optional `defaultStatus` (accepts `pending` as alias for `in_progress`), optional nonnegative `worksheetIndex`, and optional `statusAssigneeMapping` keyed by canonical status, publishes `import-insert` pg-boss job. Status-assignee IDs validated against project membership before queueing.
- `GET /api/projects/:projectId/import/:importJobId/errors` requires qa or admin, returns imported/failed row counts, per-row error details, and the job `status`.

Status-assignee routing rules:

- `backlog`, `in_progress`, `rejected` → `issues.assigneeId`
- `in_qa`, `verified` → `issues.qaAssigneeId`
- Explicit status-to-member mapping overrides row-column assignee values.
- `pending` is accepted at import/user-facing boundaries and normalized to `in_progress` via `normalizeImportStatus()`.

Queue:

- pg-boss runs on `DATABASE_URL_UNPOOLED`, created in `server.ts` with the `import-insert` queue provisioned before worker registration, and passed to `buildApp`, which now also `app.decorate("queue", …)` so import routes can publish without a raw instance reference.
- `import-insert` worker: reads pre-parsed rows from `import_jobs.parsedRows` (stored as JSONB during upload), selects one worksheet (or first sheet for legacy row arrays), applies column mapping, routes assignees by final issue status, and per-row wraps ticket-number increment + issue insert + status-history insert in one DB transaction. Row status precedence: mapped Status column value → row-color hex lookup in the confirmed `colorMapping` → `normalizeImportStatus(defaultStatus)` → `backlog`. `assigneeId`/`qaAssigneeId` columns are mapped via the user-chosen column mapping (not auto-detected); mapped IDs are validated against project membership and roles. On any unhandled failure the job is marked `failed` with the error in `errorLog`.
- Worker registration via `registerImportWorker()` is wired into `buildApp()` after route registration, using the queue passed from `server.ts`. No R2 dependency — files are parsed and discarded during upload.

## Implemented Realtime WebSocket Slice

Registered in `apps/server/src/app.ts` via `websocketPlugin` (registered immediately after `authPlugin` so the auth/db decorators exist before the WS route is set up), and implemented by:

- `apps/server/src/plugins/websocket.ts`
- `apps/server/src/ws/handler.ts`
- `apps/server/src/ws/broadcaster.ts`

Behavior:

- `GET /ws?projectId=...` upgrades to a WebSocket (`@fastify/websocket`, `websocket: true`).
- The client passes `projectId` as a query parameter. Missing `projectId` closes the socket with code `4000` (`"projectId required"`).
- The handler re-checks the session via `request.server.auth.api.getSession` on connect; an invalid session closes with code `4001` (`"Session expired"`). Membership is checked against `project_member` for any role; non-members close with code `4003` (`"Not a project member"`).
- On a `ping` message the handler re-checks the session; if expired it sends `{ type: "auth:expired" }` then closes `4001`, otherwise it replies `{ type: "pong" }`.
- `broadcaster.ts` keeps an in-memory `Map<projectId, Set<WebSocket>>` for local delivery and is now multi-instance: `broadcast(projectId, event)` delivers locally and, when a publisher is attached (entrypoint only), publishes a `{originId, event}` envelope over Postgres `LISTEN`/`NOTIFY` (`ws/event-bus.ts`, channel `veridex:ws-events`, dedicated unpooled connection). Incoming `NOTIFY` payloads call `handleRemoteBroadcast`, which skips this instance's own `originId` and delivers other instances' events locally. `joinRoom`/`leaveRoom`/`broadcast` remain unchanged, so service-layer and route call sites are unaffected.
- Events emitted (discriminated union `WsEvent`): `issue:created`, `issue:updated`, `issue:status_changed` (carries `source: 'web' | 'mcp' | 'import'`), `issue:assigned`, `issue:deleted`.
- Broadcasts are wired at call sites (not inside services) and only after the DB transaction commits: all five issue mutations in `src/routes/issues.ts` and per-row `issue:created` in `src/jobs/import.worker.ts`. This keeps the services DB-pure and keeps the broadcast-after-commit ordering required by the spec.

## Database State

- Migration `0012` adds a project-scoped, case-insensitive unique index `issues_project_title_lower_unique` on `issues(project_id, lower(title))` to enforce duplicate-title rejection (matches the runtime case-insensitive duplicate check in normal creation and import). The generated SQL has been reviewed; apply it with `pnpm db:migrate` in each environment. Note: existing data with case-only duplicate titles would block this migration; dedupe first if it occurs.
- Migration `0010` adds nullable `import_jobs.parsed_rows jsonb` for persisting parsed spreadsheet rows during upload (Option D — eliminates R2 storage for imports). The generated SQL has been reviewed; apply it with `pnpm db:migrate` in each environment.
- Migration `0009` adds `'rejected'` to the `issue_status` enum.
- Migration `0008` adds nullable `issues.image_url text` to persist either a validated external URL or the project-scoped internal image path.
- Migration `0007` adds query-driven indexes `idx_project_team` (`project(team_id)`) and `idx_project_member_project` (`project_member(project_id)`).
- Migration `0006` replaces plaintext invite-token storage with unique `token_hash` and safe `token_prefix` columns.
- Migration `0005` removes `'closed'` from the `issue_status` enum.
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

- Vitest: 26 files, 313 tests passed, including bearer-token authentication, MCP SDK Streamable HTTP role/error behavior, and multi-instance WebSocket broadcast delivery.
- Typecheck: passed.
- Build: passed.

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
- `apps/server/src/routes/issue-images.test.ts`
- `apps/server/src/routes/import.test.ts`
- `apps/server/src/jobs/import.worker.test.ts`
- `apps/server/src/services/import.service.test.ts`
- `apps/server/src/services/issue.service.test.ts`
- `apps/server/src/lib/auth.test.ts`
- `apps/server/src/config.test.ts`
- `apps/server/src/app.test.ts`
- `apps/server/src/auth/index.test.ts`
- `apps/server/src/ws/broadcaster.test.ts`
- `apps/server/src/ws/handler.test.ts`
- `apps/server/src/routes/mcp.test.ts`

Rollback and concurrency behavior currently use a stateful transaction double. Add a dedicated real-PostgreSQL integration-test harness before relying on these tests as full transaction/concurrency proof.

## Task Record

Completed task:

- Server onboarding vertical slice (migrations `0002`–`0004`, `GET /api/me`, `GET /api/users/check-username`, `POST /api/onboarding/complete`), committed in `dc94eaf` and verified with 64 passing tests.
- Server maintenance: aligned Vitest coverage tooling, restricted database URL schemes, documented planned MCP configuration, and limited the optional Compose database port to host loopback.
- Teams and invites vertical slice: six team/invite routes, shared team-role authorization, hashed one-time invite tokens, atomic team creation and invite acceptance, and focused route/service tests.
- Projects and membership vertical slice (migration `0007`, seven project routes, project service, creator-protection and team-membership rules, and focused route/service tests).
- Issues and status-history vertical slice (eight issue routes, list filters, create/detail/edit/status/assignment/history/delete services, atomic status history, and focused route/service tests).
- Spreadsheet import vertical slice (pg-boss queue on unpooled connection, ExcelJS/CSV parser worker with color-to-status resolution, upload/preview/confirm/errors routes, import service with R2 storage, worker registration in app startup, and focused route/worker/service tests). Frontend wiring complete (api/import.ts, queries/import.ts, route rewrite, ImportMapping/Progress/Complete updates).
- Import hardening pass (review findings fixed): `fastify.queue` now decorated in `buildApp` (upload/confirm no longer 500 at runtime); color mapping re-keyed to hex end-to-end and actually applied in `import-insert`; errors endpoint returns job `status` so the web complete screen polls until insertion finishes; full header list persisted so unmapped columns can be mapped instead of silently dropped; both workers mark jobs `failed` instead of getting stuck; per-row DB transaction for ticket increment + issue + status-history inserts; `ImportUpload` surfaces upload/preview failures.
- Import Option D refactor: parsed rows persisted as JSONB on `import_jobs.parsed_rows` during synchronous upload parse; R2 storage eliminated for imports; `import-parse` worker removed; `import-insert` worker reads from DB instead of re-downloading file; `getPreview` now returns actual sampleRows from stored data; `fileDownloader` dependency removed from worker registration.
- Import worksheet selection and status-assignee mapping: XLSX stores versioned `{version:2, worksheets}` with worksheet metadata; `parseExcelFileForImport` returns all worksheets; preview accepts `worksheetIndex` query param and returns worksheet list; confirm accepts `worksheetIndex` + `statusAssigneeMapping`; worker selects one worksheet, routes assignees by final status (`backlog/in_progress/rejected`→`assigneeId`, `in_qa/verified`→`qaAssigneeId`), auto-maps `assigneeId`/`qaAssigneeId` columns; `normalizeImportStatus` maps `pending` to `in_progress` at user-facing boundaries; status-assignee IDs validated against project membership. 276 tests pass.
- Realtime WebSocket slice: `@fastify/websocket` plugin registered after auth in `app.ts`; `GET /ws?projectId=` handler validates session + project membership and uses close codes `4000`/`4001`/`4003`; `ping`→`pong`/`auth:expired` re-checks session; in-memory per-project room broadcaster emits `issue:created|updated|status_changed|assigned|deleted` from issue route call sites and the import worker, all after transaction commit. WebSocket realtime tests added (broadcaster + handler). 282 tests pass.
- API-token REST slice: `GET/POST /api/tokens` and `DELETE /api/tokens/:id` require a Better Auth session; creation returns plaintext once, stores only SHA-256 plus prefix, and revocation is ownership-scoped and soft. Focused route/service tests cover validation and security invariants. Bearer authentication is also used by `/mcp` and updates `lastUsedAt`.
- Import hardening and sole-member pass (review findings fixed): `getIssueStatusHistory` is project-scoped (no cross-project history reads); import duplicate-title detection is case-insensitive and backed by migration `0012`'s unique expression index; imported issues persist `importJobId`; row-mapped developer/QA IDs and status-mapping IDs are role-validated against project membership; `mappedQaAssigneeId` now takes precedence for `in_qa` rows; `confirmImport` publishes the queue payload before persisting the mapping so enqueue failure leaves job state untouched; upload accepts uppercase `.CSV`/`.XLSX` extensions; new issues created in a single-member project auto-assign the sole member (web creation and imports), while explicit assignments in multi-member projects remain role-validated.
- MCP Streamable HTTP transport migration: `POST /mcp` rewritten on `@modelcontextprotocol/sdk` `Server` + `StreamableHTTPServerTransport` (stateless, `enableJsonResponse: true`); `GET`/`DELETE /mcp` return `405` JSON-RPC. Bearer auth, `toolDefinitions`, role enforcement, and the six scoped tools are preserved and verified by `mcp.test.ts`.
- WebSocket multi-instance broadcaster: `ws/event-bus.ts` adds a Postgres `LISTEN`/`NOTIFY` bus over a dedicated unpooled connection (channel `veridex:ws-events`); `broadcaster.ts` delivers locally and publishes/consumes `{originId, event}` envelopes so multiple server instances fan out events. Public `joinRoom`/`leaveRoom`/`broadcast` surface is unchanged; route/service call sites untouched. 313 tests pass.
- Better Auth UUID id generation fix: `auth/index.ts` now sets `advanced.database.generateId = () => crypto.randomUUID()`, matching the spec contract that `auth.user.id` is a UUID string (`.agents/veridex-db-schema.md`). Without it Better Auth generated 32-char alphanumeric ids, which failed every app-level `z.string().uuid()` user-id check (issue assignment REST/MCP schemas, project member add/remove). A function is required (not `"uuid"`) because `auth.user.id` is a plain text column without a `gen_random_uuid()` default. Verified live: new sign-ups get UUID ids and MCP `assign_issue` succeeds with real user ids; pre-existing dev users keep their legacy ids. 322 tests pass.
- Issue member projection (spec Fix #15): `issue.service.ts` adds `getProjectMemberDirectory` (one `project_member ⨝ auth.user` join per request, project-scoped) and pure `withMemberProjection`; every issue-returning route in `routes/issues.ts` (create/list/detail/update/status/assign) now embeds display-only `reporter`/`developerAssignees`/`qaAssignees` `{id, name, image}` refs alongside the raw ID fields (kept for client transition). `updateStatus` now returns `IssueWithAssignments` like the other mutations. Route-test service mock extended; 3 new `withMemberProjection` unit tests. 325 tests pass.
- Real-PostgreSQL integration-test harness: `src/test/pg-harness.ts` boots an ephemeral `postgres:16-alpine` container via the Docker CLI (`docker run`/`docker port`/`pg_isready` readiness polling/`docker rm -f` teardown, no extra dependencies), applies the full migration chain (`0000→0012`) including the `drizzle.__drizzle_migrations` ledger, and exposes drizzle `db`, raw `sql`, `reset()` (TRUNCATE-all between tests), and `stop()`. Suite: `pnpm test:integration` (`vitest.integration.config.ts`, 30s test timeout, no file parallelism); auto-skipped when Docker is unavailable; excluded from the default unit run via `vitest.config.ts`. Coverage: migration-chain count, case-insensitive duplicate-title constraint through the service path (409 `DUPLICATE_ISSUE`), status+history atomicity, and exactly-one-winner concurrency for backward transitions. 4 integration tests pass; unit suite remains 325 tests / double-free.

## Next Recommended Slice

Both the `/mcp` Streamable HTTP transport migration and the WebSocket `LISTEN`/`NOTIFY` multi-instance broadcaster are now complete (see Task Record), as is the Better Auth UUID id-generation fix. Issue responses now embed the member projection (Fix #15), and the web app consumes it (see `.agents/states/web.md`). The real-PostgreSQL integration harness now covers migration integrity, unique-constraint enforcement, transaction atomicity, and transition concurrency (`pnpm test:integration`, Docker required). Possible follow-ups: extend the integration tier to token, import, and comment services. Otherwise the backend vertical slices are fully implemented.
