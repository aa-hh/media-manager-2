'use strict';
// What the app page may see of playback and who may call the player. The page
// never sees a stream or subtitle address: they carry Plex's transient token.
// No Electron here, so tests/production.test.mjs can run it.

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/**
 * The start reply as the page gets it: no stream address, and an external subtitle's url is its tokenless stream key, which
 * setSubtitle takes back. `ids` are this install's clientId and sessionIdentifier (not secrets), so the page's reports to
 * Plex come from the same player as the stream. `sound` is the saved volume, mute and subtitle size mpv starts the file
 * with: mpv sends no event for a value it already had, so a reloaded page learns them only here.
 */
const pageCopy = (reply, ids, sound) => {
  const { streamAddresses, ...rest } = reply;
  return {
    ...rest,
    clientId: ids.clientId,
    sessionIdentifier: ids.sessionIdentifier,
    volume: sound.volume,
    muted: sound.muted,
    subtitleScale: sound.subtitleScale,
    tracks: {
      ...rest.tracks,
      subtitle: rest.tracks.subtitle.map((track) => ({ ...track, url: track.external ? track.key : null })),
    },
  };
};

/** One mpv track-list entry as the page gets it. mpv makes an external file's title and language from its address, so both are left out. */
const pageTrack = (track) => (track.external ? { ...track, title: null, lang: null } : track);

/**
 * Whether a player call may run: only from the app window's main frame while
 * it shows the app's origin. A subframe, another origin or the first-launch
 * address page could otherwise start playback and drive mpv.
 */
const callerAllowed = ({ fromAppWindow, mainFrame, frameUrl, appOrigin }) =>
  fromAppWindow === true && mainFrame === true && typeof appOrigin === 'string' && originOf(frameUrl) === appOrigin;

// As in native Mac apps the app's frame is not selectable; fields, and elements the web app marks select-text, still are.
const NO_SELECT_CSS = 'html { -webkit-user-select: none; user-select: none } input, textarea, [contenteditable], [contenteditable] * { -webkit-user-select: text; user-select: text }';

module.exports = { originOf, pageCopy, pageTrack, callerAllowed, NO_SELECT_CSS };
