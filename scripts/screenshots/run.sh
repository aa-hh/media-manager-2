#!/bin/sh
# One screenshot run: starts the stand-in Sonarr, the server and Chrome, saves the shots, and stops all three again
# even when a step fails, so nothing outlives the command.
# Run: sh scripts/build.sh && sh scripts/screenshots/run.sh <out dir>
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${1:?usage: sh scripts/screenshots/run.sh <out dir>}
trap 'sh "$HERE/stop.sh" "$OUT"' EXIT
sh "$HERE/start.sh" "$OUT" && node "$HERE/shoot.mjs" "$OUT"
