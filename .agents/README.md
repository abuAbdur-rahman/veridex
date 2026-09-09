# Veridex

**A QA-aware issue tracker for dev, QA, and test teams — one board, three views, no more shared spreadsheet.**

> Status: concept + design foundation complete (landing page, design spec). Data model and application build are the next phase.

---

## 1. Why this project exists

This project has two intertwined purposes, and both matter for anyone picking it up:

1. **A real product idea.** The founder previously worked at a company that tracked bugs and QA issues in a shared Excel file (`issues_master_FINAL_v3.xlsx` — a real filename pattern from that experience). That setup broke down in predictable ways: no status history, unclear ownership between dev/QA/testers, repro steps buried in comments if they existed at all, version conflicts when multiple people edited the file, and no link between a bug and the test case that caught it. Veridex is the tool that should have existed instead.
2. **A portfolio differentiator.** The founder is a web developer rebuilding their portfolio after a layoff, in a job market where AI tools have raised the bar for what counts as an impressive project. Generic Kanban clones and admin dashboards are commoditized — every bootcamp grad has built one. Veridex is deliberately scoped to avoid that trap: it has a specific, personally-witnessed origin story, a non-generic domain (QA workflows, not generic task management), and an MCP integration that demonstrates a skill most junior/mid-level developers don't have yet (building the *agent-operable* side of a product, not just consuming an LLM API).

**If you are an agent or collaborator picking this up:** the differentiation strategy is as important as the feature list. Any feature or copy decision should be checked against "does this make the project feel more like a generic project-management clone, or does it sharpen the specific QA/Excel-replacement story?" When in doubt, favor the sharper, more specific version.

---

## 2. Who it's for

Three roles, one shared board:

- **Dev** — owns fixing the issue. Cares about: what's assigned to them, repro steps, environment details.
- **QA** — owns verifying the fix. Cares about: what's awaiting verification, severity, linked test cases.
- **Tester** — owns catching and confirming issues. Cares about: what needs a retest, reproducibility.

The core design idea is **one underlying ticket, filtered differently per role** — not three separate tools that need to be reconciled, and not a generic single view that ignores what each role actually needs to see day to day.

It's also designed to flex down to **a single developer's personal task/progress tracker** (a normal Kanban/todo board) if the QA-specific fields are left empty — but this is a side-effect of a flexible schema, not a primary marketing angle. Don't let "it's also a todo app" dilute the sharper QA-specific pitch in any user-facing copy.

---

## 3. The core problem it solves

Replacing ad-hoc spreadsheet-based issue tracking with a structured, role-aware, historically-accurate system. Specifically:

| Spreadsheet pain point | Veridex's answer |
|---|---|
| No status history — a cell just changes, silently | Every status transition is logged: who changed it, when, from what to what |
| No clear ownership between dev/QA/tester | Role-based views built into the core data model, not bolted on |
| Repro steps buried in a comment, if present at all | Structured fields: severity, environment, steps to reproduce |
| Version conflicts when multiple people edit at once | Single live source of truth, not a file people email around |
| No link between a bug and the test case that caught it | Explicit test-case linkage on every ticket |

---

## 4. Feature set

### Core (MVP)
- **Kanban-style board** with a QA-aware workflow, not generic "To Do / Doing / Done": Backlog → In Progress → In QA → Verified (columns should reflect real QA handoffs, not generic project-management defaults)
- **Structured ticket model**: severity, environment (browser/OS/device), steps to reproduce, linked test case, full status-change history
- **Role-based views**: same underlying tickets, filtered by lens — "assigned to me" (dev), "awaiting verification" (QA), "needs retest" (tester)
- **Spreadsheet import**: upload an existing messy tracking sheet; column headers get mapped into structured ticket fields automatically (this is a direct answer to the Excel origin story — treat it as a headline feature, not an afterthought)

### Differentiators
- **MCP server integration**: exposes tools (create/read/update/delete/assign issues, change status) so an AI agent — e.g. Claude Code — can operate the tracker directly from a developer's editor or terminal, without opening a browser tab. This is the single highest-leverage feature for the portfolio-differentiation goal described in §1.
- **AI-assisted triage** (optional/stretch): auto-suggest severity from a free-text bug description; auto-summarize a long comment/status thread into "what's the current blocker." Should be tied to a real workflow moment, not added as a generic chatbot bolt-on.

### Explicitly out of scope for now
- Notifications system
- Multi-project/workspace support
- Complex permission systems beyond the three core roles

Keep the build tightly scoped to what's listed above before adding anything new — depth and polish on a small feature set outperforms a wide, shallow feature list, both for the real product and for the portfolio narrative.

---

## 5. Naming

**Veridex** — from *veri-* (Latin root for "true"), combined with an "-index/-dex" ending evoking tracking and record-keeping. Chosen deliberately as an English/abstract name (as opposed to the Arabic-rooted naming pattern used in the founder's other portfolio projects, Manhaj and Sahnaf), evoking trust and reliability — fitting for a tool whose entire purpose is being a source of truth a team can actually rely on.

This name has **not** been verified against existing trademarks, npm package names, or domain availability — do that before treating it as final if this project moves toward being publicly shipped or listed on a resume/portfolio site.

Alternate names considered, if a rename is ever needed: Certane, Stabli, Fidelo, Trestle.

---

## 6. Design system

A design spec has already been built out (see `veridex-spec.html`) covering the foundation. Summary for quick reference:

### Two independent color systems
- **Status colors** — describe a fact about a ticket. Never repurpose these for interaction states.
  - `pass` (teal-green) — verified
  - `pending` (amber) — medium severity / in review
  - `block` (brick red) — high severity / blocked
  - `dev` (blue) — dev-owned
- **Accent color** (orange) — describes what's interactive: buttons, active nav, selected rows/cards, links, focus rings. Carries no status meaning.
- **The governing rule**: status answers "what is this ticket," accent answers "what can I click / what did I just select." A ticket can be both `pending` and `selected` simultaneously — these are independent facts and must never collapse into a single color.
- Full light and dark theme values are defined as CSS custom properties in the existing HTML artifacts and should be treated as the source of truth for any future UI work.

### Two-font type system
- **JetBrains Mono** — for anything that is structured or generated data: page/section titles, ticket IDs, timestamps, environment strings, table/board data columns.
- **Inter** — for anything a person actually wrote: ticket descriptions, comments, repro steps, button/nav labels.
- **The governing rule**: *if it's typed by a person, use Inter; if it's structured/generated data, use JetBrains Mono.* This single rule should resolve any future typography decision without needing to revisit the whole system.

---

## 7. What exists today

- `veridex.html` — a marketing/showcase landing page explaining the product's purpose, problem, workflow, and MCP capability to an outside viewer (e.g. a recruiter or early user). Includes a light/dark theme toggle and an animated visual literally transforming a messy spreadsheet row into a structured ticket card, as a direct visual callback to the origin story.
- `veridex-spec.html` — page one ("Colors & Fonts") of an internal design specification meant to keep any future UI work consistent. Structured to be extended with additional spec pages (e.g. spacing/layout, components) as the project grows.

## 8. What's next

Recommended build order for whoever (human or agent) picks this up next:

1. **Data model** — formalize the ticket schema (fields, status-history structure, role/permission model, test-case linkage) before writing any application code.
2. **Core board + role views** — the MVP Kanban experience described in §4.
3. **Spreadsheet import** — the direct Excel-replacement feature; the differentiator most tied to the origin story.
4. **MCP server** — expose the CRUD/status tools described in §4; this is the highest-value feature for the portfolio-differentiation goal.
5. **AI-assisted triage** — optional, only if time allows and it can be tied to a genuine workflow moment rather than added as a generic AI feature.
6. Additional design-spec pages (spacing/layout, components) as the actual UI gets built out, to keep pace with implementation.

---

## 9. Portfolio framing (for README/case-study writing later)

When this project is written up for the portfolio, lead with the origin story, not the tech stack:

> "At a previous company, QA and dev teams tracked bugs in a shared Excel file — no status history, no ownership clarity, no link between a bug and the test case that caught it. I built Veridex to replace that with a lightweight, role-aware tracker — including an MCP server so the tracker can be operated directly by an AI coding agent, not just through a browser."

Any case-study write-up should highlight: the specific real-world pain point (not a hypothetical), the one or two hardest technical/design decisions (e.g. structuring role-based views off one shared data model, or the spreadsheet-column-mapping logic for import), and the MCP integration as evidence of AI-native (not AI-replaceable) engineering skill.
