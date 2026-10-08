import type { Server } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApiRoutes } from './api.js';
import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { createEventHub } from './events.js';
import { createJobRunner } from './jobs.js';
import { createProblems } from './problems.js';
import { createGrabTracker } from './grabs.js';
import { createArr } from './services/arr.js';
import { readSetting } from './services/connection.js';
import { createRtorrent } from './services/rtorrent.js';
import { createTorrentPoller } from './torrents.js';
import { createTrackerWatch } from './trackers.js';
import { createSearchScheduler } from './searches.js';
import { createStallFix } from './stalls.js';

const clientDirectory = fileURLToPath(new URL('../client/', import.meta.url));
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? '3000');

let database: DatabaseSync | undefined;
try {
  database = openDatabase();
} catch {
  console.error('Database initialization failed.');
  process.exitCode = 1;
}

if (database !== undefined) {
  const openedDatabase = database;
  const events = createEventHub();
  const runner = createJobRunner();
  const poller = createTorrentPoller({ database, rtorrent: createRtorrent(database), events });
  runner.register('rtorrent-poll', poller.intervalMs, poller.poll);
  const arrServices = { sonarr: createArr('sonarr', database), radarr: createArr('radarr', database) };
  const grabs = createGrabTracker({ database, arr: arrServices, events });
  runner.register('arr-reconcile', grabs.intervalMs, grabs.reconcile);
  const problems = createProblems({ database, events });
  runner.register('dependency-problems', 30_000, problems.syncDependencies);
  const rtorrent = createRtorrent(database);
  const trackers = createTrackerWatch({ database, rtorrent, problems, events });
  runner.register('tracker-watch', 30_000, trackers.check);
  const stalls = createStallFix({ database, rtorrent, arr: arrServices, problems, trackers });
  runner.register('stall-fix', 60_000, stalls.check);
  // Two minutes keeps Radarr's whole-library read light while still searching close to each release time.
  const searches = createSearchScheduler({ database, arr: arrServices, problems });
  runner.register('search-schedule', 2 * 60_000, searches.check);
  const app = createApp({
    clientDirectory,
    listeningHost: host,
    ownerPlexId: process.env.PLEX_OWNER_ID,
    publicOrigin: process.env.APP_ORIGIN,
    events,
    api: createApiRoutes(database),
    webhooks: {
      secret: () => readSetting(openedDatabase, 'credentials', 'webhook.secret'),
      receive: grabs.receiveWebhook,
    },
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
