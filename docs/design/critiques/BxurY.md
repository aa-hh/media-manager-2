# Critique: Desktop / Pick a release (episode detail), frame BxurY

Assessment A only (design review), from the 1440x900 screenshot plus PRODUCT.md, the direction contract and docs/design/sonarr-radarr-review.md. No detector run, by brief.

## Design-specificity verdict

Specific to this product. Tracker names as cells, hit and run terms per row, the cooldown state, the "YOU OWN" line against which every row is coloured, and the cached-results age with a refresh key could not be lifted into another app unchanged. The timing-tower idea shows in the colour cells and tabular figures. The problem is volume: the screen carries the tower idea on every surface at once (results list, five legend items, three selector strips, ten coloured rows, a downloads dock, a key-hint list), so the one job, "pick the release for S02E08 and grab it", has to be found among about 70 interactive or coloured elements.

## Nielsen heuristics

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Result age, owned version, live downloads and E07 at 64% all visible. Selected episode is ambiguous (see issue 4). |
| 2 | Match with the real world | 3 | Tracker vocabulary fits the owner. "+1600" has no label, "72h or 0.9" needs decoding. |
| 3 | User control and freedom | 2 | No visible way back to the overview; Esc behaviour not shown. |
| 4 | Consistency and standards | 2 | Two different highlight styles in the episode strip; "Grab" vs "GRAB G"; red used as a cell fill and as text in the same row. |
| 5 | Error prevention | 3 | Cooldown rows lose their Grab button; hit and run terms on every row. |
| 6 | Recognition over recall | 3 | Keys shown on buttons and in the hint list; legend explains colours. |
| 7 | Flexibility and efficiency | 4 | Keyboard on every action, quality filter counts, season packs on P. |
| 8 | Aesthetic and minimalist design | 1 | Five saturated fill colours across ten rows, eight identical Grab buttons, three stacked selector strips, two persistent side panels. |
| 9 | Error recovery | 2 | Grab errors are hover-only by the owner's choice; nothing on this frame shows recovery. |
| 10 | Help and documentation | 2 | Legend is present but permanent and long; no help for "+1600" or the hit and run shorthand. |
| | Total | 25 / 40 | Acceptable |

## Cognitive load

Failures (5 of 8, high load):
- Single focus: the table competes with the results list, legend, three selector strips, the downloads dock and the hint list.
- Visual hierarchy: the purple best row, the outlined selected row and the white "GRAB G" button pull in three places; the quality column's bright fills outshine the release names.
- Minimal choices: see decision points below.
- Chunking: ten columns, several of which (source, audio, profile) repeat the same value down most rows.
- Progressive disclosure: the colour legend, key hints and downloads dock are always open.

Decision points with more than 4 visible options:
- Episode strip: 10 episodes.
- Season tabs plus season packs: 4.
- Quality filter: 4 (at the limit).
- Release table: 8 Grab buttons visible at once.
- Top navigation: 5 items plus search.
- Before reaching the first release row the owner passes about 21 selectable controls.

## Strengths

1. The comparison is right where the decision is made: "Meets Sonarr's quality profile (+1500)", tracker, hit and run terms and seeders sit on the row, and rejection reasons ("720p not wanted", "cooldown") are inline, as the owner decided.
2. "YOU OWN" sits in the header, so every row's green or yellow reads against a visible baseline, and the owned row says OWNED instead of offering Grab.
3. "Results from 14 min ago, refresh R (fresh search ~20s)" sets honest expectations for the cached-results decision.

## Priority issues

### 1. Colour fills on every row drown the one signal that matters (P1)
What: every row's quality cell is a solid purple, green or yellow block, the tracker cell turns red on cooldown, and the hit and run text turns red too. Ten saturated blocks in one column plus red twice per risky row.
Why: when every row is lit, "best on the board" (the one purple row) does not stand out. The owner on a normal evening wants to see "which one should I take" in two seconds; instead the eye lands on a wall of green.
Fix: keep the colour but shrink it. Put the comparison colour as a narrow 4px bar at the row's left edge, and leave the quality text plain white. Keep one solid fill only for the best row. Red appears once per row (on the tracker or the reason, not both). Rows that cannot be grabbed collapse under a "2 on cooldown" line.
Command: `/impeccable quieter` then `/impeccable colorize`.

### 2. Three stacked selector strips before the table (P1)
What: season tabs (3) plus season packs, an episode strip of 10 cells, and a quality filter of 4 chips, each in its own band, about 150px tall in total.
Why: the owner arrived here for S02E08; the header already says so. Ten episode cells and the season tabs are navigation for a different task.
Fix: fold season and episode into the header as one control ("S02E08", with [ and ] for previous and next episode, a dropdown for the rest). Put the quality filter chips on the same line as the result-age note. Keep season packs as a key and one link in that line. This returns about 100px to the table and removes about 13 always-visible controls.
Command: `/impeccable distill`.

### 3. Grab button on every row (P2)
What: eight bordered "Grab" buttons, one highlighted "GRAB G".
Why: identical buttons repeated down a column read as a second table and add eight focus targets for Sam's screen reader. Keyboard users grab with G on the selected row anyway.
Fix: show the Grab button only on the selected or hovered row; other rows show nothing in that column, OWNED and cooldown keep their words. Rows stay clickable to select.
Command: `/impeccable distill`.

### 4. Persistent chrome eats a third of the screen (P1)
What: the 340px search results list (2 results, with about 550px of empty space under them), the key-hint list, the downloads dock (about 130px, three rows), and download speeds in the top bar.
Why: none of it serves picking a release for S02E08. The dock repeats information shown elsewhere (E07 at 64% already shows in the episode strip; speeds already show in the top bar). The owner named this exact repetition as the clutter source.
Fix: on the release detail view, collapse the results list to a narrow rail or hide it until the search box is focused. Collapse the downloads dock to a single summary line ("3 downloading, 41.6 MB/s") that expands on click or a key. Move the key hints behind "?" and show only the keys for this view inline (G, R, P) where they already appear.
Command: `/impeccable distill` then `/impeccable layout`.

### 5. Two kinds of "selected" in the episode strip and in the table (P2)
What: E07 has a white outline and a progress arrow, E08 has a white fill. In the table, the best row is purple and the selected row is outlined, with a white Grab button.
Why: Sam and Alex both have to work out which highlight means "this is the one you are on". Two highlight styles side by side read as two selections.
Fix: one selection style everywhere (the white fill); show downloading as text only ("64%") without an outline.
Command: `/impeccable polish`.

## Persona red flags

Alex (power user):
- The legend row (5 items) is permanent screen space Alex learned on day one. Hide it behind "?" or show it only on first use.
- No column sort shown; Alex will want to sort by seeders or size with a key.
- "+1600" with no label: score of what? Alex knows, but a column header "Score" costs nothing.

Sam (accessibility):
- Comparison meaning lives in fill colour; purple and green 2160p cells are distinguishable mainly by hue. The legend helps sighted users only. Add a text marker for "best" (for example "Best" in the cell) and make the row's accessible name include "better than yours" or "not better".
- Dimmed cooldown rows and grey release names look well under 4.5:1 contrast on the dark ground at this size.
- Eight Grab buttons with the same label give a screen reader eight identical "Grab" links; each needs the release name in its label.

The owner on a normal evening (mostly lets Sonarr search, digs in when something went wrong):
- On landing they cannot tell in two seconds whether they need to act at all. They own 1080p FLOS, there are three 2160p releases "better than yours": is this screen telling them to upgrade? A one-line verdict under the header ("4 releases beat yours; best: 2160p FLUX, 8.9 GB, PHD") would answer it.
- The view looks like a trading terminal for a task they do maybe once a week.

## Minor observations

- The poster placeholder is a flat green block; with real art the header gets even busier.
- Release names are the most identifying data and are the dimmest text in the row.
- Source column says WEB-DL on all ten rows; hide a column when every row has the same value.
- "YOU OWN" line packs eight facts in one string; "seeding 31h of 120h" also repeats in the OWNED row's hit and run cell.
- "Fri 21:00" and "Fri +7d" in the episode strip use two date formats.
- Top-right "rTorrent · 3s ago" is tiny and low contrast; it duplicates the dock's "live from rTorrent".

## Questions

1. Why is the default selected row the second one (green, BHD) and not the purple best row? If the app already prefers it, say why on the row; if not, select the best row.
2. Does the owner ever switch episode from inside this view, or always come here from the episode row on the overview? If the latter, the episode strip can go.
3. Would the owner accept the downloads dock as a collapsed one-line summary on detail views, keeping it fully open only on the overview and Downloads page?
