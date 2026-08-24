# Veridex — Backend Stack Specification

> Version: v1.4 — added `source` tracking ('web' | 'mcp' | 'import') to every status-changing call site, MCP activity feed endpoint, MCP connection config generation.

---

## Stack at a Glance

| Layer | Choice |
|-------|--------|
| Runtime | Node.js (LTS) |
| Framework | Fastify |
| API design | REST + OpenAPI (Zod-derived, `fastify-type-provider-zod`) |
| ORM | Drizzle |
| Database (prod) | Neon — pooled string for runtime, unpooled for migrations + pg-boss |
| Database (local) | Installed PostgreSQL 17+ or optional PostgreSQL 17 Compose service |
| File storage | Cloudflare R2 (S3-compatible) |
| Job queue | pg-boss (Postgres-backed, unpooled connection) |
| Auth | Better Auth, mounted on Fastify via `toNodeHandler` |
| Real-time | WebSockets via `@fastify/websocket`, scoped per project |
| MCP server | Mounted at `/mcp`, authenticated via `api_tokens`, scoped by `project_member.role` |
| Deployment | Railway |
| Testing | Vitest — unit tests on service layer |

---

## ⚠️ Critical Gotchas

### 1. Transaction Integrity on Status Updates

`issues.status` and `issue_status_history` must be written in a single DB transaction, broadcast fired only after commit. Every call site passes `source` explicitly — never inferred after the fact — so the MCP Connection page's activity feed can distinguish agent-driven changes from manual ones.

```typescript
// services/issue.service.ts
export async function updateStatus(
  issueId: string,
  toStatus: IssueStatus,
  changedBy: string,
  projectId: string,
  source: 'web' | 'mcp' | 'import',   // NEW — required, no default at the service layer
  note?: string
) {
  const current = await db.query.issues.findFirst({ where: eq(issues.id, issueId), columns: { status: true } });

  await db.transaction(async (tx) => {
    await tx.update(issues).set({ status: toStatus, updatedAt: new Date() }).where(eq(issues.id, issueId));
    await tx.insert(issueStatusHistory).values({
      issueId, changedBy, fromStatus: current?.status ?? null, toStatus, note, source,
    });
  });

  broadcast(projectId, { type: 'issue:status_changed', payload: { issueId, toStatus, source } });
}
```

Call sites:

```typescript
// routes/issues.ts — REST route
await issueService.updateStatus(issue.id, body.status, user.id, projectId, 'web', body.note);

// mcp/tools/change-status.ts — MCP tool
await issueService.updateStatus(issueId, toStatus, callerId, issue.projectId, 'mcp');

// jobs/import.worker.ts — import insert
await issueService.updateStatus(issue.id, mappedStatus, importJob.createdBy, projectId, 'import');
```

### 2. Neon Connection Pooling — Two Strings, Two Purposes

| String | Used for | Why |
|--------|----------|-----|
| `DATABASE_URL` (pooled, PgBouncer) | Drizzle runtime queries in Fastify | Connection reuse under load |
| `DATABASE_URL_UNPOOLED` (direct) | `drizzle-kit` migrations, `pg-boss` | PgBouncer breaks advisory locks + DDL |

```typescript
// packages/db/src/client.ts
const queryClient = postgres(process.env.DATABASE_URL!);      // pooled — runtime
export const db = drizzle(queryClient, { schema });
export const unpooledConnectionString = process.env.DATABASE_URL_UNPOOLED!; // migrations + pg-boss
```

### 3. WebSocket Scaling Limit

In-memory `Map<projectId, Set<WebSocket>>` broadcaster works on a single instance only. Multi-instance deploys must swap to Postgres `LISTEN/NOTIFY` via the pg-boss connection — service layer and client code are unaffected by the swap.

---

## Fix #4 — Cross-schema FK is app-level, not DB-level

Every `text` column referencing `auth.user.id` (Better Auth's schema) has **no database foreign key constraint** — Drizzle-kit cannot generate one across independently-migrated schemas. Enforcement happens entirely at the application layer:

```typescript
// lib/auth.ts
export async function requireSession(request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new UnauthorizedError();
  return session; // session.user.id is now a trusted, validated string
}
```

Every service function that writes a user ID into a Veridex table receives that ID from a validated session — never from unvalidated client input. This is the substitute for the missing DB constraint.

---

## Fix #10 — Mounting Better Auth on Fastify

Better Auth ships official adapters for Express and Hono, but not Fastify directly. The Node.js handler adapter (`toNodeHandler`) bridges the gap — it wraps Better Auth's request handler to work with raw Node req/res objects, which Fastify exposes via `request.raw` / `reply.raw`.

```typescript
// plugins/auth.ts
import type { FastifyInstance } from 'fastify';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@veridex/auth';

export async function authPlugin(fastify: FastifyInstance) {
  // Mount ALL Better Auth routes (OAuth callbacks, session, sign-out, etc.)
  // Must be registered BEFORE fastify's own body parser touches these routes
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body); // let Better Auth parse its own body
  });

  fastify.all('/api/auth/*', async (request, reply) => {
    const response = await toNodeHandler(auth)(request.raw, reply.raw);
    return response;
  });
}
```

```typescript
// index.ts
await fastify.register(authPlugin);
```

Register this plugin **before** any global `@fastify/multipart` or JSON body parser that might consume the request stream Better Auth needs to read itself.

---

## Fix #8 — WebSocket Subscription Scoping

The broadcaster keys rooms by `projectId`, but the original spec never defined how a socket connection gets assigned to a room. A user with two tabs open (project A and project B) needs two independently-scoped connections.

**Resolution:** the client passes `projectId` as a query parameter on the WS upgrade URL. The server validates project membership before joining the room.

```typescript
// ws/handler.ts
fastify.get('/ws', { websocket: true }, async (socket, request) => {
  const projectId = new URL(request.url, 'http://x').searchParams.get('projectId');
  if (!projectId) return socket.close(4000, 'projectId required');

  const session = await requireSession(request);
  const member = await db.query.projectMember.findFirst({
    where: and(eq(projectMember.projectId, projectId), eq(projectMember.userId, session.user.id)),
  });
  if (!member) return socket.close(4003, 'Not a project member');

  joinRoom(projectId, socket);
  socket.on('close', () => leaveRoom(projectId, socket));

  // Fix #11 — session expiry check on every keep-alive
  socket.on('message', async (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'ping') {
      const stillValid = await auth.api.getSession({ headers: request.headers });
      if (!stillValid) {
        socket.send(JSON.stringify({ type: 'auth:expired' }));
        return socket.close(4001, 'Session expired');
      }
      socket.send(JSON.stringify({ type: 'pong' }));
    }
  });
});
```

Client:

```typescript
// apps/web/src/lib/ws.ts
const ws = new WebSocket(`${WS_URL}/ws?projectId=${projectId}`);

ws.onmessage = ({ data }) => {
  const { type, payload } = JSON.parse(data);
  if (type === 'auth:expired') {
    router.navigate({ to: '/login' });
    return;
  }
  // ... handle issue:* events
};

// Keep-alive + session validity check every 30s
setInterval(() => ws.send(JSON.stringify({ type: 'ping' })), 30_000);
```

---

## Fix #6 — ExcelJS Theme Color Resolution

`cell.fill.fgColor.rgb` is only populated when a cell uses an explicit RGB fill. Most real-world spreadsheets — including the QA sheet this feature is modeled on — use **theme colors** (`fgColor.theme` + `fgColor.tint`), which requires a resolver.

```typescript
// jobs/import.worker.ts — theme color resolution

// Excel's 10 standard theme color slots (Office default theme)
const THEME_COLORS = [
  'FFFFFF', '000000', 'E7E6E6', '44546A', // background/text 1&2
  '4472C4', 'ED7D31', 'A5A5A5', 'FFC000',  // accent 1-4
  '5B9BD5', '70AD47',                       // accent 5-6
];

function applyTint(hex: string, tint: number): string {
  const rgb = parseInt(hex, 16);
  const r = (rgb >> 16) & 0xff, g = (rgb >> 8) & 0xff, b = rgb & 0xff;
  const adjust = (channel: number) =>
    tint < 0
      ? Math.round(channel * (1 + tint))
      : Math.round(channel * (1 - tint) + 255 * tint);
  return [adjust(r), adjust(g), adjust(b)]
    .map(c => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function resolveCellColor(fgColor: ExcelJS.Fill['fgColor']): string | null {
  if (!fgColor) return null;
  if (fgColor.rgb) return fgColor.rgb;                     // explicit RGB — easy case
  if (fgColor.theme !== undefined) {                        // theme color — needs resolution
    const base = THEME_COLORS[fgColor.theme] ?? null;
    if (!base) return null;
    return fgColor.tint ? applyTint(base, fgColor.tint) : base;
  }
  return null; // indexed or auto — treat as no fill
}

// Status matching against resolved hex (fuzzy ranges, not exact match)
function hexToStatus(hex: string | null): IssueStatus | null {
  if (!hex) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  if (r > 200 && g > 150 && g < 220 && b < 100) return 'in_progress'; // orange range
  if (r > 200 && g > 200 && b < 120) return 'in_qa';                  // yellow range
  if (r < 120 && g > 150 && b < 150) return 'verified';               // green range
  return null; // no confident match — leave for user override in mapping UI
}
```

This resolver runs during the **parse step**, producing `color_mapping` suggestions that the user reviews and can override in the mapping UI — automatic detection is a convenience, not a silent guarantee.

---

## Fix #9 — CSV Parsing Dependency

The import flow requires CSV parsing on the server; this was missing from the dependency list.

```bash
pnpm add papaparse
pnpm add -D @types/papaparse
```

```typescript
// jobs/import.worker.ts
import Papa from 'papaparse';

const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
  header: true,
  skipEmptyLines: true,
});
```

CSV files have no cell color data — `.csv` imports always fall through to the manual status-mapping prompt in the UI (no `color_mapping` is ever generated for CSV).

---

## Monorepo Placement

```
veridex/
├── compose.yaml
└── apps/
    └── server/
        └── src/
            ├── index.ts
            ├── plugins/
            │   ├── auth.ts           ← toNodeHandler mount (fix #10)
            │   ├── cors.ts
            │   ├── helmet.ts
            │   ├── rate-limit.ts
            │   ├── multipart.ts
            │   ├── swagger.ts
            │   └── websocket.ts
            ├── routes/
            │   ├── teams.ts
            │   ├── invites.ts        ← new — accept/create invite tokens
            │   ├── projects.ts
            │   ├── issues.ts
            │   ├── import.ts
            │   ├── test-cases.ts
            │   ├── api-tokens.ts     ← new — create/revoke MCP tokens
            │   └── mcp.ts            ← new — access-summary + activity feed for /profile/mcp
            ├── services/
            │   ├── team.service.ts
            │   ├── invite.service.ts ← new
            │   ├── project.service.ts
            │   ├── issue.service.ts
            │   ├── member.service.ts
            │   ├── import.service.ts
            │   └── token.service.ts  ← new
            ├── ws/
            │   ├── handler.ts        ← projectId scoping + session expiry (fixes #8, #11)
            │   └── broadcaster.ts
            ├── mcp/
            │   ├── server.ts         ← auth via api_tokens
            │   └── tools/
            ├── jobs/
            │   ├── queue.ts          ← pg-boss init (unpooled)
            │   └── import.worker.ts  ← theme color resolver (fix #6)
            └── lib/
                ├── r2.ts
                ├── auth.ts           ← requireSession, requireProjectRole
                └── errors.ts         ← new — standard error shape (fix #14)
```

---

## Fix #14 — Standard Error Response Shape

Every route and every MCP tool returns errors in the same shape:

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  constructor() { super('UNAUTHORIZED', 'Session required', 401); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') { super('FORBIDDEN', message, 403); }
}

export class NotFoundError extends AppError {
  constructor(resource: string) { super('NOT_FOUND', `${resource} not found`, 404); }
}
```

```typescript
// index.ts — global error handler
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message, details: error.details },
    });
  }
  request.log.error(error);
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
});
```

Response shape: `{ error: { code, message, details? } }` — consistent across REST and used verbatim in MCP tool error returns.

---

## Local Development

### Optional `compose.yaml`

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:17-alpine
    container_name: veridex_postgres
    restart: unless-stopped
    ports:
      - '127.0.0.1:${POSTGRES_PORT:-5432}:5432'
    environment:
      POSTGRES_USER: veridex
      POSTGRES_PASSWORD: veridex
      POSTGRES_DB: veridex_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U veridex -d veridex_dev']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Local env vars

Installed PostgreSQL is the primary local workflow; Docker is not required. The optional Compose service binds PostgreSQL to host loopback only and uses the same direct URL, with `POSTGRES_PORT` reflected in the URL when overridden.

```bash
WEB_ORIGIN=http://localhost:5173

# Local: both point to the same direct database URL.
DATABASE_URL=postgresql://veridex:veridex@localhost:5432/veridex_dev
DATABASE_URL_UNPOOLED=postgresql://veridex:veridex@localhost:5432/veridex_dev

BETTER_AUTH_SECRET=any-long-local-secret
BETTER_AUTH_URL=http://localhost:3001

# Optional authenticated local E2E session. Keep the server loopback-bound.
DEV_AUTH_ENABLED=false

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=veridex-uploads
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com

PORT=3001
HOST=127.0.0.1
NODE_ENV=development
```

When `DEV_AUTH_ENABLED=true`, `NODE_ENV=development`, and `HOST` is
`127.0.0.1`, `localhost`, or `::1`, `POST /api/dev/test-session` creates or
signs in the fixed `dev-user@localhost.test` identity, completes onboarding,
and forwards the normal Better Auth session cookies. The route is not
registered unless all three guards pass. Keep this endpoint loopback-only; it
is a local E2E aid, not an authentication bypass for shared environments.

---

## Drizzle Migration Ownership

Drizzle is the sole migration owner for both `auth.*` and public tables. Run the server migration command, which uses `DATABASE_URL_UNPOOLED`:

```bash
pnpm --dir apps/server db:migrate
```

Do not run Better Auth migration commands or rewrite applied Drizzle migrations. Production uses Neon's direct URL for this command. The same direct URL will serve the planned pg-boss runner when jobs are implemented.

---

## Authorization Model

```typescript
// lib/auth.ts
export async function requireProjectRole(
  userId: string,
  projectId: string,
  allowed: ProjectRole[]
): Promise<ProjectMember> {
  const member = await db.query.projectMember.findFirst({
    where: and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)),
  });
  if (!member) throw new ForbiddenError('Not a member of this project');
  if (!allowed.includes(member.role)) throw new ForbiddenError('Insufficient role');
  return member;
}
```

---

## MCP Server Authentication (fix #2 support)

MCP requests authenticate via bearer token, hashed and looked up against `api_tokens`:

```typescript
// mcp/server.ts
import { createHash } from 'crypto';

async function authenticateMcpRequest(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  const raw = authHeader.slice(7);
  const hash = createHash('sha256').update(raw).digest('hex');

  const token = await db.query.apiTokens.findFirst({
    where: and(eq(apiTokens.tokenHash, hash), isNull(apiTokens.revokedAt)),
  });
  if (!token) throw new UnauthorizedError();
  if (token.expiresAt && token.expiresAt < new Date()) throw new UnauthorizedError();

  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, token.id));
  return { userId: token.userId };
}
```

### Tools (MVP)

| Tool | Min role |
|------|----------|
| `list_issues` | tester |
| `get_issue` | tester |
| `create_issue` | tester |
| `update_issue` | dev |
| `change_status` | dev |
| `assign_issue` | qa, admin |

Every tool call resolves `project_member.role` for the caller against the target issue's project — identical enforcement to REST routes via `requireProjectRole`.

---

## MCP Connection Page Support

Three additions needed to power the `/profile/mcp` frontend screen.

### 1. Access summary endpoint

Cross-references the caller's `project_member` rows against the tool table to show "what this agent can access" per project.

```typescript
// routes/mcp.ts
fastify.get('/api/mcp/access-summary', async (request, reply) => {
  const { user } = await requireSession(request);

  const memberships = await db.query.projectMember.findMany({
    where: eq(projectMember.userId, user.id),
    with: { project: true },
  });

  const TOOL_MIN_ROLE: Record<string, ProjectRole[]> = {
    list_issues:   ['tester', 'qa', 'dev', 'admin'],
    get_issue:     ['tester', 'qa', 'dev', 'admin'],
    create_issue:  ['tester', 'qa', 'dev', 'admin'],
    update_issue:  ['dev', 'admin'],
    change_status: ['dev', 'qa', 'admin'],
    assign_issue:  ['qa', 'admin'],
  };

  const summary = memberships.map(m => ({
    projectId: m.projectId,
    projectName: m.project.name,
    role: m.role,
    availableTools: Object.entries(TOOL_MIN_ROLE)
      .filter(([, roles]) => roles.includes(m.role))
      .map(([tool]) => tool),
    totalTools: Object.keys(TOOL_MIN_ROLE).length,
  }));

  return reply.send({ summary });
});
```

### 2. Agent activity feed endpoint

Powered directly by `issue_status_history.source = 'mcp'` — the schema addition that makes this feed possible.

```typescript
// routes/mcp.ts
fastify.get('/api/mcp/activity', async (request, reply) => {
  const { user } = await requireSession(request);

  const activity = await db.query.issueStatusHistory.findMany({
    where: and(eq(issueStatusHistory.changedBy, user.id), eq(issueStatusHistory.source, 'mcp')),
    orderBy: desc(issueStatusHistory.changedAt),
    limit: 20,
    with: { issue: { columns: { ticketRef: true, title: true } } },
  });

  return reply.send({ activity });
});
```

### 3. Config snippet generation (client-side only)

No new endpoint needed — the frontend composes the JSON config block from the server's public MCP URL (an env-driven constant, e.g. `PUBLIC_MCP_URL`) plus the raw token value, which is only ever available in the response body of `POST /api/tokens`, immediately after generation. The config block is never reconstructable after that response — if the user navigates away without copying it, they must generate a new token.

---

## Full Dependency List

```bash
# Core
pnpm add fastify
pnpm add @fastify/cors @fastify/helmet @fastify/rate-limit
pnpm add @fastify/multipart
pnpm add @fastify/websocket
pnpm add @fastify/swagger @fastify/swagger-ui

# Zod → Fastify type provider
pnpm add fastify-type-provider-zod zod

# ORM + DB
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit

# File storage
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Spreadsheet parsing
pnpm add exceljs
pnpm add papaparse              # NEW — CSV parsing (fix #9)
pnpm add -D @types/papaparse

# Job queue (unpooled connection)
pnpm add pg-boss

# MCP
pnpm add @modelcontextprotocol/sdk

# Dev
pnpm add -D tsx vitest @vitest/coverage-v8
pnpm add dotenv
```

---

## Testing Strategy

Vitest targets the service layer, dependency-injected `db`. No Docker/Neon needed for unit tests.

Key test targets:
- `createIssue` ticket_ref generation is race-safe (simulate concurrent calls)
- Status transition rules
- Theme color resolver — verify against known theme + tint combinations
- `requireProjectRole` throws on insufficient role
- `broadcast()` called after mutations (spy)
- API token hashing — verify plaintext never persisted

---

## Recommended Build Order

1. `docker compose up -d`
2. Fastify scaffold → `GET /health`
3. Drizzle client + first migration (team, invites, project, issues, api_tokens)
4. Better Auth plugin mount (fix #10) → `pnpm db:migrate` (fix #13)
5. Teams + Invites CRUD
6. Projects + Project Members CRUD
7. Issues CRUD + atomic ticket_ref + status transitions
8. WebSocket server → projectId scoping + session expiry (fixes #8, #11)
9. pg-boss + import worker with theme color resolver (fix #6)
10. Spreadsheet import routes (upload → preview → confirm)
11. API tokens CRUD
12. MCP server → tools + token auth
13. Vitest service unit tests

---

## Explicitly Excluded

| Excluded | Reason |
|----------|--------|
| Redis | pg-boss uses Postgres; in-memory broadcaster for single instance |
| tRPC | REST + OpenAPI chosen |
| Polling for real-time | Replaced by WebSockets |
| DB-level cross-schema FKs | Not supported cleanly by Drizzle-kit; app-level enforcement used instead |
| Email/notifications | Out of scope for MVP — invite links are shareable, not emailed |
| Docker for production | Railway handles it |

## Fix #15 — Issue Member Projection

Issue list/detail/create/update/status/assign responses embed resolved member
references so clients do not need a second lookup against project members to
display names.

Contract: every serialized issue carries optional projection fields alongside
the raw ID fields (kept for backward compatibility during client transition):

```typescript
interface MemberRef {
  id: string;
  name: string;
  image: string | null;
}

// Added to each issue response:
reporter?: MemberRef | null;
developerAssignees?: MemberRef[];
qaAssignees?: MemberRef[];
```

- Resolution joins `project_member` with `auth.user` per request (one query),
  scoped by `projectId`; never a per-issue N+1.
- Raw `reporterId`, `developerAssigneeIds`, and `qaAssigneeIds` remain the
  source of truth for mutations; projection fields are display-only.
- Implemented in `issue.service.ts` (`getProjectMemberDirectory`,
  `withMemberProjection`) and applied in `routes/issues.ts`.

## Integration Test Harness (Real PostgreSQL)

`apps/server` runs a focused integration tier against real PostgreSQL:

- Harness: `src/test/pg-harness.ts` — ephemeral `postgres:16-alpine` container
  driven by the Docker CLI (`docker run -P`, readiness via `pg_isready`, teardown
  via `docker rm -f`, crash-safe cleanup on process exit). No extra dependencies;
  applies the full migration chain and the `drizzle.__drizzle_migrations`
  ledger; exposes drizzle `db`, raw `sql`, `reset()` (TRUNCATE all app tables
  between tests), `stop()`.
- Command: `pnpm test:integration`. Excluded from the default unit run by
  `vitest.config.ts`. Auto-skips when Docker is unavailable.
- Tier owns behaviors the transaction double cannot prove: constraint
  enforcement, rollback semantics, status+history atomicity under concurrent
  transitions, and migration-chain integrity.
