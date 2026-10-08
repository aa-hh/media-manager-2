# Critique: Desktop / Calendar: forecast (S8S9Ex)

Source: screenshot at 1440x900. Read-only review; the pen file was not changed.

## Design specificity verdict

The screen belongs to this product. Times next to channel names, "searches at 22:45 · profile HD 1080p", "Sonarr will not search or download it" and the red "MISSING · 0 SEEDERS FOUND" strip could only come from a Sonarr/Radarr front end. The flat black, the monospace-feel caps labels and the thin progress bars carry the timing-tower look from the direction contract.

The trouble is volume. Every card speaks at the same loudness, so the two things that need the owner (Shrinking missing, Platonic E09 missing) sit inside a wall of "not aired yet" text.

## Nielsen scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | "now 21:20" line, "airing now" and live downloads are clear. Downloaded and missing cards look the same as not-aired cards apart from their words. |
| 2 | Match with the real world | 3 | States written as words. Tracker codes "BHD", "PHD", "BLU" in the dock and "profile UHD preferred" are insider shorthand. |
| 3 | User control and freedom | 3 | Previous day, next day, today and the three views are all one key away. |
| 4 | Consistency and standards | 2 | The two missing items in the top strip are styled differently (red badge vs plain grey text). A bright border means "selected" on Hacks and something else on Tracker. Month's key hint reads "0" while Week and Forecast use their first letter. |
| 5 | Error prevention | 3 | Calendar is view only and says so. |
| 6 | Recognition over recall | 3 | Key hints sit next to their actions. |
| 7 | Flexibility and efficiency | 3 | Keyboard paging and view switching. No way to filter to "needs attention only". |
| 8 | Aesthetic and minimalist design | 1 | 17 cards each with 4 lines of text, 7 boxed premiere/finale badges, 7 key hints, a full-width downloads dock and two speed readouts. |
| 9 | Help users recover from errors | 2 | "Shrinking ... searched 4 times" and "nothing passed the profile" give no next step on screen (search again, pick a release, open the show). |
| 10 | Help and documentation | 2 | No hint what "profile UHD preferred" or the badges mean; fine for Alex, not for anyone else. |
| **Total** | | **25/40** | **Acceptable** |

## Cognitive load

Failures (4 of 8, high load):
- Single focus: the downloads dock and the top-bar speeds pull the eye away from the week.
- Visual hierarchy: seven white-boxed SEASON PREMIERE / SEASON FINALE badges are louder than the one red missing badge; the eye lands on badges first.
- Chunking: each card repeats four lines; 17 cards gives about 68 lines of text, most of them "not aired yet" plus "searches at ... profile ...".
- Progressive disclosure: the search time and profile line on every future card is detail nobody needs until something fails.

Decision points with more than 4 visible options:
- Header row: previous day, next day, today, Week, Month, Forecast (6), plus the 5 top-bar nav items and search above it.

## What's working

- The missing strip under the header names the problem in words ("aired Wed 7 Oct 21:00 · searched 4 times, last 40 min ago") and is the only red on the screen, as the colour rules intend.
- The "now 21:20" rule in today's column places the airing-now Hacks card in time without any extra chrome.
- States in plain words ("Sonarr will not search or download it", "completes season 2 (8 of 10 owned by then)") answer "what will happen" without a lookup.

## Priority issues

**[P1] Every future card carries the same two filler lines**
- What: "not aired yet" and "searches at HH:MM · profile X" appear on 12 of 17 cards.
- Why: the owner who monitors in the evening wants exceptions. Repeated normal-state text buries Pachinko (downloaded), Hacks (airing now), Tracker (unmonitored) and the missing items.
- Fix: make "not aired yet, will search automatically" the silent default. Show only time, channel, title and episode code on those cards. Keep the state line only when it differs from the default (downloaded, airing now, unmonitored, missing, season pack). Move search time and profile into the expanded card or a hover.
- Command: /impeccable distill

**[P1] Downloads dock repeated on the calendar**
- What: 130 px full-width table of three downloads with speed, time left, seeders and tracker, under a top bar that already shows "Downloads 3" and both speeds.
- Why: it duplicates the Downloads screen and the top bar, and takes space from the week. The owner's review already says live progress shows on the calendar entries themselves, which makes the dock redundant here.
- Fix: drop the dock from the calendar. Show a thin progress bar and percent on the matching card when an episode in view is downloading; the "Downloads 3" nav count covers the rest.
- Command: /impeccable distill

**[P2] Premiere and finale badges outshout problems**
- What: seven white-outlined caps badges, the strongest boxed shape on the page after the selected card.
- Why: a premiere is nice to know; a missing episode is the only thing on this screen that needs action. The hierarchy is inverted.
- Fix: make premiere/finale a small grey word in the time line ("21:00 · HBO · premiere") with no box. Keep boxes and colour for states that need the owner.
- Command: /impeccable quieter

**[P2] Missing items are inconsistent and give no next step**
- What: Shrinking has a red badge; Platonic E09 is plain grey text at the far right of the same strip. Neither offers an action.
- Why: two problems of the same kind look like different kinds; the owner has to leave for another screen to act.
- Fix: list both in the same format in the strip ("2 aired and still missing"), each with the reason and one key action (open the episode, or search again). Give Platonic the same red badge.
- Command: /impeccable clarify

**[P3] Header row noise**
- What: "Sonarr and Radarr · view only · times in Europe/London" note and seven key hints across the header and top bar.
- Fix: drop the note (or show it once in settings); show key hints only when the keyboard is in use or on a "?" overlay. Check the Month hint, which reads "0".
- Command: /impeccable quieter

## Persona red flags

**Alex (power user)**: Has the keys he wants. Missing: a key to jump to the next problem, and a filter to show only exceptions. The 7 always-on key hints are teaching him what he already knows.

**Sam (accessibility)**: The grey detail lines ("searches at 22:45 · profile HD 1080p", "Sonarr searches when it ends at 21:30") look about 10 px in mid grey on near-black, likely under 4.5:1 contrast. Tracker's dimmed title and text read as disabled. Downloaded vs not aired relies on reading small text, with no shape or icon difference. Tracker codes BHD/PHD/BLU have no spoken label.

**The owner on a normal evening**: Opens the calendar to check that tonight is on track. Within a few seconds he sees badges, then the dock, then the red strip. He has to read 17 cards to confirm that only two things are wrong. What he wants is "2 problems, everything else on schedule" at a glance.

## Minor observations

- "4 items", "2 items" column counts add little in a 5-day view with visible cards.
- TODAY and TOMORROW are boxed the same way as the badges; a weight change on the date would do.
- Large empty space at the bottom of the Fri and Sat columns; fine, but it shows the dock is borrowing height the columns do not need, which also argues the columns could be shorter on a busy week.
- "The Diplomat · 6 episodes" and "Severance · 2 episodes" show the collapse rule from the owner's review working well.
- The Hacks card's bright border reads as selection, but Tracker's card has a similar border; pick one meaning.

## Questions

1. If every normal card were reduced to time and title, would the owner still want the forecast view, or would the missing strip plus a week view cover it?
2. Should the calendar ever show downloads that are not episodes on screen (The Bear pack, Andor)?
3. Is the "view only" note answering a question anyone asked?
