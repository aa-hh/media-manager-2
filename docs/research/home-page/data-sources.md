# Home page rows: where the data comes from

Researched 16 Nov 2026 for a Plex-style home page at `/` (rows of things to watch, one click to play). Read-only: no code changed, nothing run against Plex or Trakt.

Sources:
- This repo at `claude/home-page-plex-discovery-0b4a28` (branched from `15966a8`).
- Earlier research, which already tested Plex's lists on the slot's Plex 1.43.2: [plex-watch-status.md](../in-app-player/plex-watch-status.md) and [plax-lessons.md](../in-app-player/plax-lessons.md) (the owner's Plax client).
- Trakt's API description, downloaded from `jsapi.apiary.io/apis/trakt.apib`. Trakt marked that copy deprecated on 11 Jun 2026 in favour of developer.trakt.tv ([announcement](https://github.com/trakt/trakt-api/discussions/808)); the new OAuth page still says the access token "is valid for 7 days" and adds that refresh tokens are single-use.

## Short answer

- The app has one viewer today: the owner. Sign-in refuses every other Plex account, managed accounts included (`src/server/auth.ts:515-517`, `:532`), and every Plex call uses the owner's saved token (`src/server/services/plex.ts:16`, `plexPlayback.ts:69`). So every row below is the owner's. Rows become per-person only when friends can sign in, which `PRODUCT.md:64` keeps out of the first version.
- Continue Watching and Recently Added already come back from the server on every library load (`src/server/watchStatus.ts:379-430`). The TV app shows them as rows (`android-tv/.../ui/browse/Rails.kt:49-67`); the web Library only uses Continue Watching as a filter (`src/client/library/grid.ts:64-73`).
- Per-episode last-played time is already in memory: the Plex listing the app builds every 60 seconds holds every episode with `lastViewedAt` (`watchStatus.ts:146-186`, `:107`). Nothing reads it per episode; only the show-level `lastViewedAt` leaves the server (`watchStatus.ts:397`). Nothing is stored in the database.
- Trakt today is public lists only, with just a Client ID (`src/server/services/trakt.ts:7`, `:75-86`, `src/server/connections.ts:28`). Watchlist, recommendations, Trakt's next episode and Trakt's resume points all need the viewer to sign in to Trakt, which needs a Client Secret the app does not store yet.
- "Can this play?" has two halves already used together on the show page: Sonarr has the file, and Plex matched it (`src/client/title/playLine.ts:18-21`). Season counts ("4 of 8") are already printed on the show page (`src/client/title/rows.ts:71-85`).
- Jellyfin installs get none of this: watch status is switched off unless the media server is Plex (`src/server/index.ts:104`), and Play is hidden on Jellyfin (`src/client/library/watch.ts:72`).

## 1. What the app knows today

| Fact | Where | Per episode? | Whose |
|---|---|---|---|
| Resume point (`viewOffset`), length, play count, last played (`lastViewedAt`) per movie and episode | Plex listing of every movie and episode, `watchStatus.ts:146-186`; per item via `playable`, `:110-131` | Yes, in memory. Sent per episode only on the show page (`forSeries`, `:432-458`) | Owner's token |
| Show totals: episodes, episodes watched, last played | `watchStatus.ts:390-398` | No, per show | Owner |
| Continue Watching (Plex's merged row: partly watched items plus each show's next episode) | `plex.continueWatching()` → `/hubs/continueWatching/items`, `plex.ts:106`; mapped `watchStatus.ts:404-421` | Each entry is one episode with season and number | Owner |
| Next episode for one show | `plex.onDeck()` → `/library/metadata/{id}?includeOnDeck=1`, `plex.ts:108-113`; used `watchStatus.ts:438` | Yes | Owner |
| Recently added: 20 shows ranked by their newest episode, 20 movies | `watchStatus.ts:88`, `:183`, `:422-429` | No: a show, not the new episodes | Shared (it is the library) |
| Which episodes have a file | `episodes.has_file` in SQLite (`src/server/database.ts:234-245`), read by `listEpisodes`, `src/server/titles.ts:105-118`; refreshed on Sonarr's Download and EpisodeFileDelete webhooks, `titles.ts:295-301` | Yes | Shared |
| Season counts: files, aired episodes, all episodes | Sonarr `seasons[].statistics`, passed through `src/server/library.ts:114-125`, `:381-386` | Per season | Shared |

Freshness: the Plex listing is reused for 60 seconds (`watchStatus.ts:89`) and rebuilt early when Plex's webhook reports a play, pause, stop or watched mark (`:92`, `:284-296`). Plex webhooks need Plex Pass on the owner's account.

Gaps:
- Continue Watching entries for anything Sonarr or Radarr do not track are dropped (`watchStatus.ts:407`).
- The web Library keeps one Continue Watching entry per show (`src/client/library/Library.tsx:230-234`), as does the TV app (`Rails.kt:129`). Plex lists one entry per show anyway.
- `lastViewedAt` also moves on a partial play. Plex's history list (`/status/sessions/history/all`) records finished plays only, with `viewedAt`, and can be filtered by account, library and date (plex-watch-status.md, "Watched history"). The app does not call it.

## 2. Plex lists worth using

All already tested on the slot's Plex; see plex-watch-status.md section 2.

| List | Address | Notes |
|---|---|---|
| Continue Watching | `/hubs/continueWatching/items` (in use) | Same as Plex's apps. Follows the server's "weeks to consider" setting (16 on the slot) and its 40-item cap. |
| One library's Continue Watching | `/hubs/sections/{id}/continueWatching/items` | Movies and TV apart, if the design splits them. |
| Recently added | `/library/sections/{id}/all?sort=addedAt:desc`, or `/hubs/home/recentlyAdded?type=1\|2` | The app's own listing already covers this. |
| Finished plays | `/status/sessions/history/all?accountID=…&sort=viewedAt:desc` | Paged by `X-Plex-Container-Start`/`-Size` headers. The owner's token sees every account's plays; `accountID=1` is the owner on the slot (unverified that it always is). |
| Plex's own home rows | `/hubs`, `/hubs/promoted` | Plax uses these for its home (plax-lessons.md, section 6). On the slot they include "Leaving Soon" collections someone else made. |

Managed and Plex Home accounts: every watch field belongs to whichever account's token made the request (plex-watch-status.md, "Per user"). Plax switches to the active Home user's token for this (plax-lessons.md:31). The app never sees a second account's token, so a friend's Continue Watching is out of reach until friends can sign in.

Jellyfin: Jellyfin has its own resume, next-up and latest lists, but the app's Jellyfin client asks for no watch data at all (`EnableUserData: 'false'`, `src/server/services/jellyfin.ts:87`). A Jellyfin home page is separate work, sized L.

## 3. Trakt

Today: public lists (trending, popular, anticipated and so on), genres and backdrops, with only `trakt.clientId` saved (`trakt.ts:113-137`, `src/server/discover/recipes.ts:39-77`). A 429 pauses every Trakt call until `Retry-After` passes (`trakt.ts:88-108`).

What signing in to Trakt adds (all "OAuth Required" in Trakt's description):

| Call | Gives | Limits |
|---|---|---|
| `GET /sync/watchlist/{movies\|shows}` | The viewer's watchlist | Free accounts: 100 items (account limits in the `/users/settings` example: watchlist 100, 2 lists of 100, collection 100). Over the limit Trakt answers 420. |
| `GET /shows/{id}/progress/watched` | `next_episode`: the next aired episode the viewer has not watched; `last_episode`, per-season counts | One call per show. Only aired episodes count. |
| `GET /sync/playback/{movies\|episodes}` | Resume points from players that report to Trakt | Kept 6 months. |
| `GET /recommendations/{movies\|shows}?ignore_watchlisted=true` | Personal suggestions | Default 10, up to 100 per page. |
| `GET /sync/history`, `/sync/watched/{type}` | Everything watched, with dates | |
| `GET /users/me/lists` | The viewer's own lists | Free: 2 lists of 100. |
| `GET /sync/last_activities` | One timestamp per area (watchlist, watched, playback) | Trakt's suggested first call: re-read an area only when its timestamp moved. |

No sign-in needed: `GET /movies/{id}/related` and `/shows/{id}/related` ("related and similar"), usable for a "Because you watched" row seeded from Plex's own history.

Sign-in: the device code flow (`POST /oauth/device/code`, then poll `POST /oauth/device/token` every `interval` seconds until 200; the code lasts `expires_in`, 600 s in the example). The viewer types an 8-character code at trakt.tv/activate, which also suits the TV app. Polling needs the Client Secret. The access token lasts 7 days; each refresh returns a new refresh token and the old one stops working, so a lost write logs the viewer out of Trakt.

Rate limits: 1,000 GET calls per 5 minutes per signed-in user and the same for the app's unsigned calls; 1 write per second per user. Paid-only calls answer 426 (none of the calls above are paid-only); sorting a watchlist by outside ratings is paid-only and falls back to rank.

Keeping Trakt current: Trakt only knows what something reports to it. Trakt's own Plex Scrobbler needs both Trakt VIP and Plex Pass ([Trakt support](https://support.trakt.tv/support/solutions/articles/70000425640-plex-scrobbler)); free tools such as Plaxt and PlexTraktSync exist. The app cannot tell which, if any, the owner runs. The app already receives Plex's play, pause, stop and watched webhooks (`watchStatus.ts:284-296`), so it could report plays to Trakt itself (`/scrobble/start|pause|stop`); if the owner also runs a scrobbler, Trakt would get every play twice.

## 4. Deciding that something can play

Rule the show page already uses (`playLine.ts:18-21`): Sonarr or Radarr has the file AND Plex has matched that file to an item. Both halves matter:
- Plex alone lags behind an import until its scan finishes; Sonarr alone can say "has file" for a file Plex has not picked up. Playing goes through Plex's item id (`watch.ts:86-93`), so without Plex's match there is nothing to play.
- Plex lists only what it has, so Plex's own lists (Continue Watching, Recently Added) are playable by definition. Lists from Trakt or Sonarr are not, and need this check per item.

Where each check lives today:
- Movie: `movie.hasFile` (`library.ts:479`) and a Plex match by file path, then TMDB or IMDB id (`watchStatus.ts:211-215`).
- Episode: `episodes.has_file` in SQLite, or Sonarr's live `hasFile`; Plex match by file path, then by season and number (`watchStatus.ts:449-452`).
- Trakt and TMDB titles to library ids: `libraryIdsByTmdbId` (`titles.ts:98-103`), used by Discover's `present` (`src/server/discover/rows.ts:113-130`). Shows from Trakt also carry a TVDB id (`trakt.ts:50`).

Partly downloaded season: the season chip already prints "N missing · 4 of 8" (`rows.ts:71-85`, called from `src/client/title/EpisodeRows.tsx:527-532`), from Sonarr's season statistics. Sonarr's `episodeCount` counts aired episodes (with files or monitored), `totalEpisodeCount` counts all, including unaired. For "episodes 1–4 of 8 here", list `has_file` per episode from the `episodes` table; gaps such as "1, 2 and 5 of 8" fall out of the same list.

Next episode not downloaded: Plex's next episode only ever points at an episode Plex has, so when S2 E5 is missing Plex either offers nothing or a later episode (unverified which). To spot the gap, compare the last watched episode with the `episodes` table: the first aired episode after it with `has_file = 0` is the missing one. Trakt's `next_episode` gives the same answer from Trakt's side, when Trakt is kept current.

## 5. Can home rows reuse Discover's saved rows?

Discover saves each row as JSON in `discover_rows`, keyed by the row's settings, shared by everyone, rebuilt every 30 minutes to 6 hours by the `discover-refresh` job, and only `orchestrator.ts` may call TMDB or Trakt (ADR 0004; `recipes.ts:22-30`; `rows.ts:82-106`).

- Fits: rows that are the same for everyone and change slowly. A "Because you watched" row built from Trakt's public `related` lists, or Trakt recommendations while there is one viewer. The library join already happens when a row is read (`present`, `rows.ts:113-130`), so a "can it play" filter can join there too; ask Trakt for 100 and keep the playable ones, since most won't be.
- Does not fit: Continue Watching, Up Next, recently watched, watchlist. They are one viewer's, change on every play, and Plex's webhook already marks the moment to re-read (`watchStatus.ts:92`). The key has no viewer in it (`rowKey`, `rows.ts:71-75`), so per-person rows would need it added before friends sign in.
- Personal Trakt data needs its own small store: tokens (secret, so with the other credentials, never echoed to the page) and the last `/sync/last_activities` answer, re-read when the home page loads and at most every few minutes.

## Rows

Sizes: S is about a day, M a few days, L a week or more. The Trakt sign-in itself is counted once, under Missing pieces.

### Continue Watching

| | |
|---|---|
| Source | Plex `/hubs/continueWatching/items` |
| Today | Exists on the server (`watchStatus.ts:404-421`); TV app row exists; web shows it only as a Library filter |
| Trakt sign-in | Not needed. Trakt's `/sync/playback` only adds resume points from players other than Plex |
| Freshness | 60 s, plus Plex's webhook |
| Per user | Owner only today |
| Playable rule | Plex lists only what it has. Items not in Sonarr or Radarr are dropped today (`watchStatus.ts:407`) |
| Size | S (web row; data already there) |

### Up Next (next episode of shows in progress)

| | |
|---|---|
| Source | Plex's Continue Watching already includes each show's next episode (plex-watch-status.md, "Continue Watching vs On Deck"); `includeOnDeck=1` per show; Trakt `progress/watched` for the true next aired episode |
| Today | Plex part exists, mixed into Continue Watching. Missing-episode check does not exist |
| Trakt sign-in | Only for Trakt's version |
| Freshness | Plex: 60 s plus webhook. Trakt: per `last_activities` |
| Per user | Owner only today |
| Playable rule | Plex's pick is playable. A gap (next aired episode with no file) needs the `episodes` table check in section 4 |
| Size | S to split it out of Continue Watching; M with the missing-episode card |

### Recently Added

| | |
|---|---|
| Source | Plex `addedAt`, already in the listing |
| Today | Exists on the server, 20 shows and 20 movies (`watchStatus.ts:422-429`); TV app rows exist (`Rails.kt:63-64`); not on the web |
| Trakt sign-in | No |
| Freshness | 60 s; a new import shows after Plex's scan, not on Sonarr's webhook |
| Per user | Shared |
| Playable rule | Plex lists only what it has |
| Size | S. "3 new episodes" on a show card needs per-episode `addedAt`, also already in memory: S |

### Watchlist, available now

| | |
|---|---|
| Source | Trakt `/sync/watchlist`. Alternative without Trakt: the owner's Plex watchlist on `discover.provider.plex.tv` (python-plexapi's `MyPlexAccount.watchlist`; not tried here) |
| Today | Nothing |
| Trakt sign-in | Yes (or the Plex watchlist) |
| Freshness | Re-read when `last_activities` says the watchlist changed |
| Per user | Per Trakt account |
| Playable rule | Join TMDB/TVDB ids to library ids, then the section 4 check. A show is available when at least one episode plays; the card says how many |
| Size | M |

### Recently watched episodes

| | |
|---|---|
| Source | Plex history `/status/sessions/history/all` (finished plays), or `lastViewedAt` on each episode in the existing listing (moves on partial plays too) |
| Today | The data is in memory, unused per episode (`watchStatus.ts:107`, `:146-186`) |
| Trakt sign-in | No. Trakt `/sync/history` only if Trakt is kept current |
| Freshness | 60 s plus webhook |
| Per user | Owner only today. The history list can filter by account, so other accounts' plays are readable with the owner's token |
| Playable rule | Drop entries whose file is gone (Plex keeps history for deleted items) |
| Size | S from the listing; M from the history list (new Plex call with paging) |

### Because you watched X / Trakt recommendations

| | |
|---|---|
| Source | Trakt `/movies/{id}/related`, `/shows/{id}/related` (no sign-in), seeded from Plex's last finished plays; or `/recommendations` (sign-in) |
| Today | Nothing; Trakt client has neither call |
| Trakt sign-in | No for `related`; yes for `recommendations` |
| Freshness | Hours. Can be a Discover saved row |
| Per user | Seeded per viewer; one viewer today |
| Playable rule | Library join, then section 4 check. Most suggestions won't be in the library: ask for 100, keep the playable ones, hide the row under a minimum count |
| Size | M |

### New episodes of shows you watch

| | |
|---|---|
| Source | Plex listing: episodes with recent `addedAt`, unwatched, from shows with at least one watched episode |
| Today | All fields in memory; no code |
| Trakt sign-in | No |
| Freshness | 60 s plus webhook |
| Per user | Owner only today |
| Playable rule | Plex has it by definition |
| Size | S |

### Partly downloaded seasons

| | |
|---|---|
| Source | `episodes.has_file` per episode, Sonarr season statistics |
| Today | Counts printed on the show page (`rows.ts:71-85`); no list across shows |
| Trakt sign-in | No |
| Freshness | Sonarr webhooks |
| Per user | Shared |
| Playable rule | At least one episode with a file and a Plex match; card says which ("Episodes 1–4 of 8") |
| Size | S. Better as a label on cards in other rows than as its own row |

### Leaving soon

| | |
|---|---|
| Source | The deletion score does not exist in code. Research only: [aa-163-learning-deletion-score.md](../aa-163-learning-deletion-score.md); `PRODUCT.md:64` puts it out of the first version. Plex's own "Leaving Soon" collections exist on the slot's Plex, made by another tool |
| Today | Nothing |
| Size | L with the score; S to show an existing Plex collection as a row |

## Missing pieces

1. Trakt sign-in: a Client Secret setting, the device code flow (web and TV screens), token storage beside the other credentials, refresh before the 7 days run out, a Trakt client for signed-in calls (bearer header, its own 1-per-second write limit). L.
2. A "can this play" check shared by every non-Plex row: library id, file present, Plex match. Today it exists only inside the show page (`playLine.ts:18-21`) and the server's matchers. M.
3. A server reply for the home page that carries per-episode data (episode id, `lastViewedAt`, `addedAt`, resume point). `forLibrary` sends only per-show totals (`watchStatus.ts:390-398`). S.
4. Plex history client with paging, for finished plays. S.
5. Missing-next-episode check against the `episodes` table. S.
6. A route and screen for the home page at `/`; the Library moves elsewhere (`src/client/Home.tsx:55`, `:114-115`). M.
7. Before friends sign in: the viewer's id in every personal row, and each friend's own Plex token. Out of scope until `PRODUCT.md:64` changes.

## Open questions for the owner

1. Who runs the home page: only you, or friends too soon? With only you, the owner's Plex token and one Trakt account are enough, and rows can be saved like Discover's.
2. Do you already send Plex plays to Trakt (Trakt VIP's Plex Scrobbler, Plaxt, PlexTraktSync)? If not, Trakt's next episode and history go stale, and either the app reports plays to Trakt itself or Up Next uses Plex only. If yes, the app must not also report them.
3. Watchlist from Trakt or from Plex? A free Trakt account holds 100 watchlist items; the Plex watchlist needs no new sign-in.
4. Next episode not downloaded: hide the show, or show a greyed card ("S2 E5 not downloaded") with a search button? A greyed card breaks "only playable content" but is the one place the gap would show.
5. Continue Watching entries for things Sonarr and Radarr don't track (home videos, items added to Plex by hand): show them, or keep dropping them as today?
6. Is the home page Plex-only? Jellyfin installs would get an empty page, or the old Library, until the Jellyfin side is built.

## Owner answers, 16 Nov 2026

- **Plex plays sent to Trakt:** not sure. Design rows from Plex data first; Trakt-based "next episode" waits until this is known.
- **Watchlist:** if there is a watchlist row, it reads both Trakt and Letterboxd (films only). Plex's watchlist was not chosen.
- **Next episode not downloaded:** hide the show from Home. Home lists only things that can play now.
- **Friends:** a separate session will scope friends soon. Design for one viewer now, without layouts that would break with a per-person Home.
- **Cards (after seeing layouts A, B, C):** Home uses small, compact cards, since the viewer already knows these titles. Discover keeps the big posters. Clicking a card opens the title page; only Play plays.
