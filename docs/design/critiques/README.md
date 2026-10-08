# Prototype critique, 8 Oct 2026

26 screens of `design/mediaManager2.pen`, each reviewed by its own agent with impeccable's critique method (design review). One automated check ran over HTML exports of all 26; its 4,331 findings were all export artefacts (colour variables not resolved, so every text read as black; no DESIGN.md yet), so contrast was judged by eye only. One file per screen in this folder, named by pen.dev frame id.

Average 25.4 / 40, "Acceptable". Range 21 (phone, TV overview at 22, month calendar 21/36) to 29 (Downloads: remove).

## What makes it cluttered (found on most screens)

1. **The same global chrome on every screen.** The live downloads dock repeats the top bar's "Downloads 3" and speeds, shows unrelated shows, and is often the brightest block. The keyboard hint list (sidebar or footer) shows keys that don't work on that screen. The search results column stays open on detail screens.
2. **Normal states printed on every row.** "ON", "meets profile", "not aired yet", "downloaded 2160p", "ready" repeat on most rows and bury the two or three rows that need attention.
3. **Colour where nothing is unusual, none where something is.** Every release has a solid colour cell, so the one "best" row doesn't stand out; problems (missing, stalled, failed, blocked import) are plain grey; white "OWNED" chips are the loudest thing on the library. An outlined box means four different things.
4. **Repeated per-row actions.** Grab on every release, two icon buttons on every episode, keys on every flagged row, though keys only act on the selected row.
5. **Decisions don't get focus.** Confirm panels (replace, remove, delete, mark as failed) leave the rest of the screen bright and clickable; up to three inline panels open at once; destructive choices sit on one key; some keys mean two things on one screen (R refresh vs Replace; 1/2, Enter, S, M, A).

## Content errors found

- The purple "best on the board" release is one the profile rejects (REMUX over 60 GB).
- The override panel has no replace-or-second-version choice for an episode already owned.
- Delete panels say "frees 9.6 GB / 58.4 GB"; with a hardlink and the torrent kept seeding, it frees nothing.
- "Digital release date" breaks the glossary rule that "release" means a torrent.
- "Flagged 5" in the top bar against 14 missing and 9 below cutoff on the page; a flagged list not sorted as its footer claims.
- Mark as failed says Sonarr will grab from "another tracker"; Sonarr doesn't pick trackers.

## Per screen

| Screen | Frame | Score | Biggest decluttering move |
|---|---|---|---|
| Pick a release (movie) | GYT2F | 23 | Colour only the best passing release and risks; Grab only on the selected row |
| Pick a release: already owned | pWgUy | 25 | Collapse results column and dock; dim other rows while the choice is open |
| Pick a release (episode) | BxurY | 25 | Fold season/episode into the header with [ ]; collapse results and dock |
| Phone: pick a release | fSkBY | 21 | Whole row tappable; bottom sheet with Replace / Second version |
| Movie overview | zWW5R | 28 | Remove the dock; one status word; merge rows that repeat the upgrade note |
| TV overview | L7crsL | 22 | Show only what's unusual; row buttons on the selected row only |
| Library | GOM8w | 24 | Field chips into a popover; totals into the tab row; dock to one line |
| History | EYHjp | 26 | Remove the dock and header key list; failures in red |
| Health | imWFw | 25 | Healthy blocks to one summary line each; remove the dock |
| Downloads | dIXwk | 27 | Problem rows first and red; five default columns |
| Downloads: remove | oeZxo | 29 | Dim everything but the panel; footer shows Enter and Esc only |
| TV: monitoring | vIwpS | 26 | Dim header buttons while the panel is open; no sidebar key list |
| TV: range select | iAVnz | 24 | Keys only in the selection bar; make the range clearly highlighted |
| Manual import | TrXNw | 27 | Collapse the 8 ready files into one line; problem file on top |
| Flagged | R1GOrH | 27 | Drop the dock; keys only on the selected row |
| Flagged: missing / below cutoff | Ulb14 | 26 | One list per tab; drop the footer hint bar |
| Override before grab | GTb4E | 26 | One expanded row at a time; add replace or second version |
| Calendar: week | J1uFA4 | 25.6 | Drop the dock; colour missing episodes consistently |
| Calendar: month | g20KL | 21/36 | Show a state only when it isn't what the date implies |
| Calendar: forecast | S8S9Ex | 25 | "Not aired, will search" becomes the silent default |
| Delete second version | rSYPn | 27 | Three-line panel; dim the rest |
| Delete movie | XX6W9 | 26 | Panel the only bright thing; fix keys that mean two things |
| Delete: history unknown | d6TYkb | 27 | One sentence of advice; details behind a toggle |
| Mark as failed | fs0ud | 25 | Dim outside the open episode; remove-torrent off a single key |
| Episode details | c9Z57 | 24 | Exceptions only; no per-row buttons |
| Blocklist | D1bufZ | 27 | Drop the dock; "why blocked" next to the title |
