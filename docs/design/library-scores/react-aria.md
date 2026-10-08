# React Aria Components + our own Tailwind styles (slug `react-aria`)

Checked 8 Oct 2026. Docs moved from react-spectrum.adobe.com/react-aria to react-aria.adobe.com (301 redirect).

## TanStack Table: needed or not?

Not needed. Score React Aria's own Table alone.
- React Aria's Table already has sorting (`allowsSorting`, `sortDescriptor`), sub-rows (`treeColumn`, `expandedKeys`), single and multiple row selection, column resizing, drag and drop, and virtualisation (`Virtualizer` + `TableLayout`). https://react-aria.adobe.com/Table, https://react-aria.adobe.com/Virtualizer
- TanStack Table would add only grouping and column-visibility state. Both are a few lines over the data array: React Aria's own docs hide columns by filtering the `columns` array.
- Pairing TanStack with a plain HTML table would throw away React Aria's grid keyboard behaviour and screen reader roles. Feeding TanStack's row model into React Aria's Table works but means two sources of truth for sort, selection and expansion state.

## Must-haves

| # | Result | Evidence | Source |
|---|---|---|---|
| M1 | pass | Plain npm package, peer deps React 16.8 to 19; no Next.js. Has a `client-only` dependency (a marker package, no-op in Vite). | https://registry.npmjs.org/react-aria-components (1.22.0) |
| M2 | pass | "React Aria does not include any styles by default"; styled via `className`, data attributes or the `tailwindcss-react-aria-components` plugin; no CSS-in-JS runtime required. | https://react-aria.adobe.com/styling |
| M3 | pass | No default styles at all, so square corners, no shadows and 32-36px rows are whatever we write. | https://react-aria.adobe.com/styling |
| M4 | pass | Adobe's accessibility layer; grid roles, live-region toasts as F6 landmark regions, focus management documented per component. | https://react-aria.adobe.com/Table, https://react-aria.adobe.com/Toast |
| M5 | pass | Apache-2.0 (npm and GitHub repo). | https://github.com/adobe/react-spectrum |
| M6 | pass | 1.22.0 released 8 Oct 2026; nightly builds daily; supports React 19. | https://registry.npmjs.org/react-aria-components |

## Weighted

| # | Score | Weight | Points | Reason | Source |
|---|---|---|---|---|---|
| W0 | 3 | 2 | 6 | WAI-ARIA keyboard patterns across lists, tabs, radio groups, menus; Esc closes overlays (`isKeyboardDismissDisabled` defaults false). | https://react-aria.adobe.com/Modal, https://react-aria.adobe.com/Table |
| W1 | 2 | 3 | 6 | No pen.dev kit for React Aria itself (HeroUI's kit is React Aria underneath but has HeroUI's look). Unstyled parts can be drawn one-for-one in pen.dev, but we draw all of them. | brief (pen.dev kits: shadcn, HeroUI, Halo, Lunaris, Nitro) |
| W2 | 3 | 3 | 9 | Tailwind starter components copy in via the shadcn command-line tool; behaviour can be overridden through render props, contexts, or by dropping to the `react-aria` hooks, without forking. | https://react-aria.adobe.com/getting-started |
| W3 | 2 | 3 | 6 | 5.9M weekly downloads; official MCP server, agent skills and llms.txt. API is verbose (collections, render props, slots), smaller agent training base than Radix/shadcn. | https://api.npmjs.org/downloads/point/last-week/react-aria-components, https://react-aria.adobe.com/ai |
| W4 | 2 | 2 | 4 | ESM, `sideEffects: ["*.css"]`, so unused components drop out; each component pulls shared i18n and state packages, heavier per component than Radix or Base UI (size not measured). | npm registry manifest |
| W5 | 2 | 2 | 4 | GridList and the hooks accept `disallowTypeAhead`; the Table component drops that prop (destructured and discarded in `TableInner`), so letter keys inside a focused table trigger typeahead unless our shortcut handler catches them first in the capture phase. | https://github.com/adobe/react-spectrum/blob/main/packages/react-aria-components/src/Table.tsx (line ~698) |
| W6 | 3 | 2 | 6 | Shift + arrow calls `extendSelection` when `selectionMode="multiple"`. | https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/selection/useSelectableCollection.ts (line ~206) |
| W7 | 3 | 2 | 6 | Table, GridList, ListBox, Tree are grids/lists with one Tab stop and arrow-key movement. | https://react-aria.adobe.com/Table |
| W8 | 3 | 1 | 3 | `isFocusVisible` render prop and focus-visible data attribute on every interactive part; styled by us. | https://react-aria.adobe.com/styling |
| W9 | 2 | 3 | 6 | Sorting, sub-rows via `treeColumn`, row selection built in. Grouping into Needs you / Being handled / Everything else is not built in: three table bodies or top-level tree rows. | https://react-aria.adobe.com/Table |
| W10 | 2 | 2 | 4 | No column-visibility API; docs filter the `columns` array. Picker is a Menu with checkbox selection, ours to build. | https://react-aria.adobe.com/Table |
| W11 | 3 | 2 | 6 | `Virtualizer` with `TableLayout` (both directions) and `ListLayout`; works with Table, GridList, ListBox. | https://react-aria.adobe.com/Virtualizer |
| W12 | 2 | 3 | 6 | Selection, focus and expansion are tracked by row key and can be controlled, so replacing data keeps them if keys are stable. Not confirmed under real 2-second server-sent-event updates (unverified, needs a test build). | https://react-aria.adobe.com/Table |
| W13 | 2 | 2 | 4 | No editable-cell API; docs put a `TextField` in cells with `keyboardNavigationBehavior="tab"`. A ComboBox in a cell follows the same route. | https://react-aria.adobe.com/Table |
| W14 | 3 | 2 | 6 | `Disclosure` and `DisclosureGroup`; GridList/Table rows can expand. | https://react-aria.adobe.com/Disclosure |
| W15 | 3 | 2 | 6 | `ComboBox` with filtering; `Autocomplete` for filtered menus. | https://react-aria.adobe.com/ComboBox, https://react-aria.adobe.com/Autocomplete |
| W16 | 3 | 2 | 6 | `Popover`, `Menu` (with checkbox/radio selection in menus). | https://react-aria.adobe.com/Menu, https://react-aria.adobe.com/Popover |
| W17 | 3 | 2 | 6 | `RadioGroup` and `ToggleButtonGroup`. | https://react-aria.adobe.com/RadioGroup, https://react-aria.adobe.com/ToggleButtonGroup |
| W18 | 3 | 2 | 6 | `Tabs`; counts are tab content. | https://react-aria.adobe.com/Tabs |
| W19 | 3 | 2 | 6 | `Tooltip` shows on hover and instantly on keyboard focus; not on touch (docs say so). | https://react-aria.adobe.com/Tooltip |
| W20 | 2 | 2 | 4 | Toast exists but every export is `UNSTABLE_`-prefixed; docs show only title, description and close, so an Undo button goes in as our own content (unverified). | https://react-aria.adobe.com/Toast |
| W21 | 2 | 2 | 4 | No drawer component; docs say trays, drawers and sheets are a `Modal` with our own entry/exit animation. | https://react-aria.adobe.com/Modal |
| W22 | 3 | 2 | 6 | `Modal` + `Dialog`, Esc closes. | https://react-aria.adobe.com/Modal |
| W23 | 3 | 2 | 6 | `Checkbox`, `Switch`. | https://react-aria.adobe.com/Checkbox, https://react-aria.adobe.com/Switch |
| W24 | 2 | 2 | 4 | `ProgressBar`, `Meter`, `Breadcrumbs` exist; badge, keyboard key chip and skeleton do not. | https://react-aria.adobe.com/ProgressBar, https://react-aria.adobe.com/Breadcrumbs |
| W25 | 3 | 1 | 3 | No theme of its own; dark and light are entirely our CSS variables in Tailwind classes. | https://react-aria.adobe.com/styling |

## Total

139 / 165.

## What we would build ourselves

- All visual styling for every component (starting from the Tailwind starter kit, restyled to square, flat, 32-36px).
- Grouping rows into Needs you / Being handled / Everything else.
- Column-visibility picker (Menu + filtered `columns` array).
- Drawer and bottom sheet animation on top of `Modal`.
- Toast with an Undo button, on an `UNSTABLE_` API that may change.
- Badge, keyboard key chip, skeleton.
- A capture-phase keyboard handler so single-letter shortcuts beat the Table's built-in typeahead.
- Every component drawn in pen.dev by hand (no React Aria kit).

## Biggest risk

The Table's typeahead cannot be switched off, so our single-letter shortcuts (A, I, G, R, S, F, D) fight it inside every focused table unless a capture-phase handler intercepts them first.
