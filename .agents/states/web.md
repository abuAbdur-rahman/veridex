# Veridex Frontend Handoff

Updated: 2026-08-24 (production-readiness fixes)

## Production-Readiness Fixes (this session)

- `isServerMemberRef` (`api/issues.ts`) now accepts `image: string | null`, matching the server member projection; OAuth avatars no longer invalidate entire issue responses. This also fixed the previously failing `ProjectHomeScreen` board-render test.
- `updateProjectMemberRole` (`api/projects.ts`) now validates the server's `{ userId }` response instead of `null`; role changes no longer report INVALID_RESPONSE after succeeding.
- `requiresAuditNote(fromStatus, toStatus)` mirrors the server's order-based backward-transition rule, so `verified → in_qa` now prompts for the required note in both `ProjectHomeScreen.moveIssue` and `IssueDetailPanel.move`.
- `SettingsScreen` no longer persists to the demo store: name/username/default-role render read-only from `GET /api/me`, theme selection stays functional via next-themes, and the fake "Save changes"/"Reset demo" controls are removed.

## Current State

- Auth/session, onboarding, teams/invites, projects/membership, issue/status-history (including rejection), spreadsheet import, issue comments, and project WebSocket refresh slices are integrated in the web app.
- API token management is integrated. `/profile/mcp` also loads project access summaries and recent MCP-triggered status activity. The server `/mcp` endpoint uses the MCP SDK Streamable HTTP transport (stateless, JSON responses); the MCP profile screen is wired to it via `VITE_MCP_URL=/mcp` (`.env.local`) plus a Vite `/mcp` proxy, so the endpoint and one-time client-config block render.
- Authenticated routes share `apps/web/src/components/app/AppShell.tsx`. Server-backed team selection is shared between shell and dashboard and persisted across reloads via `apps/web/src/stores/workspace-team-store.ts` (zustand persist).
- Sidebar shows a team-level "Members" nav item (`/teams/$teamId/settings`) when no project is selected; visible to team owners/admins only and hidden when the username matches the team name.
- Route components are code-split with `lazyRouteComponent` (dashboard, project board, import, members, team settings, settings, MCP); landing/login/onboarding stay eager. Main chunk is ~296KB (~93KB gzip).
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
- `apps/web/src/stores/workspace-team-store.ts`
- `apps/web/src/api/comments.ts`, `apps/web/src/lib/server-mappers.ts`
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
- Latest full Vitest run: 16 files, 60 tests passed (includes `api/comments.test.ts` adapter coverage). Token adapter and WebSocket cache-invalidation coverage are included; existing jsdom navigation stderr is non-failing.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. Route splitting landed: main JS chunk is ~296 KB before gzip (~93 KB gzip); the >500KB chunk-size warning is resolved.

Focused coverage:

- `apps/web/src/api/projects.test.ts`
- `apps/web/src/api/issues.test.ts`
- `apps/web/src/api/import.test.ts`
- `apps/web/src/queries/import.test.ts`
- `apps/web/src/components/screens/ProjectHomeScreen.test.tsx`

## Remaining Work

- Comment edit/delete UI is wired (`PATCH/DELETE /api/projects/:projectId/comments/:commentId` adapters in `api/comments.ts`, mutations in `queries/issues.ts`, inline edit + confirm-delete in `CommentThread.tsx`; author or project admin only). No remaining comment gaps.
- The issue API embeds the server member projection (Fix #15, see `.agents/states/server.md`); `lib/server-mappers.ts` maps `reporter`/`developerAssignees`/`qaAssignees` refs directly — the client member-list fallback has been removed. `Issue.reporter` is now optional in `veridex-types.ts`.
- Router-level pending state: `defaultPendingComponent: RoutePending` (`components/app/RoutePending.tsx`) with 200ms `defaultPendingMs`/`defaultPendingMinMs` covers lazy-route loads.
- No known open work; further bundle analysis is optional.

## Do Not Regress

- Do not add `closed` without a product decision.
- Do not treat frontend role lenses as authorization.
- Do not persist raw MCP token values.
- Preserve canonical `/profile/settings` and `/profile/mcp` routes.
- Preserve URL-owned project view/search/selected-issue state.
