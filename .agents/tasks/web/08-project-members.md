# Project Members

## Objective

Make project membership controls functional against demo state and consistent
with team-before-project membership rules.

## Dependencies

- `01-demo-domain-store.md`
- `03-overlays-feedback-accessibility.md`

## Scope

- Add project-member invitation from eligible existing team members.
- Wire role changes and confirmed removal.
- Hide or disable admin-only commands for non-admin lenses with honest copy.
- Link users who are not team members to Team Settings instead of adding them
  directly.

## Acceptance

- The same user cannot be added twice.
- Role and removal changes persist in demo state and update role-based views.
- Destructive removal requires confirmation.
- Controls communicate that frontend role checks are presentation only.

## Verify

- Add invite, duplicate, role-change, removal, and visibility tests.
- Run tests, lint, and typecheck.

## Out Of Scope

- Email delivery, server authorization, and invitation tokens.

## Status

- [ ] Complete
