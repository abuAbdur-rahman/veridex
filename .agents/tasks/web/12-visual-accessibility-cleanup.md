# Visual And Accessibility Cleanup

## Objective

Unify the functional application after behavior settles, using canonical tokens
and shared layout patterns rather than Stitch-specific duplication.

## Dependencies

- Tasks `02` through `11`

## Scope

- Audit shell header versus sub-page header responsibilities and remove duplicate
  headings/actions.
- Reconcile application token/radius/focus values with `.agents/DESIGN.md` and
  `apps/web/DESIGN.md`.
- Replace status-colored commands and hard-coded foreground colors with semantic
  interaction tokens.
- Normalize responsive density, overflow, touch targets, empty/loading states,
  and reduced-motion behavior.

## Acceptance

- Repeated page families use shared headers/layouts with no nested card stacks.
- Status color describes data only; orange describes interaction/selection only.
- Keyboard focus is visible and touch targets are at least 44px on mobile.
- All primary workflows remain usable at 1280px and 390px in both themes.

## Verify

- Run automated accessibility checks approved by the project.
- Complete keyboard, zoom, reduced-motion, light/dark, and screenshot review.
- Run full tests, lint, typecheck, and build.

## Out Of Scope

- New visual themes, marketing-page redesign, and unrelated component rewrites.

## Status

- [ ] Complete
