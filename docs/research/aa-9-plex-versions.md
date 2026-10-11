# Plex versions next to files Sonarr and Radarr track

Linear: [AA-9](https://linear.app/aa-hh/issue/AA-9). Researched 2026-10-08.

Source code read at these commits (links below point at them):

- Radarr `develop` at [`0a097de`](https://github.com/Radarr/Radarr/tree/0a097deb192a6b72b84c23dc18c2c0d68a0678fe) (2026-10-04).
- Sonarr `main`, the v4 release branch, at [`cab419a`](https://github.com/Sonarr/Sonarr/tree/cab419ade8ac7fcab5bf80394ee492abd35d5f5a) (2026-09-09). Sonarr's default branch is now `v5-develop`; its rescan code has the same structure, but this note cites `main` because that is what a v4 install runs.

## Answer

Plex: put the second version in the same movie folder (or season folder) as the tracked version and give it the same movie name and year (or the same `sXXeYY` episode number). Plex then shows both as one title.

Sonarr and Radarr never rename, move or delete an untracked version on rescan, rename or upgrade. They do delete it when the whole movie or show is deleted with its files.

The real risk is rescan. Every rescan offers each untracked video file in the folder to the import rules. If the second version is of equal or higher quality than the tracked version, Sonarr or Radarr silently switches to tracking the second version and leaves the old one on disk, now untracked. Nothing warns about this. A second version of lower quality is rejected on every rescan and left alone.

## Plex: naming and placement

### Movies

- Name every version `MovieName (Release Year) - ArbitraryText.ext` in the movie's folder. The text after the dash can be anything; Plex does not show it. Plex's example is `/Movies/Pulp Fiction (1994)/Pulp Fiction (1994) - 1080p.mkv` next to `Pulp Fiction (1994) - SD.m4v`. Source: [Plex, Multiple Versions of the Same Movie](https://support.plex.tv/articles/200381043-multi-version-movies/).
- Plex picks the version that suits the playing device; many apps also offer a "Play Version" choice, but Plex says not to rely on that choice being shown. Same source.
- Versions are different files of the same cut. Different cuts (Director's Cut, Extended) are "editions", which Plex lists as separate items with separate watched status. A file whose name carries `{edition-...}` is filed under that edition. Source: [Plex, Multiple Editions](https://support.plex.tv/articles/multiple-editions/). So if the tracked version's name includes an edition tag (Radarr can add one through its naming settings) and the second version's does not, Plex shows two editions, not two versions of one title. This interaction is inferred from Plex's rules, not tested.
- The ArbitraryText must not end in a Plex extras word: `-behindthescenes`, `-deleted`, `-featurette`, `-interview`, `-scene`, `-short`, `-trailer` or `-other` (hyphen, no space). Plex treats such a file as an extra, not a version. Plex also says inline extras and multiple versions should not share a folder; extras go in subfolders such as `Trailers/` when there are several versions. Source: [Plex, Local Files for Trailers and Extras](https://support.plex.tv/articles/local-files-for-trailers-and-extras/).

### TV episodes

- Plex's TV naming article has no section on versions. It says the season and episode notation (`s02e17`) is "the most important bit" of the file name, with optional text after it: `/TV Shows/ShowName/Season 02/ShowName – s02e17 – Optional_Info.ext`. Source: [Plex, Naming and organizing your TV show files](https://support.plex.tv/articles/200220687-naming-series-season-based-tv-shows/).
- Plex's TV editions article confirms that versions work for episodes: "multi-version support has allowed users to provide multiple different versions of the same underlying movie/episode and have them merged together". Source: [Plex, Multiple Editions (TV Shows)](https://support.plex.tv/articles/multiple-editions-tv-shows/).
- So a second episode version goes in the same season folder with the same `sXXeYY` and different text after it. Plex does not spell this out for episodes; it follows from the two articles above.

## Sonarr and Radarr: what happens to an untracked file in the folder

Radarr tracks one file per movie (`Movie.MovieFileId`). Sonarr tracks one file per episode (`Episode.EpisodeFileId`). Everything else in the folder is untracked to them.

### Rescan (the risky one)

A rescan (Sonarr and Radarr call it "disk scan") lists every video file under the movie or series folder, removes the ones already tracked, and runs the rest through the same import rules used for downloads, with "new download" set to false. Sources: Radarr [DiskScanService.cs lines 130-143](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/DiskScanService.cs#L130-L143); Sonarr [DiskScanService.cs lines 137-143](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/MediaFiles/DiskScanService.cs#L137-L143).

Files the scan skips entirely (both apps, same patterns): [Radarr lines 72-75](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/DiskScanService.cs#L72-L75), [Sonarr lines 72-75](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/MediaFiles/DiskScanService.cs#L72-L75).

- Anything inside a subfolder named `Plex Versions` (Plex's own folder for versions its Media Optimizer creates), `@eaDir`, `.@__thumb`, or any folder starting with `.`.
- Anything inside `extras`, `featurettes`, `trailers`, `samples` and the other extras folder names.
- Files ending `-trailer`, `-other`, `-behindthescenes`, `-deleted`, `-featurette`, `-interview`, `-scene`, `-short`. These are the same words Plex uses for extras, so this cannot be used to hide a version from Sonarr and Radarr without Plex also treating it as an extra.

The import rule that matters is the upgrade check. It rejects the untracked file only if it is lower quality than the tracked file, or the same quality with a lower repack/proper revision, or the same quality with a lower custom format score. Equal or better is accepted. Sources: Radarr [UpgradeSpecification.cs lines 45-79](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/MovieImport/Specifications/UpgradeSpecification.cs#L45-L79); Sonarr [UpgradeSpecification.cs lines 33-89](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/MediaFiles/EpisodeImport/Specifications/UpgradeSpecification.cs#L33-L89). The check ignores the quality profile's "Upgrades Allowed" switch (the word `UpgradeAllowed` does not appear in either file), so turning upgrades off does not stop this.

When a rescan accepts the untracked file:

1. It is added as a new tracked file. Because the import is not a new download, no file is deleted or moved on disk. Sources: Radarr [ImportApprovedMovie.cs lines 131-151](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/MovieImport/ImportApprovedMovie.cs#L131-L151); Sonarr [ImportApprovedEpisodes.cs lines 154-170](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/MediaFiles/EpisodeImport/ImportApprovedEpisodes.cs#L154-L170).
2. The movie or episode now points at the new file. Sources: Radarr [MovieService.cs lines 439-443](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/Movies/MovieService.cs#L439-L443); Sonarr [EpisodeService.cs lines 284-288](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/Tv/EpisodeService.cs#L284-L288).
3. The old record becomes orphaned and a housekeeping task deletes the record (not the file). Sources: Radarr [CleanupOrphanedMovieFiles.cs](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/Housekeeping/Housekeepers/CleanupOrphanedMovieFiles.cs#L18-L23); Sonarr [CleanupOrphanedEpisodeFiles.cs](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/Housekeeping/Housekeepers/CleanupOrphanedEpisodeFiles.cs#L18-L23).

The previously tracked version is still on disk and is now the untracked one. If both versions have exactly equal quality and custom format score, each rescan accepts whichever is untracked, so tracking would flip between them on every rescan. This flip is read from the code, not tested.

No health check covers untracked files. The Radarr health checks folder has none about them, and neither app's health check code mentions "unmapped" or "untracked" ([Radarr HealthCheck/Checks](https://github.com/Radarr/Radarr/tree/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/HealthCheck/Checks)). A rejected file is only logged.

When rescans run:

- After each series or movie refresh, when "Rescan Series Folder after Refresh" / "Rescan Movie Folder after Refresh" is "Always" (the default). Sources: Radarr [ConfigService.cs line 307](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/Configuration/ConfigService.cs#L305-L309), [RefreshMovieService.cs lines 178-191](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/Movies/RefreshMovieService.cs#L178-L191); Sonarr [ConfigService.cs line 248](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/Configuration/ConfigService.cs#L246-L250); [Radarr settings wiki](https://wiki.servarr.com/radarr/settings), [Sonarr settings wiki](https://wiki.servarr.com/sonarr/settings).
- The scheduled refresh runs every 24 hours in Radarr and every 12 hours in Sonarr. Sources: Radarr [TaskManager.cs lines 88-89](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/Jobs/TaskManager.cs#L88-L89); Sonarr [TaskManager.cs lines 102-103](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/Jobs/TaskManager.cs#L102-L103).
- Setting it to "Never" or "After Manual Refresh" stops the scheduled rescans. Other code paths also queue a rescan (for example Radarr after an import fails with "Destination already exists", [ImportApprovedMovie.cs line 188](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/MovieImport/ImportApprovedMovie.cs#L188)), and the full list of triggers was not traced. Unconfirmed that the setting stops every rescan.

### Rename

Rename only touches tracked files: Radarr loads the movie's tracked files ([RenameMovieFileService.cs line 159](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/RenameMovieFileService.cs#L159)), Sonarr the series' tracked files ([RenameEpisodeFileService.cs line 60](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/MediaFiles/RenameEpisodeFileService.cs#L60)). The second version keeps its name.

Changing a movie's or series' path (for example after renaming the folder format) moves the whole folder, so the second version moves with it. Sources: Radarr [MoveMovieService.cs line 70](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/Movies/MoveMovieService.cs#L70); Sonarr [MoveSeriesService.cs line 72](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/Tv/MoveSeriesService.cs#L72). Any path media-manager-2 stored for the second version is then out of date.

### Upgrade (import of a new download)

An upgrade deletes only the currently tracked file, through the recycle bin, then imports the new one. Sources: Radarr [UpgradeMediaFileService.cs lines 52-69](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/UpgradeMediaFileService.cs#L52-L69); Sonarr [UpgradeMediaFileService.cs lines 64-65](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/MediaFiles/UpgradeMediaFileService.cs#L64-L65). The second version survives, but if a rescan has already switched tracking to it, the upgrade deletes the second version instead of the one the user thinks is tracked.

### Deleting the movie or show

Deleting a movie or series with "delete files" sends the whole folder to the recycle bin, second version included. Sources: Radarr [MediaFileDeletionService.cs line 121](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/MediaFileDeletionService.cs#L91-L126); Sonarr [MediaFileDeletionService.cs line 121](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/MediaFiles/MediaFileDeletionService.cs#L91-L126). With no recycle bin folder set, the folder is deleted permanently ([Radarr RecycleBinProvider.cs lines 40-48](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/RecycleBinProvider.cs#L40-L48)). Deleting without "delete files" leaves the folder alone.

"Delete Empty Folders" only removes a folder that is empty, so it never removes a folder holding a second version ([Radarr MediaFileDeletionService.cs lines 129-155](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/MediaFileDeletionService.cs#L129-L155)).

### Extra files

Sonarr's and Radarr's "extra files" (subtitles, `.nfo` and other file types listed in "Import Extra Files") are taken only from non-video files ([Radarr DiskScanService.cs lines 176-180](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/MediaFiles/DiskScanService.cs#L176-L180)). A second video version is never treated as an extra file. Subtitles that belong to a second version could be picked up as extras of the tracked version; not checked.

## Settings that affect this

| Setting (both apps unless named) | Effect on a second version |
| --- | --- |
| Rescan Series/Movie Folder after Refresh | "Always" (default) runs the rescan that can switch tracking every 12 h (Sonarr) or 24 h (Radarr). |
| Recycling Bin | Where a deleted movie or show folder goes, second version included. Empty means permanent delete. |
| Recycling Bin Cleanup | Days before recycle bin contents are deleted for good. |
| Delete Empty Folders | No effect while the second version is in the folder. |
| Quality profile and custom formats | Decide whether a rescan rejects the second version (lower) or switches tracking to it (equal or higher). |
| Download Propers & Repacks | Changes whether a same-quality file with a higher revision counts as better. |
| Radarr movie naming with edition tag | Can make Plex treat the two files as separate editions. |

## Open points

- No placement was found that hides a second version from Sonarr and Radarr while Plex still treats it as a version. Every pattern the scanners skip is either a Plex extras pattern or the `Plex Versions` folder, which Plex manages itself. Whether Plex merges a regular video file placed in a movie's `Plex Versions` subfolder was not checked.
- Whether Plex merges a version whose name does not follow `MovieName (Year) - text` exactly (Radarr's default file name is `{Movie Title} ({Release Year}) {Quality Full}`, with no dash, per [NamingConfig.cs line 13](https://github.com/Radarr/Radarr/blob/0a097deb192a6b72b84c23dc18c2c0d68a0678fe/src/NzbDrone.Core/Organizer/NamingConfig.cs#L13)) was not tested; Plex documents only the dashed pattern.
