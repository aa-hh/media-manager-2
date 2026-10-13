import { randomBytes } from 'node:crypto';
import { linkSync, rmSync, type Stats, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { type Context, Hono } from 'hono';
import { backupKeyFromEnvironment, backupsAreOff, createBackupKeyPair, readBackupKeyPair, setBackupsOff } from './backup.js';
import { readBackupDestination } from './backupDestination.js';
import { applicationMigrations, migrateDatabase } from './database.js';
import { effectiveOwner, readEnvironmentOwner } from './owner.js';
import { getPreference, setPreference } from './preferences.js';
import type { ArrServices } from './services/arr.js';
import { readSetting } from './services/connection.js';
import { createJellyfin } from './services/jellyfin.js';
import { createPlex } from './services/plex.js';
import type { XmlRpcParam } from './services/rtorrent.js';
import { isSoftware, saveTrackerCredential, saveTrackerSoftware, type TrackerAccounts } from './services/trackerAccounts.js';
import { deleteSetting, setSetting } from './settings.js';
import { addTracker, bareHost, isRecord, listTrackerHosts } from './trackerRules.js';

export type SetupEnvironment = { Variables: { plexSignInToken: string | undefined } };

type Dependencies = {
  database: DatabaseSync;
  arr: ArrServices;
  rtorrent: { call: (method: string, params: readonly XmlRpcParam[]) => Promise<unknown> };
  trackers: TrackerAccounts;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
};

// The same keys connections.ts lists for each service; a service counts as set up when all of them are set.
const requiredKeys = {
  sonarr: [['serviceAddresses', 'sonarr.url'], ['credentials', 'sonarr.apiKey']],
  radarr: [['serviceAddresses', 'radarr.url'], ['credentials', 'radarr.apiKey']],
  rtorrent: [['serviceAddresses', 'rtorrent.url'], ['credentials', 'rtorrent.username'], ['credentials', 'rtorrent.password']],
  plex: [['serviceAddresses', 'plex.url'], ['credentials', 'plex.token']],
} as const;
const folderKeys = [
  'downloads.sonarr', 'downloads.radarr', 'library.sonarr', 'library.radarr', 'versions.sonarr', 'versions.radarr',
] as const;

const folderFields = ['downloadsSonarr', 'downloadsRadarr', 'librarySonarr', 'libraryRadarr', 'versionsSonarr', 'versionsRadarr'] as const;
type FolderField = typeof folderFields[number];
export type FolderValues = Record<FolderField, string>;
type FolderStat = (path: string) => Pick<Stats, 'isDirectory'> | undefined;
// 'ok', or the failing error code ('EXDEV', 'EACCES', 'mismatch', ...).
export type LinkTest = (fromFolder: string, toFolder: string) => 'ok' | string;

// Bind mounts and pooled disks fool a device-number check; only a real link proves imports can hardlink.
export const testHardlink: LinkTest = (fromFolder, toFolder) => {
  const name = `.media-manager-2-link-test-${randomBytes(6).toString('hex')}`;
  const from = join(fromFolder, name);
  const to = join(toFolder, `${name}.link`);
  try {
    writeFileSync(from, 'x', { flag: 'wx' });
    linkSync(from, to);
    const fromStats = statSync(from);
    const toStats = statSync(to);
    return fromStats.ino === toStats.ino && toStats.nlink >= 2 ? 'ok' : 'mismatch';
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return typeof code === 'string' ? code : 'failed';
  } finally {
    try { rmSync(from, { force: true }); } catch { /* cleanup never throws */ }
    try { rmSync(to, { force: true }); } catch { /* cleanup never throws */ }
  }
};

const serviceName = { Sonarr: 'TV', Radarr: 'Movies' } as const;

// Every failing field's message; an empty object means the folders can be saved.
export const folderProblems = (
  values: FolderValues,
  stat: FolderStat = (path) => statSync(path, { throwIfNoEntry: false }),
  link: LinkTest = testHardlink,
): Partial<Record<FolderField, string>> => {
  const fields: Partial<Record<FolderField, string>> = {};
  for (const field of folderFields) {
    const path = values[field];
    if (!isAbsolute(path)) {
      fields[field] = 'Must be an absolute path.';
      continue;
    }
    const stats = stat(path);
    if (stats === undefined || !stats.isDirectory()) fields[field] = 'This folder does not exist.';
  }
  // Imports hardlink second versions from the service's downloads folder.
  for (const service of ['Sonarr', 'Radarr'] as const) {
    const downloads = `downloads${service}` as const;
    const versions = `versions${service}` as const;
    if (fields[downloads] !== undefined || fields[versions] !== undefined) continue;
    const result = link(values[downloads], values[versions]);
    if (result === 'EXDEV') {
      fields[versions] = `On a different drive from the ${serviceName[service]} downloads folder, so imports can't hardlink.`;
    } else if (result !== 'ok') {
      fields[versions] = `A test hardlink from the ${serviceName[service]} downloads folder failed (${result}), so imports can't hardlink here.`;
    }
  }
  return fields;
};

// A library on another drive still saves (a network library is fine), but a deleted download can't be re-linked from it.
// Runs only after folderProblems passed, so every folder exists.
export const folderWarnings = (
  values: FolderValues,
  link: LinkTest = testHardlink,
): Partial<Record<FolderField, string>> => {
  const warnings: Partial<Record<FolderField, string>> = {};
  for (const service of ['Sonarr', 'Radarr'] as const) {
    const result = link(values[`downloads${service}`], values[`library${service}`]);
    if (result === 'EXDEV') {
      warnings[`library${service}`] = `On a different drive from the ${serviceName[service]} downloads folder, so a deleted download can't be re-linked from this library.`;
    } else if (result !== 'ok') {
      warnings[`library${service}`] = `A test hardlink from the ${serviceName[service]} downloads folder failed (${result}), so a deleted download can't be re-linked from this library.`;
    }
  }
  return warnings;
};

type Part = 'trackers' | 'metadata' | 'backup';
type Choices = Record<Part, { wanted: boolean; skipped: boolean }>;
const CHOICES_KEY = 'setup.choices';
const metadataKeys = [['credentials', 'tmdb.apiKey'], ['credentials', 'mdblist.apiKey'], ['credentials', 'trakt.clientId']] as const;

const readBody = async (context: Context): Promise<unknown> => {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
};
const hasExactly = (body: unknown, keys: readonly string[]): body is Record<string, unknown> => (
  isRecord(body) && Object.keys(body).length === keys.length && keys.every((key) => Object.hasOwn(body, key))
);
const isChoice = (value: unknown) => hasExactly(value, ['wanted', 'skipped'])
  && typeof value.wanted === 'boolean' && typeof value.skipped === 'boolean';
const isDirectory = (path: string) => statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;

// Routes for the first-run setup wizard; app.ts mounts them at /api/setup behind the sign-in guard, which also checks
// every write's origin. Nothing here blocks other routes: the wizard decides from requiredComplete what to show.
export const createSetupRoutes = ({ database, arr, rtorrent, trackers, env = process.env, fetch }: Dependencies) => {
  const routes = new Hono<SetupEnvironment>();

  const readChoices = (): Choices | undefined => {
    const stored = getPreference(database, CHOICES_KEY);
    if (stored === undefined) return undefined;
    // Choices saved before the posters and ratings step existed lack metadata.
    return { metadata: { wanted: false, skipped: false }, ...JSON.parse(stored) } as Choices;
  };
  const chosenOut = (part: Part) => {
    const choices = readChoices();
    return choices !== undefined && (!choices[part].wanted || choices[part].skipped);
  };
  const isSet = (category: string, key: string) => readSetting(database, category, key) !== undefined;
  const done = (set: boolean) => (set ? 'done' : 'not_done') as 'done' | 'not_done';

  routes.get('/', (context) => {
    // The media server step follows the current owner: a Jellyfin owner needs an API key, anyone else Plex.
    const owner = effectiveOwner(database, env.PLEX_OWNER_ID);
    const jellyfinOwner = owner?.provider === 'jellyfin';
    const required = {
      sonarr: done(requiredKeys.sonarr.every(([category, key]) => isSet(category, key))),
      radarr: done(requiredKeys.radarr.every(([category, key]) => isSet(category, key))),
      rtorrent: done(requiredKeys.rtorrent.every(([category, key]) => isSet(category, key))),
      mediaServer: done(jellyfinOwner ? isSet('credentials', 'jellyfin.apiKey') : requiredKeys.plex.every(([category, key]) => isSet(category, key))),
      folders: done(folderKeys.every((key) => isSet('hostPaths', key))),
    };
    let destination: ReturnType<typeof readBackupDestination>;
    let problem: string | null = null;
    try {
      destination = readBackupDestination(database);
    } catch (error) {
      problem = (error as Error).message;
    }
    // A key pair made in the app replaces BACKUP_KEY, so the environment is not read once one exists.
    const pair = readBackupKeyPair(database);
    let key: 'pair' | 'env' | 'missing' | 'invalid' = 'pair';
    if (pair === undefined) {
      try {
        key = backupKeyFromEnvironment(env) === undefined ? 'missing' : 'env';
      } catch {
        key = 'invalid';
      }
    }
    const off = backupsAreOff(database);
    const choices = readChoices();
    return context.json({
      required,
      optional: {
        trackers: {
          status: listTrackerHosts(database, env).length > 0 ? 'done' : chosenOut('trackers') ? 'skipped' : 'not_done',
          wanted: choices?.trackers.wanted ?? false,
        },
        metadata: {
          status: metadataKeys.some(([category, key]) => isSet(category, key)) ? 'done' : chosenOut('metadata') ? 'skipped' : 'not_done',
          wanted: choices?.metadata.wanted ?? false,
        },
        backup: {
          // Backups switched off elsewhere count as skipped until the owner says they want them here.
          status: destination !== undefined && !off ? 'done' : (choices === undefined ? off : chosenOut('backup')) ? 'skipped' : 'not_done',
          wanted: choices?.backup.wanted ?? false,
        },
      },
      requiredComplete: Object.values(required).every((status) => status === 'done'),
      mediaServer: owner !== undefined && jellyfinOwner
        ? {
          kind: 'jellyfin',
          url: readSetting(database, 'serviceAddresses', 'jellyfin.url') ?? '',
          serverName: owner.serverName ?? '',
          ownerName: owner.userName,
        }
        : { kind: 'plex', ownerName: owner?.userName ?? '' },
      ownerPinned: readEnvironmentOwner(env.PLEX_OWNER_ID) !== undefined,
      plexSignInTokenAvailable: context.get('plexSignInToken') !== undefined,
      // The access key, the secret and BACKUP_KEY's value never leave the server, and the restore key is never returned here either.
      backup: {
        destination: destination === undefined ? null
          : destination.kind === 'folder' ? { kind: 'folder', folder: destination.folder }
            : { kind: 's3', endpoint: destination.config.endpoint, bucket: destination.config.bucket, region: destination.config.region },
        problem,
        key,
        keyCreatedAt: pair === undefined ? null : pair.createdAt,
      },
    });
  });

  // Skipping or unticking backups turns them off, as the CLI's `backup off` does, so the health check stops reminding.
  // Ticking them never turns them on: only a saved destination (POST /backup) does.
  routes.put('/choices', async (context) => {
    const body = await readBody(context);
    if (!hasExactly(body, ['trackers', 'metadata', 'backup']) || !isChoice(body.trackers) || !isChoice(body.metadata) || !isChoice(body.backup)) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    setPreference(database, CHOICES_KEY, JSON.stringify({ trackers: body.trackers, metadata: body.metadata, backup: body.backup }));
    if (chosenOut('backup')) setBackupsOff(database, true);
    return context.body(null, 204);
  });

  routes.get('/folders', async (context) => {
    const saved = {
      downloadsSonarr: readSetting(database, 'hostPaths', 'downloads.sonarr') ?? null,
      downloadsRadarr: readSetting(database, 'hostPaths', 'downloads.radarr') ?? null,
      librarySonarr: readSetting(database, 'hostPaths', 'library.sonarr') ?? null,
      libraryRadarr: readSetting(database, 'hostPaths', 'library.radarr') ?? null,
      versionsSonarr: readSetting(database, 'hostPaths', 'versions.sonarr') ?? null,
      versionsRadarr: readSetting(database, 'hostPaths', 'versions.radarr') ?? null,
    };
    const rootFolder = async (service: 'sonarr' | 'radarr') => {
      const { status, body } = await arr[service].request('/api/v3/rootfolder');
      if (status < 200 || status > 299 || !Array.isArray(body)) return null;
      const folder = body.find((entry) => isRecord(entry) && typeof entry.path === 'string' && entry.path.trim() !== '');
      return folder === undefined ? null : folder.path as string;
    };
    // The folder the service's enabled download client puts its torrents in (tvDirectory or movieDirectory).
    const clientFolder = async (service: 'sonarr' | 'radarr') => {
      const name = service === 'sonarr' ? 'tvDirectory' : 'movieDirectory';
      const { status, body } = await arr[service].request('/api/v3/downloadclient');
      if (status < 200 || status > 299 || !Array.isArray(body)) return null;
      for (const client of body) {
        if (!isRecord(client) || client.enable === false || !Array.isArray(client.fields)) continue;
        const field = client.fields.find((entry) => isRecord(entry) && entry.name === name);
        if (isRecord(field) && typeof field.value === 'string' && field.value.trim() !== '') return field.value;
      }
      return null;
    };
    const downloadDirectory = async () => {
      const value = await rtorrent.call('directory.default', []);
      return typeof value === 'string' && value !== '' ? value : null;
    };
    const settled = <T>(result: PromiseSettledResult<T | null>) => (result.status === 'fulfilled' ? result.value : null);
    const [sonarr, radarr, sonarrClient, radarrClient, downloads] = (await Promise.allSettled([
      rootFolder('sonarr'), rootFolder('radarr'), clientFolder('sonarr'), clientFolder('radarr'), downloadDirectory(),
    ])).map(settled);
    const librarySonarr = saved.librarySonarr ?? sonarr;
    const libraryRadarr = saved.libraryRadarr ?? radarr;
    return context.json({
      saved,
      suggested: {
        downloadsSonarr: sonarrClient ?? downloads,
        downloadsRadarr: radarrClient ?? downloads,
        librarySonarr: sonarr,
        libraryRadarr: radarr,
        versionsSonarr: librarySonarr === null ? null : `${librarySonarr}-versions`,
        versionsRadarr: libraryRadarr === null ? null : `${libraryRadarr}-versions`,
      },
    });
  });

  // Suggests the rTorrent address and username from the first enabled rTorrent download client in Sonarr, then Radarr.
  // The password is never read. Always answers 200 so the wizard can ask before rTorrent is saved.
  routes.get('/rtorrent', async (context) => {
    const isLocal = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const bare = (host: string) => host.replace(/^\[|\]$/g, '');
    const read = async (service: 'sonarr' | 'radarr') => {
      try {
        const { status, body } = await arr[service].request('/api/v3/downloadclient');
        if (status < 200 || status > 299 || !Array.isArray(body)) return undefined;
        for (const client of body) {
          if (!isRecord(client) || client.enable === false || client.implementation !== 'RTorrent' || !Array.isArray(client.fields)) continue;
          const value = (name: string) => (client.fields as unknown[]).find((entry) => isRecord(entry) && entry.name === name) as { value?: unknown } | undefined;
          const host = value('host')?.value;
          if (typeof host !== 'string' || host.trim() === '') continue;
          const port = value('port')?.value;
          const secure = value('useSsl')?.value === true;
          const urlBase = value('urlBase')?.value;
          const username = value('username')?.value;
          let name = bare(host.trim().toLowerCase());
          if (isLocal(name)) {
            try {
              name = bare(new URL(readSetting(database, 'serviceAddresses', `${service}.url`) ?? '').hostname);
            } catch {
              name = '';
            }
          }
          const path = typeof urlBase === 'string' ? urlBase.replace(/^\/+|\/+$/g, '') : '';
          const displayHost = name.includes(':') ? `[${name}]` : name;
          const address = name === '' || isLocal(name) ? null
            : `${secure ? 'https' : 'http'}://${displayHost}${typeof port === 'number' && port !== (secure ? 443 : 80) ? `:${port}` : ''}${path === '' ? '' : `/${path}`}`;
          return { address, username: typeof username === 'string' && username !== '' ? username : null };
        }
      } catch {
        // An unconfigured or unreachable service reads as no client.
      }
      return undefined;
    };
    return context.json(await read('sonarr') ?? await read('radarr') ?? { address: null, username: null });
  });

  // Second versions download into the same folder as their service's own grabs, so there is no separate downloads key for them.
  routes.post('/folders', async (context) => {
    const body = await readBody(context);
    if (!hasExactly(body, folderFields) || folderFields.some((field) => typeof body[field] !== 'string')) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const values = body as FolderValues;
    const fields = folderProblems(values);
    if (Object.keys(fields).length > 0) return context.json({ error: 'invalid_folders', fields }, 400);
    setSetting(database, 'hostPaths', 'downloads.sonarr', values.downloadsSonarr);
    setSetting(database, 'hostPaths', 'downloads.radarr', values.downloadsRadarr);
    setSetting(database, 'hostPaths', 'library.sonarr', values.librarySonarr);
    setSetting(database, 'hostPaths', 'library.radarr', values.libraryRadarr);
    setSetting(database, 'hostPaths', 'versions.sonarr', values.versionsSonarr);
    setSetting(database, 'hostPaths', 'versions.radarr', values.versionsRadarr);
    return context.json({ warnings: folderWarnings(values) });
  });

  // Connects Plex with the token the owner signed in with, checked in a throwaway in-memory database first so a
  // failing address saves nothing. The token is never sent back.
  routes.post('/plex', async (context) => {
    const body = await readBody(context);
    if (!hasExactly(body, ['url']) || typeof body.url !== 'string') return context.json({ error: 'invalid_request' }, 400);
    const token = context.get('plexSignInToken');
    if (token === undefined) return context.json({ error: 'no_sign_in_token' }, 409);
    const scratch = new DatabaseSync(':memory:');
    try {
      migrateDatabase(scratch, applicationMigrations);
      setSetting(scratch, 'serviceAddresses', 'plex.url', body.url);
      setSetting(scratch, 'credentials', 'plex.token', token);
      const status = await createPlex(scratch, { fetch }).check();
      if (status.kind === 'ok') {
        setSetting(database, 'serviceAddresses', 'plex.url', body.url);
        setSetting(database, 'credentials', 'plex.token', token);
      }
      return context.json(status);
    } finally {
      scratch.close();
    }
  });

  // Connects the Jellyfin server the owner signed in through, checked in a throwaway database first like Plex above, so a
  // refused key saves nothing. The address is the saved one; only the key comes from the request.
  routes.post('/jellyfin', async (context) => {
    const body = await readBody(context);
    if (!hasExactly(body, ['apiKey']) || typeof body.apiKey !== 'string' || body.apiKey === '') return context.json({ error: 'invalid_request' }, 400);
    if (effectiveOwner(database, env.PLEX_OWNER_ID)?.provider !== 'jellyfin') return context.json({ error: 'not_jellyfin_owner' }, 409);
    const scratch = new DatabaseSync(':memory:');
    try {
      migrateDatabase(scratch, applicationMigrations);
      const url = readSetting(database, 'serviceAddresses', 'jellyfin.url');
      if (url !== undefined) setSetting(scratch, 'serviceAddresses', 'jellyfin.url', url);
      setSetting(scratch, 'credentials', 'jellyfin.apiKey', body.apiKey);
      const status = await createJellyfin(scratch, { fetch }).check();
      if (status.kind === 'ok') setSetting(database, 'credentials', 'jellyfin.apiKey', body.apiKey);
      return context.json(status);
    } finally {
      scratch.close();
    }
  });

  // Adds a tracker only once its account connects, so the wizard never leaves a half-added one; "other" has no
  // account to test. The hit-and-run rule is set afterwards with PUT /api/settings/trackers/:host/rule.
  routes.post('/trackers', async (context) => {
    const body = await readBody(context);
    if (!isRecord(body) || Object.keys(body).some((key) => !['host', 'software', 'credential'].includes(key))
      || typeof body.host !== 'string' || !isSoftware(body.software)
      || (body.credential !== undefined && typeof body.credential !== 'string')) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const host = bareHost(body.host);
    if (host === undefined) return context.json({ error: 'invalid_host' }, 400);
    if (listTrackerHosts(database, env).includes(host)) return context.json({ error: 'duplicate' }, 409);
    const credential = typeof body.credential === 'string' ? body.credential : '';
    if (body.software === 'other') {
      if (credential.trim() !== '') return context.json({ error: 'invalid_request' }, 400);
      addTracker(database, host);
      saveTrackerSoftware(database, host, 'other');
      return context.json({ host, connection: { kind: 'unsupported' } }, 201);
    }
    if (credential.trim() === '') return context.json({ error: 'invalid_request' }, 400);
    const connection = await trackers.test(host, body.software, credential);
    if (connection.kind !== 'ok') return context.json({ host, connection });
    addTracker(database, host);
    saveTrackerSoftware(database, host, body.software);
    saveTrackerCredential(database, host, credential);
    return context.json({ host, connection }, 201);
  });

  // A folder and a bucket never coexist, since readBackupDestination refuses both. The bucket is not tested here:
  // the next backup run and the health check report a bad one.
  routes.post('/backup', async (context) => {
    const body = await readBody(context);
    const bucketFields = ['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey'] as const;
    if (hasExactly(body, ['folder']) && typeof body.folder === 'string') {
      if (!isAbsolute(body.folder)) return context.json({ error: 'invalid_backup', field: 'folder', reason: 'Must be an absolute path.' }, 400);
      if (!isDirectory(body.folder)) return context.json({ error: 'invalid_backup', field: 'folder', reason: 'This folder does not exist.' }, 400);
      setSetting(database, 'hostPaths', 'backup.folder', body.folder);
      for (const key of ['backup.endpoint', 'backup.bucket', 'backup.region']) deleteSetting(database, 'serviceAddresses', key);
      for (const key of ['backup.accessKeyId', 'backup.secretAccessKey']) deleteSetting(database, 'credentials', key);
    } else if (
      isRecord(body) && bucketFields.every((field) => typeof body[field] === 'string')
      && (body.region === undefined || typeof body.region === 'string')
      && Object.keys(body).every((key) => key === 'region' || (bucketFields as readonly string[]).includes(key))
    ) {
      const blank = bucketFields.find((field) => (body[field] as string).trim() === '');
      if (blank !== undefined) return context.json({ error: 'invalid_backup', field: blank, reason: 'Required.' }, 400);
      setSetting(database, 'serviceAddresses', 'backup.endpoint', body.endpoint as string);
      setSetting(database, 'serviceAddresses', 'backup.bucket', body.bucket as string);
      setSetting(database, 'credentials', 'backup.accessKeyId', body.accessKeyId as string);
      setSetting(database, 'credentials', 'backup.secretAccessKey', body.secretAccessKey as string);
      if (typeof body.region === 'string') setSetting(database, 'serviceAddresses', 'backup.region', body.region);
      else deleteSetting(database, 'serviceAddresses', 'backup.region');
      deleteSetting(database, 'hostPaths', 'backup.folder');
    } else {
      return context.json({ error: 'invalid_request' }, 400);
    }
    setBackupsOff(database, false);
    return context.body(null, 204);
  });

  // The private half is returned once, in this response, and never stored; creating another pair replaces the public half.
  routes.post('/backup/key', (context) => context.json(createBackupKeyPair(database), 201));

  return routes;
};
