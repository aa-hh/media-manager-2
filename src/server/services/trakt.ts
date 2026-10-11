import type { DatabaseSync } from 'node:sqlite';
import { type ConnectionStatus, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

// A public list needs only the Client ID, so one movie of it proves the ID works. Trakt answers 403 to an unknown ID.
const CHECK_URL = 'https://api.trakt.tv/movies/trending?limit=1';

export const createTrakt = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  // The Client ID goes only into a request header; no status or error carries it.
  const check = async (): Promise<ConnectionStatus> => {
    const clientId = readSetting(database, 'credentials', 'trakt.clientId');
    if (clientId === undefined) return { kind: 'not_configured' };
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, CHECK_URL, {
        headers: { Accept: 'application/json', 'trakt-api-key': clientId, 'trakt-api-version': '2', 'User-Agent': 'media-manager-2' },
      });
    } catch {
      return { kind: 'unreachable' };
    }
    if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
    return response.ok ? { kind: 'ok', version: 'key accepted' } : { kind: 'unreachable' };
  };

  return { check };
};
