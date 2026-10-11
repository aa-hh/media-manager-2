---
name: media-manager-2
description: Paper white and black with lime. Dense release tables, black actions, lime only for the best release and live downloads.
# Light mode only. Values come from the variables in design/design-system.lib.pen.
colors:
  background: "#FFFFFF"
  card: "#FFFFFF"
  popover: "#FFFFFF"
  muted: "#F2F2EF"
  secondary: "#F2F2EF"
  accent: "#F6F6F3"
  surface-hover: "#F6F6F3"
  surface-pressed: "#EAEAE6"
  selected: "#EDEDE9"
  foreground: "#111111"
  muted-foreground: "#55554F"
  subtle-foreground: "#686862"
  faint-foreground: "#A3A39D"
  border: "#E3E3DE"
  input: "#8C8C85"
  primary: "#111111"
  primary-hover: "#2E2E2C"
  primary-pressed: "#000000"
  primary-foreground: "#FFFFFF"
  best: "#C6F135"
  best-soft: "#F3FCD6"
  best-foreground: "#3D5600"
  live: "#C6F135"
  destructive: "#CC1F17"
  destructive-hover: "#AD1912"
  destructive-pressed: "#8E140E"
  destructive-soft: "#FDE9E7"
  destructive-foreground: "#FFFFFF"
  warning: "#A15C00"
  warning-soft: "#FDF0D9"
  warning-foreground: "#FFFFFF"
  ring: "#111111"
  focus-on-dark: "#FFFFFF"
  bar: "#111111"
  bar-foreground: "#FFFFFF"
  bar-muted-foreground: "#B5B5AE"
  scrim: "#1111114D"
  shadow: "#1111111F"
typography:
  title-hero: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "36px", fontWeight: 800}
  page-title: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "26px", fontWeight: 700}
  section: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "16px", fontWeight: 700}
  body: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "14px", fontWeight: 400}
  label: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "13px", fontWeight: 600}
  caption: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "11px", fontWeight: 600}
  data: {fontFamily: "Barlow Semi Condensed, sans-serif", fontSize: "14px", fontWeight: 400, fontFeature: "\"tnum\""}
  data-small: {fontFamily: "Barlow Semi Condensed, sans-serif", fontSize: "13px", fontWeight: 500, fontFeature: "\"tnum\""}
rounded:
  radius-xs: "4px"
  radius-sm: "6px"
  radius-md: "8px"
  radius-lg: "10px"
  radius-full: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
  space-10: "40px"
  space-12: "48px"
  space-16: "64px"
  page-margin: "40px"
  page-margin-phone: "16px"
  poster-gutter: "20px"
components:
  button-default: {backgroundColor: "{colors.primary}", textColor: "{colors.primary-foreground}", rounded: "{rounded.radius-md}", padding: "0px 16px", height: "40px"}
  button-default-hover: {backgroundColor: "{colors.primary-hover}"}
  button-default-pressed: {backgroundColor: "{colors.primary-pressed}"}
  button-row: {backgroundColor: "{colors.primary}", textColor: "{colors.primary-foreground}", rounded: "{rounded.radius-sm}", padding: "0px 10px", height: "28px"}
  button-large: {backgroundColor: "{colors.primary}", textColor: "{colors.primary-foreground}", rounded: "{rounded.radius-lg}", padding: "0px 20px", height: "48px"}
  button-outline: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}", padding: "0px 16px", height: "40px"}
  button-ghost: {textColor: "{colors.foreground}", rounded: "{rounded.radius-md}", padding: "0px 16px", height: "40px"}
  button-destructive: {backgroundColor: "{colors.destructive}", textColor: "{colors.destructive-foreground}", rounded: "{rounded.radius-md}", padding: "0px 16px", height: "40px"}
  button-destructive-hover: {backgroundColor: "{colors.destructive-hover}"}
  input-search: {backgroundColor: "{colors.muted}", textColor: "{colors.foreground}", rounded: "{rounded.radius-lg}", padding: "0px 16px", height: "48px", width: "640px"}
  input-field: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.radius-sm}", padding: "0px 12px", height: "40px"}
  select-trigger: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}", height: "40px"}
  toggle-group: {backgroundColor: "{colors.muted}", rounded: "{rounded.radius-md}", padding: "3px", height: "40px"}
  toggle-group-item-selected: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.radius-sm}", height: "34px"}
  badge-neutral: {backgroundColor: "{colors.muted}", textColor: "{colors.muted-foreground}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  badge-strong: {backgroundColor: "{colors.primary}", textColor: "{colors.primary-foreground}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  badge-best: {backgroundColor: "{colors.best}", textColor: "{colors.foreground}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  badge-destructive: {backgroundColor: "{colors.destructive-soft}", textColor: "{colors.destructive}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  badge-warning: {backgroundColor: "{colors.warning-soft}", textColor: "{colors.warning}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  table: {backgroundColor: "{colors.card}", rounded: "{rounded.radius-lg}"}
  table-header: {backgroundColor: "{colors.card}", textColor: "{colors.subtle-foreground}", typography: "{typography.caption}", padding: "0px 16px", height: "32px"}
  table-row: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", typography: "{typography.data}", padding: "0px 16px", height: "40px"}
  table-row-two-line: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", padding: "0px 16px", height: "56px"}
  table-row-hover: {backgroundColor: "{colors.surface-hover}"}
  table-row-selected: {backgroundColor: "{colors.selected}"}
  table-row-best: {backgroundColor: "{colors.best-soft}"}
  app-bar: {backgroundColor: "{colors.background}", textColor: "{colors.foreground}", padding: "0px 40px", height: "64px"}
  downloads-live-bar: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", typography: "{typography.data-small}", height: "40px"}
  tooltip: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", rounded: "{rounded.radius-sm}"}
  callout-destructive: {backgroundColor: "{colors.destructive-soft}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}"}
  callout-warning: {backgroundColor: "{colors.warning-soft}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}"}
  poster-card: {rounded: "{rounded.radius-md}", width: "152px"}
---

# Design System: media-manager-2

## Overview

Paper white and black with lime. Black carries the content, the actions and every "on" state. Lime appears in two places only: the best release and live downloads. Red means something went wrong, amber means something is missing or waiting. Tables stay dense: 40px rows inside a 40px page margin, 8 posters per row on Library.

Light mode only for now. The dark design is archived in `design/archive/mediaManager2-2026-10-11.pen`. Desktop first; the phone is secondary and several phone rows are deferred.

The source of truth is the pen.dev library `design/design-system.lib.pen`: its variables and its five component sheets. The nine screen files import it. `design/mediaManager2.pen` no longer exists; see [`design/README.md`](design/README.md) for which file holds which screen.

These are static pen.dev components. Keyboard behaviour, focus handling, screen reader support, live updates and table sorting are implementation work; a static frame proves none of them.

Token names follow shadcn/ui, so code and design use the same words. The code does not use these names yet (see "Names in the current code" below).

## Colors

Neutrals do most of the work. One meaning per colour.

- **Page and surfaces:** `background` is the page; `card` is tables, panels and menus (both white). `muted` is sunken things: tracks, Kbd keys, the neutral badge, the search field at rest. `surface-hover` and `surface-pressed` are hover and pressed. `selected` is the grey tint on a selected row, always with the 3px black side bar.
- **Text:** `foreground` (18.9:1 on white) for text and icons. `muted-foreground` (7.5:1) for secondary text. `subtle-foreground` (5.6:1) for meta, placeholders and column headers. `faint-foreground` (2.5:1) is for disabled things only, never readable text.
- **Lines:** `border` draws dividers and panel edges. `input` (3.4:1) draws control edges: outline buttons, checkboxes, radios, focused fields.
- **Black:** `primary` is buttons and "on" states (checked, monitored, selected segment label, active tab underline). `bar` is the downloads bar, toasts, tooltips and the selection bar, with `bar-foreground` text.
- **Lime:** `best` marks the single best release; `best-soft` tints its row. `live` marks downloads in progress. Lime is 1.3:1 on white, so it is only ever a fill behind black text (14.4:1) or a fill on the black downloads bar or on a poster. Never lime text, lime icons or thin lime lines on white.
- **Red:** `destructive`, `destructive-soft` and their hover and pressed steps are for problems and risk: stalled, failed, gave up, hit and run risk, tracker cooldown, a failed service.
- **Amber:** `warning` and `warning-soft` are for missing, below cutoff, import blocked, unsaved edits and changes waiting for Sonarr or Radarr.
- **Focus:** `ring` (black) on white; `focus-on-dark` (white) on the black bars.
- **Overlay:** `scrim` (black 30%) dims the page behind a phone sheet. `shadow` is the colour of the floating shadow.

Posters keep their own colour; the interface stays black and white around them.

`popover`, `secondary`, `accent` and the `*-foreground` slots exist so shadcn components resolve. `radius` (10) and `radius-xl` (14) are shadcn base slots; components use the `radius-*` scale below.

### Names in the current code

`src/client/globals.css` on main still uses older names. Moving it to the names above is implementation work, not done. Proposed mapping:

- `--ground` to `background`; `--control` to `card`; `--control-hover` to `surface-hover`; `--quiet-hover` to `surface-pressed`; `--ink` to `foreground`; `--secondary-ink` to `muted-foreground`; `--border` stays `border`; `--focus` to `ring`.
- The `--mm-*` set (`--mm-ground`, `--mm-row`, `--mm-ink`, `--mm-best`, `--mm-risk` and the rest) holds the archived dark values. It goes away; the library's Tokens sheet lists each old `mm-` name with its new name.
- The fonts change too: the code loads Inter and Barlow; the target is Schibsted Grotesk and Barlow Semi Condensed.

## Typography

Schibsted Grotesk (`font-ui`) for the interface: titles, labels, buttons, navigation, reading text. Barlow Semi Condensed (`font-data`) for release data and numbers: release names, sizes, seeders, counts, speeds, dates, file names, addresses.

- Title page hero 36/800; page titles 26/700; sections 16/700; group headings 14/600 sentence case; body 14/400; labels and buttons 13/600 to 15 by control size.
- Column headers are 11/600 capitals in `subtle-foreground`, so a group heading never reads as a column header.
- Numbers use tabular figures and right-align in their columns.

## Layout

- **Desktop:** 64px app bar (`topbar`) with a 48px search field centred between the product name and the navigation, 560 to 720px wide (640 in the library). 40px black downloads bar (`livebar`) at the bottom of every desktop screen. 40px page margin (`page-margin`).
- **Tables:** 40px rows, 56px for two-line rows (`row-two-line`), 32px header row (`row-header`), 16px side padding in every row so columns line up across pages. Release tables use the same fixed column widths everywhere.
- **Library:** 152px posters (`poster-width`) with a 20px gutter, 8 per row at 1440px.
- **Group headings:** 24px above, 8px below, no band and no line.
- **Episode details:** opens under the row as a full-width band, content starting at the Title column.
- **Phone:** 16px margin (`page-margin-phone`), 52px top bar with a full-width 44px search under it, bottom sheets for grabs and choices, 44px touch targets.
- **Spacing:** the `space-*` scale, 4 to 64px.

## Elevation & Depth

Flat by default. Things in the page flow (tables, rows, panels in the page, callouts, cards, the add block) get a 1px `border` edge and no shadow.

Only things that float get a shadow: dropdown menus, tooltips, toasts, the inline panel, the phone sheet and the selection bar. One shadow for all of them: `0 2px 6px #1111110F, 0 8px 24px #1111111F` (the phone sheet casts it upward).

## Shapes

Corners run from 4 to 10px. `radius-xs` (4) for badges, Kbd, checkboxes, menu items and skeletons; `radius-sm` (6) for row buttons, form fields and tooltips; `radius-md` (8) for default buttons, posters, cards and callouts; `radius-lg` (10) for large buttons, the search field, tables, panels, menus, toasts and sheets; `radius-full` for dots and progress bars. The only side bar is the 3px row marker; callouts have none.

## Components

Every component lives in `design/design-system.lib.pen` as `v2/Family/Variant` and shows its states as instances beside it. Each sheet note names the shadcn/ui component it maps to, or says "Custom". Screens use instances and override named children (`Label`, `Count`, `Value`, `Icon`, `Kbd`).

### Control sizes

Three sizes, set with the `control-*` tokens. Buttons, inputs, selects and toggle groups match.

- **Row** 28px (`control-h-row`, padding 10, text 13, radius 6, icon 14): only inside table rows and dense lists.
- **Default** 40px (`control-h-default`, padding 16, text 14, radius 8, icon 16): everywhere else.
- **Large** 48px (`control-h-large`, padding 20, text 15, radius 10, icon 18): the one main action on a page or panel, such as the title header actions, the grab confirmation (Replace or Second version) and Settings Connect.

Icon-only buttons are squares at the same heights. pen.dev cannot bind height or icon size to a variable, so those are typed numbers; change them together with the tokens.

### Buttons, badges and inputs

- **v2/Button:** primary (black, shadcn `default`), outline (white, `input` edge), ghost, destructive (red), outline-destructive, menu (outline with a chevron). Disabled is a grey fill, never opacity. Loading swaps the icon for a spinner and keeps the width.
- **v2/Badge**, 20px: neutral (`muted`), strong (black, "In library"), lime (`best`, black text: best release, "Downloading 64%"), risk, warning, outline ("Searching" with a spinner). Release tables add `v2/Mark/comparison` (best is the only lime pill), `v2/Cell/profile-fit` (fit in words) and `v2/Mark/pending-change` (old value, arrow, new value on amber while a change waits).
- **v2/Input/Search:** `muted` fill and no edge at rest, white with an `input` edge plus the ring when focused. In a form (`v2/Field/labelled`) it becomes 40px, radius 6, white with an edge. Phone: 44px, full width.
- **Toggle group:** `muted` track, white selected segment with a 1px edge and black 600 label, no shadow. **Tabs:** active label black 600 with a 2px underline. **Checkbox and radio:** 16px, `input` edge, black when on. **Switch** is for settings only; monitored is always `v2/Toggle/Bookmark`.

### Tables and rows

`v2/Table` is white with a 1px edge and radius 10. Every named row (release, episode, season, download, health problem and the rest) is an instance of `v2/Table/Row`, so states work the same everywhere: hover `surface-hover`, pressed `surface-pressed`, selected `selected` tint plus a 3px black bar on the left edge, risk a red bar, warning an amber bar, best a `best-soft` tint, focus a 2px inner black edge. A grabbed release swaps Grab for a lime badge with the percent and a 3px black progress line along the row's bottom.

### Chrome and floating things

The downloads bar is black with white text; lime is allowed there for the arrow and progress fills because it sits on black. Menus, tooltips (`bar`, after 400ms), toasts (`bar`, bottom left), the inline panel and the selection bar (`bar`) float and take the shadow. Inside menus and lists the highlight is the focus cue, with no ring.

### Focus

Every focused control gets a 2px `ring` outline with a 2px white gap (Tailwind `outline-2 outline-offset-2`). The black ring is 18.9:1 against the white gap, so it reads beside black, red and lime fills alike. On black bars it is `focus-on-dark`; rows use the 2px inner edge. Spinners (700ms a turn) and skeleton shimmer (1.4s) stay still under reduced motion.

## Do's and Don'ts

### Do:

- **Do** keep normal states quiet: monitored, meets profile, not aired, downloaded show nothing extra.
- **Do** use black for actions and "on" states, and grey tint plus the black side bar for selection.
- **Do** use the real service and tracker logos from the library, never drawn stand-ins.
- **Do** write status in words, every chip as a `v2/Badge` instance.
- **Do** use the words in CONTEXT.md: Release, Grab, Replace, Second version, Manual download, Pick a release, Search automatically.

### Don't:

- **Don't** put lime on white as text, icons, lines or a thin progress bar.
- **Don't** use red for anything that has not gone wrong, or amber for decoration.
- **Don't** put shadows on anything in the page flow, or corners outside 4 to 10px.
- **Don't** use `faint-foreground` for readable text, or opacity for disabled.
- **Don't** draw a coloured side bar on callouts.
- **Don't** describe these static components as working keyboard controls or tested accessibility.
