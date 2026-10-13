import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { applicationMigrations, migrateDatabase } from './database.js';
import { effectiveOwner } from './owner.js';
import { createArr } from './services/arr.js';
import { type ConnectionStatus, readSetting, type ServiceOptions } from './services/connection.js';
import { createJellyfin, identify } from './services/jellyfin.js';
import { createMdblist } from './services/mdblist.js';
import { createPlex } from './services/plex.js';
import { createRtorrent } from './services/rtorrent.js';
import { createTmdb } from './services/tmdb.js';
import { createTrakt } from './services/trakt.js';
import { getSetting, setSetting } from './settings.js';

type Category = 'serviceAddresses' | 'credentials';
const categories: readonly Category[] = ['serviceAddresses', 'credentials'];

// The keys each service reads; the settings screen reads and writes these and no others.
const serviceKeys = {
  sonarr: { serviceAddresses: ['sonarr.url'], credentials: ['sonarr.apiKey'] },
  radarr: { serviceAddresses: ['radarr.url'], credentials: ['radarr.apiKey'] },
  rtorrent: { serviceAddresses: ['rtorrent.url'], credentials: ['rtorrent.username', 'rtorrent.password'] },
  plex: { serviceAddresses: ['plex.url'], credentials: ['plex.token'] },
  jellyfin: { serviceAddresses: ['jellyfin.url'], credentials: ['jellyfin.apiKey'] },
  // TMDB, MDBList and Trakt each have one fixed address, so the owner enters only a key.
  tmdb: { serviceAddresses: [], credentials: ['tmdb.apiKey'] },
  mdblist: { serviceAddresses: [], credentials: ['mdblist.apiKey'] },
  trakt: { serviceAddresses: [], credentials: ['trakt.clientId'] },
} satisfies Record<string, Record<Category, string[]>>;
type ServiceName = keyof typeof serviceKeys;

// Tracker accounts live with their trackers (trackerSettings.ts), not here.
const checks: Record<ServiceName, (database: DatabaseSync, options: ServiceOptions) => Promise<ConnectionStatus>> = {
  sonarr: (database, options) => createArr('sonarr', database, options).check(),
  radarr: (database, options) => createArr('radarr', database, options).check(),
  rtorrent: (database, options) => createRtorrent(database, options).check(),
  plex: (database, options) => createPlex(database, options).check(),
  jellyfin: (database, options) => createJellyfin(database, options).check(),
  tmdb: (database, options) => createTmdb(database, options).check(),
  mdblist: (database, options) => createMdblist(database, options).check(),
  trakt: (database, options) => createTrakt(database, options).check(),
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const isServiceName = (value: string): value is ServiceName => Object.hasOwn(serviceKeys, value);
const isKnown = (category: string, key: string): category is Category => (
  (categories as readonly string[]).includes(category)
  && Object.values(serviceKeys).some((keys) => (keys[category as Category] as string[]).includes(key))
);
// A blank credential in the form means "keep the saved one", so the owner never has to retype a secret.
const isBlankCredential = (category: Category, value: string) => category === 'credentials' && value.trim() === '';

// Reads { serviceAddresses?, credentials? } holding only this service's keys with string values.
const readFormValues = (body: unknown, service: ServiceName) => {
  if (!isRecord(body) || Object.keys(body).some((category) => !(categories as readonly string[]).includes(category))) return undefined;
  for (const category of categories) {
    const values = body[category];
    if (values === undefined) continue;
    if (!isRecord(values)) return undefined;
    const allowed: string[] = serviceKeys[service][category];
    if (Object.entries(values).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')) return undefined;
  }
  return body as Partial<Record<Category, Record<string, string>>>;
};

// Routes for the settings screen; app.ts mounts them behind the sign-in guard, which also checks every PUT and POST's origin.
export const createConnectionRoutes = (database: DatabaseSync, options: ServiceOptions & { ownerPlexId?: string } = {}) => {
  const routes = new Hono();

  // A Jellyfin owner belongs to one server, so its address may change only to an address of that same server (same Id).
  // An owner saved without the Id (before it was stored, or when the server did not answer) gets it from the saved address first.
  const sameServer = async (url: string): Promise<'ok' | 'unreachable' | { different: string }> => {
    const owner = effectiveOwner(database, options.ownerPlexId);
    if (owner?.provider !== 'jellyfin') return 'ok';
    const fetch = options.fetch ?? globalThis.fetch;
    let serverId = owner.serverId;
    if (serverId === null) {
      const saved = getSetting(database, 'serviceAddresses', 'jellyfin.url');
      const current = saved === undefined ? undefined : await identify(fetch, saved.replace(/\/+$/, ''));
      if (current?.kind !== 'ok') return 'unreachable';
      serverId = current.serverId;
      database.prepare('UPDATE owner SET server_id = ? WHERE id = 1 AND server_id IS NULL').run(serverId);
    }
    const identified = await identify(fetch, url.replace(/\/+$/, ''));
    if (identified.kind !== 'ok') return 'unreachable';
    return identified.serverId === serverId ? 'ok' : { different: identified.serverName };
  };

  // A saved credential never leaves the server, not even masked: the browser learns only whether it is set.
  routes.get('/settings', (context) => context.json({
    services: Object.entries(serviceKeys).map(([service, keys]) => ({
      service,
      serviceAddresses: Object.fromEntries(keys.serviceAddresses.map((key) => [key, getSetting(database, 'serviceAddresses', key) ?? ''])),
      credentials: Object.fromEntries(keys.credentials.map((key) => [key, readSetting(database, 'credentials', key) !== undefined])),
    })),
  }));

  routes.put('/settings/:category/:key', async (context) => {
    const category = context.req.param('category');
    const key = context.req.param('key');
    if (!isKnown(category, key)) return context.json({ error: 'not_found' }, 404);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.value !== 'string') {
      return context.json({ error: 'invalid_request' }, 400);
    }
    if (category === 'serviceAddresses' && key === 'jellyfin.url') {
      const same = await sameServer(body.value);
      if (same === 'unreachable') return context.json({ error: 'unreachable' }, 409);
      if (same !== 'ok') return context.json({ error: 'different_server' }, 409);
    }
    if (!isBlankCredential(category, body.value)) setSetting(database, category, key, body.value);
    return context.body(null, 204);
  });

  // The form's values are laid over the saved ones in a throwaway in-memory database, so the service's own check runs unchanged and nothing is saved.
  // Jellyfin is identified first, so an address that answers but is not Jellyfin reads as not_jellyfin rather than unreachable, and one that does not answer is waited on only once.
  routes.post('/settings/test/:service', async (context) => {
    const service = context.req.param('service');
    if (!isServiceName(service)) return context.json({ error: 'not_found' }, 404);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const form = readFormValues(body, service);
    if (form === undefined) return context.json({ error: 'invalid_request' }, 400);
    if (service === 'jellyfin') {
      const url = form.serviceAddresses?.['jellyfin.url'] ?? getSetting(database, 'serviceAddresses', 'jellyfin.url');
      const identified = url ? (await identify(options.fetch ?? globalThis.fetch, url.replace(/\/+$/, ''))).kind : undefined;
      if (identified === 'not_jellyfin') return context.json({ kind: 'not_jellyfin' });
      if (identified === 'no_answer') return context.json({ kind: 'unreachable' });
    }
    const jellyfinUrl = service === 'jellyfin' ? form.serviceAddresses?.['jellyfin.url'] : undefined;
    if (jellyfinUrl !== undefined && jellyfinUrl !== getSetting(database, 'serviceAddresses', 'jellyfin.url')) {
      const same = await sameServer(jellyfinUrl);
      if (same === 'unreachable') return context.json({ kind: 'unreachable' });
      if (same !== 'ok') return context.json({ kind: 'different_server', serverName: same.different });
    }
    const scratch = new DatabaseSync(':memory:');
    try {
      migrateDatabase(scratch, applicationMigrations);
      for (const category of categories) {
        for (const key of serviceKeys[service][category] as string[]) {
          const given = form[category]?.[key];
          const value = given === undefined || isBlankCredential(category, given) ? getSetting(database, category, key) : given;
          if (value !== undefined) setSetting(scratch, category, key, value);
        }
      }
      return context.json(await checks[service](scratch, options));
    } finally {
      scratch.close();
    }
  });

  return routes;
};
