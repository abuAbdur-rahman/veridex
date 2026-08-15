# Veridex Server — Contributor Guide

## Purpose

Fastify + TypeScript backend for Veridex, a QA-aware issue tracker. Owns auth, projects, issues, status history, spreadsheet import, real-time events, and the MCP surface.

## Source of truth

Read in this order before changing server behavior:

1. Root [`AGENTS.md`](../../AGENTS.md) — repository-wide rules.
2. [`.agents/veridex-backend-spec.md`](../../.agents/veridex-backend-spec.md) — runtime behavior, error shape, gotchas.
3. [`.agents/veridex-db-schema.md`](../../.agents/veridex-db-schema.md) — table contracts and constraints.
4. [`.agents/tasks/server/`](../../.agents/tasks/server/) — active work plan.

When two documents disagree, resolve in the most specific one before coding.

## Stack

- Node.js LTS, Fastify 5, Zod, Drizzle ORM, `postgres.js`
- Better Auth (mounted via `toNodeHandler`), pg-boss, AWS SDK (R2), ExcelJS, papaparse, MCP SDK
- Local DB: installed PostgreSQL 17+ is primary; optional PostgreSQL 17 Compose service
- Prod DB: Neon — pooled `DATABASE_URL` for runtime, unpooled `DATABASE_URL_UNPOOLED` for migrations + pg-boss

## Layout

```
apps/server/
├── drizzle.config.ts          # drizzle-kit config (uses DATABASE_URL_UNPOOLED)
└── src/
    ├── app.ts                 # Fastify factory — registers plugins + error handler
    ├── server.ts              # entry point
    ├── config.ts              # Zod-validated env contract
    ├── db/
    │   ├── client.ts          # pooled runtime client
    │   ├── migrations/        # drizzle-kit output
    │   └── schema/            # one file per table + enums + index barrel
    ├── lib/                   # errors.ts, auth.ts (requireSession/requireProjectRole)
    ├── plugins/               # helmet, cors, rate-limit, swagger, auth
    ├── routes/                # one file per resource
    ├── services/              # business logic, DI'd db
    ├── ws/                    # websocket handler + broadcaster
    ├── mcp/                   # MCP server + tools
    └── jobs/                  # pg-boss queue + import worker
```

## Conventions

- Validate all external input with Zod at the route boundary. Never trust `req.body`.
- Throw `AppError` subclasses; the global handler maps them to `{ error: { code, message, details? } }`.
- **Status changes**: write `issues.status` + `issue_status_history` in one DB transaction; broadcast WS only after commit; pass `source: 'web' | 'mcp' | 'import'` explicitly at every call site.
- **Cross-schema FKs** (columns referencing `auth.user.id`): plain `text` columns, no `.references()`. Enforce at the app layer via validated session IDs. Comment each column.
- No `any` — use `unknown` + narrowing.
- No `console.log` in committed code.
- No hardcoded secrets — read from env.
- Every `catch` must log, rethrow, or return a typed error.

## Local setup

```bash
# Postgres 18 must be installed and running (psql --version >= 18)
createuser -P veridex        # password: veridex
createdb -O veridex veridex_dev

cp .env.example .env         # fill DATABASE_URL + BETTER_AUTH_SECRET

pnpm install
pnpm typecheck
pnpm dev                     # http://127.0.0.1:3001
```

## Verification

Run from `apps/server/` before reporting work complete:

```bash
pnpm test          # Vitest
pnpm typecheck     # tsc --noEmit
pnpm build         # tsc project build
pnpm db:generate   # after any schema change, then review the migration SQL
```

Never edit a generated migration by hand — fix the schema source and regenerate.