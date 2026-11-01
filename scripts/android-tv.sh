#!/bin/sh
# The one way the Android TV app builds and tests. Hooks, CI, agents and humans
# call this, never android-tv/gradlew directly (the guard hook denies that).
#
# Usage: sh scripts/android-tv.sh build|test|ffmpeg|release|install
#   build    the debug APK (gets the FFmpeg decoder first when out/ has none for the current key)
#   test     the JVM unit tests (likewise)
#   ffmpeg   Media3's FFmpeg audio decoder AAR, into android-tv/ffmpeg/out/
#   install  the debug APK onto the box named by $ANDROID_TV_DEVICE (adb serial or IP:port)
#   release  the signed release APK; needs ANDROID_TV_KEYSTORE_PATH (a PKCS12 .p12)
#            and ANDROID_TV_KEYSTORE_PASSWORD; versionCode from ANDROID_TV_VERSION_CODE (default 1)
# build, test, ffmpeg and release run one at a time per machine; a run that finds another running exits 75.
set -eu
cd "$(dirname "$0")/.."

# CI sets both; on a Mac they default to Android Studio's JDK (or, on a Mac
# without Android Studio, the copy of it on the Space drive) and the SDK that
# Android Studio's first-launch setup installs. In a cloud container they default
# to where scripts/cloud-android-sdk.sh installs them.
studio_jdk="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
[ -d "$studio_jdk" ] || studio_jdk=/Volumes/Space/Android/jdk-25/Contents/Home
[ -d "$studio_jdk" ] || studio_jdk=/opt/jdk-25
sdk=$HOME/Library/Android/sdk
[ -d "$sdk" ] || [ ! -d /opt/android-sdk ] || sdk=/opt/android-sdk
JAVA_HOME=${JAVA_HOME:-$studio_jdk}
ANDROID_HOME=${ANDROID_HOME:-$sdk}
export JAVA_HOME ANDROID_HOME

# On a Mac with the Space drive, Gradle's home (downloads, build cache, daemons) lives on the drive too: the main
# disk runs near full, and every worktree on that Mac shares one build cache.
if [ -z "${GRADLE_USER_HOME:-}" ] && [ -d /Volumes/Space/Android ]; then
    GRADLE_USER_HOME=/Volumes/Space/Android/gradle-home
    export GRADLE_USER_HOME
fi

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

# One Android build at a time on a machine. Each build starts Gradle and Kotlin daemons of several GB, and two at once
# swap the mule to a standstill. A run that finds another holding the lock says who and exits 75, so its caller does
# other work and retries later (AGENTS.md: a busy shared resource is reported, not waited on). The lock is a symlink
# whose target is the holder's pid (ln -s is atomic, and macOS has no flock); a lock whose holder has gone is taken over.
# A fixed path, not $TMPDIR: macOS gives each login session its own TMPDIR and none to ssh, so a run from Terminal
# and one sent over ssh would each see a different lock.
LOCK=${ANDROID_TV_LOCK:-/tmp/media-manager-2-android-tv.lock}
take_lock() {
    tries=0
    until ln -s "$$" "$LOCK" 2>/dev/null; do
        if ! holder=$(readlink "$LOCK" 2>/dev/null); then
            if [ -e "$LOCK" ]; then
                echo "android-tv: $LOCK is in the way and is not a lock; remove it" >&2
                exit 75
            fi
            # Released between the two calls; but nothing there at all, again and again, means the lock can't be made.
            tries=$((tries + 1))
            if [ "$tries" -ge 5 ]; then
                echo "android-tv: could not create the lock $LOCK" >&2
                exit 75
            fi
            continue
        fi
        # A live pid counts only while it is still this script, so a pid the system has since reused frees the lock.
        if ps -o command= -p "$holder" 2>/dev/null | grep -q 'android-tv\.sh'; then
            echo "android-tv: another Android build (pid $holder) is running on this machine; retry when it has finished" >&2
            exit 75
        fi
        # Removed only if it still names the dead holder, so a lock another run has just taken survives.
        if [ "$(readlink "$LOCK" 2>/dev/null)" = "$holder" ] && ! rm -f "$LOCK" 2>/dev/null; then
            echo "android-tv: could not remove the stale lock $LOCK (pid $holder); remove it by hand" >&2
            exit 75
        fi
    done
    # Removed only while it still names this run, so a lock another run has since taken survives this one's exit.
    trap '[ "$(readlink "$LOCK" 2>/dev/null)" = "$$" ] && rm -f "$LOCK"' EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
}

gradle() {
    sh android-tv/gradlew -p android-tv --console=plain "$@"
}

# Media3's FFmpeg audio decoder, kept out of git. It is rebuilt only when its key changes: a hash of the build script
# and the catalogue's media3 line, so other dependency bumps reuse it. CI's caches use the same key (tests.yml and
# android-tv-release.yml).
# out/key records the key of the AAR in out/. A Mac with the Space drive keeps one copy per key there, so every
# worktree on that Mac, and every run sent to it, reuses it.
FFMPEG_AAR=android-tv/ffmpeg/out/lib-decoder-ffmpeg-release.aar
FFMPEG_CACHE=${ANDROID_TV_FFMPEG_CACHE:-/Volumes/Space/Android/ffmpeg-cache}
ffmpeg_key() {
    { cat android-tv/ffmpeg/build.sh; grep '^media3 = ' android-tv/gradle/libs.versions.toml; } | shasum -a 256 | cut -c1-16
}
ffmpeg() {
    if [ ! -d "$ANDROID_HOME/ndk/26.1.10909125" ]; then
        if [ -z "${CI:-}" ]; then
            echo "android-tv: no NDK 26.1.10909125 in $ANDROID_HOME. Install it in Android Studio's SDK Manager (NDK, Side by side)." >&2
            exit 97
        fi
        yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "ndk;26.1.10909125" >/dev/null
    fi
    key=$(ffmpeg_key)
    bash android-tv/ffmpeg/build.sh
    echo "$key" > android-tv/ffmpeg/out/key
    # Copied under a temporary name, then renamed, so a run reading the cache never sees half a file.
    if [ -d "$(dirname "$FFMPEG_CACHE")" ] && mkdir -p "$FFMPEG_CACHE" 2>/dev/null; then
        # A cache that can't be written (drive full, no permission) is skipped, never a failed build.
        { cp "$FFMPEG_AAR" "$FFMPEG_CACHE/$key.aar.$$" && mv "$FFMPEG_CACHE/$key.aar.$$" "$FFMPEG_CACHE/$key.aar"; } \
            || { rm -f "$FFMPEG_CACHE/$key.aar.$$"; echo "android-tv: could not save the decoder to $FFMPEG_CACHE" >&2; }
    fi
}
need_ffmpeg() {
    key=$(ffmpeg_key)
    [ -f "$FFMPEG_AAR" ] && [ "$(cat android-tv/ffmpeg/out/key 2>/dev/null)" = "$key" ] && return
    if [ -f "$FFMPEG_CACHE/$key.aar" ]; then
        mkdir -p android-tv/ffmpeg/out
        cp "$FFMPEG_CACHE/$key.aar" "$FFMPEG_AAR"
        echo "$key" > android-tv/ffmpeg/out/key
        echo "android-tv: FFmpeg decoder reused from $FFMPEG_CACHE ($key)"
        return
    fi
    ffmpeg
}

case "$1" in
    build) take_lock; need_ffmpeg; gradle assembleDebug ;;
    test) take_lock; need_ffmpeg; gradle testDebugUnitTest ;;
    ffmpeg) take_lock; ffmpeg ;;
    install)
        if [ -z "${ANDROID_TV_DEVICE:-}" ]; then
            echo "android-tv: set ANDROID_TV_DEVICE to the box's adb serial or IP:port" >&2
            exit 2
        fi
        "$ANDROID_HOME/platform-tools/adb" -s "$ANDROID_TV_DEVICE" install -r \
            android-tv/app/build/outputs/apk/debug/app-debug.apk
        ;;
    release)
        # Checked before anything builds, so an unsigned APK can never come out of this.
        if [ -z "${ANDROID_TV_KEYSTORE_PATH:-}" ] || [ -z "${ANDROID_TV_KEYSTORE_PASSWORD:-}" ]; then
            echo "android-tv: release needs ANDROID_TV_KEYSTORE_PATH (the release .p12) and ANDROID_TV_KEYSTORE_PASSWORD; the release workflow sets both from its secrets" >&2
            exit 2
        fi
        take_lock
        need_ffmpeg
        gradle assembleRelease -PversionCode="${ANDROID_TV_VERSION_CODE:-1}"
        echo android-tv/app/build/outputs/apk/release/app-release.apk
        ;;
    *) usage ;;
esac
