import { extname, isAbsolute } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { deleteCookie, setCookie } from 'hono/cookie';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { createAuthentication } from './auth.js';
import { createEventHub, type EventHub } from './events.js';
import { globalTimers, type Timers } from './jobs.js';
import { createAddRoutes, type Add } from './add.js';
import { createReleaseRoutes, type Releases } from './releases.js';
import { createSearchRoutes, type Search } from './search.js';

export type CreateAppOptions = {
  clientDirectory: string;
  listeningHost: string;
  ownerPlexId?: string;
  publicOrigin?: string;
  now?: () => number;
  fetch?: typeof globalThis.fetch;
  events?: EventHub;
  timers?: Timers;
  search?: Search;
  add?: Add;
  releases?: Releases;
};

type AppEnvironment = {
  Variables: {
    sessionExpiresAt: number;
    sessionToken: string;
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

export const createApp = (options: CreateAppOptions) => {
  if (!isAbsolute(options.clientDirectory)) throw new TypeError('clientDirectory must be absolute.');
  const now = options.now ?? Date.now;
  const events = options.events ?? createEventHub();
  const timers = options.timers ?? globalTimers;
  const authentication = createAuthentication({
    listeningHost: options.listeningHost,
    ownerPlexId: options.ownerPlexId,
    publicOrigin: options.publicOrigin,
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

  const clearSessionCookie = (context: Context) => {
    deleteCookie(context, sessionCookieName, cookieOptions);
  };
  const clearBindingCookie = (context: Context) => {
    deleteCookie(context, bindingCookieName, cookieOptions);
  };

  app.use('*', async (context, next) => {
    await next();
    context.header('Cache-Control', 'no-store');
    context.header('Referrer-Policy', 'no-referrer');
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('X-Frame-Options', 'DENY');
  });

  const requestLimit = bodyLimit({
    maxSize: 1_024,
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
    const result = await authentication.start(binding.kind === 'value' ? binding.value : undefined);
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

  for (const path of ['/auth/status', '/auth/start', '/auth/callback', '/auth/complete', '/auth/cancel', '/auth/logout']) {
    app.all(path, (context) => context.json({ error: 'method_not_allowed' }, 405));
  }
  app.all('/auth', (context) => context.json({ error: 'not_found' }, 404));
  app.all('/auth/*', (context) => context.json({ error: 'not_found' }, 404));

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
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)) return requireBrowserPost(context, next);
    return next();
  };

  app.use('/api', privateGuard);
  app.use('/api/*', privateGuard);
  app.get('/api/session', (context) => context.json({ expiresAt: context.get('sessionExpiresAt'), serverNow: now() }));
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
