# media-manager-2

A power-user web app that puts Sonarr and Radarr behind one interface, will later let friends request movies and TV shows (as Seerr does), and watches their downloads closely enough to catch and fix the cases where they stall, report vague status, or fail to act.

## Language

**Sonarr**:
The external service that manages TV shows. media-manager-2 searches for, grabs and manages TV shows through it.
_Avoid_: Sear, the TV backend

**Radarr**:
The external service that manages movies. media-manager-2 searches for, grabs and manages movies through it.
_Avoid_: radar, the movie backend

**rTorrent**:
The download client that Sonarr and Radarr hand torrents to. It does the downloading; they only check on it. media-manager-2 reads torrent status from it directly.
_Avoid_: the downloader, the torrent client

**Monitored**:
Whether Sonarr or Radarr is watching for a movie or episode, searching for it and grabbing upgrades. Sonarr's and Radarr's own term.
_Avoid_: wanted, tracked, followed

**Release**:
One specific torrent an indexer offers for a movie or episode, before it is downloaded. Sonarr's and Radarr's own term.
_Avoid_: result, file, torrent (for something not yet grabbed)

**Grab**:
Sending a chosen release to rTorrent to download. Sonarr's and Radarr's own term. Normally done through Sonarr or Radarr; a grab for a second version goes from media-manager-2 to rTorrent directly.
_Avoid_: snatch, queue, download (as a verb for this step)

**Replace**:
The user's choice to swap the tracked version for a hand-picked release. Always carried out, even when Sonarr or Radarr would not count the release as an upgrade.
_Avoid_: upgrade (Sonarr's and Radarr's automatic replacement, which follows the quality profile), overwrite

**Manual download**:
A movie or episode whose tracked version the user chose by hand through a replace. Sonarr and Radarr must not upgrade over it; media-manager-2 labels it so.
_Avoid_: protected item, locked, pinned

**Import**:
Placing a finished download into the library folder. Sonarr's and Radarr's own term.
_Avoid_: move, copy, process

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
A started, unfinished torrent that has made no progress for long enough that media-manager-2 stops waiting on it and looks for another release. rTorrent has no such status; media-manager-2 decides it.
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
