# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript on Node.js. One Hono server runs the background jobs and serves a React single-page app built with Vite. SQLite database, continuously copied to Cloudflare R2. Live torrent status reaches the browser through server-sent events. Decided in Linear: [Choose the technology](https://linear.app/aa-hh/issue/AA-14).

Undecided: the component library. Waits on the first prototype ([Choose the design library](https://linear.app/aa-hh/issue/AA-15)); pen.dev's built-in kits and code rules favour Tailwind, and shadcn/ui fits best if an open-source library is chosen.

## Users

One user in the first version: the owner, a power user who runs Sonarr, Radarr, rTorrent and Plex on a Whatbox seedbox and downloads from private trackers. Mostly at a desktop browser searching, picking releases and managing files; on a phone to check status and make quick grabs, for example while travelling.

Friends who request movies and TV shows are a planned later audience (v2), not a first-version user.

## Product Purpose

media-manager-2 puts Sonarr and Radarr behind one interface and makes them behave the way the owner expects. It lets the owner search movies and TV shows, pick the exact release, and choose to replace the tracked version or keep a second version. It watches every download live from rTorrent and fixes searches that never ran and torrents that stalled, on its own.

Success: the owner trusts that what they asked for will arrive, at the quality they picked, without babysitting Sonarr, Radarr or rTorrent, and without ever getting a hit and run.

## Positioning

Sonarr and Radarr only see rTorrent through a slow, vague summary, never retry a stalled torrent, never search for missing items on a timer, and track one file per movie or episode. media-manager-2 reads rTorrent directly, knows each private tracker's hit and run rules, honours the owner's hand-picked choices over automatic upgrades, and manages extra versions alongside the ones Sonarr and Radarr track.

## Operating Context

- Runs on the same Whatbox machine as rTorrent and the library folder, reached at the owner's own domain through Cloudflare. Plex sign-in, limited to the owner's account.
- Talks to Sonarr, Radarr, rTorrent, Plex and three private trackers (Beyond-HD, PrivateHD, Blutopia).
- Torrents must keep seeding to satisfy each tracker's hit and run rules; files reach the library folder as hardlinks.
- The v1 tool (https://github.com/aa-hh/media-manager) is retired; its code is a source to copy from, not a reference for this product's design.

## Capabilities and Constraints

First version, as agreed on the Linear map ([Map: first version of media-manager-2](https://linear.app/aa-hh/issue/AA-5)):

1. Search movies and TV shows, routed to Radarr or Sonarr.
2. List releases and grab one by hand; for something already in the library, choose replace or second version.
3. A replace always goes through, even when not an upgrade. Replaced items are labelled "manual download" and must not be upgraded over.
4. Second versions are grabbed, imported, tracked and deleted by media-manager-2.
5. On delete, ask whether to also remove the torrent, recommending an answer from the tracker's hit and run rules.
6. Live torrent status from rTorrent.
7. Automatic fixes for missed searches, stalled torrents, tracker problems and blocked imports; anything it gives up on is flagged.
8. Health checks for Sonarr, Radarr, rTorrent, Plex, each tracker account and its own housekeeping.
9. A view-only calendar of upcoming monitored episodes and movies.
10. Flags and warnings appear in the app only: a flagged page, a history on each movie and episode, and a global activity log.

Images and descriptions come only from Sonarr and Radarr: one poster and one backdrop per title, plus season posters and episode images.

Terminology: use the words in `CONTEXT.md` exactly. "Release" always means a torrent, never a release date.

Out of the first version: friend requests, playback statistics, deletion score, scheduled deletion, storage forecasting, calendar actions, phone notifications, and configuration for other people's setups.

## Brand Commitments

Name: media-manager-2. No logo or other brand assets exist yet.

## Evidence on Hand

None. There are no screenshots, users, testimonials or data to show; future work must not invent any.

## Product Principles

1. The owner's choice wins. A hand-picked release or replace is carried out, and automation never quietly undoes it.
2. Never risk a hit and run. When in doubt, keep seeding.
3. Show the real state, live. Status comes from rTorrent itself, not a stale summary.
4. Fix it, then tell. Automation handles routine failures on its own and records what it did; only what it can't fix asks for attention.
5. Power over hand-holding. Dense, precise information for someone who knows Sonarr, Radarr and torrents.

## Accessibility & Inclusion

Keyboard-first: every action reachable and fast from the keyboard. No other product-specific requirement.
