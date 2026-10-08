# Critique: Desktop / TV overview: range select (iAVnz)

Screenshot only; pen file not inspected. Assessment A only (no detector run).

## Design-specificity verdict
Specific, not generic. The season strip with per-season ON/OFF, the second-version sub-rows with "seeding · PHD 4h of 72h", and the live progress in episode 7 could only belong to this product. The problem is volume, not identity: this one frame shows about 22 key hints, 7 header buttons, 20 row icon buttons, and the same download shown in three places. The screen's job right now (change monitoring for episodes 3 to 6) is the quietest thing on it.

## Nielsen scores
| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Selection count, range and "2 monitored" are stated. But the selected rows are marked only by a thin left line; the rows themselves look unselected. |
| 2 | Match with real world | 2 | "PHD 4h of 72h", "below cutoff", "WEB-DL · FLUX" are fine for the owner, but "PHD 4h of 72h" reads as a code, not "seed 68 more hours on PHD". |
| 3 | User control and freedom | 3 | Esc clears, Shift arrows shrink. Good. |
| 4 | Consistency and standards | 2 | M means "Monitoring" in the header and "monitor" in the selection bar, both visible at once. A means "Search monitored" (whole show) and "search" (selection). ON/OFF pills look the same as the season tab ON/OFF toggles and as quality badges. |
| 5 | Error prevention | 2 | The range includes the two second-version sub-rows; it is unclear whether monitor/search touch them. Delete (D) sits in the same header row as routine actions. |
| 6 | Recognition over recall | 3 | Everything is labelled. Too much so (see 8). |
| 7 | Flexibility and efficiency | 3 | Strong keyboard path. No visible mouse path for range select (no checkboxes, no shift-click cue). |
| 8 | Aesthetic and minimalist design | 1 | Four separate key-hint areas, repeated "meets profile" text on 6 rows, 20 icon buttons, downloads dock, results column with 2 items taking 24% of the width. |
| 9 | Error recovery | n/a | No error state in this frame. |
| 10 | Help and documentation | 3 | Inline hints everywhere; they are the help. |

Total 22/36, renormalised 24/40. Band: acceptable (20 to 27).

## Cognitive load
Failures (5 of 8, high):
- Single focus: the selection bar competes with the header buttons, season strip, row icons, downloads dock and the sidebar key legend.
- Chunking: header row has 7 actions in one undivided line.
- Visual hierarchy: the active task (the selection bar) is a dark strip the same weight as a table row; the white "Search monitored" button is the loudest element and is unrelated to the task in progress.
- Minimal choices: header offers 7 actions; selection bar offers 4 actions plus 2 range keys; each row offers 2 icon buttons.
- Progressive disclosure: row icons, header actions and the sidebar legend all stay visible while a range is selected, when only the selection actions apply.

Decision points over 4 options: header actions (7), selection bar (6 key hints), sidebar key legend (5).

## Strengths
- The selection bar sits directly under the selected range and states the result in words ("episodes 3 to 6, 2 monitored"). That summary is exactly what the owner needs before pressing M or U.
- Second versions shown as indented sub-rows with seeding progress against the hit and run rule, without a click.
- Unaired episodes show "searches when it airs" and greyed actions, so the owner sees the automation is handling them.

## Priority issues

**P1. Key hints everywhere.**
What: hints in the search box (/), on all 7 header buttons, the season strip (Space), the selection bar (6), the previous/next show links, and a 5-line legend in the sidebar.
Why: about 22 hint chips on one screen. They read as noise, and they hide the 4 that matter right now.
Fix: while a range is selected, show hints only in the selection bar. Remove the sidebar legend (move it to a "?" overlay). Drop key letters from header buttons and show them on hover/focus or in the "?" overlay. Remove the "Space toggle monitored" line from the season strip.
Command: /impeccable distill

**P1. Selected rows are barely marked.**
What: rows 3 to 6 differ from rows 1, 2, 7 only by a 2px line on the left edge; zebra striping already varies row backgrounds.
Why: the owner cannot see the range at a glance; Sam cannot see it at all at low contrast; it fails "don't rely on one thin cue".
Fix: give selected rows a clear tinted background plus the left bar, and fold the selection bar into a sticky footer of that tinted block. Add a checkbox column that appears only once a selection exists, for mouse users.
Command: /impeccable clarify

**P1. Same key, two meanings, both on screen.**
What: M = "Monitoring" (header) and "monitor" (selection); A = "Search monitored" and "search".
Why: the owner cannot tell which one fires. A mistaken A starts a whole-show search instead of 4 episodes.
Fix: while a selection exists, hide or dim the header actions so only one meaning of each key is visible. Better: give selection actions the same letters but show them only in the selection bar, and grey the header out.
Command: /impeccable clarify

**P2. The same download shown three times, plus repeated chrome.**
What: "Downloads 3" in the top bar, "downloading 64% · 6m" in episode 7, and Severance S02E07 in the docked downloads list. The search results column keeps 2 results open at 340px wide after the show is chosen.
Why: three places to watch for one fact; the dock and results column take about 35% of the screen on a task about episodes.
Fix: keep the progress in the episode row and the count in the top bar. Collapse the dock to a one-line summary ("3 downloading · 41.6 MB/s") that expands on click. Collapse the results column to a narrow strip once a title is open; Esc or / brings it back.
Command: /impeccable distill

**P2. Status column repeats "meets profile".**
What: 6 of 10 rows say "meets profile"; every aired row carries a search and a list icon.
Why: repeated text and 20 icons drown the rows that need attention (episode 8 below cutoff, episode 7 downloading).
Fix: leave Status blank when the file meets the profile; show text only for exceptions. Show the two row icons on hover or focus only.
Command: /impeccable quieter

## Persona red flags
- Alex (power user): range select works by keyboard, but the shared letters M and A risk a wrong action. No shift-click range for when the hand is on the mouse.
- Sam (accessibility): selection is a thin line only. Grey text (air dates, "meets profile", sidebar legend, "previous show") looks under 4.5:1 on the dark ground. ON and OFF pills differ by fill only, no icon.
- The owner on a normal evening: opens Severance to check what is missing and sees 7 buttons, 22 key hints and a downloads table. The two rows that need them (8 below cutoff, 7 downloading) do not stand out from 8 rows of "meets profile".

## Minor observations
- Poster is an empty green block; fine for a prototype, but it is the largest shape in the header.
- "previous show" / "next show" key chips have no visible letter.
- Season 3 "not aired 0 GB ON": the 0 GB adds nothing.
- Header meta line ("2022 · Apple TV+ · English · 2 seasons, 19 episodes · 312 GB on disk · Profile...") is one long run; the profile is the only part relevant to this task.
- Episode 2 is OFF but has a file; nothing says whether unmonitoring keeps the file. The selection bar could say "files are kept".

## Questions
1. Should second-version sub-rows ever be part of a range, or should the range skip them?
2. Is the sidebar key legend needed if every action already carries its hint, or the other way round? Pick one home for hints.
3. Does the downloads dock need to be on the show overview at all, given the episode row already shows progress?
