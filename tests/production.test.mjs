import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { once } from 'node:events';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const serverPath = fileURLToPath(new URL('../dist/server/index.js', import.meta.url));
const databaseModuleUrl = new URL('../dist/server/database.js', import.meta.url).href;
const appModuleUrl = new URL('../dist/server/app.js', import.meta.url).href;
const settingsModuleUrl = new URL('../dist/server/settings.js', import.meta.url).href;
const arrModuleUrl = new URL('../dist/server/services/arr.js', import.meta.url).href;
const rtorrentModuleUrl = new URL('../dist/server/services/rtorrent.js', import.meta.url).href;
const plexModuleUrl = new URL('../dist/server/services/plex.js', import.meta.url).href;
const cliPath = fileURLToPath(new URL('../dist/server/cli.js', import.meta.url));
const eventsModuleUrl = new URL('../dist/server/events.js', import.meta.url).href;
const jobsModuleUrl = new URL('../dist/server/jobs.js', import.meta.url).href;
const dependenciesModuleUrl = new URL('../dist/server/dependencies.js', import.meta.url).href;
const grabsModuleUrl = new URL('../dist/server/grabs.js', import.meta.url).href;
const problemsModuleUrl = new URL('../dist/server/problems.js', import.meta.url).href;
const apiModuleUrl = new URL('../dist/server/api.js', import.meta.url).href;
const torrentsModuleUrl = new URL('../dist/server/torrents.js', import.meta.url).href;
const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const clientDirectory = fileURLToPath(new URL('../dist/client/', import.meta.url));

const runNode = async (source, options = {}) => {
  const child = spawn(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const [code, signal] = await once(child, 'exit');
  return { code, signal, stdout, stderr };
};

const runCli = async (args, options = {}) => {
  const child = spawn(process.execPath, [cliPath, ...args], {
    env: options.env ?? process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.end(options.stdin);
  const [code, signal] = await once(child, 'close');
  return { code, signal, stdout, stderr };
};

const readUserVersion = (database) => database.prepare('PRAGMA user_version').get().user_version;

// Incorrect production file resolution or fallback routing prevents the built application from loading, or returns HTML for missing files.
test('production server serves the built browser application from another directory', async (t) => {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'media-manager-2-production-'));
  const databasePath = join(workingDirectory, 'data', 'media-manager.sqlite');
  const child = spawn(process.execPath, [serverPath], {
    cwd: workingDirectory,
    env: { ...process.env, DB_PATH: databasePath, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const killTimer = setTimeout(() => child.kill('SIGKILL'), 5_000);
      child.kill('SIGTERM');
      try {
        await exited;
      } finally {
        clearTimeout(killTimer);
      }
    }
    await rm(workingDirectory, { recursive: true, force: true });
  });

  const baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error(`Server did not listen within 10 seconds.\n${output}`)), 10_000);
    const finish = (error, url) => {
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
      if (error) reject(error);
      else resolve(url);
    };
    const onData = () => {
      const match = output.match(/Listening on (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) finish(null, match[1]);
    };
    const onExit = (code, signal) => finish(new Error(`Server exited before listening (code ${code}, signal ${signal}).\n${output}`));
    const onError = (error) => finish(error);
    child.stdout.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);
  });
  const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(5_000),
  });
  let applicationHtml;
  let assetPaths;

  // Starting production without database initialization leaves no durable settings file.
  await t.test('creates the configured database before listening', async () => {
    assert.equal((await stat(databasePath)).isFile(), true);
  });

  await t.test('GET / returns HTML referencing built JavaScript and CSS', async () => {
    const response = await request('/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    applicationHtml = await response.text();
    const script = applicationHtml.match(/<script\b[^>]*\bsrc="([^"]+\.js)"/);
    const stylesheet = applicationHtml.match(/<link\b[^>]*\bhref="([^"]+\.css)"/);
    assert.ok(script, 'HTML must reference built JavaScript');
    assert.ok(stylesheet, 'HTML must reference built CSS');
    assetPaths = [script[1], stylesheet[1]];
  });

  await t.test('referenced JavaScript and CSS return nonempty content with their content types', async () => {
    for (const [index, path] of assetPaths.entries()) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('content-type'), index === 0 ? /(?:text|application)\/javascript/ : /text\/css/);
      assert.ok((await response.text()).length > 0, path);
    }
  });

  for (const path of ['/', '/smoke/nested']) {
    await t.test(`HEAD ${path} succeeds without a body`, async () => {
      const response = await request(path, { method: 'HEAD', headers: { Accept: 'text/html' } });
      assert.equal(response.status, 200);
      assert.equal(await response.text(), '');
    });
  }

  for (const accept of ['text/html', 'text/html;q=0.5']) {
    await t.test(`GET /smoke/nested accepting ${accept} returns the application document`, async () => {
      const response = await request('/smoke/nested', { headers: { Accept: accept } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      assert.equal(await response.text(), applicationHtml);
    });
  }

  for (const path of ['/assets/missing.js', '/package.json']) {
    for (const accept of ['*/*', 'text/html']) {
      await t.test(`GET ${path} accepting ${accept} returns 404`, async () => {
        const response = await request(path, { headers: { Accept: accept } });
        assert.equal(response.status, 404);
      });
    }
  }

  // Ignoring the HTML quality parameter returns the application document when q=0 rejects HTML.
  for (const accept of ['application/json', 'application/json, text/html;q=0']) {
    await t.test(`GET /smoke/nested accepting ${accept} returns 404`, async () => {
      const response = await request('/smoke/nested', { headers: { Accept: accept } });
      assert.equal(response.status, 404);
    });
  }

  await t.test('POST /smoke/nested returns 404', async () => {
    const response = await request('/smoke/nested', { method: 'POST', headers: { Accept: 'text/html' } });
    assert.equal(response.status, 404);
  });

  // Missing authorization must return JSON instead of exposing the application document through the private prefix.
  await t.test('GET /api/session without a cookie returns 401 JSON', async () => {
    const response = await request('/api/session', { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), { error: 'unauthenticated' });
  });

  // Removing the signal handler or failing to close the HTTP server leaves SIGTERM exiting by signal instead of code 0.
  await t.test('SIGTERM exits with code 0', async () => {
    child.kill('SIGTERM');
    const [code, signal] = await once(child, 'exit', { signal: AbortSignal.timeout(5_000) }); // real-time-ok: ceiling on process exit, not a fixed wait
    assert.equal(code, 0);
    assert.equal(signal, null);
  });
});

const jsonHeaders = (origin = 'https://media.example') => ({
  'Content-Type': 'application/json',
  Origin: origin,
  'X-Requested-With': 'media-manager-2',
});

const responseJson = (value, status = 200, headers) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', ...headers },
});

const responseCookies = (response) => response.headers.getSetCookie?.()
  ?? (response.headers.get('set-cookie')?.split(/,(?=\s*[^;,]+=)/) ?? []);

const cookieValue = (response, name) => {
  const cookie = responseCookies(response).find((value) => value.startsWith(`${name}=`));
  return cookie?.split(';', 1)[0];
};

const plexStateFromUrl = (url, expectedOrigin = 'https://media.example') => {
  const handoff = new URL(url);
  assert.equal(handoff.origin, 'https://app.plex.tv');
  assert.equal(handoff.pathname, '/auth');
  assert.ok(handoff.hash.startsWith('#?'));
  const parameters = new URLSearchParams(handoff.hash.slice(2));
  const forwardUrl = new URL(parameters.get('forwardUrl'));
  assert.equal(forwardUrl.origin, expectedOrigin);
  assert.equal(forwardUrl.pathname, '/auth/callback');
  return { parameters, state: forwardUrl.searchParams.get('state') };
};

const createPlexFixture = ({
  now,
  ownerId = 42,
  createStatus = 201,
  createBody,
  checkStatus = 200,
  checkBody,
  userStatus = 200,
  userBody,
  failAt,
  malformedAt,
  checkGate,
  createGate,
  userBodyGate,
} = {}) => {
  let nextPinId = 100;
  const attempts = new Map();
  const calls = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    calls.push({ url, init, headers });
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal, 'provider requests must carry a timeout signal');
    assert.equal(headers.get('accept'), 'application/json');
    assert.equal(headers.get('x-plex-product'), 'media-manager-2');
    assert.ok(headers.get('x-plex-client-identifier'));
    if (failAt === 'network') throw new TypeError('fixture network failure');

    if (url.href === 'https://clients.plex.tv/api/v2/pins') {
      if (createGate?.enabled) {
        createGate.enteredResolve();
        await createGate.wait;
      }
      assert.equal(init.method, 'POST');
      assert.equal(headers.get('content-type'), 'application/json');
      if (failAt === 'create-redirect') throw new TypeError('redirect mode rejected the response');
      const body = JSON.parse(init.body);
      assert.deepEqual(Object.keys(body).sort(), ['jwk', 'strong']);
      assert.equal(body.strong, true);
      assert.deepEqual(Object.keys(body.jwk).sort(), ['alg', 'crv', 'kid', 'kty', 'x']);
      assert.equal(body.jwk.kty, 'OKP');
      assert.equal(body.jwk.crv, 'Ed25519');
      assert.equal(body.jwk.alg, 'EdDSA');
      assert.ok(body.jwk.kid);
      assert.ok(body.jwk.x);
      assert.equal(body.jwk.d, undefined);
      const publicKey = createPublicKey({ key: body.jwk, format: 'jwk' });
      const id = nextPinId++;
      attempts.set(String(id), {
        clientId: headers.get('x-plex-client-identifier'),
        jwk: body.jwk,
        publicKey,
      });
      const value = createBody ?? {
        id,
        code: `pin-${id}`,
        expiresAt: new Date(now() + 9 * 60_000).toISOString(),
      };
      if (malformedAt === 'create') return { status: createStatus, json: async () => { throw new SyntaxError('malformed fixture JSON'); } };
      return responseJson(value, createStatus);
    }

    if (url.origin === 'https://clients.plex.tv' && url.pathname.startsWith('/api/v2/pins/')) {
      if (checkGate) await checkGate.wait;
      assert.equal(init.method, 'GET');
      const id = url.pathname.split('/').at(-1);
      const attempt = attempts.get(id);
      assert.ok(attempt, 'PIN check must use an ID returned by PIN creation');
      assert.equal(headers.get('x-plex-client-identifier'), attempt.clientId);
      const compact = url.searchParams.get('deviceJWT');
      const parts = compact?.split('.') ?? [];
      assert.equal(parts.length, 3);
      const [encodedHeader, encodedPayload, encodedSignature] = parts;
      const jwtHeader = JSON.parse(Buffer.from(encodedHeader, 'base64url'));
      const jwtPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url'));
      assert.deepEqual(jwtHeader, { alg: 'EdDSA', kid: attempt.jwk.kid, typ: 'JWT' });
      assert.equal(jwtPayload.aud, 'plex.tv');
      assert.equal(jwtPayload.iss, attempt.clientId);
      assert.equal(jwtPayload.iat, Math.floor(now() / 1000));
      assert.equal(jwtPayload.exp, jwtPayload.iat + 60);
      const signed = Buffer.from(`${encodedHeader}.${encodedPayload}`, 'ascii');
      const signature = Buffer.from(encodedSignature, 'base64url');
      assert.equal(verify(null, signed, attempt.publicKey, signature), true);
      const changedPayload = `${encodedPayload.slice(0, -1)}${encodedPayload.endsWith('A') ? 'B' : 'A'}`;
      assert.equal(verify(null, Buffer.from(`${encodedHeader}.${changedPayload}`, 'ascii'), attempt.publicKey, signature), false);
      const { publicKey: wrongPublicKey } = generateKeyPairSync('ed25519');
      assert.equal(verify(null, signed, wrongPublicKey, signature), false);
      if (failAt === 'check-redirect') throw new TypeError('redirect mode rejected the response');
      if (failAt === 'check-network') throw new TypeError('fixture network failure');
      if (malformedAt === 'check') return { status: checkStatus, json: async () => { throw new SyntaxError('malformed fixture JSON'); } };
      return responseJson(checkBody ?? { authToken: 'plex-secret-token' }, checkStatus);
    }

    if (url.href === 'https://plex.tv/api/v2/user') {
      assert.equal(init.method, 'GET');
      assert.equal(headers.get('x-plex-token'), 'plex-secret-token');
      const checkCall = calls.filter((call) => call.url.origin === 'https://clients.plex.tv' && call.url.pathname.startsWith('/api/v2/pins/')).at(-1);
      assert.equal(headers.get('x-plex-client-identifier'), checkCall.headers.get('x-plex-client-identifier'));
      if (failAt === 'user-redirect') throw new TypeError('redirect mode rejected the response');
      if (failAt === 'user-network') throw new TypeError('fixture network failure');
      if (malformedAt === 'user') return { status: userStatus, json: async () => { throw new SyntaxError('malformed fixture JSON'); } };
      if (userBodyGate) {
        return {
          status: userStatus,
          json: async () => {
            userBodyGate.enteredResolve();
            await userBodyGate.wait;
            return userBody ?? { id: ownerId, restricted: false, anonymous: false };
          },
        };
      }
      return responseJson(userBody ?? { id: ownerId, restricted: false, anonymous: false }, userStatus);
    }

    throw new Error(`Unexpected provider request: ${url.href}`);
  };
  return { attempts, calls, fetch };
};

const makeApp = async (input = {}) => {
  const clock = input.clock ?? { value: 1_800_000_000_000 };
  const ownerPlexId = Object.hasOwn(input, 'ownerPlexId') ? input.ownerPlexId : '42';
  const publicOrigin = Object.hasOwn(input, 'publicOrigin') ? input.publicOrigin : 'https://media.example';
  const listeningHost = input.listeningHost ?? '127.0.0.1';
  const { fetch, fixtureOptions, events, timers, webhooks, api } = input;
  const { createApp } = await import(appModuleUrl);
  const now = () => clock.value;
  const fixture = fetch ? undefined : createPlexFixture({ now, ...fixtureOptions });
  const app = createApp({
    clientDirectory,
    listeningHost,
    ownerPlexId,
    publicOrigin,
    now,
    fetch: fetch ?? fixture.fetch,
    events,
    timers,
    webhooks,
    api,
  });
  return { app, clock, fixture };
};

const startAuthentication = async (app, { cookie, origin = 'https://media.example', body = {} } = {}) => {
  const response = await app.request('/auth/start', {
    method: 'POST',
    headers: { ...jsonHeaders(origin), ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { binding: cookieValue(response, '__Host-mm_plex') ?? cookieValue(response, 'mm_plex'), json, response };
};

const completeAuthentication = async (app, binding, state, { cookie, origin = 'https://media.example' } = {}) => app.request('/auth/complete', {
  method: 'POST',
  headers: { ...jsonHeaders(origin), Cookie: [binding, cookie].filter(Boolean).join('; ') },
  body: JSON.stringify({ state }),
});

const createFakeTimers = (clock) => {
  const handles = new Set();
  return {
    setInterval: (callback, ms) => {
      const handle = { callback, ms, remaining: ms };
      handles.add(handle);
      return handle;
    },
    clearInterval: (handle) => { handles.delete(handle); },
    advance: (elapsed) => {
      clock.value += elapsed;
      for (const handle of [...handles]) {
        handle.remaining -= elapsed;
        while (handle.remaining <= 0 && handles.has(handle)) {
          handle.remaining += handle.ms;
          handle.callback();
        }
      }
    },
  };
};

const signIn = async (app) => {
  const started = await startAuthentication(app);
  const completed = await completeAuthentication(app, started.binding, plexStateFromUrl(started.json.url).state);
  assert.equal(completed.status, 200);
  return { session: cookieValue(completed, '__Host-mm_session'), expiresAt: (await completed.json()).expiresAt };
};

const openStream = async (app, session) => {
  const response = await app.request('/api/events', { headers: { Cookie: session } });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const next = async () => {
    const { done, value } = await reader.read();
    return { done, text: value === undefined ? '' : decoder.decode(value) };
  };
  return { response, reader, next };
};

const drain = () => new Promise((resolve) => setImmediate(resolve));

// Weakening provider verification, cookie binding, expiry, or private-prefix routing must turn at least one case red.
test('Plex owner authentication', async (t) => {
  await t.test('owner success uses signed Plex requests and protects the private prefix', async () => {
    const { app, clock, fixture } = await makeApp();
    const status = await app.request('/auth/status');
    assert.deepEqual(await status.json(), { configured: true, pending: false });
    const started = await startAuthentication(app);
    assert.equal(started.response.status, 201);
    assert.match(started.binding, /^__Host-mm_plex=/);
    assert.match(responseCookies(started.response).join('\n'), /HttpOnly/i);
    assert.match(responseCookies(started.response).join('\n'), /SameSite=Lax/i);
    assert.match(responseCookies(started.response).join('\n'), /Secure/i);
    assert.match(responseCookies(started.response).join('\n'), /Path=\//i);
    const { parameters, state } = plexStateFromUrl(started.json.url);
    assert.equal(parameters.get('clientID'), fixture.calls[0].headers.get('x-plex-client-identifier'));
    assert.equal(parameters.get('code'), 'pin-100');
    assert.equal(parameters.get('context[device][product]'), 'media-manager-2');
    assert.ok(state);
    const pendingStatus = await app.request('/auth/status', { headers: { Cookie: started.binding } });
    assert.deepEqual(await pendingStatus.json(), { configured: true, pending: true });
    const callback = await app.request(`/auth/callback?state=${encodeURIComponent(state)}`);
    assert.equal(callback.status, 200);
    assert.match(callback.headers.get('content-type'), /text\/html/);
    const completed = await completeAuthentication(app, started.binding, state);
    assert.equal(completed.status, 200);
    assert.deepEqual(await completed.json(), { expiresAt: clock.value + 24 * 60 * 60_000 });
    const session = cookieValue(completed, '__Host-mm_session');
    assert.match(session, /^__Host-mm_session=/);
    const sessionSetCookie = responseCookies(completed).find((value) => value.startsWith('__Host-mm_session='));
    assert.match(sessionSetCookie, /HttpOnly/i);
    assert.match(sessionSetCookie, /SameSite=Lax/i);
    assert.match(sessionSetCookie, /Secure/i);
    assert.match(sessionSetCookie, /Path=\//i);
    assert.match(sessionSetCookie, /Max-Age=86400/i);
    assert.doesNotMatch(sessionSetCookie, /Domain=/i);
    assert.doesNotMatch(JSON.stringify([...fixture.attempts.values()]), /plex-secret-token/);
    assert.doesNotMatch(await callback.text(), /plex-secret-token|"42"/);
    const privateResponse = await app.request('/api/session', { headers: { Cookie: session, Accept: 'text/html' } });
    assert.equal(privateResponse.status, 200);
    // Omitting current server time prevents expiry scheduling independent of the browser clock.
    assert.deepEqual(await privateResponse.json(), { expiresAt: clock.value + 24 * 60 * 60_000, serverNow: clock.value });
    for (const path of ['/api', '/api/missing']) {
      const denied = await app.request(path, { headers: { Accept: 'text/event-stream' } });
      assert.equal(denied.status, 401);
      assert.deepEqual(await denied.json(), { error: 'unauthenticated' });
      const unknown = await app.request(path, { headers: { Cookie: session } });
      assert.equal(unknown.status, 404);
      assert.match(unknown.headers.get('content-type'), /application\/json/);
    }
    const unsafeForeign = await app.request('/api/missing', {
      method: 'POST',
      headers: { ...jsonHeaders('https://foreign.example'), Cookie: session },
      body: '{}',
    });
    assert.equal(unsafeForeign.status, 403);
    assert.deepEqual(await unsafeForeign.json(), { error: 'invalid_origin' });
    const unsafeOwner = await app.request('/api/missing', {
      method: 'POST',
      headers: { ...jsonHeaders(), Cookie: session },
      body: '{}',
    });
    assert.equal(unsafeOwner.status, 404);
    const oversized = await app.request('/api/missing', {
      method: 'POST',
      headers: { ...jsonHeaders(), Cookie: session },
      body: JSON.stringify({ value: 'x'.repeat(2_000) }),
    });
    assert.equal(oversized.status, 413);
  });

  await t.test('invalid configuration keeps the public document available', async () => {
    for (const options of [
      { ownerPlexId: undefined },
      { ownerPlexId: '0' },
      { ownerPlexId: '01' },
      { ownerPlexId: String(Number.MAX_SAFE_INTEGER + 1) },
      { publicOrigin: undefined },
      { publicOrigin: 'http://media.example' },
      { publicOrigin: 'https://user:pass@media.example' },
      { publicOrigin: 'https://media.example/path' },
      { publicOrigin: 'https://media.example?query=1' },
      { publicOrigin: 'https://media.example#fragment' },
      { publicOrigin: 'http://localhost:3000', listeningHost: '0.0.0.0' },
    ]) {
      const { app } = await makeApp(options);
      const status = await app.request('/auth/status');
      assert.deepEqual(await status.json(), { configured: false, pending: false }, JSON.stringify(options));
      const start = await startAuthentication(app, { origin: options.publicOrigin?.startsWith('http') ? new URL(options.publicOrigin).origin : undefined });
      assert.equal(start.response.status, 503, JSON.stringify(options));
      assert.deepEqual(start.json, { error: 'not_configured' });
      assert.equal((await app.request('/')).status, 200);
    }
  });

  await t.test('HTTP loopback uses local host-only cookie names', async () => {
    const { app } = await makeApp({ publicOrigin: 'http://127.0.0.1:3000' });
    const started = await startAuthentication(app, { origin: 'http://127.0.0.1:3000' });
    assert.equal(started.response.status, 201);
    assert.match(started.binding, /^mm_plex=/);
    assert.doesNotMatch(responseCookies(started.response).join('\n'), /; Secure/i);
    const state = plexStateFromUrl(started.json.url, 'http://127.0.0.1:3000').state;
    const completed = await completeAuthentication(app, started.binding, state, { origin: 'http://127.0.0.1:3000' });
    assert.equal(completed.status, 200);
    const sessionSetCookie = responseCookies(completed).find((value) => value.startsWith('mm_session='));
    assert.match(sessionSetCookie, /Max-Age=86400/i);
    assert.doesNotMatch(sessionSetCookie, /; Secure/i);
    assert.doesNotMatch(sessionSetCookie, /Domain=/i);
    assert.equal((await app.request('/api/session', { headers: { Cookie: '__Host-mm_session=foreign' } })).status, 401);
  });

  await t.test('origin, metadata, JSON, body, and return input checks run on authentication and private writes', async () => {
    const { app } = await makeApp();
    const invalidRequests = [
      { headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2' }, body: '{}' },
      { headers: jsonHeaders('null'), body: '{}' },
      { headers: jsonHeaders('https://foreign.example'), body: '{}' },
      { headers: { ...jsonHeaders(), 'Sec-Fetch-Site': 'cross-site' }, body: '{}' },
      { headers: { ...jsonHeaders(), 'Content-Type': 'text/plain' }, body: '{}' },
      { headers: { ...jsonHeaders(), 'X-Requested-With': 'other' }, body: '{}' },
    ];
    for (const request of invalidRequests) {
      const response = await app.request('/auth/start', { method: 'POST', ...request });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'invalid_origin' });
    }
    const extra = await startAuthentication(app, { body: { returnTo: 'https://attacker.example' } });
    assert.equal(extra.response.status, 400);
    assert.deepEqual(extra.json, { error: 'invalid_request' });
    const oversized = await app.request('/auth/start', {
      method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ value: 'x'.repeat(2_000) }),
    });
    assert.equal(oversized.status, 413);
    const forwarded = await app.request('/auth/start', {
      method: 'POST', headers: { ...jsonHeaders('https://foreign.example'), 'X-Forwarded-Host': 'media.example', 'X-Forwarded-Proto': 'https' }, body: '{}',
    });
    assert.equal(forwarded.status, 403);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const missingSession = await app.request('/api/missing', { method, headers: jsonHeaders(), body: '{}' });
      assert.equal(missingSession.status, 401);
    }
  });

  await t.test('state, browser binding, malformed cookies, replay, and PIN expiry are rejected', async () => {
    const { app, clock } = await makeApp();
    const first = await startAuthentication(app);
    const second = await startAuthentication(app);
    const firstState = plexStateFromUrl(first.json.url).state;
    const secondState = plexStateFromUrl(second.json.url).state;
    for (const [binding, state] of [[first.binding, secondState], [second.binding, firstState], [undefined, firstState]]) {
      const response = await completeAuthentication(app, binding, state);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'invalid_flow' });
    }
    assert.equal((await completeAuthentication(app, first.binding, firstState)).status, 401);
    assert.equal((await completeAuthentication(app, second.binding, secondState)).status, 401);

    const successful = await startAuthentication(app);
    const successfulState = plexStateFromUrl(successful.json.url).state;
    const malformed = await completeAuthentication(app, 'bad-cookie', successfulState);
    assert.equal(malformed.status, 401);
    const duplicate = await app.request('/auth/complete', {
      method: 'POST', headers: { ...jsonHeaders(), Cookie: `${successful.binding}; ${successful.binding}` }, body: JSON.stringify({ state: successfulState }),
    });
    assert.equal(duplicate.status, 401);
    const success = await completeAuthentication(app, successful.binding, successfulState);
    assert.equal(success.status, 200);
    const replay = await completeAuthentication(app, successful.binding, successfulState);
    assert.equal(replay.status, 401);
    const expiring = await startAuthentication(app);
    const expiringState = plexStateFromUrl(expiring.json.url).state;
    clock.value += 9 * 60_000;
    const expired = await completeAuthentication(app, expiring.binding, expiringState);
    assert.equal(expired.status, 401);
    assert.deepEqual(await expired.json(), { error: 'flow_expired' });
  });

  await t.test('pending and concurrent PIN completion retain the attempt', async () => {
    const gate = {};
    gate.wait = new Promise((resolve) => { gate.resolve = resolve; });
    const { app } = await makeApp({ fixtureOptions: { checkGate: gate, checkBody: { authToken: null } } });
    const started = await startAuthentication(app);
    const state = plexStateFromUrl(started.json.url).state;
    const first = completeAuthentication(app, started.binding, state);
    await Promise.resolve();
    const concurrent = await completeAuthentication(app, started.binding, state);
    assert.equal(concurrent.status, 409);
    assert.deepEqual(await concurrent.json(), { error: 'in_progress' });
    gate.resolve();
    const pending = await first;
    assert.equal(pending.status, 202);
    assert.deepEqual(await pending.json(), { status: 'pending' });
    const status = await app.request('/auth/status', { headers: { Cookie: started.binding } });
    assert.deepEqual(await status.json(), { configured: true, pending: true });
  });

  await t.test('cancel, restart, and logout prevent late provider results from creating sessions', async () => {
    for (const action of ['cancel', 'restart', 'logout']) {
      const gate = {};
      gate.wait = new Promise((resolve) => { gate.resolve = resolve; });
      const { app } = await makeApp({ fixtureOptions: { checkGate: gate } });
      const started = await startAuthentication(app);
      const state = plexStateFromUrl(started.json.url).state;
      const completing = completeAuthentication(app, started.binding, state);
      await Promise.resolve();
      if (action === 'restart') {
        const replacement = await startAuthentication(app, { cookie: started.binding });
        assert.equal(replacement.response.status, 201);
      } else {
        const response = await app.request(`/auth/${action}`, {
          method: 'POST', headers: { ...jsonHeaders(), Cookie: started.binding }, body: '{}',
        });
        assert.equal(response.status, 204);
      }
      gate.resolve();
      const late = await completing;
      assert.equal(late.status, 401);
      assert.deepEqual(await late.json(), { error: 'invalid_flow' });
      assert.equal((await app.request('/api/session')).status, 401);
    }

    const userBodyGate = {};
    userBodyGate.entered = new Promise((resolve) => { userBodyGate.enteredResolve = resolve; });
    userBodyGate.wait = new Promise((resolve) => { userBodyGate.resolve = resolve; });
    const { app } = await makeApp({ fixtureOptions: { userBodyGate } });
    const started = await startAuthentication(app);
    const completing = completeAuthentication(app, started.binding, plexStateFromUrl(started.json.url).state);
    await userBodyGate.entered;
    const cancelled = await app.request('/auth/cancel', {
      method: 'POST', headers: { ...jsonHeaders(), Cookie: started.binding }, body: '{}',
    });
    assert.equal(cancelled.status, 204);
    userBodyGate.resolve();
    const late = await completing;
    assert.equal(late.status, 401);
    assert.deepEqual(await late.json(), { error: 'invalid_flow' });
  });

  await t.test('owner identity must be a matching unrestricted Plex account ID', async () => {
    for (const userBody of [
      { id: 41, restricted: false, anonymous: false },
      { id: 42, restricted: true, anonymous: false },
      { id: 42, restricted: false, anonymous: true },
      { id: '42', restricted: false, anonymous: false },
      { id: 0, restricted: false, anonymous: false },
      { id: Number.MAX_SAFE_INTEGER + 1, restricted: false, anonymous: false },
      { username: 'owner', email: 'owner@example.test' },
    ]) {
      const { app } = await makeApp({ fixtureOptions: { userBody } });
      const started = await startAuthentication(app);
      const completed = await completeAuthentication(app, started.binding, plexStateFromUrl(started.json.url).state);
      assert.equal(completed.status, 403, JSON.stringify(userBody));
      assert.deepEqual(await completed.json(), { error: 'owner_only' });
    }
  });

  await t.test('provider failures and malformed responses never create sessions or expose upstream data', async () => {
    const cases = [
      { fixtureOptions: { createStatus: 500 }, phase: 'start' },
      { fixtureOptions: { createBody: { id: 1, code: 'code' } }, phase: 'start' },
      { fixtureOptions: { createBody: { id: 'bad', code: 'code', expiresAt: new Date(1_900_000_000_000).toISOString() } }, phase: 'start' },
      { fixtureOptions: { malformedAt: 'create' }, phase: 'start' },
      { fixtureOptions: { failAt: 'create-redirect' }, phase: 'start' },
      { fixtureOptions: { failAt: 'network' }, phase: 'start' },
      { fixtureOptions: { checkStatus: 500 }, phase: 'complete' },
      { fixtureOptions: { checkBody: { authToken: 42 } }, phase: 'complete' },
      { fixtureOptions: { malformedAt: 'check' }, phase: 'complete' },
      { fixtureOptions: { failAt: 'check-redirect' }, phase: 'complete' },
      { fixtureOptions: { failAt: 'check-network' }, phase: 'complete' },
      { fixtureOptions: { userStatus: 500 }, phase: 'complete' },
      { fixtureOptions: { malformedAt: 'user' }, phase: 'complete' },
      { fixtureOptions: { failAt: 'user-redirect' }, phase: 'complete' },
      { fixtureOptions: { failAt: 'user-network' }, phase: 'complete' },
    ];
    for (const entry of cases) {
      const { app } = await makeApp({ fixtureOptions: entry.fixtureOptions });
      const started = await startAuthentication(app);
      if (entry.phase === 'start') {
        assert.equal(started.response.status, 503);
        assert.deepEqual(started.json, { error: 'plex_unavailable' });
        assert.doesNotMatch(JSON.stringify(started.json), /secret|clients\.plex|plex\.tv/i);
      } else {
        assert.equal(started.response.status, 201);
        const completed = await completeAuthentication(app, started.binding, plexStateFromUrl(started.json.url).state);
        assert.equal(completed.status, 503);
        const body = await completed.json();
        assert.deepEqual(body, { error: 'plex_unavailable' });
        assert.doesNotMatch(JSON.stringify(body), /secret|clients\.plex|plex\.tv/i);
      }
    }
  });

  await t.test('sessions rotate, expire absolutely, do not slide, and vanish with a new factory', async () => {
    const setup = await makeApp();
    const firstStart = await startAuthentication(setup.app);
    const firstComplete = await completeAuthentication(setup.app, firstStart.binding, plexStateFromUrl(firstStart.json.url).state);
    const firstSession = cookieValue(firstComplete, '__Host-mm_session');
    setup.clock.value += 60_000;
    const replacementStart = await startAuthentication(setup.app, { cookie: firstStart.binding });
    const replacementComplete = await completeAuthentication(
      setup.app,
      replacementStart.binding,
      plexStateFromUrl(replacementStart.json.url).state,
      { cookie: firstSession },
    );
    assert.equal(replacementComplete.status, 200);
    const replacementSession = cookieValue(replacementComplete, '__Host-mm_session');
    assert.notEqual(replacementSession, firstSession);
    assert.equal((await setup.app.request('/api/session', { headers: { Cookie: firstSession } })).status, 401);
    const expiry = setup.clock.value + 24 * 60 * 60_000;
    // Omitting current server time prevents expiry scheduling independent of the browser clock.
    for (const serverNow of [expiry - 60_000, expiry - 1]) {
      setup.clock.value = serverNow;
      const before = await setup.app.request('/api/session', { headers: { Cookie: replacementSession } });
      assert.equal(before.status, 200);
      assert.deepEqual(await before.json(), { expiresAt: expiry, serverNow });
    }
    setup.clock.value = expiry;
    const expired = await setup.app.request('/api/session', { headers: { Cookie: replacementSession } });
    assert.equal(expired.status, 401);
    assert.deepEqual(await expired.json(), { error: 'session_expired' });
    assert.match(responseCookies(expired).join('\n'), /Max-Age=0/i);
    const restarted = await makeApp({ clock: setup.clock });
    assert.equal((await restarted.app.request('/api/session', { headers: { Cookie: replacementSession } })).status, 401);
  });

  await t.test('logout revokes one browser while another owner session remains valid', async () => {
    const { app } = await makeApp();
    const sessions = [];
    for (let index = 0; index < 2; index += 1) {
      const started = await startAuthentication(app);
      const completed = await completeAuthentication(app, started.binding, plexStateFromUrl(started.json.url).state);
      assert.equal(completed.status, 200);
      sessions.push({ binding: started.binding, session: cookieValue(completed, '__Host-mm_session') });
    }
    assert.notEqual(sessions[0].session, sessions[1].session);
    const logout = await app.request('/auth/logout', {
      method: 'POST', headers: { ...jsonHeaders(), Cookie: `${sessions[0].binding}; ${sessions[0].session}` }, body: '{}',
    });
    assert.equal(logout.status, 204);
    assert.equal((await app.request('/api/session', { headers: { Cookie: sessions[0].session } })).status, 401);
    assert.equal((await app.request('/api/session', { headers: { Cookie: sessions[1].session } })).status, 200);
    const again = await app.request('/auth/logout', { method: 'POST', headers: jsonHeaders(), body: '{}' });
    assert.equal(again.status, 204);
  });

  // Acknowledging ambiguous cancellation or sign-out as successful must fail without changing either browser credential.
  await t.test('cancel and logout reject ambiguous cookies before changing sessions or attempts', async () => {
    for (const [origin, prefix] of [['https://media.example', '__Host-'], ['http://127.0.0.1:3000', '']]) {
      for (const path of ['/auth/cancel', '/auth/logout']) {
        for (const name of ['mm_plex', 'mm_session']) {
          for (const invalidKind of ['equal duplicates', 'different duplicates', 'malformed value']) {
            const { app } = await makeApp({ publicOrigin: origin });
            const started = await startAuthentication(app, { origin });
            const state = plexStateFromUrl(started.json.url, origin).state;
            const completed = await completeAuthentication(app, started.binding, state, { origin });
            assert.equal(completed.status, 200);
            const session = cookieValue(completed, `${prefix}mm_session`);
            const pending = await startAuthentication(app, { origin });
            assert.equal(pending.response.status, 201);
            const cookies = [pending.binding, session];
            const cookieName = `${prefix}${name}`;
            const original = cookies.find((cookie) => cookie.startsWith(`${cookieName}=`));
            const invalid = invalidKind === 'malformed value'
              ? `${cookieName}=%not-valid`
              : `${original}; ${invalidKind === 'equal duplicates' ? original : `${cookieName}=${'A'.repeat(43)}`}`;
            const ambiguous = cookies.map((cookie) => cookie === original ? invalid : cookie).join('; ');
            const rejected = await app.request(path, {
              method: 'POST', headers: { ...jsonHeaders(origin), Cookie: ambiguous }, body: '{}',
            });
            assert.equal(rejected.status, 400, `${path}: ${cookieName}: ${invalidKind}`);
            assert.deepEqual(await rejected.json(), { error: 'invalid_request' });
            assert.deepEqual(responseCookies(rejected), []);
            assert.equal((await app.request('/api/session', { headers: { Cookie: session } })).status, 200);
            const status = await app.request('/auth/status', { headers: { Cookie: pending.binding } });
            assert.deepEqual(await status.json(), { configured: true, pending: true });
            const retried = await app.request(path, {
              method: 'POST', headers: { ...jsonHeaders(origin), Cookie: cookies.join('; ') }, body: '{}',
            });
            assert.equal(retried.status, 204);
            const after = await app.request('/auth/status', { headers: { Cookie: pending.binding } });
            assert.deepEqual(await after.json(), { configured: true, pending: false });
            assert.equal((await app.request('/api/session', { headers: { Cookie: session } })).status, path === '/auth/logout' ? 401 : 200);
          }
        }
        const { app } = await makeApp({ publicOrigin: origin });
        for (const cookie of [undefined, `${prefix}mm_plex=${'A'.repeat(43)}; ${prefix}mm_session=${'B'.repeat(43)}`]) {
          const response = await app.request(path, {
            method: 'POST', headers: { ...jsonHeaders(origin), ...(cookie ? { Cookie: cookie } : {}) }, body: '{}',
          });
          assert.equal(response.status, 204);
        }
      }
    }
  });

  await t.test('forged, malformed, and duplicate session cookies are rejected and cleared', async () => {
    const { app } = await makeApp();
    for (const cookie of [
      '__Host-mm_session=forged',
      '__Host-mm_session=%not-valid',
      '__Host-mm_session=one; __Host-mm_session=two',
      'mm_session=local-name-on-https',
    ]) {
      const response = await app.request('/api/session', { headers: { Cookie: cookie } });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'unauthenticated' });
      assert.match(responseCookies(response).join('\n'), /__Host-mm_session=;|Max-Age=0/i);
    }
  });

  await t.test('rate limits starts at the boundary and accepts starts after one minute', async () => {
    const { app, clock } = await makeApp();
    for (let index = 0; index < 10; index += 1) {
      assert.equal((await startAuthentication(app)).response.status, 201);
    }
    const limited = await startAuthentication(app);
    assert.equal(limited.response.status, 429);
    assert.deepEqual(limited.json, { error: 'rate_limited' });
    assert.ok(Number(limited.response.headers.get('retry-after')) >= 1);
    clock.value += 60_000;
    assert.equal((await startAuthentication(app)).response.status, 201);
  });

  await t.test('pending-attempt capacity refuses excess and removes expired attempts first', async () => {
    const createGate = { enabled: true, entered: 0, waiters: [] };
    createGate.enteredResolve = () => {
      createGate.entered += 1;
      const ready = createGate.waiters.filter(({ count }) => createGate.entered >= count);
      createGate.waiters = createGate.waiters.filter(({ count }) => createGate.entered < count);
      for (const { resolve } of ready) resolve();
    };
    createGate.waitFor = (count) => createGate.entered >= count
      ? Promise.resolve()
      : new Promise((resolve) => createGate.waiters.push({ count, resolve }));
    createGate.wait = new Promise((resolve) => { createGate.resolve = resolve; });
    const { app, clock } = await makeApp({ fixtureOptions: { createGate } });
    const reserved = [];
    for (let minute = 0; minute < 10; minute += 1) {
      for (let index = 0; index < 10; index += 1) reserved.push(startAuthentication(app));
      await createGate.waitFor((minute + 1) * 10);
      clock.value += 60_000;
    }
    const full = await startAuthentication(app);
    assert.equal(full.response.status, 503);
    assert.deepEqual(full.json, { error: 'plex_unavailable' });
    createGate.resolve();
    const created = await Promise.all(reserved);
    assert.equal(created.filter(({ response }) => response.status === 201).length, 100);
    createGate.enabled = false;
    clock.value += 10 * 60_000;
    assert.equal((await startAuthentication(app)).response.status, 201);
  });

  await t.test('session capacity refuses excess and removes expired sessions first', async () => {
    const { app, clock } = await makeApp();
    for (let index = 0; index < 100; index += 1) {
      if (index > 0 && index % 10 === 0) clock.value += 60_000;
      const started = await startAuthentication(app);
      assert.equal(started.response.status, 201, String(index));
      const completed = await completeAuthentication(app, started.binding, plexStateFromUrl(started.json.url).state);
      assert.equal(completed.status, 200, String(index));
    }
    clock.value += 60_000;
    const excessStart = await startAuthentication(app);
    const excess = await completeAuthentication(app, excessStart.binding, plexStateFromUrl(excessStart.json.url).state);
    assert.equal(excess.status, 503);
    assert.deepEqual(await excess.json(), { error: 'plex_unavailable' });
    clock.value += 24 * 60 * 60_000;
    const afterExpiryStart = await startAuthentication(app);
    const afterExpiry = await completeAuthentication(app, afterExpiryStart.binding, plexStateFromUrl(afterExpiryStart.json.url).state);
    assert.equal(afterExpiry.status, 200);
  });

  await t.test('all public authentication methods reject unsupported shapes without effects', async () => {
    const { app } = await makeApp();
    for (const path of ['/auth/start', '/auth/complete', '/auth/cancel', '/auth/logout']) {
      const get = await app.request(path);
      assert.equal(get.status, 405, path);
    }
    for (const path of ['/auth/status', '/auth/callback']) {
      const post = await app.request(path, { method: 'POST', headers: jsonHeaders(), body: '{}' });
      assert.equal(post.status, 405, path);
    }
    assert.equal((await app.request('/auth/unknown')).status, 404);
    const malformed = await app.request('/auth/complete', { method: 'POST', headers: jsonHeaders(), body: '{' });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'invalid_request' });
    const duplicateState = await app.request('/auth/complete', {
      method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ state: 'one', other: 'two' }),
    });
    assert.equal(duplicateState.status, 400);
    for (const path of ['/auth/cancel', '/auth/logout']) {
      const nonempty = await app.request(path, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ value: true }) });
      assert.equal(nonempty.status, 400);
    }
  });

  await t.test('authentication and application responses carry browser security headers', async () => {
    const { app } = await makeApp();
    for (const response of [await app.request('/'), await app.request('/auth/status'), await app.request('/api/session')]) {
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
    }
  });
});

test('event stream delivery', async (t) => {
  const setup = async () => {
    const clock = { value: 1_800_000_000_000 };
    const events = (await import(eventsModuleUrl)).createEventHub();
    const timers = createFakeTimers(clock);
    const { app } = await makeApp({ clock, events, timers });
    return { app, clock, events, timers };
  };
  const logout = (app, session) => app.request('/auth/logout', {
    method: 'POST', headers: { ...jsonHeaders(), Cookie: session }, body: '{}',
  });

  // Registering the stream route outside the owner guard, or letting HEAD open a stream, turns this red.
  await t.test('unauthenticated, expired and revoked sessions get 401 JSON and HEAD gets 405 before any stream', async () => {
    const { app, clock } = await setup();
    const anonymous = await app.request('/api/events');
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await anonymous.json(), { error: 'unauthenticated' });
    const revoked = await signIn(app);
    assert.equal((await logout(app, revoked.session)).status, 204);
    const afterLogout = await app.request('/api/events', { headers: { Cookie: revoked.session } });
    assert.equal(afterLogout.status, 401);
    assert.deepEqual(await afterLogout.json(), { error: 'unauthenticated' });
    const { session } = await signIn(app);
    const head = await app.request('/api/events', { method: 'HEAD', headers: { Cookie: session } });
    assert.equal(head.status, 405);
    clock.value += 24 * 60 * 60_000;
    const expired = await app.request('/api/events', { headers: { Cookie: session } });
    assert.equal(expired.status, 401);
    assert.deepEqual(await expired.json(), { error: 'session_expired' });
  });

  // Changing the event, data or id framing, or dropping the stream route, turns this red.
  await t.test('an owner session receives published events with id, event and data framing', async () => {
    const { app, events } = await setup();
    const { session } = await signIn(app);
    const { response, reader, next } = await openStream(app, session);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/event-stream/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(events.publish('demo', { value: 1 }), 1);
    assert.equal((await next()).text, 'event: demo\ndata: {"value":1}\nid: 1\n\n');
    assert.equal(events.publish('demo', [2]), 2);
    assert.equal((await next()).text, 'event: demo\ndata: [2]\nid: 2\n\n');
    await reader.cancel();
  });

  // Letting unserializable data reach the stream write turns this red.
  await t.test('publish refuses data that does not serialize and consumes no id', async () => {
    const { events } = await setup();
    assert.throws(() => events.publish('demo', undefined), TypeError);
    assert.throws(() => events.publish('demo', 1n), TypeError);
    assert.equal(events.publish('demo', 1), 1);
  });

  // Skipping session revalidation before an event write turns this red.
  await t.test('logout ends the stream before the next event and later events are not delivered', async () => {
    const { app, events } = await setup();
    const { session } = await signIn(app);
    const { next } = await openStream(app, session);
    events.publish('demo', 1);
    assert.match((await next()).text, /id: 1\n/);
    assert.equal((await logout(app, session)).status, 204);
    events.publish('demo', 2);
    assert.equal((await next()).done, true);
  });

  // Removing the keepalive, changing its 25-second period, or skipping revalidation at the keepalive turns this red.
  await t.test('keepalive comments are written every 25 seconds and expiry closes the stream at the next keepalive', async () => {
    const { app, clock, timers } = await setup();
    const { session, expiresAt } = await signIn(app);
    const { next } = await openStream(app, session);
    timers.advance(25_000);
    assert.equal((await next()).text, ': keepalive\n\n');
    timers.advance(25_000);
    assert.equal((await next()).text, ': keepalive\n\n');
    clock.value = expiresAt;
    timers.advance(25_000);
    assert.equal((await next()).done, true);
  });

  // Replaying earlier events to a new stream, or failing to deliver after a reconnect, turns this red.
  await t.test('a reconnecting browser receives only events published after it reconnects', async () => {
    const { app, events } = await setup();
    const { session } = await signIn(app);
    const first = await openStream(app, session);
    events.publish('demo', 1);
    assert.match((await first.next()).text, /id: 1\n/);
    await first.reader.cancel();
    const second = await openStream(app, session);
    events.publish('demo', 2);
    const { text } = await second.next();
    assert.match(text, /id: 2\n/);
    assert.doesNotMatch(text, /id: 1\n/);
    await second.reader.cancel();
  });

  // Removing the stream cap, or failing to release a slot when a client disconnects, turns this red.
  await t.test('the 21st concurrent stream is refused with 503 and a closed stream frees its slot', async () => {
    const { app } = await setup();
    const { session } = await signIn(app);
    const readers = [];
    for (let index = 0; index < 20; index += 1) {
      const { response, reader } = await openStream(app, session);
      assert.equal(response.status, 200, String(index));
      readers.push(reader);
    }
    const refused = await app.request('/api/events', { headers: { Cookie: session } });
    assert.equal(refused.status, 503);
    assert.match(refused.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await refused.json(), { error: 'too_many_streams' });
    await readers.shift().cancel();
    const { response, reader } = await openStream(app, session);
    assert.equal(response.status, 200);
    readers.push(reader);
    for (const open of readers) await open.cancel();
  });
});

test('background job runner', async (t) => {
  const { createJobRunner } = await import(jobsModuleUrl);
  const setup = () => {
    const timers = createFakeTimers({ value: 0 });
    return { timers, runner: createJobRunner(timers) };
  };
  const gate = () => {
    let open;
    const wait = new Promise((resolve) => { open = resolve; });
    return { wait, open };
  };

  // Running a job at start, or letting a second start add a second timer, turns this red.
  await t.test('runs each job once per interval after start, with no immediate run and no duplicate timer from a second start', async () => {
    const { timers, runner } = setup();
    let runs = 0;
    runner.register('a', 1000, () => { runs += 1; });
    runner.start();
    timers.advance(500);
    await drain();
    assert.equal(runs, 0);
    runner.start();
    timers.advance(500);
    await drain();
    assert.equal(runs, 1);
    timers.advance(500);
    await drain();
    assert.equal(runs, 1);
    timers.advance(500);
    await drain();
    assert.equal(runs, 2);
  });

  // Letting a tick start a run while the same job's previous run is unfinished turns this red.
  await t.test('skips a tick while the previous run is in flight', async () => {
    const { timers, runner } = setup();
    const blocked = gate();
    let runs = 0;
    runner.register('a', 1000, async () => {
      runs += 1;
      await blocked.wait;
    });
    runner.start();
    timers.advance(1000);
    await drain();
    assert.equal(runs, 1);
    timers.advance(1000);
    await drain();
    assert.equal(runs, 1);
    blocked.open();
    await drain();
    timers.advance(1000);
    await drain();
    assert.equal(runs, 2);
  });

  // Letting a job's exception escape the timer, or logging the error contents, turns this red.
  await t.test('a failing job is logged by name only and keeps its schedule', async (t) => {
    t.mock.method(console, 'error', () => {});
    const failures = [
      () => { throw new Error('secret-value'); },
      async () => { throw new Error('secret-value'); },
    ];
    for (const fail of failures) {
      const { timers, runner } = setup();
      let runs = 0;
      runner.register('risky', 1000, () => {
        runs += 1;
        return fail();
      });
      runner.start();
      timers.advance(1000);
      await drain();
      timers.advance(1000);
      await drain();
      assert.equal(runs, 2);
    }
    assert.ok(console.error.mock.calls.length >= 1);
    const logged = JSON.stringify(console.error.mock.calls.map((call) => call.arguments));
    assert.match(logged, /risky/);
    assert.doesNotMatch(logged, /secret-value/);
  });

  // Resolving stop before the in-flight run finishes, or leaving the old timer scheduled after stop, turns this red.
  await t.test('stop awaits the in-flight run, fires nothing afterwards, and start resumes the schedule', async () => {
    const { timers, runner } = setup();
    const blocked = gate();
    let runs = 0;
    runner.register('a', 1000, async () => {
      runs += 1;
      await blocked.wait;
    });
    runner.start();
    timers.advance(1000);
    await drain();
    assert.equal(runs, 1);
    let stopped = false;
    const stopping = runner.stop().then(() => { stopped = true; });
    await drain();
    assert.equal(stopped, false);
    blocked.open();
    await stopping;
    timers.advance(5000);
    await drain();
    assert.equal(runs, 1);
    runner.start();
    timers.advance(1000);
    await drain();
    assert.equal(runs, 2);
  });

  // Silently accepting a duplicate or late registration turns this red.
  await t.test('duplicate names and registering after start throw', () => {
    const { runner } = setup();
    runner.register('a', 1000, () => {});
    assert.throws(() => runner.register('a', 1000, () => {}), { message: 'Duplicate job: a' });
    runner.start();
    assert.throws(() => runner.register('b', 1000, () => {}), { message: 'Register jobs before start.' });
  });
});

// Removing initialization or deriving the default from the working directory loses durable storage.
test('database initialization is repeatable and its default path is stable', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-database-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const explicitPath = join(root, 'explicit', 'media-manager.sqlite');
  const { openDatabase } = await import(databaseModuleUrl);

  const first = openDatabase(explicitPath);
  const initialized = readUserVersion(first);
  assert.ok(initialized >= 1);
  first.close();
  const second = openDatabase(explicitPath);
  assert.equal(readUserVersion(second), initialized);
  second.close();

  const home = join(root, 'home');
  const firstWorkingDirectory = join(root, 'one');
  const secondWorkingDirectory = join(root, 'two');
  await Promise.all([
    mkdir(firstWorkingDirectory),
    mkdir(secondWorkingDirectory),
  ]);
  const childEnvironment = { ...process.env, HOME: home };
  delete childEnvironment.DB_PATH;
  const source = `
    const { openDatabase } = await import(${JSON.stringify(databaseModuleUrl)});
    const database = openDatabase();
    console.log(database.prepare('PRAGMA database_list').all().find(({ name }) => name === 'main').file);
    database.close();
  `;
  const firstRun = await runNode(source, { cwd: firstWorkingDirectory, env: childEnvironment });
  const secondRun = await runNode(source, { cwd: secondWorkingDirectory, env: childEnvironment });
  assert.equal(firstRun.code, 0, firstRun.stderr);
  assert.equal(secondRun.code, 0, secondRun.stderr);
  const expectedPath = join(await realpath(home), '.local', 'share', 'media-manager-2', 'media-manager.sqlite');
  assert.equal(firstRun.stdout.trim(), expectedPath);
  assert.equal(secondRun.stdout.trim(), expectedPath);
});

// Replacing, deleting, or reopening settings must preserve the exact stored strings across processes.
test('settings persist across processes for every category', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-settings-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const databasePath = join(root, 'data', 'media-manager.sqlite');
  const values = {
    hostPaths: '/srv/media/Films',
    serviceAddresses: 'https://example.test/path?query="quoted"',
    trackerConfiguration: "ratio >= 1.5 and label = 'keep'",
    credentials: 'token-"double"-\'single\'',
  };
  const writer = `
    const { openDatabase } = await import(${JSON.stringify(databaseModuleUrl)});
    const { deleteSetting, getSetting, setSetting } = await import(${JSON.stringify(settingsModuleUrl)});
    const database = openDatabase(${JSON.stringify(databasePath)});
    const values = ${JSON.stringify(values)};
    for (const [category, value] of Object.entries(values)) setSetting(database, category, 'representative', value);
    setSetting(database, 'hostPaths', 'replace-me', 'old');
    setSetting(database, 'hostPaths', 'replace-me', 'new');
    setSetting(database, 'credentials', 'empty', '');
    setSetting(database, 'credentials', 'delete-me', 'temporary');
    deleteSetting(database, 'credentials', 'delete-me');
    deleteSetting(database, 'credentials', 'missing');
    if (getSetting(database, 'credentials', 'missing') !== undefined) process.exitCode = 2;
    database.close();
  `;
  const writeResult = await runNode(writer);
  assert.equal(writeResult.code, 0, writeResult.stderr);

  const reader = `
    const { openDatabase } = await import(${JSON.stringify(databaseModuleUrl)});
    const { getSetting } = await import(${JSON.stringify(settingsModuleUrl)});
    const database = openDatabase(${JSON.stringify(databasePath)});
    const result = {};
    for (const category of ${JSON.stringify(Object.keys(values))}) result[category] = getSetting(database, category, 'representative');
    result.replaced = getSetting(database, 'hostPaths', 'replace-me');
    result.empty = getSetting(database, 'credentials', 'empty');
    result.deleted = getSetting(database, 'credentials', 'delete-me') ?? null;
    result.missing = getSetting(database, 'credentials', 'missing') ?? null;
    console.log(JSON.stringify(result));
    database.close();
  `;
  const readResult = await runNode(reader);
  assert.equal(readResult.code, 0, readResult.stderr);
  assert.deepEqual(JSON.parse(readResult.stdout), {
    ...values,
    replaced: 'new',
    empty: '',
    deleted: null,
    missing: null,
  });
});

// Applying a later migration must retain settings while advancing the schema version.
test('a successful later migration preserves existing settings', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-migration-success-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const databasePath = join(root, 'media-manager.sqlite');
  const { migrateDatabase, openDatabase } = await import(databaseModuleUrl);
  const { getSetting, setSetting } = await import(settingsModuleUrl);
  const database = openDatabase(databasePath);
  setSetting(database, 'credentials', 'token', 'preserved');
  const current = readUserVersion(database);
  migrateDatabase(database, [...Array(current).fill('SELECT 1;'), 'CREATE TABLE later_record (id INTEGER PRIMARY KEY);']);
  assert.equal(readUserVersion(database), current + 1);
  assert.equal(getSetting(database, 'credentials', 'token'), 'preserved');
  assert.equal(database.prepare("SELECT name FROM sqlite_schema WHERE name = 'later_record'").get().name, 'later_record');
  database.close();
});

// A failed migration must roll back its data changes, schema changes, and version update together.
test('a failing later migration leaves the previous database unchanged', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-migration-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const databasePath = join(root, 'media-manager.sqlite');
  const { migrateDatabase, openDatabase } = await import(databaseModuleUrl);
  const { getSetting, setSetting } = await import(settingsModuleUrl);
  const database = openDatabase(databasePath);
  setSetting(database, 'credentials', 'token', 'original');
  const current = readUserVersion(database);
  assert.throws(
    () => migrateDatabase(database, [
      ...Array(current).fill('SELECT 1;'),
      "UPDATE settings SET value = 'changed'; CREATE TABLE partial_record (id INTEGER); INSERT INTO missing_table VALUES (1);",
    ]),
    { message: 'Database migration failed.' },
  );
  database.close();

  const reopened = openDatabase(databasePath);
  assert.equal(readUserVersion(reopened), current);
  assert.equal(getSetting(reopened, 'credentials', 'token'), 'original');
  assert.equal(reopened.prepare("SELECT name FROM sqlite_schema WHERE name = 'partial_record'").get(), undefined);
  reopened.close();
});

// Initialization must reject incompatible, corrupt, or locked databases without replacing their contents.
test('database initialization failures preserve existing files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-preserve-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { openDatabase } = await import(databaseModuleUrl);

  const futurePath = join(root, 'future.sqlite');
  const future = new DatabaseSync(futurePath);
  future.exec('CREATE TABLE future_record (value TEXT); INSERT INTO future_record VALUES (\'future\'); PRAGMA user_version = 99;');
  future.close();
  await chmod(futurePath, 0o600);
  assert.throws(() => openDatabase(futurePath), { message: 'Database schema version is newer than this application.' });
  const futureCheck = new DatabaseSync(futurePath);
  assert.equal(readUserVersion(futureCheck), 99);
  assert.equal(futureCheck.prepare('SELECT value FROM future_record').get().value, 'future');
  futureCheck.close();

  const unrelatedPath = join(root, 'unrelated.sqlite');
  const unrelated = new DatabaseSync(unrelatedPath);
  unrelated.exec("CREATE TABLE sqliteXunrelated (value TEXT); INSERT INTO sqliteXunrelated VALUES ('unrelated');");
  unrelated.close();
  await chmod(unrelatedPath, 0o600);
  assert.throws(() => openDatabase(unrelatedPath), { message: 'Database is not empty and cannot be initialized.' });
  const unrelatedCheck = new DatabaseSync(unrelatedPath);
  assert.equal(readUserVersion(unrelatedCheck), 0);
  assert.equal(unrelatedCheck.prepare('SELECT value FROM sqliteXunrelated').get().value, 'unrelated');
  unrelatedCheck.close();

  const corruptPath = join(root, 'corrupt.sqlite');
  const corruptContents = 'not a SQLite database and must remain unchanged';
  await writeFile(corruptPath, corruptContents, { mode: 0o600 });
  assert.throws(() => openDatabase(corruptPath), { message: 'Database migration failed.' });
  assert.equal(await readFile(corruptPath, 'utf8'), corruptContents);

  const lockedPath = join(root, 'locked.sqlite');
  const initialized = openDatabase(lockedPath);
  const lockedVersion = readUserVersion(initialized);
  initialized.close();
  const lock = new DatabaseSync(lockedPath);
  lock.exec('BEGIN IMMEDIATE;');
  assert.throws(() => openDatabase(lockedPath), { message: 'Database migration failed.' });
  lock.exec('ROLLBACK;');
  lock.close();
  const afterRelease = openDatabase(lockedPath);
  assert.equal(readUserVersion(afterRelease), lockedVersion);
  afterRelease.close();
});

// Empty, relative, in-memory, publicly accessible, symlinked database-file, and application-owned locations must be rejected without changing permissions.
test('database paths and permissions are restricted', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-permissions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { openDatabase } = await import(databaseModuleUrl);

  for (const unsafePath of ['', 'relative.sqlite', ':memory:']) {
    assert.throws(() => openDatabase(unsafePath), { message: 'Database path must be an absolute file path outside the application directory.' });
  }
  const applicationPath = join(projectDirectory, 'dist', 'forbidden.sqlite');
  assert.throws(() => openDatabase(applicationPath), { message: 'Database path must be an absolute file path outside the application directory.' });

  const linkedApplication = join(root, 'linked-application');
  await symlink(projectDirectory, linkedApplication);
  assert.throws(
    () => openDatabase(join(linkedApplication, 'dist', 'linked-forbidden.sqlite')),
    { message: 'Database path must be an absolute file path outside the application directory.' },
  );

  const publicDirectory = join(root, 'public-directory');
  await mkdir(publicDirectory, { mode: 0o755 });
  const publicDirectoryMode = (await stat(publicDirectory)).mode & 0o777;
  assert.throws(
    () => openDatabase(join(publicDirectory, 'database.sqlite')),
    { message: 'Database directory must be private and owned by the current user.' },
  );
  assert.equal((await stat(publicDirectory)).mode & 0o777, publicDirectoryMode);

  const publicFile = join(root, 'public.sqlite');
  await writeFile(publicFile, '', { mode: 0o600 });
  await chmod(publicFile, 0o640);
  assert.throws(
    () => openDatabase(publicFile),
    { message: 'Database file must be a private regular file owned by the current user.' },
  );
  assert.equal((await stat(publicFile)).mode & 0o777, 0o640);

  const targetFile = join(root, 'target.sqlite');
  await writeFile(targetFile, '', { mode: 0o600 });
  const linkedFile = join(root, 'linked.sqlite');
  await symlink(targetFile, linkedFile);
  assert.throws(
    () => openDatabase(linkedFile),
    { message: 'Database file must be a private regular file owned by the current user.' },
  );

  const privatePath = join(root, 'new-private-directory', 'database.sqlite');
  const database = openDatabase(privatePath);
  database.close();
  assert.equal((await stat(join(root, 'new-private-directory'))).mode & 0o777, 0o700);
  assert.equal((await stat(privatePath)).mode & 0o777, 0o600);
  assert.equal((await lstat(privatePath)).isSymbolicLink(), false);
});

// Invalid setting inputs must fail before SQLite can store categories or keys outside the settings contract.
test('settings validate categories, keys, and values', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-settings-validation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { openDatabase } = await import(databaseModuleUrl);
  const { deleteSetting, getSetting, setSetting } = await import(settingsModuleUrl);
  const database = openDatabase(join(root, 'database.sqlite'));
  t.after(() => database.close());
  assert.throws(() => getSetting(database, 'other', 'key'), { message: 'Invalid settings category.' });
  assert.throws(() => setSetting(database, 'credentials', '  ', 'value'), { message: 'Setting key must be a nonblank string.' });
  assert.throws(() => deleteSetting(database, 'credentials', ''), { message: 'Setting key must be a nonblank string.' });
  assert.throws(() => setSetting(database, 'credentials', 'key', 42), { message: 'Setting value must be a string.' });
});

// A startup storage failure must exit unsuccessfully with one fixed message and never begin listening.
test('production startup stops when database initialization fails', async (t) => {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'media-manager-2-startup-failure-'));
  t.after(() => rm(workingDirectory, { recursive: true, force: true }));
  const child = spawn(process.execPath, [serverPath], {
    cwd: workingDirectory,
    env: {
      ...process.env,
      DB_PATH: 'relative.sqlite',
      HOST: '127.0.0.1',
      NODE_NO_WARNINGS: '1',
      PORT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const [code, signal] = await once(child, 'exit');
  assert.equal(signal, null);
  assert.notEqual(code, 0);
  assert.equal(output.trim(), 'Database initialization failed.');
  assert.doesNotMatch(output, /Listening on|relative\.sqlite/);
});

// Credential values must remain absent from every production and development response and from server output.
test('credential settings are never served to browsers', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-credential-exposure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const databasePath = join(root, 'data', 'media-manager.sqlite');
  const credential = `credential-${process.pid}-\"'distinctive`;
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const database = openDatabase(databasePath);
  setSetting(database, 'credentials', 'private-token', credential);
  database.close();

  const child = spawn(process.execPath, [serverPath], {
    cwd: root,
    env: {
      ...process.env,
      DB_PATH: databasePath,
      HOST: '127.0.0.1',
      NODE_NO_WARNINGS: '1',
      PORT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const killTimer = setTimeout(() => child.kill('SIGKILL'), 5_000);
      child.kill('SIGTERM');
      try {
        await exited;
      } finally {
        clearTimeout(killTimer);
      }
    }
  });
  const baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error(`Server did not listen within 10 seconds.\n${output}`)), 10_000);
    const finish = (error, url) => {
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
      if (error) reject(error);
      else resolve(url);
    };
    const onData = () => {
      const match = output.match(/Listening on (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) finish(null, match[1]);
    };
    const onExit = (code, signal) => finish(new Error(`Server exited before listening (code ${code}, signal ${signal}).\n${output}`));
    const onError = (error) => finish(error);
    child.stdout.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);
  });
  const productionPaths = ['/', '/assets/missing.js', '/missing', `/@fs/${databasePath}`, databasePath, `/file/${pathToFileURL(databasePath).href}`];
  const applicationResponse = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(5_000) });
  const applicationHtml = await applicationResponse.text();
  const assetPaths = [
    applicationHtml.match(/<script\b[^>]*\bsrc="([^"]+\.js)"/)?.[1],
    applicationHtml.match(/<link\b[^>]*\bhref="([^"]+\.css)"/)?.[1],
  ].filter(Boolean);
  for (const path of [...productionPaths, ...assetPaths]) {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(5_000) });
    assert.doesNotMatch(await response.text(), new RegExp(credential.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), path);
  }
  assert.doesNotMatch(output, new RegExp(credential.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const { createServer } = await import('vite');
  const vite = await createServer({
    root: projectDirectory,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
  });
  t.after(() => vite.close());
  await vite.listen();
  const address = vite.httpServer?.address();
  assert.ok(address && typeof address !== 'string');
  const viteResponse = await fetch(`http://127.0.0.1:${address.port}/@fs/${databasePath}`, {
    signal: AbortSignal.timeout(5_000),
  });
  assert.notEqual(viteResponse.status, 200);
  assert.doesNotMatch(await viteResponse.text(), new RegExp(credential.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

// Treating a missing setting, a 401 or 403, a timeout or a malformed body as any other outcome, or putting a credential in a status or error, breaks the connection checks.
test('service connections read saved settings and classify each outcome', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { deleteSetting, setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createRtorrent } = await import(rtorrentModuleUrl);
  const { createPlex } = await import(plexModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-connections-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const pid = process.pid;
  const rtorrentUser = `rtorrent-user-${pid}-distinctive`;
  const rtorrentPassword = `rtorrent-password-${pid}-distinctive`;
  const xmlString = (value) => `<methodResponse><params><param><value><string>${value}</string></value></param></params></methodResponse>`;
  const arr = (name, port) => ({
    name,
    create: (fetch) => createArr(name, database, { fetch }),
    url: `http://127.0.0.1:${port}`,
    credentials: { [`${name}.apiKey`]: `${name}-key-${pid}-distinctive` },
    method: 'GET',
    probeUrl: `http://127.0.0.1:${port}/api/v3/system/status`,
    headers: { 'x-api-key': `${name}-key-${pid}-distinctive`, accept: 'application/json' },
    okBody: JSON.stringify({ version: '4.0.10.2544' }),
    version: '4.0.10.2544',
    malformedBody: '{}',
    usePrimitive: (service) => service.request('/api/v3/system/status'),
    primitiveResult: { status: 200, body: { version: '4.0.10.2544' } },
  });
  const services = [
    arr('sonarr', 65001),
    arr('radarr', 65002),
    {
      name: 'rtorrent',
      create: (fetch) => createRtorrent(database, { fetch }),
      url: 'http://127.0.0.1:65003/xmlrpc',
      credentials: { 'rtorrent.username': rtorrentUser, 'rtorrent.password': rtorrentPassword },
      method: 'POST',
      probeUrl: 'http://127.0.0.1:65003/xmlrpc',
      headers: {
        authorization: `Basic ${Buffer.from(`${rtorrentUser}:${rtorrentPassword}`).toString('base64')}`,
        'content-type': 'text/xml',
      },
      bodyIncludes: '<methodName>system.client_version</methodName>',
      okBody: xmlString('0.9.8'),
      version: '0.9.8',
      malformedBody: '<html>not xml</html>',
      faultBody: '<methodResponse><fault><value><struct><member><name>faultCode</name><value><int>-501</int></value></member><member><name>faultString</name><value><string>Access denied: unauthorized</string></value></member></struct></value></fault></methodResponse>',
      usePrimitive: (service) => service.call('system.client_version', []),
      primitiveResult: '0.9.8',
    },
    {
      name: 'plex',
      create: (fetch) => createPlex(database, { fetch }),
      url: 'http://127.0.0.1:65004',
      credentials: { 'plex.token': `plex-token-${pid}-distinctive` },
      method: 'GET',
      probeUrl: 'http://127.0.0.1:65004/',
      headers: { 'x-plex-token': `plex-token-${pid}-distinctive`, accept: 'application/json' },
      okBody: JSON.stringify({ MediaContainer: { version: '1.41.0.8994' } }),
      version: '1.41.0.8994',
      malformedBody: '{}',
      usePrimitive: (service) => service.request('/'),
      primitiveResult: { status: 200, body: { MediaContainer: { version: '1.41.0.8994' } } },
    },
  ];

  for (const service of services) {
    const urlEntry = ['serviceAddresses', `${service.name}.url`, service.url];
    const credentialEntries = Object.entries(service.credentials).map(([key, value]) => ['credentials', key, value]);
    const save = (entries) => {
      for (const [category, key] of [urlEntry, ...credentialEntries]) deleteSetting(database, category, key);
      for (const [category, key, value] of entries) setSetting(database, category, key, value);
    };
    const run = async (respond, use = (connection) => connection.check()) => {
      const calls = [];
      const fetch = async (url, init = {}) => {
        calls.push({ url: String(url), init, headers: new Headers(init.headers) });
        return respond();
      };
      const result = await use(service.create(fetch));
      for (const call of calls) {
        assert.equal(call.init.redirect, 'error', service.name);
        assert.ok(call.init.signal instanceof AbortSignal, service.name);
      }
      return { result, calls };
    };

    const incomplete = [
      [],
      [urlEntry],
      credentialEntries,
      ...(credentialEntries.length > 1 ? credentialEntries.map((entry) => [urlEntry, entry]) : []),
    ];
    for (const entries of incomplete) {
      save(entries);
      const { result, calls } = await run(() => { throw new Error('unexpected request'); });
      const label = `${service.name} with ${entries.map(([, key]) => key).join(', ') || 'nothing'}`;
      assert.deepEqual(result, { kind: 'not_configured' }, label);
      assert.equal(calls.length, 0, label);
    }

    save([urlEntry, ...credentialEntries]);
    const ok = await run(() => new Response(service.okBody, { status: 200 }));
    assert.deepEqual(ok.result, { kind: 'ok', version: service.version }, service.name);
    assert.equal(ok.calls.length, 1, service.name);
    const [request] = ok.calls;
    assert.equal(request.init.method ?? 'GET', service.method, service.name);
    assert.equal(request.url, service.probeUrl, service.name);
    for (const [name, value] of Object.entries(service.headers)) {
      assert.equal(request.headers.get(name), value, `${service.name} ${name}`);
    }
    if (service.bodyIncludes) assert.ok(String(request.init.body).includes(service.bodyIncludes), service.name);
    const primitive = await run(() => new Response(service.okBody, { status: 200 }), service.usePrimitive);
    assert.deepEqual(primitive.result, service.primitiveResult, service.name);

    const failures = [
      ['401', 'rejected', () => new Response('', { status: 401 })],
      ['403', 'rejected', () => new Response('', { status: 403 })],
      ['500', 'unreachable', () => new Response('', { status: 500 })],
      ['network failure', 'unreachable', () => { throw new TypeError('fetch failed'); }],
      ['timeout', 'unreachable', () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); }],
      ['malformed body', 'unreachable', () => new Response(service.malformedBody, { status: 200 })],
      ...(service.faultBody ? [['fault', 'rejected', () => new Response(service.faultBody, { status: 200 })]] : []),
    ];
    for (const [label, kind, respond] of failures) {
      const { result } = await run(respond);
      assert.deepEqual(result, { kind }, `${service.name} ${label}`);
    }

    const failed = await run(
      () => { throw new TypeError('fetch failed'); },
      (connection) => service.usePrimitive(connection).then(() => assert.fail(`${service.name} resolved`), (error) => error),
    );
    const errorText = String(failed.result);
    for (const value of [...Object.values(service.credentials), '127.0.0.1']) {
      assert.equal(errorText.includes(value), false, `${service.name} error mentions ${value}`);
    }
  }
});

// Dropping an escape, mis-reading a scalar, or resolving a fault or malformed response corrupts every rTorrent call.
test('rTorrent XML-RPC requests are encoded and responses parsed by hand', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createRtorrent } = await import(rtorrentModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-xmlrpc-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const password = `rtorrent-password-${process.pid}-distinctive`;
  setSetting(database, 'serviceAddresses', 'rtorrent.url', 'http://127.0.0.1:65003/xmlrpc');
  setSetting(database, 'credentials', 'rtorrent.username', `rtorrent-user-${process.pid}`);
  setSetting(database, 'credentials', 'rtorrent.password', password);
  const requestBodies = [];
  let responseBody = '';
  const rtorrent = createRtorrent(database, {
    fetch: async (url, init) => {
      requestBodies.push(init.body);
      return new Response(responseBody, { status: 200 });
    },
  });
  const wrap = (value) => `<methodResponse><params><param><value>${value}</value></param></params></methodResponse>`;

  responseBody = wrap('<string>done</string>');
  await rtorrent.call('d.multicall2', ['', 'main', 'd.hash=', 'a&b<c>']);
  assert.equal(
    requestBodies[0],
    '<?xml version="1.0"?><methodCall><methodName>d.multicall2</methodName><params><param><value><string></string></value></param><param><value><string>main</string></value></param><param><value><string>d.hash=</string></value></param><param><value><string>a&amp;b&lt;c&gt;</string></value></param></params></methodCall>',
  );

  const torrent = (hash, size) => `<value><struct><member><name>hash</name><value><string>${hash}</string></value></member><member><name>size</name><value><i8>${size}</i8></value></member></struct></value>`;
  const parsed = [
    [wrap('<string>abc</string>'), 'abc'],
    [wrap('bare'), 'bare'],
    [wrap('<string>a &amp; b &lt;c&gt; &quot;q&quot; &apos;s&apos; &#65;&#x42;</string>'), 'a & b <c> "q" \'s\' AB'],
    [wrap('<int>7</int>'), 7],
    [wrap('<i4>-3</i4>'), -3],
    [wrap('<i8>1234567890123</i8>'), 1234567890123],
    [wrap(`<array><data>${torrent('H1', 10)}${torrent('H2', 20)}</data></array>`), [{ hash: 'H1', size: 10 }, { hash: 'H2', size: 20 }]],
    [wrap('<array><data></data></array>'), []],
  ];
  for (const [body, expected] of parsed) {
    responseBody = body;
    assert.deepEqual(await rtorrent.call('system.client_version', []), expected, body);
  }

  responseBody = '<methodResponse><fault><value><struct><member><name>faultCode</name><value><int>-501</int></value></member><member><name>faultString</name><value><string>Could not find method</string></value></member></struct></value></fault></methodResponse>';
  await assert.rejects(rtorrent.call('system.missing', []), (error) => {
    assert.match(error.message, /-501/);
    assert.match(error.message, /Could not find method/);
    assert.equal(error.message.includes(password), false);
    return true;
  });

  const malformed = [
    'not xml at all',
    '<methodResponse><params></params></methodResponse>',
    '<methodResponse><params><param><value><double>1.5</double></value></param></params></methodResponse>',
    '<methodResponse><params><param><value><string>abc</str',
  ];
  for (const body of malformed) {
    responseBody = body;
    await assert.rejects(rtorrent.call('system.client_version', []), { message: 'rTorrent is unreachable.' }, body);
  }
});

test('rTorrent poll keeps a live torrent table and a seeding counter', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createTorrentPoller, listTorrents } = await import(torrentsModuleUrl);
  const { readDependency } = await import(dependenciesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-torrents-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let databaseCount = 0;

  const hashA = 'ab'.repeat(20);
  const hashB = 'CD'.repeat(20);
  const hashC = 'EF'.repeat(20);
  // Field order matches the poller's d.multicall2 request.
  const row = (hash, overrides = {}) => {
    const torrent = {
      hash, name: `Name ${hash.slice(0, 4)}`, size: 1000, completed: 1000, down: 0, up: 50,
      state: 1, open: 1, active: 1, complete: 1, message: '', finished: 1_700_000_000, ratio: 1500, peers: 3, seeders: 1,
      ...overrides,
    };
    return [torrent.hash, torrent.name, torrent.size, torrent.completed, torrent.down, torrent.up, torrent.state,
      torrent.open, torrent.active, torrent.complete, torrent.message, torrent.finished, torrent.ratio, torrent.peers, torrent.seeders];
  };

  const setup = (databasePath) => {
    databaseCount += 1;
    const database = openDatabase(databasePath ?? join(root, `db-${databaseCount}`, 'media-manager.sqlite'));
    const clock = { value: 1_000_000 };
    const events = createEventHub();
    const published = [];
    events.subscribe((event) => published.push(event));
    const fake = { rows: [], fail: undefined, calls: [] };
    const rtorrent = {
      call: async (method, params) => {
        fake.calls.push([method, params]);
        if (method === 't.multicall') {
          return params[0] === hashC ? [] : [[`https://tracker.example/announce/secret-passkey-${params[0]}?pk=1`]];
        }
        if (fake.fail !== undefined) throw new Error(fake.fail);
        return fake.rows;
      },
    };
    const poller = createTorrentPoller({ database, rtorrent, events, now: () => clock.value, intervalMs: 30_000 });
    return { database, clock, published, fake, poller };
  };

  // Dropping the uppercase normalization, deleting gone torrents, keeping the announce passkey, re-querying a trackerless torrent, or publishing unchanged polls turns this red.
  await t.test('new, changed, gone and returning torrents are stored and published', async () => {
    const { database, clock, published, fake, poller } = setup();
    fake.rows = [row(hashA), row(hashB, { complete: 0, completed: 0 }), row(hashC)];
    await poller.poll();
    let torrents = listTorrents(database);
    assert.deepEqual(torrents.map((torrent) => torrent.hash), [hashA.toUpperCase(), hashB, hashC]);
    assert.equal(torrents[2].trackerHost, '');
    assert.equal(torrents[0].trackerHost, 'tracker.example');
    assert.equal(JSON.stringify(torrents).includes('passkey'), false);
    assert.equal(torrents[1].complete, false);
    const first = published.filter((event) => event.type === 'torrents');
    assert.equal(first.length, 1);
    assert.equal(first[0].data.changed.length, 3);

    clock.value += 30_000;
    await poller.poll();
    assert.equal(published.filter((event) => event.type === 'torrents').length, 1);
    assert.equal(fake.calls.filter(([method]) => method === 't.multicall').length, 3);

    clock.value += 30_000;
    fake.rows = [row(hashB, { complete: 0, completed: 400, down: 99 }), row(hashC)];
    await poller.poll();
    torrents = listTorrents(database);
    assert.equal(torrents.length, 3);
    assert.equal(torrents.find((torrent) => torrent.hash === hashA.toUpperCase()).goneAt, clock.value);
    assert.equal(torrents.find((torrent) => torrent.hash === hashB).completedBytes, 400);
    const latest = published.at(-1);
    assert.equal(latest.type, 'torrents');
    assert.deepEqual(latest.data.gone, [hashA.toUpperCase()]);
    assert.deepEqual(latest.data.changed.map((torrent) => torrent.hash), [hashB]);

    clock.value += 30_000;
    fake.rows = [row(hashA), row(hashB, { complete: 0, completed: 400, down: 99 }), row(hashC)];
    await poller.poll();
    assert.equal(listTorrents(database).find((torrent) => torrent.hash === hashA.toUpperCase()).goneAt, null);
    database.close();
  });

  // Crediting a poll where either side was not cleanly seeding, or crediting a gap longer than two intervals, turns this red.
  await t.test('the seeding counter credits only clean seeding across ordinary poll gaps and survives a restart', async () => {
    const databasePath = join(root, 'counter', 'media-manager.sqlite');
    const first = setup(databasePath);
    const seconds = () => listTorrents(first.database)[0].seedingSeconds;
    first.fake.rows = [row(hashB)];
    await first.poller.poll();
    assert.equal(seconds(), 0);
    first.clock.value += 30_000;
    await first.poller.poll();
    assert.equal(seconds(), 30);
    first.clock.value += 30_000;
    first.fake.rows = [row(hashB, { message: 'Tracker: [Failure reason "Unregistered torrent"]' })];
    await first.poller.poll();
    assert.equal(seconds(), 30);
    first.clock.value += 30_000;
    first.fake.rows = [row(hashB)];
    await first.poller.poll();
    assert.equal(seconds(), 30);
    first.clock.value += 30_000;
    first.fake.rows = [row(hashB, { active: 0 })];
    await first.poller.poll();
    assert.equal(seconds(), 30);
    first.clock.value += 30_000;
    first.fake.rows = [row(hashB)];
    await first.poller.poll();
    first.clock.value += 45_000;
    await first.poller.poll();
    assert.equal(seconds(), 75);
    const stoppedAt = first.clock.value;
    first.database.close();

    const second = setup(databasePath);
    second.clock.value = stoppedAt + 61_000;
    second.fake.rows = [row(hashB)];
    await second.poller.poll();
    assert.equal(listTorrents(second.database)[0].seedingSeconds, 75);
    second.clock.value += 30_000;
    await second.poller.poll();
    assert.equal(listTorrents(second.database)[0].seedingSeconds, 105);
    second.database.close();
  });

  // Clearing the table on a failed poll, or never recording rTorrent as down and back up, turns this red.
  await t.test('an unreachable or malformed rTorrent keeps the last snapshot and marks the dependency down', async () => {
    const { database, clock, published, fake, poller } = setup();
    fake.rows = [row(hashA)];
    await poller.poll();
    assert.equal(readDependency(database, 'rtorrent').state, 'ok');
    const failures = [
      () => { fake.fail = 'rTorrent is unreachable.'; },
      () => { fake.fail = undefined; fake.rows = [['not', 'a', 'row']]; },
      () => { fake.rows = [row('xyz')]; },
    ];
    for (const fail of failures) {
      clock.value += 30_000;
      fail();
      await poller.poll();
      assert.equal(readDependency(database, 'rtorrent').state, 'down');
      assert.equal(listTorrents(database).length, 1);
      assert.equal(listTorrents(database)[0].goneAt, null);
    }
    const downSince = readDependency(database, 'rtorrent').since;
    assert.equal(downSince, clock.value - 60_000);
    clock.value += 30_000;
    fake.rows = [row(hashA)];
    await poller.poll();
    assert.deepEqual(readDependency(database, 'rtorrent'), { name: 'rtorrent', state: 'ok', since: clock.value, detail: '' });
    assert.deepEqual(published.filter((event) => event.type === 'dependency').map((event) => event.data.state), ['ok', 'down', 'down', 'ok']);
    database.close();
  });
});

test('Sonarr and Radarr grabs are matched to torrents and recorded once', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker, findGrab, listGrabs, listQueue } = await import(grabsModuleUrl);
  const { readDependency } = await import(dependenciesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-grabs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let databaseCount = 0;
  const movieHash = 'aa'.repeat(20);
  const episodeHash = 'Bb'.repeat(20);
  const packHash = 'cc'.repeat(20);
  const missedHash = 'dd'.repeat(20);

  const setup = (databasePath) => {
    databaseCount += 1;
    const database = openDatabase(databasePath ?? join(root, `db-${databaseCount}`, 'media-manager.sqlite'));
    const clock = { value: Date.parse('2026-10-08T12:00:00Z') };
    const events = createEventHub();
    const fake = {
      sonarr: { queue: [], history: [], down: false, requests: [] },
      radarr: { queue: [], history: [], down: false, requests: [] },
    };
    const service = (name) => ({
      request: async (path) => {
        fake[name].requests.push(path);
        if (fake[name].down) throw new Error(`${name === 'sonarr' ? 'Sonarr' : 'Radarr'} is unreachable.`);
        if (path.startsWith('/api/v3/queue')) {
          return { status: 200, body: { page: 1, pageSize: 200, totalRecords: fake[name].queue.length, records: fake[name].queue } };
        }
        if (path.startsWith('/api/v3/history/since')) return { status: 200, body: fake[name].history };
        return { status: 404, body: undefined };
      },
    });
    const tracker = createGrabTracker({ database, arr: { sonarr: service('sonarr'), radarr: service('radarr') }, events, now: () => clock.value });
    const heard = [];
    tracker.onGrab((grab) => { heard.push(grab.hash); });
    return { database, clock, fake, tracker, heard };
  };

  // Dropping the hash normalization, losing a pack's episodes, or splitting one grab into two records turns this red.
  await t.test('webhooks and the history check record a movie, an episode, a multi-episode and a season pack as one record per hash', async () => {
    const { database, clock, fake, tracker, heard } = setup();
    assert.equal(tracker.receiveWebhook('radarr', {
      eventType: 'Grab', movie: { id: 7 }, release: { releaseTitle: 'Movie.2024.2160p', indexer: 'Blutopia (API)' }, downloadId: movieHash,
    }), 'ok');
    assert.equal(tracker.receiveWebhook('sonarr', {
      eventType: 'Grab', series: { id: 3 }, episodes: [{ id: 31 }, { id: 32 }],
      release: { releaseTitle: 'Show.S01E01E02.1080p', indexer: 'BeyondHD' }, downloadId: episodeHash,
    }), 'ok');
    assert.equal(findGrab(database, movieHash.toLowerCase()).movieId, 7);
    assert.deepEqual(findGrab(database, episodeHash).episodeIds, [31, 32]);
    assert.equal(findGrab(database, episodeHash.toUpperCase()).indexer, 'BeyondHD');

    clock.value += 60_000;
    fake.sonarr.history = [
      { downloadId: episodeHash.toUpperCase(), seriesId: 3, episodeId: 32, sourceTitle: 'Show.S01E01E02.1080p', date: '2026-10-08T11:59:00Z', data: { indexer: 'BeyondHD' } },
      ...[41, 42, 43].map((episodeId) => ({
        downloadId: packHash, seriesId: 4, episodeId, sourceTitle: 'Show.S02.1080p', date: '2026-10-08T11:30:00Z', data: { indexer: 'PrivateHD' },
      })),
    ];
    await tracker.reconcile();
    const grabs = listGrabs(database);
    assert.equal(grabs.length, 3);
    assert.deepEqual(findGrab(database, packHash).episodeIds, [41, 42, 43]);
    assert.equal(findGrab(database, packHash).indexer, 'PrivateHD');
    assert.equal(findGrab(database, episodeHash).grabbedAt, Date.parse('2026-10-08T11:59:00Z'));
    assert.deepEqual(findGrab(database, episodeHash).episodeIds, [31, 32]);
    assert.deepEqual([...heard].sort(), [movieHash.toUpperCase(), episodeHash.toUpperCase(), packHash.toUpperCase()].sort());
    database.close();
  });

  // Losing the checkpoint, or reading history only from the moment of the restart, leaves grabs made while the server was down unmatched.
  await t.test('after a restart the check fills grabs whose webhooks were missed', async () => {
    const databasePath = join(root, 'restart', 'media-manager.sqlite');
    const first = setup(databasePath);
    await first.tracker.reconcile();
    const firstSince = first.fake.radarr.requests.find((path) => path.startsWith('/api/v3/history/since'));
    assert.match(decodeURIComponent(firstSince), /date=2026-09-24T12:00:00.000Z/);
    const stoppedAt = first.clock.value;
    first.database.close();

    const second = setup(databasePath);
    second.clock.value = stoppedAt + 3 * 60 * 60_000;
    second.fake.radarr.history = [
      { downloadId: missedHash, movieId: 9, sourceTitle: 'Missed.2025.1080p', date: new Date(stoppedAt + 60 * 60_000).toISOString(), data: { indexer: 'Blutopia' } },
    ];
    await second.tracker.reconcile();
    const since = second.fake.radarr.requests.find((path) => path.startsWith('/api/v3/history/since'));
    assert.match(decodeURIComponent(since), new RegExp(`date=${new Date(stoppedAt - 10 * 60_000).toISOString()}`));
    assert.equal(findGrab(second.database, missedHash).movieId, 9);
    second.database.close();
  });

  // Dropping delayed (pending) items, keeping a stale queue after a failed read, or not marking the service down turns this red.
  await t.test('the queue snapshot keeps delayed releases and survives a failed read', async () => {
    const { database, fake, tracker } = setup();
    fake.sonarr.queue = [
      { id: 1, downloadId: episodeHash, seriesId: 3, episodeId: 31, title: 'Show.S01E01E02.1080p', status: 'downloading',
        trackedDownloadStatus: 'ok', trackedDownloadState: 'downloading', indexer: 'BeyondHD', protocol: 'torrent',
        quality: { quality: { name: 'WEBDL-1080p' } }, customFormats: [{ name: 'DV' }], customFormatScore: 150, size: 1000, sizeleft: 250 },
      { id: 2, seriesId: 3, episodeId: 33, title: 'Show.S01E03.1080p', status: 'delay', trackedDownloadStatus: 'ok',
        trackedDownloadState: 'downloading', estimatedCompletionTime: '2026-10-08T13:00:00Z', statusMessages: [] },
    ];
    await tracker.reconcile();
    const queue = listQueue(database);
    assert.equal(queue.length, 2);
    assert.equal(queue[0].downloadId, episodeHash.toUpperCase());
    assert.deepEqual(queue[0].formats, ['DV']);
    assert.equal(queue[1].status, 'delay');
    assert.equal(queue[1].downloadId, null);
    assert.equal(readDependency(database, 'sonarr').state, 'ok');

    fake.sonarr.down = true;
    await tracker.reconcile();
    assert.equal(listQueue(database).length, 2);
    assert.equal(readDependency(database, 'sonarr').state, 'down');
    assert.equal(readDependency(database, 'radarr').state, 'ok');
    database.close();
  });

  // Serving the webhook without a configured secret, accepting a wrong password, or putting it behind the owner sign-in turns this red.
  await t.test('the webhook endpoint needs the saved secret and no sign-in', async () => {
    const received = [];
    const authorization = (password) => `Basic ${Buffer.from(`sonarr:${password}`).toString('base64')}`;
    const post = (app, path, headers, body = '{"eventType":"Test"}') => app.request(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
    });
    let secret;
    const { app } = await makeApp({
      webhooks: { secret: () => secret, receive: (service, payload) => { received.push([service, payload]); return 'ok'; } },
    });
    assert.equal((await post(app, '/webhooks/sonarr', { Authorization: authorization('anything') })).status, 503);
    secret = `webhook-secret-${process.pid}`;
    const missing = await post(app, '/webhooks/sonarr', {});
    assert.equal(missing.status, 401);
    assert.equal((await post(app, '/webhooks/sonarr', { Authorization: authorization('wrong') })).status, 401);
    assert.equal((await post(app, '/webhooks/sonarr', { Authorization: authorization(secret) }, 'not json')).status, 400);
    assert.equal((await post(app, '/webhooks/plex', { Authorization: authorization(secret) })).status, 404);
    assert.equal(received.length, 0);
    assert.equal((await post(app, '/webhooks/radarr', { Authorization: authorization(secret) })).status, 204);
    assert.deepEqual(received, [['radarr', { eventType: 'Test' }]]);
  });
});

test('problems record each fix attempt and its result', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createProblems, listOpenProblems, subjectHistory, countReleaseAttempts } = await import(problemsModuleUrl);
  const { writeDependency } = await import(dependenciesModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-problems-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const episode = { type: 'episode', service: 'sonarr', id: '31' };

  // Opening a second record for a problem already open, losing a step, or forgetting tried releases across a restart turns this red.
  await t.test('a problem moves through being handled, needs you and resolved, and tried releases survive a restart', async () => {
    const databasePath = join(root, 'lifecycle', 'media-manager.sqlite');
    let database = openDatabase(databasePath);
    const clock = { value: 1_000 };
    const events = createEventHub();
    const published = [];
    events.subscribe((event) => published.push(event));
    let problems = createProblems({ database, events, now: () => clock.value });
    const first = problems.open({ kind: 'stalled', subject: episode, summary: 'No seeders for an hour.', hash: 'AB'.repeat(20) });
    assert.equal(first.state, 'handling');
    assert.equal(problems.open({ kind: 'stalled', subject: episode, summary: 'again' }).id, first.id);
    clock.value += 1;
    problems.step(first.id, 'fix', 'Blocked the release and grabbed one from Beyond-HD.');
    assert.equal(problems.recordReleaseAttempt(episode, 'release-one'), 1);
    assert.equal(problems.recordReleaseAttempt(episode, 'release-one'), 1);
    assert.equal(problems.recordReleaseAttempt(episode, 'release-two'), 2);
    clock.value += 1;
    problems.setState(first.id, 'needs_you', 'Gave up after three releases.');
    assert.deepEqual(listOpenProblems(database).map((problem) => problem.state), ['needs_you']);
    database.close();

    database = openDatabase(databasePath);
    problems = createProblems({ database, events, now: () => clock.value });
    assert.equal(countReleaseAttempts(database, episode), 2);
    clock.value += 1;
    problems.setState(first.id, 'resolved', 'Imported by hand.');
    assert.throws(() => problems.step(first.id, 'fix', 'late'), { message: 'Problem is not open.' });
    assert.deepEqual(listOpenProblems(database), []);
    const [history] = subjectHistory(database, episode);
    assert.deepEqual(history.steps.map((step) => [step.at, step.kind]), [[1000, 'problem'], [1001, 'fix'], [1002, 'result'], [1003, 'result']]);
    assert.equal(history.resolvedAt, 1003);
    const reopened = problems.open({ kind: 'stalled', subject: episode, summary: 'Stalled again.' });
    assert.notEqual(reopened.id, first.id);
    assert.equal(published.filter((event) => event.type === 'problem').length, 5);
    database.close();
  });

  // Leaving a down dependency without a needs-you problem, or never resolving it on recovery, turns this red.
  await t.test('a down dependency pauses the fixes that need it and resolves when it recovers', async () => {
    const database = openDatabase(join(root, 'dependencies', 'media-manager.sqlite'));
    const events = createEventHub();
    const problems = createProblems({ database, events, now: () => 5_000 });
    writeDependency(database, events, 'rtorrent', 'down', 5_000, 'rTorrent is unreachable.');
    writeDependency(database, events, 'sonarr', 'ok', 5_000, '');
    assert.deepEqual(problems.pausedBy(['rtorrent', 'sonarr', 'never-seen']), ['rtorrent']);
    problems.syncDependencies();
    problems.syncDependencies();
    let open = listOpenProblems(database);
    assert.equal(open.length, 1);
    assert.deepEqual([open[0].state, open[0].subject.id, open[0].summary], ['needs_you', 'rtorrent', 'rTorrent is unreachable.']);
    writeDependency(database, events, 'rtorrent', 'ok', 6_000, '');
    problems.syncDependencies();
    assert.deepEqual(problems.pausedBy(['rtorrent']), []);
    assert.deepEqual(listOpenProblems(database), []);
    database.close();
  });

  // Mounting the read routes outside the owner guard turns this red.
  await t.test('problem and download routes need the owner session', async () => {
    const database = openDatabase(join(root, 'api', 'media-manager.sqlite'));
    const { app } = await makeApp({ api: createApiRoutes(database) });
    assert.equal((await app.request('/api/problems')).status, 401);
    assert.equal((await app.request('/api/downloads')).status, 401);
    const { session } = await signIn(app);
    const problems = await app.request('/api/problems', { headers: { Cookie: session } });
    assert.equal(problems.status, 200);
    assert.deepEqual(await problems.json(), []);
    const downloads = await app.request('/api/downloads', { headers: { Cookie: session } });
    assert.deepEqual(Object.keys(await downloads.json()).sort(), ['grabs', 'problems', 'queue', 'torrents']);
    assert.equal((await app.request('/api/problems/history?type=nope&id=1', { headers: { Cookie: session } })).status, 400);
    database.close();
  });
});

// Echoing a stored value, keeping the trailing newline from stdin, or misreporting a 401 lets credentials leak or hides a broken connection.
test('operator command stores settings from stdin and checks connections without printing secrets', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { getSetting } = await import(settingsModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-cli-'));
  const databasePath = join(root, 'media-manager.sqlite');
  const database = openDatabase(databasePath);
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const env = { ...process.env, DB_PATH: databasePath, NODE_NO_WARNINGS: '1' };
  const cli = (args, stdin) => runCli(args, { env, stdin });
  const pid = process.pid;
  const credentials = {
    'sonarr.apiKey': `sonarr-key-${pid}-distinctive`,
    'radarr.apiKey': `radarr-key-${pid}-distinctive`,
    'rtorrent.username': `rtorrent-user-${pid}-distinctive`,
    'rtorrent.password': `rtorrent-password-${pid}-distinctive`,
    'plex.token': `plex-token-${pid}-distinctive`,
  };

  const usage = await cli([]);
  assert.equal(usage.code, 2);
  assert.match(usage.stderr, /usage:/);

  const saved = await cli(['settings', 'set', 'credentials', 'sonarr.apiKey'], `${credentials['sonarr.apiKey']}\n`);
  assert.equal(saved.code, 0, saved.stderr);
  assert.equal(getSetting(database, 'credentials', 'sonarr.apiKey'), credentials['sonarr.apiKey']);

  const invalid = await cli(['settings', 'set', 'nope', 'k'], 'value');
  assert.notEqual(invalid.code, 0);
  assert.match(invalid.stderr, /Invalid settings category\./);

  const listed = await cli(['settings', 'list']);
  assert.equal(listed.code, 0, listed.stderr);
  assert.ok(listed.stdout.split('\n').includes('credentials sonarr.apiKey'), listed.stdout);
  assert.equal(listed.stdout.includes(credentials['sonarr.apiKey']), false);

  const unconfigured = await cli(['connections', 'check']);
  assert.equal(unconfigured.code, 1, unconfigured.stderr);
  assert.equal(unconfigured.stdout, 'sonarr: not_configured\nradarr: not_configured\nrtorrent: not_configured\nplex: not_configured\n');

  const { createServer } = await import('node:http');
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url, headers: request.headers });
    response.writeHead(401).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const urls = { 'sonarr.url': base, 'radarr.url': base, 'rtorrent.url': `${base}/xmlrpc`, 'plex.url': base };
  for (const [category, entries] of [['serviceAddresses', urls], ['credentials', credentials]]) {
    for (const [key, value] of Object.entries(entries)) {
      const result = await cli(['settings', 'set', category, key], value);
      assert.equal(result.code, 0, result.stderr);
    }
  }

  const rejected = await cli(['connections', 'check']);
  assert.equal(rejected.code, 1, rejected.stderr);
  assert.equal(rejected.stdout, 'sonarr: rejected\nradarr: rejected\nrtorrent: rejected\nplex: rejected\n');
  for (const value of Object.values(credentials)) {
    assert.equal(rejected.stdout.includes(value), false);
    assert.equal(rejected.stderr.includes(value), false);
  }
  const sent = (header) => requests.map((request) => request.headers[header]);
  assert.ok(sent('x-api-key').includes(credentials['sonarr.apiKey']));
  assert.ok(sent('x-api-key').includes(credentials['radarr.apiKey']));
  const basic = Buffer.from(`${credentials['rtorrent.username']}:${credentials['rtorrent.password']}`).toString('base64');
  assert.ok(sent('authorization').includes(`Basic ${basic}`));
  assert.ok(sent('x-plex-token').includes(credentials['plex.token']));

  const deleted = await cli(['settings', 'delete', 'credentials', 'plex.token']);
  assert.equal(deleted.code, 0, deleted.stderr);
  const relisted = await cli(['settings', 'list']);
  assert.equal(relisted.code, 0, relisted.stderr);
  assert.equal(relisted.stdout.split('\n').includes('credentials plex.token'), false);
});
