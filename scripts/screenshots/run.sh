#!/bin/sh
# One screenshot run: starts the stand-in Sonarr, the server and Chrome, saves the shots, and stops all three again
# even when a shot fails, so nothing outlives the command. A refused start stops nothing: the trap is set only after
# start.sh succeeded, so the earlier run that caused the refusal keeps going.
# Run: sh scripts/build.sh && sh scripts/screenshots/run.sh <out dir>
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${1:?usage: sh scripts/screenshots/run.sh <out dir>}
sh "$HERE/start.sh" "$OUT" || exit
trap 'sh "$HERE/stop.sh" "$OUT"' EXIT
node "$HERE/shoot.mjs" "$OUT"
