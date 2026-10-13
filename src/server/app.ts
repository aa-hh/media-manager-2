import { createHash, timingSafeEqual } from 'node:crypto';
import { extname, isAbsolute } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { deleteCookie, setCookie } from 'hono/cookie';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { createAuthentication, isLoopback, type JellyfinQuickConnectStartResult, type JellyfinSignInResult } from './auth.js';
import { createDiscoverRoutes, type Discover } from './discover/index.js';
import { createEventHub, type EventHub } from './events.js';
import { globalTimers, type Timers } from './jobs.js';
import { logEvent } from './log.js';
import { createAddRoutes, type Add } from './add.js';
import { createGrabRoutes, type Grabs } from './grabs.js';
import { createLibraryRoutes, type Library } from './library.js';
import { createOwnedRoutes, type Owned } from './owned.js';
import { effectiveOwner } from './owner.js';
import { createProtectionRoutes, type Protection } from './protection.js';
import { createReleaseRoutes, type Releases } from './releases.js';
import { createSearchRoutes, type Search } from './search.js';
import type { SecondVersionDelete } from './secondVersionDelete.js';
import { createSecondVersionRoutes, type SecondVersions } from './secondVersions.js';
import type { SetupEnvironment } from './setup.js';
import { createTitleDeleteRoutes, type TitleDelete } from './titleDelete.js';
import { createTmdbTitleRoutes, type TmdbTitles } from './tmdbTitles.js';

export type CreateAppOptions = {
  clientDirectory: string;
  listeningHost: string;
  database: DatabaseSync;
  ownerPlexId?: string;
  publicOrigin?: string;
  now?: () => number;
  fetch?: typeof globalThis.fetch;
  events?: EventHub;
  timers?: Timers;
  search?: Search;
  add?: Add;
  releases?: Releases;
  grabs?: Grabs;
  secondVersions?: SecondVersions;
  secondVersionDelete?: SecondVersionDelete;
  owned?: Owned;
  protection?: Protection;
  library?: Library;
  discover?: Discover;
  titleDelete?: TitleDelete;
  tmdbTitles?: TmdbTitles;
  setup?: Hono<SetupEnvironment>;
  api?: Hono;
  images?: Hono;
  cache?: Hono;
  webhooks?: {
    secret(): string | undefined;
    receive(service: 'sonarr' | 'radarr', payload: unknown): 'ok' | 'ignored' | 'invalid';
  };
};

type AppEnvironment = {
  Variables: {
    sessionExpiresAt: number;
    sessionToken: string;
    plexSignInToken: string | undefined;
  };
};

const MAX_STREAMS = 20;
const KEEPALIVE_MS = 25_000;

type CookieRead =
  | { kind: 'missing' | 'invalid' | 'duplicate' }
  | { kind: 'value'; value: string };

const SESSION_LIFETIME_SECONDS = 24 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const readCookie = (header: string | undefined, name: string): CookieRead => {
  if (header === undefined) return { kind: 'missing' };
  const values = header.split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator === -1 || part.slice(0, separator).trim() !== name) return [];
    return [part.slice(separator + 1).trim()];
  });
  if (values.length === 0) return { kind: 'missing' };
  if (values.length !== 1) return { kind: 'duplicate' };
  if (!TOKEN_PATTERN.test(values[0])) return { kind: 'invalid' };
  return { kind: 'value', value: values[0] };
};

const WEBHOOK_BODY_LIMIT = 512 * 1024;

// Sonarr and Radarr send their webhook username and password as Basic auth; only the password is checked.
const webhookPasswordMatches = (header: string | undefined, secret: string) => {
  const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(header ?? '');
  if (match === null) return false;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator === -1) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(decoded.slice(separator + 1)), digest(secret));
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readExactJson = async (context: Context, keys: string[]) => {
  let value: unknown;
  try {
    value = await context.req.json();
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) return undefined;
  return value;
};

const acceptsHtml = (header: string | undefined) => header?.split(',').some(
  (type) => {
    const [mediaType, ...parameters] = type.split(';').map((part) => part.trim());
    const quality = parameters.find((parameter) => parameter.startsWith('q='))?.slice(2);
    return mediaType === 'text/html' && (quality === undefined || Number(quality) > 0);
  },
) ?? false;

const metricNames = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB', 'api', 'api-failed'];
const metricRatings = ['good', 'needs-improvement', 'poor'];
const metricKeys = ['name', 'value', 'route', 'path', 'rating', 'status'];
const pagePath = (value: unknown) => typeof value === 'string' && value.length <= 200 && /^\/[A-Za-z0-9/_.\-]*$/.test(value);

// Only these fields reach the log, so a browser cannot write anything else into it.
const validMetric = (item: unknown) => {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
  const { name, value, route, path, rating, status } = item as Record<string, unknown>;
  return Object.keys(item).every((key) => metricKeys.includes(key))
    && typeof name === 'string' && metricNames.includes(name)
    && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 600_000
    && pagePath(route)
    && (path === undefined ? name !== 'api' && name !== 'api-failed' : pagePath(path))
    // A failed request carries its status, 0 when no response came back at all.
    && (status === undefined ? name !== 'api-failed' : name === 'api-failed' && Number.isInteger(status) && (status as number) >= 0 && (status as number) <= 599)
    && (rating === undefined || (typeof rating === 'string' && metricRatings.includes(rating)));
};

export const createApp = (options: CreateAppOptions) => {
  if (!isAbsolute(options.clientDirectory)) throw new TypeError('clientDirectory must be absolute.');
  const now = options.now ?? Date.now;
  const events = options.events ?? createEventHub();
  const timers = options.timers ?? globalTimers;
  const authentication = createAuthentication({
    listeningHost: options.listeningHost,
    ownerPlexId: options.ownerPlexId,
    publicOrigin: options.publicOrigin,
    database: options.database,
    now,
    fetch: options.fetch ?? globalThis.fetch,
  });
  const secure = authentication.secure;
  const sessionCookieName = secure ? '__Host-mm_session' : 'mm_session';
  const bindingCookieName = secure ? '__Host-mm_plex' : 'mm_plex';
  const app = new Hono<AppEnvironment>();
  const applicationDocument = serveStatic({ root: options.clientDirectory, path: 'index.html' });
  const staticFiles = serveStatic({ root: options.clientDirectory });
  const cookieOptions = { httpOnly: true, sameSite: 'Lax' as const, secure, path: '/' };

  // A loopback listener sits behind the reverse proxy the README requires, so the socket is the proxy and the browser is
  // the address the proxy appended last; anything earlier in the header is the browser's own claim.
  const clientOf = (context: Context) => {
    const forwarded = isLoopback(options.listeningHost) ? context.req.header('X-Forwarded-For')?.split(',').at(-1)?.trim() : undefined;
    if (forwarded) return forwarded;
    try {
      return getConnInfo(context).remote.address ?? '';
    } catch {
      return '';
    }
  };

  const clearSessionCookie = (context: Context) => {
    deleteCookie(context, sessionCookieName, cookieOptions);
  };
  const clearBindingCookie = (context: Context) => {
    deleteCookie(context, bindingCookieName, cookieOptions);
  };

  // Times every API request but these: the event stream stays open for hours, browser timings are logged by their own route,
  // and image loads would flood the log.
  app.use('*', async (context, next) => {
    const { path } = context.req;
    if (!path.startsWith('/api') || path === '/api/events' || path === '/api/metrics' || path.startsWith('/api/images/')) return next();
    const started = performance.now();
    await next();
    logEvent('api', { method: context.req.method, path, status: context.res.status, ms: Math.round((performance.now() - started) * 10) / 10 });
  });

  app.use('*', async (context, next) => {
    await next();
    // Cached poster and fanart may be reused by the browser for five minutes; everything else, error answers included, is never stored.
    const reusableImage = context.req.path.startsWith('/api/images/') && (context.res.status === 200 || context.res.status === 304);
    context.header('Cache-Control', reusableImage ? 'private, max-age=300' : 'no-store');
    context.header('Referrer-Policy', 'no-referrer');
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('X-Frame-Options', 'DENY');
  });

  const requestLimit = bodyLimit({
    maxSize: 1_024,
    onError: (context) => context.json({ error: 'request_too_large' }, 413),
  });

  // A grab names its release by guid, which is often a long magnet or download URL.
  const grabRequestLimit = bodyLimit({
    maxSize: 16_384,
    onError: (context) => context.json({ error: 'request_too_large' }, 413),
  });

  // A manual import lists every file of a season pack, and a movie or show delete every torrent and second version chosen,
  // so they get more room than the other private writes.
  const importRequestLimit = bodyLimit({
    maxSize: 64 * 1_024,
    onError: (context) => context.json({ error: 'request_too_large' }, 413),
  });

  const requireBrowserPost: MiddlewareHandler<AppEnvironment> = async (context, next) => {
    const origin = context.req.header('Origin');
    const contentType = context.req.header('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
    const requestedWith = context.req.header('X-Requested-With');
    const fetchSite = context.req.header('Sec-Fetch-Site')?.toLowerCase();
    if (
      (authentication.origin !== undefined && origin !== authentication.origin)
      || origin === undefined
      || origin === 'null'
      || requestedWith !== 'media-manager-2'
      || contentType !== 'application/json'
      || fetchSite === 'cross-site'
    ) return context.json({ error: 'invalid_origin' }, 403);
    // A batch of browser timings holds up to 50 items, so it gets the same room as a grab.
    if (context.req.path === '/api/grabs' || context.req.path === '/api/second-versions' || context.req.path === '/api/metrics') return grabRequestLimit(context, next);
    // A movie or show delete lists every torrent and second version chosen, which for a long show is many.
    if (context.req.path.startsWith('/api/imports/') || /^\/api\/library\/(movie|series)\/\d+\/delete$/.test(context.req.path)) return importRequestLimit(context, next);
    return requestLimit(context, next);
  };

  app.get('/auth/status', (context) => {
    const binding = readCookie(context.req.header('Cookie'), bindingCookieName);
    if (binding.kind === 'duplicate' || binding.kind === 'invalid') {
      clearBindingCookie(context);
      return context.json({ error: 'invalid_request' }, 400);
    }
    return context.json(authentication.status(binding.kind === 'value' ? binding.value : undefined));
  });

  app.post('/auth/start', requireBrowserPost, async (context) => {
    const body = await readExactJson(context, []);
    if (body === undefined) return context.json({ error: 'invalid_request' }, 400);
    const binding = readCookie(context.req.header('Cookie'), bindingCookieName);
    if (binding.kind === 'duplicate' || binding.kind === 'invalid') {
      clearBindingCookie(context);
      return context.json({ error: 'invalid_request' }, 400);
    }
    const result = await authentication.start(binding.kind === 'value' ? binding.value : undefined, clientOf(context));
    if (result.kind === 'not_configured') return context.json({ error: 'not_configured' }, 503);
    if (result.kind === 'unavailable') return context.json({ error: 'plex_unavailable' }, 503);
    if (result.kind === 'rate_limited') {
      context.header('Retry-After', String(result.retryAfter));
      return context.json({ error: 'rate_limited' }, 429);
    }
    setCookie(context, bindingCookieName, result.binding, {
      ...cookieOptions,
      maxAge: Math.max(1, Math.ceil((result.expiresAt - now()) / 1000)),
    });
    return context.json({ url: result.url }, 201);
  });

  app.get('/auth/callback', applicationDocument);

  app.post('/auth/complete', requireBrowserPost, async (context) => {
    const body = await readExactJson(context, ['state']);
    if (body === undefined || typeof body.state !== 'string' || body.state.length === 0) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const binding = readCookie(context.req.header('Cookie'), bindingCookieName);
    if (binding.kind !== 'value') {
      clearBindingCookie(context);
      return context.json({ error: 'invalid_flow' }, 401);
    }
    const session = readCookie(context.req.header('Cookie'), sessionCookieName);
    if (session.kind === 'duplicate' || session.kind === 'invalid') {
      clearSessionCookie(context);
      return context.json({ error: 'invalid_flow' }, 401);
    }
    const result = await authentication.complete(
      binding.value,
      body.state,
      session.kind === 'value' ? session.value : undefined,
    );
    if (result.kind === 'pending') return context.json({ status: 'pending' }, 202);
    if (result.kind === 'in_progress') return context.json({ error: 'in_progress' }, 409);
    if (result.kind === 'invalid_flow') return context.json({ error: 'invalid_flow' }, 401);
    if (result.kind === 'flow_expired') {
      clearBindingCookie(context);
      return context.json({ error: 'flow_expired' }, 401);
    }
    clearBindingCookie(context);
    if (result.kind === 'owner_only') return context.json({ error: 'owner_only' }, 403);
    if (result.kind === 'unavailable') return context.json({ error: 'plex_unavailable' }, 503);
    setCookie(context, sessionCookieName, result.session, { ...cookieOptions, maxAge: SESSION_LIFETIME_SECONDS });
    return context.json({ expiresAt: result.expiresAt });
  });

  app.post('/auth/cancel', requireBrowserPost, async (context) => {
    if (await readExactJson(context, []) === undefined) return context.json({ error: 'invalid_request' }, 400);
    const binding = readCookie(context.req.header('Cookie'), bindingCookieName);
    const session = readCookie(context.req.header('Cookie'), sessionCookieName);
    if (binding.kind === 'duplicate' || binding.kind === 'invalid' || session.kind === 'duplicate' || session.kind === 'invalid') {
      return context.json({ error: 'invalid_request' }, 400);
    }
    if (binding.kind === 'value') authentication.cancel(binding.value);
    clearBindingCookie(context);
    return context.body(null, 204);
  });

  app.post('/auth/logout', requireBrowserPost, async (context) => {
    if (await readExactJson(context, []) === undefined) return context.json({ error: 'invalid_request' }, 400);
    const binding = readCookie(context.req.header('Cookie'), bindingCookieName);
    const session = readCookie(context.req.header('Cookie'), sessionCookieName);
    if (binding.kind === 'duplicate' || binding.kind === 'invalid' || session.kind === 'duplicate' || session.kind === 'invalid') {
      return context.json({ error: 'invalid_request' }, 400);
    }
    authentication.logout(
      binding.kind === 'value' ? binding.value : undefined,
      session.kind === 'value' ? session.value : undefined,
    );
    clearBindingCookie(context);
    clearSessionCookie(context);
    return context.body(null, 204);
  });

  // The answers the four Jellyfin sign-in routes share for everything but success.
  const jellyfinRefusal = (context: Context, result: JellyfinSignInResult | JellyfinQuickConnectStartResult) => {
    switch (result.kind) {
      case 'not_configured': return context.json({ error: 'not_configured' }, 503);
      case 'invalid_url': return context.json({ error: 'invalid_request' }, 400);
      case 'owner_exists': return context.json({ error: 'owner_exists' }, 409);
      case 'rate_limited':
        context.header('Retry-After', String(result.retryAfter));
        return context.json({ error: 'rate_limited' }, 429);
      case 'refused': return context.json({ error: 'refused' }, 401);
      case 'not_administrator': return context.json({ error: 'not_administrator', userName: result.userName, serverName: result.serverName }, 403);
      case 'owner_only': return context.json({ error: 'owner_only' }, 403);
      case 'off': return context.json({ error: 'quick_connect_off' }, 409);
      case 'pending': return context.json({ status: 'pending' }, 202);
      case 'in_progress': return context.json({ error: 'in_progress' }, 409);
      case 'invalid_flow': return context.json({ error: 'invalid_flow' }, 401);
      case 'flow_expired': return context.json({ error: 'flow_expired' }, 401);
      default: return context.json({ error: 'jellyfin_unavailable' }, 503);
    }
  };

  app.post('/auth/jellyfin/check', requireBrowserPost, async (context) => {
    const body = await readExactJson(context, ['url']);
    if (body === undefined || typeof body.url !== 'string') return context.json({ error: 'invalid_request' }, 400);
    const result = await authentication.jellyfinCheck(body.url, clientOf(context));
    if (result.kind === 'ok') return context.json({ kind: 'ok', url: result.url, serverName: result.serverName });
    if (result.kind === 'no_answer' || result.kind === 'not_jellyfin') return context.json({ kind: result.kind });
    return jellyfinRefusal(context, result);
  });

  // The address is sent only during first run; once a Jellyfin owner exists, or a Plex owner switches, the saved one is used.
  app.post('/auth/jellyfin/password', requireBrowserPost, async (context) => {
    const body = await readExactJson(context, ['url', 'username', 'password']) ?? await readExactJson(context, ['username', 'password']);
    if (
      body === undefined
      || (Object.hasOwn(body, 'url') && (typeof body.url !== 'string' || body.url === ''))
      || typeof body.username !== 'string' || body.username === ''
      || typeof body.password !== 'string' || body.password === ''
    ) return context.json({ error: 'invalid_request' }, 400);
    const session = readCookie(context.req.header('Cookie'), sessionCookieName);
    if (session.kind === 'duplicate' || session.kind === 'invalid') {
      clearSessionCookie(context);
      return context.json({ error: 'invalid_request' }, 400);
    }
    const result = await authentication.jellyfinPassword(
      body.url as string | undefined,
      body.username,
      body.password,
      clientOf(context),
      session.kind === 'value' ? session.value : undefined,
    );
    if (result.kind !== 'success') return jellyfinRefusal(context, result);
    setCookie(context, sessionCookieName, result.session, { ...cookieOptions, maxAge: SESSION_LIFETIME_SECONDS });
    return context.json({ expiresAt: result.expiresAt });
  });

  app.post('/auth/jellyfin/quick-connect', requireBrowserPost, async (context) => {
    const body = await readExactJson(context, ['url']) ?? await readExactJson(context, []);
    if (body === undefined || (Object.hasOwn(body, 'url') && typeof body.url !== 'string')) return context.json({ error: 'invalid_request' }, 400);
    const binding = readCookie(context.req.header('Cookie'), bindingCookieName);
    if (binding.kind === 'duplicate' || binding.kind === 'invalid') {
      clearBindingCookie(context);
      return context.json({ error: 'invalid_request' }, 400);
    }
    const session = readCookie(context.req.header('Cookie'), sessionCookieName);
    if (session.kind === 'duplicate' || session.kind === 'invalid') {
      clearSessionCookie(context);
      return context.json({ error: 'invalid_request' }, 400);
    }
    const result = await authentication.jellyfinQuickConnectStart(
      body.url as string | undefined,
      binding.kind === 'value' ? binding.value : undefined,
      clientOf(context),
      session.kind === 'value' ? session.value : undefined,
    );
    if (result.kind !== 'success') return jellyfinRefusal(context, result);
    setCookie(context, bindingCookieName, result.binding, {
      ...cookieOptions,
      maxAge: Math.max(1, Math.ceil((result.expiresAt - now()) / 1000)),
    });
    return context.json({ code: result.code, expiresAt: result.expiresAt }, 201);
  });

  app.post('/auth/jellyfin/quick-connect/complete', requireBrowserPost, async (context) => {
    if (await readExactJson(context, []) === undefined) return context.json({ error: 'invalid_request' }, 400);
    const binding = readCookie(context.req.header('Cookie'), bindingCookieName);
    if (binding.kind !== 'value') {
      clearBindingCookie(context);
      return context.json({ error: 'invalid_flow' }, 401);
    }
    const session = readCookie(context.req.header('Cookie'), sessionCookieName);
    if (session.kind === 'duplicate' || session.kind === 'invalid') {
      clearSessionCookie(context);
      return context.json({ error: 'invalid_flow' }, 401);
    }
    const result = await authentication.jellyfinQuickConnectComplete(binding.value, session.kind === 'value' ? session.value : undefined);
    if (result.kind === 'pending' || result.kind === 'in_progress' || result.kind === 'invalid_flow') return jellyfinRefusal(context, result);
    clearBindingCookie(context);
    if (result.kind !== 'success') return jellyfinRefusal(context, result);
    setCookie(context, sessionCookieName, result.session, { ...cookieOptions, maxAge: SESSION_LIFETIME_SECONDS });
    return context.json({ expiresAt: result.expiresAt });
  });

  for (const path of [
    '/auth/status', '/auth/start', '/auth/callback', '/auth/complete', '/auth/cancel', '/auth/logout',
    '/auth/jellyfin/check', '/auth/jellyfin/password', '/auth/jellyfin/quick-connect', '/auth/jellyfin/quick-connect/complete',
  ]) {
    app.all(path, (context) => context.json({ error: 'method_not_allowed' }, 405));
  }
  app.all('/auth', (context) => context.json({ error: 'not_found' }, 404));
  app.all('/auth/*', (context) => context.json({ error: 'not_found' }, 404));

  const webhookLimit = bodyLimit({
    maxSize: WEBHOOK_BODY_LIMIT,
    onError: (context) => context.json({ error: 'request_too_large' }, 413),
  });
  app.post('/webhooks/:service{sonarr|radarr}', webhookLimit, async (context) => {
    const secret = options.webhooks?.secret();
    if (options.webhooks === undefined || secret === undefined) return context.json({ error: 'not_configured' }, 503);
    if (!webhookPasswordMatches(context.req.header('Authorization'), secret)) {
      context.header('WWW-Authenticate', 'Basic realm="media-manager-2 webhooks"');
      return context.json({ error: 'unauthenticated' }, 401);
    }
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const result = options.webhooks.receive(context.req.param('service') as 'sonarr' | 'radarr', payload);
    if (result === 'invalid') return context.json({ error: 'invalid_request' }, 400);
    return context.body(null, 204);
  });
  app.all('/webhooks/*', (context) => context.json({ error: 'not_found' }, 404));

  const privateGuard: MiddlewareHandler<AppEnvironment> = async (context, next) => {
    const session = readCookie(context.req.header('Cookie'), sessionCookieName);
    if (session.kind !== 'value') {
      clearSessionCookie(context);
      return context.json({ error: 'unauthenticated' }, 401);
    }
    const validated = authentication.validateSession(session.value);
    if (validated.kind !== 'success') {
      clearSessionCookie(context);
      return context.json({ error: validated.kind === 'expired' ? 'session_expired' : 'unauthenticated' }, 401);
    }
    context.set('sessionExpiresAt', validated.expiresAt);
    context.set('sessionToken', session.value);
    context.set('plexSignInToken', authentication.plexToken(session.value));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)) return requireBrowserPost(context, next);
    return next();
  };

  app.use('/api', privateGuard);
  app.use('/api/*', privateGuard);
  app.post('/api/metrics', async (context) => {
    const batch: unknown = await context.req.json().catch(() => undefined);
    if (!Array.isArray(batch) || batch.length > 50 || !batch.every(validMetric)) return context.json({ error: 'invalid_request' }, 400);
    for (const item of batch) logEvent('web', item);
    return context.body(null, 204);
  });
  app.get('/api/session', (context) => context.json({
    expiresAt: context.get('sessionExpiresAt'),
    serverNow: now(),
    mediaServer: effectiveOwner(options.database, options.ownerPlexId)?.provider ?? 'plex',
  }));
  let openStreams = 0;
  app.get('/api/events', (context) => {
    if (context.req.method !== 'GET') return context.json({ error: 'method_not_allowed' }, 405);
    if (openStreams >= MAX_STREAMS) return context.json({ error: 'too_many_streams' }, 503);
    openStreams += 1;
    return streamSSE(context, async (stream) => {
      const token = context.get('sessionToken');
      let finished = false;
      let closed!: () => void;
      const done = new Promise<void>((resolve) => { closed = resolve; });
      const finish = () => {
        if (finished) return;
        finished = true;
        unsubscribe();
        timers.clearInterval(keepalive);
        openStreams -= 1;
        closed();
      };
      const valid = () => {
        if (authentication.validateSession(token).kind === 'success') return true;
        finish();
        return false;
      };
      stream.onAbort(finish);
      const unsubscribe = events.subscribe((event) => {
        if (!valid()) return;
        void stream.writeSSE({ id: String(event.id), event: event.type, data: JSON.stringify(event.data) });
      });
      const keepalive = timers.setInterval(() => {
        if (valid()) void stream.write(': keepalive\n\n');
      }, KEEPALIVE_MS);
      await done;
    });
  });
  if (options.search !== undefined) app.route('/api/search', createSearchRoutes(options.search));
  if (options.add !== undefined) app.route('/api/add', createAddRoutes(options.add));
  if (options.releases !== undefined) app.route('/api/releases', createReleaseRoutes(options.releases));
  if (options.grabs !== undefined) app.route('/api/grabs', createGrabRoutes(options.grabs));
  if (options.secondVersions !== undefined) app.route('/api/second-versions', createSecondVersionRoutes(options.secondVersions, options.secondVersionDelete));
  if (options.owned !== undefined) app.route('/api/owned', createOwnedRoutes(options.owned));
  if (options.protection !== undefined) app.route('/api/protected', createProtectionRoutes(options.protection));
  if (options.library !== undefined) app.route('/api/library', createLibraryRoutes(options.library));
  if (options.titleDelete !== undefined) app.route('/api/library', createTitleDeleteRoutes(options.titleDelete));
  if (options.tmdbTitles !== undefined) app.route('/api/library', createTmdbTitleRoutes(options.tmdbTitles));
  if (options.discover !== undefined) app.route('/api/discover', createDiscoverRoutes(options.discover));
  if (options.images !== undefined) app.route('/api/images', options.images);
  if (options.cache !== undefined) app.route('/api/cache', options.cache);
  if (options.setup !== undefined) app.route('/api/setup', options.setup);
  if (options.api !== undefined) app.route('/api', options.api);
  app.all('/api', (context) => context.json({ error: 'not_found' }, 404));
  app.all('/api/*', (context) => context.json({ error: 'not_found' }, 404));

  app.on(['GET', 'HEAD'], '*', staticFiles);
  app.on(['GET', 'HEAD'], '*', async (context, next) => {
    const path = context.req.path;
    if (acceptsHtml(context.req.header('Accept')) && !extname(path) && path !== '/assets' && !path.startsWith('/assets/')) {
      return applicationDocument(context, next);
    }
    return context.notFound();
  });
  app.notFound((context) => context.text('Not Found', 404));

  return app;
};
