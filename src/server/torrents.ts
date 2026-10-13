import type { DatabaseSync } from 'node:sqlite';
import { readDependency, writeDependency } from './dependencies.js';
import type { EventHub } from './events.js';

type XmlRpcCall = (method: string, params: readonly string[]) => Promise<unknown>;

export type Torrent = {
  hash: string;
  name: string;
  sizeBytes: number;
  completedBytes: number;
  downRate: number;
  upRate: number;
  started: boolean;
  open: boolean;
  active: boolean;
  complete: boolean;
  message: string;
  finishedAtSeconds: number;
  ratioThousandths: number;
  peersConnected: number;
  seedersConnected: number;
  directory: string;
  trackerHost: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  goneAt: number | null;
  seedingSeconds: number;
};

export const POLL_INTERVAL_MS = 30_000;
export const LIVE_POLL_INTERVAL_MS = 1_000;
// razor: at most this many tracker lookups per poll, so a first run against a full client stays one light call per torrent.
const TRACKER_LOOKUPS_PER_POLL = 20;
// razor: same ceiling for file list reads; a full client fills in over a few minutes of polls.
const FILE_LIST_READS_PER_POLL = 20;
// A torrent that comes back inside a month keeps its first-seen time and seeding counter.
const GONE_ROW_KEEP_MS = 30 * 24 * 60 * 60_000;

export type TorrentFile = { path: string; sizeBytes: number };

// A list with a path that is absolute or climbs out with '..' is not stored, so the torrent counts as unread.
export const parseFileList = (value: unknown): TorrentFile[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const files: TorrentFile[] = [];
  for (const row of value) {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'number' || !Number.isSafeInteger(row[1]) || row[1] < 0) return null;
    const path = row[0];
    if (path === '' || path.startsWith('/') || path.split('/').some((part) => part === '..')) return null;
    files.push({ path, sizeBytes: row[1] });
  }
  return files;
};

const fields = [
  ['hash', 'd.hash=', 'string'],
  ['name', 'd.name=', 'string'],
  ['sizeBytes', 'd.size_bytes=', 'number'],
  ['completedBytes', 'd.completed_bytes=', 'number'],
  ['downRate', 'd.down.rate=', 'number'],
  ['upRate', 'd.up.rate=', 'number'],
  ['started', 'd.state=', 'flag'],
  ['open', 'd.is_open=', 'flag'],
  ['active', 'd.is_active=', 'flag'],
  ['complete', 'd.complete=', 'flag'],
  ['message', 'd.message=', 'string'],
  ['finishedAtSeconds', 'd.timestamp.finished=', 'number'],
  ['ratioThousandths', 'd.ratio=', 'number'],
  ['peersConnected', 'd.peers_connected=', 'number'],
  ['seedersConnected', 'd.peers_complete=', 'number'],
  ['directory', 'd.directory=', 'string'],
] as const;

type Observed = Pick<Torrent, (typeof fields)[number][0]>;

// The values that move second to second. Name, size and folder change rarely and stay with the full poll.
const liveFields = fields.filter(([key]) => key !== 'name' && key !== 'sizeBytes' && key !== 'directory');
type Live = Pick<Torrent, (typeof liveFields)[number][0]>;

const columns: Record<keyof Torrent, string> = {
  hash: 'hash',
  name: 'name',
  sizeBytes: 'size_bytes',
  completedBytes: 'completed_bytes',
  downRate: 'down_rate',
  upRate: 'up_rate',
  started: 'started',
  open: 'open',
  active: 'active',
  complete: 'complete',
  message: 'message',
  finishedAtSeconds: 'finished_at',
  ratioThousandths: 'ratio_thousandths',
  peersConnected: 'peers_connected',
  seedersConnected: 'seeders_connected',
  directory: 'directory',
  trackerHost: 'tracker_host',
  firstSeenAt: 'first_seen_at',
  lastSeenAt: 'last_seen_at',
  goneAt: 'gone_at',
  seedingSeconds: 'seeding_seconds',
};
const flagKeys = new Set(['started', 'open', 'active', 'complete']);
const keys = Object.keys(columns) as (keyof Torrent)[];

const parseRows = <T extends { hash: string }>(value: unknown, requested: readonly (typeof fields)[number][] = fields): T[] => {
  if (!Array.isArray(value)) throw new Error('Unexpected rTorrent response.');
  return value.map((row) => {
    if (!Array.isArray(row) || row.length !== requested.length) throw new Error('Unexpected rTorrent response.');
    const torrent: Record<string, unknown> = {};
    requested.forEach(([key, , kind], index) => {
      const cell = row[index];
      if (kind === 'string') {
        if (typeof cell !== 'string') throw new Error('Unexpected rTorrent response.');
        torrent[key] = cell;
      } else {
        if (typeof cell !== 'number' || !Number.isSafeInteger(cell)) throw new Error('Unexpected rTorrent response.');
        torrent[key] = kind === 'flag' ? cell !== 0 : cell;
      }
    });
    const observed = torrent as T;
    if (!/^[0-9A-Fa-f]{40}$/.test(observed.hash)) throw new Error('Unexpected rTorrent response.');
    return { ...observed, hash: observed.hash.toUpperCase() };
  });
};

const isSeeding = (torrent: Pick<Torrent, 'complete' | 'started' | 'active' | 'message'>) => (
  torrent.complete && torrent.started && torrent.active && torrent.message === ''
);

// Announce URLs carry the passkey in their path or query, so only the host is ever kept.
// '' means looked up and none found (trackerless or DHT-only), so the torrent is not queued again.
const trackerHostFrom = (value: unknown): string => {
  if (!Array.isArray(value)) return '';
  for (const row of value) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
    try {
      const host = new URL(row[0]).hostname.toLowerCase();
      if (host !== '') return host;
    } catch {
      continue;
    }
  }
  return '';
};

const readRow = (row: Record<string, unknown>): Torrent => {
  const torrent: Record<string, unknown> = {};
  for (const key of keys) {
    const value = row[columns[key]];
    torrent[key] = flagKeys.has(key) ? value === 1 : value;
  }
  return torrent as Torrent;
};

export const listTorrents = (database: DatabaseSync): Torrent[] => database
  .prepare('SELECT * FROM torrents ORDER BY first_seen_at, hash')
  .all()
  .map((row) => readRow(row as Record<string, unknown>));

export const createTorrentPoller = (options: {
  database: DatabaseSync;
  rtorrent: { call: XmlRpcCall };
  events: EventHub;
  now?: () => number;
  intervalMs?: number;
}) => {
  const { database, rtorrent, events } = options;
  const now = options.now ?? Date.now;
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;

  const setDependency = (state: 'ok' | 'down', at: number, detail: string) => {
    writeDependency(database, events, 'rtorrent', state, at, detail);
  };

  const lookUpTrackers = async (hashes: string[]) => {
    const hosts = new Map<string, string>();
    for (const hash of hashes.slice(0, TRACKER_LOOKUPS_PER_POLL)) {
      try {
        hosts.set(hash, trackerHostFrom(await rtorrent.call('t.multicall', [hash, '', 't.url='])));
      } catch {
        continue;
      }
    }
    return hosts;
  };

  const readFileLists = async (hashes: string[]) => {
    const lists = new Map<string, TorrentFile[]>();
    for (const hash of hashes.slice(0, FILE_LIST_READS_PER_POLL)) {
      try {
        const files = parseFileList(await rtorrent.call('f.multicall', [hash, '', 'f.path=', 'f.size_bytes=']));
        if (files !== null) lists.set(hash, files);
      } catch {
        continue;
      }
    }
    return lists;
  };

  // True when the torrents table now matches rTorrent.
  const poll = async (): Promise<boolean> => {
    const startedAt = now();
    let observed: Observed[];
    try {
      observed = parseRows<Observed>(await rtorrent.call('d.multicall2', ['', 'main', ...fields.map(([, command]) => command)]));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'rTorrent is unreachable.';
      setDependency('down', startedAt, detail);
      return false;
    }
    const at = now();
    const existing = new Map(listTorrents(database).map((torrent) => [torrent.hash, torrent]));
    const hosts = await lookUpTrackers(observed
      .filter((torrent) => (existing.get(torrent.hash)?.trackerHost ?? null) === null)
      .map((torrent) => torrent.hash));
    const listed = new Set(database.prepare('SELECT DISTINCT hash FROM torrent_files').all().map((row) => String(row.hash)));
    // A torrent of size 0 has no metadata yet, so it has no list to read and no data on disk.
    const fileLists = await readFileLists(observed.filter((torrent) => torrent.sizeBytes > 0 && !listed.has(torrent.hash)).map((torrent) => torrent.hash));

    const changed: Torrent[] = [];
    const gone: string[] = [];
    const seen = new Set<string>();
    const upsert = database.prepare(`
      INSERT INTO torrents (${keys.map((key) => columns[key]).join(', ')})
      VALUES (${keys.map(() => '?').join(', ')})
      ON CONFLICT (hash) DO UPDATE SET ${keys.filter((key) => key !== 'hash').map((key) => `${columns[key]} = excluded.${columns[key]}`).join(', ')}
    `);
    const insertFile = database.prepare('INSERT OR IGNORE INTO torrent_files (hash, "index", path, size_bytes) VALUES (?, ?, ?, ?)');
    database.exec('BEGIN IMMEDIATE;');
    try {
      for (const [hash, files] of fileLists) files.forEach((file, index) => insertFile.run(hash, index, file.path, file.sizeBytes));
      for (const torrent of observed) {
        if (seen.has(torrent.hash)) continue;
        seen.add(torrent.hash);
        if (torrent.sizeBytes === 0) database.prepare('DELETE FROM torrent_files WHERE hash = ?').run(torrent.hash);
        const previous = existing.get(torrent.hash);
        const elapsed = previous === undefined ? 0 : at - previous.lastSeenAt;
        // Credit seeding only across one ordinary poll gap; a restart or outage adds nothing, so the counter can only undercount.
        const credited = previous !== undefined && previous.goneAt === null && isSeeding(previous) && isSeeding(torrent)
          && elapsed > 0 && elapsed <= intervalMs * 2;
        const next: Torrent = {
          ...torrent,
          trackerHost: previous?.trackerHost ?? hosts.get(torrent.hash) ?? null,
          firstSeenAt: previous?.firstSeenAt ?? at,
          lastSeenAt: at,
          goneAt: null,
          seedingSeconds: (previous?.seedingSeconds ?? 0) + (credited ? Math.floor(elapsed / 1000) : 0),
        };
        upsert.run(...keys.map((key) => {
          const value = next[key];
          return typeof value === 'boolean' ? Number(value) : value;
        }));
        // The counter ticks on every seeding poll; publishing for that alone would resend every seeding torrent each interval.
        if (previous === undefined || keys.some((key) => key !== 'lastSeenAt' && key !== 'seedingSeconds' && previous[key] !== next[key])) {
          changed.push(next);
        }
      }
      for (const previous of existing.values()) {
        if (seen.has(previous.hash) || previous.goneAt !== null) continue;
        database.prepare('UPDATE torrents SET gone_at = ? WHERE hash = ?').run(at, previous.hash);
        database.prepare('DELETE FROM torrent_files WHERE hash = ?').run(previous.hash);
        gone.push(previous.hash);
      }
      database.prepare(`DELETE FROM torrents WHERE gone_at IS NOT NULL AND gone_at < ? AND hash NOT IN (SELECT hash FROM torrent_grabs)
        AND hash NOT IN (SELECT hash FROM second_versions WHERE hash IS NOT NULL)`).run(at - GONE_ROW_KEEP_MS);
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
    setDependency('ok', at, '');
    if (changed.length > 0 || gone.length > 0) events.publish('torrents', { changed, gone });
    return true;
  };

  // Refreshes the moving values of torrents the full poll already stored, publishing only rows that changed.
  // It never adds, marks gone or touches lastSeenAt and seedingSeconds, so the seeding credit stays with the full poll's gaps;
  // a failed read is left for the full poll to report.
  const pollLive = async () => {
    // While the full poll has rTorrent marked down, a hanging client would hold every run for the request time limit.
    if (readDependency(database, 'rtorrent')?.state === 'down') return;
    let observed: Live[];
    try {
      observed = parseRows<Live>(await rtorrent.call('d.multicall2', ['', 'main', ...liveFields.map(([, command]) => command)]), liveFields);
    } catch {
      return;
    }
    const existing = new Map(listTorrents(database).map((torrent) => [torrent.hash, torrent]));
    const changed: Torrent[] = [];
    const update = database.prepare(`UPDATE torrents SET ${liveFields.filter(([key]) => key !== 'hash').map(([key]) => `${columns[key]} = ?`).join(', ')} WHERE hash = ?`);
    database.exec('BEGIN IMMEDIATE;');
    try {
      for (const live of observed) {
        const previous = existing.get(live.hash);
        if (previous === undefined || previous.goneAt !== null) continue;
        const next: Torrent = { ...previous, ...live };
        if (!liveFields.some(([key]) => previous[key] !== next[key])) continue;
        existing.set(live.hash, next);
        update.run(...liveFields.filter(([key]) => key !== 'hash').map(([key]) => {
          const value = next[key];
          return typeof value === 'boolean' ? Number(value) : value;
        }), live.hash);
        changed.push(next);
      }
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
    if (changed.length > 0) events.publish('torrents', { changed, gone: [], live: true });
  };

  return { poll, pollLive, intervalMs };
};
