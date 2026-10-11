import type { DatabaseSync } from 'node:sqlite';
import { libraryIdsByTmdbId } from '../titles.js';

// One card as saved in a Discover row; images stay TMDB paths until a reply builds our image URLs.
export type StoredItem = {
  tmdbId: number;
  type: 'movie' | 'tv';
  title: string;
  year: number | null;
  date: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  genreIds: number[];
  genres: string[];
  overview: string | null;
  popularity: number | null;
};
// A reference row (genres, streaming services) keeps its list in `reference` and no items.
export type StoredRow = { items: StoredItem[]; totalPages: number | null; reference?: unknown };

// Popular, rating and newest are plain TMDB sorts; upcoming also keeps only titles released from today on.
export const sorts = {
  popular: { movie: 'popularity.desc', tv: 'popularity.desc' },
  rating: { movie: 'vote_average.desc', tv: 'vote_average.desc' },
  newest: { movie: 'primary_release_date.desc', tv: 'first_air_date.desc' },
  upcoming: { movie: 'primary_release_date.asc', tv: 'first_air_date.asc' },
} as const;
export type Sort = keyof typeof sorts;

export type Filters = {
  genres: number[];
  providers: number[];
  region: string;
  yearFrom: number | null;
  yearTo: number | null;
  minRating: number | null;
};

// The trending grid is TMDB's trending list, so it alone has sort 'trending' and may mix movies and TV as type 'all'.
export type RowSpec =
  | { kind: 'row'; recipe: string; type: 'all' | 'movie' | 'tv'; filters: Filters }
  | { kind: 'grid'; type: 'movie' | 'tv'; sort: Sort; page: number; filters: Filters }
  | { kind: 'grid'; type: 'all' | 'movie' | 'tv'; sort: 'trending'; page: number; filters: Filters }
  | { kind: 'reference'; name: 'genres' | 'providers' | 'trakt-genres'; type: 'movie' | 'tv'; region: string };

export type DiscoverResult = {
  tmdbId: number;
  type: 'movie' | 'tv';
  title: string;
  year: number | null;
  date: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  genres: string[];
  overview: string | null;
  libraryId: number | null;
};

// Keys sorted and id lists in ascending order, so the same request always names the same saved row.
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.every((item) => typeof item === 'number') ? [...value].sort((a, b) => a - b) : value.map(canonical);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical((value as Record<string, unknown>)[name])]));
  }
  return value;
};
export const rowKey = (spec: RowSpec) => JSON.stringify(canonical(spec));
export const parseKey = (key: string) => JSON.parse(key) as RowSpec;

export const createRows = (database: DatabaseSync, now: () => number = Date.now) => ({
  // Reading a row marks it read, so the refresh job keeps only rows someone still opens.
  read(key: string): { row: StoredRow; fetchedAt: number } | undefined {
    const found = database.prepare('SELECT json, fetched_at FROM discover_rows WHERE key = ?').get(key);
    if (found === undefined) return undefined;
    database.prepare('UPDATE discover_rows SET read_at = ? WHERE key = ?').run(now(), key);
    return { row: JSON.parse(String(found.json)) as StoredRow, fetchedAt: Number(found.fetched_at) };
  },
  // Whether a row is saved, without marking it read.
  has(key: string) {
    return database.prepare('SELECT 1 FROM discover_rows WHERE key = ?').get(key) !== undefined;
  },
  // `at` may be backdated so the row counts as stale; a new row is marked read now either way.
  save(key: string, row: StoredRow, at: number) {
    database.prepare(`INSERT INTO discover_rows (key, json, fetched_at, read_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`).run(key, JSON.stringify(row), at, now());
  },
  list(): Array<{ key: string; fetchedAt: number; readAt: number }> {
    return database.prepare('SELECT key, fetched_at, read_at FROM discover_rows').all()
      .map((row) => ({ key: String(row.key), fetchedAt: Number(row.fetched_at), readAt: Number(row.read_at) }));
  },
  remove(key: string) {
    database.prepare('DELETE FROM discover_rows WHERE key = ?').run(key);
  },
});

export type Rows = ReturnType<typeof createRows>;

// The image route serves TMDB files by size name; these two sizes are the agreed ones.
const image = (size: string, path: string | null) => (path === null ? null : `/api/images/tmdb/${size}/${path.replace(/^\//, '')}`);

export const present = (items: StoredItem[], database: DatabaseSync): DiscoverResult[] => {
  const owned = {
    movie: libraryIdsByTmdbId(database, 'radarr', items.flatMap((item) => (item.type === 'movie' ? [item.tmdbId] : []))),
    tv: libraryIdsByTmdbId(database, 'sonarr', items.flatMap((item) => (item.type === 'tv' ? [item.tmdbId] : []))),
  };
  return items.map((item) => ({
    tmdbId: item.tmdbId,
    type: item.type,
    title: item.title,
    year: item.year,
    date: item.date,
    posterUrl: image('w342', item.posterPath),
    backdropUrl: image('w1920_and_h800_multi_faces', item.backdropPath),
    rating: item.rating,
    genres: item.genres,
    overview: item.overview,
    libraryId: owned[item.type].get(item.tmdbId) ?? null,
  }));
};
