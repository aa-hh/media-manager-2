#!/bin/sh
# The one way to compile/typecheck this repo. Agents call this, never the bare
# build command (the Claude hook in .claude/hooks/ enforces it).
set -eu
cd "$(dirname "$0")/.."
# Best-effort: remove worktrees flagged .prunable (scripts/housekeeping.sh); never fails the build.
sh scripts/housekeeping.sh || true
rm -rf dist
npm run build "$@"
