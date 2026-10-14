# In-app video player: how it fits this codebase

Repo: `media-manager-2`, worktree `video-streaming-feasibility-06c659`, read on 2026-10-14. Paths are relative to the repo root. This covers only what the code and repo docs show. How Plex's and Jellyfin's streaming APIs behave is a separate research track and is not checked here.

## Short answer

Feasible, with one large server piece and one hosting risk.

- The app already holds everything needed to reach the owner's media server: its address and a token (Plex) or API key (Jellyfin), plus the owner's Jellyfin user id.
- Nothing playback-related exists. There is no item lookup on the media server, no video component, no video library installed, and no progress table.
- The browser must never hold a secret (`src/client/AGENTS.md:5`, `:16`). So video has to go through our server: a new route that passes the media server's video through and rewrites playlist addresses. The existing service request helper cannot do this as written (10-second limit that covers the whole body, JSON-only parsing).
- Hosting risk: the app, Plex and the library folder share one Whatbox slot (`PRODUCT.md:17`, `:33`), and Whatbox bans transcoding 4K HEVC video (`docs/research/aa-8-whatbox-hosting.md:47`). Most browsers cannot play HEVC or MKV files directly, so 4K versions would need transcoding the host forbids.
- Product scope: a player appears nowhere in `PRODUCT.md`. "Playback statistics" is listed as out of the first version (`PRODUCT.md:63`). `CONTEXT.md:107-109` defines Plex as "the media server that plays the library folder", so today the app leaves playback to Plex.

## 1. Architecture snapshot

**Process and stack**
- One Node.js process. A Hono server also serves the React app. All state lives in one SQLite file (`README.md:14-15`).
- Server: `hono` 4.13 and `@hono/node-server` (`package.json:16,19`). Database: Node's built-in `node:sqlite` (`src/server/owner.ts:1`, `src/server/database.ts:498-528`).
- Client: React 19, Vite 8, Tailwind 4 and `@base-ui/react` (`package.json:15,22-23,27,33-35`).

**Client routing**
- No router library. `Home.tsx` picks the screen from the address (`src/client/Home.tsx:94-103`). Title pages match `/series/`, `/movie/` or `/title/` (`:103`), and `Overview.tsx` splits the address into a route (`src/client/title/Overview.tsx:36-37`).
- Every screen change goes through `changeScreen` with a view transition (`src/client/navigation.ts:5-13`, `:76`).

**Server routes**
- Sub-routers mount under `/api` (`src/server/app.ts:543-557`) and are wired in `src/server/index.ts:84-228`.
- Every `/api` request passes `privateGuard` (`app.ts:478-497`).

**Data layer**
- Migrations are an ordered array of SQL strings (`database.ts:28-425`), run by `migrateDatabase` (`database.ts:498-528`).
- Generic key/value settings live in four categories (`src/server/settings.ts:3-8`).

**Outside services**
- Every request to Sonarr, Radarr, rTorrent, Plex, Jellyfin and the rest must go through `src/server/services/` (`AGENTS.md:96-103`).
- Every call there uses `requestWithTimeout`: a 10-second default that also covers reading the body, and redirects refused (`src/server/services/connection.ts:15-37`; rule at `src/server/services/AGENTS.md:9`).
- `createMediaServer` picks Plex or Jellyfin on every call, from the owner's sign-in provider (`src/server/services/mediaServer.ts:25-31`). The shared interface `MediaServer` has `check`, `findLibraryFor`, `refresh` and an optional `mergeVersions` (`mediaServer.ts:11-23`).

**Sign-in and sessions**
- One user, the owner. Plex sign-in refuses restricted or anonymous accounts (`src/server/auth.ts:425-431`). A second account gets `owner_only` (`auth.ts:444`). Jellyfin sign-in accepts administrators only (`auth.ts:479`).
- The session cookie is `httpOnly`, `SameSite=Lax`, path `/` (`app.ts:164,169`), and lasts 24 hours (`auth.ts:28`). The database stores only a hash of each session (`auth.ts:206-222`).
- Writes (non-GET) must carry a matching `Origin`, `X-Requested-With: media-manager-2` and a JSON content type (`app.ts:228-241`, `:492`). GETs only need the cookie.
- Every response gets `Cache-Control: no-store` except cached images, plus `X-Frame-Options: DENY` (`app.ts:200-208`). No Content-Security-Policy is set anywhere (searched `index.html`, `src`, `public`).

**Deployment**
- Runs on the same Whatbox machine as rTorrent and the library folder, reached at the owner's domain through Cloudflare (`PRODUCT.md:33`). The owner runs Plex on that seedbox too (`PRODUCT.md:17`).
- Listens on `127.0.0.1` behind something that serves `APP_ORIGIN` over HTTPS (`README.md:465-483`). `APP_ORIGIN` must be HTTPS except for loopback development (`README.md:73-75`).
- The Plex address example is `http://127.0.0.1:32400` (`README.md:94`).
- Whatbox: no Docker, no root access, a shared CPU, and a ban on transcoding 4K HEVC (`docs/research/aa-8-whatbox-hosting.md:7,11-13,45-48`).
- The setup wizard asks for the Plex address and takes the token from the Plex sign-in (`src/client/settings/SetupWizard.tsx:42`; `src/server/setup.ts:347-368`).

## 2. Plex and Jellyfin integration today

**Plex** (`src/server/services/plex.ts`, 71 lines)
- Reads `serviceAddresses/plex.url` and `credentials/plex.token` (`plex.ts:12-16`).
- `request` sends `X-Plex-Token` as a header and always parses the reply as JSON (`plex.ts:18-36`).
- `check` (`:38-53`) reads `/`. `findLibraryFor` (`:55-64`) reads `/library/sections`. `refresh` (`:66-68`) asks for a folder scan.
- The stored token is the owner's plex.tv account token from sign-in, saved by setup step `POST /api/setup/plex` (`setup.ts:349-363`). It can also be pasted in (`README.md:99`). The sign-in token is also kept in memory per session, never in the database (`auth.ts:189-191`, `:448`, `:634-637`).
- No server discovery: plex.tv is called only for sign-in (`auth.ts:24-26`), and nothing reads the user's server list. The address is typed by hand.
- No item, metadata, media-part, playback or timeline calls.

**Jellyfin** (`src/server/services/jellyfin.ts`, 206 lines)
- Reads `serviceAddresses/jellyfin.url` and `credentials/jellyfin.apiKey` (`jellyfin.ts:19-23`).
- Sends `Authorization: MediaBrowser Token="…"` (`:25-29`). Parses JSON the same way as Plex.
- `check` (`:51-65`) reads `/System/Info`. `findLibraryFor` (`:67-76`) reads `/Library/VirtualFolders`. `refresh` (`:79-81`) posts to `/Library/Media/Updated`.
- `mergeVersions` (`:86-104`) lists `/Items` with `Fields=Path` and matches files by their last two path parts. It is the only item lookup against any media server in the codebase.
- Sign-in reads the user id, name and administrator flag. It deliberately drops the AccessToken (`jellyfin.ts:153`).
- The owner's Jellyfin user id and server id are saved in the `owner` table (`src/server/owner.ts:3-9`, `auth.ts:484`). The API key itself is pasted from Jellyfin's dashboard (`SetupWizard.tsx:42`, `setup.ts:372-387`).

**Emby:** nothing. No client, no sign-in path, no setting key. The only "Emby" in `src` is a comment on Jellyfin's `X-Emby-Token` header (`jellyfin.ts:25`).

**What a player would reuse:** the server address, the Plex owner token or Jellyfin API key, the owner's Jellyfin user id, and the provider switch in `createMediaServer`.

**Gaps:**
- No lookup from our movie or episode to the media server's item.
- No way to start a playback session or build a stream address.
- No request helper that can stream a long body, or pass through binary or Range requests.
- No per-user media-server identity beyond the owner.
- No Emby.

## 3. Matching our items to Plex and Jellyfin items

**External ids we hold**
- Sonarr series: `imdbId`, `tvdbId`, `tmdbId` (`src/server/services/arr/series.ts:27-29`, parsed `:86-88`).
- Radarr movies: `imdbId`, `tmdbId` (`arr/movies.ts:30-31`, `:98-99`).
- The library detail sends them to the client as `links` (`src/server/library.ts:99`, `:147`, `:353`, `:393`).
- `title_store` keeps `tmdb_id` and `tvdb_id` (`database.ts:336-341`). `tmdbTitles.tvdbIdOf` converts a TMDB id to a TVDB id (`src/server/tmdbTitles.ts:90`).

**Episodes have no external ids.** The parsed type has only ids, season and episode numbers, and the file (`arr/episodes.ts:4-24`). An episode would be matched as the series' TVDB, TMDB or IMDB id plus season and episode number, or by file path.

**File paths are available**
- Each file has `path` and `relativePath` (`arr/files.ts:8-9`, `:66-67`), plus `mediaInfo` with video codec, resolution, audio languages and subtitles (`arr/files.ts:19-26`, `:77-84`).
- The library detail includes the title's folder path for owned titles (`library.ts:351`, `:391`).
- Second-version rows record `tracked_path` (`database.ts:403`).

**Existing matching code:** only Jellyfin's path-tail match in `mergeVersions` (`jellyfin.ts:83-100`). Its own comment names "a lookup by provider id" as the upgrade path if listing everything gets slow (`jellyfin.ts:85`). No Plex GUID or `ratingKey` matching exists. The only `guid` in `src/server` is the release guid in `releases.ts` and `grabs.ts`.

**Fit:** the app, Plex and the files share one machine (`PRODUCT.md:33`). Path matching therefore already works for Jellyfin and is the shortest route for Plex too. External-id matching is the fallback when the media server sees the files under another mount (`jellyfin.ts:83-84` already allows for that).

**Versions differ by server**
- Plex shows all files of a movie or episode as one title (`CONTEXT.md:79-81`).
- Jellyfin groups only files in one folder, so the app's second versions show as separate titles until `mergeVersions` joins them (`docs/research/aa-145-jellyfin-versions.md:9`).
- So "pick a quality" behaves differently per server.

## 4. Where a player would live

**Client entry points**
- Movie page header: `MovieOverview.tsx:73` renders `TitleHeader`. Its action buttons sit at `src/client/title/TitleHeader.tsx:296-313` (Search, Pick a release, the more-actions menu at `:277`).
- Series page: `SeriesOverview.tsx:172`, with episode rows from `title/EpisodeRows.tsx`.
- Episode details: `EpisodeDetails.tsx:55`. The tracked file row is `TrackedVersion` (`EpisodeDetails.tsx:37`), and second versions come from `SecondVersionRows` (`title/SecondVersions.tsx`). These rows are the natural place for "play this version".
- A full-window player needs a new address (for example `/play/...`) added to the view switch in `Home.tsx:94-103`.
- `MediaServerContext` already tells the client which server the owner uses (`src/client/mediaServer.ts:4`, provided in `main.tsx:250`, read in `PickRelease.tsx:158`).

**Server routes**
- New routes mounted beside the others in `app.ts:543-557` and wired in `index.ts`, where `mediaServer` already exists (`index.ts:94`).
- The Plex and Jellyfin code goes into `plex.ts` and `jellyfin.ts` behind new optional methods on `MediaServer` (`mediaServer.ts:11-23`). That matches how `mergeVersions` was added and follows `AGENTS.md:96-103`.

**Our server in the middle, or browser straight to the media server?** The code forces our server in the middle:
- The browser never holds a secret (`src/client/AGENTS.md:5`, `:16`; `README.md:80-82`). Plex and Jellyfin stream addresses carry a token.
- The configured Plex address is a loopback address on the seedbox (`README.md:94`), which the browser cannot reach.
- The app is served over HTTPS (`README.md:73-75`), so a plain-HTTP media address would also be blocked as mixed content.
- Same-origin GETs carry the session cookie (`app.ts:169`), and `privateGuard` lets GETs through on the cookie alone (`app.ts:492`). So `<video>` and segment requests to our own `/api/...` work with the existing session.

**What the pass-through route must work around**
- `requestWithTimeout` aborts after 10 seconds including the body (`connection.ts:19`, `:29`). The `request` functions in `plex.ts:18-36` and `jellyfin.ts:26-48` always read JSON. Streaming needs a new helper in `services/connection.ts` that keeps the no-redirect rule but times only the connection, not the body.
- Every `/api` request is logged except `/api/events`, `/api/metrics` and images (`app.ts:190-198`). Video segment requests need the same exclusion or they flood `server.log`.
- Playlists (HLS, the streaming format where a text playlist lists short video segments) must be rewritten so segment addresses point at our route and carry no token.
- `Cache-Control: no-store` on every reply (`app.ts:203-205`) is fine for video.

**Design rules before any UI code**
- New UI needs screens in its own `.pen` file before a builder starts (owner's design-first rule). Title pages live in `title.pen` (`design/README.md:13`). A player screen would be a new file under `~/Projects/media-manager-2-design/`.
- An approved design that changes the library goes through `/approve-design` before code (`design/README.md:7`).
- `components/ui/` is presentational only and never fetches (`src/client/AGENTS.md:17`). It has no video, slider-scrubber or menu-for-tracks component today. The closest are `progress.tsx`, `dropdown-menu.tsx` and `toggle-group.tsx` in `src/client/components/ui/`.

## 5. Where watch progress would live

- No table holds progress. None of the migrations creates one (`database.ts:28-425`). The tables cover settings, torrents, grabs, problems, titles, images, second versions, sessions and owner.
- The owner's identity on the media server is already known:
  - Plex: the stored token is the owner's own account token (`setup.ts:352-362`), so progress reported with it lands on the owner's Plex account.
  - Jellyfin: the owner's user id is in `owner.user_id` (`owner.ts:12-17`). The API key is not tied to a user, so progress calls must name that user id.
- Keeping progress only in Plex or Jellyfin means it stays in step with the owner's TV and phone apps and needs no migration.
- A local table would be a second copy that drifts. Repo docs keep the media server as the source for this data: `CONTEXT.md:115-117` says playback statistics are "read from Plex and Tautulli", and ADR 0005 lists "Plex watched state" as out of scope for deletes (`docs/adr/0005-ask-what-a-delete-is-for.md:23`).
- One code trap: the final progress write when a tab closes cannot use `navigator.sendBeacon`. Writes need the `X-Requested-With` header and JSON content type (`app.ts:228-241`), and `sendBeacon` cannot set a custom header. Use `fetch(..., { keepalive: true })`, or make the progress route a GET.

## 6. Dependencies already installed

- None for video. Runtime dependencies are `@base-ui/react`, `@hono/node-server`, `@tanstack/react-table`, `clsx`, `hono`, `lucide-react`, `react`, `react-dom`, `tailwind-merge` and `web-vitals` (`package.json:14-24`).
- `package-lock.json` has no `hls.js`, `video.js`, `shaka-player`, `plyr`, `media-chrome`, `@vidstack` or `dashjs` (0 matches).
- No `<video>` or `<track>` element exists anywhere in `src/client`.
- No ffmpeg or other transcoder is referenced, so "our own server streams the files" could only send files the browser can already play.
- Helpful pieces already present:
  - Hono can stream a `Response` body straight through.
  - `@base-ui/react` has menu and slider parts for quality and subtitle menus.
  - `lucide-react` has play, pause and caption icons.

## 7. Work items and sizes

Sizes: S = under a day, M = one to three days, L = most of a week or more.

**Server**

| Item | Size | Where |
|---|---|---|
| Find the media server's item for a movie, episode or specific file (path first, external ids as fallback), for Plex and Jellyfin | M | new `MediaServer` methods in `plex.ts`, `jellyfin.ts`, `mediaServer.ts` |
| Start a playback session and list quality and subtitle choices (direct play vs transcode decision per server) | M–L | same files |
| Pass-through route for playlists, segments, subtitles and Range requests, with a streaming request helper, playlist rewriting and the log exclusion | L | new route module, `services/connection.ts`, `app.ts:190-198` |
| Report progress, read the resume point, mark watched, stop the session | M | same `MediaServer` methods plus a route |
| Subtitle delivery the browser accepts (text tracks as WebVTT, image subtitles burned in by the server) | M | depends on server API |
| Emby support: new client, sign-in path, settings keys, setup step | L | nothing exists |
| Our own server sending files directly (no media server) | M for direct play only; transcoding is not possible on Whatbox for 4K HEVC | new route; no ffmpeg present |

**Client**

| Item | Size |
|---|---|
| Player screen and route in `Home.tsx`, `hls.js` added as the first video dependency | M |
| Controls: play/pause, seek, quality menu, subtitle menu, resume prompt, keyboard | M |
| Play buttons in `TitleHeader`, episode rows, tracked and second-version rows | S |

**Design**

| Item | Size |
|---|---|
| New `.pen` file: player, controls, menus, resume prompt, loading and failure states, play entry points on `title.pen` | M |
| `/approve-design` pass for new library components | S–M |

**Tests** (one test file only, `tests/AGENTS.md:9`)

| Item | Size |
|---|---|
| Extend the Plex and Jellyfin fakes already in `tests/production.test.mjs:318` and `:531`. Cover item matching, playlist rewriting, and that no token appears in any reply or rewritten playlist | M |

**Riskiest parts here**

1. **Transcoding on the Whatbox slot.**
   - Plex and the files run on a shared machine that bans 4K HEVC transcoding (`aa-8-whatbox-hosting.md:47`).
   - The app keeps 2160p second versions (example at `aa-145-jellyfin-versions.md:9`), and `mediaInfo.videoCodec` (`arr/files.ts:20`) can tell us which files would need transcoding.
   - A browser player would likely be limited to files the browser can play as-is, or to lower-quality versions.
2. **Video through Cloudflare.** The public address goes through Cloudflare (`PRODUCT.md:33`), so every byte of video would too. Check Cloudflare's terms for video served through its proxy. Not verified here.
3. **The pass-through route.** It breaks the house pattern: the 10-second limit covering the body (`connection.ts:19,29`) and JSON-only replies. It also needs care so the token never reaches the browser inside a rewritten playlist or an error message (`services/AGENTS.md:13`).
4. **Quality choice differs by server.** Plex merges versions. Jellyfin needs `mergeVersions` to have run, and returns false while either file is missing (`mediaServer.ts:19-22`).
5. **One user only.** Progress belongs to the owner's account. Friends (v2, `PRODUCT.md:19`) would each need their own media-server identity, which the sign-in flow does not keep (Jellyfin AccessToken dropped at `jellyfin.ts:153`; Plex sign-in tokens are memory-only, `auth.ts:189-191`).
6. **Review cost.** Touching `auth.ts` or `database.ts` triggers the full four-reviewer review (`scripts/review-branch.sh:77`). A design that keeps progress in the media server avoids `database.ts` entirely.

## 8. Existing references to playback, streaming, "watch" or "play"

Searched `docs/`, `CONTEXT.md`, `PRODUCT.md`, `DESIGN.md`, `design/README.md`, `docs/adr/` and `.scratch/`. Linear itself was not queried.

- **Playback statistics** is a defined term, read from Plex and Tautulli (`CONTEXT.md:111-117`). It is out of the first version (`PRODUCT.md:63`; `docs/handover-2026-10-08-aa37.md:47`; `docs/handover-2026-10-08.md:7`; `.scratch/aa-37/work-order.md:47`).
- **Plex watched state** is out of scope for the delete flow (`docs/adr/0005-ask-what-a-delete-is-for.md:23`).
- **Whatbox transcoding ban** (`docs/research/aa-8-whatbox-hosting.md:47`). Whatbox also advises against streaming from cloud-storage mounts (`docs/design/setup-folders-discovery.md:86`).
- Every other "streaming" hit means streaming services on Discover (Netflix and similar filters, AA-89) or the `/api/events` event stream. None is about playback.
- No ticket, ADR, design file or doc mentions an in-app player, a play button, resume, or HLS.
