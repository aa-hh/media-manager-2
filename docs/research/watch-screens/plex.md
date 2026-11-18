# Watch screens: how Plex builds the show, season, episode and film pages

Researched 17 Nov 2026 for the playback-first screens (Home → show → season → episode, and film). Read-only: nothing was run, no Plex account was used, no code in this repo changed.

Marks used on every claim:
- **confirmed**: read in shipped code, in a published spec, or in a library's source.
- **inferred**: reasoned from names or nearby code, not read directly.
- **unknown**: looked for, not found.

Words used below:
- **ratingKey**: Plex's id for one item (a show, a season, an episode, a film).
- **pre-play page**: Plex's own name (`PrePlay…` in its code) for an item's detail page.
- **hub**: a row of items Plex's server returns ready-made, with a title, such as "More Like This".
- **On Deck**: Plex's pick of the next episode to watch in a show.

## Sources

1. **Classic Plex Web**, the app at `app.plex.tv/desktop`. Read in two copies, as text:
   - 4.160.0, shipped inside the Plex desktop app on this Mac (`/Applications/Plex.app/Contents/Resources/web-client/js/`). Main file `main-8792-e90a21a5fe7ae941e8eb-plex-4.160.0-75ddd7b.js`; the pre-play page is `chunk-359-ca505e8cdb640886cee9-…js`; the page header's season and episode switcher is `chunk-8369-…js`. Quoted names can be searched for in those files.
   - 4.163.0, downloaded from `https://app.plex.tv/desktop/` on 17 Nov 2026 (`main-8792-0fadf59092c873ab638b-plex-4.163.0-8246fd2.js`). The item call's parameters, the related-hubs version check and the credits call are byte-for-byte the same as in 4.160.0. The page layout chunk was read only in 4.160.0.
2. **The new Plex for Android TV app**, from the owner's own notes in `/Volumes/Space/plex-re/` (version 2026.20.0, read from its string table and decompiled native code). Section 3.
3. **Plax**, the owner's LG TV client, [github.com/aa-hh/Plax](https://github.com/aa-hh/Plax) at `a5751bf` (20 Sep 2026): `src/ui/screens/detailScreen.js`, `src/plex/library.js`, `docs/agent-handoff-browse-playback-detail.md`.
4. **python-plexapi** [github.com/pkkid/python-plexapi](https://github.com/pkkid/python-plexapi), default branch on 17 Nov 2026 (latest release 4.18.3): `plexapi/base.py`, `video.py`, `media.py`, `mixins/objects.py`, `mixins/resources.py`.
5. **Plex's published API reference**, [developer.plex.tv/pms](https://developer.plex.tv/pms/), version 1.2.3. The OpenAPI file is embedded in that page and was extracted.
6. Earlier research in this repo: [plex-desktop-network.md](../in-app-player/plex-desktop-network.md), [plex-watch-status.md](../in-app-player/plex-watch-status.md), [plex-playback-features.md](../in-app-player/plex-playback-features.md), [plax-lessons.md](../in-app-player/plax-lessons.md), [home-page/data-sources.md](../home-page/data-sources.md), [home-page/motion-and-speed.md](../home-page/motion-and-speed.md).

## Short answer

- **Navigation depth is where Plex's two apps differ most.** Classic Plex Web has four separate pages: show, season, episode, film. The new TV app has one show screen: a season picker and that season's episodes live inside it, and an episode opens in the same show screen (owner's notes). Section 1.
- **Classic Plex Web feeds every detail page from one call**, `GET /library/metadata/{ratingKey}` with `includeConcerts, includeExtras, includeOnDeck, includePopularLeaves, includePreferences, includeReviews, includeChapters, includeStations, includeExternalMedia` and four `async…` flags (confirmed in 4.160 and 4.163). Then up to four follow-up calls: the children list, the extras list, the related hubs and the augmentation hubs.
- **Cast & Crew comes from the item itself** (`Role`, `Director`, `Writer`, `Producer`), capped at 25 people plus a "view all" tile (confirmed). The separate `/credits` call is for person pages.
- **Play on a show or season plays Plex's On Deck episode**, fetched with `includeOnDeck=1`. A season with no On Deck episode plays its first unwatched episode (confirmed). Play on an item with a resume point asks "Resume from {time}" or "Start from the beginning" (confirmed).
- **Our server already has most of each page**: Sonarr and Radarr give titles, overviews, seasons, episode stills, air dates, file details and film credits; TMDB (saved in the title store) gives TV cast and similar titles; MDBList gives show scores; Plex's 60-second listing gives watch marks, resume points and versions per episode and film.
- **The real gaps are four**: a title logo (clear logo), audio and subtitle choices on the detail page, Plex's own extras, and theme music. Only the audio and subtitle choices have to come from Plex.
- **Detail page hero**: the new Plex TV app uses the same clear logo, cover-fit picture, bottom scrim and fade-out on scroll on its detail screens as on Home, plus a colour wash our Home rules reject. Classic Plex Web shows no logo and only a full-page background. Our detail pages can reuse the TV Home hero rules as they are (section 8).
- **Recommended**: no new Plex call for show and season pages; one light Plex item call on the episode and film pages, only when the viewer opens the audio or subtitle picker (or on page load, if the owner wants them visible). Section 7.

## 1. Navigation depth: classic Plex Web against the new TV app

This is the decision the owner is making, so it comes first.

| | Classic Plex Web (4.160, 4.163) | New Plex for Android TV (2026.20, owner's notes) | Plax (owner's LG client) |
|---|---|---|---|
| Show | Own page. Seasons are a grid of season posters below the header (confirmed: `PrePlayDescendantList`, default style `PrePlayGrid`) | Show screen with a season picker (`LumaDetailsSiblingsMenuContent`) and one row of the chosen season's episodes (`LumaDetailsChildrenRowScroller`) (confirmed by string table) | Show screen with season tabs and a 16:9 episode grid that refills when a tab is chosen (confirmed, `detailScreen.js`) |
| Season | Own page, reached by clicking a season poster. Lists its episodes (confirmed) | No separate season screen: choosing a season changes the episode row inside the show screen (confirmed component names; route `:name/season/:season`) | Exists as its own detail type, also reachable from the show (confirmed) |
| Episode | Own pre-play page (confirmed) | Opens inside the show screen: `ShowEpisodeScreen` serves both the show and the episode (confirmed name; exact layout inferred). Route `:name/season/:season/episode/:episode` | Own layout planned, not built at `a5751bf` (Plax handoff doc, package B1) |
| Moving between siblings | Header has previous and next arrows and a menu listing the siblings (other seasons on a season page, other episodes on an episode page) (confirmed: `toolbarPrevious`, `toolbarNext`, `PrePlayPageHeaderSiblingsMenu`) | The season picker; on Roku a "SHOW" entry was added to the season bar to reach the show level ([Plex forum, 9 Jun 2025](https://forums.plex.tv/t/roku-preview-has-now-been-updated-to-the-new-experience-plex-would-love-to-hear-from-us/919354/237), user report) | Tabs |
| Back | Browser back; the page's scroll position is restored (`useScrollRestore` key `PrePlayPageContent`, confirmed) | Returns to the row the viewer came from with the same item focused (owner's notes; the link between `popToTopOnBlur` and focus restoring is marked inferred there) | Router back; `parentDetail` kept for child pages (confirmed) |

What this means for us:
- The flow the owner described (show page → season page → episode page) is the classic web model: three page loads and three Backs to get from an episode to Home.
- The new TV app's model is one show screen where the season is a picker and episodes are a row, so the viewer never leaves the show to pick an episode. Its episode view is part of the same screen.
- Both use the same data underneath: the show item, the season list (`/children`) and one season's episodes (`/children` of the season). The choice is a design choice, not a data one.

## 2. Classic Plex Web: page anatomy

All of this is from the 4.160.0 pre-play chunk unless marked. The page picks one layout per type (`Show`, `Season`, `Episode`, `Movie`, plus person, collection and music layouts) in one switch; an item with no layout shows "Pardon our dust. This item is lacking a details page." (confirmed).

### 2.1 Parts every detail page shares

The header (`PrePlayMetadata`) takes these slots, in this order (confirmed slot names; pixel layout inferred):
- **Background**: the item's art. The 2021 TV layout defaulted to a blur of colours from the artwork, not the photo ([motion-and-speed.md](../home-page/motion-and-speed.md), confirmed there for the TV layout). The server can compute those four colours: `GET /services/ultrablur/colors?url=…`, and draw the blur: `GET /services/ultrablur/image?topLeft=…&topRight=…&bottomRight=…&bottomLeft=…&width=…&height=…` through the image resizer `/photo/:/transcode` (documented in the spec).
- **Poster**: shown only when the window is at least 800 px wide (confirmed).
- **Attribution logo**: the logo of the outside source, for titles from Plex's online catalogue (confirmed). This is not the title's own logo. Classic Plex Web shows the title as text; it never reads `clearLogo` (inferred: no `clearLogo` string in the pre-play chunk).
- **Title**, **subtitle**, **badges** (edition, such as "Director's Cut"), **facts** line, **ratings**, **star rating** (the viewer's own score out of 10), **social proof** ("people on Plex have watched this"), **summary** with More / Less, and the **button bar**.
- **Theme music**: on page load, if the "play theme music" setting is on, plays `grandparentTheme`, else `parentTheme`, else `theme` (confirmed).

Below the header, rows appear in a fixed order per type (next sections). Each row is its own data source:
- **Cast & Crew**: people from the item's `Role` tags (title "Cast"), then `Director`, `Writer` and `Producer` (title "Crew"), merged by name so one person with two jobs shows once with "Actor / Director". At most 25, then a "view all" tile. Each person has `tag` (name), `role` (character), `thumb` (photo address), `tagKey` (confirmed).
- **Ratings & Reviews**: either critic reviews from the item's `Review` elements (sent because of `includeReviews=1`) or Plex users' reviews, depending on a setting (confirmed).
- **Extras**: trailers and other extras from `{key}/extras`, laid out as 16:9 cards (confirmed).
- **Augmented hubs**: rows from Plex's online service, fetched from the item's `augmentationKey` with `wait=1` (confirmed call; content inferred, for example more titles by the same people).
- **Where to watch**: other services and servers that have the title (confirmed, Plex account feature).
- **Related**: hubs from `{key}/related` (section 5.2), minus the streaming-service upsell hub (confirmed).

Score badges (confirmed, function reading `Rating` elements): each `Rating` element has `image`, `value`, `type`. The `image` prefix picks the logo: `imdb://` IMDb, `rottentomatoes://…certified|ripe|rotten|spilled|upright` Rotten Tomatoes critic or audience, `thetvdb://` TheTVDB, `themoviedb://` TMDB, anything else a plain score. On a season, the badge comes from the plain `rating` / `audienceRating` fields instead.

### 2.2 Show page

1. Header. Facts: content rating (for example "TV-MA"), release date if not out yet (in the accent colour), year, genres. Score badges. Summary.
2. Buttons: Play, Add to / Remove from Watchlist, Play Trailer, Mark as Played / Unplayed, Download, Edit, Share (confirmed list, `promotedActions`). Shuffle, Play Next and Add to Queue sit in the "…" menu (confirmed strings).
3. Where to watch (Plex catalogue titles only).
4. **Seasons**: a grid of season posters, each with its title and episode count (confirmed `PrePlayGrid` fields for seasons; label text inferred). The viewer can switch the list to a detailed list (`Details`, `SimpleDetails` styles, confirmed). Plex Web asks for the first 20 and pages the rest as the grid scrolls (confirmed `size:20`).
5. Cast & Crew.
6. Ratings & Reviews.
7. Extras.
8. Where to watch (library titles, when the Discover source is on).
9. Related.

Shows with `skipChildren` set (mini-series without seasons) list episodes straight away, using `/grandchildren` instead of `/children` (confirmed, spec and Plex Web).

### 2.3 Season page

1. Header: show title, season title as subtitle, score badges, summary.
2. Buttons: Play, Watchlist, Mark as Played / Unplayed, Download, Edit, Share. No trailer (confirmed).
3. Where to watch.
4. Cast & Crew.
5. Ratings & Reviews.
6. **Episodes**: the season's `/children`. In the grid style, each card is the episode's 16:9 still with its title and episode number (confirmed fields, label text inferred). In the simple list style only 3 episodes show at first, then "Show All Episodes" (confirmed).
7. Where to watch, then Related.

On the season page, cast and reviews come before the episode list (confirmed order in the code).

### 2.4 Episode page

1. Header:
   - Title: the **show's** name, linking to the show page; subtitle: the **episode's** title (confirmed).
   - Facts: season name (linking to the season page), "Season 1 Episode 3" or the air date for daily shows, a progress fact, release date if not out yet.
   - Second line: content rating, air date, duration.
   - Score badges, summary.
   - "Directed by" and "Written by", two names each.
   - **Media details** next to them: Video, Audio, Subtitles and Versions, each with the current choice, and pickers for audio and subtitles (confirmed strings and the streams menu components; layout inferred).
2. Buttons: Play, Watchlist, Mark as Played / Unplayed, Download, Edit, Share (confirmed).
3. Where to watch, Cast & Crew (guest cast from the episode's own `Role` tags), Ratings & Reviews, augmented hubs, Related.

There is no list of the season's other episodes on the episode page; the header's previous / next arrows and siblings menu do that job (confirmed components).

### 2.5 Film page

1. Header: facts are content rating, release date if upcoming, year, a further fact (inferred to be duration), genres, "available until" and "Purchased" badges for catalogue rentals. Subtitle: "Directed by" up to 3 names. Score badges, star rating, summary. Media details (Video, Audio, Subtitles, Versions) beside it.
2. Buttons: Play, Buy / Rent (catalogue only), Watchlist, Play Trailer, Mark as Played / Unplayed, Download, Edit, Share (confirmed).
3. Where to watch, Cast & Crew, Ratings & Reviews, Extras, augmented hubs, Where to watch, Related.

"Play Trailer" plays the item's `primaryExtraKey`, which "for a movie is a trailer" (spec, confirmed). Collections the film belongs to come in the related hubs (inferred; `includeCollections` appears in Plex Web's list code, not on this call).

### 2.6 What Play does

- **Show**: fetches the show with `includeOnDeck=1` and plays the `OnDeck` episode as a continuous queue (next episodes follow) (confirmed).
- **Season**: same call on the parent show; plays the On Deck episode only if it belongs to this season, else fetches the season's `/children` and plays the first episode with no `viewCount` (confirmed). Plax copies this, and when every episode is watched starts the season again from episode 1 (confirmed in Plax).
- **Episode or film with a resume point**: a "Resume Playback" dialog: "Resume from {time}" with time left, or "Start from the beginning" (confirmed).
- **Film started from the start**: may play trailers first (`extrasPrefixCount`, [plex-desktop-network.md](../in-app-player/plex-desktop-network.md) section 6.1).

### 2.7 Cards, Continue Watching and Back

- A poster card has a link area, a play circle, a "…" menu and an edit button (confirmed class names `MetadataPosterCardActions-playButton`, `-playCircle`, `-moreButton`). Clicking the poster opens the item's pre-play page and the play circle plays (inferred from those names).
- A **Continue Watching** episode card is the episode item itself, so clicking it opens the **episode** page, and its play circle resumes (inferred). Its "…" menu adds "Remove from Continue Watching" (confirmed).
- New TV app: what selecting a Continue Watching card does is not in the owner's notes or in public posts found (unknown). On Roku, users report the next unplayed episode is already focused when a show screen opens ([forum, 9 Jun 2025](https://forums.plex.tv/t/roku-preview-has-now-been-updated-to-the-new-experience-plex-would-love-to-hear-from-us/919354/237)).

## 3. The new Plex TV app (owner's notes)

From `/Volumes/Space/plex-re/PLEX-NAVIGATION-AND-DETAIL-SCREENS.md`, `PLEX-HERO-IMAGE-RENDERING.md`, `PLEX-API-AND-DESIGN-REPORT.md` and `PLEX-ANIMATION-AND-TRANSITIONS.md`: Plex for Android TV 2026.20.0, read from the Hermes bytecode string table and decompiled Kotlin and C++. The JavaScript itself could not be decompiled, so names are confirmed and behaviour mostly inferred. The marks below are the notes' own.

**One detail screen pattern for every type** (confirmed by string table). `LumaDetailsScreen` and its parts, top to bottom:
1. Header and hero: `LumaDetailsResponsiveHeader` / `LumaDetailsScreenHero`. Backdrop, title logo (`bodyTitleArtwork`, `ClearLogo`, `Title Art`), facts row, description.
2. Action bar: `LumaTVActionButtonBar`, a row of `ActionButtonTV`, plus an overflow menu (`LumaHeroOverflowMenu`).
3. Siblings and children: `LumaDetailsSiblingsMenuContent` (the season picker) and `LumaDetailsChildrenRowScroller` (episodes, extras, deleted scenes, related, each a row).
4. More rows: related, cast, reviews.
Three variants of the screen (`LumaDetailsScreenTsx1`–`3`) serve phone, tablet and TV from the same data. Type-specific screens exist for films (`MovieDetailScreen`), shows and episodes (`ShowEpisodeScreen`), people, collections, playlists and music.

**Season and episode navigation happens inside the show screen** (confirmed names): `ShowDetailsNavigation`, `ShowDetailsNavigationTV`, `usePMSShowEpisodeNavigation`, behind a feature flag `hasShowDetailsNavigationFeature`. Route shapes `:name/season/:season` and `:name/season/:season/episode/:episode`, parsed back from slugs by `([\w-]+)-season-(\d+)(?:-episode-(\d+))?` (confirmed strings). Which screen each route opens is inferred.

**Actions come from a server, not the app** (endpoint confirmed, response shape inferred): the app asks `/api/action/get-actions-for-metadata-item` on `luma.plex.tv` which buttons to show, and performs them with `/api/action/metadata/:id`. Buttons in the bundle include `LumaWatchActionButton` (play), rate, download, cast, "edit watched date", watchlist.

**Screens can be server-defined** (confirmed endpoints): `/api/screen` and `/api/fragment` on `luma.plex.tv`, shaped by `x-plex-luma-*` headers (layout, capabilities, settings). This needs a plex.tv account session; our server cannot use it.

**Calls to the owner's own Plex server** for a detail screen (confirmed strings): `/library/metadata/:ratingKey`, `/children`, `/credits` (full credits route `libraries/:serverId/metadata/:ratingKey/credits`), related `/hubs/metadata/:ratingKey`, `/similar`, `includeOnDeck`, `includeGuids`, `includeUserState`, `excludeFields`, `excludeElements`. Exact flags per call: unknown.

**Hero** (confirmed in decompiled code unless marked): artwork drawn to fill its box and cropped at the edges, centred by default; requested from the server's `/photo/:/transcode` at the size of the view; a cross-fade when the focused item changes; the full-screen background is a colour wash from `ultrablur/colors` (on `luma.plex.tv` as `/api/fragment/ultrablur/colors?url=`); a bottom scrim and gradient keep text readable. The title is a clear logo shown whole (that it is fitted whole, and that text is the fallback without a logo: inferred).

**Focus and Back**: Android's own focus system. Back returns to the row and item the viewer came from (stated; partly inferred). Holding up or down is throttled (`setVerticalDpadRepeatThrottleMs`, confirmed in code) so a row change settles before the next. The focused row expands and reserves its height before animating, so rows above and below do not jump (`ExpandingRow`, `setReservedHeight`, confirmed in code); some rows never expand (`NonExpandingRow`).

**Where it differs from classic Plex Web**:
- Depth: one show screen with a season picker and an episode row, against separate show, season and episode pages.
- Title: a logo image, against plain text.
- Buttons: decided by Plex's servers per item, against a fixed list per type.
- Background: artwork colour wash plus artwork, against art or colour blur by setting.

## 4. Plax (the owner's LG client)

Confirmed in `detailScreen.js` and `library.js` at `a5751bf`:
- Item: `GET /library/metadata/{id}?includeChildren=1&includeExtras=1&includeMarkers=1&includeChapters=1&includeRelated=0&includeOnDeck=0`.
- Seasons and episodes: `/library/metadata/{id}/children`, one call per show, one per season, cached in memory.
- Related rows: `/hubs/metadata/{id}/related`, 12 items, and it warms the metadata of the related items so opening one is instant.
- Score: `audienceRating` or `rating`, with the logo chosen from `audienceRatingImage` or `ratingImage`.
- Show page: title, facts line, score, overview, season tabs, 16:9 episode grid that refills per tab, "Play" / "Resume" and "Play from start" buttons.
- Plax's own handoff lists what its episode page still lacks: series title linking to the show, "season · episode · time left" line, IMDb or audience score, Video / Audio / Subtitles as labelled rows with pickers, a TV-friendly episode picker.

## 5. API calls, with real parameter names

### 5.1 The item call

`GET /library/metadata/{ratingKey}`. Several ids may be joined with commas (spec). Every `include…` flag below is undocumented in the spec; the spec only says the details endpoint accepts them (it mentions `includeExtras=1` once). "Web" is what Plex Web's detail page sends (confirmed in 4.160 and 4.163).

| Flag | Adds | Web | Our need |
|---|---|---|---|
| `includeOnDeck=1` | An `OnDeck` element holding the next episode (show) | yes | Show Play button. Already called by `plex.onDeck()` |
| `includeExtras=1` | An `Extras` block with the first extras; the full list is `{key}/extras` | yes | Extras row |
| `includeReviews=1` | `Review` elements: `tag` (critic), `text`, `image`, `link`, `source` (python-plexapi `media.Review`) | yes | Reviews row, if wanted |
| `includeChapters=1` | `Chapter` elements | yes | Player only |
| `includeMarkers=1` | `Marker` elements (intro, credits) | no on the page, yes at play start | Player only |
| `includeRelated=1`, `includeRelatedCount=1` | Related hubs inline | no (separate call) | Use the separate call |
| `includeConcerts`, `includeStations`, `includePopularLeaves`, `includePreferences` | Music, radio, popular tracks, per-item settings | yes | No |
| `includeExternalMedia=1` | Items from other providers | yes | No |
| `includeGuids=1` | `Guid` elements: `imdb://tt…`, `tmdb://…`, `tvdb://…` | no (detail replies carry them anyway: inferred) | Already sent on our listing |
| `includeFields=thumbBlurHash,artBlurHash` | Small blur codes for placeholders | no | Optional placeholder (python-plexapi default; field contents unverified) |
| `excludeElements=…`, `excludeFields=…` | Drops tags or fields to shrink the reply | no | Useful for light calls |
| `checkFiles=1` | Checks the files exist on disk, synchronously | the media-info dialog only | Avoid on page load: our player call allows it 60 s (`plexPlayback.ts:216-220`) |
| `asyncCheckFiles`, `asyncRefreshAnalysis`, `asyncRefreshLocalMediaAgent`, `asyncAugmentMetadata` | Start background work on the server; the last returns an `augmentationKey` | yes | Never send ([plex-playback-features.md](../in-app-player/plex-playback-features.md) trap) |

python-plexapi's full-item reload sends `includeChapters=1`, `includeMarkers=1`, `includeBandwidths=1`, `includeGeolocation=1`, `includeLoudnessRamps=1` and the blur-hash fields, the rest `0` (`base.py` `_INCLUDES`, confirmed).

### 5.2 Lists around an item

| Call | Returns | Status |
|---|---|---|
| `/library/metadata/{show}/children?excludeAllLeaves=1` | The seasons. Without `excludeAllLeaves` Plex adds an "All episodes" entry (Plax filters it out) | confirmed (python-plexapi `Show.seasons`, Plex Web siblings) |
| `/library/metadata/{season}/children` | The season's episodes | confirmed |
| `/library/metadata/{show}/grandchildren` | Episodes of a show with `skipChildren` | confirmed (spec) |
| `/library/metadata/{show}/allLeaves` | Every episode of the show. 0.03 s on the slot | documented; timing from [plex-watch-status.md](../in-app-player/plex-watch-status.md) |
| `/library/metadata/{id}?includeOnDeck=1` → `OnDeck.Metadata[0]` | Next episode. "If show is unwatched, return will likely be the first episode" (python-plexapi) | confirmed; in use (`plex.ts:108-113`) |
| `/library/metadata/{id}/extras` | Trailers, featurettes, deleted scenes (`Extra` items with `subtype`, `extraType`) | documented |
| `/library/metadata/{id}/related` | Related hubs. Plex Web adds `includeAugmentations=1&includeExternalMetadata=1&includeMeta=1`; servers older than 1.19.2 use `/hubs/metadata/{id}/related` instead | confirmed (both versions); documented |
| `/hubs/metadata/{id}/related?count=` | The same hubs, older address; Plax uses it | documented |
| `/library/metadata/{id}/similar?count=` | A flat list of similar items, default 200 | documented |
| `/library/metadata/{id}/credits` | `CreditGroup` with `Credit` / `Role`; Plex Web uses it on person pages | confirmed call; not in the spec (the spec's `/credits` is a `PUT` that detects credits markers) |
| `/library/metadata/augmentations/{id}?wait=1` | Hubs from Plex's online service | documented |
| `/hubs/metadata/{id}/postplay` | After-playback hubs | documented; in use (`plexPlayback.ts:292`) |
| `/library/metadata/{id}/users/top` | Which accounts played it most | documented |

Paging: Plex Web asks for 20 children at a time with `X-Plex-Container-Start` / `-Size` and fetches more as the list scrolls (confirmed). The spec says providers may return only 20 when no paging is sent; that rule is written for outside providers, and whether the library returns every child without paging is unverified here (inferred yes: python-plexapi passes the season count as the page size).

### 5.3 Fields on the item

| What | Field | Notes |
|---|---|---|
| Backdrop | `art`; episodes also `grandparentArt`; `hero`, `parentHero`, `grandparentHero` | `hero` is documented as "a hero image for the item"; Plex Web's pre-play page does not read it (inferred) |
| Poster / still | `thumb` (episode: its still), `parentThumb`, `grandparentThumb` | |
| Title logo | `Image` elements with `type` `clearLogo` (also `background`, `banner`, `coverPoster`, `snapshot`), each with `url` and `alt` | Spec and python-plexapi `logo()`; only filled when the library's agent supplies one (inferred) |
| Background colours | `UltraBlurColors`: `topLeft`, `topRight`, `bottomLeft`, `bottomRight` | python-plexapi; also `/services/ultrablur/colors` |
| Image resizing | `/photo/:/transcode?url=…&width=&height=&minSize=1&upscale=0` (also `blur`, `opacity`, `blendColor`, `format`) | Spec; Plex's apps use it for every image |
| Scores | `rating` + `ratingImage`; `audienceRating` + `audienceRatingImage` (for example `rottentomatoes://image.rating.spilled`, `themoviedb://image.rating`, `imdb://image.rating`); `Rating` elements (`image`, `value`, `type`) | Which sources appear follows the library's agent settings (inferred) |
| Viewer's score | `userRating` (0–10) | |
| Outside ids | `Guid` elements: `imdb://`, `tmdb://`, `tvdb://` | Already used for matching (`watchStatus.ts`) |
| People | `Role` (`tag`, `role`, `thumb`, `tagKey`, `filter`), `Director`, `Writer`, `Producer` | `thumb` is a full image address, for example on `image.tmdb.org` (spec example) |
| Facts | `contentRating`, `year`, `originallyAvailableAt`, `duration`, `studio`, `tagline`, `Genre`, `editionTitle`, `childCount` / `seasonCount`, `leafCount`, `viewedLeafCount` | |
| Theme music | `theme`, `parentTheme`, `grandparentTheme` → `/library/metadata/{id}/theme/{timestamp}` | |
| Trailer | `primaryExtraKey` → the trailer's own item | |
| Resume and watched | `viewOffset`, `viewCount`, `lastViewedAt` | Already in our listing |
| Versions and tracks | `Media[]` (one per version: `videoResolution`, `height`, `bitrate`, `videoCodec`, `audioCodec`, `audioChannels`, `container`) → `Part[]` → `Stream[]` (`streamType` 1 video, 2 audio, 3 subtitle; `language`, `displayTitle`, `selected`, `default`, `forced`) | Our listing has `Media` and `Part` (we read versions from it, `watchStatus.ts:110-131`); whether listings carry `Stream` is inferred no |
| Markers | `Marker` (`type` `intro`/`credits`, `startTimeOffset`, `endTimeOffset`) | Player only |

### 5.4 Calls per screen in classic Plex Web

| Screen | Calls, in order (all confirmed) |
|---|---|
| Show | 1. Item call (5.1). 2. In parallel: `{show}/children` (20 at a time); `{key}/extras` when the item lists extras; `{key}/related?includeAugmentations=1&includeExternalMetadata=1&includeMeta=1`; the `augmentationKey` with `wait=1`. 3. On Play: the show again with `includeOnDeck=1` |
| Season | 1. Item call. 2. `{season}/children` (episodes); `{show}/children?excludeAllLeaves=1` (sibling seasons for the header menu); related; augmentation. 3. On Play: the show with `includeOnDeck=1`, then maybe `{season}/children` |
| Episode | 1. Item call. 2. `{season}/children?excludeAllLeaves=1` (sibling episodes for the header menu); related; augmentation. 3. On Play: item again with markers and chapters, play queue, decision ([plex-desktop-network.md](../in-app-player/plex-desktop-network.md)) |
| Film | 1. Item call. 2. `{key}/extras`; related; augmentation |

Images are separate requests through `/photo/:/transcode`.

## 6. What our server already has

Today both apps open a title through `GET /api/library/series/:id` and `GET /api/library/movie/:id` (`src/server/library.ts:618-675`; TV app `android-tv/…/api/Library.kt:223-225`). TV cast and similar titles come from `GET /api/library/tmdb/:type/:tmdbId` (`src/server/tmdbTitles.ts:146`).

| Page element | Have it? | From | Where | New call needed |
|---|---|---|---|---|
| Show / film title, year, overview, genres, certification, runtime, network or studio | yes | Sonarr / Radarr | `library.ts` `seriesDetail`, `movieDetail` | none |
| Backdrop | yes | TMDB (default), Trakt or fanart.tv by setting | `src/server/backdrops.ts` | none |
| Poster, season posters | yes | Sonarr / Radarr | `library.ts:286`, `seasons[].posterUrl` | none |
| Title logo | no | Sonarr and Radarr both have a `Clearlogo` image type (confirmed in their `MediaCoverTypes`); Plex `Image type=clearLogo`; TMDB `/images` logos; fanart.tv `hdtvlogo` / `hdmovielogo` (fanart client reads backgrounds only today, `fanart.ts`) | not used today | Read `clearlogo` from the Sonarr / Radarr images we already fetch (whether they are filled per title: unchecked) |
| Show scores | yes | MDBList: IMDb, Rotten Tomatoes critic and audience, Metacritic; 7-day cache, 3 s cap on first load | `mdblist.ts`, `library.ts:537` | none |
| Film scores | yes | Radarr `ratings` | `library.ts` `MovieDetail.ratings` | none |
| Seasons with counts ("4 of 8") | yes | Sonarr statistics | `library.ts`, `src/client/title/rows.ts:71-85` | none |
| Episode list: title, number, air date, overview, runtime, still | yes | Sonarr episodes (`imageUrl` = Sonarr `screenshot`) | `library.ts:58-76`, `:342` | none |
| Episode file details (resolution, audio and subtitle languages) | yes | Sonarr / Radarr file media info | `FileDetail` | none |
| Watched, resume point, length, last played, per episode and film | yes | Plex listing, rebuilt every 60 s or on Plex's webhook | `watchStatus.ts:146-186`, `forSeries` `:432`, `forMovie` `:459` | none |
| Show's next episode (Play button) | yes | Plex `includeOnDeck=1`, waits at most 1.5 s | `plex.ts:108-113`, `watchStatus.ts:438` | none |
| Versions (several files of one title) | yes | Plex `Media` / `Part` from the listing | `watchStatus.ts:110-131` | none |
| Audio and subtitle choices before Play | no | Plex `Stream` elements on the full item | not used today | **Plex item call** on episode and film pages |
| Film cast and crew with photos | yes | Radarr credits, one extra Radarr call | `library.ts:654` | none |
| Show cast with character | yes | TMDB `aggregate_credits`, saved in the title store | `tmdb.ts:250`, `tmdbTitles.ts` | none |
| Episode guest cast | no | Plex `Role` on the episode; TMDB `/tv/{id}/season/{n}/episode/{e}/credits` | not used today | Optional |
| Trailer | films: yes | Radarr `youTubeTrailerId` (YouTube) | `library.ts:405` | none; Plex local trailers need `/extras` |
| Extras (featurettes, deleted scenes) | no | Plex `{key}/extras` | not used today | Optional Plex call |
| Similar / related | yes | TMDB `recommendations`, saved | `tmdb.ts:250` | none; filter to library titles for "playable" |
| Reviews | no | Plex `includeReviews=1` | not used today | Optional |
| Theme music | no | Plex `theme` | not used today | Optional (needs the item call and an audio proxy) |
| Intro / credits markers | at play start | Plex | `plexPlayback.ts:216-220` | none for the page |
| Background colours | no | Plex `/services/ultrablur/colors`; or our current blurred poster (`header-title.tsx`) | not used today | none needed |

**Jellyfin** is supported as a media server in code (`src/server/services/jellyfin.ts`), but watch status is off unless the server is Plex (`src/server/index.ts:104`), the Jellyfin listing asks for no watch data (`EnableUserData: 'false'`, `jellyfin.ts:87`) and Play is hidden on Jellyfin ([data-sources.md](../home-page/data-sources.md)). Equivalents, from Jellyfin's public API (not called anywhere in this repo; inferred):

| Plex | Jellyfin |
|---|---|
| `/library/metadata/{id}` | `/Users/{userId}/Items/{id}` (with `People`, `ImageTags` including `Logo`, `MediaSources` with streams) |
| `{show}/children` | `/Shows/{id}/Seasons` |
| `{season}/children`, `allLeaves` | `/Shows/{id}/Episodes?seasonId=` |
| `includeOnDeck=1` | `/Shows/NextUp?seriesId=` |
| `{key}/extras` | `/Items/{id}/SpecialFeatures` |
| `/similar`, `/related` | `/Items/{id}/Similar` |
| `clearLogo` image | `/Items/{id}/Images/Logo` |

## 7. Recommendation: smallest set of calls per screen

Where the server sits: the live install runs on the Whatbox seedbox with Plex on the same machine at a loopback address ([codebase-fit.md](../in-app-player/codebase-fit.md), "The configured Plex address is a loopback address on the seedbox"), so a Plex call costs milliseconds (0.03 s for a show's `allLeaves` on the slot). Setup accepts any Plex address, so another install can have Plex across the internet; then each Plex call adds one internet round trip (inferred 50–200 ms) and the 60-second listing (0.7 s for 692 episodes on the slot) moves more data. Sonarr and Radarr are local on the slot too; TMDB, MDBList, fanart.tv and Trakt are always across the internet and are cached in SQLite.

| Screen | Calls | Latency risk |
|---|---|---|
| Show | The existing `GET /api/library/series/:id`: Sonarr series + episodes (local), backdrop and MDBList scores (saved copies; first load waits up to 3 s for MDBList), Plex marks from the listing (memory), On Deck (`includeOnDeck=1`, capped at 1.5 s). Plus the existing TMDB title call for cast and similar (saved). Logo: read `clearlogo` from the Sonarr reply. **No new Plex call.** | Low on the slot. The Sonarr episodes call grows with long shows. First visit to a title waits on TMDB and MDBList. With remote Plex, only On Deck adds a round trip, already capped |
| Season | Nothing new: the show reply already holds every episode with its marks. If the season is its own page, open it from the cached show reply. | None |
| Episode | Same show reply, plus one new light Plex call for audio and subtitle choices: `GET /library/metadata/{episodeKey}` with no `checkFiles` and no `async…` flags, ideally `excludeElements=Role,Director,Writer,Genre` to trim it. Make it when the viewer opens the picker, or in the background after the page draws. | Low on the slot (one local call). With remote Plex, one round trip; never block the page on it. `checkFiles` must stay off: it reads the disk and our player allows it 60 s |
| Film | The existing `GET /api/library/movie/:id` (Radarr movie and credits, scores, backdrop, Plex marks and versions). Same light Plex item call as the episode for audio and subtitles. Logo from the Radarr reply. | Same as episode. Radarr credits is a second Radarr call, already made today |
| Extras, reviews, theme music, Plex related hubs | Leave out of the first version. If wanted later: `{key}/extras`, `includeReviews=1` on the light item call, `theme` through an image-style proxy, `{key}/related`. | `related` with `includeAugmentations` / `includeExternalMetadata` may make Plex call its online service (inferred), so it can be slow even with a local Plex |

Images: Plex artwork addresses point at a server the browser and TV cannot reach (loopback), so any Plex image (logo, ultrablur, theme) would need to pass through our server like the playlist collage already does (`plex.ts:129`). TMDB, Sonarr and Radarr images already work.

## 8. Detail page hero compared with our TV Home hero

Question from the TV Home hero session: do Plex's show, film and episode pages use the same clear logo and backdrop fade as the Home hero? Compared against [tv-home-hero-rules.md](tv-home-hero-rules.md). Sources: the owner's `PLEX-HERO-IMAGE-RENDERING.md` (the `/Volumes/Space/plex-re/` copy; the `~/Downloads` copy is an earlier edit of the same report that marks the colour-wash section "IGNORE - we dont do full colour like plex") and `PLEX-ANIMATION-AND-TRANSITIONS.md`, plus the classic web bundle.

**New Plex TV app: yes, the detail screen uses the same parts as the Home hero**, apart from details the notes could not recover.
- Same logo: the detail screen's body carries a text title and a logo side by side (`bodyTitle`, `bodyTitleArtwork`), and the logo is the one artwork type users can change under "Title Art" (confirmed by string table). Home uses the same type, so it is the same image (inferred). Shown whole, never cropped, text title kept for screen readers (inferred in the notes).
- Same picture handling: one image view (`ChromaImageView`) for every hero, cover fit, centred unless a position is passed, no face or subject finding in the bundle (confirmed in decompiled code). The detail backdrop is the item's `art`, `banner` or `grandparentArt`, never the poster (confirmed field names; which field per type is inferred). So an **episode page shows the show's art** (`grandparentArt`), not the episode still (inferred).
- Same fade-out on scroll: detail and Home heroes sit in a sticky header that fades away as the viewer moves down (`renderStickyHeaderBackdrop`, `backdropExiting`, `LumaScreenHero` driven by scroll position; confirmed names).
- Same readability treatment: a bottom scrim and linear gradient whose opacity animates (`BottomScrimView`, `LinearGradient`, confirmed names), with the words anchored by a gravity setting, in practice to the bottom (inferred in the notes). Gradient stop values: not recovered.
- Same colour wash behind it: the full-screen background is the four-colour wash from `ultrablur/colors` (confirmed in code). Placement of the picture on the detail screen (full width, or pinned right like our Home): unknown.

**Classic Plex Web: no**, it has no hero.
- No logo on any detail page. `clearLogo` appears only as an artwork type the owner can edit (server 1.43.0 or later, `clearLogoEditing:"1.43.0"`); the pre-play chunk never reads it (confirmed).
- The background fills the whole page behind the content (`FullPageBackground`, confirmed): either a four-colour wash whose colours the browser extracts itself from a 240 px copy of the art (falling back to no wash when the art is very dark), or the art itself at up to 1920 × 1080, dimmed through `/photo/:/transcode` filters, with a texture on top (confirmed code; which one is the default is unknown).

**Against our TV Home rules:**

| Our Home rule | New Plex TV detail screen | Classic Plex Web detail page |
|---|---|---|
| 16:9 picture pinned right, cover fit, centred, no subject finding | Cover fit, centred, no subject finding: **matches**. Pinned right or full width: unknown | Full-page background, not a picture box: **differs** |
| Left and bottom straight gradients to `#0C0F14` | Bottom scrim and gradient: **matches in kind**; a left gradient is not named in the notes; stop values unknown | Dimmed full-page art or colour wash: **differs** |
| No colour wash | Colour wash behind everything: **differs** (the owner already rejected it for Home) | Colour wash is one of the two modes: **differs** |
| Clear logo fitted whole, plain title fallback, text kept for screen readers | Same: **matches** | Text title only: **differs** |
| Picture waits 300 ms of rest, old one dims, new one fades in 600 ms from 1.03 | Cross-fade between old and new picture on change (confirmed); durations not recovered. A detail page shows one title, so it changes only on arrival (inferred) | No cross-fade |
| Hero changes with every row | Detail hero belongs to the title and fades out as the viewer scrolls down (confirmed names) | Not applicable |

So the detail pages can reuse the Home hero's picture box, fades, logo box and logo source unchanged, and still follow what the new Plex app does, minus its colour wash, which Home already dropped. The one choice the rules do not cover is which picture an episode page shows: Plex shows the show's art.

## Open questions for the owner

1. **Separate season and episode pages, or the new Plex TV model?** Classic Plex Web: show → season → episode, three pages and three Backs. New Plex TV app: one show screen with a season picker and an episode row; the episode opens inside the show screen. Same data either way.
2. **Where does a Continue Watching card on Home land?** On the episode page (classic web behaviour), or on the show screen with that episode focused (closer to the new TV app)? Home already decided that a card opens a page and only Play plays.
3. **Title as a logo or as text?** The new TV app shows the clear logo; classic web shows text. A logo depends on Sonarr / Radarr (or TMDB) having one, so text stays as the fallback.
4. **Audio and subtitle choices on the episode and film pages, or only in the player?** Showing them on the page is the one thing that needs a new Plex call per page.
5. **Extras, reviews and theme music in the first version?** Each is an extra Plex call and none is in the data we hold today.
6. **Which picture heads an episode page: the show's backdrop (what the new Plex app uses) or the episode's own still?** Everything else about the detail hero can copy the TV Home hero rules unchanged (section 8).
