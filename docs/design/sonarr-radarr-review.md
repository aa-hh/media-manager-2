# Sonarr and Radarr interface review: decisions

The owner went through Sonarr's and Radarr's screens (read from their frontend source, Sonarr v4.0.20 and Radarr v6.4.4) and decided what media-manager-2 keeps, changes or drops. Prototype: `design/mediaManager2.pen`. Linear: [Prototype search, release list and replace-or-second-version](https://linear.app/aa-hh/issue/AA-16).

## Across every screen

- Sonarr and Radarr hide much of their status behind hover and click. media-manager-2 shows it inline, as words.
- They reuse colours across meanings (purple is downloading in one place and 50+ seeders in another). media-manager-2 gives each colour one meaning: purple best on the board, green better than your file, yellow not better than your file, red any risk (hit and run risk, 0 seeders, tracker cooldown).
- Opening a movie or show lands on its overview. Picking a release by hand (Sonarr's and Radarr's Interactive Search) is a detail view that opens on the last cached results with their age; a fresh search (about 20 seconds) runs only on request.

## Added to the first version

Library list; monitoring controls for show, season and episode (keyboard range select); missing and below-cutoff lists; a global history page; mark a past grab as failed, and a blocklist page; manual import; override which movie, episode or quality a release counts as before grabbing it; releases held back by delay profiles shown in live downloads.

## Per screen

**Library list.** Poster grid. Keep: episode progress ("8 + 2 / 10": files, plus downloading, out of total), a totals footer (shows, movies, episodes, files, size), a column picker. Leave bulk select and edit for later.

**Search.** One box for movies and TV; also accepts IMDb, TMDB and TVDB ids. Adding a title is one key with saved defaults; a second key opens the options.

**TV show overview.** Actions, each on a key: search monitored episodes automatically, history, series monitoring options, edit, delete (with hit and run advice for its torrents), refresh and rescan, rename. Header shows size on disk (and per season), continuing or ended, network and language, path, tags and links. Episode rows mark finale and premiere, repack and proper, and scene numbering mismatch. `[` and `]` jump to the previous and next show. Second versions sit under their episode.

**Movie overview.** Header shows one rating, certification and genres, studio and collection. One status word (queued, downloaded, missing, not available, deleted), driven by live rTorrent state. The versions list shows quality, size, group, HDR, audio, languages, custom format score and formats, and seeding against the hit and run rule.

**Episode details.** Expand inline on Enter: versions, history (with mark as failed), search buttons. Esc closes. No modal.

**Pick a release.** Profile column: meets Sonarr's or Radarr's quality profile (with custom format score) or the rejection reason, inline. Seeder count as a number, red at 0. Extra columns: freeleech and indexer flags, release history (grabbed before, failed, blocklisted). Grab errors follow Sonarr: red button, error on hover. This is the one hover-only status the owner chose; the finish review should check it.

**Live downloads.** Extra columns: ratio, custom formats and score. Remove offers Sonarr's choices (remove from rTorrent or not; blocklist, blocklist and search, or don't) plus media-manager-2's hit and run advice. The same live progress shows on episodes, seasons, movies and the calendar.

**History.** Each event in words, automatic-fix events mixed in; Enter expands a row to its details (tracker, group, score, how it was found, deletion reason, paths). Fixed columns, quick filters.

**Missing and below cutoff.** Filters on the flagged page, each with when it was last searched. Manual downloads never appear as below cutoff.

**Calendar.** Week, month and forecast (a rolling few days) views. States as words, colour only where the colour rules give it a meaning. Several episodes of one show on one day collapse into one entry.

**Health.** One list merging Sonarr's, Radarr's and media-manager-2's checks, each labelled by source, with wiki link and test button. Health badge in the top bar, marked by the worst problem. Disk free space per drive.
