# radix-own: our own components on Radix Primitives + Tailwind, paired with TanStack Table

Checked 8 Oct 2026. Radix Primitives is "A project by @workos" (https://github.com/radix-ui, radix-ui.com footer).

## Release cadence (checked against the npm registry)

Stable `radix-ui` releases, from https://registry.npmjs.org/radix-ui:

- 2025: 1.1.0 (22 Jan) through 1.4.2 (20 May), then 1.4.3 (13 Aug 2025).
- No stable release for almost 10 months: 13 Aug 2025 to 6 Jun 2026.
- 2026: 1.5.0 (6 Jun), 1.6.0 (15 Jun), 1.6.1 (30 Jun), 1.6.2 (6 Jul), 1.6.3 and 1.6.4 (20 Jul), 1.6.5 (22 Jul), 1.6.6 and 1.6.7 (24 Jul), 1.7.0 (5 Oct). Release candidates for 1.8.0 published 7 and 8 Oct.
- Repo commits on 5, 6, 7 and 8 Oct 2026 (https://github.com/radix-ui/primitives/commits). Not archived, 274 open issues, 19.4k stars.
- Two people carry most of the history: chaance (526 commits) and benoitgrelard (518) (https://github.com/radix-ui/primitives/graphs/contributors).

TanStack Table: `@tanstack/react-table` 9.2.6 released 4 Oct 2026, MIT, peer `react >=18` (https://registry.npmjs.org/@tanstack/react-table).

## 1. Must-haves

| # | Result | Evidence |
|---|---|---|
| M1 | pass | Peer dependencies are only `react` and `react-dom`; no Next.js dependency. https://registry.npmjs.org/radix-ui (1.7.0) |
| M2 | pass | Unstyled; styling is ours via `className`, `data-state` attributes and `--radix-*` CSS variables; no theme object. https://www.radix-ui.com/primitives/docs/guides/styling |
| M3 | pass | Ships no visual styles at all, so nothing to fight. https://www.radix-ui.com/primitives/docs/overview/introduction |
| M4 | pass | Follows WAI-ARIA patterns, manages roles, labels and focus. https://www.radix-ui.com/primitives/docs/overview/accessibility |
| M5 | pass | MIT (npm `license` field and GitHub). https://github.com/radix-ui/primitives |
| M6 | pass | 1.7.0 on 5 Oct 2026; peer range includes `^19.0`, React latest is 19.3.0. https://registry.npmjs.org/radix-ui , https://registry.npmjs.org/react |

## 2. Weighted scores

| # | Score | Weight | Total | Reason | Source |
|---|---|---|---|---|---|
| W0 | 3 | 2 | 6 | Arrow keys in menus, tabs, radio groups; Esc closes; focus returns to trigger (`onCloseAutoFocus`) | https://www.radix-ui.com/primitives/docs/overview/accessibility |
| W1 | 2 | 3 | 6 | No pen.dev kit of its own; pen.dev's shadcn/ui kit maps one-for-one if we model our components on shadcn's Radix versions | pen.dev kit list in brief; https://ui.shadcn.com/docs |
| W2 | 3 | 3 | 9 | All styled component code is ours in the repo; `asChild` swaps any rendered element | https://www.radix-ui.com/primitives/docs/guides/composition |
| W3 | 3 | 3 | 9 | 19M weekly downloads of `radix-ui`, 92M of `@radix-ui/react-dialog`; long-time base of shadcn/ui | https://api.npmjs.org/downloads/point/last-week/radix-ui |
| W4 | 3 | 2 | 6 | Per-primitive packages and `radix-ui/<name>` subpath imports; tree-shaking fixed in July 2026 release | https://www.radix-ui.com/primitives/docs/overview/releases (20 Jul 2026) |
| W5 | 2 | 2 | 4 | Select and menus take letter keys for typeahead only while open and focused; Toast viewport hotkey is F8, configurable. Our shortcut handler must skip events from inside open menus | https://www.radix-ui.com/primitives/docs/components/select , /toast |
| W6 | 1 | 2 | 2 | Neither Radix nor TanStack Table handles Shift + arrow; TanStack gives selection state only, we write the keys | https://tanstack.com/table/latest/docs/guide/row-selection |
| W7 | 1 | 2 | 2 | Roving focus is documented only inside Toolbar, ToggleGroup, RadioGroup, Tabs; `@radix-ui/react-roving-focus` is published but undocumented; no grid roving | https://github.com/radix-ui/primitives/tree/main/packages/react/roving-focus |
| W8 | 2 | 1 | 2 | Focus moves correctly; the visible ring is ours with Tailwind `focus-visible:` | https://www.radix-ui.com/primitives/docs/guides/styling |
| W9 | 3 | 3 | 9 | TanStack Table: sorting, grouping, expanding, sub-rows, row selection built in | https://tanstack.com/table/latest/docs/guide/grouping , /expanding |
| W10 | 3 | 2 | 6 | TanStack column visibility API; picker UI from DropdownMenu `CheckboxItem` | https://tanstack.com/table/latest/docs/guide/column-visibility |
| W11 | 2 | 2 | 4 | Needs `@tanstack/react-virtual` added; Table docs ship virtualised examples | https://tanstack.com/table/latest/docs/guide/virtualization |
| W12 | 2 | 3 | 6 | `getRowId` keys selection and expanded state by our id so data refreshes keep them; focus survival is our wiring | https://tanstack.com/table/latest/docs/guide/row-selection |
| W13 | 2 | 2 | 4 | TanStack editable-data example plus Radix Select/Popover in the cell; no filterable picker (see W15) | https://tanstack.com/table/latest/docs/framework/react/examples/editable-data |
| W14 | 3 | 2 | 6 | Collapsible and Accordion | https://www.radix-ui.com/primitives/docs/components/collapsible |
| W15 | 1 | 2 | 2 | No combobox in Radix; Select has typeahead, not type-to-filter. We build one on Popover or add another library | https://github.com/radix-ui/website/tree/main/data/primitives/docs/components (no combobox) |
| W16 | 3 | 2 | 6 | Popover and DropdownMenu | https://www.radix-ui.com/primitives/docs/components/popover |
| W17 | 3 | 2 | 6 | RadioGroup and ToggleGroup | https://www.radix-ui.com/primitives/docs/components/toggle-group |
| W18 | 3 | 2 | 6 | Tabs; counts are our markup inside the trigger | https://www.radix-ui.com/primitives/docs/components/tabs |
| W19 | 3 | 2 | 6 | Tooltip, opens on focus and hover | https://www.radix-ui.com/primitives/docs/components/tooltip |
| W20 | 3 | 2 | 6 | Toast with `Toast.Action` (requires `altText` for screen readers) | https://www.radix-ui.com/primitives/docs/components/toast |
| W21 | 2 | 2 | 4 | No sheet or drawer; Dialog styled as a side or bottom panel; no drag-to-dismiss | https://www.radix-ui.com/primitives/docs/components/dialog |
| W22 | 3 | 2 | 6 | Dialog | https://www.radix-ui.com/primitives/docs/components/dialog |
| W23 | 3 | 2 | 6 | Checkbox and Switch | https://www.radix-ui.com/primitives/docs/components/checkbox |
| W24 | 2 | 2 | 4 | Progress only; badge, key chip, breadcrumb, skeleton are plain markup we write | https://www.radix-ui.com/primitives/docs/components/progress |
| W25 | 2 | 1 | 2 | No theme of its own; we define the dark and light CSS variables | https://www.radix-ui.com/primitives/docs/guides/styling |

## 3. Total

**135 / 165** (weights sum to 55).

## 4. What we would build ourselves

- Every styled component: about 20 wrappers (button, input, select, menu, popover, dialog, sheet, tabs, tooltip, toast, checkbox, switch, radio, toggle group, collapsible, progress) with our Tailwind classes and variables.
- Combobox with type-to-filter (episode picker, quality override, poster fields), or a second library for it.
- Sheet / bottom sheet on top of Dialog, including phone behaviour.
- Badge, key chip, breadcrumb, skeleton.
- Table markup and styling around TanStack Table, keyboard roving across rows and cells, Shift + arrow range selection.
- Virtualisation wiring with `@tanstack/react-virtual`.
- Keeping focus on a row through live server-sent-event updates.
- A global shortcut handler that ignores keys typed inside open menus, selects and inputs.
- Matching pen.dev components by hand (no kit for our own library).

## 5. Biggest risk

Radix went almost 10 months without a stable release (Aug 2025 to Jun 2026) and most of its history rests on two maintainers, so another stall under WorkOS would leave us patching a dependency we cannot easily swap.
