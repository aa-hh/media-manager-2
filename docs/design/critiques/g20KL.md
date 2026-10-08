# Critique: Desktop / Calendar: month (frame g20KL)

Assessment A only (design review), from the 1440x900 screenshot plus PRODUCT.md, CONTEXT.md, the direction contract and the owner's calendar decision in docs/design/sonarr-radarr-review.md ("States as words, colour only where the colour rules give it a meaning. Several episodes of one show on one day collapse into one entry.").

## Design specificity verdict

Partly authored. The near-black ground, square cells, condensed type and a single red cell for the one real risk (Shrinking S03E02, "MISSING · 0 SEEDERS") follow the timing-tower direction, and the per-show collapsing ("Severance · 4 episodes") is specific to this product. The month grid itself is a stock calendar layout with no idea of its own: every cell, every row and every state word gets the same weight, so it reads as a spreadsheet of grey text rather than a board where colour marks the exceptions. The direction's promise ("readable at a glance") holds for the release table; on this screen it is lost under repeated status text.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Today chip, "airing now", live percentages in cells. Good. Downloads shown three times (top bar count, cells, dock). |
| 2 | Match with the real world | 2 | "digital release date" / "physical release date" uses "release" for a date, which CONTEXT.md and PRODUCT.md forbid ("Release always means a torrent"). "times in Europe/London" note, but month view shows no times at all. |
| 3 | User control and freedom | 3 | previous month, next month, today and view switch all present. |
| 4 | Consistency and standards | 2 | Platonic S02E09 "missing" is plain grey; Shrinking S03E02 missing is red. Outlined box used for both "unmonitored" (least important) and "airing now" (most live). |
| 5 | Error prevention | n/a | View-only screen with no inputs or actions. |
| 6 | Recognition rather than recall | 3 | States as words, key hints shown. No legend for the outlined box or the paler past-month cells. |
| 7 | Flexibility and efficiency | 3 | Keys for every control, three views. No way to show only problems or hide unmonitored shows. |
| 8 | Aesthetic and minimalist design | 1 | Roughly 75 status labels on one screen, about 40 of them "not aired yet" and 25 "downloaded 1080p/2160p". Nothing but one red cell stands out. |
| 9 | Error recovery | 2 | "missing" and "0 seeders" are stated but nothing says whether a search ran or links to the flagged page. |
| 10 | Help and documentation | 2 | Key hints only; no explanation of outlined rows or which states are shown. |
| **Total** | | **21/36** | **Acceptable (58%)** |

## Cognitive load

Failures (4 of 8, high):
- Single focus: the live downloads dock (3 rows, about 125px) competes with the grid and repeats three entries already shown in the cells (Severance 64%, The Bear 23%, Andor 91%) and the "Downloads 3" tab.
- Visual hierarchy: every row has the same two-part shape (title left, grey state right). The eye has no route from "today" to "anything wrong".
- Chunking: 35 cells with up to 4 entries, each entry carrying two strings. About 150 text items on screen.
- Progressive disclosure: file quality ("1080p", "2160p") on every downloaded past episode is detail the owner only needs when something is wrong.

Decision point over 4 options: the header row has 6 controls (previous month, next month, today, Week, Month, Forecast), each with its own key hint box, plus the top bar's 5 tabs and search. Six key hint boxes in one header line.

## What works

- Red appears exactly once, on the one episode at real risk. That is the colour rule working: the problem is findable in under two seconds.
- Several episodes of one show on one day collapse ("Severance · 3 episodes", "The Bear · 10 episodes · premiere"), as the owner decided. Without it the grid would be unusable.
- Today is marked by a chip and a lighter cell, and "airing now" is a live state, which fits the monitoring job.

## Priority issues

1. **[P1] Default states printed on every row.**
   Why: "not aired yet" on every future entry and "downloaded 1080p/2160p" on every past entry make about 65 labels that say what the date already says. They bury the four states that need attention (missing, downloading, airing now, 0 seeders) under identical grey text. This is the main source of the clutter the owner named.
   Fix: print a state only when it differs from the expected one for that date. Future and not aired: title only. Past and downloaded: title only (or a small dim tick). Keep words for missing, downloading N%, airing now, unmonitored, not out yet past its date. Move quality to the title's page or a hover. The grid drops to roughly 15 labels.
   Command: /impeccable distill

2. **[P1] Live downloads dock on the calendar.**
   Why: the same three downloads appear in the cells, in the dock and in the top bar count. The dock takes the space the last week row needs (26 Oct to 1 Nov is cramped) and splits attention on a screen whose job is "what is coming and is anything wrong".
   Fix: drop the dock on the calendar. The cells already show "downloading 64%"; the "Downloads 3" tab is one key away. If the owner wants the dock everywhere, collapse it to a one-line strip ("3 downloading · 41.6 MB/s") that expands on click.
   Command: /impeccable quieter

3. **[P2] Missing is shown two ways; outline box means two opposite things.**
   Why: Platonic S02E09 "missing" (5 Oct) looks like any other row while Shrinking S03E02 is red, so the owner can miss a real gap. Outlined boxes mark both unmonitored shows (Abbott Elementary, Tracker) and "Hacks S05E01 · premiere · airing now". A border pulls the eye, so the least important rows (unmonitored) are among the most visible.
   Fix: missing past its air date gets one treatment everywhere, a red text label without fill if not at hit and run risk, a solid red cell when it is. Unmonitored rows lose the box and drop to dim text, or are hidden behind a "show unmonitored" toggle. Keep the outline for "airing now" only.
   Command: /impeccable clarify

4. **[P2] "release date" wording and a time zone note with no times.**
   Why: "Weapons · digital release date", "Superman · physical release date", "Mickey 17 · digital release date" use "release" for a date, against the glossary rule. The header note "Sonarr and Radarr · view only · times in Europe/London" explains times the month view never shows and restates that the calendar is view-only, which the lack of buttons already says.
   Fix: write "Weapons · digital", "Superman · on disc" (or "in cinemas / digital / disc" if CONTEXT.md has words for these). Delete the header note on month view; keep the time zone note on week view where times appear.
   Command: /impeccable clarify

5. **[P3] Key hint boxes on every header control.**
   Why: six boxed letters ([<] [>] [T] [W] [O] [F]) sit next to their labels, doubling the header's visual weight. "O" for Month is not guessable.
   Fix: show key hints on hover or behind "?" for a key list; keep labels only. If the owner wants them visible, render them as plain dim text with no box. Use "M" for Month if free.
   Command: /impeccable quieter

## Persona red flags

**Alex (power user):** no filter for "problems only" or "hide unmonitored", so finding every missing episode means scanning all 35 cells. "O" for Month must be memorised. Otherwise keys cover every control.

**Sam (accessibility):** grey state text and dimmer unmonitored text on near-black at about 9 to 10px are likely under 4.5:1; check the unmonitored grey especially. "MISSING · 0 SEEDERS" is red but also worded, which passes; the outlined "airing now" relies on a border alone to differ from plain rows. Month grid needs a table or grid role with day names announced per cell; with 4 entries times 35 cells, a screen reader user needs a "next problem" jump.

**The owner on a normal evening:** opens the calendar to check that tonight's episodes will arrive. Today's cell is easy to find, and the red Shrinking cell catches the eye. The Platonic S02E09 gap from Monday does not: it reads exactly like the "downloaded" rows around it. The dock at the bottom repeats what he already saw. He has to read about 75 labels to confirm nothing else is wrong, which is the babysitting the product promises to remove.

## Minor observations

- Long entries wrap to two lines ("The Diplomat · 6 episodes · premiere", "The Running Man · digital release date") and the state label centres vertically against them, making ragged rows.
- "not aired yet" (TV) and "not out yet" (movies) both mean "future"; with issue 1 fixed, neither needs to show.
- Past-month and next-month cells (28 to 30 Sep, 1 Nov) use a slightly lighter fill than current-month cells, which is the reverse of the usual dimming and makes them look selected.
- Empty days (16, 23, 30) are fine; no empty-state text needed.
- "8 TODAY" chip uses a white fill, the same weight as the red cell; it could be quieter since the cell fill already marks today.

## Questions

1. If every row only showed a state when something is unusual, would the owner still want the month view, or would the forecast view (a few days) become the default?
2. Should unmonitored shows appear on the calendar at all, given the product only promises "upcoming monitored episodes and movies"?
3. Does the live downloads dock need to be on every screen, or only on pages where downloads are the job (downloads, a title's overview)?
