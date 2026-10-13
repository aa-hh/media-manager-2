#!/bin/sh
# Stops the stand-in Sonarr, the server and Chrome that start.sh recorded in <out dir>/run/*.pid, and whatever still
# listens on their ports when the pid files are gone.
# Run: sh scripts/screenshots/stop.sh <out dir>
RUN=${1:?usage: sh scripts/screenshots/stop.sh <out dir>}/run
for pidfile in "$RUN"/*.pid; do
  [ -f "$pidfile" ] || continue
  kill "$(cat "$pidfile")" 2>/dev/null || true
  rm -f "$pidfile"
done
left=$(lsof -t -i tcp:3999 -i tcp:9333 -i tcp:65301 -sTCP:LISTEN 2>/dev/null || true)
[ -z "$left" ] || kill $left 2>/dev/null || true
