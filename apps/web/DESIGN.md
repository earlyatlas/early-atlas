# Design

Visual system for Early Atlas. Source of truth is `src/styles/tokens.css`
(consumed by `src/styles/global.css`). Components must use tokens, never literals.
Theme is driven by `[data-theme]` on `<html>`; **dark is the default**.

## Theme / Vibe

Calm, grounded, library-like. A quiet content tool: low-chroma surfaces, one cool
accent, generous space, system typography. Warmth comes from softness and copy, not
from color saturation or childish motifs. Dark-first, with a clean light mode.

## Color (tokens)

Defined per theme. Roles: `--bg` (page), `--surface` / `--surface-2` (raised /
inset), `--ink` (body text), `--muted` (secondary text), `--line` (hairlines),
`--accent` + `--accent-ink` / `--accent-soft` / `--accent-border` (single accent
family), `--header`, and notice pairs (`--notice-ok*`, `--notice-bad*`).

| Role                  | Dark                   | Light                 |
| --------------------- | ---------------------- | --------------------- |
| bg                    | `#0f1420`              | `#fbfcfe`             |
| surface / surface-2   | `#161c2b` / `#1b2233`  | `#ffffff` / `#f3f5fa` |
| ink                   | `#e6e9f0`              | `#1c2333`             |
| muted                 | `#98a2b8`              | `#5a6478`             |
| line                  | `#242c3e`              | `#e2e6ee`             |
| accent                | `#7d97ff` (periwinkle) | `#3a5bd9` (blue)      |
| accent-soft / -border | `#1b2440` / `#2c3a63`  | `#eef1fb` / `#dde3fa` |

Strategy: **restrained** — tinted-neutral surfaces + one accent used sparingly
(links, the active state, type/method chips, the expand control). Identity color is
the cool periwinkle/blue accent; preserve it. Colors are authored as hex today.

## Typography

- Families: `--font-sans` = system UI stack (system-ui / -apple-system / Segoe UI /
  Roboto); `--font-mono` for code. No custom/brand font yet.
- Scale (rem): `--text-sm .875` · `--text-base 1` · `--text-lg 1.15` · `--text-xl 1.6`.
  h1 = xl (1.6rem, line-height 1.2); h2 = lg. Body line-height 1.55. Measure capped
  at `--prose 70ch`. (Hierarchy is currently shallow — a known polish target.)

## Spacing & Radius

- Space scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 (`--space-1`…`--space-7`).
- Radius: `--radius-sm 6` · `--radius-md 10` · `--radius-pill 999`.
- Elevation: `--shadow-1` (subtle), `--shadow-2` (raised/hover). Used sparingly.

## Layout

App shell is a CSS grid: `--sidebar-w 248px` (left nav) · content `minmax(0,1fr)` ·
optional `--toc-w 200px` ("on this page" rail), centered at `--shell-max 1280px`,
sticky header `--header-h 56px`. Collapses to a single column with a drawer nav on
mobile.

## Components

- **Browse tree** — `details`/`summary` nodes (domain → skill → leaf) sharing one
  `.node-row`: an expand toggle (`.node-toggle`), a title link (`.node-link`), and a
  type tag (`.node-type`); uniform title size, hierarchy via nesting + tag.
- **Filters** — age input, stage/area `select`, keyword box, facet chips (`.hint`,
  `.chip-selected`).
- **Chips** — `.chip` (tags), `.chip.method` ("Inspired by"), `.node-type`,
  `.kind-eyebrow` (record-type badge).
- **Record pages** — breadcrumb, kind badge, title, age, chips, sectioned content,
  right-hand TOC rail, print-to-PDF.
- **Milestones** — age input + area select → goal cards (`.ms-goal`, `.ms-now`,
  `.ms-next`, `.ms-tag`).
- **Notices** — `.disclaimer` (currently uses a left side-stripe — flagged for
  rework; side-stripe accents are an anti-pattern here).

## Motion

Minimal today: chevron rotation on expand, small hover transitions. No motion
system yet. Any added motion must ship a `prefers-reduced-motion` alternative.

## Accessibility

Target WCAG AA. Dark + light themes. Body text must hold ≥4.5:1; verify `--muted`
on tinted surfaces. Touch targets ≥44px (phone-first audience). Reduced-motion respected.
