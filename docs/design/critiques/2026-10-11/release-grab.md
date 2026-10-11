Method: DEGRADED: single-context (design-file review of mediaManager2.pen, light mode only; no running app, so the impeccable detector and browser overlays could not run)

# Release picking and grab: design critique (light mode)

Screens: ND0L4 Pick a release inline under episode, p6UBkQ Grab already owned, AHRck Pick a release inline under movie header, YQrvQ Phone / Pick a release, LN7tO Phone / Grab sheet, plus the Row/release states on E9gJVQ (Light components, Tables and rows).

Measurements come from `Get(..., {resolveVariables:true, resolveInstances:true})` on the light theme. Exports used for viewing are in `scratchpad/review/png/`.

## Light tokens these screens use

| Token | Hex | Where it shows up here |
|---|---|---|
| ground | #F5F5F5 | page, table header band |
| row | #FFFFFF | rows, panels, sheets |
| row-hover | #EDEFF2 | quality chips, file chips |
| seam | #D1D5DB | every 1px border and row divider |
| ink / ink-2 / ink-3 | #171B20 / #58616C / #9AA1AB | text, secondary text, sheet handle |
| accent / accent-soft | #215D47 / #D6E5DB | Grab, Search automatically, selected episode row, chosen Replace card, downloading badge |
| best / best-soft | #6D28D9 / #EDE9FE | the "best" word, best row tint, 2px left bar |
| risk / risk-soft | #B42318 / #FBE3E1 | tracker cooldown chip, BLU tracker chip |
| Scrim | #F5F5F5 at 60% | washes out everything outside the open panel |

Corner radius: 0 on every button, panel, segmented control, sheet and choice card. 2px only on chips and key hints.
Type: Barlow for labels and buttons, Barlow Semi Condensed for data. Sizes in this flow: 11, 12, 13, 14, 15, 17, 20.

## Cross-screen findings (the ones that matter most)

1. **[P1] Column headers sit 60px to the right of their data on the episode screen.** In ND0L4's release table (I5B1m) the header cell SIZE spans x 764 to 834 while the size values span x 704 to 774. SEEDERS, TRACKER, HIT AND RUN and AUDIO · HDR are all off by the same 60px (header AUDIO · HDR is 120px wide, the data column is 180px; header RELEASE is 444px, data RELEASE about 384px). In the export, "SIZE" floats over nothing and "8.9 GB" sits under the end of the release name. The movie table (AHRck) is aligned, so the episode table was built from a different header. Fix: one Table/Header instance whose column widths are bound to Row/release (Un25k): Quality 80, Fit 110, Source 70, Release fill, Size 70, Seeders 70, Tracker 60, Hit and run 110, Audio · HDR 180, action 110.

2. **[P1] "Better than yours" is told three different ways, and not at all on the episode screen.** AHRck marks rows with "better" (Barlow 12/700, #58616C). YQrvQ says "better than yours" / "not better" (Barlow 12/400, #58616C). ND0L4 owns a 1080p below-cutoff file, yet its four 2160p rows carry no comparison mark at all. Components for this already exist on the canvas (Mark/comparison/best iivYD, better xYt1l, same-or-worse phD1O, yours Y9or9N) and none of these screens use them consistently. Fix: use those four marks everywhere, same words on desktop and phone.

3. **[P1] "best", "better" and "yours" float after the release name, so the eye cannot find them by scanning down.** The "best" word starts at x 572 on the FLUX row; on other rows the same mark lands wherever the name ends. Fix: give the comparison its own fixed column (about 64px) directly left of Size. Then "best / better / same / yours" form a single vertical line the owner reads in one pass, and the release name column stays pure text.

4. **[P1] Trackers are three-letter text, and the movie screen paints a tracker red.** Rows show "PHD", "BHD", "BLU" as 13/600 ink text. On AHRck the BLU tracker is a red chip (#FBE3E1 / #B42318) because of a cooldown, while ND0L4 shows the same cooldown as a separate "Tracker cooldown" chip in the hit and run column. A tracker's identity and a tracker's problem share one cell and one colour. Logo components exist (Logo/Beyond-HD dofWM, Logo/PrivateHD i2QZW, Logo/Blutopia z7AOoy). Fix: 16px tracker logo plus short name in ink-2 in the Tracker column; the cooldown always goes in the hit and run column as text in risk colour ("cooldown 3h left"), never as a recoloured tracker.

5. **[P1] The phone list shows a release from YTS.** YQrvQ's last row reads "WEBRip · YTS" with "YTS · rejected: below cutoff". The product talks to three private trackers only (Beyond-HD, PrivateHD, Blutopia, per PRODUCT.md). Replace with a Blutopia row. Also, "rejected: below cutoff" is the wrong reason for a 720p release; the desktop wording "720p not wanted" is the true one.

6. **[P2] Phone sorts a rejected release to the top.** YQrvQ's first row is the dimmed "REMUX · FraMeSToR, rejected: over 60 GB", above the best release. Desktop puts rejected releases last. Sort the same way on both: passing releases by score, rejected at the bottom.

7. **[P2] Green means four things.** #215D47 / #D6E5DB is the Grab button, the Search automatically button, the selected episode row (lzEfN fill #D6E5DB), the chosen Replace card and the "Downloading 64%" badge. On ND0L4 a green-tinted row sits directly on top of a violet-tinted best row, two saturated tints touching. Fix: keep green for the one action you take (Grab, Search automatically). Use a neutral for selection (ink at 6%, about #EEEFF1, with a 2px ink left bar). Use violet only for best.

8. **[P2] Hit and run cells mean different things when empty.** AHRck leaves the BHD cells blank (W4NK3R, NTb, DON rows); ND0L4 writes "120h or ratio 1.0" for BHD. A blank reads as "unknown" or "no rule". Always print the rule; if a tracker has none, write "no rule".

9. **[P2] Everything is square, every surface is a 1px #D1D5DB box.** Buttons, the segmented quality filter, the inline panel, choice cards and phone sheets all have radius 0 and no elevation. The open panel on ND0L4 (K07bs, white with a seam stroke) does not read as belonging to episode 08; it reads as one more white box on grey. This is the "back office" look the owner wants gone.

10. **[P2] The type scale has seven sizes within 9px and almost no weight contrast inside rows.** In a release row every value is 13px #171B20, regular or 600. Release name, size, tracker, hit and run and audio all pull equally, so nothing leads. The only strong elements are the group name (700) and seeders (600).

## Per screen

### ND0L4 · Pick a release, inline under episode

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | "Results from 14 min ago" and the downloading row are clear; no sign of a search in progress on refresh |
| 2 | Match system / real world | 3 | Terms match CONTEXT.md; "+1600" score is unexplained |
| 3 | User control and freedom | 3 | Previous/next episode, quality filter, collapse chevron; no visible close for the panel itself |
| 4 | Consistency and standards | 1 | Header 60px off its data; no comparison marks while the movie table has them; filter on the left here, on the right on AHRck |
| 5 | Error prevention | 3 | Rejected releases dimmed with reason; BLU cooldown releases folded into "2 more on BLU" |
| 6 | Recognition rather than recall | 2 | Owner must remember owned file is 1080p to judge each row; tracker abbreviations; marks float |
| 7 | Flexibility and efficiency | 4 | G, Shift R, [ and ], D key hints throughout |
| 8 | Aesthetic and minimalist design | 2 | Green row over violet row; every cell same weight; square boxes |
| 9 | Error recovery | 2 | Cooldown explained, but no route from a rejected release to why the profile rejects it |
| 10 | Help and documentation | 2 | Keys shown; nothing explains the score or "below cutoff" |
| | **Total** | **25/40** | Acceptable, held back by consistency |

Top problems
- Column header misalignment (finding 1). Measured: header SIZE x 764 to 834, data x 704 to 774.
- Scrim (oIO9m, #F5F5F5 at 60%) blends the episode rows above to roughly #B6BABE text on #F9F9F9 for ink-2 text, about 1.9:1. The owner loses the context of which episodes already have files while choosing. A lighter wash (30%) or plain ink-3 text would keep them readable without competing.
- "312 PHD" reads as one value: Seeders is right-aligned ending at x 856, Tracker starts at x 868, a 12px gap.
- The Grab button (26px tall, radius 0, #215D47) is the only filled control in the table and appears on the best row only. That is right; its square 26px shape at 13px inside a 34px row looks cramped.

Proposals
- Container: open the panel as a card under the episode row, inset 8px left and right of the row edges, radius 10px, 1px #E3E6EA border, shadow 0 1px 2px rgba(23,27,32,.06) and 0 4px 16px rgba(23,27,32,.06). Connect it to episode 08 with the episode row's bottom corners square and the card's top corners square, so they read as one object.
- Selected episode row: neutral #EEEFF1 with a 2px #171B20 left bar instead of green #D6E5DB.
- Results line: one order on every screen. Left: "Results from 14 min ago · Refresh (Shift R)" and "5 releases beat yours". Right: quality filter. Previous/next episode go in the episode row's own actions, not in the results line.
- Column order and widths: Quality 72 | Release fill | Comparison 64 | Fit 96 | Size 72 right | Seeders 64 right | (24px gap) Tracker 96 logo plus name | Hit and run 120 | Audio · HDR 168 | action 96 right.

### p6UBkQ · Grab, already owned

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Title states exactly what will be grabbed; nothing shown after Grab |
| 2 | Match system / real world | 3 | "Replace tracked version" and "Second version" match CONTEXT.md |
| 3 | User control and freedom | 3 | Close (Esc) in the header and Cancel (Esc) in the footer do the same thing |
| 4 | Consistency and standards | 2 | Phone's Replace button grabs in one tap; desktop needs pick then Grab. Replace detail wording differs from phone |
| 5 | Error prevention | 2 | Replace is preselected, so a stray Enter replaces; nothing says the result is labelled "manual download" and will not be upgraded over |
| 6 | Recognition rather than recall | 3 | The owned file is restated in the question |
| 7 | Flexibility and efficiency | 4 | 1, 2, Enter, Esc |
| 8 | Aesthetic and minimalist design | 2 | Hint "1 or 2 picks · Enter grabs" repeats the key hints already on the cards and button |
| 9 | Error recovery | 2 | No undo or "remove from rTorrent" after a mistaken grab |
| 10 | Help and documentation | 3 | Each choice has a one-line consequence |
| | **Total** | **27/40** | Acceptable |

Top problems
- Two equal exits: Close at 13/600 #58616C top right and Cancel 32px outline in the footer. Keep Cancel only.
- The choice cards (84px tall, padding 0/14, radius 0) carry a key hint, a 14/600 title and a 12/400 detail; the chosen one is #D6E5DB with a 1px #215D47 border, the same green as the Grab button below it. Chosen card and action button merge into one green mass.
- Replace detail says "Sonarr swaps the file; the old torrent keeps seeding". Good, and it is what should also appear on phone (see LN7tO).
- The panel title is the only 20/700 text on the screen and is longer than the table above it is wide at 1376px; it reads as a page heading rather than a confirmation.

Proposals
- Make the two choices the two buttons. "Grab as replacement" (filled #215D47, key 1) and "Grab as second version" (outline, key 2), each 36px tall, radius 8px. Enter triggers whichever has focus. One step fewer, same as the phone, and the cards' consequence lines sit under each button in 12px ink-2.
- Add the missing consequence to the Replace option: "Labelled manual download. Sonarr will not upgrade over it."
- Show the release's hit and run rule in the panel ("PrivateHD · seed 72h or ratio 0.9"); it is the one fact the owner weighs here that the panel drops.
- Title at 17/600 ("Grab 2160p WEB-DL · FLUX · 8.9 GB from PrivateHD"), with the tracker logo.

### AHRck · Pick a release, inline under movie header

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Results age, "5 releases beat yours", downloading badge |
| 2 | Match system / real world | 3 | "cooldown 3h left" clear; "+1850" unexplained |
| 3 | User control and freedom | 3 | Filter, refresh; no close for the results block |
| 4 | Consistency and standards | 2 | Red BLU tracker chip; blank hit and run cells; results line order differs from ND0L4 |
| 5 | Error prevention | 3 | Rejections stated ("over 60 GB max", "score -10000", "720p not wanted") |
| 6 | Recognition rather than recall | 3 | "better" marks and a "yours" row present |
| 7 | Flexibility and efficiency | 4 | Same keys |
| 8 | Aesthetic and minimalist design | 3 | Clean table; header card and table card share no radius or spacing logic |
| 9 | Error recovery | 3 | Cooldown says when it ends |
| 10 | Help and documentation | 2 | "Your file" strip explains cutoff, but it is below the fold |
| | **Total** | **29/40** | Good |

Top problems
- "Your file" strip (28px rows, Barlow 12 #58616C labels) sits under ten releases at y 829, cut by the downloads bar. It holds the reference every row is compared against.
- "better" (12/700 #58616C) and "yours" (12/700 #58616C) look identical except for the word.
- The 2160p REMUX row is dimmed for "over 60 GB max" yet still shows 214 seeders in bold; dimmed rows should drop the bold.

Proposals
- Move "Your file" to a pinned line directly under the column header, in the same columns as the release rows (quality chip, name, size, tracker), on #F5F5F5 with "yours" in the comparison column. The owner compares straight down. Keep the "yours" row in the sorted list too, so its rank is visible.
- Comparison column marks: "best" violet #6D28D9 on #EDE9FE pill (radius 999, 11/600, 18px tall); "better" ink #171B20 with a small up-arrow icon; "same" and "worse" ink-2 #58616C; "yours" ink outline pill. Pill only on best, so best still wins.
- Header block and results block: same 24px inner padding and 10px radius, 16px apart.

### YQrvQ · Phone / Pick a release

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Results age, Search again |
| 2 | Match system / real world | 2 | YTS is not one of the owner's trackers; "rejected: below cutoff" is the wrong reason |
| 3 | User control and freedom | 3 | Close, filter |
| 4 | Consistency and standards | 2 | Sort differs from desktop; comparison wording differs |
| 5 | Error prevention | 3 | Rejected rows dimmed |
| 6 | Recognition rather than recall | 3 | "You own 1080p WEB-DL · Below cutoff" under the title |
| 7 | Flexibility and efficiency | 2 | No way to grab without opening the sheet; no hit and run rule beyond "72h seed" |
| 8 | Aesthetic and minimalist design | 3 | Calm two-line rows |
| 9 | Error recovery | 2 | Nothing for a release that fails |
| 10 | Help and documentation | 2 | No score or profile detail |
| | **Total** | **25/40** | Acceptable |

Top problems
- YTS row and wrong rejection reason (finding 5).
- Rejected REMUX first (finding 6).
- Sheet (Sheet/Content/phone) is full height with radius 0, so it reads as a page, not a sheet; the 36x4 #9AA1AB handle promises a drag the shape does not support.
- "better than yours" repeats on five of seven rows at 12/400 ink-2; with five identical labels it carries no signal.

Proposals
- Sheet top corners 16px, 8px of #F5F5F5 page showing above it.
- Row: line 1 quality chip, source and group (15/600), size and seeders right; line 2 tracker logo plus "PrivateHD · 72h or ratio 0.9" (12 ink-2), comparison mark right aligned. Use the same marks as desktop: "best" pill, "better", "same", "yours".
- Rows 60px with 16px side padding (current 58px, padding 0/16).

### LN7tO · Phone / Grab sheet

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Nothing shown after tapping Replace or Keep |
| 2 | Match system / real world | 3 | Facts table is plain |
| 3 | User control and freedom | 3 | Two Close controls visible at once (sheet behind and sheet in front) |
| 4 | Consistency and standards | 2 | Replace wording differs from desktop; sheet radius 0 |
| 5 | Error prevention | 2 | "Deletes the 1080p file once this finishes" sounds like the torrent goes too; one tap replaces |
| 6 | Recognition rather than recall | 3 | "Compared with yours: better than your 1080p WEB-DL" |
| 7 | Flexibility and efficiency | 2 | Fine for a phone, no faster route |
| 8 | Aesthetic and minimalist design | 3 | Clear stack |
| 9 | Error recovery | 2 | No undo |
| 10 | Help and documentation | 3 | Consequence line under Replace |
| | **Total** | **25/40** | Acceptable |

Top problems
- Replace button consequence (Barlow 11/400 white on #215D47) says "Deletes the 1080p file". Desktop says "the old torrent keeps seeding". Under the "never risk a hit and run" principle the phone must say the same: "Swaps the library file. The 1080p torrent keeps seeding."
- Sheet separation relies on a 1px #D1D5DB line over a 60% light-grey scrim; front and back sheets are both white, radius 0, no shadow. The two layers blur together, and both show a Close.
- Keep as second version (48px, outline) has no consequence line while Replace has one; the owner gets the facts for one option only.
- Tracker shows "PHD · 72h seed"; the full rule (72h or ratio 0.9) is on desktop but not here.

Proposals
- Scrim #171B20 at 32% instead of light grey, front sheet radius 16px top, shadow 0 -8px 24px rgba(23,27,32,.12). Hide the back sheet's Close while the front sheet is open.
- Buttons 48px, radius 12px. Both carry a consequence line: Keep as second version gets "Keeps both. media-manager-2 tracks the new one."
- Facts rows: tracker as logo plus "PrivateHD · seed 72h or ratio 0.9".

### E9gJVQ · Row/release component (Un25k) states

Row: 34px, padding 0/12, gap 12, 1px bottom #D1D5DB. States on the sheet: default, best, best hover, hover, selected, focus, dimmed, tracker cooldown, owned.

- Every hidden variant child ships inside every row (Marker, TrackerChip with "BHD", Tracker cooldown chip, Owned label, D key). Instances in ND0L4 carry a TrackerChip labelled "BHD" even on PHD rows, disabled. Harmless when hidden, but one wrong `enabled` flips a PHD row to a red BHD chip. Use separate states or one tracker slot.
- The Marker (2px #6D28D9) appears in every row's data but is enabled only on best. Keep.
- The Grab button inside the row has radius 0 and height 26px; panel buttons are 32px; phone buttons 48px. Three button heights, all square.
- Focus state: 2px accent stroke inside the row. Keep, but use ink #171B20 for focus so green stays an action colour.

## Systemwide proposals

Spacing scale: 4, 8, 12, 16, 24, 32. Today the flow uses 4, 5, 6, 8, 10, 12, 14, 16 and 20. Table rows and the results line both use 16px side padding (now 12 on rows, 20 on the ND0L4 results line, 12 on the AHRck results line). Panels 24px inside, 16px between blocks.

Corner radii: key hints and chips 4px; row buttons, inputs and the quality filter 6px; dialog buttons 8px; cards and the inline panel 10px; phone sheets 16px top; phone buttons 12px. Table rows stay square; the card around them carries the radius.

Buttons: Grab in a row 28px tall, padding 0/10, radius 6, Barlow 13/600, white on #215D47, with the G key hint at 60% white. Hover #194A38 (accent-hover). Dialog primary 36px. Secondary buttons white with #D1D5DB border; ghost buttons ink-2 text only.

Type: keep Barlow and Barlow Semi Condensed. Four sizes in this flow: 11 (column labels, chips), 13 (data), 15 (phone row titles, dialog option titles), 20 (dialog title, phone sheet title at 17 is fine to fold into 20 or 15). In release rows set the dotted release name in ink-2 #58616C and the group name in ink 600, so the eye lands on resolution chip, group, comparison, size. Size and seeders with tabular figures, right aligned.

Colour roles:
- Green #215D47: the action you take. Nothing else.
- Violet #6D28D9 / #EDE9FE: best release only (pill plus 2px left bar; drop the full-row tint or keep it at #F5F3FF, lighter than now).
- Red #B42318: problems, always with words (cooldown, rejected for a risk reason).
- Neutral ink for selection and focus.
- Tracker identity from the real logos, not colour.

Density: 34 to 36px desktop rows are right for this owner. Gain room by moving Fit next to the comparison, cutting Source into the quality chip ("2160p WEB-DL") and giving the freed 70px to the release name, which truncates today on the movie screen.

## Delight

1. **Grab confirmation in place.** On Grab, the button shows the existing Spinner for the round trip, then the row turns into its own live status: the Grab cell becomes "Grabbed" (the grab goes through Sonarr or Radarr, or straight to rTorrent for a second version), and within seconds a thin #215D47 progress line grows along the row's bottom edge from rTorrent's real progress, while the episode row above switches to "downloading 0%". No toast needed; the result appears where the owner was looking. On phone the sheet closes and the same progress line runs along the bottom of the chosen release row.
2. **The best release arrives last on refresh.** When "Refresh" finishes, rows settle and then the "best" pill fades in with a 150ms scale from 0.9, so the owner's eye is pulled to the answer once the list is stable. Respect reduced motion: no scale, instant.

## Questions to consider

- Does Source need its own column when the quality chip could read "2160p WEB-DL"?
- Should 1 and 2 grab immediately on desktop, as the phone buttons do?
- Is the full-row violet tint needed once "best" has its own column and pill?
