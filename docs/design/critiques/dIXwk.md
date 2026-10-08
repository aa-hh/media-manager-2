# Critique: Desktop / Downloads (frame dIXwk)

Method: Assessment A only (design review), single agent, from the 1440x900 screenshot plus PRODUCT.md, the direction contract and the owner's screen decisions. No detector run (pen.dev frame, not a web page).

## Design specificity verdict

Specific to this product. The delayed rows ("in Radarr's queue, not in rTorrent yet", "grabs in 2h 10m"), the stalled row's automatic-fix note, the import-blocked row quoting Sonarr's rejection with an "import as second version" action, and the tracker column all come from this owner's setup. A generic torrent client could not show these unchanged. The visual language (monochrome table, outlined quality boxes, tiny tracked headers) is generic dark-dashboard, though: nothing in the styling tells you which rows matter.

## Nielsen heuristics

| # | Heuristic | Score | Why |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Every row has a status word, progress, time left, and the top bar shows live speeds and "rTorrent 3s ago". Loses a point because problem states look the same as healthy ones. |
| 2 | Match with the real world | 3 | Words the owner uses (delayed, stalled, import blocked, seeders, ratio). "Score +1650" and "DDP 5.1" are Sonarr's own vocabulary, fine for this owner. |
| 3 | User control and freedom | 3 | Pause, resume, grab now, search again, remove are each one key. No visible undo for remove, but the decisions doc gives remove its own choices dialog. |
| 4 | Consistency and standards | 2 | Same key action is shown twice (inline in the row and again in the footer). Action placement varies: in the status cell for delayed, paused and failed rows, on a second line for import blocked, nowhere for stalled. |
| 5 | Error prevention | 3 | Remove goes through a choices dialog with hit and run advice (per decisions). Grab now on a delayed release skips the delay profile with no warning visible here. |
| 6 | Recognition over recall | 3 | Inline key hints next to each action. Footer "1 2 3 filter by status" asks you to remember which number is which status; nothing on screen maps them. |
| 7 | Flexibility and efficiency | 4 | Keyboard everything, filter keys, one-key grab now. Built for the power user. |
| 8 | Aesthetic and minimalist design | 1 | Ten columns at equal visual weight, eleven heavy outlined quality boxes, two sets of key hints, an eight-part count line and an explainer sentence. Nothing is lifted, so the eye has nowhere to land. |
| 9 | Help users recognise and recover from errors | 3 | The three problem rows say what happened and what media-manager-2 is doing about it, in plain words, with the fix key. Strongest part of the screen. Loses a point because those notes are small grey text at the same weight as the release group names. |
| 10 | Help and documentation | 2 | The right-hand explainer and footer hints help a first visit; there is no way to dismiss them once learned. |

Total: 27/40. Rating band: Acceptable (20-27), at the top edge.

## Cognitive load

Failures (4 of 8, high load):

- Single focus fails. The screen's one job on a normal evening is "is anything wrong?". Three problem rows (stalled, import blocked, failed) sit at positions 6, 7 and 11, mixed among healthy rows, in the same white and grey as everything else. The only colour on the whole screen is one red "0".
- Visual hierarchy fails. Quality boxes are the heaviest marks on the screen and they carry the least useful information once a download has started. Title, status and problems have no more weight than tracker codes and ratio.
- Chunking fails. The count line lists 8 statuses in one dot-separated string. Ten columns per row with no grouping between "what is it", "how far along" and "what Sonarr/Radarr thinks of it".
- Progressive disclosure fails. Custom formats, score, ratio and seeders show on every row all the time, though they matter at grab time and when something has gone wrong, not while watching a healthy download.

Decision points with more than 4 visible options:

- Footer: 7 key hints (move, open title, pause or resume, grab now, manual import, remove, filter).
- Count line: 8 status categories, which double as the implied filter set.
- Top bar: 5 nav items plus search plus 3 status readouts (9 things), repeated on every screen.

## Strengths

1. Problem rows explain themselves. "BHD removed this torrent. media-manager-2 blocked the release and is searching another tracker." tells the owner what happened and that nothing is needed from them. This is the product promise ("without babysitting") made visible.
2. Delayed releases sit in the same list as real torrents, with plain wording for why there is no progress bar and when the grab happens. That closes a gap Sonarr's queue leaves open.
3. Dense but well aligned: numbers right-aligned, progress bars share one width, percentages line up. A power user can scan a column fast.

## Priority issues

### P1. Problems do not stand out from healthy downloads
- What: stalled, import blocked and failed rows look like the downloading rows. Status words are all the same white bold. Rows are not sorted by need.
- Why: the owner's normal-evening job is to check nothing is wrong. Today that needs reading all 11 status cells. At 40 rows it breaks completely.
- Fix: sort rows that need attention to the top, under a thin "Needs you (3)" or similar divider, with healthy rows below. Give the problem status word the red the colour rules already reserve for risk (or a left edge mark in red), and leave every healthy row monochrome. Make the explanation line under a problem row normal text colour, not dim grey.
- Command: `/impeccable clarify` then `/impeccable colorize`

### P1. Too many columns at equal weight
- What: ten columns: quality, title, tracker, progress, time left, status, seeders, ratio, custom formats, score.
- Why: this is the owner's clutter complaint in one picture. Custom formats and score answer "should I grab this?", which was decided before the download started. Ratio and seeders matter for hit and run and stalls, which the status line already calls out when they become a problem.
- Fix: default view keeps quality, title, progress, time left, status. Move tracker into the title's grey suffix ("WEB-DL · FLUX · BHD"). Put seeders, ratio, custom formats and score behind the column picker already decided for the library list, off by default, and show seeders inline only when it is the problem ("0 seeders" in the status detail, red). The owner chose ratio, custom formats and score as extra columns; the lighter version keeps them one key away rather than always on.
- Command: `/impeccable distill`

### P2. Key hints shown twice
- What: inline hints in rows (G grab now, P resume, M import as second version, S search again) plus a 7-item footer that lists the same keys.
- Why: two places saying the same thing doubles the noise and the footer is permanent chrome on every screen.
- Fix: keep the inline hints (they sit next to the thing they act on). Cut the footer to the keys that have no inline home (move, Enter, filter, remove), or show it only when "?" is pressed. Show the inline hint only on the focused row, plain text label on the others.
- Command: `/impeccable distill`

### P2. Quality boxes dominate the left edge
- What: eleven outlined boxes with bold "2160p"/"1080p", the strongest shapes on the screen.
- Why: draws the eye to the least decision-relevant column on this screen, and the outline repeated 11 times reads as a wall of buttons that are not buttons.
- Fix: drop the outline, plain text in the grey weight, or fold into the title suffix ("2160p · WEB-DL · FLUX"). Keep the box treatment for the release picker, where quality is the comparison.
- Command: `/impeccable quieter`

### P2. Low contrast small text and weak focus
- What: release group names, status details, the explainer sentence and the problem notes are small grey text on near black; the focused row is barely lighter than the rest.
- Why: Sam cannot read the explanation lines, which carry the most useful content on the screen. A keyboard-first screen with an invisible focused row fails its own premise.
- Fix: raise detail text to at least 4.5:1 contrast; give the focused row a clear background plus a left edge mark.
- Command: `/impeccable audit` then `/impeccable polish`

## Persona red flags

- Alex (power user): fine with density, but "1 2 3 filter by status" with eight statuses and no visible mapping forces recall. No visible sort control. Wants a "needs attention only" filter as the first number.
- Sam (accessibility): grey detail text on black looks well under 4.5:1; status is carried by words, which is good, but the only colour cue (red 0) depends on colour alone. Focus row barely visible. Inline key boxes at about 10px are hard to read.
- The owner on a normal evening: opens Downloads to check all is well, sees eleven equal rows, ten columns and a count line of eight statuses, and has to read every row to find the three that matter. Two of those three need nothing from him (media-manager-2 is already handling them), and the screen does not separate "handled, just so you know" from "needs you" (only the import-blocked row needs a decision).

## Minor observations

- Nav badge "Downloads 3" counts active downloads while the page says 11 items and 3 problems. Pick one meaning; a badge for problems would be more useful.
- The right-hand line "live from rTorrent, plus releases Sonarr and Radarr are holding back" is a first-visit explainer that stays forever. Remove it or show it only when there are delayed rows and the owner has not seen it.
- The count line could become the filter: make each status count a selectable chip and drop "1 2 3 filter by status" from the footer.
- Time left "unknown" for the stalled row repeats what "stalled" already says; a dash is enough.
- Seeders column is blank for the failed row and filled for delayed rows; fine, but for delayed rows the number means "swarm of a release not yet grabbed", a different meaning in the same column.
- The bottom 40 percent of the viewport is empty. Not a problem itself; it shows the table has room to breathe with taller rows and a group divider.
- Search box and the "Search" nav item both sit in the top bar.

## Questions

1. Should Downloads open filtered to "needs attention" when anything does, and to everything otherwise?
2. Are ratio, custom formats and score worth an always-on column on this screen, or is one key to reveal them enough, given you already chose a column picker for the library?
3. Would you accept the footer key list appearing only on "?" across every screen, with inline hints carrying the per-row actions?
