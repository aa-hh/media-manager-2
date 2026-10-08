# Critique: Desktop / Pick a release: override before grab (GTb4E)

Assessment A only (design review), single context, from the 1440x900 screenshot plus PRODUCT.md, CONTEXT.md, the direction contract and the owner's screen decisions. No detector run (not part of this brief).

## Design specificity verdict

Specific to this product. The release table is recognisably the tracker table a private-tracker user knows, and the extra columns (hit and run rule, tracker cooldown, release history, "maps to E07" scene numbering, freeleech flags) could not be lifted into any other product. The comparison colours (purple best, green better than yours, yellow not better, red risk) are the one strong idea and they work.

What drags it toward generic is the density itself: the screen reads as "every field Sonarr has, plus ours". The timing-tower idea in the direction contract is a board you read at a glance; this frame needs reading, not glancing, because three expanded panels, a legend, a key-hint list and a downloads dock all compete with the table.

## Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Results age ("14 min ago") and live speeds are clear. Download progress shows in three places (top bar "Downloads 3", E07 tile "64%", bottom dock). |
| 2 | Match with the real world | 3 | Owner's vocabulary throughout. "72h or 0.9" and "31h of 120h" are terse: hours or ratio is not labelled. "+1600" with no unit. |
| 3 | User control and freedom | 3 | Close/Esc on the override panel, cancel on the not-matched prompt, refresh on R. |
| 4 | Consistency and standards | 2 | Two inline panels use two patterns: the override panel has real buttons, the not-matched prompt has keycap text only. G is shown on both "GRAB G" and "Grab as ... G"; Esc on both "Close" and "cancel". "GRAB" uppercase on one row, "Grab" elsewhere. |
| 5 | Error prevention | 3 | Not-matched confirm, scene numbering warning, cooldown row disabled. Gap: the owned episode (1080p) offers no replace or second version choice in the override panel. |
| 6 | Recognition rather than recall | 3 | Legend and keys always visible, which helps recall at the cost of clutter. "0" as the override key has no meaning on its own. |
| 7 | Flexibility and efficiency | 3 | Every action has a key. Conflicting key hints between simultaneously open panels cost a point. |
| 8 | Aesthetic and minimalist design | 1 | Cluttered. Roughly 12 regions compete: top bar, results tower, rail key hints, title header, legend, season tabs, Season packs, 10 episode tiles, quality filters, refresh note, 11-column table with three expanded rows, downloads dock. |
| 9 | Error recovery | 3 | Warnings name the fix inline ("count it as S02E08", "set what it counts as first"). Grab errors are hover-only by the owner's choice; not shown here. |
| 10 | Help and documentation | 2 | The rail key list and legend are the only help. No explanation of the hit and run strings or the score numbers, even on focus. |
| **Total** | | **26/40** | **Acceptable** |

## Cognitive load

Failures (6 of 8, high load):
- Single focus: the frame's job is the override panel on row 2, but the scene mismatch row and the not-matched prompt at the bottom are open at the same time and both have red warning icons that pull the eye harder than the override panel.
- Chunking: 11 data columns plus a Grab column; 10 episode tiles in one strip.
- Visual hierarchy: two white primary buttons ("GRAB G" on the row and "Grab as S02E08 · 2160p WEB-DL G" in the panel) plus a white selected episode tile and a white selected season tab and filter chip. White means "selected" and "primary action" at once.
- One thing at a time: three inline states open simultaneously.
- Minimal choices: navigation above the table alone offers 3 season tabs + Season packs + 10 episode tiles + 4 quality filters + refresh = 19 targets before a release row.
- Progressive disclosure: the legend, the full rail key list and every per-field keycap (E, Q, L) are always on.

Passes: grouping (the override panel sits directly under its row), working memory (the panel restates the release and the current values).

Decision points with more than 4 visible options: episode strip (10), the release table (8 Grab buttons), the season/filter band (8 chips), the override panel (3 dropdowns + grab + close, with keycaps for each = 5 actions).

## Strengths

1. The override panel opens inline under its own row, says what the release "counts as" in plain words, and the primary button repeats the final result ("Grab as S02E08 · 2160p WEB-DL"). The owner can check the outcome before pressing.
2. Warnings carry their own fix: the scene numbering row explains Sonarr will import it as S02E07 and offers "count it as S02E08" on the spot. That is exactly the "fix it, then tell" principle.
3. Row states replace the Grab button with a word: "OWNED" for the version you have, a dash for the cooldown row. Status is visible without hover, as the direction contract asks.

## Priority issues

**[P1] Three inline panels open at once, with clashing keys.**
- What: override panel (row 2), scene numbering warning (row 4) and the not-matched prompt (720p row) are all expanded. G, Esc and Enter each appear on two of them.
- Why: the owner cannot tell which panel the keyboard is talking to. Pressing Esc or G becomes a guess on the one screen where a wrong key sends a torrent.
- Fix: only one row expanded at a time; opening one collapses the others. Keep the scene numbering note as a one-line inline row (it is information, not a prompt), but drop its red icon to the row's Profile cell ("maps to E07" already says it) and show the full sentence only when that row is focused. Show the not-matched prompt only after the owner presses Grab on that row. Redraw this frame with just the override panel open.
- Command: /impeccable distill

**[P1] Override panel skips replace or second version for an episode the owner already has.**
- What: the header says "YOU OWN S02E08 1080p", but the panel's only choices are episode, quality and language, then "Grab as".
- Why: PRODUCT.md capability 2 says grabbing something already in the library always asks replace or second version. Here it is unclear which happens, and a wrong guess replaces a seeding file or silently adds a second copy.
- Fix: add a fourth control to the panel, a two-option switch "Replace your 1080p / Keep as second version", defaulting to replace, and put the choice into the button label ("Grab as S02E08 · 2160p WEB-DL, replace"). Drop the per-field keycaps (E, Q, L) to make room; Tab moves between fields.
- Command: /impeccable clarify

**[P1] Too much chrome above and below the table.**
- What: before the first release row the owner passes a 4-line header (title, metadata, YOU OWN, legend), season tabs, Season packs, a 10-tile episode strip, quality filters and the refresh note: about 300px of 900. The downloads dock takes another 110px, and its only relevant row (Severance S02E07) already shows on the E07 tile.
- Why: the table, the screen's one job, gets about half the viewport and only ~11 rows. The owner's "extremely cluttered" complaint lands mostly here.
- Fix: (a) collapse the 10-tile episode strip into one line "S02E08 of 10 · [ ] previous / next" while picking a release, and show the full strip only on the overview; (b) move the colour legend out of the header and show it once in the table header row as hover/focus text on the Quality column, or behind a "?" key; (c) collapse the downloads dock to one line ("3 downloading · 41.6 MB/s") on this screen, expandable with a key; the top bar already carries "Downloads 3".
- Command: /impeccable distill, then /impeccable layout

**[P2] Key hints are everywhere.**
- What: the rail's 6-line key list, "/" in search, "P" on Season packs, "R" in the refresh note, "G" on two buttons, "Esc" on Close, "E", "Q", "L" beside dropdowns, "Enter", "0", "Esc" on the not-matched prompt. About 14 keycaps on one screen.
- Why: they add a second layer of small boxed text to every area, so nothing reads as plain. A power user learns these once.
- Fix: show the keycap only on the focused row's primary action and on the open panel's primary button. Replace the rail key list with a single "? keys" hint; show the full list on "?". Remove keycaps from the dropdown fields.
- Command: /impeccable quieter

**[P2] Low-contrast release names and helper text.**
- What: the RELEASE column (the actual release name, the thing the owner checks for group and tags) is dim grey, smaller than SIZE and SEEDERS. The override panel's explanation ("read from the release name · change any field before grabbing; Sonarr imports it as shown here") is dimmer still. The cooldown row dims the whole row including seeders.
- Why: likely under 4.5:1 on the near-black ground; the release name is a primary comparison field, not secondary text.
- Fix: release name in the same white as the figures, group name (FLUX, NTb, HHWEB) in bold at the end; helper text to at least the metadata-line grey.
- Command: /impeccable typeset

## Persona red flags

**Alex (power user):** G is advertised on both the highlighted row and the override panel; which one fires? Esc closes the override panel or cancels the not-matched prompt? A power user presses fast and the ambiguity will bite. Overriding needs "0" then Tab through three fields; fine, but the keycaps E/Q/L suggest single-key jumps that collide with nothing documented.

**Sam (accessibility):** colour carries the comparison (purple/green/yellow/red quality cells); the legend helps sighted users only. The Quality cell needs a text or icon cue for "best" and "better than yours" (the Profile column's tick/warning/cross covers the profile, not the comparison). Release names and helper text likely fail 4.5:1 contrast. Three expanded regions without a clear focus owner will confuse a screen reader about which region is live.

**The owner on a normal evening (mostly monitors, digs in when something went wrong):** they arrive here because S02E08 came in at 1080p and they want 2160p. Their first five seconds land on a legend, an episode strip and three warnings, two of which are about other rows. The thing they came to do (grab a 2160p and decide whether to replace the 1080p) is not obviously the screen's job, and the replace question is missing.

## Minor observations

- The 720p not-matched row's Quality cell is yellow ("not better than yours"), but a release that does not match the episode is a risk; it belongs in red, or at least the cell should not read as a normal comparison.
- Cooldown row: "cooldown" gives no end time. "cooldown, ends 21:40" lets the owner decide whether to wait.
- History column is "–" on 6 of 9 rows; it could merge into the Profile column as a small tag ("failed 6 Oct") and free a column.
- AUDIO · HDR on the cooldown row shows "–" in the Grab slot with no reason; a word ("cooldown") matches the "OWNED" pattern.
- The results tower spends 340px on two results and a key list on this screen; collapsing it to the poster thumbs while picking a release gives the table its width back.
- Header title uses curly quotes ("Sweet Vitriol"); the override dropdown spells it "Sweet Vitriol" without quotes. Fine, but keep one form.

## Questions

1. If only one row could be expanded at a time, would you rather the scene numbering warning still show as a permanent one-line note, or only when that row is focused?
2. Should replace be the default for an owned episode in the override panel, or should the panel force a choice each time?
3. Would you accept the downloads dock collapsing to one line on pick-a-release screens, given the top bar already says "Downloads 3"?
