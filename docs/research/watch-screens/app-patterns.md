# Watch screens: how other apps build show, season, episode and film pages

Research for the playback-first pages: Home (rows), show page, season page, episode page, film page, one design on web and TV. Gathered 17 Nov 2026. Plex is covered in a separate note and appears here only for contrast.

How the sources were read:

- Apple's guidelines (HIG) were read from their JSON data, since the pages need JavaScript. Apple's own web app (tv.apple.com) sends finished HTML, so its show, episode and film pages were read directly: what the page lists is what the page has.
- Netflix, Prime Video and Disney+ were read from their public, signed-out web title pages. Signed-in pages carry more (buttons, progress), which those pages do not show.
- Jellyfin was read from its source code (jellyfin-web and jellyfin-androidtv on GitHub, `master` on 17 Nov 2026).
- Help pages and press articles are linked inline. A claim with no link is marked "(no link)" and comes from general knowledge of the app; treat it as unverified.

## What this app already has

- Show and film pages already name the exact episode on Play: "Resume S2 E4" with "Stopped at 21:00 · S2 E4 · Woe's Hollow" and "31 min left of 52 min", or "Play S3 E5" with the episode title and length (`src/client/title/playLine.ts`, `seriesPlayLine`). A resume menu offers starting over (`TitlePlay.tsx`).
- The next episode is Plex's next episode, else the earliest playable one, with specials last (`nextEpisode` in the same file).
- On an episode row the still is the Play button (`TitlePlay.tsx`, line 133).
- Owner rules already set (memory "home page row decisions", TV plan `docs/plans/android-tv-app-plan.md`):
  - Web: a click on a card opens the title page; only the Play button plays.
  - TV: OK on a card opens the title page; the remote's Play/Pause key plays it (T33). Holding OK opens a short list of actions; the title page carries the same actions as buttons after Play (31 Oct).
  - Backdrop: a 16:9 picture pinned right, cover fit, fading on the left and bottom edges only, the film's own title lettering with plain text as fallback.
  - Speed: title page within 350 ms, backdrop within 500 ms.
  - TV: side menu on the left; Back on a page returns to the menu item (Google's rule for apps with left navigation).

## 1. Element inventory

Each table lists who has the element, its variants, and the most common variant. "Most common" counts the apps in this note that have the element.

### Hero

| Element | Who has it | Variants | Most common |
|---|---|---|---|
| Backdrop | All | Full-bleed 16:9 picture behind the text (Apple's "superhero" block in its web page markup; Disney+'s `DetailEntityHero`; Jellyfin's backdrop); a "larger banner" on Google TV's 2025 details page ([Android Authority](https://www.androidauthority.com/google-tv-material-3-expressive-partial-rollout-3577125/), 14 Jul 2025) | Full-bleed picture, text on the left |
| Backdrop crop | Google, Apple | Google's immersive list: 16:9 background with the subject placed top right ([Immersive list](https://developer.android.com/design/ui/tv/guides/components/immersive-list)). Apple's Top Shelf images are flipped and blurred to fit 1920 px at 16:9 when used as a fallback ([Top Shelf](https://developer.apple.com/design/human-interface-guidelines/top-shelf)) | Subject right, text left |
| Scrim | All | A gradient under the text. Apple's markup names it `legibility-gradient` and `lockup-scrim`. Our rule: fades on the left and bottom only | Left-to-right plus bottom fade |
| Title logo vs text | Apple (`contentLogo` in page data), Jellyfin web (`renderLogo`, logo image when the server has one), Netflix (no link) | Logo image; plain title text as fallback | Logo, with text fallback |
| Autoplay trailer or preview | Apple web ("Unmute Preview" control, so it starts muted), Google TV ("trailers... will now play automatically", switchable off under Enable video previews, [9to5Google](https://9to5google.com/2021/07/19/android-tv-watchlist-update/), 2021), Netflix (per-profile switch "Autoplay previews while browsing", [Netflix Help](https://help.netflix.com/en/node/2102)), Prime Video (video plays in the hero on TV devices, [Amazon](https://www.aboutamazon.com/news/entertainment/prime-video-updated-steaming-experience), 23 Jul 2024) | Muted start; with sound; off by setting | Autoplay on, with a setting to stop it |
| Overline above the title | Apple ("2026 Oscar® Winner" above the film title on its web page); Netflix home labels such as "Emmy Nominee" ([Tudum](https://www.netflix.com/tudum/articles/netflix-new-tv-layout), 7 May 2025) | Award, "New episode", ranking | Rare on detail pages |

### Facts line and ratings

| Element | Who has it | Variants | Most common |
|---|---|---|---|
| Facts line | All | Apple: "TV Show · Thriller · Mystery" then "2022 · 57m · 15+". Netflix: "2025 · 5 Seasons · TV-14 · Sci-Fi". Prime: "IMDb 8.5/10 · 2019 · 5 seasons · Action • Comedy • Dark · 18+". Disney+: "2022 – 2025 • 2 Seasons • genres" (each from its public page) | Year, season count or runtime, age rating, genre |
| End time | Jellyfin ("Ends at {0}", `EndsAtValue` in `mediainfo.js`, counted from the saved position) | Clock time when the film or episode would finish | Only Jellyfin |
| Ratings | Prime (IMDb score), Apple (Common Sense age and blurb), Google TV (a Ratings section with pill-shaped shortcuts), Jellyfin (community star rating and a critic score drawn fresh or rotten, `mediainfo.js`) | One score in the facts line; a ratings section lower down | One score inline |
| Mood tags | Netflix ("This show is... Ominous, Nostalgic"), Prime ("Action • Comedy • Dark") | Inline or under More details | Netflix and Prime only |
| Advisories | Apple ("Content Advisories: Sexual Content, Violence, Language"), Disney+ (photosensitivity warning in Details) | In the details section | Details section |

### Primary action

| State | Who has it | Variants | Most common |
|---|---|---|---|
| Play, never started | All | "Play"; Apple and this app name the episode (this app: "Play S3 E5"); Jellyfin Android TV "Play next up" (`lbl_play_next_up`) | "Play" plus the episode named nearby |
| Resume | All | Jellyfin web keeps the Play icon and changes its label to "Resume" (`reloadPlayButtons`); Jellyfin Android TV "Resume from 12:34" (`lbl_resume_from`); this app "Resume S2 E4" with minutes left | Resume with a progress bar or time left |
| Play from start | Jellyfin web (a separate Replay button shown only when there is a saved position, `btnReplay`; label "Play from beginning"), Kodi (setting "Default play action": ask, or resume at once, [Kodi wiki](https://kodi.wiki/view/Settings/Media/Videos)), this app (inside the resume menu) | Separate visible button; a menu or prompt on Play | Separate button, shown only when resumable |
| Next episode | Apple, Netflix, Max (Continue Watching holds "the next episode in a series that you're watching", [HBO Max Help](https://help.hbomax.com/hr-en/Answer/Detail/000001235)) | The show's Play button moves on to the next episode after one is finished | Play moves to the next episode automatically |
| Resume prompt | Kodi ("Ask if resumable") | Apple's guidance says not to ask: "If playback can be resumed, do so automatically without prompting for confirmation" ([Playing video](https://developer.apple.com/design/human-interface-guidelines/playing-video)) | Resume without asking |

### Secondary actions

| Element | Who has it | Variants | Most common |
|---|---|---|---|
| Watchlist / My List | Apple ("Add"), Prime ("Watchlist"), Google TV ("Watchlist"), Netflix (My List; moved further down in the 2025 TV design, [TechRadar](https://www.techradar.com/streaming/the-new-ui-is-borderline-unusable-netflix-subscribers-are-still-complaining-about-the-app-re-design-and-im-100-percent-with-them), 18 Sep 2025) | Icon button; labelled button | Icon button beside Play |
| Mark watched | Jellyfin (`btnPlaystate` on web, `ic_watch` on Android TV), Google TV ("Watched it?" for a movie or show; its help page does not mention episodes, [Google TV Help](https://support.google.com/googletv/answer/10070483?hl=en)), Kodi | Toggle button; menu item | Toggle button in self-hosted apps; streamers rarely offer it |
| Trailer | Prime ("Watch trailer"), Jellyfin (`btnPlayTrailer`), Apple and Netflix (a Trailers row lower on the page) | Button in the hero; a row further down | Button when one trailer; row when several |
| Shuffle | Jellyfin (shown for folders such as a show or season, `btnShuffle`) | Button | Self-hosted apps only |
| Like / dislike | Prime ("Like", "Not for me"), Google TV ("Like", "Dislike"), Netflix (no link) | Icon buttons | Streamers only |
| More | Jellyfin (`btnMoreCommands`), Netflix TV (page options holding "Remove from Continue Watching", [Netflix Help](https://help.netflix.com/en/node/115312)) | Overflow button; long press | Overflow button |
| Go to show / Go to season | Jellyfin Android TV on episode pages ("Go to series", previous episode), requested for Infuse in 2018 with no shipped answer in the thread ([Firecore forum](https://community.firecore.com/t/go-to-show-and-go-to-season-buttons/16192)) | Buttons on the episode page | Self-hosted apps |

### Season switcher

| Variant | Who uses it | Notes |
|---|---|---|
| Row of season names above the episode row | Apple tvOS and web ("Season 1 Season 2" above the episodes; choosing one jumps the row to that season's episode 1, [Apple Community](https://discussions.apple.com/thread/255349897)), Disney+ web (seasons listed under an Episodes heading) | The most common on big streaming apps |
| Drop-down | Netflix web ("Select Season" listing each season), Prime Video web (season selector; each season also has its own page, titled "The Boys - Season 1") | Common on web |
| Season list on the left, episodes on the right | Netflix TV ("Episodes and Info" or "Episodes and more" on the title, [Netflix Help](https://help.netflix.com/en/node/125348); layout per [TechWiser](https://techwiser.com/how-to-change-seasons-or-episodes-on-netflix/), third party) | Two columns; the left list doubles as navigation |
| Season posters opening a season page | Jellyfin web (portrait cards titled "Seasons", each with a Play overlay), Jellyfin Android TV ("Seasons" row; a season opens a grid of its episodes), Emby before 4.10 (a row of season folders), Kodi (a seasons list), Plex | The common pattern in self-hosted apps |
| Season tabs over an episode row, plus a full season screen | Emby 4.10 TV apps: focusing a season tab changes the episode row below; OK on a tab opens that season "in a new screen with the old vertical display format" ([Emby forum](https://emby.media/community/topic/123745-navigationui-is-weird-on-410)) | Closest to the recommendation in section 5 |
| Seasons as text on the play screen | Infuse ("On the preplayback screens you'll only see the seasons by text", designed as "a single screen access point", [Firecore forum](https://community.firecore.com/t/tv-shows-season-posters/56377), Jul 2025) | |
| No switcher for one season | Kodi ("Flatten TV show seasons", default "If only one season"), Emby 4.8 ("Display all episodes directly under series without using season layer", a per-viewer option, [4.8.0.80 release notes](https://github.com/MediaBrowser/Emby.Releases/releases/tag/4.8.0.80)) | |

### Episode list

| Element | Who has it | Variants | Most common |
|---|---|---|---|
| Layout | Apple: one sideways row of 16:9 stills with text under each. Netflix web, Prime web, Jellyfin season page: vertical list, still on the left, text on the right (Jellyfin `listView` with `imageSize: 'large'`). Jellyfin episode page: sideways row "More from Season 2" | Sideways row; vertical list | Vertical list on web; sideways row on TV |
| Episode number | Netflix "1. Chapter One"; Apple "EPISODE 1" as an overline; Disney+ "S2:E1"; Prime "1." | Before the title; overline; season and episode code | Number before the title |
| Title | All | One line, cut off at the end | One line |
| Runtime | All (Apple "57m", Netflix "49m", Prime "1 h 2 min") | Beside or under the title | Short form |
| Summary | All | Netflix and Apple print one to two sentences in full; Prime cuts at about 150 characters with the full text revealed; Jellyfin uses a "Show more" link on the main overview | Two lines |
| Air date | Prime (per episode), Apple (episode page: "Feb 18, 2022") | In the row; only on the episode page | Rare in the row |
| Age rating per episode | Prime ("18+" on each row) | | Prime only |
| Progress bar | Max ("Episodes that you've already watched have a progress bar", HBO Max Help, via search summary of the same article), Netflix and Apple (no link), this app | Bar under the still | Bar under the still |
| Watched mark | Jellyfin (played button on each row of the season page, `enablePlayedButton`), Kodi, this app (tick) | Tick on the still; toggle button | Self-hosted apps only |
| Missing or unaired | Jellyfin (viewer setting "Display missing episodes within seasons"), Prime (availability text per row such as "30-day free trial") | Shown dimmed; hidden | Hidden by default |
| Spoiler hiding | Kodi ("Show information for unwatched items": movie plot, episode plot and episode thumb can be hidden), Infuse ("Hide Spoilers" blurs descriptions and thumbnails of unwatched episodes, since 6.4, [Firecore](https://firecore.com/blog/24883)) | Blur; hide | Off by default where offered; requested for Plex, Emby and Jellyfin ([Jellyfin #273](https://github.com/jellyfin/jellyfin-web/issues/273), [Emby forum](https://emby.media/community/topic/48048-spoiler-plot-suppression-on-unwatched-items)) |

### Lower sections

| Element | Who has it | Variants | Most common |
|---|---|---|---|
| Cast | Apple ("Cast & Crew" with photos and role names), Jellyfin ("Cast & Crew"; "Guest stars" on episodes), Netflix (text list), Disney+ (text in Details) | Photo row; text list | Photo row on show and film pages |
| Extras | Apple ("Trailers", "Bonus Content"), Prime ("Bonus", "Trailers"), Disney+ ("Extras" tab), Jellyfin ("Special Features", "Additional Parts") | Row per kind; one tab | A row |
| More like this | Apple ("Related"), Netflix ("You Might Also Like"), Prime ("Customers also watched"), Disney+ ("You May Also Like", "Suggested" tab), Jellyfin ("More Like This") | Row; tab | A row at the bottom |
| Details block | Apple ("About", "Information", "Languages", "Accessibility"), Netflix ("More Details": genres, audio, subtitles, cast), Prime ("Details" tab), Disney+ ("Details" tab), Google TV ("Important Information", two columns since Jul 2025) | Section at the bottom; tab | Section at the bottom |
| Versions | Disney+ ("Versions" tab, IMAX Enhanced or Widescreen, [SlashGear](https://www.slashgear.com/1186589/heres-how-to-find-uhd-or-imax-enhanced-shows-and-movies-on-disney)), Jellyfin web (a version drop-down on the page, `selectSource`), this app (second versions) | Tab; drop-down before Play | Drop-down before Play in self-hosted apps |
| Audio and subtitles | Jellyfin web (audio and subtitle drop-downs on the page before playing, `selectAudio`, `selectSubtitles`), Apple and Netflix (read-only lists of languages), Infuse (only during playback; users have asked since 2018 to choose before playing, [Firecore forum](https://community.firecore.com/t/view-and-select-audio-subtitle-tracks-on-video-details-page/17826/45)) | Choosable before Play; read-only list; player only | Read-only list; choosable only in Jellyfin and Plex |
| Technical badges | Apple (4K, Dolby Vision, Dolby Atmos, CC, SDH, AD in its page labels), Prime ("HDR", "UHD"), Disney+ (DTS:X under Details, same SlashGear article) | Badges in the facts line; a list in Details | Small badges in or near the facts line |
| Chapters | Jellyfin Android TV (a "Chapters" row on films and episodes) | | Jellyfin only |

## 2. Navigation depth

| App | Show page | Season page | Episode page | Select on an episode | Select on a Continue Watching card |
|---|---|---|---|---|---|
| Netflix TV | Yes, with "Episodes and Info" or "Episodes and more" ([Help](https://help.netflix.com/en/node/125348)) | No | No | Plays | Since 2015, selecting a title starts or resumes it at once ([TechCrunch](https://techcrunch.com/?p=1186254), 22 Jul 2015); removal is from the title's details page ([Help](https://help.netflix.com/en/node/115312)). Current behaviour not confirmed |
| Netflix web | Yes, as a panel over Home (no link); public page lists episodes by season | No | No | Plays (no link) | Plays (no link) |
| Apple TV app, tvOS | Yes | No (season row on the show page) | Yes | Still: plays. Text under it: opens the episode page ([Apple Community](https://discussions.apple.com/thread/255349897), Dec 2023) | Plays ("highlight an item in the Up Next row, then press the center or play button", [Apple Support](https://support.apple.com/guide/tv/atvbe160da08/tvos)) |
| Apple TV web | Yes (`/show/`) | No | Yes (`/episode/`: show name, title, "S1, E2", summary, date, runtime, information, languages) | Opens the episode page (each episode links to `/episode/...`) | Not checked |
| Google TV | Yes | Not found | Not found | Not found | Opens the provider app (no link) |
| Disney+ | Yes, with tabs Episodes, Suggested, Extras, Versions, Details | No | No | Plays (no link) | Resumes ("select the episode or movie you want to stream", [Disney+](https://www.disneyplus.com/en-gb/explore/articles/remove-from-continue-watching), 29 Oct 2025) |
| Max | Yes | No | No | Plays (no link) | Resumes; on phone and computer "More Episodes" switches episode ([HBO Max Help](https://help.hbomax.com/hr-en/Answer/Detail/000001235), via search summary; the page is region-locked) |
| Prime Video | Yes, one page per season (tabs Episodes, Related, Details) | The show page is a season page | No | Plays (no link) | Plays (no link) |
| Jellyfin web | Yes (Next Up card, Seasons posters) | Yes (vertical episode list) | Yes ("More from Season X" row) | Opens the episode page; a play overlay on the still plays | Plays (no link) |
| Jellyfin Android TV | Yes (rows: Next Up, Seasons, Upcoming, Specials, Cast & Crew, More like this) | A grid of the season's episodes (`folderBrowser`) | Yes (Next episode row, Guest stars, Chapters) | Opens the episode page (`ShowDetails`), unless the row is set to play | Not checked |
| Emby | Yes; in 4.10 TV apps, season tabs over an episode row | Yes (OK on a season tab, or the season folders of older versions); none with the 4.8 option | Yes, with a seasons row when entered from the show ([Emby forum](https://emby.media/community/topic/106843-seasons-row-in-episode-detail-view)) | Opens the episode page | Not checked |
| Infuse | Yes | Seasons as text on the same screen | A play screen per episode | Opens the play screen (no link) | Opens the play screen; going back returns Home, not to the show ([Firecore forum](https://community.firecore.com/t/go-to-show-and-go-to-season-buttons/16192)) |
| Kodi | Yes (seasons list) | Yes (episode list), skipped for one season by default | Information dialog | Set by "Default select action": Choose, Play, Resume, Show information or Queue ([Kodi wiki](https://kodi.wiki/view/Settings/Media/Videos)) | Same setting |
| Plex, for contrast | Yes | Yes | Yes | Opens the episode page | Opens a page (see the Plex note) |

### Arguments for each depth

One show page with the episodes on it (Netflix, Apple, Disney+, Max):

- On a remote every page change costs a press and a wait. Google: "Organize your information in a way that requires the fewest screens" ([Navigation on TV](https://developer.android.com/design/ui/tv/guides/foundations/navigation-on-tv)).
- Changing season is a sideways move on one page; Back has one place to go.
- The cost: the show page gets long, and per-season facts (season summary, season poster, "mark season watched") have no home.

Separate season page (Jellyfin, Emby, Kodi, Plex):

- Room for a full vertical episode list with long summaries, the best reading layout on web.
- Season-level actions sit in one obvious place.
- The cost on TV: Show → Season → Episode is three presses before anything plays, and Back has to unwind each one. Kodi and Emby both added ways to skip the season layer, which shows the layer annoys people when it holds little.

Separate episode page (Apple, Jellyfin, Emby, Plex):

- Holds what the row cannot: full summary, guest cast, versions, audio and subtitle choice, file facts, mark watched.
- With a pointer it is cheap: the row links to it and the still plays. With a remote the select press can do only one thing, so the app must choose: Apple plays on select of the still and opens details from the text below; Jellyfin opens the page and plays from the page's button.

Remote control against pointer:

- With a pointer two targets on one row (still plays, text opens the page) cost nothing. With a remote they cost a press each, and the viewer has to know the split exists.
- On TV the dominant choice among streaming apps is: select plays, details are one step away. Self-hosted apps, whose users care about versions and files, open the page.

## 3. Focus and motion on TV, and the web equivalents

Rules from the guidelines:

- One primary action per screen; "the first button in the group acts as the primary action since focus lands on it first" (Google, [Buttons](https://developer.android.com/design/ui/tv/guides/components/buttons)).
- Give each direction one job: categories up and down, items in a category sideways (Google, [Navigation on TV](https://developer.android.com/design/ui/tv/guides/foundations/navigation-on-tv); Apple, "always moving focus in the same direction as the gesture", [Remotes](https://developer.apple.com/design/human-interface-guidelines/remotes)).
- Never move focus without the viewer's input, except to a neighbour when the focused item disappears (Apple, [Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)).
- Focused items grow; leave room so the larger item does not cover anything. Apple's safe area: 60 points top and bottom, 80 at the sides ([Layout](https://developer.apple.com/design/human-interface-guidelines/layout)). Google: 5% margins, 48 dp by 27 dp ([Layouts](https://developer.android.com/design/ui/tv/guides/styles/layouts)).
- Back: Apple says open "the parent of the current screen", which "isn't necessarily the previous screen" ([Remotes](https://developer.apple.com/design/human-interface-guidelines/remotes)). Google says the previous destination, no confirmation, no loops, no on-screen Back button ([Navigation on TV](https://developer.android.com/design/ui/tv/guides/foundations/navigation-on-tv)). A deep link into a details page then Back leads to the app's home.
- Press and hold select "can be used to show more options" (Google, same page).
- After playback ends, "display a detail view for the content the viewer was just watching and include an option to resume" (Apple, [Playing video](https://developer.apple.com/design/human-interface-guidelines/playing-video)).

What apps do (where a source exists):

- Episode rows open at the next episode: Emby's row will "move your focus to the next up episode when it first gains focus" ([Emby forum](https://emby.media/community/topic/123745-navigationui-is-weird-on-410), 4.10); Kodi's "Select first unwatched TV show season / episode" setting.
- Emby 4.10: focusing a season tab changes the episode row below at once; OK on the tab opens the full season screen (same post).
- Apple's season selector jumps the row to the chosen season's episode 1.
- Netflix's two-column TV layout puts seasons on the left list and episodes on the right, so Left and Right move between the lists.

Recommended rules for our TV pages:

1. Page opens with focus on the primary button (Play or Resume). Nothing autoplays.
2. Down from the buttons goes to the season names, then to the episode row; entering the episode row lands on the next episode, not episode 1.
3. Focusing a season name switches the row below at once (no select needed), and the row keeps its own position per season while the page is open.
4. Up from the top button row does nothing; Left from the left-most button opens the side menu (owner's side menu rule).
5. The backdrop stays put while focus moves into the lower rows; the text block scrolls up with the page. No zoom or parallax on the backdrop.
6. Back leaves the page and returns focus to the card or episode that opened it. Back never first scrolls to the top: one press, one page.
7. OK on the primary button plays. Play/Pause anywhere on the page plays the focused item, or the page's primary item when focus is on a button.
8. Hold OK on an episode opens the short list (episode details, mark watched, play from start), matching the owner's 31 Oct decision.

Web equivalents:

- Keyboard: Tab moves between groups (buttons, season names, episodes, lower rows); arrow keys move inside a group. This is how Apple's iPadOS focus groups work ([Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)). Enter activates; Space plays or pauses (Apple's "people expect to press Space" rule, [Playing video](https://developer.apple.com/design/human-interface-guidelines/playing-video)).
- Pointer: the still is the Play target (already true); the rest of the row opens the episode page. Season names are tabs, switched on click.
- Hover shows only the Play mark on a still, at the 120 ms speed already approved for Home.

## 4. What looks dated or annoys people

1. Previews that start on their own, sometimes with sound. Netflix added a switch in Feb 2020 after years of complaints ([BGR](https://bgr.com/tech/turn-off-netflix-autoplay/)); in 2025 a reviewer wrote of the TV home that "a full-motion preview clip automatically starts playing, with a loud soundtrack in some cases" ([TechRadar](https://www.techradar.com/streaming/the-new-ui-is-borderline-unusable-netflix-subscribers-are-still-complaining-about-the-app-re-design-and-im-100-percent-with-them)).
2. Focused tiles that balloon. The same article: growing tiles cut each row "from six to four", and readers reported dizziness and nausea.
3. Common actions moved out of reach. Same article: My List "is now hidden... you need to scroll down to access it".
4. Too few episodes on screen. An Emby Roku user, Apr 2021: "Seeing info on only three episodes at a time", down from six ([Emby forum](https://emby.media/community/topic/97241-roku-app-version-40-build-26/page/4)).
5. Play starting the wrong episode. Jellyfin's show Play buttons started the first special instead of the Next Up episode ([Jellyfin forum](https://forum.jellyfin.org/printthread.php?tid=11050)); Emby users report "Play SX Episode X displays wrong episode" ([Emby forum](https://emby.media/community/topic/124054-tv-shows-go-to-show-play-sx-episode-x-displays-wrong-episode-no/)).
6. Spoilers in stills and summaries. Requests for Plex ([forum](https://forums.plex.tv/t/hide-or-blur-thumbnails-for-unwatched-tvshows-episodes/338087)), Emby and Jellyfin (linked above); an Infuse user found a still taken from the episode's last minutes ([Firecore forum](https://community.firecore.com/t/spoilers-in-thumbnails/15053)).
7. Dead ends from Home. Opening an episode from Home in Infuse and pressing Back returns to Home, not the show ([Firecore forum](https://community.firecore.com/t/go-to-show-and-go-to-season-buttons/16192)).
8. No audio or subtitle choice before playing (Infuse requests, linked above).
9. Marking watched only for whole titles, not episodes or "up to here" (Google TV's "Watched it?", above; Infuse request to [improve marking whole series or seasons](https://community.firecore.com/t/improve-marking-entire-series-season-as-watched-unwatched/37958)).
10. A season layer for a one-season show (Kodi flattens it by default; Emby 4.8 added an option to drop the layer).
11. Promotion mixed into what you own. Prime's home puts titles "you must rent or purchase" ahead of Continue Watching ([The Streamable](https://thestreamable.com/prime-video-user-interface-review), 12 Sep 2025). Apple's own Top Shelf guidance says to avoid promoting what people "have already purchased, rented, or watched" ([Top Shelf](https://developer.apple.com/design/human-interface-guidelines/top-shelf)).
12. Our judgement, no source: rows of icon buttons with labels printed under each (Jellyfin Android TV's `TextUnderButton`), boxed panels around every section, and star-rating glyphs read as older TV software next to Apple's and Disney+'s text-on-picture pages.

### Opportunities to do better

1. Name the exact episode and time left on every Play, everywhere: "Resume S2 E5 · 31 min left". This app already does it on web title pages; carry it to Home cards, TV, the season and episode pages.
2. Open every episode row at the next episode, with its season already chosen, and show the row's position ("E5 of 10").
3. Never autoplay. The backdrop is a still picture; a trailer plays only from a Trailer button.
4. Spoiler protection for unwatched episodes after the next one: blur the still and hide the summary until focused or revealed (Infuse does blur; nobody does "after the next one").
5. A technical line taken from the actual file, not a catalogue: "4K · Dolby Vision · Atmos · 2 versions". Streaming apps can only show what the service offers; we know what is on disk.
6. Audio and subtitles shown as one line under Play ("English 5.1 · Subtitles off"), changeable before playing and remembered per show. Only Jellyfin and Plex offer the choice before playing, both as drop-downs.
7. "Ends at 22:41" on films and on Resume, as Jellyfin does; most useful at night.
8. Skip the season names when a show has one season (Kodi's default).
9. Back always lands on the card or episode that opened the page; a Continue Watching card opens the show page with Resume focused, so Back and "Go to show" never strand the viewer.
10. Mark watched "up to here" from the episode's short list, and mark a season watched from its page.
11. Episodes that are not on disk shown honestly in the list (dimmed, with air date or "Not downloaded") rather than missing, matching the owner's rule that partial seasons must say only some episodes exist.
12. Speed: page within 350 ms and backdrop within 500 ms (approved), with the next episode's still and the backdrop cached, so Back and forth between Home and a show is instant.

## 5. Recommended anatomy

The same layout on web and TV; the web version adds hover and keyboard and allows a wider episode list.

### Home card behaviour

- Web: click opens the show or film page; only the Play mark plays (owner rule kept).
- TV: OK opens the page; Play/Pause plays (T33 kept). Hold OK opens the short list.
- A Continue Watching or Up next card opens the show page, not the episode page, with Resume focused and the episode row scrolled to that episode. Reason: the show page answers "what is next" and keeps season context; the episode page is for reading about one episode.
- Back from the page returns focus to the same card.

### Show page

1. Backdrop: 16:9 picture pinned right, fading left and bottom (existing rule). Still, no video.
2. Title logo, plain title when there is none.
3. Facts line: years · season count · age rating · genres. If some episodes are not downloaded: "Some episodes not downloaded" (owner's partial-season rule).
4. Summary, three lines, the rest under More details at the bottom.
5. Primary button: "Resume S2 E5", "Play S2 E6" or "Play S1 E1". Under it: "Woe's Hollow · 31 min left", with a thin progress bar.
6. Up to three icon buttons: Play from start (only when resuming), Trailer (only when one exists), More (mark show watched, shuffle, open the managing page, remove from Continue Watching).
7. Season names as tabs (left out for one season; Specials last).
8. Episode row: 16:9 still, "E5 · Woe's Hollow", runtime or "31 min left", progress bar, tick when watched, two-line summary. Opens at the next episode. Episodes not on disk dimmed with their air date.
9. Below: Extras (if Plex has them), Cast, More details (genres, network, creators, audio and subtitle languages from the files). More like this only if the owner wants discovery on watch pages.

Rationale: a remote reaches Play in zero presses and any episode in two to four; the page holds what the season page would, so most viewers never need the season page.

### Season page

1. Backdrop: the season poster's picture if Plex has one, else the show backdrop; "Season 2" large, with the show logo small above it.
2. Facts line: year · episode count · "3 of 10 not downloaded" when true.
3. Season summary.
4. Primary button: Resume or Play for the next episode in this season; More holds "Mark season watched".
5. Vertical list of every episode: larger still, number and title, runtime or time left, air date, full summary (spoiler rule applies), progress bar, tick.

Reached by OK or click on a season name that is already chosen (Emby 4.10 does this), or "All episodes" at the end of the show page's episode row. It is the reading view; nothing on the show page depends on it.

### Episode page

1. Backdrop: the episode still if it is large enough, else the show backdrop; show logo small.
2. "S2 E5 · Woe's Hollow" large; facts line: air date · runtime · end time · technical line.
3. Full summary.
4. Primary button: Resume or Play, with time left; Play from start when resuming; Mark watched.
5. Audio and subtitle line; Version choice when there is more than one version.
6. Row: the rest of the season, starting at the next episode (Jellyfin's "More from Season 2", Apple's episode row).
7. Guest cast if the data exists.
8. Links back: show name opens the show page; "Season 2" opens the season page.

### Film page

1. Backdrop, title logo, facts line: year · runtime · "Ends at 22:41" · age rating · genres; one rating score if the owner wants one.
2. Summary, three lines.
3. Primary button: "Play" or "Resume · 48 min left"; Play from start when resuming; Trailer; More (mark watched, open the managing page).
4. Audio and subtitle line; Version choice; technical line from the file.
5. Below: Extras, Cast, part of a collection (if any), More details.

## Decisions for the owner

Only choices that change the design:

1. On TV, does OK on an episode tile play it (Netflix, Apple, Disney+), or open the episode page (Jellyfin, Emby, Plex)? Recommended: play, with the episode page in the hold-OK list. On web the still keeps playing and the row opens the page either way.
2. Does the show page carry the episode row with season names (recommended), or only season cards that open season pages (Jellyfin, Plex)?
3. Trailers: never autoplay (recommended), muted autoplay after a pause, or autoplay with a setting?
4. Spoiler protection for unwatched episodes: off, on for episodes after the next one (recommended), or a setting?
5. Episodes not downloaded: dimmed in the list with air date (recommended), or hidden on watch pages?
6. Play from start: a visible icon button when resuming (recommended, Jellyfin's pattern), or kept inside the resume menu as today?
7. Audio and subtitles before Play: show the line on the page (recommended), or leave it to the player?
8. Lower sections: keep Cast, Extras and More details; include More like this or leave discovery to Discover?
9. A Continue Watching card: opens the show page with Resume focused (recommended), or the episode page?

## Could not verify from a primary source

- Netflix's current TV behaviour when selecting a Continue Watching card: the 2015 change made selection play at once; the 2022 removal steps imply a page opens.
- Signed-in layouts of Netflix web, Disney+ (season tabs on TV) and Max (show page structure): Max's help pages are region-locked from here, and its show page needs sign-in.
- Google TV's season and episode layout on its details page.
- Apple TV app's exact Play label on tvOS ("Play S1, E1" or similar); Apple's help pages describe the Play button but not its words.
- The Netflix Tech Blog's artwork post (personalised artwork per viewer, 2017) blocks automated reads; secondary coverage only.
