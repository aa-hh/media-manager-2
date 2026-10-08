# Critique: Desktop / Flagged: missing and below cutoff (Ulb14)

Assessment A only (design review), single agent, from the 1440x900 screenshot plus PRODUCT.md, the direction contract and docs/design/sonarr-radarr-review.md. No detector run (out of scope for this brief).

## Design specificity verdict

Specific to this product. The columns answer the questions only a Sonarr/Radarr owner has: when was it last searched, when is the next automatic search, what did the last search return ("2 releases found, both rejected: size over max"), and for below cutoff, your file against the cutoff. The "no search-all" rule and hiding manual downloads from below cutoff are product decisions you can see on the screen. No generic dashboard tells.

The problem is volume. The screen shows two lists, two layers of explanation, key hints in four places and the live downloads dock, so the one job (see what is stuck and why, then search a few) takes longer to find than it should.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Next run is stated three times (toolbar sentence, every row's "Next automatic search", the "in 4 min" exception). Clear, but repeated. |
| 2 | Match with the real world | 3 | Plain words. "Below cutoff" relies on the glossary; the header line says these are ones automatic fixes "gave up on", which is wrong for Missing (they are still searched every 6h). |
| 3 | User control and freedom | 3 | Esc clears selection, Space and Shift-range select. Nothing destructive here. |
| 4 | Consistency and standards | 2 | "Missing" tab is active but a "Below cutoff" section also renders under it, while a separate "Below cutoff 9" tab exists. Top bar says "Flagged 5" while this page lists 14 + 9. Footer says "sorted by air date, oldest first" but rows run Mar 2025, Mar 2025, Apr 2025, Oct 2024, Dec 2024, May 2025, Oct 2024. |
| 5 | Error prevention | 3 | No search-all protects trackers; S searches only the selection. |
| 6 | Recognition rather than recall | 3 | Every key is shown, so nothing has to be remembered. Shown too often, see 8. |
| 7 | Flexibility and efficiency | 4 | Number keys for tabs, Space, Shift range, S, Enter, slash for search. |
| 8 | Aesthetic and minimalist design | 1 | Two tables, a selection toolbar with five labelled actions, a sentence beside it, a footer hint bar with five more, and a three-row downloads dock. The brightest things on screen are white 1080p chips and the NEVER badge, not the problems. |
| 9 | Help users recover from errors | 2 | "Last result" says why something failed but offers no next step. "Both rejected: size over max" should lead straight to pick a release; "nothing that meets the profile" should offer the profile. |
| 10 | Help and documentation | 2 | Help is present but as long inline sentences (below cutoff paragraph, "S searches the selected items only. There is no search-all.") that sit on screen permanently. |
| **Total** | | **26/40** | **Acceptable** |

## Cognitive load

Failed checklist items (5 of 8, high load):
- Single focus: the Missing list, a Below cutoff preview and the live downloads dock all compete. Downloads also already appear in the top bar ("Downloads 3", speeds).
- Chunking: six columns per missing row, two of which are nearly constant ("6h ago", "18:00 today" on 5 of 7 rows).
- Visual hierarchy: the loudest marks are the filled white "1080p" chips and the outlined "NEVER" badge. The most useful column, "Last result", is the faintest, smallest text on the page, pushed to the far right.
- Minimal choices: the selection toolbar shows 5 options (Search selected, Select, Select range, Clear selection, plus the explanation); the footer shows 5 more hints; tabs show 3 with key boxes. The selection toolbar and footer repeat Space and S.
- Progressive disclosure: key hints, the below cutoff explanation and the downloads dock are always on, whether or not anything is selected.

Passed: grouping (tables are clearly separated), working memory (nothing needs remembering from another screen), one thing at a time is borderline.

Decision points over 4 visible options: selection toolbar (5), footer hint bar (5), top nav (5 links plus search).

## Strengths

1. "Last result" is the right column. "2 releases found, both rejected: size over max" and "no results 8 times running, now searched daily" tell the owner exactly why something is stuck without opening it.
2. Below cutoff shows your file next to the cutoff as two chips ("1080p WEB-DL FLUX" against "2160p WEB-DL"), so the gap is readable at a glance.
3. The header line "Automatic fixes handled 41 problems this week on their own" reassures the owner on a normal evening before they read any rows.

## Priority issues

**[P1] The page shows two tabs' content at once.**
- What: "Missing" is the active tab, yet a "Below cutoff 9" section with its own table and "Open full list 3" sits under it, duplicating the "Below cutoff" tab.
- Why: the owner cannot tell what tab they are on or whether the 3 below cutoff rows are the whole list (they are 3 of 9). Two tables also double the column headers and row chrome.
- Fix: one list per tab. Drop the below cutoff section from the Missing tab. If a cross-tab summary is wanted, put it in the tab label counts, which already exist.
- Command: /impeccable distill

**[P1] Key hints appear in four places.**
- What: tab number boxes, the selection toolbar (S, Space, Shift arrows, Esc), the footer bar (arrows, Enter, 1 2 3, Space, plus the S sentence), and the slash in the search box.
- Why: the owner named key-hint noise as clutter. Space and S are each shown twice. Fifteen-plus outlined key boxes form a second visual layer over the data.
- Fix: delete the footer hint bar on this screen. Show the selection toolbar only when something is selected, with just "3 selected, Search (S), Clear (Esc)". Move the full key list behind "?". Keep the tab number boxes only if they are faint until hover or focus.
- Command: /impeccable quieter

**[P1] Columns repeat the same value and bury the reason.**
- What: "Last searched" and "Next automatic search" read "6h ago / 18:00 today" on 5 of 7 rows, and the toolbar sentence already says "next run 18:00 (in 2h 10m)". "Type" spells "TV · Sonarr" where "TV" implies Sonarr. "Last result" is faint grey at the far right.
- Why: the owner's real question is "why is this stuck", and the answer is in the weakest text on the page.
- Fix: merge the two search columns into one "Searched" column that shows only exceptions ("never, next in 4 min", "daily since 8 misses") and leaves normal rows blank, with the shared 18:00 run stated once in the page header. Drop "Sonarr/Radarr" from Type (or drop Type and show a small TV/Movie word after the title). Move "Last result" next to the title at body text colour.
- Command: /impeccable layout

**[P2] Live downloads dock takes the bottom fifth of a screen about stuck items.**
- What: three full-width progress rows (about 130px) unrelated to missing or below cutoff items, while the top bar already shows "Downloads 3" and both speeds.
- Why: it is the only moving content, so it pulls the eye away from the list on every screen it appears on.
- Fix: hide the dock on Flagged; keep the top bar count. If a flagged item is downloading, show progress on that row only, which the review doc already asks for on episodes and movies.
- Command: /impeccable distill

**[P2] Loudest marks point at the least urgent things.**
- What: filled white "1080p" chips are the highest contrast element on the page; the outlined "NEVER" badge marks Black Bag, whose search runs in 4 minutes.
- Why: emphasis should land on items needing the owner (rejected releases, 8 misses in a row), not on an item about to fix itself.
- Fix: render quality chips as outlined or plain text in both columns; style "never searched" as plain text, and reserve emphasis for rows where automatic search has repeatedly failed.
- Command: /impeccable quieter

## Persona red flags

**Alex (power user):** Gets every shortcut, but S works only on a selection, so searching one row takes Space then S; no single key to search the focused row. Header row sort is stated in text but the order shown does not match it, so Alex cannot trust the sort.

**Sam (accessibility):** "Last result", "TV · Sonarr" and column headers are small grey text on near-black; likely under 4.5:1 contrast (check the token values). Uppercase 10-11px column labels. Key hint boxes use tiny text inside thin outlines. The selected-row state relies on a checkbox tick and faint row tint; the focused row has a thin outline only.

**The owner on a normal evening:** Opens Flagged because the top bar says 5, lands on a page showing 14 and 9. The header says these are what automatic fixes "gave up on", but Missing items are still searched every 6h, so the owner cannot tell if action is needed. The answer (wait for 18:00, or the release was rejected for size) is in the faintest column.

## Minor observations

- Empty band of about 60px between the below cutoff table and the footer hint bar.
- "7 more below" is a scroll hint that would not be needed if the list ran to the bottom of the viewport (the dock and footer take that space).
- Below cutoff explanation is 30 words; "Manual downloads are not listed (Severance S02E08 hidden)" carries the useful part.
- The toolbar sentence on the right ("Monitored items without a file...") restates the tab name.
- "Open full list" with key box 3 duplicates pressing 3 for the tab.

## Questions

1. Should "Flagged 5" in the top bar count only "Needs you", and if so, should Missing and Below cutoff live on Flagged at all, or under Library as filters?
2. Would a "Search (S)" that works on the focused row when nothing is selected break the no-search-all rule? It still searches one item.
3. Does the downloads dock need to be on every screen, or only on Downloads and title pages?
