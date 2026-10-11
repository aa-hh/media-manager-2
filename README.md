# media-manager-2

A power-user web app that runs Sonarr and Radarr through one interface and
keeps their torrent downloads on track: it reads rTorrent directly, spots
downloads that stall or report vague status, and fixes them.

It is a single Node.js process (a Hono server that also serves the React app)
with its state in one SQLite file. It is built for one person, the owner, who
signs in with their Plex account.

## What you need

- Node.js 22.13 or newer. Node may print an experimental SQLite warning at
  startup because its built-in SQLite module is still marked experimental.
- Sonarr and Radarr, each with an API key.
- rTorrent with its XML-RPC interface reachable over HTTP(S), as most
  seedboxes provide it.
- A Plex account, used to sign in, and a Plex Media Server.
- Optional: accounts on the Blutopia, PrivateHD or Beyond-HD trackers, for
  account stats.
- Optional: somewhere to keep backups, either a folder (another disk, a
  network share) or an S3-compatible bucket. See [Backups](#backups-optional).

## Install and start

```sh
npm ci
sh scripts/build.sh
npm start
```

The server prepares its database, then prints its listening address. If the
database cannot be prepared it prints `Database initialization failed.` and
exits unsuccessfully. An invalid `TRACKER_RULES` stops it the same way, with a
message naming the tracker and field at fault. Production runs the Hono server, which serves the
compiled React app; Vite's preview server is not used.

### Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `HOST` | no | Listening address, default `127.0.0.1` |
| `PORT` | no | Listening port, default `3000`; `0` picks a free port |
| `DB_PATH` | no | SQLite database location, default `~/.local/share/media-manager-2/media-manager.sqlite` |
| `APP_ORIGIN` | yes | The public origin people open, such as `https://media.example.com` |
| `PLEX_OWNER_ID` | yes | Your numeric Plex account ID; only this account can sign in |
| `BACKUP_KEY` | for backups | 64 hex characters that encrypt every backup; see [Backups](#backups-optional) |
| `TRACKER_RULES` | no | Hit-and-run rules as JSON keyed by tracker hostname; see [Tracker hit-and-run rules](#tracker-hit-and-run-rules) |

`DB_PATH` must be absolute, outside the application folder, and inside a
folder owned by the current user with no group or other access. A new folder
gets mode `0700` and a new database file mode `0600`. The database holds every
saved credential; only the server and the command-line tool below read it.

## Sign in

Sign-in goes through Plex. Set both `PLEX_OWNER_ID` and `APP_ORIGIN`; without
them nobody can sign in. The first person to sign in never becomes the owner:
only the Plex account whose ID matches `PLEX_OWNER_ID` gets in.

`APP_ORIGIN` must use HTTPS, except for local development over HTTP on a
loopback origin with a loopback `HOST` such as `127.0.0.1` or `::1`. It cannot
contain credentials, a path, a query or a fragment. Plex always returns to
`/auth/callback` on this origin.

A session lasts 24 hours from sign-in; activity does not extend it. Sessions
live in server memory, so restarting the server signs every browser out.
Signing out ends only the current browser's session. The server keeps the
owner ID, service credentials and Plex tokens to itself; the browser only ever
sees sign-in state, session expiry and status fields.

## Connect your services

The server reaches Sonarr, Radarr, rTorrent and Plex, and finds their folders
on disk, through these saved settings:

| Category | Key | Meaning |
| --- | --- | --- |
| `serviceAddresses` | `sonarr.url` | Sonarr base URL with scheme and port, such as `http://127.0.0.1:8989` |
| `serviceAddresses` | `radarr.url` | Radarr base URL with scheme and port |
| `serviceAddresses` | `rtorrent.url` | rTorrent XML-RPC URL with scheme, port and path, such as `https://seedbox.example.com:443/xmlrpc` |
| `serviceAddresses` | `plex.url` | Plex Media Server base URL with scheme and port, such as `http://127.0.0.1:32400` |
| `credentials` | `sonarr.apiKey` | Sonarr API key |
| `credentials` | `radarr.apiKey` | Radarr API key |
| `credentials` | `rtorrent.username` | rTorrent HTTP basic auth username |
| `credentials` | `rtorrent.password` | rTorrent HTTP basic auth password |
| `credentials` | `plex.token` | Plex Media Server token |
| `serviceAddresses` | `mediaManager.hookUrl` | The address Sonarr and Radarr can reach this app at, such as `http://127.0.0.1:3000`. With `webhook.secret`, the server adds its own webhook to both and keeps it up to date |
| `credentials` | `webhook.secret` | A long random password Sonarr and Radarr send with each webhook call |
| `hostPaths` | `downloads.sonarr` | Absolute folder rTorrent downloads Sonarr's torrents into, such as `/home/<user>/files/Sonarr` |
| `hostPaths` | `downloads.radarr` | Absolute folder rTorrent downloads Radarr's torrents into |
| `hostPaths` | `library.sonarr` | Absolute Sonarr library root, such as `/home/<user>/TV`; a stopped torrent whose download files are gone is re-linked from here |
| `hostPaths` | `library.radarr` | Absolute Radarr library root, such as `/home/<user>/Movies`; same use as above |
| `hostPaths` | `downloads.versions` | Absolute folder rTorrent downloads second versions into |
| `hostPaths` | `versions.radarr` | Absolute folder finished movie second versions are hardlinked into. Must be on the same drive as `downloads.versions` and inside a Plex Movies library |
| `hostPaths` | `versions.sonarr` | Same as above for episodes, inside a Plex TV library. Episode second versions wait until it is set |
| `serviceAddresses` | `blutopia.url` | Optional. Blutopia base URL with scheme, such as `https://blutopia.cc` |
| `credentials` | `blutopia.apiToken` | Optional. Blutopia API token from the site's API settings |
| `serviceAddresses` | `privatehd.url` | Optional. PrivateHD base URL with scheme |
| `credentials` | `privatehd.username` | Optional. PrivateHD account username |
| `credentials` | `privatehd.password` | Optional. PrivateHD account password |
| `credentials` | `privatehd.pid` | Optional. PrivateHD PID |
| `serviceAddresses` | `beyondhd.url` | Optional. Beyond-HD base URL with scheme |
| `credentials` | `beyondhd.apiKey` | Optional. Beyond-HD API key |
| `credentials` | `beyondhd.rssKey` | Optional. Beyond-HD RSS key |

The backup settings are listed under [Backups](#backups-optional).

Until a settings screen exists, save and check settings with the command-line
tool, run from the app folder with the same `DB_PATH` as the server:

```sh
node dist/server/cli.js settings set <category> <key>   (value read from stdin)
node dist/server/cli.js settings delete <category> <key>
node dist/server/cli.js settings list
node dist/server/cli.js connections check
node dist/server/cli.js backup now
node dist/server/cli.js backup off | on
node dist/server/cli.js backup list
node dist/server/cli.js backup restore --to <absolute path> [--object <key>]
```

For example:

```sh
printf '%s' "$SONARR_KEY" | node dist/server/cli.js settings set credentials sonarr.apiKey
```

The value comes from stdin so it stays out of shell history and the process
list; running `settings set` alone lets you type it and end with Ctrl-D. One
trailing line break is removed. `settings list` prints each saved category and
key, never a value.

`connections check` prints one line per service, in the order sonarr, radarr,
rtorrent, plex, blutopia, privatehd, beyondhd, and exits 0 only when all seven
are `ok`. Tracker lines print `ok` without a version.

- `ok <version>`: the service accepted the saved credentials and reported its version.
- `not_configured`: the URL or a credential for that service is missing or empty.
- `rejected`: the service refused the saved credentials.
- `unreachable`: the request failed, timed out after 10 seconds, or returned an unexpected answer.

The output never contains a URL or a setting value.

### Tracker accounts

`GET /api/trackers` returns one entry per tracker (Blutopia, PrivateHD,
Beyond-HD, in that order). Only Blutopia returns stats: `username` and `group`
as text, and `uploaded`, `downloaded` and `buffer` (bytes), `ratio`,
`seeding`, `leeching`, `seedbonus` and `hitAndRuns` as numbers, each `null`
when Blutopia leaves it out. PrivateHD and Beyond-HD return
`stats: "unsupported"`. Trackers are only ever reached through their APIs.

### Tracker hit-and-run rules

No tracker or rule is built in. Removal advice and the release columns judge a
torrent only by a tracker you have added; a tracker with no rule gets "Can't
tell; keep seeding". Rules come from two places, and a rule saved in settings
wins over the env file's rule for the same host:

| Category | Key | Meaning |
| --- | --- | --- |
| `trackerConfiguration` | `trackers.<host>` | The tracker was added, with or without a rule |
| `trackerConfiguration` | `rules.<host>` | The tracker's saved rule, as JSON |
| `trackerConfiguration` | `margins.<host>` | Optional. Removal-advice margins as JSON: `timeFactor` and `globalRatioFactor` (1 or more), `extraHours` and `ratioExtra` (0 or more); defaults 1.1, 1.25, 6 and 0.05 |

`TRACKER_RULES` in the env file holds rules as one JSON object keyed by
hostname. A tracker listed there counts as added and can only be removed there.
Each rule has these fields; any left out mean "none":

- `minHours`: seed hours that clear a finished torrent.
- `minHoursFormula`: `"privatehd"` to work the hours out from the size instead.
- `minRatio`: the torrent ratio that clears it, combined with the hours by
  `logic` (`"and"` or `"or"`).
- `minGlobalRatio`: the account-wide ratio minimum.
- `partialExemptBelow`, `partialRatio`, `partialMaxHours`: for a download left
  incomplete, the fraction below which it owes nothing, and the ratio or
  seeding hours that clear it otherwise.

The owner's three trackers, as one line. Keep the single quotes: the env file
is read by `sh`, which would strip the double quotes.

```sh
TRACKER_RULES='{"blutopia.cc":{"minHours":168,"minGlobalRatio":0.4},"beyond-hd.me":{"minHours":120,"minRatio":1.0,"logic":"or","minGlobalRatio":0.25},"privatehd.to":{"minHoursFormula":"privatehd","minRatio":0.9,"logic":"or","partialExemptBelow":0.1,"partialRatio":0.9,"partialMaxHours":1440}}'
```

The settings screen uses these routes under the owner guard:

- `GET /api/settings/trackers` lists `{ host, status, rule, ruleSource, margins, problem }`
  per tracker. `status` is `configured` (saved rule), `configured_env` (env
  file rule only) or `no_rule`; `problem` names a saved value that fails
  validation.
- `POST /api/settings/trackers` `{ host }` adds a tracker. A URL is cut down to
  its hostname; a duplicate gets 409, anything that is not a hostname 400.
- `PUT /api/settings/trackers/<host>/rule` `{ rule, margins? }` saves a rule. An
  invalid one gets 400 `{ error, field, reason }`.
- `DELETE /api/settings/trackers/<host>/rule` clears the saved rule and
  margins; the env file's rule, if any, applies again.
- `DELETE /api/settings/trackers/<host>` removes the tracker and everything
  saved for it. A tracker in `TRACKER_RULES` gets 409 `in_environment`.

### Title cache

The server keeps a copy of every Sonarr series and Radarr movie, Sonarr's
episodes, and each title's poster and fanart. The `title-refresh` job re-reads
both full lists every five minutes. Between runs, Sonarr and Radarr webhooks
(see `mediaManager.hookUrl` above) refresh one title on Sonarr's `SeriesAdd`, `Download`, `EpisodeFileDelete` and
`Rename` events and Radarr's `MovieAdded`, `Download`, `MovieFileDelete` and
`Rename` events, and drop it on `SeriesDelete` or `MovieDelete`. Images are
stored in an `images` folder beside the database. No Sonarr or Radarr key
reaches the browser. Sonarr and Radarr search results are kept in memory for
ten minutes per service and search term; a failed lookup is never kept.

## Backups (optional)

Backups are your choice. The app runs the same without them; until you set
one up, the health screen carries a low-level "Backups are not set up"
reminder. To run without backups and accept the risk, turn them off, which
also removes the reminder:

```sh
node dist/server/cli.js backup off   # no backups, no reminder
node dist/server/cli.js backup on    # back on; a destination and key are then needed
```

Once set up, every 5 minutes the server copies its database with SQLite's `VACUUM INTO`, gzips the
copy, encrypts it with AES-256-GCM under `BACKUP_KEY`, and writes it to the
destination you chose. The database holds every saved credential, so backups
are never written unencrypted.

A run is skipped when backups are off, when no destination is set, and when
nothing has written to the database since the last backup. Once a destination
is set, a missing or malformed `BACKUP_KEY`, or a folder and a bucket set at
the same time, fails the run, and the health screen warns until a backup
succeeds.
`backup now` runs one backup at once, even when nothing changed, and prints
`backup: ok <key> <bytes> bytes`, `backup: skipped <reason>` or
`backup: failed <reason>`.

### Choose a destination

Set **one** of these.

**A folder**, such as a second disk, a mounted network share or a synced
folder:

| Category | Key | Meaning |
| --- | --- | --- |
| `hostPaths` | `backup.folder` | Absolute path of an existing folder |

The server never creates this folder itself; a folder that does not exist
fails the backup. On a separate drive or share, point it at a folder *inside*
the drive, such as `/mnt/backup-drive/media-manager-2`, not at the mount point
itself: an unmounted drive's mount point is still an empty folder, and
backups written there would fill the local disk.

**An S3-compatible bucket**, such as Cloudflare R2, Backblaze B2, Amazon S3,
Wasabi or MinIO:

| Category | Key | Meaning |
| --- | --- | --- |
| `serviceAddresses` | `backup.endpoint` | The service's S3 endpoint, such as `https://<account id>.r2.cloudflarestorage.com` or `https://s3.us-west-004.backblazeb2.com` |
| `serviceAddresses` | `backup.bucket` | The bucket that holds the backups |
| `serviceAddresses` | `backup.region` | Optional. The bucket's region, default `auto`, which suits Cloudflare R2; most other services need their real region, such as `us-west-004` |
| `credentials` | `backup.accessKeyId` | Access key ID |
| `credentials` | `backup.secretAccessKey` | Secret access key |

Give the key read, write, list and delete access to that bucket only.
Requests use path-style addresses (`<endpoint>/<bucket>/<key>`).

### Set up

1. Make the key, and keep a copy somewhere safe such as a password manager.
   Without it, no backup can be read.

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Pass it to the server as `BACKUP_KEY` (for example in the env file
   described under [Run it on a server](#run-it-on-a-server)) and restart the
   server.
3. Save the destination settings from the tables above with `settings set`.
4. Run `node dist/server/cli.js backup now` with `BACKUP_KEY` set and check
   it prints `backup: ok`.

### What is kept

Backups are stored as `backups/<UTC time>-<first 12 hex digits of the SHA-256
of the uncompressed file>.sqlite.gz.enc`, and `backups/latest.json` names the
newest. After each backup the server keeps every backup from the last 24
hours plus the newest of each earlier UTC day for 7 days, and deletes the rest.
Each run is recorded in the `backup_runs` table (kept 30 days), which feeds the
health screen.

### Restore

`backup list` and `backup restore` never open the database, so they work on a
host that has none. They read the destination from environment variables
instead of the settings: either `BACKUP_FOLDER`, or `BACKUP_ENDPOINT`,
`BACKUP_BUCKET`, `BACKUP_ACCESS_KEY_ID`, `BACKUP_SECRET_ACCESS_KEY` and,
when needed, `BACKUP_REGION`. `backup restore` also needs `BACKUP_KEY`.

`backup restore` takes the newest backup (or `--object <key>`), decrypts it,
checks its hash against its name, its integrity and its schema version, and
writes it to the `--to` path, which must not exist yet and whose folder must
be readable by this user only. It then prints the row count of the main
tables.

To restore after losing the database:

1. Stop the server, and anything that restarts it (see
   [Keep it running](#keep-it-running) for how to hold the restart lock).
2. Move the current database aside if there is one.
3. Export the destination variables and `BACKUP_KEY` for this shell. `read -rs`
   keeps secrets out of shell history:

   ```sh
   export BACKUP_ENDPOINT=<endpoint> BACKUP_BUCKET=<bucket> BACKUP_ACCESS_KEY_ID=<access key id>
   read -rs BACKUP_SECRET_ACCESS_KEY && export BACKUP_SECRET_ACCESS_KEY
   read -rs BACKUP_KEY && export BACKUP_KEY
   ```

   For a folder destination, replace the first two lines with
   `export BACKUP_FOLDER=<path>`.
4. Run `node dist/server/cli.js backup list` and check the `(latest)` backup
   is recent.
5. Run `node dist/server/cli.js backup restore --to <your DB_PATH>` and check
   the row counts look right, for example `settings` is not 0.
6. Start the server and run `node dist/server/cli.js connections check`.

To move to another host, stop the old server for good, run `backup now` on it
so the last backup holds every write, then on the new host install Node, copy
the app, run `npm ci --omit=dev`, and follow steps 3 to 6.

## Run it on a server

`sh scripts/deploy.sh` builds the current checkout on your machine and runs it
on a Linux host you reach over ssh, replacing whatever copy was running there.
`DEPLOY_HOST` must name that host as ssh knows it; the script stops without it. The host needs Node 22.13 or newer,
`rsync`, `curl`, `flock` and `setsid`, and something that serves `APP_ORIGIN`
over HTTPS and forwards it to `PORT` on the host, such as a reverse proxy or a
seedbox's custom app link. `/api/events` is a plain HTTP stream; WebSockets are
not needed.

Set the host up once:

1. On the host, create `~/.config/media-manager-2/env` with mode `0600`:

   ```sh
   PORT=<the port your proxy forwards to>
   HOST=127.0.0.1
   APP_ORIGIN=<the public https address, no trailing slash>
   PLEX_OWNER_ID=<your numeric Plex account ID>
   BACKUP_KEY=<64 hex characters, only if you use backups>
   TRACKER_RULES='<JSON, only if you keep tracker rules here>'
   ```

   Leave `DB_PATH` unset so the database stays at its default path outside the
   app folder, where deploys never touch it.
2. Run `DEPLOY_HOST=<host> sh scripts/deploy.sh` once, then on the host save
   your settings from `~/media-manager-2` with `settings set`, as described
   under [Connect your services](#connect-your-services). They persist across
   later deploys.

The script runs `npm ci` locally when the checkout has no packages installed
or its lock file changed since the last install. It copies `dist/`,
`package.json` and `package-lock.json` to `~/media-manager-2/` on the host,
runs `npm ci --omit=dev` there when the lock file changed, stops the old server
with SIGTERM and starts the new one. It then checks the server answers on the
host and at `APP_ORIGIN`, prints `connections check`, and prints the branch and
commit now live, which it also keeps in `~/media-manager-2/DEPLOYED`. Server
output goes to `~/media-manager-2/server.log`; each deploy moves the previous
log to `server.log.1`.

Some seedbox hosts only accept a custom app port when something already
answers on it. A placeholder that stops itself after 15 minutes does the job;
stop it (`pgrep -af placeholder` shows its pid) before the first deploy:

```sh
setsid timeout 900 node -e "require('http').createServer((q, s) => s.end('placeholder')).listen(PORT, '127.0.0.1')" > /dev/null 2>&1 &
```

### Keep it running

The server runs as a plain Node process with no container. `deploy.sh` copies
`scripts/ensure-running.sh` to `~/media-manager-2/bin/`. That script exits at
once when another copy holds `~/media-manager-2/ensure.lock`, and does nothing
when `/auth/status` answers on `PORT`. Otherwise, if the saved pid is still
this server, it asks `/auth/status` twice more, 10 seconds apart, and stops
the server only when all three fail. It then starts a new one and logs
`started pid <pid>`. The server it starts never holds the lock, and
`deploy.sh` holds the same lock while it swaps servers, so cron cannot start a
second copy.

Add these two lines on the host with `crontab -e`:

```sh
@reboot $HOME/media-manager-2/bin/ensure-running.sh >> $HOME/media-manager-2/ensure.log 2>&1
* * * * * $HOME/media-manager-2/bin/ensure-running.sh >> $HOME/media-manager-2/ensure.log 2>&1
```

Cron runs with a short `PATH`. If `ensure.log` shows `node: not found`, add
`PATH=<the output of dirname "$(command -v node)">:/usr/bin:/bin` to
`~/.config/media-manager-2/env`; the script reads that file.

- Start: run `~/media-manager-2/bin/ensure-running.sh`, or wait up to a minute for cron.
- Restart: `kill $(cat ~/media-manager-2/server.pid)`; cron starts a new server within a minute.
- Stop for maintenance, such as a restore: run
  `flock -n ~/media-manager-2/ensure.lock sh`, stop the server inside that
  shell, and `exit` when done. While that shell is open cron cannot restart
  the server.

## Development

```sh
npm ci
sh scripts/setup.sh               # enables the git hooks
npm run dev                       # Vite development server
sh scripts/build.sh               # compile and typecheck
sh scripts/test.sh                # fast run
sh scripts/test.sh --full         # full suite
sh scripts/test.sh --production   # check an existing build without rebuilding
sh scripts/test.sh --review-script
```

Always build and test through `scripts/build.sh` and `scripts/test.sh`.
Extra test-runner arguments can follow `--full` or `--production`. The Vite
development server does not proxy or implement the sign-in routes; use the
production server to sign in. `AGENTS.md` and `CONTEXT.md` describe the
project's rules and vocabulary, and `docs/adr/` records its decisions.

### Server routes

- `GET /auth/status` reports whether sign-in is configured and whether that browser has a pending attempt.
- `POST /auth/start` creates a Plex sign-in attempt.
- `GET /auth/callback` serves the application after Plex returns.
- `POST /auth/complete` verifies the returned Plex account and creates an application session.
- `POST /auth/cancel` cancels that browser's pending attempt.
- `POST /auth/logout` revokes that browser's session and pending attempt.
- `GET /api/session` verifies the current owner session.
- `GET /api/events` streams server events to the signed-in owner's browser.
- `GET /api/images/{sonarr|radarr}/{id}/{poster|fanart}` serves cached
  artwork with an `ETag` (a matching `If-None-Match` gets `304`) and
  `Cache-Control: private, max-age=300`.

Every browser route for settings, media, search, grabs, downloads, history,
health and the rest belongs under the owner guard at `/api`.

`GET /api/events` is a server-sent event stream behind that guard, so a
missing, expired or signed-out session gets a 401 JSON response before any
stream header is sent. Each event arrives as `event: <type>`, `data: <JSON>`
and `id: <integer>`, with ids increasing for the life of the server process. A
`: keepalive` comment every 25 seconds keeps the connection open through
proxies. The server re-checks the owner session before every event and every
keepalive, and closes the stream once the session has expired or been signed
out. One server process holds at most 20 open streams; the next request gets
503 `too_many_streams`. Nothing is replayed, so a reconnecting browser
receives only events published after it reconnects.

### Background jobs

Background jobs run without a browser session. Every job is registered before
the runner starts. A job never overlaps its own previous run; a tick that
arrives while the previous run is unfinished is skipped. A failing job is
logged by name only and stays scheduled. The first run happens one interval
after start. SIGTERM or SIGINT stops the runner, waits for runs in progress,
closes open streams and the server, and exits with code 0. A second signal
during shutdown exits immediately with code 1. The schedule lives only in
memory, so a restart starts from an empty schedule.
