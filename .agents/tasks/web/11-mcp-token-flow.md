# MCP Token Flow

## Objective

Make the MCP setup screen demonstrate one-time token handling accurately without
claiming frontend demo state provides real token security.

## Dependencies

- `01-demo-domain-store.md`
- `03-overlays-feedback-accessibility.md`

## Scope

- Wire token creation, metadata list, one-time raw value, generated config, copy,
  revoke, and activity refresh demo behavior.
- Reset token-modal state on close and reopen.
- Show config only while a freshly generated raw token is available.
- Add zero-token and zero-activity empty states.

## Acceptance

- Raw token is shown once and is never persisted or reconstructable.
- Closing the one-time view removes raw value and generated config.
- Revoke requires confirmation and removes token metadata.
- Clipboard and refresh actions report real demo outcomes.

## Verify

- Add create/close/reopen/copy/revoke/empty-state tests.
- Inspect browser storage to confirm raw token absence.
- Run tests, lint, typecheck, and build.

## Out Of Scope

- Cryptographic token generation, hashing, authentication, and live MCP calls.

## Status

- [ ] Complete
