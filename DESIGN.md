---
name: media-manager-2
description: Paper white and black with lime. Dense release tables, glow-blue actions, lime only for the best release and live downloads.
# Light mode only. Values come from the variables in ~/Projects/media-manager-2-design/design-system.lib.pen.
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
  action: "#9ECAE1"
  action-hover: "#8BBFDB"
  action-pressed: "#76B2D2"
  action-foreground: "#07080B"
  plex: "#E5A00D"
  plex-hover: "#F3AA0E"
  plex-pressed: "#D19209"
  plex-foreground: "#111111"
  jellyfin: "#00A4DC"
  jellyfin-hover: "#1AB3E8"
  jellyfin-pressed: "#0093C6"
  jellyfin-foreground: "#07080B"
  foreground-on-dark: "#ECE9E1"
  muted-foreground-on-dark: "#B8B9B6"
  destructive-on-dark: "#F2A097"
  card-on-dark: "#FFFFFF0D"
  input-on-dark: "#FFFFFF3D"
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
  inline-control: "#F1F4F8"
  inline-control-hover: "#E8EDF4"
  inline-control-border: "#7889A3"
  inline-control-border-hover: "#66778F"
  inline-control-foreground: "#334766"
  status-queued: "#E06A10"
  status-downloading: "#2F8A1F"
  status-importing: "#7A3FD1"
  status-stalled: "#E5534B"
  status-blocked: "#A3150F"
typography:
  title-hero: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "36px", fontWeight: 800}
  page-title: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "26px", fontWeight: 700}
  section: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "16px", fontWeight: 700}
  body: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "14px", fontWeight: 400}
  label: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "13px", fontWeight: 600}
  caption: {fontFamily: "Schibsted Grotesk, sans-serif", fontSize: "11px", fontWeight: 600}
  data: {fontFamily: "Barlow Semi Condensed, sans-serif", fontSize: "14px", fontWeight: 400, fontFeature: "\"tnum\""}
  data-small: {fontFamily: "Barlow Semi Condensed, sans-serif", fontSize: "13px", fontWeight: 500, fontFeature: "\"tnum\""}
  inline-value: {fontFamily: "Barlow Semi Condensed, sans-serif", fontSize: "26px", fontWeight: 700, fontFeature: "\"tnum\""}
rounded:
  radius-xs: "4px"
  radius-sm: "12px"
  radius-md: "12px"
  radius-lg: "12px"
  radius-full: "999px"
  button-radius: "12px"
  button-radius-hover: "14px"
  control-radius-row: "6px"
  control-radius-row-hover: "8px"
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
  poster-width: "210px"
  detail-indent: "133px"
components:
  button-default: {backgroundColor: "{colors.action}", textColor: "{colors.action-foreground}", rounded: "{rounded.button-radius}", padding: "0px 16px", height: "36px"}
  button-default-hover: {backgroundColor: "{colors.action-hover}"}
  button-default-pressed: {backgroundColor: "{colors.action-pressed}"}
  button-row: {backgroundColor: "{colors.action}", textColor: "{colors.action-foreground}", rounded: "{rounded.control-radius-row}", padding: "0px 10px", height: "28px"}
  button-large: {backgroundColor: "{colors.action}", textColor: "{colors.action-foreground}", rounded: "{rounded.button-radius}", padding: "0px 18px", height: "44px"}
  button-outline: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.button-radius}", padding: "0px 16px", height: "36px"}
  button-ghost: {textColor: "{colors.foreground}", rounded: "{rounded.button-radius}", padding: "0px 16px", height: "36px"}
  button-destructive: {backgroundColor: "{colors.destructive}", textColor: "{colors.destructive-foreground}", rounded: "{rounded.button-radius}", padding: "0px 16px", height: "36px"}
  button-destructive-hover: {backgroundColor: "{colors.destructive-hover}"}
  input-search: {backgroundColor: "{colors.muted}", textColor: "{colors.foreground}", rounded: "{rounded.radius-lg}", padding: "0px 16px", height: "48px", width: "640px"}
  input-field: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.radius-sm}", padding: "0px 12px", height: "36px"}
  select-trigger: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}", padding: "0px 12px 0px 16px", height: "36px"}
  toggle-group: {backgroundColor: "{colors.muted}", rounded: "{rounded.radius-md}", padding: "3px", height: "36px"}
  toggle-group-item-selected: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.control-radius-row}", height: "30px"}
  badge-neutral: {backgroundColor: "{colors.muted}", textColor: "{colors.muted-foreground}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  badge-strong: {backgroundColor: "{colors.primary}", textColor: "{colors.primary-foreground}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  badge-best: {backgroundColor: "{colors.best}", textColor: "{colors.foreground}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  badge-destructive: {backgroundColor: "{colors.destructive-soft}", textColor: "{colors.destructive}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  badge-warning: {backgroundColor: "{colors.warning-soft}", textColor: "{colors.warning}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px"}
  badge-plain: {textColor: "{colors.muted-foreground}", padding: "0px", height: "28px"}
  table: {backgroundColor: "{colors.card}", rounded: "{rounded.radius-lg}"}
  table-header: {backgroundColor: "{colors.card}", textColor: "{colors.subtle-foreground}", typography: "{typography.caption}", padding: "0px 16px", height: "32px"}
  table-row: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", typography: "{typography.data}", padding: "0px 16px", height: "40px"}
  table-row-two-line: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", padding: "0px 16px", height: "56px"}
  table-row-hover: {backgroundColor: "{colors.surface-hover}"}
  table-row-selected: {backgroundColor: "{colors.selected}"}
  table-row-best: {backgroundColor: "{colors.best-soft}"}
  nav-item: {textColor: "{colors.muted-foreground}", rounded: "{rounded.radius-md}", padding: "0px 10px", height: "40px"}
  nav-item-active: {backgroundColor: "{colors.selected}", textColor: "{colors.foreground}"}
  dropdown-item: {rounded: "{rounded.radius-xs}", padding: "0px 8px", height: "32px"}
  dropdown-content: {backgroundColor: "{colors.card}", rounded: "{rounded.radius-lg}", padding: "4px", width: "248px"}
  panel-inline: {backgroundColor: "{colors.card}", rounded: "{rounded.radius-lg}", padding: "20px 0px"}
  dialog: {backgroundColor: "{colors.card}", rounded: "{rounded.radius-lg}", padding: "24px", width: "560px"}
  dialog-add: {backgroundColor: "{colors.card}", rounded: "{rounded.radius-lg}", padding: "36px", width: "800px"}
  select-inline: {backgroundColor: "{colors.inline-control}", textColor: "{colors.inline-control-foreground}", rounded: "{rounded.radius-sm}", padding: "0px 12px", height: "38px"}
  select-inline-hover: {backgroundColor: "{colors.inline-control-hover}"}
  badge-inline: {backgroundColor: "{colors.inline-control}", textColor: "{colors.inline-control-foreground}", rounded: "{rounded.radius-sm}", padding: "0px 12px", height: "38px"}
  badge-inline-value: {backgroundColor: "{colors.inline-control}", textColor: "{colors.inline-control-foreground}", typography: "{typography.inline-value}", rounded: "{rounded.radius-sm}", padding: "0px 12px", height: "38px"}
  toast: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", rounded: "{rounded.radius-lg}", width: "400px"}
  selection-bar: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", rounded: "{rounded.radius-lg}", height: "56px"}
  episode-details: {backgroundColor: "{colors.card}"}
  app-bar: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", padding: "0px 40px", height: "64px"}
  downloads-live-bar: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", typography: "{typography.data}", height: "40px"}
  tooltip: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", rounded: "{rounded.radius-sm}"}
  callout-destructive: {backgroundColor: "{colors.destructive-soft}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}"}
  callout-warning: {backgroundColor: "{colors.warning-soft}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}"}
  poster-card: {rounded: "{rounded.radius-md}", width: "210px"}
  callout-info: {backgroundColor: "{colors.muted}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}"}
  status-rule-pill: {backgroundColor: "{colors.muted}", textColor: "{colors.muted-foreground}", rounded: "{rounded.radius-sm}", padding: "0px 8px", height: "26px"}
  status-rule-pill-no-rule: {backgroundColor: "{colors.warning-soft}", textColor: "{colors.warning}"}
  field-number-input: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", typography: "{typography.data}", rounded: "{rounded.control-radius-default}", padding: "0px 12px", height: "36px", width: "72px"}
  collapsible-content: {padding: "0px 12px 16px 36px"}
  chip-fit: {textColor: "{colors.muted-foreground}", rounded: "{rounded.radius-xs}", padding: "0px 6px", height: "20px", width: "36px"}
  tag-format: {textColor: "{colors.muted-foreground}", rounded: "{rounded.radius-xs}", padding: "0px 4px", height: "16px"}
  chip-release-state: {backgroundColor: "{colors.muted}", textColor: "{colors.foreground}", rounded: "{rounded.control-radius-row}", padding: "0px 6px", height: "28px"}
  line-inset-notice: {backgroundColor: "{colors.warning-soft}", textColor: "{colors.foreground}", height: "40px"}
  chip-filter: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.radius-full}", padding: "0px 6px 0px 10px", height: "28px"}
---

# Design System: media-manager-2

## Overview

Paper white and black with lime. Black carries the content and every "on" state (checkboxes, radios, selected rows, toggles). The main action on a screen is a glow-blue button (`action`, the rim of light on the planet mascot, near-black text 11:1); hover `action-hover` with the corners easing from 12 to 14px (`button-radius` to `button-radius-hover`), pressed `action-pressed`, focus the usual 2px black ring, disabled the muted look. Secondary buttons stay white with an edge and tertiary buttons have no fill; buttons use 12px corners, row-size buttons in tables 6px. Destructive buttons stay red. Lime appears in two places only: the best release and live downloads. Red means something went wrong, amber means something is missing or waiting. Tables stay dense: 40px rows inside a 40px page margin, 6 posters per row on Library.

Light mode only for now. The dark design is archived in `~/Projects/media-manager-2-design/archive/mediaManager2-2026-10-11.pen`. Desktop first; the phone is secondary and several phone rows are deferred.

The source of truth is the pen.dev library `~/Projects/media-manager-2-design/design-system.lib.pen`: its variables, its five component sheets and a sixth sheet for motion. The nine screen files import it. `design/mediaManager2.pen` no longer exists; see [`design/README.md`](design/README.md) for which file holds which screen.

These are static pen.dev components. Keyboard behaviour, focus handling, screen reader support, live updates and table sorting are implementation work; a static frame proves none of them.

Token names follow shadcn/ui, so code and design use the same words.

## Colors

Neutrals do most of the work. One meaning per colour.

- **Page and surfaces:** `background` is the page; `card` is tables, panels and menus (both white). `muted` is sunken things: tracks, Kbd keys, the neutral badge, the search field at rest. `surface-hover` and `surface-pressed` are hover and pressed. `selected` is the grey tint on a selected row, always with the 3px black side bar.
- **Text:** `foreground` (18.9:1 on white) for text and icons. `muted-foreground` (7.5:1) for secondary text. `subtle-foreground` (5.6:1) for meta, placeholders and column headers. `faint-foreground` (2.5:1) is for disabled things only, never readable text.
- **Lines:** `border` draws dividers and panel edges. `input` (3.4:1) draws control edges: checkboxes, radios, focused fields. Outline and menu buttons take a 1.5px `foreground` edge instead (1.5px `border` when disabled, 1.5px `destructive` on outline-destructive); at row size inside a table the outline edge is 1px `border`.
- **Black:** `primary` is "on" states (checked, monitored, selected segment label, active tab underline). `bar` is the downloads bar, toasts, tooltips and the selection bar, with `bar-foreground` text. One in-page exception: the setup wizard's "How the pieces connect" strip fills with `bar` once every part is connected, meaning the whole chain is live.
- **Lime:** `best` marks the single best release; `best-soft` tints its row. `live` marks downloads in progress. Lime is 1.3:1 on white, so it is only ever a fill behind black text (14.4:1) or a fill on the black downloads bar or on a poster. Setup wizard exception: a connected part's pill in the "How the pieces connect" strip is black with a lime dot (connected and answering), and the finished strip's pills are lime with black text. Never lime text, lime icons or thin lime lines on white.
- **Slate:** only inside the add dialog's sentence. `inline-control` fills the chips and pills, `inline-control-foreground` is their text (8.5:1 on the fill), `inline-control-border` edges the chips you can click (3.2:1), and the `-hover` pair is hover and open. Slate means "a value in this sentence"; it never marks status, selection or an action.
- **Plex orange:** `plex`, `plex-hover`, `plex-pressed` and `plex-foreground` are only for the "Log in with Plex" button.
- **Jellyfin blue:** `jellyfin` (#00A4DC), `jellyfin-hover`, `jellyfin-pressed` and `jellyfin-foreground` (near-black, 7.0:1 on the fill) are only for the "Log in with Jellyfin" button.
- **On the dark sign-in ground:** `foreground-on-dark` (#ECE9E1) for headings, labels and values, `muted-foreground-on-dark` (#B8B9B6) for body and help text, `destructive-on-dark` (#F2A097, 9.8:1) for error text and edges, `card-on-dark` (white 5%) as the input fill and `input-on-dark` (white 24%) as its edge. The light-mode `foreground` and `destructive` are unreadable there.
- **Red:** `destructive`, `destructive-soft` and their hover and pressed steps are for problems and risk: stalled, failed, gave up, hit and run risk, tracker cooldown, a failed service.
- **Amber:** `warning` and `warning-soft` are for missing, below cutoff, import blocked, unsaved edits and changes waiting for Sonarr or Radarr.
- **Focus:** `ring` (black) on white; `focus-on-dark` (white) on the black bars.
- **Overlay:** `scrim` (black 30%) dims the page behind a phone sheet. `shadow` is the colour of the floating shadow.

Posters keep their own colour; the interface stays black and white around them.

`popover`, `secondary`, `accent` and the `*-foreground` slots exist so shadcn components resolve. `radius` (12) and `radius-xl` (14) are shadcn base slots; components use the `radius-*` scale below.

### Names in the current code

`src/client/globals.css` now uses the names above, with Schibsted Grotesk and Barlow Semi Condensed bundled in `src/client/assets/fonts/`.

## Typography

Schibsted Grotesk (`font-ui`) for the interface: titles, labels, buttons, navigation, reading text. Barlow Semi Condensed (`font-data`) for release data and numbers: release names, sizes, seeders, counts, speeds, dates, file names, addresses.

- Title page hero 36/800; page titles 26/700; sections 16/700; group headings 14/600 sentence case; body 14/400; labels and buttons 13/600 to 15 by control size.
- Column headers are 11/600 capitals in `subtle-foreground`, so a group heading never reads as a column header. The releases inset header is 700.
- Numbers use tabular figures and right-align in their columns.

## Layout

- **Desktop:** 64px app bar (`topbar`) with a 48px search field centred between the product name and the navigation, 560 to 720px wide (640 in the library). 40px black downloads bar (`livebar`) at the bottom of every desktop screen. 40px page margin (`page-margin`).
- **Tables:** 40px rows, 56px for two-line rows (`row-two-line`), 32px header row (`row-header`), 16px side padding in every row so columns line up across pages. Column edges are shared across tables; see Tables and rows.
- **Library:** 210px posters (`poster-width`), 6 per row at 1440px with 20px gaps (`poster-gutter`). The first and last poster in a row sit on the page margins; at other widths the gaps widen to fill the row, never below 20px. The Discover grids work the same way.
- **Group headings:** 24px above, 8px below, no band and no line.
- **Episode details:** opens under the row as a full-width white band with no side bar, content starting at the Title column (`detail-indent`, 133px). Three sections 24px apart: Details, Versions, History, each a group heading over a white panel.
- **Title header:** 220px backdrop band fading to white behind a 210 by 315 poster, title 36/800, facts column on the right. When the page scrolls it collapses to a 72px strip with a 32 by 48 poster thumb, breadcrumb, 20/700 title and the same three actions.
- **Phone:** 16px margin (`page-margin-phone`), 52px top bar with a full-width 44px search under it (`v2/Navigation/Phone`, `navigation-phone.tsx`), bottom sheets for grabs and choices (`v2/Sheet (phone)`, `sheet-phone.tsx`: corners 10 on top, a 36 by 4 handle, 18/700 title, full-width 44px actions), 44px touch targets.
- **Spacing:** the `space-*` scale, 4 to 64px.

## Elevation & Depth

Flat by default. Things in the page flow (tables, rows, the inline panel, callouts, cards, the add block, the episode details band) get a 1px `border` edge and no shadow.

Only things that float get a shadow: dropdown menus, tooltips, toasts, dialogs, the phone sheet and the selection bar. One shadow for all of them: `0 2px 6px #1111110F, 0 8px 24px #1111111F` (the phone sheet casts it upward).

## Shapes

Two corner sizes. Everything outside a table is 12px: buttons, inputs, selects, toggle groups, cards, posters, panels, dialogs, menus, toasts, callouts, sheets and the add dialog's inline chips (`radius-sm`, `radius-md`, `radius-lg`, `control-radius-default`, `control-radius-large` and `button-radius` all resolve to 12). Controls inside a table row are 6px (`control-radius-row`): Grab, Pause, Search again and the other 28px row buttons, and the release-state chip. The bookmark toggle keeps 12 in a row. A toggle group's segments are 6 inside its 12 track. List rows outside a table (the episode list, service rows) are 12. On hover a button's corners grow by 2px (12 to 14, 6 to 8) and the button grows 4px in width and height, centred so nothing around it moves. Small atoms keep `radius-xs` (4): badges, Kbd, checkboxes, menu items, skeletons and the toast action; dots and progress bars use `radius-full`. The add dialog's sentence box is the one larger corner, 16px. The only side bar is the 3px row marker; callouts have none.

## Components

Every component lives in `~/Projects/media-manager-2-design/design-system.lib.pen` as `v2/Family/Variant` and shows its states as instances beside it. Each sheet note names the shadcn/ui component it maps to, or says "Custom". Screens use instances and override named children (`Label`, `Count`, `Value`, `Icon`, `Kbd`).

### Control sizes

Four sizes, set with the `control-*` tokens. Buttons, inputs, selects and toggle groups match, and so does the plain badge at row height.

- **Row** 28px (`control-h-row`, padding 10, text 13, radius 6, icon 14): only inside table rows and dense lists.
- **Small** 30px (`control-h-sm`, otherwise the default tokens): controls in a filter bar beside a toggle group, so they line up with its 30px segments. `v2/Select trigger/sm` and `v2/Button/sm`.
- **Default** 36px (`control-h-default`, padding 16, text 14, radius 12, icon 16): everywhere else.
- **Large** 44px (`control-h-large`, padding 18, text 14, radius 12, icon 18): the one main action on a page or panel, such as the title header actions, the grab confirmation (Replace or Second version) and Settings Connect.

Icon-only buttons are squares at the same heights. pen.dev cannot bind height or icon size to a variable, so those are typed numbers, on badges too; change them together with the tokens.

### Buttons, badges and inputs

- **v2/Button:** primary (glow-blue `action`, shadcn `default`), outline (white, 1.5px `foreground` edge; 1px `border` at row size), ghost, destructive (red), outline-destructive, menu (outline with a chevron), and the two brand buttons `v2/Button/plex` and `v2/Button/jellyfin` (44px, brand fill and edge, 20px black mark and label on the brand tokens; only on the sign-in block). Disabled is a grey fill, never opacity. Loading swaps the icon for a spinner and keeps the width.
- **v2/Badge**, 20px (`badge-h`, padding `badge-px` 6, text `badge-text` 11, icon `badge-icon` 12): neutral (`muted`), strong (black, "In library"), best (lime `best`, black text: the best release), live (`muted`, black text and `v2/Status/download circle`: "Downloading 64%"), risk, warning, outline ("Searching" with a spinner). `v2/Mark/pending-change` shows the old value, an arrow and the new value on amber while a change waits; the release table's chips and marks are listed under Releases. `v2/Chip/filter` (`chip-filter.tsx`) is a filter that is on, such as a Discover filter tag: 28 high, white, 1.5px `input` edge, fully round, 13/500 words and a 14px remove cross. `v2/Mark/comparison` (`mark-comparison.tsx`) says how a release compares, such as "better": a 12px up arrow and 12/600 words, 20 high, no fill. Plain is the look for a standing status beside a row button, such as In library on a search result: no fill and no padding, a 14px `foreground` check and `muted-foreground` words, built from the row tokens (`control-h-row`, `control-text-row`, `control-icon-row`) so it lines up with the button. A filled badge never takes button height, or it reads as a button; the one exception is `v2/Chip/release-state` (`chip-release-state.tsx`), 28 high because it stands where the row's Grab button was.
- **v2/Input/Search:** `muted` fill and no edge at rest, white with a 1.5px `input` edge plus the ring when focused. In a form (`v2/Field/labelled`) it becomes 36px, radius 12, white with an edge. Phone: 44px, full width. An empty field is `v2/Field/labelled/empty`: the placeholder in `subtle-foreground`. On the dark sign-in ground it is `v2/Field/labelled/on-dark`: `card-on-dark` fill, `input-on-dark` edge, on-dark text, and `destructive-on-dark` error text with a 2px edge; the sign-in block uses it at the large size (44px, 16px text).
- **Select trigger:** 36px, radius 12, 1.5px `input` edge, an optional grey lead label before the value, the chevron at the right edge at any width; the open list is a dropdown menu. `v2/Select trigger/sm` is the same at 30px for filter bars.
- **Toggle group:** up to six segments, 30px each inside a 36px `muted` track with 3px padding; white selected segment, radius 6, with a 1px edge and black 600 label, no shadow. The releases inset's quality filter is the same group at 32px with 28px segments (`size="inset"` in `toggle-group.tsx`). **Tabs:** active label black 600 with a 2px underline. **Checkbox and radio:** 16px, `input` edge, black when on. **Switch** is for settings only; monitored is always `v2/Toggle/Bookmark`.
- **Option rows:** `v2/Option row` (`option-row.tsx`) is a radio or checkbox with a title and a line of explanation, radius 12, no edge; the choice shows in the control, never as a tint. `v2/Option row/bordered` (the `bordered` prop) is the same row as a card with its own edge, for a short set of standalone choices in a grid: site software, backup destination, Plex token, the setup wizard's optional parts. Radius 12, padding 14 16, white fill, 1px `border` edge; on, the edge turns 2px `foreground`, the second pixel an inset shadow so nothing moves. `v2/Option row/bordered/service` is the first-run pick of a media server on the dark ground: `card-on-dark` fill, white 12% edge, a 32px service logo in place of the radio and a chevron on the right; it opens the next step rather than recording a choice. `v2/Card/choice` is the larger radio card for decisions in a panel or dialog.

- **Sentence form (the add dialog):** the settings are read as one sentence. `v2/Select trigger/inline` is a choice inside it: slate fill, 1px `inline-control-border` edge, bold text, line height 1.3 and a 16px chevron; open or hover goes to the `-hover` pair, open adds a 1.5px `inline-control-foreground` edge. The Sonarr or Radarr logo and name inside it (`Badge variant="inline"`) has the same fill, a 24px logo, no edge, no chevron, 500 weight, and is never focusable. `v2/Badge/inline` (`Badge variant="inline-value"`) is a calculated value inside it (aired count, next air date, movies in a collection, expected date) in Barlow Semi Condensed 700 at 26px, line height 1.3, with tabular figures, in the same 38px pill with 12px padding. A required choice left empty is the same select in amber (`warning-soft` fill, 1.5px `warning` edge, `warning` text) with a plus in place of the chevron and a verb-first label ("Choose seasons"), plus an amber helper line under the sentence; the confirm button stays disabled. Text is 22px with chips 38px tall. The sentence sits in a rounded box (1.5px `input` edge, radius 16, padding 28 32, 14px between lines, as wide as its longest sentence up to the dialog width so the space either side of the text matches) so it reads as the one place to change the add; the amber helper line goes under the box. Wording: three short sentences, one fact each, one per line. 1 "[Sonarr] will add <title> to your library." 2 "Monitor [choice] using profile [profile]." (specific seasons: "Monitor [specific seasons]: [1, 2, 7] using profile [profile]."; no episodes or nothing: "Monitor [no episodes]." and no third line). 3 what the search covers: "[18] aired episodes will be included in the search."; nothing aired yet: "Nothing has aired yet. The first episode airs on (date)."; future episodes: "The next episode airs on (date)." when known. For a movie the monitor choices read "just the movie", "entire collection" and "nothing", and line 3 reads "Search starts once it's [available], expected on (date)." (date from the chosen availability: cinema date, or the earliest digital or physical date; dropped when unknown or past), "Search starts now." when already out, or "Search covers up to (3) movies once they're [available]." for a collection. `v2/Block/add-controls` lays out the dialog body: More options sits 28 below the box. Settings that don't read as a sentence sit under that 32-high `v2/Collapsible trigger` whose summary line lists their values, as `v2/Fact/row` rows 48 high with 180px labels, indented 24, with a select sized to its longest option (MUI Select rule: the trigger never changes width, the chevron sits at the right edge). A successful Confirm closes the dialog and shows a toast titled "Added <title> to your library" whose second line repeats line 3's fact ("Sonarr is searching 18 aired episodes.", "Sonarr will search once episodes air.", "Nothing is monitored.", "Radarr is searching now.", "Radarr will search once it's available, expected on 26 Mar 2027.", "Radarr is searching up to 3 movies."). The dialog opens with the remembered quality profile and root folder (the last successful add per service) preselected.

### Rule forms and tracker status

- **v2/Field/number** (`field-number.tsx`): a 72 by 36px number box with plain words before and after it, read as one sentence ("Not a hit and run below 10 % downloaded"). The value is in `font-data`; an empty box shows a hint in `subtle-foreground`. Either word can be left out. Seed-time size bands and the More section of a tracker's rule are built from it.
- **v2/Field/labelled optional** (`field-labelled-optional.tsx`): `v2/Field/labelled` for a field that may be left blank. The word Optional sits after the label in 12px `subtle-foreground`; help, error and the trailing action work as in `v2/Field/labelled`.
- **v2/Collapsible trigger/open**: the open state of `v2/Collapsible trigger` (`collapsible-trigger.tsx`); the chevron turns 90° to point down and the summary hides. No separate code component.
- **v2/Collapsible/content** (`collapsible-content.tsx`): holds what the trigger reveals, directly under it. 12px between children; padding 0 12 16 36 lines the content up with the trigger's title. Opens by height at `duration-size`, closes at `duration-fast`; instant under reduced motion.
- **v2/Callout/info** (`callout-info.tsx`): a fact to know, not a problem: `muted` fill, `muted-foreground` icon (info by default; the screen may swap the icon, such as a file icon for "comes from the env file"), radius 12, no side bar, optional outline button 16px under the words. Use `v2/Callout` for risk and warning.
- **v2/Status/rule pill** (`status-rule-pill.tsx`): a tracker's hit and run rule state, in the tracker row and the tracker editor. Same 26px shape as the service pill with no logo and no icon: Configured and Configured (env file) have a black dot on `muted`; No rule has an amber dot and amber text on `warning-soft`, because that tracker's torrents keep seeding. The same amber look marks an account that answers but can't share its stats ("No account stats").

### Tables and rows

`v2/Table` is white with a 1px edge and radius 12. Every named row (release, episode, season, download, health problem and the rest) is an instance of `v2/Table/Row`, so states work the same everywhere: hover `surface-hover`, pressed `surface-pressed`, selected `selected` tint plus a 3px black bar on the left edge, risk a red bar, warning an amber bar, best a `best-soft` tint, focus a 2px inner black edge.

- **Columns and edges:** every table is 1360 wide with 16 side padding and 16 between columns. Shared edges: Air date 712 (104; Tracker takes this edge on a table with no date), Status 832 (176), Quality 1024 (104), Size 1144 (72, right-aligned), Actions 1232 (112, right-aligned). Seasons table: chevron 16 (20), bookmark 52 (28), number 96 (40), title 152 to 696. Version rows under an open episode start at x 152 and keep every shared edge. A table's own columns go between its first column and Tracker.
- **Headers:** 32 high, white, 11/600 capitals (700 in the releases inset) in `subtle-foreground`, 0.5 tracking, 1px border line under. Seasons table: a season header at the top and an episode header directly under each open season. MONITOR right-aligned in a 64 cell over the chevron and bookmark columns. Header cells are `v2/Table/Cell/header` instances; set only content, width and justifyContent on them.
- **Row heights:** season 48. Episode, version, release and download 40. Header 32, the versions header under an open episode included. The expanded element is that header plus its version rows, with no padding. A download's band hugs its lines (32, or 50 with a message and buttons). Every height includes the row's 1px line.
- **Lines:** every row ends with a 1px line in `input` grey (#8C8C85), whatever its tint, inset by depth: season rows x 16 to 1344, episode rows x 96 to 1344, version rows and the versions header x 152 to 1344. Flat tables x 16 to 1344. The last row of a group takes the line of the row that follows it: set the line's left padding to 80 (episode line) on the last version row before an episode, and to 0 (season line) on the last episode, or last version, before a season. A table's last row has none; the table edge closes it.
- **Tints:** white rows. Season rows: `accent`, full width. The open episode row: `accent` from x 96 to 1344 only (Open tint); the gutter stays white. The expanded element and its version rows: white. Selected: `selected` tint with the 3px black bar. Hover: `surface-hover`, `surface-pressed` on an accent row. Best release: `best-soft`. Download band: `muted`. One tint per row.
- **Precedence:** tint, first match wins: selected, hover, the row's own tint (accent or best-soft), white. Bar, first match wins: black for selected, red, amber; while a row is selected its red or amber stays in the chip. The line at the bottom of a row never changes.
- **Bars:** 3px at the left edge, at most one per row: black for selected, red when the row's chip is red, amber when it is amber, season rows included. No tint with a bar. Open has no bar.
- **Status chip:** one `v2/Badge` per row, in Status. Live: `muted` fill, black words, download circle on. A fact worth noticing: `muted` fill, grey words. The row's normal state: no fill, grey words. Amber (`warning-soft`): missing, below cutoff. Red (`destructive-soft`): import blocked, failed, stalled, Sonarr or Radarr warning, rTorrent error, gave up, hit and run risk, tracker cooldown. No lime on a status chip except the Best release. Sentence case, at most one detail after " · ", percent rounded down. Seeding reads "Seeding" until the time-left wording is approved.
- **Opening an episode:** only an episode with a file opens. The ••• at the row's right end (today's Details button) opens a menu whose first item is View files, Hide files while open; Esc closes. Without a file the item is absent and nothing opens. No chevron on episode rows. Open: the row's `accent` tint runs x 96 to 1344; under it, white and with no card, a versions header and the version rows start at x 152, each ending with its line from x 152; history follows below them at the same inset.
- **Actions:** main row action (Grab, Add): `action` fill, `action-foreground` words, 28 high. Secondary: outline with a 1px `border` edge. Delete and Remove from downloads: outline destructive. Row icons 14 px `muted-foreground` in 28 px buttons, 2 apart. A tracker cooldown turns Grab off.
- **Motion:** the expanded element opens with a height change at `duration-size`, ease-out, and closes at `duration-fast`, ease-in (as in `EpisodeRows.tsx`). A status change crossfades the chip's colours at `duration-base`; the words swap at once. The download circle follows `v2/Status/download circle`: queued blinks, downloading fills clockwise, importing turns, paused holds.
- **Reduced motion:** reuse the circle spec: queued holds solid, downloading jumps to the new percent, importing and searching hold with the gap at the top, paused never moves. The chip's colour crossfade stays; the expanded element opens and closes without the height change.

### Releases

- **Releases inset:** `v2/Row/episode-releases` (`row-episode-releases.tsx`) opens under an episode row from the list icon in its actions, drawn pressed while open; the icon again or Esc closes it. On the movie page it opens under the tracked version row. White, no card, no padding; the open row above takes its open tint; the last row's `input`-grey line closes it. Content starts 10 in from the inset's edge (162, or 26 on the movie page); the lines and the tint start at the edge. Opening (releases.pen motion screen "Releases inset opens under episode", ifAlv): the list icon in the episode row turns pressed at once and the open tint appears. The inset's height grows from 0 to 452 over `duration-base` (160 ms), ease-out, and the rows below move down with it; it closes at `duration-fast`, ease-in. The inset's own rows do not move inside it. Reduced motion: no height animation; the inset appears at full height at once and closes at once.
- **Height and scroll:** the filter row, the 32 header and the pinned Yours row stay put. Under them a 340 scroll area holds eight 40 rows and 20 px of a ninth, with a 6 px `input`-grey scrollbar in the 16 px right gutter. 452 high with a file, 412 without; a shorter list takes its own height.
- **Filter row:** first in the inset, under the numbering notice when there is one: 40 high, the quality toggle group (32 track, 28 items) from x 162 with Refresh beside it (outline with a 1px `border` edge, 28 high, refresh icon; the spinner replaces the icon while searching or refreshing). Counts leave out the Yours row. Left out in the empty and failed states.
- **Columns:** each release is a `v2/Row/release` (`row-release.tsx`). Episode page, inset at x 152: Release 152 (384) · Audio · HDR 552 (144) · Seeders 712 (64, right-aligned) · Tracker 792 (104) · Fit 912 (96) · Quality 1024 (104) · Size 1144 (72, right-aligned) · last column 1232 (112, right-aligned, blank header). Quality, Size and the last column keep the shared edges. Movie page: the list starts at x 16 and Release is 520. No Hit and run column: the tracker tells the rule. A freeleech release shows `v2/Mark/freeleech` (`mark-freeleech.tsx`, a 12 px `foreground` percent icon) 6 px after the tracker name; a proper shows `v2/Mark/proper` (`mark-proper.tsx`, a 12 px `muted-foreground` wrench) after the quality.
- **Release names:** `v2/Cell/release-name` shows the name in full where it fits. Otherwise cut in the middle with …: the start keeps the series and SxxExx (a movie keeps its title and year), the end keeps the group in 700 `foreground`. The group and the episode number are never cut. Dotted name in `muted-foreground`. A 14 px history mark, at least 6 px from the name, (`v2/Mark/history`, `mark-history.tsx`) at the cell's right edge: failed before, blocklisted, or grabbed before; the worse one shows.
- **Tags:** Audio · HDR holds one outlined `v2/Tag/format` (`tag-format.tsx`) per format, audio first then picture: DDP 5.1, DV, HDR10. 16 high, radius 4, `input`-grey edge, data 12/600 in `muted-foreground`, 4 apart, left-aligned, never wrapping.
- **Seeders:** the number alone: 0 in `destructive`, under 10 in `warning`, both 600; ? when the tracker does not say; blank on the Yours row. No box or chip. Leechers in the tooltip.
- **Fit:** 96 wide, one 36 by 20 `v2/Chip/fit` (`chip-fit.tsx`) at the cell's left edge so the scores line up. Zero or more: outlined, `input`-grey edge, data 13/500 `muted-foreground`. Negative: `warning-soft` with `warning` words. Best: the lime chip with its score, or a star when no scores exist; the only lime in the list. Rejected: the 16 px monitor-x in `destructive` on `destructive-soft`, the row dimmed to `subtle-foreground`, the reasons in the tooltip; on a rejected row the group drops to 500 and the resolution to 400. No reason chip anywhere.
- **Last column:** the user's relationship to the release, one thing at a time. Grab in `action`, 28 high, or an outline Grab on a rejected row. After a grab, `v2/Chip/release-state` (`chip-release-state.tsx`), a 28 high chip with 11/600 words: Grabbed (orange circle, `#E06A10` ring and solid fill), the percent alone while downloading (18%, green circle filling, `#2F8A1F` ring with a clockwise fill), Stalled (light red, `#E5534B`), Importing (purple, `#7A3FD1` ring with a gap), Import blocked (dark red, `#A3150F` solid). Yours, black with white words, on the owned file. Red states on `destructive-soft` with red words. The words swap at once; the colour crossfades. The five circle colours are the `status-queued`, `status-downloading`, `status-stalled`, `status-importing` and `status-blocked` tokens; `v2/Status/download circle` is `status-download-circle.tsx`.
- **Size:** the number in `foreground`, the unit in `subtle-foreground`, right-aligned.
- **Cooldown:** a red Cooldown chip in the last column in place of Grab, with the red 3 px bar at the table's left edge. The only bar in this table.
- **Tints:** Best's `best-soft` runs from the inset's edge to 1344, the extent of its line. The Yours row is white. One tint per row.
- **Hidden releases:** releases Sonarr matched to another episode (`episodeRequested` false) are never listed. When nothing matches, the inset shows the empty state: "No release for this episode", then "3 results were for other episodes", and Search again. No filter row and no header.
- **Numbering notice:** when the episode's scene numbers differ from its own, a `v2/Line/inset-notice` (`line-inset-notice.tsx`) sits above the filter row: "Trackers number this episode S02E07." Notices inside the releases inset are never callouts. Every one (search failed, earlier results, results out of date, tracker numbering notice) is one 40 px line spanning the inset's width (x 152 to 1344 under an episode, 16 to 1344 on the movie page), fill `warning-soft`, no radius, no card, the message in 13 px `foreground` words at the 10 px gap, and the call to action as a 28-high outline button at the right edge, with no white fill and a 1px `input` edge ("Try again" on failed, "Refresh" on earlier results and out of date, none on the numbering notice), ending with the usual 1 px line like a row.
- **Searching and errors:** searching: Refresh spins with "Searching every indexer. This takes about 20 seconds." beside it, and four placeholder rows sit under the header (release blocks of varied width, a second audio block on every other row), so the inset is about 232 high while searching. When results arrive, the first four rows fade in over the placeholders (about 120 ms, ease-out, no movement), then the inset grows to its full 452 with the remaining rows fading in as the space opens, including rows inside the scroll area; the header and the pinned Yours row stay put. Reduced motion: no fade and no height animation, the listed state appears at once. Sonarr not answering: the inset notice line with Try again. The failed state is that notice line alone, with no filter row, no header and no rows. When earlier results exist the list stays and the notice line under the filter row says these are the earlier results, with Refresh. Results too old: the same notice line asks for a refresh, with Refresh.
- **Grab dialog:** main button in `action` with `action-foreground` words. Counts as (`v2/Dialog/counts-as`, `dialog-counts-as.tsx`): a tertiary collapsible under the choice cards, closed by default with the current value beside it; open, the season in plain words and one inline select for one episode. No quality choice. Opening (releases.pen motion screen "Grab dialog open", HEg3R): the scrim and the dialog fade in, `duration-base` ease-out; on confirm the dialog closes and the last column changes to the Grabbed chip, crossfade at `duration-base`. Reduced motion: no fade; the scrim and the dialog appear at once.

### Library, search and calendar

- **Poster card:** 210 by 315 everywhere (Library, Discover rows and grids, title page), radius 12, 1px inner edge, title 14/600 (rank 14/600 in `subtle-foreground` before it), the calendar date tab radius 12, and a 130px overview panel on hover. Hover darkens the poster 8%, pressed 16%; selected adds a 2px black edge and a 700 title. Downloading shows a 4px lime strip on the poster's bottom edge; just imported shows it full width plus a black chip with a lime check.
- **Profile fit:** `v2/Cell/profile-fit` (`cell-profile-fit.tsx`) is a quality profile score in a cell: a 14px check and the score, data 14 in `muted-foreground`, no box.
- **Previous and next:** `v2/Link prev-next` (`link-prev-next.tsx`): two ghost buttons, 36 high, 600 words and 16px chevrons in `muted-foreground`, 6 between chevron and words.
- **Search result:** 84px row with a 40 by 60 poster, title and year, one meta line, one overview line, and either "In library" as a plain badge (check and words, no box) with the file count (fixed 80px column) or a row-size outline Add button, both 28px.
- **Calendar:** entries are `muted` tiles, radius 12, no edge, with a 3px marker (amber missing, red gave up) and a black progress bar while downloading. Today's date sits in a black circle. Month cells are 188 by 132 with up to three entries and "+2 more". Week view has a 2px black now line with an 8px dot. The calendar is view-only; entries open the title.

### Chrome and floating things

- **App bar:** 64px, white at 70% over a 24px background blur on every page so what scrolls under it shows through, line under, 40px side padding. Nav items are 40px, radius 12, 500 labels in `muted-foreground`, with a count pill (red on `destructive-soft` for problems); the active item gets the `selected` fill and a black 600 label. Service status lives behind Health, whose count turns red when a service fails. Before setup is done the bar is `v2/AppBar/Desktop/setup`: the product name only, no search or navigation, and a ghost "Sign out" button on the right.
- **Downloads bar:** black with white text; lime is allowed there for the arrow and progress fills because it sits on black. Idle reads "Nothing downloading". A stalled item shows a red dot and words.
- **Floating:** menus (248px, 32px items, sentence-case group headings), tooltips (`bar`, after 400ms), toasts (`bar`, 400px, bottom left above the downloads bar, Undo with the Z key), dialogs and the selection bar (`bar`, 56px, 16px above the downloads bar) take the shadow. Inside menus and lists the highlight is the focus cue, with no ring.
- **Sign-in:** a dark `#07080b` ground with the planet drawn behind and no app bar, a 400px block fixed 120px from the left and bottom edges on desktop (24px sides and 83px from the bottom on a phone) holding the product name and the brand button for the chosen media server: Plex-orange `plex` "Log in with Plex" with Plex's black chevron (`v2/Sign-in/block`), or Jellyfin-blue `jellyfin` "Log in with Jellyfin" with the black Jellyfin mark (`v2/Sign-in/block/jellyfin`). Text on the ground uses `foreground-on-dark` and `muted-foreground-on-dark`. While Jellyfin Quick Connect waits for approval the block's body is `v2/Sign-in/quick-connect code` (`sign-in-quick-connect-code.tsx`): an instruction line, six digits in two groups of three (Barlow Semi Condensed 64/600, 6px tracking) and the expiry; the username and password fallback is the on-dark field at the large size. One line under the button only after a failed attempt, an expired session, or when sign-in is not configured.

### Where a decision opens

The kind of decision sets the scale of the place it opens in. Three tiers:

1. **In the table**, for choices that open from a row and need the rows in view: a tinted `muted` band under the row, 13px text, choices as a 28px toggle group or 32px option rows, and a 28px button on the row's actions line named for the outcome. No 40 or 48px control and no card surface inside a table. Grab choice, remove from downloads, inline status, history details, the releases inset (`v2/Row/episode-releases`).
2. **Page panel** (`v2/Panel/inline`), for work under a page header or hero or with its own rows: 1px edge, no shadow, a 36px Close, one 44px main action. Import by hand, change monitoring.
3. **Dialog** (`v2/Dialog` over `v2/Scrim`, 560px), for destructive or lossy confirmations: delete a file, version or title; replace the current file; discard unsaved edits; remove from downloads; grab on a title you already own. One wider exception: adding a title opens an 800px dialog (`dialog-add`, 36px padding) from the "Add to library" button in the title header. Its title is 36px with the title's name in 800 weight ("Add **The Studio**"), its body is the sentence form, and its footer is a borderless Cancel and a glow-blue "Confirm selection".

### Errors, empty and loading

- A row error is an inline status line (`v2/Status/inline`: icon plus words for sent, failed or busy) in a `muted` band under the row.
- A table error is a one-line `v2/Callout` above the table. Callouts come in risk, warning and info looks, radius 12, no side bar.
- Empty: a centred 360px block, one plain sentence and at most one next step.
- Loading: skeleton rows shaped like the row family they replace (40px row, 56px two-line row, poster card, search result, calendar entry).
- Unsaved edits: an amber pencil and "Unsaved edits" in the footer beside a Discard edits outline button; the main action stays the 44px button.

### Focus

Every focused control gets a 2px `ring` outline with a 2px white gap (Tailwind `outline-2 outline-offset-2`). The black ring is 18.9:1 against the white gap, so it reads beside black, red and lime fills alike. On black bars it is `focus-on-dark`; rows use the 2px inner edge. Spinners and skeleton shimmer stay still under reduced motion (see Motion).

## Motion

The library's sixth sheet holds the motion tokens and a transition table; each screen file holds `v2 / Motion / …` storyboards drawn as Before, Mid and After frames.

- **Durations:** `duration-fast` 120ms (hover, press, checks), `duration-base` 160ms (panels, menus, tabs, crossfades), `duration-slow` 220ms (toast, phone sheet, progress), `duration-spin` 700ms, `duration-shimmer` 1400ms, `duration-toast` 6000ms, `delay-tooltip` 400ms.
- **Easing:** `ease-out` `cubic-bezier(0.2, 0, 0, 1)` for anything entering, crossfades and progress; `ease-in` `cubic-bezier(0.4, 0, 1, 1)` for anything leaving; `ease-linear` for loops. `ease-in-out` `cubic-bezier(0.4, 0, 0.2, 1)` exists but no transition uses it yet.
- **Reduced motion** (`prefers-reduced-motion: reduce`): loops stop, every slide or scale becomes an opacity fade of `duration-fast`, every size change is instant.

| Trigger | What changes | Duration | Easing |
|---|---|---|---|
| Page change (links, back, forward) | one view transition per change: the old screen holds up to 350ms while the new one loads its data and the images in view (a poster that arrives in time shows without its own fade), then the old fades out as the new fades in, both on the same timing so the page never washes out; a new screen opens at the top, back and forward return to their scroll | base | out |
| Open a title from a poster card | the card's poster morphs into the title page's poster, the same size, during the page change; a title page still loading shows that poster in place | slow | out |
| Hover (rows, buttons, nav, posters, calendar entries, cards) | fill to the hover token; poster brightness to 92% | fast | out |
| Press, focus ring | instant | 0 | — |
| Inline panel open / close | height 0 to full, fade in, rise 6px, sibling rows dim / reverse | base / fast | out / in |
| Season expand, history row expand | chevron turns 90°, rows grow from 0 | base | out |
| Releases inset open / close | height 0 to full, rows below move down; the inset's own rows do not move | base / fast | out / in |
| Releases arrive | first four rows fade in over the placeholders, then the inset grows to its full height as the remaining rows fade in; header and pinned row stay put | fast, then base | out |
| Row selection | side bar and selected fill appear | fast | out |
| Selection bar in / out | slide up 16px and fade in / fade out | base / fast | out / in |
| Toast | slide up 12px and fade in, stays `duration-toast` (paused on hover), fades out | slow / fast | out / in |
| Phone sheet and scrim | sheet slides up, scrim fades in | slow | out / in |
| Dropdown menu, select list | fade and 4px slide from the trigger | fast | out / in |
| Tooltip | fades in after `delay-tooltip` | fast | out |
| Skeleton to content | only when content arrives after its screen is showing: the skeleton stays underneath and fades out while the content fades in, so shared parts such as a poster stay solid; content ready within the hold just appears with the page change | base | out / in |
| Progress update | fill width moves; percent text swaps at once | slow | out |
| Download imports | badge crossfades Downloading to Imported; row leaves the list after `duration-toast` | base | out |
| Grab in a row | Grab, then the release-state chip; the words swap at once, the colours crossfade | base | out |
| Undo window (blocklist, toast) | row height to 0 after the window; Undo restores it | base | in / out |
| Checkbox, radio, bookmark | glyph scales 0.85 to 1, check stroke draws | fast | out |
| Toggle group, tabs | segment or underline slides to the new item | base | out |
| Calendar step, view switch, search results, settings pane | content crossfade | base | out |
| Downloads bar expand | panel rises from the bar | base / fast | out / in |
| Sign-in state change | heading and body crossfade; button label swaps at once | base | out |
| Connect, Run all checks, Add and search | button goes to loading at once; result crossfades | base | out |
| Dialog | scrim and dialog fade in, dialog scales 0.98 to 1 / reverse | base / fast | out / in |
| Add dialog, monitor or seasons change | sentence line 3 fades in anew and the count pill's fill flashes inline-control-hover then back; only on the owner's change, never on data arriving | base | out |
| Add dialog, Confirm | the line-3 number travels from the closing dialog into the toast's second line, fill inline-control to transparent and text inline-control-foreground to bar-foreground, while the dialog takes its usual exit and the toast rises; never on a refusal; reduced motion shows the toast with the number already in place | slow / fast | out / in |

## Do's and Don'ts

### Do:

- **Do** keep normal states quiet: monitored, meets profile, not aired, downloaded show nothing extra.
- **Do** use glow-blue `action` for the main action and black for "on" states, and grey tint plus the black side bar for selection.
- **Do** use the real service and tracker logos from the library, never drawn stand-ins.
- **Do** write status in words, every chip as a `v2/Badge` instance (the add dialog's sentence uses `v2/Select trigger/inline` and `v2/Badge/inline` instead).
- **Do** use the words in CONTEXT.md: Release, Grab, Replace, Second version, Manual download, Pick a release, Search automatically.

### Don't:

- **Don't** put lime on white as text, icons, lines or a thin progress bar.
- **Don't** use red for anything that has not gone wrong, or amber for decoration.
- **Don't** put shadows on anything in the page flow (the inline panel included), or corners other than 4, 6 and 12px (8 and 14 on hover, 16 on the add dialog's sentence box).
- **Don't** put a 40 or 48px control, or a card, inside a table row; open a page panel or a dialog instead.
- **Don't** use `faint-foreground` for readable text, or opacity for disabled.
- **Don't** draw a coloured side bar on callouts.
- **Don't** describe these static components as working keyboard controls or tested accessibility.
