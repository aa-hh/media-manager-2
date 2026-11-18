# Watch screens: what open-source clients do on show, season, episode and film pages

Research for the playback-first screens (Home rows, then show page, season page, episode page, film page, each with a backdrop and scrim), the same design on web and TV. Gathered 17 Nov 2026 by reading each repo's source as text from shallow clones. Nothing was built or run. Stars and last push are from the GitHub API on that date.

## Licences, in plain words

We are a private project. Reading any of this code to learn how it works, then writing our own, is fine under every licence below. Layout ideas, timings and gradient values are facts we can reuse. Copying code is where licences differ:

- **MIT and Apache-2.0** (Seerr, Google's JetStream sample): copy code freely. Keep their copyright notice in the copied file.
- **MPL-2.0** (Streamyfin, Swiftfin): works per file. A file we copy stays MPL; if we ever hand the app to someone, that file's source (with our changes) must be available to them. The rest of our code is unaffected.
- **GPL-2.0 and GPL-3.0** (jellyfin-web, jellyfin-androidtv, Wholphin, NuvioTV, VoidTV, Fladder, Plezy, Stremio, plx-native): copying even one function makes our whole app GPL the day we give a build (the TV APK, the Electron app) to anyone else, and we would owe them all our source. Ideas only.
- **CC BY-NC-SA 4.0** (Arctic Fuse 3, a Kodi skin) and **Flixor's own licence** (AGPL-3.0 plus a no-commercial-use clause): ideas only.

## The clients

| Client | Stack | Stars | Last push | Licence | Screenshots |
|---|---|---|---|---|---|
| [Wholphin](https://github.com/damontecres/Wholphin) | Kotlin, Compose for TV, Jellyfin | 3,347 | 15 Nov 2026 | GPL-2.0 | [film page](https://github.com/user-attachments/assets/849aad34-49d5-4864-8de7-005bbcb68ac6), [series page](https://github.com/user-attachments/assets/655389e1-6a6f-43bc-85e1-e2feffb20429) |
| [Plezy](https://github.com/edde746/plezy) | Flutter, Plex and Jellyfin, desktop/phone/Android TV | 4,207 | 16 Nov 2026 | GPL-3.0 | [plezy.app](https://plezy.app/#screenshots), [readme-showcase.webp](https://github.com/edde746/plezy/blob/main/assets/readme-showcase.webp) |
| [NuvioTV](https://github.com/NuvioMedia/NuvioTV) | Kotlin, Compose for TV, Stremio-style add-ons | 3,543 | 16 Nov 2026 | GPL-3.0 | [Play Store](https://play.google.com/store/apps/details?id=com.nuvio.app) |
| [JetStream](https://github.com/android/tv-samples/tree/main/JetStreamCompose) | Google's Compose for TV sample | 1,287 | 30 Oct 2026 | Apache-2.0 | [Screenshots.png](https://github.com/android/tv-samples/blob/main/JetStreamCompose/Screenshots.png) |
| [Swiftfin](https://github.com/jellyfin/Swiftfin) | SwiftUI, iOS and tvOS, Jellyfin | 4,288 | 16 Nov 2026 | MPL-2.0 | none in repo |
| [Stremio web](https://github.com/Stremio/stremio-web) | React, TypeScript | 15,108 | 16 Nov 2026 | GPL-2.0 | none in repo |
| [Seerr](https://github.com/seerr-team/seerr) (Overseerr + Jellyseerr merged) | Next.js, React, Tailwind | 13,256 | 16 Nov 2026 | MIT | [preview.jpg](https://github.com/seerr-team/seerr/blob/develop/public/preview.jpg) |
| [jellyfin-androidtv](https://github.com/jellyfin/jellyfin-androidtv) | Java/Kotlin, Leanback (Android's older TV toolkit) | 4,743 | 16 Nov 2026 | GPL-2.0 | [Play Store](https://play.google.com/store/apps/details?id=org.jellyfin.androidtv) |
| [jellyfin-web](https://github.com/jellyfin/jellyfin-web) | JavaScript/React | 3,994 | 16 Nov 2026 | GPL-2.0 | none in repo |
| [Streamyfin](https://github.com/streamyfin/streamyfin) | React Native/Expo, phone and TV | 5,367 | 16 Nov 2026 | MPL-2.0 | [03-media-details.png](https://github.com/streamyfin/streamyfin/blob/develop/assets/images/screenshots/03-media-details.png) |
| [Fladder](https://github.com/DonutWare/Fladder) | Flutter, Jellyfin | 2,742 | 15 Nov 2026 | GPL-3.0 | [TV details](https://github.com/DonutWare/Fladder/blob/develop/assets/marketing/screenshots/Television/Details.png?raw=true) |
| [plx-native](https://github.com/plxnative/plx-native) | Rust + OpenGL, Plex, rooted LG TVs | 1,270 | 16 Nov 2026 | GPL-3.0 | [ux-detail.jpg](https://github.com/plxnative/plx-native/blob/main/docs/screenshots/ux-detail.jpg) |
| [Flixor](https://github.com/Flixorui/flixor) | React web, SwiftUI tvOS, Plex | 500 | 16 Nov 2026 | custom, non-commercial | [flixor-01.jpg](https://github.com/Flixorui/flixor/blob/main/docs/screenshots/flixor-01.jpg) |
| [VoidTV](https://github.com/hritwikjohri/VoidTV-for-jellyfin) | Kotlin TV, Jellyfin | 200 | 24 Apr 2026 | GPL-3.0 | [screenshots folder](https://github.com/hritwikjohri/VoidTV-for-jellyfin/tree/main/VoidTV-screenshots) |
| [Arctic Fuse 3](https://github.com/jurialmunkey/skin.arctic.fuse.3) | Kodi skin (XML) | 190 | 16 Nov 2026 | CC BY-NC-SA 4.0 | [extras/screenshots](https://github.com/jurialmunkey/skin.arctic.fuse.3/tree/piers/extras/screenshots) |

Not covered: Estuary and Arctic Zephyr/Horizon (Arctic Horizon 2 is archived; Fuse 3 is the same author's current skin), Moonfin (a Flutter fork of the Jellyfin TV app, too young to add much).

## At a glance

| Client | OK or click on an episode | Season switching | Title logo | Backdrop |
|---|---|---|---|---|
| Wholphin | plays from the resume point | tab row, loads on click | yes, text fallback | 70% top-right, faded edges |
| Plezy | plays | TV: one row per season, loads on arrival; phone: chips | Plex `clearLogo`, text fallback | full, 10-stop scrim |
| NuvioTV | opens a source picker | chips, loads 150 ms after focus | yes, text fallback | full, kept from the previous screen until the new one loads |
| JetStream | (film only) plays | none | no | full, three gradients |
| Swiftfin | still plays, text opens episode page | tvOS chips, select 350 ms after focus | yes, text fallback | tvOS: blurs once focus leaves the header |
| Stremio web | opens the episode state of the same page | chips, season kept in the URL | yes, sized by area | right-anchored, three gradients |
| Seerr | nothing (request app) | accordion | no | top band, one gradient |
| jellyfin-androidtv | opens episode page, focus on Resume | separate page per season | yes, beside the title text | full-screen, 58% tint |
| Streamyfin | opens episode page | TV: button opens a season list | yes, text fallback | full |
| plx-native | still plays, text opens episode page | tabs, 0.2 s after focus | Plex `clearLogo`, sized by area | full |

No client changes the backdrop when an episode gets focus. Plezy and Wholphin change the text block above the episode row instead.

## Client by client

### Wholphin (closest match to our TV app)

Link base: `https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/`

- **Show page** ([ui/detail/series/SeriesDetails.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/detail/series/SeriesDetails.kt) L370-620): header (logo or title, facts, overview), Play and Shuffle, a row of season cards, cast, extras, More like this.
- **Season and episode page** ([ui/detail/series/SeriesOverviewContent.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/detail/series/SeriesOverviewContent.kt) L142-400), top to bottom: season tabs, show logo, details of the focused episode (60% width), a sideways row of episode stills, play buttons for the focused episode, then cast and guest stars for that episode. Opening any episode or season from anywhere lands here, positioned on it ([data/model/BaseItem.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/data/model/BaseItem.kt) L281-303). A separate episode page exists only as a fallback.
- **Film page**: [ui/detail/movie/MovieDetails.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/detail/movie/MovieDetails.kt) L313-460.
- **OK on an episode** plays from the resume point; long-press opens a menu. Resume and Restart are two buttons, Restart only when there is progress ([ui/components/PlayButtons.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/components/PlayButtons.kt) L95-135).
- **Backdrop** ([ui/nav/Backdrop.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/nav/Backdrop.kt) L151-213): one shared backdrop behind every screen, drawn at 70% width and height in the top-right, faded to the background by two alpha masks (left 0 to 60% width, top to bottom). 800 ms crossfade. [services/BackdropService.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/services/BackdropService.kt) L57-131 waits 500 ms and only swaps if the item is still current, so scrolling fast through cards does not flicker.
- **Logo** ([ui/components/TitleOrLogo.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/components/TitleOrLogo.kt)): 60dp tall, at most 320dp wide, text on error or when missing. Episodes use the show's logo.
- **Seasons**: tab row ([ui/components/TabRow.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/components/TabRow.kt) L73-92). Entering from the side picks the first or last tab; from above or below, the selected one. A season loads on click, then focus jumps to its first episode.
- **Episodes**: 120dp-tall stills with "E3", a watched icon and a progress bar ([ui/cards/BannerCard.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/cards/BannerCard.kt) L142-195). The other stills dim to 40% while focus is elsewhere on the page.
- **Focus restoration**: last focused row index in `rememberSaveable`, re-requested in a `LaunchedEffect`; the episode row uses `focusRestorer` ([ui/Extensions.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/Extensions.kt) L176-190, L355).
- **Images**: Coil 3, memory and disk cache, crossfade off; every card asks the server for exactly its own pixel size ([ui/cards/ItemCardImage.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/cards/ItemCardImage.kt) L76).

### Plezy (the Plex client)

Link base: `https://github.com/edde746/plezy/blob/main/lib/`

- **One screen for show, season and film** ([screens/media_detail_screen.dart](https://github.com/edde746/plezy/blob/main/lib/screens/media_detail_screen.dart), 5,089 lines). No episode page and no season page: an episode opens the show page with that episode's season selected and the episode focused ([utils/media_navigation_helper.dart](https://github.com/edde746/plezy/blob/main/lib/utils/media_navigation_helper.dart) L30-94).
- **TV layout** (L3759-3894): full-screen backdrop; a text block on the left 60% (logo, focused episode title, info line, 3-line summary, actions); below it one row per season, then cast, extras, related. The text block and the Play button follow the focused episode (L5046: Play targets the focused episode, else Plex's on-deck one). Content stays hidden until row heights are known, so nothing jumps (L1106-1170).
- **OK on an episode plays** (L4486-4497). "Play from beginning" lives only in the context menu ([widgets/media_context_menu.dart](https://github.com/edde746/plezy/blob/main/lib/widgets/media_context_menu.dart) L636-637).
- **Scrim** (L4738-4768): a 10-stop gradient to the page background, alpha `0.20, 0.234, 0.325, 0.453, 0.60, 0.747, 0.875, 0.985, 0.998, 1.0` at even steps, all times 0.94. The code comment explains: an ease-in-out curve, a light dim at the top, and a tail that avoids a visible band on black screens. TV version: [widgets/tv_spotlight_background.dart](https://github.com/edde746/plezy/blob/main/lib/widgets/tv_spotlight_background.dart) L58-200 (left: 0.86 to 0.32 at 56% to 0).
- **Logo**: Plex `Image[]` entry of type `clearLogo` ([services/plex_mappers.dart](https://github.com/edde746/plezy/blob/main/lib/services/plex_mappers.dart) L772-794); text while loading, on error or when missing.
- **Season loading on TV**: arriving on a season row loads it; the neighbouring seasons' first page is fetched ahead; low-end TVs keep only the current season and one either side (L2114-2153, L4374-4600).
- **Plex calls** ([services/plex_client.dart](https://github.com/edde746/plezy/blob/main/lib/services/plex_client.dart)): `/library/metadata/{id}?includeOnDeck=1&includeChapters=1&includeMarkers=1` (on deck read from `OnDeck.Metadata`, L1262-1311); `/children` for seasons; `/grandchildren` for a show's episodes because `/allLeaves` returned nothing on a season (L1778-1792); `/extras`; `/hubs/metadata/{id}/related?count=10`.
- **Images** ([utils/media_image_helper.dart](https://github.com/edde746/plezy/blob/main/lib/utils/media_image_helper.dart) L43-125): `/photo/:/transcode?width&height&minSize=1&upscale=0`, sizes rounded up to 40 by 60 px steps so cached copies get reused, at least 2x density on TV, backdrops capped at 1280x720 on low-end devices. Disk cache 14 days.
- **Focus**: films focus Play; shows focus the on-deck episode in its season row. Each row remembers its focused card ([focus/locked_hub_controller.dart](https://github.com/edde746/plezy/blob/main/lib/focus/locked_hub_controller.dart) L7-20).

### NuvioTV

Link base: `https://github.com/NuvioMedia/NuvioTV/blob/dev/app/src/main/java/com/nuvio/tv/ui/screens/detail/`

- **One screen** ([MetaDetailsScreen.kt](https://github.com/NuvioMedia/NuvioTV/blob/dev/app/src/main/java/com/nuvio/tv/ui/screens/detail/MetaDetailsScreen.kt), 3,476 lines): hero, season chips, that season's episode row, a tabbed block (cast, ratings, More like this, trailer), comments.
- **Play label** from the next episode to watch: "Resume", "Resume S2 E4" or "Play" (MetaDetailsViewModel.kt L1905-1950). Menu on an episode offers "start from beginning" and mark watched.
- **Backdrop**: the previous screen's backdrop stays underneath until the new one has loaded, so moving between pages never flashes the background colour (L2176-2210, `BackdropLayer` L3237-3330). 400 ms crossfade. Scrolling past the hero fades the backdrop to 15% over 300 ms.
- **Scrim**: left gradient over 78% of the width, background-colour alpha `1, 0.95, 0.84, 0.70, 0.52, 0.34, 0.18, 0.07, 0` at `0, .10, .22, .36, .52, .66, .78, .90, 1`, drawn once into a 2 px tall bitmap and stretched (L2214-2259). Our TV `Backdrop.kt` already does the same trick at quarter size.
- **Logo** ([HeroSection.kt](https://github.com/NuvioMedia/NuvioTV/blob/dev/app/src/main/java/com/nuvio/tv/ui/screens/detail/HeroSection.kt) L139-230): 100dp tall, at most 40% of the width, text on failure.
- **Seasons** ([EpisodesSection.kt](https://github.com/NuvioMedia/NuvioTV/blob/dev/app/src/main/java/com/nuvio/tv/ui/screens/detail/EpisodesSection.kt) L123-370): chips; focusing one loads it after 150 ms. Specials sort last.
- **Episodes** (EpisodesSection.kt L641-1137): wide stills with a bottom gradient, title, description, runtime, date, progress bar, watched mark. A setting blurs unwatched stills.
- **Back from the player** (`resolveReturnFocusStep`, L292-370): focus lands on the next episode, and moves to the next season after a finale. Focus requests wait two frames and retry up to four times (FocusRestoreUtils.kt).
- **Images**: every request carries a size; focusing an episode preloads its full-screen still (EpisodesSection.kt L790-810).

### JetStream (Google's sample; the only Apache-licensed TV code here)

Link base: `https://github.com/android/tv-samples/blob/main/JetStreamCompose/jetstream/src/main/java/com/google/jetstream/presentation/`

- **Film page only**; no show, season or episode pages ([screens/movies/MovieDetailsScreen.kt](https://github.com/android/tv-samples/blob/main/JetStreamCompose/jetstream/src/main/java/com/google/jetstream/presentation/screens/movies/MovieDetailsScreen.kt) L97-160): a 432dp hero, cast, a "Similar to" row, reviews.
- **Focus helpers worth copying** ([utils/ModifierUtils.kt](https://github.com/android/tv-samples/blob/main/JetStreamCompose/jetstream/src/main/java/com/google/jetstream/presentation/utils/ModifierUtils.kt) L163-182): a pair of modifiers that save the focused child when focus leaves a row and restore it when focus comes back, falling back to the first child. Rows use `focusRestorer` plus that pair ([common/MoviesRow.kt](https://github.com/android/tv-samples/blob/main/JetStreamCompose/jetstream/src/main/java/com/google/jetstream/presentation/common/MoviesRow.kt) L108-125).
- **"Similar" replaces the page** instead of stacking another one (`popUpTo` in App.kt L80-86), so Back still returns to where you came from.
- **Weak spots**: gradients in hard-coded pixels ([screens/movies/MovieDetails.kt](https://github.com/android/tv-samples/blob/main/JetStreamCompose/jetstream/src/main/java/com/google/jetstream/presentation/screens/movies/MovieDetails.kt) L202-238), no resume, no image sizes, no initial focus on the detail page.

### Swiftfin

Link base: `https://github.com/jellyfin/Swiftfin/blob/main/Shared/`

- **One item view for iOS and tvOS** ([Views/ItemView/ItemView.swift](https://github.com/jellyfin/Swiftfin/blob/main/Shared/Views/ItemView/ItemView.swift)), sections from [ItemContentGroupProvider.swift](https://github.com/jellyfin/Swiftfin/blob/main/Shared/Views/ItemContentGroupView/ItemContentGroupProvider.swift): season chips with an episode row, genres, cast, specials, similar, about.
- **Episode card** ([SeriesEpisodeContentGroup+EpisodeCard.swift](https://github.com/jellyfin/Swiftfin/blob/main/Shared/Objects/ContentGroup/SeriesEpisodeContentGroup/SeriesEpisodeContentGroup+EpisodeCard.swift) L42-50): tapping the still plays (resumes); tapping the text opens the episode page; long-press for a menu. Our web episode rows already work this way (`PlayStill` in `src/client/title/EpisodeRows.tsx`).
- **Play button** ([Views/ItemView/Components/PlayButton.swift](https://github.com/jellyfin/Swiftfin/blob/main/Shared/Views/ItemView/Components/PlayButton.swift) L75-82): label "N min left" or "Play"; long-press offers "Play from beginning".
- **tvOS backdrop** ([ContentGroupScrollView.swift](https://github.com/jellyfin/Swiftfin/blob/main/Shared/Views/ItemView/Components/ScrollViews/ContentGroupScrollView.swift) L55-68): while the header has focus, the top 30% is sharp and the rest is behind a frosted blur; once focus moves into the rows, the whole backdrop blurs over 0.2 s. The header fills the screen height minus 75 pt, content bottom-left ([CinematicContentGroupContainer.swift](https://github.com/jellyfin/Swiftfin/blob/main/Shared/Components/Layouts/CinematicContentGroupContainer.swift)).
- **Seasons on tvOS** ([SeriesEpisodeContentGroup+SeasonSelector.swift](https://github.com/jellyfin/Swiftfin/blob/main/Shared/Objects/ContentGroup/SeriesEpisodeContentGroup/SeriesEpisodeContentGroup+SeasonSelector.swift) L94): focusing a chip selects it after 350 ms. The default season is the one holding the Play button's episode, and the episode row opens scrolled to that episode.
- **Page colour from the image**: a colour sampled from the backdrop ([UIImage+InterestingColor.swift](https://github.com/jellyfin/Swiftfin/blob/main/Shared/Extensions/UIImage+InterestingColor.swift)) becomes the page colour below the hero, with a blurred mirrored strip of the image fading into it ([BottomEdgeGradientModifier.swift](https://github.com/jellyfin/Swiftfin/blob/main/Shared/Extensions/ViewExtensions/Modifiers/BottomEdgeGradientModifier.swift)).

### Stremio web

Link base: `https://github.com/Stremio/stremio-web/blob/development/src/`

- **One route for show and episode** ([routes/Details/Details.tsx](https://github.com/Stremio/stremio-web/blob/development/src/routes/Details/Details.tsx)): background, hero (logo, facts, description, actions), and on desktop a fixed right-hand panel 27.5rem wide holding season chips, a search box and the episode list. Choosing an episode swaps the hero to that episode's still, title and overview.
- **Primary button** ([routes/Details/usePrimaryAction.ts](https://github.com/Stremio/stremio-web/blob/development/src/routes/Details/usePrimaryAction.ts)): "Resume S1 E3" with "N min left". No start-over option anywhere.
- **Logo sizing** ([components/Logo/Logo.tsx](https://github.com/Stremio/stremio-web/blob/development/src/components/Logo/Logo.tsx), Logo.less): height is `min(9rem, 30rem / ratio, 15.3rem / √ratio)`, so a very wide logo and a near-square one end up taking similar space. It also draws the logo into a canvas and finds the box of pixels with alpha above 16 (Logo.tsx L28-80) to crop out transparent padding, cached per address. Waits up to 500 ms for that, fades in over 0.2 s, falls back to the name in text.
- **Season in the address** as `?season=N`, replaced not pushed ([routes/Details/useSeason.ts](https://github.com/Stremio/stremio-web/blob/development/src/routes/Details/useSeason.ts)). Default: the season with the last-watched episode, else the first season that isn't specials ([common/useSeasons.ts](https://github.com/Stremio/stremio-web/blob/development/src/common/useSeasons.ts)).
- **Backdrop** ([routes/Details/Background/Background.less](https://github.com/Stremio/stremio-web/blob/development/src/routes/Details/Background/Background.less)): image at 62% opacity, right-anchored, three gradients in `rgb(12,11,17)`: left `94% 0%, 86% 22%, 60% 40%, 20% 58%, 0% 70%`; bottom `90% 0%, 40% 26%, 0% 46%`; top `55% 0%, 0% 18%`.
- **Episode list**: watched badge, progress bar, "N min left", "Upcoming". Auto-scrolls to the in-progress episode (Videos/Video.tsx L53-69). Scroll position saved per show and season and restored on Back ([Videos/useScrollMemory.ts](https://github.com/Stremio/stremio-web/blob/development/src/routes/Details/Videos/useScrollMemory.ts)). A spoiler setting blurs unwatched stills but still shows their descriptions.

### Seerr (MIT, title pages only, no playback)

Link base: `https://github.com/seerr-team/seerr/blob/develop/src/`

- **Pages**: [components/TvDetails/index.tsx](https://github.com/seerr-team/seerr/blob/develop/src/components/TvDetails/index.tsx), [components/MovieDetails/index.tsx](https://github.com/seerr-team/seerr/blob/develop/src/components/MovieDetails/index.tsx). Backdrop, poster plus title plus facts plus actions, overview with a facts card, seasons accordion, cast slider, recommendations, similar.
- **Header gradient** (TvDetails L498-514): `linear-gradient(180deg, rgba(17,24,39,0.47) 0%, rgba(17,24,39,1) 100%)` over TMDB's `w1920_and_h800_multi_faces` backdrop, the same image size our server stores (`TMDB_IMAGE_SIZES` in `src/server/titles.ts`). The page pulls itself up under the app bar (`styles/globals.css` L124-133), which our `TitleHeader.tsx` already does.
- **Copyable pieces**: [Common/ImageFader](https://github.com/seerr-team/seerr/blob/develop/src/components/Common/ImageFader/index.tsx) (82-line backdrop crossfade), the rating chips in MovieDetails L790-865, `PersonCard`. Its `Slider` needs `@react-spring/web` and lodash, which we don't have; our Discover rows already scroll sideways.
- **Weak spots**: seasons and episodes newest first, cast photos fetched at 600x900 for a 144 px card.

### jellyfin-androidtv and jellyfin-web (the official Jellyfin clients)

- **TV** ([ui/itemdetail/FullDetailsFragment.java](https://github.com/jellyfin/jellyfin-androidtv/blob/master/app/src/main/java/org/jellyfin/androidtv/ui/itemdetail/FullDetailsFragment.java), 1,241 lines of Leanback): one fragment for every type. An episode card opens the episode page, where focus starts on "Resume from mm:ss" if there is progress, else on Play (`handleResumeButtonAndFocus`, L1075-1091). A season is a generic browse grid, not a detail page. One full-screen background that cycles all backdrops every 30 s with a 58% near-black tint ([res/values/colors.xml](https://github.com/jellyfin/jellyfin-androidtv/blob/master/app/src/main/res/values/colors.xml) L67). Cards show a BlurHash (a short text code that decodes into a blurred preview) while loading ([ui/AsyncImageView.kt](https://github.com/jellyfin/jellyfin-androidtv/blob/master/app/src/main/java/org/jellyfin/androidtv/ui/AsyncImageView.kt) L48-99).
- **Web** ([apps/legacy/controllers/itemDetails/index.js](https://github.com/jellyfin/jellyfin-web/blob/master/src/apps/legacy/controllers/itemDetails/index.js), 2,212 lines): one page for every type; seasons as poster cards, each its own page; an episode page adds "More from Season X". Banner at 40vh with `background-attachment: fixed` for cheap parallax. On desktop, playing an episode means hovering its thumbnail for a play icon. Going back re-focuses the element that had focus ([components/viewManager/viewManager.js](https://github.com/jellyfin/jellyfin-web/blob/master/src/components/viewManager/viewManager.js) L47-58).

### Shorter notes

- **Streamyfin** ([components/series/TVSeriesPage.tsx](https://github.com/streamyfin/streamyfin/blob/develop/components/series/TVSeriesPage.tsx) L391-634): Play label "Continue S1:E3" or "Play S1:E3", but pressing it opens the episode page instead of playing (L272-277): two presses to watch. TV season choice is a button that opens a list. Moving between episodes replaces the screen rather than stacking. [docs/tv-focus-guide.md](https://github.com/streamyfin/streamyfin/blob/develop/docs/tv-focus-guide.md) records where TV focus flickers.
- **Fladder** ([screens/details_screens/](https://github.com/DonutWare/Fladder/tree/develop/lib/screens/details_screens)): separate show, season, episode and film pages. Play label "Resume S1 - E3"; the button fills with colour up to the watch progress ([components/media_play_button.dart](https://github.com/DonutWare/Fladder/blob/develop/lib/screens/shared/media/components/media_play_button.dart) L92-103). A dot marks the next-up episode. Images requested at stepped sizes from 64 to 3840 px.
- **plx-native** (Plex): episode card has two focus stops, still plays and text opens the page. Logos sized to a constant area of 60,000 px². Ignores Plex reporting S1E1 as on deck for a show nobody has started ([rust-modules/screens/src/detail/hero.rs](https://github.com/plxnative/plx-native/blob/main/rust-modules/screens/src/detail/hero.rs) L299-317). Falls back to `/library/metadata/{id}/clearLogo` on older servers.
- **Flixor** (Plex): tvOS episode rows can be focused but not selected; tvOS images skip Plex's resizer and load full size. Play label "Resume", "Play Next Episode", "Play Again", never the episode number.
- **VoidTV**: BlurHash fills the screen, then the sharp backdrop over the top-right 70% with 64dp feathered edges ([components/common/HeroBackground.kt](https://github.com/hritwikjohri/VoidTV-for-jellyfin/blob/main/app/src/main/java/com/hritwik/avoid/presentation/ui/components/common/HeroBackground.kt) L35-125); the sharp image is requested at original size (L80).
- **Arctic Fuse 3**: season labels in a row, the selected season's episodes underneath, with a built-in delay so scrolling past labels doesn't reload episodes for each. Logo box 640 by 135, left-aligned, using a copy with transparent padding cropped. Fallback order: clearlogo, the show's clearlogo, text ([1080i/Includes_Info.xml](https://github.com/jurialmunkey/skin.arctic.fuse.3/blob/piers/1080i/Includes_Info.xml) L403-460).

## 1. The ten best ideas worth taking

1. **OK or click on an episode plays it, resuming.** Start-over lives in a second button or the menu, shown only when there is progress. Wholphin [PlayButtons.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/components/PlayButtons.kt), Plezy [media_detail_screen.dart](https://github.com/edde746/plezy/blob/main/lib/screens/media_detail_screen.dart) L4486-4497. Our TV `ShowScreen.kt` already plays on OK; keep it.
2. **The Play label names the action and the episode**: "Resume S2 E4", "Play S1 E1", plus "N min left". NuvioTV MetaDetailsViewModel.kt L1905-1950, Stremio [usePrimaryAction.ts](https://github.com/Stremio/stremio-web/blob/development/src/routes/Details/usePrimaryAction.ts), Fladder. Plezy's bare "S2E4" with only an icon for resume-or-play is the version to avoid.
3. **The text block above the episode row follows focus**: focused episode's title, S/E line, summary, and the Play button targets it. The backdrop stays the show's. Plezy L5046, Wholphin [SeriesOverviewContent.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/detail/series/SeriesOverviewContent.kt). This is how one page can serve both "season page" and "episode page" on TV.
4. **Title logo with text fallback, sized by area.** Plex `clearLogo` from the `Image[]` array (Plezy [plex_mappers.dart](https://github.com/edde746/plezy/blob/main/lib/services/plex_mappers.dart) L772-794), height `min(cap, width/ratio, k/√ratio)` with transparent padding cropped (Stremio [Logo.tsx](https://github.com/Stremio/stremio-web/blob/development/src/components/Logo/Logo.tsx)), text while loading and on error (Wholphin [TitleOrLogo.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/ui/components/TitleOrLogo.kt)).
5. **Keep the previous backdrop until the next has loaded.** No flash of background colour between pages. NuvioTV `BackdropLayer`, Plezy [cycling_media_backdrop.dart](https://github.com/edde746/plezy/blob/main/lib/widgets/cycling_media_backdrop.dart) L258-280. Pair it with Wholphin's 500 ms wait before swapping on Home ([BackdropService.kt](https://github.com/damontecres/Wholphin/blob/main/app/src/main/java/com/github/damontecres/wholphin/services/BackdropService.kt)).
6. **Default season = the season of the next episode to watch, with the row scrolled to that episode.** Stremio [useSeasons.ts](https://github.com/Stremio/stremio-web/blob/development/src/common/useSeasons.ts), Swiftfin, Plezy. Our TV `ShowScreen.kt` already picks the season (`initialSeason`); the scroll-to-episode part is missing.
7. **Season in the web address** (`?season=2`, replaced rather than pushed), so Back, reload and shared links land on the same season. Stremio [useSeason.ts](https://github.com/Stremio/stremio-web/blob/development/src/routes/Details/useSeason.ts).
8. **On TV, focusing a season tab switches after a short pause** (150 to 350 ms), so passing over tabs doesn't load each one; OK switches at once. NuvioTV EpisodesSection.kt L169-176, Swiftfin SeasonSelector L94, plx-native.
9. **Back from the player lands on the next episode**, moving to the next season after a finale. NuvioTV `resolveReturnFocusStep` (MetaDetailsScreen.kt L292-370). Every row also remembers its last focused card (JetStream [ModifierUtils.kt](https://github.com/android/tv-samples/blob/main/JetStreamCompose/jetstream/src/main/java/com/google/jetstream/presentation/utils/ModifierUtils.kt) L163-182).
10. **Ask the image server for the drawn size, rounded to steps.** Plezy rounds to 40 by 60 px steps so cached copies get reused, fetches 1.5x to 2x for sharpness, and caps backdrops at 1280x720 on weak TVs ([media_image_helper.dart](https://github.com/edde746/plezy/blob/main/lib/utils/media_image_helper.dart) L43-125). Plex does this with `/photo/:/transcode?width&height&minSize=1&upscale=0`.

Runners-up: dim the other episode stills while focus is elsewhere (Wholphin); blur the TV backdrop once focus leaves the header (Swiftfin tvOS); spoiler blur on unwatched stills that also hides their descriptions (none do both); fade the app bar background in over the first 50 to 100 px of scroll (Plezy L3711-3737); "More like this" replaces the page instead of stacking (JetStream App.kt L80-86).

## 2. Reusable code and techniques for our stack

Our stack: React 19, Tailwind 4, Base UI and lucide on the web (no animation or image library installed); Compose BOM 2026.09.00, tv-material 1.1.0 and Coil 3.6.3 on TV.

| Technique | Source (licence) | Where it lands in our code | Notes |
|---|---|---|---|
| Logo sizing `min(cap, width/ratio, k/√ratio)` | Stremio Logo.less (GPL, so rewrite) | Web: a logo slot in `src/client/components/ui/header-title.tsx`, used by `src/client/title/TitleHeader.tsx`. TV: inside `ui/components/ContentBlock.kt`, which today draws the title as text | Plain CSS `min()` and a few lines of Kotlin. No dependency. |
| Crop a logo's transparent padding | Stremio Logo.tsx L28-80 (GPL, rewrite) | Better done once on our server when the logo is first copied, so web and TV both get the cropped file | Our images already go through `/api/images` (`src/server/app.ts` L699), so the browser could also measure it in a canvas without cross-origin errors. |
| Logo source | Plezy plex_mappers.dart (idea) | Server: read `Image[]` type `clearLogo` from the Plex metadata call, or TMDB's `/images` logos in `src/server/tmdbTitles.ts`. Add the logo size to `TMDB_IMAGE_SIZES` in `src/server/titles.ts` | Our server has no logo source today (no `clearLogo` anywhere in `src/`). |
| Backdrop crossfade between two images | Seerr `ImageFader` (MIT, copyable) | Web: `TitleHeader.tsx` | 82 lines, React only. Keep the old image until the new one's `onLoad`. |
| Keep previous backdrop until the new one loads | NuvioTV, Plezy (GPL, rewrite) | TV: `ui/components/Backdrop.kt` and `ServerImage.kt`. Coil's `AsyncImage` takes a `placeholder`; pass the last drawn backdrop as a memory-cache key | Our scrim is already drawn once into a quarter-size bitmap in `Backdrop.kt`, the same trick NuvioTV uses. |
| Save and restore focused card per row | JetStream ModifierUtils.kt L163-182 (Apache, copyable) | TV: `ui/components/Focus.kt`; used by rows in `ui/browse/Rails.kt` and the episode list in `ShowScreen.kt` | `Modifier.focusRestorer` is in our Compose version. |
| Remember season and focused episode across the player | Wholphin Extensions.kt (GPL, rewrite) | TV `ShowScreen.kt`: `selectedSeason` is a plain `remember`, so it resets after the player; make it `rememberSaveable`, and save the focused episode the same way | Today focus always returns to the Play button (`LaunchedEffect(detail != null)`). |
| Season switch after a short pause on focus | NuvioTV, Swiftfin (ideas) | TV: `ui/components/Tabs.kt` (`TabRow` has `onSelect`); a `LaunchedEffect` keyed on the focused tab with a `delay` | |
| Season in the address | Stremio useSeason.ts (GPL, rewrite) | Web: `src/client/navigation.ts` plus the season state in `src/client/title/SeriesOverview.tsx` | Use replace, not push. |
| Sized image requests | Plezy media_image_helper.dart (GPL, rewrite) | TV: `ServerImage.kt` passes no size today; add a width parameter to `/api/images` on the server, and Coil's `size()` on the request | Our backdrop is TMDB `w1920_and_h800_multi_faces`, 2.4:1, so on a 16:9 TV `ContentScale.Crop` cuts its sides. Worth checking against the Figma frames. |
| Plex `/photo/:/transcode` with `minSize=1` | Plezy, plx-native | Server: `src/server/services/plexPlayback.ts` already calls it for scrub previews (`preview`, with `upscale=1`); the same call can serve Plex art and stills at a set size | Use `upscale=0` for art. |
| Plex next episode | Plezy plex_client.dart L1262-1311, plx-native hero.rs L299-317 | Server: `includeOnDeck=1` on the metadata call; ignore an on-deck S1E1 for a show with nothing watched | We currently work out the next episode ourselves (`nextEpisode` in the TV app, `playLine.ts` on the web). |
| Gradient stops | Plezy 10-stop scrim, Stremio's three gradients, NuvioTV's 9 stops (numbers are not code) | TV: `BackdropScrim` values in `Backdrop.kt`. Web: `TitleHeader.tsx` | Plezy's comment explains why the tail stops at 0.998 rather than 1. Only change ours if the Figma frames do. |

## 3. What these clients get wrong

- **Play that takes two presses.** Streamyfin's TV "Play S1:E3" opens the episode page instead of playing (TVSeriesPage.tsx L272-277). jellyfin-androidtv and Fladder also route an episode through its page first.
- **Episodes you can focus but not select.** Flixor tvOS ([TVEpisodesRail.swift](https://github.com/Flixorui/flixor/blob/main/apps/tvos/FlixorTV/Views/Details/Components/TVEpisodesRail.swift) L270-331).
- **Play hidden behind hover.** jellyfin-web desktop shows the play icon only when hovering a thumbnail.
- **Resume vs play told only by an icon.** Plezy. Say it in words.
- **No start-over at all.** JetStream, Stremio, Flixor.
- **Full-size images on a TV.** jellyfin-androidtv holds every backdrop as an unsized bitmap at once (BackgroundService L102-120); VoidTV requests originals; Flixor tvOS skips Plex's resizer; Streamyfin asks for an unsized 1000 px backdrop.
- **Gradients in fixed pixels.** JetStream's scrim moves with screen density. Use fractions, as our `Backdrop.kt` does.
- **Newest first.** Seerr lists seasons and episodes newest first.
- **Spoiler mode that blurs stills but prints the plot.** Stremio. If we add spoiler hiding, hide both.
- **Two focus stops per episode card on TV.** plx-native's "still plays, text opens" is hard to discover with a remote. On TV, one stop that plays, and the menu or a long press for the rest. (On the web, the still-plays, row-opens split works, and we already have it.)
- **One giant screen file for every item type.** Plezy 5,089 lines, NuvioTV 3,476, jellyfin-web 2,212, jellyfin-androidtv 1,241. Keep show, season, episode and film as separate screens sharing components.
- **Busy detail pages.** jellyfin-androidtv shows a dozen-plus icon buttons. Our "TV screens stay calm" rule already rules this out.
