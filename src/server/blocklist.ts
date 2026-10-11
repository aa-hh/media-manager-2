import type { DatabaseSync } from 'node:sqlite';
import { type Context, Hono } from 'hono';
import type { Subject } from './problems.js';
import type { Service } from './torrentGrabs.js';

type ArrRequest = (path: string, init?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }) => Promise<{ status: number; body: unknown }>;

export type BlockEntry = {
  service: Service;
  id: number;
  title: string;
  release: string;
  quality: string | null;
  indexer: string | null;
  at: number;
  by: 'you' | 'media-manager-2' | 'Sonarr' | 'Radarr';
  reason: string;
};

export type MarkFailedResult =
  | { kind: 'remove_failed_on' }
  | { kind: 'refused' }
  | { kind: 'unavailable' }
  | { kind: 'ok'; searched: 'service' | 'media-manager-2' | 'manual_download' | 'search_failed' };

const PAGE_SIZE = 100;
const serviceWords = { sonarr: 'Sonarr', radarr: 'Radarr' } as const;
const originWords = { history: "from the title's history", downloads: 'from Live downloads' } as const;
// Only these problems end with media-manager-2 blocklisting the release it gave up on.
const blockingKinds = ['stalled', 'unregistered', 'damaged', 'tracker_down', 'import_bad_release'];

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
const ok = (status: number) => status >= 200 && status <= 299;

// Remembers that the owner blocklisted a release, which Sonarr and Radarr themselves do not record.
export const recordBlocklistMark = (database: DatabaseSync, service: Service, releaseTitle: string, origin: 'history' | 'downloads', at: number) => {
  database.prepare('INSERT INTO blocklist_marks (service, release_title, at, origin) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .run(service, releaseTitle, at, origin);
};

export const createBlocklist = (options: {
  database: DatabaseSync;
  arr: Record<Service, { request: ArrRequest }>;
  isManualDownload: (subject: Subject) => boolean;
  now?: () => number;
}) => {
  const { database, arr, isManualDownload } = options;
  const now = options.now ?? Date.now;

  const read = async (service: Service, path: string) => {
    try {
      const { status, body } = await arr[service].request(path);
      return ok(status) ? body : undefined;
    } catch {
      return undefined;
    }
  };

  const send = async (service: Service, path: string, init: { method: 'POST' | 'DELETE'; body?: unknown }) => {
    try {
      const { status } = await arr[service].request(path, init);
      return ok(status) ? 'ok' as const : 'refused' as const;
    } catch {
      return 'unavailable' as const;
    }
  };

  // The service's own mark-failed keeps the library file; only a client set to remove failed downloads would delete the seeding torrent.
  const markFailed = async (
    service: Service,
    historyId: number,
    body: { movieId: number | null; episodeIds: number[]; releaseTitle: string },
  ): Promise<MarkFailedResult> => {
    let clients: unknown;
    try {
      const response = await arr[service].request('/api/v3/downloadclient');
      if (!ok(response.status)) return { kind: 'refused' };
      clients = response.body;
    } catch {
      return { kind: 'unavailable' };
    }
    if (Array.isArray(clients) && clients.some((client) => record(client)?.enable === true && record(client)?.removeFailedDownloads === true)) {
      return { kind: 'remove_failed_on' };
    }
    const marked = await send(service, `/api/v3/history/failed/${historyId}`, { method: 'POST' });
    if (marked !== 'ok') return { kind: marked };
    recordBlocklistMark(database, service, body.releaseTitle, 'history', now());

    if (record(await read(service, '/api/v3/config/downloadclient'))?.autoRedownloadFailed === true) return { kind: 'ok', searched: 'service' };
    const subjects: Subject[] = service === 'radarr'
      ? (body.movieId === null ? [] : [{ type: 'movie', service, id: String(body.movieId) }])
      : body.episodeIds.map((id) => ({ type: 'episode', service, id: String(id) }));
    if (subjects.some(isManualDownload)) return { kind: 'ok', searched: 'manual_download' };
    const command = service === 'sonarr'
      ? { name: 'EpisodeSearch', episodeIds: body.episodeIds }
      : { name: 'MoviesSearch', movieIds: body.movieId === null ? [] : [body.movieId] };
    // The grab is already marked failed here, so a refused search still reports the mark as done.
    const searched = await send(service, '/api/v3/command', { method: 'POST', body: command });
    return { kind: 'ok', searched: searched === 'ok' ? 'media-manager-2' : 'search_failed' };
  };

  const attribute = (service: Service, release: string, message: string | null): Pick<BlockEntry, 'by' | 'reason'> => {
    const mark = database.prepare(`
      SELECT origin FROM blocklist_marks WHERE service = ? AND lower(release_title) = lower(?) ORDER BY at DESC LIMIT 1
    `).get(service, release);
    if (mark !== undefined) return { by: 'you', reason: originWords[mark.origin as keyof typeof originWords] };
    const problem = database.prepare(`
      SELECT p.summary FROM problems p JOIN torrent_grabs g ON upper(p.hash) = g.hash
      WHERE g.service = ? AND lower(g.release_title) = lower(?) AND p.kind IN (${blockingKinds.map(() => '?').join(', ')})
      ORDER BY p.opened_at DESC, p.id DESC LIMIT 1
    `).get(service, release, ...blockingKinds);
    if (problem !== undefined) return { by: 'media-manager-2', reason: String(problem.summary) };
    return { by: serviceWords[service], reason: message ?? '' };
  };

  const toEntry = (service: Service, raw: unknown): BlockEntry | undefined => {
    const value = record(raw);
    const id = value?.id;
    const at = Date.parse(text(value?.date) ?? '');
    if (value === undefined || typeof id !== 'number' || !Number.isSafeInteger(id) || Number.isNaN(at)) return undefined;
    const release = text(value.sourceTitle) ?? '';
    const movie = record(value.movie);
    const series = record(value.series);
    const episodes = Array.isArray(value.episodeIds) ? value.episodeIds.length : 0;
    const title = service === 'radarr'
      ? (text(movie?.title) === null ? release : `${String(movie?.title)} (${String(movie?.year)})`)
      : (text(series?.title) === null ? release : `${String(series?.title)} · ${episodes} ${episodes === 1 ? 'episode' : 'episodes'}`);
    return {
      service,
      id,
      title,
      release,
      quality: text(record(record(value.quality)?.quality)?.name),
      indexer: text(value.indexer),
      at,
      ...attribute(service, release, text(value.message)),
    };
  };

  // A service that is not set up or not answering contributes nothing, so the other one's entries still show.
  const list = async (page: number, service: Service | 'all') => {
    const services = service === 'all' ? ['sonarr', 'radarr'] as const : [service];
    const pages = await Promise.all(services.map(async (name) => {
      const records = record(await read(name, `/api/v3/blocklist?page=${page}&pageSize=${PAGE_SIZE}&sortKey=date&sortDirection=descending`))?.records;
      return { name, records: Array.isArray(records) ? records : [] };
    }));
    const entries = pages.flatMap(({ name, records }) => records.flatMap((raw) => toEntry(name, raw) ?? []));
    return { entries: entries.sort((a, b) => b.at - a.at), hasMore: pages.some(({ records }) => records.length >= PAGE_SIZE) };
  };

  const unblock = (service: Service, id: number) => send(service, `/api/v3/blocklist/${id}`, { method: 'DELETE' });

  return { markFailed, list, unblock };
};

export type Blocklist = ReturnType<typeof createBlocklist>;

const serviceParam = (value: string | undefined) => (value === 'sonarr' || value === 'radarr' ? value as Service : undefined);
const idParam = (value: string) => (/^\d{1,15}$/.test(value) ? Number(value) : undefined);

export const createBlocklistRoutes = (blocklist: Blocklist) => {
  const routes = new Hono();
  routes.get('/', async (context) => {
    const pageText = context.req.query('page') ?? '1';
    const page = Number(pageText);
    const service = context.req.query('service') ?? 'all';
    if (!/^\d{1,2}$/.test(pageText) || page < 1 || page > 50 || (service !== 'all' && serviceParam(service) === undefined)) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    return context.json(await blocklist.list(page, service as Service | 'all'));
  });
  routes.delete('/:service/:id', async (context) => {
    const service = serviceParam(context.req.param('service'));
    const id = idParam(context.req.param('id'));
    if (service === undefined || id === undefined) return context.json({ error: 'invalid_request' }, 400);
    const result = await blocklist.unblock(service, id);
    return result === 'ok' ? context.body(null, 204) : context.json({ error: `service_${result}` }, 502);
  });
  return routes;
};

const readMarkBody = (body: unknown) => {
  const value = record(body);
  if (value === undefined || Object.keys(value).length !== 3) return undefined;
  const { movieId, episodeIds, releaseTitle } = value;
  if (movieId !== null && !Number.isSafeInteger(movieId)) return undefined;
  if (!Array.isArray(episodeIds) || episodeIds.length > 50 || !episodeIds.every((id) => Number.isSafeInteger(id))) return undefined;
  if (typeof releaseTitle !== 'string' || releaseTitle === '' || releaseTitle.length > 500) return undefined;
  return { movieId: movieId as number | null, episodeIds: episodeIds as number[], releaseTitle };
};

// Mounted beside the history router so marking a grab failed lives with the blocklist it feeds.
export const createHistoryFailedRoute = (blocklist: Blocklist) => async (context: Context) => {
  const service = serviceParam(context.req.param('service'));
  const id = idParam(context.req.param('id') ?? '');
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: 'invalid_request' }, 400);
  }
  const input = readMarkBody(body);
  if (service === undefined || id === undefined || input === undefined) return context.json({ error: 'invalid_request' }, 400);
  const result = await blocklist.markFailed(service, id, input);
  if (result.kind === 'ok') return context.json({ searched: result.searched });
  if (result.kind === 'remove_failed_on') return context.json({ error: 'remove_failed_on' }, 409);
  return context.json({ error: result.kind === 'refused' ? 'service_refused' : 'service_unavailable' }, 502);
};
