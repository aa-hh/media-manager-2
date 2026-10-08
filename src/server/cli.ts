import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './database.js';
import { createArr } from './services/arr.js';
import { createPlex } from './services/plex.js';
import { createRtorrent } from './services/rtorrent.js';
import { deleteSetting, listSettingKeys, setSetting } from './settings.js';

const usage = [
  'usage: node dist/server/cli.js settings set <category> <key>   (value read from stdin)',
  '       node dist/server/cli.js settings delete <category> <key>',
  '       node dist/server/cli.js settings list',
  '       node dist/server/cli.js connections check',
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
  const statuses = await Promise.all(services.map(([, service]) => service.check()));
  statuses.forEach((status, index) => {
    const name = services[index][0];
    console.log(status.kind === 'ok' ? `${name}: ok ${status.version}` : `${name}: ${status.kind}`);
  });
  return statuses.every((status) => status.kind === 'ok') ? 0 : 1;
};

const args = process.argv.slice(2);
const [group, action, category, key] = args;
const command = group === 'settings' && action === 'set' && args.length === 4 ? 'set'
  : group === 'settings' && action === 'delete' && args.length === 4 ? 'delete'
    : group === 'settings' && action === 'list' && args.length === 2 ? 'list'
      : group === 'connections' && action === 'check' && args.length === 2 ? 'check'
        : undefined;

if (command === undefined) {
  console.error(usage);
  process.exitCode = 2;
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
