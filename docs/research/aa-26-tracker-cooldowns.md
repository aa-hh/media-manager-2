# How to tell a tracker has the owner on a cooldown

Linear: [AA-26](https://linear.app/aa-hh/issue/AA-26). Researched 2026-10-08 without signing in to any tracker.

"Cooldown" here means the tracker has taken away the owner's right to download new torrents for a while, usually after hit and run warnings or a low global ratio.

## Answer

No tracker API checked here says "your downloads are blocked". media-manager-2 has to notice the block from two places:

1. **rTorrent's message field on a torrent that is still downloading.** When a tracker refuses an announce (the regular check-in a torrent client makes with the tracker), rTorrent stores the tracker's text in `d.message` as `Tracker: [Failure reason "<tracker text>"]`. On Blutopia (UNIT3D software) the text is `Your downloading privileges have been disabled! (Read the rules)`, or `Your downloading privileges have been disabled.` if it runs UNIT3D's separate announce server. Finished, seeding torrents are not refused, so only unfinished torrents show it.
2. **A failed grab.** UNIT3D refuses to hand out the .torrent file and redirects to a web page instead. Prowlarr, Sonarr and Radarr see this only as a generic "download failed".

Prowlarr, Sonarr and Radarr do not keep a tracker switched off for a cooldown. A failed grab pauses the indexer (their name for a tracker connection) for 1 minute at first, growing to at most 24 hours on repeated failures, and every successful search shortens it again. Searches keep working during a cooldown, so the pause never sticks, and they store no error text.

Recommended: media-manager-2 watches `d.message` on its own unfinished torrents and its own grab failures, and matches the text against a per-tracker setting. The block ends when the same unfinished torrent announces without error, which UNIT3D lets it retry every 30 minutes. AA-13 already keeps partly downloaded torrents active, so they double as the check that the cooldown is over.

## Blutopia (UNIT3D)

Source: UNIT3D at commit `8b88f4c`, the open-source software Blutopia runs. Blutopia may change settings or code; see "What the owner should check".

### What turns downloads off

- **Hit and run warnings.** A torrent gets a hit and run warning when the user downloaded more than 10% of it, stopped seeding, seeded under 7 days (604,800 seconds), and 3 days of grace plus 1 day after a pre-warning have passed. Each warning expires after 14 days. ([AutoWarning.php L58-L80](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Console/Commands/AutoWarning.php#L58-L80), [config/hitrun.php L37-L94](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/config/hitrun.php#L37-L94))
- At 3 active warnings, download rights are switched off (`can_download = 0`). ([AutoWarning.php L104-L118](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Console/Commands/AutoWarning.php#L104-L118), [config/hitrun.php L48](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/config/hitrun.php#L48))
- A warning ends early if the user seeds that torrent up to 7 days after all. When active warnings drop below 3, download rights come back automatically. ([AutoDeactivateWarning.php L55-L95](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Console/Commands/AutoDeactivateWarning.php#L55-L95))
- **Global ratio.** If the user's numbers drop them into the "Leech" group, download rights are switched off until they qualify for another group. ([AutoGroup.php L88-L94](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Console/Commands/AutoGroup.php#L88-L94))
- Separately, a global ratio under 0.4 blocks getting new .torrent files, without touching announces. ([config/other.php L112](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/config/other.php#L112), [TorrentDownloadController.php L54-L58](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Http/Controllers/TorrentDownloadController.php#L54-L58))

### What the tracker returns

| Where | When | Text |
|---|---|---|
| Announce, built-in announce code | download rights off and torrent unfinished | `Your downloading privileges have been disabled! (Read the rules)` ([AnnounceController.php L338-L341](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Http/Controllers/AnnounceController.php#L338-L341), [TrackerException.php L58](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Exceptions/TrackerException.php#L58)) |
| Announce, separate UNIT3D-Announce server | same | `Your downloading privileges have been disabled.` ([announce.rs L430-L431](https://github.com/HDInnovations/UNIT3D-Announce/blob/f7039c4c5dd5c9e7e303be1507a95757d305f2f6/src/announce.rs#L430-L431), [error.rs L62-L63](https://github.com/HDInnovations/UNIT3D-Announce/blob/f7039c4c5dd5c9e7e303be1507a95757d305f2f6/src/error.rs#L62-L63)) |
| Announce | account banned, disabled or not yet active | `Your account is not enabled! ( Current `Banned` )` and similar ([TrackerException.php L57](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Exceptions/TrackerException.php#L57)) |
| Announce, as a warning, not a failure | too many torrents downloading at once (download slots) | `Your slot limit is reached! ...` ([AnnounceController.php L112-L127](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Http/Controllers/AnnounceController.php#L112-L127), [TrackerException.php L70](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Exceptions/TrackerException.php#L70)) |
| .torrent download link | download rights off | redirect to the torrent's web page with `Your download rights have been revoked!` ([TorrentDownloadController.php L60-L64](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Http/Controllers/TorrentDownloadController.php#L60-L64)) |
| .torrent download link | global ratio under 0.4 | redirect with `Your ratio is too low to download!` (same file, L54-L58) |

- The download-rights check runs only when the torrent is unfinished (`left != 0`), so seeding torrents keep announcing normally.
- After a failure, UNIT3D tells the client to wait 1,800 seconds (30 minutes) before the next announce. ([AnnounceController.php L47](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Http/Controllers/AnnounceController.php#L47), [L707-L718](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Http/Controllers/AnnounceController.php#L707-L718))
- The .torrent links Prowlarr gets from the API use the RSS key route, which hits the same checks. ([TorrentResource.php L138](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Http/Resources/TorrentResource.php#L138), [routes/rss.php L31](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/routes/rss.php#L31))

### What the API exposes

`GET /api/user` returns `group`, `ratio`, `seeding`, `leeching` and `hit_and_runs`, and nothing about active warnings or download rights. ([UserResource.php L46-L55](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Http/Resources/UserResource.php#L46-L55))

- `hit_and_runs` is a lifetime count: it goes up by 1 per warning and nothing in the code lowers it. ([AutoWarning.php L93](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Console/Commands/AutoWarning.php#L93)) A rise since the last check means a new warning. It cannot say how many are still active.
- `group` equal to `Leech` (or `Banned`, `Disabled`) means downloads are off. Group names are site settings; the owner should confirm Blutopia's.

## Beyond-HD and PrivateHD

Both are closed source and publish no API docs without sign-in (`https://beyond-hd.me/api-docs`, `https://privatehd.to/api-docs` and `https://avistaz.to/api-docs` all return 404).

- Beyond-HD's search API (`POST /api/torrents/{key}`) returns `status_code`, `status_message` and torrent rows. Prowlarr treats `status_code` 0 as an error and shows `status_message`. ([Prowlarr BeyondHD.cs L164](https://github.com/Prowlarr/Prowlarr/blob/3c6e1d97ac485a70cc9d4063dd5d17af7a77584d/src/NzbDrone.Core/Indexers/Definitions/BeyondHD.cs#L164), [L270-L278](https://github.com/Prowlarr/Prowlarr/blob/3c6e1d97ac485a70cc9d4063dd5d17af7a77584d/src/NzbDrone.Core/Indexers/Definitions/BeyondHD.cs#L270-L278))
- PrivateHD (AvistaZ network) uses `/api/v1/jackett/auth` and `/api/v1/jackett/torrents`, returns torrent rows only, and gives errors as `{"message": ...}` with HTTP 401, 422 or 429. ([AvistazBase.cs L22, L68-L79](https://github.com/Prowlarr/Prowlarr/blob/3c6e1d97ac485a70cc9d4063dd5d17af7a77584d/src/NzbDrone.Core/Indexers/Definitions/Avistaz/AvistazBase.cs#L22-L79), [AvistazParserBase.cs L25-L44](https://github.com/Prowlarr/Prowlarr/blob/3c6e1d97ac485a70cc9d4063dd5d17af7a77584d/src/NzbDrone.Core/Indexers/Definitions/Avistaz/AvistazParserBase.cs#L25-L44))
- Neither has a known endpoint for warnings, hit and run counts or download rights (same finding as AA-19 for global ratio).
- Unconfirmed: the announce text and the .torrent download response either tracker gives during a cooldown, and whether a cooldown blocks announces at all or only new .torrent files.

## rTorrent

- The tracker's `failure reason` becomes `Failure reason "<text>"`. ([libtorrent tracker_http.cc L417-L426](https://github.com/rakshasa/libtorrent/blob/2557894956c714f3c1c7f0b07f70ee98aaa69233/src/tracker/tracker_http.cc#L417-L426); same format in libtorrent 0.13.8, [L300](https://github.com/rakshasa/libtorrent/blob/v0.13.8/src/tracker/tracker_http.cc#L300))
- rTorrent stores it as `Tracker: [<text>]` in the torrent's message, read with `d.message`, and clears it on the next successful announce. ([download.cc L24-L25, L58-L63](https://github.com/rakshasa/rtorrent/blob/728790a2b4d2f4e49d9bd66f707ece439c383238/src/core/download.cc#L24-L63), [command_download.cc L833](https://github.com/rakshasa/rtorrent/blob/728790a2b4d2f4e49d9bd66f707ece439c383238/src/command_download.cc#L833))
- A `warning message` (such as UNIT3D's slot limit) is only written to the log and never reaches `d.message`, except texts containing "unregistered", "not registered" or "torrent cannot be found" in current libtorrent. ([tracker_http.cc L428-L439](https://github.com/rakshasa/libtorrent/blob/2557894956c714f3c1c7f0b07f70ee98aaa69233/src/tracker/tracker_http.cc#L428-L439))
- `d.message` can be added to the existing `d.multicall2` poll from AA-7 at no extra cost.

## Prowlarr, Sonarr and Radarr

- A failed .torrent fetch counts as an indexer failure. Prowlarr follows the redirect, sees HTML, and throws "Site responded with html content." ([HttpIndexerBase.cs L295-L298](https://github.com/Prowlarr/Prowlarr/blob/3c6e1d97ac485a70cc9d4063dd5d17af7a77584d/src/NzbDrone.Core/Indexers/HttpIndexerBase.cs#L295-L298), [DownloadService.cs L97-L106, L163-L172](https://github.com/Prowlarr/Prowlarr/blob/3c6e1d97ac485a70cc9d4063dd5d17af7a77584d/src/NzbDrone.Core/Download/DownloadService.cs#L97-L172)). Sonarr and Radarr do the same on their side: `sonarr/src/NzbDrone.Core/Download/DownloadService.cs` L117-L128, `radarr/src/NzbDrone.Core/Download/DownloadService.cs` L116-L127 (Sonarr v4.0.20.3014, Radarr v6.4.4.10685).
- The pause lengths are 0, 1 min, 5 min, 15 min, 30 min, 1 h, 3 h, 6 h, 12 h, 24 h, one step up per failure. ([EscalationBackOff.cs](https://github.com/Prowlarr/Prowlarr/blob/3c6e1d97ac485a70cc9d4063dd5d17af7a77584d/src/NzbDrone.Core/ThingiProvider/Status/EscalationBackOff.cs); identical in `sonarr/src/NzbDrone.Core/ThingiProvider/Status/EscalationBackOff.cs` L5-L16)
- Each successful search steps it down one level and clears the pause. ([ProviderStatusServiceBase.cs L60-L83](https://github.com/Prowlarr/Prowlarr/blob/3c6e1d97ac485a70cc9d4063dd5d17af7a77584d/src/NzbDrone.Core/ThingiProvider/Status/ProviderStatusServiceBase.cs#L60-L83), [HttpIndexerBase.cs L456](https://github.com/Prowlarr/Prowlarr/blob/3c6e1d97ac485a70cc9d4063dd5d17af7a77584d/src/NzbDrone.Core/Indexers/HttpIndexerBase.cs#L456)). UNIT3D's search API does not check download rights, so searches keep succeeding during a cooldown.
- The stored status has only failure times, a level and a "disabled until" time, no error text (`sonarr/src/NzbDrone.Core/ThingiProvider/Status/ProviderStatusBase.cs` L8-L13). Sonarr reports it only through the health check "Indexers unavailable due to failures" (`sonarr/src/NzbDrone.Core/HealthCheck/Checks/IndexerStatusCheck.cs` L28-L51); there is no indexer status endpoint in Sonarr's or Radarr's v3 API (`openapi.json` has no `indexerstatus`).
- None of them reads rTorrent's tracker message.

## What the owner should check while signed in

1. Blutopia: whether it uses UNIT3D's built-in announce code or the separate UNIT3D-Announce server (decides which of the two texts appears), its hit and run settings (warnings before downloads stop, warning length), and the exact group names for ratio-blocked accounts.
2. Beyond-HD and PrivateHD: the hit and run or ratio rule that blocks downloads, how long it lasts, and the exact text shown on the site and in rTorrent when it happens. The rules pages need sign-in.
3. Any of the three: whether an API key holder can see active warnings anywhere outside the profile page.

Until these are confirmed, store the block text for each tracker in settings, filled in for Blutopia from the table above, and treat any `Failure reason` on an unfinished torrent that is not "unregistered" or a connection error as a possible cooldown to flag for the owner.
