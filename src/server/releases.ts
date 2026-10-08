import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { createArr } from './services/arr.js';

type Arr = Pick<ReturnType<typeof createArr>, 'request' | 'configured'>;

export type ReleaseTarget =
  | { service: 'radarr'; kind: 'movie'; movieId: number }
  | { service: 'sonarr'; kind: 'episode'; seriesId: number; episodeId: number }
  | { service: 'sonarr'; kind: 'season'; seriesId: number; seasonNumber: number };

export type PastEvent = { kind: 'grabbed' | 'failed' | 'blocklisted'; at: string | null };

export type Release = {
  guid: string;
  indexerId: number;
  indexer: string | null;
  title: string;
  quality: string | null;
  size: number | null;
  ageHours: number | null;
  seeders: number | null;
  leechers: number | null;
  approved: boolean;
  rejections: string[];
  customFormatScore: number;
  customFormats: string[];
  flags: string[];
  protocol: string | null;
  past: PastEvent[];
};

export type StoredSearch = { fetchedAt: number; releases: Release[] };

type Failure = { kind: 'not_configured' | 'unreachable' | 'rejected' };
export type ReleaseResult =
  | { kind: 'ok'; search: StoredSearch }
  | (Failure & { stored: StoredSearch | null });

// Interactive searches ask every indexer and routinely take 20 seconds or more.
const SEARCH_TIMEOUT_MS = 120_000;

// Sonarr sends indexer flags as a bitmask and Radarr as names; both use the same flag set.
const flagBits: Array<[number, string, string]> = [
  [1, 'G_Freeleech', 'Freeleech'],
  [2, 'G_Halfleech', 'Halfleech'],
  [4, 'G_DoubleUpload', 'Double upload'],
  [8, 'PTP_Golden', 'Golden'],
  [16, 'PTP_Approved', 'Approved'],
  [32, 'G_Internal', 'Internal'],
  [128, 'G_Scene', 'Scene'],
  [256, 'G_Freeleech75', 'Freeleech 75%'],
  [512, 'G_Freeleech25', 'Freeleech 25%'],
  [2048, 'Nuked', 'Nuked'],
];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);
const positiveInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value > 0
);

export const targetKey = (target: ReleaseTarget) => (
  target.kind === 'movie' ? `radarr:movie:${target.movieId}`
    : target.kind === 'episode' ? `sonarr:episode:${target.seriesId}:${target.episodeId}`
      : `sonarr:season:${target.seriesId}:${target.seasonNumber}`
);

export const parseTarget = (value: unknown): ReleaseTarget | undefined => {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'movie' && positiveInteger(value.movieId)) return { service: 'radarr', kind: 'movie', movieId: value.movieId };
  if (value.kind === 'episode' && positiveInteger(value.seriesId) && positiveInteger(value.episodeId)) {
    return { service: 'sonarr', kind: 'episode', seriesId: value.seriesId, episodeId: value.episodeId };
  }
  if (
    value.kind === 'season' && positiveInteger(value.seriesId)
    && typeof value.seasonNumber === 'number' && Number.isInteger(value.seasonNumber) && value.seasonNumber >= 0
  ) return { service: 'sonarr', kind: 'season', seriesId: value.seriesId, seasonNumber: value.seasonNumber };
  return undefined;
};

const readFlags = (value: unknown): string[] => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return flagBits.filter(([bit]) => (value & bit) !== 0).map(([, , label]) => label);
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((name) => flagBits.filter(([, key]) => key === name).map(([, , label]) => label));
};

const readRejections = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rejection) => {
    const reason = typeof rejection === 'string' ? text(rejection) : isRecord(rejection) ? text(rejection.reason) : null;
    return reason === null ? [] : [reason];
  });
};

const toRelease = (value: unknown): Release | undefined => {
  if (!isRecord(value)) return undefined;
  const guid = text(value.guid);
  const title = text(value.title);
  if (guid === null || title === null || !positiveInteger(value.indexerId)) return undefined;
  const quality = isRecord(value.quality) && isRecord(value.quality.quality) ? text(value.quality.quality.name) : null;
  const rejections = readRejections(value.rejections);
  return {
    guid,
    indexerId: value.indexerId,
    indexer: text(value.indexer),
    title,
    quality,
    size: count(value.size),
    ageHours: count(value.ageHours) ?? (count(value.age) === null ? null : (value.age as number) * 24),
    seeders: count(value.seeders),
    leechers: count(value.leechers),
    approved: value.approved === true && rejections.length === 0,
    rejections,
    customFormatScore: typeof value.customFormatScore === 'number' && Number.isFinite(value.customFormatScore) ? value.customFormatScore : 0,
    customFormats: Array.isArray(value.customFormats)
      ? value.customFormats.flatMap((format) => (isRecord(format) && text(format.name) !== null ? [text(format.name)!] : []))
      : [],
    flags: readFlags(value.indexerFlags),
    protocol: text(value.protocol),
    past: [],
  };
};

const pastKinds: Record<string, PastEvent['kind']> = { grabbed: 'grabbed', downloadFailed: 'failed' };

// Earlier events are matched on the release's title, the one field history, blocklist
// and a fresh search all carry the same way.
const attachPast = (releases: Release[], history: unknown, blocklist: unknown) => {
  const events = new Map<string, PastEvent[]>();
  const add = (title: unknown, event: PastEvent) => {
    const key = text(title)?.toLowerCase();
    if (key === undefined) return;
    events.set(key, [...(events.get(key) ?? []), event]);
  };
  const historyRecords = Array.isArray(history) ? history : isRecord(history) && Array.isArray(history.records) ? history.records : [];
  for (const record of historyRecords) {
    if (!isRecord(record) || typeof record.eventType !== 'string' || !(record.eventType in pastKinds)) continue;
    add(record.sourceTitle, { kind: pastKinds[record.eventType], at: text(record.date) });
  }
  const blocklistRecords = isRecord(blocklist) && Array.isArray(blocklist.records) ? blocklist.records : [];
  for (const record of blocklistRecords) {
    if (isRecord(record)) add(record.sourceTitle, { kind: 'blocklisted', at: text(record.date) });
  }
  return releases.map((release) => ({ ...release, past: events.get(release.title.toLowerCase()) ?? [] }));
};

const readStored = (database: DatabaseSync, key: string): StoredSearch | null => {
  const row = database.prepare('SELECT fetched_at, releases FROM release_searches WHERE target = ?').get(key);
  if (row === undefined || typeof row.fetched_at !== 'number' || typeof row.releases !== 'string') return null;
  try {
    const releases: unknown = JSON.parse(row.releases);
    return Array.isArray(releases) ? { fetchedAt: row.fetched_at, releases: releases as Release[] } : null;
  } catch {
    return null;
  }
};

export const createReleases = (
  database: DatabaseSync,
  services: { sonarr: Arr; radarr: Arr },
  now: () => number = Date.now,
) => {
  const running = new Map<string, Promise<ReleaseResult>>();

  const searchPaths = (target: ReleaseTarget) => {
    if (target.kind === 'movie') {
      return {
        releases: `/api/v3/release?movieId=${target.movieId}`,
        history: `/api/v3/history/movie?movieId=${target.movieId}`,
        blocklist: `/api/v3/blocklist/movie?movieId=${target.movieId}`,
      };
    }
    const query = target.kind === 'episode'
      ? `episodeId=${target.episodeId}`
      : `seriesId=${target.seriesId}&seasonNumber=${target.seasonNumber}`;
    return {
      releases: `/api/v3/release?${query}`,
      history: `/api/v3/history/series?seriesId=${target.seriesId}${target.kind === 'season' ? `&seasonNumber=${target.seasonNumber}` : ''}`,
      blocklist: `/api/v3/blocklist?page=1&pageSize=1000&seriesIds=${target.seriesId}`,
    };
  };

  const fresh = async (target: ReleaseTarget): Promise<ReleaseResult> => {
    const key = targetKey(target);
    const stored = readStored(database, key);
    const service = services[target.service];
    if (!service.configured()) return { kind: 'not_configured', stored };
    const paths = searchPaths(target);
    let response: { status: number; body: unknown };
    try {
      response = await service.request(paths.releases, { timeoutMs: SEARCH_TIMEOUT_MS });
    } catch {
      return { kind: 'unreachable', stored };
    }
    if (response.status === 401 || response.status === 403) return { kind: 'rejected', stored };
    if (response.status < 200 || response.status > 299 || !Array.isArray(response.body)) return { kind: 'unreachable', stored };
    const releases = response.body.flatMap((item) => {
      const release = toRelease(item);
      return release === undefined ? [] : [release];
    });
    // History and blocklist only add context; losing them must not lose the search.
    const optional = (path: string) => service.request(path).then(
      (result) => (result.status >= 200 && result.status <= 299 ? result.body : undefined),
      () => undefined,
    );
    const [history, blocklist] = await Promise.all([optional(paths.history), optional(paths.blocklist)]);
    const search = { fetchedAt: now(), releases: attachPast(releases, history, blocklist) };
    database.prepare(`
      INSERT INTO release_searches (target, fetched_at, releases) VALUES (?, ?, ?)
      ON CONFLICT (target) DO UPDATE SET fetched_at = excluded.fetched_at, releases = excluded.releases
    `).run(key, search.fetchedAt, JSON.stringify(search.releases));
    return { kind: 'ok', search };
  };

  const refresh = (target: ReleaseTarget) => {
    const key = targetKey(target);
    const existing = running.get(key);
    if (existing !== undefined) return existing;
    const started = fresh(target).finally(() => running.delete(key));
    running.set(key, started);
    return started;
  };

  return {
    // Stored results come back at once with their age; a search runs only when nothing is stored.
    async get(target: ReleaseTarget): Promise<ReleaseResult & { refreshing: boolean }> {
      const stored = readStored(database, targetKey(target));
      if (stored !== null) return { kind: 'ok', search: stored, refreshing: running.has(targetKey(target)) };
      return { ...(await refresh(target)), refreshing: false };
    },
    refresh,
    find(target: ReleaseTarget, guid: string) {
      return readStored(database, targetKey(target))?.releases.find((release) => release.guid === guid);
    },
  };
};

export type Releases = ReturnType<typeof createReleases>;

const respond = (result: ReleaseResult & { refreshing?: boolean }) => {
  if (result.kind === 'ok') {
    return { status: 200 as const, body: { ...result.search, refreshing: result.refreshing ?? false } };
  }
  return {
    status: (result.kind === 'not_configured' ? 503 : 502) as 503 | 502,
    body: { error: result.kind, stored: result.stored },
  };
};

export const createReleaseRoutes = (releases: Releases) => {
  const routes = new Hono();
  routes.get('/', async (context) => {
    const query = context.req.query();
    const target = parseTarget({
      kind: query.kind,
      movieId: Number(query.movieId),
      seriesId: Number(query.seriesId),
      episodeId: Number(query.episodeId),
      seasonNumber: query.seasonNumber === undefined ? undefined : Number(query.seasonNumber),
    });
    if (target === undefined) return context.json({ error: 'invalid_request' }, 400);
    const { status, body } = respond(await releases.get(target));
    return context.json(body, status);
  });
  routes.post('/refresh', async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const target = parseTarget(body);
    if (target === undefined) return context.json({ error: 'invalid_request' }, 400);
    const result = respond(await releases.refresh(target));
    return context.json(result.body, result.status);
  });
  return routes;
};
