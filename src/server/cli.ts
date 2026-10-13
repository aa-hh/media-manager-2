import type { DatabaseSync } from 'node:sqlite';
import { dirname, isAbsolute, join } from 'node:path';
import { backupKeyFromEnvironment, createBackup, listSnapshots, restoreBackup, restoreKeyFromEnvironment, setBackupsOff } from './backup.js';
import { backupDestinationFromEnvironment, createBackupStore, readBackupDestination } from './backupDestination.js';
import { defaultDatabasePath, openDatabase } from './database.js';
import { createEventHub } from './events.js';
import { setLogSink } from './log.js';
import { createArr } from './services/arr.js';
import { createMediaServer } from './services/mediaServer.js';
import { createRtorrent } from './services/rtorrent.js';
import { createTrackerAccounts } from './services/trackerAccounts.js';
import { deleteSetting, listSettingKeys, setSetting } from './settings.js';
import { getPreference, setPreference } from './preferences.js';
import { BACKDROP_SOURCE_KEY, BACKDROP_SOURCES } from './backdrops.js';
import { clearCache } from './clearCache.js';

const usage = [
  'usage: node dist/server/cli.js settings set <category> <key>   (value read from stdin)',
  '       node dist/server/cli.js settings delete <category> <key>',
  '       node dist/server/cli.js settings list',
  '       node dist/server/cli.js connections check',
  '       node dist/server/cli.js backdrop source [tmdb | trakt | fanart]   (shows the source, or switches it)',
  '       node dist/server/cli.js cache clear   (saved title details, backdrops, Discover rows and copied images)',
  '       node dist/server/cli.js backup now   (a key made in the app, or BACKUP_KEY)',
  '       node dist/server/cli.js backup off | on',
  '       node dist/server/cli.js backup list   (BACKUP_FOLDER or BACKUP_ENDPOINT, BACKUP_BUCKET, BACKUP_ACCESS_KEY_ID, BACKUP_SECRET_ACCESS_KEY)',
  '       node dist/server/cli.js backup restore --to <absolute path> [--object <key>]   (the backup list variables and BACKUP_RESTORE_KEY or BACKUP_KEY)',
].join('\n');

const readStdin = async () => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
};

const checkConnections = async (database: DatabaseSync) => {
  const mediaServer = createMediaServer(database, { ownerPlexId: process.env.PLEX_OWNER_ID })();
  const services = [
    ['sonarr', createArr('sonarr', database)],
    ['radarr', createArr('radarr', database)],
    ['rtorrent', createRtorrent(database)],
    [mediaServer.name, mediaServer],
  ] as const;
  const [statuses, trackerStatuses] = await Promise.all([
    Promise.all(services.map(([, service]) => service.check())),
    createTrackerAccounts(database).stats(),
  ]);
  statuses.forEach((status, index) => {
    const name = services[index][0];
    console.log(status.kind === 'ok' ? `${name}: ok ${status.version}` : `${name}: ${status.kind}`);
  });
  trackerStatuses.forEach(({ host, connection }) => console.log(`${host}: ${connection.kind}`));
  // A tracker set to "other" software has no account connection by design, so it never fails the check.
  const fine = (kind: string) => kind === 'ok' || kind === 'unsupported';
  return statuses.every((status) => status.kind === 'ok') && trackerStatuses.every(({ connection }) => fine(connection.kind)) ? 0 : 1;
};

const backupNow = async (database: DatabaseSync) => {
  const backup = createBackup({
    database,
    events: createEventHub(),
    store: () => {
      const destination = readBackupDestination(database);
      return destination === undefined ? undefined : createBackupStore(destination);
    },
  });
  const run = await backup.run({ force: true });
  console.log(run.outcome === 'ok' ? `backup: ok ${run.objectKey} ${run.bytes} bytes` : `backup: ${run.outcome} ${run.detail}`);
  return run.outcome === 'failed' ? 1 : 0;
};

// Listing and restoring read the destination from the environment and never open the database, so they work on a host with no database yet.
const runWithoutDatabase = async (restoreOptions: Map<string, string> | undefined) => {
  try {
    const destination = backupDestinationFromEnvironment();
    if (destination === undefined) {
      console.error('Set BACKUP_FOLDER, or BACKUP_ENDPOINT, BACKUP_BUCKET, BACKUP_ACCESS_KEY_ID and BACKUP_SECRET_ACCESS_KEY.');
      return 1;
    }
    const store = createBackupStore(destination);
    if (restoreOptions === undefined) {
      const { latestKey, snapshots } = await listSnapshots(store);
      for (const { key, size } of snapshots) console.log(`${key} ${size} bytes${key === latestKey ? ' (latest)' : ''}`);
    } else {
      const restoreKey = restoreKeyFromEnvironment();
      const sealKey = backupKeyFromEnvironment();
      if (restoreKey === undefined && sealKey === undefined) {
        console.error('Set BACKUP_RESTORE_KEY or BACKUP_KEY.');
        return 1;
      }
      const target = restoreOptions.get('--to') as string;
      const { key, counts } = await restoreBackup({ store, target, objectKey: restoreOptions.get('--object'), key: sealKey, restoreKey });
      console.log(`restored ${key} to ${target}`);
      for (const { table, count } of counts) console.log(`${table} ${count}`);
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Command failed.');
    return 1;
  }
};

const parseRestoreOptions = (rest: string[]) => {
  const options = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const [name, value] = [rest[index], rest[index + 1]];
    if ((name !== '--to' && name !== '--object') || value === undefined || options.has(name)) return undefined;
    options.set(name, value);
  }
  const target = options.get('--to');
  return target !== undefined && isAbsolute(target) ? options : undefined;
};

// Timing records belong in the server's log; here they would land in output that people and deploy.sh read.
setLogSink(() => {});
const args = process.argv.slice(2);
const [group, action, category, key] = args;
const restoreOptions = group === 'backup' && action === 'restore' ? parseRestoreOptions(args.slice(2)) : undefined;
const command = group === 'settings' && action === 'set' && args.length === 4 ? 'set'
  : group === 'settings' && action === 'delete' && args.length === 4 ? 'delete'
    : group === 'settings' && action === 'list' && args.length === 2 ? 'list'
      : group === 'connections' && action === 'check' && args.length === 2 ? 'check'
        : group === 'backdrop' && action === 'source' && args.length <= 3 ? 'backdrop'
          : group === 'cache' && action === 'clear' && args.length === 2 ? 'cache-clear'
        : group === 'backup' && action === 'now' && args.length === 2 ? 'backup-now'
          : group === 'backup' && action === 'list' && args.length === 2 ? 'backup-list'
            : group === 'backup' && (action === 'off' || action === 'on') && args.length === 2 ? 'backup-switch'
              : restoreOptions !== undefined ? 'backup-restore'
                : undefined;

if (command === undefined) {
  console.error(usage);
  process.exitCode = 2;
} else if (command === 'backup-list' || command === 'backup-restore') {
  process.exitCode = await runWithoutDatabase(restoreOptions);
} else {
  let database: DatabaseSync | undefined;
  try {
    database = openDatabase();
  } catch {
    console.error('Database initialization failed.');
    process.exitCode = 1;
  }
  if (database !== undefined) {
    try {
      if (command === 'set') {
        setSetting(database, category, key, await readStdin());
      } else if (command === 'delete') {
        deleteSetting(database, category, key);
      } else if (command === 'cache-clear') {
        clearCache(database, join(dirname(process.env.DB_PATH ?? defaultDatabasePath), 'images'));
        console.log('cache cleared');
      } else if (command === 'backdrop') {
        if (category !== undefined) {
          if (!(BACKDROP_SOURCES as readonly string[]).includes(category)) throw new Error(`The backdrop source must be one of: ${BACKDROP_SOURCES.join(', ')}.`);
          setPreference(database, BACKDROP_SOURCE_KEY, category);
        }
        console.log(`backdrop source: ${getPreference(database, BACKDROP_SOURCE_KEY) ?? 'tmdb'}`);
      } else if (command === 'list') {
        for (const row of listSettingKeys(database)) console.log(`${row.category} ${row.key}`);
      } else if (command === 'backup-switch') {
        setBackupsOff(database, action === 'off');
        console.log(`backups: ${action}`);
      } else if (command === 'backup-now') {
        process.exitCode = await backupNow(database);
      } else {
        process.exitCode = await checkConnections(database);
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Command failed.');
      process.exitCode = 1;
    } finally {
      database.close();
    }
  }
}
