# Critique: Desktop / Mark as failed (frame fs0ud)

Assessment A only (design review), single context, read from the 1440x900 screenshot plus PRODUCT.md, CONTEXT.md, the direction contract and the owner's screen decisions. The pen file structure was not inspected.

## Design specificity verdict

Specific to this product. The confirm step names the tracker (BeyondHD), the seeding hours against that tracker's hit and run rule, rTorrent, and recommends the choice that protects the account. No generic tool would say "keep it seeding in rTorrent; the blocklist does not need it removed". The visual language (near-black ground, square white cells, one red risk cell) follows the timing-tower contract.

Where it slips: the confirm step is the fifth level of nesting (top bar, results list, show header, season table, expanded episode, history, grab event, confirm box), and it gets about 180 of 900 pixels. The owner's decision "expand inline, no modal" is being honoured so literally that a destructive, account-affecting decision is drawn with the same weight as a history line.

## Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Hit and run state and seeding hours are shown at the moment of choice. The grab row being failed is the same release the history says imported at 08:12, and the screen never says so. |
| 2 | Match system / real world | 3 | Plain sentences. "Hardlinked", "grab", "below-cutoff" go unexplained; "grabs the best release from another tracker" is wrong (Sonarr may pick another release on the same tracker). |
| 3 | User control and freedom | 3 | Cancel on Esc is clear. But Esc is also bound to "Close" in the history header ten pixels above; which one fires is not obvious. No word on how to undo a mark as failed (remove the blocklist entry). |
| 4 | Consistency and standards | 2 | F appears twice (the grab row's "Mark as failed F" and the confirm button "keep seeding F"). Seeding is "1h of the 5-day hit and run rule" here but "41h of 72h" on the version rows. "recommended" floats as grey text outside its button. |
| 5 | Error prevention | 2 | "Mark as failed and remove torrent" is one key (R) away while a red HIT AND RUN RISK cell sits directly above it. The risky action gets a full-size outlined button. |
| 6 | Recognition rather than recall | 3 | Every action shows its key. Over-applied: the hints are everywhere, including ones irrelevant to this moment. |
| 7 | Flexibility and efficiency | 3 | Keyboard path is short: F, then F again. Good for the power user. |
| 8 | Aesthetic and minimalist design | 1 | Around 30 actionable things visible while the user decides between 3. The downloads dock, the left-hand key hint list, per-row icon pairs, trash icons and the season tabs all compete with the confirm box. |
| 9 | Error recovery | 2 | Copy explains what happens next, not how to reverse it. No mention of where the blocklist entry can be removed. |
| 10 | Help and documentation | 3 | Inline explanation is good and short enough. |
| **Total** | | **25/40** | **Acceptable** |

## Cognitive load

Failures (5 of 8, high):
- Single focus: the confirm box shares the viewport with the full season table, three unrelated downloads (The Bear, Andor) and the search results list.
- Visual hierarchy: the confirm box is set apart only by a 1px border and a slightly lighter fill; the white "Search season 2" button at the top is as loud as the recommended confirm button.
- Minimal choices: the dialog itself has 3 options, but the viewport offers about 30: 5 nav links, search box, Search season 2, 3 season tabs, 2 icon buttons on each of 5 episode rows, 2 trash icons, Search automatically, Pick a release, Close, Mark as failed, the 3 confirm options, and 5 key hints.
- One thing at a time: the history header actions (Search automatically, Pick a release, Close) stay live above an open confirm.
- Progressive disclosure: the left key hint list (search, move, open, grab selected release, filter quality) and the downloads dock show constantly; none apply to this decision.

Decision points with more than 4 visible options: the history header plus grab row (5 actions with keys: A, I, Esc, F, plus confirm keys F, R, Esc below), and the top bar (5 sections plus search plus 3 live figures).

## Emotional journey

The user arrives here because something went wrong (a bad grab). The screen answers the anxious question well in words ("your current file stays", "keep it seeding") but visually the moment is flat: the reassurance is grey body text in a box that looks like any other row. The peak (choosing safely) is undercut by a second big button that would cause a hit and run strike.

## What is working

1. The recommended choice is the safe one, and it is the filled white button and the default key. The H&R reasoning is given in one concrete sentence with real numbers.
2. Inline confirm within the history, as the owner decided: the user sees the exact grab (full release name, tracker, size, "automatic search") they are failing, so there is nothing to remember from another screen.
3. The single red cell is the only saturated colour on the screen, so the risk reads first. The colour rule is holding.

## Priority issues

**[P1] The confirm step is buried under unrelated chrome**
- What: the downloads dock (three unrelated torrents), the left key hint list, and the rest of the season table stay at full strength while a destructive choice is open. The dock also clips episode 7 in half.
- Why: the owner on a normal evening came here because something broke; they need one question on screen, not the whole app.
- Fix: while a confirm is open, dim everything outside the expanded episode (50% opacity, not interactive), and collapse the downloads dock to a one-line summary ("3 downloading, 41.6 MB/s") everywhere except the Downloads page. Drop the left key hint list entirely and show keys only on the buttons they trigger.
- Command: /impeccable distill

**[P1] "Remove torrent" is too easy to hit under a hit and run risk**
- What: R on a full-size button next to the recommended one, with the H&R warning above it.
- Why: one wrong key costs a tracker strike; the screen already knows the torrent has 1h of 5 days.
- Fix: when hit and run risk is present, show only "Mark as failed, keep seeding" and Cancel; put "remove torrent instead" as a small text link that asks a second confirm naming the strike. Move "recommended" inside the button or drop it once the risky choice is demoted.
- Command: /impeccable harden

**[P2] Duplicated keys and labels**
- What: "Mark as failed F" still shows on the grab row while the confirm (also F) is open; "Close Esc" and "cancel Esc" sit 200px apart; Search automatically (A) and Pick a release (I) appear in both the show header ("Search season 2 A") and the history header.
- Why: double bindings make the user stop and work out which one fires; this is the key-hint noise the owner flagged.
- Fix: hide the grab row's "Mark as failed" and the history header actions while confirm is open. One Esc target on screen at a time. Keep A and I in the show header only.
- Command: /impeccable quieter

**[P2] Per-row icon buttons repeat on every row**
- What: magnifier and list icons on every episode row, trash on every second version row, without labels.
- Why: 12+ identical icons add noise and give screen-reader and low-vision users no text; the expanded episode already exposes these actions.
- Fix: show row actions only on the focused or hovered row (and always on the expanded one), with text labels there.
- Command: /impeccable distill

**[P2] Copy accuracy and consistency**
- What: "grabs the best release from another tracker" is not what Sonarr does; seeding format differs between this box and the version rows; the screen does not say this grab is the file currently in the library.
- Fix: "Sonarr blocklists this release and searches again. Your current file (this release, imported 08:12) stays until a replacement imports." Use one seeding format everywhere: "1h of 120h".
- Command: /impeccable clarify

## Persona red flags

**Alex (power user):** Pressing F on the grab row and F again to confirm is quick. But Esc is ambiguous between cancel and closing the whole history; a fast Esc-Esc likely collapses the episode he was working in. R is one key from a tracker strike with no second confirm.

**Sam (accessibility):** Grey secondary text ("recommended", "cancel", timestamps, helper line under Search season 2, the left key hints) looks well under 4.5:1 on the near-black ground. Key hint boxes are about 10px text. Row icons have no visible labels. The confirm box is marked only by a thin border, so with low vision the dialog boundary is hard to find.

**The owner on a normal evening (monitors, lets Sonarr/Radarr search):** Came here because an episode looked wrong. Has to read past the season table, unrelated downloads and a hint list to find a three-line question. Might take "Mark as failed and remove torrent" as the thorough option, since it is the same size and sounds more complete.

## Minor observations

- The top bar "Search" tab is lit while the user is in a show overview; it reads as the wrong place.
- "Season 2 7/10 · +2 versions" packs three facts into a tab label.
- Helper text under Search season 2 repeats what the button does; drop it or show it on focus.
- "rTorrent · 3s ago" and both speed figures add three live numbers to every screen; the health badge could carry staleness instead.
- "Today 07:40" grab sits in the confirm box but "Today 08:12" imported line sits above it, so the event order reads bottom-up with the confirm in the middle.

## Questions

1. Should any confirm that touches a torrent under hit and run risk hide the risky option by default, across delete, remove download and mark as failed?
2. Does the downloads dock need to be on every screen, or would a one-line count in the top bar meet the "live progress shows on episodes, seasons, movies" decision, since rows already show their own progress?
3. Would the owner accept keys shown only on focused controls, with a "?" overlay for the full list, in place of the always-on hint list?
