# Work order — AA-66 (Re-link a stopped torrent to its surviving library file)

Repo: `/home/user/media-manager-2`, branch `claude/project-thread-i8zine` = `origin/main` 917c2b6. Working tree has two mode-only changes (`.githooks/project.conf`, `scripts/deploy.sh`, 644→755); they are not needed by this work and must be left alone. No risk paths exist (`is_risk_path` is `__none__`, `scripts/review-branch.sh:62-70`), but invariants and test cases are listed first.

## Goal

Add an automatic fix, `src/server/relink.ts`, run by the job runner every 60 s like the stall fix: when rTorrent has stopped a Sonarr/Radarr-grabbed torrent (or reports missing data) because its download files were deleted while the library still holds hardlinks of the same files, re-link the library files into a fresh folder under the per-service download root, re-hash in rTorrent, and start it again so seeding resumes with no re-download and no hit-and-run. Every attempt is one problem record (kind `download_missing`) in the AA-52 problems store; a success ends `resolved`, anything else ends `needs_you` with the last `fix` step naming where it stopped. It ports Media Manager 1's hand-run `reseed_stopped.py` for the owner's Whatbox slot, where the app, rTorrent, the download folders and the libraries share one host and one device.

## Invariants (the tests below encode them)

1. **No rTorrent write before the whole plan is proven.** `d.close`, `d.directory.set`, `d.open`, `d.check_hash`, `d.start`, `d.message.set` are issued only after: grab record found, not protected, settings present, every download file absent on disk, every torrent file matched to a distinct same-size library file, same device. Any earlier failure flags `needs_you` with zero rTorrent writes.
2. **`d.start` only when `d.complete` is `1`** after the hash wait. Otherwise `needs_you`, torrent left open and stopped.
3. **Exact byte-size matching only.** No name, extension or fuzzy matching. One library file matches at most one torrent file.
4. **Manual downloads (protected items) are never re-linked.** The problem is opened and set `needs_you`.
5. **Torrents without a grab record, still in the Arr queue, marked failed, already handed to the stall fix (`stall_watch.replaced_at` set) or awaiting replacement (`torrent_issues.replace = 1`) are skipped silently** — no problem opened.
6. **A torrent whose download files still exist is not this problem** — skipped silently even if stopped.
7. **No wall-clock waits in tests**: the `d.hashing` poll uses an injected `sleep` and the injected `now`, with a ceiling.
8. **At most one open problem per torrent for this kind** (`problems.ts:89`); an open `handling` problem found on a later pass is turned into `needs_you` instead of re-running the fix.

## Verified facts

- Deployment runs the server on the Whatbox slot itself (`scripts/deploy.sh:1-3`, `:44-56`, `:88-91`), so the app shares rTorrent's filesystem and `node:fs` `linkSync` is the right tool.
- The settings table already allows category `hostPaths` with free-form keys (`src/server/database.ts:29-34`, `src/server/settings.ts:3-8`); nothing reads `hostPaths` yet. `readSetting` returns `undefined` for missing or empty (`src/server/services/connection.ts:23-26`). The CLI writes any category/key (`src/server/cli.ts:8-12`, `:58`), documented in `README.md:35-55`.
- Torrent rows: `Torrent` type `src/server/torrents.ts:7-28`; `started` is `d.state` (`:41`), `message` is `d.message` (`:45`), `name` is `d.name` (`:36`); `listTorrents` `:129`. Poller skips nothing by state, so stopped torrents are in the table.
- Grab records: `Grab` `src/server/torrentGrabs.ts:9-22` (`movieId`, `seriesId`, `episodeIds`, `failedAt`, `importedAt`); `findGrab(database, hash)` `:85`; `listQueue(database)` `:95` with `downloadId` (`:27`). `importedAt` is NOT a reliable "imported" signal; absence from `arr_queue` is the gate used here.
- Problems API: `createProblems` returns `{ open, step, setState, recordReleaseAttempt, syncDependencies, pausedBy }` (`src/server/problems.ts:67-149`). `open` returns the existing open problem unchanged when one exists for the same kind+subject (`:89-92`); `step(id, 'fix'|'result', text)` `:104`; `setState(id, state, text)` `:111`; `pausedBy(names)` `:143`. `listOpenProblems(database)` `:53`; `Problem.hash` `:15`; `Subject` `:6`. Existing kinds are plain snake_case strings.
- Downloads screen renders a problem-only row's status as `problem.kind.replace(/_/g, ' ')` (`src/client/downloads/model.ts:276`); no client change is needed.
- Stall fix shape to mirror: `createStallFix(options: { database; rtorrent: { call: XmlRpcCall }; arr: Record<Service, { request: ArrRequest }>; problems; trackers; now?; isManualDownload })` (`src/server/stalls.ts:67-75`); `XmlRpcCall` (`:12`); `subjectsOf(grab)` (`:40-42`, private — copy the 3 lines, do not export); `f.multicall` call shape (`:135`); torrent subject `{ type: 'torrent', service: null, id: hash }` (`:200`); `pausedBy(['rtorrent', grab.service])` gate (`:207`); the stall check skips stopped torrents and torrents with a message (`:260-262`).
- `XmlRpcParam = string | number` (`src/server/services/rtorrent.ts:18`); `call` throws on faults (`:191`).
- Protection: `isProtected(subject)` (`src/server/protection.ts:199-203`); wired as `isManualDownload: protection.isProtected` (`src/server/index.ts:67`, `:70`).
- Job wiring: `runner.register(name, intervalMs, run)` (`src/server/jobs.ts:37`); in-flight runs are skipped (`:24`); stall fix registered at `src/server/index.ts:67-68`.
- Injected-wait precedent: `vetoInBackground(..., wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)))` (`src/server/protection.ts:341-346`).
- Tracker watch interplay: damaged messages (`src/server/trackers.ts:23`, `:32`) get one `d.check_hash` (`:191`) and after 30 min ask the stall fix to replace (`:194-195`). Hence step 1's final `d.message.set` to `''`.
- Tests: one file, `tests/production.test.mjs` (`sh scripts/test.sh`). Module URL constants at `:23-48`. rTorrent fake pattern `:2456-2466`; poll rows field order `:1793-1802`, `:2459`; Arr fakes `:2468-2483`; fixture databases `:2441-2450`; `createProtection(database, arr).isProtected` with a `protected_items` insert (`:2488-2489`). Node v22.
- rTorrent semantics (rtorrent-community cmd-ref): `d.directory.set ‹hash›, ‹path›` — single-file: file at `‹path›/d.name`; multi-file: `d.name` appended, files at `‹path›/d.name/f.path`. `d.is_multi_file` 0/1. `f.path` relative; `f.size_bytes` size. `d.hashing` 0 none, else hashing. `d.complete` 0/1. `join(d.directory, f.path)` is a file's current absolute path in both cases. The poll loop sleeps once before its first read.

## Steps

### Step 1 — new file `src/server/relink.ts`

Export:

- `export const HOST_PATH_KEYS` — exact strings: `downloads.sonarr`, `downloads.radarr`, `library.sonarr`, `library.radarr` (absolute paths; no hard-coded defaults).
- `export const PROBLEM_KIND = 'download_missing'`.
- `export const MISSING_DATA = /hash check returned unfinished chunks|no such file|could not open/i`.
- `export const HASH_POLL_MS = 5_000` and `export const HASH_WAIT_LIMIT_MS = 2 * 60 * 60_000`.
- `export const createRelinkFix = (options) => ({ check })` with options `{ database; rtorrent: { call: XmlRpcCall }; arr: Record<Service, { request: ArrRequest }>; problems: Problems; isManualDownload: (subject: Subject) => boolean; now?: () => number; sleep?: (ms: number) => Promise<void> }` — types copied from `stalls.ts:9-12`, `sleep` defaulting as `protection.ts:345` does.

`check()` does, per torrent from `listTorrents(database)`, in this order:

1. Return at once if `problems.pausedBy(['rtorrent']).length > 0`.
2. Silent skips (no problem, no calls): `torrent.goneAt !== null`; not `(!torrent.started || MISSING_DATA.test(torrent.message))`; `findGrab` undefined; `grab.failedAt !== null`; `listQueue(database)` has an item with `downloadId === torrent.hash`; a `stall_watch` row for the hash with `replaced_at IS NOT NULL` (query as `trackers.ts:162`); a `torrent_issues` row with `replace = 1`; `problems.pausedBy(['rtorrent', grab.service]).length > 0`.
3. Open-problem handling: find in `listOpenProblems(database)` a problem with `kind === PROBLEM_KIND && hash === torrent.hash`. If `needs_you`, skip. If `handling`, `problems.setState(id, 'needs_you', 'An earlier attempt was interrupted; check the torrent in rTorrent.')` and skip.
4. Read `rtorrent.call('f.multicall', [hash, '', 'f.path=', 'f.size_bytes='])` → rows `[path, size]`; reject anything else by throwing. Read `rtorrent.call('d.directory', [hash])`. If ANY `join(directory, path)` exists on disk (`existsSync`), skip silently.
5. Open the problem: `problems.open({ kind: PROBLEM_KIND, subject: { type: 'torrent', service: null, id: hash }, hash, summary })` with summary exactly `` `${torrent.name}: rTorrent's download files are gone.` ``. Everything after runs in one try/catch; a thrown `Error` ends with `problems.setState(id, 'needs_you', error.message)` (as `stalls.ts:224-226`).
6. Guards inside the try:
   a. Manual download: if `subjectsOf(grab).some(isManualDownload)` → `problems.setState(id, 'needs_you', 'This is a manual download, so it is left alone.')` and return.
   b. Settings: `readSetting(database, 'hostPaths', 'downloads.<service>')` and `'library.<service>'`; either missing → throw `` `Set hostPaths downloads.${service} and library.${service} first.` ``.
   c. Library folder from the Arr: Radarr `GET /api/v3/movie/${grab.movieId}` → `.path`; Sonarr `GET /api/v3/series/${grab.seriesId}` → `.path` (throw `'No series is recorded for this grab.'` / `'No movie is recorded for this grab.'` when the id is null). Non-2xx or missing string path → throw `` `${label} did not give the library folder.` `` (labels as `stalls.ts:31`). Folder must be absolute and inside the library root (`relative(root, folder)` not starting with `..` and not absolute); else throw `` `${folder} is outside hostPaths library.${service}.` ``.
   d. Walk the folder with `readdirSync(folder, { recursive: true, withFileTypes: true })`, regular files only, with `statSync` size and full path. For each torrent file in order, pick the first unused library file whose size equals exactly. First unmatched → throw `` `No library file has exactly ${size} bytes for ${path}.` ``.
   e. `statSync(downloadRoot).dev !== statSync(folder).dev` → throw `'The download folder and the library are on different drives.'`.
7. rTorrent writes, each followed by `problems.step(id, 'fix', text)`: `d.close` → `'Closed the torrent in rTorrent.'`; `d.directory.set` `[hash, downloadRoot]` → `` `Pointed it at ${downloadRoot}.` ``; read `d.is_multi_file`; base is `join(downloadRoot, torrent.name)` when `1`, else `downloadRoot`; for each pair `mkdirSync(dirname(destination), { recursive: true })` then `linkSync(libraryPath, join(base, f.path))` — if destination exists with the same `ino` as the library file skip that link, else let the error propagate; step `` `Hardlinked ${n} file${n === 1 ? '' : 's'} from the library.` ``; `d.open` → `'Opened it.'`; `d.check_hash` → `'Rechecking the data.'`.
8. Hash wait: `const startedAt = now()`; loop: `await sleep(HASH_POLL_MS)`; read `d.hashing`; exit on `0`; if `now() - startedAt >= HASH_WAIT_LIMIT_MS` throw `'Still rechecking after two hours.'`.
9. `d.complete` not `1` → throw `'The recheck found the data incomplete, so the torrent stays stopped.'`. Else `d.start` → step `'Started it.'`; then `d.message.set` `[hash, '']` in its own try — on failure step `'Could not clear the old message in rTorrent.'` and continue; finally `problems.setState(id, 'resolved', 'Seeding again from the library copy.')`.

Imports: `existsSync, linkSync, mkdirSync, readdirSync, statSync` from `node:fs`; `dirname, isAbsolute, join, relative` from `node:path`; `findGrab, listQueue, type Grab, type Service` from `./torrentGrabs.js`; `listOpenProblems, type createProblems, type Subject` from `./problems.js`; `readSetting` from `./services/connection.js`; `listTorrents` from `./torrents.js`; `type XmlRpcParam` from `./services/rtorrent.js`. One file-top comment naming the purpose, in the style of `manualImport.ts:52-53`.

### Step 2 — `src/server/index.ts`

Import `createRelinkFix` from `./relink.js` (alphabetical). After the `runner.register('stall-fix', ...)` line, `const relink = createRelinkFix({ database, rtorrent, arr, problems, isManualDownload: protection.isProtected });` and `runner.register('relink-fix', 60_000, relink.check);`.

### Step 3 — `README.md` settings table (`:35-45`)

Add four rows after the `credentials` rows, Category `hostPaths`, Keys `downloads.sonarr`, `downloads.radarr`, `library.sonarr`, `library.radarr`, Meanings: "Absolute folder rTorrent downloads Sonarr's / Radarr's torrents into, such as `/home/<user>/files/Sonarr`" and "Absolute Sonarr / Radarr library root, such as `/home/<user>/TV` / `/home/<user>/Movies`; a stopped torrent whose download files are gone is re-linked from here". Adjust the sentence at `:33` in one clause if it would mislead.

### Step 4 — `tests/production.test.mjs`

a. Add `const relinkModuleUrl = new URL('../dist/server/relink.js', import.meta.url).href;` next to `stallsModuleUrl`.

b. Add one top-level `test('a stopped torrent whose download files were deleted is re-linked to its library copy', async (t) => { ... })` directly after the stall test. Fixture per subtest, following `:2441-2500`: a `mkdtemp` root with real folders `downloads/Radarr` (download root), `library/Movies/Movie (2024)` under `library/Movies` (library root); library files written to exact byte lengths; settings via `setSetting(database, 'hostPaths', ...)`. Fake rtorrent `call`: `d.multicall2` → one row (field order `:1793-1802`) with state 0, open 0, active 0, complete 0, message `'Download registered as completed, but hash check returned unfinished chunks.'`, name and size per case; `t.multicall` → `[['https://tracker.example/announce/k']]`; `f.multicall` → the case's `[[path, size], ...]`; `d.directory` → `join(root, 'downloads/Radarr/Old.Folder')` (does not exist); `d.is_multi_file` → per case; `d.hashing` → `fake.hashing > 0 ? 3 : 0`; `d.complete` → `fake.complete`; every other method pushed to `calls` and returns `0`. Fake `sleep = async (ms) => { clock.value += ms; fake.hashing -= 1; }`. Fake radarr: queue empty, `/api/v3/history/since` → one grab `{ downloadId: hash, movieId: 7, sourceTitle, date, data: {} }`, `/api/v3/movie/7` → `{ path: movieFolder }`. Build poller, grabs, problems, `createRelinkFix({ database, rtorrent, arr, problems, now, sleep, isManualDownload: createProtection(database, arr).isProtected })`; run `await grabs.reconcile(); await poller.poll(); await relink.check();`. `writes = calls.filter(([m]) => ['d.close','d.directory.set','d.open','d.check_hash','d.start','d.message.set'].includes(m))`.

Subtests (each with its one-sentence defect comment):
1. **Single-file success** (`hashing = 3`, `complete = 1`, library file 1234 bytes, torrent file `Movie.2024.mkv` 1234 bytes): `writes` deep-equals `[['d.close', hash], ['d.directory.set', hash, downloadRoot], ['d.open', hash], ['d.check_hash', hash], ['d.start', hash], ['d.message.set', hash, '']]`; the linked file has `nlink === 2` and the library file's `ino`; the one `download_missing` problem is `resolved`.
2. **Size mismatch** (library 1235 bytes): `needs_you`, last step matches `/exactly 1234 bytes/`, `writes` `[]`, nothing under `downloadRoot`.
3. **Multi-file with one unmatched file** (`is_multi_file` 1, files `[['a.mkv', 10], ['b.mkv', 20]]`, library only a 10-byte file): `needs_you`, `writes` `[]`.
4. **Multi-file success**: links at `join(downloadRoot, name, 'a.mkv')` / `b.mkv`; `d.directory.set` points at `downloadRoot`.
5. **Manual download** (insert `protected_items ('radarr', 7, 0)`): `needs_you`, step `'This is a manual download, so it is left alone.'`, `writes` `[]`.
6. **Download files still present**: no `download_missing` problem, no writes.
7. **Hash wait ceiling** (`hashing = Infinity`, sleep never decrements it): `needs_you` with `'Still rechecking after two hours.'`, no `d.start`, `d.check_hash` present; clock advanced by at least `HASH_WAIT_LIMIT_MS`.

Rows may share one `setup({ ... })` helper as the stall test does.

## Out of scope — do not touch

- `src/server/stalls.ts`, `trackers.ts`, `torrents.ts`, `torrentGrabs.ts`, `problems.ts`, `protection.ts`, `settings.ts`, `database.ts` (no migration), `services/*`, `src/client/**`, `CONTEXT.md`, `AGENTS.md`.
- No `movieFile`/`episodeFile` lookups, no name or fuzzy matching, no torrents without a grab record, no cross-device action beyond the `dev` check.
- No changes to tracker watch or stall fix behaviour.
- No settings UI, no CLI changes, no `hostPaths` defaults, no exporting `subjectsOf`, no shared test-helper refactor, no new test file.
- No cleanup, no abstractions, no error handling for impossible cases.

## Retired terms

none

## Verification

```sh
sh scripts/build.sh          # exits 0
sh scripts/test.sh           # ends with "# fail 0"; the new test and its 7 subtests pass
```

## Execution plan

One track. Files: `src/server/relink.ts` (new), `src/server/index.ts`, `README.md`, `tests/production.test.mjs`. Model opus, effort high.

## Executor rules

- Follow the steps in order. Do not add, merge, reorder, or skip steps.
- Before editing in any folder, read the nearest AGENTS.md above it (and the root one) if the repo has them.
- If reality contradicts a Verified fact or a step is impossible as written, STOP and report the discrepancy. Do not improvise a workaround.
- Before reporting progress, audit each claim against a tool result from this session. If tests fail, say so with the output.
- "Done" means the Verification commands were run in this session and passed. Paste their output.
- Touch nothing in the Out-of-scope list.
- Deliver what was asked, at the scope intended. If the spec seems mistaken, say so in a sentence and continue as specified.
- If a step changes code that another surface also draws or calls and the work order does not name that surface, STOP and report it.
- A test you add carries one comment sentence naming the code change that turns it red; a new test extends an existing suite before it starts a new file.

## Decisions recorded

- Keys: `hostPaths/downloads.{sonarr,radarr}`, `hostPaths/library.{sonarr,radarr}`; missing keys surface as a `needs_you` problem.
- Library candidates come from walking the Arr's movie/series folder; the library root is a containment and same-device check.
- "Imported" is inferred from absence in `arr_queue`, not `importedAt`.
- Detection is `!started || MISSING_DATA.test(message)`, made safe by the "all download files absent" check.
- Known limitations (PR body only): torrents with no grab record are skipped; a relink whose hash wait exceeds 30 minutes can race the tracker watch's replacement request.
