# Overlays, Feedback, And Accessibility

## Objective

Replace hand-rolled modal behavior and silent actions with shared accessible
overlays and global feedback.

## Dependencies

- `00-decisions-and-dependencies.md`

## Scope

- Standardize modal dialogs and the issue side panel on existing Base UI-backed
  Dialog/Sheet primitives.
- Add one application toast/status layer for mutation success and failure.
- Fix clipboard actions to report success only after a successful copy.
- Define pending, disabled, destructive-confirmation, and reduced-motion rules.

## Acceptance

- Dialogs trap focus, close with Escape, restore focus, and have accessible
  names/descriptions.
- Clipboard failure is visible and never announced as success.
- Mutation feedback does not use status colors for command semantics.
- No clickable table row relies on `role="button"` without valid table and
  keyboard semantics.

## Verify

- Add keyboard/focus/clipboard component tests.
- Complete a keyboard-only manual pass with reduced motion enabled.
- Run `pnpm lint`, `pnpm typecheck`, and focused tests.

## Out Of Scope

- Domain-specific issue, import, member, or MCP behavior.

## Status

- [ ] Complete
