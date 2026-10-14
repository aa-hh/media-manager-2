# Showing Plex watch status in the app

Researched 14 Oct 2026. Builds on [media-servers.md](media-servers.md) (Plex section: writing progress with `/:/timeline` and `/:/scrobble`) and [codebase-fit.md](codebase-fit.md) (matching by file path, existing screens).

Sources:
- **The spec**: Plex's published API reference at [developer.plex.tv/pms](https://developer.plex.tv/pms/), API version 1.2.3. Links below point at its sections. A call the spec doesn't list is "undocumented"; the spec warns that "paths that aren't documented here aren't part of the API contract".
- **python-plexapi**: the most used third-party Plex library, read at commit `8a9ade7` (28 Sep 2026), [github.com/pushingkarmaorg/python-plexapi](https://github.com/pushingkarmaorg/python-plexapi).
- **Tautulli**: Plex statistics app, [web_socket.py](https://github.com/Tautulli/Tautulli/blob/master/plexpy/web_socket.py) and [activity_handler.py](https://github.com/Tautulli/Tautulli/blob/master/plexpy/activity_handler.py).
- **Checked on the slot**: GET requests run on 14 Oct 2026 against the slot's Plex Media Server 1.43.2.10687, using the app's stored address and token. No writes, no playback, no conversion started. The slot's Plex reported someone else's audio conversion running at the time; that was not ours.

Terms used below:
- **ratingKey**: Plex's id for one movie, show, season or episode on this server.
- **Hub**: Plex's name for one row of items on a home or library screen, such as "Continue Watching".
- **Leaf**: Plex's word for the bottom item in a show: an episode.

## Short answer

- Everything the owner listed comes from Plex as plain fields and lists. Nothing needs rebuilding or storing in our database.
- Per item: `viewCount` (times fully watched), `viewOffset` (resume point in milliseconds), `lastViewedAt`. Per show and season: `leafCount` and `viewedLeafCount`. All documented.
- Continue Watching: use `GET /hubs/continueWatching/items`. It matches what the Plex apps show today (17 items on the slot). The documented `/hubs/continueWatching` returns the same row wrapped as a hub.
- Watched history: `GET /status/sessions/history/all`, documented, with filters for account, library, item and date.
- Live updates: Plex pushes "playing" events with the item and its position. The documented WebSocket address is wrong on 1.43.2; the working one is `/:/websockets/notifications` (plural). The documented event-stream address `/:/eventsource/notifications` also works.
- Matching: one request per library returns every episode's ratingKey, status fields, file path and outside ids. On the slot: 692 episodes in 0.6 to 0.7 seconds, 81 movies in 0.13 seconds. No per-episode requests needed.
- Two clashes with our own docs: `PRODUCT.md:63` puts "playback statistics" out of the first version, and on our screens "Progress" and "History" already mean download progress and Sonarr/Radarr history. Both need the owner's call before design.

## 1. Status fields on each item

All from the spec's `Metadata` object ([spec, Metadata Response](https://developer.plex.tv/pms/#section/API-Info/Metadata-Response)), confirmed on the slot.

| Field | On | Meaning | Seen on the slot |
|---|---|---|---|
| `viewCount` | movie, episode | How many times fully watched. Missing when never watched. | Missing on unwatched items |
| `viewOffset` | movie, episode | Resume point in milliseconds. Missing when not partly watched. | `2511000` on an episode stopped at 41 min |
| `lastViewedAt` | movie, episode, show, season | Last time watched, in seconds since 1970. | Present on partly watched items too |
| `leafCount` | show, season | Total episodes Plex has. | `8` |
| `viewedLeafCount` | show, season | Episodes watched. | `0` of 8 for a show whose first episode is in progress |
| `viewCount` | show | Total plays of any of its episodes, rewatches included. Not "episodes watched". | `23` on a show with `viewedLeafCount` 0 |
| `skipCount` | movie, episode | Not in the spec. Seen on two partly watched movies. Meaning unverified. | `1` |

**States, read from those fields**
- Unwatched: no `viewCount`, no `viewOffset`.
- Partly watched: `viewOffset` present. Plex calls this "In Progress" in its library filter (`inProgress=1`).
- Watched: `viewCount` of 1 or more and no `viewOffset`.
- Rewatching: both `viewCount` and `viewOffset`. Common on the slot: 29 of the 69 partly watched episodes and 7 of the 15 partly watched movies had been watched before. So "watched" and "partly watched" are not exclusive; the screens need to show both.
- Show or season fully watched: `viewedLeafCount == leafCount`. python-plexapi uses exactly this test ([video.py](https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/video.py), `Show.isPlayed`).
- Unwatched episode count for a show: `leafCount - viewedLeafCount`. Plex also accepts it as a filter (`unwatchedLeaves=1`, 37 shows on the slot).

**When Plex marks a video watched** (server settings, read from `GET /:/prefs` on the slot, labels quoted from Plex):
- `LibraryVideoPlayedThreshold`, "Video played threshold": 90% (choices 70 to 95%).
- `LibraryVideoPlayedAtBehaviour`, "Video play completion behaviour": set to "earliest between threshold percent and first credits marker". So an episode with detected end credits counts as watched when the credits start, even before 90%.
- The client doesn't decide. Our player reports position with `/:/timeline` (see media-servers.md) and Plex applies these rules.

**When Plex starts keeping a resume point:** no official rule found. On the slot the smallest saved resume point was 61 seconds (episodes) and 93 seconds (movies), out of 84 partly watched items. A 2019 forum user reported Plex ignoring the first 30 seconds or so ([thread](https://forums.plex.tv/t/save-play-position/60462)); not a staff post. Unverified. Some episodes kept a resume point at 97 to 99% without being newly marked watched; why is unverified.

**Per user:** every status field belongs to the account whose token made the request. The app stores the owner's own token (codebase-fit.md section 5), so it gets the owner's status. The slot's Plex has 10 accounts (`GET /accounts`). Showing a friend's status would need that friend's token; the owner's token can only read other accounts' history (next section), not their per-item fields.

## 2. Lists

### Which addresses exist

"Spec" means listed in the spec. "Slot" means it answered 200 on 1.43.2.

| Address | Spec | Slot | Returns on the slot |
|---|---|---|---|
| `/hubs/continueWatching` | yes ([link](https://developer.plex.tv/pms/#tag/Hubs/operation/hubsGetContinueWatching)) | yes | One hub, `continueWatching`, holding the first `count` items, `more=true`. Its `key` points to the next row. |
| `/hubs/continueWatching/items` | no | yes | 17 items: movies and episodes, newest first. python-plexapi's `PlexServer.continueWatching()` uses it ([server.py](https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/server.py)). |
| `/hubs/home/continueWatching` | only inside an example response | yes | The same 17 items. |
| `/hubs/sections/{id}/continueWatching/items` | no | yes | One library's Continue Watching: 10 episodes (TV), 7 movies (Films). |
| `/hubs/home/onDeck` | only inside an example response | yes | 10 items, episodes only. |
| `/library/onDeck` | no | yes | 20 items: the same 17 plus 3 movies (below). python-plexapi `Library.onDeck()`. |
| `/library/sections/{id}/onDeck` | no | yes | 10 episodes (TV), 10 movies (Films). |
| `/hubs` | yes ([link](https://developer.plex.tv/pms/#tag/Hubs/operation/hubsGetSlash)) | yes | The home screen rows: Continue Watching, Recently Added per type, Leaving Soon collections, Recent Playlists. |
| `/hubs/sections/{id}` | yes ([link](https://developer.plex.tv/pms/#tag/Hubs/operation/hubsGetSection)) | yes | A library's rows. TV: Continue Watching, Recently Released Episodes, Recently Added, Start Watching. Films: Continue Watching, Recently Released, Recently Added, Top Unwatched, and genre and actor rows. |
| `/hubs/promoted` | yes ([link](https://developer.plex.tv/pms/#tag/Hubs/operation/hubsGetPromoted)) | yes | The rows Plex says belong on a home screen. |

**Continue Watching vs On Deck**
- On Deck was Plex's older row: the next episode to watch per show, plus partly watched items. Continue Watching replaced it in Plex's apps. A Plex staff member (DaveBinM, 16 Dec 2020) described the merged row as in-progress and On Deck items from every movie and TV library in one place, and promised a way to remove partly watched items from it ([thread](https://forums.plex.tv/t/on-deck-continue-watching-recently-added/666191)).
- On the slot the old and new lists differ only by three movies: Spider-Man: Across the Spider-Verse, Bugonia and The Fantastic Four: First Steps. They were last watched 17, 34 and 48 weeks ago. The server setting `OnDeckWindow`, "Weeks to consider for Continue Watching", is 16. So Continue Watching applies that window to movies and the old `/library/onDeck` doesn't. Episodes matched in both.
- Other Continue Watching settings on the slot: `OnDeckLimit` 40 items, and `OnDeckIncludePremieres` on ("New season premieres will always appear no matter how many weeks have passed since watching").
- Continue Watching includes next episodes, not just partly watched ones. On the slot every item had a resume point, so this wasn't visible. The show-level call below shows the next-episode case.
- Partly watched is wider than Continue Watching: 69 episodes and 15 movies are partly watched (`inProgress=1`), but only 17 items are in the row because of the 16-week window and the limit. A series page can show a resume point that the home row has dropped.
- **Use `/hubs/continueWatching/items`.** It is what Plex's own apps list. The documented `/hubs/continueWatching?count=N` is the safe fallback if Plex removes the undocumented one.

**Next episode for one show:** `GET /library/metadata/{showRatingKey}?includeOnDeck=1` adds an `OnDeck` element holding the episode Plex would play next. Undocumented; works on the slot; python-plexapi's `Show.onDeck()` uses it.

### Remove from Continue Watching

- `PUT /actions/removeFromContinueWatching?ratingKey=…` (python-plexapi `Movie.removeFromContinueWatching()`, [video.py](https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/video.py)).
- Not a documented path. The spec only names it inside the list of features a library can advertise. The slot's Plex does advertise it: `GET /media/providers` lists `actions: removeFromContinueWatching → /actions/removeFromContinueWatching`.
- Not tried (it changes state). Whether it also clears the resume point is unverified.

### Mark watched and unwatched

- `PUT /:/scrobble?key={ratingKey}&identifier=com.plexapp.plugins.library` and `PUT /:/unscrobble` with the same parameters. Documented ([scrobble](https://developer.plex.tv/pms/#tag/Timeline/operation/putScrobble), [unscrobble](https://developer.plex.tv/pms/#tag/Timeline/operation/putUnscrobble)).
- Works on a show or season too: python-plexapi calls it with a show's ratingKey to mark every episode.
- The spec says scrobble "does not create any view history of this item but rather just sets the state as played". Marking by hand won't appear in the watched history.
- Trap: the spec says both "respond to the GET verb". python-plexapi sends GET. Any code that crawls Plex addresses must never request these, or it marks things watched.

### Watched history

`GET /status/sessions/history/all`, documented ([link](https://developer.plex.tv/pms/#tag/Status/operation/statusGetHistoryAll)). The spec says to page it.
- Filters: `accountID`, `librarySectionID`, `metadataItemID` (a show's ratingKey returns all its episodes), `viewedAt>=` (seconds since 1970), `sort=viewedAt:desc`.
- An admin token sees every account's history. Filter by `accountID=1`, the server owner's local account id on the slot (unverified that 1 is always the owner).
- Each entry: `historyKey`, `ratingKey`, `title`, `grandparentTitle`, season and episode numbers, `librarySectionID`, `viewedAt`, `accountID`, `deviceID`. No resume point: these are finished plays.
- The slot holds 4,088 entries; 47 in the TV library in the last 30 days.
- Paging: send `X-Plex-Container-Start` and `X-Plex-Container-Size` headers ([spec, Pagination](https://developer.plex.tv/pms/#section/API-Info/Pagination)). Size 0 returns only the total.
- `DELETE /status/sessions/history/{id}` removes one entry. Documented.
- For a "recently watched" row, this list is better than sorting the library by `lastViewedAt`, because `lastViewedAt` also moves when something is only partly watched.

### Recently added (for completeness)

- `/hubs/home/recentlyAdded?type=1` (movies) or `type=2` (TV): what the Plex home row shows. Undocumented as a path; appears in `/hubs` on the slot. TV returns a mix of seasons and single episodes.
- `/library/sections/{id}/all?sort=addedAt:desc`: documented through the library listing and its filters. Plex's own "Recently Added in Films" row points at exactly this.
- `/library/recentlyAdded` and `/library/sections/{id}/recentlyAdded`: older, undocumented, both work.
- The app already knows what it imported from Sonarr and Radarr, so this list adds little.

### Counting by status

The library listing accepts status filters and a page size of 0, so counts cost one small request each. On the slot: TV has 692 episodes, 368 unwatched, 69 partly watched; Films has 81 movies, 56 unwatched, 15 partly watched. Filters (`unwatched`, `inProgress`, `unwatchedLeaves`, `lastViewedAt>>=`) follow the spec's media query rules ([spec, Media Queries](https://developer.plex.tv/pms/#section/API-Info/Media-Queries)).

## 3. Live updates

Plex pushes events over two documented channels, both listed in the spec's Events section:

| Address | Spec | Slot |
|---|---|---|
| `/:/websocket/notifications` (singular) | yes ([link](https://developer.plex.tv/pms/#tag/Events/operation/websocketGetSlash)) | **Fails to connect** on 1.43.2 |
| `/:/websockets/notifications` (plural) | no | Connects. Used by python-plexapi ([alert.py](https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/alert.py)) and Tautulli. |
| `/:/eventsource/notifications` | yes ([link](https://developer.plex.tv/pms/#tag/Events/operation/eventsourceGetSlash)) | Works. Server-sent events (a one-way stream over normal HTTP), `text/event-stream`. |

- The event stream is the one to use: documented, works on the slot, and plain HTTP, so it fits the server's existing request code better than a WebSocket.
- `filters=` picks event types, for example `filters=playing,timeline`. Documented. The default sends everything except logs.
- The spec doesn't describe the events themselves. Their shapes below come from Tautulli's handler and from 25 seconds of listening on the slot.

| Event type | Holds | Use |
|---|---|---|
| `playing` | `PlaySessionStateNotification`: `ratingKey`, `viewOffset`, `state` (playing, paused, buffering, stopped, error), `sessionKey` | Update one item's resume point live, from any Plex app the owner uses |
| `timeline` | `TimelineEntry`: `itemID`, `parentItemID`, `rootItemID`, `state`, `metadataState` (for example `created`), `sectionID` | Library changes: items added, refreshed, removed |
| `activity` | Server jobs, for example "Detecting intros" | Not needed |
| `transcodeSession.start` / `.update` | Conversion jobs | Not needed |

Not verified: whether marking an item watched or unwatched in another Plex app sends any event. Only plays were seen as events. Testing it means the owner marking something in a Plex app while a listener runs.

**Suggested refresh plan (not built, nothing tested beyond reads)**
1. Our server holds one event stream to Plex. Plex is on the same machine, so it costs only local traffic.
2. On `playing`: update that ratingKey's resume point from the event. On `stopped`: fetch that one item again (`GET /library/metadata/{ratingKey}`) to pick up `viewCount` if it crossed the watched threshold.
3. Pass changes to the browser over the app's existing `/api/events` stream (`src/server/app.ts:510`).
4. After our own scrobble, unscrobble or remove call, fetch the affected item again.
5. Fetch both libraries in full every few minutes to catch marks made elsewhere. It costs about 1 second and 0.5 MB with trimmed fields (section 4).

## 4. Matching our titles to Plex items

### One request per library

`GET /library/sections/{id}/all?type=4&includeGuids=1` returns every episode with ratingKey, show ratingKey, season and episode numbers, the status fields, `Media[].Part[].file` (the file path) and `Guid` ids. `type=1` does the same for movies, `type=2` for shows (with `leafCount` and `viewedLeafCount`). `type` is a documented media query field ([Content section](https://developer.plex.tv/pms/#tag/Content/operation/librarySectionGetAll)).

Timings on the slot:

| Request | Time | Size |
|---|---|---|
| All 692 episodes, full fields | 0.70 s | 1.9 MB |
| All 692 episodes, trimmed fields | 0.60 s | 0.3 MB |
| All 81 movies, full fields | 0.13 s | 0.2 MB |
| All episodes of one show (`/library/metadata/{id}/allLeaves`, documented) | 0.03 s | |

**Trimming:** `includeFields=ratingKey,grandparentRatingKey,parentIndex,index,viewCount,viewOffset,lastViewedAt,duration,file` with the header `X-Plex-Pms-Api-Version: 1.2.2`. Without that header the server treats the request as API version 0.0, where `includeFields` means "add these optional fields", not "only these" ([spec, API Versioning](https://developer.plex.tv/pms/#section/API-Info/API-Versioning)). 1.43.2 supports up to API 1.2.2. The server still sent some child lists it was asked to leave out (`Image`, `Role`); the spec says these options are "requests, not guarantees".

### Matching rules, in order

1. **File path.** Each Plex `Part.file` is the same path Sonarr and Radarr report (`/home/…/TV/American Dad!/American.Dad.S02E02….mkv` on the slot), because everything runs on one machine. Build a map from path to ratingKey. Second versions are covered too: Plex keeps every file of a movie or episode under one ratingKey, one `Media` entry per file. Watched status therefore belongs to the movie or episode, not to a version.
2. **Outside ids.** With `includeGuids=1`, each show and movie has `Guid` entries such as `imdb://tt7462410`, `tmdb://71914`, `tvdb://355730` ([spec, Metadata Response](https://developer.plex.tv/pms/#section/API-Info/Metadata-Response)). Match Sonarr's `tvdbId` to the show's `tvdb://` id, then episodes by season and episode number. Radarr's `tmdbId` or `imdbId` match the movie. Use this when a file was renamed and Plex hasn't rescanned yet.
3. Episode `Guid`s are the episode's own ids. Our episodes don't carry outside ids (codebase-fit.md section 3), so episodes match by path, or by show id plus numbers.

- Asking Plex to filter by an outside id doesn't work: `guid=tvdb://355730` returned nothing on the slot. Only Plex's own `plex://` ids work as a filter. So keep the map on our side.
- Not checked: whether Plex and Sonarr ever number a show's episodes differently (anime and absolute numbering are the usual cases). Path matching avoids the question.

### Cache

- Keep the maps in memory on our server. Rebuild on start, on a timer, and from the events in section 3. Nothing goes in the database, which matches codebase-fit.md's point that keeping status only in Plex avoids drift.
- `lastViewedAt>>=-7d` returns only items watched or partly watched recently (12 episodes in the last week on the slot), which could make the timed refresh smaller. It misses items marked unwatched, so the full refresh still has to run sometimes. `updatedAt` is no use for this: 598 of 692 episodes changed in a week through metadata refreshes.

## 5. Where status could show (suggestions only)

Screens from codebase-fit.md section 4. All of this needs a design in a `.pen` file first.

| Screen | What to show | From |
|---|---|---|
| Library cards (`src/client/library/Library.tsx`) | Watched mark on movies. Unwatched episode count on shows (`leafCount - viewedLeafCount`). A thin resume bar for partly watched movies. | Bulk lists |
| Library screen, top | A "Continue Watching" row, if the owner wants one. The Library is the app's default screen (`Home.tsx:94-103`). | `/hubs/continueWatching/items` |
| Series page (`SeriesOverview.tsx`) | Watched count per season (`viewedLeafCount` of `leafCount`). The next episode with a Play or Resume button. | Season items; `includeOnDeck=1` |
| Episode rows (`EpisodeRows.tsx`) | Per row: watched, partly watched with time left, unwatched. Mark watched or unwatched. | Episode list |
| Episode details (`EpisodeDetails.tsx`) | Last watched date, times watched, resume point. | One item |
| Movie page (`MovieOverview.tsx`, `TitleHeader.tsx`) | Same as episode details. Resume or Play from start. Mark watched. Remove from Continue Watching if partly watched. | One item |

Conflicts to resolve before design:
- Library cards allow one badge (`Library.tsx:63`: "One badge per card: live progress, then deleted, then not monitored…"). Watched status would compete with download status.
- The cards already have a "Progress" field meaning downloaded episodes (`Library.tsx:36`). Watch progress needs another word.
- `CONTEXT.md` defines "History" as Sonarr's or Radarr's record and lists "watch history" as a word to avoid. It defines "Playback statistics" as "who has watched which movie or episode, when, how often, and how far through a show they are. Read from Plex and Tautulli". That covers this feature, and `PRODUCT.md:63` lists playback statistics as out of the first version. The owner needs to move it in, and the glossary should name the per-item states.

## Could not verify

- When Plex starts keeping a resume point (61 seconds was the smallest seen).
- What `skipCount` means.
- Whether `removeFromContinueWatching` also clears the resume point.
- Whether marking watched or unwatched in another app sends an event.
- That account id 1 is always the server owner.
- That the undocumented addresses relied on here (`/hubs/continueWatching/items`, `/:/websockets/notifications`, `includeOnDeck=1`, `/actions/removeFromContinueWatching`) survive Plex updates. Each has a documented fallback except `includeOnDeck` and the remove action.
