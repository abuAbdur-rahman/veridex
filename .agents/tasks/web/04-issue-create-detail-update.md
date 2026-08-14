# Issue Create, Detail, And Update

## Objective

Complete the fixture-backed issue workflow from reporting an issue through
detail edits, lifecycle changes, history, and comments.

## Dependencies

- `01-demo-domain-store.md`
- `02-authenticated-shell-routing.md`
- `03-overlays-feedback-accessibility.md`

## Scope

- Make Report Issue a validated controlled form that creates a backlog issue.
- Add the routable issue-detail sheet over the current project view.
- Wire editable fields, valid status choices, assignee fields, and comments to
  store actions.
- Keep underlying board/list data synchronized with the open detail panel.

## Acceptance

- New issue gets the next project-scoped ticket reference and initial history.
- Detail deep links load the project view and panel; close/back restores the
  previous project URL.
- Only valid next statuses are offered; rejected transitions preserve state.
- Comments and edits appear immediately everywhere they are rendered.

## Verify

- Add interaction tests for create, deep link, close/back, edit, status, and
  comment behavior.
- Run `pnpm test --run`, `pnpm lint`, and `pnpm typecheck`.

## Out Of Scope

- Server persistence, file attachments, WebSockets, and conflict resolution.

## Status

- [ ] Complete
