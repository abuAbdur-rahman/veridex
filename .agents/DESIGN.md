# Veridex — Design System

> Version: v2.0 — dark theme promoted to primary reference (light is the secondary generated pass). Added the Application Shell spec (previously only lived in the Stitch prompts doc). Kanban card pattern upgraded to the enriched version. Reconciled a conflicting Material Design 3 token export against the canonical Veridex palette — see note below.

---

## A Note on Conflicting Token Sources

A Stitch-generated theme file was submitted for review containing two contradictory color systems in one document: a YAML frontmatter block using Material Design 3 role tokens (`background: #08151e`, `tertiary: #61d5ff`, `on-primary-fixed-variant`, etc.) and a prose section underneath describing the real Veridex palette (`#12161B`, `#FB923C`, `#2B333C`). **The YAML frontmatter palette is discarded — it does not match any hex value ever established for Veridex** and appears to be Stitch's own internal Material theme representation, not the actual rendered output. The prose section was correct and its useful additions (named typography scale, soft-fill badge formula, input focus-glow spec, issue-row density sizing) are folded into this document below. If Stitch's internal theme ever drifts from what's specified here again, treat this file — not Stitch's auto-generated tokens — as the source of truth.

---

## Contents

1. [Design principles](#design-principles)
2. [Color system](#color-system)
3. [Typography](#typography)
4. [Spacing scale](#spacing-scale)
5. [Radius & elevation](#radius--elevation)
6. [Iconography](#iconography)
7. [Application shell](#application-shell)
8. [Component patterns](#component-patterns)
9. [Interaction states](#interaction-states)
10. [Motion](#motion)
11. [Accessibility](#accessibility)
12. [Tailwind v4 + shadcn/ui token mapping](#tailwind-v4--shadcnui-token-mapping)

---

## Design Principles

Four rules govern every UI decision in Veridex. When a new component or screen doesn't have precedent, resolve the question against these first.

1. **Status answers "what is this," accent answers "what can I click."** These are two independent color systems and must never collapse into one. A ticket can be `pending` (status) and `selected` (accent state) at the same time — both are true facts, rendered with both colors present, never merged into a single color.

2. **If a person typed it, it's Inter. If the system generated it, it's JetBrains Mono.** This one rule resolves every typography decision without exception — see [Typography](#typography).

3. **Density before decoration.** Veridex is a working tool for people triaging bugs, not a marketing site. Favor information density, scanability, and fast repeated actions over illustrative flourish. Tonal layering and borders replace shadows almost everywhere — this is an IDE-adjacent aesthetic, not a consumer dashboard.

4. **The sidebar is team-scoped, the header is project-scoped.** Team identity and project switching live in the sidebar; the current project's breadcrumb, role view, and page actions live in the header. This split is deliberate — see [Application Shell](#application-shell) — and should never invert. Issue detail is always a modal overlay on the current screen, never a route change with its own header/sidebar.

---

## Color System

Extracted verbatim from the real Veridex CSS (`veridex-spec.html`) and its dark-mode counterpart. Do not introduce new hex values — including from auto-generated theme exports — without updating this file first. Dark is the primary/default theme; light is generated as a secondary pass using the same token names.

### Dark theme (primary)

```css
[data-theme="dark"] {
  --bg:             #12161B;  /* Layer 0 — main application canvas */
  --bg-alt:         #171D24;  /* Layer 1 — sidebar, nav, Kanban column backgrounds */
  --surface:        #1B2229;  /* Layer 2 — cards, modals, floating/interactive surfaces */
  --ink:            #E7ECEF;
  --ink-soft:       #93A0AC;
  --line:           #2B333C;  /* strong border — component perimeter */
  --line-soft:      #232A32;  /* soft border — internal dividers, row separators */

  --pass:      #4FCBA3;  --pass-bg:    #16302A;
  --pending:   #E3A75C;  --pending-bg: #362A16;
  --block:     #E28080;  --block-bg:   #362020;
  --dev:       #7FAAE6;  --dev-bg:     #1D2A3C;

  --accent:        #FB923C;
  --accent-strong: #FDBA74;
  --accent-bg:     #3A2712;
  --accent-ring:   rgba(251, 146, 60, 0.35);
  --on-accent:     #12161B; /* text/icon color when sitting ON a solid accent fill — dark text on orange, not white */
}
```

### Light theme (secondary — generated pass)

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
  --on-accent:     #FFFFFF; /* light theme is high-contrast enough for white text on accent */

  --radius: 10px;
}
```

### Layer naming (elevation without shadows)

| Layer | Dark value | Use |
|-------|-----------|-----|
| Layer 0 — Base | `--bg` (#12161B) | Main application canvas |
| Layer 1 — Anchored panels | `--bg-alt` (#171D24) | Sidebar, Kanban column backgrounds, table headers |
| Layer 2 — Floating surfaces | `--surface` (#1B2229) | Cards, modals, dropdowns, any interactive/floating element |

Every surface transition between layers is marked by a `1px` border (`--line`), never a shadow. The one exception: a currently-dragged Kanban card and an open modal both get a subtle shadow, since those are the only two moments something is meant to read as *floating above* the layer system rather than *part of* it (see [Component Patterns](#component-patterns) and [Motion](#motion)).

### Two independent systems — usage rules

| System | Colors | Answers | Never used for |
|--------|--------|---------|-----------------|
| **Status** | `pass`, `pending`, `block`, `dev` | "What is true about this ticket/entity?" | Buttons, links, active nav, focus rings, selection |
| **Accent** | `accent`, `accent-strong` | "What is interactive / currently selected?" | Severity badges, status pills, role indicators |

### Status color → meaning map

| Token | Semantic meaning in Veridex |
|-------|------------------------------|
| `pass` | Issue status: `verified`. Test case: passing. |
| `pending` | Issue severity: `medium`. Import job: `pending` / `processing`. |
| `block` | Issue severity: `high` / `critical`. Issue status: `in_progress` (blocking work). |
| `dev` | Dev-owned indicator — assignee avatars, dev-role badge. |

> **Do not** invent a fifth status color for `in_qa`. Use `pending-bg` as the column background with a `pending` text label reading "In QA" — the QA phase is semantically "pending a decision," which the existing token already covers.

### Soft-fill formula (status & severity badges)

Every status/severity badge follows the same computed relationship rather than arbitrary hand-picked pairs: **background is the status color at roughly 12–15% opacity against the surface it sits on, text is the status color at full opacity.** The hex pairs above (`--pass` / `--pass-bg`, etc.) are the pre-computed, hand-tuned values that satisfy this formula against `--bg-alt` — use them directly rather than computing opacity live, since hand-tuning avoids muddy blends on some monitors. If a new status color is ever needed, derive its `-bg` value using this same ~12–15% opacity relationship before hardcoding it.

### Tag colors

Tag colors are **never** drawn from the status palette — status and tags must stay visually distinguishable at a glance.

```css
/* Dark theme */
--tag-slate:   #A3AFBC;  --tag-slate-bg:   #232B33;
--tag-violet:  #A79BF0;  --tag-violet-bg:  #241F3D;
--tag-teal:    #5FC9C9;  --tag-teal-bg:    #16302E;
--tag-rose:    #E491AC;  --tag-rose-bg:    #38202A;
```

```css
/* Light theme */
--tag-slate:   #64748B;  --tag-slate-bg:   #EEF1F4;
--tag-violet:  #7C6FE0;  --tag-violet-bg:  #EFEDFB;
--tag-teal:    #2D9C9C;  --tag-teal-bg:    #E4F5F5;
--tag-rose:    #D65A82;  --tag-rose-bg:    #FBEBF0;
```

---

## Typography

### The governing rule

**If a person typed it, use Inter. If it's structured or system-generated, use JetBrains Mono.** Apply this before consulting any table below.

```css
--mono: 'JetBrains Mono', ui-monospace, monospace;
--sans: 'Inter', -apple-system, sans-serif;
```

### Named type scale

Formalized as discrete tokens — reference these names in code and Stitch prompts rather than raw pixel values, so a scale adjustment only happens in one place.

| Token | Font | Size | Weight | Line height | Letter spacing | Use |
|-------|------|------|--------|-------------|-----------------|-----|
| `display-mono` | JetBrains Mono | 20px | 600 | 28px | -0.02em | Page titles |
| `headline-mono` | JetBrains Mono | 16px | 500 | 24px | normal | Section headers, modal titles |
| `code-sm` | JetBrains Mono | 12px | 400 | 18px | normal | Environment strings, inline code, JSON blocks |
| `label-mono` | JetBrains Mono | 12px | 500 | 16px | 0.02em | Table headers, status/severity badge text, issue key (e.g. "VER-042") |
| `body-md` | Inter | 14px | 400 | 22px | normal | Default body copy, comments, descriptions |
| `body-sm` | Inter | 13px | 400 | 20px | normal | Secondary content, dense table cells, issue summary text |

### Application mapping

| Element | Token |
|---------|-------|
| Ticket ID (`VER-042`) | `label-mono` |
| Page/section titles | `display-mono` / `headline-mono` |
| Timestamps, dates | `label-mono` or `code-sm` |
| Environment strings (`Chrome 128 / macOS 14`) | `code-sm` |
| Table column headers | `label-mono` |
| Status/severity pill labels | `label-mono` |
| Issue row: ticket key | `label-mono` at 12px |
| Issue row: summary/title | `body-sm` (Inter) at 13-14px |
| Ticket title (detail view) | `headline-mono` for the container, but the title text itself is Inter — see note below |
| Ticket description, steps to reproduce | `body-md` |
| Comments | `body-md` |
| Button and nav labels | `body-md` or `body-sm` depending on density |
| Empty states, error messages | `body-md` |
| Form field labels | `body-sm` |

> Note on ticket titles: the ticket ID/key is always mono, but the title text a human wrote (e.g. "Login button unresponsive on mobile Safari") is always Inter — even though it sits directly next to a mono ticket ID. This is the one place the two fonts sit side by side in the same row, and that's intentional: it visually reinforces the system-data vs. human-data distinction at the exact point where both meet.

### Issue-row density (list/table views)

For high-density horizontal layouts — the QA triage list, project member tables, import preview rows: `label-mono` at 12px for the issue key column, `body-sm` at 13-14px Inter for the summary column. Keep these two sizes distinct even in the same row; do not normalize them to one size for visual tidiness — the size difference is part of what makes the key scannable at a glance.

---

## Spacing Scale

Strict 4px base grid — every margin, padding, and component height is a multiple of 4px, no arbitrary values.

```css
--space-1:  4px;   /* xs */
--space-2:  8px;   /* sm */
--space-3:  12px;
--space-4:  16px;  /* md */
--space-5:  20px;
--space-6:  24px;  /* lg */
--space-8:  32px;  /* xl */
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Semantic aliases

| Alias | Value | Use case |
|-------|-------|----------|
| `xs` | `--space-1` (4px) | Icon-to-label gap |
| `sm` | `--space-2` (8px) | Tight groupings — a label and its input, badge internal padding |
| `md` | `--space-4` (16px) | Standard internal padding within cards/containers — the default rhythm |
| `lg` | `--space-6` (24px) | Section padding (modal, panel), gap between page sections |
| `xl` | `--space-8` (32px) | Page-level horizontal padding |
| `gutter` | `--space-4` (16px) | Gap between grid items — Kanban columns, dashboard cards |
| `margin-page` | `--space-6` (24px) | Outer page margin on the main content area |

---

## Radius & Elevation

```css
--radius-sm: 6px;    /* badges, tags, checkboxes — kept sharp within dense rows */
--radius:    10px;   /* buttons, text inputs, cards — primary radius */
--radius-lg: 14px;   /* modals and high-level dialogs only — visually distinct from the background grid */
--radius-full: 999px; /* avatars, status dots */
```

No shadows on resting elements — see [Layer naming](#layer-naming-elevation-without-shadows) above. The two exceptions (dragging card, open modal) use:

```css
--shadow-drag: 0 8px 24px rgba(0, 0, 0, 0.35);   /* dragging a Kanban card, dark theme */
--shadow-modal: 0 12px 32px rgba(0, 0, 0, 0.45); /* open modal, dark theme */
```

(Lighter-theme equivalents: reduce opacity to ~0.12 and ~0.16 respectively — dark backgrounds need a stronger shadow to read at all.)

---

## Iconography

**Library: `lucide-react`.**

| Rule | Detail |
|------|--------|
| Stroke width | `1.5px` standard |
| Size | 16px inline with text, 20px for primary navigation/standalone icons |
| Color | Inherits `currentColor` — never hardcoded |

### Icon reference (issue-related)

| Concept | Icon |
|---------|------|
| Severity: low | `ChevronDown` (single, muted) |
| Severity: medium | `Minus` |
| Severity: high | `ArrowUp` |
| Severity: critical | `AlertOctagon` |
| Environment | `Monitor` |
| Steps to reproduce | `ListOrdered` |
| Test case link | `FlaskConical` |
| Comment | `MessageSquare` |
| Status history / audit log | `History` |
| Import | `Upload` |
| MCP / agent activity | `Bot` (rendered distinctly from human avatars — see Component Patterns) |
| API token | `KeyRound` |
| Team switcher | `ChevronsUpDown` |

---

## Application Shell

> New in v2.0 — this structure previously only existed in the Stitch prompt document. It's canonical here now.

The shell inverts a common dashboard default: **the sidebar carries team identity and project switching; the header carries the current project's context and page-level actions.** This split exists because team-switching is infrequent (you pick a team and stay there for a session) while project-level actions (search, new issue, role view) happen constantly and need to be reachable without leaving the current screen's visual context.

### Sidebar (Layer 1, `--bg-alt`, fixed width 240px)

Top to bottom:
1. **Team switcher block** — workspace icon, team name, a small "TEAM" tag, chevron. The whole block is a dropdown trigger for switching teams.
2. **Projects section** — small uppercase `label-mono` header, then a list of project names in the current team. Active project gets `--accent-bg` background + accent-tinted text.
3. **Divider** (`--line`)
4. **Page nav for the active project** — Board, Triage, Report Bug, Import, Members. Icon + label, `--space-3` vertical padding per item. Active page: `--accent-bg` background, accent-orange left border rail, accent-tinted icon/label.
5. **Divider**
6. **Secondary nav group** — MCP Connection, Settings.
7. **User profile row**, pinned to the bottom — avatar, username, settings icon, theme toggle.

### Header (Layer 2, `--surface`, full width, ~60px tall, 1px bottom border)

Left to right:
1. **Breadcrumb** — `Team / Project / Page`, `label-mono`, muted except the final (current) segment.
2. **Role-view dropdown** — accent-outlined pill. For single-role users (dev/qa/tester) this can render as a static label rather than an interactive dropdown, since there's nothing to switch to. For admins, it's a real dropdown: Dev View / QA View / All Views.
3. **Search bar** — center-right, placeholder `Search issues... (Cmd+K)`.
4. **Primary page action** — solid accent-filled button, right-aligned (e.g. "+ New Issue").

### Rule this shell enforces everywhere

Team identity never appears in the header. Project-level nav never appears without sidebar context. If a screen seems to need both team-switching and a page action at once, the team switcher stays in the sidebar — it does not duplicate into the header for convenience. One clear owner per piece of context, always.

### Issue detail is never a shell destination

Per Design Principle 4: opening an issue never replaces the shell. It is always a modal (right-docked, ~480px wide) sitting on top of a dimmed version of the current screen — header, sidebar, and board all remain visible underneath, dimmed. Closing it returns to exactly where the user was, with no navigation event.

---

## Component Patterns

### Status pill

- Background: `{status}-bg`, text: `{status}`, dot: 6px circle in `{status}` color with `--space-2` gap to label
- Padding: `4px 10px`, radius: `--radius-sm`
- Font: `label-mono`, uppercase, letter-spacing per the token

### Severity badge

Fixed 4-step visual weight, not color alone — must remain distinguishable for color-blind users even next to a status pill:

| Severity | Treatment |
|----------|-----------|
| `low` | Outline only, `ink-soft` text, no fill |
| `medium` | `pending-bg` fill, `pending` text |
| `high` | `block-bg` fill, `block` text, bold |
| `critical` | `block` solid fill, `on-accent`-equivalent contrasting text, `AlertOctagon` icon prefix |

### Kanban card (enriched — v2.0)

The single most-repeated, highest-visibility component in the app. Two states:

**Resting:**
```
┌────────────────────────────────┐
│ VER-042                 TC-118  │  ← ticket key (label-mono) + linked test case ref (label-mono, muted), opposite ends
│ Login button unresponsive on    │  ← title, Inter (body-md), bold, 2-line clamp
│ mobile Safari                   │
│                                  │
│ [High]  [Prod]                  │  ← severity badge (solid fill) + environment tag (neutral fill)
│                                  │
│                     🕐2d ago 🔵  │  ← timestamp (label-mono, muted) + gradient assignee avatar
└────────────────────────────────┘
```
- `--surface` background, `1px` border `--line`, `--radius` (10px), `--space-4` padding
- Assignee avatar: colorful gradient fill (blue-to-purple or teal-to-blue), never a flat gray placeholder — this is a deliberate point of visual warmth against the otherwise utilitarian card
- Linked test-case reference omitted entirely (not shown as empty/dash) on cards with no linked test case

**Active / selected** (dragging, or currently focused):
- `3px` solid `--accent` left border replacing the resting border on that edge
- `--shadow-drag` applied
- Background lightens one step toward `--bg-alt`'s inverse — approximately `#212A33` in dark theme
- This is the only card state permitted a shadow — see [Radius & Elevation](#radius--elevation)

### Kanban column

- `--bg-alt` background, header shows `label-mono` uppercase status name + count badge
- Fixed width `320px` desktop, horizontal scroll container on mobile — never percentage-based
- `--space-3` gap between cards

### Issue row (list/table density — QA triage, member lists, import preview)

- `--surface` background, `--line-soft` between rows, no outer card border
- Severity/status conveyed by a small leading color dot in addition to any text label
- Ticket key at `label-mono` 12px, summary at `body-sm` 13-14px Inter — see [Issue-row density](#issue-row-density-listtable-views)
- Row hover: background shifts to `--bg-alt`, or a left accent rail (`--accent`) appears — pick one treatment per screen, don't combine both

### Form input

```css
.input {
  font-family: var(--sans);
  font-size: 13px;
  padding: var(--space-3);
  background: var(--bg);        /* NOT --surface — inputs sit one layer darker than their container */
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--ink);
}
.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-ring);  /* glow, not blur — a crisp 2px ring, no soft blur radius */
}
```

### Button

```css
.button-primary {
  background: var(--accent);
  color: var(--on-accent);   /* dark text on orange in dark theme, white text on orange in light theme */
  border-radius: var(--radius);
  font: var(--sans);
}
.button-secondary {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--ink);
}
```

### Table (import preview, member list)

```css
thead th {
  font: var(--label-mono);
  text-transform: uppercase;
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

Centered, generous vertical padding (`--space-16`): icon (32px, `ink-soft`) → heading (`headline-mono` or Inter semibold `body-md`) → subtext (`body-sm`, `ink-soft`) → single primary action button.

### Toast / notification

Bottom-right, stacked. Success → `pass`, error → `block`, info → `dev`, warning → `pending`. Auto-dismiss 5s except errors (manual dismiss only).

---

## Interaction States

| State | Treatment |
|-------|-----------|
| **Default** | As specified per component above |
| **Hover** | Border/background shifts one layer toward `--bg-alt` (light) or `--accent` for primary actions; cursor `pointer` |
| **Focus** | `box-shadow: 0 0 0 2px var(--accent-ring)` — identical crisp ring across every focusable element, no blur |
| **Active/pressed** | `transform: scale(0.98)` on buttons only, 100ms |
| **Disabled** | `opacity: 0.5`, `cursor: not-allowed`, no hover/focus treatment applies |

### Loading states

- Buttons: replace label with a 14px spinner (`Loader2`, `animate-spin`), fixed button width, no layout shift
- Kanban board initial load: skeleton columns, 3 pulsing card placeholders each
- Import processing: determinate progress bar (WebSocket-driven), never a fake indeterminate spinner when real progress data exists

---

## Motion

### 1. Card drag

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

### 2. Real-time remote update

```css
@keyframes card-remote-update {
  0%   { background: var(--accent-bg); }
  100% { background: transparent; }
}
.card-remote-updated {
  animation: card-remote-update 900ms ease-out;
}
```

### 3. Modal enter/exit (issue detail, report issue)

```css
.modal-backdrop {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: none; /* no blur — dim only, per the flat/no-decoration principle */
  transition: opacity 200ms ease;
}
.modal-panel-right-docked {
  transition: transform 200ms ease-out;
  /* slides in from the right edge; reverses on close */
}
```

### Global rules

- Durations: `100ms` (press) / `150ms` (hover, drag) / `200ms` (modal) / `250ms` (theme toggle) / `900ms` (remote update highlight only)
- Respect `prefers-reduced-motion` — disable drag rotate/scale and the remote-update flash, keep opacity transitions only

---

## Accessibility

| Requirement | Implementation |
|-------------|-----------------|
| Color contrast | `ink`/`ink-soft` on `bg`/`bg-alt`/`surface` meet WCAG AA (4.5:1) in both themes |
| Status conveyed by color alone | Never — every status/severity pill pairs color with text and/or the 4-step weight system |
| Focus visible | Every interactive element gets the `accent-ring` focus state |
| Keyboard-operable Kanban | `@dnd-kit` keyboard sensors — arrow keys move focused card between columns |
| Form labels | Every input has a visible `<label>`, never placeholder-only |
| Live regions | WebSocket-driven board updates announce via `aria-live="polite"` — "Issue VER-042 moved to In QA" |
| Modal focus trap | Issue detail and Report Issue modals trap focus and return it to the triggering element on close |

---

## Tailwind v4 + shadcn/ui Token Mapping

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
  --color-on-accent: var(--on-accent);

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

shadcn/ui components (Base UI) are themed by pointing their CSS variable layer at these same tokens — `--primary` → `--accent`, `--destructive` → `--block`, `--border` → `--line`. Do not introduce a second, parallel token set (Material or otherwise) anywhere in the codebase — this file is the only source of truth for color, and any generation tool's internal theme representation must be checked against it, not merged in wholesale.
