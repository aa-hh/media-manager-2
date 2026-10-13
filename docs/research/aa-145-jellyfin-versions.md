# Jellyfin versions next to files Sonarr and Radarr track

Linear: [AA-145](https://linear.app/aa-hh/issue/AA-145). Tested 2026-10-13 on the Jellyfin that runs on the Whatbox slot, version **10.11.11** (`/System/Info/Public`). Follows [aa-9-plex-versions.md](aa-9-plex-versions.md).

Source read at Jellyfin tags `v10.11.11` ([`1fbd873`](https://github.com/jellyfin/jellyfin/tree/1fbd8739292cce610231be93daf43368733edf63)) and `v12.2` ([`ca0f16e`](https://github.com/jellyfin/jellyfin/tree/ca0f16eb7c195f720a1493ed469a27c4657db0c6)).

## Answer

On 10.11.11, the app's second versions do not group with the tracked file, for movies or for episodes. The app links each second version into its own versions folder (`hostPaths versions.<service>`, e.g. `~/PlexVersions/The Prestige (2006)/The Prestige (2006) - 2160p.mkv`). Plex merges two files in one library by their matched movie or episode. Jellyfin only groups files that sit in the same folder, so a version in a separate folder is always a second, separate title.

One API call fixes it: `POST /Videos/MergeVersions?ids=<tracked item>&ids=<version item>`. It returned 204 for a movie pair and an episode pair split across two folders. A signed-in user then saw one title with two versions, and the merge survived a full rescan with "replace all metadata".

Placing the version in the tracked file's folder only works if the tracked file's name is also `Folder Name - …`. Radarr's default name (`{Movie Title} ({Release Year}) {Quality Full}`, no dash) and scene names break it.

## What Jellyfin groups, from source

Movies, both versions: `VideoListResolver.GetVideosGroupedByVersion` ([10.11.11](https://github.com/jellyfin/jellyfin/blob/1fbd8739292cce610231be93daf43368733edf63/Emby.Naming/Video/VideoListResolver.cs#L102-L212)) works on the video files of one folder. It groups them only if every non-extra file name starts with the folder name, and if what follows, after Jellyfin strips quality words, is empty, starts with `-` or starts with `[...]`. One non-matching file stops grouping for the whole folder. Every file must also parse to the same year.

Episodes: 10.11.11 has no episode grouping. `v12.2` adds `GetEpisodesGroupedByVersion` ([v12.2 lines 207-271](https://github.com/jellyfin/jellyfin/blob/ca0f16eb7c195f720a1493ed469a27c4657db0c6/Emby.Naming/Video/VideoListResolver.cs#L207-L271)). It groups files whose paths parse to the same season and episode number, still within one folder ([commit d5bb775](https://github.com/jellyfin/jellyfin/commit/d5bb775), 2026-05-11).

Extras: Jellyfin treats a file name ending in `-trailer`, `-sample`, `-scene`, `-clip`, `-interview`, `-behindthescenes`, `-deleted`, `-deletedscene`, `-featurette`, `-short`, `-extra` or `-other` as an extra ([NamingOptions.cs](https://github.com/jellyfin/jellyfin/blob/1fbd8739292cce610231be93daf43368733edf63/Emby.Naming/Common/NamingOptions.cs#L589-L693)). `-clip`, `-extra` and `-deletedscene` were missing from the app's list; this branch adds them at `src/server/versionImport.ts:38`.

## Test

Two temporary libraries, each with two folders (a library folder and a versions folder, as the app sets them up), internet metadata off, filled with 2-second dummy `.mkv` files. Second versions used the app's naming: `<Title (Year)> - <quality> <group>` for movies, `<Show> - SxxEyy - <quality> <group>` for episodes. Everything was removed afterwards: libraries, items, files and the API key.

| Case | Files | Grouped by scan |
| --- | --- | --- |
| Movie, versions folder (how the app places it) | `movies/Cross Folder Test (2001)/Cross Folder Test (2001) Bluray-1080p.mkv`, `movie-versions/Cross Folder Test (2001)/Cross Folder Test (2001) - Bluray-2160p GRP.mkv` | No, 2 movies |
| Movie, same folder, tracked file has Radarr's default name | `Same Folder Test (2002) Bluray-1080p.mkv`, `Same Folder Test (2002) - Bluray-2160p GRP.mkv` | No, 2 movies |
| Movie, same folder, both dashed | `Dash Test (2003) - Bluray-1080p.mkv`, `Dash Test (2003) - Bluray-2160p GRP.mkv` | Yes, 1 movie with 2 sources |
| Movie, same folder, tracked file has a scene name | `Scene.Name.Test.2004.1080p.BluRay.x264-GRP.mkv`, `Scene Name Test (2004) - Bluray-2160p GRP.mkv` | No, 2 movies |
| Episode, versions folder | `tv/Test Show/Season 01/Test Show - S01E01 - Pilot Bluray-1080p.mkv`, `tv-versions/Test Show/Season 01/Test Show - S01E01 - Bluray-2160p GRP.mkv` | No, 2 episodes (expected before 12.2) |
| Episode, same folder | `Test Show - S01E02 - Second Bluray-1080p.mkv`, `Test Show - S01E02 - Bluray-2160p GRP.mkv` | No, 2 episodes (expected before 12.2) |

The grouped case, from `GET /Items?ParentId=<test movies library>&Recursive=true&IncludeItemTypes=Movie&Fields=Path,MediaSources`:

```
Movie | Dash Test (2003) | Id 816615576b5bc0c82041fadc2c51215d
   source: Bluray-2160p GRP | .../movies/Dash Test (2003)/Dash Test (2003) - Bluray-2160p GRP.mkv
   source: Bluray-1080p | .../movies/Dash Test (2003)/Dash Test (2003) - Bluray-1080p.mkv
```

The ungrouped app placement, same call:

```
Movie | Cross Folder Test (2001) | Id 0c0bd2f34491ba5e0c3b8023e9385b83
   source: Cross Folder Test (2001) Bluray-1080p | .../movies/Cross Folder Test (2001)/Cross Folder Test (2001) Bluray-1080p.mkv
Movie | Cross Folder Test (2001) | Id 3c204410dc093e911e8f7b7255d0df36
   source: Cross Folder Test (2001) - Bluray-2160p GRP | .../movie-versions/Cross Folder Test (2001)/Cross Folder Test (2001) - Bluray-2160p GRP.mkv
```

The show folder in each library folder also became its own series: two `Test Show` series, one per folder.

### Manual merge

`POST /Videos/MergeVersions?ids=0c0bd2f3…&ids=3c204410…` (movie) and the same call for the two S01E01 items both returned 204. After a full refresh of both libraries, listing as the admin user (`GET /Items?userId=<admin>&ParentId=…`):

```
== Movie
TotalRecordCount 6
Cross Folder Test (2001) | 2 sources
Dash Test (2003) | 2 sources
Same Folder Test | 1 sources
Same Folder Test | 1 sources
Scene.Name.Test | 1 sources
Scene Name Test | 1 sources
== Episode
TotalRecordCount 3
Test Show - S01E01 - Pilot | 2 sources
Test Show - S01E02 - | 1 sources
Test Show - S01E02 - Second | 1 sources
```

Without `userId`, both merged items still listed in this test. A retest on 2026-10-13 for [AA-151](https://linear.app/aa-hh/issue/AA-151) found the opposite: `GET /Items?Recursive=true&IncludeItemTypes=Movie&Fields=Path` without `userId` lists one item per merged pair (sometimes the version, not the tracked file), so the app's lookup finds both items only while the pair is split.

## Open points

- A merge does not survive the tracked file being renamed or replaced: tested 2026-10-13 for [AA-150](https://linear.app/aa-hh/issue/AA-150) (Merge imported second versions into one title in Jellyfin). After either, a rescan shows two titles again; merging the new tracked item again fixes it. The app notices this by the tracked path Radarr or Sonarr reports changing and merges again ([AA-151](https://linear.app/aa-hh/issue/AA-151), Merge a second version again in Jellyfin after the tracked file is renamed or upgraded).
- Retested 2026-10-13 for AA-151: a tracked file replaced under the same path keeps its item id (Jellyfin derives it from the path) and its merge, through a rescan; calling `MergeVersions` again on a merged pair returns 204 and changes nothing. If a scan runs while the tracked file is gone and the replacement then lands under the same path, the user sees only the tracked file and the version is hidden from both listings; `MergeVersions` with the two item ids fixes it, but the app cannot find the version's id by listing, so it waits for the next rename.
- With metadata on, whether Jellyfin still shows two series for a show folder in both the library and versions folders was not tested. Metadata was off.
- Which Jellyfin item IDs to pass to `MergeVersions` needs a path lookup (`GET /Items?Recursive=true&Fields=Path` filtered by path), since Jellyfin does not take paths.
- Episode grouping by name on 12.2 was read from source, not tested; the slot runs 10.11.11. Even on 12.2 it only groups within one folder, so the versions folder still needs the merge call.
