#!/usr/bin/env bash
# Tests for `scripts/test.sh --story-args`: which stories `--full` tests. Builds a throwaway repo with its own
# origin/main and a copy of test.sh, then checks the arguments printed for each case. An empty line runs every story.
#
# Usage: scripts/test-story-args.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }

repo="$TMP_DIR/repo"
mkdir -p "$repo/scripts" "$repo/.storybook" "$repo/src/client/components"
cp "$SCRIPT_DIR/test.sh" "$repo/scripts/test.sh"
cd "$repo" || exit 1
git init -q -b main
git config user.email test@example.com
git config user.name test
echo '{}' > package.json
echo 'export default {}' > .storybook/main.ts
echo ':root {}' > src/client/globals.css
echo 'export const A = 1' > src/client/components/a.tsx
git add -A && git commit -qm base
git update-ref refs/remotes/origin/main HEAD

args() { sh scripts/test.sh --story-args; }
expect() { # name, expected output
    local got
    got=$(args)
    if [ "$got" = "$2" ]; then ok "$1"; else fail "$1: expected '$2', got '$got'"; fi
}

git checkout -q -b work
echo 'export const A = 2' > src/client/components/a.tsx
git commit -qam 'component'
expect "a branch compares with where it left main" "--changed $(git rev-parse main) --passWithNoTests"

echo '{"name":"x"}' > package.json
expect "an uncommitted package.json change runs every story" ""
git checkout -q -- package.json

echo 'export default { stories: [] }' > .storybook/main.ts
git commit -qam 'storybook'
expect "a .storybook change runs every story" ""
git reset -q --hard HEAD~1

echo ':root { --x: 1 }' > src/client/globals.css
git commit -qam 'theme'
expect "a theme change runs every story" ""
git reset -q --hard HEAD~1

git checkout -q main
git merge -q --no-ff work -m 'merge work'
git update-ref refs/remotes/origin/main HEAD
expect "main compares with its previous commit" "--changed $(git rev-parse HEAD~1) --passWithNoTests"

git update-ref -d refs/remotes/origin/main
expect "no origin/main runs every story" ""

if [ "$FAILURES" -gt 0 ]; then
    echo "$FAILURES story-args test(s) failed" >&2
    exit 1
fi
echo "all story-args tests passed"
