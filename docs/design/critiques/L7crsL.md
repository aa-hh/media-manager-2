# Critique: Desktop / TV overview (default), frame L7crsL

Method: Assessment A only (design review), single agent, from the 1440x900 screenshot plus PRODUCT.md, the direction contract and docs/design/sonarr-radarr-review.md. No detector run (not part of this brief).

## Design specificity verdict

Half there. The near-black ground, condensed type, square cells and the "PHD 4h of 72h" seeding line belong to this product. Everything else reads as Sonarr's season table with the colour turned off. The direction contract's whole idea is that colour cells carry meaning (purple best, green better than owned, yellow not better, red risk). On this screen there is no colour at all: the downloading episode, the below-cutoff episode and the eight healthy episodes all carry the same grey text at the same weight. The timing-tower idea is missing, so the screen falls back to a generic dark admin table.

The direction contract also promised a status board of labelled rows (monitored, profile, your file, seeding, last search, versions), history, and a Pick a release (I) action in the header. None of these are on this frame. That fits the owner's later decision in the review doc (TV overview as a season and episode table), but the contract has not been updated, so the two now disagree.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Live speeds, "3s ago" and progress bars are good. Episode 7's progress shows twice (row and dock). The dock's third row is cut off at the bottom edge. |
| 2 | Match with the real world | 3 | Uses Sonarr's words the owner knows. "meets profile" and "searches when it airs" read well. Dates mix formats: "17 Jan", "Fri 21:00", "Fri +7d". |
| 3 | User control and freedom | 2 | Trash icon on second-version rows sits in the same column as harmless icons; no sign of a confirm or undo. No visible way back from the overview other than the results list. |
| 4 | Consistency and standards | 2 | Key hint panel shows "G grab selected release" and "1 2 7 filter quality", which do nothing on an overview. Header button shows key "A" but the per-row buttons show no keys. Disabled icon buttons (rows 9, 10) look nearly the same as enabled ones. |
| 5 | Error prevention | 2 | One-click trash next to search and list icons. Nothing marks the risky row. |
| 6 | Recognition rather than recall | 2 | 22 icon-only buttons with no labels. The list icon could mean history, releases or details; nothing says which. |
| 7 | Flexibility and efficiency | 3 | Header action on a key, results list on arrows, `/` to search. Row-level keys (search episode, expand) are not shown anywhere. |
| 8 | Aesthetic and minimalist design | 1 | Every row has the same weight. "ON" appears 10 times, "meets profile" 6 times, two identical icon buttons 10 times. The two rows that matter (7 downloading, 8 below cutoff) do not stand out. |
| 9 | Error recovery | 2 | "below cutoff · manual download" explains the state. No row shows a failure, and nothing shows where a failure would appear or how to fix it. |
| 10 | Help and documentation | 2 | Caption under the header button explains it. The key hint panel is generic, not about this screen. |
| **Total** | | **22/40** | **Acceptable** |

## Cognitive load

Checklist failures (5 of 8, high load):
- Single focus: the episode table, a live downloads dock, a results list, a key hint panel and a top bar with speeds all compete. The dock is the brightest thing on screen (white progress bars, bold percentages).
- Visual hierarchy: nothing tells the owner which episode needs a look. The eye lands on the title, then on the dock.
- Minimal choices: about 33 clickable targets are visible at once (5 nav items, search, 2 results, 1 header button, 3 season tabs, 20 row icon buttons, 2 trash buttons).
- Progressive disclosure: per-row actions, monitored state and "meets profile" are shown for every row, though they are only interesting on the selected row or the exceptions.
- Chunking: the meta line packs 7 facts into one grey line ("2022 · TV · Apple TV+ · Sonarr · Monitored: all future episodes · Profile: WEB 2160p preferred").

Decision points with more than 4 visible options:
- Each episode row: the row itself, Monitored toggle, search icon, list icon (4, at the limit) multiplied by 10 rows with no focus on one.
- Top bar: 5 nav items plus search plus status (7).
- Bottom-left key hint panel: 5 hints, 2 of which do not apply here.

## Strengths

1. The second-version sub-rows ("second version · added 2 Oct", "seeding · PHD 4h of 72h") put the hit and run state right under the episode it belongs to. This is the product's main promise shown in one line.
2. The season tabs carry their own counts ("Season 1 9/9", "Season 2 7/10 · +2 versions", "Season 3 not aired"), so the owner sees the whole show's state without opening each season.
3. Status words are plain and specific ("searches when it airs", "below cutoff · manual download") instead of icons or codes.

## Priority issues

**[P1] Repeated per-row chrome buries the two rows that matter**
- What: 10 "ON" pills, 6 "meets profile", 10 search icons, 10 list icons, and 9 bordered quality cells that all say the same thing. Rows 7 (downloading) and 8 (below cutoff) look like the other eight.
- Why: the owner on a normal evening opens Severance to answer "is it fine?". The answer is "two things are in progress, the rest is fine", and the screen makes them read 12 rows to get it. This is the clutter the owner is describing.
- Fix: show only exceptions. Drop the Monitored column and mark only unmonitored episodes (a dim row plus "not monitored" in the status). Leave the status cell blank for "meets profile". Show the search and list buttons only on the selected row (keyboard focus or hover), with their keys. Colour the status cells per the contract (a solid cell for downloading, yellow for below cutoff, red for risk). Result: rows 1 to 6 go quiet, 7 and 8 light up.
- Command: /impeccable distill

**[P1] Live downloads dock repeats the top bar and steals focus**
- What: the dock shows 3 downloads with full-width white bars, bold percentages and tracker codes. The top bar already says "Downloads 3", and episode 7's progress is already in its row. Two of the three downloads (The Bear, Andor) have nothing to do with this show. The third row is cut off by the screen edge.
- Why: it is the brightest, most animated block on the screen and it is about other titles. On every screen it adds a second job.
- Fix: remove the dock from the overview. Keep "Downloads 3" in the top bar, and turn it into a one-line live summary ("3 downloading · 41.6 MB/s") that opens the downloads page. Show this title's downloads only in its own rows, as now. If the owner insists on the dock, collapse it to one line by default and expand on a key.
- Command: /impeccable distill

**[P2] Key hint panel is generic and partly wrong for this screen**
- What: the bottom-left panel lists `/` search, arrows move, Enter open, `G` grab selected release, `1 2 7` filter quality. There are no releases on this screen, so `G` and the quality filter do nothing. The keys that do apply here (season switch, search one episode, expand an episode, `[` and `]` for previous and next show from the review doc) are missing.
- Why: it takes space and teaches the wrong keys. A power user learns keys once; after that the panel is permanent noise.
- Fix: delete the panel. Put each key next to the control it triggers (the header button already does this with "A"), and add a `?` overlay that lists every key for the current screen.
- Command: /impeccable quieter

**[P2] Icon-only row buttons and a one-click trash**
- What: 20 search and list icons with no labels or keys; the list icon's meaning is unclear. Second-version rows have a trash icon in the same column, one click away from the search icon above it. Disabled icons on rows 9 and 10 are only slightly dimmer than enabled ones.
- Why: Sam's screen reader hears "button, button" ten times. The owner can delete a seeding second version by mistake, and deleting while seeding is the hit and run risk the product exists to prevent.
- Fix: replace the per-row icons with labelled actions on the selected row ("Search · S", "Details · Enter"). Move delete into the expanded episode details (Enter), where the hit and run advice from the delete flow can sit beside it. Remove the buttons on unaired rows entirely instead of disabling them.
- Command: /impeccable clarify

**[P2] Header meta line and caption crowd one grey line**
- What: "2022 · TV · Apple TV+ · Sonarr · Monitored: all future episodes · Profile: WEB 2160p preferred" plus a small grey caption next to the button.
- Why: the two facts the owner might change (monitoring and profile) are mixed with facts that never change (year, network, "Sonarr"). The caption is small grey text with weak contrast.
- Fix: split into two lines: fixed facts dim on one, monitoring and profile on the next as labelled values. Drop "Sonarr" and "TV" (the season tabs already say TV). Cut the caption to a tooltip or the `?` overlay.
- Command: /impeccable typeset

## Persona red flags

**Alex (power user):** no key shown for searching one episode, expanding a row or switching seasons. The key hint panel advertises `G` and `1 2 7`, which do nothing here. `[` and `]` (decided in the review doc) are not shown.

**Sam (accessibility):** 22 unlabelled icon buttons. Disabled versus enabled icon buttons differ only by a slight dimming. Grey-on-black small text (meta line, caption, "live from rTorrent", key hint labels, aired dates on future rows) is likely under 4.5:1. Once colour is added for status, it must also carry a word, which the status column already has.

**The owner on a normal evening (mostly monitoring, digs in only when something is wrong):** opens Severance and has to scan 12 rows to learn nothing is wrong. The dock draws the eye to The Bear and Andor. There is no single line saying "7 of 10, 1 downloading, 1 below cutoff, 2 not aired". The season tab "7/10 · +2 versions" comes closest and is easy to miss.

## Minor observations

- Dates use three formats: "17 Jan", "Fri 21:00", "Fri +7d". Pick one style for past and one for future.
- File cell shows "—" for episode 7 while its status shows 64%. Fine, but the progress bar in the status cell duplicates the dock.
- Episode titles for unaired rows 9 and 10 are dimmed; their "ON" pills are not.
- The results list leaves about 550px of empty column above the key hints. If the hints go, the column could shrink or show the other search result's state more fully.
- "S02 7/10" in the results list and "Season 2 7/10" in the tab say the same thing twice on one screen.
- Poster placeholder is a flat green block; fine for a prototype, but it is the largest block of colour on the screen, and green means "better than owned" in the contract.

## Questions

1. If colour only marks exceptions, can rows that meet profile show no status text at all, so a quiet row means "fine"?
2. Does the live downloads dock need to be on the overview, or is "Downloads 3" in the top bar enough for an owner who mostly lets things run?
3. Should per-row actions exist only on the selected row, since the product is keyboard-first and there is always one selected row?
