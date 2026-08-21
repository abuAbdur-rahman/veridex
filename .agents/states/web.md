# Veridex Frontend Handoff

Updated: 2026-08-20

## Current State

- Auth/session, onboarding, teams/invites, projects/membership, issue/status-history (including rejection), and spreadsheet import slices are integrated in the web app.
- Unsupported domains remain fixture-backed: WebSockets, API tokens, and MCP tools. Issue comments are explicitly unavailable because no comments endpoint exists.
- Authenticated routes share `apps/web/src/components/app/AppShell.tsx`. Server-backed team selection is shared between shell and dashboard.
- Runtime-validated request adapters live in `apps/web/src/api/`; TanStack Query options and mutations live in `apps/web/src/queries/`.
- `demo-store.ts` remains fixture-only and is not used for server-backed project, issue, or project-member mutations.
- Lifecycle remains `backlog <-> in_progress <-> in_qa <-> verified`; backward transitions require an audit note.

## Integrated Endpoints

### Existing

- Auth/session/onboarding: `GET /api/me`, username check, onboarding completion, social sign-in/sign-out, and local loopback test-user login through `POST /api/dev/test-session` when the server enables it.
- Teams/invites: team list/create/member list, invite create/validate/accept.

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

## Key Files

- `apps/web/src/api/projects.ts`, `apps/web/src/api/issues.ts`, `apps/web/src/api/import.ts`
- `apps/web/src/queries/projects.ts`, `apps/web/src/queries/issues.ts`, `apps/web/src/queries/import.ts`
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
- Build warning remains: main JS chunk approximately 717 KB before gzip; route splitting is future optimization.

Focused coverage:

- `apps/web/src/api/projects.test.ts`
- `apps/web/src/api/issues.test.ts`
- `apps/web/src/api/import.test.ts`
- `apps/web/src/queries/import.test.ts`
- `apps/web/src/components/screens/ProjectHomeScreen.test.tsx`

## Remaining Work

- WebSockets, API token hashing, MCP tools, and comments need server contracts before replacing their fixture or unavailable states.
- Pending-invite list/revoke endpoints are still absent.
- The issue API returns raw IDs; a future server-side member projection could remove the client lookup.

## Do Not Regress

- Do not add `closed` without a product decision.
- Do not treat frontend role lenses as authorization.
- Do not persist raw MCP token values.
- Preserve canonical `/profile/settings` and `/profile/mcp` routes.
- Preserve URL-owned project view/search/selected-issue state.
