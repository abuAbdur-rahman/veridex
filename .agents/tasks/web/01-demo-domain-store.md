# Demo Domain Store

## Objective

Create one typed source of truth for fixture-backed frontend behavior, with
action boundaries shaped for later API replacement.

## Dependencies

- `00-decisions-and-dependencies.md`

## Scope

- Normalize fixture relationships using stable team, project, user, and issue
  IDs.
- Add a Zustand demo store seeded from immutable fixtures.
- Implement selectors for current team/project, role lenses, issue detail,
  triage, retest, and recent reports.
- Implement lifecycle-safe issue, history, and comment actions plus demo reset.
- Add unit tests for transitions, selectors, ticket references, and reset.

## Acceptance

- Screens no longer need fixture arrays as mutable application state.
- Invalid issue transitions return a typed failure and do not change history.
- Valid transitions update issue and history atomically with `source: "web"`.
- Current-user comparisons use IDs, not display names.

## Verify

Run from `apps/web/`:

```bash
pnpm test --run
pnpm lint
pnpm typecheck
```

## Out Of Scope

- API requests, authentication, WebSockets, UI refactors, and local optimistic
  reconciliation.

## Status

- [ ] Complete
