import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createAdd } from './add.js';
import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { createEventHub } from './events.js';
import { createGrabs } from './grabs.js';
import { createJobRunner } from './jobs.js';
import { createOwned } from './owned.js';
import { createReleases } from './releases.js';
import { createSearch } from './search.js';
import { createArr } from './services/arr.js';

const clientDirectory = fileURLToPath(new URL('../client/', import.meta.url));
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? '3000');

let database;
try {
  database = openDatabase();
} catch {
  console.error('Database initialization failed.');
  process.exitCode = 1;
}

if (database !== undefined) {
  const arr = { sonarr: createArr('sonarr', database), radarr: createArr('radarr', database) };
  const events = createEventHub();
  const runner = createJobRunner();
  const releases = createReleases(database, arr);
  const grabs = createGrabs(database, arr, releases, { onChange: (grab) => events.publish('grab', grab) });
  runner.register('grab-download-ids', 30_000, async () => {
    // A grab that never shows up in history within an hour is left for the owner to see, not polled forever.
    for (const grab of grabs.pending()) {
      if (grab.downloadId === null && grab.createdAt > Date.now() - 3_600_000) await grabs.resolveDownloadId(grab);
    }
  });
  const app = createApp({
    clientDirectory,
    listeningHost: host,
    ownerPlexId: process.env.PLEX_OWNER_ID,
    publicOrigin: process.env.APP_ORIGIN,
    events,
    search: createSearch(arr),
    add: createAdd(database, arr),
    releases,
    grabs,
    owned: createOwned(arr),
  });
  runner.start();
  const server = serve({ fetch: app.fetch, hostname: host, port }, (info) => {
    console.log(`Listening on http://${host}:${info.port}`);
  }) as Server;
  let stopping = false;
  const shutdown = async () => {
    if (stopping) process.exit(1);
    stopping = true;
    await runner.stop();
    server.close(() => process.exit(0));
    // Open event streams hold their sockets, so close() alone would wait on them forever.
    server.closeAllConnections();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
