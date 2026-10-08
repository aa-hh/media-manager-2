# Critique: Phone / Pick a release (fSkBY, 390x844)

Assessment A only (design review). Judged from the screenshot plus PRODUCT.md, CONTEXT.md, the direction contract and docs/design/sonarr-radarr-review.md. The read-only pen.dev inspection returned no output, so sizes below are estimated from the screenshot.

## Design specificity verdict

Specific to this product. Colour cells meaning best / better than yours / not better / risk, tracker hit and run rules inline ("120h or 1.0", "met · 212h"), the "YOU OWN" line and the "cooldown" warning could not be lifted into another app unchanged. The phone version is lighter than a desktop timing tower would be and mostly reads well. The problems are what it hides (cache age, the replace or second version choice) and the cryptic short forms, more than raw clutter.

## Nielsen heuristics

| # | Heuristic | Score | Why |
|---|---|---|---|
| 1 | Visibility of system status | 2 | No age of the cached results and no "search again" control, although the owner decided the view opens on cached results with their age. Live downloads bar at the bottom is good. |
| 2 | Match between system and real world | 2 | "214 S", "BHD/PHD/BLU", "120h or 1.0", "+1850" all need decoding. Fine for the owner at a desk, harder at a glance on a phone. |
| 3 | User control and freedom | 2 | Back arrow exists. What happens after Grab (replace or second version, confirm, undo) is not visible on this screen. |
| 4 | Consistency and standards | 2 | The meaning colour sits on the resolution cell, so it reads as "2160p is purple, 1080p is green". The cooldown row keeps a green cell while carrying a red risk tag. |
| 5 | Error prevention | 2 | Six Grab buttons about 28px tall stacked about 64px apart; a mis-tap grabs the wrong release. |
| 6 | Recognition rather than recall | 2 | No key for the four colours; meaning must be remembered. |
| 7 | Flexibility and efficiency | 3 | Resolution filter chips with counts are quick and thumb friendly. |
| 8 | Aesthetic and minimalist design | 2 | Search box, poster block, chips, 7 two-line rows, 6 outlined buttons and the dock all compete; primary job (pick one) is clear but the screen is busy for one hand. |
| 9 | Help users recognise and recover from errors | 3 | Rejection reason ("over 60 GB") and "cooldown" shown inline, in words. |
| 10 | Help and documentation | 1 | Nothing explains the short forms or colours. |
| | Total | 21/40 | Acceptable band (20 to 27). |

## Cognitive load

Checklist failures:
- Too many visible elements at once: 10 releases across 7 visible rows, each with about 9 data points (resolution, source, group, size, seeders, tracker, hit and run rule, profile result, score) plus a button.
- Relies on memory: colour meanings and the abbreviations.
- Competing calls to action: 6 identical Grab buttons, one filled because of a keyboard selection idea that has no meaning on touch.
- Non-essential chrome: the search field at the top is for a different job (finding a title).

Decision points with more than 4 visible options: the release list itself (7 grabbable rows visible, 10 total). Acceptable for this task, but the per-row buttons make each one a separate competing action.

## Strengths

1. "YOU OWN 1080p WEB-DL · 6.2 GB · PHD" under the title gives the comparison baseline before the list starts.
2. Status in words, inline: "cooldown", "over 60 GB", "OWNED", "met · 212h". No hover needed, matching the owner's decision.
3. Filter chips with counts ("2160p 4") and the slim live downloads bar are the right weight for a phone.

## Priority issues

1. **[P1] Cache age and "search again" missing.**
   What: nothing tells Casey how old these 10 results are, and there is no control for a fresh search.
   Why: the owner decided this view opens on cached results with their age. Seeders and cooldowns go stale; a quick grab on stale data is the exact mistake a distracted user makes.
   Fix: one line above the chips, "Results from 2 h ago · Search again", with Search again as a text button. Show progress in that line during the 20 second search.
   Command: /impeccable harden

2. **[P1] Six small Grab buttons per screen; replace or second version choice not shown.**
   What: every row carries its own outlined button about 64x28px. The owner owns a copy, so a grab must ask replace or second version, but nothing here shows where that happens.
   Why: buttons under 44px tall, close together, invite mis-taps; they also make up most of the visual noise on the right edge.
   Fix: drop per-row buttons. Tapping a row opens a bottom sheet at thumb height with the full release name, audio, HDR, release history, and two large buttons: "Replace your 1080p WEB-DL" and "Keep as second version". This also gives room for the details the list leaves out.
   Command: /impeccable distill, then /impeccable adapt

3. **[P2] Meaning colour sits on the resolution label.**
   What: purple, green and yellow fill the "2160p"/"1080p" cell, so the colour looks like it belongs to resolution. The cooldown row keeps green.
   Why: Casey glancing down reads "green 1080p" as a property of 1080p, not "better than yours". The risk row reads as both good and bad.
   Fix: put the meaning colour on a narrow bar at the row's left edge, keep resolution as plain text, and turn the bar red when any risk applies (risk outranks better). Add a one-line key, tappable, under the chips or in the sheet.
   Command: /impeccable colorize

4. **[P2] Cryptic short forms on the second line.**
   What: "214 S", "120h or 1.0", "+1850", "BHD".
   Why: at arm's length on a phone, in a hurry, decoding costs more than the space saved.
   Fix: "214 seeders"; "seed 5 days or 1.0 ratio" (or "seed 120 h"); move the score into the sheet and keep only the tick or cross plus reason in the row. Tracker short forms can stay since the owner uses them, but spell them out in the sheet.
   Command: /impeccable clarify

5. **[P3] Search field and filled "selected" row carried over from desktop.**
   What: the top bar is a search box for titles; the second row has a filled white Grab because it is the keyboard selection.
   Why: on a touch screen the selection has no meaning and draws the eye to an arbitrary release; the search box takes the top bar from the title.
   Fix: top bar becomes back arrow + "Dune: Part Two" title, with a search icon. Shrink the poster block into that bar plus the "You own" line. Drop the selected-row highlight on phone.
   Command: /impeccable adapt

## Persona red flags

- Casey (distracted, one-handed): Grab buttons small and stacked; interrupted mid-choice, returns with no idea how old the results are; the colour key must be remembered; replace or second version choice unknown before tapping.
- Alex (power user): wants the score and release history; the row hides history and freeleech flags the owner asked for. The bottom sheet fixes this without cluttering the list.
- The owner on a normal evening, checking a show that went wrong: "cooldown" in red is exactly the right signal; but the green cell on that row and the lack of cache age undercut trust that the list is current.

## Minor observations

- Grey second-line text (tracker, rule) looks around 11px with low contrast on graphite; check it meets 4.5:1.
- Poster placeholder is a flat purple block, which collides with purple meaning "best".
- "–" in the cooldown row's button slot gives no reason; "Not grabbable: tracker cooldown" in the sheet is clearer.
- 3 of 10 releases are off-screen with no hint of how many remain.
- "OWNED" on the yellow row is clear; consider pinning the owned release at the top as the baseline instead of in the list order.

## Questions

1. Should Grab on the phone always open a sheet (one extra tap, safer, shows replace or second version), or stay one tap per row?
2. Can the meaning colour move off the resolution cell to a row edge bar, or is the coloured resolution cell a firm part of the timing tower look?
3. Do you read "120h or 1.0" instantly, or would "seed 5 days or 1.0 ratio" be worth the width on the phone?
