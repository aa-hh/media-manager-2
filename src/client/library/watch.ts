// Pure helpers for Plex watch status on library cards. No runtime imports so the tests can load this file from source.
import type { LoadRequest } from '../desktopBridge';
import type { ContinueWatchingItem, MovieWatch, SeriesWatch, TitleWatch } from './api';

const stoppedPartway = (offsetMs: number | null, durationMs: number | null): durationMs is number =>
  offsetMs !== null && offsetMs > 0 && durationMs !== null && durationMs > 0;

/**
 * The card's marks, following Plex: the watch bar only when stopped partway, and then nothing in the corner;
 * otherwise a tick when everything is watched, or a show's number of unwatched episodes.
 */
export const watchMarks = (watch: TitleWatch, item: ContinueWatchingItem | undefined): { watched?: number; watchMark?: 'played' | number } => {
  const partway = item ?? (watch?.kind === 'movie' ? watch : undefined);
  if (partway !== undefined && stoppedPartway(partway.viewOffsetMs, partway.durationMs)) {
    return { watched: Math.round((partway.viewOffsetMs! / partway.durationMs) * 100) };
  }
  if (watch?.kind === 'movie') return watch.viewCount > 0 ? { watchMark: 'played' } : {};
  if (watch?.kind === 'show' && watch.leafCount > 0) {
    const unwatched = watch.leafCount - watch.viewedLeafCount;
    return { watchMark: unwatched > 0 ? unwatched : 'played' };
  }
  return {};
};

/** "28 min", "1 h 15 min", "2 h"; never less than a minute. */
export const minutesText = (ms: number) => {
  const total = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

/** A saved position as Plex's apps print it: "21:00", "1:05:09". */
export const clockText = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const rest = `${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  return hours === 0 ? rest.replace(/^0/, '') : `${hours}:${rest}`;
};

const episodeText = (item: ContinueWatchingItem) => (item.episode === null ? null : `S${item.episode.seasonNumber} E${item.episode.episodeNumber}`);

/** Continue Watching's meta line: "S2 E4 · 31 min left", "Next: S3 E2 · 28 min", "1 h 15 min left". */
export const continueMeta = (item: ContinueWatchingItem): string | undefined => {
  const episode = episodeText(item);
  const resumed = stoppedPartway(item.viewOffsetMs, item.durationMs);
  const time = item.durationMs === null ? null : resumed ? `${minutesText(item.durationMs - item.viewOffsetMs!)} left` : minutesText(item.durationMs);
  const parts = [episode !== null && !resumed ? `Next: ${episode}` : episode, time].filter((part) => part !== null);
  return parts.length === 0 ? undefined : parts.join(' · ');
};

/** The card button's words: Resume when stopped partway, the next episode when Plex has one, else Play. */
export const playLabel = (watch: TitleWatch, item: ContinueWatchingItem | undefined) => {
  if (watchMarks(watch, item).watched !== undefined) return 'Resume';
  const episode = item === undefined ? null : episodeText(item);
  return episode === null ? 'Play' : `Play ${episode}`;
};

/**
 * Which Play a card gets: the in-app player inside the desktop app, Plex's own web app in a plain browser,
 * and none on a Jellyfin install or for a title Plex does not have or did not answer for.
 */
export type PlayMode = 'desktop' | 'plex-web' | 'none';
export const playMode = ({ mediaServer, desktop, libraryWatch, watch }: {
  mediaServer: 'plex' | 'jellyfin';
  desktop: boolean;
  libraryWatch: 'ok' | 'unavailable' | 'off';
  watch: TitleWatch;
}): PlayMode => {
  if (mediaServer === 'jellyfin' || libraryWatch !== 'ok' || watch === null) return 'none';
  return desktop ? 'desktop' : 'plex-web';
};

/** The item's page on app.plex.tv, where Plex Web asks about resuming itself. */
export const plexWebUrl = (machineIdentifier: string, ratingKey: string) =>
  `https://app.plex.tv/desktop/#!/server/${encodeURIComponent(machineIdentifier)}/details?key=${encodeURIComponent(`/library/metadata/${ratingKey}`)}`;

export type StartFrom = 'resume' | 'start';

// Direct play first; the desktop app steps down on its own when that fails (work order C1.5).
const firstTry = { directPlay: true, directStream: true, directStreamAudio: true };

const request = (playable: { ratingKey: string; mediaIndex: number; viewOffsetMs: number | null }, from: StartFrom): LoadRequest => ({
  ratingKey: playable.ratingKey,
  mediaIndex: playable.mediaIndex,
  partIndex: 0,
  offsetSeconds: from === 'resume' ? Math.floor((playable.viewOffsetMs ?? 0) / 1000) : 0,
  flags: firstTry,
});

/** What the desktop app loads for a movie: its default (highest-quality) version. Null when Plex has no match. */
export const movieLoad = (watch: MovieWatch, from: StartFrom): LoadRequest | null =>
  (watch === null || watch.kind !== 'ok' ? null : request(watch, from));

/**
 * What the desktop app loads for a show: the asked episode (from Continue Watching), else Plex's next episode,
 * else the earliest episode Plex has, specials last. Null when Plex has none of them.
 */
export const episodeLoad = (
  detail: { episodes: Array<{ id: number; seasonNumber: number; episodeNumber: number }>; watch: SeriesWatch },
  wanted: { seasonNumber: number; episodeNumber: number } | null,
  from: StartFrom,
): LoadRequest | null => {
  const { watch } = detail;
  if (watch === null || watch.kind !== 'ok') return null;
  const target = wanted ?? watch.nextEpisode;
  const inPlex = detail.episodes.filter((episode) => watch.episodes[String(episode.id)] !== undefined);
  const episode = target === null
    ? [...inPlex].sort((a, b) => (a.seasonNumber === 0 ? 1 : 0) - (b.seasonNumber === 0 ? 1 : 0) || a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)[0]
    : inPlex.find((candidate) => candidate.seasonNumber === target.seasonNumber && candidate.episodeNumber === target.episodeNumber);
  return episode === undefined ? null : request(watch.episodes[String(episode.id)], from);
};
