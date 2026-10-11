import { type BigIntStats, lstatSync, readdirSync, realpathSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { readDependency } from './dependencies.js';
import type { ArrServices, Service } from './services/arr.js';
import { readSetting } from './services/connection.js';
import type { XmlRpcParam } from './services/rtorrent.js';
import { listSettingKeys } from './settings.js';
import { parseFileList } from './torrents.js';

type XmlRpcCall = (method: string, params: readonly XmlRpcParam[]) => Promise<unknown>;

export type LibraryFileState = 'linked' | 'copied' | 'none' | 'unknown';
export type LibraryFileMapping = { path: string; fileId: number; state: LibraryFileState; hashes: string[]; reason: string | null };
export type TorrentMapping = {
  hash: string;
  name: string;
  files: { path: string; sizeBytes: number; libraryPaths: string[]; alsoListedBy: string[] }[];
};
export type RemovalCheck = { allowed: true } | { allowed: false; reason: string };
export type Removal = { removed: true; deleted: string[]; left: { path: string; reason: string }[] } | { removed: false; reason: string };

type LiveTorrent = { hash: string; name: string; directory: string; files: { path: string; sizeBytes: number }[] | null };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isMissing = (error: unknown) => error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
const inodeOf = (stats: BigIntStats) => `${stats.dev}:${stats.ino}`;

// undefined when nothing is there; any other failure throws, because an unreadable file may still hold data.
const statIfPresent = (path: string) => {
  try {
    return statSync(path, { bigint: true });
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
};

// The path with its folder's links resolved, so two spellings of one file compare equal.
const realPath = (path: string) => {
  try {
    return join(realpathSync(dirname(path)), basename(path));
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
};

const realOrResolved = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

// Strictly inside: the root itself does not count.
const isInside = (root: string, path: string) => {
  const rest = relative(root, path);
  return rest !== '' && rest.split(sep)[0] !== '..' && !isAbsolute(rest);
};

export const createTorrentFiles = (options: { database: DatabaseSync; rtorrent: { call: XmlRpcCall }; arr: ArrServices }) => {
  const { database, rtorrent, arr } = options;

  const hostPaths = (prefix: string) => listSettingKeys(database)
    .filter(({ category, key }) => category === 'hostPaths' && key.startsWith(prefix))
    .flatMap(({ key }) => readSetting(database, 'hostPaths', key) ?? []);

  // A torrent's files are null until its list is stored and its directory known; full path is d.directory joined with f.path.
  // A torrent of size 0 has no metadata yet, so it holds no data and lists no paths.
  const liveTorrents = (): LiveTorrent[] => {
    const lists = new Map<string, { path: string; sizeBytes: number }[]>();
    for (const row of database.prepare('SELECT hash, path, size_bytes FROM torrent_files ORDER BY hash, "index"').all()) {
      const hash = String(row.hash);
      lists.set(hash, [...(lists.get(hash) ?? []), { path: String(row.path), sizeBytes: Number(row.size_bytes) }]);
    }
    return database.prepare('SELECT hash, name, directory, size_bytes FROM torrents WHERE gone_at IS NULL ORDER BY hash').all().map((row) => {
      const hash = String(row.hash);
      const directory = String(row.directory);
      const list = lists.get(hash);
      return {
        hash,
        name: String(row.name),
        directory,
        files: Number(row.size_bytes) === 0 ? [] : list === undefined || !isAbsolute(directory) ? null : list.map((file) => ({ path: join(directory, file.path), sizeBytes: file.sizeBytes })),
      };
    });
  };

  const rtorrentCurrent = () => readDependency(database, 'rtorrent')?.state === 'ok';

  const mapFiles = async (files: { path: string; fileId: number }[], service: Service, titleId: number) => {
    const torrents = liveTorrents();
    // Any gap means a torrent could hold a file unseen, so no file may be called 'none'.
    const gaps: string[] = [];
    if (!rtorrentCurrent()) gaps.push('rTorrent is not answering, so its torrent list may be out of date.');
    if (torrents.some((torrent) => torrent.files === null)) gaps.push("rTorrent's file lists are not all read yet.");

    const torrentInodes = new Map<string, string>();
    const holders = new Map<string, Set<string>>();
    const listedBy = new Map<string, string[]>();
    for (const torrent of torrents) {
      for (const file of torrent.files ?? []) {
        listedBy.set(file.path, [...(listedBy.get(file.path) ?? []), torrent.hash]);
        let stats: BigIntStats | undefined;
        try {
          stats = statIfPresent(file.path);
        } catch (error) {
          gaps.push(`Could not read ${file.path}: ${messageOf(error)}`);
          continue;
        }
        if (stats === undefined) continue;
        const inode = inodeOf(stats);
        torrentInodes.set(`${torrent.hash}\n${file.path}`, inode);
        holders.set(inode, (holders.get(inode) ?? new Set()).add(torrent.hash));
      }
    }

    const live = new Set(torrents.map((torrent) => torrent.hash));
    const imports = new Map<string, Set<string>>();
    const history = service === 'sonarr' ? await arr.sonarr.history({ seriesId: titleId }) : await arr.radarr.history({ movieId: titleId });
    if (history.kind === 'ok') {
      for (const record of history.value) {
        const hash = record.downloadId?.toUpperCase();
        const { fileId } = record.data;
        if (record.eventType !== 'downloadFolderImported' || hash === undefined || fileId === undefined || !live.has(hash)) continue;
        imports.set(fileId, (imports.get(fileId) ?? new Set()).add(hash));
      }
    } else {
      gaps.push(history.message);
    }

    const libraryInodes = new Map<string, string[]>();
    const mapped = files.map((file): LibraryFileMapping => {
      let inode: string;
      try {
        inode = inodeOf(statSync(file.path, { bigint: true }));
      } catch (error) {
        return { ...file, state: 'unknown', hashes: [], reason: `Could not read ${file.path}: ${messageOf(error)}` };
      }
      libraryInodes.set(inode, [...(libraryInodes.get(inode) ?? []), file.path]);
      const linked = holders.get(inode);
      if (linked !== undefined) return { ...file, state: 'linked', hashes: [...linked], reason: null };
      const copied = imports.get(String(file.fileId));
      if (copied !== undefined) return { ...file, state: 'copied', hashes: [...copied], reason: null };
      return gaps.length === 0 ? { ...file, state: 'none', hashes: [], reason: null } : { ...file, state: 'unknown', hashes: [], reason: gaps[0] };
    });

    const named = new Set(mapped.flatMap((file) => file.hashes));
    const holding = torrents.filter((torrent) => named.has(torrent.hash)).map((torrent): TorrentMapping => ({
      hash: torrent.hash,
      name: torrent.name,
      files: (torrent.files ?? []).map((file) => {
        const inode = torrentInodes.get(`${torrent.hash}\n${file.path}`);
        return {
          ...file,
          libraryPaths: inode === undefined ? [] : libraryInodes.get(inode) ?? [],
          alsoListedBy: (listedBy.get(file.path) ?? []).filter((hash) => hash !== torrent.hash),
        };
      }),
    }));
    return { files: mapped, torrents: holding };
  };

  // One walk of every library and versions folder, so a delete plan checks all its torrents against a single read.
  const readLibraryInodes = (after: string[]): { inodes: Map<string, string>; blocked: string | null } => {
    const inodes = new Map<string, string>();
    const gone = new Set(after.map((path) => resolve(path)));
    try {
      for (const root of [...hostPaths('library.'), ...hostPaths('versions.')]) {
        for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
          const path = join(entry.parentPath, entry.name);
          if (gone.has(resolve(path)) || !(entry.isFile() || entry.isSymbolicLink())) continue;
          const stats = statIfPresent(path);
          if (stats === undefined) continue;
          if (stats.isDirectory()) return { inodes, blocked: `${path} links to a folder, so the files under it cannot be checked.` };
          if (!inodes.has(inodeOf(stats))) inodes.set(inodeOf(stats), path);
        }
      }
    } catch (error) {
      return { inodes, blocked: `Could not check the files: ${messageOf(error)}` };
    }
    return { inodes, blocked: null };
  };

  const canRemoveTorrent = (hash: string, options: { after?: string[]; library?: ReturnType<typeof readLibraryInodes> } = {}): RemovalCheck => {
    const refuse = (reason: string): RemovalCheck => ({ allowed: false, reason });
    const torrents = liveTorrents();
    const torrent = torrents.find((candidate) => candidate.hash === hash.toUpperCase());
    if (torrent === undefined) return refuse('rTorrent no longer lists this torrent.');
    if (!rtorrentCurrent()) return refuse('rTorrent is not answering, so its torrent list may be out of date.');
    if (torrent.files === null) return refuse("This torrent's file list has not been read from rTorrent yet.");
    if (torrents.some((other) => other.files === null)) {
      return refuse("rTorrent's file lists are not all read yet, so another torrent may use the same files.");
    }
    const downloads = hostPaths('downloads.');
    if (downloads.length === 0) return refuse('No hostPaths downloads folder is set.');
    const libraryRoots = hostPaths('library.');
    if (libraryRoots.length === 0) return refuse('No hostPaths library folder is set.');
    const roots = downloads.flatMap((root) => [resolve(root), realOrResolved(root)]);

    try {
      for (const file of torrent.files) {
        const real = realPath(file.path);
        if (!roots.some((root) => isInside(root, file.path)) || (real !== undefined && !roots.some((root) => isInside(root, real)))) {
          return refuse(`${file.path} is outside every hostPaths downloads folder.`);
        }
      }

      const own = new Map<string, string>();
      for (const file of torrent.files) {
        const stats = statIfPresent(file.path);
        if (stats !== undefined) own.set(inodeOf(stats), file.path);
      }
      const ownPaths = new Set(torrent.files.map((file) => file.path));
      for (const other of torrents) {
        if (other.hash === torrent.hash) continue;
        for (const file of other.files ?? []) {
          const used = `${file.path} is also used by the torrent ${other.name}.`;
          if (ownPaths.has(file.path)) return refuse(used);
          const stats = statIfPresent(file.path);
          const mine = stats === undefined ? undefined : own.get(inodeOf(stats));
          if (mine !== undefined && realPath(mine) === realPath(file.path)) return refuse(used);
        }
      }

      const library = options.library ?? readLibraryInodes(options.after ?? []);
      if (library.blocked !== null) return refuse(library.blocked);
      for (const [inode, shared] of own) {
        const path = library.inodes.get(inode);
        if (path !== undefined) return refuse(`${shared} shares its data with the library file ${path}.`);
      }
    } catch (error) {
      return refuse(`Could not check the files: ${messageOf(error)}`);
    }
    return { allowed: true };
  };

  // Only folders inside a multi-file torrent's own folder, and that folder itself, are removed, and only when empty.
  const removeEmptyFolders = (directory: string, files: { path: string }[]) => {
    const own = resolve(directory);
    if (hostPaths('').map((path) => resolve(path)).includes(own) || !hostPaths('downloads.').some((root) => isInside(resolve(root), own))) return;
    const folders = new Set<string>();
    for (const file of files) {
      for (let folder = dirname(resolve(file.path)); folder === own || isInside(own, folder); folder = dirname(folder)) {
        folders.add(folder);
        if (folder === own) break;
      }
    }
    for (const folder of [...folders].sort((a, b) => b.split(sep).length - a.split(sep).length)) {
      try {
        rmdirSync(folder);
      } catch {
        continue;
      }
    }
  };

  // The stored lists are up to one poll old, so a torrent added or given metadata since then is read from rTorrent here.
  const pathUsedNow = async (hash: string, files: { path: string }[]): Promise<string | null> => {
    const stored = new Set(liveTorrents().filter((torrent) => (torrent.files ?? []).length > 0).map((torrent) => torrent.hash));
    const own = new Set(files.map((file) => file.path));
    const ownReal = new Set(files.map((file) => realPath(file.path) ?? file.path));
    const rows = await rtorrent.call('d.multicall2', ['', 'main', 'd.hash=', 'd.name=', 'd.directory=']);
    if (!Array.isArray(rows)) throw new Error('Unexpected rTorrent response.');
    for (const row of rows) {
      if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'string' || typeof row[2] !== 'string') {
        throw new Error('Unexpected rTorrent response.');
      }
      const [other, name, directory] = row as string[];
      if (other.toUpperCase() === hash || stored.has(other.toUpperCase())) continue;
      const answer = await rtorrent.call('f.multicall', [other, '', 'f.path=', 'f.size_bytes=']);
      const list = Array.isArray(answer) && answer.length === 0 ? [] : parseFileList(answer);
      if (list === null || (list.length > 0 && !isAbsolute(directory))) throw new Error(`Could not read the files of ${name}.`);
      for (const file of list) {
        const path = join(directory, file.path);
        if (own.has(path) || ownReal.has(realPath(path) ?? path)) return `${path} is also used by the torrent ${name}.`;
      }
    }
    return null;
  };

  const removeTorrent = async (hash: string): Promise<Removal> => {
    const key = hash.toUpperCase();
    const check = canRemoveTorrent(key);
    if (!check.allowed) return { removed: false, reason: check.reason };
    const torrent = liveTorrents().find((candidate) => candidate.hash === key);
    if (torrent === undefined || torrent.files === null) return { removed: false, reason: 'rTorrent no longer lists this torrent.' };
    const { files } = torrent;

    let multi: unknown;
    try {
      if (await rtorrent.call('d.directory', [key]) !== torrent.directory) {
        return { removed: false, reason: 'rTorrent moved this torrent since its files were checked; try again after the next check.' };
      }
      multi = await rtorrent.call('d.is_multi_file', [key]);
      const used = await pathUsedNow(key, files);
      if (used !== null) return { removed: false, reason: used };
    } catch (error) {
      return { removed: false, reason: `rTorrent did not answer (${messageOf(error)}), so nothing was removed.` };
    }
    if (multi !== 0 && multi !== 1) return { removed: false, reason: 'rTorrent gave an unexpected answer, so nothing was removed.' };
    try {
      await rtorrent.call('d.erase', [key]);
    } catch (error) {
      return { removed: false, reason: `rTorrent did not remove the torrent (${messageOf(error)}), so no files were deleted.` };
    }

    const deleted: string[] = [];
    const left: { path: string; reason: string }[] = [];
    for (const file of files) {
      try {
        if (lstatSync(file.path).isDirectory()) {
          left.push({ path: file.path, reason: 'It is a folder.' });
          continue;
        }
        unlinkSync(file.path);
        deleted.push(file.path);
      } catch (error) {
        if (!isMissing(error)) left.push({ path: file.path, reason: messageOf(error) });
      }
    }
    if (multi === 1) removeEmptyFolders(torrent.directory, files);
    return { removed: true, deleted, left };
  };

  return { mapFiles, readLibraryInodes, canRemoveTorrent, removeTorrent };
};
