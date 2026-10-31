#!/usr/bin/env bash
# Tests for when `scripts/test.sh` runs the TV app's tests: only when the branch touches android-tv/, and a missing
# Android SDK (exit 97) skips them except in CI. Builds a throwaway repo with its own origin/main, the real test.sh,
# and stand-ins for android-tv.sh, build.sh and the test file.
#
# Usage: scripts/test-android-tests.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }

repo="$TMP_DIR/repo"
mkdir -p "$repo/scripts" "$repo/tests" "$repo/android-tv" "$repo/src"
cp "$SCRIPT_DIR/test.sh" "$repo/scripts/test.sh"
# The stand-in records each run and exits with STUB_STATUS.
printf '#!/bin/sh\necho run >> "%s/ran"\nexit "${STUB_STATUS:-0}"\n' "$TMP_DIR" > "$repo/scripts/android-tv.sh"
printf '#!/bin/sh\nexit 0\n' > "$repo/scripts/build.sh"
echo "import test from 'node:test'; test('stand-in', () => {});" > "$repo/tests/production.test.mjs"
cd "$repo" || exit 1
git init -q -b main
git config user.email test@example.com
git config user.name test
echo 'a' > android-tv/a.kt
echo 'a' > src/a.ts
git add -A && git commit -qm base
git update-ref refs/remotes/origin/main HEAD

# name, expected exit status, expected runs of the TV tests (0 or 1), extra env
expect() {
    local name=$1 status=$2 runs=$3 got got_runs
    shift 3
    rm -f "$TMP_DIR/ran"
    env "$@" sh scripts/test.sh > "$TMP_DIR/out" 2>&1
    got=$?
    got_runs=$( [ -f "$TMP_DIR/ran" ] && wc -l < "$TMP_DIR/ran" | tr -d ' ' || echo 0 )
    if [ "$got" = "$status" ] && [ "$got_runs" = "$runs" ]; then ok "$name"
    else fail "$name: expected exit $status and $runs run(s), got exit $got and $got_runs run(s)"; cat "$TMP_DIR/out" >&2; fi
}

git checkout -q -b work
echo 'b' > src/a.ts
git commit -qam 'server only'
expect "a branch that leaves android-tv alone skips the TV tests" 0 0 CI=

echo 'b' > android-tv/a.kt
expect "an uncommitted android-tv change runs them" 0 1 CI=
git commit -qam 'tv'
expect "a committed android-tv change runs them" 0 1 CI=
expect "a failing TV test fails the run" 1 1 CI= STUB_STATUS=1
expect "no Android SDK skips them on a laptop" 0 1 CI= STUB_STATUS=97
expect "no Android SDK fails the run in CI" 97 1 CI=true STUB_STATUS=97

git checkout -q main
git merge -q --no-ff work -m 'merge work'
git update-ref refs/remotes/origin/main HEAD
expect "main compares with its previous commit" 0 1 CI=

git update-ref -d refs/remotes/origin/main
git checkout -q work
echo 'c' > src/a.ts
git commit -qam 'server again'
expect "no origin/main runs them" 0 1 CI=

if [ "$FAILURES" -gt 0 ]; then
    echo "$FAILURES android-tests test(s) failed" >&2
    exit 1
fi
echo "all android-tests tests passed"
