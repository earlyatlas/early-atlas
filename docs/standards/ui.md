# UI & styling standards

The UI is built for **human visitors** (parents, educators). The MCP gateway is
the surface for AI agents. These are separate audiences — keep them separate.

## Product rules

- **No authoring metadata in the human UI.** No ids, status pills, kind/type
  tags, schema vocabulary, or developer descriptions of the data model. Show the
  content a visitor came for. (Ids may appear in URLs and in the dev-only editor.)
- **No filler copy.** Don't add sentences that explain the system to the user.
  Every line on screen should mean something to a parent or educator.
- **Content first.** Titles, plain descriptions, what mastery looks like, how to
  observe it, activities, and associated videos — that is the page.

## Styling architecture

**Tokens are the contract; everything else is a cascade layer by reach.** We do
not use Sass or the 7-1 pattern — Astro gives us component scoping, and native CSS
`@layer` gives ITCSS-style ordering without specificity wars.

**Files** (`apps/web/src/styles/`), imported once by `global.css`:

```
tokens.css            settings — color/space/type/radius custom properties (UNLAYERED)
base.css              @layer base       — reset, document, headings, forms, focus
layout.css            @layer layout     — app shell: header, grid, sidebar, content, TOC
components/*.css       @layer components — filters, tree, chips, milestones, record…
utilities.css         @layer utilities  — .muted, .clean, single-purpose helpers
print.css             UNLAYERED         — paper handout overrides (intentional !important)
```

`global.css` declares the order `@layer base, layout, components, utilities;` then
`@import`s the partials. Later layers win regardless of source order or specificity.

**Where a new style goes — decide in this order:**

1. **A token?** Color/space/radius/type → add to / reuse `tokens.css`. Never a raw
   hex; the `color-no-hex` stylelint rule (`pnpm lint:css`, in `pnpm check`)
   enforces it. Prefer the `--space-*` scale for spacing.
2. **A self-contained, server-rendered component** (its own `.astro`, markup not
   built by client JS, classes not shared) → an **Astro scoped `<style>`** in that
   component. Scoped styles are unlayered, so they win over the global layers.
   Example: the PDF action in `pages/r/[id].astro`.
3. **Shared, or rendered by client JS** → the matching `@layer components` file in
   `styles/components/`. The browse tree and the Milestones cards are built via
   `innerHTML`, so Astro scoping can't reach them — their styles **must** be global.
4. **Base element / shell / utility** → `base.css` / `layout.css` / `utilities.css`.

Keep class names component-prefixed (`.ms-*`, `.node-*`). One concern per file; if
`global.css`'s imports grow, split a component file, don't fatten one.

**Theming.** `[data-theme]` on `<html>`; dark is default, light is a toggle, choice
persists in `localStorage`. Both themes must hold contrast ≥ WCAG AA.

**Accessibility.** Semantic HTML, real `<button>`/`<a>`, visible `:focus-visible`,
`alt` text, labelled controls, `prefers-reduced-motion` honored, ≥44px touch targets.

**Performance & privacy.** Third-party embeds (YouTube) use a click-to-load facade —
nothing loads from the provider until the user opts in (`components/VideoEmbed.astro`).

**Design quality.** Avoid AI-slop anti-patterns — side-stripe accent borders,
gradient text, default glassmorphism, identical card grids, and uppercase tracked
eyebrows on every section. Favor restraint, hierarchy, and intentional spacing.

## Layout (wiki shell)

The app is a wiki, not a marketing page. Every page renders inside `Base.astro`'s
shell: a sticky header, a persistent left **sidebar** nav tree (domains → lessons,
with active-state highlighting, built from `lib/nav.ts`), the content column, and
an optional right **"on this page"** rail. Record pages add breadcrumbs and split
content into anchored `<section id>`s; provide the rail by filling the `toc` slot
(the shell shows it only when present). Keep prose within `--prose`; let the
sidebar and grid fill the width so there's no dead space. The sidebar is
off-canvas on mobile.

## Growth

New surfaces should be composed from tokens + small Astro components so the app
stays consistent as it scales to many pages and contributors.
