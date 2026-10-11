import {
  createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync,
  type KeyObject, randomBytes,
} from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { gunzipSync, gzip } from 'node:zlib';
import { applicationMigrations, assertDatabasePath, openDatabase } from './database.js';
import type { EventHub } from './events.js';
import { getPreference, setPreference } from './preferences.js';

export type BackupStore = {
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
const snapshotKey = /^backups\/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2}\.\d{3})Z-([0-9a-f]{12})\.sqlite\.gz\.enc$/;
const countedTables = ['settings', 'torrents', 'torrent_grabs', 'grabs', 'problems', 'protected_items', 'preferences', 'second_versions', 'version_events'];

const sha256Hex = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const gzipAsync = promisify(gzip);

// Turning backups off is the owner accepting the risk of running without them, so nothing reminds them while it holds.
export const backupsAreOff = (database: DatabaseSync): boolean => getPreference(database, 'backups') === 'off';
export const setBackupsOff = (database: DatabaseSync, off: boolean): void => setPreference(database, 'backups', off ? 'off' : 'on');

// The backup destination would otherwise hold every saved credential in plain text, so snapshots are sealed with AES-256-GCM:
// a 12-byte nonce, the ciphertext, then the 16-byte authentication tag. A snapshot sealed to the app's key pair puts the
// marker and a one-off X25519 public key in front of that, and its AES key comes from the two keys' shared secret.
export const backupKeyFromEnvironment = (env: NodeJS.ProcessEnv = process.env): Buffer | undefined => {
  const value = env.BACKUP_KEY;
  if (value === undefined || value === '') return undefined;
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('BACKUP_KEY must be 64 hex characters.');
  return Buffer.from(value, 'hex');
};

const keyPairPreference = 'backup.keyPair';
const restoreKeyPrefix = 'mm2-restore-';
const pairMarker = Buffer.from('mm2x25519', 'ascii');
// DER headers that turn 32 raw X25519 bytes into a key Node can import; a JWK import of the private half alone fails.
const spkiPrefix = Buffer.from('302a300506032b656e032100', 'hex');
const pkcs8Prefix = Buffer.from('302e020100300506032b656e04220420', 'hex');

// Only the public half is stored; the private half is returned once for the owner to keep, so the server alone cannot restore.
// JWK x and d are already the raw 32 bytes in base64url.
export const createBackupKeyPair = (database: DatabaseSync, now: () => number = Date.now) => {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const createdAt = now();
  setPreference(database, keyPairPreference, JSON.stringify({ publicKey: publicKey.export({ format: 'jwk' }).x, createdAt }));
  return { restoreKey: `${restoreKeyPrefix}${privateKey.export({ format: 'jwk' }).d}`, createdAt };
};

export const readBackupKeyPair = (database: DatabaseSync): { publicKey: string; createdAt: number } | undefined => {
  const stored = getPreference(database, keyPairPreference);
  return stored === undefined ? undefined : JSON.parse(stored) as { publicKey: string; createdAt: number };
};

export const restoreKeyFromEnvironment = (env: NodeJS.ProcessEnv = process.env): string | undefined => {
  const value = env.BACKUP_RESTORE_KEY;
  if (value === undefined || value === '') return undefined;
  if (!/^mm2-restore-[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('BACKUP_RESTORE_KEY must be mm2-restore- followed by 43 characters.');
  return value;
};

type SealKey = { kind: 'env'; key: Buffer } | { kind: 'pair'; publicKey: string };

const aesSeal = (key: Buffer, plain: Uint8Array) => {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]);
};

const aesOpen = (key: Buffer, data: Buffer) => {
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(data.length - 16));
  return Buffer.concat([decipher.update(data.subarray(12, data.length - 16)), decipher.final()]);
};

const rawPublicKey = (key: KeyObject) => Buffer.from(key.export({ format: 'jwk' }).x as string, 'base64url');

const pairAesKey = (privateKey: KeyObject, publicKey: KeyObject, ephemeralRaw: Buffer, recipientRaw: Buffer) => Buffer.from(hkdfSync(
  'sha256',
  diffieHellman({ privateKey, publicKey }),
  Buffer.alloc(0),
  Buffer.concat([pairMarker, ephemeralRaw, recipientRaw]),
  32,
));

const seal = (sealKey: SealKey, plain: Uint8Array) => {
  if (sealKey.kind === 'env') return aesSeal(sealKey.key, plain);
  const recipientRaw = Buffer.from(sealKey.publicKey, 'base64url');
  const recipient = createPublicKey({ key: Buffer.concat([spkiPrefix, recipientRaw]), format: 'der', type: 'spki' });
  const ephemeral = generateKeyPairSync('x25519');
  const ephemeralRaw = rawPublicKey(ephemeral.publicKey);
  return Buffer.concat([pairMarker, ephemeralRaw, aesSeal(pairAesKey(ephemeral.privateKey, recipient, ephemeralRaw, recipientRaw), plain)]);
};

// The marker at the start of the body says which kind of key sealed it, so restore never has to guess.
const open = (sealed: Uint8Array, { key, restoreKey }: { key?: Buffer; restoreKey?: string }) => {
  const data = Buffer.from(sealed);
  if (!data.subarray(0, pairMarker.length).equals(pairMarker)) {
    if (key === undefined) throw new Error('This backup needs BACKUP_KEY.');
    try {
      return aesOpen(key, data);
    } catch {
      throw new Error('Downloaded snapshot could not be decrypted with BACKUP_KEY.');
    }
  }
  if (restoreKey === undefined) throw new Error('This backup needs the restore key; set BACKUP_RESTORE_KEY.');
  try {
    const privateRaw = Buffer.from(restoreKey.slice(restoreKeyPrefix.length), 'base64url');
    const privateKey = createPrivateKey({ key: Buffer.concat([pkcs8Prefix, privateRaw]), format: 'der', type: 'pkcs8' });
    const ephemeralRaw = data.subarray(pairMarker.length, pairMarker.length + 32);
    const ephemeral = createPublicKey({ key: Buffer.concat([spkiPrefix, ephemeralRaw]), format: 'der', type: 'spki' });
    const aesKey = pairAesKey(privateKey, ephemeral, ephemeralRaw, rawPublicKey(createPublicKey(privateKey)));
    return aesOpen(aesKey, data.subarray(pairMarker.length + 32));
  } catch {
    throw new Error('Downloaded snapshot could not be decrypted with the restore key.');
  }
};
const keyTime = (key: string) => {
  const match = snapshotKey.exec(key);
  return match === null ? undefined : Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`);
};

// Keeps every snapshot from the last 24 hours plus the newest of each earlier UTC day within 7 days.
const prune = async (store: BackupStore, now: number, uploadedKey: string) => {
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

export const createBackup = ({ database, events, store, key = backupKeyFromEnvironment, now = Date.now }: {
  database: DatabaseSync;
  events: EventHub;
  store: () => BackupStore | undefined;
  key?: () => Buffer | undefined;
  now?: () => number;
}) => {
  // total_changes() counts this connection's writes and data_version moves when another connection commits; together they see every write.
  const writeMarker = () => {
    const changes = database.prepare('SELECT total_changes() AS value').get()?.value;
    const version = database.prepare('PRAGMA data_version').get()?.data_version;
    return `${changes}:${version}`;
  };
  let backedUpMarker: string | undefined;

  const snapshot = async (target: BackupStore, sealKey: SealKey, startedAt: number) => {
    const directory = mkdtempSync(join(tmpdir(), 'media-manager-2-backup-'));
    let raw: Uint8Array;
    let marker: string;
    try {
      const path = join(directory, 'snapshot.sqlite');
      // Read before the snapshot: a commit landing between the two then forces one extra upload instead of being skipped.
      marker = writeMarker();
      // The copy runs off the main thread so requests keep moving. Its own read-only connection sees only committed writes,
      // so it never catches half of a job's transaction; one step copies every page under a single read, so no write restarts it.
      const file = String(database.prepare("SELECT file FROM pragma_database_list WHERE name = 'main'").get()?.file);
      const source = new DatabaseSync(file, { readOnly: true });
      try {
        await backup(source, path, { rate: 2 ** 31 - 1 });
      } finally {
        source.close();
      }
      raw = await readFile(path);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    const sha256 = sha256Hex(raw);
    const body = seal(sealKey, await gzipAsync(raw));
    const key = `backups/${new Date(startedAt).toISOString().replace(/:/g, '-')}-${sha256.slice(0, 12)}.sqlite.gz.enc`;
    await target.put(key, body, 'application/octet-stream');
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
      let target: BackupStore | undefined;
      let sealKey: SealKey | undefined;
      let configError: string | undefined;
      try {
        target = store();
        // A key pair made in the app replaces BACKUP_KEY, which is then not read at all.
        const pair = readBackupKeyPair(database);
        const envKey = pair === undefined ? key() : undefined;
        if (pair !== undefined) sealKey = { kind: 'pair', publicKey: pair.publicKey };
        else if (envKey !== undefined) sealKey = { kind: 'env', key: envKey };
      } catch (error) {
        configError = error instanceof Error ? error.message : 'Backup is not configured correctly.';
      }
      // The marker describes the database as the uploaded snapshot saw it; undefined means nothing is known to be backed up.
      let marker: string | undefined;
      let result: Omit<BackupRun, 'id' | 'startedAt' | 'finishedAt'>;
      if (backupsAreOff(database)) {
        result = { outcome: 'skipped', detail: 'off', objectKey: null, bytes: null, sha256: null };
      } else if (configError !== undefined) {
        result = { outcome: 'failed', detail: configError, objectKey: null, bytes: null, sha256: null };
      } else if (target === undefined) {
        result = { outcome: 'skipped', detail: 'not_configured', objectKey: null, bytes: null, sha256: null };
      } else if (sealKey === undefined) {
        // A destination means the owner asked for backups, so a missing key must show as a failure, not as not set up.
        result = { outcome: 'failed', detail: 'No backup key: create one in the app or set BACKUP_KEY.', objectKey: null, bytes: null, sha256: null };
      } else if (!force && backedUpMarker !== undefined && backedUpMarker === writeMarker()) {
        marker = backedUpMarker;
        result = { outcome: 'skipped', detail: 'unchanged', objectKey: null, bytes: null, sha256: null };
      } else {
        try {
          const uploaded = await snapshot(target, sealKey, startedAt);
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

const readPointerKey = async (store: BackupStore) => {
  const body = await store.get(pointerKey);
  if (body === undefined) return undefined;
  try {
    const key = (JSON.parse(Buffer.from(body).toString('utf8')) as { key?: unknown }).key;
    return typeof key === 'string' ? key : undefined;
  } catch {
    return undefined;
  }
};

export const listSnapshots = async (store: BackupStore) => {
  const snapshots = (await store.list('backups/'))
    .filter(({ key }) => snapshotKey.test(key))
    .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  return { latestKey: await readPointerKey(store), snapshots };
};

export const restoreBackup = async ({ store, target, objectKey, key: sealKey, restoreKey }: {
  store: BackupStore;
  target: string;
  objectKey?: string;
  key?: Buffer;
  restoreKey?: string;
}) => {
  assertDatabasePath(target);
  if (existsSync(target)) throw new Error('Restore target already exists.');
  const key = objectKey ?? await readPointerKey(store);
  const body = key === undefined ? undefined : await store.get(key);
  if (key === undefined || body === undefined) throw new Error('No backup found.');

  const expected = snapshotKey.exec(key)?.[5];
  const compressed = open(body, { key: sealKey, restoreKey });
  let raw: Uint8Array;
  try {
    raw = gunzipSync(compressed);
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
