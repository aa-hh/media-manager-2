import type { DatabaseSync } from 'node:sqlite';
import { type ConnectionStatus, isInsideFolder, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';
import type { Library, LibraryType } from './mediaServer.js';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
// A refused key fails every request alike, so the caller stops asking until the next run; the health check tells the owner.
export class JellyfinKeyRefused extends Error {}
const answer = (status: number) => {
  if (status === 401 || status === 403) throw new JellyfinKeyRefused('Jellyfin refused the API key.');
  if (status >= 500) throw new Error('Jellyfin is unavailable.');
};
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
    const serverName = isRecord(result.body) ? result.body.ServerName : undefined;
    return typeof serverName === 'string' && serverName !== '' ? { kind: 'ok', version, serverName } : { kind: 'ok', version };
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

  // Jellyfin has no path filter, so the items are listed and matched by folder and file name, which also holds when
  // Radarr or Sonarr see the tracked file under another mount than Jellyfin does.
  // razor: lists every movie, or every episode of that season number; a lookup by provider id is the upgrade if that gets slow.
  const mergeVersions = async (type: LibraryType, trackedPath: string, versionPath: string, season?: number) => {
    const query = new URLSearchParams({ Recursive: 'true', IncludeItemTypes: type === 'movie' ? 'Movie' : 'Episode', Fields: 'Path', EnableImages: 'false', EnableUserData: 'false' });
    if (season !== undefined) query.set('ParentIndexNumber', String(season));
    const result = await request(`/Items?${query}`);
    answer(result.status);
    if (result.status < 200 || result.status > 299) return false;
    const items = isRecord(result.body) && Array.isArray(result.body.Items) ? result.body.Items.filter(isRecord) : [];
    const tail = (path: string) => path.split(/[\\/]+/).filter(Boolean).slice(-2).join('/');
    const idAt = (path: string) => {
      const found = items.filter((item) => typeof item.Path === 'string' && typeof item.Id === 'string' && tail(item.Path) === tail(path));
      return found.length === 1 ? String(found[0].Id) : undefined;
    };
    const tracked = idAt(trackedPath);
    const version = idAt(versionPath);
    if (tracked === undefined || version === undefined || tracked === version) return false;
    const merge = await request(`/Videos/MergeVersions?ids=${encodeURIComponent(tracked)}&ids=${encodeURIComponent(version)}`, { method: 'POST' });
    answer(merge.status);
    return merge.status >= 200 && merge.status <= 299;
  };

  return { name: 'jellyfin' as const, label: 'Jellyfin', check, findLibraryFor, refresh, mergeVersions };
};

// Sign-in on the first-run page, against a server address given explicitly rather than saved. Jellyfin binds a Quick Connect
// code to the DeviceId that started it, so every call sends the same one.
const SIGN_IN_AUTHORIZATION = 'MediaBrowser Client="media-manager-2", Device="media-manager-2", DeviceId="media-manager-2", Version="1"';

type Answer = { status: number; body: unknown };

// Throws when nothing answered; a body that is not JSON reads as undefined.
const signInRequest = async (fetchImpl: typeof globalThis.fetch, url: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<Answer> => {
  const headers: Record<string, string> = { Authorization: SIGN_IN_AUTHORIZATION, Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await requestWithTimeout(fetchImpl, url + path, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return { status: response.status, body };
};

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value !== '';

export type IdentifyResult = { kind: 'ok'; serverName: string; serverId: string } | { kind: 'no_answer' | 'not_jellyfin' };

export const identify = async (fetchImpl: typeof globalThis.fetch, url: string): Promise<IdentifyResult> => {
  let answer: Answer;
  try {
    answer = await signInRequest(fetchImpl, url, '/System/Info/Public');
  } catch {
    return { kind: 'no_answer' };
  }
  const { status, body } = answer;
  if (status < 200 || status > 299 || !isRecord(body) || !nonEmpty(body.Id) || !nonEmpty(body.Version)) return { kind: 'not_jellyfin' };
  if (typeof body.ProductName !== 'string' || !body.ProductName.toLowerCase().includes('jellyfin')) return { kind: 'not_jellyfin' };
  return { kind: 'ok', serverName: nonEmpty(body.ServerName) ? body.ServerName : new URL(url).host, serverId: body.Id };
};

export type JellyfinUser = { userId: string; userName: string; isAdministrator: boolean };
export type AuthenticateResult = { kind: 'ok'; user: JellyfinUser } | { kind: 'refused' | 'unavailable' };

// The AccessToken in the answer is never read: the app keeps no Jellyfin session of its own.
const readAuthentication = (answer: Answer, refused: number[]): AuthenticateResult => {
  if (refused.includes(answer.status)) return { kind: 'refused' };
  if (answer.status !== 200 || !isRecord(answer.body) || !isRecord(answer.body.User)) return { kind: 'unavailable' };
  const { Id, Name, Policy } = answer.body.User;
  if (!nonEmpty(Id) || typeof Name !== 'string' || !isRecord(Policy) || typeof Policy.IsAdministrator !== 'boolean') return { kind: 'unavailable' };
  return { kind: 'ok', user: { userId: Id, userName: Name, isAdministrator: Policy.IsAdministrator } };
};

export const authenticateByName = async (fetchImpl: typeof globalThis.fetch, url: string, username: string, password: string): Promise<AuthenticateResult> => {
  try {
    return readAuthentication(await signInRequest(fetchImpl, url, '/Users/AuthenticateByName', { method: 'POST', body: { Username: username, Pw: password } }), [401]);
  } catch {
    return { kind: 'unavailable' };
  }
};

export const authenticateWithQuickConnect = async (fetchImpl: typeof globalThis.fetch, url: string, secret: string): Promise<AuthenticateResult> => {
  try {
    return readAuthentication(await signInRequest(fetchImpl, url, '/Users/AuthenticateWithQuickConnect', { method: 'POST', body: { Secret: secret } }), [400, 401]);
  } catch {
    return { kind: 'unavailable' };
  }
};

export type QuickConnectInitiateResult = { kind: 'ok'; code: string; secret: string } | { kind: 'off' | 'unavailable' };

export const quickConnectInitiate = async (fetchImpl: typeof globalThis.fetch, url: string): Promise<QuickConnectInitiateResult> => {
  let answer: Answer;
  try {
    answer = await signInRequest(fetchImpl, url, '/QuickConnect/Initiate', { method: 'POST' });
  } catch {
    return { kind: 'unavailable' };
  }
  if (answer.status === 401) return { kind: 'off' };
  if (answer.status !== 200 || !isRecord(answer.body) || typeof answer.body.Code !== 'string' || typeof answer.body.Secret !== 'string') {
    return { kind: 'unavailable' };
  }
  return { kind: 'ok', code: answer.body.Code, secret: answer.body.Secret };
};

export type QuickConnectState = 'pending' | 'approved' | 'expired' | 'unavailable';

export const quickConnectState = async (fetchImpl: typeof globalThis.fetch, url: string, secret: string): Promise<QuickConnectState> => {
  let answer: Answer;
  try {
    answer = await signInRequest(fetchImpl, url, `/QuickConnect/Connect?secret=${encodeURIComponent(secret)}`);
  } catch {
    return 'unavailable';
  }
  if (answer.status === 404) return 'expired';
  if (answer.status !== 200) return 'unavailable';
  return isRecord(answer.body) && answer.body.Authenticated === true ? 'approved' : 'pending';
};
