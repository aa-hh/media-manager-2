# media-manager-2

A power-user web app for discovering, downloading and managing media in one place. It puts Sonarr and Radarr behind one interface, will later let friends request movies and TV shows (as Seerr does), and watches their downloads closely enough to catch and fix the cases where they stall, report vague status, or fail to act.

## Language

**Sonarr**:
The external service that manages TV shows. media-manager-2 searches for, grabs and manages TV shows through it.
_Avoid_: Sear, the TV backend

**Radarr**:
The external service that manages movies. media-manager-2 searches for, grabs and manages movies through it.
_Avoid_: radar, the movie backend

**Series**:
One TV show as Sonarr holds it, with its seasons, episodes and files. Sonarr's own term; "show" is fine in words to the user.
_Avoid_: programme

**Movie**:
One film as Radarr holds it, with the one file it tracks. Radarr's own term.
_Avoid_: film

**Episode**:
One episode of a series as Sonarr holds it, with whether it is monitored and has a file. Sonarr's own term.
_Avoid_: ep, installment

**rTorrent**:
The download client that Sonarr and Radarr hand torrents to. It does the downloading; they only check on it. media-manager-2 reads torrent status from it directly.
_Avoid_: the downloader, the torrent client

**Monitored**:
Whether Sonarr or Radarr is watching for a movie or episode, searching for it and grabbing upgrades. Sonarr's and Radarr's own term.
_Avoid_: wanted, tracked, followed

**Automatic search**:
Asking Sonarr or Radarr to search every tracker for a movie or episode and grab the best release that meets its quality profile. The usual way things get downloaded. Sonarr's and Radarr's own term; the app's button says "Search automatically".
_Avoid_: quick search, auto-grab

**Interactive search**:
Searching every tracker for a movie or episode and listing all releases so the user picks one by hand. Slow (about 20 seconds), so media-manager-2 shows the last results first. Sonarr's and Radarr's own term; the app's screen is called "Pick a release".
_Avoid_: manual search, release search

**Release**:
One specific torrent an indexer offers for a movie or episode, before it is downloaded. Sonarr's and Radarr's own term.
_Avoid_: result, file, torrent (for something not yet grabbed)

**Grab**:
Sending a chosen release to rTorrent to download. Sonarr's and Radarr's own term. Normally done through Sonarr or Radarr; a grab for a second version goes from media-manager-2 to rTorrent directly.
_Avoid_: snatch, queue, download (as a verb for this step)

**Queue**:
The downloads Sonarr or Radarr is tracking in rTorrent, from grab until import or removal. Sonarr's and Radarr's own term; media-manager-2 keeps its own copy and reads that between checks.
_Avoid_: active downloads, in-progress list, download list

**Blocklist**:
The releases Sonarr or Radarr will never grab again, each with why and when it was added. Sonarr's and Radarr's own term.
_Avoid_: blacklist, banned releases, ignore list

**Replace**:
The user's choice to swap the tracked version for a hand-picked release. Always carried out, even when Sonarr or Radarr would not count the release as an upgrade.
_Avoid_: upgrade (Sonarr's and Radarr's automatic replacement, which follows the quality profile), overwrite

**Manual download**:
A movie or episode whose tracked version the user chose by hand through a replace. Sonarr and Radarr must not upgrade over it; media-manager-2 labels it so.
_Avoid_: protected item, locked, pinned

**Import**:
Placing a finished download into the library folder. Sonarr's and Radarr's own term.
_Avoid_: move, copy, process

**History**:
Sonarr's or Radarr's own record of what happened to each movie or episode: grabs, imports, failures, deletions and renames. Separate from the problems media-manager-2 records itself.
_Avoid_: event log, activity, timeline

**Library folder**:
The final folder Plex reads from. A movie or episode may have several versions in it; an upgrade replaces only the version Sonarr or Radarr tracks.
_Avoid_: media folder, final directory

**Version**:
One file of a movie or episode in the library folder, at a particular quality. Plex shows all of them as one title and lets the viewer pick. Sonarr and Radarr track only one version each; media-manager-2 grabs, imports, tracks and deletes the rest. A second version stays until the user deletes it. When grabbing a release for something already in the library, the user chooses whether it replaces the tracked version or becomes a second version.
_Avoid_: copy, edition, duplicate

**Seeding**:
rTorrent continuing to upload a finished torrent. Required by the private trackers in use, so a torrent's downloaded files are never deleted when its library copy is replaced. When the user deletes a version, media-manager-2 asks whether to also remove its torrent, recommending an answer based on whether the tracker's hit and run rules are met.
_Avoid_: sharing

**Stalled**:
A started, unfinished torrent that has made no progress for long enough that media-manager-2 stops waiting on it and looks for another release. A stalled second version is never regrabbed: it is removed if nothing downloaded, and flagged to the user either way. rTorrent has no such status; media-manager-2 decides it.
_Avoid_: stuck, dead, hung

**Tracker**:
A private torrent site that a release comes from, with its own hit and run rules.
_Avoid_: indexer (the search source Sonarr and Radarr query, which may or may not be the same site), site

**Hit and run**:
A tracker's rule for how long, or up to what upload-to-download ratio, a single torrent must seed before it can be removed without penalty. Each tracker sets its own: a fixed seed time, a time that grows with file size, a ratio, or a combination. Used for both the rule and breaking it.
_Avoid_: seeding requirement, seed rule, ratio rule

**Global ratio**:
The user's total upload-to-download ratio across a whole tracker account. Each tracker sets a minimum; it is separate from any single torrent's hit and run rule.
_Avoid_: account ratio, overall ratio

**Site software**:
The tracker software a tracker's site runs (UNIT3D, Gazelle, NexusPHP, or other). It decides how media-manager-2 reads the tracker account; trackers running the same software share one way in.
_Avoid_: tracker type, platform, engine

**Plex**:
The media server that plays the library folder to the user and friends.
_Avoid_: the player, the server

**Tautulli**:
The external service that records detailed playback statistics for Plex.
_Avoid_: stats service

**Playback statistics**:
Who has watched which movie or episode, when, how often, and how far through a show they are. Read from Plex and Tautulli.
_Avoid_: watch history, viewing data, plays

**Request**:
A friend's ask for a specific movie or TV show to be added to the library.
_Avoid_: ticket, order, submission
