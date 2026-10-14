# What Plax shows about talking to Plex

Researched 14 Oct 2026. Builds on [README.md](README.md) (Decision section), [plex-watch-status.md](plex-watch-status.md), [plex-playback-features.md](plex-playback-features.md), [media-servers.md](media-servers.md) and [player-stack.md](player-stack.md).

Source: [github.com/aa-hh/Plax](https://github.com/aa-hh/Plax), the owner's Plex client for LG webOS TVs, read at commit `a5751bf` (20 Sep 2026). Nothing was installed or run. References are `file:line` inside Plax.

Words used below:
- **Direct play**: the player fetches the original file as stored. No work on the server.
- **Direct stream**: the server copies the video untouched and repackages it or converts only the audio. Plax's code also calls this "remux". Light work.
- **Transcode**: the server re-encodes the video. Heavy work on the slot's shared processor.
- **`/decision`**: `GET /video/:/transcode/universal/decision`, where the player tells the Plex server what it can play and the server answers direct play, direct stream or transcode.
- **Client profile**: the server's list of what a player can play. A player picks a built-in one with `X-Plex-Client-Profile-Name` and edits it with `X-Plex-Client-Profile-Extra`.
- **`resourceSession`**: the id the server returns from `/decision` for the session it created.

## Short answer

- Most of Plax's Plex code exists because the TV can't play MKV, DTS, PGS subtitles or most Dolby Vision files. mpv plays all of them, so for Original quality our player needs only the file address, the token, timeline calls and the subtitle and audio choice. Plax's 88-second embedded-subtitle extraction does not apply to us.
- The lower-quality path (our quality setting) is where Plax helps most. It records, with server-log evidence, which `/decision` and `start.m3u8` shapes the server rejects with HTTP 400 and why. This answers much of the "unexplained 400" risk in [player-stack.md](player-stack.md).
- Plax was debugged against a Plex server on Whatbox (commits `23e4681`, `7fa6093`, `d77d15c`; `src/playback/playbackFallback.js:15-19`). Whether it was the same slot is unverified. Its Whatbox findings are the closest thing we have to transcode tests on the slot.
- Two Plax bugs line up with traps our research already found: it looks for credits markers with type `credit` (the slot returns `credits`), and it tells markers apart by `id` (every marker on the slot has the same id). Do not copy that code unchanged.
- Plax uses no play queues, no live updates, no transcode keep-alive or stop calls, and never sends `X-Plex-Pms-Api-Version`. It neither confirms nor contradicts our research on those.
- Plax is plain JavaScript (old-browser style: `var`, no classes), public on GitHub, with no licence file and no `license` field in `package.json`. The owner wrote it, so reuse is his call. About ten small pure modules port to TypeScript cleanly (section 8).

## 1. Sign-in, headers and finding the server

**Headers on every request** (`src/plex/clientIdentity.js:153-169`, `src/plex/client.js:29-39`):
`X-Plex-Client-Identifier`, `X-Plex-Product`, `X-Plex-Version`, `X-Plex-Platform`, `X-Plex-Platform-Version`, `X-Plex-Device`, `X-Plex-Model`, `X-Plex-Device-Name`, `X-Plex-Device-Vendor` (TV only), `X-Plex-Token`, `Accept`.

- **Client identifier**: made once as `plax-<random><time>` and kept in local storage (`src/ui/screens/pairingScreen.js:8-14`).
- **Product and platform**: Plax does not call itself Plax to the server. On a real TV it sends `Plex for LG` / `webOS`; in a browser or the simulator it sends `Plex Web` / `Chrome` / `Computer` (`src/plex/clientIdentity.js:9-14`, `:92-131`). Commit `51b94c4`: the server "could not match TranscodeUniversalRequest" when Plax sent its own platform name with an empty version. Commit `a9b02cd`: the server has no profile for the simulator's model name. The name `Plax` appears only on the plex.tv sign-in page (`src/plex/auth/pinAuth.js:46-50`). Because `plexHeaders()` is used for the PIN calls too, Plax shows in the account's device list as Plex for LG.
- **Token**: the active Plex Home user's token, else the account token (`src/plex/client.js:23-27`). Per-server calls use the server's own `accessToken` from plex.tv when present, which overrides the account token (`src/plex/client.js:59-65`, `:120-122`). Tokens are stripped from every logged address (`src/plex/client.js:165-176`).
- **Where the token goes**: in a header for `fetch` calls, in the query string for anything handed to the `<video>` element, which can't send headers (`src/plex/client.js:41-52`). The query form adds every `X-Plex-*` identity field too, which some transcode addresses reject (section 7).
- **API version header**: never sent. No match for `X-Plex-Pms-Api-Version` in `src/`. Every Plax request runs as API version 0.0. Plax asks for XML from the server (`Accept: application/xml`, `src/plex/client.js:91-105`) and JSON from plex.tv.

**Sign-in** (`src/plex/auth/pinAuth.js`):
- `POST https://plex.tv/api/v2/pins` with `{"strong": false}` for a 4-character code the user types at plex.tv/link (`:5-15`). A strong PIN is a long code meant for the QR flow.
- Poll `GET /api/v2/pins/{id}` every 2 s, up to 120 times (4 minutes), until `authToken` appears (`:23-44`).
- `GET /api/v2/user` to read the account (`:56-60`).
- This is the older long-lived token, not the JWT sign-in the spec now recommends ([media-servers.md](media-servers.md), "Sign-in and connections").

**Finding the server** (`src/plex/servers/discovery.js`, `connectionPolicy.js`):
- `GET https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1`, 15 s timeout, one retry after 400 to 600 ms on a network or 5xx error (`discovery.js:52-77`). Keeps entries that provide `server` (`:14-50`).
- Ranks the addresses: HTTPS before HTTP, local before remote before relay. Plain HTTP is heavily penalised unless the user turns on "allow insecure" (`connectionPolicy.js:21-40`).
- Probes each address in order with `GET /identity`, not `/`, because a reverse proxy may serve a web page at the root and fail an HTTPS plex.direct candidate (`discovery.js:145-179`). Timeout 15 s for remote HTTPS, 8 s otherwise (`:105-108`).
- Tries the server's `accessToken` first, then the account token (`:79-92`, `:197-226`).
- With several servers, prefers owned ones (`:284-312`).

## 2. Direct play, direct stream and transcode

### How Plax decides

1. Before asking the server, a local check of the file against the TV's abilities sets `forceTranscode` when the TV can neither direct play nor direct stream it (`src/playback/hubDirectPlay.js:63-90`).
2. Plax always calls `/decision`, even for files it expects to direct play (`src/backends/plex/playback.js:438-559`). The first call is hopeful: `directPlay=1&directStream=1&directStreamAudio=1`. The one exception is a lower-quality pick, which sends all three as `0` (`:412-433`).
3. It reads the reply's `Part@decision`: `directplay` means direct play, `copy` means direct stream, anything else is a transcode (`src/playback/parseTranscodeDecision.js:150-155`). It also reads `resourceSession`, each `Stream@decision`, `burn` and `decisionText`, and logs which track blocked direct play and why (`parseTranscodeDecision.js:30-47`, `src/backends/plex/playback.js:453-504`).
4. If the user picked a lower quality and the server still says direct play or copy, Plax forces a transcode (`playback.js:364-377`).
5. If `/decision` fails with 400, it retries once with all three flags at `0`. If that fails too, it falls through to a transcode over plain HTTP rather than stopping (`playback.js:506-558`).

### Addresses it builds

- **Direct play**: the part's `key` from the metadata, with any query string cut off, plus the token and identity in the query: `{server}/library/parts/{partId}/{changestamp}/{file}?X-Plex-Token=…` (`playback.js:561-564`, `src/playback/plexPaths.js:6-23`). Part keys sometimes carry `checkFiles`, `offset` or a session id in their query; those must be removed (commit `d137492`).
- **`/decision` query**: only an allowed list of keys, copied from plex-for-kodi (`src/playback/transcodeDecision.js:3-32`): `path`, `mediaIndex`, `partIndex`, `hasMDE`, `directPlay`, `mediaBufferSize`, `session`, subtitle keys, `location`, `offset`, `maxVideoBitrate`, `videoResolution`, `protocol`. The comment says a remote server returns a bare 400 when `/decision` carries the streaming-only flags (`directStream`, `fastSeek`, `X-Plex-Incomplete-Segments`, `autoAdjustQuality`).
- **`/decision` headers**: identity and token, `X-Plex-Session-Identifier` set to the client identifier (not the playback session), `X-Plex-Client-Profile-Name: Generic`, and the profile edits in `X-Plex-Client-Profile-Extra` (`playback.js:321-340`).
- **`path=`**: always the server-relative `/library/metadata/{ratingKey}`, never a full URL. The server fetches this path from itself; a public address there makes it fail (`src/playback/tracks/subtitleTracks.js:209-218`).
- **`session=`**: a 24-character random id made by Plax (`playback.js:80-88`, `:185-195`).
- **Transcode start**: `GET /video/:/transcode/universal/start.m3u8` with `session` and `transcodeSessionId` set to the `resourceSession` the server returned. Plax refuses to start if `/decision` returned none (`playback.js:197-222`, `:124-182`, `:308-315`). Other parameters: `fastSeek=1`, `hasMDE=1`, `autoAdjustQuality=0`, `mediaBufferSize=102400`, `location`, `offset` (whole seconds), `maxVideoBitrate`, `videoResolution`, `audioStreamID`, `protocol=hls`, `X-Plex-Incomplete-Segments=1` (`src/playback/hlsPolicy.js:92-97`).
- Plax never builds `start.mpd` (DASH). All its transcodes are HLS.

### Client profile edits

`src/playback/deviceProfile.js` builds `X-Plex-Client-Profile-Extra` from these commands joined by `+` (grammar at `:8-14`):
- `add-direct-play-profile(type=videoProfile&container=…&videoCodec=…&audioCodec=…&subtitleCodec=…)` (`:71-94`).
- `add-direct-play-profile(type=subtitleProfile&codec=…)` plus `add-transcode-target(type=subtitleProfile&protocol=http&context=all&subtitleCodec=srt&container=srt)`. The comment says the server refuses subtitle extraction without that second target (`:96-114`).
- `add-transcode-target(type=videoProfile&context=streaming&protocol=hls&container=mpegts&videoCodec=h264&audioCodec=aac,ac3,mp3)` for full transcodes (`:188-221`).
- `add-transcode-target-audio-codec(…&audioCodec=<source>&transcodeCodec=<target>)`: DTS-HD and TrueHD to AC-3, FLAC and Opus to AAC (`:243-252`).
- `add-limitation(scope=videoCodec&scopeName=<codec>&type=upperBound&name=video.bitrate&value=…&replace=true)`. The comment says the older form without `scopeName`, `type` and `replace` "is silently ignored by modern PMS" (`:154-163`).
- Commit `5a66ce5`: without any `add-transcode-target`, `/decision` returned 200 with an empty reply and code 4005 "No conversion profile found for protocol http", and `start.m3u8` then failed with 400.

### Formats the TV can't play

- MKV with Dolby Vision is sent as a direct stream to MP4 over plain HTTP (`playback.js:224-233`, `:726-731`).
- On webOS 4, HLS with fMP4 segments made the server list a `/base/header` start segment that returned 404, so Plax uses MPEG-TS segments for transcodes (`playback.js:251-262`, `hlsPolicy.js:74-83`).
- On webOS 4, a transcode over plain HTTP (`protocol=http`) came back as 200 with an empty body (`playback.js:689-699`, `:716-718`). Plax's subtitle notes say progressive `/universal/start` is "broken on many `plex.direct` proxies" (`docs/plex-subtitle-transcode.md:18`).

### Range requests

Plax never sets a `Range` header itself. Direct play hands the address to the TV's `<video>` element, which asks for byte ranges on its own. mpv does the same.

### Quality options and "Auto"

- The list matches Plex Web, Plezy and our [player-stack.md](player-stack.md) list: Original; 1080p at 20, 12, 10, 8 Mbps; 720p at 4, 3, 2 Mbps; 480p at 1.5 Mbps; 720 and 320 kbps (`src/playback/qualityProfiles.js:14-40`).
- "Auto" is not Plex's automatic quality. Plax always sends `autoAdjustQuality=0` (`playback.js:139`), and `auto` is kept only as an old setting name that now means Original (`qualityProfiles.js:43`). Plax's README still describes an Auto mode; it is out of date.
- What Plax does instead: on an error it walks direct play, then direct stream, then transcode, then plain-HTTP transcode (`src/playback/playbackFallback.js:1-80`), and on repeated buffering it steps down one preset (`qualityProfiles.js:83-88`).
- **Original over a remote connection**: with no `maxVideoBitrate`, a remote server applies a low default and refuses direct play with `directPlayDecisionCode` 3000. Plax sends the file's own bitrate times 1.1, or 2,000,000 kbps if unknown, mirroring Plex Web's "Maximum" (`qualityProfiles.js:125-152`).
- **A lower quality must send `directPlay=0` on `/decision`**: with `directPlay=1` the server ignores the bitrate cap, answers direct play, creates no transcode session, and `start.m3u8` then fails with 400 (commit `3c13044`, `playback.js:412-433`).
- Changing quality, audio or a burned-in subtitle restarts playback at the current position with a new `/decision` (`src/ui/screens/playerScreen.js:1383-1459`).

## 3. Subtitles and audio

### Listing

- Streams come from the item's `Media > Part > Stream`, `streamType` 2 for audio and 3 for subtitles (`src/playback/tracks/audioTracks.js:3-15`, `subtitleTracks.js:27-54`).
- Each subtitle is sorted into image-based (PGS, VobSub), "on demand" (`transient` or `providerTitle`, downloaded by Plex), embedded (`location` of `embedded` or `internal`), or a separate file (`external`, `sidecar`, `downloaded`) (`subtitleTracks.js:16-25`).
- Menu label: title, then "(Forced)" or "(SDH)", the format (SRT, ASS, PGS…) and "Embedded" or "External" (`subtitleTracks.js:60-107`).

### Choosing

- `PUT /library/parts/{partId}?subtitleStreamID={id}&allParts=1` before playback, only when a subtitle is chosen (`subtitleTracks.js:230-263`, `playback.js:677-683`). Plax never sends `subtitleStreamID=0` to turn subtitles off on the server.
- Audio is never written with that `PUT`. The chosen `audioStreamID` goes on `/decision` and `start`, and changing it restarts playback (`audioTracks.js:17-20`, `playerScreen.js:1384-1393`).

### Embedded, separate file, burned in

- **Never let the server choose subtitles.** With no subtitle selected Plax sends `subtitles=none`. Leaving it out lets the server pick a forced subtitle and burn it in, which forces a full transcode (`playback.js:291-299`, commit `428a536`). This was the root cause of Plax's first "why is everything transcoding" bug.
- **Text subtitle on**: `subtitles=sidecar` on webOS 4 (keeps direct play and lets the server extract the subtitle on the same session), `subtitles=auto` on newer TVs (`playback.js:267-280`).
- **Separate subtitle file**: `GET /library/streams/{id}.{ext}?encoding=utf-8&format=srt` (`subtitleTracks.js:265-294`). Fast.
- **Embedded subtitle during direct play** (the TV can't read it from the MKV):
  - If the stream has a `key`, Plex already extracted it during analysis; `/library/streams/{key}.srt` returns it in 2 to 5 s (`subtitleTracks.js:632-645`).
  - Without a `key`, `/library/streams/{id}.srt` answers 501 "not a sidecar subtitle" forever (commit `9424712`).
  - The working call, copied from the official Plex for LG app's requests in the server log: `GET /subtitles/:/transcode/universal/start?path=/library/metadata/{id}&protocol=http&directPlay=1&directStream=1&directStreamAudio=1&subtitles=sidecar&copyts=1&offset={s}&session={same session as /decision}…` (`subtitleTracks.js:409-519`). It takes about 60 to 88 s (`:648`, commit `455fcef`).
  - Rules for that call: no `subtitleStreamID` in the query (the stream comes from the earlier `PUT`, `:466-470`); identity and token in headers only (`:490-494`); profile headers present (`:496-502`); HTTP `Accept` left as text, because `Accept: application/json` returns a JSON wrapper instead of the SRT (`:504-509`).
- **Image-based subtitles** (PGS, VobSub) need a transcode with `subtitles=burn` (`subtitleTracks.js:798-800`, `:836-856`). ASS styling burned in needs `advancedSubtitles=burn`.
- **Text subtitles during a transcode**: `skipSubtitles=1` on the stream and fetch the text separately (`subtitleTracks.js:857-860`). Plax's ordered list of fallback subtitle addresses is at `:617-772`.

### Remembering choices

- Audio starts on the stream Plex marks `selected` (`hubDirectPlay.js:29-32`).
- Subtitles always start Off, ignoring Plex's `selected` flag: "No automatic default subtitle, ever" (`hubDirectPlay.js:33-36`).
- Nothing carries a choice to the next episode. Subtitle delay, size and background are app settings (`src/settings/playbackSettings.js:9-16`).

## 4. Versions

- Each `Media` element is one version. Plax records its index, codecs, bitrate, container, part key, part id and `indexes` (`src/playback/versionSelector.js:5-32`).
- The chosen version's position becomes `mediaIndex` on `/decision` and `start`; direct play uses that version's part key (`src/playback/sessionController.js:15-38`, `playerScreen.js:1953`).
- Default pick is the **last** `Media` in the list, or the first if a "prefer highest quality" setting is on (`versionSelector.js:34-40`). Plex doesn't promise any order, so this is a guess. Our player should choose by resolution and bitrate.

## 5. Watch status and progress

- **Timeline call**: `POST /:/timeline?ratingKey=&key=/library/metadata/{id}&state=&time=&duration=&identifier=com.plexapp.plugins.library` (`src/plex/library.js:205-235`). On `stopped` it adds `continuing`.
- **When it is sent** (`src/playback/playerAdapter.js`):
  - every 10 s while playing (`:113`, `:1576-1588`), skipping repeats within 0.5 s of the last report (`:683-685`);
  - `playing` on the first frame with a position above 0 (`:654-674`);
  - `paused` on pause, `playing` on resume (`:1386-1401`);
  - after every seek (`:1497-1508`);
  - `stopped` with `continuing=0` on stop and at the end (`:1444-1452`, `:718-736`).
- No `X-Plex-Session-Identifier`, `playQueueItemID`, `bandwidth` or buffer fields on the timeline. When moving to the next episode Plax sends `stopped` with `continuing=0` (`src/playback/timelineFlush.js:20-21`, `queueAdvance.js:5-11`). The spec's `continuing=1` is never sent.
- **Marking watched**: Plax does it itself with `PUT /:/scrobble?key=/library/metadata/{id}&identifier=com.plexapp.plugins.library` at 92% or within the last 30 s, and again on `ended` (`src/playback/scrobblePolicy.js:1-16`, `playerAdapter.js:631-645`). A seek back below 85% allows another mark. `PUT /:/unscrobble` for "mark unwatched" (`library.js:637-649`).
- **Resume**: `viewOffset` from the item. A resume or start-over choice appears unless the offset is within 5 s of the end (`src/ui/resumeChoice.js:18-24`). Transcodes get `offset` in whole seconds.
- **Continue Watching**: `/hubs/continueWatching` (documented), then `/hubs/home/continueWatching`, then On Deck via `/hubs/home/onDeck?type=1|2` (`library.js:578-616`). Hub rows are cached 30 s and refreshed in the background; any pause or stop clears them (`library.js:22-53`, `:447-460`, `:618-635`).
- **Sessions**: no `/status/sessions`, no terminate, no `/video/:/transcode/universal/ping` or `/stop`. Plax leaves transcodes for the server to time out.
- **Live updates**: none. No WebSocket and no event stream; Plax re-fetches.

## 6. Browsing and the library

- Libraries: `GET /library/sections`, skipping entries that aren't real folder-backed libraries (`discovery.js:349-451`).
- Listing: `/library/sections/{id}/all?type=1|2&sort=titleSort` paged with `X-Plex-Container-Start` / `-Size` in the query, 200 per page, two pages at a time (`library.js:265-362`).
- One item: `GET /library/metadata/{id}?includeChildren=1&includeExtras=1&includeMarkers=1&includeChapters=1&includeRelated=0&includeOnDeck=0` (`library.js:364-385`). The comment: "Plex omits <Marker> children unless explicitly requested". Plax sends none of the `async…` flags our research warned about.
- Children: `/library/metadata/{id}/children` (`library.js:387-399`).
- Home rows: `/hubs/promoted`, falling back to `/hubs` (`library.js:515-530`); per library `/hubs/sections/{id}` (`:532-543`); related `/hubs/metadata/{id}/related` (`:545-556`).
- Search: `/hubs/search?query=&limit=&includeCollections=0`, falling back to `/library/sections/{id}/search` (`src/plex/search.js:63-95`).
- **Markers**: read from `Marker` children at item, `Media` and `Part` level (`src/playback/introMarkers.js:13-62`). Skip seeks to 2 s before the marker's end, "aligned with official Plex clients" (`:10-11`, `:139-146`). No automatic skip (`:7-8`).
- **Next episode**: no server play queue. Plax lists the current season's episodes from `/children` and plays them in order, so it stops at the end of a season (`src/playback/playbackQueue.js:43-89`). A 5 s countdown starts when the credits prompt shows, or at the end of the file (`src/playback/autoplayCountdown.js:2-23`). A separate "Up Next" list is kept in local storage, not Plex (`src/playback/userQueue.js:1-20`).
- **Pictures**:
  - Posters and art through `/photo/:/transcode?url=&width=&height=&minSize=1&upscale=1`. The comment: the raw `/thumb` address ignores size and sends the full image (`src/plex/client.js:137-154`).
  - Scrub previews: `/library/parts/{partId}/indexes/sd/{ms}?width=240&height=135` when the part has `indexes="sd"` (`src/playback/storyboard.js:33-45`). Plax also guesses at `/library/metadata/{id}/storyboard` and `/storyboards` (`:15`); neither is in the spec and neither was checked.
  - Background colours: `/services/ultrablur/colors` and `/services/ultrablur/image` (`src/plex/ultrablur.js:41-72`), not checked against the spec.

## 7. Workarounds and traps Plax found

Server-log evidence is quoted from Plax's own comments and commit messages; none of it was re-checked here.

**Transcode requests the server rejects with 400**
1. Streaming-only flags on `/decision` over a remote connection (`transcodeDecision.js:3-9`).
2. `directPlay=1` with a bitrate cap: no session created, so `start.m3u8` fails (commit `3c13044`).
3. No `add-transcode-target` in the profile: code 4005 (commit `5a66ce5`).
4. Profile edits in the query instead of headers: the server uses them for that one request but doesn't store them with the session, so later calls on the session fail (`playback.js:331-333`). The old command form without `scopeName`/`type`/`replace` is ignored without error (`deviceProfile.js:154-163`).
5. A `start` address whose `session` doesn't match `/decision`'s `resourceSession` (`playback.js:209-222`, `:634-636`).
6. On the TV's HLS path, against "this PMS build": `X-Plex-*` identity fields, `audioStreamID`, `directStream=0` or `location=wan` in the `start.m3u8` query (`hlsPolicy.js:98-159`). But commit `7fa6093` added `location=wan` because the Whatbox server returned 400 without it, and other paths still send it (`subtitleTracks.js:203-207`). Plax's evidence on `location` contradicts itself.
7. A badly identified request gets a generic HTML 400 from the plex.direct front end even on a plain `/decision` (`scripts/probe-subs.sh:35-37`).

**Whatbox-specific**
- The server fetches `path=` from itself on 127.0.0.1. A part key with its query string, or a public address, makes that fail with "HTTP -1", which shows up as a 400 (commits `d137492`, `23e4681`).
- Some Whatbox setups direct play fine but fail every universal transcode address. Plax then gives up on subtitles and returns to plain direct play instead of trying more transcodes (commit `d77d15c`, `playbackFallback.js:15-23`).

**Session identifiers**
- `X-Plex-Session-Identifier` on `/decision` must be the client identifier, because the official app sends that and the server matches later calls against it (`playback.js:325-330`).
- Subtitle extraction must reuse the playback `/decision`'s `session`. Commit `15819f4` (26 Jun) claimed a separate session was the fix; the code a day later says that theory "was wrong" (`subtitleTracks.js:473-487`). That final fix landed inside commit `64940e9`, titled "perf(focus,sidebar,hero,bundle)", so the commit history alone points the wrong way.

**Delivery**
- `X-Plex-Incomplete-Segments=1` makes the playlist list segments before they exist; they return 404 until ready, so the player needs retries (Plax: 12 retries, 1 s apart, `playerAdapter.js:528-530`).
- With `offset` on a transcode, the player may report time from the start of the title or from the offset, depending on the player. Plax guesses which and once double-counted (2061 s became 4122 s) (`playerAdapter.js:1543-1554`). This matches Plezy's warning in [player-stack.md](player-stack.md).
- `offsetSecondsForPlex` treats any value of 10,000 or less as already in seconds (`subtitleTracks.js:153-160`). A resume point under 10 s in milliseconds would be sent as thousands of seconds. Don't copy it.

**Out-of-date Plax docs** (the code above wins)
- README "Auto" quality: now an alias of Original.
- `docs/plex-subtitle-transcode.md:18` says `/decision` sends `subtitles=auto`; the code sends `none`, `sidecar` or `auto` by case.
- `hlsPolicy.js:8-9` says webOS 4 should prefer fMP4; the code below it uses MPEG-TS for transcodes.

**Privacy note**: `scripts/probe-subs.sh` in the public repo names a real plex.direct server address. No tokens are committed.

## 8. Against our research, and what to reuse

### Confirms

| Our claim | Plax |
|---|---|
| Timeline every 10 s plus each state change ([media-servers.md](media-servers.md)) | Same (`playerAdapter.js:113`) |
| `includeMarkers=1` is needed though not in the spec ([plex-playback-features.md](plex-playback-features.md) §2) | Same comment (`library.js:372-374`) |
| `PUT /library/parts/{id}?subtitleStreamID=&allParts=1` sets the subtitle | Works (`subtitleTracks.js:230-263`) |
| `/library/streams/{id}.srt` only for separate files; 501 for embedded ([player-stack.md](player-stack.md)) | Confirmed with server logs (commit `9424712`) |
| Never use `subtitles=burn` for text | Plax burns only PGS and VobSub |
| Quality list from Plex Web and Plezy | Same list (`qualityProfiles.js:14-40`) |
| `/subtitles/:/transcode/universal/start` exists but isn't in the spec | Plax depends on it for embedded subtitles |
| Changing quality restarts the transcode | Same (`playerScreen.js:1445-1458`) |

### Contradicts or differs

| Topic | Our research | Plax | Likely right |
|---|---|---|---|
| Credits marker type | `credits` on the slot | Looks for `credit` (`introMarkers.js:75-79`); its test uses a made-up `credit` example (`scripts/validate-intro-markers.mjs:42`) | Ours, checked on the slot. Skip Credits and the credits countdown likely never fire in Plax on this server. |
| Telling markers apart | Every marker has id 26294; key by type, start and end | Keys by `id` (`introMarkers.js:64-67`, `playerScreen.js:1639-1681`) | Ours. On the slot, skipping one intro marks every intro in that episode as skipped. |
| Skip target | Plex Web seeks to the marker's end | 2 s before the end | Either; a product choice. |
| Who marks watched | Server rules from timeline calls | Client `PUT /:/scrobble` at 92% | Ours for history: the spec says scrobble creates no view history. Plax's mark lands after the server's 90% rule, so on this server it likely adds nothing. |
| Next episode | Server play queue, `continuing=1` | Season list on the client, `continuing=0` | Ours for crossing seasons; Plax's is simpler and needs no writes. |
| Default subtitle | Use Plex's `selected` and account settings | Always Off | Ours, for the owner's "remember my choice" request. |
| Identity | `X-Plex-Platform=Chrome` for the browser profile | Pretends to be Plex for LG or Plex Web | For mpv direct play no profile is needed. For transcodes Plax shows `Generic` plus profile edits works; send our own product name with that. Unverified whether the server accepts an unknown product with `Generic`. |
| API version | Send `X-Plex-Pms-Api-Version` for `includeFields` | Never sent | Both work; only `includeFields` depends on it. |

### Fills gaps

- The unanswered forum thread's "`start` 400 after `/decision` 200" ([media-servers.md](media-servers.md), "Not documented") now has seven known causes (section 7).
- Avoid plain-HTTP transcodes through plex.direct; use HLS with MPEG-TS segments for the quality setting.
- On a remote server, always send `maxVideoBitrate` if `/decision` is called for Original.
- Image resizing through `/photo/:/transcode`.
- Gaps Plax doesn't fill: play queues, transcode ping and stop, `/status/sessions`, Plex's automatic quality, live updates (no evidence for WebSocket or event stream), `X-Plex-Pms-Api-Version`.

### What changes for our player

- **Original**: skip `/decision`. Hand mpv the part address with the token in a header (`--http-header-fields`) instead of the query, so it stays out of logs. Embedded subtitles and all audio tracks come from the file. Only separate subtitle files need `sub-add` with `/library/streams/{id}.srt`. Whether skipping `/decision` changes what Plex's dashboard shows is unverified; timeline calls register playback either way.
- **Lower quality**: follow Plax's working shape. `/decision` with `directPlay=0&directStream=0`, `subtitles=none` or `burn`, profile in headers, `X-Plex-Session-Identifier` = client identifier; then `start.m3u8` with `session` = `resourceSession`, `protocol=hls`, MPEG-TS target. Use one 1080p H.264 file for the first test, as [player-stack.md](player-stack.md) says.
- **Add what Plax lacks**: stop the transcode when playback ends, ping it while paused, and send `continuing=1` when moving to the next episode.

### Modules worth porting to TypeScript

Pure functions with no TV code, each under 300 lines:

| Plax file | Use |
|---|---|
| `src/playback/parseTranscodeDecision.js` | Read `/decision` replies |
| `src/playback/transcodeDecision.js` | Allowed `/decision` keys |
| `src/playback/deviceProfile.js` (`limitation`, target builders) | Profile edit syntax; replace the webOS capability table with one H.264/AAC target |
| `src/playback/qualityProfiles.js` | Quality list and `applyProfileToParams` |
| `src/playback/plexPaths.js` | Part key clean-up |
| `src/plex/servers/connectionPolicy.js` and the parse and `/identity` probe in `discovery.js` | Server address ranking and checking |
| `src/plex/auth/pinAuth.js` | PIN sign-in, if the desktop app signs in itself |
| `src/playback/tracks/subtitleTracks.js` (stream parsing, labels, part `PUT`, stream address) | Subtitle menu and selection; leave the extraction fallbacks |
| `src/playback/introMarkers.js` | Marker parsing, after fixing `credits` and the key |
| `src/plex/client.js` (`redactPlexUrl`, error mapping) | Token-safe logging |

Not worth porting: `playerAdapter.js`, `hlsPolicy.js`, `capabilityMatrix.js`, `lgBitrateLimits.js`, `mediaOption.js` and the screens. They exist for the TV's `<video>` element.

Plax's `node:test` suites (`test/parse-transcode-decision.test.js`, `test/plex-paths.test.js`, `test/connection-policy.test.js`) can come along as starting tests, but check fixtures against real server replies first: the marker fixture shows they were not always captured.

## Could not verify

- That Plax's Whatbox server is the owner's current slot.
- Any server-log claim in Plax's comments; none were re-run.
- Whether the slot returns `credit` for any marker (our research saw only `credits`).
- Whether a `Generic` profile with a non-Plex product name gets the same transcode behaviour as Plax's borrowed identity.
- Whether `location=wan` helps or hurts on the slot's `start.m3u8`.
