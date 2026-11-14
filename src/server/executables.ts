import type { DatabaseSync } from 'node:sqlite';
import { subjectsOf } from './imports.js';
import type { createProblems, Subject } from './problems.js';
import { deferSearches } from './searches.js';
import type { Removal } from './torrentFiles.js';
import { findGrab, listQueue } from './torrentGrabs.js';

type Problems = ReturnType<typeof createProblems>;

// Program files no video release carries.
const PROGRAM_EXTENSIONS = ['exe', 'scr', 'bat', 'cmd', 'com', 'msi', 'lnk', 'pif', 'vbs', 'ps1'];
const VIDEO_EXTENSIONS = ['mkv', 'mp4', 'avi', 'm4v', 'ts', 'm2ts', 'wmv', 'mov', 'webm', 'mpg', 'mpeg'];
// The queue copy is refreshed at least every five minutes; a torrent younger than this may be missing from it while Sonarr still tracks it.
export const QUEUE_SETTLE_MS = 10 * 60_000;
// A removal rTorrent keeps refusing (not answering, file lists still being read) is retried each check for this long, then handed over.
export const REMOVAL_RETRY_MS = 24 * 60 * 60_000;

const anyEnding = (column: string, extensions: string[]) => extensions.map(() => `lower(${column}) LIKE ?`).join(' OR ');
const endings = (extensions: string[]) => extensions.map((extension) => `%.${extension}`);

// Removes obvious fakes: a torrent Sonarr or Radarr picked by itself that holds a program file and no video, with nothing downloaded,
// so no tracker is owed seeding. Any other torrent holding a program file (one with video, partly downloaded, finished, or picked by
// hand) is only flagged to the owner. While a queue lists the torrent, the import fix blocks the release instead.
// razor: a queued fake that Sonarr or Radarr never flags waits here forever; checking queued torrents too is the upgrade path.
export const createExecutableSweep = (options: {
  database: DatabaseSync;
  problems: Problems;
  removeTorrent: (hash: string) => Promise<Removal>;
  isManualDownload: (subject: Subject) => boolean;
  now?: () => number;
}) => {
  const { database, problems, removeTorrent, isManualDownload } = options;
  const now = options.now ?? Date.now;

  const check = async () => {
    const at = now();
    const queued = new Set(listQueue(database).flatMap((item) => (item.downloadId === null ? [] : [item.downloadId.toUpperCase()])));
    const rows = database.prepare(`
      SELECT t.hash, t.name, t.complete, t.completed_bytes, t.first_seen_at,
        (SELECT f.path FROM torrent_files f WHERE f.hash = t.hash AND (${anyEnding('f.path', PROGRAM_EXTENSIONS)}) ORDER BY f."index" LIMIT 1) AS program,
        EXISTS (SELECT 1 FROM torrent_files v WHERE v.hash = t.hash AND (${anyEnding('v.path', VIDEO_EXTENSIONS)})) AS video
      FROM torrents t WHERE t.gone_at IS NULL
    `).all(...endings(PROGRAM_EXTENSIONS), ...endings(VIDEO_EXTENSIONS));
    // rTorrent's next poll marks a removed torrent gone; until then its resolved problem keeps it from being removed twice.
    const handled = database.prepare("SELECT 1 FROM problems WHERE kind = 'program_file' AND subject_type = 'torrent' AND subject_id = ? AND state = 'resolved'");
    for (const row of rows) {
      if (row.program === null) continue;
      const hash = String(row.hash);
      const grab = findGrab(database, hash);
      if (grab === undefined || queued.has(hash) || handled.get(hash) !== undefined || at - Number(row.first_seen_at) < QUEUE_SETTLE_MS) continue;
      const subjects = subjectsOf(grab);
      const file = String(row.program).split('/').at(-1);
      const problem = problems.open({ kind: 'program_file', subject: { type: 'torrent', service: null, id: hash }, hash, summary: `${String(row.name)} holds a program file: ${file}` });
      if (problem.state === 'needs_you') continue;
      const kept = row.video === 1 ? 'it also holds video'
        : row.complete === 1 ? 'it finished downloading, so its tracker may be owed seeding time'
          : Number(row.completed_bytes) > 0 ? 'part of it downloaded, so its tracker may be owed seeding time'
            : grab.byHand || subjects.some(isManualDownload) ? 'you picked it by hand' : null;
      if (kept !== null) {
        problems.setState(problem.id, 'needs_you', `Left in rTorrent because ${kept}.`);
        continue;
      }
      const removal = await removeTorrent(hash);
      if (removal.removed) {
        deferSearches(database, subjects, at);
        problems.setState(problem.id, 'resolved', 'Removed the fake and its files. The next search waits six hours, so a real release has time to turn up.');
      } else if (at - problem.openedAt >= REMOVAL_RETRY_MS) {
        problems.setState(problem.id, 'needs_you', `Not removed after a day of tries: ${removal.reason}`);
      } else if (problem.steps.at(-1)?.text !== `Not removed yet: ${removal.reason}`) {
        problems.step(problem.id, 'result', `Not removed yet: ${removal.reason}`);
      }
    }
  };

  return { check };
};
