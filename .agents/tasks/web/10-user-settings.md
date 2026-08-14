# User Settings

## Objective

Make profile hints, theme selection, and demo reset behave consistently with the
application provider and demo store.

## Dependencies

- `01-demo-domain-store.md`
- `03-overlays-feedback-accessibility.md`

## Scope

- Convert settings to a controlled validated form.
- Save username and default-role invite hint to demo state.
- Use `next-themes` as the sole theme owner.
- Add confirmed Reset Demo Data behavior and feedback.

## Acceptance

- Save persists according to the approved demo-persistence decision.
- Default role is labeled and treated only as an invite hint.
- Theme updates immediately and remains usable in light and dark modes.
- Reset restores fixture seed and never preserves a raw MCP token.

## Verify

- Add save, validation, theme, persistence, and reset tests.
- Browser-check both themes at 1280px and 390px.
- Run tests, lint, and typecheck.

## Out Of Scope

- Account deletion, password settings, and real profile APIs.

## Status

- [ ] Complete
