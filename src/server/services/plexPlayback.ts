import type { DatabaseSync } from 'node:sqlite';
import { readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isOk = (status: number) => status >= 200 && status <= 299;

const containerOf = (body: unknown) => (isRecord(body) && isRecord(body.MediaContainer) ? body.MediaContainer : undefined);

// What Plex learns about the player on each playback call; the client id is the desktop install's own, so Plex sees each
// desktop as its own player.
export const identityValues = (clientId: string): Record<string, string> => ({
  'X-Plex-Product': 'media-manager-2',
  'X-Plex-Version': '1',
  'X-Plex-Platform': 'macOS',
  'X-Plex-Model': 'standalone',
  'X-Plex-Client-Profile-Name': 'Plex Desktop',
  'X-Plex-Features': 'external-media,indirect-media,hub-style-list',
  'X-Plex-Device-Name': 'media-manager-2',
  'X-Plex-Client-Identifier': clientId,
});

type Call = {
  method?: 'GET' | 'POST' | 'PUT';
  path: string;
  query?: Record<string, string>;
  timeoutMs?: number;
  sessionIdentifier?: string;
};

export type PlexPlayback = ReturnType<typeof createPlexPlayback>;

// Plex calls for the desktop player. The owner token is always a header; on GET the other identity values go in the
// query, on POST and PUT in headers, as Plex's own desktop client sends them.
export const createPlexPlayback = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  const readConfiguration = () => {
    const url = readSetting(database, 'serviceAddresses', 'plex.url');
    const token = readSetting(database, 'credentials', 'plex.token');
    return url === undefined || token === undefined ? undefined : { url, token };
  };

  const send = async ({ method = 'GET', path, query = {}, timeoutMs, sessionIdentifier }: Call, clientId?: string) => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error('Plex is not configured.');
    const identity = clientId === undefined ? {} : identityValues(clientId);
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

  const identity = async (): Promise<{ machineIdentifier: string; maxUploadBitrate: number | null }> => {
    const body = await container({ path: '/' }, undefined, 'the server identity');
    if (typeof body.machineIdentifier !== 'string' || body.machineIdentifier === '') throw new Error('Plex refused the server identity.');
    const maxUploadBitrate = typeof body.maxUploadBitrate === 'number' && Number.isFinite(body.maxUploadBitrate) ? body.maxUploadBitrate : null;
    return { machineIdentifier: body.machineIdentifier, maxUploadBitrate };
  };

  const transientToken = async (clientId: string) => {
    const body = await container({ path: '/security/token', query: { type: 'delegation', scope: 'all' } }, clientId, 'a transient token');
    if (typeof body.token !== 'string' || !body.token.startsWith('transient-')) throw new Error('Plex refused a transient token.');
    return body.token;
  };

  const resources = async (clientId: string): Promise<unknown[]> => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error('Plex is not configured.');
    const response = await requestWithTimeout(fetchImpl, 'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1', {
      headers: {
        'X-Plex-Token': configuration.token,
        'X-Plex-Client-Identifier': clientId,
        'X-Plex-Product': 'media-manager-2',
        Accept: 'application/json',
      },
    });
    if (!isOk(response.status)) throw new Error('plex.tv refused the server list.');
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error('plex.tv refused the server list.');
    return body;
  };

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
      query: Object.fromEntries([
        'includeConcerts', 'includeExtras', 'includeOnDeck', 'includePopularLeaves', 'includePreferences', 'includeChapters',
        'includeStations', 'includeMarkers', 'includeExternalMedia', 'asyncAugmentMetadata', 'checkFiles',
      ].map((name) => [name, '1'])),
      timeoutMs: 60_000,
    }, clientId);
    if (result.status === 404) return undefined;
    const body = containerOf(result.body);
    if (!isOk(result.status) || body === undefined) throw new Error('Plex refused the item.');
    const first = Array.isArray(body.Metadata) ? body.Metadata[0] : undefined;
    return isRecord(first) ? first : undefined;
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
