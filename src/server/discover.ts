import { Hono } from 'hono';
import type { Result } from './services/arr/result.js';
import type { createTmdb, TmdbDiscoverParams, TmdbListItem, TmdbMediaType, TmdbPage } from './services/tmdb.js';
import type { LibraryTitle } from './library.js';
import type { TitleRef, TitleStore } from './titleStore.js';

type Tmdb = Pick<ReturnType<typeof createTmdb>, 'discover' | 'trending' | 'genres' | 'providers'>;

export type DiscoverResult = {
  tmdbId: number;
  type: TmdbMediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  overview: string | null;
  libraryId: number | null;
};

// Popular, rating and newest are plain TMDB sorts; upcoming also keeps only titles released from today on.
const sorts = {
  popular: { movie: 'popularity.desc', tv: 'popularity.desc' },
  rating: { movie: 'vote_average.desc', tv: 'vote_average.desc' },
  newest: { movie: 'primary_release_date.desc', tv: 'first_air_date.desc' },
  upcoming: { movie: 'primary_release_date.asc', tv: 'first_air_date.asc' },
} as const;
type Sort = keyof typeof sorts;

type DiscoverQuery = {
  page: number;
  sort: Sort;
  genres: number[];
  providers: number[];
  region: string;
  yearFrom: number | null;
  yearTo: number | null;
  minRating: number | null;
};

// The image route serves TMDB files by size name; these two sizes are the agreed ones.
const image = (size: string, path: string | null) => (path === null ? null : `/api/images/tmdb/${size}/${path.replace(/^\//, '')}`);
const firstSentence = (text: string | null) => (text === null ? null : text.split(/(?<=[.!?])\s/, 1)[0]);

const pageNumber = (value: string | undefined) => {
  if (value === undefined) return 1;
  return /^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= 500 ? Number(value) : undefined;
};
const idList = (value: string | undefined) => {
  if (value === undefined || value === '') return [];
  const parts = value.split(',');
  return parts.length <= 20 && parts.every((part) => /^\d{1,9}$/.test(part)) ? parts.map(Number) : undefined;
};
const region = (value: string | undefined) => (value === undefined ? 'US' : /^[A-Z]{2}$/.test(value) ? value : undefined);
const year = (value: string | undefined) => {
  if (value === undefined) return null;
  return /^\d{4}$/.test(value) && Number(value) >= 1870 && Number(value) <= 2200 ? Number(value) : undefined;
};

// Every value is checked here, so nothing the browser sends reaches TMDB unchecked.
const parseDiscoverQuery = (query: Record<string, string | undefined>): DiscoverQuery | undefined => {
  const page = pageNumber(query.page);
  const sort = query.sort ?? 'popular';
  const genres = idList(query.genres);
  const providers = idList(query.providers);
  const regionCode = region(query.region);
  const yearFrom = year(query.yearFrom);
  const yearTo = year(query.yearTo);
  const minRating = query.minRating === undefined ? null
    : /^\d{1,2}(\.\d)?$/.test(query.minRating) && Number(query.minRating) <= 10 ? Number(query.minRating) : undefined;
  if (page === undefined || !Object.hasOwn(sorts, sort) || genres === undefined || providers === undefined || regionCode === undefined
    || yearFrom === undefined || yearTo === undefined || minRating === undefined) return undefined;
  if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) return undefined;
  return { page, sort: sort as Sort, genres, providers, region: regionCode, yearFrom, yearTo, minRating };
};

const today = (now: number) => new Date(now).toISOString().slice(0, 10);

const discoverParams = (type: TmdbMediaType, query: DiscoverQuery, now: number): TmdbDiscoverParams => {
  const dateField = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  let from = query.yearFrom === null ? undefined : `${query.yearFrom}-01-01`;
  if (query.sort === 'upcoming' && (from === undefined || from < today(now))) from = today(now);
  return {
    page: query.page,
    sort_by: sorts[query.sort][type],
    with_genres: query.genres.length === 0 ? undefined : query.genres.join(','),
    // Any one of the chosen services is enough, so they are joined with TMDB's "or".
    with_watch_providers: query.providers.length === 0 ? undefined : query.providers.join('|'),
    watch_region: query.region,
    [`${dateField}.gte`]: from,
    [`${dateField}.lte`]: query.yearTo === null ? undefined : `${query.yearTo}-12-31`,
    'vote_average.gte': query.minRating ?? undefined,
    // A rating sort without a vote floor fills the page with titles rated by one person.
    'vote_count.gte': query.sort === 'rating' ? 200 : undefined,
  };
};

export const createDiscover = (options: {
  tmdb: Tmdb;
  store: TitleStore;
  libraryTitles: () => Promise<{ titles: LibraryTitle[] }>;
  now?: () => number;
}) => {
  const { tmdb, store } = options;
  const now = options.now ?? Date.now;

  const results = async (page: TmdbPage) => {
    // A library that cannot be read leaves every library id empty rather than failing the list.
    // razor: reads the whole Sonarr and Radarr lists on every page; switch to the saved title cache if that shows up as slow.
    const library = await options.libraryTitles().catch(() => ({ titles: [] }));
    const owned = new Map(library.titles.flatMap((title) => (title.tmdbId === null ? [] : [[`${title.type}:${title.tmdbId}`, title.id] as const])));
    return page.results.flatMap((item: TmdbListItem): DiscoverResult[] => {
      if (item.mediaType === null || item.title === null) return [];
      const type = item.mediaType;
      const summary = {
        title: item.title,
        year: item.date === null ? null : Number(item.date.slice(0, 4)) || null,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        rating: item.voteAverage,
        overview: item.overview,
        genreIds: item.genreIds,
      };
      store.put({ type, tmdbId: item.id } as TitleRef, 'tmdbSummary', summary);
      return [{
        tmdbId: item.id,
        type,
        title: summary.title,
        year: summary.year,
        posterUrl: image('w342', item.posterPath),
        backdropUrl: image('w1920_and_h800_multi_faces', item.backdropPath),
        rating: item.voteAverage,
        overview: firstSentence(item.overview),
        libraryId: owned.get(`${type}:${item.id}`) ?? null,
      }];
    });
  };

  const list = async (result: Result<TmdbPage>): Promise<Result<{ page: number; totalPages: number; results: DiscoverResult[] }>> => (
    result.kind === 'ok'
      ? { kind: 'ok', value: { page: result.value.page, totalPages: result.value.totalPages, results: await results(result.value) } }
      : result
  );

  return {
    discover: async (type: TmdbMediaType, query: DiscoverQuery) => list(await tmdb.discover(type, discoverParams(type, query, now()))),
    trending: async (page: number) => list(await tmdb.trending('all', 'week', page)),
    genres: tmdb.genres,
    providers: tmdb.providers,
  };
};

export type Discover = ReturnType<typeof createDiscover>;

export const createDiscoverRoutes = (discover: Discover) => {
  const routes = new Hono();
  const invalid = { error: 'invalid_request' };
  const mediaType = (value: string) => (value === 'movie' || value === 'tv' ? value : undefined);
  // TMDB missing or down becomes JSON the screen can show, never an unhandled error.
  const reply = <T>(context: { json: (body: unknown, status?: 200 | 502 | 503) => Response }, result: Result<T>) => (
    result.kind === 'ok'
      ? context.json(result.value)
      : context.json({ error: result.kind, reason: result.message }, result.kind === 'not_configured' ? 503 : 502)
  );

  routes.get('/trending', async (context) => {
    const page = pageNumber(context.req.query('page'));
    if (page === undefined) return context.json(invalid, 400);
    return reply(context, await discover.trending(page));
  });
  routes.get('/genres/:type', async (context) => {
    const type = mediaType(context.req.param('type'));
    if (type === undefined) return context.json(invalid, 400);
    const result = await discover.genres(type);
    return reply(context, result.kind === 'ok' ? { kind: 'ok', value: { genres: result.value } } : result);
  });
  routes.get('/providers/:type', async (context) => {
    const type = mediaType(context.req.param('type'));
    const code = region(context.req.query('region'));
    if (type === undefined || code === undefined) return context.json(invalid, 400);
    const result = await discover.providers(type, code);
    return reply(context, result.kind === 'ok' ? { kind: 'ok', value: { providers: result.value } } : result);
  });
  routes.get('/:type', async (context) => {
    const type = mediaType(context.req.param('type'));
    const query = parseDiscoverQuery(context.req.query());
    if (type === undefined || query === undefined) return context.json(invalid, 400);
    return reply(context, await discover.discover(type, query));
  });
  return routes;
};
