# Veridex — App Pages & Screens

> Version: v1.1 — `/settings/tokens` replaced by `/settings/mcp` (full MCP Connection screen: config, tokens, access summary, agent activity). Mapped to app-flow.md v1.2, db-schema.md v0.5, backend-spec.md v1.4, DESIGN.md v1.0.

---

## How to read this document

Each screen entry follows the same shape:

- **Route** — TanStack Router path
- **Access** — who can reach it (role/auth requirement)
- **Layout** — structural composition
- **Data** — which API calls populate it, which tables it reads/writes
- **Real-time** — which WebSocket events affect it live
- **Key components** — DESIGN.md component references
- **Empty/loading/error states** — what each looks like

---

## Contents

1. [Public screens](#public-screens)
2. [Auth & onboarding](#auth--onboarding)
3. [Dashboard](#dashboard)
4. [Project home — role views](#project-home--role-views)
5. [Issue detail](#issue-detail)
6. [Import flow](#import-flow-screens)
7. [Member management](#member-management)
8. [Settings](#settings)
9. [Shared UI shell](#shared-ui-shell)
10. [Screen inventory table](#screen-inventory-table)

---

## Public Screens

### 1. Landing page

**Route:** `/`
**Access:** Public
**Layout:** Existing `veridex.html` — hero, problem/solution table, feature list, MCP callout, spreadsheet→ticket animation. No changes needed; already built.
**Data:** None (static marketing content)
**Real-time:** None

---

### 2. Login

**Route:** `/login`
**Access:** Public (redirects to `/dashboard` if session exists)
**Layout:**
```
┌───────────────────────────────┐
│         [Veridex logo]         │
│                                 │
│   Track bugs like it's not     │
│         1997.                  │
│                                 │
│  [ 🔵 Continue with Google ]   │
│  [ ⚫ Continue with GitHub ]   │
│                                 │
│   No password. No spreadsheet. │
└───────────────────────────────┘
```
**Data:** None until OAuth redirect — buttons link directly to `/api/auth/sign-in/google` and `/api/auth/sign-in/github`
**Real-time:** None
**Key components:** Two OAuth buttons only — no email/password fields exist anywhere in the app per the OAuth-only decision
**Error state:** If OAuth callback fails, redirect back here with a toast: "Sign-in failed. Please try again."

---

### 3. Team invite acceptance

**Route:** `/join/team/:token`
**Access:** Public entry point; requires session to actually accept (redirects to `/login?redirect=/join/team/:token` if not authenticated)
**Layout:**
```
┌───────────────────────────────┐
│   You've been invited to join  │
│         "Acme QA Team"         │
│                                 │
│   Invited by sarah@acme.com    │
│                                 │
│      [ Accept Invite ]         │
│      [ Decline ]               │
└───────────────────────────────┘
```
**Data:**
- `GET /api/invites/:token/validate` on load — checks exists/not-expired/not-accepted
- `POST /api/invites/:token/accept` on accept click
**Real-time:** None
**Error states:**
- Expired: "This invite has expired. Ask the team admin to send a new one."
- Already accepted: "This invite has already been used."
- Invalid token: "This invite link isn't valid."

---

## Auth & Onboarding

### 4. Onboarding — username

**Route:** `/onboarding`
**Access:** Authenticated, `username IS NULL`
**Layout:**
```
┌───────────────────────────────┐
│      Welcome to Veridex        │
│                                 │
│   Choose your username         │
│   ┌───────────────────────┐   │
│   │ sarahchen              │   │  ← pre-filled from provider
│   └───────────────────────┘   │
│   ✓ Available                  │  ← live check
│                                 │
│         [ Continue ]           │
└───────────────────────────────┘
```
**Data:**
- `GET /api/users/check-username?q=` — debounced live validation as user types
- `POST /api/onboarding/complete { username }` on submit — atomic team/project provisioning happens server-side, invisible to this screen
**Real-time:** None
**Key components:** Single form input with inline validation state (checkmark/error icon), `--accent` focus ring
**Error state:** Username taken → red inline message "That username is taken" below field, submit disabled until resolved

---

## Dashboard

### 5. Dashboard — team switcher + project list

**Route:** `/dashboard`
**Access:** Authenticated, onboarded
**Layout:**
```
┌──────────────────────────────────────────────┐
│ [Veridex]     [Team: sarahchen ▾]    [👤 ▾]   │  ← top nav, team switcher
├──────────────────────────────────────────────┤
│  Your Projects                  [+ New Project]│  ← only if team admin/owner
│                                                  │
│  ┌────────────────┐  ┌────────────────┐       │
│  │ My Project       │  │ Acme QA         │       │
│  │ 🟢 admin          │  │ 🔵 dev          │       │
│  │ 12 open issues    │  │ 34 open issues  │       │
│  └────────────────┘  └────────────────┘       │
└──────────────────────────────────────────────┘
```
**Data:**
- `GET /api/me` — cached, drives team switcher (all teams user belongs to)
- `GET /api/teams/:teamId/projects` — projects under the selected team, each annotated with the caller's `project_member.role`
- Open issue count: aggregated server-side (`COUNT(*) WHERE status != 'closed'`)
**Real-time:** None on this screen — project list doesn't need live updates
**Key components:** Project card (border, no shadow, per DESIGN.md), role badge using status-pill styling repurposed for role display
**Empty state:** New user with only their auto-provisioned personal team and default project sees exactly one card — never a blank dashboard
**Loading state:** Skeleton cards (2-3 pulsing placeholders)

---

## Project Home — Role Views

### 6. Dev view — Kanban board

**Route:** `/projects/:projectId` (default view when `role = dev`)
**Access:** `project_member.role IN ('dev', 'admin')`
**Layout:**
```
┌────────────────────────────────────────────────────┐
│ ← Acme QA        [Dev|QA|Tester|All ▾ admin-only]   │
├────────────────────────────────────────────────────┤
│  Backlog    In Progress    In QA    Verified         │
│  ┌──────┐   ┌──────┐       ┌──────┐  ┌──────┐       │
│  │ card  │   │ card  │       │ card  │  │ card  │       │
│  │ card  │   │       │       │ card  │  │       │       │
│  └──────┘   └──────┘       └──────┘  └──────┘       │
└────────────────────────────────────────────────────┘
```
Filtered to: issues where `assignee_id = currentUser` OR `assignee_id IS NULL`.
**Data:**
- `GET /api/projects/:projectId/issues?assignee=me,unassigned` — initial load
- `PATCH /api/projects/:projectId/issues/:issueId/status` — on card drop
**Real-time:**
- `GET /ws?projectId=` connection opens on mount, closes on unmount
- `issue:status_changed` → move card between columns, apply remote-update flash (DESIGN.md motion)
- `issue:created` → insert new card if it matches the current filter
- `issue:assigned` → card appears/disappears if assignee changed to/from current user
**Key components:** Kanban card, Kanban column, drag-and-drop via `@dnd-kit`
**Empty state:** Per-column empty message when a column has zero cards: "Nothing here" (small, muted, centered in column)
**Loading state:** Skeleton columns with pulsing card placeholders

---

### 7. QA view — triage list

**Route:** `/projects/:projectId` (default view when `role = qa`)
**Access:** `project_member.role IN ('qa', 'admin')`
**Layout:**
```
┌────────────────────────────────────────────────────┐
│ ← Acme QA                          Awaiting QA (7)   │
├────────────────────────────────────────────────────┤
│  🔴 VER-042  Login button unresponsive    [Verify ▾]│
│  🟠 VER-039  Search filter resets           [Verify ▾]│
│  🟡 VER-031  Typo in footer                 [Verify ▾]│
└────────────────────────────────────────────────────┘
```
List, not board — sorted by severity descending. This is a triage queue, not a spatial layout.
**Data:**
- `GET /api/projects/:projectId/issues?status=in_qa&sort=severity_desc`
- `PATCH /api/projects/:projectId/issues/:issueId/status { status: 'verified' }` — quick-verify action
- `PATCH .../status { status: 'in_progress', note }` — quick-reject with required note field
**Real-time:**
- `issue:status_changed` where `to_status = 'in_qa'` → row appears with insert animation
- Row disappears (fade out, 250ms) when status changes away from `in_qa` — either by this user's own action or another QA teammate's
**Key components:** Table row (per DESIGN.md table styling), severity badge, inline action dropdown
**Empty state:** "Nothing awaiting verification. Nice work." — positive framing, not a generic "no data" message

---

### 8. Tester view — report + retest queue

**Route:** `/projects/:projectId` (default view when `role = tester`)
**Access:** `project_member.role IN ('tester', 'admin')`
**Layout:**
```
┌────────────────────────────────────────────────────┐
│ ← Acme QA          [+ Report Issue]                  │
├────────────────────────────────────────────────────┤
│  Needs Retest (2)                                    │
│  🔴 VER-039  Search filter resets  ← sent back by QA │
│                                                        │
│  Your Recent Reports (5)                              │
│  VER-042  In Progress                                 │
│  VER-041  Backlog                                     │
└────────────────────────────────────────────────────┘
```
Two sections: issues bounced back from QA (`in_qa → in_progress` transitions where this tester is watching), and a lightweight history of what this tester has personally filed.
**Data:**
- `GET /api/projects/:projectId/issues?needs_retest=true`
- `GET /api/projects/:projectId/issues?reporter=me&sort=created_desc&limit=10`
- `POST /api/projects/:projectId/issues` — report issue form submission
**Real-time:** `issue:status_changed` where `from_status = 'in_qa' AND to_status = 'in_progress'` → adds to "Needs Retest" section live
**Key components:** Report Issue button opens a modal (see screen 9), simple list rows

---

### 9. Report Issue modal

**Route:** Modal overlay, not a route — opened from Tester view, Dev view, or MCP-parity manual entry point
**Access:** `project_member.role IN ('tester', 'qa', 'admin')`
**Layout:**
```
┌───────────────────────────────────┐
│  Report an Issue              [×]  │
├───────────────────────────────────┤
│  Title *                           │
│  [___________________________]    │
│                                     │
│  Severity          Environment     │
│  [Medium ▾]         [Chrome/mac▾] │
│                                     │
│  Steps to reproduce                │
│  [___________________________]    │
│  [___________________________]    │
│                                     │
│  Link test case (optional)         │
│  [Search test cases... ▾]         │
│                                     │
│         [Cancel]  [Create Issue]   │
└───────────────────────────────────┘
```
**Data:** `POST /api/projects/:projectId/issues` — server generates `ticket_ref` atomically (backend spec fix #1)
**Real-time:** On success, `issue:created` broadcasts to all connected clients in the project — the reporter's own board updates via the WS event, not a local optimistic-only insert, keeping single source of truth
**Key components:** Form input, select dropdowns, textarea — all per DESIGN.md form input spec
**Validation:** Title required; severity defaults to `medium`; everything else optional per schema

---

### 10. Admin view — full board + view switcher

**Route:** `/projects/:projectId` (default view when `role = admin`)
**Access:** `project_member.role = 'admin'`
**Layout:** Same Kanban board as Dev view, but:
- Unfiltered — shows all issues regardless of assignee
- View-switcher control in the header: segmented buttons `[Dev | QA | Tester | All]` — lets admin preview the board through any role's lens without changing anyone's actual `project_member.role`
- Additional nav tabs visible only to admin: **Members**, **Import**, **API Tokens**

```
┌────────────────────────────────────────────────────┐
│ ← Acme QA   Board  Members  Import      [Dev|QA|Tester|All]│
├────────────────────────────────────────────────────┤
│  Backlog    In Progress    In QA    Verified         │
│  (all issues, every column, unfiltered)               │
└────────────────────────────────────────────────────┘
```
**Data:** `GET /api/projects/:projectId/issues` — no filter params when view switcher is on "All"; adds `?assignee=me` etc. when switched to a specific role lens
**Real-time:** All `issue:*` events apply, unfiltered
**Key components:** Segmented control (new pattern — 4-way toggle, `accent` background on active segment)

---

## Issue Detail

### 11. Issue detail panel

**Route:** `/projects/:projectId/issues/:issueId`
**Access:** Any `project_member` of the project
**Layout:** Side panel (slides in from right, doesn't navigate away from the board) on desktop; full-screen on mobile.
```
┌─────────────────────────────────┐
│ VER-042                    [×]   │  ← ticket_ref, mono
│ Login button unresponsive on     │  ← title, Inter, editable inline (dev+)
│ mobile Safari                    │
│                                   │
│ [In Progress ▾]  [🔴 High]       │  ← status dropdown + severity badge
│                                   │
│ Assignee: 👤 Dev Name            │
│ QA: 👤 QA Name                   │
│                                   │
│ ── Description ──                │
│ Free text description...          │
│                                   │
│ ── Environment ──                │
│ Chrome 128 · macOS 14 · Desktop  │
│                                   │
│ ── Steps to Reproduce ──          │
│ 1. Open login page                │
│ 2. Tap the submit button          │
│                                   │
│ ── Linked Test Case ──            │
│ 🧪 TC-014: Login flow smoke test  │
│                                   │
│ ── Status History ──   [History icon]│
│ ● backlog → in_progress            │
│   by Dev Name · 2 days ago         │
│ ● in_progress → in_qa              │
│   by Dev Name · 1 day ago          │
│ ● in_qa → in_progress              │
│   by QA Name · 6 hours ago         │
│   "Still reproduces on Safari 17"  │
│                                   │
│ ── Comments (3) ──                │
│ [comment thread]                  │
│ [+ Add comment]                   │
└─────────────────────────────────┘
```
**Data:**
- `GET /api/projects/:projectId/issues/:issueId` — full detail
- `GET /api/projects/:projectId/issues/:issueId/history` — status history timeline
- `PATCH /api/projects/:projectId/issues/:issueId` — field edits (dev+)
- `PATCH .../status` — status transitions, respects the valid-transition table from app-flow.md
- `POST .../comments` — new comment
**Real-time:**
- Panel subscribes to this specific `issueId` within the already-open project WS connection
- `issue:updated`, `issue:status_changed`, `comment:created` (if another user comments while panel is open) all update the panel live
**Key components:** Status pill dropdown (only shows valid next-states per the transition table — invalid transitions aren't even selectable, not just rejected server-side), status history timeline (vertical line + dot per entry, mono timestamps), comment thread
**Empty state:** No comments yet → "No comments yet. Start the conversation." above the comment box

---

## Import Flow Screens

### 12. Import — upload step

**Route:** `/projects/:projectId/import`
**Access:** `project_member.role IN ('qa', 'admin')`
**Layout:**
```
┌───────────────────────────────────┐
│  Import Issues                      │
│                                      │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │                                 │  │
│  │     Drop your .xlsx or .csv     │  │
│  │         file here                │  │
│  │                                 │  │
│  │      or [Browse files]          │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                      │
│  Supports Excel row-color status    │
│  detection and CSV column mapping   │
└───────────────────────────────────┘
```
**Data:** `POST /api/import/upload` (multipart) → returns `{ importJobId }`, navigates to preview screen
**Real-time:** None yet — connection opens once parsing begins
**Key components:** Drag-and-drop zone with dashed border (`--line`, becomes `--accent` dashed on drag-over), matching the `.card-drop-zone-active` pattern from DESIGN.md

---

### 13. Import — parsing progress

**Route:** Same URL, different state — `/projects/:projectId/import` (job in `processing`)
**Layout:**
```
┌───────────────────────────────────┐
│  Parsing issues_master_FINAL_v3.xlsx │
│                                      │
│  ████████████░░░░░░░░  62 / 100     │  ← determinate, not fake spinner
│                                      │
│  Detecting row colors...            │
└───────────────────────────────────┘
```
**Data:** No polling — driven entirely by `import:progress` WebSocket events
**Real-time:** `import:progress { stage: 'parsed', totalRows }` → progress bar appears; subsequent `import:progress { imported, total }` events during the later insert step update the same bar

---

### 14. Import — column mapping preview

**Route:** Same URL — `/projects/:projectId/import` (job ready for confirmation)
**Layout:**
```
┌─────────────────────────────────────────────┐
│  Map your columns                              │
│                                                  │
│  Spreadsheet column      →   Veridex field      │
│  "Issue description"     →   [Title ▾]          │
│  "Severity"               →   [Severity ▾]      │
│  "Category"                →   [Tags ▾]         │
│  "Device"                   →   [Environment.device ▾]│
│                                                  │
│  ── Detected row colors ──                       │
│  🟠 Orange (43 rows)   →  [In Progress ▾]        │
│  🟡 Yellow (12 rows)   →  [In QA ▾]              │
│  🟢 Green (8 rows)     →  [Verified ▾]           │
│  ⚪ No fill (2 rows)    →  [Backlog ▾]            │
│                                                  │
│         [Cancel]      [Confirm & Import]        │
└─────────────────────────────────────────────┘
```
**Data:**
- `GET /api/import/:id/preview` — returns headers, sample rows, and `color_mapping` suggestions (from the theme-color resolver in backend spec fix #6)
- `PATCH /api/import/:id/confirm { columnMapping, colorMapping }`
**Key components:** Color swatch chips matching resolved hex values, dropdown per row for user override — this screen is where automatic detection becomes user-confirmed, never silently trusted
**CSV-specific state:** No color section rendered at all for `.csv` uploads — instead a single "Default status for all imported issues" dropdown, since CSV carries no color data

---

### 15. Import — completion summary

**Route:** Same URL — job `completed`
**Layout:**
```
┌───────────────────────────────────┐
│  ✓ Import complete                  │
│                                      │
│  73 issues imported                 │
│  2 rows failed  [View errors]       │
│                                      │
│         [ View Board ]              │
└───────────────────────────────────┘
```
**Data:** `GET /api/import/:id/errors` if the user clicks "View errors" — shows row number + error message per failed row
**Real-time:** `import:completed { importedCount, failedCount }` triggers this screen state

---

## Member Management

### 16. Project members

**Route:** `/projects/:projectId/members`
**Access:** `project_member.role = 'admin'`
**Layout:**
```
┌──────────────────────────────────────────┐
│  Members                  [+ Invite]        │
│                                              │
│  👤 sarahchen         [Admin ▾]     [Remove]│
│  👤 devuser           [Dev ▾]       [Remove]│
│  👤 qauser             [QA ▾]        [Remove]│
└──────────────────────────────────────────┘
```
**Data:**
- `GET /api/projects/:projectId/members`
- `PATCH /api/projects/:projectId/members/:userId { role }` — role change
- `DELETE /api/projects/:projectId/members/:userId`
**Invite sub-flow:** Clicking `[+ Invite]` opens a modal requiring the invitee to already be a team member (per app-flow.md — project invite requires prior team membership) — if they're not yet on the team, the modal surfaces a link to the Team Members screen instead of allowing a direct project invite
**Key components:** Table row, inline role-select dropdown, destructive-styled remove button (`block` color on hover)

---

### 17. Team members + invites

**Route:** Accessible via team switcher → "Manage Team" (not in the original route map — implied by the invite flow; added here as `/teams/:teamId/settings`)
**Access:** `team_member.team_role IN ('owner', 'admin')`
**Layout:**
```
┌──────────────────────────────────────────┐
│  Team: Acme QA                              │
│                                              │
│  Members                                     │
│  👤 sarahchen (owner)                        │
│  👤 devuser (member)                          │
│                                              │
│  Pending Invites                             │
│  dana@acme.com — expires in 5 days [Revoke]  │
│                                              │
│  [+ Invite by email]                         │
└──────────────────────────────────────────┘
```
**Data:**
- `GET /api/teams/:teamId/members`
- `POST /api/teams/:teamId/invites { email, teamRole }` → shows shareable link in a copyable field, since MVP has no email delivery
- Pending invites list: `invites WHERE team_id = ? AND accepted_at IS NULL AND expires_at > now()`
**Key components:** Copyable link field (input + "Copy" button, matches form input styling with a trailing icon button)

---

## Settings

### 18. User settings

**Route:** `/settings`
**Access:** Any authenticated user
**Layout:**
```
┌───────────────────────────────┐
│  Settings                       │
│                                   │
│  Username                        │
│  [sarahchen___________]          │
│                                   │
│  Default role (invite hint)      │
│  [Dev ▾]                          │
│                                   │
│  Theme                            │
│  [ ☀ Light | 🌙 Dark ]            │
│                                   │
│         [Save Changes]           │
└───────────────────────────────┘
```
**Data:** `PATCH /api/me { username?, default_role? }`
**Note:** `default_role` is explicitly labeled "invite hint" in the UI copy itself — reinforcing the schema decision that this field never drives authorization

---

### 19. MCP Connection

**Route:** `/settings/mcp`
**Access:** Any authenticated user. User-scoped (tokens belong to the user, not a project), but the screen surfaces per-project access since that's how MCP permissions actually resolve at call time.
**Layout:**
```
┌────────────────────────────────────────────────┐
│  MCP Connection                                   │
│                                                     │
│  ── Connect an agent ──                            │
│  Endpoint                                          │
│  https://api.veridex.app/mcp            [Copy]     │
│                                                     │
│  Claude Code config                    [Copy JSON] │
│  ┌─────────────────────────────────────────┐     │
│  │ {                                          │     │
│  │   "mcpServers": {                          │     │
│  │     "veridex": {                            │     │
│  │       "url": "https://api.veridex.app/mcp",│     │
│  │       "headers": {                          │     │
│  │         "Authorization": "Bearer vrx_***"   │     │
│  │       }                                      │     │
│  │     }                                        │     │
│  │   }                                          │     │
│  │ }                                            │     │
│  └─────────────────────────────────────────┘     │
│                                                     │
│  ── Your tokens ──                    [+ New]      │
│  🔑 Claude Code - MacBook                          │
│     Last used 2 hours ago            [Revoke]      │
│                                                     │
│  ── What this agent can access ──                  │
│  Project          Your role      Tools available   │
│  Acme QA           dev            5 of 6 tools      │
│  My Project        admin          6 of 6 tools      │
│                                                     │
│  ── Available tools ──                             │
│  list_issues        tester+   read                 │
│  get_issue           tester+   read                 │
│  create_issue         tester+   write               │
│  update_issue         dev+     write               │
│  change_status         dev+     write               │
│  assign_issue           qa+     write               │
│                                                     │
│  ── Recent agent activity ──                       │
│  🤖 VER-042 status → in_qa        3 min ago         │
│  🤖 VER-038 created                  1 hour ago     │
└────────────────────────────────────────────────┘
```

**New token modal** (unchanged from prior design — triggered by `[+ New]`):
```
┌───────────────────────────────────┐
│  New API Token                       │
│                                        │
│  Name                                 │
│  [Claude Code - MacBook_______]       │
│                                        │
│         [Cancel]  [Generate]          │
├───────────────────────────────────┤
│  ⚠ Copy this now — you won't see it   │
│    again                              │
│                                        │
│  vrx_a1b2c3d4e5f6...          [Copy]  │
│                                        │
│              [Done]                   │
└───────────────────────────────────┘
```
On generation, the connection config block above updates in place to embed this token — the config JSON and the raw token are only ever visible together, in this one moment. Neither is reconstructable after the user leaves this view; a lost token means generating a new one.

**Data:**
- `GET /api/tokens` — token list
- `POST /api/tokens { name }` — raw token returned once in response body, never persisted in plaintext, never retrievable again
- `DELETE /api/tokens/:id`
- `GET /api/mcp/access-summary` — powers the "What this agent can access" table; derived server-side from `project_member` rows cross-referenced against the tool-permission table
- `GET /api/mcp/activity` — powers "Recent agent activity"; reads `issue_status_history WHERE changed_by = me AND source = 'mcp'` (schema v0.5 addition — see [Cross-Reference Note](#cross-reference-note))

**Real-time:** None — this is a settings/review screen, not a live board. Activity feed refreshes on navigation, not via WebSocket.

**Key components:**
- Copyable code block (monospace, `bg-alt` background, copy icon button — same pattern as the invite link field on Team Members)
- Warning banner in new-token modal uses `pending-bg`/`pending` (caution, not error — `block` is reserved for actual failures)
- Access summary table reuses the standard table row pattern from DESIGN.md
- Activity feed row: 🤖 icon prefix (visually distinct from the 👤 avatar used for human-driven activity elsewhere in the app — reinforces that this action didn't come from a person at a keyboard)

**Empty states:**
- Zero tokens: connection config section shows a placeholder ("Generate a token below to see your config") instead of a broken/empty JSON block
- Zero agent activity: "No agent activity yet. Connect a client above to get started." — directs attention to the connect flow rather than reading as a dead end

---

## Shared UI Shell

### Top navigation

Present on every authenticated route. Contains:
- Veridex logo (links to `/dashboard`)
- Team switcher dropdown (all teams from `GET /api/me`)
- Project breadcrumb when inside a project (`Acme QA / Board`)
- User menu (avatar → Settings, MCP Connection, Sign Out)
- Theme toggle (matches the existing `.switch` component from `veridex-spec.html` — same visual treatment carried into the app)

### Notification/toast layer

Global, mounted once at the app root. Any mutation response or WebSocket event can trigger a toast:
- `issue:created` (from someone else) → subtle toast: "New issue reported: VER-043"
- Import completion → success toast
- Session expiry (WS `auth:expired` event) → redirect to `/login` with toast: "Your session expired. Please sign in again."

### Command palette (stretch, not MVP-blocking)

`Cmd+K` — quick jump to any issue by `ticket_ref`, switch projects, or trigger "Report Issue." Not required for MVP but the Mono/structured-data-first design language (ticket refs, timestamps) makes Veridex a natural fit for this pattern later.

---

## Screen Inventory Table

Full flat list for engineering ticket creation — one row per screen, cross-referenced to route, role, and primary API.

| # | Screen | Route | Min role | Primary API |
|---|--------|-------|----------|--------------|
| 1 | Landing | `/` | Public | — |
| 2 | Login | `/login` | Public | `/api/auth/sign-in/*` |
| 3 | Invite accept | `/join/team/:token` | Public→session | `/api/invites/:token/*` |
| 4 | Onboarding | `/onboarding` | Session | `/api/onboarding/complete` |
| 5 | Dashboard | `/dashboard` | Session | `/api/teams`, `/api/teams/:id/projects` |
| 6 | Dev board | `/projects/:id` | dev | `/api/projects/:id/issues` |
| 7 | QA triage | `/projects/:id` | qa | `/api/projects/:id/issues?status=in_qa` |
| 8 | Tester view | `/projects/:id` | tester | `/api/projects/:id/issues` |
| 9 | Report Issue modal | (modal) | tester+ | `POST /api/projects/:id/issues` |
| 10 | Admin board | `/projects/:id` | admin | `/api/projects/:id/issues` (unfiltered) |
| 11 | Issue detail | `/projects/:id/issues/:issueId` | project member | `/api/projects/:id/issues/:issueId` |
| 12 | Import upload | `/projects/:id/import` | qa, admin | `POST /api/import/upload` |
| 13 | Import progress | `/projects/:id/import` | qa, admin | WS `import:progress` |
| 14 | Import mapping | `/projects/:id/import` | qa, admin | `GET/PATCH /api/import/:id/*` |
| 15 | Import complete | `/projects/:id/import` | qa, admin | `GET /api/import/:id/errors` |
| 16 | Project members | `/projects/:id/members` | admin | `/api/projects/:id/members` |
| 17 | Team members | `/teams/:id/settings` | team admin | `/api/teams/:id/members`, `/invites` |
| 18 | User settings | `/settings` | session | `PATCH /api/me` |
| 19 | MCP Connection | `/settings/mcp` | session | `/api/tokens`, `/api/mcp/access-summary`, `/api/mcp/activity` |

---

## Cross-Reference Note

Resolved as of app-flow.md v1.2 and backend-spec.md v1.4:
- ~~Screen 17's route was missing from the app-flow.md route map~~ — `/teams/:teamId/settings` is now listed there.
- `/settings/tokens` (screen 19) has been superseded by `/settings/mcp`, which folds token management into a fuller connection screen. All references across documents now point to the new route.
