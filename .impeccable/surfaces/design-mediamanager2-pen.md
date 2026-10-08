---
version: 1
slug: "design-mediamanager2-pen"
primary_target: "design/mediaManager2.pen"
related_targets: []
---

# Search and release list

Scope: one search box for movies and TV shows; the movie and TV overviews (the default when a title opens: monitored state, profile and cutoff, files and versions, seeding, history, search automatically); pick a release (the detail view, opening on cached results); and the replace-or-second-version choice. Screen-by-screen decisions: docs/design/sonarr-radarr-review.md. Visitor mode: Operate. Desktop first; phone layout for checking and quick grabs.

Task: search a title, open it, compare releases on quality and source, size and seeders, tracker and its hit and run rule, group, audio and HDR; grab one. Status (owned, downloading, manual download, second version) is always visible without clicking. Dense, never sparse; never a raw spreadsheet; keyboard-first.

Unresolved: component library (waits on this prototype's component list).

## Direction contract

THESIS: The tracker's release table run like a live timing tower: dense rows on a dark ground where every colour is a comparison, readable at a glance while seeders and downloads change. Refuses the release table hidden in a modal behind hover-only status.

OWN-WORLD: Near-black timing ground (#0E0F12), stepped graphite rows, white tabular figures. Solid colour cells carry meaning only: purple = best release on the board, green = better than the version you own, yellow = not better than what you own, red = any risk (hit and run risk, 0 seeders, tracker cooldown). Condensed sans with tabular figures; one row height; no cards, no shadows, square cells.

STORY: The owner sees at once which release is best, which beat what they own, which carry a hit and run commitment, and what is already downloading; they grab with one key and choose replace or second version inline.

FIRST VIEWPORT: Left, a narrow tower of search results (poster thumb, title, year, status cell). Right, the open title's overview: poster and header with Search automatically (A) and Pick a release (I), then a status board of labelled rows (monitored, profile, your file, seeding, last search, versions) and history; live downloads docked at the bottom. Pick a release swaps in the dense release table, best release lit purple, Grab at each row's end.

FORM: Formula 1 live timing tower, my top-ranked grounded candidate (impeccable's pick, round 2), seed key 1ad4bbdb.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
