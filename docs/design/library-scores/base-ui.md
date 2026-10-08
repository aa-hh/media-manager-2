# Base UI + our own Tailwind styles + TanStack Table (slug `base-ui`)

Checked 8 Oct 2026. Versions: `@base-ui/react` 1.8.0 (4 Sep 2026), `@tanstack/react-table` 9.2.6 (4 Oct 2026). Base UI docs pages were read as Markdown from `https://base-ui.com/react/<page>.md`.

## 1. Must-haves

| # | Verdict | Evidence | Source |
|---|---|---|---|
| M1 | pass | Plain React package. Peer dependencies are React, React DOM and optional date-fns, with nothing from Next.js. Quick start covers plain React. TanStack Table needs only `react >=18`. | https://registry.npmjs.org/@base-ui/react/1.8.0 , https://base-ui.com/react/overview/quick-start.md , https://registry.npmjs.org/@tanstack/react-table |
| M2 | pass | "Unstyled, don't bundle CSS, and are compatible with Tailwind". Styling hooks are `className`, data attributes (`data-checked`, `data-highlighted`) and the CSS variables it exposes. TanStack Table is headless. | https://base-ui.com/react/handbook/styling.md |
| M3 | pass | Ships no default look. The docs' own examples use `rounded-none` and `h-8` (32px) triggers. TanStack renders no markup. | https://base-ui.com/react/components/menu.md |
| M4 | pass | Follows the WAI-ARIA Authoring Practices and handles ARIA roles, attributes and focus management. Table semantics (`table`/`grid` roles, sort announcements) are ours because TanStack is headless. | https://base-ui.com/react/overview/accessibility.md |
| M5 | pass | Both MIT. | https://registry.npmjs.org/@base-ui/react , https://registry.npmjs.org/@tanstack/react-table |
| M6 | pass | Base UI released 1.8.0 on 4 Sep 2026 (1.4.0 to 1.8.0 since 13 Apr) and supports React 19. TanStack released 9.2.6 on 4 Oct 2026. | https://base-ui.com/react/overview/releases/v1-8-0.md , npm registry |

All must-haves pass.

## 2. Weighted scores

| # | Score | Weight | Score x weight | Reason | Source |
|---|---|---|---|---|---|
| W0 | 3 | 2 | 6 | Follows the WAI-ARIA Authoring Practices: arrow keys, Home/End, Esc, and `finalFocus` to return focus | https://base-ui.com/react/overview/accessibility.md |
| W1 | 2 | 3 | 6 | pen.dev has no Base UI kit. The components are unstyled, so our pen.dev drawings become the spec one-for-one. The shadcn kit's parts map to Base UI parts, but that kit's foundation is unverified. | https://base-ui.com/react/handbook/styling.md |
| W2 | 2 | 3 | 6 | Installed from npm rather than copied in. Every part takes `className`, `style`, a `render` prop and `mergeProps`, so markup and styles can be overridden without forking. Behaviour beyond the props cannot. | https://base-ui.com/react/handbook/composition.md , https://base-ui.com/react/handbook/customization.md |
| W3 | 2 | 3 | 6 | 19.3M weekly downloads, an `llms.txt` file and Markdown docs, and one consistent Root/Trigger/Popup anatomy. The package was renamed in Dec 2025 and TanStack Table v9 shipped 4 Aug 2026, so agents trained earlier will write old imports and v8 calls. TanStack publishes a v9 migration guide and agent skills. | https://base-ui.com/llms.txt , https://api.npmjs.org/downloads/point/last-week/@base-ui/react , https://tanstack.com/table/latest/llms.txt |
| W4 | 3 | 2 | 6 | `sideEffects: false` with 80 subpath exports (`@base-ui/react/menu`). TanStack v9 advertises "feature-level tree shaking". | npm registry manifest , https://tanstack.com/table/latest/llms.txt |
| W5 | 2 | 2 | 4 | Letter keys act as type-to-find only inside an open menu, select or combobox. Not confirmed in the source that nothing listens on the whole document. | https://base-ui.com/react/overview/accessibility.md (unverified in source) |
| W6 | 2 | 2 | 4 | TanStack v9 has built-in Shift range selection that follows display order and keeps its anchor across data updates. It is wired to clicks, so Shift + arrow keys is our own keydown handler calling the same handler. | https://tanstack.com/table/latest/docs/framework/react/guide/row-selection.md |
| W7 | 1 | 2 | 2 | Roving focus exists inside Toolbar, Tabs, Radio Group and Toggle Group (`loopFocus`, `orientation`). There is no list, grid or table primitive, so roving focus across table rows is ours. | https://base-ui.com/react/components/toggle-group.md |
| W8 | 2 | 1 | 2 | Every part accepts `focus-visible:` classes, but the docs make the focus style our job | https://base-ui.com/react/overview/accessibility.md |
| W9 | 3 | 3 | 9 | TanStack has sorting, grouping, expanding, sub-rows and row selection built in. The markup is ours. | https://tanstack.com/table/latest/llms.txt (Feature Guides) |
| W10 | 3 | 2 | 6 | TanStack column visibility, plus the Base UI Menu checkbox item (`Menu.CheckboxItem`) for the picker | https://tanstack.com/table/latest/docs/framework/react/guide/column-visibility.md , https://base-ui.com/react/components/menu.md |
| W11 | 2 | 2 | 4 | Needs the separate `@tanstack/react-virtual` package. Official row-virtualisation examples exist, and Base UI Combobox has a virtualised example. | https://tanstack.com/table/latest/docs/framework/react/guide/virtualization.md , https://base-ui.com/react/components/combobox.md |
| W12 | 2 | 3 | 6 | `getRowId` keys selection and expansion to our own row ids, so state survives new data. Keeping focus and an open row through each update is our own rendering work. | https://tanstack.com/table/latest/docs/guide/rows.md , row-selection guide |
| W13 | 2 | 2 | 4 | Base UI Combobox and Select can go inside a cell. Edit mode and keyboard movement between cells are ours. | https://base-ui.com/react/components/combobox.md |
| W14 | 3 | 2 | 6 | Collapsible and Accordion, including `hiddenUntilFound` so the browser's page search can open them | https://base-ui.com/react/components/collapsible.md |
| W15 | 3 | 2 | 6 | Combobox with type-to-filter. Autocomplete is a separate component. | https://base-ui.com/react/components/combobox.md |
| W16 | 3 | 2 | 6 | Popover, Menu, Context Menu and Menubar | https://base-ui.com/llms.txt |
| W17 | 3 | 2 | 6 | Radio Group and Toggle Group | https://base-ui.com/react/components/radio-group.md , toggle-group.md |
| W18 | 3 | 2 | 6 | Tabs. A count is our own markup inside the tab. | https://base-ui.com/react/components/tabs.md |
| W19 | 3 | 2 | 6 | Tooltip, shown on hover and on focus | https://base-ui.com/llms.txt |
| W20 | 3 | 2 | 6 | Toast with `actionProps` and a documented "Undo action" example | https://base-ui.com/react/components/toast.md |
| W21 | 3 | 2 | 6 | Drawer: swipe to dismiss, bottom sheet by default (`swipeDirection` "down"), snap points, software-keyboard handling | https://base-ui.com/react/components/drawer.md |
| W22 | 3 | 2 | 6 | Dialog and Alert Dialog | https://base-ui.com/llms.txt |
| W23 | 3 | 2 | 6 | Checkbox, Checkbox Group and Switch | https://base-ui.com/llms.txt |
| W24 | 1 | 2 | 2 | Progress and Meter only. Badge, keyboard key chip, breadcrumb and skeleton are missing. | https://base-ui.com/llms.txt |
| W25 | 2 | 1 | 2 | No theme of its own to fight. Dark and light themes are entirely our Tailwind variables. | https://base-ui.com/react/handbook/styling.md |

## 3. Total

**135 / 165.**

## 4. What we would build ourselves

- Every visual style: Tailwind classes and colour variables for every part. Base UI ships no look.
- Table markup, roles (`grid` or `table`), sort announcements and the focus indicator for the release, episode, downloads, history, blocklist, flagged, import and library tables.
- Roving focus and arrow-key movement across table rows and cells, plus Shift + arrow range selection wired to TanStack's range handler.
- Keeping focus, selection and an open inline row stable while server-sent events replace row data.
- Virtualised rows with `@tanstack/react-virtual`, a third package.
- Edit mode for manual-import cells holding a Combobox or Select.
- Badge, keyboard key chip, breadcrumb and skeleton.
- The app's single-letter shortcut layer, and a check that it ignores keys typed inside open menus and inputs.
- Plus everything on the requirements' "built by us whatever we pick" list.

## 5. Biggest risk

Base UI and TanStack Table both give behaviour without a table or grid primitive, so the hardest part of the product (keyboard focus and live updates in dense tables) is entirely our code, written by agents trained mostly on the older TanStack v8 API.
