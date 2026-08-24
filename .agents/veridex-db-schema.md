# Veridex — Database Schema Specification

> Version: v0.6 — invite tokens are now hashed at rest.

---

## What Changed from v0.5

| Change | Detail |
|--------|--------|
| Invite token storage hardened | Replaced plaintext `invites.token` with unique SHA-256 `token_hash` plus display-safe `token_prefix`. Raw URL-safe tokens are returned once and never stored or logged. |

## What Changed from v0.4 → v0.5

| Change | Detail |
|--------|--------|
| `issue_status_history.source` added | `change_source` enum: `web` \| `mcp` \| `import`. Distinguishes agent-driven changes from manual web UI changes — needed for the MCP Connection page's "Recent agent activity" feed. |

## What Changed from v0.3 → v0.4

| Fix | Change |
|-----|--------|
| #1 | `project.next_ticket_number` added; `ticket_ref` generated atomically, scoped per project |
| #2 | `api_tokens` table added for MCP authentication |
| #3 | `invites` table added — team invite tokens now persisted and validatable |
| #4 | All `FK → auth.user.id` are now **application-level only** — Drizzle cannot enforce cross-schema constraints, so these are documented, not declared |
| #12 | `import_jobs.file_type` converted from `text` to `file_type` enum |

---

## Architecture

```
PostgreSQL 17+
├── auth (schema)     — owned by Drizzle migrations
│   ├── user          — extended with username + default_role
│   ├── session
│   ├── account
│   └── verification
└── public (schema)   — owned by Drizzle migrations
    ├── team
    ├── team_member
    ├── invites
    ├── project
    ├── project_member
    ├── issues
    ├── issue_status_history
    ├── comments
    ├── test_cases
    ├── tags
    ├── issue_tags
    ├── import_jobs
    └── api_tokens
```

### ⚠️ Cross-schema FK constraint limitation

Every column referencing `auth.user.id` in this document is written as "FK → auth.user.id" for documentation clarity, but **none of these are enforced as database foreign keys**. Drizzle owns migrations for both the `auth` and `public` schemas, but Veridex deliberately keeps application user references unconstrained at the database layer so Better Auth remains the authority for user lifecycle behavior.

**These relationships are enforced at the application layer only:**
- Every write to a user-referencing column is validated against an active session (the ID came from an authenticated request — it is trustworthy by construction).
- Referential integrity on delete is handled in the service layer, not via `ON DELETE CASCADE` from `auth.user`.
- If a user is deleted from Better Auth, a server-side cleanup job (not a DB trigger) must handle orphaned references.

In Drizzle schema files, user-referencing columns are declared as plain `text` columns with a comment, not a `.references()` call:

```typescript
reporterId: text('reporter_id').notNull(), // FK → auth.user.id (app-level only, not DB-enforced)
```

---

## Enumerable Types

```sql
CREATE TYPE team_role      AS ENUM ('owner', 'admin', 'member');
CREATE TYPE project_role   AS ENUM ('dev', 'qa', 'tester', 'admin');
CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE issue_status   AS ENUM ('backlog', 'in_progress', 'in_qa', 'verified', 'rejected');
CREATE TYPE import_status  AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE file_type      AS ENUM ('xlsx', 'csv');
CREATE TYPE change_source  AS ENUM ('web', 'mcp', 'import');
```

---

## Auth Layer — Better Auth

Managed exclusively through the Drizzle schema and forward migrations in `apps/server/src/db/migrations/`. Better Auth's migration CLI is not used.

### `user` (Better Auth base + Veridex extensions)

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| `id` | `text` (UUID string) | Better Auth | PK — `generateId: crypto.randomUUID` |
| `name` | `text` | Better Auth | Synced from OAuth provider |
| `email` | `text` UNIQUE | Better Auth | Read-only in app |
| `emailVerified` | `boolean` | Better Auth | Auto-true on OAuth |
| `image` | `text` nullable | Better Auth | Avatar URL |
| `createdAt` / `updatedAt` | `timestamp` | Better Auth | |
| `username` | `text` UNIQUE nullable | Veridex extension | Null until onboarding confirms it |
| `default_role` | `text` nullable | Veridex extension | UX hint for invite dropdown — never used for auth |

### `session`, `account`, `verification`

Unchanged — see Better Auth docs. `account.providerId` is `google` or `github`; `account.password` is always null (OAuth-only).

---

## Veridex Tables

> All Veridex PKs are `uuid` via `gen_random_uuid()`.
> All user-referencing columns are `text`, app-level FK only (see limitation above).

---

### 1. `team`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `name` | `text` | NOT NULL | |
| `slug` | `text` | UNIQUE NOT NULL | |
| `owner_id` | `text` | app FK → `auth.user.id` | |
| `is_personal` | `boolean` | NOT NULL, default `false` | Hides from invite/discovery UIs |
| `created_at` | `timestamptz` | default `now()` | |

---

### 2. `team_member`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `team_id` | `uuid` | FK → `team.id` ON DELETE CASCADE | |
| `user_id` | `text` | app FK → `auth.user.id` | |
| `team_role` | `team_role` | NOT NULL, default `member` | |
| `invited_by` | `text` | app FK → `auth.user.id`, nullable | Null for team owner (self) |
| `joined_at` | `timestamptz` | default `now()` | |

**Primary key:** `(team_id, user_id)`

---

### 3. `invites` — NEW (fix #3)

Persists team invite tokens so they can be validated, expired, and revoked server-side. Raw URL-safe tokens are returned exactly once when created and are never stored or logged. Only their SHA-256 hashes and display-safe prefixes are persisted. Incoming tokens are hashed before lookup.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `token_hash` | `text` | UNIQUE NOT NULL | SHA-256 hash used for invite lookup |
| `token_prefix` | `text` | NOT NULL | Safe leading characters shown for identification |
| `team_id` | `uuid` | FK → `team.id` ON DELETE CASCADE | |
| `invited_by` | `text` | app FK → `auth.user.id` | |
| `email` | `text` | NOT NULL | Invitee's email — for reference and future email delivery |
| `team_role` | `team_role` | NOT NULL, default `member` | Role granted on acceptance |
| `accepted_at` | `timestamptz` | nullable | Null until claimed |
| `expires_at` | `timestamptz` | NOT NULL | Default: `created_at + 7 days` |
| `created_at` | `timestamptz` | default `now()` | |

```typescript
export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').unique().notNull(),
  tokenPrefix: text('token_prefix').notNull(),
  teamId: uuid('team_id').notNull().references(() => team.id, { onDelete: 'cascade' }),
  invitedBy: text('invited_by').notNull(),
  email: text('email').notNull(),
  teamRole: teamRoleEnum('team_role').notNull().default('member'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

Acceptance logic (service layer): hash the incoming raw token with SHA-256 and look up `token_hash`; reject if `expires_at < now()` or `accepted_at IS NOT NULL`. On success, set `accepted_at = now()` and insert the `team_member` row in the same transaction. Never persist or log the raw token.

---

### 4. `project`

`next_ticket_number` added — see fix #1 for the atomic generation pattern used in `issues`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `team_id` | `uuid` | FK → `team.id` ON DELETE CASCADE, NOT NULL | |
| `name` | `text` | NOT NULL | |
| `slug` | `text` | NOT NULL | Unique within team |
| `description` | `text` | nullable | |
| `next_ticket_number` | `integer` | NOT NULL, default `0` | **New.** Incremented atomically on issue creation. |
| `created_by` | `text` | app FK → `auth.user.id` | |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | default `now()` | |

**Unique constraint:** `(team_id, slug)`

---

### 5. `project_member`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `project_id` | `uuid` | FK → `project.id` ON DELETE CASCADE | |
| `user_id` | `text` | app FK → `auth.user.id` | |
| `role` | `project_role` | NOT NULL | Authorization source of truth |
| `added_at` | `timestamptz` | default `now()` | |

**Primary key:** `(project_id, user_id)`

---

### 6. `issues`

`ticket_ref` uniqueness is now scoped correctly — see fix #1 below the table.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `ticket_ref` | `text` | NOT NULL | `VRX-001` — generated atomically, unique per project |
| `title` | `text` | NOT NULL | |
| `description` | `text` | nullable | |
| `severity` | `issue_severity` | NOT NULL, default `medium` | |
| `status` | `issue_status` | NOT NULL, default `backlog` | Denormalized read column |
| `environment` | `jsonb` | nullable | `{ browser, os, device, version, page }` |
| `steps_to_reproduce` | `text` | nullable | |
| `expected_result` | `text` | nullable | |
| `actual_result` | `text` | nullable | |
| `project_id` | `uuid` | FK → `project.id` ON DELETE CASCADE | |
| `reporter_id` | `text` | app FK → `auth.user.id` | |
| `assignee_id` | `text` | app FK → `auth.user.id`, nullable | Dev role |
| `qa_assignee_id` | `text` | app FK → `auth.user.id`, nullable | QA role |
| `test_case_id` | `uuid` | FK → `test_cases.id`, nullable | |
| `import_job_id` | `uuid` | FK → `import_jobs.id`, nullable | |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | default `now()` | |
| `closed_at` | `timestamptz` | nullable | |

**Unique constraint:** `(project_id, ticket_ref)` — replaces the old global `UNIQUE` on `ticket_ref` alone.

#### Fix #1 — Atomic ticket_ref generation

The old design marked `ticket_ref` globally unique with no generation mechanism — a race condition under concurrent inserts, and semantically wrong once multi-project ships (two projects should each be able to have their own `VRX-001`... except the prefix should differ per project too, so really `AAA-001`, `BBB-001`, etc.)

```typescript
// services/issue.service.ts
export async function createIssue(input: CreateIssueInput, projectId: string, reporterId: string) {
  return db.transaction(async (tx) => {
    // Atomically claim the next ticket number for this project
    const [project] = await tx
      .update(projectTable)
      .set({ nextTicketNumber: sql`${projectTable.nextTicketNumber} + 1` })
      .where(eq(projectTable.id, projectId))
      .returning({ nextTicketNumber: projectTable.nextTicketNumber, slug: projectTable.slug });

    const ticketRef = `${project.slug.slice(0, 3).toUpperCase()}-${String(project.nextTicketNumber).padStart(3, '0')}`;
    // e.g. VER-001, VER-002...

    const [issue] = await tx.insert(issues).values({
      ...input,
      projectId,
      reporterId,
      ticketRef,
      status: 'backlog',
    }).returning();

    await tx.insert(issueStatusHistory).values({
      issueId: issue.id,
      changedBy: reporterId,
      fromStatus: null,
      toStatus: 'backlog',
    });

    return issue;
  });
}
```

The `UPDATE ... RETURNING` inside a transaction is what makes this race-safe — Postgres row-locks the `project` row for the duration of the transaction, so two concurrent issue creations on the same project cannot claim the same number.

---

### 7. `issue_status_history`

Immutable. Never update or delete rows.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `issue_id` | `uuid` | FK → `issues.id` ON DELETE CASCADE | |
| `changed_by` | `text` | app FK → `auth.user.id` | |
| `from_status` | `issue_status` | nullable | |
| `to_status` | `issue_status` | NOT NULL | |
| `note` | `text` | nullable | |
| `source` | `change_source` | NOT NULL, default `web` | `web` \| `mcp` \| `import` — powers the MCP activity feed |
| `changed_at` | `timestamptz` | default `now()` | |

Added to support the MCP Connection page's "Recent agent activity" feed — without it, `changed_by` alone can't distinguish an agent-driven change from a manual web UI change made by the same user.

```typescript
export const changeSourceEnum = pgEnum('change_source', ['web', 'mcp', 'import']);
```

Set explicitly by whichever code path calls `updateStatus()` — the REST route handler passes `source: 'web'`, the MCP tool passes `source: 'mcp'`, the import worker passes `source: 'import'`. Never inferred after the fact.

---

### 8. `comments`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `issue_id` | `uuid` | FK → `issues.id` ON DELETE CASCADE |
| `author_id` | `text` | app FK → `auth.user.id` |
| `body` | `text` | NOT NULL |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |
| `deleted_at` | `timestamptz` | nullable |

---

### 9. `test_cases`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `title` | `text` | NOT NULL |
| `description` | `text` | nullable |
| `preconditions` | `text` | nullable |
| `steps` | `jsonb` | nullable — `[{ step, expected }]` |
| `expected_result` | `text` | nullable |
| `project_id` | `uuid` | FK → `project.id` |
| `created_by` | `text` | app FK → `auth.user.id` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

---

### 10. `tags`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `name` | `text` | NOT NULL |
| `color` | `text` | NOT NULL — accent/neutral only, never status colors |
| `project_id` | `uuid` | FK → `project.id` |
| `created_at` | `timestamptz` | default `now()` |

---

### 11. `issue_tags`

| Column | Type | Constraints |
|--------|------|-------------|
| `issue_id` | `uuid` | FK → `issues.id` ON DELETE CASCADE |
| `tag_id` | `uuid` | FK → `tags.id` ON DELETE CASCADE |

**Primary key:** `(issue_id, tag_id)`

---

### 12. `import_jobs`

`file_type` is now a proper enum (fix #12).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `filename` | `text` | NOT NULL | R2 storage key |
| `original_name` | `text` | NOT NULL | Shown in UI |
| `file_type` | `file_type` | NOT NULL | `xlsx` \| `csv` — was `text`, now enum |
| `status` | `import_status` | NOT NULL, default `pending` | |
| `total_rows` | `integer` | nullable | |
| `imported_rows` | `integer` | NOT NULL, default `0` | |
| `failed_rows` | `integer` | NOT NULL, default `0` | |
| `column_mapping` | `jsonb` | nullable | `{ "Bug Title": "title" }` |
| `color_mapping` | `jsonb` | nullable | `.xlsx` only — see backend spec §ExcelJS theme resolver |
| `error_log` | `jsonb` | nullable | `[{ row, error }]` |
| `project_id` | `uuid` | FK → `project.id` | |
| `created_by` | `text` | app FK → `auth.user.id` | |
| `created_at` | `timestamptz` | default `now()` | |
| `completed_at` | `timestamptz` | nullable | |

---

### 13. `api_tokens` — NEW (fix #2)

Enables MCP server authentication. Tokens are hashed at rest — plaintext is shown to the user exactly once, at creation time, and never stored or retrievable again.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `user_id` | `text` | app FK → `auth.user.id` | |
| `token_hash` | `text` | UNIQUE NOT NULL | SHA-256 hash of the token |
| `token_prefix` | `text` | NOT NULL | First 8 chars, shown in UI for identification (`vrx_a1b2...`) |
| `name` | `text` | NOT NULL | User-provided label, e.g. `"Claude Code - MacBook"` |
| `last_used_at` | `timestamptz` | nullable | Updated on each MCP request |
| `expires_at` | `timestamptz` | nullable | Null = no expiry |
| `revoked_at` | `timestamptz` | nullable | Soft revoke |
| `created_at` | `timestamptz` | default `now()` | |

```typescript
export const apiTokens = pgTable('api_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(), // FK → auth.user.id (app-level)
  tokenHash: text('token_hash').unique().notNull(),
  tokenPrefix: text('token_prefix').notNull(),
  name: text('name').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

Token generation pattern (service layer):

```typescript
import { randomBytes, createHash } from 'crypto';

export function generateApiToken() {
  const raw = `vrx_${randomBytes(24).toString('base64url')}`; // shown to user ONCE
  const hash = createHash('sha256').update(raw).digest('hex'); // stored
  const prefix = raw.slice(0, 12); // for display: "vrx_a1b2c3d4..."
  return { raw, hash, prefix };
}
```

MCP request auth middleware hashes the incoming bearer token and looks up `token_hash` — never compares plaintext.

---

## Indexes

```sql
-- Board view
CREATE INDEX idx_issues_project_status ON issues(project_id, status);
CREATE INDEX idx_issues_assignee ON issues(assignee_id);
CREATE INDEX idx_issues_qa_assignee ON issues(qa_assignee_id);

-- Ticket ref lookup (now composite, not global unique)
CREATE UNIQUE INDEX idx_issues_project_ticket_ref ON issues(project_id, ticket_ref);

-- Status history timeline
CREATE INDEX idx_status_history_issue ON issue_status_history(issue_id, changed_at);

-- MCP activity feed: recent agent-driven changes per user
CREATE INDEX idx_status_history_source ON issue_status_history(changed_by, source, changed_at DESC) WHERE source = 'mcp';

-- Active comments
CREATE INDEX idx_comments_issue ON comments(issue_id) WHERE deleted_at IS NULL;

-- Team / project membership lookups
CREATE INDEX idx_team_member_team ON team_member(team_id);
CREATE INDEX idx_team_member_user ON team_member(user_id);
CREATE INDEX idx_project_member_project ON project_member(project_id);
CREATE INDEX idx_project_member_user ON project_member(user_id);
CREATE INDEX idx_project_team ON project(team_id);

-- Invites
CREATE UNIQUE INDEX idx_invites_token_hash ON invites(token_hash);
CREATE INDEX idx_invites_team ON invites(team_id) WHERE accepted_at IS NULL;

-- API tokens — lookup by hash on every MCP request
CREATE UNIQUE INDEX idx_api_tokens_hash ON api_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_tokens_user ON api_tokens(user_id);
```

---

## ⚠️ Critical Gotchas (carried forward, unchanged)

### 1. Transaction Integrity on Status Updates
`issues.status` and `issue_status_history` must be written inside a single DB transaction. See `createIssue` and `updateStatus` patterns above — both follow this rule.

### 2. Neon Connection Pooling
Use the **pooled** connection string for Fastify runtime queries. Use the **unpooled/direct** connection string for `drizzle-kit` migrations and `pg-boss`. Full detail in the backend spec.

### 3. WebSocket Scaling Limit
In-memory broadcaster works on a single instance only. Upgrade path: Postgres `LISTEN/NOTIFY` via the pg-boss connection. Full detail in the backend spec.

---

## Key Design Decisions

### Why `ticket_ref` generation lives on `project`, not a separate sequence table
Postgres `SEQUENCE` objects are global and don't reset per project. A counter column on `project`, incremented inside the same transaction as the issue insert via `UPDATE ... RETURNING`, gives per-project numbering with zero risk of collision — the row lock on `project` during the UPDATE serializes concurrent ticket creation for that project without blocking other projects.

### Why `invites` and `api_tokens` are separate tables, not reused
`invites` grants team access via email + token, single-use, expiring. `api_tokens` grants API access via bearer token, long-lived, revocable, scoped to a user (not a team). Different lifecycle, different security model — conflating them would create either an over-privileged invite system or an under-featured token system.

### Why cross-schema FKs are documented but not DB-enforced
This is a deliberate tradeoff, not an oversight. Application-level enforcement keeps user IDs sourced from validated sessions and avoids coupling Veridex tables to Better Auth's user-deletion behavior. Drizzle remains the sole migration owner for both schemas.

---

## Monorepo Placement

```
veridex/
└── packages/
    ├── auth/
    │   └── src/index.ts        ← Better Auth config
    └── db/
        ├── schema/
        │   ├── team.ts
        │   ├── invites.ts       ← new
        │   ├── project.ts
        │   ├── issues.ts
        │   ├── history.ts
        │   ├── comments.ts
        │   ├── test-cases.ts
        │   ├── tags.ts
        │   ├── imports.ts
        │   └── api-tokens.ts    ← new
        ├── migrations/
        ├── drizzle.config.ts    ← uses DATABASE_URL_UNPOOLED
        └── index.ts
```

---

## Out of Scope (MVP)

| Table | Purpose |
|-------|---------|
| `notifications` | `user_id`, `issue_id`, `type`, `read_at` |
| `attachments` | Files on issues/comments → object storage |
| `workspace` | Parent of teams for multi-org support |
| `audit_log` | Append-only log for team/project admin actions |
