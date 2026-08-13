# Veridex Web Agent Guide

## Purpose

`apps/web/` contains the Veridex React SPA. The current route is a public product landing page; future authenticated dashboard routes should reuse the app providers and introduce their own route layout where needed.

## Structure

```text
src/
  components/
    landing/       Landing page sections and interactive visual
    layout/        Site-wide navigation and footer
    theme/         Theme controls
  lib/             Small reusable utilities
  providers/       App-wide context providers
  routes/          TanStack Router route modules
  styles/          Reserved for additional style modules
  index.css        Design tokens and landing stylesheet
  main.tsx         Browser entry point
  router.tsx       Typed router instance
public/
  logos/           Supplied Veridex raster assets
```

## Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

## Conventions

- Use `@/` for imports from `src/`.
- Keep route definitions in `src/routes/`.
- Keep reusable page pieces in focused components; do not create a single monolithic page file.
- Validate external data at boundaries when API/form work is added.
- Use Inter for prose and JetBrains Mono for IDs, labels, statuses, and section titles.
- Do not merge status colors with the orange interaction accent.
- Preserve visible focus states and `prefers-reduced-motion` support.
