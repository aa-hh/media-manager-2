import type { DatabaseSync } from 'node:sqlite';
import { writeDependency } from './dependencies.js';
import type { EventHub } from './events.js';
import { type ArrServices, type HistoryRecord, type QueueItem, valueOrThrow } from './services/arr.js';
import type { Torrent } from './torrents.js';

export type Service = 'sonarr' | 'radarr';

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

export const RECONCILE_INTERVAL_MS = 5 * 60_000;
// Bounds the first check after a fresh install or a long outage; older grabs no longer need matching.
const HISTORY_LOOKBACK_MS = 14 * 24 * 60 * 60_000;
// Overlap with the previous check so a grab recorded just before it ran is never skipped.
const HISTORY_OVERLAP_MS = 10 * 60_000;

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
  const row = database.prepare('SELECT * FROM torrent_grabs WHERE hash = ?').get(hash.toUpperCase());
  return row === undefined ? undefined : readGrab(row as Record<string, unknown>);
};

// A torrent is watched only when Sonarr, Radarr or this app grabbed it; rTorrent also holds downloads added by other means, such as music.
export const isOwnedTorrent = (database: DatabaseSync, hash: string) => findGrab(database, hash) !== undefined
  || database.prepare('SELECT 1 FROM second_versions WHERE upper(hash) = ? LIMIT 1').get(hash.toUpperCase()) !== undefined;

// Problems the stall fix and tracker watch open on a torrent; import problems come from the queue and are left alone.
export const WATCH_KINDS = ['stalled', 'unfinished', 'unregistered', 'tracker_down', 'damaged'];

export const listGrabs = (database: DatabaseSync): Grab[] => database
  .prepare('SELECT * FROM torrent_grabs ORDER BY grabbed_at, hash')
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

type GrabInput = Omit<Grab, 'importedAt' | 'failedAt'>;
type GrabListener = (grab: Grab) => void | Promise<void>;

export const createGrabTracker = (options: {
  database: DatabaseSync;
  arr: ArrServices;
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
      INSERT INTO torrent_grabs (hash, service, movie_id, series_id, episode_ids, release_title, indexer, grabbed_at, published_at, by_hand,
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
    const result = database.prepare(`UPDATE torrent_grabs SET ${column} = ? WHERE hash = ? AND ${column} IS NULL`).run(at, hash);
    if (result.changes > 0) events.publish('grab', findGrab(database, hash));
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
    const row = database.prepare('SELECT history_checked_at, outcomes_checked_at FROM grab_checkpoints WHERE service = ?').get(service);
    return {
      grabs: row === undefined ? undefined : Number(row.history_checked_at),
      outcomes: row?.outcomes_checked_at == null ? undefined : Number(row.outcomes_checked_at),
    };
  };

  // A season pack is one history row per episode, all with the same downloadId.
  const mergeGrabs = (service: Service, records: HistoryRecord[]) => {
    const grabs = new Map<string, GrabInput>();
    for (const record of records) {
      const hash = normalizeHash(record.downloadId);
      const grabbedAt = Date.parse(record.date ?? '');
      if (hash === null || Number.isNaN(grabbedAt)) continue;
      const publishedAt = Date.parse(record.data.publishedDate ?? '');
      const existing = grabs.get(hash);
      grabs.set(hash, {
        hash,
        service,
        movieId: existing?.movieId ?? record.movieId,
        seriesId: existing?.seriesId ?? record.seriesId,
        episodeIds: ids([...(existing?.episodeIds ?? []), record.episodeId]),
        releaseTitle: existing?.releaseTitle || (record.sourceTitle ?? ''),
        indexer: existing?.indexer || (record.data.indexer ?? ''),
        grabbedAt: Math.min(existing?.grabbedAt ?? grabbedAt, grabbedAt),
        publishedAt: existing?.publishedAt ?? (Number.isNaN(publishedAt) ? null : publishedAt),
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
      const since = Math.max(startedAt - HISTORY_LOOKBACK_MS, (checkpoint.grabs ?? 0) - HISTORY_OVERLAP_MS);
      // Outcomes keep their own bookmark so imports from before they were read get backfilled without widening the grab
      // window: a new grab record would let the stall fix search again for a torrent it would otherwise only flag.
      const outcomesSince = Math.max(startedAt - HISTORY_LOOKBACK_MS, (checkpoint.outcomes ?? 0) - HISTORY_OVERLAP_MS);
      const filter = { since: Math.min(since, outcomesSince) };
      const [queue, history] = await Promise.all([
        arr[service].queue(),
        service === 'sonarr' ? arr.sonarr.history(filter) : arr.radarr.history(filter),
      ]);
      const items = valueOrThrow(queue);
      const records = valueOrThrow(history);
      const grabbed = records.filter((record) => record.eventType === 'grabbed' && Date.parse(record.date ?? '') >= since);
      for (const grab of mergeGrabs(service, grabbed)) recordGrab(grab);
      // The Download webhook is not the only way to learn of an import: without it, finished torrents would read as downloading forever.
      for (const record of records) {
        const hash = normalizeHash(record.downloadId);
        const at = Date.parse(record.date ?? '');
        if (hash === null || Number.isNaN(at)) continue;
        if (record.eventType === 'downloadFolderImported') markOutcome(hash, 'imported_at', at);
        if (record.eventType === 'downloadFailed') markOutcome(hash, 'failed_at', at);
      }
      storeQueue(service, items);
      database.prepare(`
        INSERT INTO grab_checkpoints (service, history_checked_at, outcomes_checked_at) VALUES (?, ?, ?)
        ON CONFLICT (service) DO UPDATE SET history_checked_at = excluded.history_checked_at, outcomes_checked_at = excluded.outcomes_checked_at
      `).run(service, startedAt, startedAt);
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
    // A torrent new to rTorrent gets its episodes or movie and its queue item now, so title pages show its progress within
    // one rTorrent poll instead of after the next five-minute read. A grab made in the app already has a record, but a
    // season grab's record lists no episodes until Sonarr's history is read.
    readOnNewTorrents: () => events.subscribe((event) => {
      if (event.type !== 'torrents') return;
      const { changed, live } = event.data as { changed: Torrent[]; live?: boolean };
      // The one-second refresh resends a new torrent every second; the full poll that found it already asked once.
      if (live !== true && changed.some((torrent) => torrent.firstSeenAt === torrent.lastSeenAt)) void reconcile();
    }),
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
