# coss ui + TanStack Table

coss ui (coss.com/ui, repo github.com/cosscom/coss, formerly Origin UI, now owned by Cal.com). Components are copied into our repo with the shadcn command-line tool (`npx shadcn@latest add @coss/<name>`), built on Base UI (`@base-ui/react` 1.8.0) and Tailwind v4. Paired with TanStack Table for data tables. Checked 8 Oct 2026.

## Licence (checked in detail)

- Repo default is AGPL-3.0 (GitHub licence field; https://github.com/cosscom/coss/blob/main/LICENSE).
- https://github.com/cosscom/coss/blob/main/LICENSING.md makes `apps/origin/` and `apps/ui/` and their subfolders MIT.
- The components the shadcn tool copies come from `apps/ui/registry/default/` (ui, base-ui, hooks, lib, particles), so they are MIT. https://github.com/cosscom/coss/tree/main/apps/ui/registry/default
- `packages/ui/src` holds the same files, but it is a generated copy written by `apps/ui/scripts/sync-ui.mts` (source `registry/default`, target `../../packages/ui/src`). It sits outside the MIT folders, so by the repo's wording it falls under the AGPL default. It is not published on npm (`@coss/ui` returns "Not found" on registry.npmjs.org). The get-started page suggests importing from `@coss/ui/base-ui/*`; we must not do that, only copy from the registry. https://github.com/cosscom/coss/blob/main/apps/ui/scripts/sync-ui.mts
- `apps/ui` has no LICENSE file of its own; the MIT text with a copyright line is only in `apps/origin/LICENSE.md`. We should keep a notice file crediting coss / Cal.com next to the copied components.
- Base UI: MIT (npm). TanStack Table: MIT (npm).

## 1. Must-haves

| # | Verdict | Evidence | Source |
|---|---|---|---|
| M1 | pass | Install is the shadcn tool into any React + Tailwind v4 project; none of the 53 component files imports `next` or `next-themes` (scanned every file in `registry/default/ui`). Docs assume Next.js for fonts (`layout.tsx`, `next/font`), which we replace with plain CSS. | https://github.com/cosscom/coss/blob/main/apps/ui/content/docs/(root)/get-started.mdx |
| M2 | pass | Tailwind classes plus CSS variables with the same names as shadcn/ui ("The variables are the same as shadcn/ui, and are fully customizable"); no theme object. | same get-started.mdx, lines 62-64 |
| M3 | pass (with work) | Code is ours after copying, so anything can change. Default look fights us: `button.tsx` uses `rounded-lg`, `shadow-xs`, coloured shadows; `table.tsx` card variant has `rounded-xl` and inset shadows. Expect a pass over every file to strip corners and shadows. | https://github.com/cosscom/coss/blob/main/apps/ui/registry/default/ui/button.tsx, .../ui/table.tsx |
| M4 | pass | Interactive parts are Base UI primitives (roles, labels, focus handling); table is native `<table>` markup. | https://base-ui.com/react/overview/accessibility |
| M5 | pass | Copied components are MIT (see Licence section). AGPL applies to the rest of the repo, which we never copy. | https://github.com/cosscom/coss/blob/main/LICENSING.md |
| M6 | pass | No GitHub releases; components ship through the registry. Changelog entries 19 Aug, 31 Jul, 26 Jul, 22 Jun 2026; component commits 30 Sep, 16 Sep, 7 Sep 2026; repo pushed 7 Oct 2026. Built against React 19.2; Base UI 1.8.0 released 4 Sep 2026, peer React 17-19. | https://github.com/cosscom/coss/commits/main/apps/ui/registry/default/ui, https://coss.com/ui/docs/changelog, https://www.npmjs.com/package/@base-ui/react |

All six pass.

## 2. Weighted scores

| # | Score | Weight | Total | Reason | Source |
|---|---|---|---|---|---|
| W0 | 3 | 2 | 6 | Base UI follows the WAI-ARIA patterns for menu, tabs, radio group, select, dialog (Esc, focus return). | https://base-ui.com/react/overview/accessibility |
| W1 | 1 | 3 | 3 | No pen.dev kit. Uses the same CSS variable names as shadcn/ui, so pen.dev's shadcn kit variables carry over, but component shapes differ and must be rebuilt by hand (unverified how close). | get-started.mdx lines 62-64 |
| W2 | 3 | 3 | 9 | Copy-in: files land in our repo via the shadcn tool. | https://coss.com/ui/docs/get-started |
| W3 | 2 | 3 | 6 | 10.7k GitHub stars, much smaller than shadcn/ui, but same file layout and tool as shadcn and ships an agent skill (`npx skills add cosscom/coss`) covering all 53 primitives. Base UI ~19M weekly npm downloads. | https://github.com/cosscom/coss/tree/main/apps/ui/skills, https://api.npmjs.org/downloads/point/last-week/@base-ui/react |
| W4 | 3 | 2 | 6 | Only copied files ship; Base UI imported per component (`@base-ui/react/menu` etc). | https://github.com/cosscom/coss/blob/main/apps/ui/registry/default/ui/drawer.tsx |
| W5 | 2 | 2 | 4 | Scanned all component files: only key handler is the sidebar's Cmd/Ctrl + B. Base UI menus and selects match typed letters only while open (not confirmed for every primitive). | https://github.com/cosscom/coss/blob/main/apps/ui/registry/default/ui/sidebar.tsx |
| W6 | 1 | 2 | 2 | Neither coss nor TanStack Table provides Shift + arrow range selection; TanStack has the row-selection state, we write the keys. | https://tanstack.com/table/latest/docs/guide/row-selection |
| W7 | 1 | 2 | 2 | Roving focus exists in Base UI toolbar, tabs, radio group, menus, but not in the table; one-Tab-stop grid is ours to build. | https://base-ui.com/react/components/toolbar |
| W8 | 2 | 1 | 2 | `focus-visible:ring-2 ring-ring` in button, checkbox, tabs, menu (checked those four, not every file); colour from `--ring`. | https://github.com/cosscom/coss/blob/main/apps/ui/registry/default/ui/button.tsx |
| W9 | 3 | 3 | 9 | TanStack Table has sorting, grouping, expanding, sub-rows, row selection; coss docs show a TanStack data table on its table parts. | https://tanstack.com/table/latest/docs/guide/grouping, https://github.com/cosscom/coss/blob/main/apps/ui/content/docs/components/table.mdx (line 216) |
| W10 | 3 | 2 | 6 | TanStack column visibility state, shown with coss menu checkbox items. | https://tanstack.com/table/latest/docs/guide/column-visibility |
| W11 | 1 | 2 | 2 | Neither virtualises; needs TanStack Virtual added separately. | https://tanstack.com/virtual/latest |
| W12 | 2 | 3 | 6 | TanStack keeps selection and expansion keyed by `getRowId`, so data swaps keep state; focus keeping is ours. | https://tanstack.com/table/latest/docs/api/core/table#getrowid |
| W13 | 2 | 2 | 4 | Combobox and select drop into cells; no editable-cell helper. | https://coss.com/ui/docs/components/combobox |
| W14 | 3 | 2 | 6 | Collapsible and accordion components. | https://github.com/cosscom/coss/tree/main/apps/ui/registry/default/ui |
| W15 | 3 | 2 | 6 | Combobox and autocomplete with typing to filter. | https://coss.com/ui/docs/components/combobox |
| W16 | 3 | 2 | 6 | Popover and menu (with checkbox and radio items). | https://coss.com/ui/docs/components/menu |
| W17 | 3 | 2 | 6 | Radio group, toggle group, and tabs built on a segmented-control style. | https://github.com/cosscom/coss/blob/main/apps/ui/registry/default/ui/tabs.tsx |
| W18 | 2 | 2 | 4 | Tabs (default and underline); counts are a badge we place inside. | same tabs.tsx |
| W19 | 3 | 2 | 6 | Tooltip component. | https://coss.com/ui/docs/components/tooltip |
| W20 | 3 | 2 | 6 | Toast renders `Toast.Action` when `actionProps` is passed (Undo). | https://github.com/cosscom/coss/blob/main/apps/ui/registry/default/ui/toast.tsx (line 167) |
| W21 | 3 | 2 | 6 | Drawer on Base UI Drawer, defaults to bottom, swipe to close; sheet with four sides. | https://github.com/cosscom/coss/blob/main/apps/ui/registry/default/ui/drawer.tsx |
| W22 | 3 | 2 | 6 | Dialog and alert dialog. | https://coss.com/ui/docs/components/dialog |
| W23 | 3 | 2 | 6 | Checkbox, checkbox group, switch. | https://coss.com/ui/docs/components/switch |
| W24 | 3 | 2 | 6 | Progress, meter, badge, kbd, breadcrumb, skeleton all in the set. | https://github.com/cosscom/coss/blob/main/apps/ui/registry.json |
| W25 | 3 | 1 | 3 | Light and dark through CSS variables (shadcn token set). | get-started.mdx |

## 3. Total

**134 / 165**

## 4. What we build ourselves

- Strip rounded corners, shadows and colour-mixed hover tints from every copied file; set 32-36px row heights.
- Data table wiring: TanStack column definitions, grouping into Needs you / Being handled / Everything else, sub-rows, expandable row panels.
- Shift + arrow range selection and one-Tab-stop arrow navigation in tables.
- Virtualised lists with TanStack Virtual.
- Keeping focus and an open row steady when server-sent events replace row data.
- Editable cells in manual import (combobox inside a row).
- Vite font and theme setup in place of the docs' Next.js `layout.tsx` steps.
- A licence notice for the copied MIT files (no LICENSE file inside `apps/ui`).
- The pen.dev library file for these components (no kit exists).

## 5. Biggest risk

The default look (rounded corners, layered shadows, card variants) is baked into long class strings in every file, so making it square and flat is a rewrite of each component's styling, and a mistaken import from the AGPL `packages/ui` copy instead of the MIT registry would put the repo's licence in question.
