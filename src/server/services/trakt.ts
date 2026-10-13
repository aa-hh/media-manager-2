import type { DatabaseSync } from 'node:sqlite';
import { classify, isRecord, notConfigured, type Result, unreachable } from './arr/result.js';
import { type ConnectionStatus, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

const LABEL = 'Trakt';
const BASE_URL = 'https://api.trakt.tv';
// A public list needs only the Client ID, so one movie of it proves the ID works. Trakt answers 403 to an unknown ID.
const CHECK_URL = `${BASE_URL}/movies/trending?limit=1`;
const DEFAULT_WAIT_SECONDS = 60;

export type TraktPeriod = 'daily' | 'weekly' | 'monthly' | 'all';
export type TraktFilters = { genres?: string[]; years?: [number, number]; ratings?: [number, number]; tmdbRatings?: [number, number]; languages?: string[]; countries?: string[]; runtimes?: [number, number]; certifications?: string[]; networkIds?: number[]; status?: string[] };
export type TraktListRequest =
  | { type: 'movie'; kind: 'trending' | 'popular' | 'anticipated' | 'played' | 'watched' | 'collected' | 'favorited' | 'boxoffice'; period?: TraktPeriod; filters?: TraktFilters; limit: number }
  | { type: 'tv'; kind: 'trending' | 'popular' | 'anticipated' | 'played' | 'watched' | 'collected' | 'favorited'; period?: TraktPeriod; filters?: TraktFilters; limit: number };
export type TraktTitle = { type: 'movie' | 'tv'; tmdbId: number | null; tvdbId: number | null; title: string | null; year: number | null; date: string | null; rating: number | null };
export type TraktGenre = { name: string; slug: string };

const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const range = ([low, high]: [number, number]) => (low === high ? `${low}` : `${low}-${high}`);
const periodKinds = new Set(['played', 'watched', 'collected', 'favorited']);

const filterQuery = (filters: TraktFilters): Array<[string, string]> => {
  const entries: Array<[string, string | undefined]> = [
    ['genres', filters.genres?.join(',')],
    ['years', filters.years && range(filters.years)],
    ['ratings', filters.ratings && range(filters.ratings)],
    ['tmdb_ratings', filters.tmdbRatings && range(filters.tmdbRatings)],
    ['languages', filters.languages?.join(',')],
    ['countries', filters.countries?.join(',')],
    ['runtimes', filters.runtimes && range(filters.runtimes)],
    ['certifications', filters.certifications?.join(',')],
    ['network_ids', filters.networkIds?.join(',')],
    ['status', filters.status?.join(',')],
  ];
  return entries.flatMap(([name, value]) => (value === undefined || value === '' ? [] : [[name, value] as [string, string]]));
};

// Most lists wrap each title as { movie } or { show }; /popular sends the title itself.
const parseTitles = (type: 'movie' | 'tv', body: unknown): TraktTitle[] => (
  (Array.isArray(body) ? body.filter(isRecord) : []).flatMap((entry) => {
    const wrapped = entry[type === 'movie' ? 'movie' : 'show'];
    const record = isRecord(wrapped) ? wrapped : isRecord(entry.ids) ? entry : undefined;
    if (record === undefined) return [];
    const ids = isRecord(record.ids) ? record.ids : {};
    const released = typeof record.released === 'string' ? record.released : record.first_aired;
    return [{
      type,
      tmdbId: number(ids.tmdb),
      tvdbId: number(ids.tvdb),
      title: typeof record.title === 'string' ? record.title : null,
      year: number(record.year),
      date: typeof released === 'string' ? released.slice(0, 10) : null,
      rating: number(record.rating),
    }];
  })
);

const parseGenres = (body: unknown): TraktGenre[] => (
  (Array.isArray(body) ? body.filter(isRecord) : []).flatMap((genre) => (
    typeof genre.name === 'string' && typeof genre.slug === 'string' ? [{ name: genre.name, slug: genre.slug }] : []
  ))
);

export const createTrakt = (database: DatabaseSync, options: ServiceOptions & { now?: () => number } = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  let pausedUntil = 0;

  const headers = (clientId: string, extra: Record<string, string> = {}) => (
    { Accept: 'application/json', ...extra, 'trakt-api-key': clientId, 'trakt-api-version': '2', 'User-Agent': 'media-manager-2' }
  );

  // The Client ID goes only into a request header; no status or error carries it.
  const check = async (): Promise<ConnectionStatus> => {
    const clientId = readSetting(database, 'credentials', 'trakt.clientId');
    if (clientId === undefined) return { kind: 'not_configured' };
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, CHECK_URL, { headers: headers(clientId) });
    } catch {
      return { kind: 'unreachable' };
    }
    if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
    return response.ok ? { kind: 'ok', version: 'key accepted' } : { kind: 'unreachable' };
  };

  // After a 429, list, genres and fanart send nothing until the wait Trakt named has passed. check() is not paused.
  const get = async (operation: string, path: string, query: Array<[string, string]>): Promise<Result<unknown>> => {
    const clientId = readSetting(database, 'credentials', 'trakt.clientId');
    if (clientId === undefined) return notConfigured(LABEL, operation);
    if (now() < pausedUntil) {
      return { kind: 'refused', status: 429, message: `${LABEL} asked to wait before the next request, so ${operation} did not run.` };
    }
    const url = new URL(BASE_URL + path);
    for (const [name, value] of query) url.searchParams.set(name, value);
    let response: Response;
    let body: unknown;
    try {
      response = await requestWithTimeout(fetchImpl, url.href, { headers: headers(clientId, { 'Content-Type': 'application/json' }) });
      body = await response.json().catch(() => undefined);
    } catch {
      return unreachable(LABEL, operation);
    }
    if (response.status === 429) {
      const seconds = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
      pausedUntil = now() + (seconds >= 0 ? seconds : DEFAULT_WAIT_SECONDS) * 1000;
    }
    const result = classify(LABEL, operation, { status: response.status, body });
    return result.kind === 'ok' ? { kind: 'ok', value: result.value.body } : result;
  };

  const list = async (request: TraktListRequest): Promise<Result<TraktTitle[]>> => {
    const section = request.type === 'movie' ? 'movies' : 'shows';
    const path = `/${section}/${request.kind}${periodKinds.has(request.kind) ? `/${request.period ?? 'weekly'}` : ''}`;
    const query: Array<[string, string]> = [['extended', 'full']];
    if (request.kind !== 'boxoffice') query.push(['limit', String(request.limit)], ...filterQuery(request.filters ?? {}));
    const result = await get(`the ${request.kind} list`, path, query);
    return result.kind === 'ok' ? { kind: 'ok', value: parseTitles(request.type, result.value) } : result;
  };

  const genres = async (type: 'movie' | 'tv'): Promise<Result<TraktGenre[]>> => {
    const result = await get('the genre list', `/genres/${type === 'movie' ? 'movies' : 'shows'}`, []);
    return result.kind === 'ok' ? { kind: 'ok', value: parseGenres(result.value) } : result;
  };

  // Trakt sends one fanart per title as a path without https://, at 'medium' (1280 wide); 'full' is the 1920 wide copy.
  const fanart = async (type: 'movie' | 'tv', tmdbId: number): Promise<Result<string | null>> => {
    const result = await get('the backdrop lookup', `/search/tmdb/${tmdbId}`, [['type', type === 'movie' ? 'movie' : 'show'], ['extended', 'images']]);
    if (result.kind !== 'ok') return result;
    const entry = (Array.isArray(result.value) ? result.value.filter(isRecord) : [])[0];
    const record = entry?.[type === 'movie' ? 'movie' : 'show'];
    const images = isRecord(record) && isRecord(record.images) ? record.images : {};
    const path = Array.isArray(images.fanart) && typeof images.fanart[0] === 'string' ? images.fanart[0] : '';
    const link = `https://${path.replace(/^https?:\/\//, '').replace('/medium/', '/full/')}`;
    return { kind: 'ok', value: /^https:\/\/[a-z0-9.-]*trakt\.tv\//.test(link) ? link : null };
  };

  return { check, list, genres, fanart };
};

export type Trakt = ReturnType<typeof createTrakt>;
