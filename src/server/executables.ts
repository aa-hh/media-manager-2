import type { DatabaseSync } from 'node:sqlite';
import { subjectsOf } from './imports.js';
import type { createProblems } from './problems.js';
import { deferSearches } from './searches.js';
import type { Removal } from './torrentFiles.js';
import { findGrab, listQueue } from './torrentGrabs.js';

type Problems = ReturnType<typeof createProblems>;

// Program files no video release carries; one in a grabbed torrent marks a fake.
const PROGRAM_EXTENSIONS = ['exe', 'scr', 'bat', 'cmd', 'com', 'msi', 'lnk', 'pif', 'vbs', 'ps1'];

// Removes torrents Sonarr or Radarr grabbed that hold a program file, once neither queue lists them: while queued, the import fix
// blocks the release. An unfinished torrent is removed; a finished one may owe its tracker seeding time, so the owner decides.
// razor: a queued torrent that Sonarr or Radarr never flags waits here forever; checking queued torrents too is the upgrade path.
export const createExecutableSweep = (options: {
  database: DatabaseSync;
  problems: Problems;
  removeTorrent: (hash: string) => Promise<Removal>;
  now?: () => number;
}) => {
  const { database, problems, removeTorrent } = options;
  const now = options.now ?? Date.now;

  const check = async () => {
    const queued = new Set(listQueue(database).flatMap((item) => (item.downloadId === null ? [] : [item.downloadId.toUpperCase()])));
    const rows = database.prepare(`
      SELECT f.hash, f.path, t.name, t.complete FROM torrent_files f JOIN torrents t ON t.hash = f.hash
      WHERE t.gone_at IS NULL AND (${PROGRAM_EXTENSIONS.map(() => 'lower(f.path) LIKE ?').join(' OR ')}) ORDER BY f.hash, f."index"
    `).all(...PROGRAM_EXTENSIONS.map((extension) => `%.${extension}`));
    const found = new Map<string, { path: string; name: string; complete: boolean }>();
    for (const row of rows) {
      const hash = String(row.hash);
      if (!found.has(hash)) found.set(hash, { path: String(row.path), name: String(row.name), complete: row.complete === 1 });
    }
    // rTorrent's next poll marks a removed torrent gone; until then its resolved problem keeps it from being removed twice.
    const handled = database.prepare("SELECT 1 FROM problems WHERE kind = 'program_file' AND subject_type = 'torrent' AND subject_id = ? AND state = 'resolved'");
    for (const [hash, { path, name, complete }] of found) {
      const grab = findGrab(database, hash);
      if (grab === undefined || queued.has(hash) || handled.get(hash) !== undefined) continue;
      const file = path.split('/').at(-1) ?? path;
      const problem = problems.open({ kind: 'program_file', subject: { type: 'torrent', service: null, id: hash }, hash, summary: `${name} holds a program file, not a video: ${file}` });
      if (problem.state === 'needs_you') continue;
      if (complete) {
        problems.setState(problem.id, 'needs_you', 'It finished downloading, so it was left in rTorrent: removing a finished torrent can break its tracker\'s seeding rule.');
        continue;
      }
      const removal = await removeTorrent(hash);
      if (!removal.removed) {
        problems.setState(problem.id, 'needs_you', `Not removed: ${removal.reason}`);
        continue;
      }
      deferSearches(database, subjectsOf(grab), now());
      problems.setState(problem.id, 'resolved', 'Removed the torrent and its files. The next search waits six hours, so a real release has time to turn up.');
    }
  };

  return { check };
};
