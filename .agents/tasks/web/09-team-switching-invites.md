# Team Switching And Invites

## Objective

Complete team selection and pending-invite behavior while preserving project
scope.

## Dependencies

- `02-authenticated-shell-routing.md`
- `03-overlays-feedback-accessibility.md`

## Scope

- Implement team switcher dropdown and valid destination resolution.
- Add controlled invite-by-email flow that creates a copyable demo link.
- Wire pending-invite revocation and empty states.
- Remove fixture imports and render-time `window` access from team screens.

## Acceptance

- Switching teams changes project choices and never leaves stale project links.
- Invite links appear only after successful validated submission.
- Revoke requires confirmation and updates the pending list.
- Personal-team restrictions follow `.agents/veridex-app-flow.md`.

## Verify

- Add switching, invite validation, copy, revoke, and empty-state tests.
- Manually verify mobile drawer behavior after team changes.
- Run tests, lint, and typecheck.

## Out Of Scope

- Real token generation, email sending, and invite acceptance API work.

## Status

- [ ] Complete
