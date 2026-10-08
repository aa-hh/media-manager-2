Method: single-context, Assessment A only (design review from the 1440x900 screenshot; brief asked for Assessment A, no detector run, pen file not opened)

# Critique: Desktop / Delete movie (XX6W9)

## Design specificity verdict

Specific to this product. The panel lists each version with its file, its tracker, hours seeded against that tracker's hit and run rule, the ratio, and a per-torrent recommendation, then offers Radarr's own choices (remove, keep unmonitored, list exclusion). No other product could use this panel unchanged. It is the clearest expression of principle 2 ("never risk a hit and run") in the prototype.

The clutter comes from what surrounds the panel. The panel opens inside the full movie overview, so the poster, description, three header action buttons, the six-row results list, five footer key hints and the three-row live downloads dock all stay on screen and compete with a destructive decision.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Confirm button spells out the outcome ("Delete 2 files · remove 1 torrent · keep 1 seeding"). Missing: how much disk space is actually freed, since the 720p file stays on disk as the seeding torrent's file. |
| 2 | Match system / real world | 3 | Glossary words used correctly (version, tracked by Radarr, second version, hit and run). "ITS TORRENT" heading and grey "switch" label read awkwardly. |
| 3 | User control and freedom | 3 | Esc cancels; safe defaults. No undo after Enter. |
| 4 | Consistency and standards | 2 | Keys 1 and 2 mean "switch torrent choice" in the panel and "filter quality" in the footer hint list. Enter means "open" in the footer and "delete files" in the panel. Two Cancel controls. |
| 5 | Error prevention | 2 | Defaults follow the recommendation (good), but X then Enter deletes 9.6 GB of files with no second step, and Enter is the same key the user presses all day to open things. |
| 6 | Recognition rather than recall | 3 | Every option shows its key and a one-line consequence. The REMOVE / KEEP SEEDING boxes look like buttons that would act, not like the current choice. |
| 7 | Flexibility and efficiency | 4 | Whole decision is keyboard-reachable, one key per choice. |
| 8 | Aesthetic and minimalist design | 1 | About 17 key hints visible at once; the hit and run row says the same thing three times; unrelated downloads dock and results list stay at full weight; dead band of about 120px between panel and dock. |
| 9 | Error recovery | 2 | Nothing shown for a failed file delete or a torrent removal that rTorrent rejects. |
| 10 | Help and documentation | 3 | Grey helper text beside each Radarr option explains the consequence in place. |
| **Total** | | **26/40** | **Acceptable** |

## Cognitive load

Failures (4 of 8, high load):
- Single focus: header actions (Search automatically, Pick a release), poster and description, results list, footer key list and downloads dock all sit beside a destructive decision.
- Visual hierarchy: two white filled buttons on screen, "Search automatically" in the header and the delete confirm. The header one is higher and reads as the primary action.
- Minimal choices: the decision point shows 2 torrent switches, 2 Radarr radio options, 1 checkbox, the confirm and 2 cancels (8), plus 3 header buttons and 6 results that remain clickable.
- Progressive disclosure: footer hints for search, move, open, grab selected release and filter quality are shown during a delete where none of them apply.

Passes: grouping (version table, then "In Radarr", then the confirm bar), working memory (all facts are on the panel).

## Emotional journey

The high-stakes moment gets real reassurance: red "HIT AND RUN RISK" and a pre-chosen "keep seeding" on the risky torrent. The ending (confirm button summarising exactly what will happen) is strong. The noise around it weakens the calm the panel tries to create.

## What's working

1. The confirm button is a sentence of outcomes: "Delete 2 files · remove 1 torrent · keep 1 seeding". The owner reads the result before pressing anything.
2. Per-torrent recommendations default to the safe answer, and red appears only on the one risky row, matching the colour rule that red means risk.
3. Each Radarr option carries its consequence in plain words ("Radarr won't grab it again on its own"), so no one needs to know Radarr's internals.

## Priority issues

**[P1] Clashing keys on the same screen**
- What: 1 and 2 switch torrent choices in the panel but "filter quality" in the footer list; Enter deletes in the panel but "opens" in the footer list.
- Why: a power user moving fast will hit Enter expecting the footer meaning; a keyboard-first product cannot have one key mean two things on one screen.
- Fix: while the panel is open, replace the footer key list with nothing (the panel already labels its own keys). Use a deliberate key for the destructive confirm, for example Shift+Enter or D, and keep plain Enter inert or bound to Cancel.
- Command: /impeccable harden

**[P1] Destructive confirm is one ordinary keypress away**
- What: X opens the panel, Enter deletes 9.6 GB. No undo, no failure state.
- Why: files deleted from the library folder are gone; the 1080p torrent is also removed.
- Fix: confirm key as above; after confirm, show a short result row in place of the panel ("Deleted 2 files, removed 1 torrent, 720p torrent still seeding") with any failure shown in red on its line.
- Command: /impeccable harden

**[P1] The delete panel shares the screen with three unrelated jobs**
- What: header buttons, poster and description, results list at full brightness, footer key list, and the three-row downloads dock (about 130px) stay on screen.
- Why: this is the owner's clutter concern in its sharpest form; a destructive decision should be the only bright thing.
- Fix: while the panel is open, hide the header action buttons and description (keep title and poster), dim the results list, collapse the downloads dock to one line ("Downloading 3 · 41.6 MB/s"), and remove the footer key list. Close the dead band so the confirm bar sits near the bottom.
- Command: /impeccable distill

**[P2] The hit and run row says the same thing three times**
- What: the 720p row shows "HIT AND RUN RISK", then "Keep seeding: 18h of PrivateHD's 72h rule met (or ratio 0.9)", then "Removing the torrent now risks a hit and run", next to a "Torrent seeding vs rule" column that already shows "18h of 72h, ratio 0.31 of 0.9".
- Why: four statements of one fact double the row height and bury the choice.
- Fix: merge the "Torrent seeding vs rule" and "Recommendation" columns into one: red cell "Hit and run risk · 18h of 72h, ratio 0.31 of 0.9". Drop the two prose lines. Same for the safe row: "Rule met · 212h of 72h".
- Command: /impeccable distill

**[P2] Torrent choice looks like a button, not a state**
- What: "REMOVE" and "KEEP SEEDING" boxes with a grey "switch" and key 1 or 2 next to them.
- Why: it is unclear whether pressing the box acts now or shows the current choice.
- Fix: a two-part toggle "Keep seeding | Remove" per row with the chosen side filled, and rename the column to "Torrent".
- Command: /impeccable clarify

## Persona red flags

**Alex (power user):** presses Enter out of habit and deletes; reads "1 2 7 filter quality" in the footer and "1 switch" in the panel and cannot trust either; two Cancel controls (top right "Esc cancel" and bottom "Cancel Esc").

**Sam (accessibility):** helper text ("Radarr stops monitoring it and forgets it", "switch", "follows each torrent's recommendation") is small mid-grey on near-black and likely below 4.5:1 contrast; the radio and checkbox are small; the safe/risky difference on the safe row rests on the white "REMOVE" fill versus outline, which a screen reader would need named as "selected".

**The owner on a normal evening (mostly monitoring, digs in when something has gone wrong):** wants to clear out an old movie and move on. Has to read a five-column table, two Radarr choices and a list exclusion. Will wonder whether 9.6 GB is really freed, when the 720p file stays on disk as the seeding torrent. The downloads dock pulls the eye down to Severance progress mid-decision.

## Minor observations

- "both files leave the library folder" and "9.6 GB" suggest 9.6 GB is freed; with the 720p torrent kept, about 3.4 GB stays on disk. Show "frees 6.2 GB now, 3.4 GB when the 720p torrent is removed".
- "hardlink to the torrent's file" is repeated on both rows; say it once in the panel heading line.
- "Add list exclusion" should look disabled when "Keep it in Radarr, unmonitored" is chosen, if it only applies to removal.
- The highlighted "Delete movie" header button duplicates the panel's own "DELETE MOVIE" heading.
- "follows each torrent's recommendation" beside the confirm is useful only once the owner overrides a choice; show it only then ("1 choice differs from the recommendation").

## Questions

1. Should the delete panel replace the movie overview entirely while open, so the poster, description and header buttons leave the screen?
2. Does the downloads dock need to be on every screen, or only on the overview and the downloads page, with a one-line count elsewhere?
3. Can the owner delete one version from here, or is per-version delete a separate flow? The panel title says "Delete movie" but the table invites per-row decisions.
