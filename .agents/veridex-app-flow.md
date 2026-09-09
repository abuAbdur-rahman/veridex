# Veridex — App Flow

> Version: v1.3 — profile screens use `/profile/settings` and `/profile/mcp`; legacy `/settings` routes redirect to the canonical profile paths.

---

## Contents

1. [Entity hierarchy](#entity-hierarchy)
2. [Auth flow](#auth-flow)
3. [Onboarding flow](#onboarding-flow)
4. [App flow](#app-flow)
5. [Invite flow](#invite-flow)
6. [Issue lifecycle](#issue-lifecycle)
7. [Import flow](#import-flow)
8. [API token flow](#api-token-flow)
9. [MCP surface & permission scoping](#mcp-surface--permission-scoping)
10. [Route map](#route-map)
11. [Resolved design decisions](#resolved-design-decisions)

---

## Entity Hierarchy

```
user (auth.user)
 └── team_member (team_role: owner | admin | member)
      └── team
           ├── invites (pending team invites, token-based)
           └── project
                └── project_member (role: dev | qa | tester | admin)
                     └── issue
                          ├── issue_status_history
                          ├── comments
                          └── test_case (linked)

user
 └── api_tokens (MCP authentication, independent of team/project)
```

Every user belongs to at least one team — their auto-provisioned personal team.
Every project belongs to exactly one team.
Every issue belongs to exactly one project.
A user's role is scoped per project via `project_member.role`, never global.

---

## Auth Flow

```
/login
  │
  ├── "Continue with Google" ──▶ Google OAuth consent
  │                                    │
  ├── "Continue with GitHub" ──▶ GitHub OAuth consent
  │                                    │
  └── "Continue as local test user" ──▶ POST /api/dev/test-session
        (browser on loopback; server requires development mode,
         DEV_AUTH_ENABLED=true, and a loopback HOST)
                                        │
                               ┌────────▼────────────────┐
                               │  Better Auth session     │
                               │  · OAuth callback, or     │
                               │    local test endpoint   │
                               │  · create/sign in user   │
                               │  · create session        │
                               │  · local endpoint also   │
                               │    completes onboarding  │
                               └────────┬─────────────────┘
                                       │
                              ┌────────▼──────────────────────┐
                              │  TanStack Router beforeLoad    │
                              │  (root route guard)            │
                              │                                │
                              │  if !session → /login          │
                              │  if !username → /onboarding    │
                              │  if !personal_team → /onboarding│
                              │  else → /dashboard             │
                              └────────────────────────────────┘
```

Guard reads from a pre-fetched TanStack Query cache entry (`['me']`), not a fresh fetch on every navigation:

```typescript
// apps/web/src/router.tsx
beforeLoad: async ({ context }) => {
  const me = await context.queryClient.ensureQueryData(meQueryOptions); // cached after first load
  if (!me.session) throw redirect({ to: '/login' });
  if (!me.user.username) throw redirect({ to: '/onboarding' });
  if (!me.user.hasPersonalTeam) throw redirect({ to: '/onboarding' });
}
```

---

## Onboarding Flow

> **Fix #5:** username confirmation and personal team provisioning are now a single atomic transaction. In the previous design, a failure between the two steps could leave a user permanently stuck — username set, but no personal team, and no way to retry cleanly.

```
/onboarding
  │
  └── Step 1 — Username (only step; provisioning is invisible + atomic)
        · input pre-filled from provider:
            GitHub  → profile.login
            Google  → email.split('@')[0], lowercased, sanitized
        · validation: ^[a-z0-9][a-z0-9_-]{2,29}$
        · uniqueness checked live via GET /api/users/check-username?q=
        · on confirm → POST /api/onboarding/complete { username }
```

Server-side, everything happens in one transaction:

```typescript
// services/onboarding.service.ts
export async function completeOnboarding(userId: string, username: string) {
  return db.transaction(async (tx) => {
    // 1. Set username on the Better Auth user row
    //    (app-level write — auth.user is a different schema, see cross-schema FK note)
    await auth.api.updateUser({ userId, data: { username } });

    // 2. Create personal team
    const [team] = await tx.insert(teamTable).values({
      name: username,
      slug: username,
      ownerId: userId,
      isPersonal: true,
    }).returning();

    // 3. Add user as team owner
    await tx.insert(teamMember).values({
      teamId: team.id,
      userId,
      teamRole: 'owner',
    });

    // 4. Create a default project under the personal team
    const [project] = await tx.insert(projectTable).values({
      teamId: team.id,
      name: 'My Project',
      slug: 'my-project',
      createdBy: userId,
    }).returning();

    // 5. Add user as project admin
    await tx.insert(projectMember).values({
      projectId: project.id,
      userId,
      role: 'admin',
    });

    return { team, project };
  });
  // If ANY step fails, username is NOT set — user retries /onboarding cleanly.
  // No partial state is ever visible to the router guard.
}
```

If step 1 (Better Auth update) succeeds but the Drizzle transaction later fails, the outer transaction cannot roll back the auth-schema write since it's a separate system. To close this gap fully: call `completeOnboarding` with the Drizzle transaction wrapping steps 2–5 only, and treat step 1 as the **last** write instead of the first — if steps 2–4 fail, no `username` is ever set on the user, so the guard correctly sends them back to `/onboarding` with a clean slate:

```typescript
export async function completeOnboarding(userId: string, username: string) {
  const { team, project } = await db.transaction(async (tx) => {
    const [team] = await tx.insert(teamTable).values({ name: username, slug: username, ownerId: userId, isPersonal: true }).returning();
    await tx.insert(teamMember).values({ teamId: team.id, userId, teamRole: 'owner' });
    const [project] = await tx.insert(projectTable).values({ teamId: team.id, name: 'My Project', slug: 'my-project', createdBy: userId }).returning();
    await tx.insert(projectMember).values({ projectId: project.id, userId, role: 'admin' });
    return { team, project };
  });

  // Username set LAST, only after team/project provisioning is confirmed committed
  await auth.api.updateUser({ userId, data: { username } });

  return { team, project };
}
```

This ordering guarantees: if the user has a `username`, they are guaranteed to have a personal team and default project. The router guard's two checks (`!username`, `!hasPersonalTeam`) become logically redundant in practice, but both stay in place as a defensive check.

---

## App Flow

```
/dashboard
  │
  ├── Team switcher (top nav)
  │     · lists all teams where user has a team_member row
  │     · personal team shown first, labeled with username
  │
  └── Project list (within selected team)
        · lists all projects where user has a project_member row
        · shows project name, open issue count, user's role on that project
        · [+ New Project] — only visible to team owner/admin
        │
        └── /projects/:projectId  (Project home)
              │
              · resolves project_member.role for this user + this project
              · role drives which views are shown
              │
              ├── Dev view    (role: dev)
              │     · Kanban board: Backlog → In Progress → In QA → Verified
              │     · filtered to: assigned to me + unassigned
              │     · drag card = PATCH issue status + broadcast ws event
              │
              ├── QA view     (role: qa)
              │     · triage list: issues awaiting verification (status: in_qa)
              │     · sorted by severity desc
              │     · quick-verify button → status → verified
              │
              ├── Tester view (role: tester)
              │     · report bug form → creates issue (status: backlog)
              │     · "needs retest" queue: issues returned in_qa → in_progress
              │
              ├── Admin view  (role: admin) — NEW, fix #7
              │     · view switcher: toggle between Dev / QA / Tester views
              │     │   (admin can see the board through any role's lens)
              │     · full unfiltered board — all issues regardless of assignment
              │     · access to Members tab (invite, role changes, removal)
              │     · access to Import tab
              │     · access to API Tokens tab (project-scoped tokens, see below)
              │
              ├── Members     (role: admin only)
              │     · project member list with roles
              │     · invite to project → project invite flow
              │     · change member role
              │     · remove member
              │
              └── Import      (role: admin | qa)
                    · upload .xlsx or .csv
                    → import flow (see below)
```

**Admin view resolution logic:** an admin's default landing view is the unfiltered full board. A view-switcher control (segmented button: Dev / QA / Tester / All) lets them see the board filtered as any role would see it — useful for reviewing what a specific teammate's day-to-day view looks like, without changing anyone's actual `project_member.role`.

---

## Invite Flow

> **Fix #3:** invite tokens are now persisted in the `invites` table (previously "not a separate table for MVP" — a gap that made server-side validation, expiry, and revocation impossible).

### Team invite

Grants access to the team's project directory. Does **not** grant access to any project's issues.

```
Admin/owner opens Team Settings → Members → [Invite]
  │
  ├── Enter email
  ├── POST /api/teams/:teamId/invites { email, teamRole }
  │     · generates random token
  │     · inserts invites row { token, teamId, invitedBy, email, teamRole, expiresAt: +7d }
  │     · returns shareable link: https://app.veridex.com/join/team/:token
  │       (MVP: link is copied/shared manually — no email delivery)
  │
  └── Invitee clicks link → /join/team/:token
        │
        · GET /api/invites/:token/validate
        │     · checks: exists, not expired, not already accepted
        │     · if invalid → show error page ("This invite has expired or was already used")
        │
        └── On accept → POST /api/invites/:token/accept
              · transaction:
                  - creates team_member { teamRole, invitedBy }
                  - sets invites.accepted_at = now()
              · redirects → /dashboard (team now visible in switcher)
```

### Project invite

Grants a scoped role on a specific project.

```
Admin opens Project → Members → [Invite to project]
  │
  ├── Enter username (must already be a team member)
  ├── Select role: dev | qa | tester | admin
  │     · role dropdown pre-fills with invitee's user.default_role (hint only)
  ├── POST /api/projects/:projectId/members { userId, role }
  │     · creates project_member { role, added_at } directly — no token needed,
  │       since the invitee is already a known team member
  │
  └── Invitee sees project in their project list immediately
```

> A user must be a team member before being invited to a project under that team. The team invite always comes first and requires persisted-token validation; the project invite is a direct membership grant between already-connected users.

---

## Issue Lifecycle

```
                    ┌──────────┐
                    │  Backlog  │ ← created here (tester files, import, MCP agent)
                    └────┬─────┘
                         │ dev picks up
                         ▼
                    ┌─────────────┐
                    │ In Progress  │ ← dev assigned, working on fix
                    └────┬────────┘
                         │ dev marks ready for QA
                         ▼
                    ┌────────┐
                    │ In QA   │ ← QA verifies the fix
                    └────┬───┘
              ┌──────────┴──────────┐
              │ pass                 │ fail
              ▼                      ▼
        ┌──────────┐         ┌─────────────┐
        │ Verified  │         │ In Progress  │ ← returned with note
        └──────────┘         └─────────────┘
```

Every transition writes both `issues.status` and an `issue_status_history` row atomically (see backend spec Critical Gotcha #1).

| From | Allowed next states |
|------|---------------------|
| `backlog` | `in_progress` |
| `in_progress` | `in_qa`, `backlog` |
| `in_qa` | `verified`, `in_progress`, `rejected` |
| `verified` | `in_qa` |
| `rejected` | `backlog` |

A QA-side rejection (`in_qa` -> `rejected`) marks the issue as not fixable / won't fix for now; `rejected` issues can be reopened to `backlog`. When a member without the dev role attempts a rejection on an issue they do not own, the service downgrades the transition target to `backlog` instead.

Every backward transition requires a note so progress is never erased without an audit explanation.

`ticket_ref` is generated atomically on creation, scoped per project (backend spec fix #1) — e.g. `VER-001`, `VER-002`, incrementing independently for each project.

---

## Import Flow

```
/projects/:projectId/import
  │
  ├── Upload step
  │     · .xlsx or .csv
  │     · POST /api/import/upload (multipart)
  │       → file → R2, import_jobs row (pending), pg-boss job enqueued
  │       → 202 { importJobId }
  │
  ├── Parse step (server, async)
  │     · .xlsx: ExcelJS parses + resolves fgColor (RGB or theme+tint) → color_mapping
  │     · .csv: Papa Parse — no color data, always falls through to manual mapping
  │     · broadcasts import:progress { stage: 'parsed', totalRows } over WebSocket
  │       (scoped to the project's WS room — see backend spec fix #8)
  │
  ├── Mapping step (user)
  │     · GET /api/import/:id/preview → { headers, sampleRows, colorMapping }
  │     · user maps columns → issue fields; overrides suggested color→status mapping
  │     · PATCH /api/import/:id/confirm { columnMapping, colorMapping }
  │
  └── Insert step (server, async)
        · inserts issues in batches of 25 — each insert uses the atomic
          ticket_ref generation pattern (same as manual issue creation)
        · broadcasts import:progress { imported, total } per batch
        · on finish → import_jobs status: completed
        · broadcasts import:completed { importedCount, failedCount }
```

---

## MCP Connection Flow

> Updated — token management is folded into `/profile/mcp`, which also surfaces connection config, per-project access, and agent activity.

```
/profile/mcp
  │
  ├── Connection config
  │     · displays the MCP endpoint URL (public, static: PUBLIC_MCP_URL env value)
  │     · generates a copyable client config JSON block using the endpoint
  │       + the most recently created token's raw value
  │     · config block is only ever populated in the same view as a freshly
  │       generated token — never reconstructable after the token is created
  │
  ├── Token list
  │     · GET /api/tokens
  │     · shows: name, token_prefix (vrx_a1b2...), last_used_at, created_at
  │     · [Revoke] → DELETE /api/tokens/:id
  │
  ├── [+ New Token]
  │     · user enters a label: "Claude Code - MacBook"
  │     · POST /api/tokens { name }
  │     · server generates token, hashes it, stores hash + prefix
  │     · raw token returned ONCE in the response body — shown in a modal:
  │       "Copy this now — you won't see it again"
  │     · config JSON block above updates to include this token
  │
  ├── Access summary
  │     · GET /api/mcp/access-summary
  │     · cross-references caller's project_member rows against the tool
  │       table → shows, per project: role, and how many of the 6 MCP
  │       tools that role unlocks
  │     · lets a user sanity-check "what could an agent using my token
  │       actually do" without reading the tool-permission table by hand
  │
  └── Recent agent activity
        · GET /api/mcp/activity
        · reads issue_status_history WHERE changed_by = me AND source = 'mcp'
        · shows: ticket_ref, title, status transition, relative timestamp
        · empty state: "No agent activity yet. Connect a client above to
          get started." — distinct from a generic empty state, since a
          user landing here with zero tokens should see the connect flow
          as the obvious next step, not just an empty list
```

Tokens are user-scoped, not project-scoped — an agent authenticated with a user's token can act on any project that user is a `project_member` of, subject to the role check on each tool call. This is exactly what the access summary section makes visible before the user ever has to trust it blindly.

### `source` tracking

Every status change now carries a `source: 'web' | 'mcp' | 'import'` (schema v0.5). This is what makes the activity feed possible — `changed_by` alone can't tell you whether a user moved a card by hand or an agent did it on their behalf using their token. `source` is set explicitly at each call site in the backend (REST route, MCP tool, import worker) and is never inferred after the fact.

---

## MCP Surface & Permission Scoping

```
External AI agent (e.g. Claude Code in a terminal)
  │
  ├── Authenticates via Authorization: Bearer <api_token>
  │
  ├── Calls tool: change_status { issueId: "VER-042", toStatus: "in_qa" }
  │
  └── Server:
        · hashes token, resolves to userId (api_tokens lookup)
        · resolves issue → project_id
        · looks up project_member { userId, projectId }
        · checks role in ['dev', 'qa', 'admin']
        · if unauthorized → standard error shape { error: { code: 'FORBIDDEN', ... } }
        · if authorized → issueService.updateStatus(..., source: 'mcp')
                        → issue_status_history row records source: 'mcp'
                        → broadcasts issue:status_changed to the project's WS room
                        → board updates live for all connected users
                        → appears in the caller's /profile/mcp activity feed
```

An agent with a token belonging to a user who is only a member of project A cannot touch issues in project B — even if that user is the owner of the team both projects belong to. Team ownership does not imply project membership.

### Tool reference (MVP)

| Tool | Description | Min role |
|------|-------------|----------|
| `list_issues` | List issues with filters | tester |
| `get_issue` | Full detail + status history | tester |
| `create_issue` | Create new issue | tester |
| `update_issue` | Update fields | dev |
| `change_status` | Transition status | dev |
| `assign_issue` | Set assignee/qa_assignee | qa, admin |

---

## Route Map

### Public routes (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Landing page |
| `GET` | `/login` | Login page (OAuth plus loopback-only local test login when enabled) |
| `GET` | `/api/auth/*` | Better Auth (mounted via toNodeHandler) |
| `GET` | `/join/team/:token` | Team invite acceptance page |

### Protected routes (session required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/onboarding` | Username input (provisioning is atomic + invisible) |
| `GET` | `/dashboard` | Team switcher + project list |
| `GET` | `/projects/:projectId` | Project home (role-aware; admin gets view switcher) |
| `GET` | `/projects/:projectId/issues/:issueId` | Issue detail |
| `GET` | `/projects/:projectId/import` | Import flow |
| `GET` | `/projects/:projectId/members` | Member management (admin) |
| `GET` | `/teams/:teamId/settings` | Team members + pending invites (team admin/owner) — closes prior gap between this flow and the route map |
| `GET` | `/profile/settings` | User settings (username, default_role) |
| `GET` | `/profile/mcp` | MCP connection, tokens, access summary, agent activity |

### API routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/dev/test-session` | none; development + flag + loopback host | Create/sign in the fixed local test user, provision onboarding, and set Better Auth cookies; route absent otherwise |
| `GET` | `/api/me` | session | Current user + teams (cached in TanStack Query) |
| `POST` | `/api/onboarding/complete` | session | Atomic username + team + project provisioning |
| `GET` | `/api/users/check-username` | session | Live username availability |
| `GET` | `/api/teams` | session | All teams for current user |
| `POST` | `/api/teams` | session | Create team |
| `GET` | `/api/teams/:teamId/members` | team member | List team members |
| `POST` | `/api/teams/:teamId/invites` | team admin | Create invite → persisted token |
| `GET` | `/api/invites/:token/validate` | none | Validate token before showing accept UI |
| `POST` | `/api/invites/:token/accept` | session | Accept invite → creates team_member |
| `GET` | `/api/teams/:teamId/projects` | team member | List projects |
| `POST` | `/api/teams/:teamId/projects` | team admin | Create project |
| `GET` | `/api/projects/:projectId` | project member | Project detail |
| `GET` | `/api/projects/:projectId/members` | project member | List project members |
| `POST` | `/api/projects/:projectId/members` | project admin | Add project member |
| `PATCH` | `/api/projects/:projectId/members/:userId` | project admin | Change role |
| `DELETE` | `/api/projects/:projectId/members/:userId` | project admin | Remove member |
| `GET` | `/api/projects/:projectId/issues` | project member | List issues (filters) |
| `POST` | `/api/projects/:projectId/issues` | tester+ | Create issue (atomic ticket_ref) |
| `GET` | `/api/projects/:projectId/issues/:issueId` | project member | Issue detail |
| `PATCH` | `/api/projects/:projectId/issues/:issueId` | dev+ | Update issue fields |
| `PATCH` | `/api/projects/:projectId/issues/:issueId/status` | dev+ | Status transition |
| `GET` | `/api/projects/:projectId/issues/:issueId/history` | project member | Status history |
| `POST` | `/api/projects/:projectId/issues/:issueId/comments` | project member | Add comment |
| `POST` | `/api/import/upload` | qa, admin | Upload spreadsheet |
| `GET` | `/api/import/:id/preview` | qa, admin | Column + color mapping preview |
| `PATCH` | `/api/import/:id/confirm` | qa, admin | Confirm mapping, start insert |
| `GET` | `/api/import/:id/errors` | qa, admin | Failed rows after import |
| `GET` | `/api/tokens` | session | List own API tokens |
| `POST` | `/api/tokens` | session | Generate new token (shown once) |
| `DELETE` | `/api/tokens/:id` | session | Revoke token |
| `GET` | `/api/mcp/access-summary` | session | Per-project role + available tool count for `/profile/mcp` |
| `GET` | `/api/mcp/activity` | session | Recent `source: 'mcp'` status changes for `/profile/mcp` |
| `GET` | `/ws?projectId=` | session + project member | WebSocket upgrade, scoped to project |
| `POST` | `/mcp` | api_token bearer | MCP tool invocation |
| `GET` | `/mcp/sse` | api_token bearer | MCP SSE stream |
| `GET` | `/health` | none | Health check |

---

## Resolved Design Decisions

| Decision | Resolution | Rationale |
|----------|------------|-----------|
| `user.role` kept or dropped? | Kept as `user.default_role` (nullable hint only) | Pre-fills role dropdown on project invite. Never used for auth. |
| `is_personal` on team? | Yes — included | Hides personal team from invite UIs and discovery |
| One or two invite flows? | Two (team + project) | Team invite ≠ project access; different security models |
| Personal team: explicit or implicit? | Auto-provisioned atomically in onboarding | Username is set last — guarantees no partial state is ever visible |
| Role scoping | `project_member.role` only | A person can be QA on one project, dev on another |
| MCP auth scoping | `api_tokens` → resolves user → `project_member.role` per call | Agent on project A cannot touch project B, even via team-owner's token |
| Admin's default view | Full unfiltered board + view switcher | Admin needs oversight, not just one role's lens |
| Team invite persistence | `invites` table, 7-day expiry, single-use | Enables server-side validation, expiry, revocation |
