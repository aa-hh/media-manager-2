import type { DatabaseSync } from 'node:sqlite';
import { type Context, Hono } from 'hono';
import { parseMargins, readMargins, saveMargins } from './advice.js';
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
export const createTrackerRoutes = (database: DatabaseSync, env: NodeJS.ProcessEnv = process.env) => {
  const routes = new Hono();
  const listed = (host: string) => listTrackerHosts(database, env).includes(host);

  // A saved rule or margins that fail validation are reported on their tracker, so one bad value never hides the list.
  const describe = (host: string) => {
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
    return { host, status, rule: found?.rule ?? null, ruleSource, margins, problem };
  };

  routes.get('/settings/trackers', (context) => context.json(listTrackerHosts(database, env).map(describe)));

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
    return context.body(null, 204);
  });

  return routes;
};
