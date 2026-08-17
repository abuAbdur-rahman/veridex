# Veridex Frontend Handoff

Updated: 2026-08-16

## Current State

- Frontend implementation is fixture-backed and functional. Backend integration remains the primary unfinished product work.
- Authenticated routes share one responsive shell in `apps/web/src/components/app/AppShell.tsx`.
- Demo domain state lives in `apps/web/src/stores/demo-store.ts`, persisted in localStorage, with reset support. Raw MCP tokens are never persisted.
- Server calls are split by domain under `apps/web/src/api/`; TanStack Query integrations live under `apps/web/src/queries/`. Direct imports are preferred over barrel `index.ts` files.
- Sonner is mounted once in `apps/web/src/providers/AppProviders.tsx`; authentication and onboarding server outcomes use toast feedback while field validation stays inline.
- Canonical profile routes are `/profile/settings` and `/profile/mcp`; `/profile` redirects to settings. Legacy `/settings` and `/settings/mcp` redirect to the profile routes.
- Sidebar footer has clickable avatar/profile navigation and confirmed Logout modal. Logout posts to `/api/auth/sign-out`; Vite proxies `/api` to `http://127.0.0.1:3001` in development. Redirect to `/login` occurs only after a successful response.
- Kanban uses `@dnd-kit/core` draggable cards, droppable lifecycle columns, pointer sensor, keyboard sensor, drag overlay, invalid-target disabling, and “Move to” fallback menu. Native horizontal scrollbar is hidden but horizontal scrolling remains available.
- Lifecycle is four-state: `backlog`, `in_progress`, `in_qa`, `verified`. Forward and backward transitions are supported. Every backward transition requires a note.
- Issue timestamps are normalized by `apps/web/src/lib/format-time.ts`; ISO mutation timestamps show relative values such as `just now`, while legacy fixture labels remain unchanged.

## Verification

From `apps/web/`:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 29 tests across 9 files.
- `pnpm build` passed.
- Agent Browser verified: landing page, login page, protected route redirect to `/login`, invalid invite token shows "Invite unavailable", valid-format non-existent invite shows "Invite unavailable" (404), OAuth button error handling (toast on 404 provider-not-configured), root guard redirects unauthenticated `/dashboard` to `/login`, root guard redirects unauthenticated `/teams/:id/settings` to `/login`.
- Build warning remains: main JS chunk approximately 689 KB before gzip, approximately 210 KB gzip. Route code splitting is a future optimization.

## Key Files

- `apps/web/src/components/app/AppShell.tsx`: shared shell, server-backed teams sidebar, profile footer, logout confirmation, team creation.
- `apps/web/src/api/teams.ts`: server team/member/invite adapters with runtime validation.
- `apps/web/src/api/invites.ts`: server invite validation and acceptance adapters.
- `apps/web/src/queries/teams.ts`: TanStack Query hooks for teams and team members.
- `apps/web/src/routes/invite.tsx`: public invite validation and acceptance flow.
- `apps/web/src/routes/login.tsx`: login with invite redirect preservation.
- `apps/web/src/components/screens/TeamSettingsScreen.tsx`: server-backed team members and invite creation.
- `apps/web/src/components/screens/InviteAcceptScreen.tsx`: invite state display with loading/error handling.
- `apps/web/src/components/screens/BoardScreen.tsx`: DnD context and lifecycle columns (fixture-backed).
- `apps/web/src/stores/demo-store.ts`: lifecycle transitions and demo actions (fixture-only).
- `apps/web/src/lib/format-time.ts`: mutation timestamp formatting.
- `apps/web/src/router.tsx`: route tree including canonical profile routes and legacy redirects.
- `apps/web/vite.config.ts`: `/api` development proxy to backend port 3001.

## Wireup (completed)

The implemented server onboarding, team, and invite slices are now wired up on the client:

### Auth/session/onboarding (existing)
- `apps/web/src/api/client.ts` — shared cookie-authenticated request boundary, server error parsing, and malformed-response handling.
- `apps/web/src/api/auth.ts` — Better Auth social sign-in via `POST /api/auth/sign-in/social` with safe callback path validation.
- `apps/web/src/api/session.ts` — runtime-validated `GET /api/me` contract and profile projection helpers.
- `apps/web/src/api/onboarding.ts` — runtime-validated username availability and onboarding completion contracts plus username helpers matching the server's `^[a-z0-9][a-z0-9_-]{2,29}$` rule.
- `apps/web/src/lib/query-client.ts` — shared `QueryClient` instance.
- `apps/web/src/queries/session.ts` — `meQueryOptions`, `useMe()`, `meQueryKey`, and onboarding cache projection.
- `apps/web/src/components/ui/toaster.tsx` — theme-aware Sonner host mounted once by `AppProviders`.
- `apps/web/src/router.tsx` — router context provides `{ queryClient }`.
- `apps/web/src/routes/__root.tsx` — root route guard (`beforeLoad`) reads `GET /api/me` through the shared query cache and redirects: no session → `/login`, session but not onboarded → `/onboarding`, onboarded on `/onboarding` → `/dashboard`. Public routes (landing, login, invite) are skipped so the landing page works without a backend.
- `apps/web/src/components/screens/LoginScreen.tsx` — OAuth buttons POST to `/api/auth/sign-in/social`, prevent concurrent requests, surface Better Auth errors safely, and redirect the browser to the provider URL.
- `apps/web/src/components/screens/OnboardingScreen.tsx` — username pre-filled from provider data, live availability check via debounced `GET /api/users/check-username?q=`, stale and failed checks are handled explicitly, submission calls `POST /api/onboarding/complete`, then updates the cached session projection from the committed response before navigating to `/dashboard`.
- `apps/web/src/components/app/AppShell.tsx` — sidebar profile derives from `useMe()` instead of the fixture store; sidebar teams use `useTeams()` with `me?.teams` fallback.

### Teams/invites (new)
- `apps/web/src/api/teams.ts` — runtime-validated `ServerTeam`, `ServerTeamMember`, `TeamInvite` interfaces; `listTeams()`, `createTeam()`, `listTeamMembers()`, `createTeamInvite()` adapters.
- `apps/web/src/api/invites.ts` — runtime-validated `ValidatedInvite` interface; `validateInvite(token)`, `acceptInvite(token)` adapters.
- `apps/web/src/queries/teams.ts` — `teamsQueryOptions`, `teamMembersQueryOptions`, `useTeams()`, `useTeamMembers()` hooks.
- `apps/web/src/routes/login.tsx` — `validateSearch` for optional `redirect` search param (safe path validation: must start with `/join/team/`).
- `apps/web/src/routes/invite.tsx` — public invite route: validates token via `GET /api/invites/:token/validate`, handles expired/accepted/not-found states; accept calls `POST /api/invites/:token/accept`, invalidates teams cache, navigates dashboard; unauthenticated user redirected to `/login?redirect=/join/team/{token}`.
- `apps/web/src/components/screens/InviteAcceptScreen.tsx` — accepts `state: "loading" | "valid" | "expired" | "accepted" | "invalid"`, shows invite email, busy/error states, loading spinner.
- `apps/web/src/components/screens/TeamSettingsScreen.tsx` — uses `useTeams()` and `useTeamMembers(teamId)`, shows real team members, invite form with returned token link, note about missing pending-invite listing/revoke.
- `apps/web/src/components/app/AppShell.tsx` — sidebar uses `useTeams()` for server teams, `handleCreateTeam()` with slug prompt, team dropdown with "Create team" option.

### Test coverage
- Focused adapter tests in `apps/web/src/api/auth.test.ts`, `api/teams.test.ts`, `api/invites.test.ts`, `api/onboarding.test.ts`, `api/session.test.ts`.
- Session query test in `apps/web/src/queries/session.test.ts`.
- Social sign-in response parsing narrows unknown JSON before reading Better Auth fields, so malformed success responses surface as typed `ApiError` failures instead of raw `TypeError` exceptions.
- Username availability changes expose readable text through a polite live region; status icons remain decorative.

## Remaining Backend Work

- Team/invite integration complete. Server lacks pending-invite listing and revoke endpoints; team settings shows this as a note.
- Issue API persistence, WebSockets, import parsing/jobs, API token hashing, MCP tools, and their route-level authorization remain unimplemented on the server. The dashboard project creation, board, and MCP screens remain fixture-backed until their corresponding client integrations exist.
- Replace Zustand demo actions with TanStack Query/API mutations without changing screen contracts.

## Do Not Regress

- Do not reintroduce Closed to the frontend lifecycle without a new product decision.
- Do not treat frontend role lenses as authorization.
- Do not persist raw MCP token values.
- Preserve `/profile/settings` and `/profile/mcp` as canonical paths.
- Preserve one shared authenticated shell and URL-owned project view/search/issue state.
