import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { type ArrServices, type Image, type Movie, parseMovie, parseSeries, type Result, type Series } from './services/arr.js';
import type { Title, TitleStore } from './titleStore.js';
import { readTitle } from './titles.js';

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
  files: number | null;
  tvdbId: number | null;
  tmdbId: number | null;
  imdbId: string | null;
};

export type ServiceOutcome =
  | { kind: 'ok'; count: number }
  | { kind: 'pending' }
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

// A result row shows its poster 40 px wide, but lookups link the full image (up to 280 KB on TMDB); TMDB's 185 px
// size and TheTVDB's _t thumbnail are 8 to 40 KB.
const thumbnail = (url: URL) => {
  if (url.hostname === 'image.tmdb.org') url.pathname = url.pathname.replace(/^\/t\/p\/original\//, '/t/p/w185/');
  if (url.hostname === 'artworks.thetvdb.com') url.pathname = url.pathname.replace(/(?<!_t)(\.\w+)$/, '_t$1');
  return url.href;
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
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return thumbnail(parsed);
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
    files: null,
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
    files: null,
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

type Service = 'sonarr' | 'radarr';
type Found = { result: SearchResult; record: Record<string, unknown> };

export const LOOKUP_CACHE_MS = 10 * 60_000;

// Per service: the title store part its lookup records are saved under, the record's own id field, and the title
// a record is saved as.
const lookups = {
  sonarr: {
    part: 'sonarr-lookup',
    idField: 'tvdbId',
    title: (id: number, record?: Record<string, unknown>): Title => (
      { type: 'tv', tvdbId: id, tmdbId: typeof record?.tmdbId === 'number' ? record.tmdbId : null }
    ),
    normalize: (record: Record<string, unknown>) => {
      const parsed = parseSeries(record);
      return parsed === null ? undefined : toSeries(parsed);
    },
  },
  radarr: {
    part: 'radarr-lookup',
    idField: 'tmdbId',
    title: (id: number): Title => ({ type: 'movie', tmdbId: id }),
    normalize: (record: Record<string, unknown>) => {
      const parsed = parseMovie(record);
      return parsed === null ? undefined : toMovie(parsed);
    },
  },
} as const;

const read = (services: ArrServices, service: Service, term: string) => (
  service === 'sonarr' ? services.sonarr.lookupSeries(term) : services.radarr.lookupMovies(term)
);

// One title outside the library, as Sonarr's or Radarr's own lookup record; the title page and add both read it here.
export const lookupTitle = (services: ArrServices, store: TitleStore, service: Service, id: number) => {
  const { part, idField, title } = lookups[service];
  return store.fetch(title(id), part, LOOKUP_CACHE_MS, async (): Promise<Result<Record<string, unknown>>> => {
    const found = await read(services, service, `${service === 'sonarr' ? 'tvdb' : 'tmdb'}:${id}`);
    if (found.kind !== 'ok') return found;
    const match = found.value.find((record) => record[idField] === id);
    return match === undefined ? { kind: 'not_found', message: 'No such title.' } : { kind: 'ok', value: match };
  });
};

const lookup = async (
  services: ArrServices,
  service: Service,
  term: string | undefined,
): Promise<{ outcome: ServiceOutcome; found: Found[] }> => {
  if (term === undefined) return { outcome: { kind: 'skipped' }, found: [] };
  const response = await read(services, service, term);
  if (response.kind === 'not_configured' || response.kind === 'unreachable' || response.kind === 'rejected') {
    return { outcome: { kind: response.kind }, found: [] };
  }
  // A non-2xx answer or a body that is not a list reads as unreachable, as it did before the adapter.
  if (response.kind !== 'ok') return { outcome: { kind: 'unreachable' }, found: [] };
  const seen = new Set<string>();
  const found: Found[] = [];
  for (const record of response.value) {
    const result = lookups[service].normalize(record);
    if (result === undefined || seen.has(result.key)) continue;
    seen.add(result.key);
    found.push({ result, record });
    if (found.length === MAX_RESULTS_PER_SERVICE) break;
  }
  return { outcome: { kind: 'ok', count: found.length }, found };
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

const pending = { outcome: { kind: 'pending' } as const, results: [] };

// A search term keeps only the ids it returned; each title's record lives in the title store, where the title page
// and add reuse it. A term is answered from storage only while it and every one of its records are fresh.
export const createSearch = (database: DatabaseSync, services: ArrServices, store: TitleStore) => {
  const { now } = store;

  // Sonarr's lookup sends every series count as zero, and a stored lookup can be ten minutes old, so a library title's
  // file count comes from this app's own copy of the library, read at answer time. A Radarr movie has one file at most.
  const withFiles = (result: SearchResult): SearchResult => {
    const detail = result.libraryId === null ? undefined : readTitle(database, result.service, result.libraryId)?.detail;
    if (detail === undefined) return result;
    return { ...result, files: result.service === 'sonarr' ? (detail as Series).statistics.episodeFileCount : (detail as Movie).hasFile ? 1 : 0 };
  };

  const cachedLookup = async (service: Service, term: string | undefined): Promise<{ outcome: ServiceOutcome; results: SearchResult[] }> => {
    const { part, idField, title, normalize } = lookups[service];
    if (term !== undefined && services[service].configured()) {
      const row = database.prepare('SELECT ids, fetched_at FROM search_lookups WHERE service = ? AND term = ?').get(service, term);
      if (row !== undefined && now() - Number(row.fetched_at) < LOOKUP_CACHE_MS) {
        const stored = (JSON.parse(String(row.ids)) as number[]).map((id) => store.get<Record<string, unknown>>(title(id), part));
        if (stored.every((entry) => entry !== undefined && now() - entry.fetchedAt < LOOKUP_CACHE_MS)) {
          const results = stored.flatMap((entry) => (entry === undefined ? [] : normalize(entry.value) ?? []));
          return { outcome: { kind: 'ok', count: results.length }, results };
        }
      }
    }
    const { outcome, found } = await lookup(services, service, term);
    if (outcome.kind === 'ok' && term !== undefined) {
      const ids = found.map(({ record }) => record[idField] as number);
      found.forEach(({ record }, index) => store.put(title(ids[index], record), part, record));
      // razor: stale terms are purged on each write; titles' parts are kept. Upgrade path: purge old parts on a timer.
      database.prepare('DELETE FROM search_lookups WHERE fetched_at <= ?').run(now() - LOOKUP_CACHE_MS);
      database.prepare('INSERT OR REPLACE INTO search_lookups (service, term, ids, fetched_at) VALUES (?, ?, ?, ?)')
        .run(service, term, JSON.stringify(ids), now());
    }
    return { outcome, results: found.map(({ result }) => result) };
  };

  return {
    // An add or delete changes which titles that service has, so its stored lookups would show the old answer.
    forget(service: Service) {
      database.prepare('DELETE FROM search_lookups WHERE service = ?').run(service);
      store.forget(lookups[service].part);
    },
    // Sonarr often answers a second after Radarr, so the first service to answer with results is passed to onPartial,
    // merged with the other marked pending, before both are returned.
    async search(query: SearchQuery, onPartial?: (response: SearchResponse) => void): Promise<SearchResponse> {
      const answers: Partial<Record<Service, Awaited<ReturnType<typeof cachedLookup>>>> = {};
      const respond = (): SearchResponse => {
        const { sonarr = pending, radarr = pending } = answers;
        return { results: merge(sonarr.results, radarr.results), services: { sonarr: sonarr.outcome, radarr: radarr.outcome } };
      };
      await Promise.all((['sonarr', 'radarr'] as const).map(async (service) => {
        const found = await cachedLookup(service, lookupTerm(query, service));
        const answer = { ...found, results: found.results.map(withFiles) };
        answers[service] = answer;
        if ((answers.sonarr === undefined || answers.radarr === undefined) && answer.results.length > 0) onPartial?.(respond());
      }));
      return respond();
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
    // One line of JSON per answer: the first service's results as soon as they arrive, then both services'.
    context.header('Content-Type', 'application/x-ndjson');
    return stream(context, async (output) => {
      const response = await search.search(query, (partial) => void output.writeln(JSON.stringify(partial)));
      await output.writeln(JSON.stringify(response));
    });
  });
  routes.all('/', (context) => context.json({ error: 'method_not_allowed' }, 405));
  return routes;
};
