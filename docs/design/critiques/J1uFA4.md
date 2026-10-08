# Critique: Desktop / Calendar: week (J1uFA4)

Assessment A only (design review), single agent, from the 1440x900 screenshot plus the direction contract and the owner's calendar decision in docs/design/sonarr-radarr-review.md.

## Design-specificity verdict

Mostly specific to this product. The "now 21:20" line under the airing Hacks entry, "airing now · searches when it ends", "downloading 23% as a season pack", and Severance collapsing to "3 episodes" with per-episode state are things only a Sonarr/Radarr front end would show. The week grid itself is a stock calendar layout, and the entries are boxed cards, which the contract rules out ("no cards, no shadows, square cells"). The timing-tower look survives in colour and type, not in layout.

## Nielsen heuristics

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Every entry states its state in words; airing-now and the now line are clear. Download state shown three times over (see issue 1). |
| 2 | Match with the real world | 3 | Plain states. "nothing passed the profile", "Movie · Radarr" and "Sonarr and Radarr · view only" lean on tool jargon. |
| 3 | User control and freedom | 3 | Previous/next/today and view switch are obvious. |
| 4 | Consistency and standards | 2 | An outline box means three things: selected (Shrinking), airing now (Hacks), unmonitored (Abbott Elementary, Tracker). Two missing episodes look different: Shrinking is red, Platonic is plain grey text. |
| 5 | Error prevention | n/a | Read-only screen; nothing to get wrong. |
| 6 | Recognition rather than recall | 3 | Keys are printed next to controls. Month is "O", which has to be learned. |
| 7 | Flexibility and efficiency | 3 | Keyboard paging and view keys. No way to jump from an entry to fix it is visible. |
| 8 | Aesthetic and minimalist design | 2 | Download dock, per-day item counts, network names, quality strings on every finished entry and six premiere/finale badges all compete with the two things that need attention. |
| 9 | Help users recognise and recover from errors | 2 | The two missing episodes are the only problems this week. One is red, one is grey and reads like an ordinary state. Neither shows what to do next. |
| 10 | Help and documentation | 2 | No hint of what "view only" means or why some entries are dimmed. |

Total: 23 / 36 (one n/a), renormalised 25.6 / 40. Band: Acceptable (20 to 27).

## Cognitive load

Failures (4 of 8, high):
- Single focus: the live downloads dock takes about 130px of a 900px screen and repeats progress already drawn inside the entries.
- Visual hierarchy: the eye lands on six outlined badge boxes and a white outline before it finds the missing episode. The red cell is small (one line, about 9px text).
- Minimal choices: the control strip above the grid shows 6 controls with 6 key boxes (previous, next, today, Week, Month, Forecast) plus the search "/" box above; more than 4 options at one decision point, though they split into two groups of 3, which mostly saves it.
- Progressive disclosure: every finished entry prints its full quality ("downloaded 2160p WEB-DL"); every entry prints channel or network. Owner on a normal evening needs neither.

Passes: chunking by day, grouping, one thing at a time, working memory.

## Strengths

1. States as words on every entry ("not aired yet", "unmonitored · not searched", "airing now · searches when it ends"). Matches the owner's decision and reads without a legend.
2. The now line and airing-now entry on today's column make "where are we in the week" instant.
3. Several episodes of one show on one day collapse to one entry with the split shown ("E05, E06 downloaded 2160p / E07 downloading 64%"), exactly as decided.

## Priority issues

**[P1] Download progress shown three times on one screen.**
What: "Downloads 3" in the top bar, progress bars inside Severance, The Bear and Andor entries, and the docked downloads table with the same three items and the same percentages.
Why: The dock costs about 15% of the height on a screen whose lower half is otherwise blank week space, and it is the heaviest block on the page. The owner already decided live progress shows on the calendar entries, which makes the dock redundant here.
Fix: Drop the dock from the calendar. Keep the in-entry bars and the "Downloads 3" link. If the dock must stay app-wide, collapse it to a single line ("3 downloading · 41.6 MB/s") that expands on click or a key.
Command: /impeccable distill

**[P1] Problems do not stand out from routine entries.**
What: Shrinking (missing, 0 seeders) gets red; Platonic (missing, nothing passed the profile) is grey text identical in weight to "not aired yet". Meanwhile six SEASON PREMIERE / FINALE boxes are the most framed things on the grid.
Why: The project persona opens this screen to check whether anything went wrong. Today they would miss Platonic.
Fix: Every missing or failed entry gets the red cell on its state line (red already means risk in the colour rules). Demote premiere and finale to plain small text after the episode code ("S02E01 · premiere") with no box. Optional: a one-line summary in the header row, "2 missing this week", that jumps to the first.
Command: /impeccable clarify, then /impeccable quieter

**[P2] Outline boxes carry three meanings.**
What: Selected (Shrinking, thin grey outline), airing now (Hacks, white outline), unmonitored (Abbott Elementary, Tracker, grey outline plus dim text).
Why: The eye cannot tell keyboard focus from "on air" from "ignored".
Fix: Outline is keyboard focus only. Airing now keeps the now line and its words. Unmonitored is dim text with no box.
Command: /impeccable polish

**[P2] Every entry is four lines of equal-weight detail.**
What: channel/network and time, title, episode code, state with quality.
Why: 22 entries times 4 lines is about 90 lines of text in a week; the owner reads titles and states, rarely networks or WEB-DL vs other sources on finished items.
Fix: Two lines per entry: "21:00 Severance S02E05-E07" then the state. Show quality only when it is below cutoff or in progress. Move network to the entry's detail. Drop "3 items" counts from day headers.
Command: /impeccable distill

**[P3] Boxed cards against the contract.**
What: Rounded-looking framed blocks per entry on a lighter ground.
Why: The contract says no cards, square cells, stepped graphite rows. Cards also add 22 extra edges to the picture.
Fix: Entries as flat rows separated by a 1px rule or alternating graphite step, no box.
Command: /impeccable quieter

## Persona red flags

- Alex (power user): Cannot act from an entry; to search Platonic again he has to leave the calendar. Wants Enter on an entry to open the episode and A to search it, printed only on the focused entry.
- Sam (accessibility): Time and network text and badge text sit around 9 to 10px in mid grey on near-black, likely under 4.5:1. Dimmed unmonitored entries are lower still. Missing state on Platonic relies on reading the word; on Shrinking it relies on red plus words, which is fine.
- Owner on a normal evening: Wants "is anything wrong this week" in two seconds. The answer (two missing episodes) is in the grid but one of them is disguised as a routine state, and the downloads dock pulls the eye to the bottom of the screen first.

## Minor observations

- "Superman: physical release date / not out yet · you own 2160p WEB-DL" reads as a contradiction. Say "physical release · you already own 2160p WEB-DL".
- "Sonarr and Radarr · view only · times in Europe/London" is grey filler in the header; keep the timezone, drop "view only" or explain it once.
- Month shortcut "O" next to Week "W" and Forecast "F" looks like a typo for 0. Use "M" if free.
- Key boxes appear 7 times on this screen. Print them on the view switch only, or show all on "?".
- Past days (Mon to Wed) have the same weight as upcoming days. Dimming past finished entries would push attention to today and ahead.
- Top bar speeds and "rTorrent · 3s ago" repeat on every screen; fine as one quiet line, but they duplicate the dock's job too.

## Questions

1. Does the docked downloads table need to be on the calendar at all, given the owner already chose to show progress inside each calendar entry?
2. Is the calendar for "what is coming" or "what went wrong"? If the second, should missing episodes be gathered at the top of the week instead of scattered by day?
3. Should past days fade once everything on them is downloaded?
