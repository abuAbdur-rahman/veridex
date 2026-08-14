# Kanban Interactions

## Objective

Make the board an accessible lifecycle control rather than a static card grid.

## Dependencies

- `01-demo-domain-store.md`
- `04-issue-create-detail-update.md`
- Approved Kanban dependency choice from task 00

## Scope

- Add pointer and keyboard card movement with dnd-kit, or the approved move-menu
  fallback.
- Connect moves to the lifecycle-safe status action.
- Show active card, valid drop target, invalid target feedback, live counts, and
  per-column empty states.
- Apply Dev filtering from stable user IDs.

## Acceptance

- Cards can move only through allowed lifecycle transitions.
- Keyboard users can perform every available move.
- Board counts and detail/history update from the same mutation.
- Reduced motion disables drag scale/rotation without removing feedback.

## Verify

- Add store/component tests for valid and invalid movement.
- Manually verify pointer and keyboard movement at desktop and mobile widths.
- Run tests, lint, typecheck, and build.

## Out Of Scope

- Persistence, multi-user reconciliation, WebSocket animation, and column
  reordering.

## Status

- [ ] Complete
