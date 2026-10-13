#!/bin/sh
# Fresh database, settings and session, then the stand-in Sonarr, the server and headless Chrome. Prints their pids. macOS only (Chrome path; override with CHROME).
# Run: sh scripts/build.sh && sh scripts/screenshots/run.sh <out dir> (run.sh stops them again; start.sh alone leaves them up for stop.sh)
# Refuses while any run holds the ports, from this out dir or another. SHOTS_SERVER_PORT, SHOTS_CHROME_PORT and
# SHOTS_SONARR_PORT move them (defaults 3999, 9333, 65301); stop.sh and shoot.mjs need the same values.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$(dirname "$0")/../.." && pwd)
SHOTS=$(mkdir -p "${1:?usage: sh scripts/screenshots/start.sh <out dir>}" && cd "$1" && pwd)
CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
export SHOTS_SERVER_PORT=${SHOTS_SERVER_PORT:-3999} SHOTS_CHROME_PORT=${SHOTS_CHROME_PORT:-9333} SHOTS_SONARR_PORT=${SHOTS_SONARR_PORT:-65301}
# A run from any out dir or worktree holds these ports; report it and leave it running, never kill it.
held=$(lsof -nP -i tcp:$SHOTS_SERVER_PORT -i tcp:$SHOTS_CHROME_PORT -i tcp:$SHOTS_SONARR_PORT -sTCP:LISTEN 2>/dev/null || true)
[ -z "$held" ] || { printf 'another run holds the ports, left running; stop it from its own out dir: sh scripts/screenshots/stop.sh <that out dir>\n%s\n' "$held" >&2; exit 1; }
[ -f "$REPO/dist/server/index.js" ] || { echo "no build: run sh scripts/build.sh first" >&2; exit 1; }
rm -rf "$SHOTS/run/db" "$SHOTS/run/chrome"
mkdir -p "$SHOTS/run/db" && chmod 700 "$SHOTS/run/db"
DB=$SHOTS/run/db/media-manager.sqlite
cd "$REPO"
put() { printf '%s' "$3" | DB_PATH=$DB node dist/server/cli.js settings set "$1" "$2"; }
put serviceAddresses sonarr.url http://127.0.0.1:$SHOTS_SONARR_PORT
put credentials sonarr.apiKey test-key
put serviceAddresses radarr.url http://127.0.0.1:65302
put credentials radarr.apiKey test-key
put serviceAddresses rtorrent.url http://127.0.0.1:1
put credentials rtorrent.username x
put credentials rtorrent.password x
put serviceAddresses plex.url http://127.0.0.1:1
put credentials plex.token x
for key in downloads.sonarr downloads.radarr library.sonarr library.radarr versions.sonarr versions.radarr; do
  mkdir -p "$SHOTS/run/folders/$key"; put hostPaths "$key" "$SHOTS/run/folders/$key"
done
node -e "const { DatabaseSync } = require('node:sqlite'); const { createHash } = require('node:crypto'); const db = new DatabaseSync(process.argv[1]); db.prepare('INSERT INTO sessions (token_hash, owner_id, expires_at) VALUES (?, 1, ?)').run(createHash('sha256').update('shots'.padEnd(43, 'x'), 'utf8').digest('base64url'), Date.now() + 86400000);" "$DB"
# One tracker cooling down, so a release row shows the cooldown bar: a rule for blutopia.cc (the indexer Blutopia) and its cooldown.
node -e "const { DatabaseSync } = require('node:sqlite'); new DatabaseSync(process.argv[1]).prepare('INSERT INTO tracker_cooldowns (host, since, text, known, trigger_hash) VALUES (?, ?, ?, 1, ?)').run('blutopia.cc', Date.now() - 3600000, 'Hit and run limit reached', 'shots');" "$DB"
nohup node "$HERE/sonarr.mjs" > "$SHOTS/run/sonarr.log" 2>&1 &
echo $! > "$SHOTS/run/sonarr.pid"
nohup env TRACKER_RULES='{"blutopia.cc":{"minHours":120}}' DB_PATH="$DB" HOST=127.0.0.1 PORT=$SHOTS_SERVER_PORT PLEX_OWNER_ID=1 APP_ORIGIN=http://127.0.0.1:$SHOTS_SERVER_PORT node dist/server/index.js > "$SHOTS/run/server.log" 2>&1 &
echo $! > "$SHOTS/run/server.pid"
nohup "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 --remote-debugging-port=$SHOTS_CHROME_PORT --user-data-dir="$SHOTS/run/chrome" about:blank > "$SHOTS/run/chrome.log" 2>&1 &
echo $! > "$SHOTS/run/chrome.pid"
for i in $(seq 1 60); do
  a=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$SHOTS_SERVER_PORT/ || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$SHOTS_CHROME_PORT/json || true)
  c=$(curl -s -o /dev/null -w '%{http_code}' -H 'X-Api-Key: test-key' http://127.0.0.1:$SHOTS_SONARR_PORT/api/v3/system/status || true)
  if [ "$a" = 200 ] && [ "$b" = 200 ] && [ "$c" = 200 ]; then echo "up after $i checks"; break; fi
  perl -e 'select(undef,undef,undef,0.25)'
done
echo "server $a chrome $b sonarr $c; pids sonarr $(cat "$SHOTS/run/sonarr.pid") server $(cat "$SHOTS/run/server.pid") chrome $(cat "$SHOTS/run/chrome.pid")"
