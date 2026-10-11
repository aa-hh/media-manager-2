import type { DatabaseSync } from 'node:sqlite';
import { type Context, Hono } from 'hono';
import { parseMargins, readMargins, saveMargins } from './advice.js';
import {
  createTrackerAccounts, forgetTrackerAccount, isSoftware, saveTrackerCredential, saveTrackerSoftware, type TrackerAccounts, trackerCredential, trackerSoftware,
} from './services/trackerAccounts.js';
import {
  addTracker, bareHost, isRecord, listTrackerHosts, parseRule, removeTracker, saveTrackerRule, trackerRule, trackerRulesFromEnvironment,
} from './trackerRules.js';

const readBody = async (context: Context): Promise<unknown> => {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
};

// Routes for the trackers part of the settings screen; app.ts mounts them behind the sign-in guard, which also checks
// every write's origin. A tracker in the path must already be listed, under its exact hostname.
export const createTrackerRoutes = (
  database: DatabaseSync,
  env: NodeJS.ProcessEnv = process.env,
  accounts: TrackerAccounts = createTrackerAccounts(database, { env }),
) => {
  const routes = new Hono();
  const listed = (host: string) => listTrackerHosts(database, env).includes(host);

  // A saved rule or margins that fail validation are reported on their tracker, so one bad value never hides the list.
  // envRule stays true under a Settings rule, so the screen can offer to go back to the env file's rule.
  const describe = (host: string, envRules: Map<string, unknown>) => {
    let found: ReturnType<typeof trackerRule>;
    let margins: ReturnType<typeof readMargins> | null = null;
    let problem: string | null = null;
    let invalidSavedRule = false;
    try {
      found = trackerRule(database, host, env);
    } catch (error) {
      problem = (error as Error).message;
      invalidSavedRule = true;
    }
    try {
      margins = readMargins(database, host);
    } catch (error) {
      problem ??= (error as Error).message;
    }
    const ruleSource = invalidSavedRule ? 'settings' : found?.source ?? null;
    const status = ruleSource === 'settings' ? 'configured' : ruleSource === 'env' ? 'configured_env' : 'no_rule';
    return { host, status, rule: found?.rule ?? null, ruleSource, envRule: envRules.has(host), margins, problem };
  };

  // The account credential never leaves the server: the browser learns only whether one is saved.
  const account = async (host: string) => ({
    software: trackerSoftware(database, host),
    credentialSet: trackerCredential(database, host) !== undefined,
    connection: await accounts.connection(host),
  });

  // An invalid TRACKER_RULES stops startup, and listTrackerHosts parses it too, so reading it here adds no new failure.
  routes.get('/settings/trackers', async (context) => {
    const envRules = trackerRulesFromEnvironment(env);
    return context.json(await Promise.all(
      listTrackerHosts(database, env).map(async (host) => ({ ...describe(host, envRules), ...await account(host) })),
    ));
  });

  routes.post('/settings/trackers', async (context) => {
    const body = await readBody(context);
    if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.host !== 'string') return context.json({ error: 'invalid_request' }, 400);
    const host = bareHost(body.host);
    if (host === undefined) return context.json({ error: 'invalid_host' }, 400);
    if (listed(host)) return context.json({ error: 'duplicate' }, 409);
    addTracker(database, host);
    return context.json({ host }, 201);
  });

  // Margins are optional here; left out, the saved ones stay.
  routes.put('/settings/trackers/:host/rule', async (context) => {
    const host = context.req.param('host');
    if (!listed(host)) return context.json({ error: 'not_found' }, 404);
    const body = await readBody(context);
    if (!isRecord(body) || !Object.hasOwn(body, 'rule') || Object.keys(body).some((key) => key !== 'rule' && key !== 'margins')) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const rule = parseRule(body.rule);
    if ('reason' in rule) return context.json({ error: 'invalid_rule', field: rule.field, reason: rule.reason }, 400);
    const margins = body.margins === undefined ? undefined : parseMargins(body.margins);
    if (margins !== undefined && 'reason' in margins) return context.json({ error: 'invalid_margins', field: margins.field, reason: margins.reason }, 400);
    saveTrackerRule(database, host, rule);
    if (margins !== undefined) saveMargins(database, host, margins);
    return context.body(null, 204);
  });

  // Clearing never removes the tracker: one listed only through its saved rule is kept as added. The TRACKER_RULES rule, if any, applies again.
  routes.delete('/settings/trackers/:host/rule', (context) => {
    const host = context.req.param('host');
    if (!listed(host)) return context.json({ error: 'not_found' }, 404);
    if (!trackerRulesFromEnvironment(env).has(host)) addTracker(database, host);
    saveTrackerRule(database, host, null);
    saveMargins(database, host, null);
    return context.body(null, 204);
  });

  routes.delete('/settings/trackers/:host', (context) => {
    const host = context.req.param('host');
    if (!listed(host)) return context.json({ error: 'not_found' }, 404);
    if (trackerRulesFromEnvironment(env).has(host)) {
      return context.json({ error: 'in_environment', message: `${host} is set in TRACKER_RULES in the env file; remove it there and restart the server.` }, 409);
    }
    removeTracker(database, host);
    saveMargins(database, host, null);
    forgetTrackerAccount(database, host);
    return context.body(null, 204);
  });

  routes.put('/settings/trackers/:host/software', async (context) => {
    const host = context.req.param('host');
    if (!listed(host)) return context.json({ error: 'not_found' }, 404);
    const body = await readBody(context);
    if (!isRecord(body) || Object.keys(body).length !== 1 || !isSoftware(body.software)) return context.json({ error: 'invalid_request' }, 400);
    saveTrackerSoftware(database, host, body.software);
    return context.body(null, 204);
  });

  // A blank value keeps the saved credential, so the owner never has to retype a secret.
  routes.put('/settings/trackers/:host/credential', async (context) => {
    const host = context.req.param('host');
    if (!listed(host)) return context.json({ error: 'not_found' }, 404);
    const body = await readBody(context);
    if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.value !== 'string') return context.json({ error: 'invalid_request' }, 400);
    if (body.value.trim() !== '') saveTrackerCredential(database, host, body.value);
    return context.body(null, 204);
  });

  // Tests the form's values over the saved ones without saving either; a left-out or blank credential means the saved one.
  // A Gazelle test still remembers which header form worked.
  routes.post('/settings/trackers/:host/test', async (context) => {
    const host = context.req.param('host');
    if (!listed(host)) return context.json({ error: 'not_found' }, 404);
    const body = await readBody(context);
    if (!isRecord(body) || Object.keys(body).some((key) => key !== 'software' && key !== 'credential')
      || (body.software !== undefined && !isSoftware(body.software))
      || (body.credential !== undefined && typeof body.credential !== 'string')) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const software = isSoftware(body.software) ? body.software : trackerSoftware(database, host);
    const credential = typeof body.credential === 'string' && body.credential.trim() !== '' ? body.credential : trackerCredential(database, host);
    return context.json(await accounts.test(host, software, credential));
  });

  return routes;
};
