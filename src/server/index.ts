import type { Server } from 'node:http';
import { dirname, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createAdd } from './add.js';
import { createApiRoutes } from './api.js';
import { createApp } from './app.js';
import { createBackup } from './backup.js';
import { defaultDatabasePath, openDatabase } from './database.js';
import { createEventHub } from './events.js';
import { createGrabs, handGrab } from './grabs.js';
import { createImportFix } from './imports.js';
import { createManualImport } from './manualImport.js';
import { createJobRunner } from './jobs.js';
import { createOwned } from './owned.js';
import { createProblems } from './problems.js';
import { createProtection, vetoInBackground } from './protection.js';
import { createRelinkFix } from './relink.js';
import { createReleases } from './releases.js';
import { createReplaces } from './replace.js';
import { createSearch } from './search.js';
import { createGrabTracker } from './torrentGrabs.js';
import { createArr } from './services/arr.js';
import { readSetting } from './services/connection.js';
import { createR2Store, readR2Config } from './services/r2.js';
import { createRtorrent } from './services/rtorrent.js';
import { createTrackerAccounts } from './services/trackerAccounts.js';
import { createTorrentPoller } from './torrents.js';
import { createTrackerWatch } from './trackers.js';
import { createSearchScheduler } from './searches.js';
import { createStallFix } from './stalls.js';
import { createImageRoutes, createTitleCache } from './titles.js';

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
  const arr = { sonarr: createArr('sonarr', database), radarr: createArr('radarr', database) };
  const events = createEventHub();
  const runner = createJobRunner();
  const rtorrent = createRtorrent(database);
  const poller = createTorrentPoller({ database, rtorrent, events });
  runner.register('rtorrent-poll', poller.intervalMs, poller.poll);
  const backup = createBackup({
    database,
    events,
    store: () => {
      const config = readR2Config(openedDatabase);
      return config === undefined ? undefined : createR2Store(config);
    },
  });
  runner.register('backup', 5 * 60_000, async () => { await backup.run(); });
  const torrentGrabs = createGrabTracker({ database, arr, events });
  runner.register('arr-reconcile', torrentGrabs.intervalMs, torrentGrabs.reconcile);
  const problems = createProblems({ database, events });
  runner.register('dependency-problems', 30_000, problems.syncDependencies);
  const trackers = createTrackerWatch({ database, rtorrent, problems, events });
  runner.register('tracker-watch', 30_000, trackers.check);
  const titles = createTitleCache({
    database,
    arr,
    events,
    imageDirectory: join(dirname(process.env.DB_PATH ?? defaultDatabasePath), 'images'),
  });
  runner.register('title-refresh', titles.intervalMs, titles.reconcile);
  const imports = createImportFix({ database, arr, problems, events });
  runner.register('import-fix', 60_000, imports.check);
  const releases = createReleases(database, arr);
  // 'grab' events carry torrent grab records for the Downloads screen, so a hand grab's own record goes out under its own name.
  const grabs = createGrabs(database, arr, releases, {
    onChange: (grab) => {
      events.publish('release-grab', grab);
      if (grab.downloadId !== null) torrentGrabs.recordGrab(handGrab({ ...grab, downloadId: grab.downloadId }));
    },
  });
  const protection = createProtection(database, arr, { recentGrabTitles: (service, since) => grabs.recentTitles(service, since) });
  const replaces = createReplaces(arr, grabs, { onCompleted: (grab) => protection.protect(grab) });
  const stalls = createStallFix({ database, rtorrent, arr, problems, trackers, isManualDownload: protection.isProtected });
  runner.register('stall-fix', 60_000, stalls.check);
  const relink = createRelinkFix({ database, rtorrent, arr, problems, isManualDownload: protection.isProtected });
  runner.register('relink-fix', 60_000, relink.check);
  // Two minutes keeps Radarr's whole-library read light while still searching close to each release time.
  const searches = createSearchScheduler({ database, arr, problems, isManualDownload: protection.isProtected });
  runner.register('search-schedule', 2 * 60_000, searches.check);
  runner.register('manual-download-protection', 10 * 60_000, async () => {
    await Promise.allSettled([protection.ensureWebhook('sonarr'), protection.ensureWebhook('radarr')]);
    await protection.reconcile();
  });
  runner.register('replace-completion', 60_000, () => replaces.run());
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
    protection,
    api: createApiRoutes(database, {
      arr,
      refresh: torrentGrabs.refresh,
      trackers: createTrackerAccounts(database),
      manualImport: createManualImport({ database, arr, problems }),
    }),
    images: createImageRoutes(titles),
    webhooks: {
      secret: () => readSetting(openedDatabase, 'credentials', 'webhook.secret'),
      // One receiver for both: live downloads record every event, a Grab of a manual download is vetoed,
      // and the title cache refreshes or drops the title an event names.
      receive: (service, payload) => {
        const grabs = torrentGrabs.receiveWebhook(service, payload);
        const title = titles.receiveWebhook(service, payload);
        if (grabs === 'ok') void vetoInBackground(protection, service, payload);
        if (grabs === 'invalid' || title === 'invalid') return 'invalid';
        return grabs === 'ok' || title === 'ok' ? 'ok' : 'ignored';
      },
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
