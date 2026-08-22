# Veridex Frontend Handoff

Updated: 2026-08-22

## Current State

- Auth/session, onboarding, teams/invites, projects/membership, issue/status-history (including rejection), spreadsheet import, issue comments, and project WebSocket refresh slices are integrated in the web app.
- API token management is integrated. `/profile/mcp` also loads project access summaries and recent MCP-triggered status activity. The manual MCP JSON-RPC endpoint is available, while migration to the MCP SDK Streamable HTTP transport remains a server follow-up.
- Authenticated routes share `apps/web/src/components/app/AppShell.tsx`. Server-backed team selection is shared between shell and dashboard.
- Runtime-validated request adapters live in `apps/web/src/api/`; TanStack Query options and mutations live in `apps/web/src/queries/`.
- `demo-store.ts` remains fixture-only and is not used for server-backed project, issue, or project-member mutations.
- Lifecycle remains `backlog <-> in_progress <-> in_qa <-> verified`; backward transitions require an audit note.

## Integrated Endpoints

### Existing

- Auth/session/onboarding: `GET /api/me`, username check, onboarding completion, social sign-in/sign-out, and local loopback test-user login through `POST /api/dev/test-session` when the server enables it.
- Teams/invites: team list/create/member list, invite create/validate/accept, pending invite list, and pending invite revoke.

### Comments and MCP profile

- `GET/POST /api/projects/:projectId/issues/:issueId/comments`
- `GET /api/mcp/access-summary`
- `GET /api/mcp/activity`

Issue detail lists and creates comments. Comment responses currently expose raw `authorId`; the client resolves names from project members when available and falls back to the ID. The MCP profile screen lists project roles/tools and recent status activity alongside token management and optional `VITE_MCP_URL` configuration.

### Projects and membership

- `GET/POST /api/teams/:teamId/projects`
- `GET /api/projects/:projectId`
- `GET/POST /api/projects/:projectId/members`
- `PATCH/DELETE /api/projects/:projectId/members/:userId`

These drive dashboard/sidebar project lists, project creation, project resolution, eligible-member selection, member add, role update, and removal. UI controls use authenticated team/project roles; the server remains authoritative.

### Issues

- `GET/POST /api/projects/:projectId/issues`
- `GET/PATCH/DELETE /api/projects/:projectId/issues/:issueId`
- `PATCH /api/projects/:projectId/issues/:issueId/status`
- `PATCH /api/projects/:projectId/issues/:issueId/assign`
- `GET /api/projects/:projectId/issues/:issueId/history`
- `POST /api/projects/:projectId/issue-images`
- `GET /api/projects/:projectId/issue-images/:key`

These drive search/list views, report form, detail/edit, workflow transitions, developer/QA assignment, status history, and admin deletion. `server-mappers.ts` resolves ID-only issue fields against project-member projections for display. Image uploads flow through `uploadIssueImage` (multipart) and the create mutation, accepting a single PNG/JPEG/WebP file up to 5 MB and an external HTTPS URL via the form's "Issue image" tab. The `IssueDetailPanel` exposes a "View image" button only when `issue.imageUrl` is set, opening a fullscreen dialog with an explicit close control. The issue detail sheet is now 780px wide on larger screens (full-width on small screens) to give detail and image layout more room.

### API tokens and realtime

- `GET/POST /api/tokens`
- `DELETE /api/tokens/:id`
- `GET /ws?projectId=...`

`/profile/mcp` lists, creates, and revokes server-backed user tokens, project access summaries, and recent status activity. Plaintext tokens remain component state only and disappear when the one-time dialog closes. The endpoint/config block is shown only when `VITE_MCP_URL` is configured. Project pages open a project-scoped WebSocket, send 30-second keep-alives, invalidate issue list/detail/history caches for `issue:*` events, and redirect to login on `auth:expired`. Vite proxies `/ws` in local development.

## Key Files

- `apps/web/src/api/projects.ts`, `apps/web/src/api/issues.ts`, `apps/web/src/api/import.ts`, `apps/web/src/api/tokens.ts`
- `apps/web/src/api/comments.ts`, `apps/web/src/api/mcp.ts`, `apps/web/src/queries/projects.ts`, `apps/web/src/queries/issues.ts`, `apps/web/src/queries/import.ts`, `apps/web/src/queries/tokens.ts`, `apps/web/src/queries/mcp.ts`
- `apps/web/src/lib/project-websocket.ts`
- `apps/web/src/lib/server-mappers.ts`
- `apps/web/src/components/app/AppShell.tsx`, `workspace-team.ts`
- `apps/web/src/components/screens/DashboardScreen.tsx`
- `apps/web/src/components/screens/MembersScreen.tsx`
- `apps/web/src/components/screens/ProjectHomeScreen.tsx`
- `apps/web/src/components/screens/IssueDetailPanel.tsx`
- `apps/web/src/components/screens/ReportIssueModal.tsx`
- `apps/web/src/components/screens/ImportMapping.tsx`
- `apps/web/src/routes/projects.$projectId.import.tsx`

## Verification

Run from `apps/web/`:

- `pnpm typecheck` – passed.
- `pnpm lint` – passed.
- `pnpm build` – passed.
- `src/api/import.test.ts`: 7 tests passed.
- `src/queries/import.test.ts`: 2 tests passed.
- Full Vitest run: 13 files, 48 tests passed. The earlier `ProjectHomeScreen.test.tsx` heading failure ("Unable to find role='heading' and name 'All issues'") is resolved by the working-tree fixture/board-filter changes (the mock issue now carries `developerAssigneeIds`/`qaAssigneeIds` and the dev board filters on `developerAssignees`).
- Latest full Vitest run: 15 files, 55 tests passed. Token adapter and WebSocket cache-invalidation coverage are included; existing jsdom navigation stderr is non-failing.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. Build warning remains: main JS chunk approximately 735 KB before gzip; route splitting is future optimization.

Focused coverage:

- `apps/web/src/api/projects.test.ts`
- `apps/web/src/api/issues.test.ts`
- `apps/web/src/api/import.test.ts`
- `apps/web/src/queries/import.test.ts`
- `apps/web/src/components/screens/ProjectHomeScreen.test.tsx`

## Remaining Work

- Comment edit/delete UI is not yet wired; list/create are integrated.
- MCP SDK Streamable HTTP transport migration remains pending; the current server endpoint uses manual JSON-RPC handling.
- The issue API returns raw IDs; a future server-side member projection could remove the client lookup.

## Do Not Regress

- Do not add `closed` without a product decision.
- Do not treat frontend role lenses as authorization.
- Do not persist raw MCP token values.
- Preserve canonical `/profile/settings` and `/profile/mcp` routes.
- Preserve URL-owned project view/search/selected-issue state.
