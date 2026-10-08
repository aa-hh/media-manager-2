# Critique: Desktop / Downloads: remove (frame oeZxo)

Assessment A only (design review), from the 1440x900 screenshot. Read-only.

## Design specificity verdict

Specific to this product. The remove panel could only belong to a private-tracker seedbox tool: it names the tracker (BHD), its 120h rule, hours seeded so far, the ratio alternative, and when removal becomes safe. The Sonarr rejection reason is quoted word for word. Nothing here is a generic admin template. The weakness is volume: the panel opens inside a full-strength, 11-column, 11-row table whose other rows keep their own actions and notes, so the one decision on screen has to fight for attention.

## Nielsen heuristics

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Live speeds, progress, per-row status words, "safe to remove in 3d 7h". Which row has focus is shown only by a faintly lighter band. |
| 2 | Match with the real world | 3 | Uses Sonarr's words (blocklist, import, queue). "Remove from downloads" versus "Remove from rTorrent" is a fine distinction the owner must parse every time. |
| 3 | User control and freedom | 3 | Esc cancels; safe options preselected. Once confirmed, nothing says whether the blocklist or file delete can be undone. |
| 4 | Consistency and standards | 2 | S means "blocklist and search again" in the panel and "search again" on the Silo row. Footer still lists row keys (P, G, M, 1 2 3) that are irrelevant while the panel is open. Chosen option is a white filled chip; the commit button is also a white filled chip. |
| 5 | Error prevention | 3 | Safe default (keep seeding), red hit and run label, commit button restates the full choice. "Remove from rTorrent and delete its files" gets no extra guard even while hit and run risk is shown. |
| 6 | Recognition rather than recall | 3 | Every option shows its key. Cost is key-hint noise (see issues). |
| 7 | Flexibility and efficiency | 4 | Whole flow is keyboard: X, K/R, B/S/N, Enter. |
| 8 | Aesthetic and minimalist design | 2 | Eight status counts in the header, a caption, 11 boxed quality cells, four other rows with their own inline actions, two other rows with explanation lines, a full key list in the footer, and three sentences of hit and run numbers. |
| 9 | Recognise, diagnose, recover from errors | 3 | Import blocked row quotes Sonarr and names the existing file and score. Good. |
| 10 | Help and documentation | 3 | Inline explanations replace docs; panel subtitle explains what Sonarr does. |
| | **Total** | **29 / 40** | **Good** (low end) |

## Cognitive load

Failures (4 of 8, high):

- Single focus: fails. The panel sits mid-table; rows above and below stay full brightness with "grab now" (x2), "resume", "search again" and two grey explanation lines.
- Visual hierarchy: fails. The red HIT AND RUN RISK label and the 0-seeder red figure on The Brutalist are the only red on screen and compete equally.
- One thing at a time: fails. The Shogun row offers "M import as second version" directly above a panel about removing it; two different resolutions for the same item are shown at once with no link between them.
- Progressive disclosure: fails. Ratio, custom formats and score stay visible for every row during a remove decision that uses none of them.

Passes: chunking within the panel (two labelled groups), grouping, working memory (everything needed is on screen), minimal choices per decision.

Decision points over 4 visible options: none inside a single group (2 and 3). The panel as a whole shows 7 keyed controls (K, R, B, S, N, Enter, Esc), plus the M action on the row just above, plus 7 footer hints: 15 key labels visible at the moment of one decision.

## What's working

1. The commit button restates the outcome in plain words ("Remove from downloads, keep seeding, blocklist"). The owner confirms a sentence, not a combination of toggles.
2. Hit and run advice is concrete and actionable: hours met, rule length, the ratio alternative, and a countdown to safe removal. This is Product Principle 2 made visible.
3. Inline panel instead of a modal keeps the row's context (status, ratio, Sonarr's reason) in view, matching the direction contract's refusal of hidden status.

## Priority issues

**P1. The table does not step back when the panel opens.**
What: 10 other rows keep full contrast, their inline actions and their explanation lines.
Why: The owner came here to make one decision; the eye is pulled to "grab now", the red 0, and the Brutalist and Silo notes.
Fix: While the remove panel is open, dim every other row to the secondary text tone, hide their inline actions and explanation lines, and collapse the columns the decision does not use (custom formats, score). Restore on Enter or Esc.
Command: `/impeccable distill`

**P1. The footer key list shows the wrong keys.**
What: Footer lists move, open title, pause, grab now, manual import, remove, filter. None apply inside the panel; the panel's own keys are drawn inline as well.
Why: Repeated chrome that is wrong in this state, and it doubles key-hint noise. Also the S collision (panel versus Silo row) suggests row keys might still fire.
Fix: Make the footer context-aware: while the panel is open it shows only "Enter remove, Esc cancel". Drop the inline Enter/Esc chips on the buttons, or drop them from the footer, not both. State in the design that row keys are inactive while the panel is open.
Command: `/impeccable clarify`

**P2. Hit and run block says the same thing three ways.**
What: Red label "HIT AND RUN RISK", then "Keep seeding: 41h of BHD's 120h rule met. Removing now risks a hit and run.", then "Ratio 0.47, BHD accepts 1.0 instead. Safe to remove in 3d 7h at the current upload rate.", then "recommended" on the Keep seeding chip.
Why: Four signals for one recommendation; the line wraps wide across the screen.
Fix: One line: red label, then "41h of 120h seeded, or ratio 0.47 of 1.0. Safe to remove in 3d 7h." Keep "recommended" on the chip; drop the "Keep seeding:" prefix and "Removing now risks a hit and run" (the red label already says it).
Command: `/impeccable distill`

**P2. Two competing resolutions for one item.**
What: "M import as second version" sits on the Shogun row directly above "Remove Shogun from downloads", and the default blocklists the release.
Why: For an import blocked only because it is "not an upgrade", importing as a second version may be what the owner wants; blocklisting a release they may have hand-picked cuts against Principle 1 (the owner's choice wins).
Fix: Put "import as second version" as an option inside the panel header ("or press M to import it as a second version instead"), and hide the row-level M while the panel is open. Reconsider "Blocklist only" as the default when the release was grabbed by hand.
Command: `/impeccable clarify`

**P3. Deleting files under hit and run risk has no extra guard.**
What: R (remove from rTorrent and delete its files) is one keypress from Enter while the panel says removal risks a hit and run.
Fix: When R is chosen and the rule is unmet, turn the commit button red and change its text to "Remove and delete files, hit and run risk". No extra dialog.
Command: `/impeccable harden`

## Persona red flags

- Alex (power user): Fast path is fine. Ambiguity over whether row keys (S, P, G) still fire while the panel is open; S means two things on screen.
- Sam (accessibility): Grey secondary text (subtitles, "cancel", group labels RTORRENT and BLOCKLIST, the ratio line) is small and low contrast on near-black; likely under 4.5:1. Selected versus unselected option differs only by fill, with no check mark or text change. Focused row is marked only by a slight background shift.
- Owner on a normal evening: Arrives because Shogun says "import blocked". Has to read past eight header counts and three other problem rows (stalled, failed, two delayed) to find the one decision. The panel itself is clear once found; the surrounding table makes it feel like a control room.

## Minor observations

- Header count line (11 items, 3 downloading, 2 delayed, 1 stalled, 1 import blocked, 1 importing, 1 paused, 1 queued, 1 failed) is eight numbers; the status column already shows each. Keep only counts that need attention (stalled, import blocked, failed), and only when non-zero.
- Caption "live from rTorrent, plus releases Sonarr and Radarr are holding back" is useful once; consider showing it only when the list is empty or on hover of the title.
- Quality cells are outlined boxes on all 11 rows; the outline adds 11 frames that carry no meaning. Plain text in the same column reads the same.
- Panel title "Remove Shogun S01E10 from downloads" repeats the title from the row directly above; "Remove from downloads" is enough.
- Group labels RTORRENT and BLOCKLIST are uppercase tracked labels; the option text already says rTorrent and blocklist.

## Questions

1. When an import is blocked only because it is "not an upgrade", is remove the expected action, or should the panel lead with import as second version?
2. While the remove panel is open, should the rest of the table and its keys be inactive? The design does not say.
3. Should the default blocklist choice change when the release was grabbed by hand (a manual download)?
