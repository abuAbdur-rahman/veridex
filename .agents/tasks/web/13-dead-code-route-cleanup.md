# Dead Code And Route Cleanup

## Objective

Remove generated presentation artifacts only after functional replacements are
verified.

## Dependencies

- `12-visual-accessibility-cleanup.md`

## Scope

- Audit unused shadcn primitives, screen variants, fixture imports, dependencies,
  and helpers.
- Resolve duplicate `/auth` and `/login` according to task 00.
- Remove the temporary `/triage` redirect when all links use `?view=qa`.
- Update frontend documentation when route or command behavior changed.

## Acceptance

- Every deletion has zero source references and no lost product behavior.
- One canonical login path remains.
- Route map, router, navigation, and documentation agree.
- No unused dependency remains solely because Stitch generated a component.

## Verify

Run from `apps/web/`:

```bash
pnpm test --run
pnpm lint
pnpm typecheck
pnpm build
```

Then verify all documented routes in a desktop and mobile browser pass.

## Out Of Scope

- Backend cleanup and landing-page changes unrelated to route consolidation.

## Status

- [ ] Complete
