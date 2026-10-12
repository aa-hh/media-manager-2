# 0005. Ask what a delete is for, not only what it deletes

Status: proposed

## Context

One Delete button covers different intents: free the space and never see the title again; keep the title listed but stop it downloading; get rid of this copy and find a better one. Sonarr and Radarr act differently afterwards for each, and getting it wrong is costly. A deleted file on a monitored item is searched for again. A removed title on an import list (a Plex watchlist, Trakt) is added back. A torrent removed before the tracker's hit and run rule is met is a penalty.

The delete flows so far offer: a movie removed or kept unmonitored; a show removed; one season unmonitored and its files deleted. There is no episode delete, no way to search again, no import-list exclusion (hard-coded off), and in-flight downloads for the title are not looked at, so they can import again after the delete. Sonarr monitors at four levels (show, season, episode, and `monitorNewItems` for seasons not yet added), and unmonitoring at the wrong level silently stops episodes that have not aired yet.

The owner's decisions of 11 Oct 2026 (in AA-103, Delete a season with its second versions) said "no per-episode delete in v1" and "deleting never adds an import-list exclusion". This ADR reopens both, at the owner's request of 12 Oct 2026.

## Decision

Every delete asks three things, each with a default: **what** (a movie, a show, or a chosen set of a show's seasons and episodes), **afterwards** (`remove`: gone from Sonarr or Radarr; `keepUnmonitored`: stays listed, files deleted, nothing searched; `searchAgain`: files deleted, stays monitored, a search starts, and optionally the current release is blocklisted), and **torrents** (each one kept seeding or removed, as today, with hit and run advice). `remove` is offered only for a whole title. `remove` adds an opt-in "don't let import lists add it back" (the exclusion), shown only when that service has an import list. Downloads in the queue for what is being deleted are listed, and the owner chooses to leave or remove each one; a removal always sends `skipRedownload`.

Wanting another copy *beside* the current one is not a delete. That stays in Pick a release (Replace or second version).

Monitoring follows the smallest scope deleted. Deleting episodes unmonitors only those episodes, and their season stays monitored. Deleting a whole season unmonitors the season too. When the selection holds a season with episodes not yet aired, the owner must answer whether to keep following it; there is no default. When a delete would leave a show with no files and nothing monitored, the dialog offers to remove the show instead. `keepUnmonitored` on a whole show also stops new seasons (`monitorNewItems` none). After the delete, the server reads monitoring back from Sonarr and the result shows it, so the owner never has to trust that it worked.

A torrent that still holds a file outside what is being deleted (a season pack, a full-series pack) is never offered for removal, as before.

Out of scope: removing a torrent automatically once its hit and run rule is met (owner, 12 Oct 2026: not now); Plex watched state; recycle-bin emptying.

## Consequences

The owner can say what they mean, and the result proves what Sonarr or Radarr will do next. The delete request gains fields (`mode` on every target, the exclusion flag, the blocklist flag, queue choices, the airing-season answer), so client and server change together through one contract (`docs/handover-2026-10-12-delete-intent-frontend.md`). `searchAgain` must clear media-manager-2's own manual-download protection, or the search may refuse its own replacement. Episode delete makes pack torrents common, so most torrent rows in an episode delete are locked with a reason. A whole season stays the only way to unmonitor a season; there is no "unmonitor season, keep files" in the delete dialog, because that is the monitored toggle's job.
