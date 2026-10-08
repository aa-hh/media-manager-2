# Can a replace be forced through Sonarr and Radarr?

Linear: [AA-6](https://linear.app/aa-hh/issue/AA-6). Researched 2026-10-08 against the source of the current stable releases: Sonarr [v4.0.20.3014](https://github.com/Sonarr/Sonarr/tree/v4.0.20.3014) and Radarr [v6.4.4.10685](https://github.com/Radarr/Radarr/tree/v6.4.4.10685). Every line link below points at those tags. Sonarr's v5-develop branch and Radarr's develop branch had the same logic on 2026-10-04.

## Answer

Yes, for both, in two steps. Sonarr and Radarr behave the same way here; the code is near-identical.

1. Grab: `POST /api/v3/release` grabs the hand-picked release even when the search marked it rejected (for example "not an upgrade"). Nothing on the grab path checks the quality profile.
2. Import: the automatic import after the download finishes refuses a lower-quality release with "Not an upgrade for existing episode file(s)" (Sonarr) or "Not an upgrade for existing movie file" (Radarr), and the download sits in the queue with a warning. Sending the `ManualImport` command (`POST /api/v3/command`) imports it anyway, because that command skips every import check. The tracked version moves to the recycle bin, the same as an upgrade.

Changing the quality profile is not needed.

## Grab

The grab endpoint takes a release from the last search (by `guid` and `indexerId`) and hands it straight to the download client.

- `DownloadRelease` looks the release up in a cache and calls `DownloadReport`. It never reads the search's rejections. Sonarr: [ReleaseController.cs#L71-L160](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/Sonarr.Api.V3/Indexers/ReleaseController.cs#L71-L160). Radarr: [ReleaseController.cs#L70-L122](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/Radarr.Api.V3/Indexers/ReleaseController.cs#L70-L122).
- `DownloadReport` only picks a download client and sends the torrent. Sonarr: [DownloadService.cs#L53](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/Download/DownloadService.cs#L53). Radarr: [DownloadService.cs#L53](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/Download/DownloadService.cs#L53).
- The cache entry lasts 30 minutes from the search (`GET /api/v3/release`). After that the grab fails with "Couldn't find requested release in cache, try searching again". Sonarr: [ReleaseController.cs#L240](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/Sonarr.Api.V3/Indexers/ReleaseController.cs#L240). Radarr: [ReleaseController.cs#L178](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/Radarr.Api.V3/Indexers/ReleaseController.cs#L178).
- Optional `shouldOverride: true` in the body lets the caller set the series, episodes, quality and languages (Sonarr) or movie, quality and languages (Radarr) instead of the parsed values. Sonarr: [ReleaseController.cs#L84](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/Sonarr.Api.V3/Indexers/ReleaseController.cs#L84). Radarr: [ReleaseController.cs#L83](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/Radarr.Api.V3/Indexers/ReleaseController.cs#L83). Not needed to force a grab.
- Do not use `POST /api/v3/release/push` for this. It runs the full rejection checks and drops rejected releases. Sonarr: [ReleasePushController.cs#L70-L74](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/Sonarr.Api.V3/Indexers/ReleasePushController.cs#L70-L74) and [ProcessDownloadDecisions.cs#L127-L137](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/Download/ProcessDownloadDecisions.cs#L127-L137). Radarr: [ReleasePushController.cs#L70-L74](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/Radarr.Api.V3/Indexers/ReleasePushController.cs#L70-L74).

## Automatic import refuses a lower quality

When a download finishes, the import runs every import check with no exceptions. Sonarr: [ImportDecisionMaker.cs#L111](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/MediaFiles/EpisodeImport/ImportDecisionMaker.cs#L111). Radarr: [ImportDecisionMaker.cs#L109](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/MediaFiles/MovieImport/ImportDecisionMaker.cs#L109).

One check compares the new file's quality with the tracked version's, using the order in the quality profile. If the new one ranks lower, it rejects. Sonarr: [UpgradeSpecification.cs#L43-L48](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/MediaFiles/EpisodeImport/Specifications/UpgradeSpecification.cs#L43-L48). Radarr: [UpgradeSpecification.cs#L43-L48](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/MediaFiles/MovieImport/Specifications/UpgradeSpecification.cs#L43-L48). The same check also rejects an equal quality with a lower revision (a non-repack replacing a repack, when repacks are preferred) or a lower custom format score.

A 720p release replacing a 4K file therefore fails here, even though the grab succeeded.

What happens next: the rejection is shown as a warning on the queue item and the import stops. It is not marked failed and not blocklisted; only dangerous files, executables and user-blocked extensions get marked failed. Sonarr: [CompletedDownloadService.cs#L171](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/Download/CompletedDownloadService.cs#L171) and [RejectedImportService.cs](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/Download/RejectedImportService.cs). Radarr: [CompletedDownloadService.cs#L165](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/Download/CompletedDownloadService.cs#L165) and [RejectedImportService.cs#L55](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/Download/RejectedImportService.cs#L55).

## Manual import forces it

The `ManualImport` command builds an import with no rejections at all, using the quality the caller supplies, then runs the normal import. Only items with zero rejections are imported, and this one has none by construction.

- Sonarr: [ManualImportService.cs#L480-L552](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/MediaFiles/EpisodeImport/Manual/ManualImportService.cs#L480-L552) (`new ImportDecision(localEpisode)` at L544, caller's quality at L534). An `ImportDecision` is approved when it has no rejections: [ImportDecision.cs#L13](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/MediaFiles/EpisodeImport/ImportDecision.cs#L13), filtered at [ImportApprovedEpisodes.cs#L61](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/MediaFiles/EpisodeImport/ImportApprovedEpisodes.cs#L61).
- Radarr: [ManualImportService.cs#L405-L474](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/MediaFiles/MovieImport/Manual/ManualImportService.cs#L405-L474) (`new ImportDecision(localMovie)` at L466, caller's quality at L454). [ImportDecision.cs#L13](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/MediaFiles/MovieImport/ImportDecision.cs#L13), [ImportApprovedMovie.cs#L64](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/MediaFiles/MovieImport/ImportApprovedMovie.cs#L64).
- Sonarr's and Radarr's own web pages send this same command from the Manual Import window and do not block rows that show rejections; they only require series, episodes, quality and languages to be filled in. Sonarr: [InteractiveImportModalContent.tsx](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/frontend/src/InteractiveImport/Interactive/InteractiveImportModalContent.tsx), [InteractiveImportRow.tsx#L147-L153](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/frontend/src/InteractiveImport/Interactive/InteractiveImportRow.tsx#L147-L153). The Servarr wiki gives Manual Import from Activity, Queue as the fix for blocked imports: [wiki.servarr.com/sonarr/troubleshooting](https://wiki.servarr.com/sonarr/troubleshooting).

Calls, the same for both:

1. `GET /api/v3/manualimport?downloadId=<id>` lists the files in the finished download with their parsed quality and rejections.
2. `POST /api/v3/command` with `{"name": "ManualImport", "importMode": "auto", "files": [...]}`. Each file needs `path`, `quality`, `languages`, `downloadId`, plus `seriesId` and `episodeIds` (Sonarr) or `movieId` (Radarr). Fields: [ManualImportFile.cs](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/MediaFiles/EpisodeImport/Manual/ManualImportFile.cs). Command name: [commandNames.js](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/frontend/src/Commands/commandNames.js).

`POST /api/v3/manualimport` is a different thing: it re-runs the checks on edited rows and returns the rejections. It does not import. [ManualImportController.cs#L36-L38](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/Sonarr.Api.V3/ManualImport/ManualImportController.cs#L36-L38).

Both endpoints are in each project's published OpenAPI file: [Sonarr openapi.json](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/Sonarr.Api.V3/openapi.json), [Radarr openapi.json](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/Radarr.Api.V3/openapi.json).

## What the forced import does to files and seeding

- The tracked version goes to the recycle bin (or is deleted if no recycle bin is set), the same as an upgrade. Sonarr: [ImportApprovedEpisodes.cs#L159](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/MediaFiles/EpisodeImport/ImportApprovedEpisodes.cs#L159), [UpgradeMediaFileService.cs#L65](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/MediaFiles/UpgradeMediaFileService.cs#L65). Radarr: [ImportApprovedMovie.cs#L136](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/MediaFiles/MovieImport/ImportApprovedMovie.cs#L136), [UpgradeMediaFileService.cs#L61](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/MediaFiles/UpgradeMediaFileService.cs#L61).
- With `importMode: "auto"`, the file is copied (or hardlinked) instead of moved while rTorrent reports the torrent has not met its seed goal, so seeding continues. Sonarr: [ImportApprovedEpisodes.cs#L144](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/MediaFiles/EpisodeImport/ImportApprovedEpisodes.cs#L144), [RTorrent.cs#L190-L208](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/Download/Clients/rTorrent/RTorrent.cs#L190-L208). Radarr: [ImportApprovedMovie.cs#L121](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/MediaFiles/MovieImport/ImportApprovedMovie.cs#L121), [RTorrent.cs#L208](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/Download/Clients/rTorrent/RTorrent.cs#L208). `"move"` would break seeding. `"copy"` is always safe.
- Passing `downloadId` ties the import to the queue item, so the queue item is marked imported and cleared.

## Changing the quality profile instead

Not needed, and worse. The import check reads the order of the series' or movie's quality profile, so reordering it would let the automatic import through. But the profile is shared by every series or movie that uses it, and the change would also alter what automatic searches grab while it is in place. Not tested.

## After the replace (from the code, not tested)

If the movie or episode stays monitored and its profile allows upgrades, the replaced version is now below the profile's cutoff, so the next automatic search or feed check can grab a higher-quality release and undo the replace. The check that allows this: Sonarr [UpgradeDiskSpecification.cs#L41-L51](https://github.com/Sonarr/Sonarr/blob/v4.0.20.3014/src/NzbDrone.Core/DecisionEngine/Specifications/UpgradeDiskSpecification.cs#L41-L51), Radarr [UpgradeDiskSpecification.cs#L44-L54](https://github.com/Radarr/Radarr/blob/v6.4.4.10685/src/NzbDrone.Core/DecisionEngine/Specifications/UpgradeDiskSpecification.cs#L44-L54).

## Not confirmed

- Behaviour was read from source, not run against a live Sonarr or Radarr.
- Whether the queue warning clears on its own after a manual import with `downloadId`, versus needing `DELETE /api/v3/queue/{id}`. The code marks the item imported (Sonarr ManualImportService.cs, end of `Execute`), but this was not tested.
