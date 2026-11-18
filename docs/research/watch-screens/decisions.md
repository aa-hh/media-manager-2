# Watch pages: owner decisions

Decisions from the owner for the playback-first pages (Home, show, season, episode, film). Research beside this file: `plex.md`, `app-patterns.md`, `open-source-clients.md`, `what-we-have.md`, `tv-home-hero-rules.md`.

## 17 Nov 2026

- **Direction.** The watching side gets its own pages built for playback, not the management title page bent to fit. Selecting something opens its own page with a hero and fade; the same design on web and TV, only navigation differs. Room for cast and scores; existing pieces are reused.
- **Theme.** Watch pages are always dark, on web as on TV. Management pages keep following the light/dark setting.
- **Episodes not aired yet.** Shown dimmed and not selectable, with a banner giving the air date.
- **Episodes aired but not on disk.** Shown dimmed. On hover (focus on TV) a "Manage" button appears; it opens the management page for that title, where the viewer decides whether to download it.
- **Spoilers.** For an unwatched episode, show a random piece of the show's fan art instead of the episode's own still, so there is still a picture. A "Show description" button reveals the summary. (The owner was unsure about the button; draw it and let him judge.)
- **First version includes:** version choice, quality choice, audio and subtitle choice, cast, scores.
- **Not in the first version:** a row of similar titles, trailers and extras, person pages.
- **Hero.** Reuses the TV Home hero rules in `tv-home-hero-rules.md` unchanged (title lettering with plain-title fallback, picture pinned right, straight fades, no colour wash).

## Still open (being drawn as three directions)

- How many pages: one show screen holding seasons and episodes, separate show / season / episode pages, or a mix.
- What select does on an episode, and where a Continue watching card lands.
- Whether an episode page shows the show's backdrop or the episode's still.

## 17 Nov 2026, after the walkthrough page

- **Settings on a watch page (version, quality, audio, subtitles).** The four-columns-at-once layout that replaced the episode row (direction 1, Figma 82:4108) is rejected: too hectic, and the episodes disappear. Instead a "···" button opens a short list of the settings; choosing one opens a side panel for that setting alone, gone through one at a time. The episodes stay on screen.
- The owner found the Figma frames hard to follow and the walkthrough page clear. Show short walkthroughs first; Figma frames are backing detail.
- **Season names always show.** A show with one season still shows "Season 1". The layout does not change with the number of seasons; things should not disappear. (Direction 1's drawing hid the season names for a one-season show, Figma 81:3707 and 81:3830; that is rejected.)
- **Ratings in the hero, with each site's logo.** Every watch page hero shows the scores, each with the real logo of its rating site (IMDb, Rotten Tomatoes, Metacritic and so on) next to the number, not the site's name in words: people know which sites they trust, and a logo is less reading. On a page showing one episode, the ratings take the line under the title that held length, air date, quality and "Ends at"; that line goes, since the episode's title and length already show on the episode below.

## 17 Nov 2026: direction chosen

- **Direction 1, "One show screen", is chosen** and approved for building (Figma web screens file `dFQMjELOx6ObLS0qOG3NCF`, page "Watch pages", frame 76:10949). One page per title; seasons and episodes live on it; the words at the top follow the focused or hovered episode and the buttons act on it. A Continue watching card opens the show screen with that episode at the top and Resume selected; the Play/Pause key on the card plays at once. The film screen is the same screen without the episode area.
- Three changes to direction 1's drawings, decided in comments on the walkthrough page and not redrawn: settings behind a "···" button with one side panel per setting (episodes stay visible); the season name always shows, even for one season; ratings with each site's logo take the line under the title in place of length, date, quality and "Ends at".
- Directions 2 and 3 are not chosen.

## 17 Nov 2026: build decisions

- **Built in four parts, in order:** the server data; the web watch screens; the TV watch screens; then the Continue watching card and Back on both.
- **The management side does not change at all.** Library, Search, Calendar, Discover and Flagged keep opening today's pages. The watch screens are a separate branch added beside them.
- **Web addresses.** `/watch/show/:id` and `/watch/movie/:id`, beside today's `/series/:id` and `/movie/:id`.
- **Way in on the web.** An item in the header. Where it sits is still being drawn; the web watch screens wait for that drawing.
- **Hero picture per season.** On a show, the hero picture belongs to the season: it stays the same while the viewer moves between episodes and changes when the season changes. A season with no picture of its own uses the show's plain 16:9 picture. A film has one plain 16:9 picture. Existing screens keep the picture they have today.
- **Where season pictures come from.** fanart.tv backgrounds that fans tagged with a season. TMDB has season posters only. Many seasons will have none and will show the show's picture; the owner chose this over substituting other show pictures. Episode stills are never used for the hero, because they spoil.
- **TV.** Every card opens the new watch screen. Today's show and film screens stay as the pages "Manage" opens. The TV screens are built only after direction 1 is redrawn with all the changes in this file.
- **Mark watched.** Marks the one episode shown in the hero.
- **Season summaries.** Left out.
- **Plain browser.** The same watch screen; Play opens Plex Web; the settings list (Version, Quality, Audio, Subtitles) is hidden there.
- **PRODUCT.md and DESIGN.md.** Updated in the same pull request that builds each screen.
