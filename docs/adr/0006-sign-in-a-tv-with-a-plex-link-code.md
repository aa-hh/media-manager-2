# 0006. Sign in a TV with a Plex link code and the web session

Status: accepted

## Context

The Android TV app for the Google TV Streamer (owner's decision, 31 Oct 2026; research in `docs/research/tv-apps-google-tv-and-apple-tv.md`) needs to sign in. The web sign-in sends the browser to `app.plex.tv/auth` with a strong Plex PIN (`src/server/auth.ts`). A TV has no browser to send, and the owner signs in to Plex with Google, which Google blocks inside embedded web pages.

Web sessions are random tokens whose hash is stored in the `sessions` table, sent as the `mm_session` cookie and valid for 24 hours (`SESSION_LIFETIME_MS`, `src/server/auth.ts`). Private writes must carry the app's `Origin`, `X-Requested-With: media-manager-2` and JSON (`requireBrowserPost`, `src/server/app.ts`). A native app can send all of these headers itself.

The Plex account token from sign-in is kept only in memory and only for setup's Plex step. Playback uses short-lived `transient-` tokens the server asks Plex for, so a TV never needs the account token.

## Decision

The TV asks the server to start a sign-in. The server creates a plain (not strong) Plex PIN, whose 4-character code the TV shows with the words "go to plex.tv/link". The TV polls the server, and the server polls Plex. When the code is linked, the server runs the same owner check as the web sign-in and creates an ordinary row in `sessions`, marked with the device's name and a 90-day life that renews on each use. The TV keeps the session as the same cookie a browser gets and sends the browser headers on writes, so every existing route works unchanged. Web sessions stay at 24 hours. Settings in the web app lists signed-in TVs with a Sign out button for each.

The TV asks for the server's address once, at first launch, as the desktop app does.

## Consequences

The server gains a start-and-poll pair of routes for the link code, a device name and lifetime per session row, and a list-and-revoke pair for Settings. No route learns a second way to check sign-in. A stolen TV session lasts up to 90 days unless signed out from Settings, against 24 hours for a browser. The link-code flow trusts plex.tv to bind the code to the owner's account, as the web flow trusts `app.plex.tv/auth`; it has no device-key binding like the strong PIN, so the 4-character code must be used within Plex's own expiry window.
