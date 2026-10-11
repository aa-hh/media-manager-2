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
const searchModuleUrl = new URL('../dist/server/search.js', import.meta.url).href;
const addModuleUrl = new URL('../dist/server/add.js', import.meta.url).href;
const releasesModuleUrl = new URL('../dist/server/releases.js', import.meta.url).href;
const grabsModuleUrl = new URL('../dist/server/grabs.js', import.meta.url).href;
const replaceModuleUrl = new URL('../dist/server/replace.js', import.meta.url).href;
const protectionModuleUrl = new URL('../dist/server/protection.js', import.meta.url).href;
const dependenciesModuleUrl = new URL('../dist/server/dependencies.js', import.meta.url).href;
const torrentGrabsModuleUrl = new URL('../dist/server/torrentGrabs.js', import.meta.url).href;
const problemsModuleUrl = new URL('../dist/server/problems.js', import.meta.url).href;
const apiModuleUrl = new URL('../dist/server/api.js', import.meta.url).href;
const trackersModuleUrl = new URL('../dist/server/trackers.js', import.meta.url).href;
const stallsModuleUrl = new URL('../dist/server/stalls.js', import.meta.url).href;
const searchesModuleUrl = new URL('../dist/server/searches.js', import.meta.url).href;
const importsModuleUrl = new URL('../dist/server/imports.js', import.meta.url).href;
const torrentsModuleUrl = new URL('../dist/server/torrents.js', import.meta.url).href;
const manualImportModuleUrl = new URL('../dist/server/manualImport.js', import.meta.url).href;
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
  const { applicationMigrations, openDatabase } = await import(databaseModuleUrl);

  const first = openDatabase(explicitPath);
  const initialized = readUserVersion(first);
  assert.ok(initialized >= 1);
  assert.equal(initialized, applicationMigrations.length);
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
  const { applicationMigrations, migrateDatabase, openDatabase } = await import(databaseModuleUrl);
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
  const { applicationMigrations, migrateDatabase, openDatabase } = await import(databaseModuleUrl);
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
  const { applicationMigrations, openDatabase } = await import(databaseModuleUrl);

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

  responseBody = wrap('<i8>0</i8>');
  await rtorrent.call('f.priority.set', ['ABC:f0', 0]);
  assert.match(requestBodies.pop(), /<param><value><string>ABC:f0<\/string><\/value><\/param><param><value><i8>0<\/i8><\/value><\/param>/);
  await assert.rejects(rtorrent.call('f.priority.set', ['ABC:f0', 0.5]), TypeError);

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
  const { createGrabTracker, findGrab, listGrabs, listQueue } = await import(torrentGrabsModuleUrl);
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

test('queue actions grab delayed releases and remove items without touching rTorrent', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker, listQueue } = await import(torrentGrabsModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-queue-actions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(() => database.close());
  const queue = {
    sonarr: [{
      id: -51234, status: 'delay', title: 'Andor.S02E09.2160p.WEB-DL', series: { title: 'Andor' }, episode: { seasonNumber: 2, episodeNumber: 9 },
    }],
    radarr: [{ id: 8, status: 'downloading', downloadId: 'ee'.repeat(20), title: 'Dune.Part.Two.2024', movie: { title: 'Dune: Part Two', year: 2024 } }],
  };
  const sent = [];
  const service = (name) => ({
    request: async (path, init = {}) => {
      if (init.method === undefined && path.startsWith('/api/v3/queue')) {
        return { status: 200, body: { page: 1, pageSize: 200, totalRecords: queue[name].length, records: queue[name] } };
      }
      if (init.method === undefined) return { status: 200, body: [] };
      sent.push(`${name} ${init.method} ${path}`);
      return { status: path.includes('/queue/8?') ? 500 : 200, body: undefined };
    },
  });
  const arr = { sonarr: service('sonarr'), radarr: service('radarr') };
  const tracker = createGrabTracker({ database, arr, events: createEventHub() });
  await tracker.reconcile();
  // Dropping the movie year or the episode code from the queue label turns this red.
  assert.deepEqual(listQueue(database).map((item) => item.label), ['Dune: Part Two (2024)', 'Andor S02E09']);
  const { app } = await makeApp({ api: createApiRoutes(database, { arr, refresh: tracker.refresh }) });
  const { session } = await signIn(app);
  const post = (path, body = {}, headers = jsonHeaders('https://media.example')) => app.request(path, {
    method: 'POST', headers: { ...headers, Cookie: session }, body: JSON.stringify(body),
  });

  // Letting a cross-site form reach Sonarr, acting on an id never seen in the queue, or grabbing an item that isn't delayed turns this red.
  assert.equal((await post('/api/queue/sonarr/-51234/grab', {}, { 'Content-Type': 'application/json' })).status, 403);
  assert.equal((await post('/api/queue/sonarr/999/grab')).status, 404);
  assert.equal((await post('/api/queue/radarr/8/grab')).status, 409);
  assert.equal((await post('/api/queue/sonarr/-51234/grab')).status, 204);
  assert.deepEqual(sent, ['sonarr POST /api/v3/queue/grab/-51234']);

  // Removing from rTorrent, or mapping a removal choice to the wrong blocklist and search flags, turns this red.
  sent.length = 0;
  assert.equal((await post('/api/queue/sonarr/-51234/remove', { release: 'everything' })).status, 400);
  for (const release of ['keep', 'blocklist', 'blocklist_search']) {
    assert.equal((await post('/api/queue/sonarr/-51234/remove', { release })).status, 204);
  }
  assert.equal((await post('/api/queue/radarr/8/remove', { release: 'keep' })).status, 502);
  assert.deepEqual(sent, [
    'sonarr DELETE /api/v3/queue/-51234?removeFromClient=false&blocklist=false&skipRedownload=true',
    'sonarr DELETE /api/v3/queue/-51234?removeFromClient=false&blocklist=true&skipRedownload=true',
    'sonarr DELETE /api/v3/queue/-51234?removeFromClient=false&blocklist=true&skipRedownload=false',
    'radarr DELETE /api/v3/queue/8?removeFromClient=false&blocklist=false&skipRedownload=true',
  ]);
});

test('an import is finished by hand only with a complete, conflict-free assignment and hardlinks', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createProblems, listOpenProblems } = await import(problemsModuleUrl);
  const { createManualImport } = await import(manualImportModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-manual-import-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(() => database.close());
  const hash = 'AB'.repeat(20);
  const events = createEventHub();
  const problems = createProblems({ database, events });
  const fake = { hardlinks: true, commands: [] };
  const files = [
    { path: '/downloads/Pack/S01E01.mkv', relativePath: 'S01E01.mkv', size: 1, quality: { quality: { id: 3 }, revision: { version: 2, real: 0 } }, languages: [{ id: 1 }], episodes: [{ id: 101 }], rejections: [{ reason: 'Episode unexpected' }] },
    { path: '/downloads/Pack/S01E02.mkv', relativePath: 'S01E02.mkv', size: 1, quality: { quality: { id: 3 } }, languages: [], episodes: [] },
  ];
  const sonarr = {
    request: async (path, init = {}) => {
      if (init.method === 'POST') {
        fake.commands.push(init.body);
        return { status: 201, body: {} };
      }
      if (path.startsWith('/api/v3/manualimport')) return { status: 200, body: files };
      if (path === '/api/v3/qualitydefinition') return { status: 200, body: [{ quality: { id: 3, name: 'WEBDL-1080p' }, title: 'WEBDL-1080p' }] };
      if (path === '/api/v3/language') return { status: 200, body: [{ id: 1, name: 'English' }] };
      if (path === '/api/v3/episode?seriesId=9') {
        return { status: 200, body: [{ id: 101, seasonNumber: 1, episodeNumber: 1 }, { id: 102, seasonNumber: 1, episodeNumber: 2 }] };
      }
      if (path === '/api/v3/config/mediamanagement') return { status: 200, body: { copyUsingHardlinks: fake.hardlinks } };
      return { status: 200, body: { page: 1, totalRecords: 0, records: [] } };
    },
  };
  const arr = { sonarr, radarr: sonarr };
  const tracker = createGrabTracker({ database, arr, events });
  tracker.recordGrab({ hash, service: 'sonarr', movieId: null, seriesId: 9, episodeIds: [101, 102], releaseTitle: 'Show.S01', indexer: 'BHD', grabbedAt: 1, publishedAt: null, byHand: false });
  const flagged = problems.open({ kind: 'import_matching', subject: { type: 'torrent', service: null, id: hash }, hash, summary: 'Show.S01: Episode unexpected', state: 'needs_you' });
  const manualImport = createManualImport({ database, arr, problems });
  const { app } = await makeApp({ api: createApiRoutes(database, { arr, refresh: tracker.refresh, manualImport }) });
  const { session } = await signIn(app);
  const submit = (assignments) => app.request(`/api/imports/sonarr/${hash}`, {
    method: 'POST', headers: { ...jsonHeaders('https://media.example'), Cookie: session }, body: JSON.stringify({ files: assignments }),
  });
  const file = (path, episodeIds, extra = {}) => ({ path, episodeIds, movieId: null, qualityId: 3, languageIds: [1], ...extra });

  // Losing the original reason or the title's episodes from the view turns this red.
  const view = await (await app.request(`/api/imports/sonarr/${hash}`, { headers: { Cookie: session } })).json();
  assert.deepEqual(view.reasons, ['Show.S01: Episode unexpected']);
  assert.deepEqual(view.target.episodes.map((episode) => episode.code), ['S01E01', 'S01E02']);
  assert.deepEqual(view.files.map((entry) => entry.rejections), [['Episode unexpected'], []]);

  // Accepting two files on one episode, an episode outside the series, a missing language or a file not in the download turns this red.
  for (const [assignments, reason] of [
    [[file(files[0].path, [101]), file(files[1].path, [101])], 'S01E01.mkv and S01E02.mkv are assigned to the same episode.'],
    [[file(files[0].path, [999])], 'S01E01.mkv is assigned to an episode outside this series.'],
    [[file(files[0].path, [101], { languageIds: [] })], 'S01E01.mkv has no language.'],
    [[file(files[0].path, [])], 'S01E01.mkv has no episode.'],
    [[file('/etc/passwd', [101])], 'passwd is not in this download.'],
  ]) {
    const response = await submit(assignments);
    assert.equal(response.status, 400);
    assert.ok((await response.json()).reasons.includes(reason), reason);
  }

  // Importing while Sonarr would copy instead of hardlink turns this red.
  fake.hardlinks = false;
  assert.equal((await submit([file(files[0].path, [101]), file(files[1].path, [102])])).status, 502);
  assert.deepEqual(fake.commands, []);

  // Moving instead of hardlinking, dropping the chosen episode, or leaving the problem open turns this red.
  fake.hardlinks = true;
  assert.equal((await submit([file(files[0].path, [101]), file(files[1].path, [102])])).status, 204);
  assert.equal(fake.commands.length, 1);
  const [command] = fake.commands;
  assert.equal(command.importMode, 'copy');
  assert.deepEqual(command.files.map((entry) => [entry.seriesId, entry.episodeIds, entry.quality.quality.id, entry.quality.revision.version]), [[9, [101], 3, 2], [9, [102], 3, 1]]);
  assert.equal(listOpenProblems(database).some((problem) => problem.id === flagged.id), false);
});

test('tracker messages become cooldowns, retries, rechecks and replacement requests', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTorrentPoller } = await import(torrentsModuleUrl);
  const { createProblems, listOpenProblems } = await import(problemsModuleUrl);
  const { writeDependency } = await import(dependenciesModuleUrl);
  const { classifyMessage, createTrackerWatch, listCooldowns, listIssues } = await import(trackersModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-trackers-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let count = 0;
  const hash = (n) => String(n).repeat(40).slice(0, 40).toUpperCase();
  const row = (h, overrides = {}) => {
    const value = { name: h, size: 1000, completed: 100, state: 1, active: 1, complete: 0, message: '', ...overrides };
    return [h, value.name, value.size, value.completed, 0, 0, value.state, 1, value.active, value.complete, value.message, 0, 0, 0, 0];
  };
  const setup = () => {
    count += 1;
    const database = openDatabase(join(root, `db-${count}`, 'media-manager.sqlite'));
    const clock = { value: 10_000_000 };
    const events = createEventHub();
    const fake = { rows: [], calls: [] };
    const rtorrent = {
      call: async (method, params) => {
        if (method === 't.multicall') return [['https://tracker.example/announce/passkey']];
        if (method === 'd.multicall2') return fake.rows;
        fake.calls.push([method, params[0]]);
        return 0;
      },
    };
    const now = () => clock.value;
    const poller = createTorrentPoller({ database, rtorrent, events, now });
    const problems = createProblems({ database, events, now });
    const watch = createTrackerWatch({ database, rtorrent, problems, events, now });
    const step = async (rows, elapsed = 60_000) => {
      clock.value += elapsed;
      fake.rows = rows;
      await poller.poll();
      await watch.check();
    };
    return { database, clock, events, fake, watch, step, poller };
  };

  // Treating a refusal as a tracker outage, or missing rTorrent's failure wrapper, turns this red.
  await t.test('messages are classified from rTorrent wording', () => {
    assert.deepEqual(classifyMessage(''), { kind: 'clean', text: '' });
    assert.deepEqual(classifyMessage('Tracker: [Failure reason "Your downloading privileges have been disabled! (Read the rules)"]'),
      { kind: 'refusal', text: 'Your downloading privileges have been disabled! (Read the rules)' });
    assert.equal(classifyMessage('Tracker: [Failure reason "Unregistered torrent"]').kind, 'unregistered');
    assert.equal(classifyMessage('Tracker: [Timeout was reached]').kind, 'tracker_down');
    assert.equal(classifyMessage('Tracker: [Couldn\'t resolve host name]').kind, 'tracker_down');
    assert.equal(classifyMessage('Hash check on download completion found bad chunks, consider using "safe_sync".').kind, 'damaged');
    assert.equal(classifyMessage('Something else entirely').kind, 'other');
  });

  // Ignoring a known or unknown refusal, flagging a known one as needing the owner, or never ending the cooldown turns this red.
  await t.test('a refusal on an unfinished torrent starts a cooldown that a clean check-in ends', async () => {
    const { database, step } = setup();
    setSetting(database, 'trackerConfiguration', 'refusalTexts', 'Download rights revoked\n');
    await step([row(hash(1), { message: 'Tracker: [Failure reason "Your downloading privileges have been disabled."]' })]);
    assert.deepEqual(listCooldowns(database).map((cooldown) => [cooldown.host, cooldown.known]), [['tracker.example', true]]);
    assert.equal(listOpenProblems(database)[0].state, 'handling');
    await step([row(hash(1))]);
    assert.deepEqual(listCooldowns(database), []);
    assert.deepEqual(listOpenProblems(database), []);

    await step([row(hash(1), { message: 'Tracker: [Failure reason "Ratio too low, go away"]' })]);
    const [unknown] = listCooldowns(database);
    assert.equal(unknown.known, false);
    assert.equal(unknown.text, 'Ratio too low, go away');
    const [flag] = listOpenProblems(database);
    assert.equal(flag.state, 'needs_you');
    assert.match(flag.summary, /Ratio too low, go away/);

    await step([row(hash(2), { complete: 1, completed: 1000, message: 'Tracker: [Failure reason "Download rights revoked"]' })]);
    assert.equal(listCooldowns(database).length, 1);
    database.close();
  });

  // Retrying more often than every 15 minutes, giving up before six hours, or never handing over turns this red.
  await t.test('a down tracker is asked again every 15 minutes and handed to the stall fix at six hours', async () => {
    const { database, fake, watch, step } = setup();
    const down = row(hash(3), { message: 'Tracker: [Timeout was reached]' });
    await step([down]);
    for (let minute = 1; minute < 360; minute += 1) await step([down], 60_000);
    const announces = fake.calls.filter(([method]) => method === 'd.tracker_announce');
    assert.equal(announces.length, 24);
    assert.equal(watch.replacementRequests().length, 0);
    await step([down], 60_000);
    assert.deepEqual(watch.replacementRequests().map((issue) => [issue.hash, issue.kind]), [[hash(3), 'tracker_down']]);
    database.close();
  });

  // Searching again without the one recheck, rechecking twice, or keeping an issue open after a clean answer turns this red.
  await t.test('unregistered asks for a replacement at once, damaged data is rechecked once first', async () => {
    const { database, fake, watch, step } = setup();
    await step([row(hash(4), { message: 'Tracker: [Failure reason "Unregistered torrent"]' }), row(hash(5), { message: 'Hash check on download completion found bad chunks' })]);
    assert.deepEqual(watch.replacementRequests().map((issue) => issue.hash), [hash(4)]);
    assert.deepEqual(fake.calls, [['d.check_hash', hash(5)]]);
    await step([row(hash(4), { message: 'Tracker: [Failure reason "Unregistered torrent"]' }), row(hash(5), { message: 'Hash check on download completion found bad chunks' })], 31 * 60_000);
    assert.deepEqual(fake.calls, [['d.check_hash', hash(5)]]);
    assert.deepEqual(watch.replacementRequests().map((issue) => issue.hash).sort(), [hash(4), hash(5)].sort());
    watch.replacementHandled(hash(4), 'Grabbed another release.');
    assert.deepEqual(listIssues(database).map((issue) => issue.hash), [hash(5)]);

    const recovering = row(hash(6), { message: 'Tracker: [Timeout was reached]' });
    await step([recovering]);
    await step([row(hash(6))]);
    assert.equal(listIssues(database).some((issue) => issue.hash === hash(6)), false);
    database.close();
  });

  // Acting on stale torrent rows while rTorrent is down turns this red.
  await t.test('nothing is acted on while rTorrent is down', async () => {
    const { database, events, fake, watch, poller } = setup();
    fake.rows = [row(hash(7), { message: 'Tracker: [Timeout was reached]' })];
    await poller.poll();
    writeDependency(database, events, 'rtorrent', 'down', 1, 'rTorrent is unreachable.');
    await watch.check();
    assert.deepEqual(fake.calls, []);
    assert.deepEqual(listIssues(database), []);
    database.close();
  });
});

test('a stalled torrent is replaced without risking a hit and run', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createTorrentPoller } = await import(torrentsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createProblems, listOpenProblems } = await import(problemsModuleUrl);
  const { createTrackerWatch } = await import(trackersModuleUrl);
  const { createStallFix, indexerMatchesHost } = await import(stallsModuleUrl);
  const { createProtection } = await import(protectionModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-stalls-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let count = 0;
  const minute = 60_000;
  const hash = 'AB'.repeat(20);
  const start = Date.parse('2026-10-08T12:00:00Z');

  const setup = async ({ publishedAgoMs = 48 * 60 * minute, completed = 0, files = [[0]], releases, manual = false, message = '' } = {}) => {
    count += 1;
    const database = openDatabase(join(root, `db-${count}`, 'media-manager.sqlite'));
    const clock = { value: start };
    const now = () => clock.value;
    const events = createEventHub();
    const torrent = { completed, down: 0, seeders: 0, scrape: 0 };
    const calls = [];
    const rtorrent = {
      call: async (method, params) => {
        if (method === 'd.multicall2') {
          return [[hash, 'Movie.2024.1080p', 1000, torrent.completed, torrent.down, 0, 1, 1, 1, 0, message, 0, 0, torrent.seeders, torrent.seeders]];
        }
        if (method === 't.multicall') return params[2] === 't.url=' ? [['https://tracker.blutopia.cc/announce/key']] : [[torrent.scrape]];
        if (method === 'f.multicall') return files;
        calls.push([method, ...params]);
        return 0;
      },
    };
    const requests = [];
    const radarr = {
      request: async (path, init = {}) => {
        requests.push([init.method ?? 'GET', path, init.body]);
        if (path.startsWith('/api/v3/queue?')) {
          return { status: 200, body: { totalRecords: 1, records: [{ id: 55, downloadId: hash.toLowerCase(), movieId: 7, title: 'Movie.2024.1080p', status: 'downloading' }] } };
        }
        if (path.startsWith('/api/v3/history/since')) {
          return { status: 200, body: [{ downloadId: hash, movieId: 7, sourceTitle: 'Movie.2024.1080p', date: new Date(start - minute).toISOString(),
            data: { indexer: 'Blutopia (API)', publishedDate: new Date(start - publishedAgoMs).toISOString() } }] };
        }
        if (path.startsWith('/api/v3/release?')) return { status: 200, body: releases };
        return { status: 200, body: {} };
      },
    };
    const sonarr = { request: async () => ({ status: 200, body: { totalRecords: 0, records: [] } }) };
    const arr = { sonarr: { request: async (path) => (path.startsWith('/api/v3/history') ? { status: 200, body: [] } : sonarr.request(path)) }, radarr };
    const poller = createTorrentPoller({ database, rtorrent, events, now });
    const grabs = createGrabTracker({ database, arr, events, now });
    const problems = createProblems({ database, events, now });
    const trackers = createTrackerWatch({ database, rtorrent, problems, events, now });
    if (manual) database.prepare("INSERT INTO protected_items (service, item_id, created_at) VALUES ('radarr', 7, 0)").run();
    const stalls = createStallFix({ database, rtorrent, arr, problems, trackers, now, isManualDownload: createProtection(database, arr).isProtected });
    await grabs.reconcile();
    const tick = async (minutes = 1) => {
      for (let i = 0; i < minutes; i += 1) {
        clock.value += minute;
        await poller.poll();
        await trackers.check();
        await stalls.check();
      }
    };
    return { database, torrent, calls, requests, tick, problems };
  };
  const release = (title, indexer, overrides = {}) => ({ guid: `guid-${title}`, indexerId: title.length, indexer, title, approved: true, ...overrides });
  const grabbedTitles = (requests) => requests.filter(([method, path]) => method === 'POST' && path === '/api/v3/release').map(([, , body]) => body.guid);

  // Matching the wrong host label to an indexer name sends a grab to a tracker on a cooldown.
  await t.test('tracker hosts match indexer names by site label', () => {
    assert.equal(indexerMatchesHost('BeyondHD (API)', 'beyond-hd.me'), true);
    assert.equal(indexerMatchesHost('Blutopia (Prowlarr)', 'tracker.blutopia.cc'), true);
    assert.equal(indexerMatchesHost('PrivateHD', 'blutopia.cc'), false);
  });

  // Moving the one-hour boundary, or applying it to a release under 24 hours old, turns this red.
  await t.test('no seeders is stalled after one hour, or three hours for a new release', async () => {
    const old = await setup({ releases: [] });
    await old.tick(60);
    assert.equal(old.requests.some(([method]) => method === 'DELETE'), false);
    await old.tick(1);
    assert.equal(old.requests.filter(([method]) => method === 'DELETE').length, 1);
    old.database.close();

    const fresh = await setup({ publishedAgoMs: 2 * 60 * minute, releases: [] });
    await fresh.tick(180);
    assert.equal(fresh.requests.some(([method]) => method === 'DELETE'), false);
    await fresh.tick(1);
    assert.equal(fresh.requests.filter(([method]) => method === 'DELETE').length, 1);
    fresh.database.close();
  });

  // Skipping the fresh-peers request, or calling it stalled before 30 minutes after it, turns this red.
  await t.test('seeders with zero speed ask for fresh peers, then stall 30 minutes later', async () => {
    const run = await setup({ releases: [] });
    run.torrent.seeders = 2;
    await run.tick(11);
    assert.deepEqual(run.calls.filter(([method]) => method === 'd.tracker_announce').length, 1);
    await run.tick(29);
    assert.equal(run.requests.some(([method]) => method === 'DELETE'), false);
    await run.tick(1);
    assert.equal(run.requests.filter(([method]) => method === 'DELETE').length, 1);
    run.database.close();
  });

  // Removing the torrent from rTorrent through the queue, picking the same tracker over another, or picking a cooldown tracker turns this red.
  await t.test('the replacement blocks with rTorrent untouched and prefers another tracker off cooldown', async () => {
    const run = await setup({
      releases: [
        release('Same.Tracker', 'Blutopia (API)'),
        release('Rejected', 'PrivateHD', { approved: false, rejected: true }),
        release('Other.Tracker', 'BeyondHD (API)'),
      ],
    });
    run.database.prepare("INSERT INTO tracker_cooldowns VALUES ('privatehd.to', 0, 'x', 1, ?)").run(hash);
    await run.tick(61);
    const [deleted] = run.requests.filter(([method]) => method === 'DELETE');
    assert.equal(deleted[1], '/api/v3/queue/55?removeFromClient=false&blocklist=true&skipRedownload=true');
    assert.deepEqual(grabbedTitles(run.requests), ['guid-Other.Tracker']);
    assert.deepEqual(run.calls.filter(([method]) => method === 'd.erase'), [['d.erase', hash]]);
    await run.tick(120);
    assert.equal(grabbedTitles(run.requests).length, 1);
    run.database.close();

    const onlySame = await setup({ releases: [release('Same.Tracker.2', 'Blutopia (API)'), release('Cooled', 'BeyondHD')] });
    onlySame.database.prepare("INSERT INTO tracker_cooldowns VALUES ('beyond-hd.me', 0, 'x', 1, ?)").run(hash);
    await onlySame.tick(61);
    assert.deepEqual(grabbedTitles(onlySame.requests), ['guid-Same.Tracker.2']);
    onlySame.database.close();
  });

  // Erasing a torrent with any downloaded data, or stopping files that already have data, turns this red.
  await t.test('a partly downloaded torrent stays and only its files at 0% stop', async () => {
    const run = await setup({ completed: 400, files: [[12], [0], [3], [0]], releases: [] });
    await run.tick(61);
    assert.deepEqual(run.calls.filter(([method]) => method === 'd.erase'), []);
    assert.deepEqual(run.calls.filter(([method]) => method === 'f.priority.set'), [['f.priority.set', `${hash}:f1`, 0], ['f.priority.set', `${hash}:f3`, 0]]);
    assert.deepEqual(run.calls.filter(([method]) => method === 'd.update_priorities'), [['d.update_priorities', hash]]);
    run.database.close();
  });

  // Asking the stall fix again while the kept partial torrent still says unregistered grabs a new release every check.
  await t.test('a tracker-requested replacement grabs once while the kept torrent keeps its message', async () => {
    const run = await setup({ completed: 400, files: [[12], [0]], message: 'Unregistered torrent', releases: [release('Another', 'BeyondHD')] });
    await run.tick(10);
    assert.deepEqual(grabbedTitles(run.requests), ['guid-Another']);
    assert.equal(run.database.prepare("SELECT COUNT(*) AS count FROM problems WHERE kind = 'stalled'").get().count, 1);
    run.database.close();
  });

  // Searching after the third release, or grabbing for a manual download, turns this red.
  await t.test('the third failed release and manual downloads stop at needing the owner', async () => {
    const limited = await setup({ releases: [release('Another', 'BeyondHD')] });
    limited.problems.recordReleaseAttempt({ type: 'movie', service: 'radarr', id: '7' }, 'first');
    limited.problems.recordReleaseAttempt({ type: 'movie', service: 'radarr', id: '7' }, 'second');
    await limited.tick(61);
    assert.deepEqual(grabbedTitles(limited.requests), []);
    assert.match(listOpenProblems(limited.database).find((problem) => problem.kind === 'stalled').steps.at(-1).text, /Gave up after 3/);
    limited.database.close();

    const manual = await setup({ manual: true, releases: [release('Another', 'BeyondHD')] });
    await manual.tick(61);
    assert.deepEqual(grabbedTitles(manual.requests), []);
    assert.equal(listOpenProblems(manual.database).find((problem) => problem.kind === 'stalled').state, 'needs_you');
    manual.database.close();
  });
});

test('missing movies and episodes are searched when they come out and every six hours after', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createProblems, subjectHistory } = await import(problemsModuleUrl);
  const { writeDependency } = await import(dependenciesModuleUrl);
  const { createSearchScheduler, searchDueAt } = await import(searchesModuleUrl);
  const { createProtection } = await import(protectionModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-searches-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const minute = 60_000;
  const hour = 60 * minute;

  // Searching before availability, before the 15-minute grace after adding, or more often than six hours turns this red.
  await t.test('the due time follows availability, the add grace and the six-hour repeat', () => {
    assert.equal(searchDueAt({ availableAt: 10 * hour, addedAt: 0, lastSearchAt: null }), 10 * hour);
    assert.equal(searchDueAt({ availableAt: 10 * hour, addedAt: 10 * hour - minute, lastSearchAt: null }), 10 * hour + 14 * minute);
    assert.equal(searchDueAt({ availableAt: 10 * hour, addedAt: 0, lastSearchAt: 9 * hour }), 10 * hour);
    assert.equal(searchDueAt({ availableAt: 10 * hour, addedAt: 0, lastSearchAt: 11 * hour }), 17 * hour);
  });

  // Sending a second search before Sonarr updates its last-search time, searching a queued or protected manual download, or searching while Sonarr is down turns this red.
  await t.test('the scheduler searches each due item once, skips queued and manual ones and pauses with the service', async () => {
    const database = openDatabase(join(root, 'scheduler', 'media-manager.sqlite'));
    const events = createEventHub();
    const clock = { value: Date.parse('2026-10-08T20:00:00Z') };
    const now = () => clock.value;
    const commands = [];
    const episodes = [
      { id: 1, monitored: true, hasFile: false, airDateUtc: '2026-10-08T20:00:00Z', seasonNumber: 1, episodeNumber: 1, series: { title: 'Show', added: '2025-01-01T00:00:00Z' } },
      { id: 2, monitored: true, hasFile: false, airDateUtc: '2026-10-08T14:00:00Z', lastSearchTime: '2026-10-08T15:00:00Z', seasonNumber: 1, episodeNumber: 2, series: { title: 'Show', added: '2025-01-01T00:00:00Z' } },
      { id: 3, monitored: true, hasFile: false, airDateUtc: '2026-10-01T00:00:00Z', seasonNumber: 1, episodeNumber: 3, series: { title: 'Show', added: '2025-01-01T00:00:00Z' } },
      { id: 4, monitored: true, hasFile: false, airDateUtc: '2026-10-01T00:00:00Z', seasonNumber: 1, episodeNumber: 4, series: { title: 'Show', added: '2025-01-01T00:00:00Z' } },
    ];
    const movies = [
      { id: 7, title: 'Movie', monitored: true, hasFile: false, isAvailable: true, added: '2026-10-08T19:55:00Z' },
      { id: 8, title: 'Later', monitored: true, hasFile: false, isAvailable: false, added: '2026-01-01T00:00:00Z' },
    ];
    const arr = {
      sonarr: { request: async (path, init = {}) => {
        if (init.method === 'POST') { commands.push(['sonarr', init.body]); return { status: 201, body: {} }; }
        return { status: 200, body: { totalRecords: episodes.length, records: episodes } };
      } },
      radarr: { request: async (path, init = {}) => {
        if (init.method === 'POST') { commands.push(['radarr', init.body]); return { status: 201, body: {} }; }
        return { status: 200, body: movies };
      } },
    };
    database.prepare(`INSERT INTO arr_queue (service, queue_id, download_id, movie_id, series_id, episode_id, title, status, tracked_status,
      tracked_state, status_messages, error_message, indexer, protocol, quality, formats, format_score, size_bytes, size_left_bytes)
      VALUES ('sonarr', 1, NULL, NULL, 1, 3, 'x', 'delay', 'ok', 'downloading', '[]', '', '', 'torrent', '', '[]', 0, 0, 0)`).run();
    const problems = createProblems({ database, events, now });
    database.prepare("INSERT INTO protected_items (service, item_id, series_id, season_number, episode_number, created_at) VALUES ('sonarr', 4, 1, 1, 4, 0)").run();
    const scheduler = createSearchScheduler({ database, arr, problems, now, isManualDownload: createProtection(database, arr).isProtected });

    await scheduler.check();
    assert.deepEqual(commands, [['sonarr', { name: 'EpisodeSearch', episodeIds: [1] }]]);
    assert.equal(subjectHistory(database, { type: 'episode', service: 'sonarr', id: '1' })[0].state, 'resolved');

    clock.value += 2 * minute;
    await scheduler.check();
    assert.equal(commands.length, 1);

    clock.value = Date.parse('2026-10-08T20:10:00Z');
    await scheduler.check();
    assert.deepEqual(commands.at(-1), ['radarr', { name: 'MoviesSearch', movieIds: [7] }]);

    clock.value = Date.parse('2026-10-08T21:00:00Z');
    await scheduler.check();
    assert.deepEqual(commands.at(-1), ['sonarr', { name: 'EpisodeSearch', episodeIds: [2] }]);
    assert.equal(commands.length, 3);

    writeDependency(database, events, 'sonarr', 'down', 0, 'Sonarr is unreachable.');
    clock.value = Date.parse('2026-10-09T03:00:00Z');
    await scheduler.check();
    assert.equal(commands.some(([service], index) => index >= 3 && service === 'sonarr'), false);
    database.close();
  });
});

test('blocked imports are cleared, forced, retried or flagged by reason', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createProblems, listOpenProblems } = await import(problemsModuleUrl);
  const { readDependency } = await import(dependenciesModuleUrl);
  const { classifyImport, createImportFix } = await import(importsModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-imports-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let count = 0;
  const minute = 60_000;
  const hash = 'EE'.repeat(20);

  // Reordering the patterns so a setup or bad-release message reads as something milder turns this red.
  await t.test('Sonarr and Radarr wording maps to the AA-13 groups', () => {
    const cases = [
      ['Not enough free space', 'setup'],
      ['Caution: Found executable file with extension: .exe', 'bad_release'],
      ['No audio tracks detected', 'bad_release'],
      ['Episode file already imported at 2026-10-08', 'leftover'],
      ['Not an upgrade for existing episode file(s)', 'not_better'],
      ['File is locked by another process', 'temporary'],
      ['Episode has a TBA title and recently aired', 'temporary'],
      ['Failed to move file', 'file_move'],
      ['Found matching series via grab history, but release was matched to series by ID. Automatic import is not possible.', 'matching'],
      ['Series title mismatch, automatic import is not possible.', 'matching'],
      ['Something new', 'unknown'],
    ];
    for (const [message, category] of cases) assert.equal(classifyImport([message]), category, message);
  });

  const setup = async ({ message, byHand = false, movie = false, files = [] }) => {
    count += 1;
    const database = openDatabase(join(root, `db-${count}`, 'media-manager.sqlite'));
    const clock = { value: Date.parse('2026-10-08T12:00:00Z') };
    const now = () => clock.value;
    const events = createEventHub();
    const requests = [];
    const queue = [{
      id: 9, downloadId: hash, ...(movie ? { movieId: 7 } : { seriesId: 3, episodeId: 31 }), title: 'Release.Title',
      status: 'completed', trackedDownloadStatus: 'warning', trackedDownloadState: 'importBlocked',
      statusMessages: [{ title: 'Release.Title.mkv', messages: [message] }],
    }];
    const service = (name) => ({
      request: async (path, init = {}) => {
        requests.push([name, init.method ?? 'GET', path, init.body]);
        if (path.startsWith('/api/v3/queue?')) return { status: 200, body: { totalRecords: name === (movie ? 'radarr' : 'sonarr') ? 1 : 0, records: name === (movie ? 'radarr' : 'sonarr') ? queue : [] } };
        if (path.startsWith('/api/v3/history/since')) return { status: 200, body: [] };
        if (path.startsWith('/api/v3/manualimport')) return { status: 200, body: files };
        return { status: 200, body: {} };
      },
    });
    const arr = { sonarr: service('sonarr'), radarr: service('radarr') };
    const grabs = createGrabTracker({ database, arr, events, now });
    grabs.recordGrab({ hash, service: movie ? 'radarr' : 'sonarr', movieId: movie ? 7 : null, seriesId: movie ? null : 3, episodeIds: movie ? [] : [31, 32],
      releaseTitle: 'Release.Title', indexer: 'Blutopia', grabbedAt: clock.value, publishedAt: null, byHand });
    await grabs.reconcile();
    requests.length = 0;
    const problems = createProblems({ database, events, now });
    const fix = createImportFix({ database, arr, problems, events, now });
    const writes = () => requests.filter(([, method]) => method !== 'GET').map(([name, method, path, body]) => [name, method, path, body?.name]);
    return { database, clock, fix, writes, requests, problems, queue, grabs };
  };

  // Touching rTorrent from the queue, importing a not-better automatic grab, or handling a replace's own import here turns this red.
  await t.test('leftovers and not-better automatic grabs leave the queue with rTorrent untouched; a replace is left alone', async () => {
    for (const message of ['Episode file already imported', 'Not an upgrade for existing episode file(s)']) {
      const run = await setup({ message });
      await run.fix.check();
      assert.deepEqual(run.writes(), [['sonarr', 'DELETE', '/api/v3/queue/9?removeFromClient=false&blocklist=false&skipRedownload=true', undefined]]);
      await run.fix.check();
      assert.equal(run.writes().length, 1);
      run.database.close();
    }
    const replace = await setup({ message: 'Not an upgrade for existing episode file(s)', byHand: true });
    await replace.fix.check();
    assert.deepEqual(replace.writes(), []);
    assert.deepEqual(listOpenProblems(replace.database), []);
    replace.database.close();
  });

  // Importing a file onto an episode outside the grab record turns this red.
  await t.test('matching doubts are forced only onto what was grabbed', async () => {
    const good = await setup({ message: 'Series title mismatch, automatic import is not possible.', files: [
      { path: '/files/Sonarr/a.mkv', quality: { quality: { id: 3 } }, languages: [], episodes: [{ id: 31 }] },
      { path: '/files/Sonarr/b.mkv', quality: { quality: { id: 3 } }, languages: [], episodes: [{ id: 32 }] },
    ] });
    await good.fix.check();
    const command = good.requests.find(([, method, path]) => method === 'POST' && path === '/api/v3/command');
    assert.equal(command[3].name, 'ManualImport');
    assert.equal(command[3].importMode, 'copy');
    assert.deepEqual(command[3].files.map((file) => file.episodeIds), [[31], [32]]);
    good.database.close();

    const stray = await setup({ message: 'Series title mismatch, automatic import is not possible.', files: [
      { path: '/files/Sonarr/c.mkv', episodes: [{ id: 99 }] },
    ] });
    await stray.fix.check();
    assert.deepEqual(stray.writes(), []);
    const [flag] = listOpenProblems(stray.database);
    assert.equal(flag.state, 'needs_you');
    assert.match(flag.steps.at(-1).text, /doesn't match the episodes/);
    stray.database.close();
  });

  // Not counting a bad release toward the limit, or searching again after the third, turns this red.
  await t.test('a bad release is blocked and searched again until the third release', async () => {
    const first = await setup({ message: 'No audio tracks detected', movie: true });
    await first.fix.check();
    assert.deepEqual(first.writes(), [['radarr', 'DELETE', '/api/v3/queue/9?removeFromClient=false&blocklist=true&skipRedownload=false', undefined]]);
    first.database.close();

    const third = await setup({ message: 'No audio tracks detected', movie: true });
    third.problems.recordReleaseAttempt({ type: 'movie', service: 'radarr', id: '7' }, 'one');
    third.problems.recordReleaseAttempt({ type: 'movie', service: 'radarr', id: '7' }, 'two');
    await third.fix.check();
    assert.deepEqual(third.writes(), [['radarr', 'DELETE', '/api/v3/queue/9?removeFromClient=false&blocklist=true&skipRedownload=true', undefined]]);
    assert.equal(listOpenProblems(third.database)[0].state, 'needs_you');
    third.database.close();
  });

  // Retrying sooner than the spacing, or never flagging, turns this red.
  await t.test('temporary blocks retry every 15 minutes for 24 hours; failed moves retry at 5, 30 and 120 minutes', async () => {
    const temporary = await setup({ message: 'File is locked by another process' });
    await temporary.fix.check();
    temporary.clock.value += 14 * minute;
    await temporary.fix.check();
    assert.equal(temporary.writes().length, 1);
    temporary.clock.value += minute;
    await temporary.fix.check();
    assert.equal(temporary.writes().length, 2);
    temporary.clock.value += 24 * 60 * minute;
    await temporary.fix.check();
    assert.equal(temporary.writes().length, 2);
    assert.equal(listOpenProblems(temporary.database)[0].state, 'needs_you');
    temporary.database.close();

    const move = await setup({ message: 'Failed to move file' });
    const retries = [];
    for (let elapsed = 0; elapsed <= 274; elapsed += 1) {
      await move.fix.check();
      if (move.writes().length > retries.length) retries.push(elapsed);
      move.clock.value += minute;
    }
    assert.deepEqual(retries, [5, 35, 155]);
    assert.equal(listOpenProblems(move.database)[0].state, 'handling');
    await move.fix.check();
    assert.equal(listOpenProblems(move.database)[0].state, 'needs_you');
    move.database.close();
  });

  // Dropping the check that closes retries whose download left the blocked set turns this red.
  await t.test('a temporary block or failed move that clears after a retry resolves its problem', async () => {
    for (const message of ['File is locked by another process', 'Failed to move file']) {
      const run = await setup({ message });
      await run.fix.check();
      run.clock.value += 5 * minute;
      await run.fix.check();
      assert.equal(run.writes().length, 1, message);
      run.queue.length = 0;
      await run.grabs.reconcile();
      await run.fix.check();
      assert.deepEqual(listOpenProblems(run.database), [], message);
      assert.equal(run.database.prepare('SELECT done FROM import_handling').get().done, 1, message);
      run.database.close();
    }
  });

  // Resolving only the problem named by the latest block kind leaves the first one open when a locked file then fails to move.
  await t.test('a block that changes kind before clearing resolves every import problem on the download', async () => {
    const run = await setup({ message: 'File is locked by another process' });
    await run.fix.check();
    run.queue[0].statusMessages = [{ title: 'Release.Title.mkv', messages: ['Failed to move file'] }];
    await run.grabs.reconcile();
    run.clock.value += 5 * minute;
    await run.fix.check();
    assert.ok(listOpenProblems(run.database).length >= 1);
    run.queue.length = 0;
    await run.grabs.reconcile();
    await run.fix.check();
    assert.deepEqual(listOpenProblems(run.database), []);
    run.database.close();
  });

  // Letting import fixes run while setup is broken, or never resuming them, turns this red.
  await t.test('a setup problem pauses import fixes until it is gone', async () => {
    const run = await setup({ message: 'Not enough free space' });
    await run.fix.check();
    assert.equal(readDependency(run.database, 'imports').state, 'down');
    assert.equal(listOpenProblems(run.database)[0].state, 'needs_you');
    run.database.prepare('DELETE FROM arr_queue').run();
    await run.fix.check();
    assert.equal(readDependency(run.database, 'imports').state, 'ok');
    run.database.close();
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

// Routing an identifier to the wrong service, letting one failed service hide the other's results, sorting library matches after new ones, or passing a service-local image URL to the browser breaks search.
test('one search routes to Sonarr and Radarr and reports each outcome', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { deleteSetting, setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createSearch, parseSearchQuery } = await import(searchModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-search-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const sonarrKey = `sonarr-key-${process.pid}-distinctive`;
  const radarrKey = `radarr-key-${process.pid}-distinctive`;
  const configure = () => {
    setSetting(database, 'serviceAddresses', 'sonarr.url', 'http://127.0.0.1:65011');
    setSetting(database, 'serviceAddresses', 'radarr.url', 'http://127.0.0.1:65012/');
    setSetting(database, 'credentials', 'sonarr.apiKey', sonarrKey);
    setSetting(database, 'credentials', 'radarr.apiKey', radarrKey);
  };
  configure();
  const poster = (remoteUrl) => [
    { coverType: 'banner', remoteUrl: 'https://artworks.example/banner.jpg' },
    { coverType: 'poster', url: `/MediaCover/1/poster.jpg?apikey=${sonarrKey}`, remoteUrl },
  ];
  const shows = [
    { title: 'Dune: Prophecy', year: 2024, tvdbId: 1, network: 'HBO', status: 'continuing', ratings: { value: 7.4 }, overview: 'Sisters.', images: poster('https://artworks.example/1.jpg') },
    { title: 'Dune', year: 2000, tvdbId: 2, id: 9, network: 'Sci Fi', status: 'ended', images: poster(`/MediaCover/2/poster.jpg?apikey=${sonarrKey}`) },
    { title: 'Dune', tvdbId: 2 },
    { title: '', tvdbId: 3 },
  ];
  const movies = [
    { title: 'Dune', year: 2021, tmdbId: 438631, imdbId: 'tt1160419', studio: 'Legendary', status: 'released', ratings: { imdb: { value: 8 }, tmdb: { value: 7.8 } }, images: poster('https://image.tmdb.example/dune.jpg') },
    { title: 'Dune', year: 1984, tmdbId: 841, id: 4, ratings: { tmdb: { value: 0 }, imdb: { value: 6.3 } } },
  ];
  let responders;
  const calls = [];
  const fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    const service = parsed.port === '65011' ? 'sonarr' : 'radarr';
    calls.push({ service, path: parsed.pathname, term: parsed.searchParams.get('term'), key: new Headers(init.headers).get('x-api-key') });
    return responders[service]();
  };
  const ok = (body) => () => new Response(JSON.stringify(body), { status: 200 });
  const search = createSearch({ sonarr: createArr('sonarr', database, { fetch }), radarr: createArr('radarr', database, { fetch }) });
  const run = async (text) => {
    calls.length = 0;
    return search.search(parseSearchQuery(text));
  };

  responders = { sonarr: ok(shows), radarr: ok(movies) };
  const both = await run('  Dune ');
  assert.deepEqual(calls.map(({ service, path, term, key }) => [service, path, term, key]), [
    ['sonarr', '/api/v3/series/lookup', 'Dune', sonarrKey],
    ['radarr', '/api/v3/movie/lookup', 'Dune', radarrKey],
  ]);
  assert.deepEqual(both.services, { sonarr: { kind: 'ok', count: 2 }, radarr: { kind: 'ok', count: 2 } });
  assert.deepEqual(both.results.map((result) => [result.key, result.inLibrary]), [
    ['tvdb:2', true], ['tmdb:841', true], ['tvdb:1', false], ['tmdb:438631', false],
  ]);
  const [libraryShow, libraryMovie, show, movie] = both.results;
  assert.deepEqual(show, {
    type: 'tv', service: 'sonarr', key: 'tvdb:1', title: 'Dune: Prophecy', year: 2024, network: 'HBO', status: 'continuing',
    rating: 7.4, overview: 'Sisters.', posterUrl: 'https://artworks.example/1.jpg', inLibrary: false, libraryId: null,
    tvdbId: 1, tmdbId: null, imdbId: null,
  });
  assert.equal(libraryShow.libraryId, 9);
  assert.equal(libraryShow.posterUrl, null);
  assert.equal(movie.network, 'Legendary');
  assert.equal(movie.rating, 7.8);
  assert.equal(libraryMovie.rating, 6.3);
  assert.equal(JSON.stringify(both).includes('apikey'), false);

  for (const [text, expected] of [
    ['tvdb:81189', [['sonarr', 'tvdb:81189']]],
    ['TMDB: 0438631', [['radarr', 'tmdb:438631']]],
    ['tt1160419', [['sonarr', 'imdb:tt1160419'], ['radarr', 'imdb:tt1160419']]],
    ['imdb:TT1160419', [['sonarr', 'imdb:tt1160419'], ['radarr', 'imdb:tt1160419']]],
    ['tvdb 81189', [['sonarr', 'tvdb 81189'], ['radarr', 'tvdb 81189']]],
  ]) {
    const result = await run(text);
    assert.deepEqual(calls.map(({ service, term }) => [service, term]), expected, text);
    if (expected.length === 1) assert.deepEqual(result.services[expected[0][0] === 'sonarr' ? 'radarr' : 'sonarr'], { kind: 'skipped' }, text);
  }

  for (const [label, sonarr, kind] of [
    ['401', () => new Response('', { status: 401 }), 'rejected'],
    ['network failure', () => { throw new TypeError('fetch failed'); }, 'unreachable'],
    ['500', () => new Response('', { status: 500 }), 'unreachable'],
    ['not a list', ok({ title: 'Dune' }), 'unreachable'],
  ]) {
    responders = { sonarr, radarr: ok(movies) };
    const partial = await run('Dune');
    assert.deepEqual(partial.services, { sonarr: { kind }, radarr: { kind: 'ok', count: 2 } }, label);
    assert.deepEqual(partial.results.map((result) => result.service), ['radarr', 'radarr'], label);
  }

  responders = { sonarr: ok([]), radarr: ok([]) };
  assert.deepEqual(await run('zzzz'), { results: [], services: { sonarr: { kind: 'ok', count: 0 }, radarr: { kind: 'ok', count: 0 } } });

  deleteSetting(database, 'credentials', 'radarr.apiKey');
  responders = { sonarr: ok(shows), radarr: () => assert.fail('unconfigured Radarr was called') };
  assert.deepEqual((await run('Dune')).services.radarr, { kind: 'not_configured' });
  configure();

  for (const text of ['', '   ', 'x'.repeat(201)]) assert.equal(parseSearchQuery(text), undefined, JSON.stringify(text));
});

// Sending the owner's choices under the wrong fields, dropping the lookup record, saving defaults from a refused add, or offering defaults whose profile is gone breaks adding a title.
test('adding a title sends the monitor decision and remembers it as the next default', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createAdd, parseMovieChoices, parseSeriesChoices } = await import(addModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-add-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  for (const [service, port] of [['sonarr', 65021], ['radarr', 65022]]) {
    setSetting(database, 'serviceAddresses', `${service}.url`, `http://127.0.0.1:${port}`);
    setSetting(database, 'credentials', `${service}.apiKey`, `${service}-key`);
  }
  let profiles = [{ id: 4, name: 'HD-1080p' }, { id: 6, name: 'Ultra-HD' }];
  const folders = [{ path: '/home/owner/TV', freeSpace: 10 }];
  let addResponse = { status: 201, body: { id: 77 } };
  const posts = [];
  const fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    const path = parsed.pathname;
    if (init.method === 'POST') {
      posts.push({ path, body: JSON.parse(init.body) });
      return new Response(JSON.stringify(addResponse.body), { status: addResponse.status });
    }
    const body = path.endsWith('/qualityprofile') ? profiles
      : path.endsWith('/rootfolder') ? folders
        : path.endsWith('/series/lookup') ? [{ title: 'Other', tvdbId: 1 }, { title: 'Severance', tvdbId: 371980, seasons: [{ seasonNumber: 1 }] }]
          : [{ title: 'Dune', tmdbId: 438631, images: [] }];
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const add = createAdd(database, { sonarr: createArr('sonarr', database, { fetch }), radarr: createArr('radarr', database, { fetch }) });
  const series = {
    monitor: 'none', monitorNewSeasons: true, qualityProfileId: 6, rootFolderPath: '/home/owner/TV',
    seasonFolder: true, seriesType: 'standard', searchOnAdd: false,
  };

  assert.deepEqual(await add.options('sonarr'), { kind: 'ok', qualityProfiles: profiles, rootFolders: folders, defaults: null });

  assert.deepEqual(await add.addSeries(371980, series), { kind: 'added', libraryId: 77 });
  assert.deepEqual(posts.at(-1), {
    path: '/api/v3/series',
    body: {
      title: 'Severance', tvdbId: 371980, seasons: [{ seasonNumber: 1 }],
      qualityProfileId: 6, rootFolderPath: '/home/owner/TV', seasonFolder: true, seriesType: 'standard',
      monitored: true, monitorNewItems: 'all',
      addOptions: { monitor: 'none', searchForMissingEpisodes: false, searchForCutoffUnmetEpisodes: false },
    },
  });
  assert.deepEqual((await add.options('sonarr')).defaults, series);

  addResponse = { status: 400, body: [{ propertyName: 'TvdbId', errorMessage: 'This series has already been added' }] };
  assert.deepEqual(await add.addSeries(371980, { ...series, qualityProfileId: 4 }), { kind: 'refused', reason: 'This series has already been added' });
  assert.deepEqual((await add.options('sonarr')).defaults, series);
  assert.deepEqual(await add.addSeries(5, series), { kind: 'not_found' });

  profiles = [{ id: 4, name: 'HD-1080p' }];
  assert.equal((await add.options('sonarr')).defaults, null);

  addResponse = { status: 201, body: { id: 12 } };
  const movie = { monitor: 'none', minimumAvailability: 'inCinemas', qualityProfileId: 4, rootFolderPath: '/home/owner/TV', searchOnAdd: true };
  assert.deepEqual(await add.addMovie(438631, movie), { kind: 'added', libraryId: 12 });
  const { body } = posts.at(-1);
  assert.equal(posts.at(-1).path, '/api/v3/movie');
  assert.equal(body.title, 'Dune');
  assert.equal(body.monitored, false);
  assert.equal(body.minimumAvailability, 'inCinemas');
  assert.deepEqual(body.addOptions, { monitor: 'none', searchForMovie: true });

  assert.equal(parseSeriesChoices({ ...series, monitor: 'everything' }), undefined);
  assert.equal(parseSeriesChoices({ ...series, qualityProfileId: '6' }), undefined);
  assert.equal(parseMovieChoices({ ...movie, minimumAvailability: 'tba' }), undefined);
});

// Searching again when results are stored, losing stored results on a failed refresh, dropping rejected releases, misreading either service's indexer flags, or running two searches for one target at once breaks Pick a release.
test('interactive searches are kept with their age and refreshed only on request', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createReleases } = await import(releasesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-releases-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  for (const [service, port] of [['sonarr', 65031], ['radarr', 65032]]) {
    setSetting(database, 'serviceAddresses', `${service}.url`, `http://127.0.0.1:${port}`);
    setSetting(database, 'credentials', `${service}.apiKey`, `${service}-key`);
  }
  const sonarrReleases = [
    {
      guid: 'g1', indexerId: 3, indexer: 'Blutopia', title: 'Show.S01E02.1080p.WEB-DL', quality: { quality: { name: 'WEBDL-1080p' } },
      size: 2_000_000_000, ageHours: 5.5, seeders: 40, leechers: 2, approved: true, rejections: [], customFormatScore: 1200,
      customFormats: [{ name: 'HQ' }], indexerFlags: 1 | 32, protocol: 'torrent',
    },
    {
      guid: 'g2', indexerId: 3, title: 'Show.S01E02.720p.HDTV', quality: { quality: { name: 'HDTV-720p' } }, approved: false,
      rejections: [{ reason: 'Not an upgrade for existing episode file(s)' }], indexerFlags: 0, seeders: 0,
    },
    { guid: '', indexerId: 3, title: 'broken' },
  ];
  let sonarr = () => new Response(JSON.stringify(sonarrReleases), { status: 200 });
  const paths = [];
  let releaseCalls = 0;
  let release;
  const fetch = async (url) => {
    const parsed = new URL(String(url));
    paths.push(`${parsed.port}${parsed.pathname}${parsed.search}`);
    if (parsed.pathname === '/api/v3/release') {
      releaseCalls += 1;
      if (parsed.port === '65032') {
        return new Response(JSON.stringify([{ guid: 'm1', indexerId: 7, title: 'Movie.2021.2160p', approved: true, rejections: [], indexerFlags: ['G_Freeleech75', 'Nuked'] }]), { status: 200 });
      }
      await release;
      return sonarr();
    }
    if (parsed.pathname === '/api/v3/history/series') {
      return new Response(JSON.stringify([
        { eventType: 'grabbed', sourceTitle: 'show.s01e02.720p.hdtv', date: '2026-10-01T10:00:00Z' },
        { eventType: 'downloadFolderImported', sourceTitle: 'Show.S01E02.720p.HDTV' },
      ]), { status: 200 });
    }
    if (parsed.pathname === '/api/v3/blocklist') {
      return new Response(JSON.stringify({ records: [{ sourceTitle: 'Show.S01E02.720p.HDTV', date: '2026-10-02T10:00:00Z' }] }), { status: 200 });
    }
    return new Response('', { status: 500 });
  };
  let clock = 1_000;
  const releases = createReleases(database, { sonarr: createArr('sonarr', database, { fetch }), radarr: createArr('radarr', database, { fetch }) }, () => clock);
  const episode = { service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 50 };

  const first = await releases.get(episode);
  assert.equal(first.kind, 'ok');
  assert.equal(first.search.fetchedAt, 1_000);
  assert.ok(paths.includes('65031/api/v3/release?episodeId=50'), paths.join());
  assert.deepEqual(first.search.releases.map((item) => [item.guid, item.approved, item.flags, item.rejections]), [
    ['g1', true, ['Freeleech', 'Internal'], []],
    ['g2', false, [], ['Not an upgrade for existing episode file(s)']],
  ]);
  assert.deepEqual(first.search.releases[0].past, []);
  assert.deepEqual(first.search.releases[1].past, [
    { kind: 'grabbed', at: '2026-10-01T10:00:00Z' },
    { kind: 'blocklisted', at: '2026-10-02T10:00:00Z' },
  ]);
  assert.equal(first.search.releases[0].quality, 'WEBDL-1080p');
  assert.deepEqual(first.search.releases[0].customFormats, ['HQ']);

  clock = 5_000;
  const stored = await releases.get(episode);
  assert.equal(releaseCalls, 1);
  assert.equal(stored.search.fetchedAt, 1_000);

  let unblock;
  release = new Promise((resolve) => { unblock = resolve; });
  sonarrReleases.splice(1, 1);
  const refreshes = [releases.refresh(episode), releases.refresh(episode)];
  assert.equal((await releases.get(episode)).refreshing, true);
  unblock();
  const [refreshedA, refreshedB] = await Promise.all(refreshes);
  assert.equal(releaseCalls, 2);
  assert.equal(refreshedA, refreshedB);
  assert.equal(refreshedA.search.fetchedAt, 5_000);
  assert.deepEqual(refreshedA.search.releases.map((item) => item.guid), ['g1']);
  release = undefined;

  sonarr = () => new Response('', { status: 503 });
  const failed = await releases.refresh(episode);
  assert.equal(failed.kind, 'unreachable');
  assert.equal(failed.stored.fetchedAt, 5_000);
  assert.deepEqual((await releases.get(episode)).search.releases.map((item) => item.guid), ['g1']);

  const movie = await releases.get({ service: 'radarr', kind: 'movie', movieId: 9 });
  assert.deepEqual(movie.search.releases[0].flags, ['Freeleech 75%', 'Nuked']);
  assert.equal(releases.find({ service: 'radarr', kind: 'movie', movieId: 9 }, 'm1').title, 'Movie.2021.2160p');
});

// Grabbing through /release/push or without the stored release, reporting a refused grab as sent, losing the downloadId, or recording the searched target instead of an override breaks hand grabs and the replace that follows them.
test('a hand grab is recorded before it is sent and keeps what it is for', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createReleases } = await import(releasesModuleUrl);
  const { createGrabs, parseOverrides } = await import(grabsModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-grabs-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  setSetting(database, 'serviceAddresses', 'sonarr.url', 'http://127.0.0.1:65041');
  setSetting(database, 'credentials', 'sonarr.apiKey', 'sonarr-key');
  const quality = { quality: { id: 3, name: 'WEBDL-1080p' }, revision: { version: 2, real: 0, isRepack: false } };
  const posts = [];
  let grabResponse = () => new Response('{}', { status: 200 });
  const fetch = async (url, init = {}) => {
    const { pathname } = new URL(String(url));
    if (init.method === 'POST') {
      posts.push({ pathname, body: JSON.parse(init.body) });
      return grabResponse();
    }
    if (pathname === '/api/v3/release') {
      return new Response(JSON.stringify([{
        guid: 'g-rejected', indexerId: 3, title: 'Show.S01E02.720p', approved: false, quality, languages: [{ id: 1, name: 'English' }],
        rejections: ['Not an upgrade for existing episode file(s)'],
      }]), { status: 200 });
    }
    if (pathname === '/api/v3/history') {
      return new Response(JSON.stringify({ records: [
        { downloadId: 'OTHER', data: { guid: 'g-other' } },
        { downloadId: 'ABC123HASH', data: { guid: 'g-rejected' } },
      ] }), { status: 200 });
    }
    if (pathname === '/api/v3/qualitydefinition') {
      return new Response(JSON.stringify([{ quality: { id: 3, name: 'WEBDL-1080p' } }, { quality: { id: 4, name: 'HDTV-720p', resolution: 720 } }]), { status: 200 });
    }
    return new Response('[]', { status: 200 });
  };
  const sonarr = createArr('sonarr', database, { fetch });
  const releases = createReleases(database, { sonarr, radarr: sonarr });
  const changes = [];
  const grabs = createGrabs(database, { sonarr, radarr: sonarr }, releases, { onChange: (record) => changes.push(record.state) });
  const target = { service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 50 };

  assert.deepEqual(await grabs.grab(target, 'g-rejected', 'replace'), { kind: 'unknown_release' });
  await releases.get(target);

  const sent = await grabs.grab(target, 'g-rejected', 'replace');
  assert.equal(sent.kind, 'sent');
  assert.deepEqual(posts.at(-1), { pathname: '/api/v3/release', body: { guid: 'g-rejected', indexerId: 3, downloadAllowed: true } });
  assert.deepEqual(changes, ['sending', 'sent', 'sent']);
  assert.equal(sent.record.downloadId, 'ABC123HASH');
  assert.equal(sent.record.intent, 'replace');
  assert.deepEqual(grabs.pending('replace').map((record) => record.id), [sent.record.id]);

  const overrides = parseOverrides({ seriesId: 5, episodeIds: [51, 52], qualityId: 4 }, 'sonarr');
  const overridden = await grabs.grab(target, 'g-rejected', 'grab', overrides);
  assert.deepEqual(posts.at(-1).body, {
    guid: 'g-rejected', indexerId: 3, downloadAllowed: true, shouldOverride: true,
    quality: { quality: { id: 4, name: 'HDTV-720p', resolution: 720 }, revision: { version: 2, real: 0, isRepack: false } },
    languages: [{ id: 1, name: 'English' }], seriesId: 5, episodeIds: [51, 52],
  });
  assert.deepEqual(overridden.record.target, { service: 'sonarr', kind: 'episodes', seriesId: 5, episodeIds: [51, 52] });
  assert.deepEqual(overridden.record.searchedFor, target);

  // The services require the title with every override, so a quality-only one names the searched target.
  await grabs.grab(target, 'g-rejected', 'grab', parseOverrides({ qualityId: 4 }, 'sonarr'));
  assert.deepEqual([posts.at(-1).body.seriesId, posts.at(-1).body.episodeIds], [5, [50]]);

  grabResponse = () => new Response(JSON.stringify({ message: "Couldn't find requested release in cache, try searching again" }), { status: 404 });
  const refused = await grabs.grab(target, 'g-rejected', 'grab');
  assert.equal(refused.kind, 'failed');
  assert.equal(refused.record.state, 'failed');
  assert.equal(refused.record.failure, "Couldn't find requested release in cache, try searching again");
  assert.deepEqual(grabs.list(target).map((record) => record.state), ['failed', 'sent', 'sent', 'sent']);

  assert.equal(parseOverrides({ seriesId: 5 }, 'sonarr'), undefined);
  assert.equal(parseOverrides({ movieId: 5 }, 'sonarr'), undefined);
  assert.deepEqual(parseOverrides(undefined, 'radarr'), {});
});

// Forcing an import blocked for any reason but "Not an upgrade", using a move instead of a hardlink-or-copy import, forcing the same download twice, or calling a replace complete without an import breaks the replace guarantee.
test('a replace is forced only past "Not an upgrade" and completes only on import', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createReleases } = await import(releasesModuleUrl);
  const { createGrabs } = await import(grabsModuleUrl);
  const { createReplaces } = await import(replaceModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-replace-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  for (const [service, port] of [['sonarr', 65051], ['radarr', 65052]]) {
    setSetting(database, 'serviceAddresses', `${service}.url`, `http://127.0.0.1:${port}`);
    setSetting(database, 'credentials', `${service}.apiKey`, `${service}-key`);
  }
  const notUpgrade = { sonarr: 'Not an upgrade for existing episode file(s)', radarr: 'Not an upgrade for existing movie file' };
  const queue = {};
  const history = {};
  const manual = {};
  const commands = [];
  const fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    const service = parsed.port === '65051' ? 'sonarr' : 'radarr';
    const json = (body) => new Response(JSON.stringify(body), { status: 200 });
    const id = parsed.searchParams.get('downloadId');
    if (init.method === 'POST' && parsed.pathname === '/api/v3/command') {
      commands.push({ service, body: JSON.parse(init.body) });
      return json({ id: 1 });
    }
    if (init.method === 'POST') return json({});
    if (parsed.pathname === '/api/v3/release') {
      return json([{ guid: `${service}-${parsed.searchParams.toString()}`, indexerId: 1, title: `Release ${parsed.searchParams.toString()}`, approved: false, rejections: [notUpgrade[service]] }]);
    }
    if (parsed.pathname === '/api/v3/queue') return json({ records: Object.values(queue).filter((item) => item.service === service) });
    if (parsed.pathname === '/api/v3/history') {
      if (id === null) {
        return json({ records: Object.entries(history).flatMap(([downloadId, events]) => events.map((event) => ({ ...event, downloadId }))) });
      }
      return json({ records: (history[id] ?? []).map((event) => ({ ...event, downloadId: id })) });
    }
    if (parsed.pathname === '/api/v3/manualimport') return json(manual[id] ?? []);
    return json([]);
  };
  const services = { sonarr: createArr('sonarr', database, { fetch }), radarr: createArr('radarr', database, { fetch }) };
  const releases = createReleases(database, services);
  let clock = 1_000_000;
  const grabs = createGrabs(database, services, releases, { now: () => clock });
  const replaces = createReplaces(services, grabs, { now: () => clock });
  const start = async (target, downloadId) => {
    await releases.get(target);
    const guid = (await releases.get(target)).search.releases[0].guid;
    history[downloadId] = [{ eventType: 'grabbed', data: { guid } }];
    const result = await grabs.grab(target, guid, 'replace');
    assert.equal(result.record.downloadId, downloadId);
    return result.record.id;
  };
  const blocked = (service, messages) => ({ service, status: 'completed', trackedDownloadStatus: 'warning', trackedDownloadState: 'importBlocked', statusMessages: [{ title: 'file.mkv', messages }] });
  const episodeFile = (path, rejections, episodes = [{ id: 50 }]) => ({ path, folderName: 'Show.S01E02', quality: { quality: { id: 4 } }, languages: [{ id: 1 }], releaseGroup: 'GRP', episodes, rejections: rejections.map((reason) => ({ reason, type: 'permanent' })) });

  const episode = await start({ service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 50 }, 'HASH-EPISODE');
  const dangerous = await start({ service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 51 }, 'HASH-DANGEROUS');
  const movie = await start({ service: 'radarr', kind: 'movie', movieId: 9 }, 'HASH-MOVIE');
  const vanished = await start({ service: 'radarr', kind: 'movie', movieId: 10 }, 'HASH-VANISHED');

  queue.e = { ...blocked('sonarr', []), downloadId: 'hash-episode', trackedDownloadState: 'downloading', trackedDownloadStatus: 'ok' };
  queue.d = { ...blocked('sonarr', ['Dangerous file extension .exe']), downloadId: 'HASH-DANGEROUS' };
  queue.m = { ...blocked('radarr', [notUpgrade.radarr]), downloadId: 'HASH-MOVIE' };
  queue.v = { ...blocked('radarr', []), downloadId: 'HASH-VANISHED', trackedDownloadState: 'downloading', trackedDownloadStatus: 'ok' };
  manual['HASH-MOVIE'] = [{ path: '/dl/Movie.mkv', quality: { quality: { id: 7 } }, languages: [], rejections: [{ reason: notUpgrade.radarr }] }];
  await replaces.run();
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0], {
    service: 'radarr',
    body: { name: 'ManualImport', importMode: 'auto', files: [{ path: '/dl/Movie.mkv', quality: { quality: { id: 7 } }, languages: [], downloadId: 'HASH-MOVIE', movieId: 9 }] },
  });
  assert.equal(grabs.read(episode).state, 'sent');
  assert.equal(grabs.read(dangerous).state, 'failed');
  assert.equal(grabs.read(dangerous).failure, 'Import blocked: Dangerous file extension .exe');
  assert.equal(grabs.read(movie).state, 'importing');

  queue.e = { ...blocked('sonarr', [notUpgrade.sonarr]), downloadId: 'hash-episode' };
  manual['HASH-EPISODE'] = [
    episodeFile('/dl/Show.S01E02/ep.mkv', [notUpgrade.sonarr]),
    episodeFile('/dl/Show.S01E02/sample.mkv', ['Sample']),
    episodeFile('/dl/Show.S01E02/other.mkv', [], []),
  ];
  delete queue.v;
  await replaces.run();
  assert.equal(commands.length, 2, 'the movie already forced is not forced again');
  assert.equal(commands[1].service, 'sonarr');
  assert.equal(commands[1].body.importMode, 'auto');
  assert.deepEqual(commands[1].body.files.map((file) => [file.path, file.seriesId, file.episodeIds]), [
    ['/dl/Show.S01E02/ep.mkv', 5, [50]],
    ['/dl/Show.S01E02/other.mkv', 5, [50]],
  ]);
  assert.equal(grabs.read(vanished).state, 'sent', 'history can name a download before the queue shows it');

  delete queue.e;
  history['HASH-EPISODE'].push({ eventType: 'downloadFolderImported' });
  clock += 31 * 60_000;
  await replaces.run();
  assert.equal(grabs.read(vanished).state, 'failed');
  assert.equal(grabs.read(vanished).failure, 'The download left the queue without being imported.');
  assert.equal(grabs.read(episode).state, 'completed');
  assert.equal(grabs.read(movie).state, 'failed', 'a forced import still blocked after the grace period has failed');
  assert.equal(commands.length, 2);
});

// An ignored term that misses a naming of the protected episode lets Sonarr upgrade over a manual download; one that also matches a neighbouring episode stops that episode upgrading.
test('manual-download patterns refuse every naming of one episode and no other', async () => {
  const { episodePatterns, numberRange } = await import(protectionModuleUrl);
  const toRegExp = (term) => {
    const [, source, flags] = /^\/(.*)\/([a-z]*)$/.exec(term);
    return new RegExp(source, flags);
  };
  for (const [min, max] of [[0, 0], [0, 999], [1, 1], [1, 9], [1, 12], [2, 999], [7, 103], [10, 99], [19, 200]]) {
    const range = new RegExp(`^${numberRange(min, max)}$`);
    for (let value = 0; value <= 1000; value += 1) {
      assert.equal(range.test(String(value)), value >= min && value <= max, `${value} in ${min}..${max}`);
    }
    assert.equal(range.test(`00${min}`), true);
  }
  const blocks = (season, episode, title) => episodePatterns(season, episode).map(toRegExp).some((pattern) => pattern.test(title));
  for (const title of [
    'Spike.Show.S01E02.2160p.WEB-DL', 'Spike.Show.S01E02E03.2160p', 'Spike.Show.S01E01E02.2160p', 'Spike.Show.S01E01-E03.2160p',
    'Spike.Show.1x02.2160p', 'Spike Show - S01E02 - Episode 2 [WEBDL-2160p]', 'Spike.Show.S01.2160p.WEB-DL', 'Spike.Show.Season.1.2160p',
    'Spike.Show.S01-S02.2160p', 'Spike.Show.s1e2.720p', 'Spike.Show.S01E02-04.1080p',
  ]) assert.equal(blocks(1, 2, title), true, title);
  for (const title of [
    'Spike.Show.S01E03.2160p', 'Spike.Show.S01E05.2160p', 'Spike.Show.S01E12.2160p', 'Spike.Show.S01E20.2160p', 'Spike.Show.S11E02.2160p',
    'Spike.Show.S10E02.2160p', 'Spike.Show.S02E02.2160p', 'Spike.Show.S01E03-E05.2160p', 'Spike.Show.S02.2160p', 'Spike.Show.11x02',
    'Spike.Show.Season.11.1080p',
  ]) assert.equal(blocks(1, 2, title), false, title);
  assert.equal(blocks(3, 12, 'Show.S03E10-E14.1080p'), true);
  assert.equal(blocks(3, 12, 'Show.S03E13-E14.1080p'), false);
  assert.equal(blocks(3, 12, 'Show.S03E01E02.1080p'), false);
  // Specials are season 0, and their episode numbers can be 0.
  assert.equal(blocks(0, 0, 'Show.S00E00.1080p'), true);
  assert.equal(blocks(0, 0, 'Show.S00E00-E02.1080p'), true);
  assert.equal(blocks(0, 0, 'Show.S00E01.1080p'), false);
});

// Unprotecting by unmonitoring, leaving a tag or profile behind when protection ends, vetoing media-manager-2's own grab, or letting another grab of a protected item through breaks manual-download protection.
test('manual downloads are protected with tags, release profiles and a grab veto', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createProtection, vetoInBackground } = await import(protectionModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-protection-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  for (const [service, port] of [['sonarr', 65061], ['radarr', 65062]]) {
    setSetting(database, 'serviceAddresses', `${service}.url`, `http://127.0.0.1:${port}`);
    setSetting(database, 'credentials', `${service}.apiKey`, `${service}-key`);
  }
  const fake = () => ({ tags: [], profiles: [], records: {}, notifications: [], queue: [], deleted: [], nextId: 1 });
  const state = { sonarr: fake(), radarr: fake() };
  state.radarr.records['/api/v3/movie/9'] = { id: 9, title: 'Dune', monitored: true, qualityProfileId: 4, hasFile: true, tags: [] };
  state.radarr.records['/api/v3/movie/10'] = { id: 10, title: 'Other', monitored: true, hasFile: true, tags: [] };
  state.sonarr.records['/api/v3/series/5'] = { id: 5, title: 'Show', monitored: true, tags: [7] };
  state.sonarr.records['/api/v3/episode/50'] = { id: 50, seriesId: 5, seasonNumber: 1, episodeNumber: 2, hasFile: true, monitored: true };
  const fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    const fakeState = state[parsed.port === '65061' ? 'sonarr' : 'radarr'];
    const path = parsed.pathname;
    const method = init.method ?? 'GET';
    const body = init.body === undefined ? undefined : JSON.parse(init.body);
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
    const collection = path === '/api/v3/tag' ? 'tags' : path.startsWith('/api/v3/releaseprofile') ? 'profiles' : path.startsWith('/api/v3/notification') ? 'notifications' : undefined;
    if (collection !== undefined) {
      const id = Number(path.split('/')[4]);
      if (method === 'GET') return json(fakeState[collection]);
      if (method === 'POST') {
        const created = { ...body, id: fakeState.nextId++ };
        fakeState[collection].push(created);
        return json(created, 201);
      }
      if (method === 'PUT') {
        fakeState[collection] = fakeState[collection].map((item) => (item.id === id ? { ...body, id } : item));
        return json(body, 202);
      }
      fakeState[collection] = fakeState[collection].filter((item) => item.id !== id);
      return json({});
    }
    if (path === '/api/v3/movie' && method === 'GET') return json(Object.entries(fakeState.records).filter(([key]) => key.startsWith('/api/v3/movie/')).map(([, value]) => value));
    if (path === '/api/v3/queue') return json({ records: fakeState.queue });
    if (path.startsWith('/api/v3/queue/') && method === 'DELETE') {
      fakeState.deleted.push(`${path}${parsed.search}`);
      return json({});
    }
    if (path in fakeState.records) {
      if (method === 'PUT') fakeState.records[path] = body;
      return json(fakeState.records[path]);
    }
    return json({}, 404);
  };
  const services = { sonarr: createArr('sonarr', database, { fetch }), radarr: createArr('radarr', database, { fetch }) };
  let ownTitles = [];
  const protection = createProtection(database, services, { recentGrabTitles: () => ownTitles });
  const replaceOf = (target) => ({ target, service: target.service, state: 'completed' });

  await protection.protect(replaceOf({ service: 'radarr', kind: 'movie', movieId: 9 }));
  const radarrTag = state.radarr.tags.find((tag) => tag.label === 'mm2-manual');
  assert.ok(radarrTag);
  assert.deepEqual(state.radarr.profiles.map(({ name, enabled, ignored, required, tags }) => ({ name, enabled, ignored, required, tags })), [
    { name: 'mm2 manual downloads', enabled: true, ignored: ['/./'], required: [], tags: [radarrTag.id] },
  ]);
  assert.deepEqual(state.radarr.records['/api/v3/movie/9'], { id: 9, title: 'Dune', monitored: true, qualityProfileId: 4, hasFile: true, tags: [radarrTag.id] });
  assert.deepEqual(state.radarr.records['/api/v3/movie/10'].tags, []);

  await protection.protect(replaceOf({ service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 50 }));
  const seriesTag = state.sonarr.tags.find((tag) => tag.label === 'mm2-manual-5');
  assert.ok(seriesTag);
  assert.deepEqual(state.sonarr.records['/api/v3/series/5'].tags, [7, seriesTag.id]);
  assert.equal(state.sonarr.records['/api/v3/series/5'].monitored, true);
  assert.equal(state.sonarr.profiles.length, 1);
  assert.equal(state.sonarr.profiles[0].ignored.length, 5);
  assert.deepEqual(state.sonarr.profiles[0].tags, [seriesTag.id]);
  assert.deepEqual(protection.list().map((item) => item.kind), ['movie', 'episode']);

  state.sonarr.profiles = [];
  await protection.reconcile();
  assert.equal(state.sonarr.profiles.length, 1, 'a profile removed by hand comes back');

  state.sonarr.queue = [{ id: 31, downloadId: 'ABCDEF' }];
  const grab = { eventType: 'Grab', series: { id: 5 }, episodes: [{ id: 49 }, { id: 50 }], downloadId: 'abcdef', release: { releaseTitle: 'Show.S01.1080p' } };
  assert.equal(await protection.veto('sonarr', { ...grab, episodes: [{ id: 49 }] }), 'ignored');
  ownTitles = ['show.s01.1080p'];
  assert.equal(await protection.veto('sonarr', grab), 'allowed');
  ownTitles = [];
  assert.equal(await protection.veto('sonarr', grab), 'vetoed');
  assert.deepEqual(state.sonarr.deleted, ['/api/v3/queue/31?removeFromClient=true&blocklist=true']);
  assert.equal(await protection.veto('sonarr', { eventType: 'Test' }), 'ignored');

  // Grabs reach the veto through the one webhook receiver the live-downloads work owns.
  const vetoes = [];
  await vetoInBackground({ veto: async (service, payload) => { vetoes.push([service, payload.eventType]); return 'not_found'; } }, 'sonarr', grab, async () => {});
  assert.deepEqual(vetoes, [['sonarr', 'Grab'], ['sonarr', 'Grab'], ['sonarr', 'Grab'], ['sonarr', 'Grab']], 'a veto retries while the queue entry is missing');
  await vetoInBackground({ veto: async () => assert.fail('only a Grab is vetoed') }, 'sonarr', { eventType: 'Download' });

  assert.equal(await protection.ensureWebhook('sonarr'), false, 'nothing is registered without the address and the webhook secret');
  state.sonarr.notifications = [{ id: 90, name: 'media-manager-2 grab veto', onGrab: true, fields: [{ name: 'url', value: 'http://old/hooks/grab/sonarr?token=t' }] }];
  setSetting(database, 'serviceAddresses', 'mediaManager.hookUrl', 'http://mm2.lan:8080/');
  setSetting(database, 'credentials', 'webhook.secret', 'hook-secret');
  assert.equal(await protection.ensureWebhook('sonarr'), true);
  assert.equal(state.sonarr.notifications.length, 1, 'the old grab-veto webhook is updated, not left behind');
  const [registered] = state.sonarr.notifications;
  assert.equal(registered.id, 90);
  assert.equal(registered.name, 'media-manager-2');
  assert.equal(registered.onGrab, true);
  assert.equal(registered.onDownload, true);
  assert.deepEqual(Object.fromEntries(registered.fields.map(({ name, value }) => [name, value])), {
    url: 'http://mm2.lan:8080/webhooks/sonarr', method: 1, username: 'media-manager-2', password: 'hook-secret',
  });
  registered.fields = registered.fields.map((field) => (field.name === 'password' ? { ...field, value: '********' } : field));
  await protection.ensureWebhook('sonarr');
  assert.equal(state.sonarr.notifications.length, 1, 'the webhook is registered once');
  assert.equal(state.sonarr.notifications[0].fields.find((field) => field.name === 'password').value, '********', 'an unchanged secret is not sent again');
  setSetting(database, 'credentials', 'webhook.secret', 'rotated-secret');
  await protection.ensureWebhook('sonarr');
  assert.equal(state.sonarr.notifications[0].fields.find((field) => field.name === 'password').value, 'rotated-secret', 'a new secret reaches the service');
  // Taking the first webhook with either name, or leaving the old-named one in place, turns this red: every event then arrives twice.
  state.sonarr.notifications.unshift({ id: 89, name: 'media-manager-2 grab veto', onGrab: true, fields: [{ name: 'url', value: 'http://old/hooks/grab/sonarr?token=t' }] });
  await protection.ensureWebhook('sonarr');
  assert.deepEqual(state.sonarr.notifications.map(({ id, name }) => [id, name]), [[90, 'media-manager-2']], 'a leftover old webhook is deleted, not renamed into a second copy');

  // The stall and missed-search fixes ask whether a movie or episode is a manual download.
  assert.equal(protection.isProtected({ type: 'episode', service: 'sonarr', id: '50' }), true);
  assert.equal(protection.isProtected({ type: 'episode', service: 'sonarr', id: '51' }), false);
  assert.equal(protection.isProtected({ type: 'movie', service: 'radarr', id: '9' }), true);
  assert.equal(protection.isProtected({ type: 'torrent', service: null, id: '9' }), false);

  state.radarr.records['/api/v3/movie/9'].hasFile = false;
  await protection.unprotect(protection.list().find((item) => item.kind === 'episode'));
  await protection.reconcile();
  assert.deepEqual(protection.list(), []);
  assert.deepEqual(state.radarr.records['/api/v3/movie/9'].tags, []);
  assert.deepEqual(state.sonarr.profiles, []);
  assert.deepEqual(state.sonarr.records['/api/v3/series/5'].tags, [7]);
});

test('the downloads screen joins torrents, queue items and problems into rows', async (t) => {
  // The client model is bundled by Vite, not compiled to dist, so it is loaded from source with Node's type stripping.
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../src/client/downloads/model.ts', import.meta.url), 'utf8');
  const { buildRows, groupRows, applyEvent } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
  const hash = 'CD'.repeat(20);
  const torrent = (overrides = {}) => ({ hash, name: 'Movie.2024.1080p', sizeBytes: 1000, completedBytes: 400, downRate: 0, upRate: 0, started: true,
    active: true, complete: false, message: '', ratioThousandths: 0, seedersConnected: 2, trackerHost: 'tracker.example', goneAt: null, ...overrides });
  const item = (overrides = {}) => ({ service: 'radarr', queueId: 5, downloadId: hash, movieId: 7, episodeId: null, title: 'Movie.2024.1080p', label: 'Movie (2024)',
    status: 'downloading', trackedStatus: 'ok', trackedState: 'downloading', statusMessages: [], errorMessage: '', indexer: 'Blutopia',
    quality: 'Bluray-1080p', formats: [], formatScore: 0, estimatedCompletion: null, ...overrides });
  const problem = (overrides = {}) => ({ id: 1, kind: 'stalled', subject: { type: 'torrent', service: null, id: hash }, hash, state: 'handling',
    summary: 'No seeders.', steps: [], ...overrides });
  const rowsFor = (snapshot) => buildRows({ torrents: [], queue: [], grabs: [], problems: [], ...snapshot });
  const statusOf = (torrentOverrides, queue = [item()], problems = []) => rowsFor({ torrents: [torrent(torrentOverrides)], queue, problems })[0].status;

  // Reading the wrong state first shows a blocked or stalled download as fine, or a fine one as at risk.
  await t.test('a torrent row says the most urgent thing about its download', () => {
    const cases = [
      [{}, [item()], [problem()], 'stalled', 'risk'],
      [{ message: 'Tracker: timeout' }, [item()], [], 'error', 'risk'],
      [{ complete: true }, [item({ trackedState: 'importBlocked', statusMessages: [{ title: 'x', messages: ['No matching movie.'] }] })], [], 'import blocked', 'risk'],
      [{ complete: true }, [item({ trackedState: 'importing' })], [], 'importing', 'normal'],
      [{ complete: true }, [item({ trackedState: 'importPending' })], [], 'waiting to import', 'normal'],
      [{ complete: true }, [], [], 'seeding', 'normal'],
      [{ started: false }, [item()], [], 'paused', 'normal'],
      [{ active: false }, [item()], [], 'queued', 'normal'],
      [{ downRate: 2000 }, [item()], [], 'downloading', 'normal'],
      [{ seedersConnected: 0 }, [item()], [], 'waiting for peers', 'risk'],
    ];
    for (const [overrides, queue, problems, word, tone] of cases) {
      const status = statusOf(overrides, queue, problems);
      assert.deepEqual([status.word, status.tone], [word, tone], JSON.stringify(overrides));
    }
    const blocked = rowsFor({ torrents: [torrent({ complete: true })], queue: [item({ trackedState: 'importBlocked', statusMessages: [{ title: 'x', messages: ['No matching movie.'] }] })] })[0];
    assert.equal(blocked.status.detail, 'No matching movie.');
    assert.deepEqual(blocked.importable, { service: 'radarr', downloadId: hash });
  });

  // Losing the join shows a download twice, drops a problem, or puts a delayed release's actions on the wrong row.
  await t.test('queue items and problems join their download, and the rest get rows of their own', () => {
    const delayed = item({ queueId: 6, downloadId: null, status: 'delay', estimatedCompletion: '2026-10-08T13:00:00Z', label: 'Other (2025)', movieId: 8 });
    const rows = rowsFor({
      torrents: [torrent(), torrent({ hash: 'EF'.repeat(20), goneAt: 1 })],
      queue: [item(), delayed],
      grabs: [{ hash, service: 'radarr', movieId: 7, episodeIds: [], releaseTitle: 'Movie.2024.1080p', indexer: 'Blutopia', byHand: true }],
      problems: [
        problem({ id: 2, kind: 'import_failed', subject: { type: 'movie', service: 'radarr', id: '7' }, hash: null, state: 'needs_you' }),
        problem({ id: 3, kind: 'missing', subject: { type: 'movie', service: 'radarr', id: '8' }, hash: null }),
        problem({ id: 4, kind: 'tracker_down', subject: { type: 'tracker', service: null, id: 'tracker.example' }, hash: null }),
        problem({ id: 5, state: 'resolved' }),
      ],
    });
    assert.deepEqual(rows.map((row) => [row.key, row.label, row.problems.map((open) => open.id)]), [
      [`torrent:${hash}`, 'Movie (2024)', [2]],
      ['queue:radarr:6', 'Other (2025)', [3]],
      ['problem:4', 'tracker.example', [4]],
    ]);
    assert.equal(rows[0].queueItem.queueId, 5);
    assert.equal(rows[0].byHand, true);
    assert.deepEqual(rows[0].importable, { service: 'radarr', downloadId: hash });
    assert.equal(rows[1].status.word, 'delayed');
    assert.equal(rows[1].delayedUntil, Date.parse('2026-10-08T13:00:00Z'));
    assert.equal(rows[2].queueItem, null);

    assert.deepEqual(groupRows(rows).map((group) => [group.key, group.rows.map((row) => row.key)]), [
      ['needs_you', [`torrent:${hash}`]],
      ['handling', ['queue:radarr:6', 'problem:4']],
    ]);
  });

  // Applying an event to the wrong service or keeping a resolved problem leaves the screen out of date.
  await t.test('live events update only what they name', () => {
    const snapshot = { torrents: [torrent()], queue: [item(), item({ service: 'sonarr', queueId: 9 })], grabs: [], problems: [problem()] };
    assert.deepEqual(applyEvent(snapshot, 'torrents', { changed: [], gone: [hash] }).torrents, []);
    assert.deepEqual(applyEvent(snapshot, 'queue', { service: 'radarr', items: [] }).queue.map((entry) => entry.queueId), [9]);
    assert.deepEqual(applyEvent(snapshot, 'problem', problem({ state: 'resolved' })).problems, []);
    assert.equal(applyEvent(snapshot, 'unknown', {}), snapshot);
  });
});

test('a hand grab marks its torrent grab record as by hand, whichever record arrives first', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker, findGrab } = await import(torrentGrabsModuleUrl);
  const { handGrab } = await import(grabsModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-hand-grab-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = { request: async () => ({ status: 404, body: undefined }) };
  const hand = handGrab({
    id: 1, service: 'sonarr', target: { service: 'sonarr', kind: 'episode', seriesId: 3, episodeId: 31 },
    searchedFor: { service: 'sonarr', kind: 'episode', seriesId: 3, episodeId: 31 }, guid: 'g', releaseTitle: 'Show.S01E01',
    intent: 'replace', state: 'sent', failure: null, downloadId: 'ab'.repeat(20), createdAt: 1_000, updatedAt: 1_000,
  });
  const webhook = { ...hand, indexer: 'Blutopia', grabbedAt: 2_000, byHand: false };

  // Dropping byHand from handGrab, or recording the hand grab only when no webhook record exists, turns this red:
  // the import fix then clears a replace's "Not an upgrade" download from the queue.
  for (const [first, second] of [[webhook, hand], [hand, webhook]]) {
    const database = openDatabase(join(root, `db-${first === hand ? 'hand' : 'webhook'}-first`, 'media-manager.sqlite'));
    const tracker = createGrabTracker({ database, arr: { sonarr: service, radarr: service }, events: createEventHub() });
    tracker.recordGrab(first);
    tracker.recordGrab(second);
    const grab = findGrab(database, 'ab'.repeat(20));
    assert.equal(grab.byHand, true);
    assert.equal(grab.indexer, 'Blutopia');
    assert.deepEqual([grab.seriesId, grab.episodeIds, grab.grabbedAt], [3, [31], 1_000]);
    database.close();
  }
});

test('subject labels come from Sonarr and Radarr once and fall back to ids', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createLabels } = await import(new URL('../dist/server/labels.js', import.meta.url).href);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-labels-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(() => database.close());
  const requests = [];
  const bodies = {
    '/api/v3/movie/7': { title: 'Dune', year: 2021 },
    '/api/v3/episode/31': { seasonNumber: 2, episodeNumber: 9, series: { title: 'Andor' } },
    '/api/v3/episode/32': { seasonNumber: 2, episodeNumber: 10, series: { title: 'Andor' } },
  };
  const fake = (service) => ({
    request: async (path) => {
      requests.push(`${service} ${path}`);
      return path in bodies ? { status: 200, body: bodies[path] } : { status: 404, body: undefined };
    },
  });
  const arr = { sonarr: fake('sonarr'), radarr: fake('radarr') };
  const labels = createLabels(arr);
  const grabs = createGrabTracker({ database, arr, events: createEventHub() });
  const grab = { service: 'sonarr', movieId: null, seriesId: 3, releaseTitle: 'Andor.S02', indexer: 'Blutopia', grabbedAt: 1_000, publishedAt: null, byHand: false };
  grabs.recordGrab({ ...grab, hash: 'AB'.repeat(20), episodeIds: [31, 32] });
  grabs.recordGrab({ ...grab, hash: 'CD'.repeat(20), episodeIds: [] });

  // Dropping the cache re-requests a label on every row, and dropping the fallback leaves a failed lookup without a title.
  assert.equal(await labels.movie(7), 'Dune (2021)');
  assert.equal(await labels.episode(31), 'Andor S02E09');
  assert.equal(await labels.movie(7), 'Dune (2021)');
  assert.equal(await labels.subject({ type: 'episode', service: 'sonarr', id: '31' }, database), 'Andor S02E09');
  assert.deepEqual(requests, ['radarr /api/v3/movie/7', 'sonarr /api/v3/episode/31']);
  assert.equal(await labels.movie(8), 'Radarr movie 8');
  assert.equal(await labels.movie(8), 'Radarr movie 8');
  assert.equal(requests.filter((request) => request === 'radarr /api/v3/movie/8').length, 2);
  assert.equal(await labels.episode(99), 'Sonarr episode 99');
  assert.equal(await labels.subject({ type: 'torrent', service: null, id: 'ab'.repeat(20) }, database), 'Andor S02E09 + 1 more');
  assert.equal(await labels.subject({ type: 'torrent', service: null, id: 'CD'.repeat(20) }, database), 'CD'.repeat(20));
  assert.equal(await labels.subject({ type: 'tracker', service: null, id: 'blutopia.cc' }, database), 'blutopia.cc');
});
