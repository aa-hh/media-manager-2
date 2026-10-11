DEGRADED: single-context (the target is a pen.dev file, so the impeccable detector, which scans markup files, has nothing to scan; the review ran in one context from measured node values and exports).

# Light-mode component library: critique and proposed spec

Scope: light mode only. Sheets reviewed: GrJE4, r4V8Mg, E9gJVQ, r2H65, Vpngu, c7oDN, plus the three shared sheets that hold the base controls (bi8Au "shadcn/ui · Shared controls", p9EDhk "TanStack Table and custom media views", NPTcm "Selection and disclosure"). 139 reusable components measured with resolved variables. Contrast ratios are WCAG 2 relative-luminance ratios computed from the resolved hex values.

Every proposal maps to a shadcn/ui variant or a Tailwind token. Product terms follow CONTEXT.md (release, grab, replace, second version, monitored, hit and run, seeding, stalled, manual download).

---

## 1. System-level findings

### 1.1 Every surface is a box with a grey line, and nothing floats

- Corner radius: 21 nodes use 2px (badges, Kbd, skeleton, title poster), 2 use full circles (radio). Every button, input, select, menu, tooltip, panel, card, sheet, toast and table is square.
- Shadows: zero `effect` values across all nine sheets. The dropdown menu (v5pvMG), tooltip (Y1CrMb), inline panel (l9W80), phone sheet (mPtT9) and toast (KMW20) sit at the same visual depth as table rows.
- Surface step: canvas `ground` #F5F5F5 against `row` #FFFFFF is 1.09:1, so the two surfaces barely separate and every boundary falls to the `seam` #D1D5DB border (1.47:1 on white). The result is a page of thin grey rectangles: the "back office" look the owner named.
- Grey bands: Table/Header (etMl2) and Label/group (xYqcn, jokEP, ExGw5) fill with #F5F5F5 plus a bottom border. These read as old spreadsheet header bars.

### 1.2 The green accent carries nine meanings

`accent` #215D47 / `accent-soft` #D6E5DB is used for: primary button (i1ciSB), selected table row, range-selected row (identical to selected, cr5Ga), selected card (cDZAn), info callout (u3Hab), "In library" and "Downloading" badges (SpLXr), progress fill (TziP6), today in the calendar (ZPLZy, dGZ9Y, Xffyp), the selection bar (a5qoHr) and the focus ring.

Consequences seen on the sheets:
- On a selected search result (j71aJ, third row) the "In library" badge disappears into the selected row fill: both are #D6E5DB.
- Bar/selection (a5qoHr) has the same fill as the rows it acts on, so the bar does not read as a separate control strip.
- An info callout looks like a selected row.

### 1.3 Three different colours mean "on"

| Control | "On" treatment |
|---|---|
| Button/default, RadioGroup selected | green #215D47 |
| ToggleGroup/Item/selected (b6nJ8Y), Checkbox checked and mixed, Switch ON, Badge/quality-filled, Tabs active underline, Panel/inline border | near-black #171B20 (token `selected`) |
| Combobox selected, Card/choice selected, table row selected | green tint #D6E5DB |

A checkbox and a radio in the same panel (Vpngu QfwMo and bM1w8) show black and green side by side.

### 1.4 Focus ring is invisible on filled controls (contrast failure)

Focus is drawn by swapping the 1px border for a 2px `accent` border with no gap (R88up, F9Leqm, c03Xzt, kXfOh):
- On Button/default (green fill): 1.00:1. Invisible.
- On Button/destructive (#B42318): 1.17:1.
- On ToggleGroup selected (#171B20): 2.24:1.

WCAG 2.2 asks for 3:1 between the focus indicator and what is next to it. All three fail. The ring also changes the control's outline width, so the label shifts by 1px on focus.

### 1.5 Text and control boundaries below contrast minimums

| Pair | Ratio | Where | Needs |
|---|---|---|---|
| `ink-3` #9AA1AB on white | 2.61 | Panel/inline body placeholder (l9W80), Status/service "Connected" (jjOc0), disabled labels | 4.5 for text |
| `ink-3` #9AA1AB on white | 2.61 | Checkbox (x96xJ) and RadioGroup (jW1po) unchecked border | 3.0 for a control boundary |
| `seam` #D1D5DB on white | 1.47 | Select/Trigger (dOT87), Field/labelled inputs, Input/Search border | 3.0 where the border is the only thing that marks the field |
| `seam` on `ground` | 1.35 | Bordered rows on the canvas | decorative, fine |

Passing pairs worth keeping: `ink-2` #58616C on white 6.28, on accent-soft 4.82; `risk` on `risk-soft` 5.38; `best` on `best-soft` 5.98; white on `accent` 7.72.

Disabled states are drawn with opacity (Button/default disabled is a washed green, Button/destructive disabled a washed red, R88up and c03Xzt). Opacity also lowers the icon and Kbd, and produces a colour that is not a token.

### 1.6 Type scale: ten sizes and two families doing overlapping jobs

Sizes in use: 10, 11, 12, 13, 14, 17, 18, 20, 24, 31 (count of text nodes: 12px 301, 13px 72, 11px 44...). 10px appears in Badge/destructive-filled "RISK" (cNNek) and Calendar/NowLine (Xffyp). 31px (Header/title T7bQXg) sits next to 24 and 20 with no clear step. Weights 400, 500, 600 and 700 all appear at 13px.

Barlow (labels) and Barlow Semi Condensed (data) split is sound for dense release tables. It is applied inconsistently: Row/health-problem (Tez3i) and Row/download (TCymk) set titles in Semi Condensed 13/600, while Row/episode (g9FSk) and Row/flagged (Dha8q) set titles in Barlow 13 or 14/600.

### 1.7 Row padding differs by family, so columns won't line up between pages

- 12px sides: Table/Row (S10L1), Row/release (Un25k), Row/episode (g9FSk), Row/season (CcH6h), Row/search-result (gB8HJ), Toast/undo.
- 20px sides: Row/download, Row/health-*, Row/flagged, Row/blocklist, Row/import-file, Label/group, Downloads/Live bar, Bar/bottom-action.
- 16px sides: phone rows (l0aXI, vn2J9).

Row heights: 28, 30, 34, 36, 40, 44, 52, 56, 58, 64. Most are justified by content (two-line rows at 52 and 56), but 30 (Row/second-version) and 36 (Bar/selection) sit 2 to 4px off the 34 base for no visible reason.

### 1.8 Missing states

| Component | Shown | Missing |
|---|---|---|
| Button (all variants) | default, hover, focus, disabled, loading (default only) | pressed for all; loading for outline and destructive |
| Input/Search | hover, focus, disabled, error | filled with clear button |
| Select/Trigger | focus, disabled, with lead label | hover, open, error |
| Tabs/Trigger | default, active, hover, with count | focus, disabled |
| ToggleGroup/Item | default, selected, focus, disabled | hover on unselected items |
| Checkbox | unchecked, checked, mixed, focus | hover, disabled, error |
| RadioGroup/Item | unselected, selected, focus | hover, disabled |
| DropdownMenu/Item | default, hover, focus, disabled, destructive | keyboard shortcut slot, checked item, submenu |
| Library/Poster | default, selected, focus, status variants | hover |
| Calendar/Entry | five data states | hover, focus, selected |
| Toast/undo | one state | entering, leaving, error toast |
| Tooltip | one state | with Kbd shortcut |

### 1.8a Token gaps

- No radius, spacing, control-height, shadow or motion tokens. Every value is typed by hand.
- No focus-ring token. Focus borrows `accent`.
- No scrim token. Scrim (e2mnD) uses raw #F5F5F599; the sheet says so itself.
- No disabled tokens; disabled is opacity.
- No strong border for form fields; `seam` serves dividers and inputs alike.
- `selected` (#171B20) is the same value as `ink` and is used as the Panel/inline border and active tab line, so the name does not describe the use.
- 24 un-themed variables from direction explorations (`rk-*`, `tx-*`) sit next to the real tokens. Clear them once a direction is picked.

### 1.9 Code is already drifting from the file

`src/client/components/ui/button.tsx` has variants `outline` and `quiet` (not shadcn's `default/outline/ghost/destructive`), `rounded-lg`, `min-h-11` and the Inter font, using sign-in tokens (`--control`, `--border`, `--focus`). `src/client/globals.css` holds dark `--mm-*` tokens for the signed-in app and no light set. Whatever spec is chosen below should land as one shadcn token layer (`--background`, `--foreground`, `--primary`, `--ring`, `--radius` and so on) that both the sign-in page and the app read.

---

## 2. Per component family

Heights, radii and colours below use the token names from section 3.

### 2.1 Buttons (i1ciSB default, OtgnD outline, QUIMh ghost, udeAb destructive, lMDe5 outline-destructive, rEkPf outline-menu, o7hf9z keyboard shortcuts)

Wrong now:
- Square corners, 32px only; in-row Grab is a hand-sized 28px copy and phone sheet actions are 48px with no shared size scale.
- Focus invisible on filled variants (1.4).
- Disabled by opacity (1.5).
- No pressed state.
- Outline hover fills #EDEFF2, ghost hover fills the same grey: outline and ghost become identical on hover.
- Kbd inside the green button is a white-bordered box on green, which adds a second outline inside the button.

Proposed (shadcn `Button`, `variant` × `size`):

| Size | Height | Side padding | Text | Icon | Use |
|---|---|---|---|---|---|
| `xs` | 24 | 8 | 12/600 | 14 | in-row secondary actions |
| `sm` | 28 | 10 | 13/600 | 16 | in-row Grab, selection bar, panel footers in rows |
| `default` | 32 | 12 | 14/600 | 16 | desktop default |
| `lg` | 44 | 16 | 15/600 | 18 | phone sheets and phone bars |
| `icon-sm` / `icon` | 28 / 32 square | 0 | | 16 | row icon actions, app bar |

All sizes: radius `--radius-md` 6px (phone `lg` 10px), gap 6 (`xs`, `sm`) or 8, Barlow, label never wraps.

| Variant | Rest | Hover | Pressed | Disabled |
|---|---|---|---|---|
| `default` (primary) | fill `primary` #1D6B4F, text white, `shadow-xs` | `primary-hover` #16573F | #124532, translateY(0.5px) | fill `surface-sunken`, text `ink-disabled`, no shadow |
| `outline` | fill white, 1px `border-control-soft` #D5DAE0, `shadow-xs`, text `ink` | fill `surface-hover` #F4F5F7, border #C5CBD3 | fill #ECEEF1 | fill white, border `border`, text `ink-disabled` |
| `ghost` | transparent, text `ink-2` | fill `surface-hover`, text `ink` | fill #ECEEF1 | text `ink-disabled` |
| `destructive` | fill `risk` #B42318, white | #912018 | #7A1B14 | as `default` disabled |
| `destructive-outline` (new variant; shadcn has none) | white, 1px `risk-border` #F1B9B3, text `risk` | fill `risk-soft` | fill #FAD7D3 | as `outline` disabled |

- Focus, every variant: `outline: 2px solid var(--ring); outline-offset: 2px`. The 2px gap of page colour makes the ring measure against the canvas (6.43:1 on white, 5.99:1 on canvas), never against the fill.
- Loading: spinner replaces the leading icon, label stays, `aria-busy`, width held so nothing shifts. Available on every variant.
- Kbd inside a filled button: Kbd `on-fill` style (2.12).
- Transition: background and shadow 120ms ease-out. Pressed nudge only; no scale on dense rows.
- Outline-menu (rEkPf) is `outline` with a trailing 16px chevron, and an "open" state of fill #ECEEF1 plus chevron rotated 180° over 150ms.
- Button/Keyboard shortcuts (o7hf9z) becomes `ghost` `sm` with Kbd "?".

### 2.2 Input, search, select, combobox (YxJcD, dOT87, VdPz8, TztX6)

Wrong now: square; border 1.47:1; focus swaps the border to 2px green (text shifts); placeholder in Panel/inline at 2.61:1; Select has no open or error state; value text in Input/Search is Semi Condensed 13 while Select is Barlow 13.

Proposed (shadcn `Input`, `Select`, `Combobox` on Base UI):
- Height 32 desktop, 44 phone. Radius 6. Side padding 10, gap 8, leading icon 16 in `ink-3`.
- Fill white. Border 1px `border-control` #8C94A0 (3.06:1) on standalone form fields (Select in panels, Field/labelled). The app bar search, which also has an icon, placeholder and the "/" Kbd, may use `border-control-soft` #D5DAE0 plus `shadow-xs`.
- Text Barlow 13/400 `ink`; placeholder `ink-3` #636B77 (5.38:1).
- Hover: border #6F7783.
- Focus: border `primary` plus `ring` outline 2px at offset 0 drawn outside the border (box-shadow `0 0 0 3px var(--ring-soft)` is fine as an extra halo but not as the only cue).
- Error: border `risk`, message 12/400 `risk` below with 6px gap, `aria-invalid`.
- Disabled: fill `surface-sunken`, border `border`, text `ink-disabled`.
- Filled search: 16px clear button (`ghost` `icon-xs`) appears before the Kbd.
- Select open: trigger keeps focus ring, chevron rotates, list uses the DropdownMenu content spec (2.7).
- Lead label ("Sort", "Monitoring"): `ink-3` 13/400, value `ink` 13/600, 6px apart.
- Combobox/Item: height 32, radius 4, padding 8; highlighted fill `surface-hover`; selected shows a 16px check in `primary` at the right, text 600. Do not tint selected items green.
- Field/labelled: label 12/500 `ink-2`, 6px above control; help text 12/400 `ink-3`.

### 2.3 Tabs and toggle groups (R2o8w8, UCCkl, hVJOE, b6nJ8Y, DmuxX, do7k3, Header/results filter, Calendar/Header view switcher)

Wrong now: selected segment is a solid black block (#171B20), which is the loudest object on most screens; unselected items carry their own border so groups look like a row of separate boxes; no hover on items; tab hover fills a grey block behind the label.

Proposed:
- `Tabs` (shadcn `variant="line"`): height 36, side padding 12, text 13/500 `ink-2`; hover `ink`; active `ink` 600 with a 2px `ink` underline, radius 1, inset to the label width. Count after the label in 12/500 `ink-3` (active: `ink-2`). Focus ring offset -2 inside the trigger, radius 6. No hover fill.
- `ToggleGroup` as a segmented control: track fill `surface-sunken` #EEF0F3, radius 8, padding 2, no border. Items height 28 (track 32), radius 6, side padding 10, text 13/500 `ink-2`. Hover `ink`. Selected: fill white, `shadow-xs`, text `ink` 600. Focus ring per item. Disabled `ink-disabled`. Selected segment moves with a 150ms ease-out slide where the item widths allow it.
- ToggleGroup/Torrent choice ("Keep seeding" / "Remove"): same segmented control. When "Remove" is selected and the tracker's hit and run rule is not yet met, the selected segment uses `risk-soft` fill and `risk` text so the risk shows on the choice itself, with the risk explained in words beside it (the rule from DESIGN.md that risk is never hover-only stays).
- Block/add-controls monitor choice (seven Sonarr options): keep the segmented control for the first five and the "More" menu for the rest.

### 2.4 Navigation and app bar (iLLyg, l8jX7U, NSoxp, MUNOv, Gzaoj, ewNJY, VLuBM, w1nZeY)

Wrong now: active nav item is only a weight change (500 to 600) and colour step, hard to spot; counts ("Downloads 3", "Flagged 5") are plain text; risk count is a red-bordered box that looks like a form error; app bar and live bar are both white strips with a grey line.

Proposed:
- AppBar/Desktop: height 52, fill `surface` white, bottom 1px `border`, side padding 20, gap 24. Product name 15/700 `ink`, letter-spacing -0.01em (no logo exists; do not add one).
- NavigationMenu/Link: height 32, radius 6, side padding 10, text 13/500 `ink-2`. Hover fill `surface-hover`, text `ink`. Active fill `surface-selected` #E9ECEF, text `ink` 600, `aria-current="page"`. Focus ring.
- Counts: 11/600 tabular numbers in a 18px pill (radius full, side padding 6, fill `surface-sunken`, text `ink-2`). Risk count: same pill in `risk-soft` with `risk` text, for example "2 risks", lowercase like the rest of the copy.
- Breadcrumb: 13/500 `ink-2` links, current page `ink` 600, separator a 12px chevron in `ink-3` (replaces "/"). Link hover `ink` with underline at 2px offset; focus ring radius 4.
- Link/prev-next: `ghost` `sm` buttons with Kbd "[" and "]".
- Downloads/Live bar: height 32, fill `surface`, top 1px `border`. Lead with a 6px `primary` dot that pulses (opacity 1 to 0.4, 2s) while any torrent is downloading, static when idle, red and static when something is stalled. Respect `prefers-reduced-motion`.
- Navigation/Phone: height 48, title 17/700 stays.

### 2.5 Badges and status marks (gndqp, vzeZg, SpLXr, RYbrj, H89jA, nDkSQ, FDjwP, SNLmV, cNNek, iivYD..., UK3GT...)

Wrong now:
- Ten badge styles (outline, secondary, accent, ghost, best, quality-filled, searching, destructive, destructive-filled, status). A search result row carries four bordered outline badges plus a ghost badge (j71aJ), so the row reads as a row of buttons.
- Radius 2 reads as a sharp chip, not a badge.
- "RISK" at 10px/700 with tracking.
- "In library" disappears on selected rows (1.2).

Proposed (shadcn `Badge`, cut to six variants):

| Variant | Fill | Text | Use |
|---|---|---|---|
| `secondary` | `surface-sunken` #EEF0F3 | `ink` | file quality, Missing, Below cutoff, Manual download, 2 versions |
| `accent` | `primary-soft` #E4F0EA | `primary-ink` #165A41 (6.98:1) | In library, Downloading 64% |
| `best` | `best-soft` #F1ECFE | `best` #6D28D9 (6.15:1) | Best |
| `destructive` | `risk-soft` #FDECEA | `risk` (5.75:1) | Hit and run risk, Stalled, Failed, Tracker cooldown, 0 seeders |
| `destructive-solid` | `risk` | white | health RISK only |
| `outline` | transparent, 1px `border-control-soft` | `ink-2` | Not out yet, Searching (with spinner) |

- Size: height 20, radius 4, side padding 6, gap 4, Barlow Semi Condensed 11/600, tabular numbers. `destructive-solid` 11/700 with 0.04em tracking, never 10px.
- Badge/quality-filled (black "2160p") becomes `secondary`. The best release is already marked by the row's purple bar and "best" mark; a black chip on top competes with it.
- Metadata (TV, Movie, Continuing, Ended, rating, network, genre, runtime) leaves the badge system and becomes one line of text: `TV · Continuing · ★ 8.4 · Apple TV+` in 12/400 `ink-2`, stars in `ink-3`. "Airing" keeps its 6px dot.
- On a selected row, `accent` badges switch to fill white with 1px `primary-soft-border` #BBD7C9 so they stay visible.
- Mark/comparison and Cell/profile-fit stay as text marks; they already follow the "say it in words" rule. Use `risk` only for "Maps to E07"-style warnings and keep the icon at 12px.

### 2.6 Table rows and headers (S10L1, etMl2, emjuh, Un25k, g9FSk, CcH6h, S6Hi89, D3dxMy, all status rows on c7oDN)

Wrong now: header is a grey band; selected and range-selected are identical; selected rows share the green tint with badges, callouts and the selection bar; focus is a 2px green box drawn inside the row; dimmed rows use `ink-3` text (2.61:1); padding varies 12/16/20 (1.7); in-row icon buttons are 24px bordered squares (wkHZT hover state).

Proposed (shadcn `Table` over TanStack Table):
- Table container: fill `surface`, 1px `border`, radius 8, clip children. This replaces full-bleed strips on wide pages. Rows inside keep square corners.
- Header row: height 32, fill `surface` (no band), bottom 1px `border`. Label Barlow Semi Condensed 11/600 caps, 0.06em tracking, `ink-3`. Sortable header: hover `ink-2`, sorted column `ink` with a 12px arrow.
- Body row: height 34 (dense default), 40 for Row/season, two-line rows 52. Side padding 16 for every family, desktop; 16 phone. Bottom 1px `border-subtle` #EEF0F3, last row none.
- Hover: fill `surface-hover` #F4F5F7, reveal row actions (unchanged rule: actions show on the selected row; on hover only for pointer users).
- Selected: fill `primary-soft` #E4F0EA plus a 2px `primary` bar on the left edge (inset box-shadow). Range-selected: fill `primary-soft` without the bar, so the anchor row is still findable.
- Best: fill `best-soft` #F1ECFE plus 2px `best` left bar, unchanged in spirit. Best and selected: selected fill with the `best` bar.
- Focus (keyboard): `outline: 2px solid var(--ring); outline-offset: -2px`, radius 0. Do not combine with a border change.
- Dimmed (fails the profile): text `ink-3` #636B77 (5.38:1) and quality chip `outline`; no opacity.
- Row/second-version: height 34 (from 30), fill `surface-alt` #FAFBFC, left indent 40, keeps its "second version" label.
- In-row actions: Grab is `default` `sm` (28px) with Kbd `on-fill`; icon actions are `ghost` `icon-sm` (28px, radius 6, no border).
- Label/group (xYqcn, jokEP, ExGw5): drop the grey band. 11/600 caps `ink-3` label with count, 24px space above, 8px below, no border. Risk count in `risk`.
- Row/health-problem and Row/download: titles move to Barlow 13/600 like other row titles; data cells stay Semi Condensed.

### 2.7 Dropdown menu (v5pvMG, V9BjUu)

Wrong now: square panel, no shadow, so it reads as part of the page; item focus is a 2px green box instead of a highlight; separator runs edge to edge.

Proposed (shadcn `DropdownMenu` on Base UI `Menu`):
- Content: min-width 200, fill white, 1px `border`, radius 8, padding 4, `shadow-lg`. Enter: fade plus 4px slide from the trigger side, 120ms; exit 80ms.
- Item: height 30, radius 4, side padding 8, gap 8, text 13/400 `ink`, icon 16 `ink-2`. Highlighted (hover and keyboard, Base UI `data-highlighted`): fill `surface-hover`. No ring on items; the menu's highlight is the focus indicator.
- Destructive item: text and icon `risk`; highlighted fill `risk-soft`.
- Disabled: `ink-disabled`.
- Shortcut slot: Kbd right-aligned.
- Separator: 1px `border-subtle`, margin 4px vertical, -4px horizontal.
- Label: 11/600 caps `ink-3`, padding 6/8.

### 2.8 Tooltip (Y1CrMb)

Wrong now: white box with grey border, 12px text: it looks like an input or a tag.

Proposed (shadcn `Tooltip`): fill `ink` #14181D, text white 12/500, padding 4/8, radius 6, `shadow-md`, max width 240, 6px from trigger, optional Kbd `on-fill`. Open delay 400ms, 0ms when moving between triggers. Fade 100ms.

### 2.9 Kbd (yK9y1, VD5Bk)

Wrong now: 18px with a 2px radius and grey border looks like a tiny input; inside filled buttons it adds a second box.

Proposed (shadcn `Kbd`):
- Default: height 18, min width 18, radius 4, side padding 4, fill `surface-sunken`, 1px `border` with a 1px darker bottom edge (`box-shadow: inset 0 -1px 0 var(--border-control-soft)`), text Semi Condensed 11/500 `ink-2`.
- `on-fill` (inside primary or destructive buttons, tooltip, toast): fill white at 16%, no border, text white at 85%.

### 2.10 Checkbox, radio, switch, bookmark toggle (x96xJ, jW1po, eUx2Z, Flr0s, bFL1w, u5ORj, gKBuE, S8AVx)

Wrong now: unchecked borders 2.61:1; checkbox checked is black, radio checked is green; Switch/Monitored is an "ON/OFF" text chip that the sheet itself marks legacy; no hover or disabled.

Proposed:
- `Checkbox`: 16px, radius 4, 1px `border-control` #8C94A0, fill white. Hover border #6F7783. Checked and mixed: fill `primary`, white 12px check or dash, no border. Focus ring offset 2. Disabled: fill `surface-sunken`, border `border`. Check draws in with a 120ms stroke.
- `RadioGroup` item: 16px circle, same border; selected: 1px `primary` border with a 8px `primary` dot (radius full). Same hover, focus and disabled.
- `Switch`: remove Switch/Monitored from the library; monitored state is Toggle/Bookmark. If a switch is needed later (settings), shadcn `Switch`: track 32×18 radius full, off `border-control-soft`, on `primary`; thumb 14 white with `shadow-xs`, slides 150ms.
- Toggle/Bookmark: keep the three glyphs (monitored, not monitored, mixed), they are product-specific and read well. Hit area 28 in rows (icon 16), 24 in dense rows (icon 14), radius 6, hover fill `surface-hover`, focus ring. Monitored glyph `ink`, not monitored `ink-3`, mixed `ink-2`. Toggling plays a 120ms scale from 0.85 to 1 on the glyph.
- Row/option-radio and Row/option-checkbox: height 40 for two-line options, radius 6, padding 8, hover `surface-hover`, focus ring around the row.

### 2.11 Progress, spinner, skeleton, empty state (TziP6, F8HwRR, DrTm1, d4A0eb)

- Progress: height 4, radius full, track `surface-sunken` #E6E9ED, fill `primary`; stalled fill `risk`; complete fill `ink-3`. While a torrent is actively downloading, a faint light band moves along the fill every 2s (reduced motion: static).
- Spinner: 14 or 16px, 1.5px stroke in `ink-2` (not accent), 700ms per turn.
- Skeleton: radius 4, fill `surface-sunken`, shimmer 1.4s from #EEF0F3 to #F6F7F8; static under reduced motion.
- Empty/state: max width 360, 24px padding; optional 20px icon in a 36px `surface-sunken` circle; title 15/600 `ink`; body 13/400 `ink-2`, 6px under the title; action `outline` `sm` 12px below.

### 2.12 Callouts (VLua2 risk, u3Hab info)

Wrong now: risk callout pairs a pale red fill with a full-strength red border, so the border is the loudest line on the page; the info callout is green, the same as selection and "In library".

Proposed (shadcn `Alert`):
- `destructive`: fill `risk-soft`, 1px `risk-border` #F1B9B3, radius 8, padding 12/14, gap 10, 16px icon in `risk`, title 13/600 `risk-ink` #912018, body 13/400 `ink`.
- `default` (info): fill `surface-sunken`, 1px `border`, icon `ink-2`, title 13/600 `ink`. No green.
- Strip/still-missing (s137oC) is the same `destructive` callout used as a full-width strip: keep radius 0 there only when it is attached to the top of a table container.

### 2.13 Inline panel, choice cards, scrim, add-controls block (l9W80, cDZAn, e2mnD, cM6hL, R8822k)

Wrong now: Panel/inline has a 1px near-black border and no depth, so it looks like a thick-framed box rather than a layer over dimmed content; title 20/700 sits between the 18 and 24 steps; scrim is raw #F5F5F599.

Proposed:
- Panel/inline: fill white, 1px `border`, radius 12, `shadow-lg`, padding 20 (header 20 top, 16 between sections). Title 18/700 `ink`, -0.01em. Close as `ghost` `sm` with Kbd "Esc". Footer: primary then `outline` Cancel, hint text 12 `ink-3` right-aligned. Opening: 160ms fade plus 6px rise.
- Scrim: token `scrim` rgba(244, 245, 247, 0.72) with `backdrop-filter: blur(1px)`. One per open panel, as now.
- Card/choice (shadcn `RadioGroup` item laid out as a card): radius 8, padding 14/16, fill white, 1px `border-control-soft`. Hover border #C5CBD3, fill `surface-alt`. Selected: 1.5px `primary` border, fill `primary-soft`, 16px radio indicator top-right. Focus ring offset 2. Number Kbd stays.
- Block/add-controls: radius 8, 1px `border`, padding 20, no shadow (it is in the page flow).

### 2.14 Phone sheet (mPtT9) and phone rows

- Sheet/Content/phone: top corners radius 16, fill white, `shadow-xl` upward (0 -8px 24px rgba(16,24,40,.12)), padding 8/16/24, handle 36×4 radius full `border-control-soft`. Opens with a 220ms slide from the bottom.
- Sheet actions: `lg` 44px, radius 10. "Replace tracked version" keeps its second line ("Deletes the 1080p file once this finishes") at 12/400 white 80%.
- Sheet fact list rows: height 36, label 13 `ink-2`, value 13 `ink` right-aligned, 1px `border-subtle`.
- Row/release-phone and Row/episode-phone: side padding 16, pressed fill `surface-hover`.

### 2.15 Poster card (mBNeb) and title header (T7bQXg)

Wrong now: selected tints a block behind the poster and text; focus is a thin box around both; no hover; poster corners square on the library, 2px on the header.

Proposed:
- Poster: radius 6, 1px inner border rgba(20, 24, 29, 0.08) so dark posters keep an edge on white. Downloading progress sits inside the poster's bottom edge, 3px, clipped by the radius.
- Hover: poster rises 2px with `shadow-md`, 150ms. This is the main place for visible delight on the library page.
- Selected: 2px `primary` ring at offset 2 around the poster only; title turns 600. No tinted block.
- Focus: `ring` at offset 2 around the poster.
- Title 13/600 `ink`, meta 12/400 `ink-2`, status badge 6px under.
- Header/title: poster 120×180, radius 8, `shadow-md`. Title 32/700, -0.015em (replaces 31). Overview 14/400 `ink-2`, line height 1.5, max 68 characters wide.

### 2.16 Search result row (gB8HJ) and results header (MhQc0)

- Row height 72, padding 8/16, poster thumbnail 40×60 radius 4 (not touching the row edges as now with 2px padding).
- Line 1: title 14/600, year 14/400 `ink-3`. Line 2: metadata text line (2.5). Line 3: overview 12/400 `ink-2`, one line, truncated.
- "In library" badge at right, using the selected-row rule from 2.5.
- Results header filter is the segmented ToggleGroup (2.3).
- Section labels ("In your library", "Sonarr and Radarr") use the Label/group spec (2.6).

### 2.17 Calendar (nn0ll, eA5An, s0MlHD, ZPLZy, lx3Ku, dGZ9Y, Xffyp)

Wrong now: Calendar/Entry is a white box with a grey border, padding 7/10, identical to an input; today header is a full green band; month cells are bordered boxes.

Proposed:
- Calendar/Entry: radius 6, fill `surface-sunken` #F4F5F7, no border, padding 6/8, title 13/600, meta 12/400 `ink-2`. State shows as a 3px left bar plus words: missing and gave up in `risk` (meta text `risk`), downloading in `primary` with the 3px progress under the meta line, unmonitored: title `ink-3`, bookmark glyph outline. Normal monitored entries stay plain (keeps the "quiet when normal" rule). Hover fill `surface-hover` darker step #ECEEF1; focus ring.
- DayHeader: height 32, no fill, 11/600 caps `ink-3`. Today: day number in a 22px `primary` circle with white text, "today" 11/500 `primary-ink`. Tomorrow and forecast unchanged.
- MonthCell: hairline grid (1px `border-subtle`) instead of separate boxes; out-of-month dates `ink-disabled`; today date in the 22px `primary` circle.
- NowLine: 1px `primary` line with 6px dot, label 11/600 `primary-ink` (from 10px).
- Calendar/Header: range 20/700 to 18/700; view switcher is the segmented ToggleGroup.

### 2.18 Toast (KMW20)

Wrong now: a 34px full-width bordered strip that looks like another table row, not a notification.

Proposed (shadcn `Sonner`): fixed bottom-left, 16px from the edge and above the live bar; width 360 to 420; fill `ink` #14181D, radius 8, padding 10/14, `shadow-lg`. Text 13/500 white, secondary 12/400 white 70%. "Undo" as a text button 13/600 white with Kbd `on-fill` "Z". Enter: 180ms slide up plus fade; auto-dismiss 6s, paused on hover; stack up to 3. Error toast: same body with a 16px `risk` icon on a #3A1A18 circle.

### 2.19 Selection bar and bottom action bar (a5qoHr, rdmsC)

- Bar/selection: invert it so it reads as a tool strip, not another selected row. Fill `ink` #14181D, radius 8, height 40, padding 0/8/0/14, `shadow-lg`, floating 12px above the bottom of the list. Count 13/600 white; actions `ghost` `sm` in white 85% with Kbd `on-fill`; hint 12/400 white 60%. Slides up 160ms when the first row is selected.
- Bar/bottom-action: height 52, white, top 1px `border`, `shadow` upward 0 -1px 0; primary action `default` `sm`.

---

## 3. Proposed light-mode token set

Written as shadcn CSS variables. The existing pen variables they replace are in brackets.

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--background` | #F4F5F7 [ground #F5F5F5] | page canvas |
| `--surface` (`--card`, `--popover`) | #FFFFFF [row] | table containers, panels, menus |
| `--surface-alt` | #FAFBFC [row-alt #FAFAFA] | second-version rows, card hover |
| `--surface-sunken` (`--muted`) | #EEF0F3 | segmented track, secondary badge, skeleton, Kbd, calendar entry |
| `--surface-hover` (`--accent` in shadcn naming) | #F4F5F7 [row-hover #EDEFF2] | row, menu item, ghost button hover |
| `--surface-selected` | #E9ECEF | active nav item |
| `--scrim` | rgba(244, 245, 247, 0.72) [raw #F5F5F599] | behind inline panels |

### Ink

| Token | Value | Ratio on white | Use |
|---|---|---|---|
| `--foreground` / `--ink` | #14181D [ink #171B20] | 17.8 | primary text |
| `--ink-2` (`--muted-foreground`) | #4F5864 [#58616C] | 7.21 (6.16 on primary-soft) | secondary text |
| `--ink-3` | #636B77 [#9AA1AB] | 5.38 (4.60 on primary-soft, 4.84 on sunken) | meta text, placeholders, header labels |
| `--ink-disabled` | #A3AAB4 | 2.34 | disabled text only (exempt from contrast minimums) |

### Lines

| Token | Value | Use |
|---|---|---|
| `--border` | #E3E6EA [seam #D1D5DB] | containers, dividers between sections |
| `--border-subtle` | #EEF0F3 | row dividers inside a table |
| `--border-control-soft` | #D5DAE0 | outline buttons, app bar search, card choice |
| `--border-control` (`--input`) | #8C94A0 (3.06:1) | checkbox, radio, standalone form fields |

### Accent and status

| Token | Value | Notes |
|---|---|---|
| `--primary` | #1D6B4F [accent #215D47] | white text 6.43:1; slightly brighter and greener than now |
| `--primary-hover` | #16573F | |
| `--primary-pressed` | #124532 | |
| `--primary-soft` | #E4F0EA [accent-soft #D6E5DB] | selected rows, accent badges |
| `--primary-soft-border` | #BBD7C9 | accent badge on selected row |
| `--primary-ink` | #165A41 | text on primary-soft, 6.98:1 |
| `--best` | #6D28D9 (unchanged) | 6.15:1 on best-soft |
| `--best-soft` | #F1ECFE [#EDE9FE] | |
| `--risk` (`--destructive`) | #B42318 (unchanged) | 5.75:1 on risk-soft |
| `--risk-hover` | #912018 | |
| `--risk-ink` | #912018 | callout titles |
| `--risk-soft` | #FDECEA [#FBE3E1] | |
| `--risk-border` | #F1B9B3 | callouts, destructive-outline |
| `--ring` | #1D6B4F | focus outline, always 2px with 2px offset (−2px inside rows) |

Retire: `selected` (use `ink` or `primary` by role), `on-cell` (use `primary-foreground` white), and the `rk-*` and `tx-*` exploration variables once a direction is chosen.

### Radius

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4 | badges, Kbd, checkbox, menu items, skeleton, search thumbnail |
| `--radius-md` | 6 | buttons, inputs, selects, segmented items, nav items, tooltip, poster |
| `--radius-lg` | 8 | menus, table containers, callouts, cards, segmented track, toast, selection bar |
| `--radius-xl` | 12 | inline panel |
| `--radius-2xl` | 16 | phone sheet top corners |
| `--radius-full` | 9999 | radio, switch, count pills, avatar dots |

shadcn's single `--radius` becomes 6px; its derived `sm/md/lg/xl` map to 4/6/8/12.

### Shadows

| Token | Value |
|---|---|
| `--shadow-xs` | 0 1px 1px rgba(16, 24, 40, 0.05) |
| `--shadow-md` | 0 2px 4px rgba(16, 24, 40, 0.06), 0 4px 12px rgba(16, 24, 40, 0.08) |
| `--shadow-lg` | 0 4px 8px rgba(16, 24, 40, 0.06), 0 12px 32px rgba(16, 24, 40, 0.12) |
| `--shadow-xl` | 0 -8px 24px rgba(16, 24, 40, 0.12) (phone sheet, upward) |

Rows and in-flow blocks get no shadow. Only layers that float (menu, tooltip, panel, sheet, toast, selection bar) and the hovered poster do.

### Control heights

| Token | Value | Use |
|---|---|---|
| `--control-xs` | 24 | dense in-row icon actions |
| `--control-sm` | 28 | in-row Grab, segmented items, selection bar actions |
| `--control-md` | 32 | desktop default buttons, inputs, selects |
| `--control-lg` | 44 | phone touch targets |
| `--row` | 34 | dense table row |
| `--row-tall` | 40 | season row, two-line option row |
| `--row-two-line` | 52 | download, flagged and stalled rows |

### Spacing

4, 8, 12, 16, 20, 24, 32, 48. Row side padding is 16 everywhere on desktop and phone. Panel padding 20. Section gap 24. Page gutter 24 desktop, 16 phone.

### Type

| Step | Size / weight | Family | Use |
|---|---|---|---|
| caption | 11 / 600 caps, 0.06em | Semi Condensed | header labels, group labels |
| meta | 12 / 400 | Barlow or Semi Condensed for numbers | secondary lines |
| body | 13 / 400 and 600 | Barlow; Semi Condensed for release data | rows, inputs, menus |
| control | 14 / 600 | Barlow | buttons, row titles that lead a page |
| panel title | 18 / 700, −0.01em | Barlow | panels, calendar range |
| page title | 24 / 700, −0.01em | Barlow | page headers |
| display | 32 / 700, −0.015em | Barlow | title header |

Drop 10, 17 (phone nav title may stay 17 to match iOS), 20 and 31. Tabular numbers on every count, size, ratio and percentage.

### Motion

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 120ms | hover, press, check |
| `--duration-base` | 160ms | menus, panels, segmented slide |
| `--duration-slow` | 220ms | phone sheet, toast |
| `--ease-out` | cubic-bezier(0.2, 0, 0, 1) | everything entering |

All looping motion (live bar dot, progress band, skeleton shimmer) stops under `prefers-reduced-motion: reduce`.

---

Questions skipped: this file is a deliverable for the orchestrating agent, which will put decisions to the owner.
