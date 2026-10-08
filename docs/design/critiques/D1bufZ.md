# Critique: Desktop / Blocklist (frame D1bufZ)

Method: Assessment A only (design review), single agent, from the 1440x900 screenshot plus PRODUCT.md, CONTEXT.md, the direction contract and the owner's screen decisions. No detector run (not part of this brief).

## Design specificity verdict

Mostly specific to this product. The "why blocked" column is the strongest part: a bold reason word ("stalled", "unregistered", "bad release", "marked failed") followed by a plain explanation ("no progress for 6h, 0 seeders", "sample file only, no movie", "by you from the episode's history"). Sonarr shows a raw message string here; this is better and only makes sense for this product.

Less specific: the page carries no colour at all, although the direction contract gives red a fixed meaning (risk) and a dead tracker torrent or 0 seeders is exactly that. The screen reads as a generic grey admin table. The live downloads dock and the top bar make it look like every other screen, so the blocklist has no shape of its own beyond the table.

## Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Count and timestamps clear. Nothing says whether unblocking also starts a search or waits for the next one. |
| 2 | Match system / real world | 3 | Reasons in plain words. Tracker codes BHD, PHD, BLU are fine for this owner. "FROM Sonarr" is the app's view, not the owner's. |
| 3 | User control and freedom | 2 | Only one action, one row at a time. No bulk unblock, no way to clear old entries, no visible undo. |
| 4 | Consistency and standards | 3 | Matches History's row and filter pattern. The key number boxes inside the filter chips sit next to counts and clash with them. |
| 5 | Error prevention | 2 | U unblocks instantly. That lets Sonarr regrab a release already known to be a sample file or the wrong episode. Consequence only stated once in the header. |
| 6 | Recognition rather than recall | 3 | Key hints shown. Unblock appears only on the selected row, so a mouse user has to find it. |
| 7 | Flexibility and efficiency | 3 | Keys for move, filter, unblock, open. No title search or sort control, which will hurt once the list holds hundreds of entries. |
| 8 | Aesthetic and minimalist design | 2 | Seven separate bands of chrome for a 14-row list; full release names take 40% of the width in low-contrast grey; downloads dock unrelated to the task. |
| 9 | Error recovery | 3 | The screen is itself a recovery tool and explains each reason well. Enter opens the episode to fix it. |
| 10 | Help and documentation | 3 | The one-line explanation under the title is exactly right. |
| **Total** | | **27/40** | **Acceptable** |

## Cognitive load

Failures:
- Single focus: fails. The downloading dock (3 rows, progress bars, speeds, seeders) is the most visually active block on the page and has nothing to do with blocked releases.
- Visual hierarchy: partial fail. Title column and reason word are bright; but the release name column is the widest thing on the screen and pulls the eye across a sea of dotted text.
- Chunking / grouping: fails. Releases you blocked yourself ("marked failed by you") and ones the app blocked automatically (stalled, unregistered) are mixed in one date-sorted list. The owner's real question, "did I do this or did the app?", has to be read row by row.
- Progressive disclosure: fails. Full release name, tracker and source are shown for every row up front, though they only matter when deciding to unblock one row.

Decision points with more than 4 visible options:
- Top bar: search box plus 6 nav links plus speed readout, about 8 targets.
- Key hint bar: 5 hints (move, unblock, filter, open, back). Move, back and open are standard and do not need advertising.
- Table row: 6 columns of facts competing before the one action (Unblock).

## Strengths

1. Reasons written as a bold word plus a plain cause. "wrong episode inside (S04E03)" tells the owner exactly what went wrong without opening anything.
2. The header sentence states the consequence of unblocking in one line: Sonarr and Radarr will grab it again on the next search.
3. Title column in bold white, first, gives a fast scan for "is my show in here?".

## Priority issues

**[P1] Live downloads dock repeated on a screen that has nothing to do with downloads**
- What: 3-row downloading dock at the bottom, about 130px of a 900px screen, with progress bars as the brightest marks on the page.
- Why: The owner arrives here after something went wrong and wants to read reasons. The moving bars pull the eye away; the speeds are already in the top bar.
- Fix: Drop the dock on History and Blocklist. Keep the top bar speed readout and the "Downloads 3" count as the only download signal. If the owner wants it everywhere, collapse it to one line ("3 downloading, 41.6 MB/s") that expands on click.
- Command: /impeccable distill

**[P1] Release name column dominates the table**
- What: Full dotted release names in grey take roughly 520px, the widest column, on every row.
- Why: It is the least read column until the owner decides to unblock one row, and grey 11px text on near-black is hard to read (Sam). It also pushes "why blocked", the column that answers the screen's question, to the right.
- Fix: Move "why blocked" next to the title. Shorten the release to its quality and group ("2160p ATVP WEB-DL, FLUX") and show the full name when the row is selected or expanded with Enter, as History already does. Merge TRACKER into that short line. Drop the FROM column: the title format (S02E06 vs a year) and the filter chips already say Sonarr or Radarr.
- Command: /impeccable distill, then /impeccable layout

**[P2] Unblock is one key with no guard, and only appears on the selected row**
- What: U unblocks immediately; the button shows only on the highlighted row.
- Why: Unblocking "Oppenheimer, sample file only" means Radarr will grab the same broken file again. Mouse users cannot see the action exists until they click a row. Sam (keyboard and screen reader) needs the action to be named per row.
- Fix: Keep U, but show a short undo line after it ("Unblocked Dune 2021. Undo") rather than a modal. Show the Unblock button faintly on every row and full strength on the selected one. For "bad release" rows, add a note in the undo line that the file was broken.
- Command: /impeccable harden

**[P2] Key hints add a second layer of numbers to the filter chips and a 5-item hint bar**
- What: "Sonarr 9 [2]" and "Radarr 5 [3]": a count and a shortcut number side by side. Plus the bottom hint bar repeats arrows, Enter and Esc.
- Why: "9 2" reads as one value at a glance. Arrows, Enter and Esc are standard keys that power users already know; listing them is noise on every screen.
- Fix: Remove the boxed numbers from the chips; list "1 2 3 filter" once in the hint bar. Cut the hint bar to the two keys specific to this page: U unblock and 1 2 3 filter. Better still, hide all hints behind "?" as a global help sheet.
- Command: /impeccable quieter

**[P2] No colour and no grouping by who blocked it**
- What: Every reason is the same white bold word. Manual blocks and automatic blocks are interleaved by date.
- Why: The contract reserves red for risk. "unregistered" (tracker deleted the torrent) and "0 seeders" are risks; "marked failed by you" is a choice. The owner cannot tell at a glance which rows the app decided on its own, which are the ones most likely to need an unblock.
- Fix: Add a filter or a subtle split: "Blocked by you" and "Blocked automatically". Colour only the reason word red where the contract's risk meaning holds (unregistered, 0 seeders); leave the rest white.
- Command: /impeccable clarify

## Persona red flags

**Alex (power user):** No bulk select to unblock several rows or clear entries older than a month; Sonarr has both. No title search; at 300 entries arrow keys from the top are slow. "newest first" looks like a label, not a control, so sort is unclear.

**Sam (accessibility):** Release names, reason details and key hints in small grey text on #0E0F12; likely under 4.5:1 for the hint text. The Unblock action exists visually only on the selected row. Filter chips carry two numbers with no label for either.

**The owner on a normal evening:** Lands here after a show failed to download. Has to read past the top bar, breadcrumb, title, sentence, chips, column headers, then scan across a long release name to reach the reason. Meanwhile the downloading dock animates below. The answer ("Severance S02E06: you marked it failed") is there, but it sits in column 5 of 6.

## Minor observations

- "WHEN" column mixes "Today 09:02", "Yesterday 22:40" and "4 Oct 14:20"; fine, but the jump from relative to absolute dates lands on different rows depending on locale.
- "newest first" in the far right of the chip row is far from the table it controls.
- Breadcrumb "History > Blocklist" plus "Esc back to History" plus "History" active in the nav: three ways of saying the same location.
- The selected row's outline and the Unblock button box are both thin 1px lines; the selected row barely differs from the zebra striping.
- No empty state shown; with 0 blocked releases the page should say so and keep the header sentence.

## Questions

1. Does the owner ever need the full release name on this page before choosing to unblock, or would quality and group plus Enter to expand be enough?
2. Should the downloads dock be a per-screen choice (overview and live downloads only) rather than global chrome?
3. Is unblocking a manual "marked failed" ever wanted, or is the list really about the automatic blocks the app made on its own?
