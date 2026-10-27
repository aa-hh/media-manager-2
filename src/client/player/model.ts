// The player's decisions, kept apart from React and the bridge. Pure: type imports only, so the tests load this file from source.
import type { DesktopEvents, LoadRequest, PlaybackFlags } from '../desktopBridge';

/** POST /api/playback/start's reply as the page gets it (src/server/playback.ts is the source of truth). */
export type StartReply = {
  session: string;
  /** The desktop app's own player ids, which every call to Plex during playback carries. */
  clientId?: string;
  sessionIdentifier?: string;
  partId: number | null;
  startPositionSeconds: number;
  durationMs: number | null;
  decision: PlaybackFlags & { maxVideoBitrate: number | null };
  playQueue: { items: QueueItem[] };
  tracks: { audio: AudioTrack[]; subtitle: SubtitleTrack[] };
  markers: Array<{ type: string | null; startTimeOffset: number | null; endTimeOffset: number | null }>;
  chapters: Array<{ index: number | null; title: string | null; startTimeOffset: number | null; endTimeOffset: number | null }>;
  qualitySteps: QualityStep[];
};
export type QueueItem = {
  playQueueItemID: number | null;
  ratingKey: string | null;
  type: string | null;
  title: string | null;
  grandparentTitle: string | null;
  parentIndex: number | null;
  index: number | null;
  duration: number | null;
};
export type AudioTrack = { id: number | null; index: number; ffIndex: number | null; codec: string | null; language: string | null; title: string | null; selected: boolean };
/** `url` is the tokenless stream key for a file beside the video, null for one inside it; setSubtitle takes both back. */
export type SubtitleTrack = AudioTrack & { external: boolean; key: string | null; url?: string | null };
export type QualityStep = { index: number; kbps: number; height: number };

// --- Seeking (network §4)

export const BACK_SECONDS = 10;
export const FORWARD_SECONDS = 30;
const END_GAP_SECONDS = 5;

/** Where a seek lands: never before the start, never closer than 5 s to the end (Plex's own rule). */
export const clampSeek = (target: number, duration: number) => {
  const latest = duration > 0 ? Math.max(0, duration - END_GAP_SECONDS) : Number.POSITIVE_INFINITY;
  return Math.min(latest, Math.max(0, target));
};

// --- What the player shows, from the bridge's events

export type Playback = {
  /** opening: from Play until the first position. ended: the file finished (Up Next). failed: every way of playing failed. */
  phase: 'opening' | 'playing' | 'ended' | 'failed';
  position: number;
  duration: number;
  paused: boolean;
  buffering: boolean;
  /** A new load at the same second (automatic retry, quality or track change) until its first position arrives. */
  restarting: boolean;
  loadedAhead: number;
  failure?: { message: string; tried: string[] };
};

export type BridgeEvent = { [E in keyof DesktopEvents]: { type: E; value: DesktopEvents[E] } }[keyof DesktopEvents];

export const openingAt = (seconds: number): Playback => (
  { phase: 'opening', position: seconds, duration: 0, paused: false, buffering: false, restarting: false, loadedAhead: 0 }
);

/** The next playback after one bridge event. A finished or failed title ignores mpv's late position reports. */
export const applyEvent = (state: Playback, event: BridgeEvent): Playback => {
  switch (event.type) {
    case 'position':
      // The desktop app can pass null where mpv has no value yet, though the bridge types say number.
      if (state.phase === 'ended' || state.phase === 'failed' || !Number.isFinite(event.value)) return state;
      return { ...state, phase: 'playing', position: event.value, restarting: false };
    case 'duration':
      return !Number.isFinite(event.value) || event.value === state.duration ? state : { ...state, duration: event.value };
    case 'paused':
      return { ...state, paused: event.value };
    case 'buffering':
      return { ...state, buffering: event.value };
    case 'loadedAhead':
      return { ...state, loadedAhead: Number.isFinite(event.value) ? event.value : 0 };
    case 'endOfFile':
      return state.phase === 'failed' ? state : { ...state, phase: 'ended', buffering: false };
    case 'error':
      return { ...state, phase: 'failed', buffering: false, restarting: false, failure: { message: event.value.message, tried: event.value.tried } };
    case 'started':
      return state.phase === 'opening' ? state : { ...state, phase: 'playing', restarting: true };
    case 'tracks':
    case 'volume':
    case 'muted':
      return state;
  }
};

/** The numbered states of player.pen: 3 opening, 1 and 2 playing, 4 buffering, 13 error, 14 can't reach Plex, 15 and 16 Up Next. */
export type Screen = 'opening' | 'playing' | 'buffering' | 'error' | 'unreachable' | 'up-next';

/** `plexDown`: the last timeline report got no answer, so a stall reads as Plex being unreachable rather than slow. */
export const screenFor = (state: Playback, plexDown: boolean): Screen => {
  if (state.phase === 'failed') return 'error';
  if (state.phase === 'ended') return 'up-next';
  if (state.phase === 'opening') return 'opening';
  if (!state.buffering && !state.restarting) return 'playing';
  return plexDown && state.buffering ? 'unreachable' : 'buffering';
};

// --- Timeline reports to Plex (network §6.2)

export type TimelineState = 'playing' | 'paused' | 'buffering' | 'stopped';
export const TIMELINE_EVERY_MS = 10_000;

/** What the timeline says now; null while nothing reports (opening, or Up Next after the title ended). */
export const timelineState = (state: Playback): TimelineState | null => {
  if (state.phase === 'failed') return 'stopped';
  if (state.phase !== 'playing') return null;
  if (state.buffering || state.restarting) return 'buffering';
  return state.paused ? 'paused' : 'playing';
};

/** Whether this change reports straight away: the first position, a pause, buffering, an error or a new duration. */
export const reportNow = (before: Playback, after: Playback) => {
  const next = timelineState(after);
  if (next === null) return false;
  return next !== timelineState(before) || (next !== 'stopped' && before.duration !== after.duration);
};

/** Whether the 10 s report runs in this state: every state that plays, paused included, but not after a stop. */
export const reportsPeriodically = (state: Playback) => {
  const now = timelineState(state);
  return now !== null && now !== 'stopped';
};

export const timelineQuery = (report: {
  ratingKey: string;
  state: TimelineState;
  position: number;
  duration: number;
  playedMs: number;
  playQueueItemID: number | null;
  continuing?: boolean;
  clientId: string;
  sessionIdentifier: string;
}): Record<string, string> => ({
  ratingKey: report.ratingKey,
  state: report.state,
  time: String(Math.max(0, Math.round(report.position * 1000))),
  duration: String(Math.max(0, Math.round(report.duration * 1000))),
  playbackTime: String(Math.max(0, Math.round(report.playedMs))),
  ...(report.playQueueItemID === null ? {} : { playQueueItemID: String(report.playQueueItemID) }),
  ...(report.continuing === true ? { continuing: '1' } : {}),
  clientId: report.clientId,
  sessionIdentifier: report.sessionIdentifier,
});

/** Seconds actually played between two position reports: a jump (a seek) or going back counts nothing. */
export const playedBetween = (before: number, after: number) => (after > before && after - before <= 2 ? after - before : 0);

// --- Sound

export const VOLUME_STEP = 5;
export const clampVolume = (percent: number) => Math.min(100, Math.max(0, Math.round(percent)));

/** What a key does to the sound: Up and Down change the volume 5 %, M mutes or unmutes; null for any other key. */
export const volumeKey = (key: string): { kind: 'step'; by: number } | { kind: 'mute' } | null => {
  if (key === 'ArrowUp') return { kind: 'step', by: VOLUME_STEP };
  if (key === 'ArrowDown') return { kind: 'step', by: -VOLUME_STEP };
  return key === 'm' || key === 'M' ? { kind: 'mute' } : null;
};

// --- Up Next (player.pen states 15 and 16)

export const UP_NEXT_SECONDS = 10;
// Plex's player plays the next item at once after a video shorter than this (network §10.3).
const SHORT_VIDEO_SECONDS = 300;

export type UpNextChoice<T> =
  | { kind: 'countdown'; item: T; seconds: number }
  | { kind: 'play'; item: T }
  | { kind: 'waiting' }
  | { kind: 'none' };

/**
 * What follows a title: the next episode Plex has, counted down from 10 s (at once after a short video); else the next
 * episode still on its way into Plex; else the top of Continue Watching; else nothing, and the player closes.
 */
export const upNextChoice = <T>({ next, nextOnItsWay, continueWatching, durationSeconds }: {
  next: T | null;
  nextOnItsWay: boolean;
  continueWatching: T | null;
  durationSeconds: number;
}): UpNextChoice<T> => {
  if (next !== null) return durationSeconds > 0 && durationSeconds < SHORT_VIDEO_SECONDS ? { kind: 'play', item: next } : { kind: 'countdown', item: next, seconds: UP_NEXT_SECONDS };
  if (nextOnItsWay) return { kind: 'waiting' };
  return continueWatching === null ? { kind: 'none' } : { kind: 'countdown', item: continueWatching, seconds: UP_NEXT_SECONDS };
};

/** The episode after `current` in season and episode order; specials only follow specials. */
export const nextEpisode = <E extends { seasonNumber: number; episodeNumber: number }>(episodes: E[], current: { seasonNumber: number; episodeNumber: number }) => (
  episodes
    .filter((episode) => (current.seasonNumber === 0) === (episode.seasonNumber === 0))
    .filter((episode) => episode.seasonNumber > current.seasonNumber || (episode.seasonNumber === current.seasonNumber && episode.episodeNumber > current.episodeNumber))
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)[0] ?? null
);

/** The play queue items either side of the one playing: Previous and Next (state 12). */
export const queueNeighbours = (items: QueueItem[], ratingKey: string) => {
  const at = items.findIndex((item) => item.ratingKey === ratingKey);
  return at === -1 ? { previous: null, next: null } : { previous: items[at - 1] ?? null, next: items[at + 1] ?? null };
};

// --- Skip intro and credits (network §10)

export type ActiveMarker = { kind: 'intro' | 'credits'; key: string; endSeconds: number };

/** The first intro or credits marker the position is inside, as Plex picks it. */
export const activeMarker = (markers: StartReply['markers'], positionSeconds: number): ActiveMarker | null => {
  const ms = positionSeconds * 1000;
  for (const marker of markers) {
    if ((marker.type !== 'intro' && marker.type !== 'credits') || marker.startTimeOffset === null || marker.endTimeOffset === null) continue;
    if (marker.startTimeOffset <= ms && ms < marker.endTimeOffset) {
      return { kind: marker.type, key: `${marker.type}:${marker.startTimeOffset}:${marker.endTimeOffset}`, endSeconds: Math.round(marker.endTimeOffset / 1000) };
    }
  }
  return null;
};

// --- Loads, labels and Load ahead

// Direct play first; the desktop app steps down on its own when that fails (work order C1.5).
const firstTry: PlaybackFlags = { directPlay: true, directStream: true, directStreamAudio: true };

/** The flags for a load: Original, or a quality step that asks Plex to convert at that bitrate. */
export const flagsFor = (qualityKbps: number | undefined): PlaybackFlags => (
  qualityKbps === undefined ? firstTry : { directPlay: false, directStream: true, directStreamAudio: true, maxVideoBitrate: qualityKbps }
);

/** The same title again from `seconds`, as a quality or track change and a retry need it. */
export const reloadAt = (request: LoadRequest, seconds: number, qualityKbps: number | undefined): LoadRequest => (
  { ...request, offsetSeconds: Math.max(0, Math.floor(seconds)), flags: flagsFor(qualityKbps) }
);

export const stepLabel = (step: QualityStep) => `${step.height}p · ${step.kbps >= 1000 ? `${step.kbps / 1000} Mbps` : `${step.kbps} kbps`}`;

/** The Quality button: Original, the picked step, or Converted once the player stepped down by itself. */
export const qualityLabel = (decision: StartReply['decision'], steps: QualityStep[]) => {
  if (decision.maxVideoBitrate !== null) {
    const step = steps.find((candidate) => candidate.kbps === decision.maxVideoBitrate);
    return step === undefined ? 'Converted' : `${step.height}p`;
  }
  return decision.directPlay || decision.directStream ? 'Original' : 'Converted';
};

// The desktop app's plan names (desktop/lib/retry.js) in the error block's words.
const PLAN_WORDS: Record<string, string> = {
  'Direct play': 'original file',
  'Direct stream': 'repackaged by Plex',
  Transcode: 'converted',
  'Transcode, audio included': 'converted with audio',
};
export const triedText = (tried: string[]) => `Tried: ${tried.map((plan) => PLAN_WORDS[plan] ?? plan).join(' → ')}`;

const languageName = (track: AudioTrack) => track.language ?? track.title ?? 'Unknown';
/** The Audio and Subtitles buttons show the language; the menu rows add the track's title and codec. */
export const trackButtonLabel = (track: AudioTrack | undefined, none: string) => (track === undefined ? none : languageName(track));
export const trackRowLabel = (track: AudioTrack) => [
  languageName(track),
  track.title !== null && track.title !== track.language ? track.title : null,
  track.codec?.toUpperCase() ?? null,
].filter((part) => part !== null).join(' · ');

/** Plex's stream key for a track, which takes the subtitle offset. */
export const streamKey = (track: AudioTrack) => (track.id === null ? null : `/library/streams/${track.id}`);

/**
 * Load ahead is a byte cap in the desktop app (mpv's demuxer-max-bytes) but a time in the design. Each time maps to bytes at
 * one fixed rate, chosen so 2 min is the desktop app's 512 MiB default; a file above about 36 Mbps holds less time than shown.
 */
// razor: one fixed rate for every file. Upgrade path: mpv's cache-secs through a bridge command that takes seconds.
const DEFAULT_BYTES = 512 * 1024 * 1024;
const BYTES_PER_SECOND = DEFAULT_BYTES / 120;
export const LOAD_AHEAD = [30, 60, 120, 300, 600].map((seconds) => ({
  value: String(seconds),
  label: seconds < 60 ? `${seconds} s` : `${seconds / 60} min`,
  bytes: Math.round(seconds * BYTES_PER_SECOND),
}));
/** The choice closest to a saved byte value. */
export const loadAheadChoice = (bytes: number) => LOAD_AHEAD.reduce((best, option) => (
  Math.abs(Math.log(option.bytes / bytes)) < Math.abs(Math.log(best.bytes / bytes)) ? option : best
));

/** "1 min 48 s", "40 s". */
export const durationWords = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  return minutes === 0 ? `${whole} s` : whole % 60 === 0 ? `${minutes} min` : `${minutes} min ${whole % 60} s`;
};
