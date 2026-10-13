import type { DatabaseSync } from 'node:sqlite';
import { type ConnectionStatus, isInsideFolder, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';
import type { Library, LibraryType } from './mediaServer.js';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const createPlex = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  const readConfiguration = () => {
    const url = readSetting(database, 'serviceAddresses', 'plex.url');
    const token = readSetting(database, 'credentials', 'plex.token');
    return url === undefined || token === undefined ? undefined : { url, token };
  };

  const request = async (path: string): Promise<{ status: number; body: unknown }> => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error('Plex is not configured.');
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, configuration.url.replace(/\/+$/, '') + path, {
        headers: { 'X-Plex-Token': configuration.token, Accept: 'application/json' },
      });
    } catch {
      throw new Error('Plex is unreachable.');
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { status: response.status, body };
  };

  const check = async (): Promise<ConnectionStatus> => {
    if (readConfiguration() === undefined) return { kind: 'not_configured' };
    let result: { status: number; body: unknown };
    try {
      result = await request('/');
    } catch {
      return { kind: 'unreachable' };
    }
    if (result.status === 401 || result.status === 403) return { kind: 'rejected' };
    if (result.status < 200 || result.status > 299) return { kind: 'unreachable' };
    const container = isRecord(result.body) ? result.body.MediaContainer : undefined;
    if (!isRecord(container) || typeof container.version !== 'string' || container.version === '') {
      return { kind: 'unreachable' };
    }
    return { kind: 'ok', version: container.version };
  };

  const findLibraryFor = async (folder: string, type: LibraryType): Promise<Library | undefined> => {
    const result = await request('/library/sections');
    if (result.status < 200 || result.status > 299) throw new Error('Plex refused the library list.');
    const container = isRecord(result.body) ? result.body.MediaContainer : undefined;
    const sections = isRecord(container) && Array.isArray(container.Directory) ? container.Directory.filter(isRecord) : [];
    const section = sections.find((item) => item.type === type && Array.isArray(item.Location)
      && item.Location.some((location) => isRecord(location) && typeof location.path === 'string' && isInsideFolder(location.path, folder)));
    if (section === undefined || (typeof section.key !== 'string' && typeof section.key !== 'number')) return undefined;
    return { id: String(section.key) };
  };

  const refresh = async (library: Library, folder: string) => {
    await request(`/library/sections/${encodeURIComponent(library.id)}/refresh?path=${encodeURIComponent(folder)}`);
  };

  return { name: 'plex' as const, label: 'Plex', check, request, findLibraryFor, refresh };
};
