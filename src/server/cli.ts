import type { DatabaseSync } from 'node:sqlite';
import { isAbsolute } from 'node:path';
import { createBackup, listSnapshots, restoreBackup } from './backup.js';
import { openDatabase } from './database.js';
import { createEventHub } from './events.js';
import { createArr } from './services/arr.js';
import { createPlex } from './services/plex.js';
import { createR2Store, r2ConfigFromEnvironment, readR2Config } from './services/r2.js';
import { createRtorrent } from './services/rtorrent.js';
import { createTrackerAccounts } from './services/trackerAccounts.js';
import { deleteSetting, listSettingKeys, setSetting } from './settings.js';

const usage = [
  'usage: node dist/server/cli.js settings set <category> <key>   (value read from stdin)',
  '       node dist/server/cli.js settings delete <category> <key>',
  '       node dist/server/cli.js settings list',
  '       node dist/server/cli.js connections check',
  '       node dist/server/cli.js backup now',
  '       node dist/server/cli.js backup list   (R2_* environment variables)',
  '       node dist/server/cli.js backup restore --to <absolute path> [--object <key>]   (R2_* environment variables)',
].join('\n');

const readStdin = async () => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
};

const checkConnections = async (database: DatabaseSync) => {
  const services = [
    ['sonarr', createArr('sonarr', database)],
    ['radarr', createArr('radarr', database)],
    ['rtorrent', createRtorrent(database)],
    ['plex', createPlex(database)],
  ] as const;
  const [statuses, trackerStatuses] = await Promise.all([
    Promise.all(services.map(([, service]) => service.check())),
    createTrackerAccounts(database).stats(),
  ]);
  statuses.forEach((status, index) => {
    const name = services[index][0];
    console.log(status.kind === 'ok' ? `${name}: ok ${status.version}` : `${name}: ${status.kind}`);
  });
  trackerStatuses.forEach((status) => console.log(`${status.tracker}: ${status.kind}`));
  return statuses.every((status) => status.kind === 'ok') && trackerStatuses.every((status) => status.kind === 'ok') ? 0 : 1;
};

const backupNow = async (database: DatabaseSync) => {
  const backup = createBackup({
    database,
    events: createEventHub(),
    store: () => {
      const config = readR2Config(database);
      return config === undefined ? undefined : createR2Store(config);
    },
  });
  const run = await backup.run({ force: true });
  console.log(run.outcome === 'ok' ? `backup: ok ${run.objectKey} ${run.bytes} bytes` : `backup: ${run.outcome} ${run.detail}`);
  return run.outcome === 'failed' ? 1 : 0;
};

// Listing and restoring read R2 from the environment and never open the database, so they work on a host with no database yet.
const runWithoutDatabase = async (restoreOptions: Map<string, string> | undefined) => {
  const config = r2ConfigFromEnvironment();
  if (config === undefined) {
    console.error('R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set.');
    return 1;
  }
  const store = createR2Store(config);
  try {
    if (restoreOptions === undefined) {
      const { latestKey, snapshots } = await listSnapshots(store);
      for (const { key, size } of snapshots) console.log(`${key} ${size} bytes${key === latestKey ? ' (latest)' : ''}`);
    } else {
      const target = restoreOptions.get('--to') as string;
      const { key, counts } = await restoreBackup({ store, target, objectKey: restoreOptions.get('--object') });
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

const args = process.argv.slice(2);
const [group, action, category, key] = args;
const restoreOptions = group === 'backup' && action === 'restore' ? parseRestoreOptions(args.slice(2)) : undefined;
const command = group === 'settings' && action === 'set' && args.length === 4 ? 'set'
  : group === 'settings' && action === 'delete' && args.length === 4 ? 'delete'
    : group === 'settings' && action === 'list' && args.length === 2 ? 'list'
      : group === 'connections' && action === 'check' && args.length === 2 ? 'check'
        : group === 'backup' && action === 'now' && args.length === 2 ? 'backup-now'
          : group === 'backup' && action === 'list' && args.length === 2 ? 'backup-list'
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
      } else if (command === 'list') {
        for (const row of listSettingKeys(database)) console.log(`${row.category} ${row.key}`);
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
