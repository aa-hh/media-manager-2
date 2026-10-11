# Discover page: discovery

What Seerr's Discover page does, how it is built, and what a version of it in media-manager-2 would take. Researched 11 Oct 2026 against Seerr commit `8f2eceea` (10 Oct 2026) and the live Sonarr and Radarr on the Whatbox slot.

## What Seerr does

The Discover page is a stack of horizontal rows ("sliders" in Seerr's code): Trending, Popular movies, Upcoming movies, Popular TV, Upcoming TV, movie genres, TV genres, studios, networks, recently added, recent requests and the Plex watchlist. Each row has a "show more" link to a full grid page with the same filters applied.

The full grid pages (`/discover/movies`, `/discover/tv`) scroll without end and carry a filter panel:

- release or first-air date range
- genres (all must match), keywords and excluded keywords
- studio (movies) or network (TV), TV status
- original language, age rating
- runtime, TMDB rating and vote count ranges
- streaming services in a chosen region (any may match)
- sort: popularity, release date, rating or title, up or down

Filters live only in the address bar, so every filtered view is a link. Each poster card shows a movie or TV label, a status badge (requested, downloading, available), and a request button.

## How Seerr builds it

**Everything comes from TMDB (The Movie Database).** The server calls TMDB's `/discover/movie` and `/discover/tv` endpoints for every row and grid, plus `/trending`, the genre lists, `/watch/providers/*` for streaming services and regions, and keyword and company search. "Popular" is discover sorted by popularity; "Upcoming" is discover with a release date from today on.

**The server is a thin pass-through.** About 1,000 lines of routes under `/api/v1/discover/*` check the query with a validation library, call TMDB, and return `{page, totalPages, totalResults, results}`. One database query per page then joins the results' TMDB ids against Seerr's own media table to add each title's status.

**Caching is in memory:** 5 minutes for discover and trending results, 24 hours for genre, region, language and streaming-service lists.

**The network and studio rows are hardcoded.** TMDB has no endpoint listing all networks, so Seerr ships 23 networks and 11 studios with fixed TMDB ids and logo URLs. Genre tiles get their pictures by running one discover call per genre and taking a backdrop from the results.

**Admins can edit the rows.** A `DiscoverSlider` table holds each row's type, order, on/off state and data (a keyword id, genre id, network id, search text or streaming-service list). An edit mode supports drag-and-drop reordering and a form to add custom rows with a live preview. This is about 1,300 of the frontend's 7,700 lines.

**The TMDB key is hardcoded in Seerr's source** and shared by every Seerr install.

## What changes for us

### TMDB becomes a new data source

`PRODUCT.md` says images and descriptions come only from Sonarr and Radarr. Discover cannot work under that rule:

- Sonarr has no discovery feature at all.
- Radarr's list endpoint (`/api/v3/importlist/movie`, checked live: returns 100 movies) only shows movies from lists already set up in Radarr. It has no TV, no streaming-service filter and no genre browsing.

So Discover needs TMDB directly, and the rule needs an exception. The cost is one more connection: a free TMDB API key (personal use, no fee) saved as `credentials/tmdb.apiKey` next to the others, a health check for it, and TMDB's required credit ("This product uses the TMDB API but is not endorsed or certified by TMDB" plus their logo) on the page. Borrowing Seerr's shared key would break TMDB's terms.

### Opening a card already works

The title pages already handle titles not in the library:

- **Movies:** TMDB returns the TMDB id, and `/title/tmdb/:id` already opens a movie by it. No new work.
- **TV:** our not-owned TV page is keyed by TVDB id (`/title/tvdb/:id`), but TMDB returns its own TV id. Sonarr 4.0.20 on the slot resolves `tmdb:95396` to Severance with TVDB id 371980, so one Sonarr lookup on click maps it. No new lookup source needed.

### "Already in library" is a cheap join

Library titles carry `links.tmdbId` for both movies and shows (`src/server/library.ts`). Matching discover results against those ids gives each card an "in library" badge without new storage. Seerr's request statuses don't apply until friend requests arrive in v2.

### What to leave out

| Seerr piece | Size in Seerr | Proposal |
| --- | --- | --- |
| Admin row editor (table, routes, drag-and-drop, add-row form) | ~1,300 lines | Skip. A fixed list of rows in code; one owner can ask for a change. |
| Age-rating, keyword, runtime and vote-count filters | ~600 lines | Skip at first. Add one when it is missed. |
| Genre tiles with backdrops | one TMDB call per genre | Plain genre chips instead. |
| Hardcoded networks and studios rows | 34 entries | Skip. Streaming-service filtering covers "what's on Netflix". |
| Image proxy | disk cache | Skip. Posters load from TMDB's image server, as Sonarr's lookup posters already do. |
| Plex watchlist, recent requests rows | | Skip until v2. |

TMDB has two related ideas: **networks** (who made or first aired a show: HBO, Netflix originals) and **watch providers** (where a title streams in a region today). "Browse by streaming service" means watch providers. Networks can come later if wanted.

## Proposed first version

**Server**

- A TMDB client in `src/server/services/` using the built-in `fetch`, with the same in-memory cache pattern as `src/server/search.ts`: 5 minutes for results, 24 hours for genre and streaming-service lists.
- `GET /api/discover/:type` (`movie` or `tv`) taking `page`, `sort`, `genres`, `providers`, `region`, `yearFrom`, `yearTo`, `minRating`; it checks every value before it reaches TMDB.
- `GET /api/discover/trending`, `GET /api/discover/genres/:type`, `GET /api/discover/providers/:type?region=`.
- Each result: TMDB id, type, title, year, poster URL, rating, one-line overview, and in-library id if owned.
- A TMDB entry on the Health screen and a key field in settings.

**Browser**

- A Discover screen at `/discover` with rows: Trending, Popular movies, Popular TV, Upcoming movies, Upcoming TV, and one row per streaming service the owner picks (saved as a setting, with a default region).
- A full grid at `/discover/movie` and `/discover/tv` with filters held in the address bar: genre, streaming service, year range, minimum rating, sort. A "Load more" button, or loading the next page when the bottom scrolls into view using the browser's built-in `IntersectionObserver`.
- Cards reuse `Poster` and the result layout from `src/client/Search.tsx`; clicking opens the existing title page.
- No new npm packages.

**Rough size:** about 300 lines of server code and 500 of browser code. Seerr's equivalent is about 9,500 lines, most of it the parts listed above to leave out.

## Decisions for the owner

1. Allow TMDB as a data source for Discover, as an exception to the Sonarr-and-Radarr-only rule in `PRODUCT.md`?
2. Is Discover part of v1, or does it belong with friend requests in v2?
3. Which rows and filters must the first version have? The proposal above is a starting point.
4. Default streaming region (US, GB, or another)?
