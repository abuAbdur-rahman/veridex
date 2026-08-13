# Veridex Web

The `apps/web/` package is the current Vite + React + TypeScript frontend for Veridex, a QA-aware issue tracker designed to replace spreadsheet-based bug tracking.

The implemented slice is a responsive public landing page plus an authentication presentation screen. The dashboard, API integration, and authenticated issue-management flows are planned in the repository specifications but are not implemented yet.

## Stack

- Vite 8
- React 19
- TypeScript 6
- TanStack Router
- TanStack Query provider for future server state
- Zustand for future client UI state
- Tailwind CSS v4 with explicit landing-page CSS
- `next-themes` for persisted light/dark theme selection
- Lucide React and Simple Icons
- Oxlint

## Requirements

- Node.js LTS
- `pnpm`

## Development

```bash
pnpm install
pnpm dev
```

Vite prints the local development URL after startup.

## Routes

- `/` — public landing page with the product story, workflow, MCP callout, and feature sections.
- `/auth` — authentication presentation screen with Google and GitHub UI actions. These buttons are not connected to an authentication backend yet.

## Scripts

```bash
pnpm dev        # Start Vite development server
pnpm lint       # Run Oxlint
pnpm typecheck  # Run the TypeScript project build without emitting output
pnpm build      # Typecheck and create the Vite production bundle
pnpm preview    # Preview the production bundle locally
```

Run the standard checks before submitting frontend changes:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Structure

```text
src/
├── components/
│   ├── landing/       Landing sections and spreadsheet-to-ticket visual
│   ├── layout/        Navbar, footer, and logo
│   └── theme/         Theme toggle
├── lib/               Reusable utilities and landing content data
├── providers/         App-wide providers
├── routes/            TanStack Router route modules
├── index.css          Design tokens and landing stylesheet
├── main.tsx           Browser entry point
└── router.tsx         Typed router instance
public/
└── logos/             Supplied Veridex logo assets
```

## Design System

Read [`DESIGN.md`](DESIGN.md) before changing visual behavior. The main rules are:

- Inter is used for human-written copy.
- JetBrains Mono is used for structured or generated data, labels, and section titles.
- Status colors describe issue facts and role semantics.
- Orange accent describes interaction, selection, links, and focus.
- Light and dark themes use shared CSS custom-property tokens.
- Visible focus states and `prefers-reduced-motion` support are required.

## Related Documentation

- [`../README.md`](../README.md) — project overview, current status, roadmap, and architecture.
- [`AGENTS.md`](AGENTS.md) — frontend-local contributor and agent rules.
- [`../.agents/tasks/setup-veridex-web.md`](../.agents/tasks/setup-veridex-web.md) — setup task and acceptance checks.
- [`../.agents/veridex-app-flow.md`](../.agents/veridex-app-flow.md) — planned routes and product flows.
- [`../.agents/veridex-pages-screens.md`](../.agents/veridex-pages-screens.md) — planned screen requirements.
