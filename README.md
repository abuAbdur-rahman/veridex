# Veridex

Veridex is a QA-aware issue tracker built to replace spreadsheet-based bug tracking with one structured source of truth for development, QA, and testing teams.

The product is based on a real workflow problem: shared spreadsheets hide status history, ownership, reproduction details, and the test case connected to a bug. Veridex keeps those relationships explicit and gives each role the view it needs.

## Current Status

The repository currently contains the first web slice:

- A Vite + React + TypeScript public landing page.
- A themed authentication presentation route at `/auth`.
- Light and dark themes with persisted theme selection.
- A responsive design system using Inter for human-written copy and JetBrains Mono for structured UI data.
- Landing sections covering the spreadsheet problem, role-based workflow, MCP operation, and product features.

The backend currently contains the first health-check slice. The authenticated dashboard, database, spreadsheet import, real-time updates, and MCP server are specified but are not implemented in this checkout yet.

## Product Direction

Veridex is deliberately more specific than a generic project-management board.

- **Dev:** sees assigned and unassigned work, reproduction details, and implementation context.
- **QA:** sees issues awaiting verification, sorted for triage.
- **Tester:** reports issues and follows items returned for retest.
- **Admin:** oversees the project, manages members, imports existing data, and can preview role-based views.

The planned issue lifecycle is:

```text
Backlog -> In Progress -> In QA -> Verified -> Closed
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
├── .agents/                 Product, design, architecture, and implementation specs
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
        ├── src/             App factory, config, health route, and entry point
        └── package.json      Backend scripts and dependencies
```

## Prerequisites

- Node.js LTS.
- `pnpm`.

The current implementation is frontend-only and does not require a database, OAuth credentials, or backend environment variables to run the landing experience.

## Run the Web App

```bash
cd apps/web
pnpm install
pnpm dev
```

Open the local URL printed by Vite. The implemented routes are:

- `/` — public landing page.
- `/auth` — authentication presentation screen; OAuth actions are visual placeholders until the backend is added.

## Verification

Run these commands from `apps/web/`:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm build` runs the TypeScript project build followed by the Vite production build.

## Architecture

The planned product architecture is documented before backend implementation:

- **Web:** Vite, React 19, TypeScript, TanStack Router, TanStack Query, Zustand, Tailwind CSS v4, and focused CSS for the bespoke landing experience.
- **Server:** Node.js LTS, Fastify, REST/OpenAPI, Zod, Drizzle, Better Auth, WebSockets, pg-boss, Cloudflare R2, and an MCP server mounted at `/mcp`.
- **Database:** PostgreSQL 17 locally and Neon in production. Better Auth owns the `auth` schema; Drizzle owns Veridex tables in `public`.
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
- [`.agents/tasks/setup-veridex-web.md`](.agents/tasks/setup-veridex-web.md) — web setup goal, constraints, acceptance checks, and current phase status.
- [`.agents/veridex.html`](.agents/veridex.html) — original landing-page reference.
- [`.agents/veridex-spec.html`](.agents/veridex-spec.html) — original color and typography reference.

## Scope Discipline

The MVP should deepen the QA-specific workflow before expanding into generic project-management features. Notifications, multi-project/workspace support, complex permission systems, attachments, and AI features beyond workflow-tied triage are intentionally deferred.
