DEGRADED: single-context (brief asked for Assessment A only, no subagents, no detector run)

# Critique: Desktop / Pick a release: already owned (pWgUy)

Screen: Dune: Part Two is open on pick a release. The owner already has a 1080p WEB-DL. They have selected the 2160p BluRay W4NK3R row, and the replace-or-second-version choice is open inline under that row.

## Design-specificity verdict

Authored, not generic. The timing-tower table, solid colour quality cells, tracker codes, hit and run column and the inline replace-or-second-version panel all belong to this product. No cards, shadows or stock dashboard parts.

The clutter comes from stacking the whole app shell onto the one moment that needs the most focus. When the choice panel is open, the owner faces seven regions at once: top bar (search, five nav items, two speeds, rTorrent age), search results list on the left, keyboard hint list under it, title header with a five-item colour legend, quality filter row with cache age, the release table with the choice panel inside it, and the live downloads dock with three unrelated shows. Only the choice panel and its row matter at this point.

## Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Cache age, owned file, live speeds all shown. The selected row's Grab button turns into a white "..." that says nothing. |
| 2 | Match system / real world | 3 | Consequences written in plain words ("goes to Radarr's recycle bin", "Plex shows both"). Raw scores ("+1850", "score -10000") and "DDP", "BLU" codes are fine for the owner but unexplained. |
| 3 | User control and freedom | 3 | Esc cancels, shown inline. No hint of undo after a replace. |
| 4 | Consistency and standards | 2 | R means refresh in the filter row and Replace in the panel. Purple "best on the board" sits on a release the profile rejects. "Owned" appears three ways. |
| 5 | Error prevention | 2 | One key (R) moves the 1080p file to the recycle bin and commits 32.1 GB to 120h of seeding. No confirm step, and the same key is advertised for refresh. |
| 6 | Recognition rather than recall | 3 | Legend and key hints are on screen. Colour meaning still has to be decoded through the legend. |
| 7 | Flexibility and efficiency | 4 | Keys for every action, quality filters on 1, 2, 7, grab on G. |
| 8 | Aesthetic and minimalist design | 1 | Seven regions compete during a two-option decision. Three unrelated downloads, six other search results and a key list stay up. |
| 9 | Error recovery | 2 | Recycle bin mention helps. Grab errors are hover-only (owner's choice). Nothing shows how to undo a replace. |
| 10 | Help and documentation | 2 | Legend covers colours. Nothing explains score numbers, "met · 212h", or why a row is dimmed. |
| **Total** | | **25/40** | **Acceptable** |

## Cognitive load

Failures: 5 of 8 (high).

- Single focus: fails. The dock, the results list and the key hints keep moving and drawing the eye during the decision.
- Chunking: fails. Header legend has 5 items; the table has 10 columns plus a button; the top bar has 9 items.
- Visual hierarchy: partly. The panel question is the strongest text, which is right, but the white Replace card and the white "..." button pull equal weight with the red cooldown cells and the white progress bars below.
- Minimal choices: fails. The panel itself offers 3 (Replace, Second version, cancel), which is good. But the visible key hints still offer search, move, open, grab and filter, so 8 key actions are advertised at the decision point. Top bar has 5 nav targets.
- Progressive disclosure: fails. The legend, the profile-tick explanation and the key hint list are always on, even on the tenth visit.
- Working memory: fails lightly. The panel says "You already own ... in 1080p WEB-DL" but not the size difference or disk cost (6.2 GB owned vs 32.1 GB new), so the owner has to read across to the header and the row.
- Grouping and one thing at a time: pass. Placing the choice under its row keeps the decision next to its data.

Decision points with more than 4 visible options: top bar (5 nav items plus search), key hint list (5), legend (5), quality filter (4, at the limit), table columns (10).

## Strengths

1. The inline choice panel is the best part of the screen. It opens under the chosen row, names both releases, and writes each consequence in full sentences: Radarr won't upgrade over a replace, the old file goes to the recycle bin, the torrent keeps seeding, the second version's exact file name, who tracks it. The shared hit and run commitment ("32.1 GB on BHD for 120h or to ratio 1.0") sits under both options.
2. Colour carries one meaning per hue and the table reads at a glance: green rows are better than what you own, yellow are not, red cells mark cooldown. The owned row is marked OWNED in the action column.
3. Cached results with their age and the cost of a fresh search ("~20s") answer the "is this stale?" question without a spinner.

## Priority issues

**[P1] R is both "refresh" and "Replace"**
- What: the filter row says "refresh R"; the panel says R = Replace.
- Why: an owner who presses R to refresh the stale list after the panel opened would replace their file and commit 32.1 GB to 120 hours of seeding. The most destructive action on the screen shares a key with the most harmless one.
- Fix: move refresh to Shift+R or F, or hide the refresh hint while the panel is open. Make Replace a two-step key: R selects the card, Enter confirms; S and Enter for second version. Show "Enter to confirm" on the selected card.
- Command: `/impeccable harden`

**[P1] Seven regions compete with a two-option decision**
- What: top bar, results list, key hints, header with legend, filters, table, live downloads dock are all on screen while the choice is open.
- Why: the owner's own complaint. The task here is "replace or keep both"; Severance, The Bear, Andor, Jodorowsky's Dune and the key list add nothing to it.
- Fix: on pick a release, collapse the search results list to a narrow strip (or remove it; [ and ] or Esc gets back). Hide the live downloads dock on this screen and keep the "Downloads 3" count in the top bar, which already exists. When the choice panel opens, dim the other table rows to about 40% so only the chosen row and panel stay at full strength.
- Command: `/impeccable distill`

**[P2] Always-on legend and key hint list**
- What: five-item colour legend plus "Meets Radarr's quality profile" in the header; five key hints bottom-left.
- Why: both repeat information the owner learns in a day, and both add to the noise permanently. The key hints are also wrong for this state: "G grab selected release" while the panel is open.
- Fix: replace the legend with a "?" key that shows it as an overlay, or show the legend only until the first grab. Make the key hint list follow context: when the panel is open, show only R, S, Esc (already in the panel), so remove the bottom-left list on this screen.
- Command: `/impeccable distill`

**[P2] Purple "best on the board" on a release the profile rejects**
- What: 2160p REMUX is purple but its profile cell reads "over 60 GB max" with a cross, and it still has a Grab button. Likewise 720p rows marked "not wanted" look as grabbable as eligible ones, while the cooldown rows are dimmed.
- Why: "best" and "rejected" on one row contradict each other; the owner can't tell whether purple means best quality or best choice. Dimming only some ineligible rows makes the dim state mean "blocked" in one place and nothing in another.
- Fix: give purple to the best release that passes the profile (here 2160p BluRay +1850). Dim every row the profile rejects the same way the cooldown rows are dimmed, keeping its Grab so the owner can still override.
- Command: `/impeccable clarify`

**[P2] Choice panel leaves out disk cost and gives Replace the default look**
- What: the Replace card has a light background, Second version a dark outline, so Replace looks pre-selected. Neither card gives the space change.
- Why: Replace is the destructive option and should not look like the default. Disk space is the main practical difference between the two (replace frees 6.2 GB, second version adds 32.1 GB).
- Fix: render both cards the same, neither filled until a key is pressed. Add one line each: "Frees 6.2 GB" and "Uses 32.1 GB more". Change the selected row's "..." button to "Choosing" or show nothing.
- Command: `/impeccable clarify`

## Persona red flags

**Alex (power user):** R collides between refresh and Replace, so muscle memory from the list becomes dangerous inside the panel. Has to read past the legend and key list every visit even though they are learned. Ten columns where "120h or 1.0" repeats on 6 of 10 rows: the hit and run rule is per tracker, so most of that column is noise.

**Sam (accessibility):** The comparison meaning (best, better, not better) is carried only by the fill colour of the quality cell; the text in it only says "2160p". A screen reader or colour-blind user gets no "better than yours" in words. Dimmed rows and the grey legend and release names look well under 4.5:1 contrast at what appears to be 10 to 11 px. The "..." button has no readable label. The Replace card's light background with dark text flips the theme in one spot, which is fine for contrast but makes it read as selected.

**The owner on a normal evening (mostly monitors, digs in when something went wrong):** Opened Dune to check one thing and is met with ten columns, a legend, filters, a dock and the results list. The question they care about ("is 2160p worth replacing my 1080p?") is answered well by the panel, but only after reading through the rest. Downloads for three other shows sit underneath, pulling attention back to monitoring when they came here to decide.

## Minor observations

- "Owned" status appears three times: "OWNED 1080p" in the results list, "YOU OWN" chip in the header, "OWNED" in the table. Keep the table and header; the results list chip can go once the list collapses.
- Panel heading "What should 2160p BluRay W4NK3R be?" reads oddly. "Add 2160p BluRay W4NK3R as:" or "Replace your 1080p, or keep both?" is plainer.
- "met · 212h" in the hit and run column of the owned row needs one more word ("seeding met, 212h").
- Header metadata line ("2024 · 2h 46m · Movie · Radarr · Monitored · Minimum availability: Released") is overview content; on pick a release only "Monitored" matters.
- The top bar's "rTorrent · 3s ago" sits in the same grey as the speeds and reads as a label rather than a status.
- The Second version card's border is the only bordered dark card on the screen; the two cards look like different components.

## Questions

1. Does pick a release need the search results list at all, or can Esc take the owner back to search and give the table the full width?
2. Should the live downloads dock appear only on the overview and downloads pages, given the top bar already counts them?
3. Is purple meant to mark the highest-quality release or the best release the owner should grab? The answer decides whether profile-rejected rows can ever be purple.
