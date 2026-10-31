import type { DatabaseSync } from 'node:sqlite';
import { type ConnectionStatus, isInsideFolder, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';
import type { Library, LibraryType } from './mediaServer.js';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const LISTING_TIMEOUT_MS = 60_000;

export const createPlex = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  const readConfiguration = () => {
    const url = readSetting(database, 'serviceAddresses', 'plex.url');
    const token = readSetting(database, 'credentials', 'plex.token');
    return url === undefined || token === undefined ? undefined : { url, token };
  };

  const request = async (path: string, timeoutMs?: number): Promise<{ status: number; body: unknown }> => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error('Plex is not configured.');
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, configuration.url.replace(/\/+$/, '') + path, {
        headers: { 'X-Plex-Token': configuration.token, Accept: 'application/json' },
      }, timeoutMs);
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

  // Read-only listings for watch status; each throws when Plex is unset, unreachable or refuses.
  const container = async (path: string, what: string, timeoutMs?: number): Promise<Record<string, unknown>> => {
    const result = await request(path, timeoutMs);
    if (result.status < 200 || result.status > 299) throw new Error(`Plex refused ${what}.`);
    const body = isRecord(result.body) ? result.body.MediaContainer : undefined;
    // A 2xx reply with no readable body (a timeout or cut connection mid-body) is a failure, never an empty listing.
    if (!isRecord(body)) throw new Error(`Plex sent an unreadable reply for ${what}.`);
    return body;
  };
  const metadata = (body: Record<string, unknown>) => (Array.isArray(body.Metadata) ? body.Metadata.filter(isRecord) : []);

  const identity = async (): Promise<{ machineIdentifier: string; maxUploadBitrate: number | null }> => {
    const body = await container('/', 'the server identity');
    if (typeof body.machineIdentifier !== 'string' || body.machineIdentifier === '') throw new Error('Plex refused the server identity.');
    const maxUploadBitrate = typeof body.maxUploadBitrate === 'number' && Number.isFinite(body.maxUploadBitrate) ? body.maxUploadBitrate : null;
    return { machineIdentifier: body.machineIdentifier, maxUploadBitrate };
  };

  const sections = async (): Promise<Array<{ id: string; type: LibraryType }>> => {
    const body = await container('/library/sections', 'the library list');
    const directories = Array.isArray(body.Directory) ? body.Directory.filter(isRecord) : [];
    return directories.flatMap((item) => (
      (item.type === 'movie' || item.type === 'show') && (typeof item.key === 'string' || typeof item.key === 'number')
        ? [{ id: String(item.key), type: item.type }]
        : []
    ));
  };

  // One reply carries every item of a section, every episode for a show library, so it gets longer than the default 10 s.
  const listItems = async (sectionId: string, type: 1 | 2 | 4) => metadata(
    await container(`/library/sections/${encodeURIComponent(sectionId)}/all?type=${type}&includeGuids=1`, 'the library listing', LISTING_TIMEOUT_MS),
  );

  const continueWatching = async () => metadata(await container('/hubs/continueWatching/items', 'Continue Watching'));

  const onDeck = async (showRatingKey: string): Promise<Record<string, unknown> | undefined> => {
    const show = metadata(await container(`/library/metadata/${encodeURIComponent(showRatingKey)}?includeOnDeck=1`, 'the show'))[0];
    const deck = isRecord(show?.OnDeck) ? show.OnDeck.Metadata : undefined;
    const next = Array.isArray(deck) ? deck[0] : deck;
    return isRecord(next) ? next : undefined;
  };

  // The owner's webhook list on plex.tv. Plex documents no API for it; this is the one Plex Web's settings page uses, and
  // a POST replaces the whole list.
  const plexTv = async (init: RequestInit = {}) => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error('Plex is not configured.');
    const response = await requestWithTimeout(fetchImpl, 'https://plex.tv/api/v2/user/webhooks', {
      ...init,
      headers: { 'X-Plex-Token': configuration.token, 'X-Plex-Client-Identifier': 'media-manager-2', 'X-Plex-Product': 'media-manager-2', Accept: 'application/json', ...init.headers },
    });
    if (response.status < 200 || response.status > 299) throw new Error('plex.tv refused the webhook list.');
    return response;
  };
  const webhooks = async (): Promise<string[]> => {
    const body: unknown = await (await plexTv()).json().catch(() => undefined);
    if (!Array.isArray(body)) throw new Error('plex.tv sent an unreadable webhook list.');
    return body.flatMap((item) => (isRecord(item) && typeof item.url === 'string' ? [item.url] : []));
  };
  const setWebhooks = async (urls: string[]) => {
    await plexTv({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(urls.map((url): [string, string] => ['urls[]', url])).toString(),
    });
  };

  return { name: 'plex' as const, label: 'Plex', check, request, findLibraryFor, refresh, identity, sections, listItems, continueWatching, onDeck, webhooks, setWebhooks };
};
