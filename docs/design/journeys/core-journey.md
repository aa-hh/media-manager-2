# Core journey: find, add, monitor, grab

Design proposal, 8 Oct 2026. The most common path through media-manager-2: open the app, find a title, add it, decide what is monitored, then let Sonarr or Radarr search automatically or pick a release by hand. Words follow `CONTEXT.md`; frame ids refer to `design/mediaManager2.pen`.

## 1. Who and why

The owner runs Sonarr, Radarr, rTorrent and Plex on a seedbox and knows all four. Most visits do one of two things: add something new, or check that something added is arriving.

| Screen | Its one job |
|---|---|
| Library (home) | Show what the owner has and what needs attention; start a search. |
| Search results | Tell similar titles apart so the right one opens first time. |
| Overview, not in library | Decide whether to add it, what to monitor, at what quality. |
| Overview, in library | See and change what is monitored, downloaded and downloading, per season and episode. |
| Pick a release | Choose one release and grab it. |

## 2. The journey, step by step

Counts are mouse clicks; typing the search text is not counted. Keys are optional extras.

### TV show, not yet added

| # | Screen | Visible | Primary action | Secondary | Clicks | Owner learns |
|---|---|---|---|---|---|---|
| 1 | Library | Poster grid, newest added first, progress "8 + 2 / 10". Top-bar search box: "Search library, Sonarr and Radarr". | Click the search box (or `/`). | Sort, Movies / TV / All. | 1 | What they own and what is downloading. |
| 2 | Search results | Library matches first, then lookup results as rows (anatomy below). Movies / TV / All filter with counts. | Click a result. | Filter by type. | 1 | Which result is the show they meant. |
| 3 | TV overview, not in library | Large poster, title, chips (TV, network, status, rating, runtime, certification, genres), 3-line overview, seasons strip, add controls with saved defaults set. | "Add and search". | Change scope (1), quality profile (2), More options. | 1 | Seasons, continuing or ended, and exactly what will be monitored and searched. |
| 4 | Same page, now in library | "In library" chip. Seasons become rows with bookmarks, latest open. Monitored episodes show "Searching", then quality chip and live progress, or "Missing". Live downloads bar counts new grabs. | None: leave it automatic. | Row actions (step 5). | 0 | Sonarr took it, what it searches for, what it grabbed. |
| 5 | Episode row | On hover or focus: Search automatically, Pick a release, details. | Pick a release. | Search automatically (result shows in the row). | 1 | That both actions sit on the row; no panel to open. |
| 6 | Pick a release, inline under the row | Cached results with age ("Results from 14 min ago", Refresh). A just-added show has no cache, so the search starts at once (about 20 seconds). Best passing release in purple; other rows dimmed. | Grab. | Refresh, quality filter, Esc. | 1 | Releases, profile fit, seeders, tracker, hit and run rule. |
| 7 | Grab, already owned | The release row expands with "Replace" and "Second version", each with one line of consequence. | Replace or Second version. | Esc. | 1 | What happens to the existing file and its torrent. |

| Path | Proposed | Today's frames |
|---|---|---|
| Add a show, let Sonarr search | 3 | 4 or 5 (search, result, add with "one key with saved defaults, a second key opens the options" per the review doc; no add screen is drawn) |
| Add with a non-default scope | 4 | 6 or 7 (plus Monitoring, choose mode, Apply in `vIwpS`) |
| Add and hand-pick one episode | 5 | 10 or 11 (plus season tab, select episode, open details, Pick a release, select release, Grab via `L7crsL`, `c9Z57`, `BxurY`) |
| Replace an owned episode from the library | 4 | about 8 (poster, season tab, row, details, Pick a release, select, Grab, Replace in `pWgUy`) |

The saving: scope and profile sit on the overview, seasons are rows instead of tabs, and row actions replace expanding first.

### Movie, not yet added

1. Search (1), click the result (1).
2. Overview, not in library: poster, chips, overview, collection. Add controls: Monitor (Movie Only, Movie and Collection, None), Minimum availability (Announced, In Cinemas, Released), Quality profile, "Start search for missing movie" on. "Add and search" (1).
3. The page becomes the movie overview with one status word (queued, downloading 64%, downloaded, missing, not available) driven by rTorrent. 3 clicks.
4. Hand-pick: "Pick a release" in the header (1) opens the list inline under it, laid out as `GYT2F`; Grab (1); Replace or Second version if owned (1). 5 or 6 clicks.

### Phone

Same steps. Add controls and episode row actions open in bottom sheets; Pick a release fills the sheet as `fSkBY` draws it.

### Search result row

Poster thumbnail, title, year, TV or Movie chip, network or studio, status chip, rating chip; second line, a one-line overview; right edge, "In library" with progress if added (opens the library overview). Fields come from Sonarr's `series/lookup` and Radarr's `movie/lookup` (Linear AA-12), run in parallel.

### Add controls: scope mapped to Sonarr

Checked against Sonarr's frontend source (`v5-develop`: `monitorOptions.ts`, `getNewSeries.ts`, `AddNewSeriesModalContent.tsx`) and Radarr's (`develop`: `AddNewMovieModalContent.js`, `Movie/monitorOptions.js`), 8 Oct 2026.

| Choice (ToggleGroup) | Sonarr `monitor` | `monitorNewItems` | Search for missing episodes |
|---|---|---|---|
| All seasons | All Episodes ("all episodes except specials") | all | on |
| Future episodes | Future Episodes ("episodes that have not aired yet") | all | on |
| Future seasons | None | all | off |
| Latest season | Last Season ("all episodes of the last season") | all | on |
| Choose episodes | None | none | off; page lands with bookmarks ready |

"More" opens a Select with the rest: Missing Episodes, Existing Episodes, Recent Episodes ("aired within the last 90 days and future episodes"), Pilot Episode, First Season, Monitor Specials, Unmonitor Specials. Once Sonarr has episodes, a preview line states the effect in numbers ("monitors 10 episodes in Season 3 and new seasons").

Quality profile: Select of Sonarr's profiles, prefilled. More options (Collapsible, closed): root folder, series type (Standard, Daily, Anime), season folder, tags, monitor new seasons, search for cutoff unmet episodes.

### Seasons before adding

Sonarr's lookup returns season numbers but empty statistics for a show not in the library (`SeriesLookupController.cs` sets `new SeriesStatistics()`), plus status, first and last aired dates. So before adding, each season is a chip: all "Aired" for an ended show; for a continuing show, earlier seasons "Aired" and the last "Airing" if it aired within two weeks; "Upcoming" when the series status is upcoming. Counts and dates fill in seconds after adding (question 1).

### After "Add and search"

Sonarr searches each monitored season, grabbing a season pack where a season has fully aired. Rows show "Searching", then quality and live progress. Episodes without a file show "Missing" in neutral while media-manager-2's timed searches retry; only when it gives up does the row turn red and join the Flagged page.

## 3. Monitored state visibility

A bookmark icon at all three levels, as Sonarr uses, in a shadcn Toggle labelled "Monitored" or "Not monitored".

| Level | Monitored | Not monitored | Mixed | Toggle |
|---|---|---|---|---|
| Show | Filled bookmark by the title; chip "18 of 24 episodes · new seasons on" | Outline; chip "Not monitored" | Shown by the count | Click. Scope changes use a "Monitoring" Select beside it, with the preview line and Apply. |
| Season | Filled bookmark at row start | Outline; row text one step dimmer | Bookmark with minus (Lucide `BookmarkMinus`), "6 of 10 monitored" | Click; from mixed, monitors the whole season, as Sonarr's season toggle does. |
| Episode | Filled, in secondary text colour | Outline; title and date dim | n/a | Click. Shift-click another bookmark sets the range between to the same state. |

- Every row shows its bookmark, reversing the critique's advice to drop the monitored column (`L7crsL`, `c9Z57`). Filled bookmarks are low contrast, so an unmonitored episode stands out by outline and dimmed text.
- Changes show at once: icon, season count and show chip update together. If Sonarr rejects the change, the icon flips back and the row shows a red reason ("Sonarr unreachable").
- Monitoring aired episodes that have no file adds a season-row line: "3 newly monitored episodes have no file · Search automatically". Sonarr does not search on a monitoring change.
- Unmonitoring keeps files; the `iAVnz` selection bar keeps saying so.
- A show-level scope resets hand-set episodes in Sonarr; the preview says so in numbers ("turns off 3 episodes you set by hand").

## 4. Season and episode rows

Seasons stack as Collapsible rows, newest first, latest open. Tabs go, because they hide the other seasons' state.

Season row: bookmark; "Season 2"; Aired / Airing / Upcoming chip; "7 + 1 / 10" in the library's format; size on disk; on hover or focus, Search automatically, Pick a release (season packs), expand.

| Episode row part | Content |
|---|---|
| Bookmark | Toggle, always visible |
| Number, title | "08 Sweet Vitriol"; Premiere and Finale as outline chips |
| Air date | Relative when near ("Fri 21:00", "3 days ago"), else "7 Mar" |
| File | Quality chip ("2160p WEB-DL"), "Missing", or nothing if unaired |
| State | Only what differs from normal: progress bar with percent and time left, "Searching", "Manual download", "2 versions", "Below cutoff", red risk chip |
| Actions | Search automatically, Pick a release, details chevron. Icon buttons with Tooltip and aria-label, shown on hover, focus or selection; on phone, a row tap opens the actions sheet. |

Details stay optional: the chevron expands the row in place (one at a time, others dimmed) with versions and seeding, history with mark as failed, and delete version. No side panel. Second versions stay visible as sub-rows, as in `iAVnz`, since they carry hit and run risk.

## 5. Chips and pills

Neutral unless listed. Purple only on the single best release that passes the profile. Red only for risk or failure.

| Chip | Meaning | Colour | Component |
|---|---|---|---|
| TV / Movie | Media type | Neutral outline | Badge `outline` |
| In library | Already added | Neutral filled, check icon | Badge `secondary` |
| Continuing, Ended, Upcoming; Announced, In Cinemas, Released | Sonarr or Radarr title status | Neutral outline | Badge `outline` |
| Aired, Airing, Upcoming | Season state; Airing has a dot | Neutral outline | Badge `outline` |
| Network, studio, genre, certification | Title facts | Neutral, text only | Badge `ghost` |
| 8.4 ★ | Rating from Sonarr or Radarr | Neutral outline | Badge `outline` |
| Bookmark | Monitored, not monitored, mixed | Neutral | Toggle |
| Scope choices; Movies / TV / All; 2160p / 1080p / 720p | Choices and filters | Selected item filled | ToggleGroup |
| 2160p WEB-DL | File on disk | Neutral filled | Badge `secondary` |
| Searching | Automatic search running | Neutral, spinner | Badge `outline` + Spinner |
| Downloading 64% · 6m | Live from rTorrent | Neutral bar | Progress |
| Missing, Below cutoff, Manual download, 2 versions, Premiere, Finale | Normal-but-notable states | Neutral | Badge `outline` / `secondary` |
| Best | Best release passing the profile | Purple | Badge, purple variant |
| Hit and run risk, Stalled, Failed, Tracker cooldown, 0 seeders, Missing after media-manager-2 gave up | Risk or failure | Red | Badge `destructive` |

## 6. Screen-by-screen change list

| Frame | Change | Keep | Remove | Weight |
|---|---|---|---|---|
| `GOM8w` Library | Search placeholder covers library and new titles; poster status text ("missing 2 episodes", "manual download") becomes chips; outline bookmark on unmonitored titles. | Grid, newest first, "16 + 1 / 19", totals, one-line downloads bar. | "Search" nav item (duplicates the box). | Critical: search entry. Polish: chips. |
| `zWW5R` Search + movie overview | Results become a page with the row above. Today rows show only title, "year · type" and a state word, so Dune 2021 and 1984 differ by year alone. Add the not-in-library movie overview. | Status words, history lines, second version row. | Results column beside the overview. | Critical |
| `L7crsL` TV overview | Season rows with aired state and bookmarks; bookmark on every episode; Pick a release on the row. Today only the meta line says "Monitored: all future episodes". | Episode columns, second version sub-rows, live progress, "below cutoff · manual download". | Season tabs; "Details (Enter)" as the only way to Pick a release. | Critical |
| `vIwpS` Monitoring | Modes move into a Select by the show bookmark; episode bookmarks stay visible. Add Monitor Specials and Unmonitor Specials, missing from the nine drawn. | Preview "turns on Season 1 (9 episodes) and episodes 2, 5, 6"; Apply and Cancel. | "off → on" as the only episode state; the 3 × 3 mode grid. | Critical |
| `iAVnz` Range select | Outline bookmark replaces the "Unmonitored" word; shift-click range with the mouse. | "Episodes 3 to 6 selected · 2 monitored", "Unmonitoring keeps files". | Key hints outside the selection bar. | Polish |
| `c9Z57` Episode details | Search automatically and Pick a release move to the row; the expansion keeps versions and history. Split the 9-fact header line into chips. | Inline expansion, versions table, mark as failed. | Buttons inside the expansion. | Critical |
| `S3IzNG` Episode details, light | Use its light neutral palette as the restyle basis. Rename "Grab a release" to "Pick a release". | Palette, poster, hit and run wording. | The 342px episode sidebar plus details pane: two clicks to act, no monitored state in the list. | Critical (layout); palette is polish |
| `GYT2F` / `BxurY` Pick a release | Open inline under the starting row or header; Grab on the hovered or selected row. | Profile column, cache age with refresh, "5 releases beat yours", purple best, `[ ]` previous and next episode. | Separate view and "← Back" link. | Critical |
| `fSkBY` Phone | Reached from the row's actions sheet; quality as chips. | Sheet with Replace and Keep as second version, results age, whole-row tap. | Nothing. | Polish |
| New frames | Search results; TV and movie overviews not in library with add controls; TV overview just after adding. | | | Critical |

## 7. Open questions for the owner

1. Before adding a show, are season chips with aired state enough, or should media-manager-2 fetch episode counts from Sonarr's metadata service, beyond the lookup API agreed in AA-12?
2. Should Pick a release open inline under the row (proposed) or stay a separate view as in `GYT2F` and `BxurY`?
3. Are "Future episodes" and "Future seasons" two choices or one, given they differ only for the unaired rest of the current season?
4. Should "Add and search" reuse the last add's scope and profile, or fixed defaults set once?
5. Should one search box both filter the library and find new titles (proposed), or should the library keep its own filter?
6. When a show-level scope would reset episodes set by hand, should Apply warn and reset (Sonarr's behaviour, proposed) or keep them?

## 8. New or changed features

- Library is the home screen, with search one click or `/` away.
- One search box: library matches first, then Sonarr and Radarr lookup results.
- Search results show poster, title, year, TV or Movie, network or studio, status, rating, one-line overview and In library state, from Sonarr and Radarr lookup.
- Overview of a title not in the library: large poster, overview, rating, status, facts as chips, seasons with aired, airing or upcoming state.
- Add a show with monitor scope, quality profile and search-on-add, mirroring Sonarr's add options, prefilled from saved defaults.
- Add a movie with Monitor, Minimum availability, quality profile and Start search for missing movie, mirroring Radarr's add options.
- After adding, the same page becomes the library overview and shows automatic search progress per season and episode.
- Season and episode monitored indicators (bookmark) with inline toggles, a mixed state for partly monitored seasons, and shift-click range.
- Show-level monitoring summary from episode states, with a preview of what a monitoring option changes before applying.
- Offer Search automatically after monitoring is turned on for aired episodes without files.
- Seasons as stacked rows with aired state and progress, replacing season tabs.
- Row-level Search automatically and Pick a release on episode and season rows; details expand in place only on request.
- Pick a release opens inline under the row or header that started it, on cached results with their age.
- One chip and badge set for type, status, quality, monitored, download progress and risk; purple only for the best passing release, red only for risk.
