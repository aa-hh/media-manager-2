# Running the TV app without the TV: the Android emulator on the mule

Researched 16 Nov 2026. Research only: no code, config or SDK was changed on either Mac, nothing was installed and no emulator was started. The mule was inspected over ssh with read-only commands. Builds on [tv-apps-google-tv-and-apple-tv.md](tv-apps-google-tv-and-apple-tv.md).

"The mule" is the second Mac, `alechamilton@SUMUP-M9Y197RFVG.local`, that `~/.claude/scripts/remote-run` already sends builds and tests to.

Words used below:
- **Emulator**: Google's program that runs a full copy of Android inside a virtual machine on the Mac. It is the official "simulator" for Android.
- **AVD** (Android Virtual Device): one saved emulator setup: which Android version, screen size, memory and storage. Lives in `~/.android/avd/`.
- **System image**: the copy of Android an AVD boots, downloaded per Android version and per type (phone, Android TV, Google TV).
- **adb** (Android Debug Bridge): Google's command-line tool for installing apps on, and sending commands to, an emulator or a real device.
- **D-pad**: the remote's four arrow buttons plus the centre OK button.
- **Headless**: the emulator runs with no window on screen; you reach it only through adb.
- **Layoutlib**: the cut-down copy of Android that Android Studio uses to draw `@Preview` screens on the Mac without any emulator.

## Recommendation: run the emulator headless on the mule

1. Do most screen work without any emulator: `@Preview(device = Devices.TV_1080p)` in the code, drawn by Layoutlib. Google's preview guide says previews let you "save the memory-heavy startup of the emulator" ([Compose previews](https://developer.android.com/develop/ui/compose/tooling/previews)).
2. When the real app has to run (D-pad focus, sign-in, a player smoke test), run the emulator on the mule with no window and drive it from this Mac over ssh. The mule has 24 GB of memory; Google puts one running AVD at "approximately 4GB of memory" ([Android Studio install](https://developer.android.com/studio/install)). This Mac keeps its 16 GB for the agents and the editor.
3. Use the Google TV image for Android 14 (API 34), arm64: the version the Google TV Streamer is reported to ship with ([repo note, secondary source](tv-apps-google-tv-and-apple-tv.md)). Download size 870 MB ([Google TV image catalogue](https://dl.google.com/android/repository/sys-img/google-tv/sys-img2-3.xml)).
4. Keep the Google TV Streamer for picture, sound and speed: Dolby Vision, HDR, surround passthrough, the box's own decoders. Install there with `adb pair` and `adb connect` as plan task T22 already says.

**Two decisions for Alec before any of this runs**
- **Decided 16 Nov 2026: the Space drive lives on the mule.** The mule's `~/Library/Android/sdk` already links to `/Volumes/Space/Android/sdk`, so it uses the drive's SDK as is. This Mac then has no Android SDK, so TV builds go through `remote-run`. Installing onto the mule's own disk was the alternative, and tight: 24 GB free, and `remote-run` starts deleting the mule's synced worktree copies whenever free space drops under 20 GB (`remote_free_floor`, `~/.claude/scripts/lib/remote.sh`).
- **Decided 16 Nov 2026: a running emulator stays outside the mule's two build permits.** It is started by plain `ssh`, does not show in `capacity status`, and shares the mule's 24 GB with up to two builds. See "The emulator and remote-run's permits" below.

**Commands, run from this Mac** (each `ssh` line runs on the mule; `$HOME` in single quotes expands there)

```sh
MULE=alechamilton@SUMUP-M9Y197RFVG.local
A='$HOME/Library/Android/sdk'

# The Space drive already holds emulator 37.2.13, adb, and an AVD named TV_1080p
# (Google TV, Android 16 / API 36, 1920x1080, 2 GB). Its files are in /Volumes/Space/Android/avd,
# and the mule's ~/.android/avd is empty, so ANDROID_AVD_HOME points the emulator at the drive.
# Optional, to match the Streamer's Android 14: add an API 34 Google TV device as well
#   ssh "$MULE" "$A/cmdline-tools/latest/bin/sdkmanager 'system-images;android-34;google-tv;arm64-v8a'"
#   ssh "$MULE" "ANDROID_AVD_HOME=/Volumes/Space/Android/avd $A/cmdline-tools/latest/bin/avdmanager create avd -n GoogleTV_34 -k 'system-images;android-34;google-tv;arm64-v8a' -d tv_1080p"
#   (-d is not on Google's avdmanager page; confirm with `avdmanager create avd --help`)

# start: no window, no sound, 2 GB guest memory, no state saved; caffeinate stops the mule idle-sleeping while it runs;
# nohup and & detach it so it outlives this ssh session
ssh "$MULE" "ANDROID_AVD_HOME=/Volumes/Space/Android/avd nohup caffeinate -i $A/emulator/emulator -avd TV_1080p -no-window -no-audio -no-boot-anim -memory 2048 -no-snapshot-save >/tmp/tv-emulator.log 2>&1 &"
ssh "$MULE" "$A/platform-tools/adb -s emulator-5554 wait-for-device"

# build and install in ONE remote-run call (see section 7 for why)
~/.claude/scripts/remote-run sh -c 'sh scripts/android-tv.sh build && ANDROID_TV_DEVICE=emulator-5554 sh scripts/android-tv.sh install'

# press remote buttons, take a screenshot back to this Mac
ssh "$MULE" "$A/platform-tools/adb -s emulator-5554 shell input keyevent KEYCODE_DPAD_DOWN KEYCODE_DPAD_CENTER"
ssh "$MULE" "$A/platform-tools/adb -s emulator-5554 exec-out screencap -p" > /tmp/tv.png

# stop
ssh "$MULE" "$A/platform-tools/adb -s emulator-5554 emu kill"
```

**Live picture on this Mac (optional, Alec runs it himself).** scrcpy mirrors an Android screen into a Mac window and passes keys through. Its docs give this recipe for a device attached to another computer ([scrcpy tunnels](https://github.com/Genymobile/scrcpy/blob/master/doc/tunnels.md)); it needs `scrcpy` and `adb` on this Mac (`brew install scrcpy` and `brew install --cask android-platform-tools`, [scrcpy macOS](https://github.com/Genymobile/scrcpy/blob/master/doc/macos.md)), neither installed by this research:

```sh
ssh "$MULE" "$A/platform-tools/adb start-server"
ssh -CN -L5038:localhost:5037 -L27183:localhost:27183 "$MULE" &      # keep open
ADB_SERVER_SOCKET=tcp:localhost:5038 scrcpy --force-adb-forward -s emulator-5554 -m1024
```

With the same tunnel and `ADB_SERVER_SOCKET` set, plain `adb -s emulator-5554 ...` on this Mac also talks to the mule's emulator, so the per-command `ssh` above becomes optional. scrcpy's docs do not mention emulators; that it mirrors one is **unconfirmed** until tried.

16 Nov 2026: scrcpy 5.0.1 and adb 37.0.1 are installed on this Mac (Homebrew), and `adb devices` through the tunnel lists the mule's `emulator-5554`. Drop `-m1024` for full 1080p on the local network. Google's own `tv_1080p` profile (`tv.xml` in Android Studio's `sdklib.jar`) declares `keyboard qwerty`, `nav dpad` and touch `notouch`, so an AVD made from it normally takes Mac keys, and mouse clicks never do anything. The `TV_1080p` AVD on the drive had `hw.keyboard=no` instead (switched off when the AVD was made; Android Studio's "Enable keyboard input" setting is the likely cause, unconfirmed), so its window ignored the Mac keyboard; scrcpy still worked because it sends keys through adb. On 16 Nov 2026 `hw.keyboard` was set back to `yes` (backup `config.ini.bak-2026-11-16`), and `adb shell settings put secure show_ime_with_hard_keyboard 1` keeps the on-screen keyboard showing for text fields, as on a real TV.

The app's launch screen is `io.github.aahh.mediamanager2.tv.debug/io.github.aahh.mediamanager2.tv.MainActivity` (debug build); open it with `adb -s emulator-5554 shell am start -n <that>`.

**Tried on the mule, 16 Nov 2026.** The start command above works from a plain ssh login: no GUI session trick needed.
- Boot took 24 s (cold boot, no saved state). `adb devices` on the mule lists `emulator-5554`.
- The emulator process (`qemu-system-aarch64-headless`) used 4.3 GB of the mule's memory.
- With no window, graphics run in software (SwiftShader, from the log), so animation speed says nothing about the real box.
- `input keyevent KEYCODE_DPAD_DOWN` moved focus, and `screencap` returned a 1920x1080 PNG to this Mac.
- First boot shows Google TV's "Set up Google TV" screen; it needs skipping (Cancel) before the home screen.
- The emulator found the AVD only after a pointer file `TV_1080p.ini` was added to `/Volumes/Space/Android/avd/` (contents: `avd.ini.encoding=UTF-8`, `path=/Volumes/Space/Android/avd/TV_1080p.avd`, `target=android-36`). The original pointer sat in this Mac's `~/.android/avd/`; the one on the drive works from either Mac.

## What is installed today

Checked read-only on 16 Nov 2026.

**The mule** (over ssh)
- MacBook Air, Apple M3, 8 cores, 24 GB memory, macOS 26.7.2.
- The Space drive is attached (931 GB, 639 GB free) and `~/Library/Android/sdk` links to `/Volumes/Space/Android/sdk`. On it: emulator 37.2.13, platform-tools 37.0.1, cmdline-tools `latest`, system images `android-36/google-tv/arm64-v8a` and `android-37.0/google_apis_playstore/arm64-v8a`, plus `jdk-25`, `gradle-home` and `ffmpeg-cache`.
- `/Volumes/Space/Android/avd/TV_1080p.avd`: Google TV API 36, 1920x1080 at 320 dpi, `hw.ramSize=2048`.
- `~/.android/avd/` exists and is empty, so the emulator needs `ANDROID_AVD_HOME=/Volumes/Space/Android/avd` to find that AVD.
- Android Studio 2026.2 is installed, which gives `scripts/android-tv.sh` a Java to build with.
- Internal disk 95% full, 24 GB free.
- Someone is logged in at the mule's screen (`who` shows a `console` session since 14 Nov).
- No synced copy of an android-tv worktree under `~/audiout-remote-tests.noindex/`, and `CLAUDE.md` runs TV builds with `AUDIOUT_REMOTE_LOCAL=1`, so TV builds have only ever run on this Mac.

**This Mac**
- `~/Library/Android/sdk` is a link to `/Volumes/Space/Android/sdk`. The Space drive was **not plugged in**, so `cmdline-tools`, `emulator`, `platform-tools`, `platforms` and `system-images` could not be listed. `scripts/android-tv.sh` exits with code 97 in this state.
- `scripts/android-tv.sh`'s setup message asks for SDK Platform, Build-Tools, Platform-Tools, Command-line Tools, NDK 26.1.10909125 and CMake 3.22.1, so those were presumably installed. Not verified.
- `~/.android/avd/` holds two AVDs:
  - `TV_1080p`: its `.ini` points to `/Volumes/Space/Android/avd/TV_1080p.avd`, target `android-36`. Its settings live on the unplugged drive, so whether it uses the Android TV or Google TV image is unknown.
  - `Medium_Phone_API_37.0`: a phone, Android API 37 with Play Store, arm64, `hw.ramSize=2048`, `vm.heapSize=336`, stored on the internal disk.
- Android Studio 2026.2 is installed at `/Applications/Android Studio.app`.

## The TV app, as far as an emulator cares

From `android-tv/AGENTS.md`, `android-tv/app/build.gradle.kts` and `android-tv/gradle/libs.versions.toml`:

- Kotlin, Compose for TV (`androidx.tv:tv-material` 1.1.0), Media3 1.11.1 with a home-built FFmpeg audio decoder. No Leanback.
- `minSdk 28`, `targetSdk 37`, `compileSdk 37`, Android Gradle Plugin 9.5.0.
- Native code for `arm64-v8a` and `armeabi-v7a`, so the APK runs on an arm64 emulator image.
- `scripts/android-tv.sh install` runs `adb -s $ANDROID_TV_DEVICE install -r` on the debug APK. It works with any adb target: an emulator serial such as `emulator-5554`, or the box's `IP:port`. Nothing in the repo starts or assumes an emulator today.
- Tests are JVM unit tests only (`testDebugUnitTest`); there are no on-device tests and no `@Preview` screenshot tests.

## 1. Running the emulator without Android Studio

The emulator, adb and the command-line tools are separate SDK downloads; Studio is only one way to drive them.

- **Start**: `emulator -avd <name> [options]`. Studio adds `-qt-hide-window -grpc-use-token -idle-grpc-timeout 300`, which are "only used to run the emulator window within Android Studio" ([emulator command line](https://developer.android.com/studio/run/emulator-commandline)).
- **Google has marked the old tools deprecated.** The same page says the `emulator` tool is deprecated in favour of the Android CLI's `android emulator` command; the [`sdkmanager`](https://developer.android.com/tools/sdkmanager) and [`avdmanager`](https://developer.android.com/tools/avdmanager) pages say the same. They still ship and are documented. The new [Android CLI](https://developer.android.com/tools/agents/android-cli) is a separate download from Google.
- **Android CLI equivalents**: `android emulator create <profile>`, `android emulator start [--cold] [--headless] <device>`, `android emulator stop` ([emulator](https://developer.android.com/tools/agents/android-cli/commands/emulator), [start](https://developer.android.com/tools/agents/android-cli/commands/emulator_start)). `start` waits until the device has finished booting. Its docs name only phone and desktop profiles (`medium_phone`, `large_desktop`); whether `android emulator create --list-profiles` offers a TV profile is **unconfirmed**. `start` has no memory option.

Options that cut memory or CPU, all from [emulator command line](https://developer.android.com/studio/run/emulator-commandline):

| Option | What it does |
|---|---|
| `-no-window` | No window; reach the device through adb or the console. |
| `-memory <MB>` | Guest memory, "from 1536 to 8192 MBs". Overrides the AVD setting. |
| `-no-audio` | Turns sound off for this run. |
| `-no-boot-anim` | Skips the boot animation for a faster boot. |
| `-no-snapshot-load` / `-no-snapshot-save` / `-no-snapshot` | Cold boot / do not save state on exit / neither. A saved state makes the next start fast but costs disk. |
| `-gpu <mode>` | `auto` (recommended), `host` (Mac GPU), `software`, `swiftshader`, `lavapipe`, `swangle`. `swiftshader_indirect` and `guest` were deprecated in emulator 36.4.9 ([acceleration](https://developer.android.com/studio/run/emulator-acceleration)). |
| `-wipe-data` | Factory reset of the AVD. |

AVD settings in `config.ini` that matter for memory: `hw.ramSize` (guest memory, MB), `vm.heapSize` (per-app Java heap, MB), `hw.cpu.ncore`, `disk.dataPartition.size`. These key names come from the phone AVD on this Mac. The AVD form in Studio exposes the same as RAM, VM Heap, Multi-Core CPU and Internal Storage ([managing AVDs](https://developer.android.com/tools/devices)).

On Apple Silicon the emulator uses macOS's Hypervisor.Framework and needs `arm64-v8a` images for full speed ([acceleration](https://developer.android.com/studio/run/emulator-acceleration)). An emulator console command, `nodraw on`, turns off drawing on the host "to reduce system memory and GPU load" during headless runs; it is marked experimental ([emulator console](https://developer.android.com/studio/run/emulator-console)).

## 2. TV system images for Apple Silicon

From Google's own download catalogues ([Android TV list](https://dl.google.com/android/repository/sys-img/android-tv/sys-img2-3.xml), [Google TV list](https://dl.google.com/android/repository/sys-img/google-tv/sys-img2-3.xml)), the arm64 images are:

| Image | Android versions (API) |
|---|---|
| `system-images;android-<N>;google-tv;arm64-v8a` | 31, 33, 34, 36 |
| `system-images;android-36;google-tv-ps16k;arm64-v8a` | 36 (16 KB memory pages) |
| `system-images;android-<N>;android-tv;arm64-v8a` | 31, 33, 34, 36 |

- **Google TV vs Android TV**: Google TV images carry the `google_apis` tag at API 36 and the Google TV home screen; Android TV images are the plain TV system. The Google TV Streamer runs Google TV, so the Google TV image is the closer match. The difference in home-screen behaviour is not documented on a page I found.
- **API 34** matches the Streamer's reported Android 14 and sits above the app's `minSdk 28`. API 36 is the newest TV image; there is no TV image for API 37 (the app's `targetSdk`).
- **Device profiles** bundled with Android Studio 2026.2 (`plugins/android/lib/sdklib.jar`, file `com/android/sdklib/devices/tv.xml`, read on this Mac):

| Profile id | Screen | Density | RAM | Input |
|---|---|---|---|---|
| `tv_4k` | 3840 × 2160 | xxxhdpi | 2 GiB | D-pad, keyboard |
| `tv_1080p` | 1920 × 1080 | xhdpi | 2 GiB | D-pad, keyboard |
| `tv_720p` | 1280 × 720 | tvdpi | 2 GiB | D-pad, keyboard |

  All three are 55-inch. A 4K profile draws four times the pixels of 1080p; Google warns that larger screens "may require higher system specs" ([emulator](https://developer.android.com/studio/run/emulator)). Google's TV design guide says to design at 960 × 540 dp and target 1080p assets ([TV layouts](https://developer.android.com/design/ui/tv/guides/styles/layouts)), so `tv_1080p` is the profile to use day to day.
- Google's older TV setup page still says to use "the x86 emulator" for best TV performance ([TV get started](https://developer.android.com/training/tv/start/start)). That advice is for Intel machines; on Apple Silicon only arm64 images get hardware acceleration.

## 3. Pressing remote buttons on the emulator

- **By hand**: the emulator's Extended controls window has a **Directional Pad** panel for AVDs whose profile has D-pad navigation ([emulator feature comparison](https://developer.android.com/studio/run/emulator-comparison)). F1 (Command + / on macOS) lists every keyboard shortcut ([emulator](https://developer.android.com/studio/run/emulator)).
- **Mac arrow keys**: Studio's TV profiles declare a keyboard and D-pad, but Google's AVD page says keyboard input "is disabled for Wear OS and Android TV" ([managing AVDs](https://developer.android.com/tools/devices)). Which Mac keys reach the TV as D-pad presses is **unconfirmed**; check the F1 list once the emulator is running.
- **Scripted, through adb**: `adb shell input keyevent [--longpress] [--doubletap] [--delay <ms>] <key code number or name> ...`, from the help text in Android's source ([InputShellCommand.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/services/core/java/com/android/server/input/InputShellCommand.java)). The source list includes `dpad`, so `adb shell input dpad keyevent ...` sends the press as if from a D-pad. Key names: `KEYCODE_DPAD_UP`, `_DOWN`, `_LEFT`, `_RIGHT`, `_CENTER`, `KEYCODE_BACK`, `KEYCODE_HOME`, `KEYCODE_MEDIA_PLAY_PAUSE` ([KeyEvent](https://developer.android.com/reference/android/view/KeyEvent)).
- **Scripted, through the emulator console**: `adb emu event send EV_KEY:KEY_DOWN:1 EV_KEY:KEY_DOWN:0 EV_SYN:0:0`. The console lists `KEY_UP/DOWN/LEFT/RIGHT` as "D-pad" directions and `KEY_PLAYPAUSE`, `KEY_BACK`, `KEY_HOME` ([emulator console](https://developer.android.com/studio/run/emulator-console)).
- **Android CLI**: `android input key <name or keycode>` takes `back`, `home`, `enter` or a number, so `android input key 20` is D-pad down. Its selectors include `focused=true`, which reports which element has focus ([android input](https://developer.android.com/tools/agents/android-cli/commands/input)).

## 4. What the emulator can and cannot check

Google's Media3 team: "Android's official emulator ... supports ExoPlayer", but "Where possible, we recommend testing media apps on physical devices rather than emulators" ([Media3 supported devices](https://developer.android.com/media/media3/exoplayer/supported-devices)).

**The emulator can check**
- D-pad focus order, focus visibility, Back behaviour and focus on screen open. Google says the framework handles directional movement but to "thoroughly test navigation with a D-pad controller" ([TV navigation](https://developer.android.com/training/tv/start/navigation)).
- Layout at 1080p, 720p and 4K; that important content sits inside the 5% margins (48 dp left and right, 27 dp top and bottom) ([TV layouts](https://developer.android.com/design/ui/tv/guides/styles/layouts)).
- That the app appears on the TV home screen (needs the `LEANBACK_LAUNCHER` filter and a banner) ([TV get started](https://developer.android.com/training/tv/start/start)).
- Compose for TV components behaving as on a TV, sign-in, server calls, downloads screen, error states.
- Basic playback start, seek and track switching with H.264, HEVC, VP8 and VP9 video. The AOSP emulator codec list has decoders for those four and none for AV1 or Dolby Vision ([goldfish codecs.xml](https://android.googlesource.com/device/generic/goldfish/+/refs/heads/main/codecs/media/codecs.xml)). Whether the Google TV image ships exactly this list is **unconfirmed**.

**The emulator cannot check**
- The Streamer's own decoders, Dolby Vision, HDR output to a display, and Dolby or DTS passthrough over HDMI. The emulator has no HDMI output and no USB or Bluetooth hardware ([advanced emulator usage](https://developer.android.com/studio/run/advanced-emulator-usage)).
- Speed. The emulator runs on the Mac's processor, not the Streamer's.
- Real overscan. Google notes "Most modern TVs no longer have overscan issues" ([TV layouts](https://developer.android.com/design/ui/tv/guides/styles/layouts)).
- Widevine security level. No Google page I found states which level the emulator reports; **unconfirmed**. The app plays Plex streams and does not use Widevine today.
- Whether the FFmpeg audio decoder (TrueHD, DTS) works inside the emulator. It is software, so it probably runs; **unconfirmed**.

## 5. Lighter options and complements

**Compose `@Preview` with a TV device** (no emulator, no extra memory beyond the IDE)
- `Devices.TV_1080p` and `Devices.TV_720p` exist since Compose UI 1.4.0. There is no `TV_4K` constant ([Devices](https://developer.android.com/reference/kotlin/androidx/compose/ui/tooling/preview/Devices)); use `device = "spec:width=3840px,height=2160px,dpi=..."` for 4K ([previews](https://developer.android.com/develop/ui/compose/tooling/previews)).
- Layoutlib has no network or file access ([previews](https://developer.android.com/develop/ui/compose/tooling/previews)), so screens must take their data as parameters.
- The app already has `ui-tooling-preview` and debug `ui-tooling`.

**Previews without Android Studio**
- `android preview render :app --fqn=<preview>` builds the app and renders `@Preview` functions to PNG "without a running device, emulator, or Android Studio instance" ([android preview](https://developer.android.com/tools/agents/android-cli/commands/preview), [render](https://developer.android.com/tools/agents/android-cli/commands/preview_render)). It runs Gradle itself, so in this repo it would need to go through a `scripts/android-tv.sh` subcommand. Not tried.

**Screenshot tests from previews**
- Google's Compose Preview Screenshot Testing renders `@PreviewTest` previews on the Mac and compares them with saved images. On AGP 9.5 it runs as an AGP test suite (`android.experimental.enableScreenshotTest=true`, `android.experimental.testSuiteSupport=true`, `testOptions { screenshotTests.create(...) }`). Google labels it experimental ([screenshot testing with test suites](https://developer.android.com/studio/preview/compose-screenshot-testing-with-testsuites)). The older standalone plugin "is no longer maintained" ([screenshot testing](https://developer.android.com/studio/preview/compose-screenshot-testing)). This repo is on AGP 9.5.0, so it fits, but it adds a dependency (`screenshot-validation-api`).
- Robolectric, Roborazzi and Paparazzi: I found no TV example in their docs; TV support is **unconfirmed** for all three.

**Gradle Managed Devices** (Gradle starts and stops emulators for on-device tests)
- Google's page documents phone profiles and image sources `aosp`, `google`, `aosp-atd`, `google-atd`; the lighter "Automated Test Device" images "currently support only API level 30" ([managed devices](https://developer.android.com/studio/test/gradle-managed-devices)). Nothing documents a TV image; TV support is **unconfirmed**. The repo has no on-device tests to run there today.

**The real TV over Wi-Fi**
- Wireless debugging needs "Android 13 (API level 33) or higher for TV". Pair once with `adb pair ip:port` and the code shown on the TV; after that the two connect on the same network ([adb](https://developer.android.com/tools/adb)). Then `ANDROID_TV_DEVICE=<ip:port> sh scripts/android-tv.sh install`.

**Other emulators**
- Genymotion: "Genymotion does not support Android TV" because some Android TV parts are proprietary ([Genymotion support](https://support.genymotion.com/hc/en-us/articles/115004220045-Does-Genymotion-support-Android-TV), read through Genymotion's mirror at rozz.genymotion.com). I found no other emulator offering TV images on Apple Silicon.

## 6. Memory

Numbers Google publishes:
- Mac: Studio alone 8 GB minimum; Studio and emulator 16 GB minimum, 32 GB recommended ([install](https://developer.android.com/studio/install)).
- "Running multiple AVDs simultaneously requires approximately 4GB of memory per AVD" (same page).
- TV profiles give the guest 2 GiB (Studio's `tv.xml`); `-memory` accepts 1536 to 8192 MB ([emulator command line](https://developer.android.com/studio/run/emulator-commandline)).

Not published: how much memory the emulator itself uses with and without a window, or how much closing Studio saves. **Unknown.** It can be measured once the emulator runs, for example with `ssh "$MULE" 'ps -o rss=,command= -ax | grep qemu-system'` on the mule.

The Gradle build also needs memory: `scripts/android-tv.sh` notes that each build "starts Gradle and Kotlin daemons of several GB". On the mule, one emulator (about 4 GB) plus two permitted builds of several GB each fit in 24 GB on paper; nothing measured.

## 7. Running the emulator on the mule

### Starting it over ssh

- `-no-window` is documented as "useful when running the emulator on servers that have no display. You can access the emulator through `adb` or the console" ([emulator command line](https://developer.android.com/studio/run/emulator-commandline)). An old release note (28.0.16) says that with `-no-window` the default renderer is SwiftShader, which draws in software ([emulator release notes](https://developer.android.com/studio/releases/emulator)).
- Whether macOS lets an ssh login start the emulator's virtual machine is **unconfirmed**. No Google or Apple page found says either way. `remote.sh` records a related failure: an ssh shell "sits in the Background session", where Xcode could not launch its test runner, so `remote_gui_job` starts Xcode jobs inside the logged-in screen session with `launchctl bootstrap gui/<uid>`. If the plain `ssh ... emulator` start fails, the same `launchctl bootstrap gui/<uid>` route is the next thing to try; it needs someone logged in at the mule's screen, which is the case today.
- The emulator release notes list a fix in 36.6.11 for "a significant memory leak on macOS 26.3 when closing the emulator", tied to Hypervisor.framework clean-up ([emulator release notes](https://developer.android.com/studio/releases/emulator)). The mule runs macOS 26.7.2; install an emulator at 36.6.11 or later (current: 37.2.13, 28 Oct 2026).
- Sleep: `remote.sh` says this mule's known failure is "sleeping: it answers ping ... but refuses TCP". `caffeinate -i <command>` "holds an assertion that prevents idle sleep as long as that process is running" (`man caffeinate`). Whether that keeps a MacBook Air awake with its lid closed is **unconfirmed**.

### Reaching it from this Mac

- The emulator's ports listen on the mule only. The console "accepts connections from localhost only" ([emulator console](https://developer.android.com/studio/run/emulator-console)); each emulator takes an even console port and the next odd port for adb, 5554/5555 for the first ([adb](https://developer.android.com/tools/adb)). Microsoft's guide for the same situation shows them bound to `localhost:5554` and `localhost:5555` ([Microsoft Learn](https://learn.microsoft.com/dotnet/maui/android/emulator/mac-with-windows-vm)).
- Three ways in, from simplest:
  1. **Run adb on the mule through ssh**, as in the recommendation. Nothing to set up beyond ssh, which `remote-run` already uses.
  2. **Forward the emulator's adb port**: `ssh -N -L 15555:127.0.0.1:5555 "$MULE"`, then `adb connect localhost:15555` on this Mac. This is Microsoft's documented recipe; it needs Remote Login on the Mac being reached ([Microsoft Learn](https://learn.microsoft.com/dotnet/maui/android/emulator/mac-with-windows-vm)). The device then shows as `localhost:15555`.
  3. **Forward the mule's adb server** (port 5037, where the adb server listens, [adb](https://developer.android.com/tools/adb)) and point this Mac's adb at it with `ADB_SERVER_SOCKET`, as in scrcpy's recipe above ([scrcpy tunnels](https://github.com/Genymobile/scrcpy/blob/master/doc/tunnels.md)). The device keeps its name `emulator-5554`.
- Options 2 and 3 need adb on this Mac. Today this Mac's adb is on the unplugged Space drive.
- Google documents no supported remote setup for the emulator on a Mac. Its gRPC control port was introduced as experimental and "meant to be used from the same machine the emulator is running on. Do not run the service remotely unless you understand and accept the security risks" ([emulator release notes](https://developer.android.com/studio/releases/emulator)). Google's browser streaming over WebRTC lives in [android-emulator-container-scripts](https://github.com/google/android-emulator-container-scripts), which is "intended to be run on a Linux OS" with KVM and says Docker Desktop on macOS is not supported for acceleration. Neither fits the mule.

### Seeing and driving the screen

- Screenshot: `adb exec-out screencap -p > screen.png` streams a PNG straight to the calling machine ([adb](https://developer.android.com/tools/adb)); through `ssh` it lands on this Mac.
- Remote buttons: `adb shell input keyevent KEYCODE_DPAD_DOWN` and friends (section 3), or the console's `adb emu event send EV_KEY:KEY_DOWN:1 ...`.
- Video: the console can record to `.webm` with `screenrecord start <file>`; the file lands in `~/.android/avd/<name>.avd/console_out/` on the mule ([emulator console](https://developer.android.com/studio/run/emulator-console)).
- Live view: scrcpy over the ssh tunnel (recommendation above). Its README says "Reducing resolution may greatly improve performance" and shows `-m1024` ([scrcpy README](https://github.com/Genymobile/scrcpy)). No source gives bandwidth or delay figures for any of these over a home network.

### Getting the APK onto the mule's emulator

- `remote-run` copies the worktree to `~/audiout-remote-tests.noindex/<worktree folder name>/` on the mule with `rsync -az --delete`, before every run, excluding only `.build/`, `.git/`, `.claude/`, `node_modules/`, `dist/`, `.astro/`, `.wrangler/`, `coverage/` and `DerivedData/` (`remote_sync` in `~/.claude/scripts/lib/remote.sh`).
- So `remote-run sh scripts/android-tv.sh build` leaves the APK at `android-tv/app/build/outputs/apk/debug/app-debug.apk` in that copy, but the next run's `--delete` removes it, because `android-tv/app/build/` is not excluded and does not exist on this Mac. `remote-run` itself never copies results back (`remote_fetch` exists but only repo wrappers call it).
- Hence one call that builds and installs: `remote-run sh -c 'sh scripts/android-tv.sh build && ANDROID_TV_DEVICE=emulator-5554 sh scripts/android-tv.sh install'`. The install runs on the mule, where `emulator-5554` is local.
- If the mule is asleep or both permits are taken, `remote-run` falls back to this Mac. There the install fails (no `emulator-5554` here) unless option 3's tunnel is open, in which case this Mac builds and the install reaches the mule anyway.
- `scripts/android-tv.sh` puts Gradle's cache on the Space drive only when `/Volumes/Space/Android` exists; otherwise Gradle uses `~/.gradle` on the mule's nearly full internal disk.
- Done 16 Nov 2026: `CLAUDE.md` and `AGENTS.md` no longer set `AUDIOUT_REMOTE_LOCAL=1` on TV builds.

### The emulator and remote-run's permits

- The mule has two permits (`audiout.remoteSlots = 2`), files `/tmp/audiout-remote-work.lock.N`. A job takes one for the length of one `remote-run` call. `remote.sh` chose a count of resident jobs on purpose, after three suites at once overloaded the 8-core mule.
- A permit is a poor fit for an emulator that stays up for an hour or a day. The permit belongs to the shell running the call, so it is released the moment the call returns, whatever that call left running; a permit held past 2700 seconds (45 minutes) is reclaimed anyway; and if the call's ssh session drops, a watcher kills the job's whole process group. Starting the emulator inside `remote-run` would leave it either unprotected or killed.
- Started by plain `ssh` as in the recommendation, the emulator holds no permit. `remote_sweep_orphans` only kills processes parented to PID 1 whose command line contains `audiout-remote-tests.noindex`; the emulator's command line does not, so it survives. The catch: `~/.claude/scripts/capacity status` will not show it, and two permitted builds can land on the mule beside it.
- Decided 16 Nov 2026: leave it outside the permits. The other choices were: lower `audiout.remoteSlots` to 1 while it runs; or give it a permit-style lock of its own that `capacity` reports. A wrapper (say, an `emulator` subcommand of `scripts/android-tv.sh`) would be the natural owner of start, stop and that lock. Not built.

## Only a real TV can check

- Dolby Vision and HDR10/HDR10+ reaching the display; HDR switching.
- Dolby Digital, Atmos, DTS or TrueHD passthrough to the receiver or TV.
- Which formats the Streamer decodes in hardware (AV1, HEVC levels) versus falling back to software.
- Start time, seek time, scrolling smoothness and memory pressure on a 4 GB box.
- The real remote: button set (no Menu button), key repeat, long press, voice button.
- Low-power mode stopping playback ([TV hardware](https://developer.android.com/training/tv/get-started/hardware)).
- HDMI-CEC, sleep and wake, Ethernet versus Wi-Fi throughput from Plex.
- Text legibility and focus visibility from the sofa.

## Sources

- Android Studio: [install and system requirements](https://developer.android.com/studio/install), [run apps on the emulator](https://developer.android.com/studio/run/emulator), [emulator command line](https://developer.android.com/studio/run/emulator-commandline), [emulator console](https://developer.android.com/studio/run/emulator-console), [advanced emulator usage](https://developer.android.com/studio/run/advanced-emulator-usage), [emulator feature comparison](https://developer.android.com/studio/run/emulator-comparison), [hardware acceleration](https://developer.android.com/studio/run/emulator-acceleration), [create and manage AVDs](https://developer.android.com/tools/devices), [avdmanager](https://developer.android.com/tools/avdmanager), [sdkmanager](https://developer.android.com/tools/sdkmanager), [adb](https://developer.android.com/tools/adb), [Gradle Managed Devices](https://developer.android.com/studio/test/gradle-managed-devices)
- Android CLI: [overview](https://developer.android.com/tools/agents/android-cli), [android emulator](https://developer.android.com/tools/agents/android-cli/commands/emulator), [emulator create](https://developer.android.com/tools/agents/android-cli/commands/emulator_create), [emulator start](https://developer.android.com/tools/agents/android-cli/commands/emulator_start), [android input](https://developer.android.com/tools/agents/android-cli/commands/input), [input key](https://developer.android.com/tools/agents/android-cli/commands/input_key), [android preview](https://developer.android.com/tools/agents/android-cli/commands/preview), [preview render](https://developer.android.com/tools/agents/android-cli/commands/preview_render)
- System image catalogues: [Android TV](https://dl.google.com/android/repository/sys-img/android-tv/sys-img2-3.xml), [Google TV](https://dl.google.com/android/repository/sys-img/google-tv/sys-img2-3.xml)
- TV guides: [TV get started](https://developer.android.com/training/tv/start/start), [TV navigation](https://developer.android.com/training/tv/start/navigation), [TV hardware](https://developer.android.com/training/tv/get-started/hardware), [TV layouts](https://developer.android.com/design/ui/tv/guides/styles/layouts), [Compose for TV](https://developer.android.com/training/tv/playback/compose)
- Compose: [previews](https://developer.android.com/develop/ui/compose/tooling/previews), [Devices](https://developer.android.com/reference/kotlin/androidx/compose/ui/tooling/preview/Devices), [screenshot testing](https://developer.android.com/studio/preview/compose-screenshot-testing), [screenshot testing with test suites](https://developer.android.com/studio/preview/compose-screenshot-testing-with-testsuites)
- Media3: [supported devices and emulators](https://developer.android.com/media/media3/exoplayer/supported-devices)
- Android source: [InputShellCommand.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/services/core/java/com/android/server/input/InputShellCommand.java), [goldfish codecs.xml](https://android.googlesource.com/device/generic/goldfish/+/refs/heads/main/codecs/media/codecs.xml), [KeyEvent](https://developer.android.com/reference/android/view/KeyEvent)
- Genymotion: [Does Genymotion support Android TV?](https://support.genymotion.com/hc/en-us/articles/115004220045-Does-Genymotion-support-Android-TV)
- Remote use: [emulator release notes](https://developer.android.com/studio/releases/emulator), [Microsoft Learn: connect to an emulator on a Mac from a VM](https://learn.microsoft.com/dotnet/maui/android/emulator/mac-with-windows-vm), [scrcpy README](https://github.com/Genymobile/scrcpy), [scrcpy tunnels](https://github.com/Genymobile/scrcpy/blob/master/doc/tunnels.md), [scrcpy macOS](https://github.com/Genymobile/scrcpy/blob/master/doc/macos.md), [android-emulator-container-scripts](https://github.com/google/android-emulator-container-scripts), `man caffeinate`
- Local scripts, read only: `~/.claude/scripts/remote-run`, `~/.claude/scripts/lib/remote.sh`, `~/.claude/scripts/capacity`; global git config `audiout.remoteHost`, `audiout.testPrefer` (`remote`), `audiout.remoteSlots` (2)
- The mule, read over ssh: `sw_vers`, `sysctl hw.memsize hw.ncpu`, `ls` of `~/Library/Android/sdk`, `/Volumes`, `~/.android/avd`, `~/audiout-remote-tests.noindex`, `who`, `df`
- Local, read on this Mac: `/Applications/Android Studio.app/Contents/plugins/android/lib/sdklib.jar` (`tv.xml`), `~/.android/avd/*.ini`, `~/.android/avd/Medium_Phone.avd/config.ini`, `scripts/android-tv.sh`, `android-tv/AGENTS.md`, `android-tv/app/build.gradle.kts`, `android-tv/gradle/libs.versions.toml`
