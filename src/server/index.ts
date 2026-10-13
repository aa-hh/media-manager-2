import type { Server } from 'node:http';
import { dirname, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createAdd } from './add.js';
import { createApiRoutes } from './api.js';
import { createApp } from './app.js';
import { createBlocklist } from './blocklist.js';
import { createBackup } from './backup.js';
import { createBackupStore, readBackupDestination } from './backupDestination.js';
import { defaultDatabasePath, openDatabase } from './database.js';
import { createEventHub } from './events.js';
import { createFlagged } from './flagged.js';
import { createGrabs, handGrab } from './grabs.js';
import { createHealth } from './health.js';
import { createHistory } from './history.js';
import { createImportFix } from './imports.js';
import { createManualImport } from './manualImport.js';
import { createJobRunner } from './jobs.js';
import { createLabels } from './labels.js';
import { createLibrary } from './library.js';
import { createOwned } from './owned.js';
import { createProblems } from './problems.js';
import { createProtection, vetoInBackground } from './protection.js';
import { createRelinkFix } from './relink.js';
import { createReleases } from './releases.js';
import { createReplaces } from './replace.js';
import { createSearch } from './search.js';
import { createDiscover } from './discover/index.js';
import { createTitleStore } from './titleStore.js';
import { createTmdbTitles } from './tmdbTitles.js';
import { createSecondVersionChecks, listSecondVersionRows, VERSION_CHECK_INTERVAL_MS } from './secondVersionRows.js';
import { createSecondVersionDelete } from './secondVersionDelete.js';
import { createSecondVersions } from './secondVersions.js';
import { createSetupRoutes } from './setup.js';
import { createVersionImport } from './versionImport.js';
import { createGrabTracker } from './torrentGrabs.js';
import { createArr } from './services/arr.js';
import { readSetting } from './services/connection.js';
import { createMdblist } from './services/mdblist.js';
import { createPlex } from './services/plex.js';
import { createTmdb } from './services/tmdb.js';
import { createTrakt } from './services/trakt.js';
import { createRtorrent } from './services/rtorrent.js';
import { createTrackerAccounts } from './services/trackerAccounts.js';
import { createTorrentPoller } from './torrents.js';
import { trackerRulesFromEnvironment } from './trackerRules.js';
import { createTrackerWatch } from './trackers.js';
import { createSearchScheduler } from './searches.js';
import { createStallFix } from './stalls.js';
import { createTorrentFiles } from './torrentFiles.js';
import { createTitleDelete } from './titleDelete.js';
import { adviseRemoval } from './advice.js';
import { createImageRoutes, createTitleCache, createTmdbImages, IMAGE_SWEEP_INTERVAL_MS } from './titles.js';

const clientDirectory = fileURLToPath(new URL('../client/', import.meta.url));
// An empty HOST or PORT means the default, never every interface or a random port.
const host = process.env.HOST || '127.0.0.1';
const portText = process.env.PORT || '3000';
const port = Number(portText);

let database: DatabaseSync | undefined;
try {
  // Checked once here so a bad TRACKER_RULES stops startup instead of failing each rule lookup later.
  trackerRulesFromEnvironment();
  // 0 stays allowed: the README documents it as asking the system for a free port.
  if (!/^\d{1,5}$/.test(portText) || port > 65535) throw new Error('PORT must be a whole number from 0 to 65535.');
  try {
    database = openDatabase();
  } catch {
    console.error('Database initialization failed.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}

if (database !== undefined) {
  const openedDatabase = database;
  const arr = { sonarr: createArr('sonarr', database), radarr: createArr('radarr', database) };
  const events = createEventHub();
  const runner = createJobRunner();
  const rtorrent = createRtorrent(database);
  const poller = createTorrentPoller({ database, rtorrent, events });
  const releases = createReleases(database, arr);
  const secondVersions = createSecondVersions({ database, releases, rtorrent });
  const problems = createProblems({ database, events });
  const plex = createPlex(database);
  const versionImport = createVersionImport({ database, rtorrent, arr, plex, problems });
  // Second versions still sending (left by a restart, or unconfirmed by rTorrent) are settled by the poll that follows them,
  // and finished ones are imported after it.
  runner.register('rtorrent-poll', poller.intervalMs, async () => {
    const startedAt = Date.now();
    if (!await poller.poll()) return;
    await secondVersions.reconcile(startedAt);
    await versionImport.run();
  });
  const backup = createBackup({
    database,
    events,
    store: () => {
      const destination = readBackupDestination(openedDatabase);
      return destination === undefined ? undefined : createBackupStore(destination);
    },
  });
  runner.register('backup', 5 * 60_000, async () => { await backup.run(); });
  const torrentGrabs = createGrabTracker({ database, arr, events });
  runner.register('arr-reconcile', torrentGrabs.intervalMs, torrentGrabs.reconcile);
  runner.register('dependency-problems', 30_000, problems.syncDependencies);
  const trackers = createTrackerWatch({ database, rtorrent, problems, events });
  runner.register('tracker-watch', 30_000, trackers.check);
  const imageDirectory = join(dirname(process.env.DB_PATH ?? defaultDatabasePath), 'images');
  const titles = createTitleCache({ database, arr, events, imageDirectory });
  runner.register('title-refresh', titles.intervalMs, titles.reconcile);
  const tmdbImages = createTmdbImages({ database, imageDirectory });
  runner.register('image-sweep', IMAGE_SWEEP_INTERVAL_MS, tmdbImages.sweep);
  const imports = createImportFix({ database, arr, problems, events });
  runner.register('import-fix', 60_000, imports.check);
  // 'grab' events carry torrent grab records for the Downloads screen, so a hand grab's own record goes out under its own name.
  const grabs = createGrabs(database, arr, releases, {
    onChange: (grab) => {
      events.publish('release-grab', grab);
      if (grab.downloadId !== null) torrentGrabs.recordGrab(handGrab({ ...grab, downloadId: grab.downloadId }));
    },
  });
  const protection = createProtection(database, arr, { recentGrabTitles: (service, since) => grabs.recentTitles(service, since) });
  const labels = createLabels(arr);
  const replaces = createReplaces(arr, grabs, { onCompleted: (grab) => protection.protect(grab) });
  const torrentFiles = createTorrentFiles({ database, rtorrent, arr });
  const stalls = createStallFix({
    database, rtorrent, arr, problems, trackers, isManualDownload: protection.isProtected, labels, removeTorrent: torrentFiles.removeTorrent,
  });
  runner.register('stall-fix', 60_000, stalls.check);
  const relink = createRelinkFix({ database, rtorrent, arr, problems, isManualDownload: protection.isProtected });
  runner.register('relink-fix', 60_000, relink.check);
  const versionChecks = createSecondVersionChecks({ database, arr, problems });
  runner.register('second-version-checks', VERSION_CHECK_INTERVAL_MS, versionChecks.check);
  // Two minutes keeps Radarr's whole-library read light while still searching close to each release time.
  const searches = createSearchScheduler({ database, arr, problems, isManualDownload: protection.isProtected });
  runner.register('search-schedule', 2 * 60_000, searches.check);
  runner.register('manual-download-protection', 10 * 60_000, async () => {
    await Promise.allSettled([protection.ensureWebhook('sonarr'), protection.ensureWebhook('radarr')]);
    await protection.reconcile();
  });
  const trackerAccounts = createTrackerAccounts(database);
  const tmdb = createTmdb(database);
  const trakt = createTrakt(database);
  const mdblist = createMdblist(database);
  const health = createHealth({ database, arr, rtorrent, plex, tmdb, mdblist, jobs: runner, trackerAccounts, events });
  runner.register('health-check', 5 * 60_000, async () => { await health.check(); });
  runner.register('replace-completion', 60_000, () => replaces.run());
  runner.register('grab-download-ids', 30_000, () => grabs.resolvePending());
  const secondVersionDelete = createSecondVersionDelete({ database, removeTorrent: torrentFiles.removeTorrent, scan: versionImport.scan });
  const titleStore = createTitleStore(database);
  const search = createSearch(database, arr, titleStore);
  const blocklist = createBlocklist({ database, arr, isManualDownload: protection.isProtected });
  const titleDelete = createTitleDelete({
    database,
    arr,
    torrentFiles,
    deleteVersion: secondVersionDelete,
    advise: (hash) => adviseRemoval(openedDatabase, hash, {
      now: Date.now(),
      accountStats: async (tracker) => {
        const account = await trackerAccounts.connection(tracker);
        return account.kind === 'ok' ? account.stats : null;
      },
    }),
    protection,
    blocklist,
    forget: search.forget,
  });
  const tmdbTitles = createTmdbTitles({ database, tmdb, store: titleStore });
  const library = createLibrary(arr, (title) => listSecondVersionRows(openedDatabase, title), titleStore, mdblist, tmdbTitles.tvdbIdOf);
  const add = createAdd(arr, titleStore, openedDatabase);
  const discover = createDiscover({ tmdb, trakt, store: titleStore, database });
  runner.register('discover-refresh', 10 * 60_000, discover.refresh);
  const app = createApp({
    clientDirectory,
    listeningHost: host,
    database,
    ownerPlexId: process.env.PLEX_OWNER_ID,
    publicOrigin: process.env.APP_ORIGIN,
    events,
    search,
    add: {
      ...add,
      async addSeries(...args: Parameters<typeof add.addSeries>) {
        const result = await add.addSeries(...args);
        if (result.kind === 'added') search.forget('sonarr');
        return result;
      },
      async addMovie(...args: Parameters<typeof add.addMovie>) {
        const result = await add.addMovie(...args);
        if (result.kind === 'added') search.forget('radarr');
        return result;
      },
    },
    releases,
    grabs,
    secondVersions,
    secondVersionDelete,
    titleDelete,
    owned: createOwned(arr),
    protection,
    library,
    discover,
    tmdbTitles,
    setup: createSetupRoutes({ database, arr, rtorrent, trackers: trackerAccounts, env: process.env }),
    api: createApiRoutes(database, {
      arr,
      refresh: torrentGrabs.refresh,
      trackers: trackerAccounts,
      manualImport: createManualImport({ database, arr, problems }),
      health,
      flagged: createFlagged({ database, arr, labels, isManualDownload: protection.isProtected }),
      history: createHistory({ database, arr, labels }),
      blocklist,
    }),
    images: createImageRoutes(titles, tmdbImages),
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
  // The runner first runs a job one interval after start, so the daily sweep also runs now.
  try {
    tmdbImages.sweep();
  } catch (error) {
    console.error(`Image sweep failed: ${(error as Error).message}`);
  }
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
