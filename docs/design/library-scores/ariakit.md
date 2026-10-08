# Ariakit + our own Tailwind styles + TanStack Table (slug: ariakit)

Checked 8 Oct 2026. Packages: `@ariakit/react` 0.4.41 (5 Oct 2026), `@tanstack/react-table` 9.2.6 (4 Oct 2026).

## 1. Must-haves

| # | Verdict | Evidence | Source |
|---|---|---|---|
| M1 | pass | Plain React package, peer deps `react`/`react-dom` ^17, ^18 or ^19, no Next.js dependency; TanStack Table peer `react >=18` | https://registry.npmjs.org/@ariakit/react , https://registry.npmjs.org/@tanstack/react-table/latest |
| M2 | pass | Components are unstyled; styling guide lists Tailwind; official examples are written with Tailwind `@apply` | https://ariakit.com/guide/styling , https://github.com/ariakit/ariakit/blob/main/examples/menu/style.css |
| M3 | pass | No default look at all; state exposed as `[data-focus-visible]`, `[data-active-item]`, `[data-open]`, `aria-*` and CSS variables such as `--popover-anchor-width` | https://ariakit.com/guide/styling |
| M4 | pass | Built to WAI-ARIA patterns; Dialog makes the outside inert, renders a hidden dismiss button, returns focus to the opener | https://ariakit.com/reference/dialog |
| M5 | pass | `@ariakit/react` and its packages are MIT. Caution: the ariakit.com site source (`app/`) is under a proprietary licence and the repo root has no licence file, so copying example code from the site or `examples/` is unverified | https://github.com/ariakit/ariakit/blob/main/packages/ariakit-react/license , https://github.com/ariakit/ariakit/blob/main/app/license.md |
| M6 | pass | 0.4.41 released 5 Oct 2026 (7 releases since 23 Jul 2026); supports React 19 | https://registry.npmjs.org/@ariakit/react |

All six pass.

## 2. Weighted scores

| # | Score | Weight | Score x weight | Reason | Source |
|---|---|---|---|---|---|
| W0 | 3 | 2 | 6 | WAI-ARIA keyboard patterns; Esc closes dialogs (`hideOnEscape` default true); focus returns to the opener (`autoFocusOnHide` default true) | https://ariakit.com/reference/dialog |
| W1 | 1 | 3 | 3 | No pen.dev kit (pen.dev ships shadcn/ui, HeroUI, Halo, Lunaris, Nitro). Unstyled, so every component has to be drawn in pen.dev from scratch, though nothing stops a one-for-one rebuild | score brief; https://ariakit.com/guide/styling |
| W2 | 2 | 3 | 6 | Not copied in, but every part takes a `render` prop and a separate store hook, so markup and behaviour can be overridden without forking | https://ariakit.com/guide/styling , https://ariakit.com/reference/composite-provider |
| W3 | 2 | 3 | 6 | 1.51M weekly downloads (week to 4 Oct 2026), 8.6k GitHub stars, thorough docs; still 0.x and its store/`render` pattern is less common in agent training data than Radix | https://api.npmjs.org/downloads/point/last-week/@ariakit/react , https://github.com/ariakit/ariakit |
| W4 | 3 | 2 | 6 | `sideEffects: false` and 28 subpath exports (`@ariakit/react/menu`, …); only imported components ship | https://registry.npmjs.org/@ariakit/react/0.4.41 |
| W5 | 2 | 2 | 4 | Plain Composite claims no letter keys (typeahead only via opt-in `CompositeTypeahead`), but MenuList, SelectList and the Select button turn on typeahead by default while focused (can be set `typeahead={false}`) | https://github.com/ariakit/ariakit/blob/main/packages/ariakit-react-components/src/menu/menu-list.tsx , .../select/select.tsx , https://ariakit.com/reference/composite-typeahead |
| W6 | 1 | 2 | 2 | Neither Ariakit Composite nor TanStack row selection does Shift + arrow range selection; we write it on `rowSelection` state | https://ariakit.com/reference/composite-provider , https://tanstack.com/table/latest/docs/guide/features |
| W7 | 2 | 2 | 4 | Composite gives one Tab stop with arrow keys, 2D grids via `CompositeRow`, and `virtualFocus` (aria-activedescendant); no table/grid component, so wiring it to TanStack rows is ours | https://ariakit.com/components/composite , https://ariakit.com/reference/composite-provider |
| W8 | 2 | 1 | 2 | `[data-focus-visible]` on every focusable part, including virtually focused items; the ring itself is ours to style | https://ariakit.com/guide/styling |
| W9 | 3 | 3 | 9 | TanStack Table v9: sorting, grouping, expanding with sub-rows, row selection as headless features | https://tanstack.com/table/latest/docs/guide/features |
| W10 | 2 | 2 | 4 | TanStack column visibility state + Ariakit `MenuItemCheckbox` for the picker | https://tanstack.com/table/latest/docs/guide/features , https://github.com/ariakit/ariakit/tree/main/examples/menu-item-checkbox |
| W11 | 2 | 2 | 4 | Not in either library; TanStack Virtual (separate MIT package) per TanStack's own guide | https://tanstack.com/table/latest/docs/guide/features |
| W12 | 2 | 3 | 6 | TanStack keeps selection/expanded state by row id across data updates; Ariakit stores are external to render. Keeping focus on a re-rendered row is our wiring (unverified without a test build) | https://tanstack.com/table/latest/docs/guide/features |
| W13 | 2 | 2 | 4 | No editable-cell feature in TanStack; Ariakit Select/Combobox can sit in a cell | https://tanstack.com/table/latest/docs/guide/features , https://ariakit.com/components |
| W14 | 3 | 2 | 6 | Disclosure component renders inline expandable content | https://ariakit.com/components |
| W15 | 3 | 2 | 6 | Combobox with filtering, and Select + Combobox examples | https://github.com/ariakit/ariakit/tree/main/examples/combobox-filtering , .../select-combobox |
| W16 | 3 | 2 | 6 | Popover and Menu components | https://ariakit.com/components |
| W17 | 3 | 2 | 6 | Radio group with arrow keys; a segmented toggle is a styled Radio group (Toolbar also available) | https://ariakit.com/components |
| W18 | 3 | 2 | 6 | Tab component; counts are content we put inside the tab | https://ariakit.com/components |
| W19 | 3 | 2 | 6 | Tooltip component | https://ariakit.com/components |
| W20 | 1 | 2 | 2 | No toast; Ariakit's own example pairs Dialog with react-toastify | https://github.com/ariakit/ariakit/tree/main/examples/dialog-react-toastify |
| W21 | 2 | 2 | 4 | Dialog styled as a side or bottom sheet; no sheet component or drag-to-dismiss | https://ariakit.com/components/dialog |
| W22 | 3 | 2 | 6 | Dialog, modal by default | https://ariakit.com/reference/dialog |
| W23 | 2 | 2 | 4 | Checkbox exists; no Switch component (a switch built on Checkbox with `role="switch"` is unverified) | https://ariakit.com/components |
| W24 | 1 | 2 | 2 | None of progress bar, badge, key chip, breadcrumb or skeleton exist; plain HTML from us | https://ariakit.com/components |
| W25 | 2 | 1 | 2 | No theme to fight; dark and light themes are our CSS variables entirely. The optional `@ariakit/tailwind` plugin is experimental | https://github.com/ariakit/ariakit/tree/main/packages/ariakit-tailwind |

## 3. Total

**122 / 165**

## 4. What we would build ourselves

- All visual styling for every component (no starter look), and the matching pen.dev components
- Table markup, the 2D keyboard wiring between Ariakit Composite and TanStack rows, and Shift + arrow range selection
- Virtualisation wiring with TanStack Virtual
- Editable cells (Select/Combobox inside a row)
- Toast with an Undo action (own component, or add a toast library)
- Sheet / bottom sheet styling on top of Dialog
- Switch, progress bar, badge, key chip, breadcrumb, skeleton
- Turning off typeahead on Menu/Select where it would collide with screen shortcuts

## 5. Biggest risk

Ariakit is still 0.x with a three-person core team and no pen.dev kit, so we carry both the full visual layer and any breaking changes on minor releases.
