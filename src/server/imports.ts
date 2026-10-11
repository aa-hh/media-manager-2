import type { DatabaseSync } from 'node:sqlite';
import { writeDependency } from './dependencies.js';
import type { EventHub } from './events.js';
import { findGrab, type Grab, listQueue, type QueueItem, type Service } from './torrentGrabs.js';
import type { createProblems, Subject } from './problems.js';
import { listOpenProblems, RELEASE_LIMIT } from './problems.js';

type Problems = ReturnType<typeof createProblems>;
type ArrRequest = (path: string, init?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }) => Promise<{ status: number; body: unknown }>;

export type ImportCategory = 'replace' | 'matching' | 'not_better' | 'bad_release' | 'leftover' | 'temporary' | 'file_move' | 'setup' | 'unknown';

// AA-13 grouped Sonarr's and Radarr's import rejections; these patterns read their wording. Order matters: the first match wins.
const patterns: [ImportCategory, RegExp][] = [
  ['setup', /free space|disk space|root folder|path does not exist|permission|access to the path|access denied|read-only|recycl/i],
  ['bad_release', /no audio|dangerous|executable|unsupported extension|invalid video file|not a valid video/i],
  ['leftover', /already imported|is a sample|sample file|extras?\b/i],
  ['not_better', /not an upgrade|not a quality revision upgrade|not a custom format upgrade|existing file.*(better|equal)/i],
  ['temporary', /locked|being used by another process|unpack|tba title|title is not yet|recently aired|still being written/i],
  ['file_move', /failed to (move|import|copy|hardlink)|couldn't (move|import|copy)|unable to (move|copy)|file move/i],
  ['matching', /mismatch|matched to (series|movie) by id|was unexpected|not found in the grab|unable to (parse|identify)|partial season|contains all episodes|invalid season|unknown (series|movie|episode)|manual import required|automatic import is not possible/i],
];

export const TEMPORARY_RETRY_MS = 15 * 60_000;
export const TEMPORARY_LIMIT_MS = 24 * 60 * 60_000;
export const FILE_MOVE_RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 120 * 60_000] as const;

export const classifyImport = (messages: string[]): ImportCategory => {
  for (const [category, pattern] of patterns) if (messages.some((message) => pattern.test(message))) return category;
  return 'unknown';
};

type Handling = { service: Service; downloadId: string; category: ImportCategory; firstSeenAt: number; attempts: number; lastAttemptAt: number | null; done: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const labels: Record<Service, string> = { sonarr: 'Sonarr', radarr: 'Radarr' };

const messagesOf = (items: QueueItem[]) => items
  .flatMap((item) => [item.errorMessage, ...item.statusMessages.flatMap((message) => [message.title, ...message.messages])])
  .filter((message) => message !== '');

const subjectsOf = (grab: Grab): Subject[] => (grab.movieId !== null
  ? [{ type: 'movie', service: grab.service, id: String(grab.movieId) }]
  : grab.episodeIds.map((id) => ({ type: 'episode' as const, service: grab.service, id: String(id) })));

export const createImportFix = (options: {
  database: DatabaseSync;
  arr: Record<Service, { request: ArrRequest }>;
  problems: Problems;
  events: EventHub;
  now?: () => number;
}) => {
  const { database, arr, problems, events } = options;
  const now = options.now ?? Date.now;

  const readHandling = (service: Service, downloadId: string): Handling | undefined => {
    const row = database.prepare('SELECT * FROM import_handling WHERE service = ? AND download_id = ?').get(service, downloadId);
    if (row === undefined) return undefined;
    return {
      service,
      downloadId,
      category: row.category as ImportCategory,
      firstSeenAt: Number(row.first_seen_at),
      attempts: Number(row.attempts),
      lastAttemptAt: row.last_attempt_at === null ? null : Number(row.last_attempt_at),
      done: row.done === 1,
    };
  };

  const saveHandling = (handling: Handling) => {
    database.prepare(`
      INSERT INTO import_handling (service, download_id, category, first_seen_at, attempts, last_attempt_at, done) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (service, download_id) DO UPDATE SET category = excluded.category, first_seen_at = excluded.first_seen_at,
        attempts = excluded.attempts, last_attempt_at = excluded.last_attempt_at, done = excluded.done
    `).run(handling.service, handling.downloadId, handling.category, handling.firstSeenAt, handling.attempts, handling.lastAttemptAt, Number(handling.done));
  };

  // Every queue removal leaves rTorrent alone: the torrent follows the hit and run rules, never the queue.
  const removeFromQueue = async (items: QueueItem[], blocklist: boolean, skipRedownload: boolean) => {
    for (const item of items) {
      const { status } = await arr[item.service].request(
        `/api/v3/queue/${item.queueId}?removeFromClient=false&blocklist=${blocklist}&skipRedownload=${skipRedownload}`,
        { method: 'DELETE' },
      );
      if (status < 200 || status > 299) throw new Error(`${labels[item.service]} refused to remove the download from its queue.`);
    }
  };

  const refreshDownloads = async (service: Service) => {
    const { status } = await arr[service].request('/api/v3/command', { method: 'POST', body: { name: 'RefreshMonitoredDownloads' } });
    if (status < 200 || status > 299) throw new Error(`${labels[service]} refused to check its downloads again.`);
  };

  // Forces the import only onto what the grab record says was grabbed; any file outside it stops the whole import.
  const forceImport = async (service: Service, grab: Grab): Promise<string | null> => {
    const { status, body } = await arr[service].request(`/api/v3/manualimport?downloadId=${grab.hash}&filterExistingFiles=false`);
    if (status < 200 || status > 299 || !Array.isArray(body)) throw new Error(`${labels[service]} could not list the download's files.`);
    const allowed = new Set(grab.episodeIds);
    const files: Record<string, unknown>[] = [];
    for (const candidate of body) {
      if (!isRecord(candidate) || typeof candidate.path !== 'string') continue;
      const base = {
        path: candidate.path,
        quality: candidate.quality,
        languages: candidate.languages,
        releaseGroup: candidate.releaseGroup,
        downloadId: grab.hash,
      };
      if (grab.movieId !== null) {
        files.push({ ...base, movieId: grab.movieId });
        continue;
      }
      const parsed = Array.isArray(candidate.episodes)
        ? candidate.episodes.flatMap((episode) => (isRecord(episode) && typeof episode.id === 'number' ? [episode.id] : []))
        : [];
      const episodeIds = parsed.length > 0 ? parsed : grab.episodeIds.length === 1 ? grab.episodeIds : [];
      if (episodeIds.length === 0 || episodeIds.some((id) => !allowed.has(id))) {
        return `${candidate.path} doesn't match the episodes that were grabbed.`;
      }
      files.push({ ...base, seriesId: grab.seriesId, episodeIds });
    }
    if (files.length === 0) return `${labels[service]} found no files to import.`;
    const command = await arr[service].request('/api/v3/command', { method: 'POST', body: { name: 'ManualImport', files, importMode: 'copy' } });
    if (command.status < 200 || command.status > 299) throw new Error(`${labels[service]} refused the import.`);
    return null;
  };

  const handle = async (service: Service, downloadId: string, items: QueueItem[], at: number) => {
    const messages = messagesOf(items);
    const grab = findGrab(database, downloadId);
    let category = classifyImport(messages);
    if (category === 'not_better' && grab?.byHand === true) category = 'replace';
    const previous = readHandling(service, downloadId);
    if (previous?.done === true && previous.category === category) return;
    const handling: Handling = previous?.category === category
      ? previous
      : { service, downloadId, category, firstSeenAt: at, attempts: 0, lastAttemptAt: null, done: false };
    // The replace flow (AA-31) owns its own "Not an upgrade" import.
    if (category === 'replace') return;

    const subject: Subject = { type: 'torrent', service: null, id: downloadId };
    const reason = messages[0] ?? 'Import blocked.';
    const problem = problems.open({ kind: `import_${category}`, subject, hash: downloadId, summary: `${items[0].title}: ${reason}` });
    const finish = (state: 'resolved' | 'needs_you', text: string) => {
      saveHandling({ ...handling, done: true });
      problems.setState(problem.id, state, text);
    };

    switch (category) {
      case 'setup':
        writeDependency(database, events, 'imports', 'down', at, reason);
        finish('needs_you', 'Sonarr or Radarr setup needs fixing before imports can continue; import fixes are paused.');
        return;
      case 'unknown':
        finish('needs_you', 'media-manager-2 doesn\'t recognise this import problem.');
        return;
      case 'leftover':
        await removeFromQueue(items, false, true);
        finish('resolved', 'Cleared the leftover from the queue; the torrent stays in rTorrent.');
        return;
      case 'not_better':
        await removeFromQueue(items, false, true);
        finish('resolved', 'Not better than the current file, so it was not imported; removed from the queue, torrent left seeding.');
        return;
      case 'matching': {
        if (grab === undefined) {
          finish('needs_you', 'No grab record to check the match against; finish this import by hand.');
          return;
        }
        const refused = await forceImport(service, grab);
        if (refused === null) finish('resolved', 'Imported to what was grabbed.');
        else finish('needs_you', `${refused} Finish this import by hand.`);
        return;
      }
      case 'bad_release': {
        const counts = grab === undefined ? [0] : subjectsOf(grab).map((item) => problems.recordReleaseAttempt(item, downloadId));
        const giveUp = Math.max(...counts) >= RELEASE_LIMIT;
        // Not skipping the redownload lets Sonarr or Radarr search again for this item straight away.
        await removeFromQueue(items, true, giveUp);
        if (giveUp) finish('needs_you', `Blocked the release; gave up after ${RELEASE_LIMIT} different releases.`);
        else finish('resolved', 'Blocked the release and searched again.');
        return;
      }
      case 'temporary': {
        if (at - handling.firstSeenAt >= TEMPORARY_LIMIT_MS) {
          finish('needs_you', 'Still blocked after 24 hours of retries.');
          return;
        }
        if (handling.lastAttemptAt !== null && at - handling.lastAttemptAt < TEMPORARY_RETRY_MS) {
          saveHandling(handling);
          return;
        }
        await refreshDownloads(service);
        saveHandling({ ...handling, attempts: handling.attempts + 1, lastAttemptAt: at });
        problems.step(problem.id, 'fix', 'Asked to try the import again.');
        return;
      }
      case 'file_move': {
        const delay = FILE_MOVE_RETRY_DELAYS_MS[handling.attempts];
        if (delay === undefined) {
          // The last retry gets as long as the spacing before it to show up in the queue before this gives up.
          const settle = FILE_MOVE_RETRY_DELAYS_MS[FILE_MOVE_RETRY_DELAYS_MS.length - 1];
          if (at - (handling.lastAttemptAt ?? at) >= settle) finish('needs_you', `The file move still failed after ${FILE_MOVE_RETRY_DELAYS_MS.length} retries.`);
          else saveHandling(handling);
          return;
        }
        if (at - (handling.lastAttemptAt ?? handling.firstSeenAt) < delay) {
          saveHandling(handling);
          return;
        }
        await refreshDownloads(service);
        saveHandling({ ...handling, attempts: handling.attempts + 1, lastAttemptAt: at });
        problems.step(problem.id, 'fix', `Retried the file move (${handling.attempts + 1} of ${FILE_MOVE_RETRY_DELAYS_MS.length}).`);
        return;
      }
    }
  };

  const blocked = (item: QueueItem) => item.trackedStatus === 'warning' || item.trackedState === 'importBlocked' || item.trackedState === 'failedPending';

  const check = async () => {
    const at = now();
    const queue = listQueue(database);
    const stillSetup = queue.some((item) => blocked(item) && classifyImport(messagesOf([item])) === 'setup');
    if (!stillSetup) writeDependency(database, events, 'imports', 'ok', at, '');
    for (const service of ['sonarr', 'radarr'] as const) {
      if (problems.pausedBy([service, 'imports']).length > 0) continue;
      const groups = new Map<string, QueueItem[]>();
      for (const item of queue) {
        if (item.service !== service || item.downloadId === null || !blocked(item)) continue;
        groups.set(item.downloadId, [...(groups.get(item.downloadId) ?? []), item]);
      }
      for (const [downloadId, items] of groups) {
        try {
          await handle(service, downloadId, items, at);
        } catch (error) {
          const problem = problems.open({ kind: 'import_fix_failed', subject: { type: 'torrent', service: null, id: downloadId }, hash: downloadId, summary: items[0].title });
          if (problem.state !== 'needs_you') problems.setState(problem.id, 'needs_you', error instanceof Error ? error.message : 'The import fix failed.');
        }
      }
      // Only retries leave a handling row unfinished; once its download is no longer blocked, the retry worked.
      const cleared = database.prepare('SELECT download_id FROM import_handling WHERE service = ? AND done = 0').all(service)
        .map((row) => String(row.download_id))
        .filter((downloadId) => !groups.has(downloadId));
      if (cleared.length === 0) continue;
      const open = listOpenProblems(database);
      for (const downloadId of cleared) {
        const handling = readHandling(service, downloadId) as Handling;
        saveHandling({ ...handling, done: true });
        // A block can change kind between retries (locked, then a failed move), so every import problem on the download closes.
        for (const problem of open.filter((item) => item.kind.startsWith('import_') && item.subject.type === 'torrent' && item.subject.id === downloadId)) {
          problems.setState(problem.id, 'resolved', 'The import went through after the retry.');
        }
      }
    }
  };

  return { check };
};
