import type { DatabaseSync } from 'node:sqlite';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { writeDependency } from './dependencies.js';
import type { EventHub } from './events.js';
import { type ArrServices, type QueueItem, valueOrThrow } from './services/arr.js';
import { findGrab, type Grab, listQueue, type Service } from './torrentGrabs.js';
import type { createProblems, Problem, Subject } from './problems.js';
import { listOpenProblems, RELEASE_LIMIT } from './problems.js';

type Problems = ReturnType<typeof createProblems>;

// 'manual' is never read from the queue: it marks an import the owner finished by hand.
export type ImportCategory = 'replace' | 'matching' | 'not_better' | 'bad_release' | 'leftover' | 'temporary' | 'file_move' | 'setup' | 'unknown' | 'manual';

// Every way Sonarr and Radarr refuse an import for not being better than the file in place. A replace overrides exactly
// these, so the import fix's hand-off and the replace flow must read the same wording.
export const NOT_BETTER = /not an upgrade|not a quality revision upgrade|not a custom format upgrade|existing file.*(better|equal)/i;

// AA-13 grouped Sonarr's and Radarr's import rejections; these patterns read their wording. Order matters: the first match wins.
const patterns: [ImportCategory, RegExp][] = [
  ['setup', /free space|disk space|root folder|path does not exist|permission|access to the path|access denied|read-only|recycl/i],
  ['bad_release', /no audio|dangerous|executable|unsupported extension|invalid video file|not a valid video/i],
  ['leftover', /already imported|is a sample|sample file|extras?\b/i],
  ['not_better', NOT_BETTER],
  ['temporary', /locked|being used by another process|unpack|tba title|title is not yet|recently aired|still being written/i],
  ['file_move', /failed to (move|import|copy|hardlink)|couldn't (move|import|copy)|unable to (move|copy)|file move/i],
  ['matching', /mismatch|matched to (series|movie) by id|was unexpected|not found in the grab|unable to (parse|identify)|partial season|contains all episodes|invalid season|unknown (series|movie|episode)|manual import required|automatic import is not possible/i],
];

export const TEMPORARY_RETRY_MS = 15 * 60_000;
export const TEMPORARY_LIMIT_MS = 24 * 60 * 60_000;
export const FILE_MOVE_RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 120 * 60_000] as const;
// Sonarr and Radarr accept an import command before running it; this is how long the download may stay blocked afterwards.
export const FORCED_IMPORT_SETTLE_MS = 30 * 60_000;
// A fix that failed waits this long before it runs again, twice as long after each further failure, never more than a day.
export const FIX_FAILED_RETRY_MS = 15 * 60_000;

export const classifyImport = (messages: string[]): ImportCategory => {
  for (const [category, pattern] of patterns) if (messages.some((message) => pattern.test(message))) return category;
  return 'unknown';
};

type Handling = { service: Service; downloadId: string; category: ImportCategory; firstSeenAt: number; attempts: number; lastAttemptAt: number | null; done: boolean };

const messagesOf = (items: QueueItem[]) => items
  .flatMap((item) => [item.errorMessage, ...item.statusMessages.flatMap((message) => [message.title, ...message.messages])])
  .filter((message) => message !== '');

const saveHandling = (database: DatabaseSync, handling: Handling) => {
  database.prepare(`
    INSERT INTO import_handling (service, download_id, category, first_seen_at, attempts, last_attempt_at, done) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (service, download_id) DO UPDATE SET category = excluded.category, first_seen_at = excluded.first_seen_at,
      attempts = excluded.attempts, last_attempt_at = excluded.last_attempt_at, done = excluded.done
  `).run(handling.service, handling.downloadId, handling.category, handling.firstSeenAt, handling.attempts, handling.lastAttemptAt, Number(handling.done));
};

// The import fix leaves the download alone until the command settles, then closes its problems or hands them to the owner.
export const recordHandImport = (database: DatabaseSync, service: Service, downloadId: string, at: number) => {
  saveHandling(database, { service, downloadId, category: 'manual', firstSeenAt: at, attempts: 1, lastAttemptAt: at, done: false });
};

const subjectsOf = (grab: Grab): Subject[] => (grab.movieId !== null
  ? [{ type: 'movie', service: grab.service, id: String(grab.movieId) }]
  : grab.episodeIds.map((id) => ({ type: 'episode' as const, service: grab.service, id: String(id) })));

export const createImportFix = (options: {
  database: DatabaseSync;
  arr: ArrServices;
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

  const save = (handling: Handling) => saveHandling(database, handling);

  // A block can change kind between checks (locked, then a failed move), so a download's import problems close together.
  // Runs once per blocked download per check, so it reads only that download's open problems and never their steps.
  const closeImportProblems = (downloadId: string, text: string, skip: (problem: Pick<Problem, 'id' | 'kind'>) => boolean = () => false) => {
    const rows = database.prepare("SELECT id, kind FROM problems WHERE subject_type = 'torrent' AND service = '' AND subject_id = ? AND state != 'resolved' ORDER BY opened_at, id")
      .all(downloadId)
      .map((row) => ({ id: Number(row.id), kind: String(row.kind) }));
    for (const problem of rows) {
      if (!problem.kind.startsWith('import_') || skip(problem)) continue;
      problems.setState(problem.id, 'resolved', text);
    }
  };

  const handle = async (service: Service, downloadId: string, items: QueueItem[], at: number) => {
    const messages = messagesOf(items);
    const grab = findGrab(database, downloadId);
    let category = classifyImport(messages);
    if (category === 'not_better' && grab?.byHand === true) category = 'replace';
    const previous = readHandling(service, downloadId);
    // An accepted import command is never sent again; until it settles, whatever the queue now says waits.
    if (previous !== undefined && (previous.category === 'matching' || previous.category === 'manual') && previous.lastAttemptAt !== null) {
      if (previous.done || at - previous.lastAttemptAt < FORCED_IMPORT_SETTLE_MS) return;
      category = previous.category;
    }
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
      save({ ...handling, done: true });
      problems.setState(problem.id, state, text);
      closeImportProblems(downloadId, state === 'resolved' ? text : 'Replaced by a newer problem with this download.', (item) => item.id === problem.id);
    };
    const label = service === 'sonarr' ? 'Sonarr' : 'Radarr';
    // A queue that no longer lists the download removes nothing; that is reported as a failure, never as a block.
    const removeFromQueue = async (choice: 'nothing' | 'block' | 'block_and_search') => {
      const { removed } = valueOrThrow(await arr[service].removeFromQueue({ downloadId }, choice));
      if (removed === 0) throw new Error(`${label} no longer lists this download in its queue, so ${choice === 'nothing' ? 'it could not be cleared' : 'the release was not blocked'}.`);
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
        await removeFromQueue('nothing');
        finish('resolved', 'Cleared the leftover from the queue; the torrent stays in rTorrent.');
        return;
      case 'not_better':
        await removeFromQueue('nothing');
        finish('resolved', 'Not better than the current file, so it was not imported; removed from the queue, torrent left seeding.');
        return;
      case 'manual':
      case 'matching': {
        if (handling.lastAttemptAt !== null) {
          finish('needs_you', `${label} accepted the import, but the download is still blocked ${FORCED_IMPORT_SETTLE_MS / 60_000} minutes later. Finish this import by hand.`);
          return;
        }
        if (grab === undefined) {
          finish('needs_you', 'No grab record to check the match against; finish this import by hand.');
          return;
        }
        const result = await arr[service].forceImport(grab);
        if (result.kind === 'ok') {
          save({ ...handling, attempts: handling.attempts + 1, lastAttemptAt: at });
          problems.step(problem.id, 'fix', 'Forced the import onto what was grabbed; waiting for it to finish.');
        } else if (result.kind === 'refused') finish('needs_you', `${result.message} Finish this import by hand.`);
        else valueOrThrow(result);
        return;
      }
      case 'bad_release': {
        const counts = grab === undefined ? [0] : subjectsOf(grab).map((item) => problems.recordReleaseAttempt(item, downloadId));
        const giveUp = Math.max(...counts) >= RELEASE_LIMIT;
        // Not skipping the redownload lets Sonarr or Radarr search again for this item straight away.
        await removeFromQueue(giveUp ? 'block' : 'block_and_search');
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
          save(handling);
          return;
        }
        valueOrThrow(await arr[service].refreshMonitoredDownloads());
        save({ ...handling, attempts: handling.attempts + 1, lastAttemptAt: at });
        problems.step(problem.id, 'fix', 'Asked to try the import again.');
        return;
      }
      case 'file_move': {
        const delay = FILE_MOVE_RETRY_DELAYS_MS[handling.attempts];
        if (delay === undefined) {
          // The last retry gets as long as the spacing before it to show up in the queue before this gives up.
          const settle = FILE_MOVE_RETRY_DELAYS_MS[FILE_MOVE_RETRY_DELAYS_MS.length - 1];
          if (at - (handling.lastAttemptAt ?? at) >= settle) finish('needs_you', `The file move still failed after ${FILE_MOVE_RETRY_DELAYS_MS.length} retries.`);
          else save(handling);
          return;
        }
        if (at - (handling.lastAttemptAt ?? handling.firstSeenAt) < delay) {
          save(handling);
          return;
        }
        valueOrThrow(await arr[service].refreshMonitoredDownloads());
        save({ ...handling, attempts: handling.attempts + 1, lastAttemptAt: at });
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
      const failed = listOpenProblems(database, ['import_fix_failed']);
      for (const [downloadId, items] of groups) {
        // Sonarr and Radarr can refuse the same request every time, so a failed fix backs off instead of resending each check.
        const failure = failed.find((problem) => problem.subject.id === downloadId);
        if (failure !== undefined) {
          const failures = failure.steps.filter((step) => step.kind === 'result').length;
          if (at - failure.updatedAt < Math.min(FIX_FAILED_RETRY_MS * 2 ** (failures - 1), TEMPORARY_LIMIT_MS)) continue;
        }
        // Hundreds of downloads can sit blocked; letting requests in between them keeps a check from freezing the server.
        await nextTurn();
        try {
          await handle(service, downloadId, items, at);
          closeImportProblems(downloadId, 'The import fix worked on a later try.', (item) => item.kind !== 'import_fix_failed');
        } catch (error) {
          const problem = problems.open({ kind: 'import_fix_failed', subject: { type: 'torrent', service: null, id: downloadId }, hash: downloadId, summary: items[0].title });
          const text = error instanceof Error ? error.message : 'The import fix failed.';
          if (problem.state !== 'needs_you') problems.setState(problem.id, 'needs_you', text);
          else problems.step(problem.id, 'result', `Tried again: ${text}`);
          // An unfinished row hands the download to the sweep below, so its problems close once it leaves the queue.
          const previous = readHandling(service, downloadId)
            ?? { service, downloadId, category: classifyImport(messagesOf(items)), firstSeenAt: at, attempts: 0, lastAttemptAt: null, done: false };
          save({ ...previous, done: false });
        }
      }
      // Retries, failed fixes and accepted import commands leave a handling row unfinished; once its download is no longer blocked, it went through.
      const cleared = database.prepare('SELECT download_id FROM import_handling WHERE service = ? AND done = 0').all(service)
        .map((row) => String(row.download_id))
        .filter((downloadId) => !groups.has(downloadId));
      for (const downloadId of cleared) {
        save({ ...readHandling(service, downloadId) as Handling, done: true });
        closeImportProblems(downloadId, 'The download is no longer blocked in the queue.');
      }
      // A problem handed to the owner leaves its row finished, so the sweep above skips it. Import problems carry no service,
      // so they close only once neither queue lists the download.
      const left = database.prepare(`
        SELECT DISTINCT h.download_id FROM import_handling h JOIN problems p
          ON p.subject_type = 'torrent' AND p.service = '' AND p.subject_id = h.download_id AND p.state != 'resolved' AND p.kind LIKE 'import\\_%' ESCAPE '\\'
        WHERE h.service = ? AND NOT EXISTS (SELECT 1 FROM arr_queue q WHERE q.download_id = h.download_id)
      `).all(service).map((row) => String(row.download_id));
      for (const downloadId of left) closeImportProblems(downloadId, 'The download is no longer in the queue.');
    }
  };

  return { check };
};
