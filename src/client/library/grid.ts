// Pure helpers for the library grid. No runtime imports so the tests can load this file from source.
import type { ContinueWatchingItem, LibraryTitle } from './api';
import type { SubjectProgress } from './progress';

export const progressText = (files: number, downloading: number, count: number) =>
  downloading === 0 ? `${files} / ${count}` : `${files} + ${downloading} / ${count}`;

export const totals = (titles: LibraryTitle[]) => {
  const result = { shows: 0, movies: 0, episodes: 0, files: 0, sizeBytes: 0 };
  for (const title of titles) {
    result.sizeBytes += title.sizeOnDisk;
    if (title.tv !== null) {
      result.shows += 1;
      result.episodes += title.tv.episodeCount;
      result.files += title.tv.episodeFileCount;
    } else {
      result.movies += 1;
      if (title.movie?.hasFile === true) result.files += 1;
    }
  }
  return result;
};

// The one word a movie poster prints; null for a quiet title (downloaded, or nothing to say).
export const movieWord = (title: LibraryTitle, live: SubjectProgress | undefined): string | null => {
  if (title.status === 'deleted') return 'deleted';
  if (live !== undefined) return live.percent === null ? live.word : `${live.word} ${live.percent}%`;
  if (title.movie === null) return null;
  if (!title.movie.hasFile) return title.movie.isAvailable ? 'missing' : 'not available';
  return null;
};

// Shows with aired episodes that have no file and are not downloading, plus movies that are missing or not available.
const isMissing = (title: LibraryTitle, progress: Map<string, SubjectProgress>, downloadingByShow: Map<number, number>) => {
  if (title.tv !== null) return title.tv.episodeCount - title.tv.episodeFileCount - (downloadingByShow.get(title.id) ?? 0) > 0;
  return title.status !== 'deleted' && title.movie?.hasFile === false && !progress.has(`movie:${title.id}`);
};

export const missingCount = (titles: LibraryTitle[], progress: Map<string, SubjectProgress>, downloadingByShow: Map<number, number>) =>
  titles.filter((title) => isMissing(title, progress, downloadingByShow)).length;

export const KINDS = ['all', 'movie', 'tv'] as const;
export type Kind = typeof KINDS[number];
export const SEGMENTS = ['all', 'continue', 'unwatched', 'missing', 'downloading'] as const;
export type Segment = typeof SEGMENTS[number];

export type FilterFacts = {
  progress: Map<string, SubjectProgress>;
  downloadingByShow: Map<number, number>;
  /** Plex's Continue Watching in Plex's order; empty when Plex is off or not answering. */
  continueWatching: ContinueWatchingItem[];
};

export const titleKey = (title: { service: string; id: number }) => `${title.service}:${title.id}`;

// Unwatched as Plex counts it: a movie never played through, or a show with an episode not played.
const isUnwatched = ({ watch }: LibraryTitle) =>
  watch?.kind === 'movie' ? watch.viewCount === 0 : watch?.kind === 'show' && watch.leafCount > watch.viewedLeafCount;

const isDownloading = (title: LibraryTitle, facts: FilterFacts) =>
  title.tv !== null ? (facts.downloadingByShow.get(title.id) ?? 0) > 0 : facts.progress.has(`movie:${title.id}`);

// Both filter sets apply together. Continue Watching keeps Plex's order; the rest keep the library's.
export const filterTitles = (titles: LibraryTitle[], kind: Kind, segment: Segment, facts: FilterFacts): LibraryTitle[] => {
  const ofKind = (title: LibraryTitle) => kind === 'all' || title.type === kind;
  if (segment === 'continue') {
    const byKey = new Map(titles.map((title) => [titleKey(title), title]));
    const keys = new Set(facts.continueWatching.map(titleKey));
    return [...keys].flatMap((key) => {
      const title = byKey.get(key);
      return title !== undefined && ofKind(title) ? [title] : [];
    });
  }
  return titles.filter((title) => ofKind(title) && (
    segment === 'all'
    || (segment === 'unwatched' && isUnwatched(title))
    || (segment === 'missing' && isMissing(title, facts.progress, facts.downloadingByShow))
    || (segment === 'downloading' && isDownloading(title, facts))
  ));
};

// Each set's counts follow the other set's choice.
export const filterCounts = (titles: LibraryTitle[], kind: Kind, segment: Segment, facts: FilterFacts) => ({
  kinds: Object.fromEntries(KINDS.map((each) => [each, filterTitles(titles, each, segment, facts).length])) as Record<Kind, number>,
  segments: Object.fromEntries(SEGMENTS.map((each) => [each, filterTitles(titles, kind, each, facts).length])) as Record<Segment, number>,
});

// Continue Watching and Unwatched need Plex's answer; without it they hide and the choice falls back to All.
export const segmentsFor = (watchKind: 'ok' | 'unavailable' | 'off'): Segment[] =>
  (watchKind === 'ok' ? [...SEGMENTS] : SEGMENTS.filter((segment) => segment !== 'continue' && segment !== 'unwatched'));

export const FIELDS = ['year', 'progress', 'size', 'profile', 'added'] as const;
export type Field = typeof FIELDS[number];
const DEFAULT_FIELDS: Field[] = ['year', 'progress', 'size'];
const KEY = 'mm2.library.fields';

export const readFields = (): Field[] => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    if (Array.isArray(value)) return FIELDS.filter((field) => value.includes(field));
  } catch { /* storage unavailable or unreadable: use the defaults */ }
  return DEFAULT_FIELDS;
};

export const writeFields = (fields: Field[]) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(fields));
  } catch { /* the choice just won't persist */ }
};
