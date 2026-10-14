# Watching inside the app: feasibility study

14 Oct 2026. Combines two research reports in this folder:

- [media-servers.md](media-servers.md): how Plex, Jellyfin and Emby handle playback, quality, subtitles and progress; the no-media-server option; player libraries; browser format support. Includes read-only checks run on the Whatbox slot over ssh.
- [codebase-fit.md](codebase-fit.md): what the app has today and where a player would go, with file:line evidence.

**Update, same day:** the owner chose Plex, not Jellyfin. Two follow-up reports cover that:

- [plex-terms.md](plex-terms.md): whether the player fits Plex's terms.
- [player-stack.md](player-stack.md): language, libraries, and how quality, subtitles and the mini player would work against Plex.

The Jellyfin recommendation below stands as research but is no longer the plan.

## Decision, 14 Oct 2026

- **Plex only.**
- **A desktop app built with Electron**, running on the owner's computer and connecting to the app and Plex on the slot. It plays the original file with mpv, so normal playback puts no conversion load on Whatbox. This rules out [player-stack.md](player-stack.md)'s recommendation of a player in the website. Its desktop section and the mpv details there still apply.
- **No playback tests on the slot.** Whatbox doesn't want resource-heavy programs running on shared slots.
- **Quality: original file by default, a quality setting in the player for the rest.** Picking a lower quality asks Plex on the slot to convert, and the player plays whatever stream comes back. The owner has run Plex conversions on the slot before. Whatbox's rules still ban converting 4K HEVC ([aa-8-whatbox-hosting.md](../aa-8-whatbox-hosting.md)), so for those files the setting would offer only Original, or a lower-quality second version if one exists.
- **HDR must not look grey on a non-HDR screen.** Many of the owner's files are HDR, and the Plex app shows them with correct colour on a laptop without an HDR display. Ours must too. Confirmed 14 Oct: Plex's dashboard shows these files as Direct Play, so the Plex app does the conversion on the laptop and Whatbox only sends the file. That means tone mapping on the owner's computer: converting HDR colour to normal colour while playing. mpv does this when the screen isn't HDR (unverified for the way it would be embedded in Electron). Dolby Vision files need checking separately: shown without Dolby Vision support, some of them come out green and purple.
- **mpv test on the owner's MacBook Pro, 14 Oct** (mpv 0.41 with its `gpu-next` video output, original files streamed from the slot's Plex over its plex.direct address):
  - Arrival (Dolby Vision profile 5, 4K HEVC, DTS-HD 7.1) and The Fantastic Four: First Steps (Dolby Vision profile 10, 4K AV1) looked the same as the Plex app. Profile 5 is the type that turns green and purple in players without Dolby Vision support.
  - Hereditary (Dolby Vision profile 7, 76 Mbps remux) played. mpv reported converting PQ / BT.2020 HDR to BT.709 / gamma 2.2 for the screen, so it does the tone mapping itself. mpv skips profile 7's enhancement layer, an optional second video layer that adds detail on top of the HDR10 base picture.
  - Arrival ran 14 minutes with 4 dropped frames, the buffer holding 53 seconds (94 MB) against 60 requested, DTS-HD audio decoded on the Mac, and SRT subtitles shown.
  - This Mac has no hardware AV1 decoder, so the AV1 file used the processor: 9 dropped frames in the first 20 seconds. Needs a longer run.
  - The repeated "Multiple Dolby Vision RPUs found" warnings (RPU is the Dolby Vision colour data attached to each frame) did not affect the picture.
  - Bugonia (Dolby Vision profile 8, E-AC-3 5.1) ran 24 minutes with no dropped frames reported, buffer 36 seconds (117 MB). The Devil Wears Prada (HDR10, DTS-HD) played with a 49-second buffer.
  - The AV1 file dropped 16 frames in its first minute. Hereditary (76 Mbps remux) dropped 22 frames in its first 30 seconds and held only 15 seconds of buffer (150 MB): at that bitrate the connection from the slot barely keeps ahead.
  - Several files carry PGS (picture-based Blu-ray) subtitles. mpv shows these itself, which a browser can't.
- **Open: how mpv sits in the window.** The only package found that draws mpv inside an Electron page is electron-mpv-video 0.1.1, two releases old. The fallback is mpv in its own window, controlled by the app; the mini player would then be a small mpv window kept on top.

The desktop-app section below was added after the owner asked about it. Neither report researched it, so its claims are marked where unverified.

## Answer

Yes, it's feasible. The app already stores the address and sign-in details for the owner's Plex or Jellyfin server, and both servers already run on the slot.

The limit is the slot's processor, not the code:

- A web browser can't play many typical release files as they are: MKV files, DTS or TrueHD audio, picture-based subtitles (PGS), and HEVC video in Firefox and some Chrome setups.
- For those files the server must convert the video while it plays (transcoding). The slot has no graphics chip to help, so every conversion runs on a processor shared with other Whatbox customers.
- Whatbox bans converting 4K HEVC, and shuts down media servers that use too much processor time ([Whatbox Emby page](https://whatbox.ca/wiki/Emby)).
- The Plex apps on a TV, phone or Mac avoid this because the device itself plays the original file (direct play). The server just sends it.

That gives two routes.

## Route 1: a player inside the website, using Jellyfin

Recommended order: Jellyfin first, Plex second behind the same screens, Emby only if asked for, no media-server-free version.

**Why Jellyfin first**
- Every call is documented and open source, and the official TypeScript library reached 1.0 in September 2026.
- No paywall. The terms don't restrict other apps.
- Jellyfin decides per file whether to send it as is, repackage it (cheap), or fully convert it (expensive).
- Watch progress is saved in Jellyfin, so it stays in step with the owner's other Jellyfin apps.

**Why Plex second, not first**
- Plex published an official reference for its playback calls in September 2025, and the owner's lifetime Plex Pass covers the 2025 remote-streaming paywall.
- But the calls that keep a conversion running and stop it are still undocumented. Other developers' browser players hit errors nobody has explained.
- Plex's terms forbid software that "performs substantially the same functionality" as Plex, and expect the server to run on hardware "that you own". A rented seedbox doesn't fit that wording. No sign Plex enforces it against seedboxes (unverified).

**Why not skip the media server**
- Sending files straight from our own server is small work. Making them play in a browser means rebuilding Jellyfin's conversion, seeking, quality and subtitle code, about 12,000 lines.

**What the build involves** (from codebase-fit.md)
- A server route that passes video from Jellyfin through to the browser. The browser can't be given the Jellyfin key, Plex is only reachable from inside the slot, and the app runs on HTTPS. This is the largest single piece. The current request helper gives up after 10 seconds and only reads JSON, so it needs a streaming version.
- Matching our episodes and movies to the media server's items, by file path first (everything shares one machine).
- Keeping the owner's Jellyfin sign-in token, which sign-in currently throws away (`src/server/services/jellyfin.ts:153`). Progress can't be saved without it.
- A player screen with quality and subtitle menus and a resume prompt. Player libraries: hls.js for playback, JASSUB for styled subtitles, libbitsub for picture subtitles.
- A new `.pen` design file before any of that UI is coded.
- Rough size: four to six weeks of build time for one server, with tests. The two reports used different size scales; this combines them and is a rough guide.

**What it can't fix**
- Files that need full conversion stay slow to start and slow to seek. 4K HEVC can't be converted at all on Whatbox, so it only plays in browsers that handle it natively (Safari, Chrome on a Mac).
- Browsers can't pass surround sound untouched to an amplifier. DTS and TrueHD get converted.
- Fancy subtitles don't show in iPhone fullscreen.
- All video would pass through Cloudflare. Its terms for video weren't checked.

## Route 2: a desktop app that talks to the app on Whatbox

The owner asked whether a local app could connect to the server on Whatbox, like the Plex app. Neither report researched this. The points below come from general knowledge of the tools named and need checking before anyone builds.

A local player plays nearly any file as is, so Whatbox only sends the original file. That removes the processor problem and most of the hard parts of Route 1: the conversion, the pass-through route, and the picture-subtitle and surround-sound gaps. Bandwidth is the new limit: a 4K remux (a full-quality copy of a Blu-ray) needs 40 to 80+ Mbps of steady download at your end.

Three ways to build it, smallest first:

1. **Hand the file to a player you already have.** A Play button in the website opens the file in mpv, IINA or VLC. mpv can report the playing position back, so progress can still be saved to Jellyfin or Plex (unverified for this setup). Small. You get that player's controls, not ours.
2. **Wrap the existing website in a Mac app** (Tauri or Electron turn a website into a desktop app) and play video in mpv, which handles every format. Every screen stays the same. Medium to large: putting mpv inside the app window is the hard part. Jellyfin's own desktop player is built this way (unverified).
3. **A fully native Mac app.** Every screen rebuilt. Largest.

Both server-side needs are small: a way for the desktop app to sign in (the app only knows website sign-ins today), and an endpoint that gives it the file's direct address on Plex or Jellyfin.

## Open questions for the owner

- Browser or desktop? Route 1 works on any device, including a phone, and has the limits above. Route 2 plays everything but only where the desktop app is installed.
- Is it worth upgrading the slot's Jellyfin from 10.11 to 12 first? The official TypeScript library targets version 12. The app's sign-in already uses the format version 12 requires.
- Could not verify: the details listed under "Could not verify" at the end of [media-servers.md](media-servers.md), plus Cloudflare's terms for video and Whatbox's traffic limits.
