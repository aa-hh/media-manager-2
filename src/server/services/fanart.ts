import type { DatabaseSync } from 'node:sqlite';
import { classify, isRecord, notConfigured, type Result, unreachable } from './arr/result.js';
import { readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

const LABEL = 'fanart.tv';
const BASE_URL = 'https://webservice.fanart.tv/v3';

// Shows are looked up by TVDB id, movies by TMDB id.
export const createFanart = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  // The show or movie's background entries, or null when fanart.tv holds none. The key goes only in the api-key header.
  const backgrounds = async (type: 'movie' | 'tv', id: number): Promise<Result<Array<{ link: string; likes: number; season: unknown }> | null>> => {
    const operation = `the ${type === 'movie' ? 'movie' : 'show'} backgrounds`;
    const key = readSetting(database, 'credentials', 'fanart.apiKey');
    if (key === undefined) return notConfigured(LABEL, operation);
    let status: number;
    let body: unknown;
    try {
      const response = await requestWithTimeout(fetchImpl, `${BASE_URL}/${type === 'movie' ? 'movies' : 'tv'}/${id}`, { headers: { Accept: 'application/json', 'api-key': key } });
      status = response.status;
      body = await response.json().catch(() => undefined);
    } catch {
      return unreachable(LABEL, operation);
    }
    // fanart.tv answers 404 for a title it holds no art for.
    if (status === 404) return { kind: 'ok', value: null };
    const result = classify(LABEL, operation, { status, body });
    if (result.kind !== 'ok') return result;
    const root = isRecord(body) ? body : {};
    const list = root[type === 'movie' ? 'moviebackground' : 'showbackground'];
    const entries = (Array.isArray(list) ? list.filter(isRecord) : [])
      .flatMap((image) => {
        const link = typeof image.url === 'string' ? image.url.replace(/^http:\/\//, 'https://') : '';
        return /^https:\/\/assets\.fanart\.tv\//.test(link) ? [{ link, likes: Number(image.likes) || 0, season: image.season }] : [];
      })
      .sort((a, b) => b.likes - a.likes);
    return { kind: 'ok', value: entries };
  };

  // The most-liked background, or null when fanart.tv has none.
  const background = async (type: 'movie' | 'tv', id: number): Promise<Result<string | null>> => {
    const result = await backgrounds(type, id);
    return result.kind === 'ok' ? { kind: 'ok', value: result.value?.[0]?.link ?? null } : result;
  };

  // The most-liked background fans tagged with each season of a show; entries with no season or "all" are left out.
  const seasonBackgrounds = async (tvdbId: number): Promise<Result<Array<{ seasonNumber: number; url: string }>>> => {
    const result = await backgrounds('tv', tvdbId);
    if (result.kind !== 'ok') return result;
    const bySeason = new Map<number, string>();
    for (const entry of result.value ?? []) {
      if (typeof entry.season !== 'string' || !/^\d+$/.test(entry.season)) continue;
      const seasonNumber = Number(entry.season);
      if (!bySeason.has(seasonNumber)) bySeason.set(seasonNumber, entry.link);
    }
    return { kind: 'ok', value: [...bySeason].map(([seasonNumber, url]) => ({ seasonNumber, url })) };
  };

  return { background, seasonBackgrounds };
};

export type Fanart = ReturnType<typeof createFanart>;
