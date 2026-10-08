# Critique: Desktop / Manual import (frame TrXNw)

Assessment A only (design review), from the 1440x900 screenshot. Read-only.

## Design specificity verdict

Specific to this product. The "Why Sonarr stopped" band, "media-manager-2 retried twice, then flagged it", the inline episode picker that says "taken by file 9" and "no file yet", and the hardlink line that names BeyondHD's hit and run rule (5 days, seeded 2h) could not be lifted into another app. This is the strongest copy in the prototype so far.

Where it loses specificity: the direction contract says solid colour cells carry meaning (red for risk, yellow for not better). This screen has one problem row and it uses no colour at all. It looks like a generic dark data table, and the one thing that needs attention is marked only by a thin outline and bold text in row 10 of 11.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Clear reason for the stop and the retry history. The unresolved row is not visually loud enough to find first. |
| 2 | Match with the real world | 3 | Plain sentence about why Sonarr stopped. Sonarr's raw message is shown underneath, which suits the owner. |
| 3 | User control and freedom | 3 | Per-file checkbox, Esc cancels the picker, edited rows marked "set by you". No visible way to undo a whole edit back to Sonarr's guess. |
| 4 | Consistency and standards | 2 | Row 9 says "edited" in the episode cell and "set by you" in the status cell: two words for one fact. Downloads appear twice (nav "Downloads 3" and the dock). |
| 5 | Error prevention | 2 | "Import 10 files" looks fully enabled while the summary beside it says 1 file still needs an episode. Unclear whether it blocks, skips, or imports the file unassigned. |
| 6 | Recognition over recall | 3 | Key hints are visible. Too many of them, see issue 3. |
| 7 | Flexibility and efficiency | 4 | Every field has a key, picker accepts typing, Space toggles a file. Strong for the owner. |
| 8 | Aesthetic and minimalist design | 1 | Eight identical "ready" rows, three columns with the same value in every row, a full release-name filename per row, a key hint strip, and an unrelated downloads dock all compete with one unresolved file. |
| 9 | Error recovery | 3 | Picker offers the two likely episodes and a search fallback. Good. |
| 10 | Help and documentation | 3 | Hardlink explanation is inline and concrete. |
| **Total** | | **27/40** | **Acceptable** |

## Cognitive load

Checklist failures:
- One primary job (give file 10 an episode, then import) but the eye lands first on a wall of 11 near-identical rows.
- Quality, languages and group columns repeat "2160p WEB-DL", "English, Japanese", "FLUX" on every row. Seven columns, three of which carry zero information on this pack.
- Long filenames (about 90 characters each) are the widest, brightest-weighted text on the page, yet the owner reads the "Show and episode" column, not the filename, for 8 of the 10 rows.
- Status column says "ready" 8 times.
- Repeated chrome unrelated to the task: top bar transfer speeds, nav count "Downloads 3", and a three-row live downloads dock with bright progress bars at the bottom, which are the highest-contrast moving elements on screen.

Decision points with more than 4 visible options:
- Key hint strip: 7 hints (move, include or skip, pick show or movie, pick episode, set quality, set languages, set group), plus E on the row, Esc in the picker, I on the import button. 10 key labels on one screen.
- Each row is implicitly editable in 5 fields (show, episode, quality, languages, group). Fine for the owner, but all 5 are shown as hints at once even though only "pick episode" is needed here.

## Emotional journey

The opening is reassuring: "Sonarr could not tell which episode 2 of the 10 files are, so it imported none of them" tells the owner nothing is lost. The end is weak: the final action sits next to a sentence saying the work is not done, with no visible state for whether the button will work.

## Strengths

1. The "Why Sonarr stopped" band. One plain sentence, Sonarr's raw message underneath, and a right-aligned note on what media-manager-2 already tried. This is "fix it, then tell" done right.
2. The inline episode picker under the problem row. Two candidates, numbered keys, "taken by file 9" prevents a duplicate, typing searches further, Esc cancels. No modal.
3. Import mode line ties hardlinking to the tracker's hit and run rule with real numbers (5 days, seeded 2h). This is the product's core promise made visible at the point of risk.

## Priority issues

**[P1] The one file that needs attention is buried.**
- What: the unresolved file is row 10 of 11, marked by a 1px outline and bold "needs an episode". Rows 1 to 8 are identical and need nothing.
- Why: the owner on a normal evening opens this from the Flagged page to fix one thing. They have to scan the whole table to find it.
- Fix: put files that need input at the top, lit with the contract's attention colour (yellow cell on the status, or red if it blocks import). Collapse the 8 matched files into one line: "8 files matched to S01E01 to S01E08, 2160p WEB-DL FLUX, English and Japanese. Show". Expand on Enter. Row 9 (set by you) stays visible above the collapsed group, since it was a change.
- Command: /impeccable distill

**[P1] Import button state contradicts the summary beside it.**
- What: "Import 10 files" is a solid white button; the text to its left says "1 still needs an episode".
- Why: the owner cannot tell if pressing I imports 9 and leaves one, imports 10 with one wrong, or does nothing. This is the high-stakes moment (files move into the library).
- Fix: while any included file lacks an episode, show the button disabled with "Pick an episode for 1 file first", or relabel it "Import 9 files, skip 1". Choose one rule and state it on the button.
- Command: /impeccable harden

**[P1] Columns and text that say the same thing on every row.**
- What: quality, languages and group are identical across all 10 files; filenames repeat the whole release name; status repeats "ready".
- Why: this is most of the clutter the owner named. It turns a one-decision screen into a spreadsheet, which the direction contract rules out ("never a raw spreadsheet").
- Fix: when a value is the same for every file, show it once in the header line ("2160p WEB-DL, FLUX, English and Japanese, applies to all") and drop the column. Show a column only when a file differs. Truncate filenames to the part that differs from the release name (for example "S01E03.Tomorrow.Is.Tomorrow") with the full name on focus. Drop the "ready" text; an empty status means ready, and only exceptions get a word.
- Command: /impeccable distill

**[P2] Live downloads dock and top bar speeds compete with the task.**
- What: three bright progress bars and speeds at the bottom, plus upload and download speeds and "Downloads 3" in the top bar.
- Why: the progress bars are the highest-contrast, most changing marks on the page and have nothing to do with importing Shogun. The nav already says "Downloads 3".
- Fix: hide the dock on task screens like this one (manual import, pick a release) and keep the nav count. If the owner's decision to dock it everywhere stands, collapse it to one line ("3 downloading, 41.6 MB/s") that expands on a key.
- Command: /impeccable quieter

**[P2] Key hint strip lists every edit, not the one that matters.**
- What: 7 hints in a permanent strip, plus key labels on the row, picker and button.
- Why: the owner already sees "PICK EPISODE [E]" on the problem row. The strip adds six options that are not needed to finish this import.
- Fix: show only the hints for the focused row's current need (E pick episode, Space skip file, I import). Put the full list behind "?" .
- Command: /impeccable quieter

## Persona red flags

**Alex (power user):** Keys are excellent. Red flag: after picking the episode, it is unclear whether focus moves to the next unresolved file or the Import button; with only one unresolved file Alex wants Enter to confirm and I to import, and the import result is not shown. Also no bulk "set group" or "set languages" for all selected files is visible, though Space plus a key implies it.

**Sam (accessibility):** The faint grey text (header metadata line, key hint labels, skipped sample row, "taken by file 9", "type to search other episodes") looks well below 4.5:1 on the near-black ground. The problem row is distinguished only by weight and a thin outline, no shape or icon; a screen reader user hears 11 rows before reaching it unless focus starts on it. Checkboxes need visible labels or row-level names ("Include S01E03").

**The owner on a normal evening:** Arrives from Flagged wanting to fix one thing in under a minute. They read the excellent "Why Sonarr stopped" sentence, then face 11 rows of near-identical filenames, a key strip, and moving download bars. They will find it, but the screen makes a 10-second fix feel like a 2-minute review. They then hesitate at "Import 10 files" next to "1 still needs an episode".

## Minor observations

- "Sonarr could not tell which episode 2 of the 10 files are" while the summary says "1 still needs an episode". Correct (one was fixed), but add "1 fixed by you" to the band so the counts agree at a glance.
- Row 9 "edited" and status "set by you": keep one, prefer "set by you".
- The sample file row is noise; show "1 sample file skipped" as a single line under the table.
- The release name in the header line is long and faint; the size, tracker and "finished 2h ago" are the useful parts and could lead.
- The 2160p cell is a white solid cell on every row. Per the contract, solid cells carry comparisons; a cell identical on every row compares nothing.
- The episode picker's selected option (S01E10, white box) is the right default, but it is not labelled as the suggestion. Add "suggested" or press Enter to accept.
- The dock is cut off at the bottom of the 900px viewport, so the page scrolls for no task reason.

## Questions

1. If only one file in a 10-file pack needs input, should the screen open straight to that file with the other nine collapsed, and import with one key once it is fixed?
2. Does the live downloads dock need to be on task screens at all, given "Downloads 3" is already in the nav?
3. Should media-manager-2 accept its own suggestion here (S01E10 is the only episode with no file) and flag it as "matched by media-manager-2, check", rather than stopping for the owner?
