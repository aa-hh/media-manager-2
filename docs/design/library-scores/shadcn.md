# shadcn/ui + TanStack Table (default Base UI foundation)

Scored 8 Oct 2026. Component sources checked by downloading the registry files for the default "vega" style in all three foundations: `https://ui.shadcn.com/r/styles/{base-vega,radix-vega,aria-vega}/<component>.json`.

## 1. Must-haves

| # | Result | Evidence | Source |
|---|---|---|---|
| M1 | pass | Official Vite guide: `create vite` React + TypeScript template, `@tailwindcss/vite`, `shadcn init`. Components carry a harmless `"use client"` line; no Next.js import in the Base UI components checked. The Sonner wrapper imports `next-themes` (a small theme hook, works outside Next.js); the Base UI build uses Base UI Toast instead and does not need it. | https://ui.shadcn.com/docs/installation/vite |
| M2 | pass | Theming is CSS variables (`--primary`, `--ring`, `--radius`, …) exposed to Tailwind with `@theme inline`; components are Tailwind class strings. No runtime theme object. | https://ui.shadcn.com/docs/theming |
| M3 | pass | Code is copied into our repo, so every `rounded-*` and `shadow-*` class is ours to delete. Default vega style ships `shadow-xs` on button, checkbox, switch, `shadow-md/lg` on popover, menu, sheet, and `rounded-md`/`rounded-xl`. The Lyra style already uses `rounded-none` (checked on button and popover). | https://ui.shadcn.com/r/styles/base-vega/button.json, https://ui.shadcn.com/r/styles/base-lyra/button.json |
| M4 | pass | Behaviour comes from Base UI, which follows the WAI-ARIA Authoring Practices and is tested with screen readers. The plain table (`<table>` elements) gets native table semantics. | https://base-ui.com/react/overview/accessibility |
| M5 | pass | shadcn-ui/ui MIT; @base-ui/react MIT; @tanstack/react-table MIT. | https://github.com/shadcn-ui/ui, https://registry.npmjs.org/@base-ui/react, https://registry.npmjs.org/@tanstack/react-table |
| M6 | pass | shadcn 4.21.4 released 7 Oct 2026; @base-ui/react 1.8.0 on 4 Sep 2026 (peer React ^17–^19); @tanstack/react-table 9.2.6 on 4 Oct 2026 (peer React >=18). | https://registry.npmjs.org/shadcn, https://registry.npmjs.org/@base-ui/react, https://registry.npmjs.org/@tanstack/react-table |

All must-haves pass.

## 2. Weighted requirements (Base UI foundation)

| # | Score | Weight | Points | Reason | Source |
|---|---|---|---|---|---|
| W0 | 2 | 2 | 4 | Base UI components follow WAI-ARIA keyboard patterns, Esc closes, `finalFocus` controls where focus returns. The shadcn table is a plain HTML table with no keyboard handling, so table rows get nothing. | https://base-ui.com/react/overview/accessibility |
| W1 | 3 | 3 | 9 | pen.dev kit confirmed by the caller; bundled in the installed pen.dev app. | caller |
| W2 | 3 | 3 | 9 | Components are copied into the repo by the CLI and edited freely. | https://ui.shadcn.com/docs/installation/vite |
| W3 | 2 | 3 | 6 | Largest user base of any candidate (125k GitHub stars; 13.4M weekly CLI downloads). Docked one point because Base UI became the default only in July 2026, so most code agents have seen is the Radix version (`asChild` became `render`), which invites wrong first attempts. | https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default, https://api.npmjs.org/downloads/point/last-week/shadcn |
| W4 | 3 | 2 | 6 | Base UI is imported per component (`@base-ui/react/button`, `/menu`, …); TanStack Table v9 registers only the features used, which its docs say gives a smaller bundle. | https://ui.shadcn.com/r/styles/base-vega/dropdown-menu.json, https://tanstack.com/table/latest/docs/guide/features |
| W5 | 2 | 2 | 4 | No component installs page-wide key listeners (no `onKeyDown` in the copied Base UI components checked). Menus and selects use letter keys to jump to items while open, which is the WAI-ARIA pattern but means our shortcut handler must ignore keys while those are focused. Not tested in a build. | https://base-ui.com/react/overview/accessibility |
| W6 | 1 | 2 | 2 | TanStack Table keeps selection state but has no range or Shift-key selection; we write it. Base UI has no list or grid component with range selection. | https://raw.githubusercontent.com/TanStack/table/main/docs/guide/row-selection.md |
| W7 | 1 | 2 | 2 | Base UI moves focus with arrows inside menus, tabs, radio and toggle groups, but has no list or grid component; table rows need our own roving focus. | https://base-ui.com/react/overview/accessibility |
| W8 | 3 | 1 | 3 | Button, checkbox, radio, select, switch, tabs and toast carry `focus-visible:ring-*` classes tied to the `--ring` variable. | https://ui.shadcn.com/r/styles/base-vega/button.json, https://ui.shadcn.com/docs/theming |
| W9 | 2 | 3 | 6 | TanStack Table v9 has sorting, grouping, row expanding with sub-rows and row selection; the shadcn data-table guide only wires sorting, filtering, visibility, selection and paging, so grouping and expanding UI are ours. | https://tanstack.com/table/latest/docs/guide/features, https://ui.shadcn.com/docs/components/data-table |
| W10 | 3 | 2 | 6 | Data-table guide includes a column visibility dropdown on TanStack's visibility API. | https://ui.shadcn.com/docs/components/data-table |
| W11 | 2 | 2 | 4 | Virtualisation comes from TanStack Virtual, a separate package; not in shadcn. | https://tanstack.com/table/latest/docs/guide/features |
| W12 | 2 | 3 | 6 | `getRowId` keys selection and expansion to our IDs, so state survives fresh data; keeping keyboard focus on a re-rendered row is our job (stable React keys). Not tested in a build. | https://raw.githubusercontent.com/TanStack/table/main/docs/guide/rows.md |
| W13 | 2 | 2 | 4 | Cells are our own React; a Combobox or Select can sit in a cell. No editing helpers in either library. | https://ui.shadcn.com/docs/components/base/combobox |
| W14 | 3 | 2 | 6 | Collapsible and Accordion on Base UI. | https://ui.shadcn.com/r/styles/base-vega/collapsible.json |
| W15 | 3 | 2 | 6 | Combobox on Base UI: type to filter, auto-highlight, multi-select with chips. | https://ui.shadcn.com/docs/components/base/combobox |
| W16 | 3 | 2 | 6 | Popover and Dropdown Menu on Base UI. | https://ui.shadcn.com/r/styles/base-vega/popover.json |
| W17 | 3 | 2 | 6 | Radio Group and Toggle Group on Base UI. | https://ui.shadcn.com/r/styles/base-vega/toggle-group.json |
| W18 | 3 | 2 | 6 | Tabs on Base UI; counts go in the trigger (with Badge). | https://ui.shadcn.com/r/styles/base-vega/tabs.json |
| W19 | 3 | 2 | 6 | Tooltip on Base UI. | https://ui.shadcn.com/r/styles/base-vega/tooltip.json |
| W20 | 3 | 2 | 6 | Toast on Base UI Toast with `actionProps` for an Undo button. | https://ui.shadcn.com/docs/components/base/toast |
| W21 | 3 | 2 | 6 | Drawer on `@base-ui/react/drawer` (bottom sheet) and Sheet for side panels. | https://ui.shadcn.com/r/styles/base-vega/drawer.json |
| W22 | 3 | 2 | 6 | Dialog on Base UI. | https://ui.shadcn.com/r/styles/base-vega/dialog.json |
| W23 | 3 | 2 | 6 | Checkbox and Switch on Base UI. | https://ui.shadcn.com/r/styles/base-vega/switch.json |
| W24 | 3 | 2 | 6 | Progress, Badge, Kbd, Breadcrumb and Skeleton all in the component list. | https://ui.shadcn.com/docs/components |
| W25 | 3 | 1 | 3 | Dark theme is the same variables overridden under `.dark`. | https://ui.shadcn.com/docs/theming |

## 3. Total

**140 / 165** (Base UI foundation).

### Where the other foundations would score differently

React Aria (`init --base aria`, July 2026): about **145 / 165**.
- The aria table wraps `react-aria-components` Table instead of a plain `<table>` (checked in https://ui.shadcn.com/r/styles/aria-vega/table.json). React Aria Table has arrow-key cell navigation, nested expandable rows and multiple selection with Shift (https://react-aria.adobe.com/Table, https://react-aria.adobe.com/selection), and a Virtualizer with a table layout (https://react-aria.adobe.com/Virtualizer). W0 3, W6 3, W7 3, W11 3: +10.
- W3 drops to 1 (-3): newest foundation, fewest examples for agents to learn from; one report says the aria registry lacks hover card and menubar (https://github.com/vercel/ai-elements/issues/451).
- W5 drops to 1 (-2, unverified): React Aria rows use `textValue` for typeahead, so letter keys pressed in a focused table may jump rows instead of reaching our A/I/G/R shortcuts.
- React Aria Table manages its own selection and expansion, so pairing it with TanStack Table means two sources of row state; likely use TanStack only for sorting and grouping.
- Its drawer still imports `@base-ui/react/drawer`, so two primitive libraries ship.

Radix (`init -b radix`): about **143 / 165**.
- W3 rises to 3 (+3): the version most existing shadcn code and agent training uses.
- Drawer is built on `vaul`, last released 14 Dec 2024 (https://registry.npmjs.org/vaul), which fails our maintained test for that one component. Toast is Sonner (2.0.8, 9 Aug 2026) plus `next-themes`. Combobox imports Base UI anyway.
- radix-ui 1.7.0 released 5 Oct 2026, so M6 still passes.

## 4. What we would build ourselves

- Table keyboard behaviour: roving focus across rows, Shift + arrow range selection, Esc and Enter handling (Base UI and Radix foundations).
- Grouped table (Needs you / Being handled / Everything else) and expanding sub-rows UI on TanStack's grouping and expanding features.
- Virtualised rows with TanStack Virtual for the library and history.
- Live-update handling: stable row IDs, keeping focus and the open row while server-sent events replace data.
- Inline editable cells for manual import (Combobox in a cell, commit and cancel).
- A shortcut layer that ignores keys while menus, selects or text fields have focus.
- Restyle pass: strip shadows and rounded corners (or start from the Lyra style), set 32-36px row heights, map our colour variables.
- Plus the list the requirements already mark as ours (calendar grids, poster grid, quality cells, downloads bar, shortcut overlay content).

## 5. Biggest risk

All table keyboard work (roving focus, range selection) lands on us on the default Base UI foundation, and the one foundation that provides it, React Aria, is three months old in shadcn and may grab letter keys our shortcuts need.
