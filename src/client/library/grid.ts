// Pure helpers for the library grid. No runtime imports so the tests can load this file from source.
import type { LibraryTitle } from './api';
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
export const missingCount = (titles: LibraryTitle[], progress: Map<string, SubjectProgress>, downloadingByShow: Map<number, number>) =>
  titles.filter((title) => {
    if (title.tv !== null) return title.tv.episodeCount - title.tv.episodeFileCount - (downloadingByShow.get(title.id) ?? 0) > 0;
    return title.status !== 'deleted' && title.movie?.hasFile === false && !progress.has(`movie:${title.id}`);
  }).length;

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
