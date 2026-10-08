# Critique: Desktop / History (frame EYHjp)

Assessment A only (design review), from the 1440x900 screenshot plus PRODUCT.md, CONTEXT.md, the direction contract and the owner's screen decisions. No detector run, per the brief.

## Design specificity verdict

Partly specific. The event wording is the strongest product-specific thing here: "Blocked and searched on another tracker, stalled 3h at 12%", "Imported, import forced for a replace", "Second version added, kept next to 1080p". No generic activity log says that. The expanded row (release name, tracker, group, custom format score, how it was found, age when grabbed, deletion reason, from and to paths with "hardlinked, torrent keeps seeding") is grounded in hit and run rules and hardlinks, which is exactly this product.

The visual language is less specific than the contract asks for. The contract says colour carries meaning (red = any risk, green = better than owned) and the screen is entirely grey and white. On a history page, failures, blocklists and flags are the rows that matter, and they look identical to "Renamed". With colour removed, this is a generic dark log table with outlined resolution chips. The timing-tower idea shows up only as density, not as meaning.

## Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Live speeds, counts on every filter, live downloads. But a failed download reads at the same weight as a rename, so the status that matters is not visible at a glance. |
| 2 | Match system and real world | 3 | Events in plain words with Sonarr's and Radarr's own terms. "RSS (new upload, no search)" is a good inline definition. |
| 3 | User control and freedom | 3 | Esc closes the expanded row, filters are one key. No sign of how to undo a mark as failed, or clear a filter other than pressing 1. |
| 4 | Consistency and standards | 3 | Resolution chips and key caps match other screens. Key hints are shown twice (header list and on every tab). |
| 5 | Error prevention | 2 | Mark as failed is one key (F) that blocklists, deletes the file and searches again. The consequence is spelled out, which helps, but there is no visible confirm step and the F hint sits in the page header as if it applies to every row, including "Renamed" and "Searched". |
| 6 | Recognition rather than recall | 3 | Keys are labelled on screen. The expanded row says "(row below)" to link the deletion to its upgrade, which asks the reader to match rows by eye. |
| 7 | Flexibility and efficiency | 3 | Arrow keys, Enter, F, 1 to 6. No text filter by title, no date range beyond "last 7 days". |
| 8 | Aesthetic and minimalist design | 2 | Every row has an outlined chip, two bold strings, and grey trailing text, so 16 rows carry about 48 equal-weight bold items. Header, tabs and dock add about 30 more competing labels. |
| 9 | Recognise, diagnose, recover from errors | 2 | Reasons are clear ("torrent unregistered on tracker", "3 releases failed in a row"). The next step is not: "needs a look on the flagged page" is plain text, not a link, and failure rows have no action other than the global F. |
| 10 | Help and documentation | 2 | Key hint list only. Fine for this owner, nothing more. |
| **Total** | | **26/40** | **Acceptable** |

## Cognitive load

Checklist failures (4 of 8, high):

- Single focus: the live downloads dock takes the bottom 130px with three progress bars, the brightest moving thing on the page, on a screen whose job is looking back.
- Chunking: 16 rows in one undivided run, with "Today" and "Yesterday" repeated in every date cell instead of day dividers.
- Visual hierarchy: the rows the owner opens this page for (Download failed, Blocklisted, Flagged, File deleted: missing from disk) have no more weight than Grabbed or Renamed.
- Minimal choices: see below.

Decision points with more than 4 visible options:

- Filter tabs: 6 tabs, each with a count and a key cap, so 18 marks for one choice.
- Top navigation: 6 destinations plus search, plus 3 status readouts.
- Page header key hints: 4 hints that repeat what the tabs and the expanded row already show.

## What's working

1. Events are written as sentences with the reason attached. "Upgraded from 1080p WEB-DL", "Marked as failed by you", "File deleted, reason: missing from disk". The owner can read the log without decoding Sonarr's event types.
2. Inline expansion instead of a modal, exactly as decided. The expanded row puts the destructive action (Mark as failed) next to what it will do ("blocklists it, deletes the file, searches again; torrent keeps seeding"), which is the right place for that warning.
3. The Source column separates Sonarr, Radarr and media-manager-2, so automatic fixes are mixed in but still attributable, which fits "fix it, then tell".

## Priority issues

**[P1] Failures look the same as routine events**
- What: Download failed, Blocklisted, Flagged, Marked as failed and "File deleted, reason: missing from disk" use the same white bold and grey as Grabbed and Renamed. The Failures tab exists, but in the All view nothing stands out.
- Why: The owner on a normal evening opens History when something has gone wrong. Today they scan 16 rows of equal weight to find 3 that matter. The direction contract already says red means risk; this screen does not use it.
- Fix: Colour only the event word. Red for Download failed, Blocklisted, Flagged and missing from disk. Leave everything else grey. Drop the bold from routine event words (Grabbed, Imported, Renamed, Searched) so the red ones are the only strong marks in that column.
- Command: /impeccable colorize

**[P1] The live downloads dock and repeated chrome compete with the log**
- What: The dock shows the same 3 downloads as "Downloads 3" in the top bar, with speeds already in the top bar too. The page header repeats key hints that appear on the tabs and in the expanded row.
- Why: About 15 percent of the viewport goes to live state on a screen about the past. The animated progress bars pull the eye away from the table. This is the clearest case of the clutter the owner named.
- Fix: Remove the dock from History. The top bar "Downloads 3" and speeds already say downloads are running. If the owner wants a hint, a single line inside the top bar is enough. Delete the header key hint list; the tab key caps and the Esc and F caps inside the expanded row already teach every key. Move "64 events" out of the subtitle, since "All 64" says it.
- Command: /impeccable distill

**[P2] Every row carries an outlined resolution chip and a bold tracker**
- What: 16 white-outlined boxes stacked in one column, plus bold BHD and PHD in every row.
- Why: Repeated boxes are the loudest shapes on the page and say little here: quality matters for grabs and upgrades, not for "Renamed" or "Searched". The bold tracker column draws the eye to the least decision-relevant field.
- Fix: Plain text resolution (no box) in the Release and quality column, keep the outlined chip only on the live pick-a-release table where it is compared. Tracker in regular weight. Consider folding Tracker into the Release and quality column ("2160p WEB-DL FLUX, 9.8 GB, BHD") to drop one column.
- Command: /impeccable quieter

**[P2] Related events are separate rows the reader has to connect**
- What: Andor S02E08 "Upgraded" and "File deleted, reason: upgrade" are two rows, and the expanded row says "(row below)". Severance S02E08 Grabbed and Imported, Oppenheimer Download failed and Blocklisted are the same pattern.
- Why: The owner reconstructs one story from two or three rows, and the event count is inflated (64 events is really fewer things that happened).
- Fix: Add day dividers (Today, Yesterday, 6 Oct) and show times only in the When column. Group consecutive events for the same title and release under one row with the latest event as the headline ("Download failed, then blocklisted") and the steps shown on expand.
- Command: /impeccable layout

**[P2] Mark as failed has no confirm and its hint shows on every row**
- What: F in the header is presented as a page-wide key. It blocklists, deletes the file and searches again.
- Why: One stray key on the wrong focused row deletes a file. The owner principle "the owner's choice wins" cuts both ways: a mistaken F undoes a choice the owner made.
- Fix: Show the F cap only inside an expanded grab or import row (already there). Make F open an inline "Mark as failed? Enter to confirm, Esc to cancel" in the row, or give a short undo line after.
- Command: /impeccable harden

## Persona red flags

**Alex (power user):** Keys are good, but no way to type a title to filter ("andor"). Cannot jump between failures only from the All view without switching tabs. Six tabs with numbers 1 to 6 is fine for Alex; the duplicate hint list is not needed by someone who already learned them.

**Sam (accessibility):** Grey secondary text (event reasons, subtitle, key hint labels, dates) looks well below 4.5:1 on the near-black ground. The focused or expanded row is marked only by a thin left bar and a slightly lighter background. If colour is added for failures (issue 1), the event word must still say "failed", which it does, so colour stays a second signal. Check that the expanded region is announced and that Mark as failed is a real button with its consequence in its accessible description.

**The owner on a normal evening (monitors, lets Sonarr and Radarr search, digs in only when something broke):** Opens History because Oppenheimer did not arrive. Has to read every event word to find "Download failed" in row 10, then see that the next row up says "Blocklisted", then wonder whether anything searched again (nothing says so). "Shogun S01E03 Flagged, needs a look on the flagged page" tells them where to go but gives nothing to click. The three progress bars at the bottom are the most eye-catching thing and are not what they came for.

## Minor observations

- "Today" and "Yesterday" in 8 consecutive date cells; day dividers would remove the repetition.
- Tab key caps (1 to 6) are bordered boxes next to counts, so each tab has three parts. The counts alone are enough on the tab; keys can live in the shortcut help.
- "Esc close" sits far right in the expanded row, far from where the eye is.
- The Searched row "search on add never ran" says what happened but not what came of it; nothing in the row says a release was found or not.
- "no release grabbed yet" and "needs a look on the flagged page" are grey sentences in the Release and quality column, a different kind of content from the rest of that column.
- Source column says "media-manager-2" in full on many rows; it is wide and repetitive for the app's own name.

## Questions

1. If History opened on the Failures filter whenever there are unread failures, would the owner still need colour in the All view?
2. Is the live downloads dock on every screen a decision, or a default? On History, Calendar and Health it answers a question nobody on those screens is asking.
3. Should one thing that happened (grab, fail, blocklist, search again) be one row, with the steps inside it?
