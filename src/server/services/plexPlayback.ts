import type { DatabaseSync } from 'node:sqlite';
import { readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isOk = (status: number) => status >= 200 && status <= 299;

const containerOf = (body: unknown) => (isRecord(body) && isRecord(body.MediaContainer) ? body.MediaContainer : undefined);

// Who Plex is told is playing. Missing means desktop; the TV app may ask for android, which also names its Android release.
export type PlexIdentity = { kind: 'desktop' } | { kind: 'android'; platformVersion: string };

const DESKTOP: PlexIdentity = { kind: 'desktop' };

// What Plex learns about the player on each playback call; the client id is the player install's own, so Plex sees each
// desktop or TV as its own player.
// The TV keeps Plex Desktop's profile, which allows anything and transcodes to Matroska, under its own name. Plex's
// bundled Android profile caps a transcode at 1080p H.264 and burns in subtitles, even with X-Plex-Client-Profile-Extra
// (checked on the slot's Plex 1.43.4, 31 Oct 2026); Plex's dashboard shows product, platform and device, not the profile.
export const identityValues = (clientId: string, identity: PlexIdentity = DESKTOP): Record<string, string> => ({
  ...(identity.kind === 'desktop'
    ? { 'X-Plex-Product': 'media-manager-2', 'X-Plex-Platform': 'macOS', 'X-Plex-Model': 'standalone' }
    : {
        'X-Plex-Product': 'media-manager-2 TV',
        'X-Plex-Platform': 'Android',
        'X-Plex-Platform-Version': identity.platformVersion,
        'X-Plex-Device': 'Android TV',
      }),
  'X-Plex-Version': '1',
  'X-Plex-Client-Profile-Name': 'Plex Desktop',
  'X-Plex-Features': 'external-media,indirect-media,hub-style-list',
  'X-Plex-Device-Name': 'media-manager-2',
  'X-Plex-Client-Identifier': clientId,
});

type Configuration = { url: string; token: string };

const KEEP_MS = 5 * 60_000;

type Call = {
  method?: 'GET' | 'POST' | 'PUT';
  path: string;
  query?: Record<string, string>;
  timeoutMs?: number;
  sessionIdentifier?: string;
};

export type PlexPlayback = ReturnType<typeof createPlexPlayback>;
/** The calls under one identity. */
export type PlexPlaybackCalls = ReturnType<typeof build>;

type Options = ServiceOptions & { now?: () => number };

type Shared = {
  identity: () => Promise<{ machineIdentifier: string; maxUploadBitrate: number | null }>;
  resources: (clientId: string) => Promise<unknown[]>;
};

// Plex calls for the in-app players. The owner token is always a header; on GET the other identity values go in the
// query, on POST and PUT in headers, as Plex's own desktop client sends them.
const build = (database: DatabaseSync, options: Options, who: PlexIdentity, shared?: Shared) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;

  const readConfiguration = () => {
    const url = readSetting(database, 'serviceAddresses', 'plex.url');
    const token = readSetting(database, 'credentials', 'plex.token');
    return url === undefined || token === undefined ? undefined : { url, token };
  };

  const send = async ({ method = 'GET', path, query = {}, timeoutMs, sessionIdentifier }: Call, clientId?: string) => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error('Plex is not configured.');
    const identity = clientId === undefined ? {} : identityValues(clientId, who);
    const search = new URLSearchParams(method === 'GET' ? { ...query, ...identity } : query).toString();
    const headers: Record<string, string> = {
      ...(method === 'GET' ? {} : identity),
      ...(sessionIdentifier === undefined ? {} : { 'X-Plex-Session-Identifier': sessionIdentifier }),
      'X-Plex-Token': configuration.token,
      Accept: 'application/json',
    };
    const url = configuration.url.replace(/\/+$/, '') + path + (search === '' ? '' : `?${search}`);
    return requestWithTimeout(fetchImpl, url, { method, headers }, timeoutMs);
  };

  // A non-2xx answer keeps its status and is never read as data.
  const json = async (call: Call, clientId?: string): Promise<{ status: number; body: unknown }> => {
    const response = await send(call, clientId);
    if (!isOk(response.status)) return { status: response.status, body: undefined };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { status: response.status, body };
  };

  const container = async (call: Call, clientId: string | undefined, what: string) => {
    const result = await json(call, clientId);
    const body = containerOf(result.body);
    if (!isOk(result.status) || body === undefined) throw new Error(`Plex refused ${what}.`);
    return body;
  };

  // The server identity and plex.tv's server list (the slowest call of every start) rarely change, so each keeps its last
  // good answer with the configuration it was for. Same configuration and younger than 5 minutes: returned as is. Same
  // configuration and older: returned at once while one refresh runs, and a failed refresh leaves the kept answer. No kept
  // answer for this configuration: fetched and waited for, and a failure throws. Nothing expires and no timer runs, so
  // the app page's /api/playback/connections call at load is what refreshes a long-idle answer before the next Play.
  const keeping = <Args extends unknown[], T>(
    keyOf: (configuration: Configuration) => string,
    load: (configuration: Configuration, ...args: Args) => Promise<T>,
  ) => {
    let kept: { key: string; at: number; value: T } | undefined;
    let refreshing = false;
    return async (...args: Args): Promise<T> => {
      const configuration = readConfiguration();
      if (configuration === undefined) throw new Error('Plex is not configured.');
      const key = keyOf(configuration);
      const fetchFresh = async () => {
        const value = await load(configuration, ...args);
        kept = { key, at: now(), value };
        return value;
      };
      const held = kept;
      if (held === undefined || held.key !== key) return fetchFresh();
      if (now() - held.at >= KEEP_MS && !refreshing) {
        refreshing = true;
        fetchFresh().catch(() => {}).finally(() => { refreshing = false; });
      }
      return held.value;
    };
  };

  const identity = shared?.identity ?? keeping(
    ({ url, token }) => `${url}\n${token}`,
    async (): Promise<{ machineIdentifier: string; maxUploadBitrate: number | null }> => {
      const body = await container({ path: '/' }, undefined, 'the server identity');
      if (typeof body.machineIdentifier !== 'string' || body.machineIdentifier === '') throw new Error('Plex refused the server identity.');
      const maxUploadBitrate = typeof body.maxUploadBitrate === 'number' && Number.isFinite(body.maxUploadBitrate) ? body.maxUploadBitrate : null;
      return { machineIdentifier: body.machineIdentifier, maxUploadBitrate };
    },
  );

  const transientToken = async (clientId: string) => {
    const body = await container({ path: '/security/token', query: { type: 'delegation', scope: 'all' } }, clientId, 'a transient token');
    if (typeof body.token !== 'string' || !body.token.startsWith('transient-')) throw new Error('Plex refused a transient token.');
    return body.token;
  };

  const resources = shared?.resources ?? keeping(
    ({ token }) => token,
    async ({ token }, clientId: string): Promise<unknown[]> => {
      const response = await requestWithTimeout(fetchImpl, 'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1', {
        headers: {
          'X-Plex-Token': token,
          'X-Plex-Client-Identifier': clientId,
          'X-Plex-Product': 'media-manager-2',
          Accept: 'application/json',
        },
      });
      if (!isOk(response.status)) throw new Error('plex.tv refused the server list.');
      const body: unknown = await response.json();
      if (!Array.isArray(body)) throw new Error('plex.tv refused the server list.');
      return body;
    },
  );

  const createPlayQueue = async (input: { clientId: string; sessionIdentifier: string; sectionUuid: string; ratingKey: string; continuous: boolean }) => container({
    method: 'POST',
    path: '/playQueues',
    query: {
      type: 'video',
      uri: `library://${input.sectionUuid}/item/${encodeURIComponent(`/library/metadata/${input.ratingKey}`)}`,
      repeat: '0',
      own: '1',
      includeChapters: '1',
      includeMarkers: '1',
      includeGeolocation: '1',
      includeExternalMedia: '1',
      ...(input.continuous ? { continuous: '1' } : {}),
    },
    sessionIdentifier: input.sessionIdentifier,
  }, input.clientId, 'the play queue');

  // Undefined when Plex has no such item.
  const item = async ({ clientId, ratingKey }: { clientId: string; ratingKey: string }): Promise<Record<string, unknown> | undefined> => {
    const result = await json({
      path: `/library/metadata/${ratingKey}`,
      query: Object.fromEntries(['includeChapters', 'includeMarkers', 'checkFiles'].map((name) => [name, '1'])),
      timeoutMs: 60_000,
    }, clientId);
    if (result.status === 404) return undefined;
    const body = containerOf(result.body);
    if (!isOk(result.status) || body === undefined) throw new Error('Plex refused the item.');
    const first = Array.isArray(body.Metadata) ? body.Metadata[0] : undefined;
    // Plex puts the library's UUID on the container, not the item; the play queue needs it.
    return isRecord(first) ? { librarySectionUUID: body.librarySectionUUID, ...first } : undefined;
  };

  // A timeout or network error is { kind: 'failed' }: the caller goes ahead with its own decision.
  const decision = async (input: { clientId: string; params: Record<string, string> }) => {
    try {
      return await json({
        path: '/video/:/transcode/universal/decision',
        query: input.params,
        timeoutMs: 2_000,
      }, input.clientId);
    } catch {
      return { kind: 'failed' as const };
    }
  };

  const timeline = (input: { clientId: string; sessionIdentifier: string; query: Record<string, string> }) => json(
    { path: '/:/timeline', query: input.query, sessionIdentifier: input.sessionIdentifier },
    input.clientId,
  );

  const ping = ({ clientId, session }: { clientId: string; session: string }) => json(
    { path: '/video/:/transcode/universal/ping', query: { session } },
    clientId,
  );

  const stop = ({ clientId, session }: { clientId: string; session: string }) => json(
    { path: '/video/:/transcode/universal/stop', query: { session } },
    clientId,
  );

  const setTrack = (input: { clientId: string; partId: number; kind: 'audio' | 'subtitle'; streamId: number; allParts: boolean }) => json({
    method: 'PUT',
    path: `/library/parts/${input.partId}`,
    query: {
      [input.kind === 'audio' ? 'audioStreamID' : 'subtitleStreamID']: String(input.streamId),
      ...(input.allParts ? { allParts: '1' } : {}),
    },
  }, input.clientId);

  const subtitleOffset = ({ clientId, streamKey, ms }: { clientId: string; streamKey: string; ms: number }) => json(
    { method: 'PUT', path: streamKey, query: { offset: String(ms) } },
    clientId,
  );

  const scrobble = ({ clientId, ratingKey, played }: { clientId: string; ratingKey: string; played: boolean }) => json(
    { path: played ? '/:/scrobble' : '/:/unscrobble', query: { identifier: 'com.plexapp.plugins.library', key: ratingKey } },
    clientId,
  );

  const preview = async (input: { clientId: string; partId: number; ms: number; width: number; height: number }) => {
    const response = await send({
      path: '/photo/:/transcode',
      query: {
        url: `/library/parts/${input.partId}/indexes/sd/${Math.round(input.ms / 1000) * 1000}`,
        width: String(input.width),
        height: String(input.height),
        minSize: '1',
        upscale: '1',
      },
    }, input.clientId);
    if (!isOk(response.status)) return { status: response.status, contentType: null, bytes: null };
    return { status: response.status, contentType: response.headers.get('Content-Type'), bytes: await response.arrayBuffer() };
  };

  const postplay = ({ clientId, ratingKey }: { clientId: string; ratingKey: string }) => container(
    { path: `/hubs/metadata/${ratingKey}/postplay` },
    clientId,
    'the post-play hubs',
  );

  return { identity, transientToken, resources, createPlayQueue, item, decision, timeline, ping, stop, setTrack, subtitleOffset, scrobble, preview, postplay };
};

// The desktop identity's calls, and as() for the same calls under another identity, sharing the kept server identity and
// server list.
export const createPlexPlayback = (database: DatabaseSync, options: Options = {}) => {
  const desktop = build(database, options, DESKTOP);
  return { ...desktop, as: (who: PlexIdentity) => build(database, options, who, { identity: desktop.identity, resources: desktop.resources }) };
};
