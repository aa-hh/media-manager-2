#!/bin/sh
# Stops the stand-in Sonarr, the server and Chrome that start.sh recorded in <out dir>/run/*.pid.
# Run: sh scripts/build.sh && sh scripts/screenshots/start.sh <out dir> && node scripts/screenshots/shoot.mjs <out dir>; sh scripts/screenshots/stop.sh <out dir>
RUN=${1:?usage: sh scripts/screenshots/stop.sh <out dir>}/run
for pidfile in "$RUN"/*.pid; do
  [ -f "$pidfile" ] || continue
  kill "$(cat "$pidfile")" 2>/dev/null || true
  rm -f "$pidfile"
done
