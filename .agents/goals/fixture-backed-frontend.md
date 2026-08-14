# Goal: Cohesive Fixture-Backed Frontend

## Objective

Turn the current Stitch-derived presentation layer into a cohesive, usable
Veridex application before the backend is complete.

The frontend must demonstrate the real QA workflow with honest in-memory demo
behavior: team and project switching, role-aware views, issue creation and
detail, lifecycle transitions, Kanban movement, import, membership management,
settings, and MCP token setup. The implementation must be structured so typed
demo actions can later be replaced by TanStack Query API calls without
rewriting presentational screens.

This is not a redesign from scratch. Remove generated complexity only when it
does not serve the product flow, consolidate repeated layout patterns, and keep
the existing Veridex visual language.

## Why

Stitch supplied useful visual direction but is not a product or architecture
authority. Generated screens currently contain inert controls, duplicated
state ownership, hard-coded project context, and components that imply behavior
that does not exist. Cleanup and functionality must therefore be driven by the
documented Dev, QA, Tester, and Admin workflows rather than by generated markup.

## Sources Of Truth

Use these in order:

1. Existing implementation in `apps/web/`
2. `apps/web/AGENTS.md`
3. `.agents/veridex-app-flow.md`
4. `.agents/veridex-pages-screens.md`
5. `.agents/DESIGN.md` and `apps/web/DESIGN.md`
6. `veridex-stitch-prompts.md` as design provenance only
7. `.agents/dev-spec.md` for planned frontend tooling

The deleted `.agents/tasks/setup-veridex-web.md` and
`.agents/tasks/web/app-interface-shadcn.md` remain setup and presentation-work
provenance in Git history; neither is an active implementation specification.

## Product Decisions

- Keep four distinct views: Dev, QA, Tester, and All. The Stitch prompt's merged
  QA/Tester view was an explicit assumption and conflicts with the app flow.
- Make `?view=` the durable owner of role-lens state. Preserve `/triage` only as
  a redirect to `?view=qa` while links migrate.
- Use one authenticated shell. Dashboard keeps team/project switching but does
  not show project-page navigation until a project is selected.
- Model issue detail as a routable overlay: the URL supports deep links while
  the project board remains visible below a right-side panel. This reconciles
  the route map with the required overlay interaction.
- Keep fixtures as immutable seed data. Components must not import fixture
  collections as live state.
- Do not simulate authentication, authorization guarantees, WebSockets, file
  parsing, token security, or server failures as if they were implemented.

## Recommended Architecture

- Add one typed Zustand demo store seeded from normalized fixtures.
- Scope teams, projects, memberships, issues, history, comments, imports,
  settings, tokens, and activity by stable IDs.
- Expose narrowly named actions matching future mutations: `createIssue`,
  `updateIssue`, `changeIssueStatus`, `addComment`, membership/invite actions,
  import actions, settings actions, and token actions.
- Enforce the lifecycle transition table in demo actions and append status
  history with `source: "web"` in the same state update.
- Let route params and validated search params own durable navigation state.
  Keep only temporary form, dialog, drag, and disclosure state local.
- Keep screen components data-and-callback driven. Route/controller hooks read
  demo state now and can later switch to TanStack Query without changing screen
  contracts.
- Use the existing Base UI-backed dialog, sheet, dropdown, and form primitives
  for keyboard and focus behavior instead of maintaining hand-rolled overlays.
- Keep the shell header responsible for breadcrumb, search, role lens, and
  global actions. Keep `PageHeader` responsible for sub-page title, count, and
  local actions.

## Interaction Matrix

| User action | Demo result | Future boundary |
|---|---|---|
| Switch team or project | Shell and route context change together | `/api/me`, team project list |
| Change role lens | `?view=` changes and correct role data renders | Filtered issue query |
| Search issues | Board/lists filter by reference or title | Issue list `search` query |
| Move Kanban card | Valid status transition updates issue and history | Issue status `PATCH` |
| Open issue | Routable panel opens over current project view | Issue and history `GET` |
| Create issue | Valid backlog issue gets next project ticket reference | Issue `POST` |
| Edit, transition, comment | Detail and underlying view update together | Issue/comment mutations |
| QA verify or reject | Row leaves triage; reject requires note | Issue status `PATCH` |
| Import file | Demo state advances through upload, mapping, result | Import APIs and WebSocket |
| Manage project members | Invite, role, and removal update demo membership | Project member APIs |
| Manage team invites | Invite link and pending rows update | Team invite APIs |
| Save settings | Profile hint and theme update with feedback | `PATCH /api/me` |
| Manage MCP token | Raw token appears once; metadata can be revoked | Token APIs |

## Dependency Gates

Implementation must not begin until these choices are approved:

1. Add Vitest, React Testing Library, `user-event`, `jest-dom`, and jsdom for
   store, route, form, modal, and keyboard regression tests.
2. Add `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` for pointer
   and keyboard Kanban movement. If declined, ship an accessible "Move to"
   menu instead of hand-rolled drag and drop.
3. Decide whether demo domain/settings state persists in `localStorage`.
   Recommended: persist it with an explicit Reset Demo Data action, but never
   persist a raw MCP token.
4. Confirm `/login` as canonical and redirect or remove duplicate `/auth`.

React Hook Form is not required for the first pass. Add Zod when real API or
file boundaries arrive; do not add speculative form dependencies now.

## Task Order

1. `00-decisions-and-dependencies.md`
2. `01-demo-domain-store.md`
3. `02-authenticated-shell-routing.md`
4. `03-overlays-feedback-accessibility.md`
5. `04-issue-create-detail-update.md`
6. `05-kanban-interactions.md`
7. `06-role-workflows.md`
8. `07-import-flow.md`
9. `08-project-members.md`
10. `09-team-switching-invites.md`
11. `10-user-settings.md`
12. `11-mcp-token-flow.md`
13. `12-visual-accessibility-cleanup.md`
14. `13-dead-code-route-cleanup.md`

## Success Criteria

- Every visible primary action either works in demo state, navigates somewhere
  valid, or is clearly disabled with honest explanatory copy.
- Team, project, issue, and role state remains coherent across navigation,
  refresh, back/forward, and mobile navigation.
- Dev, QA, Tester, and Admin views follow `.agents/veridex-app-flow.md`.
- Issue creation, edits, comments, and valid status changes update every
  affected view from one state owner.
- Kanban movement supports keyboard operation and rejects invalid lifecycle
  transitions.
- Import, member, settings, and MCP flows have complete demo happy paths,
  validation, cancellation, feedback, and relevant destructive confirmation.
- Shared shell, sub-page headers, overlays, empty states, and feedback patterns
  are reused instead of duplicated.
- Status colors remain data-only; orange remains interaction/selection-only.
- Layout works at 1280px and 390px in light and dark themes.
- `pnpm lint`, `pnpm typecheck`, tests, and `pnpm build` pass.

## Boundaries

- Always preserve the QA lifecycle and spreadsheet-replacement narrative.
- Always validate demo action input and model future API boundaries explicitly.
- Ask before adding dependencies or changing route/product decisions above.
- Never make frontend demo state an authorization boundary.
- Never claim backend persistence, real-time sync, parsing, or token security.
- Never delete generated components until references and replacement behavior
  have been verified.

## Status

- [x] Current UI, product flow, and Stitch provenance investigated
- [x] Contradictions and implementation sequence documented
- [ ] Dependency and route decisions approved
- [ ] Tasks 01-13 implemented and verified
