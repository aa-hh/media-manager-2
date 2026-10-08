# Critique: Desktop / Delete second version (rSYPn)

Assessment A only (design review), single context, from the 1440x900 screenshot plus PRODUCT.md, CONTEXT.md, the direction contract and docs/design/sonarr-radarr-review.md. No detector run.

## Design specificity verdict

Specific to this product. The delete step is built around the thing only media-manager-2 cares about: whether removing the torrent breaks PrivateHD's hit and run rule, with the hours and ratio left. The inline panel under the versions row (no modal) follows the owner's "expand inline, Esc closes" decision, and the red cell is used only for risk, as the contract says. A generic file manager could not reuse this screen.

The problem is volume. The one decision on screen (remove the torrent or not) is surrounded by the full movie overview, the results list, a keyboard hint list, the speed readout and three live download rows, and the panel itself says the same thing three or four times.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Live seeding hours and ratio shown. Nothing says where the deleted file goes (gone for good, or a trash folder). |
| 2 | Match with the real world | 3 | Uses the glossary words. But the panel calls the same thing "second version", "library copy" and "file" within four lines. |
| 3 | User control and freedom | 3 | Enter picks the safe answer, Esc and Cancel back out. No undo after the delete. |
| 4 | Consistency and standards | 2 | Esc cancel appears twice (top right of panel and the Cancel button). Left hint list still shows "G grab selected release" while a delete is open. Two different seeding readings on screen (Seeding row 212h ratio 1.4 for the 1080p file, panel 18h ratio 0.31 for the 720p) with nothing tying each to its file. |
| 5 | Error prevention | 3 | Safe answer is the Enter default and red marks the risky one. But the risky answer fires on a single R press, and its label "Yes, remove the torrent too" never says the file is deleted as well. |
| 6 | Recognition rather than recall | 3 | Every button carries its key. |
| 7 | Flexibility and efficiency | 4 | D, Enter, R, Esc: the whole delete is four keys or fewer. |
| 8 | Aesthetic and minimalist design | 1 | Recommendation stated four times; seeding progress stated three times; the panel sits mid-page with bright unrelated content above, beside and below it. |
| 9 | Error recovery | 2 | No word on what happens if the delete or torrent removal fails, and no way back once the file is gone. |
| 10 | Help and documentation | 3 | The recommendation explains the rule in plain words at the moment it matters. |
| **Total** | | **27/40** | **Acceptable** |

## Cognitive load

Checklist failures:
- Single focus: fails. The decision competes with the overview rows (Monitored, Quality profile, Your file, Seeding, Last search), each still at full brightness with their own actions (Unmonitor M, Change Q), plus Search automatically A and Pick a release I.
- Chunking: fails inside the panel. Header line, Library copy, Its torrent, Recommendation, then the question. The question the user must answer comes fifth, about 150px below the panel's start.
- Redundancy: fails. "Keep seeding" appears as the recommendation sentence, the "recommended" tag, the No button wording, and implicitly the red HIT AND RUN RISK cell plus "risks a hit and run on PrivateHD".
- Relevant chrome: fails. Left hint list (search, move, open, grab selected release, filter quality) and the downloads list have nothing to do with deleting.

Decision point with more than 4 visible options: yes. In the panel there are 3 buttons plus the second Esc cancel (4). Across the screen, about 14 key hints are visible at once (/, A, I, M, Q, D, Esc, Esc, Enter, R, the up and down arrows, Enter, G, 1 2 7) and about 11 clickable actions outside the panel.

## Emotional journey

This is the highest-stakes moment in the product: a wrong answer costs tracker standing. The panel handles the reassurance well (safe default, plain explanation). The ending is weak: no confirmation of what will happen to the file, and no result state is designed for after the press.

## Strengths

1. The safe answer is the Enter default and is the filled, prominent button; the risky one is outlined in red and needs a different key. Muscle memory of pressing Enter protects the user.
2. The recommendation gives real numbers: "18h of PrivateHD's 72h rule met (or ratio 0.9)", "54h of seeding left at the current pace". The owner can decide without opening rTorrent.
3. Inline under the versions row, no modal, keeps the user's place, matching the owner's decision for episode details.

## Priority issues

**[P1] The recommendation is said four times and the seeding progress three times.**
- Why: the owner said the design is cluttered; this panel is a clear case. The eye reads the same fact repeatedly before reaching the question.
- Fix: collapse the panel to three lines. Line 1, the question as the heading: "Delete the 720p FLUX file. Also remove its torrent?" Line 2, one sentence: "PrivateHD needs 54h more seeding (18h of 72h, ratio 0.31 of 0.9). Keep it seeding." with the red HIT AND RUN RISK cell at its start. Line 3, the buttons. Drop the "DELETE SECOND VERSION 720p WEB-DL FLUX 3.4 GB" header (repeats the versions row directly above), the Library copy and Its torrent rows (put the file name and torrent name behind a "details" toggle or on hover of the line), the "recommended" tag and the "risks a hit and run on PrivateHD" note.
- Command: /impeccable distill

**[P1] The rest of the screen stays at full strength while a destructive choice is open.**
- Why: the person who mostly monitors and only digs in when something is wrong lands here rarely and nervously; 5 overview rows, 6 results, 5 key hints and 3 download rows all compete with the one question.
- Fix: while the panel is open, dim everything outside it (overview rows, header actions, results list, downloads list) to the muted text colour and disable their keys. Hide the left keyboard hint list or swap it to the panel's own keys (Enter keep seeding, R remove torrent, Esc cancel). Collapse the downloads list to its one-line header "Downloading 3" for the duration.
- Command: /impeccable quieter

**[P1] The risky answer fires on one key and its label hides that the file is deleted too.**
- Why: "Yes, remove the torrent too" reads as if only the torrent goes. A stray R removes a torrent mid-rule with no undo and risks a hit and run.
- Fix: relabel both answers by outcome: "Delete file, keep seeding" (Enter) and "Delete file and torrent" (R). When the hit and run rule is not yet met, make R require a hold or a second press ("Press R again to confirm"), and only then. When the rule is met, a single R is fine.
- Command: /impeccable harden

**[P2] Two seeding readings on one screen with nothing tying them to their file.**
- Why: the Seeding row says "PrivateHD 212h ratio 1.4, hit and run rule met" (the 1080p file); the panel says 18h, ratio 0.31, at risk (the 720p). Same tracker, opposite verdicts, 200px apart.
- Fix: label the overview row "Seeding (1080p)" or fold seeding into each file's row (Your file, Second versions) so each reading sits next to the file it belongs to. Dimming from the issue above also helps.
- Command: /impeccable clarify

**[P2] No after-state and no word on recovery.**
- Why: the file deletion cannot be undone and the screen does not say so, or show what the versions row looks like afterwards, or what happens if rTorrent refuses the removal.
- Fix: add one muted line under the buttons: "The file is deleted for good." Design the after-state: the versions row replaced by "720p FLUX deleted, torrent still seeding (54h left)" for a few seconds, and an error state for a failed torrent removal.
- Command: /impeccable harden

## Persona red flags

**Alex (power user):** Fast path is good (D then Enter). Red flags: the R key fires the risky choice in one press, easy to hit when reaching for nearby keys; the left hint list still advertises G grab during the delete, so a habitual G could act on the background screen if keys are not captured by the panel.

**Sam (accessibility):** The small grey labels (LIBRARY COPY, ITS TORRENT, RECOMMENDATION) and the trailing notes ("recommended", "risks a hit and run on PrivateHD", "Esc cancel") are tiny and low contrast on near-black and likely below 4.5:1. The Yes button's danger is signalled mainly by a red outline, so a screen reader or colour-blind user relies on the label, which (see above) omits that the file is deleted. Focus order runs No, Yes, Cancel across about 1060px; the focus ring needs to be unmistakable on each.

**The owner on a normal evening (monitors, lets Sonarr and Radarr search, digs in when something goes wrong):** Came to tidy up a duplicate. Has to read four labelled rows before reaching the question, and sees a red HIT AND RUN RISK cell and a "hit and run rule met" line at the same time, for the same tracker. Likely reaction: hesitation and a re-read. The download speeds, results and keyboard hints add nothing for this person at this moment.

## Minor observations

- "Esc cancel" in the panel's top right and the Cancel (Esc) button: keep the button, drop the corner text.
- Cancel sits at the far right edge, about 350px from the other two buttons; group all three on the left.
- "Its torrent" is a fragment; "Torrent" is enough as a label.
- The "Delete version D" control on the selected versions row stays bright and active while its own confirm is open; show it as the pressed state or hide it.
- The last-results note next to Pick a release ("last results 14 min ago, fresh search takes ~20s") is irrelevant here and adds another line of grey text.

## Questions

1. Should the rest of the screen dim and lock while a delete is open, or does the owner want to keep reading the overview mid-decision?
2. When the hit and run rule is already met, should this step skip the question entirely and remove both file and torrent with a single confirm?
3. Does the downloads list need to be on this screen at all, or can it live only on the Downloads tab with a count in the top bar (already there as "Downloads 3")?
