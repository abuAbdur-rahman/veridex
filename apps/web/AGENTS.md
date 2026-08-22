# Veridex Web Agent Guide

## Purpose

`apps/web/` contains the Veridex React SPA: a public landing page, authenticated QA workflow screens, and the client boundary for implemented server APIs. Authenticated routes share the application shell and TanStack Query cache.

## Structure

```text
src/
  components/
    app/           Authenticated shell and reusable workflow UI
    landing/       Landing page sections and interactive visual
    layout/        Site-wide navigation and footer
    screens/       Focused route-level screens
    theme/         Theme controls
    ui/            Shared UI primitives and feedback hosts
  api/             Runtime-validated server request adapters
  lib/             Small reusable utilities
  providers/       App-wide context providers
  queries/         TanStack Query options, hooks, and cache projections
  routes/          TanStack Router route modules
  stores/          Fixture-backed demo domain state
  styles/          Reserved for additional style modules
  index.css        Design tokens and landing stylesheet
  main.tsx         Browser entry point
  router.tsx       Typed router instance
public/
  logos/           Supplied Veridex raster assets
```

## Commands

```bash
pnpm dev
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

## Conventions

- Use `@/` for imports from `src/`.
- Put server request adapters in `src/api/` and validate external responses before returning typed data.
- Put shared TanStack Query options and hooks in `src/queries/`; use the router-provided `QueryClient` for guards and cache updates.
- Keep fixture-only workflow state in `src/stores/demo-store.ts`. Do not mix server-backed mutations into that store.
- Keep route definitions in `src/routes/`.
- Keep reusable page pieces in focused components; do not create a single monolithic page file.
- Validate external data at boundaries when API/form work is added.
- Use Inter for prose and JetBrains Mono for IDs, labels, statuses, and section titles.
- Do not merge status colors with the orange interaction accent.
- Preserve visible focus states and `prefers-reduced-motion` support.

## Current Server Integration

Implemented client integrations:

- **Auth/session:** Social sign-in/sign-out, local development test-user login through `POST /api/dev/test-session` on loopback development servers, `GET /api/me`, `GET /api/users/check-username`, and `POST /api/onboarding/complete`.
- **Teams:** `GET /api/teams`, `POST /api/teams`, `GET /api/teams/:teamId/members`.
- **Invites:** create, validate, accept, list pending, and revoke team invites through the implemented invite endpoints.
- **Projects and issues:** project membership, issue CRUD, assignments, status history, issue images, spreadsheet import, and project-scoped WebSocket refresh are server-backed.
- **Issue comments:** list and create comments from issue detail; server comment rows expose `authorId`, so the UI resolves names from the current project-member projection and falls back to the ID.
- **MCP profile:** API-token management plus access-summary and recent-activity views are server-backed. The manual MCP JSON-RPC endpoint is available at `/mcp`; the SDK transport migration remains a server follow-up.

Fixture state remains limited to workflows whose server contracts are not implemented. Team settings and sidebar use server-backed teams; login preserves invite redirect via search param. The local test-user button is hostname-gated in the browser, while the server's development flag and loopback guard remain authoritative.

Check `.agents/states/server.md` before wiring a screen. A rendered frontend route does not imply a matching backend endpoint exists.
