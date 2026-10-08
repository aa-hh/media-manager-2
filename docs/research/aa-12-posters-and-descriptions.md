# Where posters and descriptions come from (AA-12)

Question: v1 read posters, backdrops and descriptions from TMDB. Is that the best source for the first version? Compared: TMDB, TheTVDB, Fanart.tv, Sonarr and Radarr's own API, and Plex.

Researched 2026-10-08. "Unconfirmed" marks anything not checked against a primary source.

## Recommendation

Use Sonarr and Radarr as the only source for the first version. Add TMDB later only if a screen needs something they lack.

- Search has to go through Sonarr's and Radarr's lookup endpoints anyway (map item 1). Those results already carry a poster, a backdrop and a description, including for titles not yet added.
- For titles already added, Sonarr and Radarr keep local copies of the poster and backdrop, with ready-made smaller sizes.
- Sonarr also returns season posters, episode images and episode descriptions.
- No new API key, no new rate limit, no new licence to agree to. media-manager-2 already holds the Sonarr and Radarr keys.
- What this gives up: only one poster and one backdrop per title (no picking between alternatives), full-size images only for titles not yet added, and episode images that are links to TheTVDB rather than local copies.

TMDB is the best fallback if one is needed: free for non-commercial use, about 40 requests per second, covers posters, backdrops, season posters, episode images and descriptions, and Radarr's movie images already come from it. Its terms require the TMDB logo and a notice in the app, and cap caching at 6 months.

## Comparison

| Source | Posters and backdrops | Season and episode images | Descriptions | Key and rate limits | Licence | Works for titles not yet added |
|---|---|---|---|---|---|---|
| [Sonarr](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/NzbDrone.Core/MediaCover/MediaCoverService.cs) / [Radarr](https://github.com/Radarr/Radarr/blob/develop/src/NzbDrone.Core/MediaCover/MediaCoverService.cs) API | One poster, one backdrop, banner and logo per title. Stored locally once added, plus 500 and 250 pixel tall posters and 360 and 180 pixel tall backdrops | Sonarr: season posters and banners, one image per episode (67 of 80 Breaking Bad episodes had one). Both are links to TheTVDB, not local copies. Radarr: not applicable | Yes for shows, episodes and movies | The Sonarr and Radarr keys already in use. No limit of their own (unconfirmed for the public metadata servers behind them) | No terms of their own found (unconfirmed). Underlying images are TheTVDB's (shows) and TMDB's (movies) | Yes. Lookup results include images (passed through Sonarr or Radarr for 24 hours) and the description |
| [TMDB](https://developer.themoviedb.org/docs/image-basics) | Many per title, many sizes up to original | [Season posters](https://developer.themoviedb.org/reference/tv-season-images), [episode images](https://developer.themoviedb.org/reference/tv-episode-images) | Yes, all levels | Free key from account settings. [About 40 requests per second](https://developer.themoviedb.org/docs/rate-limiting) | [Non-commercial only; logo and notice required; cache at most 6 months](https://www.themoviedb.org/api-terms-of-use) | Yes |
| [TheTVDB](https://thetvdb.com/api-information) | Many per title | Season and episode images (Sonarr's TV images come from here) | Yes, through translation endpoints | Key plus optional subscriber PIN, sign-in token lasts 1 month. Rate limit not stated (unconfirmed) | [Free under $50k company revenue with attribution and a link](https://thetvdb.com/api-information) | Yes |
| [Fanart.tv](https://fanarttv.docs.apiary.io/) | Posters, backgrounds, logos, clear art | Season posters, season thumbs, season banners. No episode images | None | Project key, plus optional personal key per user. New images held back about 7 days, about 48 hours with a personal key (forum posts, unconfirmed) | Terms page blocked by a bot check, unconfirmed | Yes, by TMDB or IMDb ID for movies, TheTVDB ID for shows |
| [Plex](https://developer.plex.tv/pms/) | Poster (`thumb`) and background (`art`) for items in the library | Yes for items in the library | Yes (`summary`) | Plex token | Not checked (unconfirmed) | No in any documented way. The discover service behind Plex's own search is not in the official docs |

## Findings

### Sonarr

- The series lookup endpoint (`GET /api/v3/series/lookup?term=`) searches Sonarr's metadata server and returns full series records, including `images`, `overview` and `remotePoster`. [SeriesLookupController.cs](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/Sonarr.Api.V3/Series/SeriesLookupController.cs)
- For a series not yet added (id 0), each image URL is rewritten to `/MediaCoverProxy/{hash}/{file}`. Sonarr fetches the remote image on request and remembers the mapping for 24 hours. [MediaCoverService.cs](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/NzbDrone.Core/MediaCover/MediaCoverService.cs), [MediaCoverProxy.cs](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/NzbDrone.Core/MediaCover/MediaCoverProxy.cs)
- For an added series, Sonarr downloads each image to its data folder and serves it at `/MediaCover/{seriesId}/{type}.jpg`, with a hash on the end that changes when the image changes. It also writes smaller copies: posters at 500 and 250 pixels tall, backdrops ("fanart") at 360 and 180, banners at 70 and 35.
- Image types: Poster, Banner, Fanart, Screenshot, Headshot, Clearlogo. [MediaCover.cs](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/NzbDrone.Core/MediaCover/MediaCover.cs)
- Only series-level images are stored locally. Season images (`includeSeasonImages`) and episode images (`GET /api/v3/episode?includeImages=true`) come back as remote URLs. [SeriesResource.cs](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/Sonarr.Api.V3/Series/SeriesResource.cs), [EpisodeControllerWithSignalR.cs](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/Sonarr.Api.V3/Episodes/EpisodeControllerWithSignalR.cs)
- Sonarr's metadata server is `skyhook.sonarr.tv/v1/tvdb/...`, built on TheTVDB. [SonarrCloudRequestBuilder.cs](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/NzbDrone.Common/Cloud/SonarrCloudRequestBuilder.cs)
- Checked live on 2026-10-08 for Breaking Bad (TheTVDB 81189): poster, banner, backdrop and logo all on `artworks.thetvdb.com`; all 6 seasons had a poster; 67 of 80 episodes (specials included) had an image; series and episodes had descriptions.
- Whether `/MediaCover/` needs the Sonarr key or a signed-in session depends on Sonarr's sign-in settings (unconfirmed). media-manager-2's server can fetch and pass images on either way.

### Radarr

- Same design as Sonarr: `GET /api/v3/movie/lookup?term=`, plus `/movie/lookup/tmdb` and `/movie/lookup/imdb`, returning `images`, `overview` and `remotePoster`, with the same 24-hour pass-through for movies not yet added. [MovieLookupController.cs](https://github.com/Radarr/Radarr/blob/develop/src/Radarr.Api.V3/Movies/MovieLookupController.cs)
- Same local storage and smaller sizes as Sonarr. [MediaCoverService.cs](https://github.com/Radarr/Radarr/blob/develop/src/NzbDrone.Core/MediaCover/MediaCoverService.cs)
- Radarr's metadata server is `api.radarr.video`, and it also talks to TMDB directly. [RadarrCloudRequestBuilder.cs](https://github.com/Radarr/Radarr/blob/develop/src/NzbDrone.Common/Cloud/RadarrCloudRequestBuilder.cs)
- Checked live for The Matrix (TMDB 603): poster and backdrop both `image.tmdb.org/t/p/original/...` URLs, so Radarr's movie images are TMDB images at full size.

### TMDB

- Image URL = base URL + size + file path, for example `https://image.tmdb.org/t/p/w500/<file>.jpg`. Sizes come from `/configuration`. [Image basics](https://developer.themoviedb.org/docs/image-basics)
- Season posters: `/3/tv/{id}/season/{n}/images`. Episode images: `/3/tv/{id}/season/{n}/episode/{e}/images` (returned as `stills`).
- Lookup by TheTVDB ID works for shows, seasons and episodes, so TMDB data can be matched to Sonarr's records. [Find by ID](https://developer.themoviedb.org/reference/find-by-id)
- The old limit of 40 requests per 10 seconds was removed in December 2019; the current limit is "somewhere in the 40 requests per second range" and may change. [Rate limiting](https://developer.themoviedb.org/docs/rate-limiting)
- Terms: no commercial use without a separate agreement; must show the TMDB logo (less prominent than the app's own) and the notice "uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB"; no caching beyond 6 months; no use for AI or machine learning applications. [Terms of use](https://www.themoviedb.org/api-terms-of-use)
- v1 called `api.themoviedb.org/3/{movie|tv}/{id}` with the key as an `api_key` query value and read `poster_path`, `backdrop_path` and `overview` only, at the movie and show level (`scripts/lib/collectors/tmdb.py` in v1).

### TheTVDB

- Version 4 API: sign in at `/login` with the API key (and a subscriber PIN for keys that users pay for) to get a token valid for 1 month. Endpoints include `/series/{id}/artworks`, `/seasons/{id}/extended`, `/episodes/{id}/extended`, `/movies/{id}/extended`. [swagger.yml](https://github.com/thetvdb/v4-api/blob/main/docs/swagger.yml)
- Price by company revenue: free under $50k a year with attribution, $1,000 a year from $50k to $250k, $10,000 a year from $250k to $1M. End users who see the data must see "Metadata provided by TheTVDB" with a link. [API information](https://thetvdb.com/api-information)

### Fanart.tv

- Version 3: `webservice.fanart.tv/v3/movies/{tmdb or imdb id}` and `/v3/tv/{thetvdb id}`. Sends a project key (`api_key`) and optionally a user's personal key (`client_key`). [API blueprint](https://fanarttv.docs.apiary.io/)
- Image types for TV include `tvposter`, `showbackground`, `seasonposter`, `seasonthumb`, `seasonbanner`, `hdtvlogo`, `clearart`. No episode images and no descriptions.
- The official key and terms pages sit behind a bot check and could not be read. The 7-day and 48-hour delays come from [forum posts](https://emby.media/community/topic/66178-fanarttv-image-issues) and are unconfirmed.

### Plex

- Plex's server API returns `thumb` (poster), `art` (background) and `summary` (description) for items already in the library, sent with an `X-Plex-Token`. [Plex Media Server API](https://developer.plex.tv/pms/)
- The official docs describe no search for titles outside the library. Plex's own discover search (`metadata.provider.plex.tv`) is not documented there, so relying on it would mean an unofficial API.
- Plex only knows about a title once its file is imported, so it cannot cover search results or anything still downloading.
