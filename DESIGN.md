---
name: media-manager-2
description: Dense release comparisons and live download status on a dark ground.
colors:
  ground: "#0E0F12"
  row: "#15171C"
  row-alt: "#1B1E24"
  row-hover: "#22262E"
  seam: "#262A33"
  ink: "#EEF0F2"
  ink-2: "#9AA1AB"
  ink-3: "#69707B"
  best: "#A24BF0"
  risk: "#FF3B30"
  on-cell: "#0E0F12"
typography:
  button: {fontFamily: "Barlow", fontSize: "14px", fontWeight: 600}
  navigation: {fontFamily: "Barlow", fontSize: "13px", fontWeight: 500}
  body: {fontFamily: "Barlow Semi Condensed", fontSize: "13px", fontWeight: 400}
  key: {fontFamily: "Barlow Semi Condensed", fontSize: "11px", fontWeight: 400}
rounded:
  none: "0px"
spacing:
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
components:
  button-default: {backgroundColor: "{colors.ink}", textColor: "{colors.on-cell}", typography: "{typography.button}", rounded: "{rounded.none}", padding: "0px 12px", height: "32px"}
  button-outline: {textColor: "{colors.ink}", typography: "{typography.button}", rounded: "{rounded.none}", padding: "0px 12px", height: "32px"}
  button-ghost: {textColor: "{colors.ink}", typography: "{typography.button}", rounded: "{rounded.none}", padding: "0px 12px", height: "32px"}
  input-search: {backgroundColor: "{colors.ground}", textColor: "{colors.ink}", rounded: "{rounded.none}", padding: "0px 10px", height: "32px", width: "420px"}
  tab-trigger: {textColor: "{colors.ink-2}", rounded: "{rounded.none}", padding: "0px 12px", height: "34px"}
  keyboard-key: {textColor: "{colors.ink-2}", typography: "{typography.key}", rounded: "{rounded.none}", padding: "0px 5px"}
  table-row: {backgroundColor: "{colors.row}", textColor: "{colors.ink}", typography: "{typography.body}", rounded: "{rounded.none}", padding: "0px 20px", height: "34px"}
  downloads-live-bar: {backgroundColor: "{colors.row}", textColor: "{colors.ink}", typography: "{typography.body}", rounded: "{rounded.none}", padding: "0px 20px", height: "32px"}
---

# Design System: media-manager-2

## Overview

The approved reference is the Formula 1 live timing tower: dense release rows, stepped graphite backgrounds and precise comparisons. The owner searches, compares and chooses a release without routine status labels competing for attention.

This records the 26 static screens in `design/mediaManager2.pen`. Shared components were rebuilt from the existing design as shadcn/ui counterparts; they were not imported from a kit. Base UI controls and TanStack Table behavior are not implemented here. Static review does not prove runtime behavior or accessibility.

## Colors

`ground`, `row`, `row-alt` and `row-hover` separate surfaces and rows. `seam` divides them. `ink` carries primary content; `ink-2` and `ink-3` carry secondary content and hints. `on-cell` supplies dark text on a filled control.

Use `best` only for the single best release that passes the quality profile in each release table. Use `risk` for problems and risks, with explanatory text. Better or not better than the owned file is a text mark. The legacy `better` and `same` Pen variables are excluded from the active palette.

## Typography

Barlow carries interface labels and navigation. Barlow Semi Condensed carries release data, counts and key hints. Preserve aligned numeric columns. The frontmatter records the shared component defaults; existing compact row and phone instances override them where needed.

## Layout

The prototype has desktop frames (1440 × 900px) and one phone frame (390 × 844px). These are examples, not implemented responsive breakpoints. Desktop top bars are 48px high; the phone top bar is 40px. Shared table rows are 34px high, with existing 32–36px variations retained by screen. Live-download bars are 32px high on every screen.

Keep release lists inline with the title. Show row actions and their keys on the selected row only. Open one inline decision panel at a time and dim the surrounding content. The phone uses a bottom sheet for the release choice.

## Elevation & Depth

Use stepped backgrounds, divider lines and selection outlines. The design has no shadows. Keep the surrounding content dim while a decision is open.

## Shapes

Controls and cells have square corners. Search fields, outlined buttons and key hints use thin borders. Avoid decorative cards around rows, controls or decisions.

## Components

The shared library contains Button default, outline and ghost variants; Input/Search; Tabs triggers; NavigationMenu links; Kbd; Checkbox; RadioGroup; Switch; Select; Collapsible; Sheet; Badge; Progress; and Table, Row and Cell parts. Table styling follows TanStack Table's row and cell structure; table behavior remains implementation work.

Default buttons use light fill and dark text. Outline buttons use a thin border; ghost buttons keep the surrounding background. Preserve each existing action's size, icon, key and state. Tabs use light text and a bottom line for the active item. Navigation uses text weight and colour for the current page.

Calendar grids and entries, poster composition, the one-line live-download bar and inline decision content remain product-specific. Posters and descriptions must come from Sonarr or Radarr. The sidecar contains static style samples, not working app components.

## Do's and Don'ts

- Do keep normal monitored, downloaded, ready and not-aired states quiet.
- Do show actions and key hints on the selected row only.
- Do open one inline decision at a time and dim surrounding content.
- Do keep the one-line live-download bar on every screen.
- Do preserve the owner's chosen release and show tracker risks in words.
- Don't add green or yellow comparison fills.
- Don't hide release tables in a modal or make risk explanations hover-only.
- Don't add shadows, rounded controls or decorative cards.
- Don't describe static components as working keyboard controls or tested accessibility.
