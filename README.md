# media-manager-2

Use Node.js 22.13 or newer. Node may print an experimental SQLite warning at
startup because its built-in SQLite module is still marked experimental.

```sh
npm ci
sh scripts/build.sh
sh scripts/test.sh
sh scripts/test.sh --full
npm start
```

Production runs the Hono server and serves the compiled React application.
Vite's preview server is not used in production.
`HOST` and `PORT` set the listening address and port; they default to
`127.0.0.1` and `3000`. `PORT=0` selects an available port.
`DB_PATH` sets the SQLite database location. It defaults to
`~/.local/share/media-manager-2/media-manager.sqlite`. The path must be
absolute, outside the application directory, and inside a directory owned by
the current user with no group or other access. A new directory uses mode
`0700`, and a new database file uses mode `0600`.

The server initializes the database before listening. If initialization fails,
it prints `Database initialization failed.` and exits unsuccessfully. Credential
values stay in the private database and are read or changed only by server
functions and by the operator command described under Service connections.

The server prints its listening address after database initialization succeeds.

## Service connections

The server reaches Sonarr, Radarr, rTorrent and Plex, and finds their folders on disk, with these saved settings:

| Category | Key | Meaning |
| --- | --- | --- |
| `serviceAddresses` | `sonarr.url` | Sonarr base URL with scheme and port, such as `http://127.0.0.1:8989` |
| `serviceAddresses` | `radarr.url` | Radarr base URL with scheme and port |
| `serviceAddresses` | `rtorrent.url` | rTorrent XML-RPC URL with scheme, port and `/xmlrpc`, such as `https://server.whatbox.ca:443/xmlrpc` |
| `serviceAddresses` | `plex.url` | Plex Media Server base URL with scheme and port, such as `http://127.0.0.1:32400` |
| `credentials` | `sonarr.apiKey` | Sonarr API key |
| `credentials` | `radarr.apiKey` | Radarr API key |
| `credentials` | `rtorrent.username` | rTorrent HTTP basic auth username |
| `credentials` | `rtorrent.password` | rTorrent HTTP basic auth password |
| `credentials` | `plex.token` | Plex Media Server token |
| `serviceAddresses` | `r2.endpoint` | Cloudflare R2 S3 endpoint, `https://<account id>.r2.cloudflarestorage.com` |
| `serviceAddresses` | `r2.bucket` | R2 bucket that holds the backups |
| `credentials` | `r2.accessKeyId` | R2 API token access key ID |
| `credentials` | `r2.secretAccessKey` | R2 API token secret access key |
| `hostPaths` | `downloads.sonarr` | Absolute folder rTorrent downloads Sonarr's torrents into, such as `/home/<user>/files/Sonarr` |
| `hostPaths` | `downloads.radarr` | Absolute folder rTorrent downloads Radarr's torrents into, such as `/home/<user>/files/Radarr` |
| `hostPaths` | `library.sonarr` | Absolute Sonarr library root, such as `/home/<user>/TV`; a stopped torrent whose download files are gone is re-linked from here |
| `hostPaths` | `library.radarr` | Absolute Radarr library root, such as `/home/<user>/Movies`; a stopped torrent whose download files are gone is re-linked from here |
| `serviceAddresses` | `blutopia.url` | Blutopia base URL with scheme, such as `https://blutopia.cc` |
| `serviceAddresses` | `privatehd.url` | PrivateHD base URL with scheme |
| `serviceAddresses` | `beyondhd.url` | Beyond-HD base URL with scheme |
| `credentials` | `blutopia.apiToken` | Blutopia API token from the site's API settings |
| `credentials` | `privatehd.username` | PrivateHD account username |
| `credentials` | `privatehd.password` | PrivateHD account password |
| `credentials` | `privatehd.pid` | PrivateHD PID |
| `credentials` | `beyondhd.apiKey` | Beyond-HD API key |
| `credentials` | `beyondhd.rssKey` | Beyond-HD RSS key (optional) |

Until a settings screen exists, save and check them on the server with the
operator command:

```sh
node dist/server/cli.js settings set <category> <key>   (value read from stdin)
node dist/server/cli.js settings delete <category> <key>
node dist/server/cli.js settings list
node dist/server/cli.js connections check
node dist/server/cli.js backup now
node dist/server/cli.js backup list
node dist/server/cli.js backup restore --to <absolute path> [--object <key>]
```

```sh
printf '%s' "$KEY" | DB_PATH=/path/to/media-manager.sqlite node dist/server/cli.js settings set credentials sonarr.apiKey
```

The value comes from stdin so it stays out of shell history and the process
list. One trailing line break is removed. `settings list` prints each saved
category and key, never a value.

`connections check` prints one line per service, in the order sonarr, radarr,
rtorrent, plex, blutopia, privatehd, beyondhd, and exits 0 only when all seven are `ok`. Tracker lines print `ok` without a version:

- `ok <version>`: the service accepted the saved credentials and reported its version.
- `not_configured`: the URL or a credential for that service is missing or empty.
- `rejected`: the service refused the saved credentials.
- `unreachable`: the request failed, timed out after 10 seconds, or returned an unexpected answer.

The output never contains a URL or a setting value. AA-38 is accepted only on
live service evidence: the owner runs `node dist/server/cli.js connections
check` on the slot and sees `ok` with a version on the sonarr, radarr, rtorrent and plex lines. The test fixtures
prove controlled behaviour only.

### Tracker accounts

`getTrackerAccountStats(database)` in `src/server/services/trackerAccounts.ts`
returns one entry per tracker (Blutopia, PrivateHD, Beyond-HD, in that order).
`GET /api/trackers` (owner session) returns the same JSON. Only Blutopia
returns stats (`username, group, uploaded, downloaded, ratio, buffer, seeding,
leeching, seedbonus, hitAndRuns`); PrivateHD and Beyond-HD return
`stats: "unsupported"`. The three trackers are used through their APIs only
(AA-23). Live tracker evidence is still owed: no live keys exist and the tests
use fixtures. Acceptance needs the owner's `connections check` showing three
tracker `ok` lines.

### Title cache

The server keeps a copy of every Sonarr series and Radarr movie, Sonarr's
episodes, and each title's poster and fanart. The `title-refresh` job re-reads
both full lists every five minutes. Between runs the shared webhook receiver
refreshes one title on Sonarr's `SeriesAdd`, `Download`, `EpisodeFileDelete`
and `Rename` events and Radarr's `MovieAdded`, `Download`, `MovieFileDelete`
and `Rename` events, and drops it on `SeriesDelete` or `MovieDelete`.
Images are stored in an `images` folder beside the database and served to the
signed-in owner at `GET /api/images/{sonarr|radarr}/{id}/{poster|fanart}`,
with an `ETag` (a matching `If-None-Match` gets `304`) and
`Cache-Control: private, max-age=300`. No Sonarr or Radarr key reaches the
browser. Search results from Sonarr and Radarr lookups are kept in memory for
ten minutes per service and search term; a failed lookup is never kept.

## Backups to Cloudflare R2

Every 5 minutes the server copies its database with SQLite's `VACUUM INTO`,
gzips the copy and uploads it to R2. A run is skipped when nothing has written
to the database since the last upload, and when any of the four `r2.*`
settings is missing. `backup now` runs one upload at once, even when nothing
changed, and prints `backup: ok <key> <bytes> bytes`, `backup: skipped
<reason>` or `backup: failed <reason>`.

Snapshots are stored as `backups/<UTC time>-<first 12 hex digits of the
SHA-256 of the uncompressed file>.sqlite.gz`, and `backups/latest.json` names
the newest. After each upload the server keeps every snapshot from the last 24
hours plus the newest snapshot of each earlier UTC day for 7 days, and deletes
the rest.

Each run is recorded in the `backup_runs` table (kept 30 days) and published
as a `backup` event. These are the inputs for a future health screen; a failed
backup shows no warning yet.

`backup list` and `backup restore` never open the database, so they work on a
host that has none. They read the bucket from these environment variables
instead of the settings: `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` and
`R2_SECRET_ACCESS_KEY`. `backup restore` downloads the newest snapshot (or
`--object <key>`), checks its hash against its name, its integrity and its
schema version, writes it to the `--to` path, which must not exist yet, and
prints the row count of the main tables.

The tests prove controlled behaviour against a fake bucket only. This is
accepted once Ali runs `backup now`, `backup list` and a `backup restore` to a
spare path against the real bucket.

### Set up R2

1. Ali (Cloudflare dashboard): in R2, create a bucket, for example `mm2-backups`. Note the account ID shown on the R2 overview page.
2. Ali (Cloudflare dashboard): under R2, "Manage API tokens", create an API token with "Object Read & Write" permission, limited to that bucket. Copy the access key ID and secret access key; the secret is shown once.
3. Ali (on the slot): from `~/media-manager-2`, save the four settings, typing each value at the prompt and ending with Ctrl-D:

   ```sh
   node dist/server/cli.js settings set serviceAddresses r2.endpoint      # https://<account id>.r2.cloudflarestorage.com
   node dist/server/cli.js settings set serviceAddresses r2.bucket        # mm2-backups
   node dist/server/cli.js settings set credentials r2.accessKeyId
   node dist/server/cli.js settings set credentials r2.secretAccessKey
   ```

4. Ali (on the slot): run `node dist/server/cli.js backup now` and check it prints `backup: ok`.

### Recover after a disk failure on the slot

1. Ali (on the slot): once the slot is back, make sure `~/.config/media-manager-2/env` exists as described under Test deploy to Whatbox, and that `crontab -l` shows the two lines from Restart after a crash or reboot.
2. Ali (on the Mac): run `sh scripts/deploy.sh` to put the app back on the slot. It starts a server with an empty database.
3. Ali (on the slot): run `flock -n ~/media-manager-2/ensure.lock sh`. This opens a shell that holds the ensure script's lock, so cron cannot restart the server while you work; do steps 4 to 6 inside it. Stop the server with `kill $(cat ~/media-manager-2/server.pid)`, then move the empty database aside: `mv ~/.local/share/media-manager-2/media-manager.sqlite ~/media-manager.sqlite.empty`.
4. Ali (on the slot): export the four values for this shell session; `read -rs` keeps the secret out of shell history:

   ```sh
   export R2_ENDPOINT=https://<account id>.r2.cloudflarestorage.com R2_BUCKET=mm2-backups R2_ACCESS_KEY_ID=<access key id>
   read -rs R2_SECRET_ACCESS_KEY && export R2_SECRET_ACCESS_KEY
   ```

5. Ali (on the slot): from `~/media-manager-2`, run `node dist/server/cli.js backup list` and check the `(latest)` snapshot is recent.
6. Ali (on the slot): run `node dist/server/cli.js backup restore --to ~/.local/share/media-manager-2/media-manager.sqlite` and check the row counts look right, for example `settings` is not 0.
7. Ali (on the slot): type `exit` to leave the locked shell, then run `~/media-manager-2/bin/ensure-running.sh` to start the server on the restored database. Cron would also start it within a minute.
8. Ali (on the slot): run `node dist/server/cli.js connections check` and check the sonarr, radarr, rtorrent and plex lines say `ok`.

### Move to another host

1. Ali (on the slot): remove the two `ensure-running.sh` lines with `crontab -e` so cron cannot restart the old server, then stop it with `kill $(cat ~/media-manager-2/server.pid)` and run `node dist/server/cli.js backup now`, so the last snapshot holds every write.
2. Ali (new host): install Node 22.13 or newer, copy the app there, and run `npm ci --omit=dev`.
3. Ali (new host): export the four `R2_*` values as in step 4 above, run `node dist/server/cli.js backup list`, then `node dist/server/cli.js backup restore --to ~/.local/share/media-manager-2/media-manager.sqlite` and check the row counts.
4. Ali (new host): create the env file and a Managed Link (or the new host's equivalent) as described under Test deploy to Whatbox, start the server, and run `node dist/server/cli.js connections check`.

## Plex owner sign-in

Production sign-in requires both of these server environment variables:

- `PLEX_OWNER_ID` is the canonical positive decimal account ID from the operator's own verified Plex account record. The first person to sign in never becomes the owner.
- `APP_ORIGIN` is the public origin, such as `https://media.example`. HTTPS is required except for local HTTP development. Local HTTP requires a loopback origin and a loopback `HOST`, such as `127.0.0.1` or `::1`.

`APP_ORIGIN` cannot contain credentials, a path, a query, or a fragment. Plex always returns to `/auth/callback` on this origin. A browser cannot select another return destination.

The Hono production server implements sign-in. The Vite development server does not proxy or implement these routes:

- `GET /auth/status` reports whether sign-in is configured and whether that browser has a pending attempt.
- `POST /auth/start` creates a Plex sign-in attempt.
- `GET /auth/callback` serves the application after Plex returns.
- `POST /auth/complete` verifies the returned Plex account and creates an application session.
- `POST /auth/cancel` cancels that browser's pending attempt.
- `POST /auth/logout` revokes that browser's session and pending attempt.
- `GET /api/session` verifies the current owner session.
- `GET /api/events` streams server events to the signed-in owner's browser.

Application sessions expire 24 hours after creation. Activity does not extend them. Restarting the server signs out every browser because sessions and pending attempts live only in server memory. Signing out revokes only the current browser's session; another browser remains signed in. The server discards the Plex token after account verification and does not refresh it.

Plex tokens, the owner ID, service credentials, and authentication keys remain on the server. Browser responses contain only the Plex handoff URL, sign-in state, session expiry, and public status fields.

Every future browser route for settings, media and images, search, grabs, replaces, imports, deletion, download controls, flags, history, health, calendar, and updates belongs under the owner guard at `/api`. The [complete first-version feature map](.scratch/aa-37/work-order.md#verified-facts) records the agreed scope without assigning those features to sign-in.

`GET /api/events` is a server-sent event stream behind the `/api` owner guard, so a missing, expired or signed-out session gets a 401 JSON response before any stream header is sent. Each event arrives as `event: <type>`, `data: <JSON>` and `id: <integer>`, with ids increasing for the life of the server process. A `: keepalive` comment every 25 seconds keeps the connection open through proxies such as Whatbox and Cloudflare. The server re-checks the owner session before every event and every keepalive, and closes the stream once the session has expired or been signed out. One server process holds at most 20 open streams; the next request gets 503 `too_many_streams`. Nothing is replayed, so a reconnecting browser receives only events published after it reconnects.

Trusted server background jobs continue without a browser session. Future webhooks need a separate authenticated service contract. No webhook exists or bypasses owner authorization now.

Later features add background jobs to the job runner under these rules. Every job is registered before the runner starts. A job never overlaps its own previous run; a tick that arrives while the previous run is unfinished is skipped. A failing job is logged by name only and stays scheduled. Jobs run with no session and no request. The first run happens one interval after start. SIGTERM or SIGINT stops the runner, waits for runs in progress, closes open streams and the server, and exits with code 0. A second signal during shutdown exits immediately with code 1. The schedule lives only in memory, so a restart starts from an empty schedule.

## Test deploy to Whatbox

`sh scripts/deploy.sh` builds the current worktree and runs it on the Whatbox slot behind one fixed address, replacing whatever copy was running there. Set the slot up once:

1. On Whatbox's Manage Links page, click "Add a custom app". Name it `mm2`, give it a port between 10000 and 32767, and leave WebSockets off; `/api/events` is plain HTTP. Whatbox refuses the port unless something already answers on it, so first start a placeholder on the slot that stops itself after 15 minutes:

   ```sh
   setsid timeout 900 node -e "require('http').createServer((q, s) => s.end('placeholder')).listen(PORT, '127.0.0.1')" > /dev/null 2>&1 &
   ```

   Replace `PORT` with the chosen port. Before the first deploy, stop the placeholder: `pgrep -af placeholder` shows its pid for `kill`.
2. On the slot, create `~/.config/media-manager-2/env` with mode `0600`:

   ```sh
   PORT=<the link's port>
   HOST=127.0.0.1
   APP_ORIGIN=<the link's https address, no trailing slash>
   PLEX_OWNER_ID=<your numeric Plex account ID>
   ```

   Leave `DB_PATH` unset so the database stays at its default path outside the app folder, where deploys never touch it.
3. Run `sh scripts/deploy.sh` once, then save the Sonarr, Radarr, rTorrent and Plex settings from `~/media-manager-2` on the slot with `settings set`, as described under Service connections. They persist across later deploys.

The script first runs `npm ci` on the Mac when the worktree has no packages installed or its lock file changed since the last install. It reaches the slot over ssh as `DEPLOY_HOST`, default `shenzhou`, and copies `dist/`, `package.json` and `package-lock.json` to `~/media-manager-2/`, runs `npm ci --omit=dev` when the lock file changed, stops the old server with SIGTERM and starts the new one. It then checks the server answers on the slot and at `APP_ORIGIN`, prints `connections check`, and prints the branch and commit now live, which it also keeps in `~/media-manager-2/DEPLOYED`. Server output goes to `~/media-manager-2/server.log`.

One copy runs at a time, so a deploy from another worktree replaces it. Each deploy moves the previous `server.log` to `server.log.1`, so the slot keeps the current log and one older one.

Never give a Podman container a name containing `media-manager`. The owner's older `media-manager-ensure-running.sh` cron script removes every container whose name contains it.

### Restart after a crash or reboot

The plain Node process runs with no container. `scripts/deploy.sh` copies `scripts/ensure-running.sh` to `~/media-manager-2/bin/`. The script exits at once when another copy holds `~/media-manager-2/ensure.lock`, and does nothing when `/auth/status` answers on `PORT`. Otherwise it stops the saved pid if that is still this server, starts a new one and logs `started pid <pid>`. The server it starts never holds the lock, and `deploy.sh` holds the same lock while it swaps servers, so cron cannot start a second copy.

Ali (on the slot): add these two lines once with `crontab -e`:

```sh
@reboot $HOME/media-manager-2/bin/ensure-running.sh >> $HOME/media-manager-2/ensure.log 2>&1
* * * * * $HOME/media-manager-2/bin/ensure-running.sh >> $HOME/media-manager-2/ensure.log 2>&1
```

Cron runs with a short `PATH`. If `ensure.log` shows `node: not found`, add `PATH=<the output of dirname "$(command -v node)">:/usr/bin:/bin` to `~/.config/media-manager-2/env`; the script reads that file.

- Start: run `~/media-manager-2/bin/ensure-running.sh`, or wait up to a minute for cron.
- Restart: `kill $(cat ~/media-manager-2/server.pid)`; cron starts a new server within a minute.
- Stop for maintenance: run `flock -n ~/media-manager-2/ensure.lock sh`, stop the server inside that shell, and `exit` when done. Restoring a backup works the same way; see Backups to Cloudflare R2.

#### Acceptance on the slot

Local tests cannot show any of this; each step runs on the real slot. Record the output of each step, and record step 6 as a manual run or a real reboot. Run the commands from `~/media-manager-2` with the env file loaded: `cd ~/media-manager-2 && set -a && . ~/.config/media-manager-2/env && set +a`.

- [ ] 1. Crash. Ali (on the slot): `kill -9 $(cat server.pid)`. Within 60 seconds `curl -fs http://127.0.0.1:$PORT/auth/status` succeeds, `ensure.log` has exactly one new `started pid` line, and `pgrep -fc "node $HOME/media-manager-2/dist/server/index.js"` prints 1.
- [ ] 2. No duplicates, stopped. Ali (on the slot): stop the server inside `flock -n ensure.lock sh` and `exit`, then run `bin/ensure-running.sh & bin/ensure-running.sh & wait`. One run logs `started pid`, the other `another run holds the lock, exiting`; the `pgrep -fc` count prints 1.
- [ ] 3. No duplicates, healthy. Ali (on the slot): with the server answering, run `cat server.pid; bin/ensure-running.sh & bin/ensure-running.sh & wait; cat server.pid`. Both pids match and nothing new is logged.
- [ ] 4. Lock not inherited. Ali (on the slot): `ls -l /proc/$(cat server.pid)/fd | grep -c ensure.lock` prints 0.
- [ ] 5. Deploy against cron. Ali (on the slot): run `while :; do bin/ensure-running.sh; sleep 1; done >> ensure.log 2>&1`. Ali (on the Mac): run `sh scripts/deploy.sh`. Ali (on the slot): stop the loop with Ctrl-C; the `pgrep -fc` count prints 1 and `cat DEPLOYED` shows the new commit.
- [ ] 6. Reboot. Ali (on the slot): the slot cannot be rebooted on demand. Stop the server inside `flock -n ensure.lock sh` and `exit`, run the exact `@reboot` line from `crontab -l` by hand, and confirm the `pgrep -fc` count prints 1. After the next real Whatbox reboot, record `uptime`, `ps -o etime= -p $(cat server.pid)` and the boot-time `started pid` line in `ensure.log`.
- [ ] 7. Hung server. Ali (on the slot): `kill -STOP $(cat server.pid)`, then `bin/ensure-running.sh`. It logs `alive but not answering, stopping it` and `started pid`, and the `pgrep -fc` count prints 1.

Use `npm run dev` for the Vite development server.
Always build and test through `scripts/build.sh` and `scripts/test.sh`.
`sh scripts/test.sh --production` checks an existing build without rebuilding.
`sh scripts/test.sh --review-script` checks the review script.
Additional test-runner arguments can follow `--full` or `--production`.

shadcn/ui with Base UI and TanStack Table are configured for later features.
Product screens and styling are pending; the heading checks that React starts.
