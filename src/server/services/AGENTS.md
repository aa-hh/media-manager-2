# src/server/services

## Purpose

HTTP clients for every outside service. Plex sign-in (`auth.ts`), .torrent downloads (`secondVersions.ts`) and TMDB images (`titles.ts`) request from elsewhere, capped the same way. No business decisions; writes only its own settings.

## Rules

- Every request goes through `requestWithTimeout`: its timeout covers the body, and it refuses redirects so a key never reaches another host.
- Classify a non-2xx answer before parsing, or an error page reads as data.
- A queue removal sends `skipRedownload` true unless a search is wanted, or Sonarr and Radarr search again on their own.
- A forced import is copy with hardlinks only and refuses when hardlinks are off, so seeding never ends (`docs/adr/0002-force-every-import-by-copy-with-hardlinks.md`).
- API keys go in headers. TMDB and MDBList keys must sit in the URL, so that URL never reaches an error message.
- Tracker replies are size-capped and only numbers kept, since some carry the passkey.
- rTorrent hashes are uppercase; uppercase download ids to compare. `RtorrentFault` means refused; unreachable means rTorrent may have acted.
- `Result` keeps `not_found` apart from refusals and outages, so callers treat a missing item as gone.
- `tests/fakes/arr.mjs` must match the real API. Known gap: omitting `removeFromClient` erases the torrent for real, not in the fake.

## Map

- `arr.ts` → Sonarr and Radarr client.
- `arr/result.ts` → result type, answer classes.
- `arr/commands.ts` → searches, refreshes, forced imports.
- `arr/queue.ts` → queue.
- `arr/history.ts` → history.
- `arr/series.ts` → series.
- `arr/episodes.ts` → episodes.
- `arr/movies.ts` → movies.
- `arr/files.ts` → file details.
- `connection.ts` → timeout helper, settings.
- `rtorrent.ts` → rTorrent client.
- `mediaServer.ts` → owner's provider picks `plex.ts` or `jellyfin.ts`.
- `tmdb.ts` → TMDB client.
- `mdblist.ts`, `fanart.ts` → MDBList and fanart.tv clients.
- `trackerAccounts.ts` → tracker accounts.
- `s3.ts` → S3 backup client.
