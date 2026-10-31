#!/bin/sh
# The one way the Android TV app builds and tests. Hooks, CI, agents and humans
# call this, never android-tv/gradlew directly (the guard hook denies that).
#
# Usage: sh scripts/android-tv.sh build|test|release|ffmpeg|install
#   build    the debug APK
#   test     the JVM unit tests
#   install  the debug APK onto the box named by $ANDROID_TV_DEVICE (adb serial or IP:port)
#   release, ffmpeg  not built yet
set -eu
cd "$(dirname "$0")/.."

# CI sets both; on this Mac they default to Android Studio's JDK and the SDK
# that Android Studio's first-launch setup installs.
JAVA_HOME=${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}
ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
export JAVA_HOME ANDROID_HOME

usage() {
    echo "usage: sh scripts/android-tv.sh build|test|release|ffmpeg|install" >&2
    exit 2
}

[ $# -eq 1 ] || usage

# Exit 97 tells ~/.claude/scripts/remote-run this machine cannot run the job,
# so a run sent to a Mac without the SDK falls back to this one.
if [ ! -d "$ANDROID_HOME/platforms" ] || [ -z "$(ls "$ANDROID_HOME/platforms" 2>/dev/null)" ]; then
    echo "android-tv: no Android SDK at $ANDROID_HOME. Open Android Studio, finish its first-launch SDK setup, and install the SDK Platform, Build-Tools, Platform-Tools, Command-line Tools, NDK 26.1.10909125 and CMake 3.22.1 in SDK Manager." >&2
    exit 97
fi

gradle() {
    sh android-tv/gradlew -p android-tv --console=plain "$@"
}

case "$1" in
    build) gradle assembleDebug ;;
    test) gradle testDebugUnitTest ;;
    install)
        if [ -z "${ANDROID_TV_DEVICE:-}" ]; then
            echo "android-tv: set ANDROID_TV_DEVICE to the box's adb serial or IP:port" >&2
            exit 2
        fi
        "$ANDROID_HOME/platform-tools/adb" -s "$ANDROID_TV_DEVICE" install -r \
            android-tv/app/build/outputs/apk/debug/app-debug.apk
        ;;
    release|ffmpeg)
        echo "android-tv: '$1' is not built yet" >&2
        exit 2
        ;;
    *) usage ;;
esac
