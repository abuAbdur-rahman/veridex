# Veridex Frontend Handoff

Updated: 2026-08-15

## Current State

- Frontend implementation is fixture-backed and functional. Backend integration remains the primary unfinished product work.
- Authenticated routes share one responsive shell in `apps/web/src/components/app/AppShell.tsx`.
- Demo domain state lives in `apps/web/src/lib/demo-store.ts`, persisted in localStorage, with reset support. Raw MCP tokens are never persisted.
- Canonical profile routes are `/profile/settings` and `/profile/mcp`; `/profile` redirects to settings. Legacy `/settings` and `/settings/mcp` redirect to the profile routes.
- Sidebar footer has clickable avatar/profile navigation and confirmed Logout modal. Logout posts to `/api/auth/sign-out`; Vite proxies `/api` to `http://127.0.0.1:3001` in development. Redirect to `/login` occurs only after a successful response.
- Kanban uses `@dnd-kit/core` draggable cards, droppable lifecycle columns, pointer sensor, keyboard sensor, drag overlay, invalid-target disabling, and “Move to” fallback menu. Native horizontal scrollbar is hidden but horizontal scrolling remains available.
- Lifecycle is four-state: `backlog`, `in_progress`, `in_qa`, `verified`. Forward and backward transitions are supported. Every backward transition requires a note.
- Issue timestamps are normalized by `apps/web/src/lib/format-time.ts`; ISO mutation timestamps show relative values such as `just now`, while legacy fixture labels remain unchanged.

## Verification

From `apps/web/`:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 12 tests.
- `pnpm build` passed.
- Browser verified: pointer drag Backlog -> In Progress -> Backlog, timestamps, profile redirects, hidden scrollbar measurement, logout confirmation/cancel, and no browser errors in tested flows.
- Build warning remains: main JS chunk approximately 633 KB before gzip, approximately 194 KB gzip. Route code splitting is a future optimization.

## Key Files

- `apps/web/src/components/app/AppShell.tsx`: shared shell, profile footer, logout confirmation, logo, route-aware header.
- `apps/web/src/components/screens/BoardScreen.tsx`: DnD context and lifecycle columns.
- `apps/web/src/components/app/KanbanCard.tsx`: draggable card and keyboard-visible drag handle.
- `apps/web/src/components/app/KanbanColumn.tsx`: droppable status column.
- `apps/web/src/lib/demo-store.ts`: lifecycle transitions and demo actions.
- `apps/web/src/lib/format-time.ts`: mutation timestamp formatting.
- `apps/web/src/router.tsx`: route tree including canonical profile routes and legacy redirects.
- `apps/web/vite.config.ts`: `/api` development proxy to backend port 3001.

## Remaining Backend Work

- Align backend issue service transition rules with the frontend four-state lifecycle. The server enum/migrations now match (`backlog`, `in_progress`, `in_qa`, `verified`; migration `0005` removes `closed`).
- Integrate the implemented Better Auth session, onboarding, and project-role foundations with the frontend. Teams/invites CRUD, issue API persistence, WebSockets, import parsing/jobs, API token hashing, MCP tools, and their route-level authorization remain unimplemented.
- Replace Zustand demo actions with TanStack Query/API mutations without changing screen contracts.

## Do Not Regress

- Do not reintroduce Closed to the frontend lifecycle without a new product decision.
- Do not treat frontend role lenses as authorization.
- Do not persist raw MCP token values.
- Preserve `/profile/settings` and `/profile/mcp` as canonical paths.
- Preserve one shared authenticated shell and URL-owned project view/search/issue state.
