import type { DatabaseSync } from 'node:sqlite';
import { type ConnectionStatus, isInsideFolder, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';
import type { Library, LibraryType } from './mediaServer.js';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const collectionTypes: Record<LibraryType, string> = { movie: 'movies', show: 'tvshows' };

export const createJellyfin = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  const readConfiguration = () => {
    const url = readSetting(database, 'serviceAddresses', 'jellyfin.url');
    const apiKey = readSetting(database, 'credentials', 'jellyfin.apiKey');
    return url === undefined || apiKey === undefined ? undefined : { url, apiKey };
  };

  // The MediaBrowser header is the one form Jellyfin always accepts; X-Emby-Token and api_key are off by default.
  const request = async (path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: unknown }> => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error('Jellyfin is not configured.');
    const headers: Record<string, string> = { Authorization: `MediaBrowser Token="${configuration.apiKey}"`, Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, configuration.url.replace(/\/+$/, '') + path, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new Error('Jellyfin is unreachable.');
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { status: response.status, body };
  };

  // /System/Info, not /System/Info/Public: the public one answers without a key, so a wrong key would pass.
  const check = async (): Promise<ConnectionStatus> => {
    if (readConfiguration() === undefined) return { kind: 'not_configured' };
    let result: { status: number; body: unknown };
    try {
      result = await request('/System/Info');
    } catch {
      return { kind: 'unreachable' };
    }
    if (result.status === 401 || result.status === 403) return { kind: 'rejected' };
    if (result.status < 200 || result.status > 299) return { kind: 'unreachable' };
    const version = isRecord(result.body) ? result.body.Version : undefined;
    if (typeof version !== 'string' || version === '') return { kind: 'unreachable' };
    return { kind: 'ok', version };
  };

  const findLibraryFor = async (folder: string, type: LibraryType): Promise<Library | undefined> => {
    const result = await request('/Library/VirtualFolders');
    if (result.status < 200 || result.status > 299) throw new Error('Jellyfin refused the library list.');
    const libraries = Array.isArray(result.body) ? result.body.filter(isRecord) : [];
    const library = libraries.find((item) => item.CollectionType === collectionTypes[type] && Array.isArray(item.Locations)
      && item.Locations.some((location) => typeof location === 'string' && isInsideFolder(location, folder)));
    if (library === undefined) return undefined;
    const id = typeof library.ItemId === 'string' && library.ItemId !== '' ? library.ItemId : String(library.Name);
    return { id };
  };

  // Jellyfin scans the folder after a delay and confirms nothing, so the library is not needed and the answer not read.
  const refresh = async (_library: Library, folder: string) => {
    await request('/Library/Media/Updated', { method: 'POST', body: { Updates: [{ Path: folder, UpdateType: 'Created' }] } });
  };

  return { name: 'jellyfin' as const, label: 'Jellyfin', check, findLibraryFor, refresh };
};
