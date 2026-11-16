# Home page: motion and speed rules

Research for the Home page's movement and loading rules. Plex is the baseline to beat, not the template. Gathered 16 Nov 2026.

## Owner decisions, 16 Nov 2026

Approved targets:

- Title page drawn within 350 ms of the click; backdrop photo within 500 ms.
- Hover takes 120 ms, and nothing moves except the Play button fading in.
- TV side menu lays over the page and slides in over 150 ms (out in 120 ms); it no longer pushes the page sideways.

Approved builds (numbers from "How to build each"): #2 last Home reply kept in memory, #3 a timing per screen change, #4 first row's images first, #5 Discover posters at `w500`, #9 day-long browser cache for TMDB image copies.

Added by the owner: whatever we cache must also be fast to read back and draw, so anything we already know shows almost at once. That is rule 10 below.

Each Plex claim is marked:

- **confirmed**: read in Plex's shipped code or in a statement by Plex staff;
- **reported**: users say so on Plex's forums, with no measurement;
- **inferred**: follows from what was read, but nothing states it;
- **unknown**: no source found.

How the Plex code was read: the public sign-in page at `https://app.plex.tv/desktop/` (no account used) loads two scripts and two style sheets, all named `plex-4.163.0`. They were downloaded and searched as text. Nothing was run and no account was signed into. These files are the classic Plex Web app, not the new apps. The new apps' code is not public.

## Plex in brief

### Stack

| Claim | Status | Source |
|---|---|---|
| The new apps (2024–26 redesign) are one React Native code base for phone and TV, written from scratch | confirmed | Plex's product chief: "This is all React Native-based", "a whole new code base from the ground up" ([Lowpass, 6 Jan 2025](https://www.lowpass.cc/p/plex-apple-tv-app-relaunch-tvos-react-native)) |
| The same React Native code base is meant to cover web too, with native video players (ExoPlayer, AVFoundation, ffmpeg) under it | confirmed | Plex job ad: "a React Native based mobile, TV, and web client application" ([Built In](https://builtin.com/job/senior-software-engineer-player/8957403), removed 1 Jul 2026) |
| Which React Native libraries they use for animation, lists or images (Reanimated, FlashList and so on) | unknown | Not in any post, talk or job ad found. Plex's music app Plexamp was built with Expo and ran on desktop through react-native-web inside Electron ([Expo blog](https://blog.expo.io/plexamp-v3-81be156b749e)), so the same family is likely but not stated |
| `app.plex.tv/desktop` still serves the classic web app on 16 Nov 2026 | confirmed | Bundle is Plex Web 4.163.0: React 18 (react 18.3.1, react-dom 18.2.0), Redux, immer, moment, Popper. No react-native-web, no framer-motion, no react-spring animation code; react-use-measure (a size-measuring helper) is present. Animation is plain CSS transitions |
| A forum user asked in Jan 2026 whether the new experience comes to the web; no answer found | reported | [search summary of forum thread](https://forums.plex.tv/t/new-plex-update/944448) |

### Motion rules found in Plex's code

| Rule | Status | Detail |
|---|---|---|
| Shared duration tokens: fast 100 ms, slow 300 ms, very slow 600 ms | confirmed (web bundle) | A design-token object in the vendor script, next to TV type sizes (display 80 px) and colour names. The TV sizes suggest the same token set feeds the new apps: inferred |
| Spacing scale 2, 4, 8, 12, 16, 24, 32, 48, 64 px; corner radius 2, 4, 8, 16, full | confirmed (web bundle) | Same token object |
| Most transitions run 200 ms | confirmed (classic web) | 112 of about 180 transition timings in the main style sheet are 200 ms; the next most common is 100 ms (21) |
| Easing is mostly `ease-in-out`; the sidebar uses Material's standard curve `cubic-bezier(.4,0,.2,1)` | confirmed (classic web) | 15 uses of `ease-in-out`, 8 `ease-out`, 3 of the Material curve |
| Sidebar: 64 px collapsed, 260 px open, grows over 200 ms on the Material curve, laid over the page | confirmed (classic web) | `.SourceSidebar-collapsedSidebar` / `-expandedSidebar`: `position:absolute`, `transition:max-width .2s cubic-bezier(.4,0,.2,1)`. Because it sits over the page, the page under it never re-flows; only the sidebar itself re-measures each frame. It animates width, not a transform, so it is not the cheapest possible animation |
| Sidebar labels stay in the page while collapsed, clipped by `overflow:hidden` | confirmed (classic web) | Same rules; opening only reveals what is already drawn |
| Poster card: radius 4 px, soft shadow, progress bar laid over the bottom of the poster | confirmed (classic web) | `.MetadataPosterCard-progress{position:absolute;bottom:0}` |
| On hover the progress bar and corner badges fade out and the badge slides up 10 px | confirmed (classic web) | `.MetadataPosterCardOverlay-overlay:hover …{opacity:0;transform:translateY(-10px)}` |
| Loading card: shimmer that pulses every 600 ms | confirmed (classic web) | `.MetadataPosterCardPlaceholder` animation `.6s ease-in infinite alternate` |
| Card flip to its back face over 800 ms | confirmed (classic web) | `.MetadataPosterCard-card{transition:transform .8s}` with `rotateY(180deg)` |
| Progress bar under the poster in the new iOS app, over it in the new experience elsewhere | reported | [forum, 12 Dec 2024](https://forums.plex.tv/t/can-we-please-not-put-the-progress-bar-on-top-of-the-actual-poster/898700); users ask Plex to put it under everywhere ([forum](https://forums.plex.tv/t/standardize-progress-bar-placement-under-posters-across-all-players/931036)) |
| Card to title page: a shared poster or backdrop that flies from the card into the title page | unknown | Nothing in the classic web code; no source for the new apps |

### Speed rules found in Plex's code

| Rule | Status | Detail |
|---|---|---|
| Images are asked for at the size they are drawn times the screen's pixel density | confirmed (classic web) | Image URLs go through the server's `/photo/:/transcode` with `width` and `height` from the element, multiplied when `allowPixelRatioSize` is set, plus `minSize` and `upscale` |
| Images below the fold load when they scroll into view | confirmed (classic web) | `react-intersection-observer`'s `useInView` with `triggerOnce` |
| Home asks each server for its rows in one request, without summaries | confirmed (classic web) | `/hubs` or `/hubs/promoted` per server; `excludeFields=summary` by default; Continue Watching is `/hubs?identifier=home.continue,home.ondeck` |
| Each row request asks for one card more than it shows, to know whether "more" exists | confirmed (classic web) | `count = this.count + 1` |
| Each server's rows fill in on their own; the page does not wait for the slowest server | confirmed (classic web) | Per-list `isPending`, `isPopulated`, `isListError` flags |
| Prefetch of the title page's data or art on hover or focus | unknown | No hover prefetch found in the classic web code; nothing public for the new apps |
| Title page background: by default a blur of colours taken from the artwork, not the photo | confirmed for the 2021 TV layout | Plex's "Details Background" setting: Artwork Colors (default), Dimmed Art, None ([Plex blog via search summary](https://www.plex.tv/pt-br/blog/choose-your-own-adventure-introducing-modern-layout/), [AFTVnews](https://www.aftvnews.com/plex-refreshes-app-interface-and-adds-more-customization-options/)). The web bundle holds the colour tokens for this blur (`ultrablur-tl/tr/br/bl`). Whether the new apps keep the same default: inferred |

### "Only the first row gets the hero on the title page"

Not confirmed. No source ties the title page's backdrop to the row a card was opened from.

What the sources do show:

- **A backdrop band that follows the first row is a Home behaviour, not a title page one.** TV home screens (Google TV, and our own TV app at `android-tv/…/browse/RailsPage.kt:113`) show the focused card's backdrop at the top only while the first row is in view, and fade it out once the rows scroll past it. If Plex's TV app does the same, that would read as "only the first row gets the hero". Inferred; not seen in a Plex source.
- **The new apps often show no backdrop on the title page at all.** By default the background is artwork colours, not the photo (above). On Apple TV, users reported "Background art and cast info sometimes don't load in the details page" and "a multi-second delay for details and artworks to load" (17 Jun 2025), and some saw no background images for weeks ([forum, page 8](https://forums.plex.tv/t/current-missing-features-bugs-with-the-appletv-app-experience-preview/903091?page=8)). Reported.
- **A warm cache would explain the rest.** A card in the first row has usually had its art fetched already (it is on screen longest, and the Home band may have shown it), so its title page has the picture at once; a card further down may not. Inferred.

How to check on a phone: open a card from the first row and one from the fifth with the network slowed, and note which title page shows the photo and which shows only colours.

## Where Plex falls short

All reported by users; Plex has published no timings.

| Problem | Source |
|---|---|
| Title page took "30 seconds or more" to open, where the old app took at most 5 (iPhone, 12 May 2025) | [feedback thread, page 56](https://forums.plex.tv/t/new-experience-public-release-feedback/910904?page=56) |
| App stops responding for "15 to 30 seconds" after changing section (iOS 2025.15.0, 4 May 2025) | [forum](https://forums.plex.tv/t/new-ios-client-is-so-slow/916825) |
| Multi-second delay for title page details and art; focus moves slowly when highlighting; Back does not scroll rows back (Apple TV, June 2025) | [forum, page 8](https://forums.plex.tv/t/current-missing-features-bugs-with-the-appletv-app-experience-preview/903091?page=8) |
| "Stuttery laggy mess even on a high end phone with 12 gigs of RAM" (v2025.19.0); Fire TV "everything about the new version is slow" (2026); Android 2026.19.1 "severe performance lag" | search summaries of [Reddit](https://lr.in.psf.lt/r/PleX/comments/1lg7ww9/plex_for_mobile_android_ios_v2025190_released), [Fire TV thread](https://forums.plex.tv/t/new-plex-firetv-app-slow/938402), [Android 2026.19.1](https://forums.plex.tv/t/plex-for-android-2026-19-1/944084) |
| Library scrolling: "the lazy loading is really lazy" | search summary of the [feedback thread](https://forums.plex.tv/t/new-experience-public-release-feedback/910904?page=56) |
| Continue Watching stays stale until the app restarts | linked in [patterns.md](patterns.md), section 2 |
| Progress bar placement differs between Plex apps | [forum](https://forums.plex.tv/t/standardize-progress-bar-placement-under-posters-across-all-players/931036) |

## Our rules (with targets)

Targets are the 75th percentile on the home network, measured by the app itself (see rule 8). Where we already have the piece, the file is cited.

### 1. Card to title page

| Moment after the click | Target | Plex today |
|---|---|---|
| Press feedback | instant (0 ms), as now | 200 ms fades |
| Title page drawn with title, poster and Play | ≤ 350 ms | multi-second, 30 s worst reported |
| Backdrop photo in place | ≤ 500 ms; blurred poster fills the band from 0 ms | often missing |
| Poster flies from card to title page | 220 ms, ease-out | unknown |

- The old screen stays up to 350 ms (`HOLD_MS`, `src/client/navigation.ts:20`) while the title page loads its data and the images in view (`navigation.ts:68-80`), then crossfades in 160 ms. The card's poster morphs into the title page's poster over 220 ms (`navigation.ts:116`, `globals.css:374-388`). Plex's code has neither.
- The band under the title shows a blurred copy of the poster the browser already has, and the backdrop settles in over it (`src/client/components/ui/header-title.tsx:82-90`). This already beats Plex's artwork-colour background without extracting colours.
- **New:** hovering a Home card for 100 ms, or focusing it with the keyboard, starts both the title's detail request and its backdrop download. A pointer press starts them too if hover did not (a click fires about 100 ms after the press). The 100 ms wait stops a pointer sweeping across a row from firing 20 requests. Discover already prefetches the backdrop on hover, without the wait and without the data (`src/client/discover/Card.tsx:14-19, 38-40`).
- **New:** when Home has drawn and the browser is idle, prefetch the detail and backdrop of the first row's visible cards, at most 6. This makes the first row's title pages instant on purpose, where Plex's appear to be by accident.
- The title page reads a prefetched detail from memory if it is under 60 seconds old, and asks the server otherwise (`src/client/title/Overview.tsx:95-130` fetches today with no memory).

### 2. Back to Home

- Target: Home is back on screen in one 160 ms crossfade, no skeleton, at the same page scroll and the same sideways position in every row. Plex's Back does not scroll rows back (Apple TV report above).
- Page scroll is already restored per address (`navigation.ts:26-28, 137-142`); row scroll is kept per row in session storage (`src/client/discover/Row.tsx:28-39, 61-76`).
- **New:** keep the last Home reply in memory. Back draws it at once and asks the server again behind it; changed cards update in place with the 160 ms content crossfade (`globals.css:393-400`).

### 3. Home load

- Target: the first visit draws within the 350 ms hold with no skeleton; the server answers Home from its own cache in ≤ 150 ms with ≤ 60 KB of data.
- One request for every row that comes from our own server (Continue watching, Up next, Recently added, Playlists), up to 20 cards per row, and no summaries: a summary arrives with the title page's detail. Copied from Plex's `excludeFields=summary`.
- Rows from outside services (Trakt and Letterboxd watchlists) never hold the page. They show a skeleton row and fade in when they arrive, as Plex lets each server's rows fill in on their own.
- Live changes (playback stopped, a download imported) reach Home over the existing event stream, so it is never stale. Plex's Continue Watching is.

### 4. Row scroll

- Target: no frame longer than 50 ms while scrolling a row; arrows move one screen of cards in a smooth scroll.
- Arrows scroll by the number of whole cards in view (`Row.tsx:78-82`); trackpad sideways scroll and hidden scrollbars already work (`Row.tsx:84-87`). Cards skip re-rendering when nothing changed (`Card.tsx:31`, `memo`).
- **New on phone:** the row stops on a card edge (CSS `scroll-snap-type: x mandatory` with `scroll-snap-align: start` on cards).
- No list virtualisation (drawing only the cards in view). Eight rows of 20 cards is 160 cards; the browser handles that without it.

### 5. Hover and focus

| Trigger | What changes | Time |
|---|---|---|
| Pointer over card | poster darkens to 92%, Play button fades in on the art, no size change | 120 ms, ease-out |
| Pointer press | poster to 84% | 0 ms |
| Keyboard focus | 2 px ring | 0 ms |
| Left / Right in a row | focus moves; the row scrolls so the focused card sits at least the page margin from the edge | smooth scroll |

- Hover brightness and press are already in the poster card (`src/client/components/ui/library-poster-card.tsx:76-87`) and DESIGN.md's Motion table. The scroll padding exists on the strip (`Row.tsx:86`, `scroll-px-(--page-margin)`).
- Nothing moves on hover except the Play button's fade. Plex slides badges 10 px and fades the progress bar, which hides progress exactly when the pointer is on the card.
- Progress bar under the poster, as in the owner's screenshot and Plex's iOS app, is a design call for the Home cards; the library card draws it on the poster today (DESIGN.md "Watch marks on the poster card").

### 6. Menus

- The web app has a top bar, not a sidebar; its phone sheet slides up in 220 ms and dropdowns fade and slide 4 px in 120 ms (DESIGN.md Motion table). These already match or beat Plex's 200 ms.
- **The TV side menu does not.** Today it appears with no animation and pushes the page sideways, so the whole page re-measures (`android-tv/…/tv/ui/Navigation.kt:279-283`). Rule: the menu lays over the page and never pushes it; it slides in over 150 ms on the same ease-out as focus (`android-tv/…/ui/components/Focus.kt:26`) and out in 120 ms; focus moves into it at once, not after the slide. Plex's web sidebar also lays over the page, in 200 ms.

### 7. Images

| Card | Drawn at | Ask for | Today |
|---|---|---|---|
| Poster | 210 px wide | ≥ 420 px (2× screens): TMDB `w500` | Library `w500` (`src/server/library.ts:287`); Discover `w342` (`src/server/tmdbTitles.ts:31`), soft on 2× screens |
| Landscape card (Continue watching, Up next) | 256 to 325 px wide | ≥ 650 px: TMDB `w780` | not allowed yet: the image route takes only `w342` and the 1920 backdrop (`src/server/titles.ts:330`) |
| Title page backdrop | full width | 1920 px | as now |

- Plex sizes each image to the element exactly through its server's resizer. We pick the nearest TMDB size at or above twice the drawn width, which costs nothing to run.
- **New:** the first row's visible cards (about 5) load with `loading="eager"` and `fetchpriority="high"`; every other card stays `loading="lazy"` (`library-poster-card.tsx:77`). Target: first-row posters visible ≤ 600 ms after a cold load; Home's largest paint (LCP, already logged) ≤ 1.2 s.
- A poster that arrives late fades in over 160 ms on top of the shimmer (`library-poster-card.tsx:83-86`); one that arrives inside the 350 ms hold just appears with the page (`navigation.ts:107-108`).
- **New:** our copies of TMDB images never change at a given address, so the browser may keep them a day (`Cache-Control: private, max-age=86400`) instead of 5 minutes (`src/server/app.ts:235`). Plex collages keep the 5 minutes, as they do change.

### 8. Measuring the targets

- LCP, INP (how long the page takes to respond to a click or key) and each API request's time are already logged per screen (`src/client/metrics.ts`).
- **New:** log one `screen` item per screen change, from the click to the moment the new screen shows (`changeScreen` in `navigation.ts:82-125`), with the old and new route. That one number checks rules 1 to 3.

### 9. If Home gets a backdrop band (direction A in patterns.md)

- Follow the TV app: the band follows focus or hover only after it rests 300 ms (`RailsPage.kt:72-73`), crossfades in 150 ms (`RailsPage.kt:119`), and fades out once the first row scrolls away (`RailsPage.kt:113`).
- Rule 1's idle prefetch of the first row's backdrops means the band never shows an empty frame.

### 10. Anything cached shows almost at once (owner, 16 Nov 2026)

Caching only helps if reading it back is fast too. For anything the app already holds:

- **Target:** cached data and images are on screen in the first frame of the new screen (about 16 ms), and never later than 100 ms after the screen change. No skeleton, no shimmer, no fade for anything already held.
- **Data:** keep cached replies (Home, prefetched title details) in memory as ready-to-draw objects, keyed by title id, so a screen draws from them in the same render without waiting on a request, parsing or a storage read. The server request still runs behind and updates in place (rule 2).
- **Images:** an image counts as ready only once the browser has decoded it, not merely downloaded it. Prefetched posters and backdrops are decoded ahead with `HTMLImageElement.decode()`, so drawing them costs no decode on the click. Cards whose image is ready skip the shimmer and the 160 ms fade-in.
- **Order:** draw from memory first, then check the network. Never hold a cached screen behind the 350 ms wait (`HOLD_MS`); that wait is only for screens with nothing cached.
- **Memory limit:** cap what is held (for example the last 50 title details and the images for Home's visible rows) so a long session doesn't grow without end.
- **Measured** by the per-screen timing from rule 8, split into "from memory" and "from the network".

## How to build each

Ranked by how much faster the page feels per hour of work.

| # | Change | Where | Size |
|---|---|---|---|
| 1 | Hover (100 ms rest), focus and press prefetch of title detail and backdrop; a 60-second detail memory the title page reads first | shared helper from `discover/Card.tsx:14-19`; read in `title/Overview.tsx` | M |
| 2 | Keep the last Home reply in memory; Back shows it at once and refreshes behind | Home screen | S |
| 3 | `screen` timing item per screen change | `navigation.ts` `changeScreen`, `metrics.ts` | S |
| 4 | First row's cards eager with `fetchpriority="high"` | poster card gets an `eager` prop | S |
| 5 | Image sizes: Discover posters to `w500`; allow `w780` for landscape cards | `tmdbTitles.ts:31`, `titles.ts:330` | S |
| 6 | Idle prefetch of the first row's detail and backdrop, at most 6 | Home screen, using #1 | S |
| 7 | Outside-service rows (Trakt, Letterboxd) never hold Home; they fade in | Home screen | S |
| 8 | TV side menu over the page, 150 ms slide in, 120 ms out | `android-tv/…/tv/ui/Navigation.kt` | S |
| 9 | Day-long browser cache for TMDB image copies | `server/app.ts:235` | S |
| 10 | Phone rows stop on card edges | row strip classes | S |
| 11 | Backdrop band following hover and focus, first row only (only if direction A is picked) | Home screen, rules from `RailsPage.kt` | M |

Not worth copying:

- **A React Native or react-native-web rewrite.** Plex's rewrite is where its reported slowness comes from; our web app already has the motion rules above.
- **An animation library.** CSS transitions and the browser's view transitions cover every rule here; Plex Web uses none either.
- **List virtualisation.** Not needed at 160 cards (rule 4).
- **Colour extraction for the title background.** The blurred poster gives the same effect from an image already downloaded.
- **Asking for one extra card to know whether a row has more.** Our server returns whole rows of known length.
