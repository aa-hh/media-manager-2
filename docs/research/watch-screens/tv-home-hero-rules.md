# TV Home hero and rows: rules from the hero picture session

Relayed on 17 Nov 2026 by the session "Context posters hero image coverage". Design only: no code, no server work, awaiting the owner's approval. The watch pages take these as fixed inputs and do not redraw the TV Home hero or rows.

Written down in: the note of Figma frame 137:14098 in the TV screens file `LOntH5HQXfvTnfapJoyoqZ`, and the animated mockup https://claude.ai/artifact/AviYcYL3T15E3UTH57kvpU (first tab, "your library", 28 real titles). Plex's own method: the owner's notes at `/Users/alechenderson/Downloads/PLEX-HERO-IMAGE-RENDERING.md` and `/Volumes/Space/plex-re/`.

## Picture

- 16:9, pinned right: x 288 to 960, y 0 to 378 on a 960 × 540 screen. Cover fit, centred.
- No crop or subject-position data. Tested on 41 real TMDB 16:9 backdrops with a plain centred crop: 33 clean; the failures were wide group shots a moved crop wouldn't fix. The owner agreed: no face-finding.
- Fade: two straight gradients to the page colour `#0C0F14`.
  - Left: solid at 0%, 97% at 18%, 80% at 34%, 32% at 54%, clear at 70% of the width.
  - Bottom: clear to 42% of the height, 55% at 70%, 92% at 90%, solid at 100%.
  - Where they overlap, the bottom-left corner rounds off.
- A round fade was rejected: it lights bright pictures up as an oval. Plex's colour wash (`/services/ultrablur/colors`) is not wanted either.

## Title and words

- Title: the Plex clear logo, fitted whole (never cropped), bottom-left in a 300 × 64 box. No logo: plain title, Roboto Bold 36. Keep the plain title for screen readers.
- Words at x 120, 340 wide, y 40 to 188: logo, 12 gap, facts 15/20 (year · length or seasons · genre), 8 gap, summary 15/22, two lines at most.

## Timing

- Logo and words change the moment focus moves (50 ms out, 120 ms in).
- The picture waits until focus rests 300 ms plus loading; meanwhile the old picture dims to 55%. The new one fades in over 600 ms, settling from 1.03 scale.

## Rows

- The row with focus is open: cards 112 × 168, focused card 1.1× from its centre. Other rows are closed: 90 × 135 at 55% opacity.
- Every row drives the hero.
- Fixed heights, 242 open and 195 closed. The list scrolls so the open row's title always sits at y 218; the next row's title is at y 460 with the top 44 of its cards showing.
- No text under cards: posters carry their own titles. This contradicts DESIGN.md:441, which the owner knows.
- Row end: the slide is clamped, so once the last card is on screen the row stops and the focus ring moves right. Each row remembers its own focus.
- Section titles 20/600.

## Server findings to reuse (nothing built yet)

- `src/server/backdrops.ts:47` asks TMDB for `w1920_and_h800_multi_faces`, a 2.4:1 crop centred on faces. The design needs TMDB's plain 16:9 backdrop.
- Plex title logos: `GET /library/metadata/{ratingKey}` returns an `Image` array; the entry with type `clearLogo` gives a path. Fetch through `/photo/:/transcode?width=&height=&minSize=1&upscale=1&format=png&url=<path>` with the `X-Plex-Token` header. 27 of 28 sampled titles had one.
- Backdrop is `item.art`, poster is `item.thumb`, same transcode address.

## Figma frames owned by that session (do not edit)

- TV file `LOntH5HQXfvTnfapJoyoqZ`, DISCOVERY: 118:11088, 119:11292 to 119:11295, 122:12845, 137:14098 (with its local components in 137:14606).
- Web file `dFQMjELOx6ObLS0qOG3NCF`: 63:4498 and 63:4569 to 63:4572.

## Left to this session

- Show, season, episode, film and person pages, on TV and web.
- Web Home hero placement is still open on that session's side (frames 63:4569 to 63:4572, nothing chosen). If web Home needs a hero, ask the owner rather than inventing a different one.
- Their question for our research: do Plex's detail pages (show, film) use the same clear logo and fade, so the hero can match across Home and the detail pages?
