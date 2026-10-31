# Drawing mpv inside the desktop window: test result

27 Oct 2026. Track C0 of the in-app playback work order (Linear AA-362). Three ways of putting mpv's picture inside an Electron window under our own HTML controls, tested by the owner with his own files streamed from the slot's Plex (direct play only).

**Winner: candidate 3.** mpv draws with its `gpu-next` renderer in its own borderless window, and the transparent Electron window sits on top of it as a child window. It is the only candidate that shows Dolby Vision profile 5 (Arrival) in the right colours, and with fullscreen and the mini player done the way below it dropped no frames.

The test apps are throwaway code outside the repo: `~/Projects/media-manager-2-spike/c0-native-view/` (candidate 2) and `~/Projects/media-manager-2-spike/c0-gpu-next/` (candidate 3), each with a README and a `readout.log` of mpv's values every 10 seconds.

## The candidates

1. **`electron-mpv-video` 0.1.1**, the only package found that draws mpv inside an Electron page. Rejected 27 Oct: it can't set mpv options or report mpv's properties.
2. **mpv's render API into a native view under the page.** A small native addon draws libmpv (`vo=libmpv`, OpenGL) into an `NSOpenGLView` placed under Electron's transparent web contents. This is how the Plex desktop app embeds mpv in Qt. mpv 0.41's render API only offers the older `gpu` renderer, which does no Dolby Vision reshaping.
3. **mpv's own window under the page.** mpv opens a borderless window with `vo=gpu-next`, `gpu-api=vulkan`, `gpu-context=macvk` (Vulkan through MoltenVK). The addon finds that window through mpv's `window-id` property and attaches the Electron window above it (`addChildWindow:ordered:NSWindowAbove`), so the controls sit on the picture and the two move together.

Drawing `gpu-next` into a view we hand to mpv is not possible on macOS: mpv v0.41.0 reads `--wid` only in its X11, Windows and Android code (`options/options.c:173`, `video/out/x11_common.c`, `w32_common.c`, `android_common.c`); the macOS backend always makes its own view and window (`video/out/mac_common.swift:56-59`). The note in `include/mpv/client.h:198-200` saying it works on macOS is out of date.

## Results

All files direct-played from the slot over its `plex.direct` address, decoded by the Mac's hardware (`hwdec-current: videotoolbox`). "Second Mac" is an Apple M3 laptop with a 2880 x 1864 screen; the owner moved the tests there because his own Mac was busy with other work.

| Candidate | File | Mac | Played | Colours like the Plex app | Dropped frames | Notes |
|---|---|---|---|---|---|---|
| 2 | Hereditary (Dolby Vision 7, 76 Mbps, 4K) | owner's | 1.8 min | Yes | 3, all between 41 and 51 s | Plays the HDR10 base layer and skips the enhancement layer, as expected. About 49 s loaded ahead, the 512 MiB limit at this bitrate. |
| 2 | Arrival (Dolby Vision 5, 4K) | second | 10.5 min | **No: green and purple** | 0 | 3.5 to 4.5 min loaded ahead throughout. |
| 2 | Conclave (HDR10, 57 Mbps, 4K) | second | 3.5 min | Not recorded | 0, until fullscreen | About 65 to 90 s loaded ahead. |
| 2 | Conclave, after clicking Fullscreen | second | 0.6 min | | About 10 a second | The window did not fill the screen; mpv warned the sound had drifted from the picture. |
| 3, first version | Arrival | second | 2 min | Yes | 3 in 24 s, then about 12 a second from Fullscreen | Fullscreen and Mini resized mpv's window repeatedly; each new size made libplacebo rebuild its pipeline (1.0 to 1.6 s, four times). |
| 3, fixed | Arrival | second | 1 min, through Fullscreen and Mini | Yes | 0 | Fullscreen filled the screen. Display 60 fps, `video-sync=audio`, no delayed or mistimed frames, one 0.2 s pipeline rebuild. |

The 14 Oct standalone mpv run (also `gpu-next`) showed Arrival with 4 dropped frames in 14 minutes.

Not yet rerun on candidate 3: Hereditary, Conclave, and a long Arrival run. Candidate 2 played the first two correctly, and `gpu-next` handled them in the 14 Oct standalone test, so they are expected to pass.

## What the desktop app (C1) takes from this

- **mpv options:** `vo=gpu-next`, `gpu-api=vulkan`, `gpu-context=macvk`, `border=no`, `auto-window-resize=no` (stops mpv resizing its window for each file), plus the C1.3 options.
- **Fullscreen is mpv's:** set mpv's `fullscreen=yes` with `native-fs=no`; the Electron window takes the same frame. Electron's own simple fullscreen animates the window through many sizes, and resizing mpv's window at each step caused the frame drops above.
- **The mini player moves no window:** it shrinks the picture inside mpv's window with the `video-margin-ratio-left/right/top/bottom` properties, and the page draws the rest of the screen over it. mpv's window only changes size when the whole app window does.
- **Every call into mpv is asynchronous.** mpv's macOS window code waits on the main thread while mpv's core waits for it, and Electron's JavaScript runs on the main thread, so a blocking call while a file opens or at quit freezes the app.
- **Bundling (C1.6):** besides libmpv and its libraries, the app must carry MoltenVK and the Vulkan loader, since `gpu-next` draws through Vulkan.
- **Which window is the parent (changed 30 Oct, PR #258):** the test apps attached the Electron window above mpv's as its child. Dragging the Electron window then had to move mpv's window by hand on every step, one step behind, which made the app jitter. The app now attaches mpv's window as the Electron window's child, ordered below (`addChildWindow:ordered:NSWindowBelow`), so macOS moves both together. mpv's renderer and options are unchanged.

## Still open

- Hereditary and Conclave on candidate 3, and a 10-minute Arrival run.
- Arrival's Dolby Vision colours and the fullscreen frame drops, rerun with mpv's window as the child.
- A dark rectangle may flash on the first Load before mpv's window moves under the page.
- The Dock icon may switch to mpv's.
- macOS's own fullscreen (the green button) is untested; the app should keep its own Fullscreen button.
- Resizing the app window by dragging is untested; the test windows are fixed-size.
