import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { createLabels } from './labels.js';
import { listOpenProblems, type Problem, type Subject } from './problems.js';
import type { ReleaseTarget } from './releases.js';
import { searchDueAt } from './searches.js';
import { findGrab, listGrabs, listQueue, type Grab, type Service } from './torrentGrabs.js';

type ArrRequest = (path: string, init?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }) => Promise<{ status: number; body: unknown }>;
type Labels = ReturnType<typeof createLabels>;
type WantedType = 'movie' | 'episode';

export type FlaggedAction =
  | { kind: 'pick_release'; target: ReleaseTarget; title: string }
  | { kind: 'search'; service: Service; type: WantedType; ids: number[] }
  | { kind: 'manual_import'; service: Service; downloadId: string }
  | { kind: 'open_health' };

export type FlaggedItem = { problem: Problem; kindWord: string; label: string; detail: string; actions: FlaggedAction[] };

export type Wanted = {
  service: Service;
  type: WantedType;
  id: number;
  seriesId: number | null;
  title: string;
  availableAt: number | null;
  lastSearchAt: number | null;
  nextSearchAt: number | null;
  lastResult: string;
  inQueue: boolean;
};

const PAGE_SIZE = 500;
const WEEK_MS = 7 * 24 * 60 * 60_000;
const serviceTypes: Record<Service, WantedType> = { sonarr: 'episode', radarr: 'movie' };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const time = (value: unknown) => {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? null : parsed;
};
const code = (season: unknown, episode: unknown) => `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
const key = (service: Service, type: WantedType, id: number) => `${service}:${type}:${id}`;

export const createFlagged = (options: {
  database: DatabaseSync;
  arr: Record<Service, { request: ArrRequest }>;
  labels: Labels;
  isManualDownload: (subject: Subject) => boolean;
  now?: () => number;
}) => {
  const { database, arr, labels, isManualDownload } = options;
  const now = options.now ?? Date.now;

  const searchAction = (service: Service, ids: number[]): FlaggedAction => ({ kind: 'search', service, type: serviceTypes[service], ids });

  // A movie or a single episode can have a release picked by hand; several episodes can only be searched together.
  const grabActions = async (grab: Grab): Promise<FlaggedAction[]> => {
    if (grab.service === 'radarr' && grab.movieId !== null) {
      const title = await labels.movie(grab.movieId);
      return [{ kind: 'pick_release', target: { service: 'radarr', kind: 'movie', movieId: grab.movieId }, title }, searchAction('radarr', [grab.movieId])];
    }
    if (grab.service === 'sonarr' && grab.episodeIds.length === 1 && grab.seriesId !== null) {
      const [episodeId] = grab.episodeIds;
      const title = await labels.episode(episodeId);
      return [
        { kind: 'pick_release', target: { service: 'sonarr', kind: 'episode', seriesId: grab.seriesId, episodeId }, title },
        searchAction('sonarr', [episodeId]),
      ];
    }
    return grab.episodeIds.length > 0 ? [searchAction('sonarr', grab.episodeIds)] : [];
  };

  const episodeSeries = async (episodeId: number, hash: string | null) => {
    const grabbed = hash === null ? undefined : findGrab(database, hash)?.seriesId;
    if (grabbed !== undefined && grabbed !== null) return grabbed;
    try {
      const { status, body } = await arr.sonarr.request(`/api/v3/episode/${episodeId}`);
      return status >= 200 && status <= 299 && isRecord(body) && typeof body.seriesId === 'number' ? body.seriesId : null;
    } catch {
      return null;
    }
  };

  const actionsFor = async (problem: Problem, label: string): Promise<FlaggedAction[]> => {
    const { subject } = problem;
    if (problem.kind === 'tracker_cooldown' || subject.type === 'tracker' || subject.type === 'dependency') return [{ kind: 'open_health' }];
    if (subject.type === 'movie') {
      const movieId = Number(subject.id);
      return [{ kind: 'pick_release', target: { service: 'radarr', kind: 'movie', movieId }, title: label }, searchAction('radarr', [movieId])];
    }
    if (subject.type === 'episode') {
      const episodeId = Number(subject.id);
      const seriesId = await episodeSeries(episodeId, problem.hash);
      const search = searchAction('sonarr', [episodeId]);
      return seriesId === null
        ? [search]
        : [{ kind: 'pick_release', target: { service: 'sonarr', kind: 'episode', seriesId, episodeId }, title: label }, search];
    }
    const grab = findGrab(database, subject.id);
    if (grab === undefined) return [];
    const manual: FlaggedAction[] = problem.kind.startsWith('import_') ? [{ kind: 'manual_import', service: grab.service, downloadId: grab.hash }] : [];
    return [...manual, ...await grabActions(grab)];
  };

  const needsYou = async () => {
    const open = listOpenProblems(database);
    const items = await Promise.all(open.filter((problem) => problem.state === 'needs_you').map(async (problem): Promise<FlaggedItem> => {
      const label = await labels.subject(problem.subject, database);
      return {
        problem,
        kindWord: problem.kind.replaceAll('_', ' ').toUpperCase(),
        label,
        detail: problem.steps.at(-1)?.text ?? problem.summary,
        actions: await actionsFor(problem, label),
      };
    }));
    const handled = database.prepare('SELECT COUNT(*) AS count FROM problems WHERE resolved_at >= ?').get(now() - WEEK_MS);
    return {
      items,
      handlingCount: open.filter((problem) => problem.state === 'handling').length,
      handledThisWeek: Number(handled?.count ?? 0),
    };
  };

  type WantedRecord = { id: number; seriesId: number | null; title: string; availableAt: number | null; addedAt: number; lastSearchAt: number | null };

  const readPages = async (service: Service, path: string, filters: string, read: (record: Record<string, unknown>) => WantedRecord | undefined) => {
    const records: WantedRecord[] = [];
    for (let page = 1; ; page += 1) {
      const { status, body } = await arr[service].request(`${path}?page=${page}&pageSize=${PAGE_SIZE}&${filters}`);
      if (status < 200 || status > 299 || !isRecord(body) || !Array.isArray(body.records)) throw new Error(`${service} wanted list could not be read.`);
      for (const record of body.records) {
        const item = isRecord(record) && typeof record.id === 'number' ? read(record) : undefined;
        if (item !== undefined) records.push(item);
      }
      const total = typeof body.totalRecords === 'number' ? body.totalRecords : 0;
      if (body.records.length < PAGE_SIZE || page * PAGE_SIZE >= total) return records;
    }
  };

  const readEpisode = (record: Record<string, unknown>): WantedRecord => {
    const series = isRecord(record.series) ? record.series : {};
    return {
      id: record.id as number,
      seriesId: typeof record.seriesId === 'number' ? record.seriesId : null,
      title: `${typeof series.title === 'string' ? series.title : 'Episode'} ${code(record.seasonNumber, record.episodeNumber)}`,
      availableAt: time(record.airDateUtc),
      addedAt: time(series.added) ?? 0,
      lastSearchAt: time(record.lastSearchTime),
    };
  };

  // Radarr reports isAvailable but not since when; the search scheduler records the first check that saw a movie available.
  const readMovie = (record: Record<string, unknown>): WantedRecord => {
    const seen = database.prepare('SELECT seen_at FROM availability_seen WHERE subject = ?').get(key('radarr', 'movie', record.id as number));
    return {
      id: record.id as number,
      seriesId: null,
      title: `${typeof record.title === 'string' ? record.title : 'Movie'} (${String(record.year)})`,
      availableAt: seen === undefined ? null : Number(seen.seen_at),
      addedAt: time(record.added) ?? 0,
      lastSearchAt: time(record.lastSearchTime),
    };
  };

  const toWanted = (service: Service, record: WantedRecord): Wanted => {
    const type = serviceTypes[service];
    const ours = database.prepare('SELECT searched_at FROM search_log WHERE subject = ?').get(key(service, type, record.id));
    const known = [record.lastSearchAt, ours === undefined ? null : Number(ours.searched_at)].filter((value): value is number => value !== null);
    const lastSearchAt = known.length === 0 ? null : Math.max(...known);
    const inQueue = listQueue(database).some((item) => item.service === service && (type === 'movie' ? item.movieId : item.episodeId) === record.id);
    const grab = lastSearchAt === null ? undefined : listGrabs(database).filter((candidate) => candidate.service === service
      && candidate.grabbedAt >= lastSearchAt
      && (type === 'movie' ? candidate.movieId === record.id : candidate.episodeIds.includes(record.id))).at(-1);
    const lastResult = inQueue ? 'in queue'
      : lastSearchAt === null ? 'never searched'
        : grab !== undefined ? `grabbed ${grab.releaseTitle}` : 'nothing grabbed';
    return {
      service,
      type,
      id: record.id,
      seriesId: record.seriesId,
      title: record.title,
      availableAt: record.availableAt,
      lastSearchAt,
      nextSearchAt: record.availableAt === null ? null : searchDueAt({ availableAt: record.availableAt, addedAt: record.addedAt, lastSearchAt }),
      lastResult,
      inQueue,
    };
  };

  // A service that is not set up or cannot be read contributes nothing, so the other service's list still shows.
  const list = async (which: 'missing' | 'cutoff') => {
    const sources = [
      { service: 'sonarr' as const, filters: 'monitored=true&includeSeries=true', read: readEpisode },
      { service: 'radarr' as const, filters: 'monitored=true', read: readMovie },
    ];
    const results = await Promise.allSettled(sources.map(async ({ service, filters, read }) => (
      (await readPages(service, `/api/v3/wanted/${which}`, filters, read)).map((record) => toWanted(service, record))
    )));
    const items = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const kept = which === 'cutoff'
      ? items.filter((item) => !isManualDownload({ type: item.type, service: item.service, id: String(item.id) }))
      : items;
    return kept.sort((a, b) => (a.availableAt ?? Number.POSITIVE_INFINITY) - (b.availableAt ?? Number.POSITIVE_INFINITY));
  };

  const wanted = async () => {
    const [missing, cutoff] = await Promise.all([list('missing'), list('cutoff')]);
    return { missing, cutoff };
  };

  const search = async (service: Service, type: WantedType, ids: number[]): Promise<'ok' | 'refused' | 'unavailable'> => {
    const body = service === 'sonarr' ? { name: 'EpisodeSearch', episodeIds: ids } : { name: 'MoviesSearch', movieIds: ids };
    try {
      const { status } = await arr[service].request('/api/v3/command', { method: 'POST', body });
      if (status < 200 || status > 299) return 'refused';
    } catch {
      return 'unavailable';
    }
    const at = now();
    for (const id of ids) {
      database.prepare(`
        INSERT INTO search_log (subject, searched_at) VALUES (?, ?) ON CONFLICT (subject) DO UPDATE SET searched_at = excluded.searched_at
      `).run(key(service, type, id), at);
    }
    return 'ok';
  };

  return { needsYou, wanted, search };
};

export type Flagged = ReturnType<typeof createFlagged>;

const readSearch = (body: unknown) => {
  if (!isRecord(body) || Object.keys(body).sort().join(',') !== 'ids,service,type') return undefined;
  const { service, type, ids } = body;
  if ((service !== 'sonarr' && service !== 'radarr') || type !== serviceTypes[service]) return undefined;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || !ids.every((id) => Number.isSafeInteger(id))) return undefined;
  return { service: service as Service, type: type as WantedType, ids: ids as number[] };
};

export const createFlaggedRoutes = (flagged: Flagged) => {
  const routes = new Hono();
  routes.get('/', async (context) => context.json(await flagged.needsYou()));
  routes.get('/wanted', async (context) => context.json(await flagged.wanted()));
  routes.post('/search', async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const request = readSearch(body);
    if (request === undefined) return context.json({ error: 'invalid_request' }, 400);
    const result = await flagged.search(request.service, request.type, request.ids);
    return result === 'ok' ? context.body(null, 204) : context.json({ error: `service_${result}` }, 502);
  });
  return routes;
};
