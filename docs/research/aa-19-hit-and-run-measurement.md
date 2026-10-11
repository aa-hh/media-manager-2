# How to measure hit and run status accurately (AA-19)

Researched 2026-10-08. No tracker was signed in to. Every rules, FAQ and API docs page on Beyond-HD, PrivateHD and Blutopia redirects to a sign-in page (`curl` of beyond-hd.me/rules, privatehd.to/rules, privatehd.to/faq, blutopia.cc/pages/rules all returned 302 to the login page), so tracker-specific facts below come from open-source code and are marked where unconfirmed.

Source versions read:

- UNIT3D (the software Blutopia runs): github.com/HDInnovations/UNIT3D at commit `8b88f4c` (2025-12-03).
- rTorrent: github.com/rakshasa/rtorrent at commit `728790a` (2026-10-06).
- ruTorrent: github.com/Novik/ruTorrent at commit `f9c5a32` (2026-10-06).
- v1: `scripts/lib/collectors/rutorrent.py`, `scripts/lib/processors/torrents.py`, `scripts/lib/collectors/tracker_accounts.py`, `config/tracker_rules.json`.

## Answers

1. **Global ratio for Beyond-HD and PrivateHD.** Neither site has a known API endpoint for it. The only place found is the signed-in profile page. Unconfirmed until the owner checks while signed in.
2. **Seed time.** Blutopia counts only time actually seeding (confirmed from UNIT3D source). Beyond-HD and PrivateHD are unconfirmed. rTorrent's finish timestamp and ruTorrent's seeding-time plugin both give wall-clock time since finishing, so neither measures real seeding. media-manager-2 should add up seeding time itself from its regular rTorrent poll.
3. **PrivateHD GB.** Could not confirm 1000³ or 1024³. Until the owner checks, use 1000³: it gives the longer seed time, so it never recommends removing a torrent too early.

## 1. Where to read the global ratio

**Blutopia** (UNIT3D): `GET /api/user` returns `ratio` ([routes/api.php line 56](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/routes/api.php#L56), [UserResource.php line 50](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Http/Resources/UserResource.php#L50)). It is a string, and is `"∞"` when nothing has been downloaded ([User.php lines 1158-1167](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Models/User.php#L1158-L1167)). v1 runs `float()` on it (`tracker_accounts.py` line 51), which raises an error on `"∞"`. `uploaded` and `downloaded` in the same response are formatted text such as `"1.2 TiB"`, not byte counts.

**Beyond-HD**: The only API the open-source tools use is torrent search, `POST /api/torrents/{api key}`, whose results hold torrent fields only (name, size, seeders, freeleech flags), no account fields ([Prowlarr BeyondHD.cs lines 164 and 458-515](https://github.com/Prowlarr/Prowlarr/blob/develop/src/NzbDrone.Core/Indexers/Definitions/BeyondHD.cs)). v1 uses the same call only to confirm the key works (`tracker_accounts.py` lines 63-85). The FlexGet plugin `flexget_qbittorrent_mod` reads the ratio from the signed-in profile page by matching the text after "Ratio" ([beyond-hd.py](https://github.com/madwind/flexget_qbittorrent_mod/blob/master/ptsites/trackers/beyond-hd.py)). It signs in with Beyond-HD's "One URL (OID)": a personal link, made under My Security, that signs you in when opened. That would let media-manager-2 read the profile without storing a password, but it is a third-party claim.

**PrivateHD**: The API (`/api/v1/jackett/auth` then `/api/v1/jackett/torrents`) returns torrent fields only ([Prowlarr AvistazApi.cs](https://github.com/Prowlarr/Prowlarr/blob/develop/src/NzbDrone.Core/Indexers/Definitions/Avistaz/AvistazApi.cs), [AvistazRequestGenerator.cs line 23](https://github.com/Prowlarr/Prowlarr/blob/develop/src/NzbDrone.Core/Indexers/Definitions/Avistaz/AvistazRequestGenerator.cs)). The same FlexGet plugin reads uploaded, downloaded and ratio from the `.ratio-bar` element of `/profile/{username}` using a signed-in browser cookie ([schema/avistaz.py](https://github.com/madwind/flexget_qbittorrent_mod/blob/master/ptsites/schema/avistaz.py)). It also reads a "Hit & Run" count from the same page.

No RSS feed with account stats was found for either site.

**Owner to check while signed in:**

- Beyond-HD: the API docs page linked from your account settings. Is there an endpoint for your own stats? If not, does the One URL link exist under My Security, and does opening it show your ratio?
- PrivateHD: the API page and the FAQ. Is there any account-stats endpoint? Does `/profile/{your username}` show ratio in the top bar?
- Both: do the rules allow automated reading of the profile page? Scraping is sometimes banned.

## 2. Seed time: wall-clock or actual seeding

### What each tracker counts

**Blutopia: actual seeding time only.** Confirmed from UNIT3D source. Each announce (the client's regular check-in with the tracker) is queued with `seedtime => 0` ([ProcessAnnounce.php line 210](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Jobs/ProcessAnnounce.php#L210)). When the queue is saved, seed time grows by the gap since the previous announce only if that previous announce was under 5400 seconds (90 minutes) ago, the torrent was seeding and active then, and it is still seeding now ([AutoUpsertHistories.php line 100](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Console/Commands/AutoUpsertHistories.php#L100)). So time while stopped, offline or unable to reach the tracker does not count.

Stock UNIT3D hit and run rules ([config/hitrun.php](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/config/hitrun.php)):

- 604800 seconds (168 hours) of seed time. Matches v1's 168 for Blutopia.
- Ratio does not clear it. The check looks at seed time only ([AutoWarning.php lines 59-69](https://github.com/HDInnovations/UNIT3D/blob/8b88f4c8182eb3d3912ffef425c3224dcfd596f4/app/Console/Commands/AutoWarning.php#L59-L69)).
- Only applies if you downloaded more than 10% of the torrent's size from peers (`buffer` = 10). A torrent added already complete, with nothing downloaded, can never become a hit and run.
- Pre-warning after 1 day not seeding, hit and run after 3 more days (`prewarn` = 1, `grace` = 3).

Blutopia can change these settings; the owner should confirm 168 hours on the rules page. Blutopia's per-torrent seed time is shown on the site but not in the API: `routes/api.php` has no history endpoint.

**Beyond-HD: unconfirmed.** Its code is closed. The FlexGet plugin treats it as UNIT3D-based ([beyond-hd.py](https://github.com/madwind/flexget_qbittorrent_mod/blob/master/ptsites/trackers/beyond-hd.py) extends `Unit3D`). The rule text v1 copied (`config/tracker_rules.json`: "48h continuous offline triggers pre-warning") warns about being offline, which only matters if offline time does not count. Likely actual seeding time.

**PrivateHD: unconfirmed.** Closed code; no public rules page.

### How rTorrent and ruTorrent record it

- rTorrent sets `d.timestamp.finished` once, the first time the download finishes or a hash check finds it complete (`set_if_z`, only if still zero) ([src/main.cc lines 231-233](https://github.com/rakshasa/rtorrent/blob/728790a2b4d2f4e49d9bd66f707ece439c383238/src/main.cc#L231-L233)). v1 computes seed hours as now minus that time (`rutorrent.py` lines 133-136). That counts every hour the torrent was stopped or rTorrent was down, so v1 can say "met" before the tracker does.
- ruTorrent's seedingtime plugin does the same thing: on finish it stores the current date in a custom field named `seedingtime`, and on add it stores `addtime` ([plugins/seedingtime/init.php](https://github.com/Novik/ruTorrent/blob/f9c5a32bd0e6d64f9411e6d56fe4ed532a1dc0e1/plugins/seedingtime/init.php)). It is a finish timestamp, not a running total, so it does not help.
- rTorrent has no built-in running total of seeding time.

### Ways media-manager-2 could measure it

| Option | How | Strength | Weakness |
|---|---|---|---|
| Add up from its own poll (recommended) | The decision in AA-7 already reads every torrent every 30 to 60 seconds. On each read, if the previous and current reads both show `d.complete` = 1 and `d.is_active` = 1, add the time between them to that torrent's total in media-manager-2's database. Skip gaps longer than some limit (UNIT3D uses 90 minutes), so downtime is never counted. | No change to rTorrent. Uses data already fetched. | Misses seeding while media-manager-2 is down, which undercounts. Undercounting only delays a "safe to remove". |
| Counter inside rTorrent | A `schedule2` timer that adds 60 to a custom field (`d.custom.set`, `math.add`) on each complete, active torrent every 60 seconds. All three commands exist in current rTorrent ([command_download.cc line 753](https://github.com/rakshasa/rtorrent/blob/728790a2b4d2f4e49d9bd66f707ece439c383238/src/command_download.cc#L753), [command_ui.cc line 907](https://github.com/rakshasa/rtorrent/blob/728790a2b4d2f4e49d9bd66f707ece439c383238/src/command_ui.cc#L907), [main.cc line 396](https://github.com/rakshasa/rtorrent/blob/728790a2b4d2f4e49d9bd66f707ece439c383238/src/main.cc#L396)). | Keeps counting when media-manager-2 is down. Custom fields are saved with the torrent. | Needs the timer in rTorrent's config file, or re-sent over XML-RPC after every rTorrent restart (ruTorrent plugins do the latter). Unknown whether Whatbox lets users edit rTorrent's config. Current rTorrent source lets untrusted XML-RPC callers read `d.custom` but not call `d.custom.set` (`mark_safe` list, [command_download.cc lines 996-1001](https://github.com/rakshasa/rtorrent/blob/728790a2b4d2f4e49d9bd66f707ece439c383238/src/command_download.cc#L996-L1001)). |
| ruTorrent seedingtime plugin | Read the `seedingtime` custom field. | Already exists. | Same wall-clock flaw as `d.timestamp.finished`. |

For both counting options, torrents that were seeding before counting started have no history. For those, wall-clock since `d.timestamp.finished` is an upper bound only; show it as an estimate, or rely on the ratio side of an "or" rule.

`d.is_active` = 1 means started and not paused ([rTorrent command reference](https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html)). It does not prove the tracker accepted the announce. A tracker error would stop the tracker counting while rTorrent still shows active.

## 3. PrivateHD: 1000³ or 1024³ bytes per GB

Not confirmed. The rules page is behind sign-in and AvistaZ's code is closed.

- v1 divides by 1024³ (`rutorrent.py` line 153, `torrent_size_gb`).
- PrivateHD's API returns `file_size` in bytes ([Prowlarr AvistazApi.cs](https://github.com/Prowlarr/Prowlarr/blob/develop/src/NzbDrone.Core/Indexers/Definitions/Avistaz/AvistazApi.cs)), so either reading is easy to compute.
- On a 40,000,000,000-byte torrent: 72 + 2 × 40 = 152.0 hours with 1000³, 72 + 2 × 37.25 = 146.5 hours with 1024³. A 5.5 hour gap.
- The formula is continuous at 50 GB (72 + 2 × 50 = 172; 100 × ln(50) − 219.2023 = 172.0), so v1's copy of the formula is at least self-consistent.
- The FlexGet plugin's PrivateHD pattern expects sizes written as "GB", where its Beyond-HD pattern expects "GiB" ([schema/avistaz.py](https://github.com/madwind/flexget_qbittorrent_mod/blob/master/ptsites/schema/avistaz.py)). This shows the label PrivateHD prints, not which byte count it means.

Until checked, 1000³ is the safe choice: it always gives the longer requirement.

**Owner to check while signed in:** pick a torrent between 1 and 50 GB on your PrivateHD hit and run or seeding history page, note the exact byte size from its details page and the required seed time the site shows, then compare against 72 + 2 × (bytes ÷ 1,000,000,000) and 72 + 2 × (bytes ÷ 1,073,741,824). Also check whether the rules say if seed time means actual seeding.
