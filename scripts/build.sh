#!/bin/sh
# The one way to compile/typecheck this repo. Agents call this, never the bare
# build command (the Claude hook in .claude/hooks/ enforces it).
set -eu
cd "$(dirname "$0")/.."
rm -rf dist
npm run build "$@"
