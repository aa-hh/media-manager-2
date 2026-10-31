# Handover: Android TV app, 31 October 2026

You are taking over the native Android TV app for media-manager-2, for Alec's Google TV Streamer (4K). The previous session researched the options, settled every decision with Alec, wrote and checked the build plan, explored the TV screens in Figma, and ran wave 0 of the plan. It stopped before wave 1 at Alec's request.

Read first, in this order: this file; `docs/plans/android-tv-app-plan.md` (the approved plan: tasks, contracts, waves, owner stops, risks); `docs/research/tv-design-guidelines.md` (Google's TV design rules and, under "Owner's answers", every design decision); `docs/adr/0006-sign-in-a-tv-with-a-plex-link-code.md` and `docs/adr/0007-update-the-tv-app-from-github-releases.md`; `docs/research/tv-apps-google-tv-and-apple-tv.md` (why native Android, why Media3). Then `CLAUDE.md`, `AGENTS.md` and the nearest `AGENTS.md` for any folder you touch. Speak to Alec in plain words (his global `~/.claude/CLAUDE.md`), ask him decisions with the AskUserQuestion tool, recommended option first, each option with an upside and a downside.

## Status of the plan's tasks

Linear: project [V2 · Google TV app](https://linear.app/aa-hh/project/v2-google-tv-app-aecdb8e25f70) (`P-AA-16`), epic AA-402 (Google TV app: watch, browse and grab from the TV). Every task has a sub-issue; mention tickets with number and title.

| Task | Linear | State | Where |
|---|---|---|---|
| S0 docs to main | — | Done, merged | PR #261 |
| T00 Linear project, epic, tickets; tracker doc | AA-403 | Done, merged | PR #276 |
| T01 Server: TV link-code sign-in, 90-day device sessions, list and sign-out | AA-404 | In Review: rounds 1 and 2 passed; waiting for Alec's merge yes | PR #277, branch `claude/tv-link-code-sign-in` |
| T03c Design: first launch, link code, update prompt, banner and icon; web "Signed-in TVs" | AA-406 | Drawn, waiting for Alec's approval (S4c) | Figma (below) |
| T06 Release key into this Mac's Keychain | AA-410 | Done | Keychain |
| T12 Extend /approve-design with a TV path | AA-408 | Done, merged | PR #275 |
| Everything else | — | Not started | — |

### T01 notes for whoever finishes or deploys it

- Went beyond the plan inside its four files: web and TV sign-in now share `requestPin`, `checkPin` and `plexCompleteReply` instead of two copies; `validateSession` renews only when `privateGuard` passes `renew` (the event stream's checks must not move the expiry without re-sending the cookie); TV sign-out removes only rows with a device name; `created_at` is written for browser rows too.
- Review round 1 passed with no findings left. Its deep pass found that sign-out picked a TV by SQLite's reusable `rowid`; the scorer dropped it at 60 but confirmed it, and it was fixed anyway: TV rows now carry a random 22-character `device_id` (same migration entry, unique index), `GET /api/devices` returns it as `id`, and `POST /api/devices/:id{[A-Za-z0-9_-]{22}}/sign-out` matches it. That changes the plan's device-route contract: `id` is that string, not a number. Round 2 passed with no findings left (commit 8398c48). The `device_id` column went into the same, never-deployed migration entry; that is safe only because no database ever ran the round-1 build, so deploy only the merged result. Commits after round 2 get no review status: a further fix needs a new PR or Alec's word to merge with `--admin`
- Reviewer notes left for Alec, not code defects: anyone who reaches the public address can start a link code and try to get the owner to enter it (the usual risk with device codes); TV rows count toward `MAX_SESSIONS` (100). Live checks still owed: that plex.tv accepts the plain PIN and shows its code at plex.tv/link, and that the real TV app keeps and resends the cookies.
- After merge: owner stop SD (Alec approves a deploy and names the host; then `DEPLOY_HOST=<host> sh scripts/deploy.sh` from a clean worktree at origin/main). The TV can't use the routes before that.

### T06 notes

- Keychain (account `aa-hh`): `media-manager-2.android-tv.release-keystore` (base64 of the .p12) and `media-manager-2.android-tv.release-password` (store and key password). Alias `release`, RSA 4096, owner `CN=media-manager-2 TV`, SHA-256 `97:6A:2A:1B:32:D3:74:53:05:E7:CF:41:BB:86:65:7E:E1:C4:20:36:05:CB:CE:52:CF:DC:E8:48:36:CE:7C:7E`.
- Never print either value. Owner stop S2 is Alec running these two commands himself:
  ```
  security find-generic-password -s media-manager-2.android-tv.release-keystore -a aa-hh -w | gh secret set ANDROID_TV_RELEASE_KEYSTORE -R aa-hh/media-manager-2
  security find-generic-password -s media-manager-2.android-tv.release-password -a aa-hh -w | gh secret set ANDROID_TV_RELEASE_PASSWORD -R aa-hh/media-manager-2
  ```
- T07 must map those two secrets to `ANDROID_TV_KEYSTORE_PATH` (decoded file in `$RUNNER_TEMP`) and `ANDROID_TV_KEYSTORE_PASSWORD`; the plan's T07 section says so.

## Waiting on Alec

- **S1, Android Studio setup.** Installed at `/Applications/Android Studio.app` (Homebrew). Alec opens it, finishes first-run setup and accepts the licences, then installs in SDK Manager: newest stable SDK Platform, Build-Tools, Platform-Tools, Command-line Tools (latest), NDK (Side by side) 26.1.10909125, CMake 3.22.1; SDK at `~/Library/Android/sdk`. T04 waits for this. Check with `ls ~/Library/Android/sdk/ndk/26.1.10909125`.
- **S2**, the two secret commands above (before T07 can publish).
- **S3**, on the Streamer: Settings → System → About, select "Android TV OS build" 7 times; Developer options → USB debugging and Wireless debugging; he reads out IP:port and the pairing code. Needed before T22.
- **S4c / S4b / S4a**, approving the T03c, T03b, T03a frames. Iterating is not approval.
- **Every merge** needs Alec's yes; then `gh pr merge <n> --merge --auto`.

## Next: wave 1 (do not start without Alec's go)

From the plan's section D: T04 (after S1), T03b (player designs; T03c is done), S2, T23 (after T01 merges; shares `tests/production.test.mjs`, `src/server/app.ts`), SD for T01. Model and effort per task are in the plan's section C (cost-checked; Alec kept T24, T03a, T03b, T03c and T17 on Opus).

## Design state

Figma TV screens file: [media-manager-2 -- Android tv -- screens](https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ) (`LOntH5HQXfvTnfapJoyoqZ`), README / FINAL (empty until Alec approves) / DISCOVERY. TV components are instances of the published **TV Design Kit** library (`Rsy65KLjApSI4falPy3Ea9`, component list at node 22:532), restyled. Never edit the kit or our library `xXlrfBjHLkPumAfRzEFXtO`. The web screens file is `dFQMjELOx6ObLS0qOG3NCF`.

Alec's picks (full wording in `tv-design-guidelines.md` "Owner's answers"):

| Question | Pick | Figma |
|---|---|---|
| Navigation | Side menu on the left, collapsed to icons, opening on focus; Library is a menu item with Films and TV under it; Settings at the bottom | Q1A 5:22, 5:25 |
| Top of Discover | The focused card's backdrop and summary fill the top | Q2B 5:40 |
| Cards | 2:3 posters, title under; growing on focus must not move anything else | Q3A 5:49 |
| Library filters | Tab row (All / Continue Watching / Unwatched / Missing / Downloading); Films and TV move to the side menu | Q4A 5:61 |
| Release list | Three-line rows plus the "Grab this release?" panel | Q5B 5:76 with Q5A's panel (Q5B grab 24:3148) |
| Adding a title | "Add to library" on the title page opens a dialog holding desktop's sentence with each choice as a focusable chip; focus starts on "Confirm selection"; no Cancel (Back closes); More options collapsed | section "Q6 v2 · A" 26:3164, frames 30:3671, 26:3169–26:3187 |
| Typefaces | Schibsted Grotesk throughout | Q10C 5:103 |
| Colours | The app's Cool night palette | Q11A 5:109 |
| Per-title actions | Hold OK on a card for a short list, and the same actions as title-page buttons | not drawn yet (T03a) |
| Player jumps | Back 10 s, forward 30 s | T03b |
| Subtitle size | The app's five sizes, starting from the TV's caption setting | T03b |
| Update prompt | Centred pop-up at launch, Update now focused, Later second, Back = Later | 5:121 |

Wording: the button is always "Add to library", never "Add to Sonarr/Radarr"; the add dialog's sentence names the service with its logo, as on desktop ("Radarr will add <title> to your library."). Mockups use invented placeholder titles and data. Use real Sonarr/Radarr logos from `design/logos/` (rasterise SVG to PNG with `rsvg-convert` for Figma fills).

House style for every TV frame: 960 × 540 dp canvas, safe area 48 dp sides / 27 dp top-bottom; one focus style for buttons and cards (white 3 dp ring + 1.1× scale; side-menu items and tabs may keep the kit's white fill); outline buttons 1.5 dp `#858C99`; muted text `#AAB3C1` at full opacity (60 % layer opacity renders as a failing grey); lime only as an icon or thin line, never text; no hover-only controls; no on-screen Back button; no download bar or line on posters (only the "Downloading 64%" badge).

Open design points for T03a, from the Q6 v2 A notes (frame 28:3669): More options makes the dialog scroll; long profile names are cut in the chip; Back undoes a single-choice list but keeps season ticks; amber has no Cool night value yet (placeholder `#F0B25A` on `#2B2417`).

### T03c frames (Figma, waiting for S4c)

- TV file section 33:3757 "T03c · First launch, link code, update, icon": A1–A5 address entry, connecting and errors (screen frames 33:3769, 33:4672, 33:4862, 33:5074, 33:5096); B1–B5 link code, expired, not the owner, "Finish setup in a browser first.", signed in (35:3969, 35:4000, 35:4032, 35:4067, 35:4101); C1–C5 update pop-up, downloading, Android installer hand-off, install permission, failure; D1–D3 launcher banner, icon, banner in the apps row. Row notes 35:4375 (A) and 35:4378 (B).
- Web file `dFQMjELOx6ObLS0qOG3NCF`, Dark mode page DISCOVERY wrapper 23:1593 (the file has no Settings page): "Signed-in TVs" under Appearance, light W1–W3 and dark W4–W6 (list, empty, sign-out confirmation); notes 23:2298. It shows "last used", which the device route doesn't return yet (only `signedInAt`, `expiresAt`); either derive it (expiry minus 90 days) or add `lastUsedAt` in T11.
- **The planet.** Alec wants the desktop sign-in planet, exactly, behind the TV first-launch screens. The frames carry stills rendered from `design/discovery/sign-in-generative/2d-jupiter-fluid.html` (`?bare&state=…&t=…`): checking on A3 and B1, success on B5, idle elsewhere; placed 200 px right of the desktop position because the TV text is wider; B5 has an extra dark oval behind its centred block. Stills: the session scratchpad `planet/` folder (temporary; re-render from the HTML if gone). T14 (AA-427, First-launch address and link-code screens) now ports `src/client/signInPlanet.ts` to OpenGL ES 3.0 with the same states, constants and timings, on Opus 5.5.
- Open for Alec at S4c: the text field rings but does not grow on focus (a 440 dp field growing would push its hint line); B5 has nothing focusable for about 1.5 s; not drawn yet: address typed without http(s)://, an untrusted https certificate, too many attempts / Plex unreachable, the toast after a web sign-out; the app mark needs a larger source for the icon and 4K banner; the TV's name is assumed to come from Android's device name.

## How the previous session worked (keep doing this)

- One builder per task, as a background Agent with the plan's model and effort, `isolation: "worktree"`. A builder's first step is `git fetch origin main && git reset --hard origin/main` (plus `npm ci --ignore-scripts` for server work). It commits as `aa-hh <68386059+aa-hh@users.noreply.github.com>` and does not push; the orchestrator checks the diff, merges main in, renames the branch to `claude/<slug>`, pushes (the pre-push hook runs the full suite), opens the PR with the Linear ticket and title in the body, and runs `bash scripts/review-branch.sh`.
- Review passes: run each printed pass as a subagent, read-only. The deep pass runs on Opus, not Fable (Alec's rule). Subagents can't write into another worktree, so each returns its reply and the orchestrator saves it to the `.out` path with a Bash heredoc, then runs `bash scripts/review-branch.sh --continue`. Commits after round 2 get no review status.
- Each builder reports "plan said → I did" and flags any divergence; surface divergences to Alec rather than absorbing them.
- Figma: several agents may write the same file at once if each owns different sections; there is no daily read cap on the Figma MCP. Keep each `use_figma` call to one frame or less (a long call once hung an agent). `get_screenshot` drops at times; an in-script screenshot works.
- Builds and tests only through the repo wrappers (`sh scripts/build.sh`, `sh scripts/test.sh`, later `sh scripts/android-tv.sh`). Android work stays on this Mac (the second Mac has no Android SDK; use `AUDIOUT_REMOTE_LOCAL=1` with remote-run).
- Never open app or player windows on Alec's screen; on-TV checks are his (S6a, S6b).
- Update Linear as tasks move: In Progress when a builder starts, In Review with the PR link, Done on merge.
