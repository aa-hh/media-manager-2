# Which v1 code carries over (AA-11)

Source: v1 at https://github.com/aa-hh/media-manager, commit `75b5f9a` (the clone holds one commit, dated 2026-06-14, so there is no file history to judge how settled each file is). All paths below are inside that repo. Playback statistics and the deletion score are left out.

## Answer

| Piece | Works? | Tests | Verdict |
|---|---|---|---|
| Hit and run rules (`config/tracker_rules.json`) | Yes, matches each tracker's published rule as written in its comments | None of its own | Copy the numbers, move them into settings |
| Hit and run check (`scripts/lib/processors/torrents.py`) | Yes for the three trackers, with two bugs | No direct tests; 27% of lines run by other tests | Rewrite, keeping the PrivateHD formula and the and/or logic |
| Tracker account checks (`scripts/lib/collectors/tracker_accounts.py`) | Only Blutopia returns a global ratio; Beyond-HD and PrivateHD only confirm the login works | None; 10% of lines run | Rewrite |
| Service health checks (`scripts/lib/collectors/services.py`) | Yes, but only checks "does it answer" and the version | Good; 95% of lines run | Rewrite small, copy the Sonarr/Radarr version check |
| Sonarr reader (`scripts/lib/collectors/sonarr.py`) | Yes, read only | Some; 67% of lines run | Copy the history reader, leave the rest |
| Radarr reader (`scripts/lib/collectors/radarr.py`) | Yes, read only | Some; 74% of lines run | Copy the history reader and file details, leave the rest |
| ruTorrent reader (`scripts/lib/collectors/rutorrent.py`) | Mostly; tracker address likely never filled | None; 8% of lines run | Copy as the starting point for reading rTorrent, with fixes |
| TMDB reader (`scripts/lib/collectors/tmdb.py`) | Yes | Full; 100% of lines run | Copy as is if the first version needs posters |

None of v1 searches, lists releases, grabs, replaces, or deletes through Sonarr or Radarr. Those parts of the first version start from nothing.

## Test run

Run in an isolated virtual environment (a private Python install in the scratch folder), never touching real services: `python -I -m pytest <v1>`.

- With only `requirements.txt` installed: `1 failed, 265 passed, 132 errors`. The 132 errors come from two packages the tests need that no requirements file lists: `pytest-mock` (73 errors) and `httpx` (59 errors, needed by `auth_proxy/app.py:8`).
- With those added: `3 failed, 395 passed, 3274 warnings in 6.43s`.
- The 3 failures: one is playback statistics (out of scope). Two are in `tests/test_run_orchestration.py` and are out of date with the code, not code bugs: one test's settings lack the `rutorrent_url` key that `scripts/run.py:131` and `:322` read, and the other expects library items without the `torrent` field that `torrents.py:238-241` adds.
- Line coverage per file comes from `pytest --cov`.

## Hit and run rules: `config/tracker_rules.json`

Three trackers, each keyed by its web address:

- PrivateHD (`privatehd.to`, lines 4-10): seed time from a size formula OR torrent ratio 0.9. Global ratio minimum 1.0.
- Blutopia (`blutopia.cc`, lines 12-17): 168 hours seeding. Global ratio minimum 0.4.
- Beyond-HD (`beyond-hd.me`, lines 19-24): 120 hours OR torrent ratio 1.0. Global ratio minimum 0.25.

Each entry's `_comment` records extra tracker rules the code never reads, such as Blutopia's warning after 72 hours disconnected and Beyond-HD's limit of 3 hit and runs before losing download rights. I did not check these numbers against the trackers' own rule pages; they need the owner to confirm.

Verdict: copy the numbers and comments into the first version's settings. The map's Notes already say tracker values belong in settings, not code.

## Hit and run check: `scripts/lib/processors/torrents.py`

What it does:

- `_privatehd_required_hours` (lines 27-38): 72 hours up to 1 GB, then 72 + 2 hours per GB below 50 GB, then `100 * ln(size) - 219.2023`. I ran it: 1 GB gives 72.0, 49.99 GB gives 171.98, 50 GB gives 172.0, 100 GB gives 241.31, so the pieces join without a jump.
- `_check_requirements` (lines 84-146): applies "and" or "or" across the hours and ratio conditions and returns each condition's result plus the overall answer.
- `_find_rule` (lines 53-72): matches a tracker web address, or an indexer name such as "BeyondHD (Prowlarr)", to a rule by comparing lowercased letters and digits.
- `apply` (lines 162-276): links each rTorrent torrent to a Sonarr series or Radarr movie by the torrent's hash (its unique ID) found in Sonarr's and Radarr's grab history, then attaches the check result.

Problems:

1. A failed global ratio marks every torrent from that tracker as "not met" (lines 226-227). The glossary says the global ratio is separate from a single torrent's hit and run rule. For the delete question ("is it safe to remove this torrent?") this gives the wrong answer: removing a torrent whose own rule is met does not cause a hit and run, whatever the account ratio.
2. Matching is too loose. Line 66 accepts any tracker text that appears inside a rule key, so a tracker named `hd` matches PrivateHD. I confirmed this by running it. Line 70 checks only the rule key's length, not the tracker's.
3. Seed hours count wall-clock time since the download finished (`rutorrent.py:133-136`). A torrent that was stopped for a week still counts that week, while the trackers count only time actually seeding. The answer can say "met" too early.
4. Sizes use 1024³ bytes per GB (`rutorrent.py:153`). If PrivateHD means 1000³, a 40 GB torrent reads as 37.25 GB and needs about 5.5 fewer hours. Needs checking against PrivateHD's rule page.
5. Only one torrent per TV series is kept (lines 194-236, keyed `tv:{seriesId}`). The first version deletes single versions of single episodes, so it needs one result per torrent.
6. `min_global_ratio` of 0 is treated as "no minimum" (line 254 tests truthiness). Harmless today.

Tests: none call these functions directly. 27% of lines run, through `tests/test_run_orchestration.py`.

Verdict: rewrite, with tests. Keep the PrivateHD formula, the and/or logic, and the name matching idea (Sonarr and Radarr record the indexer name, which is how a torrent's tracker is found when rTorrent does not supply it, line 203). Drop the global ratio override and the per-series grouping.

## Tracker account checks: `scripts/lib/collectors/tracker_accounts.py`

- Blutopia (`_fetch_unit3d`, lines 36-60): reads `/api/user` and returns the global ratio and seeding count. Works.
- Beyond-HD (`_fetch_beyondhd`, lines 63-91): runs a search only to prove the API key works. Ratio is always empty; the file's own header (line 5) says Beyond-HD has no account statistics endpoint.
- PrivateHD (`_fetch_avistaz`, lines 94-142): logs in and fetches one torrent to prove the login works. Ratio is always empty.

So the global ratio check works for one tracker of three. The three trackers and their setting names are written into the code (lines 154-190), and it reads its own copy of the settings file (lines 14-25) instead of the shared `scripts/lib/config.py`.

Tests: none. 10% of lines run.

Verdict: rewrite. The Blutopia call is short enough to copy. Getting a global ratio from Beyond-HD and PrivateHD needs a different source (for example, each site's profile page), which is an open question.

## Service health checks: `scripts/lib/collectors/services.py`

- Sonarr and Radarr (`_check_arr`, lines 66-98): calls `/api/v3/system/status` for the version and `/api/v3/update` for available updates. Supports several instances of each, separated by commas (lines 101-122).
- Also checks Overseerr, Tautulli, Plex and TMDB (lines 125-249). Overseerr and Tautulli are out of scope for the first version.
- It does not check rTorrent, and does not call Sonarr's or Radarr's own `/api/v3/health` endpoint, which lists their warnings (for example "indexer unavailable" or "download client unreachable").
- `trigger_cmd` (lines 93-97) writes a ready-to-run update command containing the API key in plain text. `scripts/run.py:372` saves it to `data/services.json` on disk; the copy published to the dashboard (`scripts/generate.py:1355`) leaves it out.

Tests: `tests/test_services.py`, 95% of lines run, all passing.

Verdict: rewrite as a small module. Copy the version and update check. Add rTorrent and Sonarr/Radarr's own health warnings. Drop `trigger_cmd`.

## Sonarr reader: `scripts/lib/collectors/sonarr.py`

- `fetch` (lines 75-125): lists all series with sizes and season counts, plus quality profile names (lines 7-16).
- `fetch_history` (lines 43-72): pages through every grab event (`eventType: 1`) and returns hash, series ID and indexer name. A failure part way through returns the pages read so far with only a warning (lines 69-70). It re-reads the full history on every run.
- `fetch_episodefiles` (lines 19-40): one request per series.

Tests: `tests/test_collectors.py:122` and `:149` cover `fetch`. Nothing covers `fetch_history`. 67% of lines run.

Verdict: copy `fetch_history` (it is the link between a torrent and a library item) with a test added. Leave the rest; the first version needs search, release lists and grabs, which v1 never did.

## Radarr reader: `scripts/lib/collectors/radarr.py`

- `fetch` (lines 105-142): lists all movies with file details.
- `_extract_file_info`, `_normalise_codec`, `_fmt_resolution`, `_is_hdr` (lines 7-70): turn Radarr's file details into labels like "4K", "H.265", HDR yes or no. Well tested.
- `fetch_history` (lines 73-102): same as Sonarr's, same weaknesses.

Tests: `tests/test_collectors.py:32-120`. Nothing covers `fetch_history`. 74% of lines run.

Verdict: copy the file detail helpers (useful when showing versions side by side) and `fetch_history` with a test. Leave `fetch`.

## ruTorrent reader: `scripts/lib/collectors/rutorrent.py`

Despite the name, it talks to rTorrent directly over XML-RPC (rTorrent's remote control protocol), which is what the first version needs.

- `fetch` (lines 29-163): asks for 10 fields per torrent hash in one batched request (`system.multicall`), trying `/xmlrpc` then `/RPC2` (lines 34-42). Works out status (seeding, stopped, downloading), ratio, size and seed hours.
- Only reads torrents whose hashes it is given (line 31), so it cannot see torrents Sonarr and Radarr do not know about, such as second versions grabbed outside them.
- `d.tracker_url` (line 25) is not an rTorrent command as far as I know; tracker addresses in rTorrent are read per tracker with `t.url`. The code tolerates a failed field (lines 97-99), so the tracker probably always comes from Sonarr's or Radarr's history instead (`torrents.py:203`). Needs checking against the live rTorrent on Whatbox.
- A paused torrent that is complete shows as "unknown" (lines 114-121).
- Seed hours problem: see problem 3 under the hit and run check.

Tests: none. 8% of lines run.

Verdict: copy as the starting point, with tests, and fix: read the tracker with `t.multicall`, list all torrents rather than only known hashes, and decide how to count real seeding time.

## TMDB reader: `scripts/lib/collectors/tmdb.py`

- `_fetch_one` (lines 23-45): fetches poster, backdrop, rating, genres, overview and runtime for one movie or show.
- `enrich` (lines 48-89): fetches missing entries 8 at a time and keeps them in a cache file. Cached entries never expire, so a changed poster is never picked up.

Tests: `tests/test_tmdb.py`, 100% of lines run, all passing.

Verdict: copy as is if the first version shows posters. Search in the first version goes through Sonarr and Radarr, which return TMDB data themselves, so this may not be needed at all.

## Open questions

- Where can the first version read the global ratio for Beyond-HD and PrivateHD, since neither site's API returns it?
- How should seed time be counted: wall-clock time since the download finished (v1), or time rTorrent actually spent seeding? rTorrent does not keep the second directly.
- Does PrivateHD's size formula use 1000³ or 1024³ bytes per GB?
