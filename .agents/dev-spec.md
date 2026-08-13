Here's the full picture based on current data — tuned specifically for what Veridex is: a role-based dashboard SPA behind auth, no public SEO pages.



\---



\## Core Framework



\*\*Vite 8 + React 19 + TypeScript\*\*



For internal tools, custom portals, and dashboards — anything behind auth — Vite + React + TypeScript is the clear choice. No framework opinions, no server you don't need, instant HMR, and a build that finishes fast. Next.js would be overkill here; you don't need SSR or SEO on any of these pages.



\---



\## Routing



\*\*TanStack Router\*\*



TanStack Router wins for client-heavy SPAs and dashboards thanks to unmatched end-to-end type safety. Pick it when you're building a dashboard or any client-heavy SPA where search params carry real state, you already use TanStack Query, or type safety is non-negotiable.



Veridex has meaningful URL state — active role view (dev/QA/tester), active ticket, filters — so typed search params pay real dividends here.



\---



\## Data Fetching + Server State



\*\*TanStack Query v6\*\*



TanStack Query v6 is the undisputed standard for server state in 2026. It handles fetching, caching, synchronization, and garbage collection automatically. Pairs seamlessly with TanStack Router — same devtools, same cache, same mutation patterns.



\---



\## Client State



\*\*Zustand\*\*



For most React apps in 2026, Zustand offers the best balance of simplicity and power. At \~3KB minified + gzipped, it's the lightest dedicated option, with no Provider wrapper needed. Use it for UI state — active role, sidebar state, selected ticket — while TanStack Query owns everything that comes from the API.



\---



\## UI Components + Styling



\*\*shadcn/ui (Base UI) + Tailwind CSS v4\*\*



As of July 2026, Base UI is now the default component library in shadcn/ui — rebuilt with everything learned from Radix, by the same team. The key advantage for Veridex: shadcn/ui lets you copy components directly into your codebase — no black-box dependencies, no version lock-in, full component ownership.



This is especially important for Veridex's custom design system (the status/accent color split, the JetBrains Mono / Inter typography rule). You're not fighting a pre-styled library.



\---



\## Drag \& Drop (Kanban Board)



\*\*@dnd-kit/core + @dnd-kit/sortable\*\*



The ReUI Kanban (the community standard shadcn kanban) is powered by @dnd-kit/core for collision detection and sensor management, and @dnd-kit/sortable for the sortable context around cards and columns. Lightweight, accessible, and already the convention in the shadcn ecosystem.



\---



\## Forms + Validation



\*\*React Hook Form + Zod\*\*



The standard pairing for type-safe forms in 2026. Zod handles your ticket schema validation (severity enum, required fields, etc.) and doubles as your single source of truth for TypeScript types — define once, validate everywhere.



\---



\## Full Dependency List



```bash

\# Core

npm create vite@latest veridex -- --template react-ts

npm install react@19 react-dom@19



\# Routing + Data

npm install @tanstack/react-router @tanstack/router-devtools

npm install @tanstack/react-query @tanstack/react-query-devtools



\# State

npm install zustand



\# UI + Styling

npx shadcn@latest init          # Base UI default as of July 2026

npm install tailwindcss @tailwindcss/vite



\# Drag \& Drop

npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities



\# Forms + Validation

npm install react-hook-form zod @hookform/resolvers



\# Utilities

npm install lucide-react         # icons (already in shadcn ecosystem)

npm install clsx tailwind-merge  # class utilities

npm install date-fns             # timestamp formatting for status history

```



\---



\## What's intentionally excluded



\- \*\*No Redux\*\* — overkill, 15KB for no benefit here

\- \*\*No Next.js\*\* — no SSR/SEO need on a dashboard

\- \*\*No MUI/Chakra\*\* — their pre-styled defaults fight your design system

\- \*\*No Axios\*\* — TanStack Query + native `fetch` is sufficient



The entire production bundle (excluding your own code) lands well under 150KB gzipped with this setup. Want me to now look at the backend stack?

