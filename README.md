# Veridex

Veridex is a QA-aware issue tracker built to replace spreadsheet-based bug tracking with one structured source of truth for development, QA, and testing teams.

The product is based on a real workflow problem: shared spreadsheets hide status history, ownership, reproduction details, and the test case connected to a bug. Veridex keeps those relationships explicit and gives each role the view it needs.

## Current Status

The frontend is a fixture-backed, functional issue-tracking application:

- A Vite + React + TypeScript SPA with a public landing page.
- Authenticated issue-management UI: a shared app shell, Kanban board with the four-state lifecycle, issue create/detail/update, role workflows, and profile settings.
- Light and dark themes with persisted theme selection.
- A responsive design system using Inter for human-written copy and JetBrains Mono for structured UI data.

The backend foundation and onboarding slice are implemented and committed: a Fastify app factory with plugin layout, Zod-validated env contract, shared error envelope, Better Auth (Drizzle adapter, production-secure cookies), session and project-role authorization, rate limiting, Swagger, and the full Drizzle schema (enums + 13 public tables plus 4 auth tables) with forward migrations `0000`–`0005`. Live backend integration for the dashboard, spreadsheet import, real-time updates, and the MCP server are specified but not yet implemented.

## Product Direction

Veridex is deliberately more specific than a generic project-management board.

- **Dev:** sees assigned and unassigned work, reproduction details, and implementation context.
- **QA:** sees issues awaiting verification, sorted for triage.
- **Tester:** reports issues and follows items returned for retest.
- **Admin:** oversees the project, manages members, imports existing data, and can preview role-based views.

The planned issue lifecycle is:

```text
Backlog <-> In Progress <-> In QA <-> Verified
                         ^          |
                         |----------+
                         retest
```

Core planned capabilities:

- Structured issues with severity, environment, reproduction steps, linked test cases, and immutable status history.
- Role-based views over one shared issue model.
- `.xlsx` and `.csv` import with column mapping and spreadsheet color detection for Excel files.
- MCP tools for listing, reading, creating, updating, assigning, and changing issue status.
- Optional AI-assisted triage tied to real issue-management workflows.

## Repository Layout

```text
veridex/
├── .agents/                 Product, design, architecture, implementation specs,
│                            task plans, and per-app agent state files
├── .codebase-memory/        Persistent codebase graph artifact
├── AGENTS.md                Repository-wide contributor and agent guide
├── README.md                Project overview and development guide
└── apps/
    ├── web/                 Vite + React + TypeScript SPA
        ├── public/logos/    Supplied Veridex logo assets
        ├── src/components/  Landing, layout, and theme components
        ├── src/lib/         Small reusable utilities and content data
        ├── src/providers/   App-wide providers
        ├── src/routes/      TanStack Router route modules
        ├── src/index.css    Design tokens and landing styles
        └── package.json      Frontend scripts and dependencies
    └── server/              Fastify backend
        ├── src/
        │   ├── app.ts        App factory, plugin registration, error handler
        │   ├── config.ts     Zod-validated environment contract
        │   ├── db/           Drizzle client, schema, generated migrations
        │   ├── lib/          Typed errors, auth helpers (session + project roles)
        │   ├── plugins/      helmet, cors, rate-limit, swagger, auth
        │   └── routes/       Health and onboarding routes
        ├── drizzle.config.ts Drizzle-kit config (uses DATABASE_URL_UNPOOLED)
        └── package.json      Backend scripts and dependencies
```

## Prerequisites

- Node.js LTS.
- `pnpm`.
- PostgreSQL 17 or newer. Installed PostgreSQL is the primary local workflow; Docker Compose is an optional contributor workflow.

The landing experience runs without a database or backend env vars. Backend work requires the local Postgres role/database described in [Backend Setup](#backend-setup).

## Run the Web App

```bash
cd apps/web
pnpm install
pnpm dev
```

Open the local URL printed by Vite. The implemented routes include the public landing page at `/`, the auth presentation screen at `/auth`, and the fixture-backed authenticated app shell with the board, issue details, and profile settings.

## Backend Setup

```bash
# 1. Create the local PostgreSQL 17+ role and database (once)
createuser -P veridex            # password: veridex
createdb -O veridex veridex_dev

# 2. Configure env
cp apps/server/.env.example apps/server/.env
#   Fill WEB_ORIGIN, DATABASE_URL, DATABASE_URL_UNPOOLED, BETTER_AUTH_SECRET
#   Optional local authenticated E2E: set DEV_AUTH_ENABLED=true while
#   NODE_ENV=development and HOST remains loopback-bound.

# 3. Install and verify
pnpm install
pnpm --filter @veridex/server typecheck
pnpm --filter @veridex/server dev    # http://127.0.0.1:3001

# 4. Database tooling (Drizzle owns both public and auth schemas)
pnpm --filter @veridex/server db:migrate
pnpm --filter @veridex/server db:generate
pnpm --filter @veridex/server db:studio
```

With local test auth enabled, `POST /api/dev/test-session` creates or signs in
`dev-user@localhost.test`, completes onboarding, and sets a normal Better Auth
session cookie. The route is absent unless development mode, the explicit flag,
and a loopback `HOST` (`127.0.0.1`, `localhost`, or `::1`) are all present.

The installed PostgreSQL workflow above does not require Docker. Contributors who prefer an isolated PostgreSQL 17 service can use:

```bash
POSTGRES_PORT=5433 docker compose up -d postgres
# Use localhost:5433 in both local database URLs when overriding the port.
docker compose down
```

The Compose service uses development-only credentials, a health check, and the named `veridex_postgres_data` volume. `POSTGRES_PORT` defaults to `5432`.

For local PostgreSQL, `DATABASE_URL` and `DATABASE_URL_UNPOOLED` may be the same direct URL. Production Neon uses a pooled `DATABASE_URL` for Fastify and a direct `DATABASE_URL_UNPOOLED` for Drizzle migrations. The direct URL will also be required by the planned pg-boss job runner; the job runner is not implemented yet.

## Verification

Run these commands from `apps/web/`:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm build` runs the TypeScript project build followed by the Vite production build.

### Backend

Run from the repo root (or from `apps/server/` without the filter):

```bash
pnpm --filter @veridex/server test
pnpm --filter @veridex/server typecheck
pnpm --filter @veridex/server build
```

## Architecture

The planned product architecture is documented before backend implementation:

- **Web:** Vite, React 19, TypeScript, TanStack Router, TanStack Query, Zustand, Tailwind CSS v4, and focused CSS for the bespoke landing experience.
- **Server:** Node.js LTS, Fastify, REST/OpenAPI, Zod, Drizzle, Better Auth, WebSockets, pg-boss, Cloudflare R2, and an MCP server mounted at `/mcp`.
- **Database:** PostgreSQL 17+ locally and Neon in production. Drizzle owns migrations for both `auth` and `public` schemas. Use pooled `DATABASE_URL` for runtime queries and direct `DATABASE_URL_UNPOOLED` for migrations and the planned pg-boss runner.
- **Deployment target:** Railway for the backend.
- **Testing direction:** Vitest for backend service-layer tests.

The backend starts with `GET /health` and is intentionally separate from `apps/web/`. Continue implementing it according to the specifications in `.agents/` rather than inventing a second product model.

## Design Rules

Two rules define the visual language:

1. **Status colors and interaction accent are independent.** Status colors communicate facts about an issue; orange accent communicates interaction, selection, focus, and links. Never use one system as the other.
2. **Human-written text uses Inter; structured or generated data uses JetBrains Mono.** This applies to issue titles and comments, ticket IDs, timestamps, labels, and environment strings.

The full application design system is in [`apps/web/DESIGN.md`](apps/web/DESIGN.md).

## Project Specifications

The `.agents/` directory is the source for product intent and planned architecture:

- [`AGENTS.md`](AGENTS.md) — repository-wide implementation rules.
- [`.agents/README.md`](.agents/README.md) — product origin, audience, MVP scope, and differentiation strategy.
- [`.agents/dev-spec.md`](.agents/dev-spec.md) — frontend stack and dependency decisions.
- [`.agents/veridex-app-flow.md`](.agents/veridex-app-flow.md) — auth, onboarding, issue lifecycle, import, MCP, and route flows.
- [`.agents/veridex-pages-screens.md`](.agents/veridex-pages-screens.md) — screen-level UX and data requirements.
- [`.agents/veridex-db-schema.md`](.agents/veridex-db-schema.md) — PostgreSQL entities, constraints, indexes, and transaction rules.
- [`.agents/veridex-backend-spec.md`](.agents/veridex-backend-spec.md) — Fastify backend, auth, WebSockets, imports, MCP, local development, and testing plan.
- [`.agents/states/`](.agents/states/) — per-app agent state files (`web.md`, `server.md`) for cross-session handoff.
- [`.agents/veridex.html`](.agents/veridex.html) — original landing-page reference.
- [`.agents/veridex-spec.html`](.agents/veridex-spec.html) — original color and typography reference.

## Scope Discipline

The MVP should deepen the QA-specific workflow before expanding into generic project-management features. Notifications, multi-project/workspace support, complex permission systems, attachments, and AI features beyond workflow-tied triage are intentionally deferred.
