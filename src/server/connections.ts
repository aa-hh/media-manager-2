import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { applicationMigrations, migrateDatabase } from './database.js';
import { createArr } from './services/arr.js';
import { type ConnectionStatus, readSetting, type ServiceOptions } from './services/connection.js';
import { createPlex } from './services/plex.js';
import { createRtorrent } from './services/rtorrent.js';
import { createTrackerAccounts, type Tracker } from './services/trackerAccounts.js';
import { getSetting, setSetting } from './settings.js';

type Category = 'serviceAddresses' | 'credentials';
const categories: readonly Category[] = ['serviceAddresses', 'credentials'];

// The keys each service reads; the settings screen reads and writes these and no others.
const serviceKeys = {
  sonarr: { serviceAddresses: ['sonarr.url'], credentials: ['sonarr.apiKey'] },
  radarr: { serviceAddresses: ['radarr.url'], credentials: ['radarr.apiKey'] },
  rtorrent: { serviceAddresses: ['rtorrent.url'], credentials: ['rtorrent.username', 'rtorrent.password'] },
  plex: { serviceAddresses: ['plex.url'], credentials: ['plex.token'] },
  blutopia: { serviceAddresses: ['blutopia.url'], credentials: ['blutopia.apiToken'] },
  privatehd: { serviceAddresses: ['privatehd.url'], credentials: ['privatehd.username', 'privatehd.password', 'privatehd.pid'] },
  beyondhd: { serviceAddresses: ['beyondhd.url'], credentials: ['beyondhd.apiKey', 'beyondhd.rssKey'] },
} satisfies Record<string, Record<Category, string[]>>;
type ServiceName = keyof typeof serviceKeys;

// Tracker accounts have no version to report, so their ok carries none.
type TestResult = { kind: ConnectionStatus['kind']; version?: string };
const trackerCheck = (tracker: Tracker) => async (database: DatabaseSync, options: ServiceOptions): Promise<TestResult> => (
  { kind: (await createTrackerAccounts(database, options).check(tracker)).kind }
);
const checks: Record<ServiceName, (database: DatabaseSync, options: ServiceOptions) => Promise<TestResult>> = {
  sonarr: (database, options) => createArr('sonarr', database, options).check(),
  radarr: (database, options) => createArr('radarr', database, options).check(),
  rtorrent: (database, options) => createRtorrent(database, options).check(),
  plex: (database, options) => createPlex(database, options).check(),
  blutopia: trackerCheck('blutopia'),
  privatehd: trackerCheck('privatehd'),
  beyondhd: trackerCheck('beyondhd'),
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
export const createConnectionRoutes = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const routes = new Hono();

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
    if (!isBlankCredential(category, body.value)) setSetting(database, category, key, body.value);
    return context.body(null, 204);
  });

  // The form's values are laid over the saved ones in a throwaway in-memory database, so the service's own check runs unchanged and nothing is saved.
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
