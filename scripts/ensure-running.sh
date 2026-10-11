#!/bin/sh
# Starts media-manager-2 on the Whatbox slot unless it already answers. Cron
# runs it at @reboot and every minute; see README.md, "Restart after a crash
# or reboot". It runs only on the slot, which has flock; macOS does not.
set -u
app="$HOME/media-manager-2"
server="$app/dist/server/index.js"
log() { echo "[$(date -u +%FT%TZ)] [$$] $*"; }

# One run at a time; deploy.sh takes the same lock while it swaps servers.
exec 9>"$app/ensure.lock"
flock -n 9 || { log "another run holds the lock, exiting"; exit 0; }

set -a
. "$HOME/.config/media-manager-2/env"
set +a
curl -fs -o /dev/null --max-time 5 "http://127.0.0.1:$PORT/auth/status" && exit 0

# Same check as deploy.sh: signal the saved pid only while it is still this
# server, since a reused pid could belong to rTorrent or another app.
if [ -f "$app/server.pid" ]; then
    pid=$(cat "$app/server.pid")
    if [ "$(ps -o args= -p "$pid" 2>/dev/null)" = "node $server" ]; then
        log "pid $pid alive but not answering, stopping it"
        kill -TERM "$pid"
        sleep 5
        kill -KILL "$pid" 2>/dev/null
    fi
fi
cd "$app" || exit 1
# 9>&- keeps the server from inheriting the lock, which would block every later run.
setsid node "$server" >> server.log 2>&1 < /dev/null 9>&- &
echo $! > server.pid
log "started pid $!"
