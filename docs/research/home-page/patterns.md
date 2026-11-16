# Home page: how the best apps do it, and what to draw

Research for turning `/` from the library grid into a page of rows built for watching. Gathered 16 Nov 2026.

Owner's rules this follows: only playable content (on disk and in Plex); partial seasons may appear but must say only some episodes exist; recently played is per episode; the page is for watching, not for managing downloads. Detail pages stay as they are.

A note on sources. Plex's support site refuses automated reads, so Plex facts come from its forums and press coverage, linked inline. Card shapes that no page documents are marked "seen in the app" and are not backed by a link.

## What this app already has

- The server already reads Plex's own Continue Watching list (`/hubs/continueWatching/items` in `src/server/services/plex.ts`). That list mixes partly watched items with next episodes, as Plex merged the two in 2021 ([forum](https://forums.plex.tv/t/difference-of-on-deck-and-continue-watching/168913)).
- `GET /api/library/titles` already returns `recentlyAddedTv` and `recentlyAddedFilms` (up to 20 each, a show ranked by its newest episode), playlists, and a route to remove an item from Continue Watching (`docs/plans/android-tv-app-plan.md`, "Home rails and playlists" and T23).
- The TV app already has an approved Home (`android-tv-app-plan.md`, T16a): the focused card's backdrop at the top, then Continue watching, Recently added TV, Recently added films, Playlists, then the Trakt rows from Discover. Focus starts on the first Continue watching card. The web Home should match it unless the owner wants them to differ (question 5).
- `DESIGN.md` sets the poster card at 210 by 315, six per row at 1440 px with 20 px gaps, and a 40 px page margin. On a poster card, a click opens the title page and only the Play button plays. Discover rows (`src/client/discover/Row.tsx`) already scroll sideways with arrows and remember their scroll position.

## 1. What each app shows

### Plex (web, mobile, TV)

| Row | What it holds | Card | Notes |
|---|---|---|---|
| Continue Watching | Partly watched items and the next episode of shows in progress, merged since 2021 | Varies by app and version: show poster, season poster or landscape still ([season poster thread](https://forums.plex.tv/t/plexmediaserver-1-41-0-8911-displays-season-posters-in-home-hub-cw-and-not-show-posters/886011), [Apple TV landscape thread](https://forums.plex.tv/t/apple-tv-plex-thumbnails-for-continue-watching-are-no-longer-large-thumbnails/704357)). Progress bar under the art; show name over "S2 · E5" (seen in the app) | Always shown, cannot be hidden ([search summary of Plex's Manage Recommendations article](https://support.plex.tv/articles/manage-recommendations/)). Server setting "weeks to consider", 16 by default per [forum](https://forums.plex.tv/t/how-to-hide-remove-or-disable-on-deck-from-plex-dashboard-main-screen-setting-weeks-at-0/231338); a library option for season premieres. "Remove from Continue Watching" per item, no undo found ([forum](https://forums.plex.tv/t/how-to-undo-remove-from-continue-watching/710134)) |
| Recently Added (per library) | Newest files per library, such as "Recently Added in TV Shows" | Posters | On Home by default for each pinned library |
| Recently Released, Top Rated, genre and actor rows | Per library, chosen by the server owner | Posters | Set per library on the server, not per viewer ([forum](https://forums.plex.tv/t/allow-custom-order-on-home-library-rows-recommendations/826501)) |
| Playlists, Watchlist, Discover, Live TV, free streaming rows | Plex's own catalogue mixed in with the owner's files | Posters | Turned off only through account settings, which some report turning back on ([forum](https://forums.plex.tv/t/stop-unhiding-and-reenabling-the-streaming-section-please/696434)) |

Next episode: Plex picks the episode after the furthest one watched. If a later "season" is marked played (extras filed as Season 101), the show drops out of Continue Watching until an earlier episode is replayed ([forum](https://forums.plex.tv/t/bug-continue-watching-fails-if-something-in-later-season-is-marked-as-played/796698)).

Hero: Plex Web's Home has no large banner at the top (seen in the app).

### Jellyfin

| Row | What it holds | Card | Notes |
|---|---|---|---|
| My Media | Library tiles | Small tiles or buttons | First by default |
| Continue Watching | Partly watched only | Show art by default; a viewer setting swaps in episode stills | Separate from Next Up |
| Next Up | Next unwatched episode of each show in progress | Same as above | "Max days in 'Next Up'", default 365; "Enable Rewatching in Next Up", off by default |
| Recently Added Media (per library) | Newest items | Posters | Viewer setting "Hide watched content from 'Recently Added Media'" |

Default order: My Media, Continue Watching, Continue Listening, Continue Reading, Live TV, Next Up, Recently Added. Each viewer sets up to 10 row slots for themselves. Source: [`homeSectionType.ts`](https://github.com/jellyfin/jellyfin-web/blob/master/src/constants/homeSectionType.ts), [`userSettings.js`](https://github.com/jellyfin/jellyfin-web/blob/master/src/scripts/settings/userSettings.js), [`en-us.json`](https://github.com/jellyfin/jellyfin-web/blob/master/src/strings/en-us.json). A viewer setting, "Display missing episodes within seasons", shows episodes that are not on disk inside season lists.

### Infuse

| Row | What it holds | Card | Notes |
|---|---|---|---|
| Up Next (top row) | Watching plus recently added, or one of them: the "Up Next List" setting has Watching Only and Recently Added Only ([forum](https://community.firecore.com/t/recently-added-missing-from-up-next-on-apple-tv/51381)) | Landscape art with progress (seen in the app) | The same setting feeds the Apple TV top shelf |
| Pinned lists | Any library view pinned with "+" (Recently Added, a genre, Favourites) | Posters | Reordered from the lists button at the top right of Home ([forum](https://community.firecore.com/t/options-for-top-shelf-display/35258)) |

Better than Plex: one compact top row, and the viewer, not the server owner, decides which other rows appear.

### Apple TV app

| Row | What it holds | Card | Notes |
|---|---|---|---|
| Continue Watching (was Up Next until iOS 18.1) | Started but not finished items, plus the next episode | Landscape still with a progress line (seen in the app) | Hold select, then "Remove from Up Next"; items return when played again ([Apple Community](https://discussions.apple.com/thread/254866015)) |
| Watchlist | Saved titles, as a separate row since iOS 18.1 ([iDownloadBlog](https://www.idownloadblog.com/2024/09/25/ios-18-1-apple-tv-watchlist-section/)) | Landscape | |
| Featured, then editorial rows | Promotion | Large banner | In 2022 a Featured row pushed Up Next down the page, and press coverage called it burying what people watch ([BGR](https://bgr.com/tech/apple-tv-app-is-burying-up-next-and-people-cant-find-what-they-want-to-watch/)) |

### Netflix

| Row | What it holds | Card | Notes |
|---|---|---|---|
| Large banner at the top | One recommended title | Full-width art | Part of the May 2025 TV redesign ([Tom's Guide](https://tomsguide.com/entertainment/netflix/netflix-is-making-a-massive-change-to-its-homepage-for-the-first-time-in-years)) |
| Continue Watching | Partly watched items, one per show | Landscape art with progress (seen in the app) | "Remove From Row" on hover on a computer; on a TV, from the title page ([Netflix Help](https://help.netflix.com/en/node/115312)). Also kept in the My Netflix hub ([Tudum](https://www.netflix.com/tudum/articles/netflix-new-tv-layout)) |
| Personalised rows | Change while you browse | Larger cards showing runtime, rating and awards when focused ([Tudum](https://www.netflix.com/tudum/articles/netflix-new-tv-layout)) | |

### Trakt (web and apps) and Sequel

| Row | What it holds | Notes |
|---|---|---|
| Continue Watching | Next episodes and unfinished films, skipping unreleased items ([changelog, 2 Dec 2025](https://roadmap.trakt.tv/en/changelog)) | Sort options added 2026; rewatches can be tracked |
| Start Watching | Watchlist items not yet started | Same source |
| Progress (own page) | In progress, Up to date, Ended, Dropped | "Drop show" removes it from Up Next, Progress and calendars without losing history ([AlternativeTo](https://alternativeto.net/news/2025/4/trakt-tv-launches-drop-show-for-easier-watchlist-cleanup-across-all-platforms)) |

Sequel keeps one Up Next queue that fills with new episodes on their own and shows upcoming season premiere dates ([Devon Dundee](https://devondundee.squarespace.com/blog/sequel)).

### Channels

Up Next jumps straight to the next unwatched recording of a series ([Channels forum](https://community.getchannels.com/t/home-screen-channel-for-recordings/11420)). Too thinly documented to say more.

### Google TV's own Continue watching row (rules worth copying)

Google's rules for apps that feed the TV's home screen ([guidelines](https://developer.android.com/training/tv/discovery/guidelines-app-developers), [types](https://developer.android.com/training/tv/discovery/watch-next-add-programs)):

- Four kinds of item: stopped partway, next episode, new episode of a show you were caught up on, and saved to watchlist.
- A film counts as started after 3% or 2 minutes, whichever comes first; an episode after 2 minutes. Finished means the end credits started, or under 3 minutes left of an episode.
- Never more than one episode per show.
- Add a new episode "no matter how long it has been" since the viewer last watched.
- Remove a show when it has no unwatched episode available.
- Only update the item that changed, not the whole row.

## 2. Ways to beat Plex

1. **Own files only.** Plex fills Home with Discover, Live TV and free streaming, and its off switch reverts for some people ([forum](https://forums.plex.tv/t/stop-unhiding-and-reenabling-the-streaming-section-please/696434), [forum](https://forums.plex.tv/t/live-tv-and-discovery-are-forced-on-my-home-page-unable-to-hide-remove/913801)). Every card on our Home plays a file the owner has.
2. **Continue watching updates as soon as playback stops.** Plex apps often show a stale list until restarted ([forum](https://forums.plex.tv/t/the-plex-android-app-needs-to-be-manually-refreshed-or-closed-to-update-continue-watching/834991), [forum](https://forums.plex.tv/t/the-continue-watching-section-on-the-fire-tv-lite-will-not-stay-current/744867)). Our server already pushes download changes over its event stream; playback stops can ride on the same stream.
3. **One order, stated on the page, that every action changes.** Most recent activity first, where marking an episode watched counts as activity. In Plex it does not ([forum](https://forums.plex.tv/t/plex-not-updating-continue-watching-order/870173)), and items get pushed out by a hidden cap ([forum](https://forums.plex.tv/t/newly-added-items-are-replacing-content-in-continue-watching-instead-of-adding-to-it/868878)).
4. **Gaps get named.** When the next episode is not on disk but a later one is, Plex quietly offers the later one or drops the show ([forum](https://forums.plex.tv/t/bug-continue-watching-fails-if-something-in-later-season-is-marked-as-played/796698)). Ours says "S2 E3 isn't downloaded" and offers Search for it or Play S2 E4.
5. **Next episode still downloading shows live progress.** Plex knows nothing about downloads. We do: "S2 E6 · downloading 64%, about 8 min" on the card, and it turns into Play when the file lands. The player's Up next panel already has this waiting state.
6. **Remove with Undo.** Plex's remove has no undo ([forum](https://forums.plex.tv/t/how-to-undo-remove-from-continue-watching/710134)). Ours uses the existing toast with Undo and the Z key.
7. **Abandoned shows age out by a rule the owner can see.** Plex's 16-week window applies to the whole server and premieres of dropped shows keep coming back ([forum](https://forums.plex.tv/t/new-seasons-of-old-shows-wont-drop-off-on-deck/236309)). Offer Trakt's "Drop show" (removes it from Up next and keeps history) and a visible age limit, as Jellyfin does with "Max days in 'Next Up'".
8. **No spoilers on cards.** Use the show's backdrop for an episode not yet started, and the episode still only for one stopped partway. Jellyfin makes this a setting; Plex users complain about spoiling stills ([forum](https://forums.plex.tv/t/video-thumbnails-avoid-spoilers/934366)).
9. **Partial seasons say so.** "Season 3 · 4 of 10 episodes" on Recently added. Neither Plex nor Infuse marks this on Home.
10. **Continue watching stays at the top.** In Plex, reordering other rows can push it down ([search summary of Plex's article](https://support.plex.tv/articles/manage-recommendations/)); Apple's Featured row did the same ([BGR](https://bgr.com/tech/apple-tv-app-is-burying-up-next-and-people-cant-find-what-they-want-to-watch/)). Pin it first; other rows can be hidden or reordered by the viewer, not set per server.
11. **Same Home on web, phone and TV.** Plex's native apps and Plex Web disagree about what is in Continue Watching ([forum](https://forums.plex.tv/t/continue-watching-shows-different-content-in-native-apps-vs-web-ui/939868)). One server route feeds all three.
12. **One card per show.** Google's rule. The card names the exact episode ("S2 · E5 · Woe's Hollow") and the time left, so the viewer never wonders which episode plays.

## 3. Recommended default rows, in order

1. **Continue watching**: films and episodes stopped partway, newest first. It is the fastest route back into something.
2. **Up next**: the next episode of each show in progress, plus new episodes of shows the viewer was caught up on (marked "New"). One card per show, and never a show that is already in row 1. Answers "what do I watch tonight" without a search.
3. **Recently added TV**: one card per show, ranked by its newest episode, with "3 new episodes" or "S3 · 4 of 10 episodes". This is where downloads finishing turn into something to watch.
4. **Recently added films**: newest first, watched ones hidden (Jellyfin's setting). Same reason for films.
5. **On your watchlist**: watchlist titles that are on disk and not started (Trakt's "Start Watching"). Turns a saved list into a playable one.
6. **Playlists**: the owner's Plex playlists, already in the TV design and on the server.
7. **Because you watched [title]**: TMDB recommendations for something recently finished, filtered to titles on disk. The only recommendation row that obeys "only playable".
8. **Unwatched films**: a shuffled pick of owned, unwatched films. Gives a choice when every row above is empty or stale.

Each row hides itself when empty. When every row is empty, show the one empty-state sentence with a link to Discover (as the TV design does).

Left off Home: Trakt trending, popular and upcoming (they show titles not on disk, so they stay on Discover), Calendar, and anything about downloads beyond a card's own progress.

## Behaviour on each screen

### Desktop web (1440 wide, 40 px margins, 1360 px of content)

- Rows scroll sideways, as Discover's rows already do: arrow buttons at the row's right end on hover, trackpad sideways scroll, scroll position remembered.
- Landscape cards (Continue watching, Up next): 16:9. Four across is 325 by 183; five across is 256 by 144. Posters (other rows): the existing 210 by 315, six across.
- The next card always peeks past the right edge so it is clear the row scrolls.
- Keyboard: Tab moves between rows (one stop per row), Left and Right move within a row, Enter acts on the card. This keeps a 10-row page to 10 Tab presses.
- Card text under the art: show name (14/600), then "S2 · E5 · 31 min left" in the data font. Progress bar on the art, as the poster card's watch bar does today.

### Phone (375 wide, 16 px margins)

- Same rows, swiped sideways with scroll snapping, no arrow buttons.
- Landscape cards about 280 wide so one and a bit shows; posters about 120 wide so two and a half show.
- Remove and Mark watched sit in the existing bottom sheet, opened from a "•••" on the card or a long press.

### Android TV app

- Already designed (T16a): backdrop of the focused card at the top, rows below, focus starting on the first Continue watching card, hold OK for the action list.
- Google's card widths on the 960 by 540 grid: three across is 268 dp, four is 196 dp, with 20 dp gaps ([tv-design-guidelines.md](../tv-design-guidelines.md)). Continue watching fits three landscape cards at 268 dp; poster rows use the existing 127-wide card.
- Rows keep the focused card at a fixed spot near the left edge as focus moves right (Compose's `BringIntoViewSpec`, per the same doc).
- The TV's own home screen has a Continue watching row of its own that apps can feed ("Play Next"). Feeding it from the same server list would put the owner's shows on the TV's home before the app opens. Out of scope for the page itself.

## Partial availability, missing next episodes, new episodes, more than one viewer

- **Partial season on Recently added:** "S3 · 4 of 10 episodes". If the rest are not out yet, say "S3 · 4 episodes, 6 not out yet"; if they aired but are not on disk, "S3 · 4 of 10 · 6 missing". Two different facts, two different lines.
- **Gap before the next episode:** the Up next card names the gap ("S2 E3 isn't downloaded") and keeps the show, with Play S2 E4 as a second choice. It does not skip silently.
- **Next episode downloading or searching:** see question 3. The card can carry the download line from the poster card ("Downloading 64%") until the file lands.
- **New episode badge:** a small "New" badge on an Up next card when the show was caught up and a new episode landed, and "3 new" when several did. Google files these as their own kind of item and keeps them no matter how long ago the viewer last watched.
- **More than one viewer:** Plex keeps watch state per Plex user, so each signed-in person gets their own Continue watching and Up next. Recently added is the same for everyone. Infuse fails to keep Home setups apart across Plex managed accounts ([forum](https://community.firecore.com/t/direct-mode-recently-added-in-home-screen-lists-show-duplicates-from-pinned-plex-collections/60058)); row choices should be saved per viewer on the server, not per browser.

## Where the library grid and Discover go

- `/` becomes Home. The library grid moves to `/library`, unchanged apart from the address. The home link's label "go to the library" in `Home.tsx` changes to "go to Home".
- `navItems` in `src/client/Home.tsx` becomes: Home `/`, Library `/library`, Discover `/discover`, Calendar, Downloads, Flagged, History, Health. Eight items where today there are seven; whether an eighth fits beside the search field at 1440 px is untested (question 6).
- The TV app's side menu splits the library into TV and Films. The web could do the same with `/library/tv` and `/library/films` (question 6).
- Discover stays as it is: titles not owned, with Add.
- The library's Continue Watching filter becomes redundant with Home's first row; it can stay for a full grid view of the same list.

## 4. Layout directions to draw

### A. Backdrop at the top, then rows (matches the TV design)

- Desktop: a 420 px band under the app bar holding the backdrop of the first Continue watching item, fading into the page colour. On it, left-aligned at the page margin: the show name (36/800), "S2 · E5 · Woe's Hollow · 31 min left" (16/500), a two-line summary, and a large Resume button with a watch bar under it. A second, outline button opens the title page.
- The band follows hover or keyboard focus on any card in the first two rows, with a 160 ms crossfade, as the TV app follows focus.
- Below the band: Continue watching (landscape, five across at 256 by 144), Up next (landscape, same size), then poster rows at 210 by 315.
- Phone: the band shrinks to 16:9 at full width with the button under it; rows follow.
- Risk: the band takes a third of the screen on a laptop. It only works if the band always shows something the viewer was already watching, never promotion.

### B. Rows only, compact

- No band. The app bar, then the page title "Home" (36/800) with a one-line count ("3 shows in progress · 12 new episodes this week"), then rows straight away.
- Continue watching and Up next as landscape cards five across (256 by 144) with the Resume or Play button always visible on the card, as the poster card shows it on the library's Continue Watching filter today.
- Every other row is posters at 210 by 315, six across.
- About four rows fit on a 900 px tall window, so most viewers see Recently added without scrolling.
- Phone: identical structure, cards sized as above.
- Closest to Plex Web and Infuse; cheapest to build because Discover's row code already does it.

### C. One large Up next row, then compact rows

- One merged first row, "Up next", holding both stopped-partway items and next episodes, ordered by last activity: three large landscape cards across at 440 by 248, each with the still or backdrop, show name (20/700), episode line, a one-line summary, and Resume or Play (36 px button) on the art. The fourth card peeks.
- Under each large card, a thin second line names a gap or download when there is one ("S2 E3 isn't downloaded · Search").
- Below, compact rows: Recently added TV and films as smaller posters (150 by 225, eight across) to keep the second screen dense.
- Phone: the large row becomes one card per screen width, swiped, with a dot count under it.
- Puts one click on what to watch next with no band above it, and keeps management out of view.

## 5. Questions for the owner

1. On a Continue watching or Up next card, should a click anywhere on the card start playing, as Netflix and Apple do, or keep today's rule where only the Play button plays and the rest opens the title page?
2. One merged first row (Plex, Apple, Trakt; direction C) or two rows, Continue watching then Up next (Jellyfin; directions A and B)?
3. When the next episode is downloading or being searched for, does the show stay in Up next with a progress line (not playable yet), or leave until the file lands?
4. Which watchlist feeds "On your watchlist": Plex's watchlist, Trakt's, or the titles the owner has added and not watched?
5. The approved TV Home ends with Trakt rows from Discover, which break "only playable". Drop them from the TV Home too, or let the TV differ from the web?
6. Library in the nav: one Library item at `/library`, or TV and Films as separate items like the TV app's side menu? And which item gives way if eight nav items do not fit?
7. When friends get accounts, does each one see their own Continue watching and Up next (needs their own Plex sign-in), or does everyone see the owner's?
8. Jellyfin owners: Home today has no watch data for them (the library hides played marks unless Plex is connected). Build Home from Jellyfin's own Continue Watching and Next Up, or show only the Recently added rows?
9. Can viewers hide and reorder rows from day one, or is the order fixed for the first version?
10. How long before an untouched show leaves Up next: a fixed time (Jellyfin defaults to 365 days, Plex's forum reports 16 weeks), only when dropped by hand, or both?
