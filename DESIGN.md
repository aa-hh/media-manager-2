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
  plex: "#E5A00D"
  plex-hover: "#F3AA0E"
  plex-pressed: "#D19209"
  plex-foreground: "#111111"
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
  poster-width: "152px"
  detail-indent: "133px"
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
  nav-item: {textColor: "{colors.foreground}", rounded: "{rounded.radius-md}", padding: "0px 10px", height: "40px"}
  nav-item-active: {backgroundColor: "{colors.selected}"}
  dropdown-item: {rounded: "{rounded.radius-xs}", padding: "0px 8px", height: "32px"}
  dropdown-content: {backgroundColor: "{colors.popover}", rounded: "{rounded.radius-lg}", padding: "4px", width: "248px"}
  panel-inline: {backgroundColor: "{colors.card}", rounded: "{rounded.radius-lg}", padding: "20px"}
  dialog: {backgroundColor: "{colors.card}", rounded: "{rounded.radius-lg}", padding: "24px", width: "560px"}
  toast: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", rounded: "{rounded.radius-lg}", width: "400px"}
  selection-bar: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", rounded: "{rounded.radius-lg}", height: "56px"}
  episode-details: {backgroundColor: "{colors.muted}"}
  app-bar: {backgroundColor: "{colors.background}", textColor: "{colors.foreground}", padding: "0px 40px", height: "64px"}
  downloads-live-bar: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", typography: "{typography.data-small}", height: "40px"}
  tooltip: {backgroundColor: "{colors.bar}", textColor: "{colors.bar-foreground}", rounded: "{rounded.radius-sm}"}
  callout-destructive: {backgroundColor: "{colors.destructive-soft}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}"}
  callout-warning: {backgroundColor: "{colors.warning-soft}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}"}
  poster-card: {rounded: "{rounded.radius-md}", width: "152px"}
  callout-info: {backgroundColor: "{colors.muted}", textColor: "{colors.foreground}", rounded: "{rounded.radius-md}"}
  status-rule-pill: {backgroundColor: "{colors.muted}", textColor: "{colors.muted-foreground}", typography: "{typography.data-small}", rounded: "{rounded.radius-sm}", padding: "0px 8px", height: "26px"}
  status-rule-pill-no-rule: {backgroundColor: "{colors.warning-soft}", textColor: "{colors.warning}"}
  field-number-input: {backgroundColor: "{colors.card}", textColor: "{colors.foreground}", typography: "{typography.data}", rounded: "{rounded.radius-md}", padding: "0px 12px", height: "40px", width: "72px"}
  collapsible-content: {padding: "0px 12px 16px 36px"}
---

# Design System: media-manager-2

## Overview

Paper white and black with lime. Black carries the content, the actions and every "on" state. Lime appears in two places only: the best release and live downloads. Red means something went wrong, amber means something is missing or waiting. Tables stay dense: 40px rows inside a 40px page margin, 8 posters per row on Library.

Light mode only for now. The dark design is archived in `design/archive/mediaManager2-2026-10-11.pen`. Desktop first; the phone is secondary and several phone rows are deferred.

The source of truth is the pen.dev library `design/design-system.lib.pen`: its variables, its five component sheets and a sixth sheet for motion. The nine screen files import it. `design/mediaManager2.pen` no longer exists; see [`design/README.md`](design/README.md) for which file holds which screen.

These are static pen.dev components. Keyboard behaviour, focus handling, screen reader support, live updates and table sorting are implementation work; a static frame proves none of them.

Token names follow shadcn/ui, so code and design use the same words.

## Colors

Neutrals do most of the work. One meaning per colour.

- **Page and surfaces:** `background` is the page; `card` is tables, panels and menus (both white). `muted` is sunken things: tracks, Kbd keys, the neutral badge, the search field at rest. `surface-hover` and `surface-pressed` are hover and pressed. `selected` is the grey tint on a selected row, always with the 3px black side bar.
- **Text:** `foreground` (18.9:1 on white) for text and icons. `muted-foreground` (7.5:1) for secondary text. `subtle-foreground` (5.6:1) for meta, placeholders and column headers. `faint-foreground` (2.5:1) is for disabled things only, never readable text.
- **Lines:** `border` draws dividers and panel edges. `input` (3.4:1) draws control edges: checkboxes, radios, focused fields. Outline and menu buttons take a 1.5px `foreground` edge instead (1.5px `border` when disabled, 1.5px `destructive` on outline-destructive).
- **Black:** `primary` is buttons and "on" states (checked, monitored, selected segment label, active tab underline). `bar` is the downloads bar, toasts, tooltips and the selection bar, with `bar-foreground` text. One in-page exception: the setup wizard's "How the pieces connect" strip fills with `bar` once every part is connected, meaning the whole chain is live.
- **Lime:** `best` marks the single best release; `best-soft` tints its row. `live` marks downloads in progress. Lime is 1.3:1 on white, so it is only ever a fill behind black text (14.4:1) or a fill on the black downloads bar or on a poster. Setup wizard exception: a connected part's pill in the "How the pieces connect" strip is black with a lime dot (connected and answering), and the finished strip's pills are lime with black text. Never lime text, lime icons or thin lime lines on white.
- **Plex orange:** `plex`, `plex-hover`, `plex-pressed` and `plex-foreground` are only for the "Log in with Plex" button.
- **Red:** `destructive`, `destructive-soft` and their hover and pressed steps are for problems and risk: stalled, failed, gave up, hit and run risk, tracker cooldown, a failed service.
- **Amber:** `warning` and `warning-soft` are for missing, below cutoff, import blocked, unsaved edits and changes waiting for Sonarr or Radarr.
- **Focus:** `ring` (black) on white; `focus-on-dark` (white) on the black bars.
- **Overlay:** `scrim` (black 30%) dims the page behind a phone sheet. `shadow` is the colour of the floating shadow.

Posters keep their own colour; the interface stays black and white around them.

`popover`, `secondary`, `accent` and the `*-foreground` slots exist so shadcn components resolve. `radius` (10) and `radius-xl` (14) are shadcn base slots; components use the `radius-*` scale below.

### Names in the current code

`src/client/globals.css` now uses the names above, with Schibsted Grotesk and Barlow Semi Condensed bundled in `src/client/assets/fonts/`.

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
- **Episode details:** opens under the row as a full-width `muted` band with the 3px selection bar continuing from the open row, content starting at the Title column (`detail-indent`, 133px). Three sections 24px apart: Details, Versions, History, each a group heading over a white panel.
- **Title header:** 220px backdrop band fading to white behind a 176 by 264 poster, title 36/800, facts column on the right. When the page scrolls it collapses to a 72px strip with a 32 by 48 poster thumb, breadcrumb, 20/700 title and the same three actions.
- **Phone:** 16px margin (`page-margin-phone`), 52px top bar with a full-width 44px search under it, bottom sheets for grabs and choices, 44px touch targets.
- **Spacing:** the `space-*` scale, 4 to 64px.

## Elevation & Depth

Flat by default. Things in the page flow (tables, rows, the inline panel, callouts, cards, the add block, the episode details band) get a 1px `border` edge and no shadow.

Only things that float get a shadow: dropdown menus, tooltips, toasts, dialogs, the phone sheet and the selection bar. One shadow for all of them: `0 2px 6px #1111110F, 0 8px 24px #1111111F` (the phone sheet casts it upward).

## Shapes

Corners run from 4 to 10px. `radius-xs` (4) for badges, Kbd, checkboxes, menu items and skeletons; `radius-sm` (6) for row buttons, form fields and tooltips; `radius-md` (8) for default buttons, posters, cards and callouts; `radius-lg` (10) for large buttons, the search field, tables, panels, dialogs, menus, toasts and sheets; `radius-full` for dots and progress bars. The only side bar is the 3px row marker; callouts have none.

## Components

Every component lives in `design/design-system.lib.pen` as `v2/Family/Variant` and shows its states as instances beside it. Each sheet note names the shadcn/ui component it maps to, or says "Custom". Screens use instances and override named children (`Label`, `Count`, `Value`, `Icon`, `Kbd`).

### Control sizes

Three sizes, set with the `control-*` tokens. Buttons, inputs, selects and toggle groups match.

- **Row** 28px (`control-h-row`, padding 10, text 13, radius 6, icon 14): only inside table rows and dense lists.
- **Default** 40px (`control-h-default`, padding 16, text 14, radius 8, icon 16): everywhere else.
- **Large** 48px (`control-h-large`, padding 20, text 15, radius 10, icon 18): the one main action on a page or panel, such as the title header actions, the grab confirmation (Replace or Second version) and Settings Connect.

Icon-only buttons are squares at the same heights. pen.dev cannot bind height or icon size to a variable, so those are typed numbers; change them together with the tokens.

### Buttons, badges and inputs

- **v2/Button:** primary (black, shadcn `default`), outline (white, 1.5px `foreground` edge), ghost, destructive (red), outline-destructive, menu (outline with a chevron), plex. Disabled is a grey fill, never opacity. Loading swaps the icon for a spinner and keeps the width.
- **v2/Badge**, 20px: neutral (`muted`), strong (black, "In library"), lime (`best`, black text: best release, "Downloading 64%"), risk, warning, outline ("Searching" with a spinner). Release tables add `v2/Mark/comparison` (best is the only lime pill), `v2/Cell/profile-fit` (fit in words) and `v2/Mark/pending-change` (old value, arrow, new value on amber while a change waits).
- **v2/Input/Search:** `muted` fill and no edge at rest, white with an `input` edge plus the ring when focused. In a form (`v2/Field/labelled`) it becomes 40px, radius 6, white with an edge. Phone: 44px, full width.
- **Select trigger:** 40px, radius 8, an optional grey lead label before the value, chevron; the open list is a dropdown menu.
- **Toggle group:** up to six segments, 34px each inside a 40px `muted` track with 3px padding; white selected segment with a 1px edge and black 600 label, no shadow. **Tabs:** active label black 600 with a 2px underline. **Checkbox and radio:** 16px, `input` edge, black when on. **Switch** is for settings only; monitored is always `v2/Toggle/Bookmark`.
- **Option rows:** `v2/Option row` (`option-row.tsx`) is a radio or checkbox with a title and a line of explanation, radius 6, no edge; the choice shows in the control, never as a tint. `v2/Option row/bordered` (the `bordered` prop) is the same row as a card with its own edge, for a short set of standalone choices in a grid: site software, backup destination, Plex token, the setup wizard's optional parts. Radius 8, padding 14 16, 1px `border` edge; on, the edge turns 2px `foreground`, the second pixel an inset shadow so nothing moves. `v2/Card/choice` is the larger radio card for decisions in a panel or dialog.

### Rule forms and tracker status

- **v2/Field/number** (`field-number.tsx`): a 72 by 40px number box with plain words before and after it, read as one sentence ("Not a hit and run below 10 % downloaded"). The value is in `font-data`; an empty box shows a hint in `subtle-foreground`. Either word can be left out. Seed-time size bands and the More section of a tracker's rule are built from it.
- **v2/Field/labelled optional** (`field-labelled-optional.tsx`): `v2/Field/labelled` for a field that may be left blank. The word Optional sits after the label in 12px `subtle-foreground`; help, error and the trailing action work as in `v2/Field/labelled`.
- **v2/Collapsible trigger/open**: the open state of `v2/Collapsible trigger` (`collapsible-trigger.tsx`); the chevron turns 90° to point down and the summary stays. No separate code component.
- **v2/Collapsible/content** (`collapsible-content.tsx`): holds what the trigger reveals, directly under it. 16px between children; padding 0 12 16 36 lines the content up with the trigger's title. Opens by height at `duration-size`, closes at `duration-fast`; instant under reduced motion.
- **v2/Callout/info** (`callout-info.tsx`): a fact to know, not a problem: `muted` fill, `muted-foreground` icon (info by default; the screen may swap the icon, such as a file icon for "comes from the env file"), radius 8, no side bar, optional outline button. Use `v2/Callout` for risk and warning.
- **v2/Status/rule pill** (`status-rule-pill.tsx`): a tracker's hit and run rule state, in the tracker row and the tracker editor. Same 26px shape as the service pill with no logo and no icon: Configured and Configured (env file) have a black dot on `muted`; No rule has an amber dot and amber text on `warning-soft`, because that tracker's torrents keep seeding. The same amber look marks an account that answers but can't share its stats ("No account stats").

### Tables and rows

`v2/Table` is white with a 1px edge and radius 10. Every named row (release, episode, season, download, health problem and the rest) is an instance of `v2/Table/Row`, so states work the same everywhere: hover `surface-hover`, pressed `surface-pressed`, selected `selected` tint plus a 3px black bar on the left edge, risk a red bar, warning an amber bar, best a `best-soft` tint, focus a 2px inner black edge. A grabbed release swaps Grab for a lime badge with the percent and a 3px black progress line along the row's bottom.

### Library, search and calendar

- **Poster card:** 152 by 228, radius 8, 1px inner edge. Hover darkens the poster 8%, pressed 16%; selected adds a 2px black edge and a 700 title. Downloading shows a 4px lime strip on the poster's bottom edge; just imported shows it full width plus a black chip with a lime check.
- **Search result:** 84px row with a 40 by 60 poster, title and year, one meta line, one overview line, and either "In library" with the file count (fixed 80px column) or a 40px outline Add button.
- **Calendar:** entries are `muted` tiles, radius 6, no edge, with a 3px marker (amber missing, red gave up) and a black progress bar while downloading. Today's date sits in a black circle. Month cells are 188 by 132 with up to three entries and "+2 more". Week view has a 2px black now line with an 8px dot. The calendar is view-only; entries open the title.

### Chrome and floating things

- **App bar:** 64px, white, line under, 40px side padding. Nav items are 40px, radius 8, with a count pill (red on `destructive-soft` for problems); the active item gets the `selected` fill and a black 600 label. Service status lives behind Health, whose count turns red when a service fails.
- **Downloads bar:** black with white text; lime is allowed there for the arrow and progress fills because it sits on black. Idle reads "Nothing downloading". A stalled item shows a red dot and words.
- **Floating:** menus (248px, 32px items), tooltips (`bar`, after 400ms), toasts (`bar`, 400px, bottom left above the downloads bar, Undo with the Z key), dialogs and the selection bar (`bar`, 56px, 16px above the downloads bar) take the shadow. Inside menus and lists the highlight is the focus cue, with no ring.
- **Sign-in:** a dark `#07080b` ground with the planet drawn behind and no app bar, a 400px block fixed 120px from the left and bottom edges on desktop (24px sides and 83px from the bottom on a phone) holding the product name and the Plex-orange `#E5A00D` "Log in with Plex" button with Plex's black chevron, and one line under the button only after a failed attempt, an expired session, or when sign-in is not configured.

### Where a decision opens

The kind of decision sets the scale of the place it opens in. Three tiers:

1. **In the table**, for choices that open from a row and need the rows in view: a tinted `muted` band under the row, 13px text, choices as a 28px toggle group or 32px option rows, and a 28px button on the row's actions line named for the outcome. No 40 or 48px control and no card surface inside a table. Grab choice, remove from downloads, inline status, history details.
2. **Page panel** (`v2/Panel/inline`), for work under a page header or hero or with its own rows: 1px edge, no shadow, 40px controls, one 48px main action. Pick a release, import by hand, change monitoring.
3. **Dialog** (`v2/Dialog` over `v2/Scrim`, 560px), for destructive or lossy confirmations: delete a file, version or title; replace the current file; discard unsaved edits; remove from downloads; grab on a title you already own.

### Errors, empty and loading

- A row error is an inline status line (`v2/Status/inline`: icon plus words for sent, failed or busy) in a `muted` band under the row.
- A table error is a one-line `v2/Callout` above the table. Callouts come in risk, warning and info looks, radius 8, no side bar.
- Empty: a centred 360px block, one plain sentence and at most one next step.
- Loading: skeleton rows shaped like the row family they replace (40px row, 56px two-line row, poster card, search result, calendar entry).
- Unsaved edits: an amber pencil and "Unsaved edits" in the footer beside a Discard edits outline button; the main action stays the 48px button.

### Focus

Every focused control gets a 2px `ring` outline with a 2px white gap (Tailwind `outline-2 outline-offset-2`). The black ring is 18.9:1 against the white gap, so it reads beside black, red and lime fills alike. On black bars it is `focus-on-dark`; rows use the 2px inner edge. Spinners and skeleton shimmer stay still under reduced motion (see Motion).

## Motion

The library's sixth sheet holds the motion tokens and a transition table; each screen file holds `v2 / Motion / …` storyboards drawn as Before, Mid and After frames.

- **Durations:** `duration-fast` 120ms (hover, press, checks), `duration-base` 160ms (panels, menus, tabs, crossfades), `duration-slow` 220ms (toast, phone sheet, progress), `duration-spin` 700ms, `duration-shimmer` 1400ms, `duration-toast` 6000ms, `delay-tooltip` 400ms.
- **Easing:** `ease-out` `cubic-bezier(0.2, 0, 0, 1)` for anything entering, crossfades and progress; `ease-in` `cubic-bezier(0.4, 0, 1, 1)` for anything leaving; `ease-linear` for loops. `ease-in-out` `cubic-bezier(0.4, 0, 0.2, 1)` exists but no transition uses it yet.
- **Reduced motion** (`prefers-reduced-motion: reduce`): loops stop, every slide or scale becomes an opacity fade of `duration-fast`, every size change is instant.

| Trigger | What changes | Duration | Easing |
|---|---|---|---|
| Page change | new page fades in | fast | out |
| Open a title from a poster card | the card's poster morphs into the title page's large poster while the page crossfades (view transition); the loading page shows that poster in place | slow | out |
| Title page loads | skeleton crossfades into the page; the poster stays put | base | out |
| Hover (rows, buttons, nav, posters, calendar entries, cards) | fill to the hover token; poster brightness to 92% | fast | out |
| Press, focus ring | instant | 0 | — |
| Inline panel open / close | height 0 to full, fade in, rise 6px, sibling rows dim / reverse | base / fast | out / in |
| Season expand, history row expand | chevron turns 90°, rows grow from 0 | base | out |
| Row selection | side bar and selected fill appear | fast | out |
| Selection bar in / out | slide up 16px and fade in / fade out | base / fast | out / in |
| Toast | slide up 12px and fade in, stays `duration-toast` (paused on hover), fades out | slow / fast | out / in |
| Phone sheet and scrim | sheet slides up, scrim fades in | slow | out / in |
| Dropdown menu, select list | fade and 4px slide from the trigger | fast | out / in |
| Tooltip | fades in after `delay-tooltip` | fast | out |
| Skeleton to content | content crossfades over the shimmer | base | out |
| Progress update | fill width moves; percent text swaps at once | slow | out |
| Download imports | badge crossfades Downloading to Imported; row leaves the list after `duration-toast` | base | out |
| Grab in a row | Grab, then spinner, then Grabbed badge crossfade; progress line grows from 0 | base | out |
| Undo window (blocklist, toast) | row height to 0 after the window; Undo restores it | base | in / out |
| Checkbox, radio, bookmark | glyph scales 0.85 to 1, check stroke draws | fast | out |
| Toggle group, tabs | segment or underline slides to the new item | base | out |
| Calendar step, view switch, search results, settings pane | content crossfade | base | out |
| Downloads bar expand | panel rises from the bar | base / fast | out / in |
| Sign-in state change | heading and body crossfade; button label swaps at once | base | out |
| Connect, Run all checks, Add and search | button goes to loading at once; result crossfades | base | out |
| Dialog | scrim and dialog fade in, dialog scales 0.98 to 1 / reverse | base / fast | out / in |

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
- **Don't** put shadows on anything in the page flow (the inline panel included), or corners outside 4 to 10px.
- **Don't** put a 40 or 48px control, or a card, inside a table row; open a page panel or a dialog instead.
- **Don't** use `faint-foreground` for readable text, or opacity for disabled.
- **Don't** draw a coloured side bar on callouts.
- **Don't** describe these static components as working keyboard controls or tested accessibility.
