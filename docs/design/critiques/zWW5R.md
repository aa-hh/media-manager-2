# Critique: Desktop / Movie overview (default), frame zWW5R

Method: Assessment A only (design review), single context, read from the 1440x900 screenshot. No detector run, by brief.

## Design specificity verdict

Authored for this product. The status board rows (monitored, quality profile, your file, seeding, last search, second versions) and the history wording ("search on add never ran", "hardlinked; torrent keeps seeding") could only belong to a Sonarr/Radarr owner with private trackers. Nothing here is a generic dashboard template.

Where it loses character is volume. Every row carries a label, a value, a grey explanation sentence and often a right-hand action with a key cap. The product voice is good; there is too much of it on one screen. The screen reads as four apps stacked: a top bar with live speeds, a search results column with its own key list, the movie overview, and a downloads table for three unrelated shows.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Rich status, but no single status word for the movie (the owner decided on one: queued, downloaded, missing, not available, deleted). The owner has to read six rows to learn "you have it, an upgrade is wanted". |
| 2 | Match with the real world | 3 | Uses the glossary words. "Cutoff", "Minimum availability: Released" and "max 60 GB" are Radarr's own terms, fine for this owner. "Second versions" as a plural row label over one version reads oddly. |
| 3 | User control and freedom | 3 | Unmonitor, Change and Delete version are one key each and visible. No visible way back from the overview other than the results column, which is fine on desktop. |
| 4 | Consistency and standards | 2 | White filled boxes mean four different things: the primary button (Search automatically), owned status (OWNED 1080p), monitored state (ON) and your file's quality (1080p). Key caps appear in three styles and places: inside buttons, at the right edge of rows, and as a list at the bottom left. |
| 5 | Error prevention | 3 | Delete version sits on a single key (D) at the row edge. The product rules say delete asks about the torrent with hit and run advice, so the risk is covered if that dialog exists. |
| 6 | Recognition over recall | 3 | Actions are labelled with their keys in place. The bottom-left key list shows G (grab selected release) and 1 2 7 (filter quality), which do nothing on this view, so the list teaches the wrong keys here. |
| 7 | Flexibility and efficiency | 3 | Strong keyboard coverage (A, I, M, Q, D, /, arrows, Enter). Loses a point because the keys are spread over three places and the list shown does not match the view. |
| 8 | Aesthetic and minimalist design | 2 | The owner's concern holds. Live speeds in the top bar, a "Downloads 3" count in the nav, and a three-row downloads table at the bottom all say the same thing. Three rows explain that Radarr will upgrade (Monitored, Your file, Last search). Last search repeats the top history line. |
| 9 | Help users recover from errors | 3 | BELOW CUTOFF is explained in plain words, and the history names the missed search on add. Good. |
| 10 | Help and documentation | 3 | Inline explanations everywhere. Here the problem is excess, not absence. |
| **Total** | | **28/40** | **Good (low end)** |

## Cognitive load

Failed checklist items (4 of 8, high load):

- Single focus: the downloads table (3 rows, 7 columns each, moving progress bars) pulls the eye away from Dune, and none of its rows are about Dune.
- Visual hierarchy: four white filled elements compete with the primary button. The title and the two buttons are clear; below them every row has equal weight.
- Minimal choices: the right edge of the status board alone offers Unmonitor, Change, Delete version, plus the two header buttons, plus five nav links, plus five footer keys.
- Progressive disclosure: seeding detail, the hit and run rule, the last search source and the cached-results age are all shown when nothing is wrong.

Decision points with more than 4 visible options:

- Top bar: search box plus 5 nav links (Search, Downloads, Calendar, Flagged, Health), plus 2 speed readouts and an rTorrent freshness note. 6 interactive targets.
- Overview actions: Search automatically, Pick a release, Unmonitor, Change, Delete version. 5 actions at once, 2 of them header buttons and 3 scattered down the right edge.

Passed: chunking (status board rows are clearly grouped), grouping, one thing at a time on each row, working memory (nothing needs recalling from another screen).

## What's working

1. The status board is the right idea. Labelled rows with a value and a reason ("Radarr will upgrade it when a 2160p release turns up") answer "why is it like this" without opening anything.
2. History in sentences. "Added and searched automatically 15 min after adding (search on add never ran)" shows the automatic fix doing its job in words the owner reads in two seconds.
3. The results column is calm and scannable: poster thumb, title, year and type, one status cell per row. Owned versus not added is readable at a glance.

## Priority issues

**[P1] Live downloads table docked under a movie it has nothing to do with**
- Why: It takes about 130px of the 900px viewport, sits in the eye's natural resting spot at the bottom, animates, and shows Severance, The Bear and Andor while the owner is looking at Dune. The same news is already in the top bar (41.6 MB/s down, "Downloads 3"). Three places say "things are downloading".
- Fix: Remove the table from the movie overview. Keep "Downloads 3" and the speeds in the top bar as the global signal. If Dune itself is downloading, show its progress inside the Your file row (the owner already decided live progress shows on movies). If the owner wants the table kept, collapse it to one line ("3 downloading · 41.6 MB/s · Andor 91%") that expands on a key.
- This contradicts the direction contract's "live downloads docked at the bottom". It is the single largest cause of clutter on this screen, so the contract line should change.
- Command: /impeccable distill

**[P1] No one-glance answer to "is this movie fine?"**
- Why: The owner on a normal evening wants one answer. Today it takes reading Monitored, Your file, Last search and Seeding to conclude "downloaded, upgrade wanted, nothing to do". The owner's own decision was one status word driven by live rTorrent state; it is missing.
- Fix: Put the status word in the header meta line, styled as the loudest status on the page: "Downloaded · waiting for 2160p". Then the three upgrade explanations collapse into it (see next issue).
- Command: /impeccable clarify

**[P2] The same fact explained three times, and every row explains itself**
- Why: "Radarr searches new uploads and upgrades until the cutoff is met", "Radarr will upgrade it when a 2160p release turns up" and "Radarr also watches new uploads" are one fact. The Last search row repeats the first history line word for word in meaning. Grey sentences on all six rows make the board a paragraph.
- Fix: Keep the explanation only where something is not normal. Drop the Monitored row sentence (ON says it). Keep "Radarr will upgrade it when a 2160p release turns up" once, on Your file. Delete the Last search row; the top history line already says "Today 09:14 Automatic search · none better". Shorten Seeding to "PrivateHD · 212h · ratio 1.4 · safe" and show the rule (72h or 0.9) only when it is not met.
- Command: /impeccable distill

**[P2] White fill is used for four meanings, so the primary button does not stand out**
- Why: OWNED 1080p, OWNED 2160p, 6/6 OWNED, ON, 1080p and Search automatically are all white boxes with dark text. The eye cannot tell which white box is pressable.
- Fix: Reserve the white fill for the primary action only. Owned status becomes outlined or plain text with a colour; ON becomes a word ("Monitored") in the meta line or an outlined chip; the file quality becomes plain bold text.
- Command: /impeccable quieter

**[P2] Key hints in three places, one of them wrong for this view**
- Why: Key caps sit inside buttons, at the right end of rows, and in a five-item list at the bottom left. The list shows G and 1 2 7, which belong to Pick a release. Noise for Alex, wrong guidance for anyone learning.
- Fix: Delete the bottom-left list. Keep key caps inside the two header buttons only. Show row-action keys (M, Q, D) when the row is focused or hovered, and put the full list behind "?".
- Command: /impeccable distill

## Persona red flags

**Alex (power user):** The footer advertises G and number keys that do nothing here. Five action keys live in two different places (header buttons and right edge). No visible key for Search history or jumping between titles; the owner decided `[` and `]` for shows, and the movie view should match.

**Sam (accessibility):** The grey explanation text, history dates, row labels and the "last results 14 min ago" note look about 11px and mid grey on near black, likely under 4.5:1 contrast. Row labels are tiny uppercase with letter spacing, the hardest form to read at that size. Status is mostly carried by text, which is good, but "ON" in a small white box is the only monitored signal. The animated progress bars at the bottom move while Sam reads the page above.

**The owner on a normal evening (monitors, lets Sonarr and Radarr search, digs in only when something is wrong):** Opens Dune to check it. Nothing is wrong, yet the screen shows 6 board rows, 5 history lines, 3 downloads and 5 key hints, and no single word saying "fine". The page looks equally busy whether something is broken or not, so it cannot signal trouble by changing. The fix is to make the healthy state short and let problems add rows.

## Minor observations

- The poster placeholder is a 120x180 flat purple block; with real art this is fine, but it makes the header taller than the two buttons need.
- "last results 14 min ago · fresh search takes ~20s" sits beside the buttons at the lowest contrast on the page; it belongs as a subtitle inside the Pick a release view, where it is acted on.
- "Second versions" label with one version: use "Second version" or "Other versions".
- History has no "more" link or count; the owner decided a global history page exists, so link to it.
- Missing header fields the owner decided (rating, certification, genres, studio, collection). Adding all five to the meta line would add clutter; suggest only genres and rating in the meta line and the rest on demand.
- The top bar's "rTorrent · 3s ago" freshness note is useful on Downloads, noise elsewhere; show it only when the data is stale.

## Questions

1. If the overview showed only what is not normal, how many of the six board rows would remain for Dune today? (My count: Your file, and maybe Second versions.)
2. Does the downloads table need to be on every screen, or would a top-bar count that turns red on a stall do the same job?
3. Should the overview look visibly different when something is wrong (a flagged row at the top) so the healthy case can be almost empty?
