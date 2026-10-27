# How the Plex desktop app talks to Plex Media Server during playback

27 Oct 2026. Static reading of the official Plex app for Mac, version 1.115.0 (`tv.plex.desktop`). Nothing was run and no server was contacted.

The app is a Qt shell around three parts:

- **Plex Web 4.160.0**, a JavaScript app in `Contents/Resources/web-client/`. It makes every playback request to the server.
- **libmpv**, the mpv player as a library. It plays the stream address it is given.
- **QWebChannel**, Qt's bridge between the web page and the native code. The web page uses it to control mpv.

Each claim is marked:

- **Seen**: read in the code. Line numbers are cited.
- **Inferred**: reasoned from the code but not directly read.

## Short answer

What to copy for a desktop client built on mpv:

1. **Decide on the client, then ask the server.**
   - The client works out direct play or direct stream first.
   - Desktop allows direct play for any file in 10 containers. It checks no codecs.
   - Every playback still makes one `GET /video/:/transcode/universal/decision` before it starts.
2. **Hand mpv one of two addresses.**
   - Direct play: the raw part address.
   - Direct stream and transcode: `/video/:/transcode/universal/start` with `protocol=http`. Plex sends back a Matroska stream it writes as it goes. Only the `directStream` flag differs between the two.
   - The desktop never uses HLS or DASH.
3. **Name the device profile.**
   - Send `X-Plex-Client-Profile-Name: Plex Desktop` on every request.
   - The server then applies its built-in desktop rules for codecs and subtitles.
   - Desktop sends no `X-Plex-Client-Profile-Extra`.
4. **No automatic quality on desktop.**
   - The function that allows it always returns false in this build, so desktop always sends `autoAdjustQuality=0`.
   - When automatic quality is on (browsers only), the server adapts the stream. The client only displays the bandwidth figure the server returns.
5. **Track choices live on the server.**
   - Audio and subtitle choices are saved with `PUT /library/parts/{id}`.
   - Playback requests never carry stream ids.
   - In direct play, mpv switches track itself.
   - While transcoding, a track change makes a new decision at the current position.
6. **Seeking.**
   - Direct play: mpv seeks inside the file.
   - Transcode: the client rewrites `offset` in the same start address and reloads mpv. There is no new decision and no new session.
7. **Reporting.**
   - `GET /:/timeline` every 10 seconds in every state, plus on each state change.
   - The server decides when an item counts as watched.
   - `/:/scrobble` and `/:/unscrobble` mark items played and unplayed.

## 1. Identity sent on every request

Seen at `main` 11396-11411 and 140313-140362 (file names in "How to check these findings").

| Header | Value on desktop |
|---|---|
| `X-Plex-Product`, `-Version`, `-Platform`, `-Platform-Version` | from the native `system.describe` call. Inferred: "Plex for Mac", 1.115.0 |
| `X-Plex-Client-Identifier` | random 24 characters, made once and kept in native storage (150004, 152642) |
| `X-Plex-Device-Name` | the Mac's host name |
| `X-Plex-Device` | removed on desktop |
| `X-Plex-Model` | `standalone` |
| `X-Plex-Features` | `external-media,indirect-media,hub-style-list` |
| `X-Plex-Device-Screen-Resolution` | `{window w}x{window h},{screen w}x{screen h}` |
| `X-Plex-Client-Profile-Name` | `Plex Desktop` |
| `X-Plex-Token` | the token for that server |
| `X-Plex-Language`, `Accept-Language` | the language setting |
| `X-Plex-Session-Id`, `X-Plex-Playback-Session-Id`, `X-Plex-Playback-Id` | analytics ids |

On GET requests, every `X-Plex-*` value goes in the query string (149673-149705). On PUT and DELETE they stay headers. The one exception is when the server reports `allowBlacklistedMethodHeaders`; then they also go in the query string. `Accept-Language` is always a real header.

The app uses two session ids:

- **`X-Plex-Session-Identifier`**: the playback session.
  - Seen: one random value made when the app loads (146398).
  - Inferred: it stays the same for the whole app run.
  - It is sent only on decision, start, timeline and Live TV tune requests.
- **`session`**: the transcode session.
  - Each decision gets a new random value (25650).
  - It is reused only for seeks.

## 2. Starting playback

Driver: the action `makeDecision` (16738-16838), which calls `getPlayerDecision` (25632).

### 2.1 Fetch the item

`GET /library/metadata/{id}` with these params, all `=1`:

- `includeConcerts`, `includeExtras`, `includeOnDeck`, `includePopularLeaves`, `includePreferences`
- `includeChapters`, `includeStations`, `includeMarkers`, `includeExternalMedia`
- `asyncAugmentMetadata`, `checkFiles`

The fetch is skipped if the item was already loaded (13436-13466).

### 2.2 Decide on the client

Desktop device profile, seen at 140276-140297:

```
video: {
  lowestQualityIndex: 2,
  protocols: { http, hls, dash },
  transcodeProtocol: "http",
  directPlay: { 3gpp, asf, avi, mkv, mov, mp4, mpeg, mpegts, rm, wtv }   // containers only, no codec lists
}
```

Desktop options, seen at 139296-139337:

- `subtitlesBurnLevel: NEVER` (the client never burns subtitles into the picture)
- `preferredDirectPlayProtocol: "dash"`
- `canDisplayHDR: true`, `canDisplayDolbyVision: false`
- `allowIncompleteSegments: true`
- `advancedSubtitles: "text"`
- `subtitleSize` from the user setting

These options are merged last, so they override the user's subtitle burn setting.

Direct play is refused only when:

- the Direct Play setting is off;
- the container is not in the list;
- the file's bitrate is above the chosen quality cap (the smaller of the quality setting and the server's `maxUploadBitrate`, 24138-24171);
- the file is missing.

Direct stream needs only its setting on and a bitrate within the cap.

### 2.3 Ask the server: the decision request

`GET /video/:/transcode/universal/decision`, timeout 2 s (25897-25936). The start address is built from the same params.

| Param | Value |
|---|---|
| `hasMDE` | `1` |
| `path` | `/library/metadata/{id}`, or an absolute address with token if the item is on another server |
| `mediaIndex`, `partIndex` | which version and which part |
| `protocol` | `http` |
| `fastSeek` | `1` |
| `directPlay`, `directStream`, `directStreamAudio` | `0`/`1` from the client decision |
| `location` | `lan` on a private connection, else `wan` |
| `offset` | start position in seconds |
| `copyts` | `1` (keep the original timestamps after an offset start) |
| `X-Plex-Chunked` | `1` unless direct play |
| `X-Plex-Incomplete-Segments` | `1` |
| `subtitles` | `none` for direct play, else `auto` |
| `advancedSubtitles` | `text` |
| `subtitleSize`, `audioBoost` | user settings, default 100 / 100 |
| `maxVideoBitrate` | the quality cap in kbps, when one applies |
| `autoAdjustQuality` | `0` on desktop |
| `autoAdjustSubtitle` | `1` only with the owner's subtitle auto-sync feature and the user setting on |
| `mediaBufferSize` | mpv's forward cache in KB, when set |
| `addDebugOverlay` | `0`/`1` |
| `session`, `X-Plex-Session-Identifier` | see section 1 |
| all identity values | section 1 |

What the client does with the response (seen at 25913-25928 and 25632-25639):

- It reads only `generalDecisionCode`, `mdeDecisionCode`, `transcodeDecisionCode` and `abr`.
- Any of those codes at 2000 or above stops playback with an error.
- `generalDecisionCode` 1001 while direct play was planned: it retries once with direct play off.
- It never reads `directPlayDecisionCode`.
- Inferred: it ignores the media details in the response, so the client's own direct play and direct stream flags stand.

If the decision request itself fails, the client goes ahead with its own decision. It also skips the request for cloud servers and for servers older than 1.0.3.

### 2.4 The address given to mpv

- **Direct play** (25817-25824):
  - Address: `{server}{part.key}?X-Plex-Session-Identifier=…&X-Plex-Token=…&{identity}`.
  - There is no `download=1` and no byte-range param.
  - Inferred: mpv makes its own HTTP range requests.
- **Direct stream and transcode**: `{server}/video/:/transcode/universal/start?{same params as the decision}`.
  - Direct stream: `directPlay=0&directStream=1`.
  - Transcode: `directStream=0`.
  - The address has no file extension.

Handover to mpv over QWebChannel (139500-139567):

1. `channel.set("player", {device, rate, volume, subtitleDisplay, subtitleDelay, videoProfile, deinterlacing, exclusiveAudio, hwdec, normalizeDownmix})`
2. `channel.send("player.queue", {url, startPositionSeconds, type, effectiveFrameRate, audio:{index}, subtitle:{index,url,ffIndex,embeddedInVideo,streamIdentifier}, decision:{…}})`
3. `channel.send("player.play")`

Inferred from strings in the native binary:

- The native code runs mpv `loadfile <url> replace`.
- It may pin the host name to an IP address with ffmpeg's `resolve_hosts`.
- It sets no extra HTTP headers, so the token travels only in the address.

### 2.5 When playback fails

Seen at 55851-55879. Each step is a new decision with a new transcode session:

1. Direct play fails: retry with direct play off.
2. Direct stream fails: retry with `directStream=0`.
3. Still failing: retry with `directStreamAudio=0` too.

### 2.6 Keeping a transcode alive, and stopping it

- **Ping** (17842-17853):
  - `GET /video/:/transcode/universal/ping?session={id}` every 30 s, and only while paused.
  - A 404 response restarts playback at the current position.
- **Stop**:
  - There is no transcode stop call anywhere in the bundle.
  - The client only sends the timeline `state=stopped`, and `player.stop` to mpv.
  - Inferred: the server ends the old session once nothing reads it.
- **Several parts**: when one part ends, the next part gets a new decision with `partIndex+1, offset=0` (55907).

## 3. Quality

### 3.1 The quality table

Seen at 25524-25543. `maxVideoBitrate` (kbps) is the only value sent to the server.

| Index | kbps | Resolution | Player menu tag |
|---|---|---|---|
| 0 | 208 | 284x160 | hidden on desktop |
| 1 | 320 | 420x240 | hidden on desktop |
| 2 | 720 | 576x320 | |
| 3 | 1500 | 720x480 | |
| 4 | 2000 | 1280x720 | HD |
| 5 | 3000 | 1280x720 | HD Medium |
| 6 | 4000 | 1280x720 | HD High |
| 7 | 8000 | 1920x1080 | HD |
| 8 | 10000 | 1920x1080 | HD |
| 9 | 12000 | 1920x1080 | HD Medium |
| 10 | 20000 | 1920x1080 | HD High |

Special values: `-1` is Original (labelled "Maximum" in settings), and `-2` is Convert Automatically.

Which entries are offered (25544-25562):

- None if the server cannot transcode video.
- Entries above the server's `maxUploadBitrate` are dropped.
- Entries taller than the source file are dropped.

Player menu order (65059-65113):

1. "Play Original Quality", when the server allows that bitrate and a second test decision at Original passes.
2. "Convert Automatically" (never on desktop).
3. "Convert (Maximum)".
4. The table entries, highest first.

### 3.2 Starting quality

The starting quality comes from function `Il`, 139169-139240.

Which setting applies:

- `localQuality` on a private connection.
- `remoteQuality` otherwise.

Defaults (138104-138111):

- local: Original
- remote: `11`, one past the end of the table
- `remoteSmallVideoAtOriginalQuality`: on

Inferred: with these defaults, remote playback also starts at Original when the file fits under the server's upload limit.

Original is used when either:

- the setting is Original;
- the setting's bitrate is at least the file's bitrate.

Otherwise the client picks the best available entry at or below the setting.

These settings belong to the account and sync through plex.tv (section 7).

### 3.3 Automatic quality

Seen:

- The gate is `canPlayAdaptiveBitrate()`. It returns the opposite of an unnamed function (module 25957) that is hard-coded to return `true` in this build (26077-26098). So desktop never offers automatic quality and always sends `autoAdjustQuality=0`. Inferred: module 25957 is the "running in the desktop app" flag. The settings screens use it to hide desktop-only options.
- In other builds, automatic quality also needs the server's `streamingBrainABRVersion >= 3` (11285). It turns direct play and direct stream off and sends `autoAdjustQuality=1`.
- The client has no throughput measurement, thresholds or timers.
- The timeline response carries `MediaContainer.Bandwidths.Bandwidth[]`, with `time`, `bandwidth` and `resolution` per entry. The menu only shows that figure as "Auto (Now: …)" (17700-17708, 65088-65094).

Inferred: the server does all the adapting.

### 3.4 Changing quality mid-play

Seen at 55995-56020, 16808-16827 and 25648-25651:

1. The client removes the current decision.
2. It makes a new decision at the current position (`offset` = position).
3. The new decision gets a new transcode `session`. `X-Plex-Session-Identifier` stays the same.
4. mpv gets a fresh `player.queue`.
5. No stop is sent for the old transcode, and no timeline is sent for the change.

## 4. Seeking and preview pictures

- **Direct play**:
  - `channel.send("player.seekTo", ms)` (139744-139748).
  - Inferred from native strings: mpv seeks with `absolute+exact` (a frame-exact jump to an absolute time).
- **Transcode** (17885-17898, helper at 17474-17478):
  - The client rewrites only `offset` (in seconds) in the existing start address.
  - The `session` stays the same, and there is no decision request.
  - Inferred: mpv is stopped and given the new address, and the server restarts the transcode inside that session. `copyts=1` keeps timestamps absolute, so the position mpv reports needs no correction.
- **Skip buttons**: back 10 s, forward 30 s. Seeks stop 5 s before the end. There is no debounce on seek-bar drags (21139-21145, 61350).
- **Seekable range while transcoding**: taken from `TranscodeSession.seekStartSeconds` and `seekEndSeconds` in the timeline response (17745-17751).
- **Preview pictures** (61278-61281, 18661-18684):
  - Address: `/library/parts/{partId}/indexes/sd/{ms}`, with ms rounded to the nearest second.
  - It is fetched through `/photo/:/transcode?url=…&width=…&height=…&minSize=1&upscale=1`.
  - The index name (`sd`) is the first entry of the part's `indexes` attribute.
  - The client does not download whole BIF files (BIF: Plex's file of preview pictures).
- **Timeline after a seek**: none is sent straight away. The next 10-second report carries the new position.

## 5. Audio and subtitle tracks

### 5.1 Saving a choice

`PUT /library/parts/{partId}?audioStreamID={id}` or `?subtitleStreamID={id}` (14503-14572):

- Each request carries one stream type.
- "No subtitles" is `subtitleStreamID=0`.
- `allParts=1` applies the choice to every part:
  - always from the pre-play page;
  - from the player only when `partIndex > 0`;
  - needs server 0.9.12.5 or later.
- The client updates the item on screen first, cancels earlier PUTs for the same part, and fetches the item again on success. It rolls back on failure.

### 5.2 Effect on playback

- Decision and start requests never carry stream ids. Inferred: the server uses the saved choice.
- **Direct play**:
  - `channel.set("player", {audio:{index}, subtitle:{…}})` switches inside mpv, with no new decision (139575-139589, 139749-139761).
  - The PUT still runs, to save the choice.
- **Transcode**:
  - The client waits for the PUT to finish.
  - It then makes a new decision at the current position (55825-55845), and mpv reloads.

### 5.3 What mpv receives

Seen at 139836-139925.

**`subtitle.index`**:

- `-1`: no subtitles.
- External file in direct play: its `subIndex`.
- Embedded in direct play: its position among the embedded subtitle tracks, sorted by stream `index`.
- Transcode: always `0`.

**`subtitle.url`** is set only for an external file in direct play:

- Text formats: `{server}{stream.key}?X-Plex-Token=…&encoding=utf-8[&autoAdjustSubtitle=1]`.
- Picture formats (PGS, VobSub): no conversion params. For `idx` files, `.idx` is appended to the key.

**`subtitle.ffIndex`** is the stream's `index` (ffmpeg's track number), for embedded tracks.

**`audio.index`**: the selected track's position among the audio tracks in direct play, `0` when transcoding.

Inferred from native strings: external subtitles are loaded with mpv `sub-add`, and embedded tracks are matched by `ff-index` or `src-id` in mpv's `track-list`.

### 5.4 Burn-in

Desktop never asks for burned-in subtitles:

- The burn setting is hidden on desktop (`chunk-4276` 19785-19795).
- Direct play sends `subtitles=none`, and mpv draws the subtitles itself.
- Transcodes send `subtitles=auto` and leave it to the server's desktop profile.

The browser rules, for comparison (24333-24400):

- PGS, VobSub and EIA-608 burn.
- ASS/SSA burn under "auto".
- Other text formats stay separate when the server supports it.

### 5.5 Default track

- The client follows the server's `selected` flag on the first part. If no subtitle is selected, it picks "None".
- Language preferences are account settings on plex.tv (section 7). Inferred: the server applies them when it sets `selected`.

The client changes these with `PUT /api/v2/user/profile`:

- `autoSelectAudio`
- `defaultAudioLanguage`, `defaultSubtitleLanguage`
- `autoSelectSubtitle`: 0 manual, 1 when the audio is in a foreign language, 2 always
- `defaultSubtitleAccessibility`: hearing-impaired preference, 0-3
- `defaultSubtitleForced`: forced-subtitle preference, 0-3

### 5.6 Related calls

**Subtitle search and download** (18421-18510):

- Search: `GET {item key}/subtitles?language=…&hearingImpaired=…&forced=…`.
- Download: `PUT {item key}/subtitles?key=…&codec=…&language=…&hearingImpaired=…&forced=…&providerTitle=…`.
- Completion arrives as the server event `subtitle.download`. Without an event connection, the client checks the item every 2 s for up to 30 s.

**Subtitle offset**: `PUT {stream.key}?offset={ms}` (18086-18119).

**Audio and subtitle settings**:

- `audioBoost` is 100, or 700 when "Normalize multi-channel audio" is off. It is sent on every transcode.
- Output device, channel layout, passthrough codecs and the AC3 option go only to mpv, never to the server (139790-139797).
- Subtitle colour, position and size go to mpv. Size is also sent to the server.

## 6. Play queues, timeline, played state

### 6.1 Play queues

Every play queue request carries these params (14186-14205):

```
repeat=0|1&own=0|1&includeChapters=1&includeMarkers=1&includeGeolocation=1&includeExternalMedia=1
```

The params go in the query string, with an empty body.

| Action | Request |
|---|---|
| Create | `POST /playQueues?type=video&uri=…[&shuffle=1][&continuous=1][&key=…][&playlistID=…][&extrasPrefixCount=N]` |
| Fetch | `GET /playQueues/{id}` |
| Add at end | `PUT /playQueues/{id}?type=…&uri=…` |
| Play next | the same, plus `next=1` |
| Move | `PUT /playQueues/{id}/items/{playQueueItemID}/move[?after={previous playQueueItemID}]` (no `after` = move to top) |
| Remove | `DELETE /playQueues/{id}/items/{playQueueItemID}` |
| Shuffle / unshuffle | `PUT /playQueues/{id}/shuffle` or `/unshuffle` |
| Repeat | set the flag, then `GET /playQueues/{id}?repeat=1` |

Create params, in more detail:

- `continuous=1` is added for a show, season or episode.
- `extrasPrefixCount` (trailers before a movie) is added only for a movie started from the beginning.

Not used by the client:

- paging params (`window`, `center`, `includeBefore`, `includeAfter`);
- a clear-queue call;
- `includeRelated` and `sendAnalytics` on queue calls.

Inferred: the client takes the server's default window and uses `playQueueTotalCount`.

**`uri` formats** (21657-21825, 13160-13269):

| Source | `uri` |
|---|---|
| One item | `library://{sectionUUID}/item/%2Flibrary%2Fmetadata%2F{ratingKey}` |
| Several items | `library://{uuid}/directory/%2Flibrary%2Fmetadata%2F1%2C2%2C3` |
| Library or filtered view | `library://{uuid}/directory/{encoded /library/sections/{id}/all?…}` |
| Playlist | `playlist:///{encoded guid}` (plus `playlistID`) |
| Other providers | `server://{machineId}/{providerId}{key}` |

Shows and seasons:

- The client first fetches the show with `includeOnDeck=1` and points `uri` at the next episode to watch.
- A season with nothing on deck uses its first unwatched episode, else its first episode.

**Response**:

- Fields kept: `playQueueID`, `playQueueSelectedItemID`, `playQueueSelectedItemOffset`, `playQueueTotalCount`, `playQueueVersion`, `playQueueShuffled`, `allowShuffle`, `playQueueSourceURI`, `playQueueLastAddedItemID`.
- Each item has a `playQueueItemID`.
- The client refetches the queue after the first acknowledged timeline report of each item (17747-17752).
- `playQueueVersion > 1` means the user edited the queue: starting something new asks first (17106).

### 6.2 Timeline

`GET /:/timeline` with header `X-Plex-Session-Identifier` (17644-17686):

| Param | Value |
|---|---|
| `ratingKey`, `key` | item id and `/library/metadata/{id}` |
| `state` | `playing`, `paused`, `buffering` or `stopped` |
| `time`, `duration` | ms; for an item with several parts, `time` includes the earlier parts |
| `playbackTime` | ms actually played |
| `playQueueItemID` | when a server play queue is used |
| `continuing` | `1` with `stopped` when the next item follows |
| `hasMDE` | `1` |
| `streamingMediaId`, `context`, `row`, `col` | analytics |

When it is sent:

- Every 10 s in every state, including paused (17822).
- Straight away when any of these change: pause, buffering, error, duration, or the first progress after loading (55949-56003).
- Item change: `stopped&continuing=1` for the previous item.
- Player closed: `stopped` without `continuing`.

It is sent only to the server that owns the item, never to plex.tv.

What the client reads from the response (17694-17754):

- When `time` is past 60 s, `playbackState` `progress` or `complete` updates the item on screen (`viewOffset`, or watched).
- `terminationCode` stops playback.
- A new `mdeDecisionCode` forces a new decision.

### 6.3 Played and unplayed

- `GET /:/scrobble?identifier=com.plexapp.plugins.library&key={ratingKey}` marks played.
- `GET /:/unscrobble?…` with the same params marks unplayed.
- These work on shows and seasons too (13013-13057).
- The watched threshold is the server's. The client only reflects `playbackState=complete` from the timeline.
- There is no `/:/progress` call. The resume position comes only from the timeline.
- Remove from Continue Watching: `PUT {action path}?ratingKey=…`. The path comes from the server's actions list at run time (141396-141403).

## 7. Preferences

| What | Where | Read | Write |
|---|---|---|---|
| Player settings for the account: quality, subtitles, audio boost, autoplay | plex.tv | `GET /api/v2/user?includeSettings=1&…` | `POST /api/v2/user/settings` (JSON body below) |
| Default audio and subtitle language | plex.tv | the same | `PUT /api/v2/user/profile` |
| Device settings: direct play, direct stream, volume, restored play queue | local storage, kept by the native side | `channel.storage.getItem` | `storage.setItem` |
| mpv settings: hardware decoding, cache size, audio device and passthrough, refresh-rate switching, video profile | native `plex.ini` | `channel.get("player", […])` at start | `channel.set(section, {key: value})` |
| Server settings | the server | `GET /:/prefs` | `PUT /:/prefs?{id}={value}&…`, all changes in one call |

Body of the plex.tv settings write (42009-42019, 42530):

```
POST /api/v2/user/settings?sharedSettings=0
Content-Type: application/json
{"value":"[{\"id\":\"experience\",\"type\":\"json\",\"value\":\"{…only non-default settings…}\",\"hidden\":true}]"}
```

The write is skipped when signed out, or when plex.tv holds a settings schema newer than the client's version 12 (138147-138175).

Playback settings in that `experience` object, with defaults (138098-138118):

- `localQuality` (Original), `remoteQuality` (11)
- `autoAdjustQuality` (false)
- `remoteSmallVideoAtOriginalQuality` (true)
- `useHomeStreamingRecommendedSettings` (true)
- `subtitlesBurnLevel` (auto), `subtitleSize` (100), `subtitleColor`, `subtitlePosition`
- `autoSyncSubtitles` (true)
- `audioBoost`, `audioForceMultiChannel`
- `extrasPrefixCount` (0), `autoPlay` (true)

## How to check these findings

The cited lines are in Prettier 3.3.3 output, `--parser babel --print-width 120`, of these files:

- `main`: `Contents/Resources/web-client/js/main-8792-e90a21a5fe7ae941e8eb-plex-4.160.0-75ddd7b.js` (160,515 lines once formatted).
- `chunk-4276`: `chunk-4276-b193a1d0a5575666c24f-plex-4.160.0-75ddd7b.js`, the settings screens.

To regenerate, copy both files out of `/Applications/Plex.app` and run Prettier on the copies. A newer Plex.app moves the line numbers. Search for the quoted strings instead (`transcode/universal`, `player.queue`, `/:/timeline`, `playQueues`).

## Not found or not confirmed

- **The server's "Plex Desktop" profile.** It decides codecs and subtitle burn-in under `subtitles=auto`, but no profile file ships in Plex.app. Transcode behaviour for codecs the server considers unsupported can only be learned from a live session.
- **Whether `PUT /library/parts` saves the choice per user or for everyone.**
- **The exact mpv commands.** Only names like `loadfile`, `sub-add`, `ff-index` and `resolve_hosts` appear as strings, not the full commands.
- **Whether native code changes the address before mpv loads it.** No `http-header-fields` or user-agent string was found.
- **What `streamIdentifier` in the subtitle handover does.**
- **The server's automatic-quality thresholds.** None are in the client.

A live capture of the app's traffic during one direct play (no transcoding, so no load on the slot) would confirm sections 2 and 6.
