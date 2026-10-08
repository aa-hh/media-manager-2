# Critique: Desktop / Library (GOM8w)

Assessment A only (design review), from the 1440x900 screenshot plus PRODUCT.md, CONTEXT.md, the direction contract and docs/design/sonarr-radarr-review.md. Text colours judged by eye from the screenshot, not measured in the pen file.

## Design specificity verdict

Partly specific. The content is specific to this product: episode progress ("16 + 1 / 19"), "manual download", "+2 versions", live download bars sitting on the poster. The visual language is not. Everything outside the posters is the same grey-on-near-black outlined box, which makes this read as a generic dark media grid (Plex, Jellyfin, Sonarr's own poster view) with extra toolbars. The direction contract says solid colour cells carry meaning (red = risk, green = better than owned, and so on). This screen uses none of it: "MISSING 2", "MANUAL DOWNLOAD", "NOT AVAILABLE" and "DOWNLOADING 23%" all wear the same outlined grey badge, and "OWNED" wears a white filled one. The one thing the owner wants from this screen on a normal evening (what has gone wrong?) is the one thing the visual language does not show.

## Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Live speeds, rTorrent "3s ago", progress bars on posters and the downloads dock. Strong, but repeated three times. |
| 2 | Match system / real world | 2 | "16 + 1 / 19" needs the legend from the review doc to decode. "Show on each poster" and "choose fields" name the same control twice. |
| 3 | User control and freedom | 3 | Tabs, sort and field picker are all reversible. "showing all" hints at a filter, but no visible way to filter to problems. |
| 4 | Consistency and standards | 2 | Same badge style for good, bad and neutral states. Key hints shown twice (inline on tabs/sort/fields and again in the footer). "Search" nav item duplicates the search box beside it. |
| 5 | Error prevention | 3 | Little to break on a browse screen. |
| 6 | Recognition rather than recall | 3 | Key hints are visible; fields are labelled. Over-served, if anything. |
| 7 | Flexibility and efficiency | 3 | Keys for tabs, sort, fields, search, arrows. No filter to "needs attention", which is the fastest path for the main job. |
| 8 | Aesthetic and minimalist design | 1 | Five horizontal bands of chrome (top bar, tabs and sort, field chips, totals and key hints, downloads dock) take about 290 of 900 pixels. Only 20 of 214 titles are fully visible; the third row is cut off by the footer. |
| 9 | Error recovery | 2 | "MISSING 2" and "NOT AVAILABLE" say what is wrong but not why or what to do, and look identical to healthy states. |
| 10 | Help and documentation | 2 | Key hints act as help; no explanation of the episode progress numbers. |
| **Total** | | **24/40** | **Acceptable** |

## Cognitive load

Failures (5 of 8, high load):
- Single focus: the downloads dock, the field chip row and the totals bar all compete with the grid.
- Chunking: the field chip row has 11 controls in one line (label, 10 chips, "choose fields").
- Visual hierarchy: posters are the loudest thing, but status, the thing that matters, is the quietest. Every badge has the same weight.
- Minimal choices: the top bar has 6 nav items plus a search box; the field row offers 10 toggles at once.
- Progressive disclosure: the field picker, a set-once preference, is permanently open.

Decision points with more than 4 visible options:
- Field chip row: 10 toggles.
- Top navigation: 6 items (Search, Library, Downloads, Calendar, Flagged, Health) plus the search box, where "Search" and the box do the same job.
- Footer key hints: 5 hints, which repeat hints already shown on the controls above.

## Strengths

1. Download progress drawn on the poster itself (the thin bar under Severance, Andor, The Bear) shows live state in place without opening anything. This is the "show the real state, live" principle done well.
2. Each card carries exactly the owner's decided facts in one compact block: title, year, episode progress, size, one status, extra versions. The card itself is not cluttered.
3. The selected card (Severance) has a clear keyboard focus outline, so arrow-key browsing is visible.

## Priority issues

**[P1] Problems look the same as healthy titles**
- Why: the owner's normal-evening job here is "is anything wrong?". "MISSING 2" on Slow Horses, "MISSING 7" on The Last of Us and "NOT AVAILABLE" on Dune: Part Three are as quiet as "OWNED 1080p". The owner has to read all 20 badges to find 4 problems.
- Fix: apply the contract's colour meanings to the badge. Red fill for missing and stalled, neutral for owned and not yet available, a plain progress style for downloading. Owned should be the quietest badge, since it is the normal state; it is currently the loudest (white fill).
- Command: /impeccable colorize

**[P1] Five bands of chrome squeeze the grid to two rows**
- Why: top bar, tabs and sort, field chip row, totals and key hints, and the downloads dock leave room for 20 posters out of 214, and cut the third row in half. This is the owner's "extremely cluttered" complaint in its plainest form.
- Fix: delete the field chip row; the "F choose fields" key opens it as a popover when needed. Move the totals ("72 shows, 142 movies...") into the tab row's right side, where "214 titles, showing all" already sits, and drop the separate footer. Collapse the downloads dock to one line ("3 downloading, 41.6 MB/s") that expands on click or key; the full rows already exist on the Downloads page and as bars on the posters. That gives back about 200 pixels, a full extra row of posters.
- Command: /impeccable distill

**[P1] Downloads are shown three times**
- Why: "Downloads 3" in the nav, the progress bar and "DOWNLOADING 64%" badge on each poster, and the three-row dock at the bottom all say the same thing. The speed (41.6 MB/s) also appears both in the top bar and per row in the dock. Repeating live data three ways makes every part of the screen look busy.
- Fix: keep the poster bar (it is in place and specific) and the nav count. Collapse the dock as above, or drop it from the Library screen entirely. On the poster, keep the bar and change the badge to the percentage only.
- Command: /impeccable distill

**[P2] Keyboard hints are printed twice**
- Why: 1, 2, 3, S, F and / appear as boxed keys beside their controls, and the footer repeats 4 of them plus the arrows and Enter. Each boxed key adds another outlined rectangle to a screen that is already all outlined rectangles.
- Fix: keep one set. Either the inline keys on controls (best for learning) or a single "? for keys" hint. Drop the footer key list.
- Command: /impeccable quieter

**[P2] Episode progress "16 + 1 / 19" needs a legend**
- Why: the owner decided to keep this format, and it is dense and useful once learned, but the "+ 1" (downloading) is not visually different from the other numbers, and nothing on screen explains it.
- Fix: keep the format; render the "+ 1" in the downloading style (same treatment as the poster bar) so it reads as "1 in progress" without a legend, and add a tooltip with the plain sentence ("16 files, 1 downloading, 19 episodes").
- Command: /impeccable clarify

## Persona red flags

**Alex (power user)**: Keys exist for tabs, sort, fields and search, but there is no key or filter for "show only titles with a problem", which is what Alex wants after a failed download. Sort by "Date added" is the only sort visible; no "needs attention first". The 10 field toggles are reachable by mouse only as far as the screenshot shows.

**Sam (accessibility)**: Year, size, "+1 version", "live from rTorrent" and the unchecked field chips are mid-grey on near-black and look below 4.5:1. Badge text is about 9px uppercase, hard to read at normal zoom. If colour is added for problem states (issue 1), the badge words must stay so meaning does not rely on colour alone. Posters have no visible title until the image loads; in this mockup they are flat colour blocks, so check the real posters keep title text under them (they do here).

**The owner on a normal evening (mostly monitors, digs in when something breaks)**: Opens Library to check things are fine. Sees 20 near-identical cards, a dock of three downloads and a field picker they set once months ago. Must scan every badge to spot "MISSING 7" on The Last of Us. Has no "everything is fine" signal and no count of problems on this screen (the "Flagged 5" count lives in the nav, disconnected from which posters are affected).

## Minor observations

- "Search" in the nav sits right next to a search box that does the same thing; remove one.
- "Show on each poster" (label) and "choose fields" (button) name the same control two ways.
- "214 titles, showing all" on the right of the tab row restates the "All 214" tab.
- "+2 versions" under Severance sits under the badge with no separator and reads as a stray line; it could join the year and size line.
- The selected card's outline is close in weight to the badge outlines; a slightly brighter or thicker focus ring would separate "selected" from "status".
- Tracker short codes in the dock (BHD, PHD, BLU) are fine for the owner but undefined on screen.

## Questions

1. Should Library's default sort be "needs attention first" (missing, stalled, flagged), with "date added" one key away, given that monitoring is the normal-evening job?
2. Does the downloads dock need to be on Library at all, when every downloading title already shows its bar on the poster and Downloads is one key away?
3. Would a single summary line ("All good" or "4 titles need attention") above the grid replace the need to scan badges?
