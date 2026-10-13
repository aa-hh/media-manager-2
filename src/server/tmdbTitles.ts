import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { Result } from './services/arr/result.js';
import type { createTmdb, TmdbDetails, TmdbMediaType } from './services/tmdb.js';
import type { Title, TitleStore } from './titleStore.js';
import { libraryIdsByTmdbId } from './titles.js';

const PART = 'tmdbDetails';
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const MAX_CAST = 10;
const MAX_SIMILAR = 20;

type Tmdb = Pick<ReturnType<typeof createTmdb>, 'details' | 'tvAiring' | 'collection'>;

export type SimilarTitle = {
  tmdbId: number;
  type: TmdbMediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  libraryId: number | null;
};
// Movies get similar titles only: their cast and keywords come from Radarr.
export type TmdbTitleData =
  | { cast: Array<{ name: string; character: string | null }>; keywords: string[]; similar: SimilarTitle[] }
  | { similar: SimilarTitle[] };

const posterUrl = (path: string | null | undefined) => (typeof path === 'string' && path !== '' ? `/api/images/tmdb/w342/${path.replace(/^\//, '')}` : null);
const yearOf = (date: string | null | undefined) => {
  const year = typeof date === 'string' ? Number.parseInt(date.slice(0, 4), 10) : Number.NaN;
  return Number.isNaN(year) ? null : year;
};

export const createTmdbTitles = (options: { database: DatabaseSync; tmdb: Tmdb; store: TitleStore }) => {
  const { database, tmdb, store } = options;
  const titleOf = (type: TmdbMediaType, tmdbId: number, tvdbId: number | null | undefined): Title | undefined => {
    if (type === 'movie') return { type, tmdbId };
    return typeof tvdbId === 'number' ? { type, tvdbId, tmdbId } : undefined;
  };

  // A saved copy is served at once; a stale one is refetched in the background for the next request.
  const details = async (type: TmdbMediaType, tmdbId: number): Promise<Result<Partial<TmdbDetails>>> => {
    const load = () => tmdb.details(type, tmdbId);
    // Both arms match: the ternary only narrows the type for TitleRef.
    const saved = store.get<Partial<TmdbDetails>>(type === 'movie' ? { type, tmdbId } : { type, tmdbId }, PART);
    if (saved !== undefined) {
      const title = titleOf(type, tmdbId, saved.value.tvdbId);
      if (title !== undefined && store.now() - saved.fetchedAt >= MAX_AGE_MS) {
        void store.fetch(title, PART, MAX_AGE_MS, load).catch(() => undefined);
      }
      return { kind: 'ok', value: saved.value };
    }
    const result = await load();
    if (result.kind !== 'ok') return result;
    // razor: a show TMDB knows no TVDB id for cannot be saved, so it is fetched on every visit.
    const title = titleOf(type, tmdbId, result.value.tvdbId);
    if (title !== undefined) store.put(title, PART, result.value);
    return result;
  };

  return {
    async title(type: TmdbMediaType, tmdbId: number): Promise<TmdbTitleData> {
      const result = await details(type, tmdbId);
      const found = result.kind === 'ok' ? result.value : undefined;
      const picks = (found?.recommendations ?? []).filter((item) => item.title !== null).slice(0, MAX_SIMILAR);
      const owned = {
        movie: libraryIdsByTmdbId(database, 'radarr', picks.filter((item) => (item.mediaType ?? type) === 'movie').map((item) => item.id)),
        tv: libraryIdsByTmdbId(database, 'sonarr', picks.filter((item) => (item.mediaType ?? type) === 'tv').map((item) => item.id)),
      };
      const similar = picks.map((item): SimilarTitle => {
        const itemType = item.mediaType ?? type;
        return {
          tmdbId: item.id,
          type: itemType,
          title: item.title as string,
          year: yearOf(item.date),
          posterUrl: posterUrl(item.posterPath),
          libraryId: owned[itemType].get(item.id) ?? null,
        };
      });
      if (type === 'movie') return { similar };
      return {
        cast: (found?.cast ?? []).slice(0, MAX_CAST).map(({ name, character }) => ({ name, character })),
        keywords: (found?.keywords ?? []).map((keyword) => keyword.name),
        similar,
      };
    },

    // A TMDB failure is passed on so it is not mistaken for a show TMDB has no TVDB id for.
    async tvdbIdOf(tmdbId: number): Promise<Result<number | null>> {
      const found = await details('tv', tmdbId);
      if (found.kind !== 'ok') return found;
      return { kind: 'ok', value: typeof found.value.tvdbId === 'number' ? found.value.tvdbId : null };
    },

    // A title with no saved details gets null now (the page keeps the fanart) and the load runs in the background, so waiting on TMDB never holds the page.
    async backdropPath(type: TmdbMediaType, tmdbId: number): Promise<string | null> {
      const saved = store.get<Partial<TmdbDetails>>(type === 'movie' ? { type, tmdbId } : { type, tmdbId }, PART);
      void details(type, tmdbId).catch(() => undefined);
      return saved?.value.backdropPath ?? null;
    },

    async airing(tmdbId: number): Promise<{ seasons: Array<{ seasonNumber: number; aired: number }> | null; nextAirDate: string | null }> {
      const result = await tmdb.tvAiring(tmdbId);
      return result.kind === 'ok' ? result.value : { seasons: null, nextAirDate: null };
    },

    async collectionSize(collectionTmdbId: number): Promise<{ collection: { films: number; allReleased: boolean } | null }> {
      const result = await tmdb.collection(collectionTmdbId);
      return { collection: result.kind === 'ok' ? result.value : null };
    },
  };
};

export type TmdbTitles = ReturnType<typeof createTmdbTitles>;

// TMDB being unset or down leaves the sections empty with a 200, so the Sonarr or Radarr page is unaffected.
export const createTmdbTitleRoutes = (titles: TmdbTitles) => {
  const routes = new Hono();
  const idOf = (raw: string) => (/^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null);
  // Registered before the generic route below, which would otherwise match these paths.
  routes.get('/tmdb/tv/:tmdbId/airing', async (context) => {
    const tmdbId = idOf(context.req.param('tmdbId'));
    if (tmdbId === null) return context.json({ error: 'invalid_request' }, 400);
    return context.json(await titles.airing(tmdbId));
  });
  routes.get('/tmdb/collection/:collectionTmdbId', async (context) => {
    const collectionTmdbId = idOf(context.req.param('collectionTmdbId'));
    if (collectionTmdbId === null) return context.json({ error: 'invalid_request' }, 400);
    return context.json(await titles.collectionSize(collectionTmdbId));
  });
  routes.get('/tmdb/:type/:tmdbId', async (context) => {
    const type = context.req.param('type');
    const tmdbId = idOf(context.req.param('tmdbId'));
    if ((type !== 'movie' && type !== 'tv') || tmdbId === null) return context.json({ error: 'invalid_request' }, 400);
    return context.json(await titles.title(type, tmdbId));
  });
  return routes;
};
