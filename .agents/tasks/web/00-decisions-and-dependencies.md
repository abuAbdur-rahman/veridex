# Frontend Decisions And Dependencies

## Objective

Approve the choices that affect routing, testability, Kanban behavior, and demo
state before source implementation starts.

## Decisions

- [ ] Approve routable issue-detail overlay described in the goal.
- [ ] Approve Vitest and Testing Library dependencies.
- [ ] Approve dnd-kit dependencies, or choose the accessible move-menu fallback.
- [ ] Choose persisted demo state or reset-on-reload behavior.
- [ ] Confirm `/login` as canonical and `/auth` as redirect/removal candidate.

## Acceptance

- Every decision is recorded in `.agents/goals/fixture-backed-frontend.md`.
- Package changes are limited to approved dependencies.
- No feature implementation begins with an unresolved dependency assumption.

## Verify

- Review the updated goal and dependency diff.
- If dependencies are approved, run `pnpm install` from repository root and
  verify the lockfile contains only the approved packages.

## Out Of Scope

- Application behavior or visual changes.

## Status

- [ ] Approved
