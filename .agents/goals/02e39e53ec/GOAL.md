# Teams and Invites Backend Slice

ID: 02e39e53ec
Status: active

## Objective

Implement the next backend slice in apps/server: team listing and creation, team member listing, team invite creation with role policy, and invite validate/acceptance. Reuse the established route/service/session patterns (onboarding slice), add a shared team-role authorization helper alongside requireSession/requireProjectRole, store invite tokens as SHA-256 hashes with a safe prefix (raw token returned exactly once), enforce atomic transactions for team creation and invite acceptance, and finish with focused tests, full verification, and an updated .agents/states/server.md.

## Acceptance Criteria

- All six routes are implemented and registered in apps/server/src/app.ts following the onboarding route/service/session pattern: GET /api/teams, POST /api/teams, GET /api/teams/:teamId/members, POST /api/teams/:teamId/invites, GET /api/invites/:token/validate, POST /api/invites/:token/accept.
- GET /api/teams requires a session and returns the caller's team memberships (id, name, slug, isPersonal, teamRole), matching the teams shape already produced by getCurrentUser.
- POST /api/teams requires a session, validates { name, slug } with Zod at the route boundary (slug following the existing ^[a-z0-9][a-z0-9_-]{2,29}$ pattern), creates the team and its owner team_member row (teamRole 'owner', invitedBy null) in one transaction, and maps the team_slug_unique conflict to a 409 AppError like the onboarding USERNAME_TAKEN pattern.
- GET /api/teams/:teamId/members requires team role owner or admin (per veridex-pages-screens.md team-settings access) and returns the member list with roles.
- POST /api/teams/:teamId/invites requires team role owner or admin and enforces the role policy: owner may invite member/admin, admin may invite member only, and any invitation requesting teamRole 'owner' is rejected with 403 FORBIDDEN. The invite email is Zod-validated and normalized (trimmed lowercase).
- Invite tokens are generated as random URL-safe values; only the SHA-256 hash plus a safe display prefix are persisted in the invites table; the raw token is returned exactly once in the create-invite response so the client can build the shareable /join/team/:token link; plaintext is never stored or logged.
- GET /api/invites/:token/validate is public (no session), hashes the path token, and returns invite metadata for valid invites while distinguishing unknown (404 NOT_FOUND), expired, and already-accepted tokens via typed AppError responses.
- POST /api/invites/:token/accept requires a session, hashes the path token, requires the invite to exist/not-expired/not-accepted, binds the session user's normalized verified authenticated email (trimmed lowercase, auth.user.emailVerified true) to the invite email (mismatch rejected 403), and atomically inserts the team_member row (teamRole, invitedBy) and sets invites.acceptedAt in one transaction, returning the joined team.
- A shared requireTeamRole helper (and any needed membership helper) is added to apps/server/src/lib/auth.ts following the requireProjectRole pattern, with UUID validation of teamId and app-level-only cross-schema user references.
- All checks pass from apps/server (pnpm test, pnpm typecheck, pnpm build), the generated migration SQL is reviewed (never hand-edited), and .agents/states/server.md is updated only after verification passes.

## Out of Scope

- Project invites and project membership management (POST /api/projects/:projectId/members) — separate slice.
- Invite revocation (revoked_at) — the source schema contract for invites has no revoked_at column; only api_tokens does.
- Email delivery of invites — MVP uses manually shared links per the backend spec.
- WebSocket events for team/member changes.
- Frontend work in apps/web.
- General projects CRUD, issues, spreadsheet import, API tokens, and MCP tools.

## Constraints

- Exactly 3 tasks, ordered by dependency; do not split work by layer, phase, or file within a task.
- Resolve the invite-token security decision (SHA-256 hash + safe prefix, raw token returned once) in task 1 before any route or service work; this requires coordinated updates to .agents/veridex-db-schema.md, apps/server/src/db/schema/invites.ts, and a generated migration.
- Follow the source-of-truth order: apps/server/AGENTS.md, .agents/veridex-backend-spec.md, .agents/veridex-db-schema.md, .agents/states/server.md; resolve conflicts in the most specific document before coding.
- Validate all external input with Zod at route boundaries; return the shared error envelope { error: { code, message, details? } } via AppError subclasses; no TypeScript any.
- Cross-schema FKs to auth.user.id are application-level only — user IDs must come from validated sessions, never unvalidated client input.
- Never hand-edit generated migrations; fix the schema source and regenerate with pnpm db:generate, then review the SQL.
- Update .agents/states/server.md only after implementation passes pnpm test, pnpm typecheck, and pnpm build.
- Verification runs from apps/server: pnpm test, pnpm typecheck, pnpm build; pnpm db:generate plus migration review whenever the schema changes.
