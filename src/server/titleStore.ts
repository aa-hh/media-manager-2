import type { DatabaseSync } from 'node:sqlite';
import type { Result } from './services/arr.js';

// A show is saved under its TVDB id; its TMDB id, when a source knows it, is kept beside it.
export type Title = { type: 'movie'; tmdbId: number } | { type: 'tv'; tvdbId: number; tmdbId?: number | null };
// Either id finds a show.
export type TitleRef = Title | { type: 'tv'; tmdbId: number };

export const createTitleStore = (database: DatabaseSync, options: { now?: () => number } = {}) => {
  const now = options.now ?? Date.now;
  const inFlight = new Map<string, Promise<Result<unknown>>>();

  const keyOf = (title: TitleRef): string | undefined => {
    if (title.type === 'movie') return `movie:${title.tmdbId}`;
    if ('tvdbId' in title) return `tv:${title.tvdbId}`;
    // razor: a show first saved by TMDB id keeps its own row once a TVDB-keyed row appears; the TVDB row wins here. Merge the two rows if a reader needs both.
    const row = database.prepare("SELECT key FROM title_store WHERE type = 'tv' AND tmdb_id = ? ORDER BY tvdb_id IS NULL LIMIT 1").get(title.tmdbId);
    return row === undefined ? undefined : String(row.key);
  };

  const get = <T>(title: TitleRef, part: string): { value: T; fetchedAt: number } | undefined => {
    const key = keyOf(title);
    if (key === undefined) return undefined;
    const row = database.prepare('SELECT json, fetched_at FROM title_store_parts WHERE key = ? AND part = ?').get(key, part);
    return row === undefined ? undefined : { value: JSON.parse(String(row.json)) as T, fetchedAt: Number(row.fetched_at) };
  };

  // A show known only by its TMDB id gets a row of its own until a source names its TVDB id.
  const put = (title: TitleRef, part: string, value: unknown) => {
    const tvdbId = 'tvdbId' in title ? title.tvdbId : null;
    const key = keyOf(title) ?? `tv-tmdb:${title.tmdbId}`;
    database.prepare(`INSERT INTO title_store (key, type, tmdb_id, tvdb_id) VALUES (?, ?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET tmdb_id = COALESCE(excluded.tmdb_id, tmdb_id)`).run(key, title.type, title.tmdbId ?? null, tvdbId);
    database.prepare(`INSERT INTO title_store_parts (key, part, json, fetched_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (key, part) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`).run(key, part, JSON.stringify(value), now());
  };

  return {
    now,
    get,
    put,
    // Only a successful load is saved; two callers asking for the same missing part share one load.
    fetch<T>(title: Title, part: string, maxAgeMs: number, load: () => Promise<Result<T>>): Promise<Result<T>> {
      const stored = get<T>(title, part);
      if (stored !== undefined && now() - stored.fetchedAt < maxAgeMs) return Promise.resolve({ kind: 'ok', value: stored.value });
      const flight = `${keyOf(title)}\n${part}`;
      const running = inFlight.get(flight);
      if (running !== undefined) return running as Promise<Result<T>>;
      const loading = load()
        .then((result) => {
          if (result.kind === 'ok') put(title, part, result.value);
          return result;
        })
        .finally(() => inFlight.delete(flight));
      inFlight.set(flight, loading);
      return loading;
    },
    forget(part: string) {
      database.prepare('DELETE FROM title_store_parts WHERE part = ?').run(part);
    },
  };
};

export type TitleStore = ReturnType<typeof createTitleStore>;
