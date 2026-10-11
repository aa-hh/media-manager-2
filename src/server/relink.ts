import { existsSync, linkSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { findGrab, type Grab, listQueue, type Service } from './torrentGrabs.js';
import { listOpenProblems, type createProblems, type Subject } from './problems.js';
import { readSetting } from './services/connection.js';
import type { XmlRpcParam } from './services/rtorrent.js';
import { listTorrents } from './torrents.js';

type Problems = ReturnType<typeof createProblems>;
type ArrRequest = (path: string, init?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }) => Promise<{ status: number; body: unknown }>;
type XmlRpcCall = (method: string, params: readonly XmlRpcParam[]) => Promise<unknown>;

export const HOST_PATH_KEYS = ['downloads.sonarr', 'downloads.radarr', 'library.sonarr', 'library.radarr'] as const;
export const PROBLEM_KIND = 'download_missing';
export const MISSING_DATA = /hash check returned unfinished chunks|no such file|could not open/i;
export const HASH_POLL_MS = 5_000;
export const HASH_WAIT_LIMIT_MS = 2 * 60 * 60_000;

const labels: Record<Service, string> = { sonarr: 'Sonarr', radarr: 'Radarr' };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const subjectsOf = (grab: Grab): Subject[] => (grab.movieId !== null
  ? [{ type: 'movie', service: grab.service, id: String(grab.movieId) }]
  : grab.episodeIds.map((id) => ({ type: 'episode' as const, service: grab.service, id: String(id) })));

// Re-seeding after the download copy was deleted (AA-66): the library still holds hardlinks of the same files,
// so they are linked back under the download root, rechecked in rTorrent and started, with nothing downloaded again.
export const createRelinkFix = (options: {
  database: DatabaseSync;
  rtorrent: { call: XmlRpcCall };
  arr: Record<Service, { request: ArrRequest }>;
  problems: Problems;
  isManualDownload: (subject: Subject) => boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}) => {
  const { database, rtorrent, arr, problems, isManualDownload } = options;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const torrentFiles = async (hash: string) => {
    const rows = await rtorrent.call('f.multicall', [hash, '', 'f.path=', 'f.size_bytes=']);
    if (!Array.isArray(rows)) throw new Error('Unexpected rTorrent response.');
    return rows.map((row) => {
      if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'number') throw new Error('Unexpected rTorrent response.');
      return { path: row[0], size: row[1] };
    });
  };

  const libraryFolder = async (grab: Grab, root: string) => {
    const id = grab.service === 'radarr' ? grab.movieId : grab.seriesId;
    if (id === null) throw new Error(grab.service === 'radarr' ? 'No movie is recorded for this grab.' : 'No series is recorded for this grab.');
    const { status, body } = await arr[grab.service].request(grab.service === 'radarr' ? `/api/v3/movie/${id}` : `/api/v3/series/${id}`);
    if (status < 200 || status > 299 || !isRecord(body) || typeof body.path !== 'string') {
      throw new Error(`${labels[grab.service]} did not give the library folder.`);
    }
    const folder = body.path;
    const inside = relative(root, folder);
    if (!isAbsolute(folder) || inside.startsWith('..') || isAbsolute(inside)) {
      throw new Error(`${folder} is outside hostPaths library.${grab.service}.`);
    }
    return folder;
  };

  const relink = async (problemId: number, hash: string, name: string, grab: Grab, files: { path: string; size: number }[]) => {
    if (subjectsOf(grab).some(isManualDownload)) {
      problems.setState(problemId, 'needs_you', 'This is a manual download, so it is left alone.');
      return;
    }
    const downloadRoot = readSetting(database, 'hostPaths', `downloads.${grab.service}`);
    const libraryRoot = readSetting(database, 'hostPaths', `library.${grab.service}`);
    if (downloadRoot === undefined || libraryRoot === undefined) {
      throw new Error(`Set hostPaths downloads.${grab.service} and library.${grab.service} first.`);
    }
    const folder = await libraryFolder(grab, libraryRoot);
    const candidates = readdirSync(folder, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = join(entry.parentPath, entry.name);
        const stats = statSync(path);
        return { path, size: stats.size, ino: stats.ino };
      });
    const used = new Set<string>();
    const pairs = files.map((file) => {
      const match = candidates.find((candidate) => !used.has(candidate.path) && candidate.size === file.size);
      if (match === undefined) throw new Error(`No library file has exactly ${file.size} bytes for ${file.path}.`);
      used.add(match.path);
      return { file, library: match };
    });
    if (statSync(downloadRoot).dev !== statSync(folder).dev) throw new Error('The download folder and the library are on different drives.');

    await rtorrent.call('d.close', [hash]);
    problems.step(problemId, 'fix', 'Closed the torrent in rTorrent.');
    await rtorrent.call('d.directory.set', [hash, downloadRoot]);
    problems.step(problemId, 'fix', `Pointed it at ${downloadRoot}.`);
    const base = await rtorrent.call('d.is_multi_file', [hash]) === 1 ? join(downloadRoot, name) : downloadRoot;
    for (const { file, library } of pairs) {
      const destination = join(base, file.path);
      mkdirSync(dirname(destination), { recursive: true });
      if (existsSync(destination) && statSync(destination).ino === library.ino) continue;
      linkSync(library.path, destination);
    }
    const n = pairs.length;
    problems.step(problemId, 'fix', `Hardlinked ${n} file${n === 1 ? '' : 's'} from the library.`);
    await rtorrent.call('d.open', [hash]);
    problems.step(problemId, 'fix', 'Opened it.');
    await rtorrent.call('d.check_hash', [hash]);
    problems.step(problemId, 'fix', 'Rechecking the data.');

    const startedAt = now();
    for (;;) {
      await sleep(HASH_POLL_MS);
      if (await rtorrent.call('d.hashing', [hash]) === 0) break;
      if (now() - startedAt >= HASH_WAIT_LIMIT_MS) throw new Error('Still rechecking after two hours.');
    }
    if (await rtorrent.call('d.complete', [hash]) !== 1) {
      throw new Error('The recheck found the data incomplete, so the torrent stays stopped.');
    }
    await rtorrent.call('d.start', [hash]);
    problems.step(problemId, 'fix', 'Started it.');
    try {
      await rtorrent.call('d.message.set', [hash, '']);
    } catch {
      problems.step(problemId, 'fix', 'Could not clear the old message in rTorrent.');
    }
    problems.setState(problemId, 'resolved', 'Seeding again from the library copy.');
  };

  const check = async () => {
    if (problems.pausedBy(['rtorrent']).length > 0) return;
    for (const torrent of listTorrents(database)) {
      const { hash } = torrent;
      if (torrent.goneAt !== null || !(!torrent.started || MISSING_DATA.test(torrent.message))) continue;
      const grab = findGrab(database, hash);
      if (grab === undefined || grab.failedAt !== null) continue;
      if (listQueue(database).some((item) => item.downloadId === hash)) continue;
      if (database.prepare('SELECT 1 FROM stall_watch WHERE hash = ? AND replaced_at IS NOT NULL').get(hash) !== undefined) continue;
      if (database.prepare('SELECT 1 FROM torrent_issues WHERE hash = ? AND replace = 1').get(hash) !== undefined) continue;
      if (problems.pausedBy(['rtorrent', grab.service]).length > 0) continue;

      const earlier = listOpenProblems(database).find((problem) => problem.kind === PROBLEM_KIND && problem.hash === hash);
      if (earlier?.state === 'needs_you') continue;
      if (earlier?.state === 'handling') {
        problems.setState(earlier.id, 'needs_you', 'An earlier attempt was interrupted; check the torrent in rTorrent.');
        continue;
      }

      const files = await torrentFiles(hash);
      const directory = await rtorrent.call('d.directory', [hash]);
      if (typeof directory !== 'string') throw new Error('Unexpected rTorrent response.');
      if (files.some((file) => existsSync(join(directory, file.path)))) continue;

      const problem = problems.open({
        kind: PROBLEM_KIND,
        subject: { type: 'torrent', service: null, id: hash },
        hash,
        summary: `${torrent.name}: rTorrent's download files are gone.`,
      });
      try {
        await relink(problem.id, hash, torrent.name, grab, files);
      } catch (error) {
        problems.setState(problem.id, 'needs_you', error instanceof Error ? error.message : 'The fix failed.');
      }
    }
  };

  return { check };
};
