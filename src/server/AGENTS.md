# src/server

## Purpose

Routes, background jobs and the SQLite database that act on Sonarr, Radarr, rTorrent, Plex and TMDB through the clients in `services/`. Never move or delete a file a seeding torrent still uses.

## Rules

- Imports and relinks only hardlink, and forced imports go through `forceImport`, which refuses when hardlinks are off; moving a file ends seeding.
- Delete torrent data only through `removeTorrent`, which checks nothing kept shares it.
- Queue removals pass skipRedownload, or Sonarr and Radarr search again themselves.
- Stalled means started and unfinished; never replace or regrab a finished torrent.
- Interactive searches and grabs outlast the default request timeout, and a grab that throws may still have grabbed; settle it from history, never resend.
- An accepted ManualImport is only queued; resolve its problem once the download leaves the queue.
- Only `protection.ts` writes `protected_items`. Protect a replace before marking it completed, since nothing revisits a completed one.
- No job holds a transaction across an await, because backups snapshot this connection.

## Map

- `index.ts`, `app.ts`, `cli.ts`, `auth.ts`, `events.ts`, `jobs.ts` -> startup, routes, command line, sign-in, event stream, jobs.
- `database.ts`, `settings.ts`, `preferences.ts`, `dependencies.ts`, `backup.ts`, `backupDestination.ts` -> storage and backups.
- `setup.ts`, `connections.ts`, `trackerSettings.ts` -> setup and settings routes.
- `grabs.ts`, `replace.ts`, `protection.ts`, `releases.ts`, `releaseDetails.ts`, `searches.ts` -> searching, grabbing, replace, protection.
- `torrents.ts`, `torrentGrabs.ts`, `torrentFiles.ts`, `stalls.ts`, `trackers.ts`, `relink.ts` -> rTorrent poll, stall and tracker fixes, torrent removal.
- `imports.ts`, `manualImport.ts`, `assignments.ts` -> blocked imports, import by hand.
- `secondVersions.ts`, `versionImport.ts`, `secondVersionRows.ts`, `secondVersionDelete.ts` -> second versions.
- `titleDelete.ts`, `advice.ts`, `trackerRules.ts`, `health.ts` -> title delete, removal advice, hit and run, health.
- `problems.ts`, `flagged.ts`, `blocklist.ts`, `history.ts`, `api.ts` -> problems, blocklist, History, queue actions.
- `library.ts`, `owned.ts`, `add.ts`, `search.ts`, `labels.ts`, `titles.ts`, `titleStore.ts`, `tmdbTitles.ts`, `discover.ts` -> library, adding, lookup, TMDB, Discover.
