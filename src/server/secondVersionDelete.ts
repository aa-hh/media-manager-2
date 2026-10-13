import { type BigIntStats, lstatSync, realpathSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { listSecondVersionRows, type SecondVersionRow } from './secondVersionRows.js';
import { readSetting } from './services/connection.js';
import { listSettingKeys } from './settings.js';
import type { Removal } from './torrentFiles.js';

type Service = 'sonarr' | 'radarr';

export type SecondVersionDeletion =
  | { kind: 'not_found' }
  | { kind: 'refused'; reason: string }
  | {
    kind: 'deleted';
    deleted: { path: string } | null;
    torrent: { removed: true } | { removed: false; reason: string };
    secondVersions: SecondVersionRow[];
  };

// Strictly inside: the folder itself does not count.
const isInside = (folder: string, path: string) => {
  const rest = relative(folder, path);
  return rest !== '' && rest.split(sep)[0] !== '..' && !isAbsolute(rest);
};

const isMissing = (error: unknown) => error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Deletes one second version's file from the versions folder, and its torrent only through removeTorrent, which
// checks that nothing kept still uses the torrent's data.
export const createSecondVersionDelete = (options: {
  database: DatabaseSync;
  removeTorrent: (hash: string) => Promise<Removal>;
  scan: (service: Service, root: string, folders: Set<string>) => Promise<void>;
  now?: () => number;
}) => {
  const { database } = options;
  const now = options.now ?? Date.now;

  const event = (id: number, at: number, kind: string, detail: string) => {
    database.prepare('INSERT INTO version_events (second_version_id, at, kind, detail) VALUES (?, ?, ?, ?)').run(id, at, kind, detail);
  };

  return async (id: number, removeTorrent: boolean): Promise<SecondVersionDeletion> => {
    const row = database.prepare("SELECT * FROM second_versions WHERE id = ? AND state != 'deleted'").get(id);
    if (row === undefined) return { kind: 'not_found' };
    const refuse = (reason: string) => ({ kind: 'refused', reason }) as const;
    const service = row.service as Service;
    const state = String(row.state);
    const hash = row.hash === null ? null : String(row.hash);
    const filePath = row.file_path === null ? null : String(row.file_path);
    // An import or a send in flight would still link or record the file after the row was marked deleted.
    if (state !== 'imported' && state !== 'failed') return refuse(`This second version is still ${state}; delete it once it has imported or failed.`);

    // Everything up to the database update runs with no await, so no other request or job sees a half-deleted version.
    if (removeTorrent && hash !== null) {
      const others = Number(database.prepare("SELECT COUNT(*) AS n FROM second_versions WHERE hash = ? AND id != ? AND state != 'deleted'").get(hash, id)?.n);
      if (others > 0) {
        return refuse(`${others === 1 ? 'Another second version uses' : `${others} other second versions use`} this torrent, so it cannot be removed. Delete ${others === 1 ? 'that one' : 'those'} first, or keep the torrent.`);
      }
    }

    let deleted: { path: string } | null = null;
    let fileNote = filePath === null ? 'No file was imported.' : 'The file was already gone.';
    let folder: string | undefined;
    const root = readSetting(database, 'hostPaths', `versions.${service}`);
    if (filePath !== null) {
      if (root === undefined || !isAbsolute(root)) return refuse(`hostPaths versions.${service} is not set, so the file cannot be checked.`);
      let realRoot: string | undefined;
      let realParent: string | undefined;
      try {
        realRoot = realpathSync(root);
        realParent = realpathSync(dirname(filePath));
      } catch (error) {
        if (!isMissing(error)) return refuse(`Could not check ${filePath}: ${messageOf(error)}`);
      }
      // Checked by name and by real path, so a folder link inside the versions folder cannot lead outside it.
      const real = realRoot === undefined || realParent === undefined ? undefined : { root: realRoot, path: `${realParent}${sep}${basename(filePath)}` };
      if (!isInside(resolve(root), resolve(filePath)) || (real !== undefined && !isInside(real.root, real.path))) {
        return refuse(`${filePath} is outside hostPaths versions.${service}, so it was not deleted.`);
      }
      const sharedBy = Number(database.prepare("SELECT COUNT(*) AS n FROM second_versions WHERE file_path = ? AND id != ? AND state != 'deleted'").get(filePath, id)?.n);
      let stats: BigIntStats | undefined;
      try {
        stats = lstatSync(filePath, { bigint: true });
      } catch (error) {
        if (!isMissing(error)) return refuse(`Could not check ${filePath}: ${messageOf(error)}`);
      }
      if (stats !== undefined && sharedBy > 0) {
        fileNote = 'The file stays: another second version uses it.';
      } else if (stats !== undefined) {
        if (row.file_inode === null) return refuse(`No inode was recorded when ${filePath} was imported, so it was not deleted.`);
        if (!stats.isFile() || `${stats.dev}:${stats.ino}` !== String(row.file_inode)) {
          return refuse(`${filePath} is no longer the file imported there, so it was not deleted.`);
        }
        try {
          unlinkSync(filePath);
        } catch (error) {
          return refuse(`Could not delete ${filePath}: ${messageOf(error)}`);
        }
        deleted = { path: filePath };
        fileNote = basename(filePath);
        // Empty folders inside the versions folder go too, never the versions folder or any other hostPaths folder.
        const kept = new Set(listSettingKeys(database).filter((entry) => entry.category === 'hostPaths')
          .flatMap((entry) => readSetting(database, 'hostPaths', entry.key) ?? []).map((path) => resolve(path)));
        folder = dirname(resolve(filePath));
        while (isInside(resolve(root), folder) && !kept.has(folder)) {
          try {
            rmdirSync(folder);
          } catch {
            break;
          }
          folder = dirname(folder);
        }
      }
    }

    const at = now();
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.prepare("UPDATE second_versions SET state = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?").run(at, at, id);
      event(id, at, 'deleted', fileNote);
      if (!removeTorrent) event(id, at, 'torrent_kept', 'Kept seeding, as chosen.');
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }

    let torrent: { removed: true } | { removed: false; reason: string } = { removed: false, reason: 'Kept seeding, as chosen.' };
    if (removeTorrent) {
      if (hash === null) {
        torrent = { removed: false, reason: 'This second version has no torrent.' };
      } else {
        // The file is already unlinked, so removeTorrent's own check no longer counts it as kept.
        const removal = await options.removeTorrent(hash);
        torrent = removal.removed ? { removed: true } : { removed: false, reason: removal.reason };
      }
      event(id, now(), torrent.removed ? 'torrent_removed' : 'torrent_kept', torrent.removed ? 'Removed from rTorrent with its data.' : torrent.reason);
    }

    if (deleted !== null && root !== undefined && folder !== undefined) {
      try {
        statSync(folder);
        await options.scan(service, root, new Set([folder]));
      } catch {
        // A folder gone since the delete leaves the media server to its own scheduled scan.
      }
    }

    const title = service === 'radarr' ? { service, movieId: Number(row.movie_id) } as const : { service, seriesId: Number(row.series_id) } as const;
    return { kind: 'deleted', deleted, torrent, secondVersions: listSecondVersionRows(database, title) };
  };
};

export type SecondVersionDelete = ReturnType<typeof createSecondVersionDelete>;
