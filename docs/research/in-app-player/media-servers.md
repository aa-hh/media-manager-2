# In-app video player: feasibility of Plex, Jellyfin, Emby or no media server

Researched 14 Oct 2026. Sources are inline. "Checked on the slot" means a read-only command run over `ssh shenzhou` on 14 Oct 2026. Nothing was changed there.

## Short answer

- Every option can deliver a browser player with quality choice, subtitle choice and resume. They differ in who does the transcoding (converting video or audio into a format the browser can play) and how much of that we write ourselves.
- Jellyfin is the cheapest and safest backend to build on: a fully documented open API, an official TypeScript client at 1.0, permissive CORS (cross-origin browser access) by default, and no paywall.
- Plex is now viable too. It published an official API reference in September 2025 that covers the transcode, timeline and subtitle-selection endpoints. The owner's account has a lifetime Plex Pass, so the 2025 remote-streaming paywall does not block us. The risks are Plex's terms and a thinner record of third-party web players.
- With no media server, our own Node server plus ffmpeg is the most work by a wide margin. Jellyfin's equivalent code is about 12,000 lines of C#.
- The slot has no hardware video encoder, so every video transcode runs on a shared CPU. Design for direct play and remux (repackaging the same audio and video into another container, which costs little CPU) first, and treat full video transcodes as the exception.

## What the slot actually has (checked on the slot)

- CPU: 72 threads of Intel Xeon E5-2697 v4 (two sockets, about 21,000 PassMark each per [cpubenchmark.net](https://www.cpubenchmark.net/compare/2783vs2870/Intel-Xeon-E5-2697-v4-vs-Intel-Xeon-E5-2686-v4)). The machine is shared with other customers: load average about 14 at the time of the check.
- No GPU encoder: `/dev/dri` holds only `card0`, with no render node, and `ffmpeg -hwaccels` lists nothing. Broadwell Xeons have no Quick Sync. Plex Pass hardware transcoding therefore buys nothing here.
- ffmpeg 8.1.3 is installed system-wide.
- Plex Media Server 1.43.2.10687 is running, reached through a `*.plex.direct` HTTPS address. The owner account's Plex Pass is **active, plan "lifetime"**, and the server reports `myPlexSubscription=true`.
- Jellyfin 10.11.11 is also running, on port 25595. Jellyfin 12.0 shipped on 8 Sep 2026, so the slot is one major version behind.
- Whatbox ships Plex and Jellyfin as one-click installs ([Plex](https://whatbox.ca/wiki/Plex), [Jellyfin](https://whatbox.ca/wiki/Jellyfin)). For Emby it warns: "We will terminate any instances of Emby running that are using so much CPU as to impact other users", and caps it at 4 encoder threads on HDD plans and 6 on NVMe plans ([Emby](https://whatbox.ca/wiki/Emby)). Expect the same scrutiny for any heavy ffmpeg use, including ours.

What one CPU transcode costs, from Plex's own guideline ([support article](https://support.plex.tv/articles/201774043-what-kind-of-cpu-do-i-need-for-my-server/), last updated 2019):

| Source | PassMark for one transcode to 1080p |
|---|---|
| 4K HDR, 50 Mbps, 10-bit HEVC | 17,000 |
| 4K SDR, 40 Mbps, 8-bit HEVC | 12,000 |
| 1080p, 10 Mbps, H.264 | 2,000 |
| 720p, 4 Mbps, H.264 | 1,500 |

So a 4K HDR transcode needs most of one socket on a shared box. A 1080p H.264 transcode needs about a tenth of one.

## What the app already has (read from the code)

- `src/server/services/mediaServer.ts` already defines a `MediaServer` type with Plex and Jellyfin implementations, picked from the owner's sign-in provider. A player needs two or three more methods on it.
- The app has one owner. Only the owner can sign in (`owner_only` in `src/server/auth.ts`).
- Plex: the owner's sign-in token is held in memory per session (`plexTokens` in `src/server/auth.ts`, line 191), so it is lost on restart. The server-wide token lives in settings as `credentials/plex.token`.
- Jellyfin: the app uses an API key for library work and discards the user's access token after sign-in (comment at `src/server/services/jellyfin.ts:153`). Watch progress is stored per user, and an API key has no user, so the player would need to keep the user's access token.
- Client is React. Server is Hono on Node, with `node:sqlite`. No player library is installed.
- Hono's Node static-file helper (`@hono/node-server` 2.1.4) already answers HTTP range requests (it sets `Content-Range`), which covers serving a whole file that the browser can play as is.

---

## 1. Plex

### Official documentation now exists

- Plex published an OpenAPI reference for the Plex Media Server API on 15 Sep 2025 ([announcement](https://forums.plex.tv/t/public-api-docs-for-pms-are-here/930957)). It is aimed at "third-party clients that want to play content from a PMS". Plex says it is "not a complete 100% mirror" of the server and that it will not vet or approve third-party tools.
- The reference at [developer.plex.tv/pms](https://developer.plex.tv/pms/) is at API version 1.2.3, supported on PMS 1.43.4 or later. The spec itself is under Apache 2.0. Clients opt into a version with the `X-Plex-Pms-Api-Version` header. Without it, the server assumes `0.0`, the behaviour from before publication.
- The reference warns that "paths that aren't documented here aren't part of the API contract".

### Playback calls (all from the official spec)

| Purpose | Call | Notes |
|---|---|---|
| Ask the server how it will play an item | `GET /{video\|music}/:/transcode/universal/decision` | Same parameters as `start`. Returns direct play, direct stream (keep the video, convert only audio or container) or transcode. |
| Start playback | `GET /video/:/transcode/universal/start.{m3u8\|mpd}` | `protocol` = `hls`, `dash` or `http`. Returns an HLS playlist, a DASH manifest or a raw stream. |
| Choose the original file instead | `GET /library/parts/{partId}/{changestamp}/{filename}` | Direct play: the file as stored, with range requests. |
| Choose audio and subtitle tracks | `PUT /library/parts/{partId}?audioStreamID=&subtitleStreamID=` | `subtitleStreamID=0` turns subtitles off. `allParts=1` applies the choice to every part. Saved per user. |
| Fetch a separate subtitle file | `GET /library/streams/{streamId}.{ext}` | For subtitles delivered as a separate file. |
| Subtitle-only transcode | `GET /{type}/:/transcode/universal/subtitles` | |
| Report progress | `POST /:/timeline?ratingKey=&key=&state=&time=&duration=` | `state` is playing, paused, buffering or stopped. `time` is in ms. The spec says to call it on every state change and "every 10 seconds on a LAN/WAN". |
| Mark watched or unwatched | `PUT /:/scrobble`, `PUT /:/unscrobble` | |
| Resume point | `viewOffset` on the item | "current offset, in units of milliseconds". |
| See or stop sessions | `GET /status/sessions`, `POST /status/sessions/terminate` | |

Main parameters on `decision` and `start`:

- Quality: `videoBitrate` (kbps), `videoResolution` (e.g. `1920x1080`), `peakBitrate`, `autoAdjustQuality` (the client handles adaptive bitrate), `location` (`lan`, `wan` or `cellular`), `mediaBufferSize`.
- What the client can take: `directPlay`, `directStream`, `directStreamAudio` (each 0 or 1), `mediaIndex`, `partIndex`, `offset` (seconds, used to start at the resume point).
- Subtitles: `subtitles` = `auto`, `burn`, `none`, `sidecar` (separate file), `embedded` or `segmented`. `advancedSubtitles` = `burn` or `text` decides what happens to ASS/SSA styling when the client can't render it. `subtitleSize` sets the size of burned-in text.
- Headers: `X-Plex-Client-Identifier` (required), `X-Plex-Token`, `X-Plex-Session-Identifier` (one per playback, for several tabs at once), `X-Plex-Platform`, `X-Plex-Client-Profile-Name` (pick a built-in profile, "generally should only be used to specify the Generic profile"), and `X-Plex-Client-Profile-Extra`.
- `X-Plex-Client-Profile-Extra` changes the built-in client profile (the list of formats the client can play) with commands joined by `+`: `add-direct-play-profile(...)`, `add-limitation(...)`, `add-transcode-target(...)`, `add-transcode-target-codec(...)`, `append-transcode-target-codec(...)` and `add-settings(...)`. The spec's example is `add-direct-play-profile(type=videoProfile&container=mp4,mov&videoCodec=*&audioCodec=ac3&subtitleCodec=*)`. In practice a browser client sends `X-Plex-Platform=Chrome` (or Safari or Firefox) to get Plex's own web-browser profile, then adjusts it with these commands. python-plexapi defaults to `X-Plex-Platform: Chrome` when it builds stream URLs ([source](https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/base.py)).

### Not documented

- Keep-alive and stop calls for a transcode session (`/video/:/transcode/universal/ping` and `/stop` in community clients) and the session segment paths under `session/{id}/...` are absent from the official spec. Plex can change them without notice.
- Third-party web clients hit errors that nobody has explained. One example: `start.mpd` returning 400 after `decision` returned 200 ([Nov 2025 thread](https://forums.plex.tv/t/universal-transcoder-start-mpd-returns-400-when-called-from-custom-player/933458), still unanswered in Feb 2026). In the same thread, Plex's dashboard showed "nothing is playing" despite timeline calls. The fix was never posted.

### Sign-in and connections

- Plex now recommends JWT sign-in: a device key pair, tokens that expire after 7 days, and the PIN flow at `clients.plex.tv/api/v2/pins` ([spec, "Authenticating with Plex"](https://developer.plex.tv/pms/)). The older long-lived tokens still work.
- Server addresses and per-server `accessToken`s come from `GET https://clients.plex.tv/api/v2/resources?includeHttps=1&includeRelay=1`. The spec says relay connections are "a last resort as bandwidth on relay connections is limited".
- `*.plex.direct` hostnames give each server a valid HTTPS certificate, so an HTTPS page can load from it without mixed-content blocking. The spec's server URL template is `https://{IP-description}.{identifier}.plex.direct:{port}`.

### CORS (checked on the slot)

- An unauthenticated request with `Origin: https://example.com` got `Access-Control-Allow-Origin: https://app.plex.tv`.
- An authenticated `GET /` with the same origin got `Access-Control-Allow-Origin: https://example.com`. The server echoes the origin back once a valid token is present.
- A preflight (the browser's permission check before a cross-origin request) also echoed the origin and allowed the `x-plex-token` header.
- So a browser on our origin can call Plex directly once it holds a token. Plex had a wildcard CORS hole until mid-2020 ([Tenable TRA-2020-35](https://www.tenable.com/security/research/tra-2020-35)). The current behaviour isn't documented and could tighten again.
- Chrome's private-network checks can block a public page from calling a LAN `plex.direct` address ([forum report](https://forums.plex.tv/t/plex-web-local-ip-pms-cors-issues/900023)). The slot is public, so this only matters for home servers.
- Routing Plex calls through our own server avoids all of this. On the slot it costs only local traffic, because Plex and the app run on the same machine.

### Paywall and Plex Pass

- Since 29 Apr 2025, remote playback (anything not on the same local network) of personal video needs a Plex Pass on the server admin's account, a Plex Pass on the viewer's account, or a Remote Watch Pass ([support article](https://support.plex.tv/articles/requirements-for-remote-playback-of-personal-media/), modified 10 Apr 2026). A seedbox is always remote.
- Plex expanded this to Fire TV, smart TVs and consoles on 29 Apr 2026 ([blog update](https://www.plex.tv/blog/important-2025-plex-updates/)). Firecore told Infuse users on 21 Sep 2026 that the requirement now covers third-party apps ([Firecore post](https://community.firecore.com/t/changes-to-plex-remote-streaming-requirements/60825)).
- The owner's lifetime Plex Pass covers every user of that server, so this does not block us. It would block other installs whose owners lack Plex Pass, if the app is ever used beyond this one.
- Hardware-accelerated transcoding needs Plex Pass ([support article](https://support.plex.tv/articles/115002178853-using-hardware-accelerated-streaming/)). It doesn't matter here: the slot has no GPU.
- HDR to SDR tone mapping (converting HDR colour to normal colour for SDR screens) also needs Plex Pass on the server account. It works on the CPU on Linux ([support article](https://support.plex.tv/articles/hdr-to-sdr-tone-mapping/)).

### Terms of service (revised 30 Oct 2025, [plex.tv](https://www.plex.tv/about/privacy-legal/plex-terms-of-service/))

- Software that "accesses or calls any PMS Software", including "client applications", counts as Interfacing Software. Whoever makes it is liable for it, must include a copyright notice and a privacy notice, and grants Plex a licence to use and promote it. Clients are therefore allowed, with strings attached.
- You may not "use the Plex Solution to create any service, software or documentation that performs substantially the same functionality as the Plex Solution". A full Netflix-style Plex player sits close to that line. The September 2025 announcement invites third-party clients, which cuts the other way. Unresolved.
- "You may only use the PMS Software: (i) on a device or hardware that you own", and "Content available on your PMS Software must be on storage that you own". A rented seedbox doesn't meet that wording. Whatbox sells Plex anyway, and I found no sign of Plex enforcing this against seedboxes (unverified).
- "obtaining Plex Pass functionality without a valid Plex Pass" is prohibited. Not an issue with the owner's lifetime pass.

---

## 2. Jellyfin

Version facts: Jellyfin 12.0 shipped 8 Sep 2026, and 12.2 on 5 Oct 2026 ([releases](https://github.com/jellyfin/jellyfin/releases)). Server and web client are GPL-2.0. Everything below was read from server source at commit `e53a6d3` (13 Oct 2026).

### Playback calls

| Purpose | Call | Notes |
|---|---|---|
| Ask the server how to play an item | `POST /Items/{itemId}/PlaybackInfo` with a `PlaybackInfoDto` body | Body fields: `DeviceProfile`, `MaxStreamingBitrate`, `StartTimeTicks`, `AudioStreamIndex`, `SubtitleStreamIndex`, `MaxAudioChannels`, `MediaSourceId`, `EnableDirectPlay`, `EnableDirectStream`, `EnableTranscoding`, `AllowVideoStreamCopy`, `AllowAudioStreamCopy`, `AlwaysBurnInSubtitleWhenTranscoding`. The query-string forms are marked obsolete ([MediaInfoController.cs](https://github.com/jellyfin/jellyfin/blob/master/Jellyfin.Api/Controllers/MediaInfoController.cs)). |
| Direct play | `GET /Videos/{itemId}/stream` or `/stream.{container}` with `static=true` | The original file, with range requests. |
| Transcoded or remuxed HLS | `GET /Videos/{itemId}/master.m3u8` | Normally you don't build this URL yourself: you use `MediaSources[].TranscodingUrl` from the PlaybackInfo answer. Parameters include `mediaSourceId` (required), `playSessionId`, `videoBitRate`, `audioBitRate`, `maxWidth`, `maxHeight`, `audioStreamIndex`, `subtitleStreamIndex`, `subtitleMethod`, `startTimeTicks`, `enableAdaptiveBitrateStreaming`, `alwaysBurnInSubtitleWhenTranscoding` ([DynamicHlsController.cs](https://github.com/jellyfin/jellyfin/blob/master/Jellyfin.Api/Controllers/DynamicHlsController.cs)). |
| Subtitles as a file | `GET /Videos/{itemId}/{mediaSourceId}/Subtitles/{index}/Stream.{format}` | Converts on the fly, e.g. to `vtt`, or `ass` for a client-side renderer. |
| Subtitles inside HLS | `GET /Videos/{itemId}/{mediaSourceId}/Subtitles/{index}/subtitles.m3u8` | |
| Report start, progress, stop | `POST /Sessions/Playing`, `/Sessions/Playing/Progress`, `/Sessions/Playing/Ping`, `/Sessions/Playing/Stopped` ([PlaystateController.cs](https://github.com/jellyfin/jellyfin/blob/master/Jellyfin.Api/Controllers/PlaystateController.cs)) | Body fields include `ItemId`, `MediaSourceId`, `PlaySessionId`, `PositionTicks` (1 tick = 100 ns), `IsPaused`, `AudioStreamIndex`, `SubtitleStreamIndex` and `PlayMethod`. |
| Mark watched | `POST /UserPlayedItems/{itemId}`, `DELETE` to unmark | |
| Resume point | `UserData.PlaybackPositionTicks` on the item | Defaults: no resume point under 5% or over 90% of the runtime, or for items under 300 s (`MinResumePct`, `MaxResumePct`, `MinResumeDurationSeconds` in `ServerConfiguration.cs`). |

Subtitle delivery methods (`SubtitleDeliveryMethod` enum): `Encode` (burned in), `Embed` (left inside the container), `External` (separate file), `Hls` (subtitle playlist inside HLS) and `Drop` (removed). PlaybackInfo picks one per subtitle track from the device profile's `SubtitleProfiles` and reports it as `DeliveryMethod`, plus `DeliveryUrl` for external files.

How the device profile works: the client lists the containers and codecs it can play directly, what to transcode into otherwise, and limits such as maximum resolution. The server compares that with the file and fills in `SupportsDirectPlay`, `SupportsDirectStream` and `TranscodingUrl`. Jellyfin's web client builds its profile from `canPlayType` probes in [`browserDeviceProfile.js`](https://github.com/jellyfin/jellyfin-web/blob/master/src/scripts/browserDeviceProfile.js) (1,654 lines, GPL-2.0, so we can read it but not copy it). A short conservative profile written by us is enough to start: MP4 and WebM with H.264, VP9, AV1 and AAC; HEVC only after a probe; transcode target HLS fMP4 with H.264 and AAC; subtitles as WebVTT external files, ASS external, PGS external if we ship a renderer, burn in otherwise.

Seeking in a transcoded stream: Jellyfin publishes a playlist listing every segment up front. When the player asks for a segment more than 24 seconds past what ffmpeg has produced, or behind it, the server kills ffmpeg and restarts it at that point (`segmentGapRequiringTranscodingChange = 24 / state.SegmentLength` in `DynamicHlsController.cs`, around line 1472). For remuxes, segment edges must fall on keyframes, so Jellyfin extracts and stores keyframe positions per file (`KeyframeManager.cs`, `KeyframeRepository.cs`).

### Sign-in format (from `AuthorizationContext.cs`)

- Use `Authorization: MediaBrowser Client="…", Device="…", DeviceId="…", Version="…", Token="…"`.
- The `ApiKey` query parameter is always accepted. Media URLs that a `<video>` tag or an HLS player loads can carry it, because those requests can't easily set headers.
- `X-Emby-Token`, `X-MediaBrowser-Token`, `X-Emby-Authorization`, the `Emby` scheme name and `api_key` only work with `EnableLegacyAuthorization`. Jellyfin 12.0 turns that off by default and switches it off on existing installs ([12.0 notes](https://github.com/jellyfin/jellyfin/releases/tag/v12.0)). The app already uses the `MediaBrowser` header, so it is unaffected.
- Other 12.0 breaking changes: the `/emby/*` and `/mediabrowser/*` path prefixes are gone, and subtitle settings moved from server-wide to per library.

### CORS

`CorsHosts` defaults to `["*"]` (`ServerConfiguration.cs`, line 236), so a browser on any origin can call Jellyfin directly. Through a reverse proxy, the proxy's headers decide.

### Official TypeScript client

- [`@jellyfin/sdk`](https://github.com/jellyfin/jellyfin-sdk-typescript): MPL-2.0. 1.0.0 released 11 Sep 2026, generated from the 12.0 OpenAPI spec, with WebSocket support added. The previous release was 0.13.0 in Oct 2025.
- MPL-2.0 is per-file: using it unmodified as a dependency puts no licence obligation on our code. Changes to its own files would have to be shared under MPL.
- Our Jellyfin client is already hand-written `fetch`. Adding the SDK is optional. It saves typing the PlaybackInfo, DeviceProfile and progress types by hand.

### GPL and copying code

- Calling Jellyfin's HTTP API from our own program creates no GPL obligation. Separate programs that talk over sockets or HTTP are normally separate works ([FSF GPL FAQ, "mere aggregation"](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation)).
- Copying code from jellyfin-web (GPL-2.0), jellyfin-vue (GPL-3.0), Plezy (GPL-3.0) or Fladder (GPL-3.0) into our app makes the app a derivative work. Anyone we distribute it to must get it under a compatible GPL. Our `package.json` is `"private": true` with no licence. Reading their code to learn the approach is fine.
- Streamyfin and Finamp are MPL-2.0. Their individual files can be reused if those files stay under MPL.

---

## 3. Emby

- Closed source since 2018. Jellyfin forked from Emby 3.5.2 ([Whatbox Jellyfin page](https://whatbox.ca/wiki/Jellyfin)). The old GitHub repo has had no pushes since March 2024.
- The API looks like Jellyfin's, since they share an ancestor: `Sessions/Playing`, `/Progress`, `/Ping` and `/Stopped`, with `PositionTicks` where 1 ms = 10,000 ticks ([Emby REST docs](https://dev.emby.media/doc/restapi/Playback-Check-ins.html), [PlaystateService](https://dev.emby.media/reference/RestAPI/PlaystateService.html)). Sign-in uses `X-Emby-Authorization` or `X-Emby-Token`.
- Emby Premiere costs $4.99 a month, $54 a year or $119 lifetime. It gates hardware transcoding, offline downloads, DVR, playback in Emby's own mobile and TV apps, and "Automatically Convert Content" ([premiere page](https://emby.media/premiere.html)). The page says nothing about the API or third-party clients.
- Whatbox restricts Emby's CPU use (see above). Nothing here favours Emby over Jellyfin. I'd only add it if users ask, and then as a near-copy of the Jellyfin code. Plezy shows this works: one client covers Plex, Jellyfin and Emby ([readme](https://github.com/edde746/plezy)).

---

## 4. No media server: our own Node server plus ffmpeg

### What the browser can play without help (October 2026)

| | Chrome / Edge | Firefox | Safari (macOS, iOS) |
|---|---|---|---|
| H.264 in MP4 | yes | yes | yes |
| HEVC | only with a hardware decoder on Windows and Linux; all Macs; Android 5+ | Windows 134+, macOS 136+, Linux 137+ (hardware or system decoder), Android 137+ hardware only | yes |
| AV1 | yes | yes | only on hardware with an AV1 decoder (M3 Macs, iPhone 15 Pro and later) |
| AC-3 / E-AC-3 audio | Jellyfin's table says yes for both; caniuse says no | no AC-3; Jellyfin's table says E-AC-3 yes | Jellyfin's table says yes; caniuse marks iOS partial |
| DTS, TrueHD | no | no | no |
| MKV container | Chrome 145+ per Jellyfin | 145+ has MKV, but Jellyfin turns it off because Firefox preloads the whole file | no |
| ASS, PGS subtitles | no native support in any browser; needs a JavaScript renderer or burn-in | | |

Sources: [MDN video codecs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs), [caniuse data for HEVC, AV1 and AC-3](https://github.com/Fyrd/caniuse/tree/main/features-json), [Jellyfin codec support table](https://jellyfin.org/docs/general/clients/codec-support/), [Firefox 145 notes](https://www.firefox.com/en-US/firefox/145.0/releasenotes/) ("Added Matroska support for the most commonly used codecs"), and jellyfin-web's [`testCanPlayMkv`](https://github.com/jellyfin/jellyfin-web/blob/master/src/scripts/browserDeviceProfile.js) comment citing [jellyfin#15521](https://github.com/jellyfin/jellyfin/issues/15521). The AC-3 rows conflict between sources. Probe with `canPlayType('audio/mp4; codecs="ac-3"')` at runtime, as jellyfin-web does.

What this means for typical release files (MKV, H.264 or HEVC, with AC-3, E-AC-3, DTS or TrueHD audio, and SRT, ASS or PGS subtitles):

- A minority play as is. Most need at least a remux (MKV to MP4 or HLS, which costs little CPU) and an audio conversion to AAC (also cheap).
- HEVC needs a full video transcode for Firefox and Chrome users without a hardware decoder. That is the expensive case.

### What we would have to build

1. Direct play: serve the file with range requests. Small. Hono already supports this.
2. Probe each file with `ffprobe` for its streams, then decide per browser what to do. That decision logic is what Plex's client profile and Jellyfin's DeviceProfile already do.
3. HLS output: run ffmpeg per session, writing short segments in fragmented MP4. Video copied when the browser supports it, else transcoded to H.264. Audio converted to AAC when needed.
4. Seeking: publish a playlist listing every segment so the player shows the full timeline. Restart ffmpeg at the new position (`-ss`) when the player jumps ahead, the way Jellyfin does. When copying video, segment edges must match the file's keyframes, which means extracting and storing keyframe positions per file.
5. Quality choice: either one ffmpeg output per quality level (multiplies CPU) or "pick a quality" restarting ffmpeg at a new bitrate, which is what Plex and Jellyfin do in practice.
6. Subtitles: extract text subtitles with ffmpeg (SRT to WebVTT, or keep ASS for a JavaScript renderer). Extract PGS (Blu-ray image subtitles) for a JavaScript renderer, or burn them in, which forces a full video transcode.
7. Housekeeping: kill ffmpeg when the viewer stops or the tab closes, cap how many sessions run at once, clear segment folders, and run ffmpeg at low CPU priority so Whatbox doesn't kill it.
8. Progress: a table keyed by user and file with position, duration and watched flag, written every 10 s and on pause or stop. Small. Unlike the server options, this progress would not show up in Plex or Jellyfin, or in any other app.

For scale: Jellyfin's versions of steps 2 to 7 are `DynamicHlsController.cs` (2,097 lines), `DynamicHlsHelper.cs` (1,015), `StreamingHelpers.cs` (622) and `EncodingHelper.cs` (8,093), not counting the keyframe code.

---

## 5. Browser player libraries

| Library | Licence | Status (Oct 2026) | Fit |
|---|---|---|---|
| [hls.js](https://github.com/video-dev/hls.js) | Apache-2.0 | 1.7.3, 11 Sep 2026 | Plays HLS through Media Source Extensions (the browser API that lets JavaScript feed video data to a `<video>` element). Quality levels, with switching. WebVTT, IMSC1 (text-only) and CEA-608/708 captions. Works on iOS 17.1+ through Managed Media Source. Its readme notes Chrome 147 claims native HLS "but may fail to play certain streams natively", and recommends hls.js there. Used by jellyfin-web (1.6.16) and jellyfin-vue (1.7.3). |
| [Shaka Player](https://github.com/shaka-project/shaka-player) | Apache-2.0 | 5.2.13, 9 Oct 2026 | Plays both DASH and HLS, so it handles Plex's DASH output as well. Text parsers for WebVTT, TTML and SRT (`lib/text`), with no ASS styling. Larger than hls.js. |
| [Video.js 10](https://github.com/videojs/video.js) | Apache-2.0 | 10.1.0, 12 Oct 2026 | Player UI and controls with React support. The Vidstack, Plyr and Media Chrome teams now work on it. |
| [Vidstack](https://github.com/vidstack/player) | MIT | Security fixes only, until January 2028 | Its readme says to migrate to Video.js 10. Don't start on it. |
| [Media Chrome](https://github.com/muxinc/media-chrome) | MIT | Active | Web-component controls. Its team now also focuses on Video.js 10. |
| [JASSUB](https://github.com/ThaUnknown/jassub) | MIT (libass itself is [ISC](https://github.com/libass/libass)) | Active | Full ASS/SSA rendering via libass compiled to WebAssembly, drawn over the video. jellyfin-web uses an older relative, `@jellyfin/libass-wasm` ([MIT](https://github.com/jellyfin/JavascriptSubtitlesOctopus)). |
| [libbitsub](https://github.com/altqx/libbitsub) | MIT | Active | Renders PGS and VobSub image subtitles in the browser, written in Rust and compiled to WebAssembly. jellyfin-web 12 switched to it from libpgs. |
| [libpgs-js](https://github.com/Arcus92/libpgs-js) | MIT | Active, small | PGS only. jellyfin-vue uses it. |

A plain choice for this app: hls.js, our own React controls (or Video.js 10 if we want ready-made ones), JASSUB for ASS, and libbitsub for PGS. Add Shaka only if Plex has to use DASH.

### Prior art

- [jellyfin-web](https://github.com/jellyfin/jellyfin-web) (GPL-2.0): the reference browser client for every Jellyfin call above.
- [jellyfin-vue](https://github.com/jellyfin/jellyfin-vue) (GPL-3.0): a second, modern browser client. Uses `@jellyfin/sdk` 0.13, hls.js and libpgs.
- [Plezy](https://github.com/edde746/plezy) (GPL-3.0, Flutter): one client for Plex, Jellyfin and Emby, with direct play, transcode presets from 240p to 1080p at 20 Mbps, and full ASS. The closest match to "both behind one interface", but native rather than browser.
- [Streamyfin](https://github.com/streamyfin/streamyfin) (MPL-2.0, Expo / React Native): Jellyfin only. Chromecast still marked experimental.
- [Finamp](https://github.com/finamp-app/finamp) (MPL-2.0): Jellyfin music only. No video.
- [Fladder](https://github.com/DonutWare/Fladder) (GPL-3.0, Flutter): Jellyfin.
- python-plexapi's [`getStreamURL`](https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/base.py): a small, maintained reference for building Plex transcode URLs.
- Overseerr is archived. Its successor [Seerr](https://github.com/seerr-team/seerr) handles requests for Plex, Jellyfin and Emby but has no player. I found no maintained open-source third-party Plex player that runs in a browser (see "Could not verify").

---

## 6. Hard problems

- **Transcoding load.** No hardware encoder on the slot (checked). One 4K HDR transcode needs about 17,000 PassMark, roughly one of the two sockets, on a machine shared with other customers. Remux and audio-only conversion should cover most playback. Full transcodes should be rare, capped and low priority. Plex and Jellyfin both let us cap encoder threads. Our own ffmpeg would need the same cap. One forum user reported Jellyfin using about twice Plex's CPU on the same hardware ([thread](https://forum.jellyfin.org/t-migrating-from-plex-seeing-higher-cpu-usage)). That is one anecdote.
- **Image subtitles (PGS, VobSub).** No browser renders them. The choices are a WebAssembly renderer (libbitsub, libpgs-js), which keeps the video a cheap remux, or burn-in, which forces a full video transcode and is the most CPU-heavy case ([Jellyfin codec page](https://jellyfin.org/docs/general/clients/codec-support/)). Jellyfin 12 allows client-rendered image subtitles during a remux ([12.0 notes](https://github.com/jellyfin/jellyfin/releases/tag/v12.0)). Plex's `subtitles=burn|sidecar|segmented` choice is the equivalent. Whether Plex's sidecar endpoint hands out raw PGS for a browser renderer is unverified.
- **Surround audio.** Browsers decode audio themselves and have no API to pass Dolby or DTS streams through untouched to an amplifier. DTS and TrueHD must become AAC or AC-3. jellyfin-web keeps DTS and TrueHD behind manual settings (`enableDts`, `enableTrueHd`). The missing passthrough API is from my own knowledge of the web platform; I found no single source stating it.
- **4K HDR.** HDR plays as HDR only where browser, OS and display all support it; Safari on Apple hardware is the most reliable. Anywhere else it needs tone mapping during a transcode, which is the heaviest job on a CPU-only box. Plex does tone mapping on the CPU on Linux with Plex Pass. Jellyfin's docs describe only hardware tone mapping ([Jellyfin hardware acceleration](https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/)); whether its CPU path works is unverified. Realistically: offer 4K direct play where the browser supports it, otherwise a 1080p transcode with a warning.
- **Seeking in a transcode.** Every long jump restarts ffmpeg, so the viewer waits several seconds while it catches up. Plex and Jellyfin both behave this way. Our own server would too.
- **Mobile Safari.** iPhone uses native HLS or hls.js through Managed Media Source (iOS 17.1+). Managed Media Source is only available when an AirPlay alternative source is present, or when remote playback is explicitly disabled ([WebKit, Safari 17.1](https://webkit.org/blog/14735/webkit-features-in-safari-17-1/)). On iPhone, handing Safari the HLS address directly is simplest. Fullscreen and picture-in-picture then use the native player, so custom JavaScript subtitle renderers don't show over it. On iPhone, ASS and PGS need burn-in or conversion to WebVTT.
- **Casting.** Chromecast media must be reachable by the Chromecast itself, and adaptive streams and subtitles "must implement CORS". Supported subtitles are WebVTT, TTML and CEA-608/708. HEVC isn't supported in MPEG-TS, and MKV isn't listed ([Google Cast media](https://developers.google.com/cast/docs/media)). AirPlay works from Safari with native HLS. Plan casting as a later, separate piece of work.
- **HTTPS and mixed content.** On an HTTPS page, `<video src="http://…">` is upgraded to HTTPS automatically, but `fetch`/XHR requests to `http://` are blocked, and so are plain-IP addresses ([MDN mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content)). hls.js and Shaka fetch segments with `fetch`/XHR, so every segment URL must be HTTPS. Plex: use the `plex.direct` address or route through our server. Jellyfin on the slot answers plain HTTP on port 25595, so route it through our server or put it behind Whatbox's HTTPS proxy.
- **Bandwidth from the seedbox.** Direct play of a 4K remux needs 40 to 80+ Mbps of steady download at the viewer's end. Transcoding lowers that but costs CPU. The player should start at a quality chosen from a measured download speed, and let the viewer change it. Whatbox's per-plan traffic limits were not checked.

---

## 7. Recommendation

Sizes: small is days, medium is one to three weeks, large is more than a month, for one developer with tests, on this codebase.

| Rank | Option | Effort | Risk | Viewer experience |
|---|---|---|---|---|
| 1 | **Jellyfin-backed** | Medium | Low | Good. The server decides direct play, remux or transcode. Subtitles, resume and history are shared with every other Jellyfin app. |
| 2 | **Both, behind one interface** (Jellyfin first, then Plex) | Medium, plus another medium for the second backend | Medium (Plex part) | Same as each backend. Works whichever server the owner signed in with. |
| 3 | **Plex-backed only** | Medium | Medium | Good when it works. Resume and history are shared with Plex apps. |
| 4 | **Direct, no media server** | Large (direct play alone is small) | High | Direct play alone fails on most release files. A full version is weaker than Plex or Jellyfin for months. |

Why Jellyfin first:

- Every endpoint, field and enum used above is in open source and in the OpenAPI spec that the official TypeScript client is generated from.
- CORS is open by default, nothing is paywalled, the terms don't restrict clients, and the slot already runs it.
- The work: keep the user's Jellyfin access token instead of discarding it. Write a small device profile from `canPlayType` probes. Call PlaybackInfo, play `TranscodingUrl` or the direct-play URL with hls.js, and add JASSUB and libbitsub for subtitles. Report progress. Read `UserData` for resume.
- Upgrade the slot to Jellyfin 12 first. The 12.0 release changed sign-in defaults and added client-rendered image subtitles during remux, and SDK 1.0 targets 12.

Why Plex second rather than never:

- `mediaServer.ts` already switches between the two by owner. The player UI, subtitle renderers and progress loop are shared. Only the "get a playable address, list tracks, report progress" part differs.
- The owner's lifetime Plex Pass removes the paywall problem for this install.
- Risks to plan around:
  - Keep-alive and stop calls are undocumented.
  - Third-party players have hit 400 errors that nobody has explained.
  - The terms forbid software that "performs substantially the same functionality" and require server hardware "that you own".
  - Plex has tightened rules for third-party clients twice in 18 months.
- Send `X-Plex-Pms-Api-Version` so documented behaviour stays pinned.

Why not the direct option:

- Its first step, serving the file with range requests and saving progress in our database, is small. It only plays MP4 or WebM files with H.264, VP9 or AV1 and AAC, plus MKV in Chrome 145+. For a library of typical release files that means many titles won't play or will have no sound.
- Everything past that (remux, audio conversion, seeking, quality levels, subtitles, session cleanup) rebuilds what Plex and Jellyfin already run on the slot, on a box where Whatbox kills heavy CPU users.
- It only earns its cost if the app must work with no media server installed.

## Could not verify

- Whether Plex checks the remote-playback entitlement on the server or in each client, and whether Plex will block third-party clients beyond requiring a pass.
- Whether Plex's `protocol=hls` output plays reliably in hls.js today. Plex's own web app uses DASH (`start.mpd`), and the unexplained 400 reports involve that path.
- Whether Plex's sidecar subtitle endpoint (`/library/streams/{id}.{ext}`) serves PGS for a browser renderer.
- Chrome's MKV support from a Chrome source. The "Chrome 145+" figure comes from Jellyfin's codec page only.
- AC-3 and E-AC-3 in desktop Chrome and Safari, where sources conflict. Check at runtime with `canPlayType`.
- Whether Jellyfin's tone mapping works without hardware.
- Whatbox's per-plan traffic limits, and any Whatbox rule on ffmpeg CPU use outside Emby.
- Whether any maintained open-source third-party Plex player runs in a browser. I found none.
- The CPU comparison between Jellyfin and Plex, which rests on one forum post.
