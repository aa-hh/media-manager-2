#!/usr/bin/env bash
# Tests for when `scripts/android-tv.sh` reuses the FFmpeg decoder instead of rebuilding it: out/ is reused only while
# out/key matches the current key, the shared cache is copied on a hit, and a miss builds and fills the cache. Runs the
# real script against a stand-in SDK, gradlew and ffmpeg/build.sh, with the cache in a temporary folder.
#
# Usage: scripts/test-android-ffmpeg-cache.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }

repo="$TMP_DIR/repo"
cache="$TMP_DIR/cache"
mkdir -p "$repo/scripts" "$repo/android-tv/ffmpeg" "$repo/android-tv/gradle" "$cache" \
    "$TMP_DIR/sdk/platforms/android-37" "$TMP_DIR/sdk/ndk/26.1.10909125"
cp "$SCRIPT_DIR/android-tv.sh" "$repo/scripts/android-tv.sh"
printf '#!/bin/sh\nexit 0\n' > "$repo/android-tv/gradlew"
# The stand-in build records that it ran and writes an AAR naming the media3 version it was built for.
cat > "$repo/android-tv/ffmpeg/build.sh" <<STUB
#!/bin/bash
cd "\$(dirname "\$0")"
echo built >> "$TMP_DIR/built"
rm -rf out && mkdir -p out
grep '^media3 = ' ../gradle/libs.versions.toml > out/lib-decoder-ffmpeg-release.aar
STUB
echo 'media3 = "1.0.0"' > "$repo/android-tv/gradle/libs.versions.toml"
aar="$repo/android-tv/ffmpeg/out/lib-decoder-ffmpeg-release.aar"

# name, expected builds (0 or 1), expected AAR contents afterwards
run() {
    local name=$1 builds=$2 want=$3 got_builds
    rm -f "$TMP_DIR/built"
    ANDROID_HOME="$TMP_DIR/sdk" ANDROID_TV_FFMPEG_CACHE="$cache" sh "$repo/scripts/android-tv.sh" test > "$TMP_DIR/out" 2>&1
    got_builds=$( [ -f "$TMP_DIR/built" ] && wc -l < "$TMP_DIR/built" | tr -d ' ' || echo 0 )
    if [ "$got_builds" = "$builds" ] && [ "$(cat "$aar" 2>/dev/null)" = "$want" ]; then ok "$name"
    else fail "$name: expected $builds build(s) and AAR '$want', got $got_builds and '$(cat "$aar" 2>/dev/null)'"; cat "$TMP_DIR/out" >&2; fi
}

# Building when out/ is empty but not filling the cache turns the fourth case red.
run "no decoder and an empty cache builds it" 1 'media3 = "1.0.0"'
[ "$(ls "$cache")" ] && ok "the build is saved to the cache" || fail "the cache is still empty after a build"
# Checking only that the AAR exists, not out/key, turns this red.
run "a decoder whose key matches is reused" 0 'media3 = "1.0.0"'
echo 'media3 = "1.1.0"' > "$repo/android-tv/gradle/libs.versions.toml"
run "a Media3 bump with no cached copy rebuilds" 1 'media3 = "1.1.0"'
rm -rf "$repo/android-tv/ffmpeg/out"
run "a fresh worktree copies the cached decoder" 0 'media3 = "1.1.0"'
grep -q 'reused from' "$TMP_DIR/out" && ok "the copy says where it came from" || fail "no 'reused from' line"
echo 'media3 = "1.0.0"' > "$repo/android-tv/gradle/libs.versions.toml"
rm -f "$repo/android-tv/ffmpeg/out/key"
run "a decoder with no out/key takes the cached copy for the current key" 0 'media3 = "1.0.0"'

[ "$FAILURES" -eq 0 ] || { echo "$FAILURES failure(s)" >&2; exit 1; }
