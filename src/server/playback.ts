import { randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { identityValues, type PlexIdentity, type PlexPlayback, type PlexPlaybackCalls } from './services/plexPlayback.js';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const records = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);
const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const stringOrNull = (value: unknown) => (typeof value === 'string' ? value : null);
const isOk = (status: number) => status >= 200 && status <= 299;
const bit = (value: boolean) => (value ? '1' : '0');

// Plex's own player menu: network §3.1 table entries 2-10.
const QUALITY_STEPS = [
  { index: 2, kbps: 720, height: 320 },
  { index: 3, kbps: 1500, height: 480 },
  { index: 4, kbps: 2000, height: 720 },
  { index: 5, kbps: 3000, height: 720 },
  { index: 6, kbps: 4000, height: 720 },
  { index: 7, kbps: 8000, height: 1080 },
  { index: 8, kbps: 10000, height: 1080 },
  { index: 9, kbps: 12000, height: 1080 },
  { index: 10, kbps: 20000, height: 1080 },
];
// The tallest version plays by default, the higher bitrate breaking a tie and the earlier entry any other tie, among the
// entries whose first Part is a record. Copied from `playable` in src/server/watchStatus.ts, which does not export it.
const defaultMediaIndex = (mediaList: Array<Record<string, unknown>>) => mediaList
  .reduce<{ index: number; height: number; bitrate: number } | undefined>((top, entry, index) => {
    if (!Array.isArray(entry.Part) || !isRecord(entry.Part[0])) return top;
    const height = numberOrNull(entry.height) ?? 0;
    const bitrate = numberOrNull(entry.bitrate) ?? 0;
    return top === undefined || height > top.height || (height === top.height && bitrate > top.bitrate) ? { index, height, bitrate } : top;
  }, undefined)?.index;

const DIRECT_PLAY_CONTAINERS = new Set(['3gpp', 'asf', 'avi', 'mkv', 'mov', 'mp4', 'mpeg', 'mpegts', 'rm', 'wtv']);
const PICTURE_SUBTITLES = new Set(['pgs', 'vobsub', 'dvd_subtitle', 'idx']);

/** The server's addresses from plex.tv's list, direct first and relay last, and how many are direct. */
const addressesOf = (resources: unknown[], machineIdentifier: string) => {
  const server = records(resources).find((resource) => resource.clientIdentifier === machineIdentifier);
  const connections = records(server?.connections).filter((connection) => typeof connection.uri === 'string');
  const direct = connections.filter((connection) => connection.relay !== true);
  const uris = [...direct, ...connections.filter((connection) => connection.relay === true)]
    .map((connection) => (connection.uri as string).replace(/\/+$/, ''));
  return { uris, directCount: direct.length };
};

type Reply = { status: 200 | 404 | 409 | 502; body: unknown } | { status: 204 };
const unavailable: Reply = { status: 502, body: { error: 'plex_unavailable' } };

export type StartInput = {
  ratingKey: string;
  /** Left out, the default version plays and the reply's `mediaIndex` names it. */
  mediaIndex?: number;
  partIndex: number;
  offsetSeconds: number;
  /** True: start from Plex's saved position, not `offsetSeconds`. */
  resume?: boolean;
  directPlay: boolean;
  directStream: boolean;
  directStreamAudio: boolean;
  maxVideoBitrate?: number;
  clientId: string;
  sessionIdentifier: string;
};

type Plan = { directPlay: boolean; directStream: boolean; directStreamAudio: boolean };

export type Playback = ReturnType<typeof createPlayback>;

const buildPlayback = (plexPlayback: PlexPlaybackCalls, enabled: () => boolean, who: PlexIdentity) => {
  // Every Plex failure is 502; a thrown request is one too.
  const guarded = async (run: () => Promise<Reply>): Promise<Reply> => {
    try {
      return await run();
    } catch {
      return unavailable;
    }
  };

  const start = async (input: StartInput, desktop: boolean): Promise<Reply> => {
    const { clientId, sessionIdentifier, ratingKey, maxVideoBitrate } = input;
    const [itemResult, tokenResult, resourcesResult, identityResult] = await Promise.allSettled([
      plexPlayback.item({ clientId, ratingKey }),
      plexPlayback.transientToken(clientId),
      plexPlayback.resources(clientId),
      plexPlayback.identity(),
    ]);
    if (resourcesResult.status === 'rejected') return { status: 502, body: { error: 'plex_tv_unavailable' } };
    if (itemResult.status === 'rejected' || tokenResult.status === 'rejected' || identityResult.status === 'rejected') return unavailable;
    const record = itemResult.value;
    const transient = tokenResult.value;
    const { machineIdentifier, maxUploadBitrate } = identityResult.value;
    const mediaList = record === undefined ? [] : records(record.Media);
    const mediaIndex = input.mediaIndex ?? defaultMediaIndex(mediaList);
    const media = mediaIndex === undefined ? undefined : mediaList[mediaIndex];
    const part = media === undefined ? undefined : records(media.Part)[input.partIndex];
    if (record === undefined || mediaIndex === undefined || media === undefined || part === undefined || typeof part.key !== 'string'
      || typeof record.librarySectionUUID !== 'string') return { status: 404, body: { error: 'not_found' } };
    // Plex clears viewOffset once an item is watched, so resuming a watched one starts at 0.
    const startSeconds = input.resume === true ? Math.floor((numberOrNull(record.viewOffset) ?? 0) / 1000) : input.offsetSeconds;

    const { uris, directCount } = addressesOf(resourcesResult.value, machineIdentifier);
    if (uris.length === 0) return { status: 502, body: { error: 'plex_tv_unavailable' } };

    // The play queue is made after the item fetch, which gives its section UUID. Only the reply needs it, so it runs beside
    // the decision; the catch keeps a failure from going unhandled when the decision returns first.
    const queueRequest = plexPlayback.createPlayQueue({
      clientId, sessionIdentifier, sectionUuid: record.librarySectionUUID, ratingKey, continuous: record.type === 'episode',
    });
    queueRequest.catch(() => {});

    const fileKbps = numberOrNull(media.bitrate);
    // A remote server applies a low default cap and refuses direct play without one, so Original sends the file's bitrate
    // plus 10%, or 2,000,000 kbps when it is unknown (plax-lessons.md, "Original over a remote connection").
    const sentBitrate = maxVideoBitrate ?? (fileKbps === null ? 2_000_000 : Math.ceil(fileKbps * 1.1));
    let plan: Plan = {
      directPlay: input.directPlay && (maxVideoBitrate === undefined || (fileKbps !== null && maxVideoBitrate >= fileKbps))
        && typeof media.container === 'string' && DIRECT_PLAY_CONTAINERS.has(media.container) && part.exists !== false && part.accessible !== false,
      directStream: input.directStream && (maxVideoBitrate === undefined || (typeof media.bitrate === 'number' && media.bitrate <= maxVideoBitrate)),
      directStreamAudio: input.directStreamAudio,
    };
    // Each decision is a new transcode session; the last one belongs to the plan that plays.
    let session = randomUUID();
    const paramsFor = ({ directPlay, directStream, directStreamAudio }: Plan): Record<string, string> => ({
      hasMDE: '1',
      path: `/library/metadata/${ratingKey}`,
      mediaIndex: String(mediaIndex),
      partIndex: String(input.partIndex),
      protocol: 'http',
      fastSeek: '1',
      directPlay: bit(directPlay),
      directStream: bit(directStream),
      directStreamAudio: bit(directStreamAudio),
      location: 'wan',
      offset: String(startSeconds),
      copyts: '1',
      ...(directPlay ? {} : { 'X-Plex-Chunked': '1' }),
      'X-Plex-Incomplete-Segments': '1',
      subtitles: directPlay ? 'none' : 'auto',
      advancedSubtitles: 'text',
      subtitleSize: '100',
      audioBoost: '100',
      autoAdjustQuality: '0',
      maxVideoBitrate: String(sentBitrate),
      session,
      'X-Plex-Session-Identifier': sessionIdentifier,
    });
    // Plex's answer only confirms the plan: a failed or non-2xx decision leaves it as it is.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const answer = await plexPlayback.decision({ clientId, params: paramsFor(plan) });
      if ('kind' in answer || !isOk(answer.status) || !isRecord(answer.body) || !isRecord(answer.body.MediaContainer)) break;
      const body = answer.body.MediaContainer;
      const codes = {
        generalDecisionCode: numberOrNull(body.generalDecisionCode),
        mdeDecisionCode: numberOrNull(body.mdeDecisionCode),
        transcodeDecisionCode: numberOrNull(body.transcodeDecisionCode),
        directPlayDecisionCode: numberOrNull(body.directPlayDecisionCode),
      };
      // Plex's own client never reads directPlayDecisionCode; a refused direct play (3000) comes with 1001 and falls back below.
      const refused = [codes.generalDecisionCode, codes.mdeDecisionCode, codes.transcodeDecisionCode].some((code) => code !== null && code >= 2000);
      if (refused) return { status: 409, body: { error: 'plex_refused', codes } };
      if (attempt > 0 || codes.generalDecisionCode !== 1001 || !plan.directPlay) break;
      plan = { ...plan, directPlay: false };
      session = randomUUID();
    }
    const queue = await queueRequest;

    const identity = new URLSearchParams(identityValues(clientId, who)).toString();
    const token = new URLSearchParams({ 'X-Plex-Token': transient }).toString();
    const streamAddresses = uris.map((uri) => (plan.directPlay
      ? `${uri}${part.key}?${new URLSearchParams({ 'X-Plex-Session-Identifier': sessionIdentifier })}&${token}&${identity}`
      : `${uri}/video/:/transcode/universal/start?${new URLSearchParams(paramsFor(plan))}&${identity}&${token}`));

    const streams = records(part.Stream);
    const audio = streams.filter((stream) => stream.streamType === 2);
    const subtitles = streams.filter((stream) => stream.streamType === 3);
    const external = subtitles.filter((stream) => typeof stream.key === 'string');
    const embedded = subtitles.filter((stream) => typeof stream.key !== 'string')
      .sort((a, b) => (numberOrNull(a.index) ?? 0) - (numberOrNull(b.index) ?? 0));
    const subtitleUrl = (stream: Record<string, unknown>) => {
      const codec = stringOrNull(stream.codec);
      const idx = codec === 'idx' || stream.format === 'idx';
      const picture = idx || (codec !== null && PICTURE_SUBTITLES.has(codec));
      return `${uris[0]}${stream.key as string}${idx ? '.idx' : ''}?${token}${picture ? '' : '&encoding=utf-8'}`;
    };
    const track = (stream: Record<string, unknown>, index: number) => ({
      id: numberOrNull(stream.id),
      index,
      ffIndex: numberOrNull(stream.index),
      codec: stringOrNull(stream.codec),
      language: stringOrNull(stream.language),
      title: stringOrNull(stream.title),
      selected: stream.selected === true,
      default: stream.default === true,
    });
    const mediaHeight = numberOrNull(media.height);
    const video = streams.find((stream) => stream.streamType === 1);
    const dynamicRange = video === undefined ? null
      : video.DOVIPresent === true ? 'dolby_vision'
        : video.colorTrc === 'smpte2084' ? 'hdr10'
          : video.colorTrc === 'arib-std-b67' ? 'hlg' : 'sdr';
    const file = {
      width: numberOrNull(media.width),
      height: mediaHeight,
      videoCodec: stringOrNull(media.videoCodec),
      bitrateKbps: fileKbps,
      dynamicRange,
      dolbyVisionProfile: dynamicRange === 'dolby_vision' ? numberOrNull(video?.DOVIProfile) : null,
    };
    const qualitySteps = QUALITY_STEPS.filter((step) => (mediaHeight === null || step.height <= mediaHeight)
      && (maxUploadBitrate === null || step.kbps <= maxUploadBitrate));

    return {
      status: 200,
      body: {
        session,
        partId: numberOrNull(part.id),
        mediaIndex,
        startPositionSeconds: startSeconds,
        durationMs: numberOrNull(record.duration),
        decision: { ...plan, maxVideoBitrate: maxVideoBitrate ?? null },
        playQueue: {
          playQueueID: numberOrNull(queue.playQueueID),
          playQueueSelectedItemID: numberOrNull(queue.playQueueSelectedItemID),
          playQueueSelectedItemOffset: numberOrNull(queue.playQueueSelectedItemOffset),
          playQueueTotalCount: numberOrNull(queue.playQueueTotalCount),
          playQueueVersion: numberOrNull(queue.playQueueVersion),
          playQueueShuffled: queue.playQueueShuffled === true,
          allowShuffle: queue.allowShuffle === true,
          playQueueSourceURI: stringOrNull(queue.playQueueSourceURI),
          playQueueLastAddedItemID: numberOrNull(queue.playQueueLastAddedItemID),
          items: records(queue.Metadata).map((entry) => ({
            playQueueItemID: numberOrNull(entry.playQueueItemID),
            ratingKey: stringOrNull(entry.ratingKey),
            type: stringOrNull(entry.type),
            title: stringOrNull(entry.title),
            grandparentTitle: stringOrNull(entry.grandparentTitle),
            parentIndex: numberOrNull(entry.parentIndex),
            index: numberOrNull(entry.index),
            duration: numberOrNull(entry.duration),
          })),
        },
        tracks: {
          audio: audio.map((stream, position) => track(stream, position)),
          subtitle: subtitles.map((stream) => {
            const isExternal = typeof stream.key === 'string';
            const index = !plan.directPlay ? 0 : isExternal ? external.indexOf(stream) : embedded.indexOf(stream);
            return {
              ...track(stream, index),
              external: isExternal,
              key: stringOrNull(stream.key),
              offsetMs: numberOrNull(stream.offset),
              ...(desktop && isExternal ? { url: subtitleUrl(stream) } : {}),
            };
          }),
        },
        markers: records(record.Marker).map((marker) => ({
          type: stringOrNull(marker.type),
          startTimeOffset: numberOrNull(marker.startTimeOffset),
          endTimeOffset: numberOrNull(marker.endTimeOffset),
        })),
        chapters: records(record.Chapter).map((chapter) => ({
          index: numberOrNull(chapter.index),
          title: stringOrNull(chapter.tag),
          startTimeOffset: numberOrNull(chapter.startTimeOffset),
          endTimeOffset: numberOrNull(chapter.endTimeOffset),
        })),
        file,
        qualitySteps,
        // The server's id and the direct addresses' count let the desktop app test Plex's addresses without asking again.
        ...(desktop ? { streamAddresses, directAddressCount: directCount, machineIdentifier } : {}),
      },
    };
  };

  // The server's addresses with no token, so the desktop app can test them when it opens rather than at Play.
  const connections = async (clientId: string): Promise<Reply> => {
    const [list, { machineIdentifier }] = await Promise.all([plexPlayback.resources(clientId), plexPlayback.identity()]);
    const { uris, directCount } = addressesOf(list, machineIdentifier);
    if (uris.length === 0) return { status: 502, body: { error: 'plex_tv_unavailable' } };
    return { status: 200, body: { machineIdentifier, origins: uris, directCount } };
  };

  const timeline = async (input: {
    ratingKey: string; state: string; time: number; duration: number; playbackTime: number;
    clientId: string; sessionIdentifier: string; playQueueItemID?: number; continuing: boolean;
  }): Promise<Reply> => {
    const result = await plexPlayback.timeline({
      clientId: input.clientId,
      sessionIdentifier: input.sessionIdentifier,
      query: {
        ratingKey: input.ratingKey,
        key: `/library/metadata/${input.ratingKey}`,
        state: input.state,
        time: String(input.time),
        duration: String(input.duration),
        playbackTime: String(input.playbackTime),
        ...(input.playQueueItemID === undefined ? {} : { playQueueItemID: String(input.playQueueItemID) }),
        ...(input.continuing ? { continuing: '1' } : {}),
        hasMDE: '1',
      },
    });
    if (!isOk(result.status)) return unavailable;
    const body = isRecord(result.body) && isRecord(result.body.MediaContainer) ? result.body.MediaContainer : {};
    return { status: 200, body: { ok: true, terminationCode: numberOrNull(body.terminationCode), terminationText: stringOrNull(body.terminationText) } };
  };

  const ping = async (input: { clientId: string; session: string }): Promise<Reply> => {
    const { status } = await plexPlayback.ping(input);
    if (isOk(status)) return { status: 200, body: { status: 'ok' } };
    return status === 404 ? { status: 200, body: { status: 'gone' } } : unavailable;
  };

  const stop = async (input: { clientId: string; session: string }): Promise<Reply> => {
    const { status } = await plexPlayback.stop(input);
    return isOk(status) || status === 404 ? { status: 204 } : unavailable;
  };

  const done = async (call: Promise<{ status: number }>): Promise<Reply> => (isOk((await call).status) ? { status: 204 } : unavailable);

  const postplay = async (input: { clientId: string; ratingKey: string }): Promise<Reply> => {
    const body = await plexPlayback.postplay(input);
    return {
      status: 200,
      body: {
        hubs: records(body.Hub).map((hub) => ({
          hubIdentifier: stringOrNull(hub.hubIdentifier),
          title: stringOrNull(hub.title),
          items: records(hub.Metadata).map((entry) => ({
            ratingKey: stringOrNull(entry.ratingKey),
            type: stringOrNull(entry.type),
            title: stringOrNull(entry.title),
            grandparentTitle: stringOrNull(entry.grandparentTitle),
            parentIndex: numberOrNull(entry.parentIndex),
            index: numberOrNull(entry.index),
            duration: numberOrNull(entry.duration),
            viewOffset: numberOrNull(entry.viewOffset),
          })),
        })),
      },
    };
  };

  return {
    enabled,
    start: (input: StartInput, desktop: boolean) => guarded(() => start(input, desktop)),
    connections: (clientId: string) => guarded(() => connections(clientId)),
    timeline: (input: Parameters<typeof timeline>[0]) => guarded(() => timeline(input)),
    ping: (input: Parameters<typeof ping>[0]) => guarded(() => ping(input)),
    stop: (input: Parameters<typeof stop>[0]) => guarded(() => stop(input)),
    track: (input: Parameters<PlexPlaybackCalls['setTrack']>[0]) => guarded(() => done(plexPlayback.setTrack(input))),
    subtitleOffset: (input: Parameters<PlexPlaybackCalls['subtitleOffset']>[0]) => guarded(() => done(plexPlayback.subtitleOffset(input))),
    played: (input: Parameters<PlexPlaybackCalls['scrobble']>[0]) => guarded(() => done(plexPlayback.scrobble(input))),
    preview: (input: Parameters<PlexPlaybackCalls['preview']>[0]) => plexPlayback.preview(input).catch(() => ({ status: 502, contentType: null, bytes: null })),
    postplay: (input: Parameters<typeof postplay>[0]) => guarded(() => postplay(input)),
  };
};

// The desktop's playback, and as() for the same routes under the identity a TV asks for.
export const createPlayback = ({ plexPlayback, enabled }: { plexPlayback: PlexPlayback; enabled: () => boolean }) => ({
  ...buildPlayback(plexPlayback, enabled, { kind: 'desktop' }),
  as: (who: PlexIdentity) => buildPlayback(plexPlayback.as(who), enabled, who),
});

const PLATFORM_VERSION = /^\d{1,3}(\.\d{1,3}){0,2}$/;

// X-Media-Manager-Plex-Identity: missing or desktop is the desktop; android needs X-Media-Manager-Platform-Version, the
// TV's Android release. Anything else is undefined, a bad request.
const identityOf = (header: (name: string) => string | undefined): PlexIdentity | undefined => {
  const kind = header('X-Media-Manager-Plex-Identity');
  if (kind === undefined || kind === 'desktop') return { kind: 'desktop' };
  const platformVersion = header('X-Media-Manager-Platform-Version');
  if (kind !== 'android' || platformVersion === undefined || !PLATFORM_VERSION.test(platformVersion)) return undefined;
  return { kind: 'android', platformVersion };
};

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const QUALITY_KBPS = new Set(QUALITY_STEPS.map((step) => step.kbps));
const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);
const isRatingKey = (value: unknown): value is string => typeof value === 'string' && /^\d+$/.test(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
// A query value as a non-negative integer, else null.
const count = (value: string | undefined) => (value !== undefined && /^\d{1,15}$/.test(value) ? Number(value) : null);

// A JSON body with every required key, no unknown one, and the optional ones only when present.
const readBody = async (context: Context, required: string[], optional: string[] = []) => {
  let value: unknown;
  try {
    value = await context.req.json();
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (required.some((key) => !keys.includes(key)) || keys.some((key) => !required.includes(key) && !optional.includes(key))) return undefined;
  return value;
};

export const createPlaybackRoutes = (playback: Playback) => {
  const routes = new Hono();
  const invalid = { error: 'invalid_request' };
  const send = (context: Context, reply: Reply) => (reply.status === 204 ? context.body(null, 204) : context.json(reply.body, reply.status));

  routes.use('*', async (context, next) => {
    if (!playback.enabled()) return context.json({ error: 'not_configured' }, 503);
    if (identityOf((name) => context.req.header(name)) === undefined) return context.json(invalid, 400);
    await next();
  });
  // The playback for this request's identity; the guard above has refused a bad one.
  const on = (context: Context) => {
    const who = identityOf((name) => context.req.header(name));
    return who === undefined || who.kind === 'desktop' ? playback : playback.as(who);
  };

  // X-Media-Manager-Desktop: 1 adds the stream addresses, for the desktop's main process and the TV app; page JS could send it too, so this
  // keeps addresses out of the page's ordinary replies (state, devtools, logs) rather than defending against the page.
  routes.post('/start', async (context) => {
    const body = await readBody(context, [
      'ratingKey', 'partIndex', 'offsetSeconds', 'directPlay', 'directStream', 'directStreamAudio', 'clientId', 'sessionIdentifier',
    ], ['maxVideoBitrate', 'mediaIndex', 'resume']);
    if (body === undefined) return context.json(invalid, 400);
    const {
      ratingKey, mediaIndex, partIndex, offsetSeconds, resume, directPlay, directStream, directStreamAudio, maxVideoBitrate, clientId, sessionIdentifier,
    } = body;
    if (!isRatingKey(ratingKey) || (mediaIndex !== undefined && !isCount(mediaIndex)) || !isCount(partIndex)
      || typeof offsetSeconds !== 'number' || !Number.isFinite(offsetSeconds) || offsetSeconds < 0
      || (resume !== undefined && !isBoolean(resume))
      || !isBoolean(directPlay) || !isBoolean(directStream) || !isBoolean(directStreamAudio)
      || (maxVideoBitrate !== undefined && (typeof maxVideoBitrate !== 'number' || !QUALITY_KBPS.has(maxVideoBitrate)))
      || !isId(clientId) || !isId(sessionIdentifier)) return context.json(invalid, 400);
    const input: StartInput = {
      ratingKey, partIndex, offsetSeconds, directPlay, directStream, directStreamAudio, clientId, sessionIdentifier,
      ...(mediaIndex === undefined ? {} : { mediaIndex }),
      ...(resume === undefined ? {} : { resume }),
      ...(maxVideoBitrate === undefined ? {} : { maxVideoBitrate }),
    };
    return send(context, await on(context).start(input, context.req.header('X-Media-Manager-Desktop') === '1'));
  });

  // Bare origins with no token, unlike the start reply's addresses, so this needs no desktop header: the page may see them.
  routes.get('/connections', async (context) => {
    const clientId = context.req.query('clientId');
    if (!isId(clientId)) return context.json(invalid, 400);
    return send(context, await on(context).connections(clientId));
  });

  // A GET, so the last report when the window closes needs no X-Requested-With.
  routes.get('/timeline', async (context) => {
    // A GET skips the app's origin check and the Lax session cookie rides a cross-site link, so another site could move the owner's progress.
    if (context.req.header('Sec-Fetch-Site')?.toLowerCase() === 'cross-site') return context.json({ error: 'forbidden' }, 403);
    const query = context.req.query();
    const [time, duration, playbackTime] = [count(query.time), count(query.duration), count(query.playbackTime)];
    const playQueueItemID = count(query.playQueueItemID);
    if (!isRatingKey(query.ratingKey) || !['playing', 'paused', 'buffering', 'stopped'].includes(query.state ?? '')
      || time === null || duration === null || playbackTime === null || !isId(query.clientId) || !isId(query.sessionIdentifier)
      || (query.playQueueItemID !== undefined && playQueueItemID === null)
      || (query.continuing !== undefined && query.continuing !== '1')) return context.json(invalid, 400);
    return send(context, await on(context).timeline({
      ratingKey: query.ratingKey,
      state: query.state as string,
      time,
      duration,
      playbackTime,
      clientId: query.clientId,
      sessionIdentifier: query.sessionIdentifier,
      ...(playQueueItemID === null ? {} : { playQueueItemID }),
      continuing: query.continuing === '1',
    }));
  });

  routes.get('/ping', async (context) => {
    const { session, clientId } = context.req.query();
    if (!isId(session) || !isId(clientId)) return context.json(invalid, 400);
    return send(context, await on(context).ping({ session, clientId }));
  });

  routes.post('/stop', async (context) => {
    const body = await readBody(context, ['session', 'clientId']);
    if (body === undefined || !isId(body.session) || !isId(body.clientId)) return context.json(invalid, 400);
    return send(context, await on(context).stop({ session: body.session, clientId: body.clientId }));
  });

  routes.post('/track', async (context) => {
    const body = await readBody(context, ['partId', 'kind', 'streamId', 'allParts', 'clientId']);
    if (body === undefined) return context.json(invalid, 400);
    const { partId, kind, streamId, allParts, clientId } = body;
    if (!isCount(partId) || (kind !== 'audio' && kind !== 'subtitle') || !isCount(streamId) || !isBoolean(allParts) || !isId(clientId)) {
      return context.json(invalid, 400);
    }
    return send(context, await on(context).track({ partId, kind, streamId, allParts, clientId }));
  });

  routes.post('/subtitle-offset', async (context) => {
    const body = await readBody(context, ['streamKey', 'offsetMs', 'clientId']);
    if (body === undefined) return context.json(invalid, 400);
    const { streamKey, offsetMs, clientId } = body;
    // A subtitle can run early or late, so the offset may be negative.
    if (typeof streamKey !== 'string' || !/^\/library\/streams\/\d+$/.test(streamKey)
      || typeof offsetMs !== 'number' || !Number.isSafeInteger(offsetMs) || !isId(clientId)) return context.json(invalid, 400);
    return send(context, await on(context).subtitleOffset({ streamKey, ms: offsetMs, clientId }));
  });

  routes.post('/played', async (context) => {
    const body = await readBody(context, ['ratingKey', 'played', 'clientId']);
    if (body === undefined) return context.json(invalid, 400);
    const { ratingKey, played, clientId } = body;
    if (!isRatingKey(ratingKey) || !isBoolean(played) || !isId(clientId)) return context.json(invalid, 400);
    return send(context, await on(context).played({ ratingKey, played, clientId }));
  });

  routes.get('/preview', async (context) => {
    const query = context.req.query();
    const [partId, ms, width, height] = [count(query.partId), count(query.ms), count(query.width), count(query.height)];
    if (partId === null || ms === null || width === null || height === null || width < 1 || width > 1920 || height < 1 || height > 1920
      || !isId(query.clientId)) return context.json(invalid, 400);
    const result = await on(context).preview({ partId, ms, width, height, clientId: query.clientId });
    if (isOk(result.status) && result.bytes !== null) {
      return context.body(result.bytes, 200, { 'Content-Type': result.contentType ?? 'application/octet-stream' });
    }
    return result.status === 404 ? context.json({ error: 'not_found' }, 404) : context.json({ error: 'plex_unavailable' }, 502);
  });

  routes.get('/postplay', async (context) => {
    const { ratingKey, clientId } = context.req.query();
    if (!isRatingKey(ratingKey) || !isId(clientId)) return context.json(invalid, 400);
    return send(context, await on(context).postplay({ ratingKey, clientId }));
  });

  return routes;
};
