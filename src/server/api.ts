import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { Assignment } from './assignments.js';
import { listGrabs, listQueue, type Service } from './torrentGrabs.js';
import type { createManualImport } from './manualImport.js';
import { listOpenProblems, type SubjectType, subjectHistory } from './problems.js';
import { listTorrents } from './torrents.js';

type ArrRequest = (path: string, init?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }) => Promise<{ status: number; body: unknown }>;

export type ApiActions = {
  arr: Record<Service, { request: ArrRequest }>;
  refresh(service: Service): Promise<void>;
  manualImport: ReturnType<typeof createManualImport>;
};

const subjectTypes = new Set<SubjectType>(['movie', 'episode', 'torrent', 'tracker', 'dependency']);

// The agreed removal choices: the release can be kept, blocklisted, or blocklisted with a new search.
// rTorrent is never asked to remove anything from here, so seeding always continues.
const removals = {
  keep: 'blocklist=false&skipRedownload=true',
  blocklist: 'blocklist=true&skipRedownload=true',
  blocklist_search: 'blocklist=true&skipRedownload=false',
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const isIdList = (value: unknown): value is number[] => Array.isArray(value) && value.every((id) => Number.isSafeInteger(id));
const nullableId = (value: unknown) => value === null || Number.isSafeInteger(value);

const readAssignments = (body: unknown): Assignment[] | undefined => {
  if (!isRecord(body) || !Array.isArray(body.files) || body.files.length > 500) return undefined;
  const assignments: Assignment[] = [];
  for (const file of body.files) {
    if (!isRecord(file) || typeof file.path !== 'string' || !isIdList(file.episodeIds) || !isIdList(file.languageIds)
      || !nullableId(file.movieId) || !nullableId(file.qualityId)) return undefined;
    assignments.push({
      path: file.path,
      episodeIds: file.episodeIds,
      movieId: file.movieId as number | null,
      qualityId: file.qualityId as number | null,
      languageIds: file.languageIds,
    });
  }
  return assignments;
};
const downloadPattern = /^[0-9A-F]{40}$/;

// How far each movie and episode has downloaded, for title views and the calendar; finished imports drop out.
export const listProgress = (database: DatabaseSync) => {
  const torrents = new Map(listTorrents(database).filter((torrent) => torrent.goneAt === null).map((torrent) => [torrent.hash, torrent]));
  return listGrabs(database).flatMap((grab) => {
    const torrent = torrents.get(grab.hash);
    if (torrent === undefined || grab.importedAt !== null || grab.failedAt !== null) return [];
    const percent = torrent.sizeBytes > 0 ? Math.floor((torrent.completedBytes / torrent.sizeBytes) * 100) : 0;
    const subjects = grab.service === 'radarr'
      ? (grab.movieId === null ? [] : [{ type: 'movie' as const, id: grab.movieId }])
      : grab.episodeIds.map((id) => ({ type: 'episode' as const, id }));
    return subjects.map((subject) => ({ service: grab.service, ...subject, hash: grab.hash, percent, downRate: torrent.downRate }));
  });
};

// Routes for the owner's browser; app.ts mounts them behind the sign-in guard, which also checks every POST's origin.
export const createApiRoutes = (database: DatabaseSync, actions?: ApiActions) => {
  const api = new Hono();
  api.get('/downloads', (context) => context.json({
    torrents: listTorrents(database).filter((torrent) => torrent.goneAt === null),
    queue: listQueue(database),
    grabs: listGrabs(database),
    problems: listOpenProblems(database),
  }));
  api.get('/progress', (context) => context.json(listProgress(database)));
  api.get('/problems', (context) => context.json(listOpenProblems(database)));
  api.get('/problems/history', (context) => {
    const type = context.req.query('type') as SubjectType | undefined;
    const service = context.req.query('service') ?? '';
    const id = context.req.query('id');
    if (type === undefined || !subjectTypes.has(type) || !['', 'sonarr', 'radarr'].includes(service) || !id) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    return context.json(subjectHistory(database, {
      type,
      service: service === '' ? null : service as 'sonarr' | 'radarr',
      id,
    }));
  });

  // Only items media-manager-2 has seen in the queue can be acted on, so a stray id never reaches Sonarr or Radarr.
  const queueItem = (service: string, id: string) => {
    if ((service !== 'sonarr' && service !== 'radarr') || !/^-?\d{1,18}$/.test(id)) return undefined;
    return listQueue(database).find((item) => item.service === service && item.queueId === Number(id));
  };

  const send = async (service: Service, path: string, method: 'POST' | 'DELETE') => {
    if (actions === undefined) return 'unavailable';
    try {
      const { status } = await actions.arr[service].request(path, { method });
      if (status < 200 || status > 299) return 'refused';
    } catch {
      return 'unavailable';
    }
    await actions.refresh(service);
    return 'ok';
  };

  api.post('/queue/:service/:id/grab', async (context) => {
    const item = queueItem(context.req.param('service'), context.req.param('id'));
    if (item === undefined) return context.json({ error: 'not_found' }, 404);
    if (item.status !== 'delay') return context.json({ error: 'not_delayed' }, 409);
    const result = await send(item.service, `/api/v3/queue/grab/${item.queueId}`, 'POST');
    return result === 'ok' ? context.body(null, 204) : context.json({ error: `service_${result}` }, 502);
  });

  api.post('/queue/:service/:id/remove', async (context) => {
    const item = queueItem(context.req.param('service'), context.req.param('id'));
    if (item === undefined) return context.json({ error: 'not_found' }, 404);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const release = isRecord(body) ? body.release : undefined;
    if (typeof release !== 'string' || !Object.hasOwn(removals, release)) return context.json({ error: 'invalid_request' }, 400);
    const query = removals[release as keyof typeof removals];
    const result = await send(item.service, `/api/v3/queue/${item.queueId}?removeFromClient=false&${query}`, 'DELETE');
    return result === 'ok' ? context.body(null, 204) : context.json({ error: `service_${result}` }, 502);
  });
  const importTarget = (service: string, downloadId: string) => (
    (service === 'sonarr' || service === 'radarr') && downloadPattern.test(downloadId) ? service as Service : undefined
  );

  api.get('/imports/:service/:downloadId', async (context) => {
    const service = importTarget(context.req.param('service'), context.req.param('downloadId'));
    if (service === undefined || actions === undefined) return context.json({ error: 'not_found' }, 404);
    try {
      const view = await actions.manualImport.read(service, context.req.param('downloadId'));
      return view === undefined ? context.json({ error: 'not_found' }, 404) : context.json(view);
    } catch (error) {
      return context.json({ error: 'service_unavailable', reason: error instanceof Error ? error.message : '' }, 502);
    }
  });

  api.post('/imports/:service/:downloadId', async (context) => {
    const service = importTarget(context.req.param('service'), context.req.param('downloadId'));
    if (service === undefined || actions === undefined) return context.json({ error: 'not_found' }, 404);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const assignments = readAssignments(body);
    if (assignments === undefined) return context.json({ error: 'invalid_request' }, 400);
    const result = await actions.manualImport.submit(service, context.req.param('downloadId'), assignments);
    if (result.kind === 'not_found') return context.json({ error: 'not_found' }, 404);
    if (result.kind === 'invalid') return context.json({ error: 'invalid_assignment', reasons: result.reasons }, 400);
    if (result.kind === 'failed') return context.json({ error: 'import_failed', reason: result.reason }, 502);
    await actions.refresh(service);
    return context.body(null, 204);
  });
  return api;
};
