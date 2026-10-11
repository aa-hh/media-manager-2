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

- **Separate mounts of one filesystem.** A bind mount makes an existing folder appear at a second place in the folder tree; a container's volume (`podman run -v host:container`) is one. Two bind mounts of the same disk report the **same** `dev`, yet `link()` between them fails: "Linux permits a filesystem to be mounted at multiple points, but link() does not work across different mounts, even if the same filesystem is mounted on both" ([link(2)](https://man.archlinux.org/man/link.2.en)). So if the app ran in a Podman container with downloads and library mounted as two volumes, the old `dev` comparison would have passed and every hardlink would then have failed with `EXDEV`. Comparing mountinfo mount IDs catches this; a test hardlink proves it.
- **overlay filesystems** (the layered filesystem container images use). Folders report the overlay's own `dev`, while "non-directory objects may report an st_dev from the lower filesystem or upper filesystem" ([kernel overlayfs docs](https://docs.kernel.org/filesystems/overlayfs.html)). `versionImport.ts` compares a folder's `dev` with a file's `dev`, which can differ on overlay even when the link would work. Volumes are bind mounts, not overlay, so this only bites if media sits inside a container's own filesystem.
- **FUSE mounts** (FUSE: a filesystem run by an ordinary program, such as rclone, mergerfs or sshfs, instead of the kernel). Each FUSE mount gets its own `dev`, so two folders on one mergerfs pool compare equal even when their files sit on different underlying disks. mergerfs can only hardlink when both paths land on the same underlying disk; otherwise the link fails with `EXDEV`, or mergerfs makes a symlink instead if its `link-exdev` option is set ([mergerfs manual](https://manpages.ubuntu.com/manpages/lunar/man1/mergerfs.1.html)). A symlink is not a hardlink: deleting the download breaks the library copy.

A symlink in the path does not mislead `statSync`, which follows it: `/home/<user>` reports device 64784 like `/mnt/mpathe/<user>`. `lstat` on the symlink itself reports the system disk (2431).

**Recommended check:** same mountinfo mount ID → "same drive"; then, at save time, a test hardlink between downloads and each second-versions folder (refuse on failure) and between downloads and each library folder (warn on failure). Save now makes this test hardlink (`testHardlink` in `setup.ts`) instead of comparing `dev`.

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
- **Library on another drive from downloads:** Sonarr and Radarr cannot hardlink, so with "Use hardlinks instead of copy" on they copy the file instead. Disk use doubles while the torrent seeds. Sonarr's settings page: "If the hard link creation fails or your setup does not support hard links then Sonarr will fall back and copy the file" ([Servarr wiki source](https://github.com/Servarr/Wiki/blob/master/sonarr/settings.md); the rendered wiki does not load outside a browser). Corrected 11 Oct: this line used to cite TRaSH Guides for the fallback, but that page does not describe it. The relink fix in `relink.ts` cannot re-seed from the library. Seeding itself is unaffected. A warning fits: Plex plays from a network library fine.
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
4. Read `/api/v3/remotepathmapping`. A non-empty list means rTorrent's paths differ from Sonarr's and Radarr's; the app reads rTorrent's paths in `relink.ts`, `torrentFiles.ts` and `versionImport.ts`, and no code translates them today. Applying the mapping turns rTorrent's spelling into Sonarr's, which is the app's spelling only when the app sees the disk as Sonarr does. An empty list does not prove the app shares the services' spelling either: in a container setup all services agree on `/data/...` while the app on the host sees `/mnt/user/data/...`. (Corrected 11 Oct: this item used to say applying the mapping was enough. See "Other people's setups".)

**If the app ever runs in a Podman container:** mount the home folder at the same path inside (`-v /home/<user>:/home/<user>`), as one volume covering downloads, libraries and second versions. Separate volumes break hardlinks (link(2) above), and different inside paths break every path the services report.

## Other people's setups

Findings from 11 Oct 2026, from documentation and the code only. Nothing in this section was tried on a live machine of these kinds.

**How common each setup is:** I found no survey. The order below follows how much the Servarr wiki and TRaSH Guides write about each, which is a guess at popularity, not a measure (not verified).

**Two terms used below.**
- **Remote path mapping:** a Sonarr and Radarr setting (Settings → Download Clients) with three fields, Host, Remote Path and Local Path. The Servarr wiki calls it "a DUMB search/replace": when the download client on that host reports a path starting with Remote Path, Sonarr swaps that start for Local Path ([Servarr wiki source](https://github.com/Servarr/Wiki/blob/master/sonarr/settings.md), section Remote Path Mappings). Sonarr's code compares the host without regard to case and uses the first mapping whose remote path contains the reported path ([RemotePathMappingService.cs](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/NzbDrone.Core/RemotePathMappings/RemotePathMappingService.cs), `RemapRemoteToLocal`). It turns the download client's paths into Sonarr's own spelling and nothing else: it says nothing about library paths, Plex's paths, or the app's spelling.
- **Bind mount:** a folder made to appear at a second place in the folder tree. A container volume (`-v /mnt/user/data:/data`) is one; inside the container the folder exists only under the inside name.

**Plex's spelling is recorded in one place.** Sonarr's and Radarr's Plex Media Server connection has two advanced fields, "Map Paths From" and "Map Paths To" (`MapFrom`, `MapTo` in [Sonarr's PlexServerSettings.cs](https://github.com/Sonarr/Sonarr/blob/v5-develop/src/NzbDrone.Core/Notifications/Plex/Server/PlexServerSettings.cs); same in [Radarr's](https://github.com/Radarr/Radarr/blob/develop/src/NzbDrone.Core/Notifications/Plex/Server/PlexServerSettings.cs)). Sonarr swaps the start of its root folder path for them before asking Plex to scan. They are readable through `GET /api/v3/notification`, and empty unless the owner set them.

### What the code assumes today

The `hostPaths` folders are used in several spellings at once. That only works when the app, rTorrent, Sonarr, Radarr and Plex all spell every folder the same way, as on the owner's slot.

| Code | What it does with the path | Spelling it needs |
|---|---|---|
| `relink.ts:94`, `secondVersions.ts:263` | Sends `hostPaths downloads.*` to rTorrent with `d.directory.set` | rTorrent's |
| `relink.ts:76-101`, `versionImport.ts:217-239`, `torrentFiles.ts:176-218` and `:299-303` | Reads, hardlinks and deletes files under the same folders | The app's |
| `relink.ts:57-61` | Checks Sonarr's or Radarr's series or movie `path` is inside `hostPaths library.<service>`, as text | Sonarr's or Radarr's |
| `versionImport.ts:257-258`, `:267` | Checks a Plex `Location` path contains `hostPaths versions.<service>`, then asks Plex to scan the app's spelling of the new folder | Plex's |
| `setup.ts:190-213`, `:57-58` | Suggests Sonarr's and Radarr's root folders and rTorrent's `directory.default`, then checks them with `statSync` | Suggests in the services' spellings, checks in the app's |

**When the app cannot open rTorrent's paths** (rTorrent in a container or on another machine):
- Re-link, `relink.ts:133-152`: a stopped torrent counts as one whose files are gone whenever `existsSync` is false, so every stopped torrent with a grab qualifies. If the app can see the library, the fix then closes the torrent and points it at the app's spelling of the download folder (`relink.ts:92-94`), which rTorrent may not have. The recheck fails and the torrent stays stopped, now pointing at the wrong folder. This one does damage; it has to be switched off in such setups, not left to fail.
- Delete dialog, `torrentFiles.ts:105-147`: a torrent file the app cannot find counts as absent with no gap noted (`:108`), so library files show `none` or `copied` instead of `unknown`, and no torrent is offered for removal.
- Torrent removal, `torrentFiles.ts:183-189`: refused with "… is outside every hostPaths downloads folder." Safe.
- Second-version import, `versionImport.ts:217`: `statSync` of the download fails and the row fails for good.

**When the app cannot open Sonarr's or Radarr's library paths:** title delete's wait step (`titleDelete.ts:68-75`, `:181-188`) counts a file it cannot find as deleted, so it reports "Sonarr deleted N library files" before Sonarr has. Data stays safe: torrent removal then lists the app's own library folder (`torrentFiles.ts:208-218`) and refuses while a library file still shares data with the torrent, or refuses outright when it cannot list that folder.

**When Plex spells the folder differently:** every import opens a false "Add … to the Plex Movies library" problem, and the scan request at `versionImport.ts:267` names a folder Plex does not know (what Plex does then: not verified).

### The setups

Each table says what each service calls the folders, then what the app can do from each place it could run. "Works" means today's code works there; "needs translation" means it works once the app turns each service's spelling into its own and back.

#### 1. Everything on one shared seedbox (Whatbox, Feral, Ultra.cc)

All services run natively on one machine as one user. One spelling, apart from symlinks (Whatbox's `/home/<user>` → `/mnt/mpathe/<user>`, covered in "Path views" above). Ultra.cc homes are `/homeN/<user>` (from an [older revision of Ultra.cc's Radarr guide](https://docs.ultra.cc/books/radarr/page/radarr/revisions/2551) seen in search results; not verified on the live page). Remote path mappings: none, except when the library sits on a cloud drive joined to local disk with mergerfs; Ultra.cc's guide then adds one so Sonarr reads downloads through the mergerfs spelling (same unverified source). Hardlinks: yes within the home disk, no on rclone mounts (label table above).

| | |
|---|---|
| App runs | On the seedbox, as the same user. What the README describes today. |
| Second versions | Works |
| Re-link | Works; not with a library on a cloud mount |
| Torrent removal | Works |
| Plex check | Works when Plex runs on the seedbox; see setup 7 otherwise |

#### 2. One machine, containers, TRaSH Guides' single `/data` layout (Unraid, Synology, plain Linux)

One host folder holds everything: `/mnt/user/data` on Unraid, `/volume1/data` on Synology. Every container mounts it, or a part of it, as `/data`: rTorrent gets `/data/torrents`, Plex `/data/media`, Sonarr and Radarr all of `/data` ([Servarr Docker guide source](https://github.com/Servarr/Wiki/blob/master/docker-guide.md), section "Consistent and well planned paths"; [TRaSH Docker](https://trash-guides.info/File-and-Folder-Structure/How-to-set-up/Docker/), [TRaSH Unraid](https://trash-guides.info/File-and-Folder-Structure/How-to-set-up/Unraid/), [TRaSH Synology](https://trash-guides.info/File-and-Folder-Structure/How-to-set-up/Synology/)). hotio's images show a single `-v /<host_folder_data>:/data` too ([hotio Sonarr](https://hotio.dev/containers/sonarr/)).

All services report `/data/...` and agree with each other, so remote path mappings are empty: "If both *Arr and your Download Client are Docker Containers it is rare a remote path map is needed" (Servarr wiki source above). Hardlinks work for Sonarr and Radarr, because downloads and library arrive through one mount. Unraid also needs "Tunable (support Hard Links)" switched on in Global Share Settings (TRaSH Unraid). Unraid's `/mnt/user` is Unraid's own FUSE filesystem, type `fuse.shfs` (not verified on a live Unraid); the label table above already treats an unknown FUSE type as "assume no until a test link passes", which fits.

| | App in a container with the same single mount | App on the host (plain Node) |
|---|---|---|
| What it sees | `/data/...`, like every service | `/mnt/user/data/...`; every path a service reports fails `statSync`, and the empty mapping list gives no hint |
| Second versions | Works (one mount, so its hardlinks work) | Needs translation (`/data` ↔ `/mnt/user/data`), which no service records: ask the owner |
| Re-link | Works | Needs translation; dangerous untranslated (see above) |
| Torrent removal | Works | Needs translation; refused untranslated |
| Plex check | Works | Needs translation |

The container must also run as the same user and group IDs as the services (`PUID`/`PGID` in linuxserver and hotio images: the user and group the container's program runs as), or it cannot delete or link their files.

#### 3. One machine, containers with the images' own folder names (`/tv`, `/movies`, `/downloads`)

linuxserver's Sonarr image documents separate `/tv` and `/downloads` volumes and warns they mean "losing the ability to hardlink" ([linuxserver Sonarr](https://docs.linuxserver.io/images/docker-sonarr/)). The Servarr Docker guide: such volumes "look like two different file systems, even if they are a single file system outside the container" (source above). Plex's own image documents `-v <path/to/media>:/data` with any layout inside ([plexinc/pms-docker](https://github.com/plexinc/pms-docker)). If rTorrent's container names its folder differently from Sonarr's (`/downloads` against `/data/downloads`), Sonarr has a remote path mapping between them. Sonarr and Radarr copy instead of hardlinking.

| | App in a container with the same separate volumes | App on the host |
|---|---|---|
| Second versions | Cannot work: link(2) fails across bind mounts even on one disk | Needs translation, one pair per volume, asked from the owner; then its hardlinks work, because the host sees one disk |
| Re-link | Cannot work, same reason | Needs translation. Works against Sonarr's copies too: it matches library files by size (`relink.ts:76-89`) and rTorrent's recheck accepts identical bytes |
| Torrent removal | Needs translation if rTorrent's spelling differs | Needs translation |
| Plex check | Needs translation | Needs translation |

#### 4. One machine, some services native and some in containers

Example: rTorrent native writing `/home/u/torrents`, Sonarr in a container seeing it as `/data/torrents`. Sonarr then has a remote path mapping (Host: rTorrent's address as Sonarr's download client names it; Remote `/home/u/torrents/`; Local `/data/torrents/`). The Servarr wiki names this case: a mapping is "possibly needed if mixing Docker and Native clients".

| | App native, beside rTorrent | App in Sonarr's container layout |
|---|---|---|
| rTorrent's paths | Read as they are | Apply Sonarr's mapping (remote → local); apply it in reverse before `d.directory.set` |
| Sonarr's download paths | Apply the mapping in reverse | Read as they are |
| Sonarr's library paths | No record; ask the owner | Read as they are |
| Hardlinks | Wherever the host's disk layout allows | Only if downloads and library arrive in one mount |

#### 5. A NAS holds the disk; services on other machines reach it over SMB or NFS

Example: rTorrent on the NAS writes `/volume1/data/torrents`; Sonarr on a PC sees it as `/mnt/nas/torrents` (Linux) or `\\nas\data\torrents` (Windows), with a remote path mapping between the two. The Servarr wiki: "Generally, a remote path map is only required if your download client is on Linux when *Arr is on Windows or vice versa." Sonarr's hardlinks over NFS are made by the NAS itself (NFS version 3 has a LINK call, [RFC 1813 §3.3.15](https://www.rfc-editor.org/rfc/rfc1813#section-3.3.15)), so they can work when downloads and library sit in one export mounted once; over SMB it depends on the server (not verified). Windows spellings (`D:\…`, `\\nas\…`) can never be opened by the app on Linux, and the code's `isAbsolute` checks reject them.

| | App on the NAS (native or in a container with the single mount) | App on the Sonarr PC, over the share |
|---|---|---|
| rTorrent's paths | Read as they are | Apply Sonarr's mapping; reverse it for `d.directory.set` |
| Sonarr's library paths | Ask the owner (no service records the NAS spelling of the library) | Read as they are |
| Second versions, re-link | Works once translated; hardlinks are local | Only if the share passes hardlinks through; every file operation crosses the network |
| Torrent removal | Works once translated | Works once translated, slowly |
| Plex check | Needs translation unless Plex also runs on the NAS | Needs translation unless Plex runs on the PC |

#### 6. rTorrent on a seedbox; Sonarr, Radarr and Plex at home, files pulled down by a sync tool

Sonarr's download client points at the seedbox's rTorrent. A sync tool (Resilio Sync, Syncthing, rclone, an lftp script) copies finished downloads into a home folder, and a remote path mapping (Host: the seedbox; Remote `/home/u/files/`; Local `/mnt/sync/`) tells Sonarr where the copy lands. Sonarr imports from the home copy and hardlinks it into the library if both share a disk. Every file then exists twice: the seedbox copy that seeds and the home copy. Sync tools expose half-copied files, so Sonarr can try to import too early (Sonarr forum threads seen in search results, such as [this one](https://forums.sonarr.tv/t/sonarr-and-seedbox-integration-so-that-pulls-video-from-seedbox-to-home/7518); not opened, not verified). A variant mounts the seedbox at home with sshfs or rclone instead of copying: Sonarr then copies across the network, and no hardlinks are possible.

No machine sees both rTorrent's seeding files and the library.

| | App on the seedbox | App at home |
|---|---|---|
| Second versions | Grab works. Import cannot work: Plex and the versions folder are at home | Grab works. Import could hardlink from the synced copy if the sync also carries `downloads.versions` and the app waits for the full file size; not built |
| Re-link | Cannot work: the home library cannot re-seed a seedbox torrent without uploading it | Cannot work |
| Torrent removal | Deleting seedbox files is safe, because nothing on the seedbox shares data with the home library; but `torrentFiles.ts:178-179` and `:209-221` refuse without a set, readable library folder, so the check would need to know the library is elsewhere | Can drop the torrent over XML-RPC (`d.erase`, which leaves the data; not verified) but cannot delete seedbox files |
| Plex check | Cannot check without Plex's spelling (setup 7) | Works when Plex runs natively at home |

#### 7. Plex on another machine (combines with any setup above)

Plex's `Location` paths are in Plex's spelling: `/data/media/movies` in a Plex container, `D:\Movies` on Windows, or the mount point of a network share. The only record of the translation is the Plex connection's "Map Paths From/To" in Sonarr and Radarr, when set. Otherwise only the owner knows. Second versions and re-link do not depend on Plex's spelling; the Plex check and the scan request do.

### Summary

| Setup | Where the app should run | Second versions | Re-link | Torrent removal | Plex check |
|---|---|---|---|---|---|
| 1. One seedbox | On it, same user | Works | Works | Works | Works |
| 2. Containers, single `/data` | Container, same single mount and IDs | Works | Works | Works | Works |
| 3. Containers, separate volumes | Host, with translations | Needs translation (cannot work in a container) | Needs translation | Needs translation | Needs translation |
| 4. Mixed native and containers | Beside rTorrent | Needs translation | Needs translation | Needs translation | Needs translation |
| 5. NAS plus other machines | On the NAS | Needs translation | Needs translation | Needs translation | Needs translation |
| 6. Seedbox plus home | Open question | Cannot work today | Cannot work | Seedbox side only, with a changed check | Home side only |
| 7. Plex elsewhere | No effect | No effect | No effect | No effect | Needs translation |

### How the wizard can tell which setup it is in, and translate

1. **Collect one sample from each service.**
   - rTorrent: `directory.default`, and the `d.directory`, `f.path` and `f.size_bytes` of one finished torrent.
   - Sonarr and Radarr: root folders; download clients (`/api/v3/downloadclient`: implementation, host, `tvDirectory` or `movieDirectory`); remote path mappings; one library file with its size (`/api/v3/episodefile?seriesId=`, a movie's `movieFile`); the Plex connection's `MapFrom`/`MapTo` (`/api/v3/notification`).
   - Plex: each section's `Location` paths, and one item's file path and size from `/library/sections/{key}/all` (the `Part` element's `file` and `size`; not verified).
2. **Test each sample from the app.** `statSync` the sample file and compare its size. Same size → the app shares that service's spelling. A folder is a weak test: the app's own container can have an unrelated `/data`. `realpathSync` and inode comparison only help within the app's own view (symlinked spellings such as Whatbox's home folder); they cannot connect a container's `/data` to the host's `/mnt/user/data`.
3. **On a miss, try the translations the services record, then retest the same sample:**
   - App shares Sonarr's spelling → apply Sonarr's remote path mappings to rTorrent's paths, by Sonarr's rules (host compared without case, first mapping whose remote path contains the path, swap that start). Use the host from Sonarr's rTorrent download client, not the app's `rtorrent.url`: the two can name the same rTorrent differently (container name against public address). Ask the owner if Sonarr has several rTorrent clients.
   - App shares rTorrent's spelling → the same mappings in reverse cover Sonarr's download paths. Library paths have no record.
   - Plex → the Plex connection's `MapFrom`/`MapTo`, reversed.
4. **Still a miss → ask the owner.** Show the service's path (`/data/media/tv`) beside the folder browser from Decision 1. The owner picks the same folder in the app's view; the app drops the shared ending of both paths to get a pair of starts (`/data` ↔ `/mnt/user/data`) and retests the sample.
5. **Store and use the translations.** Per service, a list of (start as the service writes it, start as the app sees it). Translate every path read from that service; translate back every path sent to it (`d.directory.set` at `relink.ts:94` and `secondVersions.ts:263`, Plex's scan path at `versionImport.ts:267`). `hostPaths` then hold the app's spelling only, and the text comparisons at `relink.ts:57-61` and `versionImport.ts:257-258` run after translation.
6. **Prove the app's own hardlinks** with the save-time test link (Decision 4); it runs in the app's spelling, which is where the app makes its links. Sonarr's and Radarr's own hardlinks are visible only as an outcome (library files shown `linked` or `copied` in the delete dialog).
7. **When the app cannot see a service's files at all, switch features off and say why** instead of letting them fail:

| App cannot open | Switch off | Wording, for example |
|---|---|---|
| rTorrent's download folder | Second-version import, re-link, file deletion on torrent removal | "media-manager-2 can't open rTorrent's download folder `/data/torrents`, so it won't import second versions, re-link deleted downloads or delete torrent files." |
| The library | Re-link, file deletion on torrent removal | "… can't open the TV library, so it can't prove a torrent's files are safe to delete." |
| Plex's folders (no translation known) | Nothing; skip the Plex check | "Plex's name for this folder is unknown, so the app can't confirm Plex reads it." |

   Features that only call the services' web APIs do not touch the disk and keep working.
8. **Three code spots read "cannot see" as "gone"** and need fixing before any setup other than setup 1 or 2 is supported: `relink.ts:151` (the damaging one above), `titleDelete.ts:68-75`, and `torrentFiles.ts:108`, which records no gap for a torrent file it cannot find.

### Where the app should run

The rule: on the machine that holds the downloads disk, where it can open rTorrent's files and the libraries, ideally under the same names rTorrent and Sonarr/Radarr use, and as their user (or user and group IDs).

- Setup 1: on the seedbox, as the same user.
- Setups 2 and 3: as a container in the same stack, with one mount of the whole data folder at the inside path the services use, and their `PUID`/`PGID`. The README says the app "runs as a plain Node process with no container" (README.md, "Keep it running"), so this needs a container image or documented steps (open question 1).
- Setups 4 and 5: on the machine with the disk, beside rTorrent.
- Setup 6: no good place; see the open questions.
- Plex's location does not matter: the app reaches Plex over HTTP and needs only Plex's spelling.

**What the README and wizard should tell people.** README "What you need" gains a line: media-manager-2 reads, hardlinks and deletes files in your download and library folders itself, so run it on the machine that holds them, as the same user as rTorrent and Sonarr/Radarr; if those run in containers, run it in a container with the same data mount. The wizard's Folders step opens with what it found: whether it can open rTorrent's files, each library and Plex's folders, each as "same names", "translated" or "can't open", followed by the questions or the features it switched off.

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
2. **Second versions:** suggest a folder a Plex Movies or TV library already reads; otherwise create one beside the library. (Owner's server: `~/PlexVersions` for movies and a TV sibling beside it.)
3. **Downloads:** save each service's own download folder (Sonarr's and Radarr's download client folders) instead of one shared folder.
4. **Test hardlink:** on save, write a small test file into downloads, hardlink it into each library and second-version folder, check it, and delete both at once. A failed link refuses second-version folders and warns for library folders (warning decided 11 Oct, PR #72).
5. **Downloads on a cloud or other FUSE mount:** refused, following Whatbox's advice.

## Open questions (general setups)

1. Ship a container image for the app, or documented steps to run it in one? Without that, container users (setups 2 and 3) need a translation for every path.
2. Build the per-service path translations in v1, or support only setups where the app shares rTorrent's and Sonarr's/Radarr's spelling (setups 1 and 2 with the app in a container) and switch features off everywhere else?
3. Seedbox plus home sync (setup 6): in scope for v1? If so, should the app run on the seedbox or at home?
4. Setup 6 with the app on the seedbox: once the owner confirms the library is on another machine, may torrent removal delete seedbox files without the library check?
5. Windows Sonarr, Radarr or Plex: support Windows spellings (`D:\…`, `\\nas\…`), or require Linux or macOS spellings?
6. Fix the three spots that read "cannot see" as "gone" (`relink.ts:151`, `titleDelete.ts:68-75`, `torrentFiles.ts:108`) now, ahead of the wizard? The re-link one can point a stopped torrent at a folder rTorrent does not have.
7. May the wizard open one sample file listed by each service to test the app's view? It only reads metadata (`statSync`), writes nothing.
8. Sonarr or Radarr with more than one rTorrent download client: ask the owner which one is the rTorrent the app talks to?
