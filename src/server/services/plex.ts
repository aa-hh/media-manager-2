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

  const request = async (path: string, timeoutMs?: number, method: 'GET' | 'PUT' = 'GET'): Promise<{ status: number; body: unknown }> => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error('Plex is not configured.');
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, configuration.url.replace(/\/+$/, '') + path, {
        method,
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

  // The owner's video playlists, and one playlist's items; playlistItems is null when Plex has no such playlist.
  const playlists = async () => metadata(await container('/playlists?playlistType=video', 'the playlists'));
  const playlistItems = async (id: string): Promise<{ title: string; items: Array<Record<string, unknown>> } | null> => {
    const result = await request(`/playlists/${encodeURIComponent(id)}/items`);
    if (result.status === 404) return null;
    if (result.status < 200 || result.status > 299) throw new Error('Plex refused the playlist.');
    const body = isRecord(result.body) ? result.body.MediaContainer : undefined;
    if (!isRecord(body)) throw new Error('Plex sent an unreadable reply for the playlist.');
    return { title: typeof body.title === 'string' ? body.title : '', items: metadata(body) };
  };

  // A playlist's collage (Plex draws it from the list's items), sized for a TV card. Plex answers with the list's own
  // composite address, whose last part changes when the list does, so it doubles as a cache key. Off when Plex is unset,
  // not_found when Plex has no such list or no picture; throws when Plex is unreachable or refuses.
  const playlistCollage = async (id: string): Promise<
    { kind: 'off' } | { kind: 'not_found' } | { kind: 'ok'; key: string; load: () => Promise<{ bytes: Uint8Array; contentType: string }> }
  > => {
    const configuration = readConfiguration();
    if (configuration === undefined) return { kind: 'off' };
    const result = await request(`/playlists/${encodeURIComponent(id)}`);
    if (result.status === 404) return { kind: 'not_found' };
    if (result.status < 200 || result.status > 299) throw new Error('Plex refused the playlist.');
    const body = isRecord(result.body) ? result.body.MediaContainer : undefined;
    if (!isRecord(body)) throw new Error('Plex sent an unreadable reply for the playlist.');
    const composite = metadata(body)[0]?.composite;
    if (typeof composite !== 'string' || !/^\/playlists\/\d{1,12}\/composite\/\d{1,15}$/.test(composite)) return { kind: 'not_found' };
    const load = async () => {
      let response: Response;
      try {
        response = await requestWithTimeout(fetchImpl, `${configuration.url.replace(/\/+$/, '')}${composite}?width=600&height=600`, {
          headers: { 'X-Plex-Token': configuration.token, Accept: 'image/jpeg,image/png' },
        });
      } catch {
        throw new Error('Plex is unreachable.');
      }
      const contentType = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
      if (response.status < 200 || response.status > 299 || !['image/jpeg', 'image/png'].includes(contentType)) {
        throw new Error('Plex refused the playlist picture.');
      }
      return { bytes: new Uint8Array(await response.arrayBuffer()), contentType };
    };
    return { kind: 'ok', key: composite, load };
  };

  // Watch-state writes; each throws when Plex is unset, unreachable or refuses. Marking by hand sets played or unplayed
  // without adding to Plex's watch history, and works on a show to mark every episode.
  const write = async (path: string, what: string) => {
    const result = await request(path, undefined, 'PUT');
    if (result.status < 200 || result.status > 299) throw new Error(`Plex refused ${what}.`);
  };
  const markWatched = (ratingKey: string, watched: boolean) => write(
    `/:/${watched ? 'scrobble' : 'unscrobble'}?${new URLSearchParams({ identifier: 'com.plexapp.plugins.library', key: ratingKey })}`,
    watched ? 'the watched mark' : 'the unwatched mark',
  );
  // Plex documents no address for this; its library provider advertises one under its actions, read at each call so a
  // Plex update that moves it keeps working. A Plex that advertises none refuses.
  const removeFromContinueWatching = async (ratingKeys: string[]) => {
    const body = await container('/media/providers', 'the provider list');
    const providers = Array.isArray(body.MediaProvider) ? body.MediaProvider.filter(isRecord) : [];
    const features = providers.find((provider) => provider.identifier === 'com.plexapp.plugins.library')?.Feature;
    const path = (Array.isArray(features) ? features.filter(isRecord) : [])
      .flatMap((feature) => (Array.isArray(feature.Action) ? feature.Action.filter(isRecord) : []))
      .find((action) => action.id === 'removeFromContinueWatching')?.key;
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) throw new Error('Plex advertises no Continue Watching removal.');
    for (const ratingKey of ratingKeys) await write(`${path}?${new URLSearchParams({ ratingKey })}`, 'the Continue Watching removal');
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
    // An entry read wrongly would be dropped from the list posted back, so any unexpected one refuses the whole list.
    if (!Array.isArray(body) || !body.every((item): item is { url: string } => isRecord(item) && typeof item.url === 'string')) {
      throw new Error('plex.tv sent an unreadable webhook list.');
    }
    return body.map((item) => item.url);
  };
  const setWebhooks = async (urls: string[]) => {
    await plexTv({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(urls.map((url): [string, string] => ['urls[]', url])).toString(),
    });
  };

  return { name: 'plex' as const, label: 'Plex', check, request, findLibraryFor, refresh, identity, sections, listItems, continueWatching, onDeck, playlists, playlistItems, playlistCollage, markWatched, removeFromContinueWatching, webhooks, setWebhooks };
};
