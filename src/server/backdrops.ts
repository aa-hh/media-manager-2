import type { DatabaseSync } from 'node:sqlite';
import { getPreference } from './preferences.js';
import type { Result } from './services/arr/result.js';
import type { Fanart } from './services/fanart.js';
import type { Trakt } from './services/trakt.js';
import type { Title, TitleStore } from './titleStore.js';
import type { TmdbTitles } from './tmdbTitles.js';

const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
export const BACKDROP_SOURCES = ['tmdb', 'trakt', 'fanart'] as const;
export const BACKDROP_SOURCE_KEY = 'backdrop.source';

// Answers from the saved copy; a missing or old one loads in the background, so the page never waits on the source.
const saved = (store: TitleStore, title: Title, part: string, load: () => Promise<Result<string | null>>) => {
  void store.fetch(title, part, MAX_AGE_MS, async () => {
    const result = await load();
    return result.kind === 'ok' ? { kind: 'ok' as const, value: { url: result.value } } : result;
  }).catch(() => undefined);
  return store.get<{ url: string | null }>(title, part)?.value.url ?? null;
};

const storeTitle = (type: 'tv' | 'movie', ids: { tmdbId: number | null; tvdbId: number | null }): Title | undefined => {
  const { tmdbId, tvdbId } = ids;
  return type === 'movie'
    ? (tmdbId === null ? undefined : { type, tmdbId })
    : (tvdbId === null ? undefined : { type, tvdbId, tmdbId });
};

// Which source the title page backdrop comes from is the owner's choice while comparing them; TMDB unless set.
// razor: Trakt and fanart.tv pictures are linked straight from their servers for the comparison. Copy them through
// /api/images like TMDB's if one becomes the source for good; Trakt's terms ask for copies.
// Null means the chosen source has no picture, so the page keeps the Sonarr or Radarr fanart. heroBackdropUrl is the
// plain 16:9 size only TV Home reads; Trakt and fanart.tv give one picture, so it is the same address.
export const createBackdrops = (options: {
  database: DatabaseSync;
  store: TitleStore;
  tmdbTitles: Pick<TmdbTitles, 'backdropPath'>;
  trakt: Pick<Trakt, 'fanart'>;
  fanart: Pick<Fanart, 'background'>;
}) => {
  const { database, store, tmdbTitles, trakt, fanart } = options;
  const same = (url: string | null) => ({ backdropUrl: url, heroBackdropUrl: url });

  return async (
    type: 'tv' | 'movie',
    ids: { tmdbId: number | null; tvdbId: number | null },
  ): Promise<{ backdropUrl: string | null; heroBackdropUrl: string | null }> => {
    const { tmdbId, tvdbId } = ids;
    const source = getPreference(database, BACKDROP_SOURCE_KEY);
    const title = storeTitle(type, ids);
    if (source === 'trakt') return same(title === undefined || tmdbId === null ? null : saved(store, title, 'traktBackdrop', () => trakt.fanart(type, tmdbId)));
    if (source === 'fanart') {
      const id = type === 'movie' ? tmdbId : tvdbId;
      return same(title === undefined || id === null ? null : saved(store, title, 'fanartBackdrop', () => fanart.background(type, id)));
    }
    const path = tmdbId === null ? null : await tmdbTitles.backdropPath(type, tmdbId);
    if (path === null) return same(null);
    const file = path.replace(/^\//, '');
    return { backdropUrl: `/api/images/tmdb/w1920_and_h800_multi_faces/${file}`, heroBackdropUrl: `/api/images/tmdb/w1280/${file}` };
  };
};

// The title logo for TV Home: Plex's first, TMDB's second. Neither load is waited for; a title with no saved copy gets
// null now and the logo on a later read.
export const createLogos = (options: {
  store: TitleStore;
  tmdbTitles: Pick<TmdbTitles, 'logoPath'>;
  plex: { clearLogo: (ratingKey: string) => Promise<{ kind: 'off' } | { kind: 'not_found' } | { kind: 'ok' }> };
}) => {
  const { store, tmdbTitles, plex } = options;
  return async (
    type: 'tv' | 'movie',
    ids: { tmdbId: number | null; tvdbId: number | null },
    ratingKey: string | null,
  ): Promise<string | null> => {
    const title = storeTitle(type, ids);
    const fromPlex = ratingKey === null || title === undefined ? null : saved(store, title, 'plexLogo', async () => {
      try {
        const found = await plex.clearLogo(ratingKey);
        return { kind: 'ok' as const, value: found.kind === 'ok' ? `/api/images/plex/logo/${ratingKey}` : null };
      } catch (error) {
        return { kind: 'unreachable' as const, message: error instanceof Error ? error.message : 'Plex is unreachable.' };
      }
    });
    if (fromPlex !== null) return fromPlex;
    const path = ids.tmdbId === null ? null : await tmdbTitles.logoPath(type, ids.tmdbId);
    return path === null ? null : `/api/images/tmdb/w500/${path.replace(/^\//, '')}`;
  };
};
