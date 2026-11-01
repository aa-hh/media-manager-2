#!/usr/bin/env bash
# Tests that `scripts/android-tv.sh` runs one Android build at a time per machine: a second run waits for the first,
# a lock left by a dead run is taken over, and the lock is gone after a run, failed or not. Runs the real script
# against a stand-in SDK and gradlew, with the lock in a temporary folder.
#
# Usage: scripts/test-android-lock.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }

repo="$TMP_DIR/repo"
lock="$TMP_DIR/lock"
mkdir -p "$repo/scripts" "$repo/android-tv/ffmpeg/out" "$repo/android-tv/gradle" "$TMP_DIR/sdk/platforms/android-37"
cp "$SCRIPT_DIR/android-tv.sh" "$repo/scripts/android-tv.sh"
echo 'media3 = "1.0.0"' > "$repo/android-tv/gradle/libs.versions.toml"
echo 'unused' > "$repo/android-tv/ffmpeg/build.sh"
# A decoder whose key matches, so the runs go straight to the stand-in gradlew.
touch "$repo/android-tv/ffmpeg/out/lib-decoder-ffmpeg-release.aar"
{ cat "$repo/android-tv/ffmpeg/build.sh"; grep '^media3 = ' "$repo/android-tv/gradle/libs.versions.toml"; } \
    | shasum -a 256 | cut -c1-16 > "$repo/android-tv/ffmpeg/out/key"
# The stand-in Gradle logs when it starts and ends, sleeping in between so two runs would overlap.
cat > "$repo/android-tv/gradlew" <<STUB
#!/bin/sh
echo "start \$\$" >> "$TMP_DIR/log"
sleep "\${STUB_SLEEP:-0}"
echo "end \$\$" >> "$TMP_DIR/log"
exit "\${STUB_STATUS:-0}"
STUB

tv() { ANDROID_HOME="$TMP_DIR/sdk" ANDROID_TV_LOCK="$lock" sh "$repo/scripts/android-tv.sh" "$@"; }

# Two runs at once: the second starts only after the first ends. Dropping take_lock turns this red.
rm -f "$TMP_DIR/log"
STUB_SLEEP=2 tv test > "$TMP_DIR/first" 2>&1 &
first=$!
sleep 0.5
STUB_SLEEP=0 tv build > "$TMP_DIR/second" 2>&1
wait "$first"
if [ "$(cut -d' ' -f1 "$TMP_DIR/log" | tr '\n' ' ')" = "start end start end " ]; then ok "a second run waits for the first"
else fail "the runs overlapped: $(tr '\n' ' ' < "$TMP_DIR/log")"; fi
grep -q 'waiting for it to finish' "$TMP_DIR/second" && ok "the waiting run says why" || fail "no waiting message"
[ -L "$lock" ] && fail "the lock is still there after both runs" || ok "the lock is removed after a run"

# A lock naming a pid that no longer runs is taken over instead of waited on forever.
sh -c 'exit 0' & dead=$!
wait "$dead"
ln -s "$dead" "$lock"
if tv test > "$TMP_DIR/out" 2>&1 && [ ! -L "$lock" ]; then ok "a dead run's lock is taken over"
else fail "a dead run's lock was not taken over"; cat "$TMP_DIR/out" >&2; fi

# A failed build still lets the next one run.
STUB_STATUS=1 tv test > "$TMP_DIR/out" 2>&1
status=$?
if [ "$status" = 1 ] && [ ! -L "$lock" ]; then ok "a failed run removes the lock"
else fail "a failed run: exit $status, lock $( [ -L "$lock" ] && echo kept || echo removed )"; fi

# install only talks to the box, so it neither waits for nor takes the lock.
ln -s $$ "$lock"
mkdir -p "$TMP_DIR/sdk/platform-tools"
printf '#!/bin/sh\nexit 0\n' > "$TMP_DIR/sdk/platform-tools/adb"
chmod +x "$TMP_DIR/sdk/platform-tools/adb"
if ANDROID_TV_DEVICE=box tv install > "$TMP_DIR/out" 2>&1 && [ "$(readlink "$lock")" = "$$" ]; then ok "install does not wait for the lock"
else fail "install waited for or took the lock"; cat "$TMP_DIR/out" >&2; fi
rm -f "$lock"

[ "$FAILURES" -eq 0 ] || { echo "$FAILURES failure(s)" >&2; exit 1; }
echo "all android-lock tests passed"
