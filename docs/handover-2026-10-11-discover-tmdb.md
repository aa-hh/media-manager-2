# Handover: TMDB, MDBList and Discover server work, 11 October 2026

## Start here

All server work below is merged into `main`. Start every task from a fresh worktree off `origin/main` (see `CLAUDE.md` and `AGENTS.md`). The Discover epic is the V1 · Discover project in Linear; its project description holds the owner's decisions and should be read first.

Nothing from this work is deployed to the Whatbox slot yet, and neither the TMDB nor the MDBList key is saved there. Until both happen, every TMDB and MDBList feature returns its empty or "not configured" state.

## What is on main

| Ticket | Pull request | What it added |
|---|---|---|
| AA-87 "Keep one saved store of what we know about each title, from any source, and fetch only what's missing" | [#71](https://github.com/aa-hh/media-manager-2/pull/71) | `src/server/titleStore.ts`: SQLite store, one row per title, one part per source with its own fetch time. Search, previews of titles not in the library, and add share one Sonarr or Radarr lookup. |
| AA-88 "Connect TMDB: key, client and health check" | [#70](https://github.com/aa-hh/media-manager-2/pull/70) | `src/server/services/tmdb.ts`, `tmdb` in `src/server/connections.ts` (key only, no address), TMDB on the Health screen, `PRODUCT.md` exception for TMDB. |
| AA-110 "Save TMDB posters and backdrops on our server, fetched on first request" | [#80](https://github.com/aa-hh/media-manager-2/pull/80) | `GET /api/images/tmdb/:size/:file` in `src/server/titles.ts`, table `tmdb_images`. |
| AA-112 "Connect MDBList and serve each show's ratings by site" | [#83](https://github.com/aa-hh/media-manager-2/pull/83) | `src/server/services/mdblist.ts`; show detail and show preview gain `ratingsBySite`; MDBList on Health. |
| AA-89 "Discover endpoints: lists, trending, genres and streaming services" | [#82](https://github.com/aa-hh/media-manager-2/pull/82) | `src/server/discover/`: `/api/discover/:type`, `/trending`, `/genres/:type`, `/providers/:type`. Library titles gain `tmdbId`. |
| AA-111 "Serve top cast names, keywords and similar titles from TMDB on title pages" | [#81](https://github.com/aa-hh/media-manager-2/pull/81) | `src/server/tmdbTitles.ts`: `GET /api/library/tmdb/:type/:tmdbId`. |
| README correction | [#84](https://github.com/aa-hh/media-manager-2/pull/84) | Search lookups are saved in SQLite, not kept in memory. |

The Discover screen (`src/client/discover/`) uses the Discover routes; no client screen uses `/api/library/tmdb/...` yet.

## Decisions the code depends on

- **Sources.** Sonarr and Radarr stay the source for everything they provide. TMDB fills gaps only. Seasons and episodes never come from TMDB, because its numbering can differ from Sonarr's.
- **Everything fetched is saved.** Title data from any source goes into the title store. Pages show saved data at once and fetch only what is missing.
- **Freshness.** TMDB and MDBList parts are refetched in the background after 7 days. Sonarr and Radarr lookups of titles outside the library go stale after 10 minutes. Library titles keep their own refresh in `src/server/titles.ts`.
- **Images.** Our server keeps a copy of every TMDB poster and backdrop. Cast photos are the exception: they stay TMDB links. Copies are refetched after 180 days (TMDB's terms cap caching at 6 months).
- **Ratings for shows** come from MDBList, chosen over OMDb (no Rotten Tomatoes for shows) and over Seerr's method (searching Rotten Tomatoes' own site by name and year).
- **Discover rows are recipes.** Each home row is an entry in `src/server/discover/recipes.ts` naming its Trakt and TMDB sources and their weights; a new row is a new entry, not new code. Sources are blended by weighted reciprocal-rank fusion: a title scores the sum of `weight / (10 + rank)` over the sources that list it. Trending weighs Trakt 0.65 and TMDB 0.35; other blended rows use the same split.
- **Trakt caching.** Trakt lists are saved as Discover rows and rebuilt in the background: Trending after 30 minutes, other rows after 6 hours, and only rows someone read in the last 24 hours. After a 429 the Trakt client sends nothing until the `Retry-After` wait has passed. This follows Trakt's use policy as read on 11 Oct 2026: proportionate caching and background refresh are fine; mirroring its catalogue or redistributing its feed is not.
- **Hero image (AA-105).** TMDB backdrop at size `w1920_and_h800_multi_faces`, running behind the app bar, with a white fade in light mode. Fallback: the backdrop saved from Sonarr or Radarr, then no image. Exact fade stops and contrast numbers are in AA-105.

## Fixed contracts

- **Image route.** `/api/images/tmdb/<size>/<file>`, where `<file>` is TMDB's `poster_path` or `backdrop_path` without the leading slash. Allowed sizes: `w342` (posters) and `w1920_and_h800_multi_faces` (backdrops). Anything else is a 404 with no fetch. Build image URLs in this form; never send `image.tmdb.org` addresses to the browser.
- **Title store parts.** `sonarr-lookup` and `radarr-lookup` (search), `tmdbSummary` (Discover; now with `date` and `popularity`, read as null on summaries saved before), `tmdbProviders` (Discover; streaming provider ids by country code, kept 24 hours), `tmdbDetails` (title-page TMDB data), `mdblistRatings`. A new source is a new part name, not a new table.
- **Store keys.** Movies by TMDB id. Shows by TVDB id with the TMDB id kept alongside; a show known only by TMDB id gets its own row (see the limits below).
- **Discover home.** `GET /api/discover/home` takes `type` (`all`, `movie` or `tv`, default `all`), `genres`, `providers`, `region`, `yearFrom`, `yearTo`, `minRating` and `services` (comma-separated streaming service ids). It returns `{ trending: { all, movie, tv }, popularMovies, popularTv, upcomingMovies: { days30, days90 }, upcomingTv, services: [{ providerId, name, results, pending, failed, failure }], extraRows: [{ id, label, results, pending, failed, failure }] }`. Every row is `{ results, pending, failed, failure }`: `failed` is true only when the row's build failed and nothing is saved, and `failure` is then the failure kind (`not_configured`, `unreachable`, `rejected`, `not_found` or `refused`), else `null`. Rows the `type` hides: a trending tab comes back empty (`{ results: [], pending: false, failed: false, failure: null }`), `popularMovies`, `popularTv`, `upcomingMovies` and `upcomingTv` come back `null`, and an extra row is left out of `extraRows`. Each result carries `tmdbId`, `type`, `title`, `year`, `date`, `posterUrl`, `backdropUrl`, `rating`, `genres` (names), `overview` (in full) and `libraryId`. Grid routes add `pending`, `failed` and `failure` to their reply. `GET /api/discover/trending` takes `type` (`all`, `movie` or `tv`, default `all`), `page` and the same filters as the home (`genres`, `providers`, `region`, `yearFrom`, `yearTo`, `minRating`); the filters are applied to TMDB's trending page after fetching, so a page can hold fewer than 20 titles.
- **Show preview by TMDB id.** `GET /api/library/preview/sonarr/tmdb/:tmdbId` returns the same body as `/api/library/preview/sonarr/:tvdbId`, finding the TVDB id through TMDB. It answers 404 when TMDB has no TVDB id for the show, 503 when TMDB is not configured, and 502 when TMDB cannot be reached or rejects the key.
- **Discover rows.** Saved in the `discover_rows` table. Trending is rebuilt after 30 minutes, other home rows after 6 hours, genre and streaming service lists after 24 hours, all by the `discover-refresh` job and only for rows read in the last 24 hours; grid pages refill on read after 5 minutes. Rows nobody read for 7 days are deleted. See `docs/adr/0004-discover-reads-saved-rows-orchestrator-fetches.md`.
- **Keys never leave the server.** The TMDB and MDBList keys go only into requests to those services. Tests check they never appear in a response, an error message or a log line. Keep it that way.

## Work queue

In this order. Tickets are in Linear team AA.

1. **AA-113 "Add TMDB and MDBList to the settings screen".** Waits for the setup wizard session's settings pull request (folders, backup, Plex sign-in token) to merge, as agreed between the sessions. Then: add `tmdb` and `mdblist` to `ServiceName` and `services` in `src/client/settings/model.ts`, and hide the address field for a service without one.
2. **Discover screens:** AA-91 "Discover screen with rows", AA-92 "Discover grids with filters in the page address", AA-90 "Title page shows stored data at once and starts fetching on hover", then AA-86 "Tags on title pages that open Discover". No pen.dev designs exist for these yet; layout questions go to the owner as frames, not text.
3. **AA-105 "Full-height hero image behind the top of title pages".** Question 5 (page weight and drawing cost) is still open, and no ticket exists yet to build it. Mockups: frames `EaS75`, `lnLdj`, `CD7zy` in `design/title.pen` (codex-design-finish worktree). pen.dev only writes to disk when the owner presses Cmd+S.
4. **Missing tests from the AA-89 review:** the `upcoming` and `rating` sorts sending the right values to TMDB, and a show with both a TMDB-only row and a TVDB row reading the TVDB row.

## Known limits

Each is marked in the code with a `razor:` comment naming the fix.

- `titleStore.ts`: a show first saved by TMDB id keeps its own row after a TVDB-keyed row appears; lookups read the TVDB row, so the TMDB-only row's summary stops being found.
- `tmdbTitles.ts`: a show TMDB has no TVDB id for cannot be saved, so it is fetched on every visit. Whether TMDB's `external_ids.tvdb_id` arrives for current shows has not been checked against the real service.
- `mdblist.ts`: a show without a TVDB id gets no ratings. During a daily-limit block each page view still makes one failing call; `Retry-After` is not respected. Health checks MDBList at most once an hour to save the 1,000 free daily requests.
- `discover/routes.ts`: the Trending grid is TMDB-only, so its order differs from the home's blended Trending row.
- `discover/orchestrator.ts`: the first load of a row filtered by streaming service makes up to 40 availability lookups.
- `discover/orchestrator.ts`: a Trakt title without a TMDB id is skipped. A show without a TVDB id is not: its summary and availability are saved under its TMDB id (see the `titleStore.ts` limit above).
- `discover/orchestrator.ts`: filters apply after the sources are blended, so a filtered row can hold fewer than 20 titles.
- `search.ts`: saved lookups are never deleted.
- Adding a title posts the saved Sonarr or Radarr lookup record, up to 10 minutes old. Only a real add on the slot proves Sonarr and Radarr accept it.

## Keys and access

- **TMDB.** The key media manager 1 uses works (checked 11 Oct). It is `TMDB_API_KEY` in `~/homepage/config/homepage.env` on the slot (`ssh shenzhou`). Never print it. After a deploy, the owner copies it into media-manager-2 without showing it:
  `ssh shenzhou 'cd ~/media-manager-2 && grep -E "^TMDB_API_KEY=" ~/homepage/config/homepage.env | tail -1 | cut -d= -f2- | tr -d "\"\n" | node dist/server/cli.js settings set credentials tmdb.apiKey'`
- **MDBList.** The owner has a free key; it is not stored anywhere yet. It goes in through the settings screen once AA-113 lands, or with `node dist/server/cli.js settings set credentials mdblist.apiKey` on the slot.
- **Trakt.** The owner saves the Client ID with `node dist/server/cli.js settings set credentials trakt.clientId`, value on stdin. A 403 with an HTML body means Cloudflare refused a request missing Trakt's headers; a 403 in plain text means Trakt refused the Client ID or the app is not approved.
- Agents never type, paste or print any of these keys. The owner enters them.

## Traps

- **Other sessions edit the settings screen.** Before touching `src/client/settings/`, check that the setup wizard's settings pull request has merged.
- **Parallel branches conflict in `src/server/index.ts`, `src/server/app.ts` and `tests/production.test.mjs`.** Each new route adds a line to each. Merge `origin/main` in, keep both sides, and carry over any changes a branch made to the shared `makeApp` test helper.
- **Disk space.** The Mac ran out of space on 11 Oct with many worktrees each holding their own installed packages. Mark finished worktrees with `.prunable`; never delete them by hand.
- **A worktree's installed packages go stale** when main adds a dependency. Run `npm ci` before building if the build cannot find a package.
