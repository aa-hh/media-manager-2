#!/bin/bash
# Builds Media3's FFmpeg audio decoder AAR into android-tv/ffmpeg/out/, from
# androidx/media at the Media3 version the app uses. Call it through
# `sh scripts/android-tv.sh ffmpeg`, which sets JAVA_HOME and ANDROID_HOME.
set -euo pipefail
cd "$(dirname "$0")"

NDK_VERSION=26.1.10909125
FFMPEG_BRANCH=release/6.0
ANDROID_ABI=28
DECODERS=(ac3 eac3 dca mlp truehd flac alac opus vorbis mp3 aac)

MEDIA3_VERSION=$(sed -n 's/^media3 = "\(.*\)"$/\1/p' ../gradle/libs.versions.toml)
[ -n "$MEDIA3_VERSION" ] || { echo "ffmpeg: no media3 version in libs.versions.toml" >&2; exit 1; }

NDK_PATH=$ANDROID_HOME/ndk/$NDK_VERSION
case "$(uname -s)" in
    Darwin) HOST_PLATFORM=darwin-x86_64 ;;
    Linux) HOST_PLATFORM=linux-x86_64 ;;
    *) echo "ffmpeg: unsupported host $(uname -s)" >&2; exit 1 ;;
esac

rm -rf out
mkdir -p out
git clone --quiet --depth=1 --branch="$MEDIA3_VERSION" https://github.com/androidx/media out/src
FFMPEG_MODULE_PATH=$PWD/out/src/libraries/decoder_ffmpeg/src/main
git clone --quiet --depth=1 --branch="$FFMPEG_BRANCH" https://github.com/FFmpeg/FFmpeg "$FFMPEG_MODULE_PATH/jni/ffmpeg"

# Only the ABIs the app ships: drop the script's x86 and x86_64 passes, which
# start at the `./configure` line before `--libdir=android-libs/x86`.
script=$FFMPEG_MODULE_PATH/jni/build_ffmpeg.sh
awk '/^\.\/configure/ { held = $0; next }
     held != "" { if ($0 ~ /--libdir=android-libs\/x86/) exit; print held; held = "" }
     { print }' "$script" > "$script.arm"
# At API 28 FFmpeg finds iconv in libc, but the module's JNI library links against an older API without it, so the
# link fails; only subtitle decoding uses iconv.
perl -pi -e 's/^(\s*)--disable-vulkan$/$1--disable-vulkan\n$1--disable-iconv/' "$script.arm"
grep -q 'android-libs/arm64-v8a' "$script.arm" && grep -q -- '--disable-iconv' "$script.arm" \
    || { echo "ffmpeg: build_ffmpeg.sh changed shape" >&2; exit 1; }
chmod +x "$script.arm"
(cd "$FFMPEG_MODULE_PATH/jni" && ./build_ffmpeg.sh.arm "$FFMPEG_MODULE_PATH" "$NDK_PATH" "$HOST_PLATFORM" "$ANDROID_ABI" "${DECODERS[@]}")

# The module's Gradle name, from the checkout's own module list.
module=$(grep -rh -B3 '"libraries/decoder_ffmpeg"' out/src/build-logic-settings | grep -oE '"[a-z0-9-]+" to' | tail -1 | cut -d'"' -f2 || true)
[ -n "$module" ] || { echo "ffmpeg: no Gradle module for libraries/decoder_ffmpeg" >&2; exit 1; }

printf 'sdk.dir=%s\n' "$ANDROID_HOME" > out/src/local.properties
# The JNI library only for the ABIs FFmpeg was built for above.
printf '\nandroid.defaultConfig.ndk.abiFilters += listOf("armeabi-v7a", "arm64-v8a")\n' \
    >> out/src/libraries/decoder_ffmpeg/build.gradle.kts
(cd out/src && ./gradlew --console=plain ":$module:assembleRelease")
aar=$(find out/src/libraries/decoder_ffmpeg -path '*outputs/aar/*-release.aar' | head -1)
[ -n "$aar" ] || { echo "ffmpeg: Gradle made no release AAR" >&2; exit 1; }
cp "$aar" out/lib-decoder-ffmpeg-release.aar
echo "ffmpeg: built out/lib-decoder-ffmpeg-release.aar ($module, Media3 $MEDIA3_VERSION)"
