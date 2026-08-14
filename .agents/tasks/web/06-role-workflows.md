# Role Workflows

## Objective

Make Dev, QA, Tester, and Admin lenses match the documented application flow.

## Dependencies

- `04-issue-create-detail-update.md`
- `05-kanban-interactions.md`

## Scope

- Dev: assigned-to-me plus unassigned board.
- QA: severity-sorted `in_qa` queue with verify and reject-with-note actions.
- Tester: report action, needs-retest queue, and current user's recent reports.
- Admin: full board and working Dev/QA/Tester/All preview switcher.

## Acceptance

- Every lens derives from one issue collection and stable user/project IDs.
- QA verify removes the row; reject requires a note and returns it to progress.
- Admin view switching changes data without changing membership role.
- Role view remains in the URL and survives refresh/back/forward.

## Verify

- Add a role-matrix test covering visible issues and allowed commands.
- Browser-check all four views at 1280px and 390px.
- Run tests, lint, and typecheck.

## Out Of Scope

- Authorization enforcement; UI visibility is not a security boundary.

## Status

- [ ] Complete
