import type { DatabaseSync } from 'node:sqlite';
import { classify, isRecord, notConfigured, type Result, unreachable } from './arr/result.js';
import { type ConnectionStatus, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

const BASE_URL = 'https://api.themoviedb.org/3';
const LABEL = 'TMDB';
const LIST_TTL_MS = 5 * 60_000;
const REFERENCE_TTL_MS = 24 * 60 * 60_000;

export type TmdbMediaType = 'movie' | 'tv';
export type TmdbDiscoverParams = Partial<Record<
  | 'page' | 'sort_by' | 'with_genres' | 'without_genres' | 'with_keywords' | 'without_keywords'
  | 'with_watch_providers' | 'watch_region' | 'with_watch_monetization_types' | 'with_original_language'
  | 'primary_release_date.gte' | 'primary_release_date.lte' | 'first_air_date.gte' | 'first_air_date.lte'
  | 'vote_average.gte' | 'vote_count.gte' | 'with_runtime.gte' | 'with_runtime.lte' | 'include_adult',
  string | number | boolean
>>;
export type TmdbListItem = {
  id: number;
  mediaType: TmdbMediaType | null;
  title: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  date: string | null;
  voteAverage: number | null;
  genreIds: number[];
};
export type TmdbPage = { page: number; totalPages: number; totalResults: number; results: TmdbListItem[] };
export type TmdbGenre = { id: number; name: string };
export type TmdbRegion = { code: string; name: string };
export type TmdbProvider = { id: number; name: string; logoPath: string | null };
export type TmdbCastMember = { id: number; name: string; character: string | null; profilePath: string | null };
export type TmdbDetails = {
  id: number;
  mediaType: TmdbMediaType;
  tvdbId: number | null;
  title: string | null;
  overview: string | null;
  tagline: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  date: string | null;
  runtime: number | null;
  status: string | null;
  voteAverage: number | null;
  genres: TmdbGenre[];
  keywords: TmdbGenre[];
  recommendations: TmdbListItem[];
  cast: TmdbCastMember[];
};

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const records = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);
const named = (value: unknown): TmdbGenre[] => records(value).flatMap((item) => {
  const id = number(item.id);
  const name = text(item.name);
  return id === null || name === null ? [] : [{ id, name }];
});

// Movies carry title and release_date, shows name and first_air_date; trending mixes both and marks each.
const listItem = (item: Record<string, unknown>, fallback: TmdbMediaType | null): TmdbListItem | undefined => {
  const id = number(item.id);
  if (id === null) return undefined;
  const mediaType = item.media_type === 'movie' || item.media_type === 'tv' ? item.media_type : fallback;
  return {
    id,
    mediaType,
    title: text(item.title) ?? text(item.name),
    overview: text(item.overview),
    posterPath: text(item.poster_path),
    backdropPath: text(item.backdrop_path),
    date: text(item.release_date) ?? text(item.first_air_date),
    voteAverage: number(item.vote_average),
    genreIds: Array.isArray(item.genre_ids) ? item.genre_ids.filter((genre): genre is number => typeof genre === 'number') : [],
  };
};
const listItems = (value: unknown, fallback: TmdbMediaType | null) => records(value).flatMap((item) => listItem(item, fallback) ?? []);

const page = (body: unknown, fallback: TmdbMediaType | null): TmdbPage => {
  const root = isRecord(body) ? body : {};
  return {
    page: number(root.page) ?? 1,
    totalPages: number(root.total_pages) ?? 0,
    totalResults: number(root.total_results) ?? 0,
    results: listItems(root.results, fallback),
  };
};

// TV keywords sit under keywords.results and its cast under aggregate_credits with a list of roles.
// A show's TVDB id comes from external_ids: the title store saves shows under it.
const parseDetails = (body: unknown, mediaType: TmdbMediaType): TmdbDetails | undefined => {
  if (!isRecord(body)) return undefined;
  const id = number(body.id);
  if (id === null) return undefined;
  const keywords = isRecord(body.keywords) ? body.keywords : {};
  const recommendations = isRecord(body.recommendations) ? body.recommendations : {};
  const creditsBody = mediaType === 'movie' ? body.credits : body.aggregate_credits;
  const credits = isRecord(creditsBody) ? creditsBody : {};
  const episodeRuntimes = Array.isArray(body.episode_run_time) ? body.episode_run_time : [];
  const externalIds = isRecord(body.external_ids) ? body.external_ids : {};
  return {
    id,
    mediaType,
    tvdbId: number(externalIds.tvdb_id),
    title: text(body.title) ?? text(body.name),
    overview: text(body.overview),
    tagline: text(body.tagline),
    posterPath: text(body.poster_path),
    backdropPath: text(body.backdrop_path),
    date: text(body.release_date) ?? text(body.first_air_date),
    runtime: number(body.runtime) ?? number(episodeRuntimes[0]),
    status: text(body.status),
    voteAverage: number(body.vote_average),
    genres: named(body.genres),
    keywords: named(mediaType === 'movie' ? keywords.keywords : keywords.results),
    recommendations: listItems(recommendations.results, mediaType),
    cast: records(credits.cast).flatMap((member) => {
      const memberId = number(member.id);
      const name = text(member.name);
      if (memberId === null || name === null) return [];
      const character = text(member.character) ?? text(records(member.roles)[0]?.character);
      return [{ id: memberId, name, character, profilePath: text(member.profile_path) }];
    }),
  };
};

export const createTmdb = (database: DatabaseSync, options: ServiceOptions & { now?: () => number } = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  // razor: an unbounded in-memory map; discover pages are the only growing keys, add eviction if memory shows it.
  const cache = new Map<string, { expiresAt: number; value: unknown }>();

  const apiKey = () => readSetting(database, 'credentials', 'tmdb.apiKey');

  // The key goes only into the request URL; no message or cache key carries that URL.
  const get = async (operation: string, path: string, query: Record<string, string | number | boolean> = {}): Promise<Result<unknown>> => {
    const key = apiKey();
    if (key === undefined) return notConfigured(LABEL, operation);
    const url = new URL(BASE_URL + path);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, String(value));
    url.searchParams.set('api_key', key);
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, url.href, { headers: { Accept: 'application/json' } });
    } catch {
      return unreachable(LABEL, operation);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    const result = classify(LABEL, operation, { status: response.status, body });
    return result.kind === 'ok' ? { kind: 'ok', value: result.value.body } : result;
  };

  const cached = async <T>(
    ttlMs: number,
    operation: string,
    path: string,
    query: Record<string, string | number | boolean>,
    parse: (body: unknown) => T,
  ): Promise<Result<T>> => {
    const cacheKey = `${path}?${new URLSearchParams(Object.entries(query).map(([name, value]): [string, string] => [name, String(value)])).toString()}`;
    const hit = cache.get(cacheKey);
    if (hit !== undefined && hit.expiresAt > now()) return { kind: 'ok', value: hit.value as T };
    const result = await get(operation, path, query);
    if (result.kind !== 'ok') return result;
    const value = parse(result.value);
    cache.set(cacheKey, { expiresAt: now() + ttlMs, value });
    return { kind: 'ok', value };
  };

  const definedParams = (params: TmdbDiscoverParams) => Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined),
  );

  const discover = (mediaType: TmdbMediaType, params: TmdbDiscoverParams = {}) => cached(
    LIST_TTL_MS, `the ${mediaType} discover list`, `/discover/${mediaType}`, definedParams(params), (body) => page(body, mediaType),
  );

  const trending = (mediaType: TmdbMediaType | 'all', window: 'day' | 'week', pageNumber = 1) => cached(
    LIST_TTL_MS, 'the trending list', `/trending/${mediaType}/${window}`, { page: pageNumber },
    (body) => page(body, mediaType === 'all' ? null : mediaType),
  );

  const genres = (mediaType: TmdbMediaType) => cached(
    REFERENCE_TTL_MS, 'the genre list', `/genre/${mediaType}/list`, {}, (body) => named(isRecord(body) ? body.genres : undefined),
  );

  const regions = () => cached(REFERENCE_TTL_MS, 'the region list', '/watch/providers/regions', {}, (body) => (
    records(isRecord(body) ? body.results : undefined).flatMap((region) => {
      const code = text(region.iso_3166_1);
      const name = text(region.english_name);
      return code === null || name === null ? [] : [{ code, name }];
    })
  ));

  const providers = (mediaType: TmdbMediaType, region: string) => cached(
    REFERENCE_TTL_MS, 'the streaming service list', `/watch/providers/${mediaType}`, { watch_region: region }, (body) => (
      records(isRecord(body) ? body.results : undefined).flatMap((provider) => {
        const id = number(provider.provider_id);
        const name = text(provider.provider_name);
        return id === null || name === null ? [] : [{ id, name, logoPath: text(provider.logo_path) }];
      })
    ),
  );

  // Not cached here: title details are saved in the title store.
  const details = async (mediaType: TmdbMediaType, id: number): Promise<Result<TmdbDetails>> => {
    const operation = `the ${mediaType === 'movie' ? 'movie' : 'show'} details`;
    const append = mediaType === 'movie' ? 'keywords,recommendations,credits' : 'keywords,recommendations,aggregate_credits,external_ids';
    const result = await get(operation, `/${mediaType}/${id}`, { append_to_response: append });
    if (result.kind !== 'ok') return result;
    const parsed = parseDetails(result.value, mediaType);
    return parsed === undefined ? { kind: 'refused', status: null, message: `${LABEL} sent no usable ${operation}.` } : { kind: 'ok', value: parsed };
  };

  const check = async (): Promise<ConnectionStatus> => {
    const result = await get('the connection check', '/authentication');
    if (result.kind === 'not_configured' || result.kind === 'rejected') return { kind: result.kind };
    if (result.kind !== 'ok' || !isRecord(result.value) || result.value.success !== true) return { kind: 'unreachable' };
    return { kind: 'ok', version: '3' };
  };

  return { check, discover, trending, genres, regions, providers, details };
};
