'use strict';
// Decisions the player makes about mpv's file events, pausing and subtitle
// files. No Electron here, so tests/production.test.mjs can run it.

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

module.exports = { fileEvent, playsOnOpen, subtitleAdd };
