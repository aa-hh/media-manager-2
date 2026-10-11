import { Hono } from 'hono';
import type { ArrServices, Image, Movie, Result, Series } from './services/arr.js';

export type SearchQuery =
  | { kind: 'name'; term: string }
  | { kind: 'imdb'; id: string }
  | { kind: 'tmdb'; id: string }
  | { kind: 'tvdb'; id: string };

export type SearchResult = {
  type: 'tv' | 'movie';
  service: 'sonarr' | 'radarr';
  key: string;
  title: string;
  year: number | null;
  network: string | null;
  status: string | null;
  rating: number | null;
  overview: string | null;
  posterUrl: string | null;
  inLibrary: boolean;
  libraryId: number | null;
  tvdbId: number | null;
  tmdbId: number | null;
  imdbId: string | null;
};

export type ServiceOutcome =
  | { kind: 'ok'; count: number }
  | { kind: 'skipped' }
  | { kind: 'not_configured' }
  | { kind: 'unreachable' }
  | { kind: 'rejected' };

export type SearchResponse = {
  results: SearchResult[];
  services: { sonarr: ServiceOutcome; radarr: ServiceOutcome };
};

const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS_PER_SERVICE = 20;

const positiveInteger = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
);

export const parseSearchQuery = (input: string): SearchQuery | undefined => {
  const term = input.trim().replace(/\s+/g, ' ');
  if (term === '' || term.length > MAX_QUERY_LENGTH) return undefined;
  const imdb = /^(?:imdb:\s*)?(tt\d{5,10})$/i.exec(term);
  if (imdb) return { kind: 'imdb', id: imdb[1].toLowerCase() };
  const prefixed = /^(tmdb|tvdb):\s*(\d{1,10})$/i.exec(term);
  if (prefixed) return { kind: prefixed[1].toLowerCase() as 'tmdb' | 'tvdb', id: String(Number(prefixed[2])) };
  return { kind: 'name', term };
};

// Lookup images carry a public remoteUrl and a local url; the local one is served by the
// service itself and needs its key, so only an absolute http(s) remoteUrl may reach the browser.
const posterUrl = (images: Image[]): string | null => {
  for (const image of images) {
    if (image.coverType !== 'poster') continue;
    const url = image.remoteUrl;
    if (url === null) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    } catch {
      continue;
    }
  }
  return null;
};

const toSeries = (record: Series): SearchResult | undefined => {
  const { title, tvdbId, id: libraryId } = record;
  if (title === '' || tvdbId === null) return undefined;
  return {
    type: 'tv',
    service: 'sonarr',
    key: `tvdb:${tvdbId}`,
    title,
    year: positiveInteger(record.year),
    network: record.network,
    status: record.status,
    rating: record.rating,
    overview: record.overview,
    posterUrl: posterUrl(record.images),
    inLibrary: libraryId !== null,
    libraryId,
    tvdbId,
    tmdbId: record.tmdbId,
    imdbId: record.imdbId,
  };
};

const toMovie = (record: Movie): SearchResult | undefined => {
  const { title, tmdbId, id: libraryId } = record;
  if (title === '' || tmdbId === null) return undefined;
  return {
    type: 'movie',
    service: 'radarr',
    key: `tmdb:${tmdbId}`,
    title,
    year: positiveInteger(record.year),
    network: record.studio,
    status: record.status,
    rating: record.rating,
    overview: record.overview,
    posterUrl: posterUrl(record.images),
    inLibrary: libraryId !== null,
    libraryId,
    tvdbId: null,
    tmdbId,
    imdbId: record.imdbId,
  };
};

const lookupTerm = (query: SearchQuery, service: 'sonarr' | 'radarr'): string | undefined => {
  if (query.kind === 'name') return query.term;
  if (query.kind === 'imdb') return `imdb:${query.id}`;
  if (query.kind === 'tvdb') return service === 'sonarr' ? `tvdb:${query.id}` : undefined;
  return service === 'radarr' ? `tmdb:${query.id}` : undefined;
};

const lookup = async <T>(
  term: string | undefined,
  read: (term: string) => Promise<Result<T[]>>,
  normalize: (record: T) => SearchResult | undefined,
): Promise<{ outcome: ServiceOutcome; results: SearchResult[] }> => {
  if (term === undefined) return { outcome: { kind: 'skipped' }, results: [] };
  const response = await read(term);
  if (response.kind === 'not_configured' || response.kind === 'unreachable' || response.kind === 'rejected') {
    return { outcome: { kind: response.kind }, results: [] };
  }
  // A non-2xx answer or a body that is not a list reads as unreachable, as it did before the adapter.
  if (response.kind !== 'ok') return { outcome: { kind: 'unreachable' }, results: [] };
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const item of response.value) {
    const result = normalize(item);
    if (result === undefined || seen.has(result.key)) continue;
    seen.add(result.key);
    results.push(result);
    if (results.length === MAX_RESULTS_PER_SERVICE) break;
  }
  return { outcome: { kind: 'ok', count: results.length }, results };
};

// Each service ranks its own results; interleaving by rank keeps both services' best
// matches near the top, and library matches go first without disturbing that order.
const merge = (shows: SearchResult[], movies: SearchResult[]) => {
  const interleaved: SearchResult[] = [];
  for (let index = 0; index < Math.max(shows.length, movies.length); index += 1) {
    if (index < shows.length) interleaved.push(shows[index]);
    if (index < movies.length) interleaved.push(movies[index]);
  }
  return [...interleaved.filter((result) => result.inLibrary), ...interleaved.filter((result) => !result.inLibrary)];
};

export const LOOKUP_CACHE_MS = 10 * 60_000;

export const createSearch = (services: ArrServices, options: { now?: () => number } = {}) => {
  const now = options.now ?? Date.now;
  // razor: no size cap beyond purging stale entries after each successful lookup. Upgrade path: an LRU bound on entries.
  const cache = new Map<string, { fetchedAt: number; results: SearchResult[]; count: number }>();

  const cachedLookup = async <T>(
    service: 'sonarr' | 'radarr',
    term: string | undefined,
    read: (term: string) => Promise<Result<T[]>>,
    normalize: (record: T) => SearchResult | undefined,
  ): Promise<{ outcome: ServiceOutcome; results: SearchResult[] }> => {
    const key = `${service}\n${term}`;
    if (term !== undefined && services[service].configured()) {
      const entry = cache.get(key);
      if (entry !== undefined && now() - entry.fetchedAt < LOOKUP_CACHE_MS) {
        return { outcome: { kind: 'ok', count: entry.count }, results: entry.results };
      }
    }
    const result = await lookup(term, read, normalize);
    if (result.outcome.kind === 'ok') {
      const fetchedAt = now();
      cache.set(key, { fetchedAt, results: result.results, count: result.outcome.count });
      for (const [stored, entry] of cache) if (fetchedAt - entry.fetchedAt >= LOOKUP_CACHE_MS) cache.delete(stored);
    }
    return result;
  };

  return {
    // An add changes which titles that service has, so its cached lookups would still offer Add.
    forget(service: 'sonarr' | 'radarr') {
      for (const key of cache.keys()) if (key.startsWith(`${service}\n`)) cache.delete(key);
    },
    async search(query: SearchQuery): Promise<SearchResponse> {
      const [sonarr, radarr] = await Promise.all([
        cachedLookup('sonarr', lookupTerm(query, 'sonarr'), services.sonarr.lookupSeries, toSeries),
        cachedLookup('radarr', lookupTerm(query, 'radarr'), services.radarr.lookupMovies, toMovie),
      ]);
      return {
        results: merge(sonarr.results, radarr.results),
        services: { sonarr: sonarr.outcome, radarr: radarr.outcome },
      };
    },
  };
};

export type Search = ReturnType<typeof createSearch>;

export const createSearchRoutes = (search: Search) => {
  const routes = new Hono();
  routes.get('/', async (context) => {
    const values = context.req.queries('q') ?? [];
    const query = values.length === 1 ? parseSearchQuery(values[0]) : undefined;
    if (query === undefined) return context.json({ error: 'invalid_query' }, 400);
    return context.json(await search.search(query));
  });
  routes.all('/', (context) => context.json({ error: 'method_not_allowed' }, 405));
  return routes;
};
