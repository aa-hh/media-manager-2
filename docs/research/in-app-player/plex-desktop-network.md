# How the Plex desktop app talks to Plex Media Server during playback

27 Oct 2026. Static reading of the official Plex app for Mac, version 1.115.0 (`tv.plex.desktop`). Nothing was run and no server was contacted.

The app is a Qt shell around three parts:

- **Plex Web 4.160.0**, a JavaScript app in `Contents/Resources/web-client/`. It makes every playback request to the server.
- **libmpv**, the mpv player as a library. It plays the stream address it is given.
- **QWebChannel**, Qt's bridge between the web page and the native code. The web page uses it to control mpv.

Each claim is marked:

- **Seen**: read in the code. Line numbers are cited.
- **Inferred**: reasoned from the code but not directly read.

## Contents

- "Playback from start to finish, as Plex runs it": the full order of calls.
- "Recommended way to run the calls in your client": suggestions for our player.
- Sections 1-7: each call in detail.
- Section 8: choosing the server address.
- Section 9: how mpv fetches the video.
- Section 10: intro and credits skip.

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

## Playback from start to finish, as Plex runs it

Seen. Each step waits for the one before it unless marked otherwise.

**Before any playback, at app start** (section 8):

1. `GET https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1` returns each server's addresses and its own token.
2. Every direct address is tested at the same time, at most 5 at once, with a 10 s timeout.
   - A relay address (traffic passed through Plex's own servers) is tested only after every direct one fails.
   - Each success re-ranks the addresses. Order: direct, then this computer, then the local network, then https.
3. All later requests, including the video stream, use the best address at that moment.

**Pressing Play:**

1. If the item has a saved position, ask whether to resume. No network request.
2. `POST /playQueues?type=video&uri=…` creates the play queue (section 6.1). Nothing else starts until it returns.
3. `GET /library/metadata/{id}?checkFiles=1&includeMarkers=1&includeChapters=1&…` fetches the item (section 2.1). It is skipped if the item was already fetched.
4. The client picks direct play, direct stream or transcode on its own. No network request (section 2.2).
5. `GET /video/:/transcode/universal/decision?…` (section 2.3).
   - Timeout 2 s.
   - If it fails or times out, the client goes ahead with its own choice.
6. mpv gets the stream address through `player.queue`. The native code runs `loadfile <url> replace`, paused (section 9).
7. mpv's `on_preloaded` hook picks the video, audio and subtitle tracks and switches the display mode. Then playback starts.

**While playing:**

- `GET /:/timeline` every 10 s, and straight away on pause, buffering, error or duration change (section 6.2).
- Transcode only: `GET /video/:/transcode/universal/ping` every 30 s, only while paused.
- Seek:
  - direct play: mpv seeks inside the file;
  - transcode: the same start address with a new `offset`, and mpv reloads.
- Track change: `PUT /library/parts/{id}`, then either an mpv track switch (direct play) or a new decision (transcode).
- Quality change: a new decision and a new transcode session at the current position.
- Skip Intro or Skip Credits: an ordinary seek to the end of the marker. The markers came with the item fetch, so no request is made (section 10).

**Next item:**

- `GET /:/timeline?state=stopped&continuing=1` for the finished item, then steps 3-7 for the next one.
- The next decision is made early only when less than 10 s remain and no post-play screen will show (`preFetchSeconds: 10`, `makeNextDecision`, 55996-56000, 56184). The post-play screen shows for any video of 300 s or more, so episodes and movies get no early decision.
- One decision is kept per play-queue item and reused if that item comes back (16753-16754).

**Errors:**

- When mpv reports an error, the client steps down: direct play, then direct stream, then transcode, then transcode with audio too. Each step is a new decision at the current position (55851-55879).
- When nothing is left, playback pauses with a Retry button.
- No step retries the same address. Moving to a different server address happens only if a re-test has already switched it (section 8.3).

## Recommended way to run the calls in your client

These are my suggestions, not observed Plex behaviour. They combine the findings with this project's setup: one remote Plex server on the Whatbox slot, an Electron app, stock mpv.

1. **Copy the request shape exactly.**
   - Send `X-Plex-Client-Profile-Name: Plex Desktop`, `protocol=http`, `copyts=1`, `X-Plex-Chunked=1`, `X-Plex-Incomplete-Segments=1`, `fastSeek=1`, `hasMDE=1`, and the subtitle values from section 2.3.
   - Reason: the server's built-in "Plex Desktop" profile is then the one tested against mpv. A home-made profile risks transcodes Plex never tests.
2. **Overlap where Plex waits.**
   - The play queue request (step 2) and the item fetch (step 3) need nothing from each other, so send them together.
   - Fetch the next item's details and decision during the last minute of the current one.
   - Plex does neither for videos of 300 s or more. Its early decision runs only in the last 10 s of shorter items. Both changes shorten the wait before a picture appears.
3. **Keep the 2 s decision timeout and the go-ahead on failure.** The decision only confirms what the client already chose. A slow server shouldn't block direct play.
4. **Set the network options Plex leaves at mpv defaults.**
   - `network-timeout=15`.
   - For direct play: `stream-lavf-o=reconnect=1,reconnect_on_network_error=1,reconnect_delay_max=5`. A direct-play file supports byte-range requests, so a reconnect picks up where it dropped.
   - A bigger forward buffer, for example `demuxer-max-bytes=512MiB`. On 14 Oct, Hereditary (a 76 Mbps remux) held only 15 s with mpv's default 150 MB.
   - Tune these numbers with your own tests.
5. **Recover a transcode by restarting it at the current position, not by reconnecting.**
   - The chunked transcode stream can't be resumed partway through.
   - On an mpv error during a transcode: rewrite `offset` to the current position and reload, the same as Plex's seek. Only make a new decision if that fails.
6. **Stop transcodes you abandon.**
   - Plex never stops them, which leaves the server converting until it notices nobody is reading. On a shared slot that wastes CPU.
   - Call `GET /video/:/transcode/universal/stop?session={id}` instead. The Plex server bundled in the app (`Frameworks/PlexMediaServer.framework`) contains that path as the format string `/video/:/transcode/universal/stop?session=%s`, next to `/transcode/sessions/%s`, but this client never calls it. Test it once on a short file before relying on it.
7. **Re-test server addresses before retrying playback.**
   - On a playback error or a network change, re-test the addresses first (step 2 of app start), then build the new stream address.
   - Plex re-tests only on network events, websocket loss and 401 responses, so a retry can reuse a dead address.
8. **`plex.direct` address lookups.**
   - Plex pins the IP address with `resolve_hosts`, an option that exists only in Plex's own FFmpeg build. Stock mpv doesn't have it.
   - The 14 Oct mpv test played fine over the slot's `plex.direct` address, so normal DNS works there.
   - If DNS ever fails, resolve the address yourself and use the IP-based address, accepting that the certificate check won't match.
9. **Leave timeline, scrobble, play-queue edits and track saving as Plex does them.** The server's watched rules, Continue Watching and other Plex apps all depend on those calls looking the same.

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

What the native code does with that address is in section 9.

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

## 8. Choosing the server address

Seen unless marked. Desktop settings at 133706-133721, merged over the defaults at 7390-7425.

### 8.1 Where the addresses come from

- **From plex.tv** (10449-10455):
  - `GET https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1`, with `Accept: application/json` and the identity values from section 1, including the plex.tv token.
  - Each server comes with its own `accessToken`, `publicAddressMatches`, `httpsRequired` and a `connections` list. Each connection has `uri, scheme, address, port, relay` (1455, 10651).
- **From what's already known, at app start** (152113-152161):
  - Servers saved from last time, with relay addresses removed (152130).
  - `http://127.0.0.1:32400`, the local machine (152160).
  - After any successful test on the local network, `http://127.0.0.1:{port}` is added too (11617-11624).
- **Not used:** Plex's local network broadcast discovery (GDM). Searched `239.0.0.250`, `32414` and `M-SEARCH` in the JavaScript and the binary; none found.

### 8.2 Testing and ranking

- **The test request** (133959-134104):
  - `GET {connection}/media/providers` with a 10 s timeout (11112). Servers older than the `mediaProvidersServerRoot` version also get `GET /` at the same time.
  - Status 200 or 404 passes.
  - The response's `machineIdentifier` must match the server's.
  - 401, 403 and 406 mark the connection unauthorized. Anything else marks it unavailable.
  - After 3 s with no answer the screen shows a loading state (`uiTimeout`, 11113).
- **Order** (135005-135130):
  - One queue runs at most 5 tests at a time (7405).
  - Direct addresses are queued before relay. Untested before tested. Addresses matching the network you're on come first.
  - Relay addresses are tested only after every direct one has failed (11428-11439, 11644).
- **Picking the winner** (10566-10579, 11610):
  - Every success re-ranks the addresses, so a better one replaces a quicker one.
  - Ranking: not relay, then this computer, then the local network, then https. Plain http on the local network beats https over the internet.
- **Settings that skip tests:**
  - `preferInsecureConnections`, desktop default `never`: can skip https tests.
  - `rejectDirectConnections`, default off: turned on, only relay is tested.
  - `allowHttpFallback`, default `never`: can add a plain http copy of a failed https address.

### 8.3 Re-testing

Every connection is tested again when:

- the system goes online or offline (after 2 s);
- the server's event websocket closes or errors;
- any request gets a 401;
- the token changes, `publicAddressMatches` changes, or a connection is added (134425-134600).

Other re-testing rules:

- An unreachable server is retried after 2, 4, 6 … seconds, up to 30 s apart.
- There is no timer for a server that is already connected, and focusing the window does nothing.

During playback:

- Nothing in the player watches the active connection.
- Inferred: the stream address is fixed when the decision is made (16865), so mpv keeps using it.
- The error steps in "Playback from start to finish" build the next address from the active connection at that moment.

### 8.4 Tokens, relay, timeouts

- **Tokens.** Each server uses its own `accessToken` from plex.tv. Stream addresses carry it as `X-Plex-Token` (25823). The plex.tv token goes only to plex.tv.
- **Same address for everything.** Metadata and the stream use the same active connection. A different server transcodes only if the item's server has no transcoder (25708-25716).
- **Relay cap.** The client sets no relay limit of its own. It follows the server's `maxUploadBitrate` (11201-11203).
  - The requested bitrate and the quality list are capped at that value.
  - When `maxUploadBitrateReason` is `relay`, the app says qualities are limited by an indirect connection (24447-24457).
- **Timeouts:**
  - ordinary requests: 30 s, or 60 s with `checkFiles=1` (5849, 112722);
  - decision: 2 s;
  - connection test: 10 s.
- **Retries.** Ordinary requests are never retried automatically.

## 9. How mpv fetches the video

From the native binary `Contents/MacOS/Plex`. The arm64 slice was decompiled with Ghidra (symbols intact), and the main points were re-checked against the decompiled output and the bundled libraries. Addresses are arm64.

- **Options set before every file** (`MPVEngine::setupMPVParams`):
  - `demuxer-lavf-probe-info=yes`, `demuxer-mkv-probe-start-time=no`, `demuxer-seekable-cache=yes`
  - `tls-verify=yes`, with `tls-ca-file` pointing at `PlexMediaServer.framework/Versions/A/Resources/cacert.pem`
  - `pause=yes` (files load paused)
  - `sub-create-cc-track=yes`, `vo=libmpv`, `gpu-hwdec-interop=auto`
- **Loading:**
  - Start position is the global option `start=+{seconds}`, set before `["loadfile", url, "replace", 0, {per-file options}]`.
  - The `on_preloaded` hook picks the video, audio and subtitle tracks, sets the display mode, then unpauses.
- **`plex.direct` addresses** (`doQueue` 0x100057874, `URL::ConvertPlexDirectURL` 0x1000d8a08):
  - The IP address is read from the first part of the host name. `1-2-3-4.{hash}.plex.direct` gives `1.2.3.4`; seven dashes means IPv6.
  - It is passed as the per-file option `stream-lavf-o=resolve_hosts=[{host}:{ip}]`.
  - `resolve_hosts` is a Plex addition to its own FFmpeg build (found in `libavformat.59.dylib`).
  - Inferred: this skips DNS, which some routers block for addresses inside the home network, while the certificate still matches `*.plex.direct`.
- **Buffer:**
  - The web side's `forwardCacheSize` and `backwardCacheSize` become `demuxer-max-bytes` and `demuxer-max-back-bytes`, in bytes (`MPVEngine::doSet` 0x100054d04).
  - The app never sets a default, so mpv's own apply (150 MiB ahead, 50 MiB behind).
  - It reads the real value back and reports it to the web side, which sends it as `mediaBufferSize`.
- **Not set anywhere:** `network-timeout`, `cache-secs`, `cache-pause`, `demuxer-readahead-secs`, `user-agent`, `http-header-fields`, and every `reconnect*` option. The token travels only in the address.
- **Seek:** `["seek", seconds, "absolute+exact"]` (`doSeekTo` 0x1000590f4).
- **Subtitles** (`selectSubtitleStream` 0x10005284c):
  - The previous external file is removed with `sub-remove`, and a new one added with `["sub-add", url, "cached"]`.
  - `sid` is then chosen by `src-id` = `streamIdentifier`, then `ff-index` = `ffIndex`, then an EIA-608 caption track.
- **Errors** (`processMPVEvents` 0x100059908):
  - An mpv end-of-file with an error is passed to the web side as `onError(code)`.
  - `paused-for-cache` is passed on as `onBuffering`.
  - The native code never retries, reconnects or watches for stalls. Recovery is the web side's error steps.
- **`videoProfile`** changes only the picture scaling and HDR peak detection (table at 0x10006e5f0), never the network:
  - `low`: bilinear;
  - `normal` (default): spline36;
  - `high`: spline36/mitchell with debanding;
  - `maximum`: ewa_lanczossharp.
- **User `mpv.conf`.** Per the shipped `mpv.conf.md`, a user `mpv.conf` in the app's data folder is read before each playback. So the options above that Plex leaves unset can be added there.
- **The built-in server** (`NanoServerManager`). The app bundles a full Plex Media Server library that listens on `127.0.0.1`, from port 32700 up. The native player never rewrites stream addresses to it.

## 10. Intro and credits skip

Seen unless marked. This adds to [plex-playback-features.md section 2](plex-playback-features.md#2-skip-intro-skip-credits-skip-recaps), which covers the marker data on the slot and our own design.

### 10.1 Where the skip times come from

No extra request is made. Markers arrive as `Marker[]` on the item, from requests that already send `includeMarkers=1`:

- the item fetch at playback start (13449);
- every play queue request (14196);
- the detail page (36980).

There is no refetch mid-play and none when markers are missing.

The client reads only `type`, `startTimeOffset` and `endTimeOffset`, in milliseconds (9490-9497). It never reads `id`, `version` or `final`. The marker is identified by `type:startTimeOffset:endTimeOffset` (58350).

Types (55498-55500, 59053):

- `intro` gives "Skip Intro";
- `credits` gives "Skip Credits";
- `commercial` gives "Skip Ads";
- `recaps` gives "Skip Recaps".

### 10.2 What turns the button on

Account feature flags from plex.tv, not settings (21591-21592, 66654-66677):

- Intro needs `intro-markers`.
- Credits on library items need `credits-markers`.
- Commercials need no flag.

The check:

- On every whole-second change of the playback position, the client takes the first marker in array order with `startTimeOffset <= position ms < endTimeOffset`.
- There is no separate timer and no early warning before a marker starts.

When the button shows (58985-59061, 66352-66503):

- It shows while the position is inside the marker.
- It closes at `endTimeOffset`, or within 500 ms of it after a press.
- When the player controls are hidden, it fades after 10 s. Moving the mouse brings it back while still inside the marker.
- After the controls have hidden twice during one marker, it stays hidden whenever the controls are.
- It shows only in the full-size player. It doesn't show while loading, on the post-play screen or during an ad.

### 10.3 Pressing Skip

- It seeks to `Math.round(endTimeOffset / 1000)` seconds through the ordinary seek action (59000, 17877-17883):
  - direct play: `player.seekTo`;
  - transcode: an `offset` rewrite and reload (section 4).
- No extra request or analytics.
- Skip Credits is the same seek. It never jumps to Up Next on its own.
- Up Next only runs when playback ends (`onEnd`, 55881-55924). For a video of at least 300 s it fetches `GET /hubs/metadata/{id}/postplay` and shows the post-play screen. Otherwise it plays the next item straight away.

### 10.4 Automatic skip

This build has none. The bundle and the native binary contain no automatic-skip code or setting: `autoSkip`, `skipIntro` and `skipCredits` all return nothing. The native binary has no marker code at all.

The settings proposed for our player in plex-playback-features.md (off / button / automatic, once per marker) are our own design, not copied from this client.

## How to check these findings

The cited lines are in Prettier 3.3.3 output, `--parser babel --print-width 120`, of these files:

- `main`: `Contents/Resources/web-client/js/main-8792-e90a21a5fe7ae941e8eb-plex-4.160.0-75ddd7b.js` (160,515 lines once formatted).
- `chunk-4276`: `chunk-4276-b193a1d0a5575666c24f-plex-4.160.0-75ddd7b.js`, the settings screens.

To regenerate, copy both files out of `/Applications/Plex.app` and run Prettier on the copies. A newer Plex.app moves the line numbers. Search for the quoted strings instead (`transcode/universal`, `player.queue`, `/:/timeline`, `playQueues`).

## Not found or not confirmed

- **The server's "Plex Desktop" profile.** It decides codecs and subtitle burn-in under `subtitles=auto`, but no profile file ships in Plex.app. Transcode behaviour for codecs the server considers unsupported can only be learned from a live session.
- **Whether `PUT /library/parts` saves the choice per user or for everyone.**
- **The server's automatic-quality thresholds.** None are in the client.
- **Default reconnect values in Plex's FFmpeg build.** Only the option names were confirmed.
- **What the web side does with the built-in server on port 32700**, for example for downloaded items.
- **Whether `/video/:/transcode/universal/stop` behaves as its name says.** Only the string was found.

A live capture of the app's traffic during one direct play (no transcoding, so no load on the slot) would confirm the sequence and sections 2 and 6.
