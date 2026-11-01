#!/usr/bin/env bash
# Tests that `scripts/android-tv.sh release` refuses, with exit 2 and before Gradle runs, when either release keystore
# variable is unset, so an unsigned APK can never come out of it. Runs the real script against a stand-in SDK folder and
# a stand-in gradlew that records any call.
#
# Usage: scripts/test-android-release.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }

repo="$TMP_DIR/repo"
mkdir -p "$repo/scripts" "$repo/android-tv" "$TMP_DIR/sdk/platforms/android-37"
cp "$SCRIPT_DIR/android-tv.sh" "$repo/scripts/android-tv.sh"
printf '#!/bin/sh\necho "$@" >> "%s/gradle-ran"\n' "$TMP_DIR" > "$repo/android-tv/gradlew"

# name, then the env for the run; every case expects exit 2, the refusal message and no Gradle call.
refuses() {
    local name=$1 got
    shift
    rm -f "$TMP_DIR/gradle-ran"
    env -u ANDROID_TV_KEYSTORE_PATH -u ANDROID_TV_KEYSTORE_PASSWORD ANDROID_HOME="$TMP_DIR/sdk" ANDROID_TV_LOCK="$TMP_DIR/lock" "$@" \
        sh "$repo/scripts/android-tv.sh" release > "$TMP_DIR/out" 2>&1
    got=$?
    if [ "$got" = 2 ] && grep -q 'release needs ANDROID_TV_KEYSTORE_PATH' "$TMP_DIR/out" && [ ! -f "$TMP_DIR/gradle-ran" ]; then
        ok "$name"
    else
        fail "$name: expected exit 2, the refusal and no Gradle call; got exit $got"; cat "$TMP_DIR/out" >&2
    fi
}

refuses "neither variable set refuses"
refuses "only the keystore path set refuses" ANDROID_TV_KEYSTORE_PATH=/tmp/release.p12
refuses "only the password set refuses" ANDROID_TV_KEYSTORE_PASSWORD=secret

[ "$FAILURES" -eq 0 ] || { echo "$FAILURES failure(s)" >&2; exit 1; }
