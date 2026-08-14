# Authenticated Shell And Routing

## Objective

Make team, project, role-view, search, and navigation context coherent and
URL-owned where durable.

## Dependencies

- `01-demo-domain-store.md`

## Scope

- Derive sidebar content from current route and store state; remove hard-coded
  `proj_1` navigation.
- Make team/project switchers navigate to valid scoped destinations.
- Make role lens and issue search real controls backed by validated search
  params.
- Introduce a shared authenticated route layout/controller around `AppShell`.
- Redirect `/projects/:projectId/triage` to project home with `view=qa`.

## Acceptance

- Switching project updates all project-relative links and active navigation.
- Role/search state survives refresh and browser back/forward.
- Invalid team, project, or role search state has a deterministic fallback.
- Dashboard uses the authenticated shell without showing invalid project nav.

## Verify

- Add route/component tests for switching and URL state.
- Manually navigate with browser back/forward at 1280px and 390px.
- Run `pnpm lint`, `pnpm typecheck`, and focused tests.

## Out Of Scope

- Issue mutations, drag and drop, API route guards, and server authorization.

## Status

- [ ] Complete
