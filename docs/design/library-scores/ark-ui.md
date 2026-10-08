# Ark UI + our own Tailwind styles + TanStack Table (slug `ark-ui`)

Versions checked 8 Oct 2026: `@ark-ui/react` 5.39.3 (5 Oct 2026), `@ark-ui/react` 6.0.0-next.0 pre-release (6 Oct 2026), `@tanstack/react-table` 9.2.6 (4 Oct 2026), `@tanstack/react-virtual` 3.14.13 (14 Sep 2026). React latest is 19.3.0.

## 1. Must-haves

| # | Verdict | Evidence | Source |
|---|---|---|---|
| M1 | pass | Only peers are `react >=18` and `react-dom >=18`; no Next.js dependency; TanStack Table peer is `react >=18` | https://registry.npmjs.org/@ark-ui/react , https://registry.npmjs.org/@tanstack/react-table |
| M2 | pass | Headless; styled with `className` on each part and Tailwind data-attribute variants such as `data-[state=open]:bg-gray-100`; no theme object | https://ark-ui.com/docs/guides/styling |
| M3 | pass | Ships only "functional styles" (popover positioning); presentation is left to us; Park UI is the separate styled layer we are not using | https://ark-ui.com/docs/guides/styling |
| M4 | pass | Components follow WAI-ARIA patterns; source sets `role="listbox"`, `aria-multiselectable`, `aria-activedescendant`; toast region is `aria-live="polite"`, each toast `role="status"`. Table roles and announcements are ours, since TanStack Table renders no markup | https://github.com/chakra-ui/zag/blob/main/packages/machines/listbox/src/listbox.connect.ts , https://github.com/chakra-ui/zag/blob/main/packages/machines/toast/src/toast-group.connect.ts |
| M5 | pass | Ark UI, Zag.js and TanStack Table are all MIT | https://github.com/chakra-ui/ark , https://github.com/chakra-ui/zag , https://registry.npmjs.org/@tanstack/react-table |
| M6 | pass | Ark 5.39.3 released 5 Oct 2026, five releases since 17 Aug; TanStack Table 9.2.6 on 4 Oct 2026; React 19 covered by `>=18` peer | https://github.com/chakra-ui/ark/blob/main/packages/react/CHANGELOG.md , https://registry.npmjs.org/@tanstack/react-table |

## 2. Weighted requirements

| # | Score | Weight | Score x weight | Reason | Source |
|---|---|---|---|---|---|
| W0 | 3 | 2 | 6 | Components follow WAI-ARIA patterns; Drawer/Dialog close on Esc and return focus (`restoreFocus` default true, `finalFocusEl`) | https://ark-ui.com/docs/components/drawer |
| W1 | 1 | 3 | 3 | pen.dev has no Ark kit (kits are shadcn/ui, HeroUI, Halo, Lunaris, Nitro); being unstyled, each part can be drawn in pen.dev from our own variables, but the whole kit is our work | brief; https://ark-ui.com/docs/guides/styling |
| W2 | 2 | 3 | 6 | Installed as a package, not copied in; every part takes `className` and `asChild`, and the underlying Zag.js machines can be used directly to rebuild any part without forking | https://ark-ui.com/react/docs/guides/composition |
| W3 | 2 | 3 | 6 | 1.23M weekly downloads, 5.4k stars, `llms.txt`, per-page Markdown and an MCP server; smaller user base than Radix or React Aria, and a 6.0 rename of data attributes is coming | https://ark-ui.com/llms.txt , https://api.npmjs.org/downloads/point/last-week/@ark-ui/react |
| W4 | 3 | 2 | 6 | `sideEffects: false` and per-component subpath imports (for example `@ark-ui/react/hotkeys`); TanStack Table v9 makes every feature opt-in through a `features` option | https://registry.npmjs.org/@ark-ui/react , https://tanstack.com/table/latest/docs/guide/features |
| W5 | 3 | 2 | 6 | Letters are only read as typeahead while a menu, select or listbox has focus (listbox typeahead is an opt-in prop); toast focus key is Alt+T and configurable; Ark's Hotkeys utility registers document shortcuts with scopes for our per-screen keys | https://ark-ui.com/docs/components/listbox , https://ark-ui.com/docs/components/toast , https://ark-ui.com/llms.txt/utilities/hotkeys |
| W6 | 2 | 2 | 4 | Listbox `selectionMode="extended"` does Shift+arrow and Shift+click range selection (fixed in 5.39.3); TanStack Table has row selection but "ships no keydown handling", so table rows need our own wiring | https://github.com/chakra-ui/ark/blob/main/packages/react/CHANGELOG.md , https://github.com/TanStack/table/blob/main/examples/react/cell-selection/src/main.tsx |
| W7 | 2 | 2 | 4 | Listbox, menu, tabs, radio and toggle groups give one Tab stop with arrows inside; listbox supports a grid collection; table grid navigation is ours | https://ark-ui.com/docs/components/listbox |
| W8 | 3 | 1 | 3 | Parts expose state as data attributes (`data-focus-visible`, `data-highlighted`) that Tailwind variants style; nothing to override | https://ark-ui.com/docs/guides/styling |
| W9 | 2 | 3 | 6 | TanStack Table v9 has sorting, grouping, expanding with sub-rows and row selection as features; we write all markup, table roles and grouped-section headers | https://tanstack.com/table/latest/docs/guide/features |
| W10 | 3 | 2 | 6 | `columnVisibilityFeature` plus Ark Menu checkbox items or Popover for the picker | https://tanstack.com/table/latest/docs/guide/features , https://ark-ui.com/llms.txt/components/menu |
| W11 | 2 | 2 | 4 | TanStack Virtual (virtualized-rows example); Ark Combobox/Listbox accept `scrollToIndexFn` for virtual lists; joining virtualisation with grouping is our work | https://github.com/TanStack/table/tree/main/examples/react/virtualized-rows , https://ark-ui.com/llms.txt/components/combobox |
| W12 | 2 | 3 | 6 | `getRowId` gives stable row ids so selection and expansion survive new data; TanStack has a realtime-trading example; keeping focus across updates relies on our stable React keys (unverified by test build) | https://tanstack.com/table/latest/docs/guide/rows , https://github.com/TanStack/table/tree/main/examples/react/realtime-trading |
| W13 | 2 | 2 | 4 | Ark Combobox/Select can sit in a cell; TanStack has no editing feature, only examples (spreadsheet), so the edit-cell pattern is ours | https://github.com/TanStack/table/tree/main/examples/react/spreadsheet , https://ark-ui.com/llms.txt/components/combobox |
| W14 | 3 | 2 | 6 | Collapsible and Accordion components; TanStack `rowExpandingFeature` for rows opening in place | https://ark-ui.com/llms.txt/components/collapsible |
| W15 | 3 | 2 | 6 | Combobox with typed filtering, plus Select | https://ark-ui.com/llms.txt/components/combobox |
| W16 | 3 | 2 | 6 | Popover and Menu components | https://ark-ui.com/llms.txt/components/popover |
| W17 | 3 | 2 | 6 | Radio Group, Segment Group and Toggle Group components | https://ark-ui.com/llms.txt/components/segment-group |
| W18 | 3 | 2 | 6 | Tabs component; counts are our content inside the trigger | https://ark-ui.com/llms.txt/components/tabs |
| W19 | 3 | 2 | 6 | Tooltip opens on hover or focus | https://ark-ui.com/llms.txt/components/tooltip |
| W20 | 3 | 2 | 6 | Toast has `Toast.ActionTrigger` and a `toast.action` option (6.0 removes `render`/`asChild` from `Toaster`) | https://ark-ui.com/docs/components/toast |
| W21 | 2 | 2 | 4 | Drawer slides from any edge (default down), with swipe and snap points; marked "Preview" | https://ark-ui.com/docs/components/drawer |
| W22 | 3 | 2 | 6 | Dialog component following the WAI-ARIA dialog pattern | https://ark-ui.com/llms.txt/components/dialog |
| W23 | 3 | 2 | 6 | Checkbox and Switch components | https://ark-ui.com/llms.txt/components/switch |
| W24 | 1 | 2 | 2 | Only Progress (linear and circular) is provided; no badge, key chip, breadcrumb or skeleton (Hotkeys' `useFormatHotkey` formats key labels) | https://ark-ui.com/llms.txt |
| W25 | 3 | 1 | 3 | No theme of its own; every colour comes from our CSS variables, so dark now and light later are a variable swap | https://ark-ui.com/docs/guides/styling |

## 3. Total

133 out of 165.

## 4. What we would build ourselves

- Every visual style: all Tailwind classes for every part (no Park UI).
- Table markup and its screen reader roles (grid or table semantics, sort announcements, group headers for Needs you / Being handled / Everything else).
- Table keyboard: roving focus across rows and cells, Shift+arrow row range selection.
- Joining TanStack Virtual with grouped and expandable rows.
- Edit-in-cell pattern for manual import (Ark Combobox inside a TanStack cell).
- Focus preservation tests for rows updated by server-sent events.
- Badge, keyboard key chip, breadcrumb, skeleton.
- A pen.dev component file drawn from scratch, since no kit exists.
- Plus everything the requirements doc already lists as built by us.

## 5. Biggest risk

Ark 6.0 entered pre-release on 6 Oct 2026 with breaking changes (data attributes renamed from `data-scope`/`data-part` to one attribute per part, every component moved to Zag v2, `Toaster` reshaped), so starting on 5.x means a migration soon and agent-written code may mix the two APIs.
