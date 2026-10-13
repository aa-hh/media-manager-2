#!/usr/bin/env bash
# Tests for scripts/screenshots/{start,stop,run}.sh: a run never kills another run. Fakes an out dir whose pid file
# points at a sleep, holds one of the harness ports with a node listener, and runs the three scripts against them.
# Needs no build and no Chrome: every case stops at the refusal or at the pid files.
#
# Usage: scripts/test-screenshots.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHOTS="$SCRIPT_DIR/screenshots"
TMP_DIR="$(mktemp -d)"
OUT="$TMP_DIR/out dir"
LISTENER=
SLEEPER=
trap 'kill $LISTENER $SLEEPER 2>/dev/null; rm -rf "$TMP_DIR"' EXIT

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }
ports() { lsof -nP -i tcp:3999 -i tcp:9333 -i tcp:65301 -sTCP:LISTEN 2>/dev/null; }
# Polls until the command holds, a generous ceiling instead of a fixed sleep.
until_ok() { for _ in $(seq 1 40); do "$@" && return 0; sleep 0.25; done; return 1; }

held=$(ports)
if [ -n "$held" ]; then
  printf 'the harness ports are held, so this test cannot run; left running:\n%s\n' "$held" >&2
  exit 1
fi

# The listener plays a run from another out dir; the sleeper plays a process this out dir started.
node -e "require('node:net').createServer().listen(65301, '127.0.0.1')" >/dev/null 2>&1 &
LISTENER=$!
disown "$LISTENER"
until_ok sh -c 'lsof -t -i tcp:65301 -sTCP:LISTEN >/dev/null 2>&1' || { echo "listener never bound 65301" >&2; exit 1; }
# Started from a subshell so it is nobody's child: killed, it leaves no zombie, and kill -0 then tells the truth.
SLEEPER=$( (sleep 300 >/dev/null 2>&1 & echo $!) )
mkdir -p "$OUT/run" && echo "$SLEEPER" > "$OUT/run/server.pid"

run() { ERR="$(sh "$1" "$OUT" 2>&1 >/dev/null)"; RC=$?; }
expect() {
  if [ "$RC" -ne "$2" ]; then fail "$1: exit $RC, wanted $2 ($ERR)"; return; fi
  if [ -n "${3:-}" ] && ! printf '%s' "$ERR" | grep -qF -- "$3"; then
    fail "$1: stderr lacks '$3' ($ERR)"; return
  fi
  ok "$1"
}

# (a) start.sh refuses while a port is held, names the holder, kills nothing. Red if start.sh goes back to checking
# only its own out dir's pid files.
run "$SHOTS/start.sh"; expect "start refused while a port is held" 1 " $LISTENER "
kill -0 "$LISTENER" 2>/dev/null || fail "(a) start killed the listener"

# (b) run.sh with a refused start leaves this out dir's own process and pid file alone. Red if run.sh sets its
# EXIT trap before start.sh has succeeded.
run "$SHOTS/run.sh"; expect "run exits on a refused start" 1 " $LISTENER "
kill -0 "$SLEEPER" 2>/dev/null || fail "(b) run killed the sleeper after a refused start"
[ -f "$OUT/run/server.pid" ] || fail "(b) run removed the pid file after a refused start"
kill -0 "$LISTENER" 2>/dev/null || fail "(b) run killed the listener"

# (c) stop.sh kills the pid-file process, removes the file, leaves the other run's listener. Red if stop.sh stops
# reading the pid files or sweeps the ports.
run "$SHOTS/stop.sh"; expect "stop kills the pid-file process" 0
until_ok sh -c "! kill -0 $SLEEPER 2>/dev/null" || fail "(c) sleeper still alive after stop"
[ -f "$OUT/run/server.pid" ] && fail "(c) pid file still there after stop"
kill -0 "$LISTENER" 2>/dev/null || fail "(c) stop killed the listener"

# (d) stop.sh with no pid files reports the port holder instead of killing it. Red if stop.sh sweeps the ports.
run "$SHOTS/stop.sh"; expect "stop reports the holder when pid files are gone" 1 " $LISTENER "
kill -0 "$LISTENER" 2>/dev/null || fail "(d) stop killed the listener"

if [ "$FAILURES" -gt 0 ]; then
  echo "$FAILURES screenshots test(s) FAILED" >&2
  exit 1
fi
echo "all screenshots tests passed"
