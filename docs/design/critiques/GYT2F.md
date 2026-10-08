# Critique: Desktop / Pick a release (movie detail), frame GYT2F

Method: Assessment A (design review) only, single agent, from the 1440x900 screenshot. No detector run (pen.dev file, not markup). Read-only.

## Design specificity verdict

Specific to this product. The release table with a tracker column, a hit and run column, an inline profile verdict ("over 60 GB max", "+1850") and cooldown cells could not be lifted into another product unchanged. The timing-tower idea shows in the solid quality cells and tabular figures.

The cost: the timing-tower idea is applied to every surface at once. Every row carries a saturated quality cell, every row carries a Grab button, and the screen also carries the search results list, a five-line key hint list, a colour legend and a three-row downloads dock. The specific parts are good; there are too many of them on one screen.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Result age ("14 min ago"), owned row, live speeds all visible. Downloading status shown three times (top bar tab, top bar speeds, dock). |
| 2 | Match system / real world | 3 | Uses Radarr's and the trackers' own words. "120h or 1.0" needs the reader to know it means seed time or ratio. |
| 3 | User control and freedom | 2 | No visible way back to the movie overview (no Esc hint, no "Overview" link). |
| 4 | Consistency and standards | 2 | Purple "best on the board" sits on the REMUX that the profile rejects ("over 60 GB max"). Quality cell shows a resolution label but its colour means a comparison, so 1080p reads green on one row and yellow on the next with no visible reason. |
| 5 | Error prevention | 3 | Cooldown rows dimmed with no Grab. But the purple row still offers Grab despite failing the profile, and one key (G) grabs with no visible confirm before the replace-or-second-version step. |
| 6 | Recognition rather than recall | 2 | Cell colours need the legend line to decode; the legend is small grey text above the table. |
| 7 | Flexibility and efficiency | 3 | Keys for grab, refresh, quality filter. No visible sort control or sort indicator. |
| 8 | Aesthetic and minimalist design | 1 | Ten columns, ten coloured cells, eight Grab buttons, legend, filter tabs, results list, key hints and an unrelated downloads dock all at once. |
| 9 | Error recovery | 2 | Cooldown shows no end time; grab errors are hover-only by decision. |
| 10 | Help and documentation | 2 | Legend and key hints exist but are always on, which makes them noise rather than help. |
| **Total** | | **23/40** | **Acceptable** |

## Cognitive load

Failures (5 of 8, high):
- Single focus: the search results list (left, 340px) and the downloads dock (bottom, Severance / The Bear / Andor) compete with the release table and have nothing to do with picking a Dune release.
- Visual hierarchy: every row has an equally loud colour cell, so the one recommended row does not stand out. The selected row's white "GRAB G" is the strongest mark on screen, not the best release.
- Minimal choices: eight Grab buttons visible at once; quality filter has four tabs; the legend lists five meanings.
- Working memory: colour meanings must be held from the legend while scanning ten rows.
- Progressive disclosure: hit and run text, audio and HDR, full release name and the legend are always shown even when they repeat ("120h or 1.0" on 6 of 10 rows).

Passes: chunking by quality tab, grouping of rows into one table, one decision at a time (replace or second version comes after Grab).

Decision points with more than 4 options: the release table (8 Grab buttons), the legend (5 colour meanings), the key hint list (5 keys).

## Emotional journey

The owner arrives here when automatic search did not do what they wanted. The screen should calm that: "here is the best one, here is why, press G". Instead the first glance meets a wall of green and yellow, and the purple "best" row is one the profile rejects, which creates doubt at the exact moment the owner wants certainty.

## Strengths

1. Profile verdict inline as words ("720p not wanted", "score -10000", "+1850"). This replaces Radarr's hover icons and is the most useful column on the screen.
2. Risk rows are handled well: dimmed text, red tracker cell, "cooldown" in place of the hit and run rule, and no Grab button. You can see at a glance which rows are off the table.
3. Cache age and refresh cost in plain words ("Results from 14 min ago · refresh R (fresh search ~20s)") matches the owner's decision exactly.

## Priority issues

**[P1] Colour on every row means nothing stands out.**
What: all ten quality cells are solid purple, green or yellow. Six greens in a column read as background.
Why: the direction contract says the best release should be "lit purple" and read at a glance. With every cell lit, the eye has no target.
Fix: show colour only where it changes the decision. Keep the purple cell on the best row and red on risk rows. Show "better than yours" as a small green mark or green text on the score, and leave "not better than yours" uncoloured (it is the default case). Quality label goes back to plain white text on graphite.
Command: /impeccable quieter

**[P1] "Best on the board" is a release the profile rejects.**
What: the purple 2160p REMUX row shows "x over 60 GB max" in the profile column, yet keeps the best-release colour and a Grab button. The row the owner probably wants (BluRay, +1850, 389 seeders) is only marked by the selection highlight.
Why: the one strong signal on the screen contradicts the profile column next to it. The owner has to resolve the conflict by reading.
Fix: define "best" as best among releases that pass the profile and carry no risk, so purple lands on the +1850 row. Rejected rows sort below passing rows with muted text, Grab still reachable by key for the owner's override.
Command: /impeccable clarify

**[P1] Chrome that does not serve this task takes a third of the screen.**
What: search results list (340px wide, full height), key hint list (5 lines), downloads dock (3 unrelated torrents, ~130px tall), plus Downloads count and speeds in the top bar. The ~170px gap between the table and the dock is empty.
Why: the owner's concern. Picking a release is the one screen where the table should own the space. Download status already sits in the top bar ("Downloads 3", 41.6 MB/s).
Fix: on Pick a release, collapse the search results list to a narrow strip or hide it until "/" is pressed. Drop the dock here; the top bar count is enough, and a grab can show its own progress row inside this table. Replace the always-on key hint list with a single "? keys" hint that opens the list.
Command: /impeccable distill

**[P2] Eight Grab buttons repeat the same action.**
What: an outlined Grab button sits on every eligible row, plus "GRAB G" on the selected row and "G grab selected release" in the key hints.
Why: eight equal buttons are eight equal choices, and they make the right edge of the table a column of boxes.
Fix: show Grab only on the selected or hovered row (the owner is keyboard-first, so the selected row is where the action is). Other rows keep the cell empty, or show "Owned" / "Cooldown" where those apply.
Command: /impeccable quieter

**[P2] The colour legend and repeated hit and run text are always on.**
What: a five-item legend line under the header, and "120h or 1.0" repeated on six rows.
Why: the legend is needed once, then becomes noise. The repeated rule hides the rows where the hit and run rule differs ("79h or 0.9", "72h or 0.9", "met · 212h").
Fix: move the legend behind "?" with the key list. In the hit and run column, show the tracker's rule once in the tracker cell's tooltip or a column header note, and print text only where it differs or matters (met, cooldown, longer than usual).
Command: /impeccable distill

## Persona red flags

**Alex (power user):** No sort indicator or sort control on any column; cannot sort by seeders or size. No visible key for "back to overview". Release name column is the narrowest-feeling text on screen at a small grey size, yet Alex reads the group and encode from it.

**Sam (accessibility):** "Better than yours" and "not better than yours" are carried by colour alone in the quality cell; no text or icon on the row says it. Dimmed rows (REMUX 1080p, 3.9 GB WEB-DL) and grey release names look well below 4.5:1 on the near-black ground. Key hints use grey on grey boxes at small size.

**The owner on a normal evening:** They opened this because an automatic search picked something wrong or nothing at all. Within seconds they need "which one should I grab". The screen answers with ten coloured rows and a purple row that the profile rejects. Severance, The Bear and Andor progress bars at the bottom pull attention to downloads that are fine. Nothing says why they are here (for example "Radarr has not grabbed an upgrade: best passing release is +1850, yours is +850").

## Minor observations

- "OWNED" on the owned row is bold white text with no cell; it is the only row status not in a box, which reads as a different control.
- "YOU OWN" white chip in the header and "OWNED 1080p" in the left list say the same thing in two styles.
- The selected row's highlight is a thin outline; with the colour cells this loud, the outline is easy to miss.
- Owner-decided columns are missing: freeleech and indexer flags, release history (grabbed before, failed, blocklisted). If added, they should replace a repeated column, not add width.
- Cooldown shows no end time; "cooldown 3h left" would let the owner wait instead of guessing.
- "Movies + TV" label next to "6 results" is filter state with no visible control.

## Questions

1. Does the search results list need to stay open while picking a release, or does "/" bringing it back cover the case?
2. Should "best on the board" ever land on a release Radarr's profile rejects, or does the owner want purple to mean "what I would grab"?
3. Would one Grab on the selected row, plus the key, lose anything the owner uses today?
