# Critique: Library, Search results, app bar, downloads bar (light mode)

DEGRADED: single-context (one reviewer inside a parallel review; the impeccable detector reads web markup and cannot scan a .pen file, so no detector pass ran).

Source: `design/mediaManager2.pen` in the `codex-design-finish` worktree, read only. All values below were read with `Get(..., {resolveVariables: true, resolveInstances: true})`. Screens exported at 1x to `scratchpad/review/shots/`.

Screens: `nsjkg` Light / Desktop / Library, `Cke0b` Light / Desktop / Search results, `o1n2Js` Light / Phone / Search results. Shared: app bar (`f8F8kK`, `q45Jlu`), downloads bar (`mqLtL`, `mIqyF`, phone `YdDcu`).

## What makes it read as "back office"

These cut across all three screens, so they come first.

1. **Surfaces are separated only by grey hairlines.** Page `#F5F5F5` against rows and bars `#FFFFFF` is 1.09:1, so the eye cannot see the two surfaces apart. Every boundary is then drawn with a 1px `#D1D5DB` stroke (1.35:1 on the page). App bar, toolbar controls, segmented filter, every search row, every result chip and the downloads bar all carry that same stroke. Nothing has elevation, so the screen reads as a ruled form.
2. **One corner radius, 2px, on everything.** Poster images, chips, key caps, the bookmark badge: all `cornerRadius 2`. Inputs, the segmented filter, Sort and Show dropdowns and result rows have 0. Square-cornered inputs plus 2px chips is the look of a 2010 admin template.
3. **Too many boxed labels.** A search result row shows up to five bordered 20px boxes (`Movie`, `Released`, `8.1 ★`, plus the in-library label), each 11px 600 weight `#171B20`. A poster card can show five different label styles (`Status accent` fill, `Status secondary` grey fill, `Status outline` stroke, `Status ghost` text, `Status chip` stroke). Type and release status are facts, not states, but they get the same box as "Missing 7 episodes".
4. **The type scale is flat.** Every visible text on these screens sits between 11px and 14px. Wordmark 14/700, nav 13/500, result title 14/600, card title 13/600, meta 12, chips 11. No size marks a page level, so hierarchy rests entirely on weight and grey.
5. **Left edges do not line up.** App bar content starts at x=20, Library toolbar and grid at x=8, downloads bar at x=20. Search results column starts at x=240 (centred 960px) while the app bar search field starts at x=157. Phone: app bar padding 12, filter row 16, section label 16, rows 16, downloads bar 12.
6. **Green does four jobs.** `accent #215D47` / `accent-soft #D6E5DB` is used for: the selected poster card fill, the selected result row fill, the "In library" label, "Downloading 64%" label, the progress fill, the focused search stroke and the downloads icon. On the selected row and selected card, selection fill and label fill are the same `#D6E5DB`, so the label loses its background and its meaning.

## Shared: app bar

Evidence (`f8F8kK`, 1440x48, white, bottom stroke `#D1D5DB`, padding 0 20, gap 24):

- Wordmark `XqKzc` "media-manager-2" is 14px 700 Barlow, one step above the 13px nav. It does not anchor the bar.
- Active nav item (`U4N5H` Library) differs from the others only by weight 600 vs 500 and `#171B20` vs `#58616C`. No underline, no fill. Easy to miss at a glance.
- Counts are part of the label string: "Downloads 3", "Flagged 5" (`W2Nkj`, `j1SSqC`). "Flagged 5" carries the only number on the bar that asks for attention, and it looks identical to "Downloads 3". Each nav item already holds a hidden `Status` label (`qjoPz`, `risk-soft` fill) that could carry this.
- Keyboard hint `otByF` ("? keys") is 12px `#58616C` plus a 15x18 key cap with 2px radius; it reads as leftover.
- Search field `McvFG` 420x32, square, 1px `#D1D5DB`. Focused state (on `Cke0b`) only swaps stroke to `#215D47`, still 1px. No focus ring.

Proposals:

- Height 56px, padding 0 24 (matches the new page margin below). White, no bottom stroke; instead a shadow `0 1px 0 rgba(17,24,39,0.06)`, so the bar separates from the page by tone, not by a ruled line.
- Wordmark 16px 700, letter-spacing -0.01em.
- Nav items as 32px-tall buttons, radius 8, padding 0 12. Active: fill `#EEF0F3`, text `#171B20` 600. Inactive: `#58616C` 500, hover fill `#F4F5F7`.
- Counts as separate numbers in a pill (radius 999, 18px tall, padding 0 6, 11px 600, tabular figures). "Downloads" count: `#EEF0F3` fill, `#171B20` text. "Flagged" count: `risk-soft #FBE3E1` fill, `risk #B42318` text, and only when above zero.
- Search field 36px tall, radius 8, fill `#F4F5F7`, no stroke at rest; on focus white fill plus 2px `#215D47` ring at 30% opacity outside a 1px `#215D47` edge. Keep the "/" key cap at the right, radius 4.
- "? keys": drop the word, keep a 28px square ghost button with the "?" key cap, tooltip "Keyboard shortcuts".

## Shared: downloads bar

Evidence (`mqLtL`, 1440x32 at y=868; phone `YdDcu` 390x44 at y=800):

- Three text styles in one 32px strip: count 13/600, speed 13/400, items 12/400. Items text sits at y=9 while the other two sit at y=8, so baselines are 1px off.
- Chevron `cshvc` is `#9AA1AB` on white: 2.61:1, below the 3:1 floor for icons.
- "Severance S02E07 64% · The Bear S03 23% · Andor S02E09 91%" is one grey 12px string. Percentages, the most live number in the app, have no visual form.
- The bar is the app's live heartbeat (Product principle 3: "show the real state, live") but is styled like a status footer.
- Phone: the 44px bar ends at y=844, the screen bottom. On a 390x844 iPhone the home indicator takes the bottom 34px, so the bar's text and chevron sit inside the gesture area.

Proposals:

- Desktop 40px, padding 0 24, white with shadow `0 -1px 0 rgba(17,24,39,0.06)`. One text size, 13px, tabular figures; count 600, rest 400.
- Each download as its own item: name 13px `#171B20`, then a 48x4 progress track (radius 999, track `#E5E7EB`, fill `#215D47`), then the percentage. Up to three items, then "+2 more".
- Speed shown as "↓ 41.6 MB/s  ↑ 12.3 MB/s" with the arrows as 12px icons, so the label words go.
- Expand control as a real 28px button, radius 6, chevron `#58616C` (5.76:1).
- Phone: 52px bar plus `env(safe-area-inset-bottom)` padding; show count, one progress track for the overall total and speed.

## Screen 1: Light / Desktop / Library (`nsjkg`)

### Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Progress strips and "Downloading 64%" labels are good; "4 titles · gave up searching" is red text with no link. |
| 2 | Match system / real world | 3 | Uses Sonarr/Radarr words; the unmonitored mark is a plain bookmark, which reads as "saved". |
| 3 | User control and freedom | 3 | Type filter, sort and show are all one click; no visible way back from a filtered state other than "All". |
| 4 | Consistency and standards | 2 | Five label styles on cards; selected card shifts its poster 4px inward. |
| 5 | Error prevention | n/a | No destructive action on this screen. |
| 6 | Recognition rather than recall | 3 | Episode counts "16 + 1 / 19" need learning; everything else is visible. |
| 7 | Flexibility and efficiency | 3 | "/" and "D" shortcuts shown; no density toggle. |
| 8 | Aesthetic and minimalist design | 2 | Hairlines, flat surfaces, flat type scale, black filter block is the heaviest object. |
| 9 | Error recovery | 2 | "Missing 2 episodes" gives no next action on the card. |
| 10 | Help and documentation | 2 | "? keys" is the only help, and it is visually weak. |
| | **Total** | **23/36** | Acceptable; one heuristic n/a. |

### Top problems

1. **The selected card breaks the grid.** `JDyIt` (Severance) gets `padding 4` and fill `#D6E5DB`, so its poster shrinks to 120x192 while every other poster is 128x192, and its title starts at x=12 instead of x=8. Its "Downloading 64%" label (`C73a5B`, fill `#D6E5DB`) vanishes into the card fill. Selection should never change geometry.
2. **The heaviest object on the page is the least important.** Type filter item "All 214" (`EaQim/bq0RX`) is a solid `#171B20` block. Posters are the content; the filter is a setting.
3. **Grid margin is 8px** (`ReCb0` padding 4 8 16 8) while the app bar uses 20. Posters run almost to the window edge. Card rows have uneven heights (292 vs 260 vs 234) because label stacks differ, so the second row's posters start at a height that depends on the tallest card above.
4. **Unmonitored mark reads backwards.** `HVQf4/oRS1J` is a white 20x20 square with radius 2 and a plain bookmark icon `#58616C` over the poster; the title also drops to `#58616C`. A plain bookmark means "saved", the opposite of "not monitored". Sonarr uses a filled vs outlined bookmark for monitored vs unmonitored; an outlined bookmark with a slash, or the word "Unmonitored", would match.
5. **Toolbar totals are 12px and the red warning is not a control.** `epvkm` totals sit in a 437px run at 12px; "4 titles · gave up searching" (`jUsOL`, `#B42318`) is plain text, yet Product capability 7 says anything the app gives up on is flagged, so this should open Flagged.

### Proposals

- **Page margin 24px**, grid gap 16 horizontal and 24 vertical. At 1440 that keeps 10 columns: (1440 - 48 - 9x16) / 10 = 124.8, so 124px posters at 2:3 (186px tall).
- **Fixed card anatomy** so every row aligns: poster, 8px, title (14/600, one line, ellipsis), 2px, meta (12px, tabular figures), 8px, one status line reserved at 20px even when empty. Versions ("+2 versions") move into the meta line as "· 3 versions".
- **Posters radius 8**, with a 1px inner stroke `rgba(0,0,0,0.06)` so light posters keep an edge on the light page.
- **Selection as a ring, not a fill:** 2px `#215D47` ring at 3px offset around the poster only. No padding change, no card fill.
- **One status label style:** pill, radius 999, 20px tall, padding 0 8, 11px 600. Colour carries meaning: green (`#D6E5DB` / `#215D47`) for downloading and healthy; amber for missing (new token, for example fill `#FDF0D5`, text `#8A5A00`); grey `#EEF0F3` / `#58616C` for neutral facts like "Manual download" and "Not out yet". Drop the outline and ghost variants on cards.
- **Downloading as a poster overlay:** move the progress strip onto the bottom edge of the poster (inside its 8px radius, 4px tall), and drop the separate "Downloading 64%" label; show the percent in the strip's tooltip and in the meta line.
- **Type filter as a segmented control:** track `#EEF0F3`, radius 8, 2px inner padding; selected segment white, radius 6, shadow `0 1px 2px rgba(17,24,39,0.08)`, text `#171B20` 600; others `#58616C` 500. Sort and Show as 32px ghost buttons, radius 8, no stroke at rest.
- **Totals at 13px**, tabular figures; the red count becomes a link-styled button ("4 titles gave up searching →") that opens Flagged.

## Screen 2: Light / Desktop / Search results (`Cke0b`)

### Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | "In library · 1 / 1" shown; on the selected row its background disappears. |
| 2 | Match system / real world | 3 | Section names match capability 12; "1 / 1" on a movie is opaque. |
| 3 | User control and freedom | 2 | No clear button in the search field; no way to see the query echoed in the results header. |
| 4 | Consistency and standards | 2 | Network shown as an unbordered label next to three bordered ones; row padding differs from phone. |
| 5 | Error prevention | n/a | No destructive action here. |
| 6 | Recognition rather than recall | 3 | Poster, year, type, status, rating, overview all visible as capability 12 asks. |
| 7 | Flexibility and efficiency | 2 | No visible keyboard path through results (arrow keys, Enter). |
| 8 | Aesthetic and minimalist design | 2 | Four boxed labels per row; 280px of empty page below 6 results. |
| 9 | Error recovery | n/a | No error state drawn. |
| 10 | Help and documentation | 2 | Same weak "? keys". |
| | **Total** | **19/32** | Acceptable; two heuristics n/a. |

### Top problems

1. **Posters nearly touch the row edges.** Rows are 64px with `padding 2 12`, so the 40x60 poster has 2px above and below. The rows read as cramped table cells.
2. **The selected row hides its own label.** `xLk8D` fill `#D6E5DB` equals `a64OKG` "In library" fill `#D6E5DB`. The hovered row `SDskz` uses `#EDEFF2`, so there are two highlight colours with no stated difference.
3. **Boxed metadata.** `Movie`, `Released`, `8.1 ★` are three 20px boxes with 1px `#D1D5DB` strokes; `Legendary` / `HBO · 1 season` is unboxed grey text. These are all plain facts and should read as one line of text.
4. **Header does not say what was searched.** `dcJoP` says "6 results" at 13/600. The query lives only in the app bar.
5. **Column alignment:** the results column starts at x=240 and the search field at x=157; nothing ties the results to the field that produced them.

### Proposals

- **Results header:** "6 results for "dune"" at 20px 600, `#171B20`, with the query in `#58616C`. Segmented filter on the right as above.
- **Section labels** in sentence case, 13px 600 `#58616C` ("In your library", "Sonarr and Radarr"), 24px above, 8px below. Drop the 11px letter-spaced uppercase.
- **Each section as one white panel**, radius 12, shadow `0 1px 2px rgba(17,24,39,0.06), 0 0 0 1px rgba(17,24,39,0.04)`, on page `#F4F5F7`. Rows inside are separated by a 1px `#EEF0F3` divider inset 68px from the left (aligned with the text, not the poster).
- **Row 80px, padding 10 16**, poster 40x60 radius 6. Line 1: title 15/600, year 15/400 `#58616C`. Line 2: meta as plain text at 13px `#58616C`, joined by " · ": "Movie · Released · ★ 8.1 · Legendary". Line 3: overview 13px `#58616C`, one line, ellipsis.
- **In-library state on the right** as one green pill (radius 999) "In library" with the file count as plain text after it ("1 file"). Drop "1 / 1" for movies.
- **Hover** `#F7F8FA`; **keyboard focus** the 2px `#215D47` ring inside the row, radius 8. No fill change for selection.
- **Highlight the matched text** in titles (600 weight on "Dune", the rest of the title 500) so near-identical titles separate faster.

## Screen 3: Light / Phone / Search results (`o1n2Js`)

### Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | In-library labels present; downloads bar visible. |
| 2 | Match system / real world | 3 | Same words as desktop. |
| 3 | User control and freedom | 2 | Back button present; no clear button in the field. |
| 4 | Consistency and standards | 1 | Content contradicts the desktop screen (see problem 1). |
| 5 | Error prevention | n/a | No destructive action here. |
| 6 | Recognition rather than recall | 2 | Overview and network/studio dropped, which capability 12 lists as required. |
| 7 | Flexibility and efficiency | 2 | Targets under 44px slow one-handed use. |
| 8 | Aesthetic and minimalist design | 2 | Same boxed labels and hairlines; 164px empty spacer. |
| 9 | Error recovery | n/a | No error state drawn. |
| 10 | Help and documentation | n/a | Not expected on a phone search screen. |
| | **Total** | **15/28** | Poor; three heuristics n/a. |

### Top problems

1. **Phone and desktop disagree on the same search.** Desktop puts Dune: Prophecy under Sonarr and Radarr; phone puts it under In your library with "4 / 6". Desktop shows Dune (2021) in the library; phone lists it under Sonarr and Radarr. Ratings differ: Dune: Part Two 8.1 vs 8.5, Dune 2021 8.0 vs 7.8, Dune: Prophecy 7.3 vs 7.1. Desktop lists Children of Dune (2003); phone lists Frank Herbert's Dune (2000). Mockups that disagree will make the owner question which one is right.
2. **Required content missing.** Rows (`qJ5ao`, `d2XXB` and siblings) drop the one-line overview and network/studio. PRODUCT.md capability 12 requires both "to tell titles apart before opening one". Four results all called "Dune" need exactly that.
3. **Touch targets below 44px.** Search field `F69DfH` 32px tall, segmented filter `WCta0` 32px, labels 20px.
4. **Edges misaligned.** App bar padding 12 (back icon centre at x=34), content padding 16, downloads bar padding 12.
5. **Downloads bar inside the home-indicator area** (see shared section).

### Proposals

- Use the desktop data set on both screens.
- Rows 96px: poster 48x72 radius 6; line 1 title 16/600 and year; line 2 meta "Movie · Released · ★ 8.1 · Legendary" 13px; line 3 overview 13px, one line. In-library pill on line 2's right or under it.
- Search field 44px, radius 10, fill `#F4F5F7`, clear button (24px "×") once text is entered. Segmented filter 36px with full-row 44px hit area.
- 16px horizontal margin everywhere, including app bar and downloads bar.
- Sections as white panels with radius 12 and 16px side margins, same as desktop.

## Proposed system, all three screens

**Spacing scale:** 4, 8, 12, 16, 24, 32, 48. Page margin 24 desktop, 16 phone. Gap between toolbar and content 16; between sections 24; inside rows 12.

**Type (Barlow / Barlow Semi Condensed kept):**

| Use | Size / weight | Line height |
|---|---|---|
| Page heading ("6 results for "dune"") | 20 / 600 | 28 |
| Row title, card title | 15 / 600 (desktop rows), 14 / 600 (poster cards) | 20 |
| Body, overview, nav | 13 / 400–500 | 18 |
| Meta, numbers | 12–13 / 400, tabular figures | 16 |
| Status pill | 11 / 600 | 16 |

**Colour (light):** page `#F4F5F7` (cooler than `#F5F5F5`, and with white panels at 1.08:1 the panels need a shadow, which is the point). Panels and bars `#FFFFFF`. Dividers `#EEF0F3`, used inside panels only. Strokes `#D1D5DB` only on inputs at rest when no fill is used. Ink `#171B20`, secondary `#58616C`; retire `#9AA1AB` for text and icons. Green `#215D47` for healthy and downloading, plus focus ring. Add amber for "missing" so red `#B42318` stays for risks (hit and run, gave up). Keep `best #6D28D9` for release tables only, as DESIGN.md already rules.

**Radii:** 4 key caps, 6 small buttons and row posters, 8 controls, inputs and poster cards, 12 panels, 999 status pills.

**Elevation:** two levels only. Level 1 for panels and bars: `0 1px 2px rgba(17,24,39,0.06), 0 0 0 1px rgba(17,24,39,0.04)`. Level 2 for menus and the expanded downloads panel: `0 8px 24px rgba(17,24,39,0.12)`.

**Buttons:** 32px desktop / 44px phone, radius 8, padding 0 12. Primary filled `#171B20` on white text (kept for the one main action per screen, not for filters). Secondary `#EEF0F3` fill. Ghost transparent with `#F4F5F7` hover.

## Delight that fits a tool you operate

1. **Downloads that finish, visibly.** When a download imports, its poster's progress strip fills to the end, turns into a 1-second green check over the poster corner, then fades. The downloads bar count ticks down with a 150ms number roll. It confirms Product principle 3 without any extra screen.
2. **Live speed sparkline.** A 64x16 line of the last 60 seconds of download speed in the downloads bar, next to "↓ 41.6 MB/s". The owner sees stalls (a flat line) before rTorrent reports them.

Both respect `prefers-reduced-motion`: the check appears without animation and the sparkline updates without easing.

## Minor observations

- Nav component carries hidden items "Search" and "History" with a "2 RISKS" label on every item (`AN03d/*/qjoPz`, all disabled). Fine as variants, but "History" is a product feature (capability 10) with no nav entry on these screens.
- "16 + 1 / 19" (Severance) and "18 + 10 / 38" (The Bear) need a legend or tooltip; the "+" meaning (downloading episodes) is not stated anywhere on the card.
- The file holds two unused palettes, `rk-*` (Instrument Sans, Geist Mono, `#E8E9EB` ground) and `tx-*` (Archivo, Hanken Grotesk, IBM Plex Mono, `#635BFF` accent). If either is the chosen direction, the type proposals above should follow it instead of Barlow.
