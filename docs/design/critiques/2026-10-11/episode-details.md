⚠️ DEGRADED: single-context (the brief said not to spawn subagents; the target is a pen.dev frame, so `impeccable detect` and browser overlay injection cannot run against it)

# Critique: v2 / Desktop / Episode details, expanded (dLYsw), light mode

Target: frame dLYsw, the open detail area of S02E04 is frame l6AZa inside the Seasons table instance tgkTG (ref gp6Kh).
Scope: section definition and hierarchy of the open detail area. Measurements are from the resolved node tree (px relative to the Seasons table, 1360 wide) and the light-mode `mm-` token values.

## Design health score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Seeding progress per version is clear ("seeding 41 h of 72 h"); tracked versus second version is not visually distinct (both are grey badges, #F2F2EF). |
| 2 | Match system / real world | 3 | CONTEXT.md words used correctly (tracked version, second version, grab). Heading "Episode" inside an episode's own details says nothing. |
| 3 | User control and freedom | 3 | Collapse chevron sits on the row (y0qXbK, chevron-up). Nothing at the bottom of a 450 px area to close it or to tell where it ends. |
| 4 | Consistency and standards | 1 | Section headings (mk4uT: 11 px / 600 / #686862 / capitals / tracking 0.6) and column headers (Fj6GM cells: 11 px / 600 / #686862 / capitals / tracking 0.5) are the same style. Versions has a column header row; history has none. Tracked version is a relabelled Row/second-version. |
| 5 | Error prevention | 3 | Delete is only on the second version, red outline (#CC1F17), 28 px. The tracked row has no action, correctly. |
| 6 | Recognition rather than recall | 2 | History columns (When, Event, By, Detail) have no header; the reader infers "You" and "Sonarr" mean who acted. |
| 7 | Flexibility and efficiency | 3 | Row actions stay one click away; the detail opens in place with no side panel (PRODUCT.md capability 16). |
| 8 | Aesthetic and minimalist design | 1 | Every surface is #FFFFFF and every divider is the same 1 px #E3E3DE. Section boundaries rely on 24 px gaps alone, which the eye reads as one long list. |
| 9 | Error recovery | n/a | No error states in this frame. |
| 10 | Help and documentation | 3 | Seeding rule text ("rule met") explains the hit and run state inline. |
| **Total** | | **22/36** | **Acceptable, with one structural problem** |

## Design specificity verdict

LLM assessment: the content is specific to this product (seeding hours against a tracker rule, tracked versus second version, who grabbed what). The structure is generic: a stack of label plus rows with identical rules, which could belong to any admin table. The product's own selection language (grey tint plus side bar) stops at the episode row and is not used to tie the details to it.

Deterministic scan: not available. `impeccable detect` scans markup files; this target exists only as a pen.dev frame. No overlay was injected.

## Overall impression

The data is right and the columns are tidy. The open area has no edge: it shares the white of the episode rows, its own rows share their 1 px rule, and its three section headings look like a fourth and fifth column header. The biggest opportunity is one container treatment that says "this belongs to E04" and one heading style that is clearly above column headers.

## What's working

- The detail content starts at x 152, exactly the episode Title column (rjunT Title cell at 136 + row padding 16), so the nesting reads as "under this title".
- Versions and history both use 40 px rows (mm-row) and the 16 px cell gap, matching the episode rows.
- Delete sits in the far-right action column (versions row s7fOS, right edge 1328) on the second version only, in the risk colour with a word label, not an icon.

## Priority issues

**[P1] The open area does not separate from the episode rows around it.**
Evidence: l6AZa fill $mm-surface #FFFFFF, same as rjunT rows (#FFFFFF). Top edge: no rule of its own; the selected row d4zpvz (fill $mm-selected #EDEDE9, 3 px marker WvmaB) ends at y 168 and the marker does not continue. Bottom edge: history row EyZBv bottom rule at y 434 (inset from x 136) plus the container's own rule at y 450 (full width), two parallel 1 px #E3E3DE lines 16 px apart. The left 136 px gutter is empty white.
Fix: give the detail area its own band: fill $mm-surface-2 #F2F2EF, full width, continuing the 3 px selection side bar from the row down its full height, and one bottom rule. The selected row (#EDEDE9) and the band then read as one unit, set off from the white rows above and below.
Suggested command: /impeccable layout

**[P1] Section headings are styled like column headers.**
Evidence: "VERSIONS" (brNW6 → mk4uT xTran) 11 px / 600 / #686862 / capitals sits 8 px above "VERSION", "QUALITY", "RELEASE" (wYpin → Fj6GM) in 11 px / 600 / #686862 / capitals. Two rows of identical small capitals, one meaning "section", the other "column".
Fix: section heading becomes sentence case, 14 px / 600 / $mm-ink-1 (#111111), with the count in $mm-ink-3 data font. Column headers keep 11 px capitals. Two levels then differ by size, weight, colour and case.
Suggested command: /impeccable typeset

**[P1] Sections have no surface, only gaps.**
Evidence: Facts (DDgg3), versions (wYpin, a9Rnu9, SYzu0) and history (Qx0LC, j9FYiZ, EyZBv) all sit straight on #FFFFFF with the same 1 px #E3E3DE rules as the outer table. Gaps: 16 px above "EPISODE", 24 px above "VERSIONS" and "HISTORY", 8 px below each heading. With every rule identical, the 24 px gap is the only cue, and it is smaller than two row heights.
Fix: on the tinted band, put each section's content on a white panel ($mm-surface, 1 px $mm-line, radius $mm-radius-md 8, no shadow), 24 px between sections, 8 px heading to panel. Drop the last row's rule inside each panel so the panel edge is the only line.
Suggested command: /impeccable layout

**[P2] The versions and history tables do not share columns, and only one has a header.**
Evidence: versions columns (c49N0): Version 128, Quality 120, Release fill, Size 72, Tracker 112, Seeding 180, Action 88. History (nT6fn): When 128, Event fill, By 160, Detail 360. Only the first boundary (128) lines up; "By" starts at x 808 (abs) while Tracker starts at 932; "Detail" starts at 984 while Seeding starts at 1060. History has no header row; versions does (wYpin).
Fix: history By 112 and Detail 284 (Seeding 180 + gap 16 + Action 88), so By sits under Tracker and Detail under Seeding. Give history the same Table/Header (When, Event, By, Detail).
Suggested command: /impeccable layout

**[P2] The tracked version is a relabelled second-version row.**
Evidence: a9Rnu9 is a Row/second-version (c49N0) with the badge text changed to "Tracked version"; badge fill $mm-surface-2 #F2F2EF and text $mm-ink-2 #55554F, identical to "Second version" (SYzu0). The Delete button is hidden by override (WCuMu enabled false); its keyboard hint T1Pftv is flagged fully clipped in both rows.
Fix: a documented tracked-version override state on Row/second-version: outline badge ($mm-surface fill, 1 px $mm-line-strong #8C8C85, $mm-ink-1 text), release name in $mm-ink-1, no action. Sheet note records it.
Suggested command: /impeccable polish

## Persona red flags

**The owner (power user, desktop):** scanning down Season 2 after opening E04, the eye cannot find where E04's details end and E03 begins without reading the "E03" number (rows at y 450 and 458 look like the history rows above them). Comparing tracked and second version means reading the badge words; nothing in weight or colour says which one Sonarr tracks.

**The owner on a return visit:** "HISTORY 3" reads as a column title above "2 Oct 21:40"; the missing history header means "You" versus "Sonarr" has to be inferred.

## Minor observations

- Fact rows (e95lV) are 36 px; table rows are 40 px. Two rhythms in one area. Fact/row also carries a hidden Note text with width `fill_container` set to a 0 fallback plus x and y, which pen.dev reports as `fill_container` outside a layout.
- Fact rows draw a rule under the last row in each column (y 72), which then sits 24 px above "VERSIONS" and reads as the start of something.
- The empty "Head action" header cell (ONQ1R) is fine; the empty "Compared" header on the release-table demo (sheet dJZBi, Vkz7o) is not and is fixed in the same pass.
- "Episode" as a heading inside the episode's own details carries no information; "Details" says what the block is.

## Questions to consider

- Should the open detail area be a band of the selection colour, so "open" and "selected" are the same visual idea?
- Does history need all four columns, or would When, Event and By fit the owner's scan better?

Questions skipped: run by a coordinator as a fixed critique-then-fix brief; the owner's direction for step 2 was given up front.
