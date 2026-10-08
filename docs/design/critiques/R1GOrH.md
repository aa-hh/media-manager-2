# Critique: Desktop / Flagged (R1GOrH)

Assessment A only (design review), from the 1440x900 screenshot plus the direction contract and the owner's screen decisions. No detector run, per the brief.

## Design specificity verdict

Specific to this product. The rows quote real Sonarr refusals, name trackers (BHD, PrivateHD), give seeding numbers, and spell out the hit and run consequence of Remove. An unrelated product could not reuse this screen. The subtitle "Automatic fixes handled 41 problems this week on their own. These are the ones they gave up on." states the page's job in one sentence and reassures the owner that most problems never reach them.

The weakness is visual, not content. One element, the thin outlined square box, carries four meanings on this screen (kind label, key hint, tab key number, quality in the dock), so the page reads as a grid of boxes before it reads as five problems.

## Nielsen scores

| Heuristic | Score | Why |
|---|---|---|
| Visibility of system status | 3 | Each row says what happened and what is paused. Top bar shows speeds and rTorrent freshness. Timed-search state only appears in prose. |
| Match with the real world | 3 | Plain sentences ("No seeders for 9 days"). Some Sonarr words stay raw: "cutoff", "quality profile", "grab". |
| User control and freedom | 2 | Dismiss flag exists only as the X key in the footer. No visible dismiss or undo on a row for a mouse user. |
| Consistency and standards | 2 | Same outlined box for kind labels, key hints, tab numbers and dock quality badges. Kind labels look pressable, key hints look like labels. |
| Error prevention | 3 | Remove on The Substance carries the hit and run warning right beside it. Unclear whether R confirms first. |
| Recognition rather than recall | 3 | Actions are written out with their keys. Footer hints repeat what rows already show. |
| Flexibility and efficiency | 4 | Every action has a key, tabs on 1 2 3, selected row model. |
| Aesthetic and minimalist design | 2 | About 25 boxed elements, two-line prose per row, a key hint footer and a three-row downloads dock all compete. The dock is unrelated to this page's job. |
| Help users recognise and recover from errors | 3 | Each row explains cause and next step. Raw error quotes are long and sit at the same weight as the summary. |
| Help and documentation | 2 | No link to the Sonarr or tracker rule behind a refusal; "Open Health" is the only route out. |
| **Total** | **27/40** | **Acceptable** (one point under Good) |

## Cognitive load

Checklist failures:
- Too many competing elements: 5 kind boxes, 9 key hint boxes in rows, 3 tab key boxes, 4 footer key boxes, 3 dock quality boxes, plus a red chip.
- Repeated information: download count and speeds in the top bar ("Downloads 3", 41.6 MB/s) and again in the dock below.
- Chunking: "What happened" mixes the summary, the raw quoted error and the consequence in one block at near-equal weight.
- Low-contrast secondary text (timestamps, "2024 · Movie · Radarr", key letters) that the owner has to squint for.

Decision points with more than 4 visible options: none per row (most rows offer 1 or 2 actions). The page as a whole shows 9 row actions at once plus tabs, nav and footer; the "keys act on the selected row" rule means 7 of those 9 key hints are inert at any moment.

## Emotional journey

Good opening: the subtitle reassures. The hardest moment is The Substance (Remove risks a hit and run), and the red chip lands it well. The end of the page is the downloads dock, which pulls attention away from "did I clear my flags" to unrelated progress bars.

## Strengths

1. The subtitle frames the page as the leftovers of automatic fixing, which matches how the owner uses the app.
2. "Next step" column with a bold primary action and a quieter secondary is the right shape for a to-do list.
3. Red used once, for the only real risk on the page (HIT AND RUN RISK), as the colour rules require.

## Priority issues

### 1. Downloads dock repeats the top bar and has nothing to do with flags (P1)
- What: three full-width progress rows at the bottom, about 130px, plus the empty gap above them.
- Why: the top bar already shows "Downloads 3" and both speeds. On this page the dock is the most visually active thing (progress bars, white percentages) and draws the eye away from the five problems.
- Fix: drop the dock from Flagged. If the owner wants it on every screen, collapse it to one line ("3 downloading · 41.6 MB/s") that expands on click, and show a row's download only when a flagged item is the one downloading.
- Command: `/impeccable distill`

### 2. Key hints on every row (P1)
- What: 9 key boxes inside rows, though the footer says keys act only on the selected row.
- Why: 7 of 9 hints do nothing at any moment, and they double the box count in the busiest column. A power user learns the keys in a day; after that they are pure noise.
- Fix: show key hints only on the selected row. Other rows keep the action words without boxes. Remove the footer line "Keys on a row act on the selected row" once hints follow the selection, since the behaviour then explains itself.
- Command: `/impeccable distill`

### 3. One outlined box style means four things (P2)
- What: kind labels (GAVE UP, TRACKER), key hints, tab numbers, and dock quality badges all use the same thin white outline.
- Why: kind labels look like buttons; Sam using a screen magnifier cannot tell a label from a control. It also makes the page look busier than its content.
- Fix: make kind plain uppercase text with no box (it is a category, not a control). Keep the box only for keys. Quality badges belong to the dock, which issue 1 removes here.
- Command: `/impeccable clarify`

### 4. "What happened" buries the summary under raw errors (P2)
- What: The Slow Horses and Abbott Elementary rows lead with long quoted Sonarr and tracker messages ("Download denied: client rTorrent 0.9.8 not in approved list (code 47)").
- Why: the owner on a normal evening needs one line: what broke and whether anything is at risk. The raw quote is for when they dig in.
- Fix: first line a short plain summary ("PrivateHD rejects this rTorrent version"); second line the consequence. Move the quoted message into the Enter-to-expand detail the review doc already defines for other screens.
- Command: `/impeccable clarify`

### 5. Dismiss has no visible control (P2)
- What: dismiss flag exists only as X in the footer.
- Why: mouse users and anyone who skips the footer cannot clear a row, and there is no sign of undo.
- Fix: a quiet "Dismiss" text action at the end of the selected row, with an undo toast or a "Dismissed" filter.
- Command: `/impeccable harden`

## Persona red flags

- Alex (power user): fine with keys, but row-wide key hints slow scanning once learned; wants J/K or arrow selection to show hints only where they act. Will want a count per kind or a sort by risk.
- Sam (accessibility): timestamps and metadata are dark grey on near-black, likely under 4.5:1. Key letters inside boxes look about 9px. Kind boxes read as buttons. Red chip relies on colour plus text, which passes.
- The owner on a normal evening: opens Flagged to see "is anything on fire". Has to read five two-line paragraphs to find that only The Substance carries a real risk. The dock at the bottom draws the eye to downloads that are fine.

## Minor observations

- Large empty band between the last row and the footer, then the footer and dock pinned at the bottom; the page looks unfinished when there are few flags.
- "Pick a release" on two rows both use I; correct under the selected-row rule, but confusing while all hints show.
- Missing (14) and Below cutoff (9) sit as tabs next to Needs you. The owner chose this; it works because Needs you is the default and the nav badge counts only Needs you.
- The SETUP row (Library folder) duplicates a Health item; fine as a cross-link, but its kind name could say "Disk space".
- Selected row border plus lighter fill is clear.

## Questions

1. Does the downloads dock need to appear on Flagged at all, given the top bar already shows the count and speeds?
2. Would you accept key hints that appear only on the selected row, with the rest showing plain action words?
3. Should the raw Sonarr and tracker messages move behind Enter, leaving a one-line plain summary on each row?
