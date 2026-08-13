# Setup Veridex Web

## Goal

Create a clean, production-buildable Vite + React + TypeScript landing page in `apps/web/`, preserving the Veridex content and visual rules from the supplied HTML files.

## Constraints

- Use `pnpm` only.
- Keep application files inside `apps/web/`.
- Keep task tracking in this file; update phase status as work progresses.
- Use JetBrains Mono for structured/generated UI data and Inter for human-written copy.
- Preserve independent status and interaction accent color systems.
- Support light/dark themes and reduced motion.

## Phase Loop

1. Foundation: scaffold, install dependencies, move assets, configure Vite and TypeScript.
2. UI: implement tokens, providers, typed routes, layout, and landing sections.
3. Verification: generate route tree, run lint/typecheck/build, inspect browser output, fix regressions.

## Acceptance Checks

- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm build` passes.
- Landing page contains all supplied landing content sections.
- Theme toggle persists light/dark state and uses `data-theme` tokens.
- Responsive layout works at desktop and mobile widths.
- Keyboard focus and reduced-motion behavior are handled.
- Logos exist under `apps/web/public/logos/`.

## Decisions

- Vite + React 19 + TypeScript is the app shell.
- TanStack Router is used for typed SPA routing.
- TanStack Query is mounted at the app boundary for future server state.
- `next-themes` is configured with `attribute="data-theme"`; this is compatible with the Vite SPA and directly matches the supplied design tokens.
- Tailwind v4 is installed for the app foundation; bespoke landing styles remain explicit CSS so the supplied visual specification is not diluted by generic component defaults.

## Status

- [x] Foundation
- [ ] UI
- [ ] Verification
