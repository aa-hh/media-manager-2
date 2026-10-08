# Critique: Desktop / Delete: torrent seeding history unknown (d6TYkb)

## Design-specificity verdict
Specific to this product. The panel knows about hardlinks, Beyond-HD's 120 hour rule, rTorrent's finish time and Radarr list exclusions, and it picks a safe default (delete the file, keep the torrent). No generic dialog would carry this. The problem is volume: the same "we don't know the seed time" fact is said four times, and the panel sits inside a page that still shows the search results list, the movie header with three actions, a key hint list and the live downloads dock.

## Nielsen heuristics

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Seed state, ratio and finish time all shown. Disk space freed is not (see issue 2). |
| 2 | Match with the real world | 2 | "hardlink", "ratio 0.62 of 1.0", "list exclusion", "Its torrent" are tool words, not the owner's question ("is it safe to delete?"). |
| 3 | User control and freedom | 3 | Esc and Cancel present. Two cancel controls (top right and bottom right). |
| 4 | Consistency and standards | 2 | Three key hint styles in one panel (boxed letter before label, boxed letter after label, "[1] switch"). Uppercase badge "NOT SURE" vs sentence-case advice under it. |
| 5 | Error prevention | 3 | Default keeps the torrent seeding. But the torrent toggle is a label-looking box with a faint "switch", easy to miss. |
| 6 | Recognition rather than recall | 3 | Choices visible. "press 1 first to remove the torrent too" asks the owner to map a number to a control far to the right. |
| 7 | Flexibility and efficiency | 4 | Every choice on a key, Enter confirms. |
| 8 | Aesthetic and minimalist design | 1 | One movie, one file, one decision, delivered as a five-column table plus three detail rows plus a Radarr section plus a footer note. |
| 9 | Help users recover from errors | n/a | No error state on this screen. |
| 10 | Help and documentation | 3 | Inline explanations everywhere, arguably too many. |

Total: 24/36 (renormalised 27/40). Band: acceptable, with clear clutter problems.

## Cognitive load checklist failures
- Same fact repeated: "seed time unknown" (table), "NOT SURE" badge, "can't confirm Beyond-HD's 120h rule", "No seeding history for this torrent", then the "Seeding history: None..." row. Ratio is shown twice (table and Ratio row).
- A table with column headers for a single row. Five columns force a left-to-right scan of ~1,060px to read one decision.
- Decision point with more than 4 visible options: inside the panel the owner sees 7 controls (torrent toggle, 3 Radarr choices, primary button, Cancel, top-right Esc), plus 3 movie actions and 6 results rows still live behind it.
- Low-contrast grey helper text (Radarr explanations, "switch", "not met", "recommended · press 1 first...") at roughly 11px on near-black.
- Big empty band between the panel and the downloads dock, so the dock reads as part of the delete flow.

## Strengths
- Safe default. The primary button spells out the outcome: "Delete 1 file · keep the torrent seeding".
- Honest about uncertainty: it says why history is missing (torrent predates the app) and labels the finish time as an estimate instead of faking a number.
- Radarr choices state their consequence in one line each ("Radarr won't grab it again on its own").

## Priority issues

**P1. The panel says "unknown" four times and still makes the owner read a table.**
Why: the owner opens this to answer one question. The answer is buried in column four, and the detail rows below restate it.
Fix: replace the table and the three detail rows with one verdict block: "Keep the torrent seeding. Beyond-HD needs 120 hours or ratio 1.0; ratio is 0.62 and seed time before 28 Aug is unknown." Put file name, hardlink and the finish-time estimate behind a "Details" disclosure (Tab or `d`). Drop the "Seeding history" row; one sentence in the verdict covers it.
Command: `/impeccable distill`

**P1. Disk space freed is misleading.**
Why: the summary says "58.4 GB · the file leaves the library folder", but the file is a hardlink to the torrent's copy. With the recommended choice (keep seeding) the owner frees 0 GB. Someone deleting to make room will think it worked.
Fix: state it on the button line: "Delete 1 file · keep the torrent seeding · frees 0 GB until the torrent is removed". Show "frees 58.4 GB" only when the torrent toggle is switched to remove.
Command: `/impeccable clarify`

**P2. The torrent choice looks like a status label, not a control.**
Why: "KEEP SEEDING [1] switch" uses the same outlined-uppercase style as the read-only "NOT SURE" badge and the "ESTIMATE" chip. The footer then explains it ("press 1 first to remove the torrent too"), which is a sign the control does not explain itself.
Fix: make it a two-option radio group under the Radarr choices, "Torrent: Keep seeding (recommended) / Remove from rTorrent", same style as the Radarr group. Delete the footer hint.
Command: `/impeccable clarify`

**P2. Chrome around the panel competes with a destructive decision.**
Why: while deciding a delete, the screen still shows six search results, the movie header's three buttons, the left key hint list (5 hints, none relevant to the panel) and three live download bars with speeds moving. The moving bars pull the eye during the one moment that needs focus.
Fix: while the delete panel is open, dim the results column and movie actions, hide the left key hint list, and collapse the downloads dock to a single line ("3 downloading"). Remove the top-right "Esc cancel"; the Cancel button already shows Esc.
Command: `/impeccable distill`

**P3. Key hint styles disagree.**
Why: keycap before label (K, U, E), after label (A, I, X, Enter, Esc), and "[1] switch" with a word. Three patterns in one view add reading effort.
Fix: one rule: keycap after label, no extra words.
Command: `/impeccable polish`

## Persona red flags
- **Alex (power user):** fast path works (Enter). But "press 1 first" means the order of keys matters, and nothing on screen confirms the toggle flipped except the small box far right.
- **Sam (accessibility):** grey helper text fails contrast at its size. The "NOT SURE" state carries no colour and the advice is uppercase-badge plus small text; a screen reader would read a table header row for one row. The torrent toggle is not exposed as a toggle.
- **The owner on a normal evening:** wants "can I delete Dune safely, and will it free space?" Gets a five-column table and jargon (hardlink, ratio 0.62 of 1.0, list exclusion). Will likely press Enter and believe 58.4 GB was freed.

## Minor observations
- "Its torrent" reads as a typo; "Torrent" is enough.
- "Remove the movie from Radarr" selected by default for a "not sure" case is a bigger step than the rest of the panel's caution. Consider "Keep in Radarr, unmonitored" as default, or confirm the owner wants removal as default.
- "ESTIMATE" chip plus a full sentence explaining it: keep one. "~41 days ago (estimated from rTorrent)" is enough.
- Colour contract says red marks any hit and run risk. "Not sure" gets no colour, and "not met" is grey. Unknown seed time on a tracker with a hit and run rule is a risk; it should probably be red or at least not neutral.
- The movie header's "Delete movie" button stays highlighted, and its X key hint is still shown, while the panel is already open.

## Questions
1. Is the delete mainly done to free disk space? If yes, should "frees X GB" lead the panel?
2. Should "unknown seed time" count as a hit and run risk under the one-colour-one-meaning rule, and turn red?
3. Should the default Radarr choice in an uncertain case be "remove" or "keep, unmonitored"?
