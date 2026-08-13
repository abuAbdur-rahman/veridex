# Veridex — Design System

> Version: v1.0 — canonical source for all application UI. Colors and typography are extracted directly from the existing `veridex.html` / `veridex-spec.html` CSS custom properties — nothing here is reinvented. Spacing, component patterns, and states are newly formalized for application (not marketing-page) use.

---

## Contents

1. [Design principles](#design-principles)
2. [Color system](#color-system)
3. [Typography](#typography)
4. [Spacing scale](#spacing-scale)
5. [Radius & elevation](#radius--elevation)
6. [Iconography](#iconography)
7. [Component patterns](#component-patterns)
8. [Interaction states](#interaction-states)
9. [Motion](#motion)
10. [Accessibility](#accessibility)
11. [Tailwind v4 + shadcn/ui token mapping](#tailwind-v4--shadcnui-token-mapping)

---

## Design Principles

Three rules govern every UI decision in Veridex. When a new component or screen doesn't have precedent, resolve the question against these first.

1. **Status answers "what is this," accent answers "what can I click."** These are two independent color systems and must never collapse into one. A ticket can be `pending` (status) and `selected` (accent state) at the same time — both are true facts, rendered with both colors present, never merged into a single color.

2. **If a person typed it, it's Inter. If the system generated it, it's JetBrains Mono.** This one rule resolves every typography decision without exception — see [Typography](#typography).

3. **Density before decoration.** Veridex is a working tool for people triaging bugs, not a marketing site. Favor information density, scanability, and fast repeated actions over illustrative flourish. The landing page is allowed to have personality; the app itself earns trust through clarity.

---

## Color System

Extracted verbatim from `veridex-spec.html`. Do not introduce new hex values without updating this file first — every color used anywhere in the app must trace back to a token defined here.

### Light theme

```css
:root {
  --bg:        #F1F3F5;
  --bg-alt:    #E7EAED;
  --surface:   #FFFFFF;
  --ink:       #171E26;
  --ink-soft:  #4A5561;
  --line:      #D7DCE1;
  --line-soft: #E4E7EA;

  --pass:      #1C8C6B;  --pass-bg:    #E4F3EE;
  --pending:   #B8792A;  --pending-bg: #F6ECDD;
  --block:     #AF3B3B;  --block-bg:   #F5E5E5;
  --dev:       #2F5DAA;  --dev-bg:     #E4EBF6;

  --accent:        #EA6A0C;
  --accent-strong: #C9560A;
  --accent-bg:     #FDECD9;
  --accent-ring:   rgba(234, 106, 12, 0.35);

  --radius: 10px;
}
```

### Dark theme

```css
[data-theme="dark"] {
  --bg:        #12161B;
  --bg-alt:    #171D24;
  --surface:   #1B2229;
  --ink:       #E7ECEF;
  --ink-soft:  #93A0AC;
  --line:      #2B333C;
  --line-soft: #232A32;

  --pass:      #4FCBA3;  --pass-bg:    #16302A;
  --pending:   #E3A75C;  --pending-bg: #362A16;
  --block:     #E28080;  --block-bg:   #362020;
  --dev:       #7FAAE6;  --dev-bg:     #1D2A3C;

  --accent:        #FB923C;
  --accent-strong: #FDBA74;
  --accent-bg:     #3A2712;
  --accent-ring:   rgba(251, 146, 60, 0.35);
}
```

### Two independent systems — usage rules

| System | Colors | Answers | Never used for |
|--------|--------|---------|-----------------|
| **Status** | `pass`, `pending`, `block`, `dev` | "What is true about this ticket/entity?" | Buttons, links, active nav, focus rings, selection |
| **Accent** | `accent`, `accent-strong` | "What is interactive / currently selected?" | Severity badges, status pills, role indicators |

### Status color → meaning map

| Token | Semantic meaning in Veridex |
|-------|------------------------------|
| `pass` | Issue status: `verified` / `closed`. Test case: passing. |
| `pending` | Issue severity: `medium`. Import job: `pending` / `processing`. |
| `block` | Issue severity: `high` / `critical`. Issue status: `in_progress` (blocking work). |
| `dev` | Dev-owned indicator — assignee avatars, dev-role badge, `backlog` status neutral marker. |

> **Do not** invent a fifth status color for `in_qa`. Use `pending-bg` as the column background with a `pending` text label reading "In QA" — the QA phase is semantically "pending a decision," which the existing token already covers. This keeps the 4-color system intact rather than growing it per feature.

### Tag colors

Per the schema design decision: tag colors are **never** drawn from the status palette. Define a separate, smaller neutral/accent-safe palette for tags:

```css
--tag-slate:   #64748B;  --tag-slate-bg:   #EEF1F4;
--tag-violet:  #7C6FE0;  --tag-violet-bg:  #EFEDFB;
--tag-rose:    #D65A82;  --tag-rose-bg:    #FBEBF0;
--tag-teal:    #2D9C9C;  --tag-teal-bg:    #E4F5F5;
```

(Dark theme equivalents follow the same lightening pattern as the status colors above — brighter foreground, desaturated dark background.)

---

## Typography

### The governing rule

**If a person typed it, use Inter. If it's structured or system-generated, use JetBrains Mono.** This single rule resolves every typography decision — apply it before consulting any table below.

```css
--mono: 'JetBrains Mono', ui-monospace, monospace;
--sans: 'Inter', -apple-system, sans-serif;
```

### Application mapping

| Element | Font | Reasoning |
|---------|------|-----------|
| Ticket ID (`VER-042`) | Mono | Generated, structured |
| Page/section titles | Mono | Structural, not prose |
| Timestamps, dates | Mono | Generated data |
| Environment strings (`Chrome 128 / macOS 14`) | Mono | Generated/structured |
| Table column headers | Mono | Structural |
| Status/severity pill labels | Mono | Structural — short, systemic labels |
| Ticket title | Inter | Person-authored |
| Ticket description, steps to reproduce | Inter | Person-authored |
| Comments | Inter | Person-authored |
| Button and nav labels | Inter | UI copy, not data |
| Empty states, error messages | Inter | Human-facing prose |
| Form field labels | Inter | UI copy |
| Form field values that echo structured data (e.g. a read-only severity chip inside a form) | Mono | Still structured data, regardless of context |

### Type scale (application UI)

The marketing page uses `clamp()` fluid sizing appropriate for a hero section. The application UI uses a fixed scale — dashboards need predictable, non-fluid type for information density.

| Token | Size | Line height | Weight | Use |
|-------|------|-------------|--------|-----|
| `text-xs` | 11px | 16px | 500–600 | Table headers, meta labels, badges |
| `text-sm` | 13px | 20px | 400–500 | Body text, form inputs, secondary content |
| `text-base` | 14px | 22px | 400 | Default body copy, comments |
| `text-md` | 16px | 24px | 600 | Ticket titles, card headers |
| `text-lg` | 20px | 28px | 700 | Section headers, modal titles |
| `text-xl` | 26px | 32px | 700 | Page titles |

Application UI runs smaller than the marketing page throughout — a dashboard optimizes for scanning many rows, not reading long-form copy.

---

## Spacing Scale

The marketing page uses ad hoc pixel values (`18px`, `26px`, `36px`...). The application UI uses a strict 4px base scale — required for Tailwind v4 utility consistency and for the Kanban board's grid alignment.

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

| Use case | Token |
|----------|-------|
| Icon-to-label gap | `space-2` |
| Form field internal padding | `space-3` |
| Card internal padding | `space-4` |
| Gap between stacked form fields | `space-4` |
| Kanban column internal padding | `space-4` |
| Gap between Kanban columns | `space-4` |
| Section padding (modal, panel) | `space-6` |
| Page-level horizontal padding | `space-8` |
| Gap between major page sections | `space-10` |

---

## Radius & Elevation

```css
--radius-sm: 6px;   /* badges, pills, small buttons */
--radius:    10px;  /* cards, inputs, buttons — matches existing --radius token */
--radius-lg: 14px;  /* modals, large panels */
--radius-full: 999px; /* avatars, status dots */
```

Elevation is used sparingly — Veridex's flat, bordered aesthetic (visible in the existing spec's `border: 1px solid var(--line)` pattern on every card/table) is intentional and should be preserved in the app. Shadows are reserved for genuinely floating elements only.

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);        /* dropdowns, popovers */
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.12);       /* modals */
--shadow-drag: 0 8px 24px rgba(0, 0, 0, 0.18);     /* dragging a Kanban card */
```

Default state for cards and table rows: **border, not shadow.** This matches the existing swatch/table styling in `veridex-spec.html` exactly (`border: 1px solid var(--line)`, no box-shadow).

---

## Iconography

**Library: `lucide-react`** (already in the dependency list — consistent with shadcn/ui ecosystem).

| Rule | Detail |
|------|--------|
| Stroke width | `1.5` default, `2` for small icons (≤16px) where thinner strokes lose clarity |
| Default size | 16px inline with text, 20px standalone (buttons, nav) |
| Color | Icons inherit `currentColor` — never hardcoded. An icon in an `accent`-colored button is `accent`, not a fixed hex. |
| Status icons | Pair with status color: `CheckCircle2` (pass), `Clock` (pending), `AlertTriangle` (block), `Circle` (dev/backlog) |

### Icon reference (issue-related)

| Concept | Icon |
|---------|------|
| Severity: low | `ChevronDown` (single, muted) |
| Severity: medium | `ChevronsDown` or `Minus` |
| Severity: high | `ArrowUp` |
| Severity: critical | `AlertOctagon` |
| Environment | `Monitor` |
| Steps to reproduce | `ListOrdered` |
| Test case link | `FlaskConical` |
| Comment | `MessageSquare` |
| Status history / audit log | `History` |
| Import | `Upload` |
| MCP / agent activity | `Bot` |
| API token | `KeyRound` |

---

## Component Patterns

### Status pill

The single most-repeated component in the app. Appears on Kanban cards, issue detail headers, table rows.

```
┌─────────────┐
│ ● In QA      │   ← Mono font, text-xs, weight 600
└─────────────┘
```

- Background: `{status}-bg`
- Text: `{status}` (foreground)
- Dot: 6px circle, `{status}` color, `--space-2` gap to label
- Padding: `4px 10px`
- Radius: `--radius-sm`
- Font: Mono, `text-xs`, uppercase, `letter-spacing: 0.03em`

### Severity badge

Same shape as status pill but uses a fixed 4-step visual weight rather than color alone, since severity and status pills sit side-by-side on cards and must be distinguishable at a glance even for color-blind users.

| Severity | Visual treatment |
|----------|-------------------|
| `low` | Outline only, `ink-soft` text, no fill |
| `medium` | `pending-bg` fill, `pending` text |
| `high` | `block-bg` fill, `block` text, bold |
| `critical` | `block` solid fill, white text, `AlertOctagon` icon prefix |

### Kanban card

```
┌────────────────────────────────┐
│ VER-042              [severity] │  ← ticket_ref (mono) + severity badge
│ Login button unresponsive on    │  ← title (Inter, text-md, 2-line clamp)
│ mobile Safari                   │
│                                  │
│ 🏷 layout  🏷 mobile             │  ← tags (max 2 visible, "+N" overflow)
│                                  │
│ 👤 avatar          🕐 2d ago     │  ← assignee avatar + relative timestamp
└────────────────────────────────┘
```

- Border: `1px solid var(--line)`, no shadow at rest
- On drag: `--shadow-drag`, slight scale (1.02), rotate (-1deg) — see [Motion](#motion)
- On hover: border color shifts to `var(--ink-soft)`, cursor `grab`
- Padding: `--space-4`
- Radius: `--radius`

### Kanban column

- Header: status pill (larger variant) + count badge + column-level "add issue" affordance (tester/admin only)
- Background: `var(--bg-alt)` — one shade off the page background, distinguishing column from page
- Column width: fixed `320px` on desktop, horizontal scroll container on mobile — never percentage-based (prevents cards from awkwardly reflowing during drag)
- Gap between cards: `--space-3`

### Form input

```css
.input {
  font-family: var(--sans);
  font-size: 13px; /* text-sm */
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
}
.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
```

Applies to every text input, textarea, and select across the app — issue creation form, onboarding username field, comment box, invite email field.

### Table row (import preview, member list)

Matches the exact styling from `veridex-spec.html`'s existing table CSS — reuse verbatim:

```css
thead th {
  font-family: var(--mono);
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
  background: var(--bg-alt);
  padding: 11px 15px;
}
tbody td {
  padding: 13px 15px;
  font-size: 13px;
  border-bottom: 1px solid var(--line-soft);
}
```

### Empty state

Every list view (issue board with zero issues, empty project list, no comments yet) uses the same layout:

```
        [icon, 32px, ink-soft]

     No issues yet in this project
   Report a bug or import from a spreadsheet
             to get started

         [ Report an Issue ]
```

Centered, generous vertical padding (`--space-16` top/bottom), icon → heading (`text-md`, Inter, weight 600) → subtext (`text-sm`, `ink-soft`) → single primary action button.

### Toast / notification

Bottom-right, stacked. Uses status colors semantically: success → `pass`, error → `block`, info → `dev`, warning → `pending`. Auto-dismiss after 5s except errors (manual dismiss only).

---

## Interaction States

Every interactive element needs all five states defined — this is the most commonly skipped part of a design system and the fastest way to make an app feel unfinished.

| State | Treatment |
|-------|-----------|
| **Default** | As specified per component above |
| **Hover** | Border/background shifts one step toward `ink` (light) or `accent` for primary actions; cursor `pointer` |
| **Focus** | `box-shadow: 0 0 0 3px var(--accent-ring)` — identical ring across every focusable element for consistency |
| **Active/pressed** | Slight scale-down (`transform: scale(0.98)`) on buttons only, 100ms |
| **Disabled** | `opacity: 0.5`, `cursor: not-allowed`, no hover/focus treatment applies |

### Loading states

- Buttons: replace label with a 14px spinner (`Loader2` from lucide, `animate-spin`), keep button width fixed (no layout shift)
- Kanban board initial load: skeleton columns with 3 pulsing card placeholders each
- Import processing: determinate progress bar (WebSocket-driven `imported / total`), not indeterminate — the data to show real progress already exists, so never fake it with a spinner

---

## Motion

Per the frontend design principle: one well-orchestrated moment beats scattered micro-interactions. Veridex's motion budget is spent on the two moments that matter most for a Kanban tool.

### 1. Card drag (the core interaction)

```css
.card-dragging {
  transform: scale(1.02) rotate(-1deg);
  box-shadow: var(--shadow-drag);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.card-drop-zone-active {
  background: var(--accent-bg);
  border: 2px dashed var(--accent);
  transition: background 150ms ease, border-color 150ms ease;
}
```

Powered by `@dnd-kit` — these classes apply during the `onDragStart` / `onDragOver` lifecycle.

### 2. Real-time update arrival (WebSocket-driven card move)

When another user's action arrives over WebSocket and moves a card on your screen without you touching it, it must not feel jarring:

```css
@keyframes card-remote-update {
  0%   { background: var(--accent-bg); }
  100% { background: transparent; }
}
.card-remote-updated {
  animation: card-remote-update 900ms ease-out;
}
```

A brief highlight flash — not a slide/fly animation across columns, which would be disorienting when several updates arrive close together.

### Global rules

- Durations: `100ms` (button press) / `150ms` (hover, drag) / `250ms` (theme toggle, page transitions) / `900ms` (remote update highlight only)
- Easing: `ease` for color/background transitions, `ease-out` for anything entering, `ease-in` for anything exiting
- Respect `prefers-reduced-motion` — disable the drag rotate/scale and the remote-update flash, keep only opacity transitions

---

## Accessibility

| Requirement | Implementation |
|-------------|-----------------|
| Color contrast | All `ink`/`ink-soft` on `bg`/`surface` combinations meet WCAG AA (4.5:1) in both themes — verified against the existing token values |
| Status conveyed by color alone | Never — every status/severity pill pairs color with a text label and/or icon (see Severity badge) |
| Focus visible | Every interactive element gets the `accent-ring` focus state — no `outline: none` without a replacement |
| Keyboard-operable Kanban | `@dnd-kit` supports keyboard sensors — arrow keys move focused card between columns as an alternative to drag |
| Form labels | Every input has a visible `<label>`, never placeholder-only |
| Live regions | WebSocket-driven board updates announce via `aria-live="polite"` region for screen reader users — "Issue VER-042 moved to In QA" |

---

## Tailwind v4 + shadcn/ui Token Mapping

Tailwind v4's CSS-first config maps directly onto the custom properties already defined above — no duplication, one source of truth.

```css
/* apps/web/src/styles/theme.css */
@import "tailwindcss";

@theme {
  --color-bg: var(--bg);
  --color-bg-alt: var(--bg-alt);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-line: var(--line);
  --color-line-soft: var(--line-soft);

  --color-pass: var(--pass);
  --color-pass-bg: var(--pass-bg);
  --color-pending: var(--pending);
  --color-pending-bg: var(--pending-bg);
  --color-block: var(--block);
  --color-block-bg: var(--block-bg);
  --color-dev: var(--dev);
  --color-dev-bg: var(--dev-bg);

  --color-accent: var(--accent);
  --color-accent-strong: var(--accent-strong);
  --color-accent-bg: var(--accent-bg);

  --font-mono: var(--mono);
  --font-sans: var(--sans);

  --radius-sm: var(--radius-sm);
  --radius-DEFAULT: var(--radius);
  --radius-lg: var(--radius-lg);

  --spacing-1: var(--space-1);
  --spacing-2: var(--space-2);
  /* ...continues for full spacing scale */
}
```

Usage in components: `bg-pass-bg text-pass`, `font-mono text-xs`, `rounded-DEFAULT border-line` — Tailwind utility classes generated directly from the design tokens, so a color change in `theme.css` propagates everywhere with zero find-and-replace.

shadcn/ui components (Base UI) are themed by overriding their CSS variable layer to point at the same tokens — `--primary` maps to `--accent`, `--destructive` maps to `--block`, `--border` maps to `--line`. This keeps shadcn's default component behavior while ensuring every shadcn component automatically matches the Veridex palette with no per-component overrides needed.
