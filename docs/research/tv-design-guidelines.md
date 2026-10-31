# Google's TV design guidance for the Android TV app

Researched 31 Oct 2026. Research only: no app code, no Figma. Starting point for the design conversation about the native Android TV app (Kotlin with Compose for TV, Google TV Streamer, dark theme only). Builds on [tv-apps-google-tv-and-apple-tv.md](tv-apps-google-tv-and-apple-tv.md) and [ADR 0006](../adr/0006-sign-in-a-tv-with-a-plex-link-code.md).

Words used below:
- **D-pad**: the remote's up, down, left and right buttons plus the centre select button.
- **Focus**: the one item the remote is currently pointing at. On a TV it replaces both the mouse pointer and hover.
- **dp**: density-independent pixel, Android's unit for sizes. Google designs TV screens on a 960 by 540 dp canvas, so on a 1080p picture 1 dp is 2 real pixels. **sp** is the same unit for text, which also grows with the user's text-size setting.
- **Overscan**: some TVs crop the outer edge of the picture. The **safe area** is the inner part that is never cropped.
- **Scrim**: a dark see-through layer over a picture so text on it stays readable.
- **Material**: Google's design system. **tv-material** is its TV version as Compose code (`androidx.tv:tv-material`).
- **Experimental**: a component Google ships but may still change or remove; code must opt in to use it.

## Sources and their dates

Google's TV design guide (developer.android.com/design/ui/tv) has 16 pages. Its component pages show measurements only inside images, so the sizes below come from the tv-material source code where noted.

| Page | Last updated |
|---|---|
| [Design for TV][design-for-tv] | 2023-05-08 |
| [Color on TV][color-on-tv] | 2023-06-04 |
| [Navigation on TV][navigation-on-tv] | 2025-05-09 |
| [Layouts][layouts] | 2025-05-09 |
| [Typography][typography] | 2026-07-06 |
| [Color system][color-system] | 2024-03-21 |
| [Focus system][focus-system] | 2024-03-21 |
| [Buttons][buttons], [Cards][cards], [Navigation drawer][drawer], [Featured carousel][carousel], [Lists][lists], [Tabs][tabs] | 2026-03-30 |
| [Immersive list][immersive] | 2024-08-19 |
| [TV app icon guidelines][icons] | 2024-06-27 |
| [TV app quality][quality] | 2026-06-29 |
| [Build TV layouts][build-layouts] (training) | 2026-09-03 |
| [TV navigation][tv-nav] (training) | 2026-10-23 |
| [Manage TV controllers][controllers] | 2026-10-26 |
| [Playback controls on TV][playback-controls] | 2026-10-23 |
| [On-screen keyboard][keyboard] | 2026-10-23 |
| [Accessibility best practices for Android TV][a11y] | 2026-10-28 |
| [Adopt system caption settings][captions] | 2026-10-23 |
| [Ambient Mode][ambient] | 2026-09-08 |
| [Use Jetpack Compose on Android TV][compose-tv] | 2026-10-28 |
| [Create scrollable layouts for TV][compose-lists] | 2026-10-28 |
| [Compose for TV release notes][releases] | 2026-06-05 |
| [Media3 Compose-based UI][media3-compose] | 2026-10-28 |

Google's TV design guide has no page on dialogs, text fields, motion or the video player. Those topics come from the training pages above.

## Short answer

- **Design at 960 by 540 dp** and keep text and controls 48 dp in from the left and right edges and 27 dp from the top and bottom ([Build TV layouts][build-layouts]). Backgrounds and posters may run to the screen edge ([Layouts][layouts]).
- **Focus replaces hover.** A focused item grows (Google's values: 1.025, 1.05 or 1.1 times) and may add an edge, a glow or a colour change ([Focus system][focus-system]). Every control must be reachable with the D-pad alone ([TV app quality][quality], TV-DP).
- **The remote's Back button is the only back.** No on-screen Back button, no "are you sure you want to leave?", and pressing Back repeatedly must end on the Google TV home screen ([Navigation on TV][navigation-on-tv]; [TV app quality][quality], TV-DB).
- **The player's D-pad map is fixed by Google:** centre plays or pauses, left and right jump back or forward a set number of seconds, holding left or right scrubs, up or down shows the information without pausing ([Playback controls on TV][playback-controls]).
- **tv-material 1.1.0 (6 May 2026) has buttons, cards, lists, tabs, the navigation drawer, switches, checkboxes and radio buttons as finished code.** The featured carousel and chips are still experimental. The immersive list was removed in 1.0.0-beta01. There is no TV dialog, text field, slider or player control set ([Compose for TV release notes][releases]; [tv-material source][tvm-src]).
- **Start from a dark theme with light text** ([Color system][color-system]; [Build TV layouts][build-layouts]). Google also says to avoid white backgrounds unless necessary ([Color on TV][color-on-tv]).
- **The desktop design clashes with TV guidance in seven places:** dense 40 px table rows, controls that only appear on hover, the top app bar with drop-down menus, rows that open inline under other rows, the on-screen Back button in the player, keyboard-key hints, and the condensed data font.

## What Google's guidance says, by topic

### Distance and screen size

- Viewers sit about 3 m (10 ft) away. Make text and elements large, limit how much reading there is, avoid complex layouts and controls ([Design for TV][design-for-tv]).
- TVs are shared in a household; apps showing personal information should offer privacy settings ([Design for TV][design-for-tv]).
- Design at 960 by 540 dp (1 px = 1 dp at that size), with images made for 1080p ([Layouts][layouts]). A 1080p TV runs at Android's xhdpi density and a 4K TV at xxxhdpi ([Build TV layouts][build-layouts]); xhdpi is 2 pixels per dp ([TV app icon guidelines][icons], pixel ratio column).
- Landscape only; keep navigation on the left or right side and the vertical space for content; do not reuse phone or tablet layouts; "Top action bars and pull-down menus are not appropriate"; no swipe-only navigation ([Build TV layouts][build-layouts]).
- Higher quality tier: provide high-resolution images for 4K, including the icon, banner and content cards ([TV app quality][quality], TV-4K).

**For our screens:** everything is drawn at 960 by 540, about two-thirds the width of the desktop's 1440 px design frame. A desktop screen cannot be shrunk to fit; each screen is redrawn.

### Safe area and layout grid

- Safe-area margins: 48 dp left and right, 27 dp top and bottom ([Build TV layouts][build-layouts]; [Layouts][layouts]). The Layouts page also gives "58dp on the sides and 28dp on the top and bottom" and rounds 27 to 24 dp, so Google's own pages disagree. It adds: "Most modern TVs no longer have overscan issues" ([Layouts][layouts]).
- No text or control may be cut off by the screen edge ([TV app quality][quality], TV-OV). The app fills the screen with a non-transparent background (TV-TR).
- Grid: 12 columns of 52 dp with 20 dp gutters and 58 dp side margins, 4 dp between lines ([Layouts][layouts]). 12 × 52 + 11 × 20 = 844 dp of content width, which is where the 58 dp margin comes from.
- Card widths by cards per row: 1 card 844 dp, 2 cards 412 dp, 3 cards 268 dp, 4 cards 196 dp, 5 cards 124 dp, with 20 dp between cards ([Cards][cards]; [Layouts][layouts]). The 1 to 4 values fit the grid; the 5-card value does not ((844 − 4 × 20) / 5 = 152.8 dp).
- Leave room between items for the size increase of a focused item so neighbours do not overlap ([Layouts][layouts]).
- Layout templates Google names: Browse (rows stacked vertically, up and down between rows, left and right within a row), Left overlay, Right overlay, Center overlay ("urgent information or prompt a decision"), Bottom overlay, Actions (title on the left, choices on the right), Content Details, Compilation (item details on the left, its episodes on the right), Grid, and Alert (a full-screen message that needs an action to dismiss) ([Layouts][layouts]).
- Prefer one panel for content-forward screens and two panels for hierarchical, task-focused screens. Few panels; the focus path should follow reading order and never bounce between panels ([Layouts][layouts]).

**For our screens:** at 4 cards per row a poster card is 196 dp wide. The Compilation template matches a show's title page (show on the left, episodes on the right). The Actions and Right overlay templates fit choice screens such as adding a title or picking subtitles.

### Typography

- Prefer larger type. Android TV's default typeface is Roboto. A brand font is fine if it is legible at a distance, with large counters (the open space inside letters) and "a legible font width, as thinner lines are not instantly recognisable". Avoid decorative fonts; use a sans-serif for body text and labels ([Typography][typography]).
- Avoid light-weight fonts and fonts that mix very narrow and very broad strokes; break text into short chunks; use sp for text ([Build TV layouts][build-layouts]).
- The TV type scale has 15 styles in five roles: display, headline, title, body and label. Buttons use label large ([Typography][typography]).
- Sizes in tv-material's source (`TypeScaleTokens.kt`, androidx-main on 31 Oct 2026; the design page shows them only in an image) ([tv-material source][tvm-src]):

| Style | Size / line height (sp) | Weight |
|---|---|---|
| Display large, medium, small | 57/64, 45/52, 36/44 | Regular |
| Headline large, medium, small | 32/40, 28/36, 24/32 | Regular |
| Title large, medium, small | 22/28, 16/24, 14/20 | Regular, Medium, Medium |
| Body large, medium, small | 16/24, 14/20, 12/16 | Regular |
| Label large, medium, small | 14/20, 12/16, 11/16 | Medium |

- Respect the user's text-size setting: components must still fit on screen at larger text sizes ([Accessibility best practices][a11y]).

**For our screens:** these numbers look like desktop sizes but sit on a 960-wide canvas. A 14 sp TV body line is about 1.5 times as large, relative to screen width, as a 14 px line in the desktop's 1440 px frame (14/960 against 14/1440).

### Colour

- Android TV follows Material's colour roles (primary, secondary, tertiary, surfaces, outlines). "Build from dark themes, to create cinematic experiences"; Google points to the Material Theme Builder to make a scheme from key colours ([Color system][color-system]).
- TVs do not support wallpaper colours; Google suggests colours drawn from posters or other hero images instead ([Color system][color-system]).
- Design and test for sRGB colours in the TV's Standard picture mode; use high contrast between text and background; never rely on colour alone; darker colours save power, so "Avoid using white background unless necessary" ([Color on TV][color-on-tv]).
- Gradients band (show visible steps) on many TVs. Use subtle gradients, high colour depth, dithering, or solid colours ([Color on TV][color-on-tv]).
- Surfaces can be tinted by elevation levels +1 to +5 from the primary colour ([Focus system][focus-system]).
- Use light text on a dark background ([Build TV layouts][build-layouts]).

**For our screens:** the player's tall black scrims (160 dp top, 280 dp bottom on desktop) and the title-page backdrop fade are the gradients most at risk of banding.

### Focus and focus states

- Only one item has focus at a time. Focusable items sit in groups, which can nest ([Focus system][focus-system]).
- A focused item shows it through scale (1.025, 1.05 or 1.1 times, depending on size), an outline, a glow under it (2 to 32 dp) and colour changes, mixed as needed ([Focus system][focus-system]).
- States: default, focused, pressed, plus enabled, disabled and selected ([Focus system][focus-system]).
- Something must always have focus when the app starts or sits idle; use one focus style across the app; leave padding so the highlight is visible ([TV navigation][tv-nav]).
- tv-material defaults ([tv-material source][tvm-src]): buttons, icon buttons, wide buttons, cards and chips grow to 1.1 times on focus; list items and drawer items to 1.05. A focused card gets a 3 dp edge in the theme's border colour. Outlined buttons have a 1.5 dp edge.

**For our screens:** the desktop's 2 px ring with a 2 px gap is a keyboard aid; on a TV the focus effect is the main signal and needs room around every card and button.

### Navigation and the D-pad

- Every remote has a D-pad, select, home and back; press-and-hold on select "can be used to show more options" ([Navigation on TV][navigation-on-tv]).
- The D-pad moves focus to the nearest item in that direction. Every focusable item must be reachable; up and down scroll a whole list ([Navigation on TV][navigation-on-tv]).
- Give each direction one job: categories on the vertical axis, items within a category on the horizontal axis; avoid nested layouts ([Navigation on TV][navigation-on-tv]).
- If a control has no straight path to it, move it ([Navigation on TV][navigation-on-tv]).
- Back goes to the previous screen. With top navigation it scrolls to the top and focuses the menu; with left navigation it opens the side menu on the current item. No confirmation to exit, no loops, no on-screen Back button. Show a Cancel button only when every visible action confirms, destroys or buys something ([Navigation on TV][navigation-on-tv]).
- Back "must never act as a toggle", for example opening and closing a menu ([Manage TV controllers][controllers]).
- The first screen at launch is the last one before returning home; a splash screen is not part of the back path ([Navigation on TV][navigation-on-tv]).
- The app must not depend on a Menu button (TV-DM). The Google TV Streamer's remote has none ([TV research note](tv-apps-google-tv-and-apple-tv.md), "The device").
- tv-material's scrolling rows: Compose's standard `LazyRow` and `LazyColumn` (Compose Foundation 1.7.0 and later) keep the focused item in view; a custom `BringIntoViewSpec` can hold the focused item at a fixed point, for example 30% from the left edge ([Create scrollable layouts for TV][compose-lists]).

**For our screens:** every "•••" menu, hover panel and inline-opening row needs a D-pad route. Long-press select is Google's place for "more options", such as watch marks.

### Motion

- Google's TV guide has no motion page. The only motion it describes: focus scaling; the immersive list growing taller when focused ([Immersive list][immersive]); tab content sliding left or right with the tab ([Tabs][tabs]); and the carousel auto-advancing, every 5000 ms by default in code ([tv-material source][tvm-src]).
- The TV UI "must give instant and distinct feedback when a button is pressed" ([Design for TV][design-for-tv]).

### Accessibility

- Support TalkBack (Android's screen reader) with clear labels and navigation guidance ([Accessibility best practices][a11y]).
- Follow the user's text-size setting (Android 12 and later lets users change it) ([Accessibility best practices][a11y]).
- Android 13 and later has a system-wide audio description preference that apps can read ([Accessibility best practices][a11y]).
- Android TV has system caption settings (Settings > Accessibility > Captions): captions on or off, language, text size, colours and background, and "Easy Reader" simplified captions. Apps read them through `CaptioningManager` ([Adopt system caption settings][captions]).
- Higher quality tier: audio descriptions, preferred subtitle styles, high-contrast mode, simpler navigation and adjustable playback speed (TV-AX) ([TV app quality][quality]).

### Components

**Buttons** ([Buttons][buttons]; sizes from [tv-material source][tvm-src])
- Six kinds: filled, outline, icon, outline icon, wide (Google also calls it "long") and image.
- Filled for the final action of a flow; outline for the secondary action beside it. Icon buttons for compact actions and on/off toggles such as favourite or bookmark, and for play and pause.
- One primary action per screen, usually a wide button. "The first button in the group acts as the primary action since focus lands on it first."
- Sentence-case labels on one line; icon on the leading side; never two icons. Text and icon buttons are fully round; wide and image buttons have 12 dp corners. The container scales 1.1 times on focus.
- In code: button minimum 58 by 40 dp, padding 16 dp across and 10 dp down, 20 dp icon. Wide button minimum 240 by 48 dp (64 dp with a subtitle). Icon buttons 28, 40 or 56 dp.

**Cards** ([Cards][cards])
- Variants: standard, classic, compact, wide standard, wide classic. Aspect ratios 16:9 (the most common), 1:1 and 2:3 (taller, "to break up the grid and bring more emphasis").
- The text block is as wide as the image; keep descriptions short; compact cards (text on the image) need a scrim.
- In code: 8 dp corners, 1.1 times on focus, a 3 dp edge on focus ([tv-material source][tvm-src]).

**Featured carousel** ([Featured carousel][carousel])
- Full-width showcase of selected content on the home page: background image, scrim, overline, title, description, button and page dots.
- In code: `Carousel` is experimental; it advances every 5000 ms by default ([tv-material source][tvm-src]).

**Immersive list** ([Immersive list][immersive])
- A row of cards whose focused card fills the large background area with its image, title and description. The focused card scales 1.1 times; background images 16:9 with the subject placed top right.
- In code: removed from tv-material in 1.0.0-beta01, with a sample to build it yourself ([Compose for TV release notes][releases]).

**Navigation drawer** ([Navigation drawer][drawer])
- On TV both the collapsed (icons only) and expanded states are visible. Standard drawer pushes the page aside; modal drawer floats over it with a scrim.
- 3 to 7 destinations in the rail, ideally 5 to 6, each with an icon and label; top section for logo, search or profile; bottom section for 1 to 3 actions such as Settings. Badges sparingly; no wrapping labels.
- In code: `NavigationDrawer` and `ModalNavigationDrawer` are stable; collapsed item 56 dp wide, expanded 256 dp, items 48 dp tall (56 with two lines) ([tv-material source][tvm-src]).

**Tabs** ([Tabs][tabs])
- Peers of equal importance, can scroll sideways. Pill indicator for switching whole pages; bar (underline) indicator for sections inside a content area. Tabs stick to the top.
- In code: `TabRow` and `Tab` are stable.

**Lists** ([Lists][lists])
- One-, two- or three-line items with optional icon, overline, title, subtitle and a checkbox, radio button or switch.
- "Avoid placing buttons inside a list item"; show the selected item with an icon, not only a background colour.
- In code: `ListItem` minimum height 48 dp (64 two-line, 80 three-line), `DenseListItem` 40 dp (56, 72), 8 dp corners, 1.05 times on focus ([tv-material source][tvm-src]).

**Chips**
- The design guide has no chip page; the Focus system page shows chip states, including selected ([Focus system][focus-system]). In code: `FilterChip`, `InputChip`, `AssistChip` and `SuggestionChip` are experimental, 36 dp tall with 8 dp corners ([tv-material source][tvm-src]).

**Dialogs and prompts**
- No TV dialog component in tv-material ([tv-material source][tvm-src]). Google's templates are the Center overlay for urgent information or a decision and the Alert template for a full-screen message ([Layouts][layouts]). A Cancel button belongs on a screen whose only other actions confirm, destroy or buy ([Navigation on TV][navigation-on-tv]).

**Text input and the on-screen keyboard** ([On-screen keyboard][keyboard])
- Android TV's keyboard is Gboard, with voice typing built in.
- Gboard on TV supports four input types: email, password, text and numeric. A web address has no type of its own on that list.
- The keyboard floats at the bottom, centred by default, or left or right via `privateImeOptions` (`horizontalAlignment=right`). tv-foundation 1.0.0 wraps this as `TvKeyboardAlignment` (Left, Right, Center, Fullscreen), marked experimental ([tv-foundation source][tvf-src]).
- tv-material has no text field; tv-foundation 1.0.0 holds only that keyboard option after its scrolling lists were removed ([Compose for TV release notes][releases]).
- Higher quality tier: voice search, for example a microphone button beside the search field (TV-VS) ([TV app quality][quality]).

### Video player

- D-pad during playback ([Playback controls on TV][playback-controls]):

| Button | Action |
|---|---|
| Centre | Play or pause; pausing shows the controls |
| Left or right, single press | Back or forward N seconds; play or pause state is kept |
| Left or right, held | Scrub back or forward |
| Up or down | Show information (progress, title) without pausing |

- Quality rules: centre pauses and resumes, left and right rewind and fast-forward (TV-PC); the remote's play/pause key toggles (TV-PP); video pauses when the user leaves the app (TV-NP) ([TV app quality][quality]).
- Keep the screen on only during playback the user started; release it when paused or stopped. Never for video or animation the app started on its own. Ambient Mode (Google TV's screensaver) starts after 10 minutes without input ([Ambient Mode][ambient]; TV-BU, TV-BY).
- Picture-in-picture only on an explicit user action, with no controls in the small window (TV-IE, TV-IH) ([TV app quality][quality]).
- Media3's Compose UI 1.11.1 comes in two parts: `media3-ui-compose` gives the video surface and state holders (play/pause, current item, errors) with no styled controls; `media3-ui-compose-material3` adds ready-made controls styled with phone Material 3 ([Media3 Compose-based UI][media3-compose]). Google warns that mixing phone Material with tv-material can give inconsistent colours, type and shapes ([Use Jetpack Compose on Android TV][compose-tv]).
- Higher quality tier: report Continue Watching and next episodes to the Google TV home screen through the Engage SDK (TV-EC); request the content's frame rate (TV-FR) ([TV app quality][quality]).

### Launcher, sign-in and other rules that touch design

- Launcher banner 320 by 180 px at xhdpi (160 by 90 at mdpi up to 640 by 360 at xxxhdpi) with the app name in it, plus a launcher icon of at least 160 by 160 px at xhdpi ([TV app quality][quality], TV-LB, TV-BN; [TV app icon guidelines][icons]).
- Higher quality tier: sign in "using mobile or Google Account" (TV-LI) and keep returning users signed in with tokens (TV-LC) ([TV app quality][quality]). The plex.tv/link code in ADR 0006 is sign-in on a phone.

## Our screens against Google's patterns

"Stable" and "experimental" refer to tv-material 1.1.0 and tv-foundation 1.0.0 ([Compose for TV release notes][releases]; [tv-material source][tvm-src]).

| Our screen | Google pattern | Compose for TV piece | Notes |
|---|---|---|---|
| First launch: server address | Single pane; text field with Gboard | No TV text field; Compose's own text field with Gboard's text type | Gboard has no web-address type ([On-screen keyboard][keyboard]). Typing an address on a D-pad is slow; voice typing is built in. |
| First launch: Plex link code | Single pane, large code, no input | `Text`, display or headline style | Fits TV-LI "login using mobile" ([TV app quality][quality]). |
| App-wide navigation | Navigation drawer (5 to 6 destinations) or pill tabs at the top | `NavigationDrawer` / `ModalNavigationDrawer`, or `TabRow` (stable) | Training page says keep navigation on the left or right ([Build TV layouts][build-layouts]); the tabs page allows top tabs. |
| Discover | Browse template; featured carousel or immersive list at the top | `Carousel` (experimental); immersive list built by hand; rows with `LazyRow` in `LazyColumn` | |
| Search | Text field plus voice; results as a grid | `LazyVerticalGrid` of `Card`s | In-app search is no longer required for the store; voice search is tier 2 ([TV app quality][quality]). |
| Title page (movie) | Content Details template | `Button` group (stable), primary first | Focus lands on the first button, so Play or Resume goes first ([Buttons][buttons]). |
| Title page (show: seasons, episodes) | Compilation template (details left, episodes right) or Content Details with rows | `ListItem` or `Card` rows; `TabRow` with bar indicator for seasons | |
| Add to Sonarr or Radarr | Actions template (title left, choices right) or Right overlay | `ListItem` with `RadioButton` (stable); `Button` to confirm | The desktop's sentence form with inline selects has no TV equivalent. |
| Monitoring on or off | Icon button as an on/off toggle (bookmark) or list item with a switch | `IconButton`, or `ListItem` + `Switch` (stable) | Buttons page names bookmark as an icon-button toggle ([Buttons][buttons]). |
| Automatic search | Button with a loading state, then a status line | `Button`, `Text` | |
| Interactive search: release list | List, two- or three-line items; quality filter as tabs or chips | `ListItem` / `DenseListItem` (stable); `FilterChip` (experimental) or `TabRow` | No buttons inside a list item ([Lists][lists]), so Grab is the item's select action or a step after it. |
| Library with filters (All, Continue Watching, Unwatched, Missing, Downloading) | Grid template with bar tabs or chips above it | `TabRow` (stable) or `FilterChip` (experimental); grid of `Card`s | Five filters fit one tab row. |
| Play or Resume | Filled or wide button, first in the group | `Button` / `WideButton` (stable) | Wide button can carry a subtitle line ("31 min left"). |
| Watch status marks | Long-press select for more options, or a button on the title page | `Card` overlay; a list in a Right overlay | Long-press: [Navigation on TV][navigation-on-tv]. |
| Player controls | Google's D-pad map; controls appear on pause or on up/down | `media3-ui-compose` state holders; tv-material `IconButton`s | Media3's ready-made controls use phone Material 3. |
| Subtitle and audio choice | Right overlay with a radio list | `ListItem` + `RadioButton` | Selected item shown with an icon ([Lists][lists]). |
| Subtitle size | Right overlay list, or system caption settings | `ListItem` + `RadioButton`; `CaptioningManager` | See question 9. |
| Quality menu | Right overlay with a radio list | `ListItem` + `RadioButton` | |
| Skip intro, Skip credits | Button over the video that takes focus | `Button` | Desktop shows the S key; no keyboard on TV. |
| Up Next countdown | Bottom or Center overlay with two buttons | `Button` group, `Card` for the next episode | |
| "Update now / Later" prompt | Center overlay; Alert template if it must block | `Button` group in a Compose dialog (no TV dialog) | Back must close it, so Back means Later. |

## Where the desktop design clashes with TV guidance

DESIGN.md in this worktree says "Light mode only"; `main` has since added a dark theme ("Cool night", approved 31 Oct 2026, `origin/main:DESIGN.md`, section Dark mode). The comparison below uses both.

1. **Density.** Desktop tables use 40 px rows, 32 px headers in 11 px capitals, 20 px badges and 28 px row buttons inside a 1360 px table (DESIGN.md, Tables and rows). TV lists start at 48 dp (dense 40 dp) on a 960 dp screen ([tv-material source][tvm-src]), and Google asks for little text and simple layouts ([Design for TV][design-for-tv]).
2. **Controls that only appear on hover.** The poster card's Play or Resume button, its 130 px overview panel, tooltips after 400 ms and the "•••" row menus all wait for a pointer (DESIGN.md, Library and Chrome). A remote has no hover; only the higher-tier pointer-remote support adds it (TV-TO, [TV app quality][quality]).
3. **Tables with shared column edges and buttons in rows.** The release table, episode rows and downloads all put several columns and buttons in one row. Google: "Avoid placing buttons inside a list item" ([Lists][lists]); each D-pad direction should have one job ([Navigation on TV][navigation-on-tv]).
4. **Top app bar with a centred search field and drop-down menus.** Google: navigation on the left or right, "Top action bars and pull-down menus are not appropriate" ([Build TV layouts][build-layouts]).
5. **Rows that open under other rows.** The releases inset and the episode details band open inline (DESIGN.md, Releases and Tables). Google warns against nested layouts and bouncing focus between panels ([Navigation on TV][navigation-on-tv]; [Layouts][layouts]); overlays and two-pane templates are its alternatives.
6. **On-screen Back in the player.** The player's top bar has an on-dark Back button (DESIGN.md, Player and playing). Google: don't show a back button on screen ([Navigation on TV][navigation-on-tv]).
7. **Keyboard hints.** Skip intro shows the S key; toasts offer Undo with Z (DESIGN.md). The Streamer's remote has no keyboard.
8. **Focus style.** Desktop focus is a 2 px ring with a 2 px gap and no size change (DESIGN.md, Focus). TV focus grows 1.05 to 1.1 times with a 3 dp edge on cards ([Focus system][focus-system]; [tv-material source][tvm-src]), so gaps between posters must absorb a 10% growth.
9. **Condensed data font.** Barlow Semi Condensed carries release names, sizes and numbers. Google asks for "a legible font width" and avoids thin strokes at a distance ([Typography][typography]; [Build TV layouts][build-layouts]).
10. **Gradients.** The player scrims and the title backdrop fade are long dark gradients; Google warns that these band on TVs ([Color on TV][color-on-tv]).
11. **Corners.** Desktop buttons have 12 px corners. tv-material buttons are fully round, cards and list items 8 dp, wide buttons 12 dp ([tv-material source][tvm-src]). This is a default, not a rule; tv-material lets each shape be changed.

The light theme itself is not a clash once the TV is dark only. Main's dark palette (page #0C0F14, card #12161C, off-white text) already follows Google's advice of light text on a dark ground.

## Questions for the design conversation

1. **How does the owner move between Discover, Search and Library?**
   - A navigation drawer on the left, collapsed to icons until focused, 5 to 6 destinations, Settings at the bottom ([Navigation drawer][drawer]).
   - Pill tabs at the top of each page ([Tabs][tabs]); Back then scrolls to the top and focuses the tabs ([Navigation on TV][navigation-on-tv]).
   - A modal drawer that floats over the page with a scrim, keeping the full width for posters ([Navigation drawer][drawer]).

2. **What does the top of Discover look like?**
   - A featured carousel that advances every 5 seconds (experimental in code) ([Featured carousel][carousel]).
   - An immersive list: the focused card fills the background with its backdrop and summary (built by hand; removed from tv-material) ([Immersive list][immersive]; [releases][releases]).
   - Plain rows only, Browse template ([Layouts][layouts]).

3. **Posters or wide images, and how many per row?**
   - 2:3 posters, as on desktop; Google calls this ratio a way to "break up the grid" ([Cards][cards]).
   - 16:9 backdrops, the most common TV card ([Cards][cards]).
   - Cards per row: 4 (196 dp each) or 5; title under the card (standard or classic card) or on the image with a scrim (compact card) ([Cards][cards]).

4. **How do the five Library filters appear?**
   - A tab row with the bar indicator above the grid ([Tabs][tabs]).
   - Filter chips (experimental in code) ([tv-material source][tvm-src]).
   - One Browse screen with a row per filter, so Continue Watching and Downloading sit in view at once ([Layouts][layouts]).

5. **How much of the desktop release table belongs on the TV?**
   - Two- or three-line list items: release name, then quality, size, seeders and tracker as a second line ([Lists][lists]).
   - Select grabs at once, or select opens a confirm step (Right or Center overlay), since buttons cannot sit inside list items ([Lists][lists]; [Layouts][layouts]).
   - Quality filter as tabs or chips above the list.

6. **How does adding a title to Sonarr or Radarr work on a remote?**
   - Actions template: the sentence's facts on the left, the choices (monitor, profile) as radio lists on the right ([Layouts][layouts]).
   - One-press add with the remembered profile and folder, choices hidden behind a secondary button.
   - Right overlay over the title page ([Layouts][layouts]).

7. **Where do per-title actions live (mark watched, monitor, remove from Continue Watching)?**
   - Long-press select on a card opens a short list ([Navigation on TV][navigation-on-tv]).
   - Only on the title page, as buttons after Play ([Buttons][buttons]).
   - Both.

8. **Which player controls show, and how far do left and right jump?**
   - Google fixes the D-pad map but not N ([Playback controls on TV][playback-controls]). Desktop uses back 10 s and forward 30 s; one value for both, or keep the pair?
   - Subtitle, audio and quality menus as a Right overlay list, or a row of buttons under the timeline that opens one.
   - Up and down show information without pausing; what that view holds (title, time left, chapter) is open.

9. **Who owns subtitle size and style?**
   - Plex's five sizes in the app, as on desktop.
   - Android TV's system caption settings (size, colours, background) ([Adopt system caption settings][captions]).
   - Both: the app's choice starts from the system setting.

10. **Which typefaces?**
    - Keep Schibsted Grotesk for interface text and test Barlow Semi Condensed for numbers at 3 m ([Typography][typography]).
    - Roboto, Android TV's default ([Typography][typography]).
    - Schibsted Grotesk for everything, dropping the condensed face.

11. **Where do the TV's colours come from?**
    - Main's "Cool night" dark palette as is (DESIGN.md on `main`).
    - A Material dark scheme generated from glow-blue in the Material Theme Builder ([Color system][color-system]).
    - Either, plus backdrop colours taken from each poster on the title page ([Color system][color-system]).

12. **How loud is the "Update now / Later" prompt?**
    - Center overlay with Update now first and focused, Later second; Back means Later ([Layouts][layouts]; [Buttons][buttons]; [Manage TV controllers][controllers]).
    - Full-screen Alert template that must be answered ([Layouts][layouts]).
    - A quiet line on the home screen, opened on select.

## Owner's answers, 31 Oct 2026

- **Per-title actions** (question 7): both. Holding OK on a card opens a short list, and the title page carries the same actions as buttons after Play. Whether the Streamer's remote sends a usable long press is still to test on the box.
- **Player jumps** (question 8): back 10 s, forward 30 s, as on desktop.
- **Subtitles** (question 9): the app's five sizes, Tiny to Huge, starting from the TV's own caption setting.
- **Update prompt** (question 12): a centred pop-up at launch, Update now focused, Later second, Back means Later.
- **Colours** (question 11): the app's own Cool night palette (Figma Q11A). Material's generated scheme and the poster-tinted wash are out.
- **Adding a title**: the button reads "Add to library" (as `src/client/title/AddControls.tsx`), never "Add to Sonarr/Radarr". The add screen keeps desktop's sentence, which names the service with its logo ("Radarr will add <title> to your library.", DESIGN.md "Sentence form"); the owner kept that wording on 31 Oct, adapted to the TV: same words and service mark, laid out for a remote (choices as focusable lists rather than inline drop-downs).
- **Navigation** (question 1): side menu on the left, collapsed to icons, opening on focus (Figma Q1A). Library is a menu item that can be selected and has Films and TV as selectable items under it.
- **Top of Discover** (question 2): the focused card's backdrop and summary fill the top (Figma Q2B).
- **Cards** (question 3): 2:3 posters with the title under the card (Figma Q3A). Growing on focus must not move anything else on the screen.
- **Library filters** (question 4): a tab row (Figma Q4A) for All / Continue Watching / Unwatched / Missing / Downloading. Films and TV move out of the page into the side menu under Library.
- **Release list** (question 5): three-line rows (Figma Q5B) with the "Grab this release?" panel from Q5A.
- **Adding a title** (question 6): the first three options were rejected. The redesign keeps the desktop sentence with each choice as a focusable chip inside it (Figma "Q6 v2 · A"). As on desktop, "Add to library" on the title page opens a dialog holding the sentence, and the dialog ends with a confirm button; when it opens, focus starts on confirm with the remembered choices filled in. More options stays, collapsed.
- **Typefaces** (question 10): Schibsted Grotesk throughout (Figma Q10C).

## Could not verify from a primary source

- The type scale, button, card, chip, list and drawer sizes come from tv-material's source on androidx-main read on 31 Oct 2026, not from the 1.1.0 release tag; Google's design pages show these specs only as images.
- Google's safe-area figures conflict: 48/27 dp ([Build TV layouts][build-layouts]) against "58dp on the sides and 28dp on the top and bottom" and 24 dp ([Layouts][layouts]). The 5-card width of 124 dp does not fit the grid's arithmetic.
- The quality page's "Overscan" link (`/training/tv/start/layouts#overscan`) redirects to the Compose for TV overview; the overscan text now lives on [Build TV layouts][build-layouts].
- Whether Up Next starting the next episode on its own counts as "user-initiated" playback for keeping the screen on ([Ambient Mode][ambient] does not say).
- Whether Gboard on TV accepts a web-address (URI) input type; the page lists only email, password, text and numeric.
- Whether the Streamer's remote sends a long-press on select that apps can use; Google's page describes remotes in general.
- That Media3's ready-made Material 3 controls clash with tv-material is an inference from two pages ([Media3 Compose-based UI][media3-compose]; [Use Jetpack Compose on Android TV][compose-tv]), not a Google statement about Media3.
- The Compose for TV setup page's sample still pins `tv-material:1.0.0`; the release notes list 1.1.0 as current.

[design-for-tv]: https://developer.android.com/design/ui/tv/guides/foundations/design-for-tv
[color-on-tv]: https://developer.android.com/design/ui/tv/guides/foundations/color-on-tv
[navigation-on-tv]: https://developer.android.com/design/ui/tv/guides/foundations/navigation-on-tv
[icons]: https://developer.android.com/design/ui/tv/guides/system/tv-app-icon-guidelines
[color-system]: https://developer.android.com/design/ui/tv/guides/styles/color-system
[typography]: https://developer.android.com/design/ui/tv/guides/styles/typography
[focus-system]: https://developer.android.com/design/ui/tv/guides/styles/focus-system
[layouts]: https://developer.android.com/design/ui/tv/guides/styles/layouts
[buttons]: https://developer.android.com/design/ui/tv/guides/components/buttons
[cards]: https://developer.android.com/design/ui/tv/guides/components/cards
[immersive]: https://developer.android.com/design/ui/tv/guides/components/immersive-list
[drawer]: https://developer.android.com/design/ui/tv/guides/components/navigation-drawer
[carousel]: https://developer.android.com/design/ui/tv/guides/components/featured-carousel
[lists]: https://developer.android.com/design/ui/tv/guides/components/lists
[tabs]: https://developer.android.com/design/ui/tv/guides/components/tabs
[quality]: https://developer.android.com/docs/quality-guidelines/tv-app-quality
[build-layouts]: https://developer.android.com/training/tv/playback/compose/layouts
[tv-nav]: https://developer.android.com/training/tv/get-started/navigation
[controllers]: https://developer.android.com/training/tv/get-started/controllers
[playback-controls]: https://developer.android.com/training/tv/playback/controls
[keyboard]: https://developer.android.com/training/tv/get-started/onscreen-keyboard
[a11y]: https://developer.android.com/training/tv/accessibility
[captions]: https://developer.android.com/training/tv/accessibility/system-caption-settings
[ambient]: https://developer.android.com/training/tv/playback/ambient-mode
[compose-tv]: https://developer.android.com/training/tv/playback/compose
[compose-lists]: https://developer.android.com/training/tv/playback/compose/lists
[releases]: https://developer.android.com/jetpack/androidx/releases/tv
[media3-compose]: https://developer.android.com/media/media3/ui/compose
[tvm-src]: https://github.com/androidx/androidx/tree/androidx-main/tv/tv-material/src/main/java/androidx/tv/material3
[tvf-src]: https://github.com/androidx/androidx/blob/androidx-main/tv/tv-foundation/src/main/java/androidx/tv/foundation/text/TvImeOptions.kt
