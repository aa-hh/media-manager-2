# Intent UI (slug `intent-ui`)

Copy-in kit on React Aria Components (RAC) + Tailwind v4, installed with `npx shadcn@latest add @intentui/<name>`. Repo default branch `3.x`. Scored with its own Table (built on RAC Table); TanStack Table can still feed it for grouping and column state.

Correction to the brief: Intent UI does publish GitHub releases (30 of them). Latest v3.8.9 on 22 Sep 2026; last commit 7 Oct 2026.

## 1. Must-haves

| # | Verdict | Evidence | Source |
|---|---|---|---|
| M1 | pass | Official Vite guide: `npm create vite@latest`, Tailwind Vite plugin, then `npx shadcn@latest init @intentui/theme-default`. Components carry `"use client"` (harmless outside Next.js); no `next` imports in the 23 component files checked. The repo's own `next` dependency is the docs site only. | https://github.com/irsyadadl/intentui/blob/3.x/src/content/docs/getting-started/vite.mdx |
| M2 | pass | Tailwind classes plus `tailwind-variants`; theme is CSS custom properties (`--color-bg: var(--bg)`, `--primary: oklch(...)`, `--radius`). No theme object. Toast passes CSS variables to Sonner via `style`. | https://github.com/irsyadadl/intentui/blob/3.x/src/styles/themes/zinc.css |
| M3 | pass | Code is copied into our repo. Corners mostly follow `--radius` (set to 0 for square), but 15 `rounded-full` and 16 hard-coded `shadow-*` classes in the files checked need hand edits; row height is `py-(--gutter-y)`, a variable. Drawer has a hard-coded `rounded-t-2xl` and blur overlay. Work, not a fight. | https://github.com/irsyadadl/intentui/blob/3.x/src/components/ui/table.tsx |
| M4 | pass | Behaviour and ARIA come from React Aria Components (Table, Menu, ComboBox, Dialog etc.); Toast uses Sonner, which renders a live region. | https://react-aria.adobe.com/Table |
| M5 | pass | MIT licence (GitHub API `license.spdx_id = MIT`). | https://github.com/irsyadadl/intentui/blob/3.x/LICENSE |
| M6 | pass | Release v3.8.9 on 22 Sep 2026; commits on 6-7 Oct 2026; built against `react ^19.2.6`, `react-aria-components ^1.18.0`. | https://github.com/irsyadadl/intentui/releases |

## 2. Weighted requirements

| # | Score | Weight | Points | Reason | Source |
|---|---|---|---|---|---|
| W0 | 3 | 2 | 6 | RAC implements the WAI-ARIA patterns: arrows in lists, menus, tabs, radios; Esc closes; focus returns. | https://react-aria.adobe.com/Table |
| W1 | 1 | 3 | 3 | No pen.dev kit (not among shadcn/ui, HeroUI, Halo, Lunaris, Nitro); visuals are plain Tailwind so a hand rebuild is possible. | brief; https://intentui.com |
| W2 | 3 | 3 | 9 | Components are copied into the repo by the shadcn tool; `-o` re-pulls upstream. | https://github.com/irsyadadl/intentui/blob/3.x/src/content/docs/getting-started/installation.mdx |
| W3 | 2 | 3 | 6 | ~1,960 GitHub stars (small user base), but RAC's API is well documented and the repo ships `llms.txt` and a Context7 config. | https://github.com/irsyadadl/intentui |
| W4 | 2 | 2 | 4 | Only copied components ship; RAC imported per subpath (`react-aria-components/Table`). Drawer/sheet pull in `motion`, a heavy animation library. | https://github.com/irsyadadl/intentui/blob/3.x/src/components/ui/drawer.tsx |
| W5 | 2 | 2 | 4 | RAC collections do type-to-select on letters while focused; RAC Table and GridList accept `disallowTypeAhead` (in source, not in Table docs). Menus and list boxes still need checking. | https://github.com/adobe/react-spectrum/blob/main/packages/react-aria-components/src/Table.tsx |
| W6 | 2 | 2 | 4 | RAC selection docs say Shift can extend multiple selection; Shift+Arrow range not stated explicitly (unverified). | https://react-aria.adobe.com/selection |
| W7 | 3 | 2 | 6 | RAC Table, GridList, ListBox use one Tab stop with arrow navigation inside. | https://react-aria.adobe.com/Table |
| W8 | 3 | 1 | 3 | `focus-visible:ring-ring` throughout, driven by a CSS variable. | https://github.com/irsyadadl/intentui/blob/3.x/src/components/ui/table.tsx |
| W9 | 2 | 3 | 6 | Sorting, row selection, nested expandable rows (`expandedKeys`, tree column) built in; no row grouping or table sections, so the three groups are built as parent rows or via TanStack grouping. | https://intentui.com/docs/components/collections/table ; https://react-aria.adobe.com/Table |
| W10 | 2 | 2 | 4 | Columns are dynamic RAC collections; no column picker, build one from Intent's Menu with checkbox items. | https://react-aria.adobe.com/Table |
| W11 | 2 | 2 | 4 | RAC `Virtualizer` with `TableLayout` virtualises Table; Intent's table wrapper does not wire it (only an infinite-scroll example), so we add it. | https://react-aria.adobe.com/Virtualizer |
| W12 | 2 | 3 | 6 | Rows keyed by id; selection and expanded rows are key sets that survive data changes. Not tested under live updates (unverified). | https://react-aria.adobe.com/Table |
| W13 | 2 | 2 | 4 | RAC documents interactive cells (TextField with `keyboardNavigationBehavior="tab"`); Select/ComboBox in a cell not documented. | https://react-aria.adobe.com/Table |
| W14 | 2 | 2 | 4 | `disclosure-group` covers collapsible sections; a row opening into a full-width panel inside the table needs our own work. | https://github.com/irsyadadl/intentui/tree/3.x/src/components/ui |
| W15 | 3 | 2 | 6 | `combo-box` (type to filter) and `select`. | https://intentui.com/docs/components/pickers/combo-box |
| W16 | 3 | 2 | 6 | `popover`, `menu`, `dropdown`, `context-menu`. | https://github.com/irsyadadl/intentui/tree/3.x/src/components/ui |
| W17 | 3 | 2 | 6 | `radio` and `toggle-group`. | https://github.com/irsyadadl/intentui/tree/3.x/src/components/ui |
| W18 | 2 | 2 | 4 | `tabs` exists; counts by putting a `badge` in the tab. | https://github.com/irsyadadl/intentui/blob/3.x/src/components/ui/tabs.tsx |
| W19 | 3 | 2 | 6 | `tooltip` on RAC Tooltip. | https://github.com/irsyadadl/intentui/blob/3.x/src/components/ui/tooltip.tsx |
| W20 | 3 | 2 | 6 | Toast is Sonner, which supports an action button. Its wrapper imports a `theme-provider` we must supply. | https://github.com/irsyadadl/intentui/blob/3.x/src/components/ui/toast.tsx |
| W21 | 3 | 2 | 6 | `sheet` and `drawer` (`side="bottom"`). | https://github.com/irsyadadl/intentui/blob/3.x/src/components/ui/drawer.tsx |
| W22 | 3 | 2 | 6 | `dialog` and `modal`. | https://github.com/irsyadadl/intentui/tree/3.x/src/components/ui |
| W23 | 3 | 2 | 6 | `checkbox` and `switch`. | https://github.com/irsyadadl/intentui/tree/3.x/src/components/ui |
| W24 | 3 | 2 | 6 | `progress-bar`, `badge`, `keyboard` (RAC Keyboard), `breadcrumbs`, `skeleton` all present. | https://github.com/irsyadadl/intentui/tree/3.x/src/components/ui |
| W25 | 3 | 1 | 3 | Themes as CSS variables; dark mode guide for Vite. | https://github.com/irsyadadl/intentui/blob/3.x/src/content/docs/dark-mode/vite.mdx |

## 3. Total

134 / 165.

## 4. What we would build on top of it

- Strip rounded corners, shadows, blur overlay and motion animations from copied components (square, flat look).
- Table: grouping into Needs you / Being handled / Everything else, column picker, Virtualizer wiring, a row that opens into an inline panel, Select/ComboBox inside cells.
- Turn off type-to-select wherever it clashes with single-letter shortcuts.
- A theme provider for the toast wrapper, or edit it out.
- Our own pen.dev components (no kit).
- Everything in the requirements' "built by us whatever we pick" list.

## 5. Biggest risk

One maintainer and about 2,000 stars: if he stops, we own every copied file with no upstream, and agents know it far less well than shadcn/ui.
