'use strict';
// Decisions the player makes about mpv's file events, pausing, subtitle
// files and the values it saves. No Electron here, so tests/production.test.mjs can run it.
const path = require('node:path');

/**
 * What an mpv `file-loaded` or `end-file` event means for `playing`, the
 * title asked for. `loaded` is the title whose file mpv last opened: an event
 * from an older load is ignored, so a stopped or replaced file never opens,
 * fails or finishes into a newer one. Returns null (ignore), 'opened',
 * 'finished', 'unauthorized' (Plex answered 401) or 'failed'.
 */
const fileEvent = (event, playing, loaded) => {
  if (!playing || playing !== loaded) return null;
  if (event.event === 'file-loaded') return 'opened';
  if (event.event !== 'end-file') return null;
  const reason = String(event.value ?? '');
  // A stop, a reload replacing the file, or quitting: none of them is the title ending or failing.
  if (reason === 'stop' || reason === 'quit' || reason === 'redirect') return null;
  // A transcode often has no duration in mpv; Plex's own length stands in.
  const total = playing.duration ?? (typeof playing.reply?.durationMs === 'number' ? playing.reply.durationMs / 1000 : null);
  if (reason === 'eof' && (total === null || total - playing.position < 15)) return 'finished';
  // An error, or the stream ending early (it broke).
  return playing.unauthorized ? 'unauthorized' : 'failed';
};

/**
 * Whether mpv unpauses once a file opens. Every load opens paused (mpv's
 * `pause` is set to yes), so only the owner's own choice, kept on the title,
 * counts: a new load plays, and a seek's reload or a retry keeps a pause.
 */
const playsOnOpen = (playing) => playing.paused !== true;

/**
 * Whether the page hears mpv's position for `playing`. mpv reports one as soon as a file opens, still paused and before
 * anything is drawn; the page takes the first one as playing and swapped its opening screen for controls over an empty
 * picture. So each load stays on the opening screen until mpv has drawn its first frame (`drawn`, from
 * `playback-restart`) and the tracks are picked and playback let go (`begun`). Playback moving a second past where it
 * started also counts, should mpv skip `playback-restart`.
 */
const showsPosition = (playing) => !playing || (playing.drawn === true && playing.begun === true)
  || (typeof playing.position === 'number' && typeof playing.startedAt === 'number' && playing.position > playing.startedAt + 1);

/** How often the page hears mpv's position during normal play, in ms. */
const POSITION_EVERY_MS = 250;
/** A position more than this many seconds from the last one sent (a seek) goes to the page at once. */
const POSITION_JUMP_SECONDS = 1;

/**
 * Whether mpv's `time-pos` value `position`, at `now` (ms), goes to the page, given `last`, the `{ at, position }` last
 * sent (null or undefined before the first). Successive positions sent during normal play differ by about 0.25 s, so
 * they stay under the 2 s step the page's played-time count ignores (`playedBetween`); a seek shows at once. Keeping the
 * title's own position up to date every frame is the caller's job, not this one's.
 */
const sendsPosition = (last, position, now) => last === null || last === undefined || now - last.at >= POSITION_EVERY_MS
  || Math.abs(position - last.position) > POSITION_JUMP_SECONDS;

/**
 * The page's click time `value` (ms), where play-timings.log starts: kept only when it is a finite number from the
 * minute up to `now`, else undefined. Never throws, whatever the page sent.
 */
const clickTime = (value, now) => (Number.isFinite(value) && value >= now - 60_000 && value <= now ? value : undefined);

/** `address` with the scheme, host and port of `origin`. */
const withOrigin = (address, origin) => {
  const url = new URL(address);
  const target = new URL(origin);
  url.protocol = target.protocol;
  url.host = target.host;
  return url.toString();
};

/**
 * The mpv `sub-add` command for an external subtitle file Plex lists. Plex
 * addresses it to its first connection; mpv fetches it from `origin`, the one
 * that answered. The title comes from Plex: without one, mpv titles the track
 * with the file's address, token included.
 */
const subtitleAdd = (track, origin) => ['sub-add', withOrigin(track.url, origin), 'cached', track.title ?? track.language ?? track.key];

/** A volume for mpv: a whole percent from 0 to 100, or null for anything that is not a number (refused, or a saved value ignored). */
const volumePercent = (value) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null);

/** The subtitle text sizes, as mpv's sub-scale: Plex's desktop app's Tiny, Small, Normal, Large and Huge. */
const SUBTITLE_SCALES = [0.5, 0.75, 1, 1.25, 2];

/** A sub-scale for mpv: one of SUBTITLE_SCALES, or null for anything else (refused, or a saved value ignored). */
const subtitleScale = (value) => (SUBTITLE_SCALES.includes(value) ? value : null);

/** Settings' Appearance choice for nativeTheme.themeSource: light, dark or system, or null for anything else. */
const themeSource = (value) => (['light', 'dark', 'system'].includes(value) ? value : null);

/**
 * The options mpv takes before init, from `env` (the process's environment) and `userData` (the folder desktop.json
 * lives in).
 *
 * mpv's own log, userData/mpv.log beside desktop.json, is written only when MM2_MPV_LOG=1 asks for it: mpv writes it at
 * debug level, and it holds every stream and subtitle address, each with Plex's transient token. Set before init:
 * log-file is read before mpv starts, and only a file opened then holds libmpv's start-up and video-output lines, where
 * the time to the first frame goes. mpv empties the file each time it opens it, so it holds one launch.
 *
 * libmpv finds no shader cache folder of its own, so every new picture setup compiled its shaders again (the first Play
 * of a launch waited 3.5 s for its first frame). Kept beside desktop.json, compiled shaders carry over between launches.
 * Set before init: force-window makes the video output straight after init, and the output reads the folder only when
 * it is made, so a set that lands later is ignored.
 */
const mpvStartOptions = (env, userData) => ({
  ...(env.MM2_MPV_LOG === '1' ? { 'log-file': path.join(userData, 'mpv.log') } : {}),
  'gpu-shader-cache-dir': path.join(userData, 'mpv-shader-cache'),
});

module.exports = {
  fileEvent, playsOnOpen, showsPosition, sendsPosition, clickTime, subtitleAdd, volumePercent, subtitleScale, themeSource, mpvStartOptions,
};
