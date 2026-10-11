# Setup wizard Folders step: what to detect, what to ask

Findings from 11 Oct 2026. Sources: the code on this branch, read-only commands on the Whatbox slot , and the docs linked at each claim. "Not verified" marks anything I could not check.

## What the slot has

**Mounts.** `df -hT` and `findmnt` show one ext4 system disk (`/`), a 20 GB `tmpfs` at `/tmp` (memory-backed, wiped on reboot), and 37 xfs data disks at `/mnt/mpatha` … `/mnt/mpathaj`, each 11 or 21 TB. No network, FUSE, mergerfs or overlay mounts exist today. The slot is shared: `ls /mnt/mpatha` is refused, and only the owner's own folder on one disk is readable.

**Home.** `/home/<user>` is a symlink to `/mnt/mpathe/<user>`. Every folder under it sits on one xfs disk, `stat` device number 64784. That disk has 6.38 TB free of 12 TB (Sonarr's `/api/v3/rootfolder` `freeSpace`).

**The five folders.**

| Folder | What exists on the slot | Device |
|---|---|---|
| Downloads | Sonarr's download client folder `/mnt/mpathe/<user>/files/Sonarr/`; Radarr's `/mnt/mpathe/<user>/files/Radarr/` (from `/api/v3/downloadclient`, `tvDirectory` and `movieDirectory`). rTorrent's `directory.default` not verified (reading it needs an XML-RPC call, outside the allowed commands). | 64784 |
| TV library | Sonarr's only root folder: `/home/<user>/TV` | 64784 |
| Movies library | Radarr's only root folder: `/home/<user>/Movies` | 64784 |
| TV second versions | Nothing set. The wizard would suggest `/home/<user>/TV-versions`, which does not exist. | — |
| Movies second versions | Nothing set. The wizard would suggest `/home/<user>/Movies-versions`, which does not exist. Two candidates do exist: `~/PlexVersions` (holds `The Prestige (2006)` from an Oct 8 test) and `~/files/Plex Versions` (empty). | 64784 |

All five sit on the same drive, so every hardlink the app needs works on the slot. Most files in `~/files/Radarr` show a link count of 2, so Radarr's imports are hardlinks today. A few show 1 (`Better.Man…`, `Gummo…`, `Holy.Motors…`, `American.Beauty…`): their data has no second name, which means each was either never imported or was copied.

**Other facts.**
- Remote path mappings: none, in both Sonarr and Radarr. Both download clients point at `localhost`.
- Sonarr and Radarr run on the host, not in containers: their `/api/v3/diskspace` lists the host's real mount points.
- The live app database has **no `hostPaths` rows at all**. Until the Folders step saves them, relink and second-version import refuse to run on the slot.
- `podman`, `rclone`, `mergerfs` and `fusermount3` are installed, so the owner could add a cloud or mergerfs mount later. The README says the app runs as a plain Node process with no container.
- Plex library locations not verified (no Plex call was in the allowed list).

## What the app can detect on its own

| Fact | How | Notes |
|---|---|---|
| Library folders | Sonarr and Radarr `GET /api/v3/rootfolder` → `path`, `accessible`, `freeSpace` | Already used by `setup.ts`. Several root folders are possible; today it takes the first. |
| Per-service download folders | Sonarr/Radarr `GET /api/v3/downloadclient` → rTorrent client's `tvDirectory` / `movieDirectory` field | Not used yet. More exact than rTorrent's default folder, which is the parent of both on most seedboxes. |
| rTorrent's default download folder | XML-RPC `directory.default` | Already used. |
| Path rewriting between rTorrent and Sonarr/Radarr | `GET /api/v3/remotepathmapping` → `host`, `remotePath`, `localPath` | Empty on the slot. A non-empty list means the services see rTorrent's paths under other names. |
| Drives Sonarr/Radarr can see, with free space | `GET /api/v3/diskspace` → `path`, `label`, `freeSpace`, `totalSpace` | On the slot this lists all 37 shared disks, so it is only useful filtered to the drives holding the five folders. |
| Whether a folder exists and is a folder | Node `fs.statSync(path)` | Already used. Follows symlinks. |
| Which mount a folder is on, its filesystem type and source | Read `/proc/self/mountinfo`; take the line whose mount point is the longest prefix of `fs.realpathSync(folder)` | Each line has a mount ID, `major:minor` ("the value of st_dev for files on this filesystem"), the mount's root inside its filesystem, the mount point, the filesystem type (such as `xfs`, `nfs4`, `fuse.rclone`) and the source ([proc_pid_mountinfo(5)](https://man.archlinux.org/man/proc_pid_mountinfo.5.en)). Linux only; macOS development machines have no `/proc`. |
| Filesystem type without parsing mountinfo | Node `fs.statfsSync(path).type`, a number (added in Node v19.6.0 / v18.15.0, [Node fs docs](https://nodejs.org/api/fs.html)) | Values from [linux/magic.h](https://raw.githubusercontent.com/torvalds/linux/master/include/uapi/linux/magic.h): ext4 `0xEF53`, xfs `0x58465342`, btrfs `0x9123683E`, NFS `0x6969`, SMB `0xFE534D42`, CIFS `0xFF534D42`, FUSE `0x65735546`, overlay `0x794c7630`, tmpfs `0x01021994`. FUSE is one number for rclone, mergerfs and sshfs alike, so mountinfo's type string is needed to tell them apart. |
| Free space for any folder | `fs.statfsSync(path)`: `bavail × bsize` | Works for paths Sonarr/Radarr do not know. |
| Whether two folders share a drive | Compare `stat().dev`; better, compare mountinfo mount IDs | See the next section for when `dev` misleads. |
| Whether a hardlink between two folders actually works | Create a small temporary file in folder A, `fs.linkSync` it into folder B, check the inode matches, delete both | The only check that proves it. It writes to both folders, so it needs the owner's OK as part of the design. |
| Whether Plex reads a folder | Plex `GET /library/sections` → each section's `Location[].path` | Already used by `versionImport.ts` after import. Could run in the wizard instead. |

What the owner must decide, because no service records it:
- The second-versions folders. Nothing on the slot names them; only the owner knows whether `~/PlexVersions` is the intended one.
- Which root folder to use when Sonarr or Radarr has several.
- Whether to create a folder that does not exist yet.

## How the owner picks a folder

1. **Typed path, checked as they type** (what `setup.ts` does now). Works everywhere, including containers. Easy to mistype; the owner must know the path.
2. **Prefilled from Sonarr, Radarr and rTorrent, shown as a choice to confirm.** Covers both library folders and the downloads folder with no typing on the slot. Cannot fill the second-versions folders. Where a service has several root folders, show them as a list.
3. **A folder browser served by the app.** The server lists subfolders of a path (`fs.readdirSync` with `withFileTypes`, folders only) and the page lets the owner click through. Removes typing for the second-versions folders and shows what already exists (`~/PlexVersions`). The route can list any folder the app's user can read, so it belongs behind the owner sign-in and returns folder names only, never files. On the slot it starts at the home folder: `/mnt/mpath*` cannot be listed.
4. **Pick from detected mounts.** Fails on the slot: 37 mounts, one readable. Mount detection belongs in the labels and checks, not in the picker.

**Recommendation:** option 2 for the downloads and library folders, prefilled from the download client folders and root folders, each with a "change" link that opens option 3. Option 3 for the two second-versions folders, starting at the library folder's parent, with a "Create folder" action, because the current suggestions (`~/TV-versions`, `~/Movies-versions`) do not exist and fail the "This folder does not exist." check. Keep a typed path inside the browser for owners who already know it.

## Telling drives apart and labelling them

### Is `stat().dev` reliable?

Mostly, with three traps.

- **Separate mounts of one filesystem.** A bind mount makes an existing folder appear at a second place in the folder tree; a container's volume (`podman run -v host:container`) is one. Two bind mounts of the same disk report the **same** `dev`, yet `link()` between them fails: "Linux permits a filesystem to be mounted at multiple points, but link() does not work across different mounts, even if the same filesystem is mounted on both" ([link(2)](https://man.archlinux.org/man/link.2.en)). So if the app ran in a Podman container with downloads and library mounted as two volumes, `folderProblems` would pass and every hardlink would then fail with `EXDEV`. Comparing mountinfo mount IDs catches this; a test hardlink proves it.
- **overlay filesystems** (the layered filesystem container images use). Folders report the overlay's own `dev`, while "non-directory objects may report an st_dev from the lower filesystem or upper filesystem" ([kernel overlayfs docs](https://docs.kernel.org/filesystems/overlayfs.html)). `versionImport.ts` compares a folder's `dev` with a file's `dev`, which can differ on overlay even when the link would work. Volumes are bind mounts, not overlay, so this only bites if media sits inside a container's own filesystem.
- **FUSE mounts** (FUSE: a filesystem run by an ordinary program, such as rclone, mergerfs or sshfs, instead of the kernel). Each FUSE mount gets its own `dev`, so two folders on one mergerfs pool compare equal even when their files sit on different underlying disks. mergerfs can only hardlink when both paths land on the same underlying disk; otherwise the link fails with `EXDEV`, or mergerfs makes a symlink instead if its `link-exdev` option is set ([mergerfs manual](https://manpages.ubuntu.com/manpages/lunar/man1/mergerfs.1.html)). A symlink is not a hardlink: deleting the download breaks the library copy.

A symlink in the path does not mislead `statSync`, which follows it: `/home/<user>` reports device 64784 like `/mnt/mpathe/<user>`. `lstat` on the symlink itself reports the system disk (2431).

**Recommended check:** same mountinfo mount ID → "same drive"; then, at save time, a test hardlink between downloads and each second-versions folder (refuse on failure) and between downloads and each library folder (warn on failure).

### Labels and what each means

The label comes from mountinfo's filesystem type.

| Filesystem type | Label for the owner | Hardlinks | Seeding from it | Plex reading it |
|---|---|---|---|---|
| `ext4`, `xfs`, `btrfs`, `zfs` | Local disk | Within one mount, yes | Yes | Yes |
| `tmpfs` | Memory (cleared on restart) | Yes, but lost on reboot | Never: data vanishes | Never |
| `nfs`, `nfs4` | Network share (NFS) | Within one export, if the server's disk allows it (not verified) | Works, limited by network speed | Works |
| `cifs`, `smb3` | Network share (SMB) | Depends on the server; often refused (not verified) | Works, slower | Works |
| `fuse.sshfs` | Network share (SSH) | Not verified | Slow; not advised | Works, slowly |
| `fuse.rclone` | Cloud storage mount (rclone) | No. rclone's maintainers say mounts do not support hardlinks ([rclone forum](https://forum.rclone.org/t/can-rclone-create-a-hardlink-on-google-drive/10364); not in rclone's own docs) | No. Whatbox: "Do not use FUSE-mounted folders with BitTorrent clients" ([Whatbox rclone wiki](https://whatbox.ca/wiki/rclone)) | Works, but Whatbox recommends against streaming from a mount |
| `fuse.mergerfs` | mergerfs pool | Only when both paths land on one underlying disk | Yes, if the pool's underlying disks are local | Yes |
| `overlay` | Container filesystem | See overlay trap above | Not advised | Not advised |
| other `fuse.*` | The type string as shown, such as "fuse.s3fs" | Assume no until a test link passes | Unknown | Unknown |

What a failed hardlink means for each folder:
- **Second versions on another drive from downloads:** the app makes these hardlinks itself and has no copy fallback, so import is impossible. Keep this a refusal.
- **Library on another drive from downloads:** Sonarr and Radarr cannot hardlink, so with "Use hardlinks instead of copy" on they copy the file instead. Disk use doubles while the torrent seeds (copy fallback described in [TRaSH Guides, Hardlinks and Instant Moves](https://trash-guides.info/File-and-Folder-Structure/Hardlinks-and-Instant-Moves/); Sonarr's own wording not verified, the Servarr wiki did not load). The relink fix in `relink.ts` cannot re-seed from the library. Seeding itself is unaffected. A warning fits: Plex plays from a network library fine.
- **Downloads on a cloud mount:** seeding breaks. Refuse.

## Path views

The app, Sonarr, Radarr, rTorrent and Plex each report paths in their own view. They differ when a service runs in a container with its own volume paths, on another machine (Sonarr's remote path mappings exist for this), or when one folder has two spellings.

**On the slot today** all five run on the host as the same user, with no mappings, so no container or remote mismatch exists. One spelling mismatch does: Sonarr's root folder is `/home/<user>/TV`, while its download client folder is `/mnt/mpathe/<user>/files/Sonarr/`. Both point into the same home folder through the `/home/<user>` symlink.

How the code copes with two spellings:
- `torrentFiles.ts` resolves symlinks on both the setting and the file path (`realpathSync`), so either spelling works.
- `relink.ts` compares Sonarr's or Radarr's series/movie path against `hostPaths library.<service>` as plain strings. A library folder saved as `/mnt/mpathe/<user>/TV` would refuse every relink with "… is outside hostPaths library.sonarr", because Sonarr says `/home/<user>/TV/…`. The wizard's prefill uses Sonarr's spelling, so this only bites if the owner retypes it.
- `versionImport.ts` checks that a Plex library's `Location` path contains the versions folder, also as plain strings. If Plex lists `/mnt/mpathe/<user>/PlexVersions` and the app saved `/home/<user>/PlexVersions`, the app reports "Add … to the Plex Movies library" for a folder Plex already reads. Plex's spelling on the slot not verified.

**Detecting a mismatch in the wizard:**
1. For every path a service reports (root folders, download client folders, Plex locations), `statSync` it from the app's side. Missing → that service sees the folder under another name. Show both and ask the owner for the app's spelling.
2. If it exists, compare `realpathSync` of the service's path and of the owner's chosen path. Same real path → same folder in another spelling; store the service's spelling so the plain-string comparisons above match.
3. Different real paths that the owner says are the same folder → compare `stat().dev` and `stat().ino` (the inode, the file's number on its disk) of both. Equal means the same folder reached two ways.
4. Read `/api/v3/remotepathmapping`. A non-empty list means rTorrent's paths differ from Sonarr's and Radarr's; the app reads rTorrent's paths in `relink.ts`, `torrentFiles.ts` and `versionImport.ts`, so it needs the same mapping applied, which no code does today.

**If the app ever runs in a Podman container:** mount the home folder at the same path inside (`-v /home/<user>:/home/<user>`), as one volume covering downloads, libraries and second versions. Separate volumes break hardlinks (link(2) above), and different inside paths break every path the services report.

## Open questions for the owner

1. Second versions: use the existing `~/PlexVersions` for movies (and a sibling for TV), or new `~/TV-versions` / `~/Movies-versions` that the wizard creates?
2. Is `~/PlexVersions` already a folder in a Plex library? (Not verified.) Should the wizard check Plex's library folders before saving, rather than after the first import?
3. Downloads: keep one folder for all three download settings, or save Sonarr's `files/Sonarr` and Radarr's `files/Radarr` separately, as their download clients use? With one parent folder, relinked files land in the parent instead of the service's own folder.
4. May the wizard write a small test file into each folder to prove hardlinks work, deleting it straight after?
5. Library on another drive: keep it a warning, or refuse?
6. Should the wizard refuse a downloads folder on a cloud or other FUSE mount outright?
7. Is a Podman deployment of the app planned? If not, container handling can wait.

## Decisions (owner, 11 Oct 2026)

1. **Picking:** downloads and library folders arrive filled in from Sonarr, Radarr and their download clients, to confirm. A "Change" link, and both second-version folders, open a folder browser served by the app: folder names only, behind the sign-in, starting at the home folder, with "Create folder".
2. **Second versions:** suggest the existing `~/PlexVersions` for movies and a TV sibling beside it.
3. **Downloads:** save each service's own download folder (Sonarr's and Radarr's download client folders) instead of one shared folder.
4. **Test hardlink:** on save, write a small test file into downloads, hardlink it into each library and second-version folder, check it, and delete both at once. A failed link refuses second-version folders and warns for library folders (warning decided 11 Oct, PR #72).
5. **Downloads on a cloud or other FUSE mount:** refused, following Whatbox's advice.
