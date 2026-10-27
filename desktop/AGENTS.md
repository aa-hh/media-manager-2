# desktop

## Purpose

The Mac desktop app: Electron loading the owner's media-manager-2 address, mpv playing video straight from Plex. Electron and the mpv addon stay in this `package.json`, never the web app's. It never holds the owner's Plex token, only the transient one in stream addresses.

## Rules

- Every call into mpv is asynchronous: mpv's macOS window code waits on the main thread while mpv's core waits on it, so a blocking call freezes the app.
- mpv draws in its own window under this one; `--wid` does nothing on macOS. Layouts (full, mini, a page rectangle) set mpv's `video-margin-ratio-*` and move no window: each new window size makes libplacebo rebuild its shaders and drop frames.
- Fullscreen is mpv's own (`native-fs=no`); the Electron window follows mpv's frame.
- The page never sees a stream or subtitle address. The start request runs in a private script world with the page's cookie; the page's copy drops `streamAddresses` and swaps subtitle `url`s for tokenless stream keys.
- `lib/` imports nothing from Electron, so `tests/production.test.mjs` runs it.
- `address/planet.js` and the font are copied from `src/client` by `prepare.mjs`; edit the web app's copy, never these.
- Build, sign and notarise only through `scripts/desktop-build.sh`. Building the addon is `npx @electron/rebuild`.

## Map

- `main.js` → windows, navigation, the bridge handlers, mpv options and retries.
- `preload.js` → `mediaManagerDesktop` for the web app, `desktopAddress` for the address page.
- `src/mpvview.mm` → native addon: mpv's window under Electron's, async mpv calls.
- `lib/connection.js` → picks the Plex address mpv streams from.
- `lib/retry.js` → reload or step down after mpv fails.
- `lib/address.js` → checks the address typed at first launch.
- `lib/page.js` → what the page sees; who may call the player.
- `address/index.html` → first-launch address screen, the sign-in screen's look.
