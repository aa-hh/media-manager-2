import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { Failure } from '../services/arr/result.js';
import type { Orchestrator } from './orchestrator.js';
import { EXTRA_ROWS, recipeById } from './recipes.js';
import { type DiscoverResult, type Filters, present, type Rows, rowKey, type RowSpec, type Sort, sorts, type StoredRow } from './rows.js';

export type Discover = { rows: Rows; database: DatabaseSync; orchestrator: Pick<Orchestrator, 'request'> };

type Row = { results: DiscoverResult[]; pending: boolean; failed: boolean; failure: Failure['kind'] | null };

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

// Every value is checked here, so nothing the browser sends reaches TMDB or Trakt unchecked.
const parseFilters = (query: Record<string, string | undefined>): Filters | undefined => {
  const genres = idList(query.genres);
  const providers = idList(query.providers);
  const regionCode = region(query.region);
  const yearFrom = year(query.yearFrom);
  const yearTo = year(query.yearTo);
  const minRating = query.minRating === undefined ? null
    : /^\d{1,2}(\.\d)?$/.test(query.minRating) && Number(query.minRating) <= 10 ? Number(query.minRating) : undefined;
  if (genres === undefined || providers === undefined || regionCode === undefined
    || yearFrom === undefined || yearTo === undefined || minRating === undefined) return undefined;
  if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) return undefined;
  return { genres, providers, region: regionCode, yearFrom, yearTo, minRating };
};

const parseDiscoverQuery = (query: Record<string, string | undefined>): { page: number; sort: Sort; filters: Filters } | undefined => {
  const page = pageNumber(query.page);
  const sort = query.sort ?? 'popular';
  const filters = parseFilters(query);
  if (page === undefined || !Object.hasOwn(sorts, sort) || filters === undefined) return undefined;
  return { page, sort: sort as Sort, filters };
};

const parseHomeQuery = (query: Record<string, string | undefined>) => {
  const type = query.type ?? 'all';
  const filters = parseFilters(query);
  const services = idList(query.services);
  if ((type !== 'all' && type !== 'movie' && type !== 'tv') || filters === undefined || services === undefined) return undefined;
  return { type, filters, services } as const;
};

export const createDiscoverRoutes = (discover: Discover) => {
  const { rows, database, orchestrator } = discover;
  const routes = new Hono();
  const invalid = { error: 'invalid_request' };
  const mediaType = (value: string) => (value === 'movie' || value === 'tv' ? value : undefined);
  // TMDB missing or down becomes JSON the screen can show, never an unhandled error.
  const reply = (context: { json: (body: unknown, status?: 200 | 502 | 503) => Response }, failure: Failure) => (
    context.json({ error: failure.kind, reason: failure.message }, failure.kind === 'not_configured' ? 503 : 502)
  );

  // Asks for every key at once, then reads what is saved; a key with a failure and nothing saved reads as an empty row marked failed.
  const load = async (specs: RowSpec[]) => {
    const keys = specs.map(rowKey);
    const answers = await Promise.all(keys.map((key) => orchestrator.request(key)));
    return keys.map((key, index) => ({ ...answers[index], saved: rows.read(key)?.row }));
  };
  const asRow = ({ pending, failure, saved }: { pending: boolean; failure?: Failure; saved?: StoredRow }): Row => {
    const failed = saved === undefined && failure !== undefined;
    return { results: saved === undefined ? [] : present(saved.items, database), pending, failed, failure: failed ? failure.kind : null };
  };
  const reference = async (context: Parameters<typeof reply>[0], spec: RowSpec, name: 'genres' | 'providers') => {
    const [answer] = await load([spec]);
    if (answer.saved === undefined && answer.failure !== undefined) return reply(context, answer.failure);
    return context.json({ [name]: answer.saved?.reference ?? [] });
  };
  const grid = async (context: Parameters<typeof reply>[0], spec: Extract<RowSpec, { kind: 'grid' }>) => {
    const [answer] = await load([spec]);
    if (answer.saved === undefined && answer.failure !== undefined) return reply(context, answer.failure);
    return context.json({ page: spec.page, totalPages: answer.saved?.totalPages ?? null, ...asRow(answer) });
  };

  // razor: the trending grid stays TMDB-only, so its order differs from the home's blended trending row; upgrade path is serving the home recipe per page.
  routes.get('/trending', async (context) => {
    const query = context.req.query();
    const type = query.type ?? 'all';
    const page = pageNumber(query.page);
    const filters = parseFilters(query);
    if ((type !== 'all' && type !== 'movie' && type !== 'tv') || page === undefined || filters === undefined) return context.json(invalid, 400);
    return grid(context, { kind: 'grid', type, sort: 'trending', page, filters });
  });
  routes.get('/genres/:type', async (context) => {
    const type = mediaType(context.req.param('type'));
    if (type === undefined) return context.json(invalid, 400);
    return reference(context, { kind: 'reference', name: 'genres', type, region: '' }, 'genres');
  });
  routes.get('/providers/:type', async (context) => {
    const type = mediaType(context.req.param('type'));
    const code = region(context.req.query('region'));
    if (type === undefined || code === undefined) return context.json(invalid, 400);
    return reference(context, { kind: 'reference', name: 'providers', type, region: code }, 'providers');
  });
  routes.get('/home', async (context) => {
    const query = parseHomeQuery(context.req.query());
    if (query === undefined) return context.json(invalid, 400);
    const { type, filters } = query;
    const shows = (rowType: 'movie' | 'tv') => type === 'all' || type === rowType;
    const row = (recipe: string, rowType: 'all' | 'movie' | 'tv'): RowSpec => ({ kind: 'row', recipe, type: rowType, filters });
    // A chosen service outside the providers filter would show titles that filter excludes, so it gets no row.
    const services = query.services.filter((id) => filters.providers.length === 0 || filters.providers.includes(id));
    const extras = EXTRA_ROWS.filter((id) => recipeById(id)?.sources.some((source) => type === 'all' || source.mediaType === type));
    const named = {
      trendingAll: type === 'all' ? row('trending', 'all') : undefined,
      trendingMovie: shows('movie') ? row('trending', 'movie') : undefined,
      trendingTv: shows('tv') ? row('trending', 'tv') : undefined,
      popularMovies: shows('movie') ? row('popular', 'movie') : undefined,
      popularTv: shows('tv') ? row('popular', 'tv') : undefined,
      days30: shows('movie') ? row('upcoming-movies-30', 'movie') : undefined,
      days90: shows('movie') ? row('upcoming-movies-90', 'movie') : undefined,
      upcomingTv: shows('tv') ? row('upcoming-tv', 'tv') : undefined,
    };
    const requested = Object.values(named).filter((spec): spec is RowSpec => spec !== undefined);
    const specs = [...requested, ...services.map((id) => row(`service:${id}`, type)), ...extras.map((id) => row(id, type))];
    const providersSpec: RowSpec = { kind: 'reference', name: 'providers', type: 'movie', region: filters.region };
    const [answers, providerList] = await Promise.all([
      load(specs),
      services.length === 0 ? Promise.resolve([]) : load([providersSpec]),
    ]);
    const failures = answers.flatMap((answer) => (answer.saved === undefined && answer.failure !== undefined ? [answer.failure] : []));
    if (answers.length > 0 && failures.length === answers.length) return reply(context, failures[0]);
    const byKey = new Map(specs.map((spec, index) => [rowKey(spec), asRow(answers[index])]));
    const empty: Row = { results: [], pending: false, failed: false, failure: null };
    const get = (spec: RowSpec | undefined) => (spec === undefined ? null : byKey.get(rowKey(spec)) ?? empty);
    const providerNames = (providerList[0]?.saved?.reference ?? []) as Array<{ id: number; name: string }>;
    return context.json({
      trending: { all: get(named.trendingAll) ?? empty, movie: get(named.trendingMovie) ?? empty, tv: get(named.trendingTv) ?? empty },
      popularMovies: get(named.popularMovies),
      popularTv: get(named.popularTv),
      upcomingMovies: shows('movie') ? { days30: get(named.days30), days90: get(named.days90) } : null,
      upcomingTv: get(named.upcomingTv),
      services: services.map((id) => ({
        providerId: id,
        name: providerNames.find((provider) => provider.id === id)?.name ?? null,
        ...(byKey.get(rowKey(row(`service:${id}`, type))) ?? empty),
      })),
      extraRows: extras.map((id) => ({ id, label: recipeById(id)?.label, ...(byKey.get(rowKey(row(id, type))) ?? empty) })),
    });
  });
  routes.get('/:type', async (context) => {
    const type = mediaType(context.req.param('type'));
    const query = parseDiscoverQuery(context.req.query());
    if (type === undefined || query === undefined) return context.json(invalid, 400);
    return grid(context, { kind: 'grid', type, ...query });
  });
  return routes;
};
