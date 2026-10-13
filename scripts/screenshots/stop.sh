#!/bin/sh
# Stops the stand-in Sonarr, the server and Chrome that start.sh recorded in <out dir>/run/*.pid, and waits until they
# are gone so a start right after is not refused. Only those: when the pid files are gone but the ports are still held,
# that is another run (other out dir or worktree), reported and left running.
# Run: sh scripts/screenshots/stop.sh <out dir> (with the SHOTS_*_PORT values start.sh had, if any)
RUN=${1:?usage: sh scripts/screenshots/stop.sh <out dir>}/run
pids=
for pidfile in "$RUN"/*.pid; do
  [ -f "$pidfile" ] || continue
  pids="$pids $(cat "$pidfile")"
  rm -f "$pidfile"
done
if [ -n "$pids" ]; then
  kill $pids 2>/dev/null
  for _ in $(seq 1 40); do kill -0 $pids 2>/dev/null || exit 0; perl -e 'select(undef,undef,undef,0.25)'; done
  echo "still running after 10s: pids$pids" >&2
  exit 1
fi
# lsof exits 1 whenever one of the three ports has no holder, so test its output, not its status.
held=$(lsof -nP -i tcp:${SHOTS_SERVER_PORT:-3999} -i tcp:${SHOTS_CHROME_PORT:-9333} -i tcp:${SHOTS_SONARR_PORT:-65301} -sTCP:LISTEN 2>/dev/null)
[ -n "$held" ] || exit 0
printf 'no pid files in %s; the ports are held by another run, left running:\n%s\n' "$RUN" "$held" >&2
exit 1
