# media-manager-2 on the Google TV Streamer and the Apple TV 4K

Researched 31 Oct 2026. Research only: no app code was written. Builds on [in-app-player/README.md](in-app-player/README.md) (the 27 Oct desktop decision) and [in-app-player/plax-lessons.md](in-app-player/plax-lessons.md).

The owner's "Google Streambox" is Google's product named Google TV Streamer (4K), sold since 2024.

Words used below:
- **D-pad**: the remote's four arrow buttons plus the centre OK button.
- **Direct play**: the player fetches the original file from Plex unchanged. Plex only sends bytes.
- **Direct stream (remux)**: Plex copies the video unchanged into a different container (for example MKV into HLS, Apple's streaming format), sometimes converting only the audio. Light work on the slot, but the player no longer gets the original file.
- **Sideloading**: installing an app from a file instead of from the store. On Android the file is an APK, installed with ADB (Android Debug Bridge, Google's command-line tool for talking to a device).
- **WebView**: an Android component that shows a web page inside an app.
- **DV**: Dolby Vision. **PGS**: picture-based Blu-ray subtitles.

## Short answer

- **Google TV Streamer: the existing web app can run on it.** Android has a WebView, so a small Android app can load the owner's media-manager-2 address and hand video to a native player through a JavaScript bridge. That is the same split the desktop app uses today (web page plus mpv over a bridge).
- **The native player on Google TV should be Media3 (ExoPlayer), not mpv.** Media3 reads MKV, Dolby Vision configuration in MKV, TrueHD, DTS, PGS and VobSub, and uses the box's own decoders, so the TV receives a real Dolby Vision signal. mpv states it does not send Dolby Vision metadata to the display.
- **Apple TV 4K: no web route.** Apple's documentation lists WKWebView and the whole WebKit framework for iOS, macOS and visionOS, not tvOS. TVMLKit, Apple's old JavaScript-based TV framework, is deprecated in tvOS 18. Any Apple TV app means rebuilding the screens natively (SwiftUI) or in React Native for TV.
- **Apple's own player (AVPlayer) cannot open MKV.** Direct play of the owner's MKV originals on Apple TV needs a third-party engine (AetherEngine, VLCKit or libmpv builds). Only AetherEngine claims real Dolby Vision output on Apple TV; VLCKit and libmpv convert the colours themselves.
- **One codebase for both is possible (react-native-tvos), but it shares little with today's app.** The 145 screen files in `src/client` (about 19,700 lines) are React for the browser and would be rewritten. Each device still needs its own native player.
- **On a TV, watching is the job.** Managing downloads stays on the desktop and phone. The "watching on a phone is v3 or v4" note the caller remembered exists only on the unmerged branch `claude/phone-watching-priority` (commit `905645f`, 15 Oct); `main`'s `PRODUCT.md` does not mention TV or phone watching at all.
- **Keep both apps personal.** Google TV: install over ADB, no fee. Apple TV: a free Apple account works but the app stops launching after 7 days; the paid $99 a year account plus TestFlight gives 90-day builds. Avoid the App Store: guideline 5.2.3 bars apps that "facilitate illegal file sharing".

## What the app has today (from the code)

- One Hono server and a React single-page app built with Vite (`PRODUCT.md`, Stack). `src/client` holds 145 `.tsx` screen and component files (about 19,700 lines) and 35 plain `.ts` files (about 5,000 lines); 11 of those 35 use browser-only objects (`document`, `window`, `localStorage`, `EventSource`).
- Sign-in: the server starts a Plex "strong" PIN with a signed device key (`src/server/auth.ts:280-292`), sends the browser to `app.plex.tv/auth` in a popup or a full-page redirect (`src/client/plexPopup.ts`), then sets an `httpOnly`, `SameSite=Lax` cookie (`src/server/app.ts:171`). Sessions last 24 hours (`src/server/auth.ts:28`).
- Every sign-in POST must carry the app's own `Origin`, `X-Requested-With: media-manager-2` and JSON (`src/server/app.ts:231-243`). A WebView sends these like a browser; a native client would have to set them.
- Playback: `POST /api/playback/start` returns Plex stream addresses carrying a short-lived `transient-` Plex token (`src/server/playback.ts:73-151`, `src/server/services/plexPlayback.ts:88-90`). The desktop app's bridge (`src/client/desktopBridge.ts`, `desktop/preload.js`) keeps those addresses away from the page and drives mpv.
- Remote control: arrow keys are handled inside some widgets (`Home.tsx`, `Search.tsx`, `discover/Row.tsx`, `calendar/Calendar.tsx` and others), but there is no page-wide D-pad focus movement. 40 client files use hover styles, which a remote cannot trigger.
- Licence: `desktop/package.json` says `GPL-3.0-only`. The repository root has no `LICENSE` file and the root `package.json` has no `license` field.

## Google TV Streamer

### The device

- Google's spec sheet: 4 GB memory, 32 GB storage, "Up to 4K HDR, 60 FPS", Dolby Vision, HDR10, HDR10+ and HLG, audio "Dolby Digital, Dolby Digital Plus, and Dolby Atmos", HDMI 2.1, gigabit Ethernet, operating system "Android TV OS" with no version number ([Google TV Streamer tech specs PDF, Google press kit, 1 Aug 2024](https://cdn.uc.assets.prezly.com/d539077d-5078-4fd7-a9e5-4aa5cab14d6c/-/inline/no/Google%20TV%20Streamer%20Tech%20Specs.pdf); [Google Store spec page](https://store.google.com/product/google_tv_streamer_specs)).
- The remote has a D-pad, Select, Back, Home and Play/Pause, and no Menu button (same PDF).
- Not on Google's sheet: AV1, DTS or TrueHD support, and the Android version. Press reports say it shipped with Android 14 for TV ([Android Authority](https://www.androidauthority.com/google-tv-streamer-android-14-for-tvs-3469245); secondary source only).
- Developer options and installing unknown apps follow the normal Android steps; Google publishes no Streamer-specific page that was found. ADB installs are unaffected by Android's new developer verification: "Apps installed using ADB won't require verification" ([developer verification FAQ](https://developer.android.com/developer-verification/guides/faq)).
- Developer verification starts 30 Sep 2026 in Brazil, Indonesia, Singapore and Thailand, and Google says "enforcement will only apply to mobile and tablet form factors in the selected regions"; it expands worldwide from 2027 ([developer verification](https://developer.android.com/developer-verification), [FAQ](https://developer.android.com/developer-verification/guides/faq)). A free "limited distribution" account covers up to 20 devices "for testing and personal use".

### Ways to build the app

| Route | What it is | D-pad focus |
|---|---|---|
| WebView wrapper | A small Kotlin app whose main screen is a WebView loading the owner's address. Native code is exposed to the page with `addJavascriptInterface` ([WebView guide](https://developer.android.com/develop/ui/views/layout/webapps/webview)). | The web app must move focus itself. Plax had to: it replaced a 1,000-line per-screen focus map with a 250-line geometric one, then added focus zones ([Plax ADR 0001](https://github.com/aa-hh/Plax/blob/main/docs/adr/0001-geometric-focus-navigation.md)). |
| Trusted Web Activity | Opens the site in a browser that supports the TWA protocol, Chrome 72 or later ([Chrome docs](https://developer.chrome.com/docs/android/trusted-web-activity/)). Google's helper library falls back to `customtabs` or `webview` when no such browser exists ([android-browser-helper source](https://github.com/GoogleChrome/android-browser-helper/blob/main/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/LauncherActivityMetadata.java)). | Same as WebView. Adds nothing on a TV that may have no Chrome (whether the Streamer has a TWA-capable browser was not verified). |
| Capacitor | A WebView app shell; same result as the WebView wrapper with more tooling. Not researched further. | Same as WebView. |
| Compose for TV | Google's recommended toolkit: "the modern approach for building Android TV user interfaces", `androidx.tv:tv-material` ([Compose for TV](https://developer.android.com/training/tv/playback/compose)). Leanback, the older toolkit, is listed as deprecated with a migration guide ([migrate from Leanback](https://developer.android.com/training/tv/playback/leanback/migrate-to-compose)). | Built in: components have "clear focus indicators and remote-friendly input behavior". |
| react-native-tvos | A fork of React Native "with only the changes needed to support Apple TV and Android TV"; minimum Android API 24 ([repo](https://github.com/react-native-tvos/react-native-tvos)). Expo supports it ([Expo TV guide](https://docs.expo.dev/guides/building-for-tv/)). | `TVFocusGuideView` and `useTVEventHandler` (same repo). |

Every TV app must declare the touchscreen as not required, or it will not install or show on the TV launcher ([TV hardware guide](https://developer.android.com/training/tv/get-started/hardware)). Google's TV quality rules also require the `LEANBACK_LAUNCHER` category, a 320x180 banner, everything reachable with a "five-way D-pad", nothing depending on a Menu button, and video paused when the user leaves the app ([TV app quality](https://developer.android.com/docs/quality-guidelines/tv-app-quality)).

### Playing the original file

**Media3 (ExoPlayer)**, Google's player library, Apache 2.0 ([licence](https://github.com/androidx/media/blob/release/LICENSE)). Latest release 1.11.1, 10 Sep 2026 ([release notes](https://github.com/androidx/media/blob/release/RELEASENOTES.md)).
- MKV: supported for direct files ([supported formats](https://developer.android.com/media/media3/exoplayer/supported-formats)). Its MKV reader recognises HEVC, AV1, TrueHD, DTS, DTS-HD, FLAC, SRT, ASS, PGS and VobSub tracks, and reads the Dolby Vision configuration blocks (`dvcC`, `dvvC`) from MKV files ([MatroskaExtractor.java](https://github.com/androidx/media/blob/release/libraries/extractor/src/main/java/androidx/media3/extractor/mkv/MatroskaExtractor.java), lines 155-189 and 312-321 on 31 Oct 2026).
- Video decoding uses the box's own decoders, so what plays "depend[s] on the underlying platform". Dolby Vision display "depends on support from the Android platform and device" (supported formats page). Media3 added Dolby Vision profile 10 in 1.10.0 (25 Mar 2026), and prefers another decoder when the display lacks Dolby Vision (1.0.0-beta03) (release notes).
- Audio: AC-3, E-AC-3, DTS, DTS-HD and TrueHD can be decoded in software by the optional FFmpeg extension (supported formats page). The extension is audio only, and FFmpeg's own licence depends on how it is built ([decoder_ffmpeg](https://github.com/androidx/media/tree/release/libraries/decoder_ffmpeg)). Google's spec lists only Dolby formats for the Streamer, so DTS and TrueHD likely get decoded to PCM in the app rather than passed to an amplifier (passthrough on this box not verified).
- Subtitles: PGS and VobSub parsers are in Media3 ([PgsParser.java](https://github.com/androidx/media/blob/release/libraries/extractor/src/main/java/androidx/media3/extractor/text/pgs/PgsParser.java), [VobsubParser.java](https://github.com/androidx/media/blob/release/libraries/extractor/src/main/java/androidx/media3/extractor/text/vobsub/VobsubParser.java)).
- It plays a plain HTTPS address, so it can take the same `*.plex.direct` address with the transient token that mpv gets today. Video never touches Cloudflare.

**libmpv on Android.** mpv-android is an MIT-licensed player app, "not a library/module (AAR) you can import into your app"; it points to its `MPVLib` and native code as reference ([mpv-android](https://github.com/mpv-android/mpv-android)). libmpv itself is GPLv2 or later by default, LGPL when built with `-Dgpl=false` ([mpv Copyright](https://github.com/mpv-player/mpv/blob/master/Copyright)). Its HDR passthrough mode "does not send full HDR10+ or Dolby Vision metadata, but uses that information to produce HDR10" ([mpv options manual](https://github.com/mpv-player/mpv/blob/master/DOCS/man/options.rst), `--target-colorspace-hint-mode`). On a Dolby Vision TV that is a step down from Media3.

Both keep the rule of direct play from Plex. Media3 also keeps Dolby Vision as Dolby Vision; mpv covers more odd formats.

### Getting it onto the device

- Personal: build an APK and `adb install` it over the network. No fee, no review, not affected by developer verification (FAQ above).
- Google Play: US$25 one-time ([Play Console help](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)). New personal accounts must run a closed test with "a minimum of 12 testers" for 14 days before production; internal testing is exempt ([testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). TV apps are checked against the TV quality rules above, and those that pass "appear on the Play Store on TV devices immediately" (TV app quality page).

## Apple TV 4K

### The device

- Apple's spec page now covers the Apple TV 4K (4th generation) with an A19 chip, 128 GB: Dolby Vision "Profile 8.1 and 5", HDR10, HDR10+, HLG; AV1, VP9, HEVC, H.264; Dolby Atmos, AC-3, E-AC-3; HDMI 2.1 and gigabit Ethernet ([Apple TV 4K specs](https://www.apple.com/apple-tv-4k/specs/), read 31 Oct 2026). Which generation the owner has is unknown.
- No DTS or TrueHD on that list, and Dolby Vision profile 7 (UHD Blu-ray remuxes) is not listed.

### No web views on tvOS

- Apple's documentation lists WKWebView for iOS, iPadOS, Mac Catalyst, macOS and visionOS only ([WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)); the WebKit framework page has no tvOS either ([WebKit](https://developer.apple.com/documentation/webkit)). react-native-tvos confirms its tvOS build suppresses web views (repo README).
- So no wrapper around the existing web app is possible. Every screen shown on Apple TV must be rebuilt.

### Ways to build the app

- **SwiftUI or UIKit**: Apple's own recommendation in the TVMLKit deprecation notice. tvOS moves focus between items with the remote; Apple asks apps to "rely on system-provided focus effects" ([Focus and selection, Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)). SwiftUI's `focusable(_:)` is available from tvOS 15 ([docs](https://developer.apple.com/documentation/swiftui/view/focusable%28_%3A%29)).
- **TVMLKit / TVMLKit JS**: "deprecated in tvOS 18 and later. Instead, develop apps for tvOS with SwiftUI or UIKit" ([TVMLKit](https://developer.apple.com/documentation/tvmlkit), [TVMLKit JS](https://developer.apple.com/documentation/tvmljs)). Ruled out.
- **react-native-tvos**: minimum tvOS 15.1; `TVFocusGuideView` wraps Apple's `UIFocusGuide` ([repo](https://github.com/react-native-tvos/react-native-tvos)). Expo needs Xcode 16 and the tvOS 17 SDK, and some Expo account features do not work on Apple TV yet ([Expo TV guide](https://docs.expo.dev/guides/building-for-tv/)).
- **Flutter**: not supported. Flutter's platform list (3.47) has no tvOS or Android TV ([supported platforms](https://docs.flutter.dev/reference/supported-platforms)).

### Playing the original file

**AVPlayer (Apple's player) cannot open MKV.** Apple publishes no sentence saying so, but its list of AVFoundation file types has MOV, MP4, M4V, 3GP and audio types, and no Matroska ([AVFileType](https://developer.apple.com/documentation/avfoundation/avfiletype)). Apple's HLS rules allow H.264, HEVC, Dolby Vision and AV1 video in fMP4 (fragmented MP4), Dolby Vision profile 5 and profile 10 as base profiles (8.1 and 8.4 described alongside an HEVC base), and AAC, ALAC, FLAC, AC-3 and E-AC-3 audio; DTS and TrueHD do not appear, and tvOS subtitles "MUST be WebVTT" ([HLS authoring specification, revised 26 Jun 2025](https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices)).

That leaves four ways to play the owner's files:

| Way | Original file? | Dolby Vision on the TV | Licence |
|---|---|---|---|
| AVPlayer with Plex direct stream (Plex repackages the MKV for Apple, converting DTS or TrueHD audio) | No. Plex rewraps it on the slot: light work, but not direct play. | Profiles 5 and 8.1 per Apple's spec page. | Apple's own. |
| AetherEngine: FFmpeg reads the file, Apple's decoder and AVPlayer show it ([README](https://github.com/superuser404notfound/AetherEngine)) | Yes. Lists MKV, PGS, TrueHD and DTS-HD. | Claims profiles 5, 7 (as 8.1), 8.1, 8.4 and 10 with a real display switch, and Atmos passed through. These are the project's own claims, not tested here. | LGPL 3.0 plus an App Store and TestFlight exception ([LICENSE](https://github.com/superuser404notfound/AetherEngine/blob/main/LICENSE)). Started Apr 2026, release 7.53.0 on 30 Oct 2026: young and moving fast. |
| VLCKit (TVVLCKit) | Yes. tvOS 10.2 and later ([VLCKit README](https://code.videolan.org/videolan/VLCKit/-/blob/master/README.md)). | No: converts HDR itself (AetherEngine's comparison table; not checked against VideoLAN's own docs). | LGPL 2.1 or later. |
| libmpv (MPVKit) | Yes. Builds for iOS, macOS and tvOS ([MPVKit](https://github.com/mpvkit/MPVKit)). | No: mpv does not send Dolby Vision metadata (mpv manual above). | LGPL 3.0, or GPL 3.0 for the `-GPL` builds. MPVKit says it "is only suitable for learning `libmpv`", its Metal output is an unofficial patch, and upstream mpv has no tvOS build target (only `ios-gl` in [meson.build](https://github.com/mpv-player/mpv/blob/master/meson.build)). |

Strictly, the 27 Oct rule (Plex sends the original file, the device does the work) is kept on Apple TV only by the third-party engines, and only AetherEngine also keeps Dolby Vision as Dolby Vision.

### Licences and the App Store

- The owner is the only copyright holder of media-manager-2's own code, and "the developer itself is not bound by" the GPL ([GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html#DeveloperViolate)). The constraint is code from others bundled into the app.
- Personal installs are not a release: "You are free to make modifications and use them privately, without ever releasing them" ([GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html#GPLRequireSourcePostedPublic)).
- App Store: the FSF said in May 2010 that App Store terms impose restrictions that violate GPLv2 section 6, and Apple removed GNU Go rather than change them ([FSF](https://www.fsf.org/news/2010-05-app-store-compliance)). VLC for iOS was pulled in January 2011 after a VLC developer complained (news reports only, e.g. [9to5Mac](https://9to5mac.com/2011/01/07/vlc-for-ios-removed-from-the-app-store/); no VideoLAN statement found). VideoLAN moved libVLC to LGPL 2.1 on 21 Dec 2011 ([VideoLAN press release](https://www.videolan.org/press/lgpl-libvlc.html)), and VLC for iOS and tvOS is now dual-licensed GPLv2 or later and MPLv2 ([COPYING](https://code.videolan.org/videolan/vlc-ios/-/blob/master/COPYING)).
- So a GPL-only libmpv build does not belong in an App Store app; LGPL engines (VLCKit, AetherEngine, LGPL MPVKit) are what other store apps use.

### Getting it onto the device

- Free Apple account ("Personal Team"): up to 3 devices and 3 apps per device, and provisioning profiles "expire 7 days from issuance. You'll need to rebuild and reinstall" ([compare memberships](https://developer.apple.com/support/compare-memberships/)).
- Apple Developer Program: 99 USD a year ([what's included](https://developer.apple.com/programs/whats-included/)). TestFlight covers tvOS, builds last 90 days, and review is tied to external testers; up to 100 internal testers ([TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview), [TestFlight](https://developer.apple.com/testflight/)).
- App Store review risks ([App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)):
  - 5.2.3: "Apps should not facilitate illegal file sharing or include the ability to save, convert, or download media from third-party sources … without explicit authorization." A client that grabs torrents from private trackers sits squarely here.
  - 5.2.2: apps that use a third-party service must be "specifically permitted to do so under the service's terms of use". Plex's terms are covered in [in-app-player/plex-terms.md](in-app-player/plex-terms.md).
  - 2.1(a): review needs a demo account and a live back end, which means exposing the owner's server to Apple.
  - A watch-only app with no download controls would avoid 5.2.3's wording, but still needs 2.1(a). Personal TestFlight avoids all three.

## Both devices

### One codebase?

- react-native-tvos builds for both from one JavaScript codebase, and Expo supports it (sources above).
- What carries over from `src/client`: the API calls and plain logic in the 35 `.ts` files, minus the 11 that use browser-only objects. The 145 `.tsx` files use React for the browser (`react-dom`, Tailwind, Base UI) and would be rewritten with React Native components.
- The player does not carry over either way: Media3 on Android, an Apple-side engine on tvOS, each wired in natively.
- The server carries over whole. A TV app is one more client of the same API, plus the sign-in changes below.
- The Android WebView route reuses every screen as is, plus the desktop bridge's contract (`src/client/desktopBridge.ts`) for the player. It only helps Google TV.

### Which parts belong on a TV

- `PRODUCT.md` (main): the owner works "mostly at a desktop browser searching, picking releases and managing files; on a phone to check status and make quick grabs". Nothing about TVs.
- The unmerged `claude/phone-watching-priority` branch adds: "watching on a phone (the in-app player and watch status on a phone are v3 or v4…)". TV is not mentioned there either.
- A TV app's natural scope is the player and the screens that lead to it: library, title pages with Play, watch status (Continue Watching, played marks). Pick a release, tracker rules, settings and the flagged page are dense, keyboard-and-mouse screens; on a remote they cost the most focus work for the least use.
- On the WebView route all screens come along for free, but each still needs D-pad focus to be usable. Hiding the management screens on the TV is cheaper than making them remote-friendly.

### Signing in from a TV

- In the WebView wrapper, today's sign-in works unchanged in principle: with no popup, `plexPopup.ts` sends the page itself to Plex and back. But typing a Plex password with a D-pad is slow, and if the owner signs in to Plex with Google, Google forbids its sign-in inside "an embedded user-agent under the developer's control" ([Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies), "Use secure browsers").
- Sessions last 24 hours (`src/server/auth.ts:28`), so a TV would ask for sign-in daily. A TV needs a longer-lived session tied to that device, revocable from the web app.
- Prior art for a code on the TV:
  - Plex's own: Plax requests a 4-character PIN (`strong: false`) and the user types it at plex.tv/link, then Plax polls every 2 seconds for up to 4 minutes ([plax-lessons.md](in-app-player/plax-lessons.md) section 1). The server already runs Plex PINs (strong ones); it would need the short-code kind and then the same owner check it does today.
  - The OAuth device authorization grant: the TV shows a code, the owner approves it on a device that is already signed in ([RFC 8628](https://www.rfc-editor.org/rfc/rfc8628)). Here that means a "Sign in a TV" screen in the web app, with no Plex involvement.
- A native client (React Native or Swift) must also send the `Origin` and `X-Requested-With` headers the server checks, or get its own sign-in routes.

## Options ranked by effort

Effort is a rough estimate from the evidence above, not a measured build.

| Rank | Device | Option | Keeps direct play of originals | Keeps Dolby Vision as Dolby Vision | Effort |
|---|---|---|---|---|---|
| 1 | Google TV | WebView wrapper loading the existing site, sideloaded over ADB, no player yet. Proves the page, sign-in and remote on the real box. | n/a | n/a | Small |
| 2 | Google TV | Add Media3 behind a JavaScript bridge shaped like `desktopBridge.ts`, plus D-pad focus in the web app for the watching screens | Yes | Yes (per Google's specs; to test) | Medium |
| 3 | Apple TV | SwiftUI test app on a free account: one hard-coded Plex file played through AetherEngine and through AVPlayer with Plex direct stream, checked on the owner's TV | Yes (AetherEngine) | Claimed (AetherEngine) | Small |
| 4 | Apple TV | SwiftUI watch-only app (library, title, Play, watch status) with the engine chosen in rank 3, via TestFlight | Depends on rank 3 | Depends on rank 3 | Large |
| 5 | Both | react-native-tvos app, screens rewritten, native player per device | Yes | Yes with Media3 and AetherEngine | Largest |

Cheapest first step per device: Google TV, rank 1. Apple TV, rank 3; its result decides whether rank 4 is worth building.

## Open questions for the owner

- Which Apple TV 4K generation do you have? Apple's page now shows only the 4th generation (A19).
- Is Plex direct stream on Apple TV acceptable? It is not direct play, but Plex only rewraps the file (and converts DTS or TrueHD audio).
- On a TV, watching only, or also managing downloads?
- Do you sign in to Plex with Google, Apple or a Plex password? Google sign-in will not work inside a WebView.
- How long should a TV stay signed in, and should the code be Plex's (plex.tv/link) or the app's own?
- Is the official Plex app on each box good enough for watching, leaving media-manager-2 for managing on desktop and phone?
- Does your amplifier or TV need DTS and TrueHD passed through untouched, or is decoding in the app fine?

## Could not verify from a primary source

- The Streamer's Android version (press reports say Android 14 for TV; Google's sheet says only "Android TV OS") and whether Android 16 for TV has reached it.
- AV1 decoding, DTS and TrueHD passthrough, and Dolby Vision profile 7 behaviour on the Streamer.
- Whether the Streamer ships a browser that supports Trusted Web Activities.
- VLC's January 2011 App Store removal: news reports only.
- AetherEngine's Dolby Vision and Atmos claims, and its comparison of VLCKit and libmpv: the project's own statements, not tested.
- Whether TestFlight internal builds skip App Review entirely: Apple ties review to external testers but does not say so outright.
- How long Plex's `transient-` tokens last (already open in [in-app-player/README.md](in-app-player/README.md)).
