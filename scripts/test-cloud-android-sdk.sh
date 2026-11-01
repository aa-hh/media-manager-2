#!/usr/bin/env bash
# Tests for scripts/cloud-android-sdk.sh and the cloud fallback in scripts/android-tv.sh. A stand-in `uname` decides
# whether the installer thinks it is on Linux, and a stand-in sdkmanager records what it was asked to install.
#
# Usage: scripts/test-cloud-android-sdk.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }

mkdir -p "$TMP_DIR/bin"
PATH="$TMP_DIR/bin:$PATH"
os() { printf '#!/bin/sh\necho %s\n' "$1" > "$TMP_DIR/bin/uname"; chmod +x "$TMP_DIR/bin/uname"; }

jdk="$TMP_DIR/jdk" sdk="$TMP_DIR/sdk"
# A JDK and command-line tools already in place, so no case downloads anything. MAKE_DIRS=1 makes the stand-in
# sdkmanager create each package's folder, as the real one does.
reset() {
    rm -rf "$jdk" "$sdk" "$TMP_DIR/asked"
    mkdir -p "$jdk/bin" "$sdk/cmdline-tools/latest/bin"
    printf '#!/bin/sh\n' > "$jdk/bin/java"
    cat > "$sdk/cmdline-tools/latest/bin/sdkmanager" <<STUB
#!/bin/sh
for a in "\$@"; do
    case \$a in --*) ;; *) echo "\$a" >> "$TMP_DIR/asked"; [ "\${MAKE_DIRS:-}" = 1 ] && mkdir -p "$sdk/\$(echo "\$a" | tr ';' '/')" ;; esac
done
exit 0
STUB
    chmod +x "$jdk/bin/java" "$sdk/cmdline-tools/latest/bin/sdkmanager"
}
install() { JDK_DIR="$jdk" ANDROID_HOME="$sdk" env "$@" sh "$SCRIPT_DIR/cloud-android-sdk.sh" > "$TMP_DIR/out" 2>&1; }

reset; rm -rf "$jdk" "$sdk"; os Darwin
install && [ ! -e "$jdk" ] && [ ! -e "$sdk" ] && ok "does nothing off Linux" || fail "touched $jdk or $sdk off Linux"

reset; os Linux
if install MAKE_DIRS=1 && grep -qx 'platforms;android-37.0' "$TMP_DIR/asked" && [ -d "$sdk/platforms/android-37.0" ]; then
    ok "installs platforms;android-37.0 and the rest"
else fail "fresh install"; cat "$TMP_DIR/out" >&2; fi

rm -f "$TMP_DIR/asked"
install MAKE_DIRS=1 && [ ! -e "$TMP_DIR/asked" ] && ok "a second run asks sdkmanager for nothing" || fail "second run reinstalled"

reset
if ! install && grep -q 'did not install' "$TMP_DIR/out"; then ok "fails when sdkmanager installs nothing"
else fail "a package sdkmanager skipped went unnoticed"; cat "$TMP_DIR/out" >&2; fi

# With neither the Mac SDK nor /opt/android-sdk present, android-tv.sh keeps the Mac default and exits 97.
if [ -d /opt/android-sdk ]; then
    echo "  skip — /opt/android-sdk exists here"
else
    mkdir -p "$TMP_DIR/home"
    env -u JAVA_HOME -u ANDROID_HOME HOME="$TMP_DIR/home" sh "$SCRIPT_DIR/android-tv.sh" test > "$TMP_DIR/out" 2>&1
    if [ $? = 97 ] && grep -q "$TMP_DIR/home/Library/Android/sdk" "$TMP_DIR/out"; then ok "android-tv.sh keeps the Mac SDK default"
    else fail "android-tv.sh default"; cat "$TMP_DIR/out" >&2; fi
fi

[ "$FAILURES" = 0 ] || { echo "$FAILURES failure(s)" >&2; exit 1; }
echo "all passed"
