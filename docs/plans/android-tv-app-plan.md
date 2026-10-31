# Plan: native Android TV app for media-manager-2 (Google TV Streamer)

31 Oct 2026. Every file:line cite points at origin/main @ ecadbea. Paths are relative to the repo root. Every task branches from origin/main. Models: Opus 5.5, Sonnet 5.5, Haiku 5.5.

## A. End state

A Kotlin + Compose for TV app lives in `android-tv/` beside `desktop/`. It has one Gradle module, `app`, with packages `api/`, `downloads/`, `player/`, `update/` and `ui/` under `io.github.aahh.mediamanager2.tv`.

**First launch.** The TV asks for the server address (https or http, as on desktop), then signs in with a 4-character Plex link code.
- Two new server routes, `/auth/link/start` and `/auth/link/complete`, create an ordinary `sessions` row with a device name.
- The row lasts 90 days and renews on use.
- The TV keeps it as the normal session cookie and sends the browser headers on writes.
- Before the server's setup has an owner, the TV is refused with "Finish setup in a browser first."

**What the TV does.**
- Screens: home/discover, library, search, a title page with live download progress from the server's event stream, add with monitoring, automatic search and Pick a release, Play/Resume.
- Per-title actions (mark watched, monitor, remove from Continue Watching): holding OK on a card, and as buttons on the title page.
- No settings, no sign-out and no address change on the TV in v1.

**The player.**
- Media3 ExoPlayer with the box's own decoders, plus Media3's FFmpeg audio decoder built from source.
- Drawn on a SurfaceView, so Dolby Vision reaches the TV as Dolby Vision.
- Plays the stream addresses from `POST /api/playback/start`.
- Same retry, quality, Up Next, skip-marker, 10 s back / 30 s forward and subtitle-size rules as desktop. Subtitle size starts from Android TV's caption setting.
- The server can name the TV to Plex as an Android client or as Plex Desktop, chosen per request. A box test decides which one the app uses.

**Web Settings.** Lists signed-in TVs, each with Sign out.

**CI and updates.**
- The `tests` check builds and unit-tests android-tv when a branch touches it.
- Merging to main signs the app and publishes a GitHub release.
- At launch the TV shows a centred pop-up, "Update now / Later".

**Rules around the work.**
- Android builds go only through `scripts/android-tv.sh`; the guard hook blocks bare `gradle`/`gradlew`.
- No screen code before the owner approves frames in the Figma file "media-manager-2 -- Android tv -- screens" (https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ).
- TV parts are instances of the published "TV Design Kit" library (Rsy65KLjApSI4falPy3Ea9), restyled to our dark theme.

## B. OPEN QUESTIONS — needs confirmation

None. The owner answered all eight on 31 Oct 2026:

| Question | Owner's answer | Where it lands |
|---|---|---|
| Q1: TV sign-in before setup | Refuse: "Finish setup in a browser first." | T01 (409 `setup_required`), T14 |
| Q2: FFmpeg decoder | Built once per Media3 version, kept out of git, cached in CI | T05 |
| Q3: TV design path | Start from the TV Design Kit library, restyle to our theme; approved parts go into our library as `v2/TV/<Family>/<Variant>`; Kotlin is the master copy; library redrawn after merge | T12, T03a–c, T13b |
| Q4: http addresses | Allowed, as desktop; no warning text | contracts, T04, T08 |
| Q5: sign-out / change address on TV | Not in v1 | T13a |
| Q6: grab progress | Live, through the existing event stream | T26, T17, T18 |
| Q7: when TV tests run | At every commit that touches `android-tv/` | T04 |
| Q8: Plex identity | Plan a per-request Android identity; box-test it against Plex Desktop; if Android is worse, keep Desktop | T24, B15, T25 |

Further owner decisions (31 Oct):
- Per-title actions both on hold-OK and as title-page buttons.
- Player jumps 10 s back / 30 s forward.
- Subtitle size: five sizes, starting from the system caption setting.
- Update prompt: a centred pop-up, Update now focused, Later second, Back = Later.

Layout and look are decided in the Figma phase, not here: navigation, the top of Discover, poster shape, library filters, the release list, the add flow, typefaces and colours. Explorations for those 8 questions are being drawn now in the screens file from kit instances.

T24, T03a, T03b, T03c and T17 stay on Opus 5.5 at their current effort (owner, 31 Oct).

## C. Tasks

STOP marks an owner action. Agents never open windows on the owner's screens; every on-TV check is the owner's.

### Contracts fixed by this plan

**Link sign-in routes** in `src/server/app.ts`. Both use `requireBrowserPost` (`app.ts:242`).

`POST /auth/link/start`
- Body exactly `{"deviceName": string}`, read with `readExactJson` (`app.ts:113`). The name is trimmed, 1–64 characters, no control characters; otherwise 400 `invalid_request`.
- 201 `{code, expiresAt}`, plus the web binding cookie (`bindingCookieName`, `app.ts:169`) with Max-Age set to the attempt's life.
- 429 `rate_limited` with Retry-After, sharing the web limiter (`auth.ts:252`).
- 503 `not_configured` or `plex_unavailable`.
- 409 `setup_required` when no owner exists.

`POST /auth/link/complete`
- Body `{}`.
- 202 `{status:'pending'}`.
- 200 `{expiresAt}` plus the session cookie with Max-Age 7,776,000 (90 days).
- 401 `invalid_flow` or `flow_expired`; 403 `owner_only`; 409 `in_progress`; 503 `plex_unavailable`.
- Mirrors `/auth/complete` (`app.ts:295-327`).

`/auth/cancel` (`app.ts:329`) also cancels a link attempt.

**Plex PIN.**
- Create: `POST https://clients.plex.tv/api/v2/pins` with `{"strong": false}` and no `jwk`.
- Check: `GET …/pins/{id}` with the attempt's `X-Plex-Client-Identifier` and no `deviceJWT`.
- Then the same user fetch and owner check as `complete()` (`auth.ts:403-449`).
- Attempt life is `min(10 min, Plex expiresAt)`.

**Sessions migration.** Append one entry to `applicationMigrations` (`src/server/database.ts:28`), before its closing `] as const;` at `database.ts:426`:
```
ALTER TABLE sessions ADD COLUMN device_name TEXT; ALTER TABLE sessions ADD COLUMN created_at INTEGER;
```
- Web rows keep `device_name` NULL and their 24 h life (`auth.ts:28`).
- A device row renews when `expires_at − now < 90 d − 24 h`: set `expires_at = now + 90 d`, and `privateGuard` (`app.ts:492-508`) re-sends the cookie with Max-Age 90 d.

**Device routes** (behind `privateGuard`):
- `GET /api/devices` → `{devices:[{id, name, signedInAt, expiresAt}]}`. `id` is the row's `rowid`; only unexpired rows with a device name are listed.
- `POST /api/devices/:id/sign-out` → 204, or 404 `not_found`. Deletes the row and its in-memory Plex token.

**Title action routes** (T23, behind `privateGuard`; `:service` is `sonarr` or `radarr`):
- `POST /api/library/:service/:id/watched` with body exactly `{"watched": boolean}`.
- `POST /api/library/:service/:id/continue-watching/remove` with body `{}`.
- Replies: 204; 404 `not_found` when Plex has no matching item; 502 `plex_unavailable`.
- Monitoring reuses `POST /api/library/monitor`: `writeRoute('/monitor', …)` at `src/server/library.ts:856`.

**Plex identity header** (T24):
- Every `/api/playback/*` request may carry `X-Media-Manager-Plex-Identity: android` or `desktop`.
- Missing means `desktop`. Any other value is 400 `invalid_request`.
- With `android`, the TV also sends `X-Media-Manager-Platform-Version: <Android release>`, matching `^\d{1,3}(\.\d{1,3}){0,2}$`.

**TV HTTP rules.**
- The client for our server sends `Origin: <typed origin>`, `X-Requested-With: media-manager-2` and `Content-Type: application/json` on every non-GET request.
- On `/api/playback/start` it also sends `X-Media-Manager-Desktop: 1`, so the reply carries `streamAddresses`, `directAddressCount` and `machineIdentifier` (`src/server/playback.ts:273, 416`).
- The player's Plex data source is a separate OkHttpClient with no cookie jar.
- Every logged string has `X-Plex-Token` values replaced with `***`.
- Unencrypted http is allowed for every host: `res/xml/network_security_config.xml` with `<base-config cleartextTrafficPermitted="true">`.

**Releases.**
- Tag `android-tv-v<versionCode>`; asset `media-manager-2-tv.apk`.
- `versionCode` = `GITHUB_RUN_NUMBER` of the release workflow; `versionName` = `1.0.<versionCode>`.
- Local and debug builds: versionCode 1, `applicationIdSuffix ".debug"`, never check for updates.
- applicationId `io.github.aahh.mediamanager2.tv`; launcher label `media-manager-2`.

**Android baseline.**
- minSdk 28. compileSdk and targetSdk are the newest stable API installed at STOP S1.
- ABIs `arm64-v8a` and `armeabi-v7a` until box test B2.
- `android:allowBackup="false"`; touchscreen not required; `LEANBACK_LAUNCHER`; `REQUEST_INSTALL_PACKAGES`.
- Single `MainActivity` with navigation-compose.
- Session cookie in app-private SharedPreferences, behind an OkHttp `CookieJar` limited to the server host.

**Dependencies.** All declared once in T04, each at the latest stable version on the day:
- OkHttp, `okhttp-sse`, mockwebserver
- kotlinx-serialization (plugin and json)
- kotlinx-coroutines and its test library
- Media3 `media3-exoplayer`, `media3-ui`, `media3-datasource-okhttp`
- Compose BOM, `androidx.tv:tv-material` 1.1.0 or newer, `navigation-compose`
- Coil 3 `coil-compose` and `coil-network-okhttp`
- JUnit 4

`media3-ui-compose-material3` and phone Material 3 components are not used. Google warns that mixing phone Material with tv-material gives inconsistent colours, type and shapes (`docs/research/tv-design-guidelines.md:210`). That Media3's Material 3 controls in particular clash is our inference from two Google pages (`tv-design-guidelines.md:342`), not a Google statement.

### Owner stops

- **S0.** Commit the research worktree's untracked `docs/adr/0006-sign-in-a-tv-with-a-plex-link-code.md`, `docs/adr/0007-update-the-tv-app-from-github-releases.md`, `docs/research/tv-design-guidelines.md` and this plan to PR #261's branch `claude/streambox-apple-tv-support-f1fd00`. Run the review; the owner approves the merge.
- **S1.** Android Studio's first-launch SDK setup and licence acceptance. In SDK Manager install: the newest stable SDK Platform, Build-Tools, Platform-Tools, Command-line Tools (latest), NDK (Side by side) 26.1.10909125 (r26b), and CMake 3.22.1. The SDK must end up at `~/Library/Android/sdk`.
- **S2.** After T06: run the two `security … | gh secret set …` commands T06 prints.
- **S3.** On the Streamer, turn on Developer options, USB debugging and Wireless debugging, then read out the IP:port and the pairing code. Any time before T22.
- **S4c / S4b / S4a.** Approve the T03c, T03b and T03a frames. Iterating is not approval.
- **SD.** After each server pull request merges (T01, T23, T24): the owner OKs a deploy and names the host. The agent runs `DEPLOY_HOST=<host> sh scripts/deploy.sh` from a clean worktree at origin/main (`scripts/deploy.sh:1-13`). The TV can't use a route until it's deployed.
- **S6a.** Box tests through the test player (T22).
- **S6b.** The owner's full check of the finished app on the TV.
- **Per pull request.** The owner approves each merge (CLAUDE.md).

### Tasks

**T00 · Linear project, epic and tickets; tracker doc**
- **Files:** Linear; `docs/agents/issue-tracker.md:7-19`.
- **What:** Create project "V2 · Google TV app" (team AA, initiative Media Manager 2 v1) with parent issue "Google TV app: watch, browse and grab from the TV". Add one sub-issue per task in this plan, titled as here. Add the table row with the project identifier Linear assigns. Change line 19's "Don't create new projects." to "Don't create new projects unless the owner asks for one."
- **Kind:** docs · **Depends on:** owner OK of this plan
- **Model:** Haiku 5.5, because the titles are copied. **Effort:** low.
- **Verify:** every sub-issue sits under the epic; the git diff touches only issue-tracker.md.

**T01 · Server: TV link-code sign-in, 90-day device sessions, list and sign-out routes**
- **Files:**
  - `src/server/auth.ts`: `createSession` 212-223, `validateSession` 620-634, `cancel` 609, `removeExpiredAttempts` 196, the returned object 639, a new `links` map.
  - `src/server/app.ts`: routes near 271-327, `privateGuard` 492-508.
  - `src/server/database.ts:426`.
  - `tests/production.test.mjs`: the Plex PIN fake at 350-420, the helper at 485, the migration lookup style at 5111.
- **What:** Build the contracts above. Move the user-fetch + owner-check + `createSession` tail of `complete()` (`auth.ts:403-449`) into one function both flows call.
- **Tests first** (auth.ts is a review risk path, `scripts/review-branch.sh:77`):
  1. start sends `strong:false` with no jwk
  2. bad or extra `deviceName` → 400
  3. no browser headers → 403
  4. pending → 202
  5. owner → 200; row has device_name and created_at; expiry now+90 d; cookie Max-Age 7776000
  6. non-owner, restricted or anonymous → 403
  7. no owner → 409 `setup_required`, and no owner row written
  8. Jellyfin owner → 403
  9. expired attempt → 401 `flow_expired`
  10. web sign-in still lasts 24 h
  11. renewal at +25 h moves the expiry and re-sends the cookie; a second request within 24 h writes nothing
  12. expired device row → 401 `session_expired`
  13. the list shows only device rows
  14. sign-out makes the TV's next request 401; unknown id → 404; no browser headers → 403
  15. the migration test finds its migration with `applicationMigrations.findIndex` by content (as `tests/production.test.mjs:5111`)
- **Kind:** backend · **Depends on:** S0
- **Model:** Opus 5.5, because sign-in is a review risk path and a mistake opens a 90-day way in.
- **Effort:** high, because the refactor touches the live web sign-in.
- **Verify:** `sh scripts/test.sh --full` green; the tests go red when the owner check is removed from the shared function.

**T23 · Server: mark a title watched; remove it from Continue Watching**
- **Files:**
  - `src/server/library.ts`, beside `writeRoute('/monitor', …)` at 856
  - `src/server/watchStatus.ts`, for its existing title-to-Plex matching
  - `src/server/services/plexPlayback.ts` (scrobble at 225) or `services/plex.ts`: root AGENTS.md sends every Plex media request through `services/`
  - `tests/production.test.mjs`
- **What:**
  - Build the title action contract.
  - Watched uses `/:/scrobble` or `/:/unscrobble` on the matched movie or show.
  - Remove sends `PUT {action path}?ratingKey=…`. Plex supplies the path at run time from its list of actions (`docs/research/in-app-player/plex-desktop-network.md:573`).
  - Confirm the field name from developer.plex.tv/pms or with a read-only GET on the slot. Never write while checking.
- **Tests:** watched true and false; unmatched title → 404 with no Plex call; Plex failure → 502; remove sends PUT to the advertised path.
- **Kind:** backend · **Depends on:** T01 (shared tests file)
- **Model:** Sonnet 5.5. Watch history can be undone, and this isn't a risk path.
- **Effort:** medium.
- **Verify:** `sh scripts/test.sh --full` green.

**T24 · Server: per-request Plex identity (Android or Plex Desktop)**
- **Files:**
  - `src/server/services/plexPlayback.ts`: `identityValues` 14-23, `send` 51-65, the returned object 250
  - `src/server/playback.ts`: the stream address identity at 170, the routes 396-510
  - `tests/production.test.mjs`
- **Step 1 (read-only, stop rule).**
  - On the slot, list the client profiles bundled with Plex Media Server (its `Resources/Profiles/` folder) and read the Android ones.
  - Record the exact `X-Plex-Product`, `X-Plex-Platform` and `X-Plex-Client-Profile-Name` they match.
  - Context from `docs/research/in-app-player/plax-lessons.md:30`: Plax was accepted as `Plex for LG`/`webOS` and `Plex Web`/`Chrome`. Plex rejected unknown platform names and an empty platform version.
  - If no Android profile exists, stop and report. The TV keeps Plex Desktop, and T24/T25 are dropped.
- **Step 2 (code).**
  - `identityValues(clientId, identity = 'desktop', platformVersion?)`. The android branch sends the recorded product, platform and profile name, plus `X-Plex-Platform-Version`, `X-Plex-Version: 1` and the same `X-Plex-Features`, `X-Plex-Device-Name` and `X-Plex-Client-Identifier`.
  - `createPlexPlayback` gains `as(identity, platformVersion)`, which returns the same methods with that identity. The default object stays the desktop one.
  - The playback routes read the identity header and pass the chosen client into each `createPlayback` method.
- **Tests:** no header → desktop values unchanged (a desktop regression row); `android` → Android values in the GET query, the POST headers and the stream address; a bad value → 400.
- **Kind:** backend · **Depends on:** T23 (shared tests file)
- **Model:** Opus 5.5. It threads through the Plex client that live desktop playback uses.
- **Effort:** medium.
- **Verify:** `sh scripts/test.sh --full` green; existing desktop playback rows untouched.

**T03c · Design: TV first launch, link code, update prompt, launcher banner and icon; web Settings "Signed-in TVs"**
- **Files:** Figma.
  - TV frames go in "media-manager-2 -- Android tv -- screens" (https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ). If its `README`, `FINAL` or `DISCOVERY` frame is missing, create it, and ask the owner before moving existing work.
  - The web list goes in the Settings screen file's `DISCOVERY`.
- **What:**
  - Start from the owner's layout and look explorations already in the screens file, built from instances of the published TV Design Kit library (Rsy65KLjApSI4falPy3Ea9), restyled with our dark tokens (`src/client/globals.css` `:root[data-theme="dark"]`).
  - 1920×1080 frames with D-pad focus states.
  - Address entry and errors (https and http accepted, no warning).
  - Link code with "go to plex.tv/link"; code expired; not the owner; "Finish setup in a browser first."
  - Update prompt: a centred pop-up with Update now focused and Later second; downloading; handed to Android; unknown-apps permission needed.
  - Settings list: empty, rows (name, signed in, expires), sign-out confirmation.
  - Run `/impeccable` critique. Placeholder data only.
- **Kind:** docs (Figma) · **Depends on:** none
- **Model:** Opus 5.5. Owner-facing judgment; Figma allows 200 read calls a day.
- **Effort:** high.
- **Verify:** owner review (S4c).

**T03b · Design: player**
- **Files:** Figma screens file, DISCOVERY.
- **What:**
  - Controls, audio, subtitles, subtitle size and quality menus; Skip intro/credits; Up Next countdown and waiting; buffering; can't reach Plex; error with Retry. These cover `screenFor` (`src/client/player/model.ts:127-137`) and the waiting steps (`src/client/player/Player.tsx:701-712`).
  - Remote buttons: centre plays or pauses and shows the controls; left/right jump 10 s back / 30 s forward and keep play or pause; holding left/right scrubs; up/down show information without pausing (`tv-design-guidelines.md:196-205`).
  - Subtitle size: Tiny 50 / Small 75 / Normal 100 / Large 125 / Huge 200 %. The starting size from the TV's caption setting is marked. Greyed out for picture subtitles.
  - Built from kit instances.
- **Kind:** docs (Figma) · **Depends on:** T03c delivered (one designer at a time)
- **Model:** Opus 5.5. **Effort:** high.
- **Verify:** owner review (S4b).

**T03a · Design: browse**
- **Files:** Figma screens file, DISCOVERY.
- **What:**
  - Start from the owner's 8 layout and look explorations in the file.
  - Home/discover; library with Continue Watching and played marks; search; title page with seasons and episodes, monitored toggles, Play/Resume, and live per-season and per-episode download progress; add sentence (memory "add block sentence decisions"); automatic search; Pick a release; grab result with live progress.
  - Card hold-OK action list: Mark watched/unwatched, Monitor/Unmonitor, and Remove from Continue Watching (on Continue Watching items only). The same actions as title-page buttons after Play.
  - Release rows fit any quality profile name.
- **Kind:** docs (Figma) · **Depends on:** T03b delivered
- **Model:** Opus 5.5. **Effort:** high.
- **Verify:** owner review (S4a).

**T12 · Extend `/approve-design` with a TV path**
- **Files:** `.claude/skills/approve-design/SKILL.md`.
- **What:**
  - TV components start as instances of the TV Design Kit library (Rsy65KLjApSI4falPy3Ea9), restyled to our theme.
  - After approval they go into the `media-manager-2 library` Figma file as `v2/TV/<Family>/<Variant>`.
  - Code lives in `android-tv/app/src/main/java/io/github/aahh/mediamanager2/tv/ui/components/`, headed `// v2/TV/… — <Figma URL>`, with a Compose `@Preview` instead of a story.
  - Checks: `sh scripts/android-tv.sh build` and `test`.
  - `DESIGN.md` gains a TV section.
  - Step 8 redraws the TV components in the library after merge. The Kotlin code is the master copy.
- **Kind:** docs · **Depends on:** none
- **Model:** Sonnet 5.5. **Effort:** medium.
- **Verify:** the review passes.

**T04 · Android project, build wrapper, guards, CI check, docs**
- **Files:**
  - New: `android-tv/{settings.gradle.kts, build.gradle.kts, gradle.properties, gradle/libs.versions.toml, gradle/wrapper/*, gradlew, gradlew.bat}`.
  - New: `android-tv/app/{build.gradle.kts, src/main/AndroidManifest.xml, …/MainActivity.kt, res/xml/network_security_config.xml}`, plus a banner and icon from main's `desktop/icon.png` on `#0c0f14`.
  - New: `android-tv/AGENTS.md`, `scripts/android-tv.sh`, `scripts/test-guard-bash.sh`.
  - Edits: `scripts/test.sh:38-41, 67-81`, `.claude/hooks/guard-bash.sh:12`, `scripts/review-branch.sh:75-99`, `.githooks/project.conf:7, 11`, `.github/workflows/tests.yml:30-38`, `.gitignore`, `AGENTS.md:45-109`, `scripts/AGENTS.md`, `CLAUDE.md` Build & test.
- **Gradle wrapper.** Take `gradle-wrapper.jar`, `gradlew` and `gradlew.bat` from the latest stable Gradle tag on GitHub. Check the jar against `https://services.gradle.org/distributions/gradle-<v>-wrapper.jar.sha256`. Pin `distributionSha256Sum`. Declare every dependency from the contracts.
- **`scripts/android-tv.sh build|test|release|ffmpeg|install`:**
  - `JAVA_HOME` defaults to `/Applications/Android Studio.app/Contents/jbr/Contents/Home` (Java 25.0.4); `ANDROID_HOME` to `~/Library/Android/sdk`.
  - A missing SDK exits 97 with the S1 message. remote-run reads 97 as "can't run here" (`~/.claude/scripts/lib/remote.sh:527-529`), so a call sent to the mule falls back to this Mac.
  - Runs `android-tv/gradlew -p android-tv --console=plain`: `build` = `assembleDebug`, `test` = `testDebugUnitTest`.
  - `install` = `adb -s "$ANDROID_TV_DEVICE" install -r` of the debug APK.
  - `release` and `ffmpeg` exit 2 until T07 and T05 add them.
- **`test.sh`.** First, in both fast and full runs: compute the base as `--story-args` does (`test.sh:51-54`). When `git diff --name-only $base` (working tree included) touches `android-tv/` or `scripts/android-tv.sh`, run `sh scripts/android-tv.sh test`.
- **Guard hook.** `BARE_CMDS` adds `((ba|z)?sh[[:space:]]+)?([^[:space:];&|]*/)?gradlew?`. The self-test checks:
  - Denied: `gradle build`, `./gradlew test`, `android-tv/gradlew assembleDebug`, `sh android-tv/gradlew test`, `cd android-tv && ./gradlew test`, `env JAVA_HOME=x ./gradlew test`.
  - Allowed: `sh scripts/android-tv.sh test`, `git log -- android-tv/gradlew`, `cat android-tv/gradle/libs.versions.toml`.
- **Review script.** `is_product_path` adds `*.kts|*.toml|android-tv/*.xml|android-tv/*.pro`. `is_risk_path` adds `android-tv/app/build.gradle.kts` and `android-tv/app/src/main/java/io/github/aahh/mediamanager2/tv/{api,player,update}/*`.
- **Hook config.** `SOURCE_PATHS` adds `android-tv/`; `COMMENT_EXTS` adds `kt kts`.
- **CI.** The `tests` job adds `actions/setup-java@v4` (temurin 25) and `gradle/actions/setup-gradle@v4`; its name stays `tests`.
- **.gitignore.** Add `android-tv/.gradle/`, `android-tv/**/build/`, `android-tv/local.properties`, `android-tv/ffmpeg/out/`, `*.jks`, `*.keystore`, `*.p12`.
- **Root AGENTS.md.**
  - Folder Map line: `android-tv/` → the Google TV app: Kotlin, Compose for TV, Media3. Has AGENTS.md.
  - Build rule: run Android builds as `AUDIOUT_REMOTE_LOCAL=1 ~/.claude/scripts/remote-run sh scripts/android-tv.sh <cmd>`, because the mule has no Android SDK.
  - The fourth exception (`AGENTS.md:105-109`) becomes "the desktop app's mpv and the TV app's Media3 player fetching video straight from Plex, with the unauthenticated `/identity` check that picks Plex's address (`desktop/`, `android-tv/`)". The transient-token clause stays; the page clause applies to desktop only.
- **`android-tv/AGENTS.md`** (≤300 words, three sections). Rules:
  - The Plex client has no cookie jar.
  - No token appears in a log.
  - Stream addresses come only from `/api/playback/start`.
  - Writes carry the browser headers.
  - Grabs are blocked while one is in flight and never resent; a grab that errors is settled from history.
  - Snapshot and event ordering rules as in `src/client/AGENTS.md`.
  - The release key never enters the repo; debug builds never update themselves.
  - UI only from approved FINAL frames; dark theme only; no phone Material 3.
- **Kind:** new-code · **Depends on:** S1
- **Model:** Opus 5.5, because it changes hooks, CI and the review script, and a gap lets later work skip a guard.
- **Effort:** high. The scripts must run under macOS's old Bash 3.2.
- **Verify:**
  - `AUDIOUT_REMOTE_LOCAL=1 ~/.claude/scripts/remote-run sh scripts/android-tv.sh build` and `… test` both exit 0.
  - `sh scripts/test.sh --review-script` green.
  - A test PR's `tests` check runs the Android step.
  - `git check-ignore android-tv/app/build` matches.

**T05 · Build Media3's FFmpeg audio decoder**
- **Files:** `scripts/android-tv.sh` (`ffmpeg` subcommand), new `android-tv/ffmpeg/build.sh`, `android-tv/app/build.gradle.kts`, `.github/workflows/tests.yml`.
- **What:**
  - Shallow-clone androidx/media at the tag matching the Media3 version in `libs.versions.toml`, into `android-tv/ffmpeg/out/src`.
  - Clone FFmpeg `release/6.0` from `https://github.com/FFmpeg/FFmpeg` into `libraries/decoder_ffmpeg/src/main/jni`.
  - Run `build_ffmpeg.sh "$FFMPEG_MODULE_PATH" "$NDK_PATH" "$HOST_PLATFORM" 28 ac3 eac3 dca mlp truehd flac alac opus vorbis mp3 aac`, with:
    - `NDK_PATH=$ANDROID_HOME/ndk/26.1.10909125`
    - `HOST_PLATFORM` `darwin-x86_64` on macOS, `linux-x86_64` on Linux
    - the script's ABI list edited to `armeabi-v7a arm64-v8a`
  - Assemble the decoder module's release AAR with that checkout's own gradlew, inside the wrapper. Read the module name from that tag's `core_settings.gradle`.
  - Copy it to `android-tv/ffmpeg/out/lib-decoder-ffmpeg-release.aar` and add `implementation(files("../ffmpeg/out/lib-decoder-ffmpeg-release.aar"))`.
  - `build` and `test` call `ffmpeg` first when the AAR is missing.
  - A missing NDK: CI runs `sdkmanager "ndk;26.1.10909125"`; locally the script exits 97.
  - CI cache: the AAR path, keyed `ffmpeg-${{ hashFiles('android-tv/ffmpeg/build.sh','android-tv/gradle/libs.versions.toml') }}`.
- **Kind:** new-code · **Depends on:** T04
- **Model:** Sonnet 5.5, because the steps are fixed and a failure is a loud build error.
- **Effort:** medium.
- **Verify:** `unzip -l` lists `jni/arm64-v8a/libffmpegJNI.so` and `jni/armeabi-v7a/libffmpegJNI.so`; `sh scripts/android-tv.sh build` green; the second CI run hits the cache.

**T06 · Release key into this Mac's Keychain**
- **Files:** none in the repo; scratchpad only.
- **What:**
  - Make a password with `openssl rand -base64 32`.
  - Run the Android Studio JDK's `keytool -genkeypair -storetype PKCS12 -keystore <scratch>/release.p12 -alias release -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=media-manager-2 TV"`, same password for store and key.
  - Store both: `security add-generic-password -s media-manager-2.android-tv.release-keystore -a aa-hh -w "$(base64 -i release.p12)"` and `-s media-manager-2.android-tv.release-password`.
  - Delete the file with `rm -P`.
  - Print, without running them, the owner's commands: `security find-generic-password -s media-manager-2.android-tv.release-keystore -w | gh secret set ANDROID_TV_RELEASE_KEYSTORE -R aa-hh/media-manager-2`, and the same for the password into `ANDROID_TV_RELEASE_PASSWORD`.
  - Never echo either value into the transcript.
- **Kind:** new-code (one-off) · **Depends on:** none
- **Model:** Sonnet 5.5, because it handles a secret. **Effort:** low.
- **Verify:** `security find-generic-password -s media-manager-2.android-tv.release-keystore` exits 0, run without `-w`; the scratch file is gone.

**T07 · Sign and publish a GitHub release on merge**
- **Files:** new `.github/workflows/android-tv-release.yml`; `android-tv/app/build.gradle.kts` (release signing from `ANDROID_TV_KEYSTORE_PATH`/`ANDROID_TV_KEYSTORE_PASSWORD`, alias `release`; `versionCode` from Gradle property `versionCode`, default 1); `scripts/android-tv.sh` (`release`).
- **What:**
  - Triggers on push to main with paths `android-tv/**` and `scripts/android-tv.sh`; `permissions: contents: write`; `concurrency: android-tv-release`.
  - Steps: checkout, setup-java 25, setup-gradle, restore the FFmpeg cache, decode the keystore secret into `$RUNNER_TEMP`, `sh scripts/android-tv.sh test`. T06 stored the GitHub secrets as `ANDROID_TV_RELEASE_KEYSTORE` (base64 of the .p12) and `ANDROID_TV_RELEASE_PASSWORD` (store and key password); map the decoded file to `ANDROID_TV_KEYSTORE_PATH` and the password to `ANDROID_TV_KEYSTORE_PASSWORD`. Certificate SHA-256 `97:6A:2A:1B:32:D3:74:53:05:E7:CF:41:BB:86:65:7E:E1:C4:20:36:05:CB:CE:52:CF:DC:E8:48:36:CE:7C:7E`, owner `CN=media-manager-2 TV`, then `ANDROID_TV_VERSION_CODE=$GITHUB_RUN_NUMBER sh scripts/android-tv.sh release`.
  - `apksigner verify --print-certs`.
  - `gh release create android-tv-v$GITHUB_RUN_NUMBER <apk>#media-manager-2-tv.apk --title "TV app 1.0.$GITHUB_RUN_NUMBER" --notes "<merge commit subject>"`.
  - A missing secret fails the job.
- **Kind:** new-code · **Depends on:** T05, S2
- **Model:** Opus 5.5, because it publishes publicly with a key that can't be replaced.
- **Effort:** medium.
- **Verify:** after merge, release `android-tv-v<n>` exists with its asset, and the log shows certificate CN=media-manager-2 TV.

**T08 · API client layer**
- **Files:** new `…/tv/api/*`, with tests.
- **What:**
  - OkHttp client with the persisted host-only CookieJar and the header rules; a 401 sets the signed-out state.
  - Port `normaliseAddress`/`isMediaManager` (`desktop/lib/address.js:6-22`), http and https both allowed.
  - Link code: start, poll every 2 s until `expiresAt`, cancel.
  - Device name from `Settings.Global.DEVICE_NAME`, else `Build.MODEL`, cut to 64 characters.
  - kotlinx-serialization models with `ignoreUnknownKeys`, field names copied from the server source, for: `/api/session`, `/api/discover/home`, `/api/discover/:type`, `/api/search`, `/api/add/options/:service`, `POST /api/add`, `/api/library/titles`, `/series/:id`, `/movie/:id`, `/preview/…`, `/tmdb/:type/:tmdbId`, `POST /api/library/monitor`, `POST /api/library/search`, both T23 routes, `/api/releases`, `/api/releases/refresh`, `GET`/`POST /api/grabs`, `/api/downloads`, and every `/api/playback/*` route (`src/server/playback.ts:396-510`).
  - A Coil `ImageLoader` on the same client, for `/api/images/*`.
- **Tests (MockWebServer):** browser headers on POST and not on GET; the cookie survives a client restart; 401 → signed out; address rows; link poll pending → done.
- **Kind:** new-code · **Depends on:** T04
- **Model:** Opus 5.5, because nothing shares a schema with the TypeScript server, so a wrong field fails silently, and it holds the session cookie.
- **Effort:** medium.
- **Verify:** `sh scripts/android-tv.sh test` green; each model file names its server source.

**T26 · Downloads snapshot and live events on the TV**
- **Files:** new `…/tv/downloads/*`, with tests.
- **What:**
  - An SSE client (`okhttp-sse`) on `/api/events` with the session cookie.
  - The web's ordering rules from `src/client/downloads/useDownloads.ts:20-82`:
    - read `/api/downloads` after the stream opens;
    - an event arriving during that read triggers another read;
    - after the stream closes, read again and reopen after 2 s, doubling up to 30 s;
    - a 401 stops reopening.
  - Live event types: `torrents`, `queue`, `grab`, `problem` (`useDownloads.ts:4`).
  - Port `applyEvent` (`src/client/downloads/model.ts:348`), `buildRows` (`model.ts:180`) and `subjectProgress` (`src/client/library/progress.ts:7`).
  - The stream is open only while the title page or Up Next waiting needs it. The server allows 20 streams (`app.ts:73`).
  - Tests: port rows of the web model's cases, plus the event-during-read case.
- **Kind:** new-code · **Depends on:** T08
- **Model:** Opus 5.5, because the event-versus-snapshot ordering is easy to get subtly wrong and progress would quietly freeze.
- **Effort:** medium.
- **Verify:** `sh scripts/android-tv.sh test` green.

**T09a · Player engine on Media3**
- **Files:** new `…/tv/player/{PlaybackEngine.kt, PlexAddress.kt, Retry.kt, Reporting.kt, SubtitleSize.kt}`, with tests.
- **Start.**
  - `POST /api/playback/start` with `resume:true` for Resume; `mediaIndex` left out (`playback.ts:56-60, 95-103`).
  - Per-install `clientId` (18 random bytes, base64url, saved, as `desktop/main.js:47`); per-launch `sessionIdentifier` UUID.
  - Every `/api/playback/*` call carries `X-Media-Manager-Plex-Identity` from the device setting `plexIdentity` (default `desktop` until T25), plus `X-Media-Manager-Platform-Version: Build.VERSION.RELEASE` with `android`.
- **Plex address.** Port `desktop/lib/connection.js`: direct addresses first, at most 5 checks at once, 10 s timeout, `GET {origin}/identity` on the no-cookie client.
- **ExoPlayer.**
  - `DefaultRenderersFactory` with `EXTENSION_RENDERER_MODE_ON`; `OkHttpDataSource` on the no-cookie client.
  - `PlayerView(useController=false)` inside `AndroidView`, keeping its SurfaceView.
  - `VIDEO_CHANGE_FRAME_RATE_STRATEGY_ONLY_IF_SEAMLESS`; default `LoadControl`.
  - Pause in `onStop`. Keep the screen on only while playback the user started is playing (TV-BU, TV-BY; `tv-design-guidelines.md:208`).
- **Tracks.**
  - Audio: the audio group at the same position as Plex's `tracks.audio[i].index`.
  - Embedded subtitles: by the reply's `index`.
  - External subtitles: `SubtitleConfiguration`, address moved to the chosen origin (port `withOrigin`, `desktop/lib/player.js:99-113`), `id` = Plex `key`.
  - Saving a change calls `POST /api/playback/track`.
- **Subtitle size.**
  - Scale is one of 0.5, 0.75, 1, 1.25, 2.
  - With nothing saved, start from `CaptioningManager.getFontScale()` rounded to the nearest; a saved pick wins.
  - Applied with `SubtitleView.setFractionalTextSize(DEFAULT_TEXT_SIZE_FRACTION × scale)`: text cues only.
- **Seeking.** `seekBack()` −10 s and `seekForward()` +30 s (`model.ts:58-59`); `seekTo(target)` for scrubbing; all through ported `clampSeek` (`model.ts:72`).
- **Retry.**
  - Port `nextStep`/`planLabel` (`desktop/lib/retry.js:6-42`).
  - 401 counts as `unauthorized`, everything else as `failed`; `played` means the position moved.
  - Giving up exposes `failure{message, tried}`.
- **Reporting.**
  - Timeline every 10 s and on each change of state (port `model.ts:141-187`).
  - A ping every 30 s while a paused transcode waits (`Player.tsx:413`).
  - `POST /api/playback/stop` when not direct play; `POST /api/playback/played` at the end.
- **State and commands.** `StateFlow<PlayerState>` plus commands. Defines `data class PlayerRequest(ratingKey, partIndex, resume, offsetSeconds)`.
- **Tests:** retry rows matching the desktop retry tests (`tests/production.test.mjs` around 15194-15215), address choice, timeline query, track mapping, caption-scale rounding.
- **Kind:** new-code · **Depends on:** T05, T08
- **Model:** Opus 5.5, because it guards the transient-token boundary, and its retry and reporting logic decides what Plex marks as watched.
- **Effort:** high.
- **Verify:** `sh scripts/android-tv.sh test` green; `rg -n "X-Plex-Token" android-tv/app/src/main` shows only the redaction helper.

**T09b · Up Next, skip markers, quality labels**
- **Files:** new `…/tv/player/{UpNext.kt, Markers.kt, Quality.kt}`, with tests.
- **What:**
  - Port `upNextChoice`, `nextEpisode`, `queueNeighbours` (`model.ts:262-286`), `activeMarker` (`model.ts:292`), and `flagsFor`, `reloadAt`, `stepLabel`, `originalLabel`, `qualityLabel`, `triedText`, `formatLine` (`model.ts:309-357`).
  - Up Next order, as `Player.tsx:307-364`:
    1. the next episode;
    2. else wait for it while it downloads, with progress from T26 and `/api/library/series/:id` polled every 10 s (`Player.tsx:448-472`);
    3. else the play queue's next item;
    4. else the top of Continue Watching, leaving out the current show (`Player.tsx:679-699`);
    5. else close.
  - Waiting step labels from `Player.tsx:701-712`. Stop waiting returns to the library.
- **Kind:** new-code · **Depends on:** T08, T26
- **Model:** Sonnet 5.5, a one-to-one port. **Effort:** medium.
- **Verify:** rows copied from the desktop cases pass.

**T09c · Test player and device report (debug build only)**
- **Files:** `android-tv/app/src/debug/AndroidManifest.xml`, new `src/debug/java/…/DebugActivity.kt`.
- **What:**
  - Started with `adb shell am start -n io.github.aahh.mediamanager2.tv.debug/…DebugActivity --es address <origin> --es ratingKey <n> [--es identity android|desktop]`.
  - When signed out, shows the link code as plain text.
  - Plays through `PlaybackEngine` with Media3's stock controls (debug only).
  - Logs under tag `mm2-box`, with tokens redacted:
    - `SDK_INT`/`RELEASE`, `SUPPORTED_ABIS`;
    - `MediaCodecList` entries for `video/av01`, `video/hevc`, `video/dolby-vision` (with profiles), `audio/vnd.dts`, `audio/vnd.dts.hd`, `audio/true-hd`, `audio/eac3-joc`;
    - `AudioCapabilities` encodings and `CaptioningManager` font scale;
    - the identity used, the start reply's `decision`, and time from Play to first frame and from a seek to playing;
    - renderer names, dropped frames, rebuffers, and every 401 with time since start.
  - **Whatbox guard:** if the identity is `android` and a file of 2160 rows or more comes back neither direct play nor direct stream, stop at once and log it, so the slot never converts 4K.
- **Kind:** new-code · **Depends on:** T09a, T24
- **Model:** Sonnet 5.5. **Effort:** low.
- **Verify:** the build is green; the release APK has no `DebugActivity` (`apkanalyzer manifest print`).

**T10 · Update check and install (logic)**
- **Files:** new `…/tv/update/*`, with tests.
- **What:**
  - At launch, skipped when `BuildConfig.DEBUG`: `GET https://api.github.com/repos/aa-hh/media-manager-2/releases?per_page=30`.
  - Pick the highest versionCode from `^android-tv-v(\d+)$` tags that are not drafts or prereleases and have the asset. When newer than `BuildConfig.VERSION_CODE`, expose `UpdateState.Available`.
  - `install()`: without `canRequestPackageInstalls()`, open `ACTION_MANAGE_UNKNOWN_APP_SOURCES`. Otherwise download to `cacheDir/updates` and hand it to a `PackageInstaller` session. Android's signature check is the integrity check.
  - Tests: tag parsing, highest wins, skipping drafts, prereleases and missing assets, equal or older → no update.
- **Kind:** new-code · **Depends on:** T04
- **Model:** Sonnet 5.5. **Effort:** high, because the PackageInstaller flow is fiddly.
- **Verify:** tests green; on-box behaviour is B10.

**T11 · Web Settings: signed-in TVs**
- **Files:** `src/client/settings/Settings.tsx` (near the Appearance group, 375-394), plus whatever `/approve-design` creates, and `DESIGN.md`.
- **What:** Run `/approve-design` on the approved S4c Settings frame. Read `GET /api/devices`. Sign out is blocked while in flight; a 401 goes to `onUnauthenticated`.
- **Kind:** new-code · **Depends on:** T01, S4c
- **Model:** Opus 5.5, which the skill's handoff rule requires. **Effort:** medium.
- **Verify:** `sh scripts/test.sh --full` green, including the story accessibility check; library step 8 done after merge.

**T13a · TV theme, navigation, screen stubs**
- **Files:** `…/tv/ui/{Theme.kt, Navigation.kt}`, one stub file per FINAL frame in the screens file, and `MainActivity.kt`.
- **What:**
  - `Theme.kt` copies every dark token from `src/client/globals.css` into tv-material `darkColorScheme` plus a token object, same names in camelCase.
  - One route per FINAL frame. Each stub has its final signature.
  - Routing: no address → Address; no session → LinkCode; else Home. A later 401 → LinkCode.
  - No sign-out or address-change route.
  - Pop-ups use `androidx.compose.ui.window.Dialog`, because tv-material has no dialog (`tv-design-guidelines.md:187`).
  - Text entry uses `BasicTextField` with the keyboard set to URI input, because tv-material has no text field (`tv-design-guidelines.md:193`).
  - The update check runs at launch.
- **Kind:** new-code · **Depends on:** S4c, T12, T08
- **Model:** Opus 5.5, because every screen builds on it. **Effort:** high.
- **Verify:** build green; one route per FINAL frame.

**T13b · Shared TV components**
- **Files:** new `…/tv/ui/components/*`.
- **What:**
  - Through `/approve-design`'s TV path, build every `v2/TV/…` component that two or more approved FINAL frames use (S4a and S4b), with focus states.
  - Includes the card, which takes tv-material `Card`'s `onLongClick` to open the shared action list. Actions call the T23 routes and `POST /api/library/monitor`, each blocked while in flight.
- **Kind:** new-code · **Depends on:** T13a, S4a, S4b
- **Model:** Sonnet 5.5. **Effort:** high.
- **Verify:** previews compile; build green.

**T14 · First-launch address and link-code screens**
- **Files:** the `AddressScreen.kt` and `LinkCodeScreen.kt` stubs; new `…/tv/ui/signin/Planet.kt` and its shader source under `android-tv/app/src/main/assets/`.
- **What:** Build from S4c on T08. Show the frames' wording for `setup_required` ("Finish setup in a browser first."), `owner_only`, `flow_expired` and `rate_limited`.
  - The planet behind these screens is the desktop's, exactly (owner, 31 Oct): port `src/client/signInPlanet.ts` (WebGL 2 fragment shader, 3D noise texture) to OpenGL ES 3.0 in a `GLSurfaceView` or `TextureView` hosted in Compose, keeping its constants, palette, the `idle` / `checking` / `success` states with their targets, durations and delays, the 0.5 render scale and the 24 fps step while idle or checking. Idle on the address and code screens, checking while connecting or waiting for the code, success when signed in. When Android's animator duration scale is 0, draw one still frame (the desktop's reduced-motion path). Tint and layout follow the T03c frames.
- **Kind:** new-code · **Depends on:** T13a, T08
- **Model:** Opus 5.5 (raised from Sonnet for the shader port). **Effort:** medium.
- **Verify:** build green; checked in S6b.

**T19 · Update prompt**
- **Files:** the `UpdatePrompt.kt` stub.
- **What:** A centred `Dialog` at launch, after a newer release is found. Update now has initial focus; Later is second. Back or Later closes it until the next launch. Update now calls `install()` and shows the permission state.
- **Kind:** new-code · **Depends on:** T13a, T10
- **Model:** Sonnet 5.5. **Effort:** medium.
- **Verify:** build green; B10 and S6b.

**T15 · Player screen**
- **Files:** the `PlayerScreen.kt` stub and new `…/tv/ui/player/*`.
- **What:**
  - Every S4b frame, on T09a and T09b.
  - Remote: centre plays or pauses and shows the controls; left/right = `seekBack`/`seekForward`, keeping play or pause; holding left/right scrubs; up/down show information without pausing; the Play/Pause key toggles.
  - Controls hide after 2 s (`Player.tsx:727`); the skip button fades after 10 s (`Player.tsx:730`).
  - Quality menu: Original plus `qualitySteps`. Error screen with Retry. Up Next countdown, play, waiting and Stop waiting.
  - Back closes the player and reports stopped.
- **Kind:** new-code · **Depends on:** T13b, T09a, T09b, S4b
- **Model:** Sonnet 5.5. **Effort:** high.
- **Verify:** build and test green; S6b.

**T16 · Home/discover and library**
- **Files:** the stubs for those frames.
- **What:** From S4a on T08: Continue Watching and played marks from `/api/library/titles` `watch`; cards with the hold-OK action list; posters through Coil.
- **Kind:** new-code · **Depends on:** T13b, T08, T23
- **Model:** Sonnet 5.5. **Effort:** medium.
- **Verify:** build green; S6b.

**T17 · Search, title page and add**
- **Files:** the stubs for those frames.
- **What:**
  - From S4a.
  - Title-page action buttons after Play.
  - Monitored toggles on rows via `POST /api/library/monitor`.
  - Live per-season and per-episode progress from T26.
  - Add through `GET /api/add/options/:service` then `POST /api/add`, blocked while in flight.
  - Play/Resume navigates with `PlayerRequest`.
  - A hook is left at each Search automatically / Pick a release entry point, for T18.
- **Kind:** new-code · **Depends on:** T13b, T08, T09a, T23, T26
- **Model:** Opus 5.5. Adding starts real searches on private trackers.
- **Effort:** medium.
- **Verify:** build green; S6b.

**T18 · Automatic search, Pick a release, grabs**
- **Files:** the `ReleasesScreen.kt` stub and T17's hooks.
- **What:**
  - Automatic search: `POST /api/library/search`.
  - Pick a release: `GET /api/releases`, `POST /api/releases/refresh`, `POST /api/grabs`.
  - Every grab path is blocked while one is in flight; a grab that errors is never resent, and its outcome comes from `GET /api/grabs`.
  - Per-release state clears when the selection changes.
  - After a grab, the title page shows live progress through T26.
- **Kind:** new-code · **Depends on:** T17 (same files)
- **Model:** Opus 5.5, because a repeated grab costs ratio on private trackers.
- **Effort:** high.
- **Verify:** build green; S6b.

**T20 · Docs**
- **Files:** `PRODUCT.md` and `README.md` "Sign in" (around line 169).
- **What:**
  - `PRODUCT.md` Platform: web, Mac desktop app, Google TV app; plus one Users line on watching on the TV.
  - `README.md`: a TV paragraph and the Settings list.
- **Kind:** docs · **Depends on:** T01, T11
- **Model:** Haiku 5.5. **Effort:** low.
- **Verify:** the review passes.

**T22 · First install over ADB, device report, box-test record**
- **Files:** `docs/research/tv-apps-google-tv-and-apple-tv.md` (new section "Tests on the box"); `android-tv/app/build.gradle.kts` `abiFilters` if B2 trims the ABIs.
- **What:**
  - `adb pair`, then `adb connect`.
  - `adb install` release 1 downloaded from GitHub; `sh scripts/android-tv.sh install` the debug build.
  - Collect B1–B4 and B14 over adb and from the log; hand the rest to the owner as a checklist; record every result.
- **Kind:** docs · **Depends on:** S0, T07 merged, T09c, S3, deploys (SD) of T01 and T24; then S6a
- **Model:** Sonnet 5.5. **Effort:** low.
- **Verify:** every box test has a recorded result.

**T25 · Choose the TV's Plex identity from B15 (conditional)**
- **Files:** the `plexIdentity` default in `…/tv/player/PlaybackEngine.kt`.
- **What:**
  - Android counts as worse if, on any B15 file, it is less often direct play or direct stream, or it starts or seeks more slowly by more than 1 s on the median of three tries.
  - If Android is not worse, set the default to `android`. If it is worse, keep `desktop` and drop this task.
- **Kind:** new-code · **Depends on:** B15 recorded
- **Model:** Haiku 5.5. **Effort:** low.
- **Verify:** build green.

### Box tests

The owner checks on screen, except tests marked adb.

- **B1 (adb).** Android version and API level.
- **B2 (adb).** CPU ABIs. Drop `armeabi-v7a` if Android is 64-bit.
- **B3 (adb).** Decoders: AV1, Dolby Vision profiles, DTS, TrueHD.
- **B4 (adb).** Audio passthrough encodings through the owner's TV or amplifier.
- **B5.** Dolby Vision profiles 5 (Arrival), 7 (Hereditary), 8 (Bugonia) and 10 (Fantastic Four, AV1): does the TV show Dolby Vision?
- **B6.** DTS-HD and TrueHD play, and the log names the path taken.
- **B7.** 4K AV1 dropped frames.
- **B8.** Transient-token life: pause 2 h, 6 h and overnight, resume, then look for a 401 and a reload. Also open in `docs/research/in-app-player/README.md:35`.
- **B9.** Hereditary (76 Mbps) for 30 minutes: rebuffer count with the default buffer.
- **B10.** "Install unknown apps" is reachable for this app on the Streamer, and the update installs.
- **B11.** A 23.976 fps file switches the TV to 24p.
- **B12.** PGS, external SRT and ASS subtitles; subtitle size applies to text only.
- **B13.** Holding OK on the Streamer remote opens the card action list. If not, the title-page buttons still cover every action.
- **B14 (adb).** `settings get secure accessibility_captioning_font_scale` before and after changing the TV's caption size; the player's starting size follows it.
- **B15.** Android identity against Plex Desktop on the same files: Bugonia (4K DV P8, E-AC-3), Hereditary (4K P7 remux), Arrival (DTS-HD), Fantastic Four (AV1), plus one 1080p H.264 file. Three tries each with each identity, recording:
  - Plex's decision (direct play, direct stream or converting);
  - Play to first frame;
  - a 10-minute forward seek, until playing again;
  - Plex's dashboard label.
  The test player's Whatbox guard (in T09c) applies. The results feed T25.

## D. Parallel waves

| Wave | Runs at the same time | Notes |
|---|---|---|
| 0 | S0, T00 (once the plan is OK'd), T01, T03c, T06, T12, S1, S3 (any time) | No shared files. |
| 1 | T04 (after S1); T03b (after T03c); S2 (after T06); T23 (after T01); SD for T01 | |
| 2 | T05, T08, T10 (after T04); T03a (after T03b); T24 (after T23); SD for T23 | |
| 3 | T07 (after T05 + S2); T09a (after T05 + T08); T26 (after T08); T11 (after T01 + S4c); SD for T24 | |
| 4 | T09b (after T08 + T26); T09c (after T09a + T24); T13a (after S4c + T12 + T08) | |
| 5 | T22 + S6a (after S0, T07 merged, T09c, S3, SD); T14 (after T13a); T19 (after T13a + T10); T13b (after S4a + S4b) | |
| 6 | T15, T16, T17 (after T13b plus their own dependencies); T25 (after B15) | |
| 7 | T18 (after T17); T20 (after T01 + T11) | |
| 8 | S6b | |

Files that force tasks into a fixed order:
- `scripts/android-tv.sh`: T04 → T05 → T07.
- `android-tv/app/build.gradle.kts` and `libs.versions.toml`: T04 → T05 → T07 (T22 only if B2 trims the ABIs).
- `.github/workflows/tests.yml`: T04 → T05.
- `tests/production.test.mjs`, `src/server/app.ts`, `src/server/services/plexPlayback.ts`: T01 → T23 → T24.
- `…/ui/Navigation.kt`: T13a only.
- Title-page stub files: T17 → T18.
- `…/player/PlaybackEngine.kt`: T09a → T25.
- Root `AGENTS.md`: T04 only.
- The Figma screens file: T03c → T03b → T03a, one designer at a time.

Inside `player/`, T09a and T09b write different files and can run together.

**Critical path:** T03c → S4c → T03b → S4b → T03a → S4a → T13b → T17 → T18 → S6b. The build path, S1 → T04 → T05 → T09a → T09c → S6a, finishes well before it.

## E. recommended_execution

`agents`. The plan has about 30 tasks over eight waves, gated by owner stops, deploys and design approvals. Most tasks need judgment, and the owner will want to steer. Launch each wave's ready tasks as background agents, each in its own worktree, with the model above. The human gates rule out a deterministic `workflow` run.

## F. Tests, docs and registry impact

**Tests.**
- `tests/production.test.mjs` gains rows from T01, T23 and T24, including the desktop-identity regression row.
- New JVM unit tests under `android-tv/app/src/test/` (T08, T09a, T09b, T10, T26).
- New `scripts/test-guard-bash.sh`.
- No UI tests; layout and look are checked by eye.

**Docs.**
- Root `AGENTS.md`, new `android-tv/AGENTS.md`, `scripts/AGENTS.md`, `CLAUDE.md`.
- `PRODUCT.md`, `README.md`, `DESIGN.md` (TV section).
- `.claude/skills/approve-design/SKILL.md`, `docs/agents/issue-tracker.md`.
- The research note's box-test section.

**Registry and guards.** `.githooks/project.conf`, `scripts/review-branch.sh` path functions, `.claude/hooks/guard-bash.sh`.

**Data migration.** One `applicationMigrations` entry; existing rows stay web sessions.

**Linear.** One project, one epic, and sub-issues for: T01, T03a, T03b, T03c, T04, T05, T06 (with S2), T07, T08, T09a, T09b, T09c, T10, T11, T12, T13a, T13b, T14, T15, T16, T17, T18, T19, T20, T22, T23, T24, T25, T26.

## G. Risks to check during execution

- **Java 25.** The Android Studio JDK is 25.0.4. If the pinned Gradle or the Android build plugin refuses it, T04 stops and reports.
- **Android identity in Plex.** Plex may ship no Android profile, or one that converts more. The T24 stop rule, the test player's 4K guard and T25's fallback cover it.
- **Converting on Whatbox during B15.** Whatbox bans converting 4K HEVC. Only the guarded test player runs B15.
- **Plex Desktop on the TV** may approve direct play for a codec the box can't decode. The step-down path covers it; B3 and B5–B7 show how often.
- **Track mapping** assumes Plex's per-type order matches Media3's group order (true for MKV); checked in B6 and B12.
- **Buffer.** Media3's default buffer may be small for 76 Mbps remuxes (B9). A bigger buffer uses Java memory, so any change waits for measurements.
- **32-bit Android** is possible on a 64-bit chip; both ABIs stay until B2.
- **Unknown-apps setting.** Some Google TV builds hide "Install unknown apps" (B10). If the Streamer does, updates fall back to ADB.
- **http addresses** send the session cookie unencrypted (owner accepted, Q4).
- **Event streams.** The server allows 20 (`app.ts:73`); TV title pages open one each.
- **Mule rsync.** remote-run's rsync exclude list doesn't cover `android-tv/**/build` or `.gradle`. Use `AUDIOUT_REMOTE_LOCAL=1` for Android work.
- **Release key.** Its only readable copy is this Mac's Keychain (ADR 0007).
- **Session cap.** `MAX_SESSIONS = 100` (`auth.ts:34`) is shared by TVs and browsers.
- **Deploys.** The TV can't use T01, T23 or T24 until deployed (SD).
- **Main is moving.** Re-check cited lines at the start of each task.
- **Review rounds.** Commits after round 2 get no review status. Keep pull requests small.
