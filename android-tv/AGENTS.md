# android-tv

## Purpose

The Google TV app: Kotlin, Compose for TV and Media3, one Gradle module (`app`). It signs in to our server with a Plex link code, browses and adds titles, and plays video straight from Plex. The plan is `docs/plans/android-tv-app-plan.md`.

## Rules

- Build, test and install only through `scripts/android-tv.sh`; the hook denies bare `gradle` and `gradlew`.
- The Plex client (the player's data source) is a separate OkHttpClient with no cookie jar, so our session cookie never reaches Plex.
- No token appears in a log: replace every `X-Plex-Token` value with `***` before logging.
- Stream addresses come only from `POST /api/playback/start`; never build a Plex address yourself.
- Every non-GET request to our server carries `Origin`, `X-Requested-With: media-manager-2` and `Content-Type: application/json`, as a browser would.
- A grab is blocked while one is in flight and is never resent. A grab that errors is settled from history, because the server may have sent it anyway.
- Downloads follow `src/client/AGENTS.md`: the event stream reopens after it closes for good, and events arriving while a snapshot loads are not applied to the old snapshot.
- The release key never enters the repo. Debug builds (`.debug` suffix, versionCode 1) never check for updates.
- Screens come only from approved FINAL frames in the Figma screens file. Dark theme only. Use `androidx.tv:tv-material`, never phone Material 3 or `media3-ui-compose-material3`.

## Map

- `app/build.gradle.kts` → app id, SDK levels, ABIs, dependencies.
- `gradle/libs.versions.toml` → every dependency version.
- `app/src/main/java/io/github/aahh/mediamanager2/tv/` → `MainActivity`; `api/`, `downloads/`, `player/`, `update/` and `ui/` as later tasks add them.
- `app/src/main/res/xml/network_security_config.xml` → allows http server addresses, as desktop does.
