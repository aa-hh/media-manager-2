⚠️ DEGRADED: single-context (one of five parallel reviewers; the target is a pen.dev canvas, so the impeccable detector, which scans markup files, and browser overlay injection cannot run. Evidence comes from pen.dev exports at 1x and node reads with resolved variables.)

# Settings, sign-in and status screens: light-mode critique

Source file: `codex-design-finish/design/mediaManager2.pen`, read only. Exports used for this review: `scratchpad/review/png/<nodeId>.png`.

Contrast ratios below are computed from the resolved hex values (WCAG formula).

---

## 1. Settings (gwuMS first run, P8KN4f all connected, yqQwT problems and unsaved edits)

### What the frames are

- 1440x900, page fill `#F5F5F5`, body padding 20, column gap 20 (node gQzQk, IwHpe).
- Two 690px columns: Services (Sonarr, Radarr, rTorrent, Plex) and Tracker accounts (Blutopia, PrivateHD, Beyond-HD).
- Each service is a stack of full-width table rows: a 32px heading row `#FAFAFA` plus 36px white rows, every row with its own 1px `#D1D5DB` stroke (Radarr: Q5Hbt, bBWf2, zHzZp, ZVTzH).
- Corner radius is 0 on cards, fields and buttons. The only rounded thing on the page is the 2px keyboard key.
- Type: Barlow 31/700 page title, Barlow 14/600 service names, Barlow 13/500 field labels, Barlow Semi Condensed 13 for values and status, 11/600 uppercase column titles.
- Primary colour: `#215D47` dark green (Save, Connected dot). Error text `#B42318`.

### Heuristic scores

| # | Heuristic | First run | All connected | Problems | Key issue |
|---|---|---|---|---|---|
| 1 | Visibility of system status | 2 | 3 | 2 | Status is an 8px dot plus 13px grey text in the far right of each heading; "Testing…" and a disabled Test show at the same time as an enabled Save (yqQwT Radarr) |
| 2 | Match with the real world | 3 | 3 | 3 | Real service names, real logos and real version numbers; "PID" for PrivateHD is unexplained |
| 3 | User control and freedom | 2 | 2 | 2 | No way to discard unsaved edits; no Disconnect or Remove for a service |
| 4 | Consistency and standards | 2 | 2 | 2 | Fields are instances of the search box (Input/Search with its search icon and "/" key hidden); "Unsaved edits" in the heading and "Unsaved changes" in the action row name the same state twice |
| 5 | Error prevention | 2 | 2 | 2 | Saved secrets show as an empty field, so the owner cannot tell "set" from "blank" without reading a 13px note 12px away |
| 6 | Recognition over recall | 3 | 3 | 3 | Placeholders show the expected address format |
| 7 | Flexibility and efficiency | 2 | 2 | 2 | Test then Save is two clicks per service, seven times on first run |
| 8 | Aesthetic and minimalist design | 1 | 1 | 1 | Every row is a bordered box; the page reads as a spreadsheet |
| 9 | Error recovery | n/a | n/a | 3 | Errors are specific ("rTorrent didn't answer within 10 seconds", "Plex refused the token") but give no next step |
| 10 | Help and documentation | 1 | 1 | 1 | No link to where each key lives in Sonarr, Radarr, Plex or the tracker |
| | **Total** | **18/36** | **19/36** | **21/40** | Poor to acceptable |

### Design specificity verdict

The content is specific: real logos (Logo/Sonarr u3D0O5, Logo/Radarr T1cDmD, Logo/rTorrent YJlCi, Logo/Plex hNlc0, the three tracker logos), real ports (8989, 7878, 32400), the Whatbox XML-RPC address, real version strings. The form is generic: a bordered key/value table that any admin panel could use. Swap the logos and it is a WordPress plugin settings page. This is the "back office" look the owner wants gone.

### Priority issues

**[P1] The page is a grid of 1px boxes.**
- Evidence: in a 140px Radarr card there are four stacked strokes (heading, Address, API key, Action rows), each `#D1D5DB`. Cards are white on `#F5F5F5`, a 1.09:1 difference, so the borders do all the separating. Border `#D1D5DB` on white is 1.47:1.
- Fix: one card per service with a 12px radius, white fill on a slightly darker cool ground (for example `#EEF1F0`), a soft shadow (0 1px 2px at 6% plus 0 0 0 1px at 6%) instead of row strokes. No lines between fields; 16px vertical rhythm does it. Card padding 20.
- Commands: /impeccable layout, /impeccable distill.

**[P1] Connection status is the weakest element on a page whose whole job is connection status.**
- Evidence: status sits at x=612 to 678 of the heading (lgvqY), 8px dot, Barlow Semi Condensed 13 in `#58616C`. "Connected", "Not set up" and "Unsaved edits" share that grey text; only the dot changes (filled `#215D47`, hollow `#9AA1AB`, hollow `#215D47`). The column title "SERVICES · 1 OF 4 CONNECTED" is 11px.
- Fix: put status beside the logo, under the service name, as a tinted pill: Connected (green tint `#E7F3EE`, text `#1B5E44`, with the version: "Connected · 4.0.10.2544"), Not set up (neutral `#EEF0F2`), Failed (red tint `#FDECEA`, text `#B42318`), Testing (a small spinner in the pill). Failed cards also get a 3px left edge in `#B42318` so the owner can find them while scrolling. Move the "N of 4 connected" count into the page header as the summary.
- Command: /impeccable colorize.

**[P1] Disabled Save is louder than enabled Test, and its label cannot be read.**
- Evidence: disabled Save (DCWXD) is `#215D47` at 60% opacity, which blends to `#7A9E91`, with label `#9AA1AB`: 1.13:1. The enabled Test next to it is a plain white box. So the eye lands on the button that does nothing.
- Fix: replace Test and Save with one primary "Connect" button that tests and saves on success (first run), or "Save" that tests first (after edits). Failure keeps the edits unsaved and shows the error inline. A disabled state uses a neutral fill (`#EEF0F2`, text `#8A929C`), never a faded primary. Buttons: 36px tall, 8px radius, 14/600.
- Commands: /impeccable clarify, /impeccable polish.

**[P2] Saved secrets look empty.**
- Evidence: API key field Kc0FV in P8KN4f has no content; the only sign it is saved is "Set · leave blank to keep" in grey 13px at x=516. In yqQwT Radarr the edited key shows as 32 dots. So "saved" looks blank and "being typed" looks filled, the opposite of what the eye expects.
- Fix: a saved secret shows a filled, locked field: masked dots, a lock icon and a "Replace" text button inside the field. Clicking Replace empties it and focuses. Drop the "leave blank to keep" sentence.
- Command: /impeccable harden.

**[P2] Fields are built from the search box.**
- Evidence: Address input u8CCA and API key input A2B8wL are instances of Input/Search (YxJcD) with the search icon and "/" key turned off. Placeholder text `#9AA1AB` on white is 2.61:1 (fails 4.5:1).
- Fix: a real Input component: 40px tall, 8px radius, 1px `#CBD2D0` border (3:1 against white), focus ring 3px `#215D47` at 25%. Placeholder at least `#6B7480`. Labels above fields (Barlow 13/600), not in a 120px left column; this frees 120px and lets fields run the card's width.
- Command: /impeccable layout.

### First-run experience (gwuMS)

- Today: seven identical empty cards, all "Not set up", one sentence of help at 13px: "Nothing is connected yet. Add each service's address and key, test it, then save." The top bar still offers Library, Downloads, Calendar, Flagged and Health, all of which will be empty.
- Proposal:
  1. Order the cards by dependency and number them: rTorrent, Sonarr, Radarr, Plex, then trackers. Nothing works without rTorrent and Sonarr or Radarr.
  2. A progress line in the header: "2 of 7 connected" with seven small logo chips that turn from grey to full colour as each connects. Uses the real logos, so it doubles as a summary.
  3. Expand only the next card to set up; others collapse to a 56px row with logo, name and "Not set up". The owner does one thing at a time.
  4. Under each key field, one line saying where the key lives, e.g. "Sonarr: Settings > General > API Key". This is the help heuristic 10 is missing.
  5. Keep the "how the pieces connect" strip from the Rack variant (NjX6q): Trackers > Sonarr + Radarr > rTorrent > Plex, each node lighting up as it connects. It explains the product's shape without words. Rebuild it with the real logos; NjX6q currently uses stand-in marks (coloured letter squares "B", "R", "rT"), against the real-logos rule.
  6. When the last one connects, the header strip turns fully green and offers "Open the library", the first moment the app is ready.

### Problems state (yqQwT)

- Errors are good copy. Make them actionable: "rTorrent didn't answer within 10 seconds. Check the address and that rTorrent is running on Whatbox." Plus a "Try again" link in the error line.
- Radarr shows "Testing…" while Test is disabled and Save is enabled. Pick one rule: while testing, both buttons are busy and Save shows a spinner.
- "Unsaved edits" (heading) and "Unsaved changes" (action row): keep one, in the status pill. Add a page-level bar at the bottom of the viewport when any card has unsaved edits: "Radarr has unsaved edits · Discard · Save".
- Flag count in the top bar (Flagged 5) stays plain text; failed services could add a red dot on Health so the problem is visible from every page.

### Page margins and grid (applies to settings and the new light pages)

- Body padding 20 at 1440 wide is the dark table layout's margin. For a form page: max content width 1120, centred, 40px side margins, 32px between the header and the first card.
- Spacing scale in use is 4/6/8/12/20. Propose 4/8/12/16/24/32/48 and stop using 6 and 20.
- Page title 31px is off any scale. Use 28/700 with a 14px subtitle in `#58616C`.
- Two columns at 690 stay right for 1440; collapse to one at 1024 and below.

---

## 2. Sign-in (AA-37)

These frames are already light: fill `#F6F8F7`. Checked: YIKOI and enXfL Initial, FEVzb Opening Plex, my0AC Checking Plex account, g42xjJ Pending, kU2e6 Wrong owner, JzkZu Plex unavailable, VInOQ Sign-in not configured, q6A0O Attempt expired, evJ01 Session expired, hoMhL Signed in, N2fXn Signed out, gnhck Cancelling.

### What the frames are

- Content block 400px wide, pinned at x=96, vertically near centre (i2vc0t at y=306). The other 944px of the 1440 frame are empty.
- Inter throughout: 14/600 product name `#53605F`, 36/600 heading `#152123`, 16/400 body with 1.75 line height.
- One button style: white fill, 1px `#DAE2DF` border, 8px radius, 46px tall, Inter 15/600.
- The Plex mark in the button (rHKI8) is a black chevron.

### Heuristic scores (whole flow)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | "Checking your Plex account…" has a greyed "Checking…" button and no spinner or progress |
| 2 | Match with the real world | 3 | Clear, honest copy ("This app never receives your Plex password") |
| 3 | User control and freedom | 3 | Pending has Cancel |
| 4 | Consistency and standards | 1 | Inter and 8px radius here; Barlow and 0 radius in the app. Two products |
| 5 | Error prevention | 3 | Explains up front that only the owner's account works |
| 6 | Recognition over recall | 3 | Simple, one action per screen |
| 7 | Flexibility and efficiency | n/a | One-button flow |
| 8 | Aesthetic and minimalist design | 2 | Minimal, but reads as unfinished: tiny block in a large empty canvas |
| 9 | Error recovery | 2 | Wrong owner and Plex unavailable only offer "Try again" with no cause |
| 10 | Help and documentation | 2 | "Sign-in isn't configured" names the missing settings in prose, not by their real names |
| | **Total** | **21/36** | Acceptable |

### Priority issues

**[P1] The sign-in screens and the app look like two different products.**
- Evidence: sign-in uses Inter, 36/600 headings, 8px radius, `#F6F8F7` ground, `#152123` ink. Settings uses Barlow, 31/700 heading, 0 radius, `#F5F5F5` ground, `#171B20` ink. Two near-identical greys and two near-identical inks.
- Fix: settle one light token set and use it on both: one ground, one ink, one radius scale (6 for small controls, 8 for buttons and fields, 12 for cards). Whatever font wins, sign-in and the app share it. Sign-in is the first screen the owner sees; it should set the look, not differ from it.

**[P1] The only action looks secondary.**
- Evidence: "Sign in with Plex" (c9qIk) is a white button with a `#DAE2DF` border: 1.32:1 against white and 1.24:1 against the ground, so its edge is nearly invisible (non-text contrast needs 3:1). The black chevron is not Plex's colour.
- Fix: make it the primary button: Plex's dark `#1F1F1F` fill, white label, the chevron in Plex yellow `#E5A00D`, 48px tall, full content width (400px) on desktop as on the phone frame. Plex's own sign-in buttons use this pairing, so it reads as "this goes to Plex".

**[P1] Signed in (hoMhL) is a dead end.**
- Evidence: the frame holds only the heading "media-manager-2" and a Sign out button. It is the end of the flow and the end is what the owner remembers.
- Fix: this is the place for the one moment of delight. After the check passes: the owner's Plex avatar and name ("Signed in as alec"), a short check-mark animation (200 ms), then a hand-off into the library, or into Settings first run if nothing is connected. If this frame is only a stand-in until the app shell exists, label it so on the canvas.

**[P2] Error screens say what failed but not why or what next.**
- Wrong owner (kU2e6): "This Plex account can't open this app. Sign in with the owner's account." It does not say which account was refused. Plex keeps the browser signed in, so "Try again" may send the same account back. Fix: "Signed in on Plex as <name>. Only the owner can open media-manager-2." Buttons: "Sign out of Plex and try again" (primary) and "Try again".
- Plex unavailable (JzkZu): body "Try again." repeats the button. Fix: say which side failed ("plex.tv didn't answer" or "This server couldn't reach plex.tv") and when it was tried.
- Pending (g42xjJ): three buttons, "Check again", "Try again" and "Cancel". "Check again" and "Try again" read as the same thing. Fix: "I've finished on Plex" (primary, checks again), "Start over", "Cancel".
- Session expired (evJ01): body "Sign in again." but the button says "Try again". Use "Sign in with Plex" so the same button means the same thing everywhere.
- Sign-in not configured (VInOQ): "The server needs an owner Plex ID and public app address." The server reads these as `PLEX_OWNER_ID` and `APP_ORIGIN` (verified in source via `git grep process.env`). Show the two names in a code style so the owner can set them.

**[P2] Composition looks unplaced on desktop.**
- Evidence: 400px block at x=96 in a 1440 frame; 944px blank to the right; vertical position shifts per state (y=306 Initial, 318 Wrong owner, 391 Signed in), so the heading jumps between screens.
- Fix: either centre a 400px card (white, 12px radius, 32px padding) on the ground, or keep the left column and use the right half for something true to the product: a quiet, large arrangement of the seven real service logos, greyed, that the app will connect to. Fix the heading's y position across states so only the text changes.

### Phone (enXfL)

The phone frame is the best of the set: 24px margins, full-width button, readable 16px body. Same token fixes apply.

---

## 3. Dark legacy screens with no light version yet

Brief look only. All four are 1440x900 on `#0E0F12`, Barlow, 0 radius, nav "Search, Downloads, Calendar, Flagged, Health". The light frames' nav is "Library, Downloads, Calendar, Flagged, Health, Settings", so the two nav bars already disagree.

**Health (imWFw).** Strongest of the four: problems first, then collapsed healthy sections, then tracker ratios and disk. Light version needs: red "RISK" blocks (`#FF534A` fill) turned into tinted pills; the tracker table and disk bars in cards with the real tracker logos; disk bar colour that changes above 90% (today the bar is plain white whatever the value); one summary line at the top, e.g. "6 problems · 2 risk a hit and run", with the service logos showing their status as the settings header does.

**Downloads (dIXwk).** The frame has group headings ("Needs you · 1", "Being handled by media-manager-2 · 2", "Everything else · 8") but no download rows: only 6 component instances in the whole frame and none are Row/download. A light version needs the rows drawn first (Row/download TCymk and its stalled, import-blocked and waiting variants exist in the components). Then: progress bars with rounded ends in green, stalled in amber, a seeding state that shows ratio and time left to meet the tracker's hit and run rule.

**Flagged (R1GOrH).** Good copy and structure (what happened, next step). Light version: each row as a card with the poster from Sonarr or Radarr, the kind ("Gave up", "Import blocked") as a coloured pill, "Hit and run risk" in red tint, the primary next step as a real button rather than bold text with a key hint.

**Calendar week (J1uFA4).** Seven empty columns: the frame has 7 instances and 2 clipped nodes but no entries, while the header says "2 missing this week". Light version needs entries drawn (Calendar/Entry nn0ll exists), small posters per entry, Sonarr and Radarr logos to tell TV from movies, today's column tinted rather than lighter grey, and the "now" line in the primary colour.

---

## 4. Proposals summary

1. One light token set for sign-in and the app: ground `#F3F5F4`, card `#FFFFFF`, ink `#16201F`, secondary ink `#55605F`, border `#D5DBD9`, primary `#215D47`, error `#B42318`, warning `#B54708`. Radius 6 / 8 / 12.
2. Cards over bordered rows. One shadowed card per service; no line between fields.
3. Status as tinted pills next to the real logo, with the version for Connected and the reason for Failed.
4. One "Connect" button per service; one "Save" after edits; neutral disabled state.
5. Saved secrets as locked fields with "Replace".
6. Labels above fields; fields 40px tall; placeholder at least 4.5:1.
7. First run as an ordered setup with a logo progress strip, help lines that say where each key lives, and a finish moment that opens the library.
8. Sign-in: Plex-coloured primary button, named account on Wrong owner, real setting names on Not configured, a signed-in moment with the Plex avatar.
9. Content width 1120 centred, 40px side margins, spacing scale 4/8/12/16/24/32/48.
10. Before making light versions of Downloads and Calendar, draw the missing rows and entries; both frames are empty today.

Questions skipped: reviewer brief asks for a written report and a short summary, not an interactive close.
