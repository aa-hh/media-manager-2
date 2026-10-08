# HeroUI v3 (+ TanStack Table for row models) — scoring

Version scored: `@heroui/react` 3.2.6 and `@heroui/styles` 3.2.6 (17 Sep 2026). v3 is a ground-up rewrite on React Aria Components and Tailwind v4; the old v2 packages (`@heroui/theme`, `@heroui/table`, Tailwind plugin, framer-motion) are not what is scored here. HeroUI has its own Table (React Aria's Table), so TanStack Table is optional; HeroUI's docs ship a TanStack bridge example, and that pairing is what is scored for grouping and column visibility.

## Must-haves

| # | Verdict | Evidence | Source |
|---|---|---|---|
| M1 | pass | Official Vite setup (`npx heroui-cli init -t vite`); no Next.js dependency; deps are React Aria, tailwind-variants, input-otp | https://heroui.com/en/docs/react/getting-started/frameworks ; https://registry.npmjs.org/@heroui/react/3.2.6 |
| M2 | pass | Styles are plain CSS files with BEM classes written in Tailwind `@apply`, themed by CSS custom properties; `tailwind-variants` only joins class strings, no theme object or CSS-in-JS | https://unpkg.com/@heroui/styles@3.2.6/dist/index.css ; https://heroui.com/en/docs/react/getting-started/styling |
| M3 | pass, with override work | Every radius is `calc(var(--radius) * n)`, so `--radius: 0` squares everything; shadows come from `--surface-shadow`, `--overlay-shadow`, `--field-shadow`; component CSS sits in `@layer components`, so our Tailwind classes win. But the default look is opinionated and must be overridden per component: Table cells `px-4 py-3 text-sm` (about 44px rows, ours are 32-36px), a grey "primary" card wrapper around the table, column separator lines drawn with `::after`, `cursor: pointer`, soft surface colours | https://unpkg.com/@heroui/styles@3.2.6/dist/themes/shared/theme.css ; https://unpkg.com/@heroui/styles@3.2.6/dist/components/table.css ; https://unpkg.com/@heroui/styles@3.2.6/dist/themes/default/variables.css |
| M4 | pass | Built on React Aria Components (peer `react-aria-components ^1.21.1`) | https://registry.npmjs.org/@heroui/react/3.2.6 |
| M5 | pass | Apache 2.0 since v3.0.3 (GitHub repo licence Apache-2.0; npm `license` field still says MIT, both permit open-sourcing) | https://heroui.com/en/docs/react/releases/v3-0-3 ; https://api.github.com/repos/heroui-inc/heroui |
| M6 | pass | 3.2.6 released 17 Sep 2026; six releases since June; peer `react >=19` | https://registry.npmjs.org/@heroui/react |

## Weighted requirements

| # | Score | Weight | Total | Reason | Source |
|---|---|---|---|---|---|
| W1 | 2 | 3 | 6 | Pen.app bundles `pencil-heroui.pen` (390 KB) listed as design system "Hero UI"; not on pen.dev's public docs, and whether it matches v3 or v2 is unverified | /Applications/Pen.app/Contents/Resources/app.asar (file index entry `pencil-heroui.pen`, `design-kit-heroui.png`) |
| W2 | 2 | 3 | 6 | npm package, not copied in; override via `className` (accepts render-prop functions), BEM classes, data attributes, CSS variables; compound parts let us swap pieces; changing markup inside a part means dropping to React Aria (re-exported at `@heroui/react/rac`) | https://heroui.com/en/docs/react/getting-started/styling ; https://registry.npmjs.org/@heroui/react/3.2.6 (exports) |
| W3 | 2 | 3 | 6 | 771k weekly downloads, 30.9k GitHub stars, llms.txt, MCP server, agent skills, AGENTS.md download; but v3's compound API (`Table.Content`, `Table.Column`) differs from v2/NextUI, which dominates older training data | https://api.npmjs.org/downloads/point/last-week/@heroui/react ; https://heroui.com/llms.txt |
| W4 | 2 | 2 | 4 | JS: `sideEffects: false`, per-component subpath exports. CSS: default `@heroui/styles` import pulls all ~90 component stylesheets; per-component CSS files exist but must be listed by hand | https://registry.npmjs.org/@heroui/react/3.2.6 ; https://registry.npmjs.org/@heroui/styles/3.2.6 |
| W0 | 3 | 2 | 6 | React Aria keyboard patterns throughout (arrows, Esc, focus restore) | https://react-aria.adobe.com/Table.md |
| W5 | 1 | 2 | 2 | React Aria Table, ListBox and Menu use typeahead: a letter key moves focus to a matching row; Table documents no prop to turn it off (GridList has `disallowTypeAhead`). Our A/I/G/R/S/F/D shortcuts need a capture-phase key handler that runs first | https://react-aria.adobe.com/Table.md (textValue "used for features like typeahead") ; https://react-aria.adobe.com/GridList.md |
| W6 | 3 | 2 | 6 | `selectionBehavior="replace"` gives Shift + arrow range selection in tables and lists | https://react-aria.adobe.com/selection.md |
| W7 | 3 | 2 | 6 | Table and ListBox are single Tab stop with arrow navigation inside (React Aria grid) | https://react-aria.adobe.com/Table.md |
| W8 | 3 | 1 | 3 | Focus ring on every component reads `--focus`; table cells use an inset ring | https://unpkg.com/@heroui/styles@3.2.6/dist/components/table.css |
| W9 | 2 | 3 | 6 | Sorting, row selection, expandable rows and nested sub-rows (`treeColumn`, `expandedKeys`) built in; grouping (Needs you / Being handled / Everything else) not built in, done with TanStack grouped rows rendered as tree rows or as separate bodies | https://heroui.com/en/docs/react/components/table |
| W10 | 2 | 2 | 4 | No column picker component; TanStack column visibility state feeding HeroUI's dynamic columns, with a HeroUI Dropdown as the picker | https://heroui.com/en/docs/react/components/table (TanStack Table section) |
| W11 | 3 | 2 | 6 | Table and ListBox virtualisation through React Aria `Virtualizer` (example with 1000 rows) | https://heroui.com/en/docs/react/components/table (Virtualization) |
| W12 | 2 | 3 | 6 | React Aria collections track focus, selection and expanded rows by key, so re-rendered rows with stable ids keep them; not tested under a server-sent-events feed (unverified) | https://react-aria.adobe.com/Table.md |
| W13 | 2 | 2 | 4 | Cells accept any content, so a HeroUI ComboBox or Select can sit in a cell; no documented editable-cell pattern, keyboard hand-off between grid and picker is ours | https://heroui.com/en/docs/react/components/combo-box |
| W14 | 2 | 2 | 4 | Disclosure, DisclosureGroup, Accordion for summary sections; a full-width panel opening under a table row is not a documented Table pattern (tree rows give child rows, not a panel) | https://heroui.com/llms.txt (Disclosure, Accordion) |
| W15 | 3 | 2 | 6 | ComboBox (multiple selection since 3.2.3) and Autocomplete | https://heroui.com/en/docs/react/releases/v3-2-3 |
| W16 | 3 | 2 | 6 | Popover and Dropdown | https://heroui.com/llms.txt |
| W17 | 3 | 2 | 6 | RadioGroup and ToggleButtonGroup (single or multiple selection) | https://heroui.com/en/docs/react/components/toggle-button-group |
| W18 | 3 | 2 | 6 | Tabs with free content per tab (count goes in the label), secondary variant, overflow scrolling | https://heroui.com/en/docs/react/releases/v3-2-2 |
| W19 | 3 | 2 | 6 | Tooltip on hover and focus, delay configurable | https://heroui.com/en/docs/react/components/tooltip |
| W20 | 3 | 2 | 6 | Toast with `actionProps` and `Toast.ActionButton` | https://heroui.com/en/docs/react/components/toast |
| W21 | 3 | 2 | 6 | Drawer with `placement` including bottom | https://heroui.com/en/docs/react/components/drawer |
| W22 | 3 | 2 | 6 | Modal and AlertDialog | https://heroui.com/llms.txt |
| W23 | 3 | 2 | 6 | Checkbox and Switch | https://heroui.com/llms.txt |
| W24 | 3 | 2 | 6 | ProgressBar, Badge and Chip, Kbd, Breadcrumbs, Skeleton (animation set by `--skeleton-animation`, `none` allowed) | https://heroui.com/llms.txt ; https://unpkg.com/@heroui/styles@3.2.6/dist/themes/default/variables.css |
| W25 | 3 | 1 | 3 | Light and dark themes as CSS variable sets switched by `.dark` / `data-theme`; dark theme already has no surface shadow | https://unpkg.com/@heroui/styles@3.2.6/dist/themes/default/variables.css |

## Total

138 of 165 possible.

## What we would build ourselves

- Our theme file: `--radius: 0`, the three shadow variables set to none, our colour variables mapped onto HeroUI's (`--background`, `--surface*`, `--accent`, `--danger`, `--separator`, `--focus`).
- Table overrides for the timing-tower look: 32-36px rows (cell padding), no grey card wrapper (use the secondary variant or override), remove `::after` column separators, default cursor.
- Button and field size overrides where HeroUI's `h-8`/`h-9` sizes don't match.
- App-level shortcut handler that runs before React Aria's typeahead in tables and lists.
- Grouped table sections and column picker on TanStack Table state.
- Full-width inline decision panel under a table row.
- Editable-cell keyboard hand-off for manual import.
- Everything in the requirements' "built by us whatever we pick" list.

## Biggest risk

We take HeroUI's whole opinionated stylesheet and then override it component by component, so every HeroUI upgrade can shift padding, pseudo-elements or class names under our overrides, while a headless React Aria setup would give the same behaviour with nothing to undo.
