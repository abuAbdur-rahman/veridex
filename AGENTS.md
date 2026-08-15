# Veridex Contributor Guide

## Purpose

Veridex is a QA-aware issue tracker for development, QA, and testing teams. The core product promise is a structured replacement for spreadsheet-based issue tracking, with role-aware views and an agent-operable MCP surface.

Before changing product behavior, read the relevant specification in `.agents/`. Preserve the specific QA workflow and spreadsheet-replacement story; do not let implementation drift into a generic task board.

## Source Of Truth

Use these documents in this order:

1. Existing implementation in the affected directory.
2. [`apps/web/AGENTS.md`](apps/web/AGENTS.md) for frontend-local rules.
3. The most specific document in `.agents/` for the feature being changed.
4. [`apps/web/DESIGN.md`](apps/web/DESIGN.md) for application UI decisions.
5. [`README.md`](README.md) for repository-level orientation.

When two specifications disagree, stop and resolve the conflict in the most specific document before coding. Do not silently invent behavior.

## Agent State

Per-app cross-session state files live in `.agents/states/` (`web.md`, `server.md`). Update the relevant file when you finish a slice so the next session can pick up where you left off.

## Repository Scope

Current implementation lives in `apps/web/`. The product and backend specifications describe planned work; they are not evidence that those modules already exist.

Keep application files inside their owning directory. Frontend code belongs in `apps/web/`; backend code belongs in `apps/server/`. Future database, auth, job, and MCP code should follow the placements described in `.agents/veridex-backend-spec.md` and `.agents/veridex-db-schema.md`.

## Frontend Commands

Run from `apps/web/`:

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

Use `pnpm` for frontend dependency and script operations. Do not switch package managers or add generated package-manager files without a concrete reason.

## Frontend Conventions

- Use `@/` for imports from `apps/web/src/`.
- Keep TanStack Router definitions in `apps/web/src/routes/` and the router instance in `apps/web/src/router.tsx`.
- Keep route pages composed from focused components; do not create a monolithic route module.
- Put app-wide providers in `apps/web/src/providers/`.
- Put reusable visual pieces in the appropriate `components/` subdirectory.
- Validate external data at boundaries before using it in API, form, import, or MCP code.
- Use typed interfaces and `unknown` narrowing; do not introduce TypeScript `any`.
- Preserve visible keyboard focus states and reduced-motion behavior.
- Use Lucide icons when an icon exists in the project icon library.

## Design Constraints

- Use Inter for human-written prose and JetBrains Mono for structured or generated data.
- Keep status colors separate from the orange interaction accent.
- Do not use status colors for buttons, links, active navigation, focus rings, or selection.
- Follow the design tokens in `apps/web/src/index.css` and the rules in `apps/web/DESIGN.md`.
- Favor bordered, information-dense application UI over decorative card stacks and generic dashboard patterns.
- Preserve light and dark themes.
- New interactive controls need default, hover, focus, active, disabled, loading, and reduced-motion behavior where applicable.

## Product Rules

- One issue model supports Dev, QA, Tester, and Admin views.
- Authorization is scoped by project membership, not by a global user role.
- The issue lifecycle is `backlog <-> in_progress <-> in_qa <-> verified`; backward transitions require an audit note.
- Status changes and status-history writes must be atomic when the backend is implemented.
- MCP tokens are shown once, stored hashed, and checked against project membership and role on every tool call.
- Spreadsheet import is a first-class MVP feature, not a generic file-upload add-on.
- Do not add notifications, multi-workspace support, complex permissions, or generic AI features without updating scope documentation first.

## Backend Rules For Planned Work

Follow `.agents/veridex-backend-spec.md` and `.agents/veridex-db-schema.md` when server code is introduced:

- Use Fastify, REST/OpenAPI, Zod, Drizzle, Better Auth, WebSockets, pg-boss, and the planned MCP SDK stack.
- Use pooled `DATABASE_URL` for runtime queries and unpooled `DATABASE_URL_UNPOOLED` for migrations and pg-boss.
- Treat references to `auth.user.id` as application-level relationships; Drizzle does not enforce those cross-schema foreign keys in this design.
- Broadcast WebSocket events only after the transaction commits.
- Scope WebSocket rooms by `projectId` and validate project membership during upgrade.
- Return the shared error shape: `{ error: { code, message, details? } }`.
- Never log or persist plaintext API tokens.
- Use `source: 'web' | 'mcp' | 'import'` explicitly on every status-changing call site.

## Documentation Rules

Update documentation when commands, routes, architecture, scope, or implementation status changes. Clearly label planned behavior as planned. Do not document a route or service as implemented until it exists and has passed its relevant checks.

## Verification

Before reporting frontend work complete, run `pnpm lint`, `pnpm typecheck`, and `pnpm build` from `apps/web/`. For backend work, run the checks defined by the new package and add focused tests for service-layer behavior, authorization, transactions, token handling, and import parsing as applicable.
