#!/bin/sh
# Builds this worktree and runs it on the Whatbox slot behind the fixed
# Managed Link, replacing whatever copy was running there. One-time slot setup
# is in README.md, "Test deploy to Whatbox".
#
# Usage: sh scripts/deploy.sh   (DEPLOY_HOST overrides the ssh host)
set -eu
cd "$(dirname "$0")/.."

host=${DEPLOY_HOST:-shenzhou}
branch=$(git rev-parse --abbrev-ref HEAD)
commit=$(git rev-parse --short HEAD)
[ -z "$(git status --porcelain)" ] || commit="$commit+uncommitted"

status=0
origin=$(ssh "$host" 'mkdir -p ~/media-manager-2 && f=~/.config/media-manager-2/env && { [ -f "$f" ] || exit 3; } && . "$f" && { [ -n "${PORT:-}" ] && [ -n "${APP_ORIGIN:-}" ] || exit 3; } && printf %s "$APP_ORIGIN"') || status=$?
if [ "$status" = 3 ]; then
    cat >&2 <<'EOF'
deploy: ~/.config/media-manager-2/env on the slot is missing or lacks PORT or APP_ORIGIN.
Create it with mode 600, containing:

PORT=<the Managed Link's port, 10000-32767>
HOST=127.0.0.1
APP_ORIGIN=<the Managed Link's https address, no trailing slash>
PLEX_OWNER_ID=<your numeric Plex account ID>

Leave DB_PATH unset so the database stays under ~/.local/share/media-manager-2.
EOF
    exit 1
elif [ "$status" != 0 ]; then
    echo "deploy: cannot reach $host over ssh" >&2
    exit 1
fi

# A fresh worktree has no node_modules, and a merge can change the lockfile.
# The marker lives inside node_modules so deleting that folder resets it.
if ! cmp -s package-lock.json node_modules/.installed-package-lock.json; then
    npm ci --no-audit --no-fund
    cp package-lock.json node_modules/.installed-package-lock.json
fi

sh scripts/build.sh
rsync -a --delete dist package.json package-lock.json "$host:media-manager-2/"
rsync -a scripts/ensure-running.sh "$host:media-manager-2/bin/"

ssh "$host" sh -s -- "$branch" "$commit" <<'EOF'
set -eu
cd ~/media-manager-2
set -a
. ~/.config/media-manager-2/env
set +a
server="$HOME/media-manager-2/dist/server/index.js"

fail() {
    echo "deploy: $1. Last log lines:" >&2
    tail -n 20 server.log >&2
    exit 1
}

chmod 755 bin/ensure-running.sh
# Hold the ensure script's lock while the servers swap, so a cron run cannot
# start a second copy in between. The lock goes when this ssh session ends.
exec 9>ensure.lock
flock -w 60 9 || fail "ensure script still running after 60 seconds"

# Signal the saved pid only while it is still this server: a reused pid could
# belong to rTorrent or another app on the slot.
if [ -f server.pid ]; then
    pid=$(cat server.pid)
    if [ "$(ps -o args= -p "$pid" 2>/dev/null)" = "node $server" ]; then
        kill -TERM "$pid"
        i=0
        while kill -0 "$pid" 2>/dev/null; do
            i=$((i + 1))
            [ "$i" -le 60 ] || fail "old server (pid $pid) still running after 30 seconds"
            sleep 0.5
        done
    fi
fi

if [ ! -d node_modules ] || ! cmp -s package-lock.json .installed-package-lock.json; then
    npm ci --omit=dev --no-audit --no-fund
    cp package-lock.json .installed-package-lock.json
fi

if [ -f server.log ]; then
    mv server.log server.log.1
fi
# setsid detaches the server from this ssh session so it outlives the logout;
# 9>&- keeps it from inheriting the lock.
setsid node "$server" >> server.log 2>&1 < /dev/null 9>&- &
pid=$!
echo "$pid" > server.pid

i=0
while :; do
    kill -0 "$pid" 2>/dev/null || fail "server exited during startup"
    curl -fs -o /dev/null "http://127.0.0.1:$PORT/auth/status" && break
    i=$((i + 1))
    [ "$i" -le 60 ] || fail "no answer on port $PORT after 30 seconds"
    sleep 0.5
done
echo "Slot check: the server (pid $pid) answers on port $PORT."

node dist/server/cli.js connections check || true

printf 'branch %s\ncommit %s\ndeployed %s\n' "$1" "$2" "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" > DEPLOYED
cat DEPLOYED
EOF

code=$(curl -s -o /dev/null -w '%{http_code}' "$origin/auth/status") || true
if [ "$code" != 200 ]; then
    echo "deploy: $origin/auth/status answered ${code:-nothing}, so the Managed Link is not reaching the server" >&2
    exit 1
fi
echo "HTTPS check: $origin answers."
