import type { DatabaseSync } from 'node:sqlite';
import { writeDependency } from './dependencies.js';
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
  trackerHost: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  goneAt: number | null;
  seedingSeconds: number;
};

export const POLL_INTERVAL_MS = 30_000;
// razor: at most this many tracker lookups per poll, so a first run against a full client stays one light call per torrent.
const TRACKER_LOOKUPS_PER_POLL = 20;

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
] as const;

type Observed = Pick<Torrent, (typeof fields)[number][0]>;

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
  trackerHost: 'tracker_host',
  firstSeenAt: 'first_seen_at',
  lastSeenAt: 'last_seen_at',
  goneAt: 'gone_at',
  seedingSeconds: 'seeding_seconds',
};
const flagKeys = new Set(['started', 'open', 'active', 'complete']);
const keys = Object.keys(columns) as (keyof Torrent)[];

const parseRows = (value: unknown): Observed[] => {
  if (!Array.isArray(value)) throw new Error('Unexpected rTorrent response.');
  return value.map((row) => {
    if (!Array.isArray(row) || row.length !== fields.length) throw new Error('Unexpected rTorrent response.');
    const torrent: Record<string, unknown> = {};
    fields.forEach(([key, , kind], index) => {
      const cell = row[index];
      if (kind === 'string') {
        if (typeof cell !== 'string') throw new Error('Unexpected rTorrent response.');
        torrent[key] = cell;
      } else {
        if (typeof cell !== 'number' || !Number.isSafeInteger(cell)) throw new Error('Unexpected rTorrent response.');
        torrent[key] = kind === 'flag' ? cell !== 0 : cell;
      }
    });
    const observed = torrent as Observed;
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

  const poll = async () => {
    const startedAt = now();
    let observed: Observed[];
    try {
      observed = parseRows(await rtorrent.call('d.multicall2', ['', 'main', ...fields.map(([, command]) => command)]));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'rTorrent is unreachable.';
      setDependency('down', startedAt, detail);
      return;
    }
    const at = now();
    const existing = new Map(listTorrents(database).map((torrent) => [torrent.hash, torrent]));
    const hosts = await lookUpTrackers(observed
      .filter((torrent) => (existing.get(torrent.hash)?.trackerHost ?? null) === null)
      .map((torrent) => torrent.hash));

    const changed: Torrent[] = [];
    const gone: string[] = [];
    const seen = new Set<string>();
    const upsert = database.prepare(`
      INSERT INTO torrents (${keys.map((key) => columns[key]).join(', ')})
      VALUES (${keys.map(() => '?').join(', ')})
      ON CONFLICT (hash) DO UPDATE SET ${keys.filter((key) => key !== 'hash').map((key) => `${columns[key]} = excluded.${columns[key]}`).join(', ')}
    `);
    database.exec('BEGIN IMMEDIATE;');
    try {
      for (const torrent of observed) {
        if (seen.has(torrent.hash)) continue;
        seen.add(torrent.hash);
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
        gone.push(previous.hash);
      }
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
    setDependency('ok', at, '');
    if (changed.length > 0 || gone.length > 0) events.publish('torrents', { changed, gone });
  };

  return { poll, intervalMs };
};
