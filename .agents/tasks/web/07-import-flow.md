# Import Flow

## Objective

Provide a complete, honest demo of the spreadsheet-import journey without
pretending to parse or persist real files.

## Dependencies

- `01-demo-domain-store.md`
- `03-overlays-feedback-accessibility.md`

## Scope

- Validate selected file extension and expose selected-file state.
- Advance deterministic demo progress from upload to mapping with cancel/retry.
- Make column/color mappings controlled and retained; use a default-status field
  for CSV because CSV has no row colors.
- Create demo issues on confirmation, show failures, and navigate View Board.

## Acceptance

- `.xlsx` and `.csv` paths differ where the product flow requires.
- Mapping selections are never discarded between renders.
- Completion counts match inserted/failed demo rows.
- View Board opens the affected project and shows imported issues.

## Verify

- Add file-input, timer/state-machine, mapping, error, and navigation tests.
- Run tests with fake timers, then lint, typecheck, and build.

## Out Of Scope

- Excel/CSV parsing, uploads, R2, jobs, and WebSockets.

## Status

- [ ] Complete
