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

The server reaches Sonarr, Radarr, rTorrent and Plex with these saved settings:

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

Until a settings screen exists, save and check them on the server with the
operator command:

```sh
node dist/server/cli.js settings set <category> <key>   (value read from stdin)
node dist/server/cli.js settings delete <category> <key>
node dist/server/cli.js settings list
node dist/server/cli.js connections check
```

```sh
printf '%s' "$KEY" | DB_PATH=/path/to/media-manager.sqlite node dist/server/cli.js settings set credentials sonarr.apiKey
```

The value comes from stdin so it stays out of shell history and the process
list. One trailing line break is removed. `settings list` prints each saved
category and key, never a value.

`connections check` prints one line per service, in the order sonarr, radarr,
rtorrent, plex, and exits 0 only when all four are `ok`:

- `ok <version>`: the service accepted the saved credentials and reported its version.
- `not_configured`: the URL or a credential for that service is missing or empty.
- `rejected`: the service refused the saved credentials.
- `unreachable`: the request failed, timed out after 10 seconds, or returned an unexpected answer.

The output never contains a URL or a setting value. AA-38 is accepted only on
live service evidence: the owner runs `node dist/server/cli.js connections
check` on the slot and sees four `ok` lines with versions. The test fixtures
prove controlled behaviour only.

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

Application sessions expire 24 hours after creation. Activity does not extend them. Restarting the server signs out every browser because sessions and pending attempts live only in server memory. Signing out revokes only the current browser's session; another browser remains signed in. The server discards the Plex token after account verification and does not refresh it.

Plex tokens, the owner ID, service credentials, and authentication keys remain on the server. Browser responses contain only the Plex handoff URL, sign-in state, session expiry, and public status fields.

Every future browser route for settings, media and images, search, grabs, replaces, imports, deletion, download controls, flags, history, health, calendar, and updates belongs under the owner guard at `/api`. The [complete first-version feature map](.scratch/aa-37/work-order.md#verified-facts) records the agreed scope without assigning those features to sign-in.

AA-41 must authorize an event-stream connection before sending its response headers, revalidate the owner session before every private event, and close the stream when the session expires or is revoked. This sign-in work does not implement an event stream or verify stream termination.

Trusted server background jobs continue without a browser session. Future webhooks need a separate authenticated service contract. No webhook exists or bypasses owner authorization now.

Use `npm run dev` for the Vite development server.
Always build and test through `scripts/build.sh` and `scripts/test.sh`.
`sh scripts/test.sh --production` checks an existing build without rebuilding.
`sh scripts/test.sh --review-script` checks the review script.
Additional test-runner arguments can follow `--full` or `--production`.

shadcn/ui with Base UI and TanStack Table are configured for later features.
Product screens and styling are pending; the heading checks that React starts.
