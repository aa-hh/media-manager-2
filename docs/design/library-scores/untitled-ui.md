# Untitled UI React (free MIT components only)

Scored 8 Oct 2026 from the GitHub source (main branch tarball, read locally), the npm registry and untitledui.com docs. PRO components excluded. Repo: https://github.com/untitleduico/react

Free set (101 component source files, about 14,200 lines, excluding demos and stories): buttons, button group, badges, checkbox, toggle, radio buttons, input family, select, combobox, multi-select, tag select, dropdown, popover, tooltip, slider, tags, progress bar and circles, avatar, tabs, table, modal, slide-out menu, pagination, date pickers, file upload, carousel, charts, empty state, loading indicator, app navigation.

## 1. Must-haves

| # | Verdict | Evidence | Source |
|---|---|---|---|
| M1 | pass | Official Vite starter (`npx untitledui@latest init --vite`) and a manual Vite guide. `next` appears in the repo's package.json only for its Storybook; grep finds zero `from "next..."` imports in any component. | https://www.untitledui.com/react/integrations/vite ; https://github.com/untitleduico/react/blob/main/package.json |
| M2 | pass | Tailwind v4; every colour, shadow and text size is a CSS custom property in an `@theme` block (`styles/theme.css`, 834 lines). No CSS-in-JS, no runtime theme object. | https://github.com/untitleduico/react/blob/main/styles/theme.css |
| M3 | pass, with real work | The house look is strong: `rounded-lg`/`rounded-xl` everywhere (185 corner classes), skeuomorphic inset shadows on buttons (`shadow-xs-skeuomorphic`), the table shell is `rounded-xl shadow-xs ring-1`, table rows are 56px (`h-14`, small) or 72px (`h-18`), buttons 36-48px. Shadows and most corners come from Tailwind theme tokens, so setting `--radius-*: 0` and `--shadow-*: none` removes most of it in one file. 41 fixed-pixel corners in 17 files (for example `before:rounded-[7px]` on every button size) bypass the tokens and need editing by hand. Nothing is locked: we own the files. | https://github.com/untitleduico/react/blob/main/components/application/table/table.tsx ; https://github.com/untitleduico/react/blob/main/components/base/buttons/button.tsx |
| M4 | pass | Interactive parts are React Aria Components (`react-aria-components` 1.21+), which supply roles, labels and announcements. | https://github.com/untitleduico/react/blob/main/package.json ; https://react-spectrum.adobe.com/react-aria/accessibility.html |
| M5 | pass | MIT for the open-source repo; README says PRO is under a separate licence. | https://github.com/untitleduico/react/blob/main/LICENSE |
| M6 | pass | No GitHub releases (copy-in kit), but the `untitledui` install tool 0.1.69 was published 2 Oct 2026, last commit 27 Sep 2026, built on React 19.3. | https://registry.npmjs.org/untitledui ; https://github.com/untitleduico/react/commits/main |

## 2. Weighted scores

Table rows assume pairing with TanStack Table for row and column state, since the free table wrapper has no grouping or expandable rows.

| # | Score | Weight | x | Reason | Source |
|---|---|---|---|---|---|
| W1 | 1 | 3 | 3 | No pen.dev kit (pen.dev bundles shadcn/ui, HeroUI, Halo, Lunaris, Nitro). A free Untitled UI Figma file exists, so components could be redrawn in pen.dev by hand. | brief; https://www.untitledui.com/react/docs/installation (Figma files) |
| W2 | 3 | 3 | 9 | `npx untitledui add <name>` copies source into the repo. | https://www.untitledui.com/react/docs/cli |
| W3 | 2 | 3 | 6 | 1,951 GitHub stars, install tool about 7,000 downloads a week (icons 538,000). Docs, an MCP server page and a CLAUDE.md in the repo. Much smaller than shadcn/ui; API is React Aria's. | https://github.com/untitleduico/react ; https://api.npmjs.org/downloads/point/last-week/untitledui |
| W4 | 3 | 2 | 6 | Only copied files ship; React Aria Components is tree-shakable per component. | https://www.untitledui.com/react/docs/cli ; https://react-spectrum.adobe.com/react-aria/getting-started.html |
| W0 | 3 | 2 | 6 | React Aria implements the WAI-ARIA keyboard patterns, Esc to close, focus return. | https://react-spectrum.adobe.com/react-aria/accessibility.html |
| W5 | 2 | 2 | 4 | No component source binds single-letter keys (grep of key handlers). React Aria lists, menus and tables use type-to-jump while focus is inside them, which would catch A, G, R etc. there; turning that off per component unverified. | source grep; https://react-spectrum.adobe.com/react-aria/Table.html |
| W6 | 3 | 2 | 6 | React Aria Table with `selectionBehavior="replace"` does Shift + arrow range selection; the wrapper passes `selectionBehavior` through. | https://react-spectrum.adobe.com/react-aria/selection.html ; table.tsx |
| W7 | 3 | 2 | 6 | React Aria Table and GridList give one Tab stop with arrow keys inside. | https://react-spectrum.adobe.com/react-aria/Table.html |
| W8 | 3 | 1 | 3 | Every component uses `focus-visible:ring-focus-ring` / `outline-focus-ring`, a theme token. | table.tsx line 180; tabs.tsx line 37 |
| W9 | 1 | 3 | 3 | Wrapper does sorting and row selection only. Grouping, expandable rows and sub-rows come from TanStack's row model, rendered through React Aria Table by us. | table.tsx; https://tanstack.com/table/latest/docs/guide/grouping |
| W10 | 2 | 2 | 4 | Not in the kit; TanStack column visibility state plus the kit's dropdown. | https://tanstack.com/table/latest/docs/guide/column-visibility |
| W11 | 2 | 2 | 4 | Wrapper not virtualised; React Aria `Virtualizer` supports Table and ListBox. | https://react-spectrum.adobe.com/react-aria/Virtualizer.html |
| W12 | 2 | 3 | 6 | React Aria tracks focus and selection by item key, so re-rendered rows keep them; not tested with live updates (unverified). | https://react-spectrum.adobe.com/react-aria/collections.html |
| W13 | 1 | 2 | 2 | Kit's combobox can go in a cell, but keyboard handling of form controls inside a React Aria grid row is our work. | https://react-spectrum.adobe.com/react-aria/Table.html |
| W14 | 2 | 2 | 4 | No disclosure or accordion in the free set; React Aria `Disclosure` exists, we style it. | https://react-spectrum.adobe.com/react-aria/Disclosure.html |
| W15 | 3 | 2 | 6 | `combobox.tsx`, select with search, multi-select. | https://github.com/untitleduico/react/tree/main/components/base/select |
| W16 | 3 | 2 | 6 | `dropdown.tsx` (React Aria Menu) and `popover.tsx`. | https://github.com/untitleduico/react/tree/main/components/base/dropdown |
| W17 | 3 | 2 | 6 | `radio-buttons.tsx`; `button-group.tsx` is React Aria ToggleButtonGroup. | https://github.com/untitleduico/react/blob/main/components/base/button-group/button-group.tsx |
| W18 | 3 | 2 | 6 | `Tab` has a `badge` prop for counts. | https://github.com/untitleduico/react/blob/main/components/application/tabs/tabs.tsx |
| W19 | 3 | 2 | 6 | `tooltip.tsx` on React Aria Tooltip. | https://github.com/untitleduico/react/blob/main/components/base/tooltip/tooltip.tsx |
| W20 | 1 | 2 | 2 | No toast in the free repo (notifications are PRO); `sonner` sits in package.json but no component uses it. We add sonner or React Aria's Toast ourselves. | source grep; https://github.com/untitleduico/react/blob/main/package.json |
| W21 | 2 | 2 | 4 | `slideout-menu.tsx` is a right-side panel on React Aria Modal; bottom sheet for phone is ours. | https://github.com/untitleduico/react/blob/main/components/application/slideout-menus/slideout-menu.tsx |
| W22 | 3 | 2 | 6 | `modal.tsx` on React Aria Modal and Dialog. | https://github.com/untitleduico/react/blob/main/components/application/modals/modal.tsx |
| W23 | 3 | 2 | 6 | `checkbox.tsx`, `toggle.tsx` (switch). | https://github.com/untitleduico/react/tree/main/components/base |
| W24 | 2 | 2 | 4 | Progress bar and badges included; key chip, breadcrumb and skeleton missing. | https://github.com/untitleduico/react/tree/main/components/base/progress-indicators |
| W25 | 3 | 1 | 3 | `.dark-mode` class swaps the colour variables; light is the default. | https://github.com/untitleduico/react/blob/main/styles/globals.css ; theme.css line 482 |

## 3. Total

127 of a possible 165.

## 4. What we build ourselves

- Strip the house look: zero radius and shadow tokens, hand-edit 41 fixed-pixel corners and the skeuomorphic button shadows, cut table rows from 56/72px to 32-36px, remove the table's rounded shell.
- Swap the purple brand palette and semantic colour tokens for ours.
- Table grouping, expandable rows and sub-rows, column picker and virtualisation (TanStack Table plus React Aria Virtualizer).
- Editable cells with an inline picker.
- Toast with an action button.
- Disclosure / collapsible sections.
- Bottom sheet for phone.
- Keyboard key chip, breadcrumb, skeleton.
- Stopping type-to-jump in lists and tables from catching the app's letter shortcuts, if needed.

## 5. Biggest risk

The kit is a polished SaaS look (rounded, soft shadows, 56-72px rows, purple brand) baked into 14,000 lines we would own, so we would spend the first weeks undoing it, and the useful behaviour underneath is plain React Aria Components, which we could take directly without the restyling.
