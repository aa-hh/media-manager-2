#!/bin/sh
# Starts media-manager-2 on the deploy host unless it already answers. Cron
# runs it at @reboot and every minute; see README.md, "Keep it running". It
# runs only on the host, which has flock; macOS does not.
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
probe() { curl -fs -o /dev/null --max-time 5 "http://127.0.0.1:$PORT/auth/status"; }
probe && exit 0

# Same check as deploy.sh: signal the saved pid only while it is still this
# server, since a reused pid could belong to rTorrent or another app.
if [ -f "$app/server.pid" ]; then
    pid=$(cat "$app/server.pid")
    if [ "$(ps -o args= -p "$pid" 2>/dev/null)" = "node $server" ]; then
        # One slow answer on a busy host must not cost a healthy server its life.
        for _ in 2 3; do
            sleep 10
            probe && { log "pid $pid slow but answering, leaving it"; exit 0; }
        done
        log "pid $pid alive but not answering after 3 probes, stopping it"
        kill -TERM "$pid"
        i=0
        while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 20 ]; do
            i=$((i + 1))
            sleep 0.5
        done
        kill -0 "$pid" 2>/dev/null && kill -KILL "$pid"
    fi
fi
cd "$app" || exit 1
# 9>&- keeps the server from inheriting the lock, which would block every later run.
setsid node "$server" >> server.log 2>&1 < /dev/null 9>&- &
echo $! > server.pid
log "started pid $!"
