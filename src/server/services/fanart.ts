import type { DatabaseSync } from 'node:sqlite';
import { classify, isRecord, notConfigured, type Result, unreachable } from './arr/result.js';
import { readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

const LABEL = 'fanart.tv';
const BASE_URL = 'https://webservice.fanart.tv/v3';

// Shows are looked up by TVDB id, movies by TMDB id.
export const createFanart = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  // The most-liked background, or null when fanart.tv has none. The key goes only in the api-key header.
  const background = async (type: 'movie' | 'tv', id: number): Promise<Result<string | null>> => {
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
    const best = (Array.isArray(list) ? list.filter(isRecord) : [])
      .flatMap((image) => {
        const link = typeof image.url === 'string' ? image.url.replace(/^http:\/\//, 'https://') : '';
        return /^https:\/\/assets\.fanart\.tv\//.test(link) ? [{ link, likes: Number(image.likes) || 0 }] : [];
      })
      .sort((a, b) => b.likes - a.likes)[0];
    return { kind: 'ok', value: best?.link ?? null };
  };

  return { background };
};

export type Fanart = ReturnType<typeof createFanart>;
