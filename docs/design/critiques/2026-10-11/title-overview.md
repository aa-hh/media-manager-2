DEGRADED: single-context (target is a pen.dev design file, which the impeccable detector cannot scan; one reviewer per screen group was requested, so no second assessment agent ran)

# Title overview pages: light mode critique

Screens: P4SDq, P5clla, hVCkw, uFHBR, Ks0Cn, dntf2, lcXDu, m8jCL, Wzmnv, IoIR0 (all "Light / ...") in `codex-design-finish/design/mediaManager2.pen`.
Evidence: 1x PNG exports in `scratchpad/review/png/`, plus `Get` reads with `resolveVariables` and `resolveInstances`. Nothing in the document was changed.

Light tokens in use: ground `#F5F5F5`, row `#FFFFFF`, row-alt `#FAFAFA`, row-hover `#EDEFF2`, seam `#D1D5DB`, ink `#171B20`, ink-2 `#58616C`, ink-3 `#9AA1AB`, accent `#215D47`, accent-soft `#D6E5DB`, risk `#B42318`. Fonts: Barlow and Barlow Semi Condensed. The file has no radius or spacing variables at all.

## Findings shared by every screen

These explain most of the "back office" feel. Fix them once and every overview page moves.

1. **Surfaces do not separate.** White panels (`#FFFFFF`) sit on a `#F5F5F5` ground: 1.09:1. All structure comes from 1px `#D1D5DB` borders (1.47:1 against white). The result reads as a grid of boxed forms.
2. **Square everything.** Buttons have no corner radius (`K7v9po/Wl6vZ` "Primary action", `Jyr2s` "Secondary action"), panels have none (`K7v9po`, `eoUlh`, `Brktx`), chips and the poster have 2px. Square 32px buttons with 1px grey borders are the single strongest "web 2.0 admin" signal on these pages.
3. **The poster is a flat placeholder and the backdrop is unused.** `nehpY` "Poster" is a `#2C4650` (TV) or brown (movie) rectangle, 120x180, radius 2. PRODUCT.md promises "one poster and one backdrop per title" from Sonarr and Radarr, and capability 13 asks for a "large poster". 120px is not large on a 1440px page, and the backdrop appears nowhere.
4. **Hero width wasted.** Header `K7v9po` is 1376px wide; its content stops at about 840px (overview text `mTwaO` is 640px). Right half of the hero, about 540px, is empty white.
5. **Page margins drift between states of the same page.** Content padding is 24px in P4SDq, P5clla, lcXDu, m8jCL (`o8Ucq` pad `[16,24,24,24]`, gap 16) and 32px in hVCkw, uFHBR, Ks0Cn, dntf2 (`jnXFt` pad `[12,32,24,32]`, gap 8). Header padding is 24 in one family and `[16,24]` in the other. The title therefore jumps between y 128, 120 and 136 as you go from "not in library" to "just added" to "in library". Switching states visibly shifts the page.
6. **Flat type scale.** Sizes in use: 11, 12, 13, 14, 17, 20, 31. Four of them (11 to 14) carry almost everything. Season header title is 14/600 (`A1unEq/TQoJP`), episode title is 13/600 (`tmPh5/zkDii`), episode number is also 13/600. One pixel separates a season from an episode. Title at 31px is an odd value off any scale.
7. **Too many boxed chips in the hero.** Chips row `B8zYp` has 8 items at 11/600 in 20px boxes, three with `#D1D5DB` outlines (TV, Continuing, 8.4) and five without. P4SDq adds a second row of three season chips (`V2Fjh`). Two visual systems (outlined and plain) in one row, all at the same weight, read as noise.
8. **Low-contrast meaning.** ink-3 `#9AA1AB` on white is 2.61:1 and carries the unmonitored bookmark (`K7v9po/Vu35l/yGeTf`), the second version arrow (`Ea8mJ/mes5G`) and every row chevron on phone (`qHViH`). The unmonitored bookmark is the one that carries state, so it fails where it matters.
9. **Accent green means four things.** `#D6E5DB` is the "In library" chip (`aAAml`), the "Downloading 64%" chip (`FDzvC`), the "Added" banner in P5clla, and the range selection fill (`uRuWq`, `bLSBu`, `xcbgE`, `ZkKyP`, `Khcuf` in Ks0Cn) and expanded row (dntf2). Selection and "good state" look identical.
10. **No elevation, no motion cues.** Inline panels (uFHBR `Brktx`, dntf2 versions) are marked only by a 1px ink border and a 60% ground scrim (`fzcRs`, `i34vCC`, fill `#F5F5F599`). Fine for focus, but the panel itself has no depth, so it reads as another bordered box.

## Proposals shared by every screen

**Spacing scale.** 4, 8, 12, 16, 24, 32, 48, 64. Page side margin 32 on desktop, 16 on phone, on every state. Gap between hero and seasons 24. Gap between season cards 12. Inside a panel 24. No 20px padding (`eoUlh`, `Brktx` use 20).

**Corner radii.** Add three number variables: `radius-sm` 6 (chips, keys, quality chips), `radius-md` 8 (buttons, inputs, segmented control, icon buttons), `radius-lg` 12 (panels, season cards, hero card, poster). Poster gets 10 to 12 with a soft shadow.

**Buttons.** Primary: 36px high in the hero, radius 8, fill accent, 14/600 white label, 16px icon, key hint inside at 60% white. Secondary: white fill, 1px `#E2E5EA` border, radius 8, ink label; drop the grey outline look by using a very light fill `#F1F3F5` with no border instead. Row icon buttons (`gItza`, `I8sz0Y`, `nT3nS`, 26x26): 28x28, radius 6, no border at rest, `#EDEFF2` on hover.

**Surfaces.** Ground `#F4F5F7` (slightly cool), cards `#FFFFFF` with radius 12 and shadow `0 1px 2px rgba(23,27,32,0.06), 0 0 0 1px rgba(23,27,32,0.06)` instead of a hard `#D1D5DB` border. Inner row dividers `#EEF0F3`. This keeps density and loses the boxed-form look.

**Type scale.** 12 (meta, keys), 13 (row data, condensed), 14 (row titles, body), 16 (season titles, panel titles), 20 (section headings), 36 or 40 (title, Barlow 700, letter spacing -0.5). Episode titles 14/500, episode numbers 13/500 condensed tabular in ink-2, season titles 16/600. That gives three clear steps: title, season, episode.

**Colour roles.** Keep `#215D47` as the action colour (buttons, progress, monitored). Give selection its own neutral: fill `#E8EEF7` with a 2px `#3B5B8C` left edge, so selected rows never look "in library". Keep `#D6E5DB` only for "good state" chips. Raise the unmonitored bookmark to ink-2 `#58616C` outline (6.28:1).

**Hero chips.** Keep chips only for state that changes: type, Continuing or Ended, and the library status. Render network, runtime, certification and genres as one 13px ink-2 line separated by middle dots. Rating as "8.4" with a filled star, no box.

## Group 1: TV and movie overview, not in library (P4SDq, lcXDu)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Season rows say "counts fill in after adding" (`IPAsc`) while capability 13 says episode counts and aired state should show before adding |
| 2 | Match system / real world | 3 | Monitor choices mirror Sonarr and Radarr wording |
| 3 | User control and freedom | 3 | "Add without searching" offered beside "Add and search" |
| 4 | Consistency and standards | 2 | Margins 24 here vs 32 on the in-library page; no bookmark next to the title here, filled black in P5clla, green outline in hVCkw |
| 5 | Error prevention | 3 | Live preview "Monitors 19 episodes across 2 seasons · searches now" before confirming |
| 6 | Recognition over recall | 3 | Segmented control shows five choices plus More |
| 7 | Flexibility and efficiency | 2 | No key hints on the add buttons, though other pages show them |
| 8 | Aesthetic and minimalist | 2 | Two bordered cards side by side, 250px of dead ground below, hero right half empty |
| 9 | Error recovery | 1 | No state drawn for a failed add or an unreachable Sonarr |
| 10 | Help and documentation | 2 | Hint text present; "More options" hides search on add for TV |
| | **Total** | **23/40** | Acceptable |

**Top problems**

- [P1] The add decision is boxed into a 640px form card (`eoUlh`, pad 20, 1px `#D1D5DB` border) beside a 728px season list that has nothing in it. The page's one job (decide and add) looks like a settings form.
- [P1] Segmented control (P4SDq "All seasons ... More") has a black `#171B20` selected cell on square cells with 1px borders. Five 42px-tall square cells plus a loose "More" read as a 2008 tab strip. In lcXDu the same control has three options and leaves 330px blank to its right.
- [P2] "Search on add" for TV is hidden behind "More options" while the movie page shows it as a visible checkbox ("Start search for missing movie"). Same decision, two treatments.
- [P2] lcXDu dates block ("IN CINEMAS 1 Mar 2024 · DIGITAL 16 Apr 2024 · COLLECTION Dune") uses 11px uppercase labels; only place in the hero with that pattern.

**Proposals**

- Put the add controls in the hero, under the overview, as one 48px horizontal bar on a `#F6F8F7` tinted strip: Monitor (segmented control), Quality profile (select), Search on add (switch), then "Add and search" primary on the right. The season list then takes the full width below, same rows as the in-library page, with a dashed-outline bookmark per season showing what the chosen Monitor option will cover. Changing the segmented control updates those bookmarks live. That turns the preview sentence into something visible.
- Segmented control: track `#EEF0F3` radius 8, 32px high, options 13/500 ink-2, selected option white with radius 6 and shadow `0 1px 2px rgba(0,0,0,0.08)`, ink 600 label. "More" becomes the last option with a chevron opening the remaining Sonarr choices.
- Same switch for "search on add" on both TV and movie.

## Group 2: TV overview, in library and its states (hVCkw, P5clla, uFHBR, Ks0Cn, dntf2)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Per-episode "Searching" chips, progress bars, seeding hours; good |
| 2 | Match system / real world | 3 | "Search automatically", "Pick a release", "second version" match CONTEXT.md |
| 3 | User control and freedom | 3 | Esc and Cancel on the monitoring panel and selection bar |
| 4 | Consistency and standards | 2 | Data drift between states (below) and three row heights |
| 5 | Error prevention | 3 | "turns off 3 episodes you set by hand" warning in red; "Unmonitoring keeps files" |
| 6 | Recognition over recall | 2 | Mixed season state not drawn; row actions only on hover |
| 7 | Flexibility and efficiency | 3 | Range select with M, U, A, Esc keys |
| 8 | Aesthetic and minimalist | 2 | Full-width grey-bordered rows, wide empty middle columns |
| 9 | Error recovery | 2 | "Mark as failed" in history; nothing for a failed search |
| 10 | Help and documentation | 2 | Key hints on actions; nothing explains "7 + 1 / 10" |
| | **Total** | **25/40** | Good |

**Top problems**

- [P0] **Mixed monitored state is missing.** PRODUCT.md capability 15 requires a mixed state for a partly monitored season. In Ks0Cn, Season 2 shows "6 of 10 monitored" (`OcUtN/fMrAv`) but its bookmark (`Plmic`) is the same hollow outline as fully unmonitored Season 3 (`K35k1`). In hVCkw all three season bookmarks (`NDGoG/ScEsT`, `A1unEq/ScEsT`, `NHFJ3/ScEsT`) are solid `#171B20` even though episodes inside differ.
- [P1] **Selection looks like "monitored" or "in library".** Ks0Cn selected rows 03 to 06 use `#D6E5DB`, the same fill as the "In library" chip, and selected row 04 has a hollow bookmark while its green row says "good". dntf2 expanded row 04 uses the same green. Three meanings, one colour.
- [P1] **Row rhythm is uneven.** Season rows 40px, episode rows 34px, second version rows 30px, selection bar 36px, all separated by full `#D1D5DB` borders. Episode columns are fixed: title 384px (`f0WQDl`), air date 90px right-aligned (`mXZHD`), file 160px (`Nyv94`), state 384px (`z1GP8l`), actions 220px (`Ix1GY`). On rows with no state (01 to 06 in hVCkw) there is about 600px of blank white between the quality chip and the right edge.
- [P1] **Data drifts between states of the same show.** Season 2 is "Aired" in hVCkw (`A1unEq/txbjf`) and "Airing" in P5clla, uFHBR, Ks0Cn and the phone. Season 3 is "0 / 8" in hVCkw and P5clla, "0 / 10" in uFHBR and Ks0Cn. P5clla nav says "Downloads 3" while the bar below says "5 downloading · 2 new". Phone Wzmnv says "19 of 19 episodes" for the in-library state that desktop calls "18 of 24".
- [P2] **Title bookmark changes form between screens.** No bookmark in P4SDq, solid black in P5clla, green outline in hVCkw (`K7v9po/Skol0`, fill `#215D47`). A green outline in this system means unmonitored-ish (hollow) in rows but "monitored" here.
- [P2] **Monitoring panel (uFHBR, `Brktx`) is a 1376px-wide bordered box** with a 3-column radio grid where column 3 has one item and column 1 two, leaving the grid lopsided (`t1fJX`, rows `n8zxAa`, `stWKV`). The trigger "Monitoring: All seasons" sits next to the title with a 1.5px ink border while the panel shows "Future seasons" selected; the pending change is not marked on the trigger.
- [P2] "7 + 1 / 10" (`A1unEq/pYfrb`) needs explanation: on disk plus downloading over total. Nowhere says so.

**Proposals**

- **Hero with backdrop.** Full-bleed backdrop band 1440 x 300 behind the hero, from the Sonarr backdrop, with a vertical gradient from 0% to 100% ground `#F4F5F7` over its bottom 60%, so text below stays on near-white. Poster 168x252, radius 12, shadow `0 8px 24px rgba(23,27,32,0.18)`, overlapping the band's bottom edge by 64px. Title 40/700 Barlow beside the poster at the band's bottom edge. Meta line, library status chip, overview (max 680px, 15px, line height 1.5) and the two buttons below. Use the empty right side of the hero for a compact facts column: monitoring scope (the trigger for the monitoring panel), quality profile, total size, next airing. All of it is already on the page or in Sonarr.
- **Seasons as cards.** Each season a card (radius 12, 12px gap between cards). Season header 52px: chevron, 32x48 season poster thumbnail (Sonarr provides season posters), "Season 2" 16/600, status chip, then "7 on disk · 1 downloading · 10 episodes" in 13px condensed ink-2 with a 120x4 segmented bar (on disk accent, downloading accent at 50%, missing `#E4E7EB`). Episode rows 40px inside the card, 1px `#EEF0F3` dividers, 16px side padding. Second version rows stay 32px, indented 40px, on `#FAFAFB`.
- **Episode row columns.** Bookmark 20, number 28 (13/500 condensed tabular, ink-2), title flexible (14/500), air date 64 (13 condensed, left-aligned), file chip, state flexible, actions 96 right-aligned. Show the two row actions (Search automatically, Pick a release) at 40% opacity at rest instead of hiding them, so they are discoverable without hover; full opacity on hover and on the selected row.
- **Monitored state.** Monitored: solid bookmark `#215D47`. Unmonitored: outline `#58616C`. Mixed season: bookmark with its lower half filled, plus the "6 of 10 monitored" text, always visible when mixed. Unmonitored episode rows render title in ink-2 so the eye can scan which are off. Title bookmark uses exactly the same three icons.
- **Selection.** Neutral fill `#E8EEF7`, 2px `#3B5B8C` left edge, checkbox appears in the bookmark column while selecting. The selection bar becomes a floating bar pinned 16px above the downloads bar, radius 12, ink `#171B20` fill, white labels, so it reads as a temporary tool and not as another row.
- **Monitoring panel.** Drop it from the page flow into a 480px popover anchored to the "Monitoring" trigger in the hero facts column, radius 12, shadow `0 12px 32px rgba(23,27,32,0.16)`. Single column of radio rows, 44px each, description under each label. Preview sentence and the red warning stay at the bottom above "Apply monitoring".
- **Expanded episode (dntf2).** Keep the inline expansion but give it a card inside the season card (radius 8, `#FAFAFB`, 16px padding). Versions table header 11/600 condensed is fine; give "Delete second version..." a ghost style in risk red (no box border), since a bordered red box is the loudest element on the page for a rare action.

## Group 3: Movie overview, in library (m8jCL)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | "Downloading 64%" in the hero with no word on which release |
| 2 | Match system / real world | 3 | "Below cutoff", "Second version", seeding hours match CONTEXT.md |
| 3 | User control and freedom | 2 | No monitored toggle or monitor control on the in-library movie |
| 4 | Consistency and standards | 2 | Breadcrumb "Search / Dune: Part Two" for an in-library title; TV says "Library /" |
| 5 | Error prevention | 2 | "safe to remove" claim with no link to the tracker rule |
| 6 | Recognition over recall | 3 | File facts in a labelled table |
| 7 | Flexibility and efficiency | 2 | No key hints on hero actions here |
| 8 | Aesthetic and minimalist | 2 | Three stacked white strips, history rows at full 1392px width |
| 9 | Error recovery | 2 | History explains "search on add never ran" |
| 10 | Help and documentation | 2 | Cutoff explanation inline; good |
| | **Total** | **22/40** | Acceptable |

**Top problems**

- [P1] Hero says "Downloading 64%" with a 160x4 bar while "Your file" says the 1080p file is in place. The owner cannot tell whether this is a replace, an upgrade or a second version without leaving the page.
- [P1] File, seeding and second version (`Your file`, `Seeding`, `Second version` rows) are three 28px lines with 11px-ish labels and a 1px seam, then a separate "HISTORY" list with five 34px rows spanning 1392px. Long lines of short text; eye travel is wide.
- [P2] Movie has no visible monitored state on the page, though the TV page shows it on the title.

**Proposals**

- Same hero with backdrop and large poster as TV.
- Under the hero, a two-column layout at 32px gap: left (about 60%) a "Files" card with one row per version (Tracked, Second version, Downloading), each row showing quality chip, group, size, tracker and seeding hours in the same columns as the TV versions table in dntf2. The downloading item becomes a row of that table with its progress bar, labelled with what it will do ("replaces your file" or "second version"). Right (about 40%) the history card, rows 40px, time in 12px condensed ink-2 above the event text, so the column is narrow and scannable.
- Title bookmark with the same three states as TV.

## Group 4: Phone, TV overview and episode actions sheet (Wzmnv, IoIR0)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | "Downloading 64%", "Below cutoff", next airing per row |
| 2 | Match system / real world | 3 | Same terms as desktop |
| 3 | User control and freedom | 3 | Sheet with clear actions |
| 4 | Consistency and standards | 2 | Date "Mar 21" vs desktop "21 Mar"; "19 of 19" vs desktop "18 of 24" |
| 5 | Error prevention | 3 | Monitored toggle sits in the sheet, away from tap-scrolling |
| 6 | Recognition over recall | 2 | Episode rows show no monitored state |
| 7 | Flexibility and efficiency | 2 | No way to act on a whole season from the list |
| 8 | Aesthetic and minimalist | 3 | Clean; chips still boxed |
| 9 | Error recovery | 2 | Not shown |
| 10 | Help and documentation | 2 | n/a in practice on phone; nothing drawn |
| | **Total** | **25/40** | Good |

**Top problems**

- [P1] Episode rows (`j8QqqD`, `Votx1`, ...) have no bookmark, which breaks capability 15 ("visible on every show, season and episode row"). Monitored state only appears inside the sheet (IoIR0 "Monitored").
- [P2] Number text hugs its content (`cFkMN` 10, 12, 13px wide), so titles start at x 38 or 40 or 41 depending on the digits. Visible in Wzmnv: "Cold Harbor" and "Woe's Hollow" are out of line.
- [P2] Phone header (`nD1qU`, 128px) uses a 64x96 poster; no backdrop. The page title appears twice: in the nav bar ("Severance", 17/700) and in the header (20/700).
- [P2] Sheet (IoIR0) has square corners and full-width hairlines; the "Monitored" row uses a bookmark icon as a toggle where a switch is the phone standard.

**Proposals**

- Header: backdrop band 390 x 180 with the same fade, poster 88x132 radius 10 overlapping by 40px, title 24/700. Hide the nav bar title until the header scrolls away.
- Episode rows 52px: bookmark at left (16px icon, 44px tap target), number in a fixed 24px column, title 15/500, state on the right. Rows inside a season card with 16px side margin and radius 12.
- Sheet: top radius 16, grab handle 36x4 radius 2, 56px action rows, "Monitored" as a switch in accent green. Keep the header line "1080p WEB-DL · Below cutoff · Manual download".

## Delight moments that fit an operate-mode tool

1. **Poster-tinted hero.** Take the dominant colour of the poster Sonarr or Radarr already provides, and use it at low strength for the backdrop fade and for that title's progress bars and the season bar. Every title page looks like its own show without adding any content or new controls. Buttons keep the app accent, so actions stay predictable.
2. **Search results landing in place.** After "Add and search" (P5clla), when an episode's "Searching" chip resolves, it turns into the grabbed quality chip with a 300ms crossfade and a one-time soft highlight on the row, and the season bar fills by one segment. The owner watches the show fill in, which is the exact reassurance PRODUCT.md asks for ("trusts that what they asked for will arrive"). Respect reduced motion: swap with no animation.

## Questions to consider

- Should the monitoring scope live in the hero facts column as a permanent read-out, so the panel in uFHBR is only for changing it?
- Does the not-in-library page need a separate add card at all, if the season list itself can preview what will be monitored?
- Is "7 + 1 / 10" worth keeping as a compact code, or should it become words plus the segmented bar?
