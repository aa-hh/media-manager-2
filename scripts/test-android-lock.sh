#!/usr/bin/env bash
# Tests that `scripts/android-tv.sh` runs one Android build at a time per machine: a run that finds another running
# exits 75 and names it, a lock left by a dead run is taken over, and the lock is gone after a run, failed or not.
# Runs the real script against a stand-in SDK and gradlew, with the lock in a temporary folder.
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
# The stand-in Gradle records that it ran.
cat > "$repo/android-tv/gradlew" <<STUB
#!/bin/sh
echo ran >> "$TMP_DIR/log"
exit "\${STUB_STATUS:-0}"
STUB

tv() { ANDROID_HOME="$TMP_DIR/sdk" ANDROID_TV_LOCK="$lock" sh "$repo/scripts/android-tv.sh" "$@"; }

# A run that finds a live holder says who and exits 75 without running Gradle; the holder's lock stays.
# Dropping take_lock turns this red.
# The live holder is a process running a script named android-tv.sh, as a real holder is.
mkdir -p "$TMP_DIR/holder"
printf 'sleep 60\n:\n' > "$TMP_DIR/holder/android-tv.sh"
bash "$TMP_DIR/holder/android-tv.sh" &
live=$!
rm -f "$TMP_DIR/log"
ln -s "$live" "$lock"
tv build > "$TMP_DIR/out" 2>&1
status=$?
if [ "$status" = 75 ] && [ ! -f "$TMP_DIR/log" ] && [ "$(readlink "$lock")" = "$live" ]; then ok "a run that finds another running exits 75"
else fail "a busy lock: exit $status, gradle $( [ -f "$TMP_DIR/log" ] && echo ran || echo 'did not run' )"; cat "$TMP_DIR/out" >&2; fi
grep -q "pid $live" "$TMP_DIR/out" && ok "it names the holder" || fail "the holder's pid is not in the message"
kill "$live" 2>/dev/null
wait "$live" 2>/dev/null
rm -f "$lock"

# A live pid that is not this script (the pid was reused) does not hold the lock.
ln -s $$ "$lock"
if tv test > "$TMP_DIR/out" 2>&1 && [ ! -L "$lock" ]; then ok "a reused pid's lock is taken over"
else fail "a reused pid's lock was not taken over"; cat "$TMP_DIR/out" >&2; fi

# A lock that can't be made at all stops the run with a message instead of spinning.
ANDROID_HOME="$TMP_DIR/sdk" ANDROID_TV_LOCK="$TMP_DIR/missing/lock" sh "$repo/scripts/android-tv.sh" test > "$TMP_DIR/out" 2>&1
status=$?
if [ "$status" = 75 ] && grep -q 'could not create' "$TMP_DIR/out"; then ok "a lock that can't be made is reported"
else fail "a lock that can't be made: exit $status"; cat "$TMP_DIR/out" >&2; fi

# A free lock is taken for the run and removed after it.
tv test > "$TMP_DIR/out" 2>&1
if [ "$?" = 0 ] && [ -f "$TMP_DIR/log" ] && [ ! -L "$lock" ]; then ok "the lock is removed after a run"
else fail "a free lock: the run failed or left the lock"; cat "$TMP_DIR/out" >&2; fi

# A lock naming a pid that no longer runs is taken over instead of waited on forever.
sh -c 'exit 0' & dead=$!
wait "$dead"
ln -s "$dead" "$lock"
if tv test > "$TMP_DIR/out" 2>&1 && [ ! -L "$lock" ]; then ok "a dead run's lock is taken over"
else fail "a dead run's lock was not taken over"; cat "$TMP_DIR/out" >&2; fi

# Something at the lock path that is not a lock stops the run with a message instead of spinning.
echo junk > "$lock"
tv test > "$TMP_DIR/out" 2>&1
status=$?
if [ "$status" = 75 ] && grep -q 'not a lock' "$TMP_DIR/out"; then ok "a file in the lock's place is reported"
else fail "a file in the lock's place: exit $status"; cat "$TMP_DIR/out" >&2; fi
rm -f "$lock"

# A failed build still lets the next one run.
STUB_STATUS=1 tv test > "$TMP_DIR/out" 2>&1
status=$?
if [ "$status" = 1 ] && [ ! -L "$lock" ]; then ok "a failed run removes the lock"
else fail "a failed run: exit $status, lock $( [ -L "$lock" ] && echo kept || echo removed )"; fi

# A run whose lock was taken over by another while it ran leaves the new holder's lock alone.
cat > "$repo/android-tv/gradlew" <<STUB
#!/bin/sh
echo ran >> "$TMP_DIR/log"
[ -n "\${STUB_TAKEOVER:-}" ] && rm -f "$lock" && ln -s "\$STUB_TAKEOVER" "$lock"
exit 0
STUB
STUB_TAKEOVER=$$ tv test > "$TMP_DIR/out" 2>&1
if [ "$(readlink "$lock" 2>/dev/null)" = "$$" ]; then ok "a run leaves a lock it no longer holds"
else fail "a run removed a lock another run had taken"; fi
rm -f "$lock"

# install only talks to the box, so it neither checks nor takes the lock.
ln -s $$ "$lock"
mkdir -p "$TMP_DIR/sdk/platform-tools"
printf '#!/bin/sh\nexit 0\n' > "$TMP_DIR/sdk/platform-tools/adb"
chmod +x "$TMP_DIR/sdk/platform-tools/adb"
if ANDROID_TV_DEVICE=box tv install > "$TMP_DIR/out" 2>&1 && [ "$(readlink "$lock")" = "$$" ]; then ok "install ignores the lock"
else fail "install was refused by or took the lock"; cat "$TMP_DIR/out" >&2; fi
rm -f "$lock"

[ "$FAILURES" -eq 0 ] || { echo "$FAILURES failure(s)" >&2; exit 1; }
echo "all android-lock tests passed"
