---
name: media-manager-2
description: Dense release comparisons and live download status on white panels over a soft grey page.
# Light values below. Every color token also has a dark value on the pen.dev theme axis `mode` (dark | light).
colors:
  ground: "#F5F5F5"
  row: "#FFFFFF"
  row-alt: "#FAFAFA"
  row-hover: "#EDEFF2"
  seam: "#D1D5DB"
  ink: "#171B20"
  ink-2: "#58616C"
  ink-3: "#9AA1AB"
  selected: "#171B20"
  on-cell: "#FFFFFF"
  accent: "#215D47"
  accent-hover: "#194A38"
  accent-soft: "#D6E5DB"
  best: "#6D28D9"
  best-soft: "#EDE9FE"
  risk: "#B42318"
  risk-hover: "#912018"
  risk-soft: "#FBE3E1"
typography:
  page-title: {fontFamily: "Barlow", fontSize: "31px", fontWeight: 700}
  panel-title: {fontFamily: "Barlow", fontSize: "20px", fontWeight: 700}
  sheet-title: {fontFamily: "Barlow", fontSize: "17px", fontWeight: 700}
  row-title: {fontFamily: "Barlow", fontSize: "14px", fontWeight: 600}
  button: {fontFamily: "Barlow", fontSize: "14px", fontWeight: 600}
  navigation: {fontFamily: "Barlow", fontSize: "13px", fontWeight: 500}
  body: {fontFamily: "Barlow Semi Condensed", fontSize: "13px", fontWeight: 400}
  meta: {fontFamily: "Barlow", fontSize: "12px", fontWeight: 400}
  column-header: {fontFamily: "Barlow", fontSize: "11px", fontWeight: 600, letterSpacing: "0.6px"}
  key: {fontFamily: "Barlow Semi Condensed", fontSize: "11px", fontWeight: 400}
rounded:
  none: "0px"
  chip: "2px"
spacing:
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
components:
  button-default: {backgroundColor: "{colors.accent}", textColor: "{colors.on-cell}", typography: "{typography.button}", rounded: "{rounded.none}", padding: "0px 12px", height: "32px"}
  button-default-hover: {backgroundColor: "{colors.accent-hover}"}
  button-outline: {backgroundColor: "{colors.row}", textColor: "{colors.ink}", typography: "{typography.button}", rounded: "{rounded.none}", padding: "0px 12px", height: "32px"}
  button-ghost: {textColor: "{colors.ink}", typography: "{typography.button}", rounded: "{rounded.none}", padding: "0px 12px", height: "32px"}
  button-destructive: {backgroundColor: "{colors.risk}", textColor: "{colors.on-cell}", typography: "{typography.button}", rounded: "{rounded.none}", padding: "0px 12px", height: "32px"}
  button-destructive-hover: {backgroundColor: "{colors.risk-hover}"}
  input-search: {backgroundColor: "{colors.row}", textColor: "{colors.ink}", typography: "{typography.body}", rounded: "{rounded.none}", padding: "0px 10px", height: "32px", width: "420px"}
  tab-trigger: {textColor: "{colors.ink-2}", rounded: "{rounded.none}", padding: "0px 12px", height: "34px"}
  tab-trigger-active: {textColor: "{colors.ink}"}
  toggle-item-selected: {backgroundColor: "{colors.selected}", textColor: "{colors.on-cell}", rounded: "{rounded.none}", height: "32px"}
  keyboard-key: {textColor: "{colors.ink-2}", typography: "{typography.key}", rounded: "{rounded.none}", padding: "0px 5px"}
  badge-secondary: {backgroundColor: "{colors.row-hover}", textColor: "{colors.ink}", rounded: "{rounded.chip}", padding: "0px 6px", height: "20px"}
  badge-accent: {backgroundColor: "{colors.accent-soft}", textColor: "{colors.accent}", rounded: "{rounded.chip}", padding: "0px 6px", height: "20px"}
  badge-best: {backgroundColor: "{colors.best-soft}", textColor: "{colors.best}", rounded: "{rounded.chip}", padding: "0px 6px", height: "20px"}
  badge-destructive: {backgroundColor: "{colors.risk-soft}", textColor: "{colors.risk}", rounded: "{rounded.chip}", padding: "0px 6px", height: "20px"}
  table-header: {backgroundColor: "{colors.row}", textColor: "{colors.ink-2}", typography: "{typography.column-header}", padding: "0px 20px", height: "30px"}
  table-row: {backgroundColor: "{colors.row}", textColor: "{colors.ink}", typography: "{typography.body}", rounded: "{rounded.none}", padding: "0px 20px", height: "34px"}
  table-row-hover: {backgroundColor: "{colors.row-hover}"}
  table-row-selected: {backgroundColor: "{colors.accent-soft}"}
  table-row-best: {backgroundColor: "{colors.best-soft}", textColor: "{colors.best}"}
  callout-risk: {backgroundColor: "{colors.risk-soft}", textColor: "{colors.ink}", rounded: "{rounded.none}"}
  downloads-live-bar: {backgroundColor: "{colors.row}", textColor: "{colors.ink-2}", typography: "{typography.body}", rounded: "{rounded.none}", padding: "0px 20px", height: "32px"}
  phone-row: {backgroundColor: "{colors.row}", textColor: "{colors.ink}", height: "44px"}
---

# Design System: media-manager-2

## Overview

White panels sit on a soft grey page. Dark ink carries the content, one green marks the primary action and the current selection, purple marks the one best release, and red marks risk. Rows stay as dense as the dark design they replace; titles got bigger (31px) with more space above headings.

This records the static components in `design/mediaManager2.pen`. They are pen.dev components only. Keyboard behaviour, focus handling, screen reader support and table sorting are implementation work; a static frame proves none of them.

The dark theme still exists: every color token has a dark value on the theme axis `mode`, and the 26 dark frames stay in the file as the record of what changed. The light journey frames are named "Light / Desktop / …" and "Light / Phone / …".

## Colors

Neutrals do the work. `ground` is the page; `row` is panels, rows, cards and the top bar; `row-alt` is alternate rows and sidebars; `row-hover` is hover. `seam` draws every hairline, border and divider.

`ink` is primary text and icons. `ink-2` is secondary text and passes 4.5:1 on `ground`. `ink-3` is never text: only disabled states, placeholders, decorative strokes, and checkbox and radio edges (3:1 on white).

`accent` (green) is the primary button, focus rings, links and the active bookmark; `accent-soft` tints the selected row and "In library" or "Downloading 64%" chips. `selected` (near black) fills a chosen control that is not the primary action: the active toggle item or the switched-on state. `on-cell` is text on any filled color.

**One purple per table.** `best` and `best-soft` mark only the single best release that passes the quality profile.

**Red means something went wrong.** `risk`, `risk-soft` and `risk-hover` are for gave up, stalled, failed, hit and run risk, tracker cooldown and 0 seeders. "Missing" is a neutral chip. Seeding time under the hit and run rule stays neutral in rows and turns red only inside a delete or remove panel.

Poster placeholders use one of six muted hues (#3A2D55, #2F4A3C, #4A3A2A, #2C4650, #5A4A2E, #503A3A). These are the only raw hex values allowed on screens.

## Typography

Barlow carries labels, buttons, navigation and headings. Barlow Semi Condensed carries table data, counts, key hints and file names. Page titles are 31/700 everywhere, panel titles 20/700, phone sheet titles 17/700. Column headers are 11/600 uppercase `ink-2`. Right-align sizes, seeders and counts so digits line up.

## Layout

Desktop frames are 1440 × 900px; phone frames are 390 × 844px. These are examples, not tested breakpoints. Top bar 48px desktop, 44px phone. Heights: buttons, inputs, toggle items and prev/next links 32px; tab triggers 34px; one-line rows 34px; table headers 30px; second-version sub-rows 30px; season rows 40px (they hold a chevron and a bookmark); chips 20px; phone touch rows 44px.

Release tables sit inline under the title, never in a modal. One inline panel opens at a time. The live downloads bar is one line, 32px, on every screen. The phone uses a bottom sheet for picking a release and for episode actions.

## Elevation & Depth

No shadows. Depth comes from a `row` panel on the `ground` page and 1px `seam` hairlines. An open inline panel and the phone bottom sheet take a 1px `seam` outline on a `row` fill while everything around them dims.

## Shapes

Buttons, inputs, cells, tabs and rows have square corners. Chips, badges, skeleton blocks and posters have 2px corners. Callouts have no left bar: soft fill, icon, title, body. No decorative cards around rows or controls.

## Components

Every component is a reusable frame named `Family/Variant`, matching shadcn/ui names where one exists. Screens use instances; text children are named (`Label`, `Count`, `Value`, `Hint`) so screens override them by name.

- **Chrome:** AppBar/Desktop, NavigationMenu/List and /Link, Navigation/Phone, Breadcrumb, Link/prev-next, Header/page, /page-note, /page-action, /sub-page, Header/title (including "Not monitored"), Header/results, Downloads/Live bar and /phone, Bar/bottom-action, Toast/undo, Tooltip.
- **Controls:** Button/default, /outline, /ghost, /destructive, /outline-destructive, /outline-menu, /Keyboard shortcuts; Input/Search; Tabs/Trigger/default and /active; ToggleGroup, ToggleGroup/Item and /selected; DropdownMenu/Content and /Item; Select/Trigger; Combobox/Item; Checkbox; RadioGroup/Item; Collapsible/Trigger; Kbd and Kbd/icon; Toggle/Bookmark/monitored, /not-monitored, /mixed.
- **Badges and status:** Badge/outline, /secondary, /accent, /ghost, /best, /quality-filled, /searching, /destructive, /destructive-filled; Mark/comparison/best, /better, /same-or-worse, /yours; Mark/pending-change; Cell/profile-fit/meets, /rejected, /warning; Spinner; Skeleton; Progress; Label/section; Label/group, /group-date, /group-risk.
- **Tables and rows:** Table, Table/Header, Table/Row, Table/Cell; Row/release, Row/second-version, Row/episode, Row/episode-details, Row/season, Row/history; Bar/selection; Line/totals.
- **Lists and cards:** Row/search-result, Item/episode-list, Library/Poster, Calendar/Header, Calendar/DayHeader (and -today, -tomorrow), Calendar/MonthCell (and -today, -out), Calendar/Entry, Calendar/NowLine, Fact, Fact/row.
- **Panels and selection:** Panel/inline, Scrim, Card/choice, Row/option-radio, Row/option-checkbox, Field/labelled, Block/add-controls and /movie, Empty/state, Callout/risk, Callout/info.
- **Status composites:** Row/download (and -stalled, -import-blocked, -waiting, -selected), Row/health-problem (and -selected, -error, -warning), Row/health-summary, /health-stat, /health-disk, /health-disk-risk, Row/flagged and -selected, Row/blocklist (and -risk, -selected), Row/import-file (and -problem, -group), Strip/still-missing.
- **Phone:** Sheet/Content/phone, Row/release-phone, Row/episode-phone, Navigation/Phone, Downloads/Live bar/phone.

Retired: Badge/Status (use a Badge variant). Legacy: Switch/Monitored stays only on old screens (use Toggle/Bookmark). ToggleGroup/Torrent choice is built from the same items as ToggleGroup.

## States

One rule for every row family and control:

- **Hover:** `row-hover` fill on rows; `accent-hover` or `risk-hover` on filled buttons. Never opacity.
- **Selected:** `accent-soft` fill on rows, no bar. Chosen controls take `selected` fill with `on-cell` text.
- **Best:** `best-soft` fill plus a 2px `best` left bar. This is the only row bar.
- **Focus:** 2px `accent` stroke on the control itself, outside the edge; on rows, inside the edge. No wrapper frame, no gap.
- **Dimmed:** opacity 0.65 on rows outside an open panel. Never 0.5.
- **Disabled:** `ink-3` text and opacity 0.6. Opacity means disabled and nothing else.
- **Loading and error:** Spinner replaces the button icon while the label stays; Badge/searching on episode rows; Skeleton blocks at text size. Inputs in error take a `risk` border and a 12px `risk` message below.

## Do's and Don'ts

- Do keep normal states quiet: monitored, meets profile, not aired, downloaded.
- Do show row actions and key hints on the selected or hovered row only.
- Do open one inline panel at a time and dim the rest; destructive actions take two steps.
- Do write status as words plus a tinted chip, and every chip as a Badge instance.
- Do use the words in CONTEXT.md: Release, Grab, Replace, Second version, Manual download, Pick a release, Search automatically.
- Don't use green for decoration or for comparisons; "better" and "not better" are text marks.
- Don't use purple on more than one row per table, or red for anything that has not gone wrong.
- Don't use `ink-3` for readable text.
- Don't add shadows, rounded controls or cards around rows.
- Don't describe these static components as working keyboard controls or tested accessibility.
