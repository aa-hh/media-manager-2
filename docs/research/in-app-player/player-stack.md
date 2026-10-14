# In-app player: which language, platform and libraries

Researched 14 Oct 2026. Builds on [README.md](README.md), [media-servers.md](media-servers.md) and [codebase-fit.md](codebase-fit.md); it does not repeat them. Decided before this report: Plex only (Plex Media Server 1.43.2 on the Whatbox slot, lifetime Plex Pass, no graphics chip, 4K HEVC conversion banned). "Unverified" marks anything I could not confirm from a primary source or a test.

Words used below:
- **Buffer**: video the player has downloaded ahead of the current position.
- **Direct play**: the player gets the original file. **Direct stream**: Plex repackages the file and converts only the audio, which costs little processor time. **Transcode**: Plex converts the video itself, the expensive case.
- **HLS** and **DASH**: the two common streaming formats. A short text file (the manifest) lists small video pieces (segments) that the player fetches one by one. A manifest can list several qualities of the same video.
- **Adaptive bitrate (ABR)**: switching between those listed qualities as the connection changes. Plex calls its version "auto quality".
- **Media Source Extensions (MSE)**: the browser feature that lets JavaScript feed video pieces into a `<video>` element. hls.js and Shaka Player are built on it.

## Answer

Write the player in the existing web app: TypeScript and React in the browser, with the Plex calls on the Hono server.

- Playback engine: **Shaka Player 5.2** (Apache-2.0). It plays both HLS and DASH, has a configurable buffer, and parses SRT itself. Plex's own web app runs on Shaka too.
- Controls: our own React components on the `@base-ui/react` menus and sliders already installed. Video.js 10 is the ready-made alternative, but its first stable release is two weeks old.
- No subtitle library is needed for SRT.
- Every quality change, manual or automatic, restarts the Plex session at the current position. Plex sends one quality per session (strong evidence, not tested), so the player has nothing to switch between inside one stream.
- Try Plex's own server-side auto quality first. If it doesn't work for a third-party client, our player measures speed and restarts the session at a lower or higher quality.
- The mini player is one `<video>` element mounted outside the part of `Home.tsx` that changes per screen. The browser's own Picture-in-Picture works as a second option.

A desktop app with mpv plays nearly every file as is and needs no conversion on the slot, but none of the owner's five requirements needs it. It costs a second app to build, sign and update, and its mini player is the hardest part. Keep it as a later step: the Plex code on the server carries over unchanged.

## Comparison against the five requirements

| Option | 1. Configurable buffer | 2. SRT subtitles | 3. Manual quality | 4. Auto quality | 5. Mini player while browsing |
|---|---|---|---|---|---|
| **A1. Web, Shaka Player** | Yes: `streaming.bufferingGoal` (default 10 s), `rebufferingGoal` (0 s), `bufferBehind` (30 s) | Yes: built-in SRT parser for `text/srt` | Restart the Plex session at the current position | Shaka measures speed (estimate in `getStats()`); our code or Plex picks the quality | Yes |
| **A2. Web, hls.js** | Yes: `maxBufferLength` (30 s), `maxMaxBufferLength` (600 s), `maxBufferSize` (60 MB), `backBufferLength` | No SRT parser; WebVTT only. Convert SRT to WebVTT (a few lines) or ask Plex for WebVTT | Same restart | Same as Shaka, via `hls.bandwidthEstimate`. HLS only, so Plex Web's DASH route is out | Yes |
| **A3. Web, Video.js 10** | Passes Shaka or hls.js settings through | Through the engine underneath | Its quality menu lists the qualities in the manifest; with Plex that is one | Same | Yes, with ready-made controls |
| **A4. Web, Media Chrome** | Controls only; settings belong to the engine underneath | Through the engine | Same as A3 | Same | Yes |
| **A5. Web, plain `<video>`** | No: the browser decides; only `preload` | Needs a WebVTT `<track>`; convert SRT first | Restart by changing the source | No speed reading; write our own | Yes |
| **B. Tauri or Electron with mpv** | Yes, the most control: `cache-secs`, `demuxer-max-bytes`, `demuxer-readahead-secs`, can buffer to disk (`cache-on-disk`) | Yes, built in, embedded or separate | Restart, or play the original file | mpv has none (`hls-bitrate` picks once at start); write our own | Hard: mpv draws in its own native window |
| **C. Native Mac, AVPlayer** | Yes: `preferredForwardBufferDuration` | Not as a separate SRT file. WebVTT inside HLS, or draw them ourselves | Restart (`preferredPeakBitRate` only caps qualities a manifest lists) | AVPlayer adapts only across listed qualities; Plex lists one | Yes: `AVPictureInPictureController` (macOS 10.15+) |
| **C'. Native Mac, MPVKit or VLCKit** | As mpv | As mpv | As mpv | As mpv | Picture-in-Picture needs extra work (unverified) |

Requirement 5 inside the app: every web option can keep a corner player on screen while you browse; see "Where the mini player lives" below. Native options get a system floating window instead.

## Library facts (npm registry and source, 14 Oct 2026)

| Library | Version and date | Licence | Notes |
|---|---|---|---|
| [Shaka Player](https://github.com/shaka-project/shaka-player) | 5.2.13, 9 Oct 2026 (5.0 shipped Feb 2026) | Apache-2.0 | Plays DASH and HLS. Buffer defaults from [`player_configuration.js`](https://github.com/shaka-project/shaka-player/blob/v5.2.13/lib/util/player_configuration.js): `rebufferingGoal: 0`, `bufferingGoal: 10`, `bufferBehind: 30`; quality switching waits at least `switchInterval: 8` s. [`srt_text_parser.js`](https://github.com/shaka-project/shaka-player/blob/v5.2.13/lib/text/srt_text_parser.js) converts SRT to WebVTT internally and registers for `text/srt`, so a separate SRT file loads with `addTextTrackAsync(url, lang, 'subtitles', 'text/srt')`. |
| [hls.js](https://github.com/video-dev/hls.js) | 1.7.3, 11 Sep 2026 | Apache-2.0 | HLS only. From [API.md](https://github.com/video-dev/hls.js/blob/master/docs/API.md): `maxBufferLength` "the guaranteed buffer length HLS.js will try to reach" (30 s); `maxMaxBufferLength` caps it (600 s); `maxBufferSize` 60 MB; `backBufferLength` keeps played video (default unlimited). Quality: `hls.levels`, `hls.currentLevel` (switching it "flush[es] the whole buffer"), `hls.nextLevel`, `-1` for automatic. Subtitles: WebVTT, IMSC1, CEA-608/708. The doc never mentions SRT. |
| [Video.js 10](https://github.com/videojs/video.js) | `@videojs/react` 10.1.0, 13 Oct 2026; 10.0.0 was 1 Oct 2026 | Apache-2.0 | The interface is separate from playback. Playback comes from adapter packages: `@videojs/hlsjs-video` pins hls.js 1.6.19 and `@videojs/shaka-video` pins Shaka 5.2.4, both behind the latest. Engine settings pass through (`source.engine.shaka` / `source.engine.hlsJs`), and the engine object is reachable as `engine`. |
| [Media Chrome](https://github.com/muxinc/media-chrome) | 4.19.3, 28 Sep 2026 | MIT | Web-component controls only. Needs an engine such as `hls-video-element` (1.5.11). |
| [dash.js](https://github.com/Dash-Industry-Forum/dash.js) | 5.2.1, 17 Aug 2026 | BSD-3-Clause | DASH only. No reason to pick it over Shaka here. |

## The Plex part: quality, auto quality and subtitles

### Does Plex send several qualities in one session?

Probably not. The evidence, strongest first:

1. **The official spec** ([developer.plex.tv/pms](https://developer.plex.tv/pms/), API 1.2.3, extracted from the page on 14 Oct 2026):
   - `start.{m3u8|mpd}` takes one `videoBitrate` ("Target video bitrate") and one `videoResolution` ("Target maximum video resolution").
   - `autoAdjustQuality` "Indicates the client supports ABR". `peakBitrate` is "Maximum bitrate (in kbps) to use in ABR".
   - `POST /:/timeline` takes `bandwidth` ("Bandwidth in kbps as estimated by the client"), `bufferedTime`, `bufferedSize` and `timeStalled`.
   - Its reply can carry `Bandwidths`: "A list of media times and bandwidths when trascoding is using with auto adjustment of bandwidth". The spec's example shows 15,000 kbps at 1080p from time 0, then 12,000 kbps from about 17.5 minutes in.
   - Taken together: the client reports its speed and buffer, the server changes the bitrate it encodes at, and it reports the changes back.
2. **Plex's own explanation.** The 2017 blog post that launched auto quality, ["Smooth (Stream) Operator"](https://www.plex.tv/ru/blog/smooth-stream-operator/), puts the deciding part, the "Streaming Brain", in the server, adjusting all streams at once.
3. **Plex's support article** ([Automatically Adjust Quality](https://support.plex.tv/articles/115007570148-automatically-adjust-quality-when-streaming/), updated Jan 2022):
   - Auto quality needs Plex Media Server 1.8.1 or later and "requires that the content be transcoded".
   - It works between 192 kbps and 20 Mbps, and starts at the app's starting quality, adjusting after "20-60 seconds".
   - "If content is already directly playing at the original quality … Plex will not adjust the quality dynamically."
4. **Plex Web's own code** (app.plex.tv, version 4.162.1, minified JavaScript read on 14 Oct 2026):
   - "Convert Automatically" sends `autoAdjustQuality=1` with `directPlay` and `directStream` off.
   - It only offers the mode when the server reports `streamingBrainABRVersion >= 3`.
   - It shows the current quality by looking up the server's `Bandwidths` list for the playback position, not by asking its player which quality it is on.
   - It refuses its experimental HLS mode while auto quality is on ("disabled because automatic quality adjustment is enabled"), so Plex's own auto quality runs over DASH.
   - It bundles Shaka Player. Its default settings (`rebufferingGoal: 2`) point to an older Shaka release than 5.x.
5. **Plezy**, the most complete open-source Plex client ([plex_client.dart](https://github.com/edde746/plezy/blob/main/lib/services/plex_client.dart), GPL-3.0, read only):
   - It sends `autoAdjustQuality=0` and offers fixed presets from 320 kbps to 1080p at 20 Mbps, copied from Plex Web's quality table.
   - Changing quality starts a new transcode.

Not verified: what a `start.mpd` or `start.m3u8` manifest actually contains, and whether the server adapts for a third-party client that sends `autoAdjustQuality=1`. Nobody has published a captured manifest, and I did not start a transcode on the shared slot. A one-day test answers both (see "Next step").

### Who measures the connection

- **Plex's server-side auto quality:** the server decides. The timeline call lets the client pass its own estimate (`bandwidth`, `bufferedTime`). Plex Web's code doesn't send those fields, so the server presumably also judges from how fast segments are fetched (unverified).
- **Plex's newer apps** ([Quality Suggestions](https://support.plex.tv/articles/quality-suggestions/), Mar 2024; Plex HTPC, Android TV, Roku, consoles, smart TVs, but not Plex Web):
  - The client measures the speed and saves the last value per server.
  - It asks the viewer before changing quality: after 3 buffering pauses in a row it offers a lower quality, and when speed improves during a transcode it offers a higher one.
  - Each change starts a new transcode.

### Design for this app

**Quality list** (same steps as Plex Web and Plezy):
- Original
- 1080p: 20, 12, 10 or 8 Mbps
- 720p: 4, 3 or 2 Mbps
- 480p: 1.5 Mbps
- 720 or 320 kbps
- Auto

Hide presets above the file's own bitrate and resolution.

**Starting a session** (server side, in `src/server/services/plex.ts` behind `MediaServer`):
1. `GET /video/:/transcode/universal/decision` with:
   - `path=/library/metadata/{ratingKey}`, `mediaIndex`, `partIndex`
   - `X-Plex-Platform=Chrome` (Plex's browser profile), `X-Plex-Client-Identifier`, `X-Plex-Session-Identifier`, `session={uuid}`
   - `protocol=dash` or `hls` (decided by the test below)
   - For **Original**: `directPlay=1&directStream=1`. Plex picks direct play, direct stream or transcode.
   - For a **preset**: `directPlay=0&directStream=0&videoBitrate=…&videoResolution=…`. Plezy found that leaving out `videoResolution` keeps 4K sources at 2160p.
   - For **Auto**: as a preset at the starting bitrate, plus `autoAdjustQuality=1&peakBitrate=20000`.
2. Then `start.mpd` or `start.m3u8` with the same parameters, or `/library/parts/{partId}/…` when the decision is direct play.
3. Send `POST /:/timeline` every 10 s and on every play, pause or seek. Include `bandwidth` and `bufferedTime` from the player. Read `Bandwidths` to show "Now: 4 Mbps, 720p", the way Plex Web does.
4. While paused, call `/video/:/transcode/universal/ping?session=…`. It isn't in the spec, but Plex Web and Plezy both call it, because Plex otherwise shuts down an idle transcode.

**Manual quality change.**
- Stop the old session and start a new one with the same `X-Plex-Session-Identifier` and the chosen preset (Plezy reuses identifiers across switches).
- Load the new address in Shaka at the current time.
- Two ways to resume at the right place:
  - `offset={seconds}` on `start`.
  - Plezy's way: a manifest for the whole title, then a seek. Plezy found that `offset` plus a player that first reads segment 0 made Plex restart the transcode twice, which looked like endless buffering.
- The test picks one.
- Expect a pause of a few seconds while the transcoder starts. That matches Plex's own apps, which also restart (unverified figure).

**Auto quality, plan 1: Plex's own.**
- Send `autoAdjustQuality=1` and play the result in Shaka.
- Pass Shaka's speed estimate and buffer level in each timeline call.
- If the test shows the server changing bitrate mid-session for us, that's all the auto-quality code there is.

**Auto quality, plan 2: our own, if plan 1 fails.** A small controller in the browser:
- **Start:** pick the highest preset below 0.7 × the last measured speed for this device, saved in `localStorage`. With no saved speed, start at 1080p 8 Mbps.
- **Step down** one or two presets when the buffer ahead falls under 5 s while Shaka's estimate is under 1.2 × the current bitrate, or after 2 buffering pauses within 60 s.
- **Step up** one preset when the estimate has stayed above 1.8 × the next preset's bitrate for 60 s and the buffer is full.
- At least 60 s between changes, so the transcoder isn't restarted over and over on a shared processor.
- Each change is the same restart as a manual change.
- These thresholds are starting values to tune, not taken from a source.

**Original quality.**
- Auto quality can't apply: the file has one bitrate, and Plex's article says direct play is never adjusted.
- Copy Plex's Quality Suggestions: after 3 buffering pauses, offer to switch to a transcode at the current position.
- Start Original only when the measured speed is above about 1.3 × the file's bitrate. Plex's `mediaBufferSize` parameter feeds the same decision on the server.

**What it costs on the slot.**
- Auto quality and every preset are full video transcodes on the shared processor.
- A 4K HEVC source can't use them at all, because Whatbox bans that conversion. For those files the menu offers Original only, and only in browsers that can play HEVC.

### SRT subtitles

- **SRT in a separate file next to the video** (the Plex stream has a `key`):
  - `GET /library/streams/{id}.srt?encoding=utf-8` returns the file. The spec's `format` parameter converts text subtitles.
  - Plex Web loads them with `format: "srt"`.
  - Hand the address to Shaka as `text/srt`. Nothing is converted on the server.
  - Plex Web only does this in direct play ("Sidecar SRT is only supported when media is direct play"). Plezy also does it during transcodes.
  - The subtitle timing only lines up during a transcode if the stream's clock starts at 0 for the whole title. That is one more reason to prefer Plezy's whole-title manifest over `offset` (unverified).
- **SRT inside the MKV:**
  - The same call answers 501 for subtitles embedded in the video file. The spec says so, and Plezy's comments confirm it against a real server.
  - When Plex is producing a stream (direct stream or transcode): add `add-transcode-target(type=subtitleProfile&context=all&protocol=http&container=webvtt&subtitleCodec=webvtt)` to `X-Plex-Client-Profile-Extra` (the spec's own example) with `subtitles=segmented` or `sidecar`. Plex then delivers WebVTT alongside the video.
  - During direct play: the documented `GET /video/:/transcode/universal/subtitles` "Only transcode[s] subtitle streams" and returns `text/srt`. Plex Web uses it, and an undocumented `/subtitles/:/transcode/universal/start`.
- **Never use `subtitles=burn` for SRT.** Burning the text into the picture forces a full video transcode.

### Direct play in a browser compared with mpv

- **Browser.** Plays MP4 or WebM, and MKV in Chrome 145+ and Firefox 145+, with H.264, VP9 or AV1 video, AAC audio, and AC-3 depending on the browser. HEVC plays in Safari and on Macs (table in [media-servers.md](media-servers.md)).
- **Typical MKV release files.** DTS or TrueHD audio means direct stream, not direct play: Plex copies the video and converts the audio, which is cheap. HEVC in Firefox, or in Chrome without a hardware decoder, means a transcode. 4K HEVC there can't play at all.
- **Embedded subtitles in a direct-played MKV.** Not verified whether any browser exposes them to JavaScript. Fetch them from Plex as above.
- **mpv.** Plays all of it as is (MKV, HEVC, DTS, TrueHD, PGS, ASS), so Plex only sends the original file. Speed becomes the only limit: a 4K remux needs 40 to 80+ Mbps.

## Where the mini player lives in the web app

- `Home.tsx` wraps the current screen in `<div key={view === 'title' ? pathname : view}>` (`src/client/Home.tsx`, inside `<main>`). Every screen change gives that `div` a new key, so React destroys everything inside it. A player rendered inside a screen would stop on every navigation.
- `renderBar` (the downloads live bar) already sits outside that `div`, in the same `Home` return, and survives screen changes. The player goes beside it.

The arrangement:
- **Player state** (current item, Plex session, quality, position) lives in a React context provided above `Home`. `SignedIn` in `src/client/main.tsx` is where `DownloadsLiveBar`'s state lives today.
- **One `<video>` element and its Shaka instance** stay mounted outside the keyed `div`, next to `renderBar`. "Full player" and "mini player" are two CSS layouts of that same element: fixed to the whole window, or fixed to a corner above the live bar.
- Don't move the element between React parents: React would unmount it and playback would restart.
- If the full player gets an address such as `/play/…` in the view switch, that screen renders an empty placeholder and switches the shared player to full layout. It doesn't own the video.
- **Screen-change animation.** `changeScreen` in `src/client/navigation.ts` runs inside `document.startViewTransition` and can hold the old screen for up to `HOLD_MS` (350 ms) before the crossfade. During that callback the browser shows a still image of the page, so the mini player's picture may freeze briefly on every navigation while the sound carries on. I haven't tried this in this app. Giving the player its own `view-transition-name` keeps it out of the page crossfade, but probably not out of the freeze.

Two browser features can float the video outside the page:
- **Picture-in-Picture** (`video.requestPictureInPicture()`): a floating system window with only the video. Supported in Chrome 69+, Safari 13.1+ and Firefox 153+ ([MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLVideoElement.json)). Plain play and pause controls; our subtitle and quality menus don't show there. Shaka puts subtitles on the `<video>` element's own text tracks by default, and those generally display in this window (unverified for Shaka 5).
- **Document Picture-in-Picture** (`documentPictureInPicture.requestWindow()`): a floating window holding any HTML, so our React controls can move into it. Chrome and Edge 116+, Firefox 151+, not Safari ([MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/DocumentPictureInPicture.json)). It also avoids the screen-change freeze, because it's a separate window.

Recommended: the in-page corner player as the main mini player, plus a button for the system Picture-in-Picture window.

## Desktop and native options in more detail

**B. Tauri 2 or Electron around the web app, with mpv**
- **Ways to put mpv inside the window in 2026:**
  - [tauri-plugin-libmpv](https://github.com/nini22P/tauri-plugin-libmpv) (MPL-2.0, 0.3.2, last published 24 Nov 2025). Per a [Tauri discussion](https://github.com/orgs/tauri-apps/discussions/6343), this kind of setup positions a separate mpv window over an HTML element and moves it whenever the main window moves. Corners, overlays and a mini player over the web page are awkward that way.
  - [electron-mpv-video](https://github.com/yscoder/electron-mpv-video) (MIT, 0.1.1, July 2026) draws through mpv's render API into the page, so HTML controls can sit on top. It's a 0.1 release, tested against one Electron version, and you build libmpv yourself.
  - [mpv.js](https://github.com/Kagami/mpv.js) relies on a browser plugin system Electron no longer supports. Dead.
  - mpv's JSON IPC (`--input-ipc-server`, mpv's documented way for another program to control it) with mpv in its own window. Simplest and sturdy, but mpv isn't inside our window.
- **Prior art:**
  - Jellyfin Desktop runs the web interface in Qt WebEngine (Qt's built-in browser engine) with libmpv in the same window ([Flathub](https://flathub.org/apps/org.jellyfin.JellyfinDesktop)).
  - Plex HTPC and the Plex desktop app also use Qt plus mpv, according to a [packager's notes](https://negativo17.org/plex-desktop-and-htpc-client/) and Plex forum posts, not official Plex documentation.
  - Plezy uses libmpv via its own build of MPVKit.
- **Buffer:** `--cache-secs` sets seconds to prefetch. `--demuxer-max-bytes` caps memory (mpv's manual says the byte cap usually limits readahead in practice). `--demuxer-readahead-secs` applies only with the cache off. `--cache-on-disk` allows a buffer larger than memory ([options.rst](https://github.com/mpv-player/mpv/blob/master/DOCS/man/options.rst)).
- **SRT:** native (`--sub-file`, or the `sub-add` command at runtime).
- **Quality:** `--hls-bitrate` picks one HLS stream at start. mpv has no automatic switching, so auto quality is the same plan-2 controller as the web option, written against mpv's cache properties.
- **libVLC:** no maintained Electron or Tauri package found. WebChimera.js is marked abandoned.

**C. Native Mac app**
- AVPlayer can't open MKV, so Plex would have to repackage every MKV into HLS. That's a direct stream: cheap, but no longer the original file.
- AVPlayer has no support for a separate SRT file. Subtitles must arrive as WebVTT inside HLS, which Plex can do, or be drawn by our own code. This comes from general knowledge of AVFoundation, not a page I checked today.
- Buffer: `preferredForwardBufferDuration` ("If set to 0, the player will choose", macOS 10.12+). Bandwidth cap: `preferredPeakBitRate`. Floating window: `AVPictureInPictureController` (macOS 10.15+) ([Apple docs](https://developer.apple.com/documentation/avfoundation/avplayeritem/preferredforwardbufferduration)).
- MPVKit's own readme says it "is only suitable for learning `libmpv` and will not be maintained too frequently" ([MPVKit](https://github.com/mpvkit/MPVKit)). VLCKit wasn't checked.
- Every screen of the app would be rebuilt in Swift.

## Rough effort

For one developer, with tests, on this codebase. These sit inside the four-to-six-week Plex estimate in [README.md](README.md). They don't add to it.

| Piece | Size |
|---|---|
| Test against the slot: manifest shape, `autoAdjustQuality` for a third-party client, `offset` compared with seeking, embedded SRT as WebVTT | 1 day |
| Plex session calls on the server (decision, start, ping, stop, timeline) and the restart-at-position used by every quality change | 1 to 2 weeks |
| Pass-through route for manifests, segments and subtitles (already listed in codebase-fit.md as the largest piece) | about 1 week |
| Shaka player component, buffer setting, SRT loading, quality and subtitle menus | about 1 week |
| Auto quality: plan 1 is about a day of wiring; plan 2 (our own controller) is 3 to 5 days | 1 to 5 days |
| Mini player: lifting the player above the keyed screen, corner layout, Picture-in-Picture button | 2 to 4 days |
| Design file for the player and mini player first (the owner's design-before-code rule) | 3 to 5 days |

Desktop with mpv: all of the server work above, plus the desktop shell, embedding mpv, a desktop sign-in, Mac signing and notarisation (Apple's check that lets an app open without warnings), and updates. Roughly 6 to 10 weeks (unverified, nobody has scoped it). Native Mac: months.

## Risks

- **Plex's auto quality may not work for us.** It's documented only as a flag ("the client supports ABR"). Plex Web uses it over DASH, and a third-party DASH client hit unexplained 400 errors on `start.mpd` ([forum thread](https://forums.plex.tv/t/universal-transcoder-start-mpd-returns-400-when-called-from-custom-player/933458), Nov 2025, unanswered). Plan 2 doesn't depend on it.
- **Quality changes restart the transcoder.** Each one is a pause of a few seconds and a new conversion on the shared processor. The 60-second minimum between automatic changes limits this.
- **Calls Plex can change without notice.** The ping call and the session segment addresses are outside the official spec ("paths that aren't documented here aren't part of the API contract").
- **The buffer setting has a ceiling in the browser.** A browser keeps the buffer in memory and refuses more data when full (hls.js documents the `QuotaExceededError` this raises). At 20 Mbps, ten minutes ahead is about 1.5 GB, which a browser won't hold (exact limit per browser not checked). Plex's transcoder also produces video only so far ahead of the player. Plex has a server setting for this, which I remember as "Transcoder default throttle buffer" (unverified). A setting in minutes makes sense for direct play; for transcodes the server limits it. Only mpv can buffer to disk.
- **The screen-change freeze** described above, if it shows in practice.
- **Video.js 10 is new.** 10.0.0 shipped on 1 Oct 2026 and its adapters pin older hls.js and Shaka releases. Shaka on its own avoids that dependency. Moving to Video.js later is possible because it wraps the same engine.
- **Not checked:** whether the slot's Plex reports `streamingBrainABRVersion` 3 or higher. Plex Web needs that before it offers auto quality. I couldn't find the server's settings file over ssh to read it without printing the token.

## Next step

The one-day test above, run against the slot's Plex through the app's server. It answers the open Plex questions before any interface is designed:
- one quality or several per manifest;
- whether the server changes bitrate mid-session when we send `autoAdjustQuality=1` and report bandwidth;
- how long a restart at a new position takes;
- whether embedded SRT arrives as WebVTT.

It starts real transcodes on the shared processor, so it needs the owner's go-ahead and should use a 1080p H.264 file, never 4K HEVC.
