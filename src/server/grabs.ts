import type { DatabaseSync } from 'node:sqlite';
import { writeDependency } from './dependencies.js';
import type { EventHub } from './events.js';

export type Service = 'sonarr' | 'radarr';

type ArrRequest = (path: string) => Promise<{ status: number; body: unknown }>;

export type Grab = {
  hash: string;
  service: Service;
  movieId: number | null;
  seriesId: number | null;
  episodeIds: number[];
  releaseTitle: string;
  indexer: string;
  grabbedAt: number;
  publishedAt: number | null;
  byHand: boolean;
  importedAt: number | null;
  failedAt: number | null;
};

export type QueueItem = {
  service: Service;
  queueId: number;
  downloadId: string | null;
  movieId: number | null;
  seriesId: number | null;
  episodeId: number | null;
  title: string;
  // The movie or episode in words, such as "Andor S02E09" or "Dune: Part Two (2024)".
  label: string;
  status: string;
  trackedStatus: string;
  trackedState: string;
  statusMessages: { title: string; messages: string[] }[];
  errorMessage: string;
  indexer: string;
  protocol: string;
  quality: string;
  formats: string[];
  formatScore: number;
  sizeBytes: number;
  sizeLeftBytes: number;
  estimatedCompletion: string | null;
  added: string | null;
};

export const RECONCILE_INTERVAL_MS = 5 * 60_000;
// Bounds the first check after a fresh install or a long outage; older grabs no longer need matching.
const HISTORY_LOOKBACK_MS = 14 * 24 * 60 * 60_000;
// Overlap with the previous check so a grab recorded just before it ran is never skipped.
const HISTORY_OVERLAP_MS = 10 * 60_000;
const QUEUE_PAGE_SIZE = 200;

const services: readonly Service[] = ['sonarr', 'radarr'];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const integer = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) ? value : null);
const normalizeHash = (value: unknown) => {
  const hash = text(value).trim().toUpperCase();
  return /^[0-9A-F]{40}$/.test(hash) ? hash : null;
};
const ids = (values: unknown[]) => [...new Set(values.map(integer).filter((id): id is number => id !== null))].sort((a, b) => a - b);

const readGrab = (row: Record<string, unknown>): Grab => ({
  hash: String(row.hash),
  service: row.service as Service,
  movieId: row.movie_id === null ? null : Number(row.movie_id),
  seriesId: row.series_id === null ? null : Number(row.series_id),
  episodeIds: JSON.parse(String(row.episode_ids)) as number[],
  releaseTitle: String(row.release_title),
  indexer: String(row.indexer),
  grabbedAt: Number(row.grabbed_at),
  publishedAt: row.published_at === null ? null : Number(row.published_at),
  byHand: row.by_hand === 1,
  importedAt: row.imported_at === null ? null : Number(row.imported_at),
  failedAt: row.failed_at === null ? null : Number(row.failed_at),
});

export const findGrab = (database: DatabaseSync, hash: string): Grab | undefined => {
  const row = database.prepare('SELECT * FROM grabs WHERE hash = ?').get(hash.toUpperCase());
  return row === undefined ? undefined : readGrab(row as Record<string, unknown>);
};

export const listGrabs = (database: DatabaseSync): Grab[] => database
  .prepare('SELECT * FROM grabs ORDER BY grabbed_at, hash')
  .all()
  .map((row) => readGrab(row as Record<string, unknown>));

export const listQueue = (database: DatabaseSync): QueueItem[] => database
  .prepare('SELECT * FROM arr_queue ORDER BY service, queue_id')
  .all()
  .map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      service: row.service as Service,
      queueId: Number(row.queue_id),
      downloadId: row.download_id === null ? null : String(row.download_id),
      movieId: row.movie_id === null ? null : Number(row.movie_id),
      seriesId: row.series_id === null ? null : Number(row.series_id),
      episodeId: row.episode_id === null ? null : Number(row.episode_id),
      title: String(row.title),
      label: String(row.label),
      status: String(row.status),
      trackedStatus: String(row.tracked_status),
      trackedState: String(row.tracked_state),
      statusMessages: JSON.parse(String(row.status_messages)),
      errorMessage: String(row.error_message),
      indexer: String(row.indexer),
      protocol: String(row.protocol),
      quality: String(row.quality),
      formats: JSON.parse(String(row.formats)),
      formatScore: Number(row.format_score),
      sizeBytes: Number(row.size_bytes),
      sizeLeftBytes: Number(row.size_left_bytes),
      estimatedCompletion: row.estimated_completion === null ? null : String(row.estimated_completion),
      added: row.added === null ? null : String(row.added),
    };
  });

const episodeCode = (season: unknown, episode: unknown) => (
  typeof season === 'number' && typeof episode === 'number'
    ? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
    : ''
);

const queueLabel = (value: Record<string, unknown>) => {
  if (isRecord(value.movie)) {
    const year = integer(value.movie.year);
    return `${text(value.movie.title)}${year === null || year === 0 ? '' : ` (${year})`}`.trim();
  }
  if (isRecord(value.series)) {
    const episode = isRecord(value.episode) ? episodeCode(value.episode.seasonNumber, value.episode.episodeNumber) : '';
    return `${text(value.series.title)} ${episode}`.trim();
  }
  return '';
};

const parseQueueItem = (service: Service, value: unknown): QueueItem | null => {
  if (!isRecord(value)) return null;
  const queueId = integer(value.id);
  if (queueId === null) return null;
  const quality = isRecord(value.quality) && isRecord(value.quality.quality) ? text(value.quality.quality.name) : '';
  const formats = Array.isArray(value.customFormats)
    ? value.customFormats.flatMap((format) => (isRecord(format) && typeof format.name === 'string' ? [format.name] : []))
    : [];
  const statusMessages = Array.isArray(value.statusMessages)
    ? value.statusMessages.flatMap((message) => (isRecord(message)
      ? [{
        title: text(message.title),
        messages: Array.isArray(message.messages) ? message.messages.filter((line): line is string => typeof line === 'string') : [],
      }]
      : []))
    : [];
  return {
    service,
    queueId,
    label: queueLabel(value),
    downloadId: normalizeHash(value.downloadId),
    movieId: integer(value.movieId),
    seriesId: integer(value.seriesId),
    episodeId: integer(value.episodeId),
    title: text(value.title),
    status: text(value.status),
    trackedStatus: text(value.trackedDownloadStatus),
    trackedState: text(value.trackedDownloadState),
    statusMessages,
    errorMessage: text(value.errorMessage),
    indexer: text(value.indexer),
    protocol: text(value.protocol),
    quality,
    formats,
    formatScore: integer(value.customFormatScore) ?? 0,
    sizeBytes: integer(value.size) ?? 0,
    sizeLeftBytes: integer(value.sizeleft) ?? 0,
    estimatedCompletion: typeof value.estimatedCompletionTime === 'string' ? value.estimatedCompletionTime : null,
    added: typeof value.added === 'string' ? value.added : null,
  };
};

type GrabInput = Omit<Grab, 'importedAt' | 'failedAt'>;
type GrabListener = (grab: Grab) => void | Promise<void>;

export const createGrabTracker = (options: {
  database: DatabaseSync;
  arr: Record<Service, { request: ArrRequest }>;
  events: EventHub;
  now?: () => number;
}) => {
  const { database, arr, events } = options;
  const now = options.now ?? Date.now;
  const listeners = new Set<GrabListener>();

  const notify = (grab: Grab) => {
    for (const listener of [...listeners]) {
      void Promise.resolve()
        .then(() => listener(grab))
        .catch(() => { console.error('Grab listener failed.'); });
    }
  };

  // One record per hash: a webhook and the five-minute check for the same grab merge, keeping the earliest time and every episode.
  const recordGrab = (input: GrabInput): Grab => {
    const previous = findGrab(database, input.hash);
    const merged: Grab = previous === undefined
      ? { ...input, importedAt: null, failedAt: null }
      : {
        ...previous,
        movieId: previous.movieId ?? input.movieId,
        seriesId: previous.seriesId ?? input.seriesId,
        episodeIds: ids([...previous.episodeIds, ...input.episodeIds]),
        releaseTitle: previous.releaseTitle || input.releaseTitle,
        indexer: previous.indexer || input.indexer,
        grabbedAt: Math.min(previous.grabbedAt, input.grabbedAt),
        publishedAt: previous.publishedAt ?? input.publishedAt,
        byHand: previous.byHand || input.byHand,
      };
    if (previous !== undefined && JSON.stringify(previous) === JSON.stringify(merged)) return previous;
    database.prepare(`
      INSERT INTO grabs (hash, service, movie_id, series_id, episode_ids, release_title, indexer, grabbed_at, published_at, by_hand,
        imported_at, failed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (hash) DO UPDATE SET movie_id = excluded.movie_id, series_id = excluded.series_id,
        episode_ids = excluded.episode_ids, release_title = excluded.release_title, indexer = excluded.indexer,
        grabbed_at = excluded.grabbed_at, published_at = excluded.published_at, by_hand = excluded.by_hand
    `).run(merged.hash, merged.service, merged.movieId, merged.seriesId, JSON.stringify(merged.episodeIds),
      merged.releaseTitle, merged.indexer, merged.grabbedAt, merged.publishedAt, Number(merged.byHand), merged.importedAt, merged.failedAt);
    events.publish('grab', merged);
    if (previous === undefined) notify(merged);
    return merged;
  };

  const markOutcome = (hash: string, column: 'imported_at' | 'failed_at', at: number) => {
    const result = database.prepare(`UPDATE grabs SET ${column} = ? WHERE hash = ? AND ${column} IS NULL`).run(at, hash);
    if (result.changes > 0) events.publish('grab', findGrab(database, hash));
  };

  const fetchQueue = async (service: Service): Promise<QueueItem[]> => {
    const items: QueueItem[] = [];
    for (let page = 1; ; page += 1) {
      const { status, body } = await arr[service].request(
        `/api/v3/queue?page=${page}&pageSize=${QUEUE_PAGE_SIZE}&includeUnknownSeriesItems=true&includeUnknownMovieItems=true&includeSeries=true&includeEpisode=true&includeMovie=true`,
      );
      if (status < 200 || status > 299 || !isRecord(body) || !Array.isArray(body.records)) {
        throw new Error(`${service === 'sonarr' ? 'Sonarr' : 'Radarr'} queue could not be read.`);
      }
      for (const record of body.records) {
        const item = parseQueueItem(service, record);
        if (item !== null) items.push(item);
      }
      const total = integer(body.totalRecords) ?? 0;
      if (body.records.length < QUEUE_PAGE_SIZE || page * QUEUE_PAGE_SIZE >= total) return items;
    }
  };

  const storeQueue = (service: Service, items: QueueItem[]) => {
    const before = JSON.stringify(listQueue(database).filter((item) => item.service === service));
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.prepare('DELETE FROM arr_queue WHERE service = ?').run(service);
      const insert = database.prepare(`
        INSERT INTO arr_queue (service, queue_id, download_id, movie_id, series_id, episode_id, title, status, tracked_status,
          tracked_state, status_messages, error_message, indexer, protocol, quality, formats, format_score, size_bytes,
          size_left_bytes, estimated_completion, added, label)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        insert.run(item.service, item.queueId, item.downloadId, item.movieId, item.seriesId, item.episodeId, item.title,
          item.status, item.trackedStatus, item.trackedState, JSON.stringify(item.statusMessages), item.errorMessage,
          item.indexer, item.protocol, item.quality, JSON.stringify(item.formats), item.formatScore, item.sizeBytes,
          item.sizeLeftBytes, item.estimatedCompletion, item.added, item.label);
      }
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
    const after = listQueue(database).filter((item) => item.service === service);
    if (JSON.stringify(after) !== before) events.publish('queue', { service, items: after });
  };

  const readCheckpoint = (service: Service) => {
    const row = database.prepare('SELECT history_checked_at FROM grab_checkpoints WHERE service = ?').get(service);
    return row === undefined ? undefined : Number(row.history_checked_at);
  };

  const fetchGrabHistory = async (service: Service, since: number) => {
    const date = new Date(since).toISOString();
    const { status, body } = await arr[service].request(`/api/v3/history/since?date=${encodeURIComponent(date)}&eventType=grabbed`);
    if (status < 200 || status > 299 || !Array.isArray(body)) {
      throw new Error(`${service === 'sonarr' ? 'Sonarr' : 'Radarr'} history could not be read.`);
    }
    // A season pack is one history row per episode, all with the same downloadId.
    const grabs = new Map<string, GrabInput>();
    for (const record of body) {
      if (!isRecord(record)) continue;
      const hash = normalizeHash(record.downloadId);
      const grabbedAt = Date.parse(text(record.date));
      if (hash === null || Number.isNaN(grabbedAt)) continue;
      const data = isRecord(record.data) ? record.data : {};
      const existing = grabs.get(hash);
      grabs.set(hash, {
        hash,
        service,
        movieId: existing?.movieId ?? integer(record.movieId),
        seriesId: existing?.seriesId ?? integer(record.seriesId),
        episodeIds: ids([...(existing?.episodeIds ?? []), record.episodeId]),
        releaseTitle: existing?.releaseTitle || text(record.sourceTitle),
        indexer: existing?.indexer || text(data.indexer),
        grabbedAt: Math.min(existing?.grabbedAt ?? grabbedAt, grabbedAt),
        publishedAt: existing?.publishedAt ?? (Number.isNaN(Date.parse(text(data.publishedDate))) ? null : Date.parse(text(data.publishedDate))),
        byHand: false,
      });
    }
    return [...grabs.values()];
  };

  const running = new Map<Service, Promise<void>>();
  const queued = new Map<Service, Promise<void>>();
  // A request during a running check gets one fresh check after it, since the running one may have read before the change.
  // Further requests share that queued check, so a webhook burst (a season pack's imports) costs at most two.
  const reconcileService = (service: Service): Promise<void> => {
    const current = running.get(service);
    if (current === undefined) {
      const run = checkService(service).finally(() => { running.delete(service); });
      running.set(service, run);
      return run;
    }
    const waiting = queued.get(service);
    if (waiting !== undefined) return waiting;
    const next = current.then(() => {
      queued.delete(service);
      return reconcileService(service);
    });
    queued.set(service, next);
    return next;
  };

  const checkService = async (service: Service) => {
    const startedAt = now();
    const name = service;
    try {
      const checkpoint = readCheckpoint(service);
      const since = Math.max(startedAt - HISTORY_LOOKBACK_MS, (checkpoint ?? 0) - HISTORY_OVERLAP_MS);
      const [queue, history] = await Promise.all([fetchQueue(service), fetchGrabHistory(service, since)]);
      for (const grab of history) recordGrab(grab);
      storeQueue(service, queue);
      database.prepare(`
        INSERT INTO grab_checkpoints (service, history_checked_at) VALUES (?, ?)
        ON CONFLICT (service) DO UPDATE SET history_checked_at = excluded.history_checked_at
      `).run(service, startedAt);
      writeDependency(database, events, name, 'ok', now(), '');
    } catch (error) {
      const detail = error instanceof Error ? error.message : `${service} could not be read.`;
      writeDependency(database, events, name, 'down', startedAt, detail);
    }
  };

  const reconcile = async () => {
    for (const service of services) await reconcileService(service);
  };

  const receiveWebhook = (service: Service, payload: unknown): 'ok' | 'ignored' | 'invalid' => {
    if (!isRecord(payload) || typeof payload.eventType !== 'string') return 'invalid';
    const at = now();
    const hash = normalizeHash(payload.downloadId);
    switch (payload.eventType) {
      case 'Test': return 'ok';
      case 'Grab': {
        if (hash === null) return 'invalid';
        const release = isRecord(payload.release) ? payload.release : {};
        const episodes = Array.isArray(payload.episodes) ? payload.episodes : [];
        recordGrab({
          hash,
          service,
          movieId: isRecord(payload.movie) ? integer(payload.movie.id) : null,
          seriesId: isRecord(payload.series) ? integer(payload.series.id) : null,
          episodeIds: ids(episodes.map((episode) => (isRecord(episode) ? episode.id : null))),
          releaseTitle: text(release.releaseTitle),
          indexer: text(release.indexer),
          grabbedAt: at,
          publishedAt: Number.isNaN(Date.parse(text(release.publishDate))) ? null : Date.parse(text(release.publishDate)),
          byHand: false,
        });
        void reconcileService(service);
        return 'ok';
      }
      case 'Download':
        if (hash !== null) markOutcome(hash, 'imported_at', at);
        void reconcileService(service);
        return 'ok';
      case 'DownloadFailure':
      case 'ImportFailure':
      case 'ManualInteractionRequired':
        if (hash !== null && payload.eventType === 'DownloadFailure') markOutcome(hash, 'failed_at', at);
        void reconcileService(service);
        return 'ok';
      default:
        return 'ignored';
    }
  };

  return {
    reconcile,
    // Re-reads one service now, for example after the owner changed its queue.
    refresh: reconcileService,
    receiveWebhook,
    recordGrab,
    intervalMs: RECONCILE_INTERVAL_MS,
    onGrab(listener: GrabListener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
};
