# Watch screens: what the app already has

Inventory for the watch pages the owner asked for on 17 Nov 2026: Home (rows) → show page (seasons) → season page (episodes) → episode page (play, synopsis, details), plus a film page, the same design on web and TV, each with a hero and scrim, room for cast, and existing pieces reused.

Read-only. Sources: this repo at `origin/main` `b59fde8`; the Figma screens file `dFQMjELOx6ObLS0qOG3NCF` (pages Title and Home); the TV screens file `LOntH5HQXfvTnfapJoyoqZ`. Nothing was built, run or edited.

## Short answer

- The web has one title page per show or film, and it is a management page with Play added on top. Of its 26 blocks, 9 are about watching, 4 serve both, and 13 are Sonarr, Radarr and torrent work.
- There is no season page and no episode page on web or TV. The web shows seasons as table rows that open in place; the TV shows season tabs beside an episode list. Nothing anywhere shows one episode on its own.
- The TV app is already close to the watch side: its show and film screens are backdrop, title, facts, Play, Mark as watched, Monitor. Its Pick a release screen exists but nothing opens it (`Navigation.kt:92`).
- Most of the data is already on the server: summaries, episode stills, season posters, backdrops, runtimes, air dates, watch progress, versions. Missing: title logos, season summaries, show cast on the page, episode cast, cast photos for shows, audio and subtitle track lists before Play.
- Two pieces of data already reach the page and are thrown away: a movie's cast with photos (sent, never drawn) and a show's scores per site from MDBList (sent, not in the client's type).
- The biggest design tension: the web is light by default and the TV is dark only. The A2 exploration's own notes say the TV look "depends on a dark page".

## 1. Today's web title page

Address `/series/:id` or `/movie/:id` (`src/client/title/Overview.tsx:37-51`). One screen for owned titles, a cut-down header for titles not yet added (`Overview.tsx:223-247`).

### Blocks, top to bottom

| Block | Where | Tag |
|---|---|---|
| Backdrop band behind the header, blurred poster first, photo settles in | `components/ui/header-title.tsx:82` (`HeaderBackdrop`), used by `title/TitleHeader.tsx:329-335` | watching |
| Section label ("TV / Library", "Search / words"), links back | `TitleHeader.tsx:292-302`, `components/ui/section-label.tsx` | both |
| Poster 210 × 315 | `header-title.tsx:68` | watching |
| Monitor bookmark beside the title | `TitleHeader.tsx:338` | managing |
| Title 36/800 | `HeaderTitle`, `TitleHeader.tsx:334` | both |
| Meta line: TV or Movie · network · year · status · certification · ★ rating · seasons · runtime · genres | `TitleHeader.tsx:41-59` | watching |
| Badges: "In library · 8 of 10 episodes", "Downloading S2E04 42%", "Missing S2E05" | `SeriesOverview.tsx:178-188`, `MovieOverview.tsx:88-89` | managing |
| Play line: Play or Resume button, "Stopped at 21:00 · S2 E4 · title", "31 min left of 52 min" | `SeriesOverview.tsx:166-177`, `MovieOverview.tsx:93`, `TitlePlay.tsx:100`, `header-title.tsx:164` | watching |
| Resume menu (resume or start over, pick a version) | `components/ui/menu-resume.tsx`, `TitlePlay.tsx:95` | watching |
| Search automatically (primary, or outline when Play shows) | `TitleHeader.tsx:343-347` | managing |
| Pick a release | `TitleHeader.tsx:348-352` | managing |
| More menu: Refresh, History, Change monitoring, Delete | `TitleHeader.tsx:312-325` | managing |
| Overview text | `TitleHeader.tsx:210` | watching |
| Fact grid: status, first and last aired, network, air time, runtime, certification, language, other titles, next and previous episode | `TitleHeader.tsx:129-152`, drawn `:211` | both |
| Movie crew grid: director, screenplay, novel, producers, photography, music | `TitleHeader.tsx:158-165`, drawn `:212` | watching |
| Links: IMDb, TVDB, TMDB, trailer | `TitleHeader.tsx:73-84`, drawn `:213-222` | watching |
| Genre and keyword chips that open Discover | `TitleHeader.tsx:185-199`, drawn `:223-237` | watching |
| Library card: scores strip, then monitoring, new seasons, quality profile, episodes on disk, size, added, folder, tags | `components/ui/card-library.tsx`, `TitleHeader.tsx:239`, rows `SeriesOverview.tsx:152-163` | managing (scores strip: watching) |
| Change monitoring panel | `SeriesOverview.tsx:57-105`, `:207-216` | managing |
| Seasons table: season row with bookmark, air dates, status chip ("N missing · 4 of 8"), quality, size | `EpisodeRows.tsx:520-590`, `components/ui/row-season.tsx` | managing |
| Episode row: bookmark, number, still (plays), title, "31 min left" or runtime, air date, status, quality, size, Search, Pick a release, Details | `EpisodeRows.tsx:141-246`, `components/ui/row-episode.tsx`, `still-episode.tsx` | both (still, title, second line: watching) |
| Clicking an episode row selects it for bulk Monitor, Unmonitor, Search | `EpisodeRows.tsx:160`, `:622-625` | managing |
| Episode details band: file, versions, history | `EpisodeDetails.tsx:55-116` | managing |
| Releases inset under an episode or the movie's version | `EpisodeRows.tsx:442`, `MovieOverview.tsx:121-135` | managing |
| Movie versions table, second versions | `MovieOverview.tsx:110-145` | managing |
| History | `TitleHeader.tsx:370`, `MovieOverview.tsx:147` | managing |
| Delete dialog | `TitleHeader.tsx:358-369`, `DeleteTitle.tsx` | managing |

Live updates: Plex's webhook re-reads watch status (`Overview.tsx:141-161`); the downloads stream drives badges and episode status (`Overview.tsx:163-165`).

### Components in `src/client/components/ui/`

Reusable as-is on a watch page:
- `header-title.tsx`: `HeaderBackdrop` (band, blurred poster first, fades to page colour) and `HeaderPlayLine`. `HeaderTitle` itself carries the bookmark and three management buttons in fixed slots; a watch hero would pass none of them or need a variant.
- `menu-resume.tsx`, `TitlePlay.tsx` (`TitlePlayLine`, `PlayStill`, `startOnPage`): Play, Resume, version choice, Plex Web fallback.
- `still-episode.tsx`: 72 × 40 still with watch bar, played tick, play circle. Fine for a list; too small for an episode hero.
- `library-poster-card.tsx`: poster with watch bar, played tick, unwatched count, Play or Resume. 210 × 315 only; Home's compact 144 × 216 cards from frame D are not in the library yet.
- `badge.tsx`, `button.tsx` (including `on-dark`, `outline-on-dark`), `tag-format.tsx` (DDP 5.1, DV, HDR10), `fact-stacked.tsx`, `section-label.tsx`, `skeleton.tsx`, `tabs-trigger.tsx`, `progress.tsx`.
- `item-episode-list.tsx`: "Episode in a compact list, 56 px, outside a table". In the library, used by no screen. A natural season-page row.
- `link-prev-next.tsx`: previous and next ghost buttons. In the library, used by no screen. Fits episode-to-episode stepping.
- `player-up-next.tsx`: next item's 352 × 198 still, show, episode, runtime, two-line summary. Shows how an episode block can look.
- `scrim.tsx` is only the 30% dialog dim; the hero's fade lives inside `HeaderBackdrop`.

Management-shaped (stay on the management page): `row-season`, `row-episode`, `row-episode-details`, `row-episode-releases`, `row-release`, `row-second-version`, `row-history`, `toggle-bookmark`, `bar-selection`, `card-library`, `panel-inline`, `dialog-counts-as`, `chip-release-state`, `chip-fit`, `status-download-circle`, every `row-delete-*` and `row-import-*`.

Scores have no component of their own: they are a strip inside `card-library.tsx` (`ratings` prop), fed by `cardRatings` (`TitleHeader.tsx:101-111`). A show gets one unattributed Sonarr rating there.

## 2. The TV app

Files under `android-tv/app/src/main/java/io/github/aahh/mediamanager2/tv/`. Dark only, 960 × 540.

| Screen | What it shows | What OK does |
|---|---|---|
| Home (`ui/screens/HomeScreen.kt`) | Rows: Not watched yet, Continue watching, Recently added TV, Recently added films, Playlists (`ui/browse/Rails.kt:52-72`), then Trakt rows (`:80-93`). Only the first row drives the hero at the top: after focus rests ~300 ms, backdrop and summary crossfade over 150 ms; moving to a lower row fades the hero out (`ui/browse/RailsPage.kt:75-160`) | Library card: opens show or film screen. Trakt card already in the library: same. Trakt card not in the library: add dialog. Plex list: list screen (`ui/browse/Open.kt:14-29`). Holding OK on a library card: action list (Mark as watched, Monitor, Remove from Continue watching) (`ui/components/Card.kt:162-188`) |
| Show (`ui/screens/ShowScreen.kt`) | Backdrop (Episodes strength), title, facts line, three-line overview, Play or Resume with two lines, Mark as watched, Monitor on the left; season tabs and episode list on the right with live download progress (`:139-200`) | On Play: player. On an episode row: plays it if Plex has it, otherwise nothing (`:188-192`). Season tab: switches the list. Opens on the next episode's season (`ui/title/TitleModel.kt:93-101`) |
| Film (`ui/screens/FilmScreen.kt`) | Backdrop (Title page strength), title, facts, overview, Play or Resume, Mark as watched, Monitor, live download line (`:121-165`) | Play: player |
| Episode row (`ui/components/Browse.kt:62`) | 100 × 56 still, number and title, air line, 120-wide watch bar, status (Missing, Downloading, date), bookmark | (as above) |
| Pick a release (`ui/screens/ReleasesScreen.kt`) | Release list | Declared at `ui/Navigation.kt:92`; no screen navigates to it |

No season page and no episode page. Focus rules: focus never moves layout; cards and buttons grow 1.1× with a 3dp ring, rows fill off-white (DESIGN.md lines 438-451). Focus lands on Play when there is one, otherwise on Mark as watched (`ShowScreen.kt:137`, `FilmScreen.kt:119`).

Backdrop strengths already exist for three uses: Browse, Title page, Episodes (`ui/components/Backdrop.kt:25-35`).

## 3. Addresses and moving between pages

Today:
- Web addresses: `/` Library, `/discover`, `/calendar`, `/downloads`, `/flagged`, `/history`, `/health`, `/settings`, `/search`, `/blocklist`, title pages `/series/:id`, `/movie/:id`, `/title/tvdb/:id`, `/title/tmdb/:id`, `/title/tmdb-tv/:id` (`src/client/Home.tsx:54-62`, `:104-115`; `title/Overview.tsx:37-51`).
- Title addresses are built in four places: `navigation.ts:248-251` (`routeFor`, search results), `library/Library.tsx:135`, `discover/model.ts:218`, `calendar/Calendar.tsx:50`.
- The player sits at `/play/<ratingKey>`. The page under it stays mounted and its address is ignored (`player/model.ts:62-63`, `navigation.ts:236-245`); Back returns to that page.
- Home's view switch keys each title page by its full address, so every new address is its own screen with the crossfade (`Home.tsx:208`).
- TV routes are Kotlin objects (`ShowRoute`, `FilmRoute`, `PlayerRoute`, `Navigation.kt:71-104`); they share nothing with web addresses.

Options for where the watch pages live:

| Option | Addresses | What it breaks or costs |
|---|---|---|
| A. New addresses beside the management pages | `/watch/show/:id`, `/watch/show/:id/season/:n`, `/watch/show/:id/season/:n/episode/:e`, `/watch/movie/:id` | Nothing existing. Home.tsx needs one more branch. Each of the four address builders must choose watch or manage; calendar, search and Discover cards may want different answers |
| B. Watch pages take the current addresses; management moves | `/series/:id` becomes the watch show page; management at `/series/:id/manage` | Every saved link and the four builders change meaning. Search results, Calendar and Flagged then land on a watch page when the owner came to fix something |
| C. Same address, a switch between watch and manage | `/series/:id?view=manage` or a stored choice | One screen holds both layouts and both data needs. A stored choice makes the same link show different pages; a query value keeps links exact but the page must avoid adding a history step for each flip |
| D. Watch pages only below the title | `/series/:id` stays management; season and episode pages are new | The show page, the one the owner asked to make playback-first, stays management-first. Two different "show" experiences |

Getting between watch and management for the same title: today nothing needs it. Whichever option, the watch hero needs one quiet control into management (the TV's equivalent would be a button or the hold-OK list), and the management header needs the reverse. The section label (`section-label.tsx`) already links back to Library or Search and can carry a third place.

## 4. Data on hand

"Have" means it reaches the client today. Server lines in `src/server/`.

| Item | Show | Season | Episode | Film | Cheapest source for the gap |
|---|---|---|---|---|---|
| Summary | have (Sonarr) | **missing** | have (`episodes.overview`, Sonarr) | have (Radarr) | Season: TMDB `/tv/{id}/season/{n}` `overview`, or Plex's season item `summary` |
| Poster | have | have (`seasons[].posterUrl`) | n/a | have | |
| Backdrop | have (TMDB, or Trakt or fanart.tv by setting; `backdrops.ts:35-48`) | none (show's reused) | none (show's reused) | have | Plex season `art` if wanted |
| Episode still | | | have (`imageUrl`, Sonarr, remote TVDB address) | | Sizes: one size only; TMDB `still_path` has several |
| Title logo (lettering) | **missing** | | | **missing** | Sonarr's series record already carries a `clearlogo` image; `imageUrl(record.images, 'clearlogo')` (`library.ts:276`) reads it. Radarr: not checked. TMDB `/images` `logos` or fanart.tv `hdtvlogo` otherwise |
| Cast | partly: TMDB top 10, name and character, no photo (`tmdbTitles.ts:86`), at `/api/library/tmdb/tv/:id`, which no screen calls | | **missing** (guest stars) | partly: full cast with photos and order sent (`library.ts:432-438`, `:654`), never drawn (`client/library/api.ts:203-207`) | Show photos: TMDB already parses `profilePath` (`services/tmdb.ts:125-130`); drop it less. Episode: TMDB episode `credits` or Plex item `Role` tags |
| Crew | missing | | missing | have (drawn as facts, `TitleHeader.tsx:158-165`) | Same as cast |
| Scores | partly: one Sonarr rating drawn; IMDb, Rotten Tomatoes, audience and Metacritic from MDBList sent (`library.ts:367`, `services/mdblist.ts:19`) but not in the client type | | missing | have: IMDb, TMDB, Trakt, Rotten Tomatoes, Metacritic | Show: add `ratingsBySite` to the client type. Episode: TMDB `vote_average` |
| Runtime | have | sum: missing (add up episodes) | have | have | |
| Air dates | have (first, last, next, previous) | have (season statistics) | have | have (cinema, digital, physical) | |
| Certification, genres, network or studio | have | | | have | |
| Watch progress | have (episodes watched of total, next episode; `watchStatus.ts`) | partly: work out from episodes | have (resume point, length, play count, last played; `watchStatus.ts:110-131`) | have | |
| Versions | | | have (Plex versions with file, `Playable.versions`; Sonarr file quality, size; second versions) | have | |
| Audio and subtitle tracks | | | partly: Sonarr `mediaInfo` gives codec, channels, languages, subtitle languages as text (`client/library/api.ts:68-89`) | partly: same from Radarr | Full lists exist only once playing (`playback.ts:441`, `:513`). Before Play: Plex's item metadata (`/library/metadata/{ratingKey}`), one call per page |
| Which episodes can play | | | have: file in Sonarr and matched in Plex (`playLine.ts:19`) | have | |
| Trailer | | | | have (YouTube id) | |
| Similar titles | have (TMDB, 20, at the unused route) | | | have (same) | |

Stored in SQLite: `titles` (detail JSON), `episodes` (title, air date, overview, has file, monitored), `title_images` (poster and fanart only), `tmdb_images`, `title_store` (TMDB details saved 7 days) (`database.ts:224-257`, `:336-380`). No cast, logo or season summary is stored.

### Rules this direction contradicts

PRODUCT.md:
- Line 11 of Capabilities (`PRODUCT.md:53`): "The app opens on the library, with search one action away from every screen." Home already overrides this by the 16 Nov decision; the file still says it.
- `PRODUCT.md:60`: "Images and descriptions come only from Sonarr and Radarr: one poster and one backdrop per title, plus season posters and episode images. The one exception is TMDB, which may supply them for Discover and title pages." Logos, cast photos, season summaries and per-episode cast all go past "one poster and one backdrop". Trakt and fanart.tv backdrops (`backdrops.ts`) already go past it.
- `PRODUCT.md:64`: "Out of the first version: friend requests, playback statistics, …". Watch progress is shown already; nothing new here unless pages show who watched.
- `PRODUCT.md:80`: "Power over hand-holding. Dense, precise information for someone who knows Sonarr, Radarr and torrents." The watch pages are the opposite register by design; the principle needs a line saying it covers the management side.

DESIGN.md:
- `DESIGN.md:186`: "Light and dark (see Dark mode); the page follows the computer's setting". The TV is "Dark only" (`DESIGN.md:436`). "The same design on web and TV" has to settle this. The A2 frame's notes: "The TV look depends on a dark page. In light, the picture fades into white, so dark pictures turn milky".
- `DESIGN.md:274`: "Title page hero 36/800". `DESIGN.md:445`: TV "Page (40/700 title …)". A2 and the TV frame "A + D" use the film's own title lettering in place of typed titles. No DESIGN.md rule covers logos; A2 notes: "Most title lettering from TMDB is white or cream and disappears on white. Light mode has to tint it to ink".
- `DESIGN.md:441`, TV poster card: "The title and facts line sit 12 under the card and never move." A2 and "A + D" drop text under cards.
- `DESIGN.md:374`: "Poster card: 210 by 315 everywhere (Library, Discover rows and grids, title page)". Home's chosen compact cards (144 × 216) break "everywhere".
- `DESIGN.md:285`, Title header: "220px backdrop band fading to the page colour … behind a 210 by 315 poster, title 36/800, facts column on the right." Every watch page needs a new hero spec.
- `DESIGN.md:214`: "Posters keep their own colour; the interface stays black and white around them." A full-bleed backdrop hero makes the picture, not black and white, the page's ground.

## 5. Design files

Web screens file `dFQMjELOx6ObLS0qOG3NCF`. Pages: README, Foundations, about 50 component pages, Dark mode, Library, Title, Home.
- Title, FINAL (`40:540`): approved. The current owned title header with the section label in place of the breadcrumb, built on `claude/details-back-button-ux-e42d98`. It is the management header; nothing in it is watch-specific.
- Title, DISCOVERY: four back-button tries from 16 Nov; "Section label, borrowed from Plex" chosen, three rejected, one superseded. Exploratory, settled.
- Home, FINAL: empty, "Empty until the owner picks a direction."
- A2 `74:5702`, "Backdrop then rows, compact, TV style": open. The TV Home on the web: a 16:9 picture pinned right fading into the page, title lettering, facts, summary, Play; the hovered row opens. Drawn dark and light. Its notes hold the hero timing, keyboard and empty rules.
- B2 `73:5651`, "Rows only, compact, TV style": open. No hero, Play beside the title under the art.
- C2 `74:5697`, "Continue watching first, compact, TV style": open. A first row of 304 × 171 landscape cards, then poster rows; light.
- D `48:4152`, "Compact cards and Play placement": open. 144 × 216 cards, seven Play placements; recommends "Play beside the title". Its notes say option G "needs TMDB art on Home, which PRODUCT.md does not allow today".
- Hero frames `63:4569` to `63:4572` (right picture with soft edge; framed 16:9 tile; picture above, words below; the hovered card opens): all open, exploratory.
- Older A, B, C: superseded by A2, B2, C2.

TV screens file `LOntH5HQXfvTnfapJoyoqZ`, one page.
- FINAL, approved 31 Oct (T03c taken as approved pending review): T03a B1 film page, B2 show page with season tabs and episodes, B3 show page while downloading; T03d A1 to A4 Home, TV, Films, a Plex list; T03b player; T03a C Pick a release and grabbing. The built screens follow these.
- DISCOVERY `122:12845`, "Hero placement · 1b · Plex proportions, round fade to black": liked 16 Nov ("Alec's favourite is screen 1"). Plain 16:9 picture pinned right with one oval fade to the page colour; tested against 41 saved TMDB backdrops, 33 clean.
- DISCOVERY `137:14098`, "A + D · Open row, words first, title logo, no card text": open. The TV version of A2.

## 6. Constraints from the server and setup

- One viewer. Sign-in accepts only the owner's Plex account and refuses managed and restricted accounts (`src/server/auth.ts:515-532`). Every Plex call uses the owner's token. Pages can show the owner's progress only.
- Plex is required to play. Watch status runs only when the media server is Plex and a Plex token is set (`src/server/index.ts:104`); on Jellyfin, Play is hidden everywhere (`src/client/library/watch.ts:72`). A Jellyfin owner would get watch pages with no Play, no progress and no Continue watching.
- In a plain browser Play opens Plex Web (`watch.ts:77`); the in-app player is the desktop app (Electron with mpv) and the TV app. A web watch page in a browser is a page of links into Plex Web.
- Video goes straight from Plex to the player, never through Cloudflare (`docs/research/in-app-player/README.md:30`); stream addresses come only from `POST /api/playback/start`.
- Plex sits on the remote seedbox. The server keeps one listing of every Plex item for 60 seconds and rebuilds it on Plex's webhook; a cold listing holds a page up to 1.5 s (`watchStatus.ts:97`). On the slot that listing took 0.6 to 0.7 s for 692 episodes (`docs/research/in-app-player/plex-watch-status.md:23`). Any new per-page Plex call (tracks, episode cast) adds one round trip to the seedbox unless saved.
- Episode stills are remote TVDB addresses passed through from Sonarr; title images are copied and served from `/api/images`. A big episode hero would load the same small TVDB still at a larger size.

## Watch page element → reuse, adapt or new

| Element | Verdict | From |
|---|---|---|
| Hero picture and fade | adapt | Web `HeaderBackdrop`; TV `Backdrop` strengths; the liked 1b fade |
| Title lettering (logo) | new | Data from Sonarr `clearlogo`, TMDB or fanart.tv; no component |
| Typed title fallback | reuse | `HeaderTitle` title type, TV `ContentBlock` |
| Facts line | reuse | `metaLine` (`TitleHeader.tsx:41`), TV `showFacts` / `filmFacts` |
| Play or Resume with two lines | reuse | `TitlePlayLine`, `HeaderPlayLine`, `MenuResume`; TV `seriesPlayLine` |
| Mark as watched | reuse | TV buttons; web has no button yet (server route `library.ts:950`) |
| Summary | reuse | Overview text |
| Scores | adapt | Lift the strip out of `CardLibrary`; feed shows from MDBList |
| Cast row | new | Film data on hand; show data partly; no component on web or TV |
| Season list on the show page | new | Season posters and counts on hand; `row-season` is management |
| Episode list on the season page | adapt | `item-episode-list.tsx` (unused), `still-episode.tsx`; TV `EpisodeRow` |
| Episode hero still | adapt | Same still, larger; quality of TVDB still unknown |
| Previous and next episode | reuse | `link-prev-next.tsx` (unused) |
| Versions and tracks on the episode or film page | adapt | `Playable.versions`, `mediaInfo`, `tag-format.tsx` |
| Genre chips and links | reuse | `TitleHeader.tsx:185-237` |
| Similar titles | adapt | Data at `/api/library/tmdb/:type/:id`; poster card |
| Section label and back | reuse | `section-label.tsx` |
| Link to the management page | new | |
| Poster cards on Home | adapt | `library-poster-card.tsx` at 144 × 216 (frame D); TV `Card` |

## Open decisions for the owner

1. Light or dark: do watch pages follow the app's theme on web, or are they always dark like the TV?
2. Title lettering or typed title in the hero? Lettering needs a logo source and a light-mode treatment.
3. Where the watch pages live: new addresses (option A), take over the current ones (B), or one page with a switch (C).
4. Which page opens when you click a title from Search, Calendar, Discover and the Library: watch or management?
5. Does the Library grid stay as a separate page beside Home, and which page do its cards open?
6. Cast: names and roles only, or photos too; and do episode pages show guest cast (one more TMDB or Plex call per episode)?
7. Is a season page its own screen on TV too, or do TV seasons stay as tabs on the show page with the season page only on web? "The same design" decides it.
8. On Jellyfin installs: hide the watch pages, or show them without Play and progress?
9. On a plain browser, where Play opens Plex Web: same watch pages, or send the viewer straight to the management page?
10. PRODUCT.md's image rule (`PRODUCT.md:60`): widen it to logos, cast photos and season art from TMDB and fanart.tv?
