# Critique: Desktop / TV overview: monitoring (vIwpS)

Assessment A only (design review), from the 1440x900 screenshot. The detector was not run, as the brief asked.

## Design specificity verdict

Partly specific. The near-black ground, square cells, tabular figures, second-version rows under their episode, "seeding PHD 4h of 72h" and "below cutoff · manual download" belong to this product and no other. But the timing-tower idea from the direction contract has gone missing on this screen: there is no colour at all, so nothing reads at a glance. White fill now means five different things (primary button, current monitoring option, active season tab, ON chip, quality chip), and that turns the screen into an even grey field of boxes. It reads as a dense admin table more than as a live board.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Live progress on episode 7 and in the dock is good. "Future episodes · CURRENT" is wrong-looking: aired episodes 1, 3, 4, 7, 8 are ON, so the label no longer describes what is watched. |
| 2 | Match with the real world | 3 | Sonarr's own option names plus a plain one-line description each. "+2 versions", "PHD", "BHD" assume knowledge, which suits the owner. |
| 3 | User control and freedom | 3 | Esc closes, Enter applies, nothing changes until applied. No sign of undo after applying. |
| 4 | Consistency and standards | 2 | White fill carries five meanings. ON/OFF looks different in season tabs and episode rows. Key hints appear in four styles (button key caps, panel header, Space row, sidebar list). |
| 5 | Error prevention | 2 | Applying an option will reset the three episodes set OFF by hand (2, 5, 6) and Season 1's OFF, with no warning. Delete icons sit on versions still inside a 72h hit and run window with no red. |
| 6 | Recognition rather than recall | 3 | Every option and its key is visible. |
| 7 | Flexibility and efficiency | 4 | 1 to 9 plus Enter, Space toggles, [ and ] between shows, a key for every header action. |
| 8 | Aesthetic and minimalist design | 1 | Around 60 boxed elements compete equally. Hints, dock and sidebar repeat information already on screen. |
| 9 | Error recovery | 2 | "below cutoff · manual download" names the state but not what to do about it; nothing else to judge on this screen. |
| 10 | Help and documentation | 3 | Inline descriptions under every option are the right kind of help. |
| **Total** | | **26/40** | **Acceptable** |

## Cognitive load

Failures (5 of 8, high load):
- Single focus: the monitoring panel opened, but the header's white "Search monitored" button, the downloads dock, and the sidebar hint list still pull at the eye.
- Chunking: 9 monitoring options in one 3x3 block with equal weight.
- Visual hierarchy: the panel's current option, the active season tab, the primary button and eight ON chips all share the same white fill.
- Minimal choices: see decision points below.
- Progressive disclosure: per-row search and details icons (16 buttons), all key hints and the full dock show at all times.

Decision points over 4 visible options:
- Series monitoring: 9 options.
- Header actions: 7 buttons plus previous and next show (9).
- Episode table: 2 icon buttons on every row, 16 for 8 episodes, plus 2 delete icons.
- Keyboard hints: 5 in the sidebar, 3 in the panel header, 1 on the season row, 7 key caps on buttons, 1 in search. 17 key hints on one screen.

## Strengths

1. Monitoring is edited where its effects show: options on top, season toggles, then episode ON/OFF in the same view. No modal, matching the owner's decision for inline detail.
2. Each option carries a one-line plain description ("aired in the last 90 days, plus future"), so the owner never has to remember Sonarr's definitions.
3. Second versions as indented child rows with their own seeding countdown and delete icon put version and hit and run state exactly where they are needed.

## Priority issues

**[P1] The screen shows everything at once, so the job of the moment is unclear.**
Why: with the monitoring panel open, the owner's one task is "pick an option and see what it does to the episodes". The header buttons, the dock with The Bear and Andor, the sidebar hint list and 16 row icons all compete at the same weight. This is the owner's "extremely cluttered" complaint in its purest form.
Fix: while the panel is open, dim the header action row (keep only Monitoring active), collapse the downloads dock to a one-line summary ("3 downloading · 41.6 MB/s"), and remove the sidebar keyboard list entirely (key caps on buttons already teach the same keys). Show row search and details icons only on the focused or hovered row.
Command: /impeccable distill

**[P1] Applying an option silently overwrites hand-set episode and season choices.**
Why: Sonarr's series monitoring options reset episode monitored states. Episodes 2, 5 and 6 and Season 1 were set OFF by hand. One Enter wipes that, and the screen gives no warning. It also explains the confusing "Future episodes · CURRENT" label that no longer matches the table.
Fix: label the current state honestly ("Future episodes, 5 changed by hand"). When the focused option would change any episode, show a preview inline above the table ("Applying All episodes turns ON: S1 1-9, S2 E2, E5, E6") and highlight the affected rows before Enter.
Command: /impeccable harden

**[P1] White fill means five things and there is no colour meaning at all.**
Why: the direction contract reserves solid colour for comparison and risk. Here, the eye cannot tell the selected option from the primary button from an ON chip from a 2160p chip. The two second versions inside a 72h hit and run window sit next to a delete icon with no red, though "Never risk a hit and run" is product principle 2.
Fix: reserve solid white for the single focused or current item. Make ON a small filled dot or plain "on" text and OFF muted text, with no box. Drop the box around quality chips (plain "2160p" in tabular figures). Mark "seeding PHD 4h of 72h" and its delete icon red.
Command: /impeccable quieter, then /impeccable colorize

**[P2] 9 options in a flat 3x3 grid.**
Why: 9 equal choices is past working-memory limits, and the grid order (All, Future, Missing / Existing, Recent, Pilot / First season, Latest season, None) has no visible grouping.
Fix: keep all 9 (the owner chose Sonarr's full set) but as a single column grouped by intent: "Going forward" (Future, Missing, Recent), "What's on disk" (All, Existing), "Part of the show" (Pilot, First season, Latest season), then None set apart. A vertical list also makes the 1 to 9 keys read top to bottom.
Command: /impeccable layout

**[P2] "meets profile" repeated on six rows.**
Why: the normal case is printed as loudly as the exceptions, so episode 8's "below cutoff · manual download" and episode 7's progress get lost.
Fix: leave the status cell empty when an episode meets its profile; print only exceptions (downloading, below cutoff, manual download, missing, seeding window).
Command: /impeccable distill

## Persona red flags

**Alex (power user):** Fast path is excellent (M, 1 to 9, Enter). But Alex already knows the keys, so the 17 always-on hints are pure noise for him. He will also lose hand-set episode states on Enter with no preview.

**Sam (accessibility):** Descriptions like "every episode except specials" and the column headers are small dim grey on near-black, likely under 4.5:1. ON vs OFF differs only by fill vs outline at about 30px wide. The CURRENT tag and the white fill do the same job; a screen reader needs the state announced as "selected", not only shown. Focus on the 3x3 grid has no visible focus ring distinct from "current".

**The owner on a normal evening** (monitors shows, lets Sonarr and Radarr search, digs in only when something breaks): opens Severance to check Season 3 is watched. Answer is there ("Season 3 not aired · ON") but buried in a row of three tabs at the same weight as everything else. Gets 9 options, 7 header buttons, 3 unrelated downloads and a hint list for a yes or no question. On this screen nothing has gone wrong, yet it looks like a control room mid-incident.

## Minor observations

- Left results column is 340px wide and mostly empty except for the hint list at the bottom; with 2 results it could shrink or collapse once a title is open.
- "Severance S02E07" appears in the dock and on episode row 7 with the same 64% and 6m. Hide the current show's torrents from the dock, or drop the dock on this screen.
- Download speeds in the top bar, a "Downloads 3" count in the nav, and the dock show the same live state three times.
- "Season 2 7/10 · +2 versions 206 GB ON": five facts in one tab label. Move size and versions to the season heading.
- Season 1 says OFF though all 9 episodes have files; correct, but the reader may take OFF as "missing". "not watched" or a muted dot would read better.
- The poster placeholder is a flat green block; fine for a prototype, but it is the strongest colour on screen and pulls the eye.
- "previous show" and "next show" in the top right duplicate the sidebar hint "previous or next show".

## Questions

1. Should the downloads dock appear on title overview screens at all, or only on the Downloads page with a one-line summary elsewhere?
2. Would the owner accept key hints shown only on hover or after pressing "?", given the key caps already sit on every button?
3. Should applying a series monitoring option keep episode-level choices made by hand (a departure from Sonarr), or only warn before resetting them?
