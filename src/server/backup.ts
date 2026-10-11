import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync, gzipSync } from 'node:zlib';
import { applicationMigrations, assertDatabasePath, openDatabase } from './database.js';
import type { EventHub } from './events.js';

type Store = {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | undefined>;
  list(prefix: string): Promise<Array<{ key: string; size: number }>>;
  delete(key: string): Promise<void>;
};

export type BackupRun = {
  id: number;
  startedAt: number;
  finishedAt: number;
  outcome: 'ok' | 'failed' | 'skipped';
  detail: string;
  objectKey: string | null;
  bytes: number | null;
  sha256: string | null;
};

const hour = 3_600_000;
const day = 24 * hour;
const pointerKey = 'backups/latest.json';
const snapshotKey = /^backups\/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2}\.\d{3})Z-([0-9a-f]{12})\.sqlite\.gz$/;
const countedTables = ['settings', 'torrents', 'torrent_grabs', 'grabs', 'problems', 'protected_items', 'preferences'];

const sha256Hex = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const keyTime = (key: string) => {
  const match = snapshotKey.exec(key);
  return match === null ? undefined : Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`);
};

// Keeps every snapshot from the last 24 hours plus the newest of each earlier UTC day within 7 days.
const prune = async (store: Store, now: number, uploadedKey: string) => {
  const older = (await store.list('backups/'))
    .map(({ key }) => ({ key, time: keyTime(key) }))
    .filter((entry): entry is { key: string; time: number } => entry.time !== undefined && entry.key !== uploadedKey)
    .filter(({ time }) => now - time > day)
    .sort((a, b) => b.time - a.time);
  const keptDays = new Set<string>();
  for (const { key, time } of older) {
    const utcDay = new Date(time).toISOString().slice(0, 10);
    if (now - time <= 7 * day && !keptDays.has(utcDay)) {
      keptDays.add(utcDay);
    } else {
      await store.delete(key);
    }
  }
};

export const createBackup = ({ database, events, store, now = Date.now }: {
  database: DatabaseSync;
  events: EventHub;
  store: () => Store | undefined;
  now?: () => number;
}) => {
  // total_changes() counts this connection's writes and data_version moves when another connection commits; together they see every write.
  const writeMarker = () => {
    const changes = database.prepare('SELECT total_changes() AS value').get()?.value;
    const version = database.prepare('PRAGMA data_version').get()?.data_version;
    return `${changes}:${version}`;
  };
  let backedUpMarker: string | undefined;

  const snapshot = async (target: Store, startedAt: number) => {
    const directory = mkdtempSync(join(tmpdir(), 'media-manager-2-backup-'));
    let raw: Uint8Array;
    let marker: string;
    try {
      const path = join(directory, 'snapshot.sqlite');
      // Read before the snapshot: a commit landing between the two then forces one extra upload instead of being skipped.
      marker = writeMarker();
      database.prepare('VACUUM INTO ?').run(path);
      raw = readFileSync(path);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    const sha256 = sha256Hex(raw);
    const body = gzipSync(raw);
    const key = `backups/${new Date(startedAt).toISOString().replace(/:/g, '-')}-${sha256.slice(0, 12)}.sqlite.gz`;
    await target.put(key, body, 'application/gzip');
    const pointer = { key, sha256, bytes: body.byteLength, uploadedAt: now() };
    await target.put(pointerKey, Buffer.from(JSON.stringify(pointer)), 'application/json');
    let detail = '';
    try {
      await prune(target, startedAt, key);
    } catch (error) {
      detail = `prune failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
    return { marker, result: { detail, objectKey: key, bytes: body.byteLength, sha256 } };
  };

  return {
    async run({ force = false }: { force?: boolean } = {}): Promise<BackupRun> {
      const startedAt = now();
      const target = store();
      // The marker describes the database as the uploaded snapshot saw it; undefined means nothing is known to be backed up.
      let marker: string | undefined;
      let result: Omit<BackupRun, 'id' | 'startedAt' | 'finishedAt'>;
      if (target === undefined) {
        result = { outcome: 'skipped', detail: 'not_configured', objectKey: null, bytes: null, sha256: null };
      } else if (!force && backedUpMarker !== undefined && backedUpMarker === writeMarker()) {
        marker = backedUpMarker;
        result = { outcome: 'skipped', detail: 'unchanged', objectKey: null, bytes: null, sha256: null };
      } else {
        try {
          const uploaded = await snapshot(target, startedAt);
          marker = uploaded.marker;
          result = { outcome: 'ok', ...uploaded.result };
        } catch (error) {
          result = {
            outcome: 'failed',
            detail: error instanceof Error ? error.message : 'Backup failed.',
            objectKey: null,
            bytes: null,
            sha256: null,
          };
        }
      }
      const finishedAt = now();
      // Another job may write while the upload is in flight; then the next run must snapshot again.
      const snapshotStillCurrent = marker !== undefined && marker === writeMarker();
      const { lastInsertRowid } = database.prepare(`
        INSERT INTO backup_runs (started_at, finished_at, outcome, detail, object_key, bytes, sha256)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(startedAt, finishedAt, result.outcome, result.detail, result.objectKey, result.bytes, result.sha256);
      database.prepare('DELETE FROM backup_runs WHERE started_at < ?').run(startedAt - 30 * day);
      backedUpMarker = snapshotStillCurrent ? writeMarker() : undefined;
      const run: BackupRun = { id: Number(lastInsertRowid), startedAt, finishedAt, ...result };
      events.publish('backup', run);
      return run;
    },
  };
};

export const listBackupRuns = (database: DatabaseSync, limit = 50): BackupRun[] => database.prepare(`
  SELECT id, started_at, finished_at, outcome, detail, object_key, bytes, sha256
  FROM backup_runs ORDER BY id DESC LIMIT ?
`).all(limit).map((row) => ({
  id: Number(row.id),
  startedAt: Number(row.started_at),
  finishedAt: Number(row.finished_at),
  outcome: row.outcome as BackupRun['outcome'],
  detail: String(row.detail),
  objectKey: row.object_key === null ? null : String(row.object_key),
  bytes: row.bytes === null ? null : Number(row.bytes),
  sha256: row.sha256 === null ? null : String(row.sha256),
}));

const readPointerKey = async (store: Store) => {
  const body = await store.get(pointerKey);
  if (body === undefined) return undefined;
  try {
    const key = (JSON.parse(Buffer.from(body).toString('utf8')) as { key?: unknown }).key;
    return typeof key === 'string' ? key : undefined;
  } catch {
    return undefined;
  }
};

export const listSnapshots = async (store: Store) => {
  const snapshots = (await store.list('backups/'))
    .filter(({ key }) => snapshotKey.test(key))
    .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  return { latestKey: await readPointerKey(store), snapshots };
};

export const restoreBackup = async ({ store, target, objectKey }: { store: Store; target: string; objectKey?: string }) => {
  assertDatabasePath(target);
  if (existsSync(target)) throw new Error('Restore target already exists.');
  const key = objectKey ?? await readPointerKey(store);
  const body = key === undefined ? undefined : await store.get(key);
  if (key === undefined || body === undefined) throw new Error('No backup found.');

  const expected = snapshotKey.exec(key)?.[5];
  let raw: Uint8Array;
  try {
    raw = gunzipSync(body);
  } catch {
    throw new Error('Downloaded snapshot does not match its name.');
  }
  if (expected === undefined || !sha256Hex(raw).startsWith(expected)) {
    throw new Error('Downloaded snapshot does not match its name.');
  }

  const directory = mkdtempSync(join(tmpdir(), 'media-manager-2-restore-'));
  try {
    const copy = join(directory, 'snapshot.sqlite');
    writeFileSync(copy, raw, { mode: 0o600 });
    const snapshot = new DatabaseSync(copy, { readOnly: true });
    try {
      if (snapshot.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') {
        throw new Error('Downloaded snapshot failed its integrity check.');
      }
      if (Number(snapshot.prepare('PRAGMA user_version').get()?.user_version) > applicationMigrations.length) {
        throw new Error('Database schema version is newer than this application.');
      }
    } finally {
      snapshot.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, raw, { flag: 'wx', mode: 0o600 });
  let restored: DatabaseSync;
  try {
    restored = openDatabase(target);
  } catch (error) {
    // The file was created above with 'wx', so it is this run's own; leaving it would block every retry.
    rmSync(target, { force: true });
    throw error;
  }
  try {
    const counts = countedTables.map((table) => ({
      table,
      count: Number(restored.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count),
    }));
    return { key, counts };
  } finally {
    restored.close();
  }
};
