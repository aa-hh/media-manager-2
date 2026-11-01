#!/bin/sh
# Installs what `sh scripts/android-tv.sh build|test` needs in a Linux cloud container: JDK 25 and an Android SDK
# with platform 37, build-tools, platform-tools and NDK 26.1.10909125 (for the FFmpeg decoder). It is the cloud
# counterpart of Android Studio's SDK Manager on a Mac, and does nothing on a machine that is not Linux.
#
# Run it from the environment's setup script (so the result is cached with the environment), or let the
# SessionStart hook run it. A second run finds everything in place and returns in well under a second.
#
# Installs into /opt/jdk-25 and /opt/android-sdk unless JDK_DIR / ANDROID_HOME say otherwise.
set -eu

[ "$(uname -s)" = Linux ] || exit 0

JDK_DIR=${JDK_DIR:-/opt/jdk-25}
ANDROID_HOME=${ANDROID_HOME:-/opt/android-sdk}
# Kept in step with android-tv/app/build.gradle.kts (compileSdk) and android-tv/ffmpeg/build.sh (NDK_VERSION).
# Google lists API 37 as platforms;android-37.0 (there is no platforms;android-37).
PACKAGES="platform-tools platforms;android-37.0 build-tools;37.0.0 ndk;26.1.10909125"
CMDLINE_TOOLS=commandlinetools-linux-16111833_latest.zip

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

if [ ! -x "$JDK_DIR/bin/java" ]; then
    echo "cloud-android-sdk: installing JDK 25 into $JDK_DIR"
    curl -fsSL -o "$tmp/jdk.tar.gz" \
        "https://api.adoptium.net/v3/binary/latest/25/ga/linux/x64/jdk/hotspot/normal/eclipse"
    mkdir -p "$JDK_DIR"
    tar -xzf "$tmp/jdk.tar.gz" -C "$JDK_DIR" --strip-components=1
fi

sdkmanager=$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager
if [ ! -x "$sdkmanager" ]; then
    echo "cloud-android-sdk: installing the Android command-line tools into $ANDROID_HOME"
    curl -fsSL -o "$tmp/tools.zip" "https://dl.google.com/android/repository/$CMDLINE_TOOLS"
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    (cd "$tmp" && unzip -q tools.zip)
    rm -rf "$ANDROID_HOME/cmdline-tools/latest"
    mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi

missing=
for p in $PACKAGES; do
    [ -d "$ANDROID_HOME/$(echo "$p" | tr ';' '/')" ] || missing="$missing $p"
done
if [ -n "$missing" ]; then
    echo "cloud-android-sdk: installing$missing"
    yes | JAVA_HOME=$JDK_DIR "$sdkmanager" --sdk_root="$ANDROID_HOME" --licenses >/dev/null
    # shellcheck disable=SC2086 # one argument per package
    JAVA_HOME=$JDK_DIR "$sdkmanager" --sdk_root="$ANDROID_HOME" $missing
    # sdkmanager exits 0 on a package name it doesn't know, so check the folders it should have made.
    for p in $missing; do
        [ -d "$ANDROID_HOME/$(echo "$p" | tr ';' '/')" ] || { echo "cloud-android-sdk: $p did not install" >&2; exit 1; }
    done
fi

echo "cloud-android-sdk: ready (JAVA_HOME=$JDK_DIR ANDROID_HOME=$ANDROID_HOME)"
