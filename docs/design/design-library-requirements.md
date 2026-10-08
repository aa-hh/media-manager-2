# Design library requirements

What media-manager-2 needs from a component library, so candidates can be scored side by side for [Choose the design library](https://linear.app/aa-hh/issue/AA-15). Drawn from the 26 prototype screens in `design/mediaManager2.pen`, the technology choice ([AA-14](https://linear.app/aa-hh/issue/AA-14): TypeScript, React app built with Vite, Hono server, live updates by server-sent events), pen.dev's design-to-code rules, and the design rules in `.impeccable/surfaces/design-mediamanager2-pen.md`.

## How candidates are scored

1. **Must-haves** are pass or fail. A candidate that fails one is out.
2. **Weighted requirements** are scored 0 to 3 (0 = missing, 1 = possible with a lot of our own work, 2 = supported with some work, 3 = built in and good). Score × weight, summed.
3. Every score cites evidence: the library's docs, source or a small test build. No scores from memory.
4. A library can be combined with a headless table library (TanStack Table) and that pairing scored as one candidate.

## Must-haves

| # | Requirement | Why |
|---|---|---|
| M1 | Works in a React + TypeScript single-page app built with Vite; no dependency on Next.js or server components | Our stack (AA-14) |
| M2 | Styled with Tailwind CSS classes and CSS custom properties; no runtime theme object or CSS-in-JS needed | pen.dev's design-to-code rules: Tailwind only, design variables in CSS custom properties |
| M3 | Fully restylable: square corners, no shadows, 32-36px rows, our colour variables, with no default look we have to fight | The timing-tower look and "colour only what matters" |
| M4 | Screen-reader correct: proper roles, names and announcements | Accessibility floor |
| M5 | Licence that allows open-sourcing the repo (MIT, Apache 2.0 or similar) | The owner may open-source it |
| M6 | Actively maintained: a release in the last 6 months, supports the current React major version | Long-lived project |

## Weighted requirements

### Fit with pen.dev and how we build (weight 3 unless noted)

| # | Requirement | Weight |
|---|---|---|
| W1 | pen.dev has a built-in kit or library file for it, or its components can be rebuilt in pen.dev one-for-one | 3 |
| W2 | We own the component code (copied into the repo) or can override any part of it without forking | 3 |
| W3 | Well known to coding agents: large user base, clear docs, consistent API, so agent-written code comes out right first time | 3 |
| W4 | Tree-shakable, small bundle: only the components used ship to the browser (served from a shared seedbox) | 2 |

### Keyboard (a nice-to-have, per the owner; weight 2)

| # | Requirement | Weight |
|---|---|---|
| W0 | Keyboard-operable components following the WAI-ARIA patterns: arrow keys in lists, tabs, radio groups and menus; Esc closes; focus returns to where it came from | 2 |
| W5 | Components never claim single-letter keys, so the app can map its own per-screen shortcuts (A search, I pick a release, G grab, R replace, S second version, F mark as failed, D expand downloads, [ ] previous and next) | 2 |
| W6 | Range selection with Shift + arrow keys in lists and tables | 2 |
| W7 | Roving focus in dense lists and grids (one Tab stop, arrows move inside) | 2 |
| W8 | Visible, themeable focus indicator on every component | 1 |

### Data-heavy screens (weight 3): release lists, episode tables, downloads, history, blocklist, flagged, manual import, library

| # | Requirement | Weight |
|---|---|---|
| W9 | Table with sorting, grouping (Needs you / Being handled / Everything else), expandable rows and sub-rows (second versions under an episode), row selection | 3 |
| W10 | Column visibility control (the column picker on Downloads and the Library's field picker) | 2 |
| W11 | Virtualised long lists (library of 200+ titles, history of thousands of events) | 2 |
| W12 | Rows update live every few seconds (rTorrent status through server-sent events) without losing focus, selection or an open row | 3 |
| W13 | Editable cells with an inline picker inside a table row (manual import: pick episode, quality, language) | 2 |

### Controls and overlays used on the screens (weight 2 unless noted)

| # | Requirement | Seen on |
|---|---|---|
| W14 | Inline disclosure: a row expands in place to a panel (no modal), and collapsible summary sections | Replace or second version, delete, mark as failed, episode details, history details, health |
| W15 | Combobox / select with typing to filter | Episode picker, quality override, poster fields |
| W16 | Popover and dropdown menu | Field picker, filters, monitoring options |
| W17 | Radio group and segmented toggle group | Radarr delete options, Keep seeding / Remove, view switch |
| W18 | Tabs with counts | Filters on Flagged, History, Library |
| W19 | Tooltip | Grab errors (the one hover-only status the owner chose) |
| W20 | Toast with an action button | "Unblocked … Undo" on the blocklist |
| W21 | Sheet / drawer, including a bottom sheet on phone | Phone release choice, expanding the downloads bar |
| W22 | Dialog (only for the "?" keyboard shortcuts list) | All screens |
| W23 | Checkbox and switch | Selection, monitored on and off |
| W24 | Progress bar, badge, keyboard key chip, breadcrumb, skeleton loading state | Downloads, quality cells, key hints, blocklist, cached search results |
| W25 | Dark theme through CSS variables, with a light theme possible later | Weight 1 |

### Built by us whatever we pick (not scored, listed so nobody expects them from a library)

Calendar week, month and forecast grids; the timing-tower release table styling; poster grid; quality, profile and risk cells; the one-line downloads bar; dimming the rest of the screen while a decision panel is open; the "?" shortcut overlay content.

## Candidates to score

Each candidate without its own table is paired with TanStack Table.

1. shadcn/ui (copied-in components; foundations Base UI (default), Radix or React Aria since July 2026). Has a pen.dev kit.
2. React Aria Components + our own Tailwind styles
3. Base UI + our own Tailwind styles
4. Ark UI + our own Tailwind styles (Park UI uses Panda CSS, not Tailwind)
5. HeroUI (React Aria + Tailwind; a pen.dev kit was found in the installed Pen.app bundle, not on pen.dev's public docs)
6. Our own components on Radix Primitives
7. coss ui (copy-in kit on Base UI; component folders MIT, rest of repo AGPL)
8. Intent UI (copy-in kit on React Aria + Tailwind, installed with the shadcn tool)
9. Untitled UI React (large copy-in kit on React Aria + Tailwind v4; core MIT, PRO paid and excluded)
10. Ariakit (unstyled primitives; no table or toast)

Ruled out on a must-have (sources in the research notes of 8 Oct): Headless UI, JollyUI, Tremor, Flowbite React, Radix Themes, Glide Data Grid (not maintained); Catalyst, Preline (licence); Chakra UI v3, React Spectrum S2, Mantine, MUI (not Tailwind); daisyUI (no behaviour, screen reader); Reka UI, Kobalte (not React). AG Grid is the strongest table alternative to TanStack Table but brings its own theme system.

## Scores from docs and source (8 Oct 2026)

All ten pass the must-haves. Full scoring with sources per candidate in `library-scores/`.

| Rank | Candidate | Score / 165 | Main strength | Main weakness |
|---|---|---|---|---|
| 1 | shadcn/ui + TanStack Table (Base UI default) | 140 (React Aria foundation about 145) | Every control exists, code is ours, pen.dev kit | Table has no keyboard support on Base UI |
| 2 | React Aria Components | 139 | Own table with range select, virtualising, keyboard | No pen.dev kit; toast still unstable |
| 3 | HeroUI | 138 | React Aria underneath, every control, pen.dev kit in the app | Default look to undo (44px rows, card wrappers) |
| 4 | Base UI + TanStack Table | 135 | Covers nearly every control, no styles | No table or list part at all |
| 4 | Own on Radix + TanStack Table | 135 | Code ours, agents know it well | No combobox; 10-month release gap in 2025-26 |
| 6 | Intent UI | 134 | Nearly every control, code ours | One person wrote ~97% of it |
| 6 | coss ui + TanStack Table | 134 | Nearly every control, code ours (MIT folders only) | Rounded corners and shadows built into every component |
| 8 | Ark UI + TanStack Table | 133 | Nearly every control, no look | Table all ours; v6 breaking changes in pre-release |
| 9 | Untitled UI React | 127 | React Aria underneath, code ours | Strongest house look to strip; free table lacks grouping |
| 10 | Ariakit + TanStack Table | 122 | Excellent keyboard patterns, small | Many parts missing; still 0.x |

Shared finding: React Aria based tables jump to a matching row when a letter key is typed and this can't be turned off, so app-level letter shortcuts must run first.
