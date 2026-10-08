import { Hono } from 'hono';

type ArrRequest = (path: string) => Promise<{ status: number; body: unknown }>;
type ArrService = { request: ArrRequest; configured: () => boolean };

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

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const positiveInteger = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
);
const finiteNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

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
const posterUrl = (images: unknown): string | null => {
  if (!Array.isArray(images)) return null;
  for (const image of images) {
    if (!isRecord(image) || image.coverType !== 'poster') continue;
    const url = text(image.remoteUrl);
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

const firstRating = (ratings: unknown, keys: string[]): number | null => {
  if (!isRecord(ratings)) return null;
  if (finiteNumber(ratings.value) !== null) return finiteNumber(ratings.value);
  for (const key of keys) {
    const rating = ratings[key];
    if (isRecord(rating) && finiteNumber(rating.value) !== null && (rating.value as number) > 0) return rating.value as number;
  }
  return null;
};

const toSeries = (value: unknown): SearchResult | undefined => {
  if (!isRecord(value)) return undefined;
  const title = text(value.title);
  const tvdbId = positiveInteger(value.tvdbId);
  if (title === null || tvdbId === null) return undefined;
  const libraryId = positiveInteger(value.id);
  return {
    type: 'tv',
    service: 'sonarr',
    key: `tvdb:${tvdbId}`,
    title,
    year: positiveInteger(value.year),
    network: text(value.network),
    status: text(value.status),
    rating: firstRating(value.ratings, []),
    overview: text(value.overview),
    posterUrl: posterUrl(value.images),
    inLibrary: libraryId !== null,
    libraryId,
    tvdbId,
    tmdbId: positiveInteger(value.tmdbId),
    imdbId: text(value.imdbId),
  };
};

const toMovie = (value: unknown): SearchResult | undefined => {
  if (!isRecord(value)) return undefined;
  const title = text(value.title);
  const tmdbId = positiveInteger(value.tmdbId);
  if (title === null || tmdbId === null) return undefined;
  const libraryId = positiveInteger(value.id);
  return {
    type: 'movie',
    service: 'radarr',
    key: `tmdb:${tmdbId}`,
    title,
    year: positiveInteger(value.year),
    network: text(value.studio),
    status: text(value.status),
    rating: firstRating(value.ratings, ['tmdb', 'imdb', 'trakt']),
    overview: text(value.overview),
    posterUrl: posterUrl(value.images),
    inLibrary: libraryId !== null,
    libraryId,
    tvdbId: null,
    tmdbId,
    imdbId: text(value.imdbId),
  };
};

const lookupTerm = (query: SearchQuery, service: 'sonarr' | 'radarr'): string | undefined => {
  if (query.kind === 'name') return query.term;
  if (query.kind === 'imdb') return `imdb:${query.id}`;
  if (query.kind === 'tvdb') return service === 'sonarr' ? `tvdb:${query.id}` : undefined;
  return service === 'radarr' ? `tmdb:${query.id}` : undefined;
};

const lookup = async (
  service: ArrService,
  path: string,
  term: string | undefined,
  normalize: (value: unknown) => SearchResult | undefined,
): Promise<{ outcome: ServiceOutcome; results: SearchResult[] }> => {
  if (term === undefined) return { outcome: { kind: 'skipped' }, results: [] };
  if (!service.configured()) return { outcome: { kind: 'not_configured' }, results: [] };
  let response: { status: number; body: unknown };
  try {
    response = await service.request(`${path}?term=${encodeURIComponent(term)}`);
  } catch {
    return { outcome: { kind: 'unreachable' }, results: [] };
  }
  if (response.status === 401 || response.status === 403) return { outcome: { kind: 'rejected' }, results: [] };
  if (response.status < 200 || response.status > 299 || !Array.isArray(response.body)) {
    return { outcome: { kind: 'unreachable' }, results: [] };
  }
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const item of response.body) {
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

export const createSearch = (services: { sonarr: ArrService; radarr: ArrService }) => ({
  async search(query: SearchQuery): Promise<SearchResponse> {
    const [sonarr, radarr] = await Promise.all([
      lookup(services.sonarr, '/api/v3/series/lookup', lookupTerm(query, 'sonarr'), toSeries),
      lookup(services.radarr, '/api/v3/movie/lookup', lookupTerm(query, 'radarr'), toMovie),
    ]);
    return {
      results: merge(sonarr.results, radarr.results),
      services: { sonarr: sonarr.outcome, radarr: radarr.outcome },
    };
  },
});

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
