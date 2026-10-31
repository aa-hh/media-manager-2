# 0007. Update the TV app from GitHub releases

Status: accepted

## Context

The Android TV app is installed outside the Play Store (sideloaded over ADB, Android Debug Bridge), so Android won't update it. The owner wants the app to update itself (31 Oct 2026). Android only installs an update signed with the same key as the installed app; a lost or changed key means uninstalling, which signs the TV out. The repository is public on GitHub and has no releases yet.

## Decision

The app lives in `android-tv/`. CI builds and tests it on every pull request that touches that folder. When such a change merges to `main`, CI signs the app with the release key and publishes it as a GitHub release. At launch the TV checks the latest release; when it is newer than the installed version it asks "Update now / Later", downloads the file and hands it to Android's installer, which shows its own confirmation. The release key is generated once: one copy in this Mac's Keychain, one in the repository's GitHub Actions secrets, added by the owner.

## Consequences

No server code is needed for updates, and anyone's TV can update the same way. Every merged TV change makes a public release. The TV needs the "install unknown apps" permission for this app, granted once. Losing both copies of the key means every TV must uninstall and sign in again. The first install still goes over ADB from the Mac.
