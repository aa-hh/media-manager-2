import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { imageUrl } from './library.js';
import { getPreference } from './preferences.js';
import type { Movie, Series } from './services/arr.js';
import type { Result } from './services/arr/result.js';
import type { Fanart } from './services/fanart.js';
import type { Trakt } from './services/trakt.js';
import { readTitle } from './titles.js';
import type { Title, TitleStore } from './titleStore.js';
import type { TmdbTitles } from './tmdbTitles.js';
import type { WatchStatus } from './watchStatus.js';

const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const MAX_LOADS = 4;
const MAX_HERO_KEYS = 300;
const HERO_KEY = /^(sonarr|radarr|movie|tv):[1-9]\d{0,9}$/;
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

// At most MAX_LOADS of the loads it wraps run at once; a settled load hands its place to the next one waiting.
const createLimit = () => {
  let active = 0;
  const waiting: Array<() => void> = [];
  return <T>(load: () => Promise<T>) => async (): Promise<T> => {
    if (active < MAX_LOADS) active += 1;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await load();
    } finally {
      const next = waiting.shift();
      if (next === undefined) active -= 1;
      else next();
    }
  };
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
  const limit = createLimit();
  const same = (url: string | null) => ({ backdropUrl: url, heroBackdropUrl: url });

  return async (
    type: 'tv' | 'movie',
    ids: { tmdbId: number | null; tvdbId: number | null },
  ): Promise<{ backdropUrl: string | null; heroBackdropUrl: string | null }> => {
    const { tmdbId, tvdbId } = ids;
    const source = getPreference(database, BACKDROP_SOURCE_KEY);
    const title = storeTitle(type, ids);
    if (source === 'trakt') return same(title === undefined || tmdbId === null ? null : saved(store, title, 'traktBackdrop', limit(() => trakt.fanart(type, tmdbId))));
    if (source === 'fanart') {
      const id = type === 'movie' ? tmdbId : tvdbId;
      return same(title === undefined || id === null ? null : saved(store, title, 'fanartBackdrop', limit(() => fanart.background(type, id))));
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
  const limit = createLimit();
  return async (
    type: 'tv' | 'movie',
    ids: { tmdbId: number | null; tvdbId: number | null },
    ratingKey: string | null,
  ): Promise<string | null> => {
    const title = storeTitle(type, ids);
    const fromPlex = ratingKey === null || title === undefined ? null : saved(store, title, 'plexLogo', limit(async () => {
      try {
        const found = await plex.clearLogo(ratingKey);
        return { kind: 'ok' as const, value: found.kind === 'ok' ? `/api/images/plex/logo/${ratingKey}` : null };
      } catch (error) {
        return { kind: 'unreachable' as const, message: error instanceof Error ? error.message : 'Plex is unreachable.' };
      }
    }));
    if (fromPlex !== null) return fromPlex;
    const path = ids.tmdbId === null ? null : await tmdbTitles.logoPath(type, ids.tmdbId);
    return path === null ? null : `/api/images/tmdb/w500/${path.replace(/^\//, '')}`;
  };
};

export type HeroAnswer = {
  overview: string | null;
  genre: string | null;
  runtime: number | null;
  heroBackdropUrl: string | null;
  logoUrl: string | null;
  logo: 'ready' | 'none' | 'loading';
};

// The top of TV Home for every card in one call, from saved copies. A logo still loading starts its loads here, so
// the TV asks again for just those keys. Trakt cards (movie:/tv: by TMDB id) get the logo only.
export const createHeroes = (options: {
  database: DatabaseSync;
  store: TitleStore;
  tmdbTitles: Pick<TmdbTitles, 'logoKnown'>;
  backdrops: ReturnType<typeof createBackdrops>;
  logos: ReturnType<typeof createLogos>;
  watchStatus?: Pick<WatchStatus, 'forLibrary'>;
}) => {
  const { database, store, tmdbTitles, backdrops, logos, watchStatus } = options;
  const positive = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null);

  // Known means the saved copies already say whether there is a logo, so a null now is final.
  const logoOf = async (type: 'tv' | 'movie', ids: { tmdbId: number | null; tvdbId: number | null }, ratingKey: string | null) => {
    const title = storeTitle(type, ids);
    const plexKnown = ratingKey === null || title === undefined || store.get(title, 'plexLogo') !== undefined;
    const tmdbKnown = ids.tmdbId === null || tmdbTitles.logoKnown(type, ids.tmdbId);
    const logoUrl = await logos(type, ids, ratingKey);
    const logo: HeroAnswer['logo'] = logoUrl !== null ? 'ready' : plexKnown && tmdbKnown ? 'none' : 'loading';
    return { logoUrl, logo };
  };

  return async (keys: string[]): Promise<Record<string, HeroAnswer>> => {
    const unique = [...new Set(keys)];
    const library = unique.flatMap((key) => {
      const [kind, raw] = key.split(':');
      if (kind !== 'sonarr' && kind !== 'radarr') return [];
      const row = readTitle(database, kind, Number(raw));
      return row === undefined ? [] : [{ key, service: kind as 'sonarr' | 'radarr', record: row.detail }];
    });
    const watched = watchStatus === undefined || library.length === 0
      ? undefined
      : await watchStatus.forLibrary(library.map(({ service, record }) => ({ service, record: record as unknown as Series | Movie })));
    const records = new Map(library.map((entry) => [entry.key, entry]));

    const answers = await Promise.all(unique.map(async (key): Promise<[string, HeroAnswer] | undefined> => {
      const [kind, raw] = key.split(':');
      if (kind === 'movie' || kind === 'tv') {
        const { logoUrl, logo } = await logoOf(kind, { tmdbId: Number(raw), tvdbId: null }, null);
        return [key, { overview: null, genre: null, runtime: null, heroBackdropUrl: null, logoUrl, logo }];
      }
      const entry = records.get(key);
      if (entry === undefined) return undefined;
      const { record } = entry;
      const type = entry.service === 'sonarr' ? 'tv' : 'movie';
      const ids = { tmdbId: positive(record.tmdbId), tvdbId: type === 'tv' ? positive(record.tvdbId) : null };
      const ratingKey = watched?.byTitle.get(key)?.ratingKey ?? null;
      const [backdrop, { logoUrl, logo }] = await Promise.all([backdrops(type, ids), logoOf(type, ids, ratingKey)]);
      const genres = Array.isArray(record.genres) ? record.genres : [];
      return [key, {
        overview: typeof record.overview === 'string' && record.overview !== '' ? record.overview : null,
        genre: typeof genres[0] === 'string' ? genres[0] : null,
        runtime: typeof record.runtime === 'number' && record.runtime > 0 ? record.runtime : null,
        heroBackdropUrl: backdrop.heroBackdropUrl ?? imageUrl(record.images, 'fanart'),
        logoUrl,
        logo,
      }];
    }));
    return Object.fromEntries(answers.filter((answer) => answer !== undefined));
  };
};

export const createHeroRoutes = (heroes: ReturnType<typeof createHeroes>) => {
  const routes = new Hono();
  routes.get('/heroes', async (context) => {
    const items = context.req.query('items');
    const keys = items === undefined || items === '' ? [] : items.split(',');
    if (keys.length === 0 || keys.length > MAX_HERO_KEYS || !keys.every((key) => HERO_KEY.test(key))) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    return context.json({ heroes: await heroes(keys) });
  });
  return routes;
};
