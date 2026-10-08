# How to read live torrent status from rTorrent (AA-7)

Researched 2026-10-08 for Linear issue AA-7.

## Answer

Talk to rTorrent directly over XML-RPC (a remote procedure call protocol that sends XML over HTTP). On Whatbox the endpoint is `https://server.whatbox.ca:443/xmlrpc` with the Whatbox username and password. Read every torrent in one `d.multicall2` call on the `main` view, every 30 to 60 seconds. Match each torrent to its movie or episode by its info hash, which Sonarr and Radarr store as `downloadId` on queue and history items. Compare hashes case-insensitively.

ruTorrent's own JSON endpoint (`plugins/httprpc/action.php`) is a second option, but it is a plugin that may not be installed, and it uses the old `d.get_*` command names. v1 did not use it: v1 sent plain XML-RPC to `/xmlrpc` or `/RPC2`.

## Ways to reach rTorrent

| Option | What it is | Fit |
|---|---|---|
| XML-RPC over HTTPS, `/xmlrpc` | Web server on the seedbox forwards XML-RPC to rTorrent's SCGI socket (SCGI is a simple protocol between a web server and a program) | Use this. Whatbox documents it and Sonarr and Radarr already use it |
| SCGI Unix socket directly | Talk to rTorrent's socket file without the web server | Only works from a process on the same machine. Whatbox does not publish the socket path (unconfirmed) |
| ruTorrent `plugins/httprpc/action.php?mode=list` | ruTorrent plugin that returns a JSON list and only the changes since the last call | Depends on ruTorrent and a plugin; adds a layer for no gain |

Sources:
- Whatbox lists protocol HTTPS, host `server.whatbox.ca`, port 443, mountpoint `/xmlrpc`, username and password (percent-encode the password in a URL): https://whatbox.ca/wiki/Using_XMLRPC_with_Python
- Whatbox: "network.scgi.open_local must not be changed, in order for ruTorrent (and wTorrent) to work." https://whatbox.ca/wiki/Editing_rtorrentrc
- Whatbox's Sonarr guide only asks for the Whatbox password and leaves other rTorrent settings at their defaults: https://whatbox.ca/wiki/Sonarr
- Whatbox's cross-seed and Readarr guides use the same host, port 443 and path `xmlrpc` (search result summaries, pages not opened): https://whatbox.ca/wiki/cross-seed, https://whatbox.ca/wiki/readarr
- `network.scgi.open_port` and `network.scgi.open_local` open a TCP port or a Unix socket "for SCGI communication (i.e. the XMLRPC socket)": https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html
- rTorrent's own wiki prefers a Unix socket, says any local user can use an open TCP port, and shows web server setups that forward `/RPC2`: https://github.com/rakshasa/rtorrent/wiki/RPC-Setup-XMLRPC
- ruTorrent `mode=list` asks rTorrent for 36 `d.get_*` fields on the `main` view and returns `{"t": {hash: [values]}, "cid": ..., "full": 1}`, sending only changes when the client passes back its `cid`: https://github.com/Novik/ruTorrent/blob/master/plugins/httprpc/action.php
- v1 sends `system.multicall` (many single calls bundled into one request) with 10 fields per known hash, trying `/xmlrpc` then `/RPC2`: v1 `scripts/lib/collectors/rutorrent.py` lines 15 to 75

## Fields

All from https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html unless noted.

| Need | Command | Notes |
|---|---|---|
| Identity | `d.hash` | Info hash in hexadecimal, uppercase letters |
| Name, label | `d.name`, `d.custom1` | `d.custom1` holds the label Sonarr and Radarr set (their "category") |
| Progress | `d.completed_bytes`, `d.left_bytes`, `d.size_bytes` | Progress = completed / size. `d.complete` is 1 at 100% |
| Speed | `d.down.rate`, `d.up.rate` | Current bytes per second |
| Started, paused, stopped | `d.state`, `d.is_open`, `d.is_active` | state 1 = started or paused, 0 = stopped. Paused = open but not active |
| Checking files | `d.hashing`, `d.is_hash_checking` | `d.hashing` is 0 to 3 |
| Errors | `d.message` | Tracker communication errors and hash check failures |
| Tracker errors in detail | `t.multicall` with `t.url`, `t.is_enabled` | Per tracker of one torrent |
| Peers | `d.peers_connected`, `d.peers_complete` | Docs mark both "TODO"; ruTorrent reads them (`action.php` above) |
| Seed time | `d.timestamp.finished` | 0 until the torrent finishes. v1 counts seed hours from it |
| Ratio | `d.ratio` | Upload to download ratio times 1000 |
| Last state change | `d.state_changed` | Changes on pause and resume too |

Stalled state: rTorrent has no "stalled" field. Sonarr's rTorrent client does not detect it either: it sets only Completed, Downloading or Paused from `IsFinished` and `IsActive` (https://github.com/Sonarr/Sonarr/blob/develop/src/NzbDrone.Core/Download/Clients/rTorrent/RTorrent.cs). media-manager-2 has to derive it, for example: started, not complete, `d.down.rate` 0 for N minutes, or `d.peers_connected` 0, or `d.message` not empty. The threshold is a design choice, not a documented value.

Sonarr's own request is a useful minimum: `d.multicall2` with `""`, `""` then `d.name=`, `d.hash=`, `d.base_path=`, `d.custom1=`, `d.size_bytes=`, `d.left_bytes=`, `d.down.rate=`, `d.ratio=`, `d.is_open=`, `d.is_active=`, `d.complete=`, `d.timestamp.finished=` (https://github.com/Sonarr/Sonarr/blob/develop/src/NzbDrone.Core/Download/Clients/rTorrent/RTorrentProxy.cs).

## How often to read

- Sonarr checks its download clients every 1 minute (`RefreshMonitoredDownloadsCommand`, `Interval = 1`): https://github.com/Sonarr/Sonarr/blob/develop/src/NzbDrone.Core/Jobs/TaskManager.cs
- ruTorrent's web page refreshes its list every 2.5 seconds by default (`"webui.update_interval": 2500`) while the page is open: https://github.com/Novik/ruTorrent/blob/master/js/webui.js
- One `d.multicall2` call returns every torrent in one round trip. For many torrents with many fields, `network.xmlrpc.size_limit` must be large enough for the whole reply (cmd-ref above). Whatbox's default limit is unconfirmed.
- Neither rTorrent's docs nor Whatbox's wiki give a polling limit or say how rTorrent schedules RPC work (unconfirmed).

Suggested: one `d.multicall2` every 30 to 60 seconds in the background, and every 5 seconds only while the user has a download screen open. That is far lighter than ruTorrent's 2.5 second default (whether Whatbox changes that default is unconfirmed).

## Matching a torrent to its movie or episode

- Sonarr and Radarr set a queue item's `downloadId` to rTorrent's `d.hash`: `item.DownloadId = torrent.Hash;` (RTorrent.cs above).
- Sonarr queue items carry `downloadId`, `seriesId`, `episodeId`, `status`, `trackedDownloadState`, `errorMessage`: https://github.com/Sonarr/Sonarr/blob/develop/src/Sonarr.Api.V3/Queue/QueueResource.cs
- Radarr queue items carry `downloadId`, `movieId`, `status`, `trackedDownloadState`, `errorMessage`: https://github.com/Radarr/Radarr/blob/develop/src/Radarr.Api.V3/Queue/QueueResource.cs
- History records keep `downloadId` after the queue item is gone (Sonarr: `downloadId`, `eventType`, `seriesId`, `episodeId`): https://github.com/Sonarr/Sonarr/blob/develop/src/Sonarr.Api.V3/History/HistoryResource.cs
- `GET /api/v3/history?downloadId=<hash>` filters history by hash in both apps: https://github.com/Sonarr/Sonarr/blob/develop/src/Sonarr.Api.V3/History/HistoryController.cs, https://github.com/Radarr/Radarr/blob/develop/src/Radarr.Api.V3/History/HistoryController.cs
- Case: rTorrent returns uppercase. Sonarr lowercases the hash when it relabels a torrent after import (`DownloadId.ToLower()` in RTorrent.cs), and history from other download clients may differ. Compare in one case (unconfirmed which case Sonarr stores in history; normalising both sides avoids the question).
- Second versions are grabbed by media-manager-2 straight to rTorrent, so Sonarr and Radarr never see them. media-manager-2 must store the hash itself at grab time.

## Unconfirmed

- Path of Whatbox's SCGI Unix socket, and whether a process on the box may use it.
- Whatbox's `network.xmlrpc.size_limit` value.
- Any Whatbox limit on XML-RPC request rate.
- How rTorrent schedules RPC requests against its download work.
