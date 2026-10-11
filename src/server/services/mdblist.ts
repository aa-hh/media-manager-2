import type { DatabaseSync } from 'node:sqlite';
import type { TitleStore } from '../titleStore.js';
import { classify, isRecord, notConfigured, type Result, unreachable } from './arr/result.js';
import { type ConnectionStatus, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

const BASE_URL = 'https://api.mdblist.com';
const LABEL = 'MDBList';
const PART = 'mdblistRatings';
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
// The show page waits this long at most for ratings it has never saved.
const RATINGS_TIMEOUT_MS = 3_000;
// The free tier allows 1,000 requests a day and Health checks every 5 minutes, so one check result is kept for an hour.
const CHECK_TTL_MS = 60 * 60_000;
// Severance: a show MDBList is sure to know, so a lookup of it proves the key works.
const CHECK_PATH = '/tvdb/show/371980';

type MdblistRating = { source: string; value: number | null; votes: number | null };
export type SiteRating = { value: number; votes: number | null } | null;
export type RatingsBySite = { imdb: SiteRating; rottenTomatoes: SiteRating; rottenTomatoesAudience: SiteRating; metacritic: SiteRating };
export type ShowIds = { tvdbId: number | null; tmdbId: number | null };

const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// Each rating's url is unreliable (IMDb's is a bare number), so only source, value and votes are kept.
const parseRatings = (body: unknown): MdblistRating[] => (
  (isRecord(body) && Array.isArray(body.ratings) ? body.ratings.filter(isRecord) : []).flatMap((rating) => (
    typeof rating.source === 'string' ? [{ source: rating.source, value: number(rating.value), votes: number(rating.votes) }] : []
  ))
);

export const noRatings: RatingsBySite = { imdb: null, rottenTomatoes: null, rottenTomatoesAudience: null, metacritic: null };

export const ratingsBySite = (ratings: MdblistRating[]): RatingsBySite => {
  const site = (source: string): SiteRating => {
    const found = ratings.find((rating) => rating.source === source);
    return found === undefined || found.value === null ? null : { value: found.value, votes: found.votes };
  };
  return { imdb: site('imdb'), rottenTomatoes: site('tomatoes'), rottenTomatoesAudience: site('popcorn'), metacritic: site('metacritic') };
};

export const createMdblist = (database: DatabaseSync, options: ServiceOptions & { now?: () => number } = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  let lastCheck: { key: string; at: number; status: ConnectionStatus } | undefined;

  const apiKey = () => readSetting(database, 'credentials', 'mdblist.apiKey');

  // The key goes only into the request URL; no message carries that URL or the thrown error.
  const get = async (operation: string, path: string, timeoutMs: number): Promise<Result<unknown>> => {
    const key = apiKey();
    if (key === undefined) return notConfigured(LABEL, operation);
    const url = new URL(BASE_URL + path);
    url.searchParams.set('apikey', key);
    let response: Response;
    let body: unknown;
    try {
      response = await requestWithTimeout(fetchImpl, url.href, { headers: { Accept: 'application/json' } }, timeoutMs);
      body = await response.json().catch(() => undefined);
    } catch {
      return unreachable(LABEL, operation);
    }
    const result = classify(LABEL, operation, { status: response.status, body });
    return result.kind === 'ok' ? { kind: 'ok', value: result.value.body } : result;
  };

  // A show MDBList does not know is saved as an empty list, so it is not asked again for a week.
  const load = async ({ tvdbId, tmdbId }: ShowIds): Promise<Result<MdblistRating[]>> => {
    let result: Result<unknown> = { kind: 'not_found', message: `${LABEL} has no such show.` };
    if (tvdbId !== null) result = await get('the show ratings', `/tvdb/show/${tvdbId}`, RATINGS_TIMEOUT_MS);
    if (result.kind === 'not_found' && tmdbId !== null) result = await get('the show ratings', `/tmdb/show/${tmdbId}`, RATINGS_TIMEOUT_MS);
    if (result.kind === 'not_found') return { kind: 'ok', value: [] };
    return result.kind === 'ok' ? { kind: 'ok', value: parseRatings(result.value) } : result;
  };

  // Never fails: a saved copy is served at once (refetched in the background once a week old); with none saved, any failure gives all nulls.
  const showRatings = async (store: TitleStore, ids: ShowIds): Promise<RatingsBySite> => {
    // razor: the title store keys shows by TVDB id, and every Sonarr show has one; a show without it gets no ratings.
    if (ids.tvdbId === null) return noRatings;
    const title = { type: 'tv' as const, tvdbId: ids.tvdbId, tmdbId: ids.tmdbId };
    const stored = store.get<MdblistRating[]>(title, PART);
    const fetching = store.fetch(title, PART, MAX_AGE_MS, () => load(ids)).catch(() => undefined);
    if (stored !== undefined) return ratingsBySite(stored.value);
    const result = await fetching;
    return result?.kind === 'ok' ? ratingsBySite(result.value) : noRatings;
  };

  const check = async (): Promise<ConnectionStatus> => {
    const key = apiKey();
    if (lastCheck !== undefined && lastCheck.key === key && now() - lastCheck.at < CHECK_TTL_MS) return lastCheck.status;
    const result = await get('the connection check', CHECK_PATH, 10_000);
    let status: ConnectionStatus;
    if (result.kind === 'not_configured' || result.kind === 'rejected') status = { kind: result.kind };
    else if (result.kind === 'refused' && result.status === 429) status = { kind: 'ok', version: 'daily request limit reached' };
    else if (result.kind === 'ok') status = { kind: 'ok', version: 'key accepted' };
    else status = { kind: 'unreachable' };
    if (key !== undefined && status.kind !== 'unreachable') lastCheck = { key, at: now(), status };
    return status;
  };

  return { check, showRatings };
};

export type Mdblist = ReturnType<typeof createMdblist>;
