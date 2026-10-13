import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createCipheriv, createHash, createPublicKey, generateKeyPairSync, randomBytes, verify } from 'node:crypto';
import { once } from 'node:events';
import fs, { existsSync } from 'node:fs';
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connectArr, createArrFake, episodeRecord, historyRecord, importFile, movieRecord, queueItem, seriesRecord } from './fakes/arr.mjs';

const serverPath = fileURLToPath(new URL('../dist/server/index.js', import.meta.url));
const databaseModuleUrl = new URL('../dist/server/database.js', import.meta.url).href;
const appModuleUrl = new URL('../dist/server/app.js', import.meta.url).href;
const settingsModuleUrl = new URL('../dist/server/settings.js', import.meta.url).href;
const arrModuleUrl = new URL('../dist/server/services/arr.js', import.meta.url).href;
const rtorrentModuleUrl = new URL('../dist/server/services/rtorrent.js', import.meta.url).href;
const plexModuleUrl = new URL('../dist/server/services/plex.js', import.meta.url).href;
const jellyfinModuleUrl = new URL('../dist/server/services/jellyfin.js', import.meta.url).href;
const mediaServerModuleUrl = new URL('../dist/server/services/mediaServer.js', import.meta.url).href;
const tmdbModuleUrl = new URL('../dist/server/services/tmdb.js', import.meta.url).href;
const connectionModuleUrl = new URL('../dist/server/services/connection.js', import.meta.url).href;
const logModuleUrl = new URL('../dist/server/log.js', import.meta.url).href;
const traktModuleUrl = new URL('../dist/server/services/trakt.js', import.meta.url).href;
const fanartModuleUrl = new URL('../dist/server/services/fanart.js', import.meta.url).href;
const clearCacheModuleUrl = new URL('../dist/server/clearCache.js', import.meta.url).href;
const backdropsModuleUrl = new URL('../dist/server/backdrops.js', import.meta.url).href;
const mdblistModuleUrl = new URL('../dist/server/services/mdblist.js', import.meta.url).href;
const trackerAccountsModuleUrl = new URL('../dist/server/services/trackerAccounts.js', import.meta.url).href;
const cliPath = fileURLToPath(new URL('../dist/server/cli.js', import.meta.url));
const eventsModuleUrl = new URL('../dist/server/events.js', import.meta.url).href;
const jobsModuleUrl = new URL('../dist/server/jobs.js', import.meta.url).href;
const searchModuleUrl = new URL('../dist/server/search.js', import.meta.url).href;
const addModuleUrl = new URL('../dist/server/add.js', import.meta.url).href;
const releasesModuleUrl = new URL('../dist/server/releases.js', import.meta.url).href;
const releaseDetailsModuleUrl = new URL('../dist/server/releaseDetails.js', import.meta.url).href;
const grabsModuleUrl = new URL('../dist/server/grabs.js', import.meta.url).href;
const secondVersionsModuleUrl = new URL('../dist/server/secondVersions.js', import.meta.url).href;
const versionImportModuleUrl = new URL('../dist/server/versionImport.js', import.meta.url).href;
const secondVersionRowsModuleUrl = new URL('../dist/server/secondVersionRows.js', import.meta.url).href;
const secondVersionDeleteModuleUrl = new URL('../dist/server/secondVersionDelete.js', import.meta.url).href;
const replaceModuleUrl = new URL('../dist/server/replace.js', import.meta.url).href;
const libraryModuleUrl = new URL('../dist/server/library.js', import.meta.url).href;
const protectionModuleUrl = new URL('../dist/server/protection.js', import.meta.url).href;
const dependenciesModuleUrl = new URL('../dist/server/dependencies.js', import.meta.url).href;
const torrentGrabsModuleUrl = new URL('../dist/server/torrentGrabs.js', import.meta.url).href;
const problemsModuleUrl = new URL('../dist/server/problems.js', import.meta.url).href;
const apiModuleUrl = new URL('../dist/server/api.js', import.meta.url).href;
const connectionsModuleUrl = new URL('../dist/server/connections.js', import.meta.url).href;
const trackersModuleUrl = new URL('../dist/server/trackers.js', import.meta.url).href;
const trackerRulesModuleUrl = new URL('../dist/server/trackerRules.js', import.meta.url).href;
const adviceModuleUrl = new URL('../dist/server/advice.js', import.meta.url).href;
const trackerSettingsModuleUrl = new URL('../dist/server/trackerSettings.js', import.meta.url).href;
const stallsModuleUrl = new URL('../dist/server/stalls.js', import.meta.url).href;
const labelsModuleUrl = new URL('../dist/server/labels.js', import.meta.url).href;
const relinkModuleUrl = new URL('../dist/server/relink.js', import.meta.url).href;
const searchesModuleUrl = new URL('../dist/server/searches.js', import.meta.url).href;
const importsModuleUrl = new URL('../dist/server/imports.js', import.meta.url).href;
const torrentsModuleUrl = new URL('../dist/server/torrents.js', import.meta.url).href;
const torrentFilesModuleUrl = new URL('../dist/server/torrentFiles.js', import.meta.url).href;
const titleDeleteModuleUrl = new URL('../dist/server/titleDelete.js', import.meta.url).href;
const historyModuleUrl = new URL('../dist/server/history.js', import.meta.url).href;
const manualImportModuleUrl = new URL('../dist/server/manualImport.js', import.meta.url).href;
const s3ModuleUrl = new URL('../dist/server/services/s3.js', import.meta.url).href;
const backupDestinationModuleUrl = new URL('../dist/server/backupDestination.js', import.meta.url).href;
const backupModuleUrl = new URL('../dist/server/backup.js', import.meta.url).href;
const setupModuleUrl = new URL('../dist/server/setup.js', import.meta.url).href;
const titlesModuleUrl = new URL('../dist/server/titles.js', import.meta.url).href;
const preferencesModuleUrl = new URL('../dist/server/preferences.js', import.meta.url).href;
const titleStoreModuleUrl = new URL('../dist/server/titleStore.js', import.meta.url).href;
const tmdbTitlesModuleUrl = new URL('../dist/server/tmdbTitles.js', import.meta.url).href;
// The modules loaded in this process log timing records nowhere; a test that checks them installs its own sink and puts this one back.
const { setLogSink } = await import(logModuleUrl);
const discardLog = () => {};
setLogSink(discardLog);
// The owner's confirmed rules (AA-23). The code ships none, so tests that judge these trackers supply them.
const ownerRules = {
  'blutopia.cc': { minHours: 168, minGlobalRatio: 0.4 },
  'beyond-hd.me': { minHours: 120, minRatio: 1.0, logic: 'or', minGlobalRatio: 0.25 },
  'privatehd.to': { minHoursFormula: 'privatehd', minRatio: 0.9, logic: 'or', partialExemptBelow: 0.1, partialRatio: 0.9, partialMaxHours: 1440 },
};
const saveOwnerRules = async (database) => {
  const { setSetting } = await import(settingsModuleUrl);
  for (const [host, rule] of Object.entries(ownerRules)) setSetting(database, 'trackerConfiguration', `rules.${host}`, JSON.stringify(rule));
};

// Makes every linkSync in the app throw `code`, as link() does across mounts, until the returned function restores it.
const failLinks = (code) => {
  const original = fs.linkSync;
  fs.linkSync = () => { throw Object.assign(new Error(`${code}: link failed`), { code }); };
  syncBuiltinESMExports();
  return () => {
    fs.linkSync = original;
    syncBuiltinESMExports();
  };
};

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
  // An empty HOST listening on every interface instead of the default 127.0.0.1 turns this red.
  const child = spawn(process.execPath, [serverPath], {
    cwd: workingDirectory,
    env: { ...process.env, DB_PATH: databasePath, HOST: '', PORT: '0' },
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
  const { fetch, fixtureOptions, events, timers, webhooks, api, library, discover, titleDelete, images, setup } = input;
  const { createApp } = await import(appModuleUrl);
  const { applicationMigrations, migrateDatabase } = await import(databaseModuleUrl);
  const database = input.database ?? new DatabaseSync(':memory:');
  if (input.database === undefined) migrateDatabase(database, applicationMigrations);
  const now = () => clock.value;
  const fixture = fetch ? undefined : createPlexFixture({ now, ...fixtureOptions });
  const app = createApp({
    clientDirectory,
    listeningHost,
    database,
    ownerPlexId,
    publicOrigin,
    now,
    fetch: fetch ?? fixture.fetch,
    events,
    timers,
    webhooks,
    api,
    library,
    discover,
    titleDelete,
    images,
    setup,
  });
  return { app, clock, fixture, database };
};

const startAuthentication = async (app, { cookie, origin = 'https://media.example', body = {}, headers = {} } = {}) => {
  const response = await app.request('/auth/start', {
    method: 'POST',
    headers: { ...jsonHeaders(origin), ...(cookie ? { Cookie: cookie } : {}), ...headers },
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

  // Turns red if sessions go back to server memory: a new app on the same database would reject the cookie.
  await t.test('sessions rotate, expire absolutely, do not slide, and survive a restart on the same database', async () => {
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
    // Turns red if the Plex account token from sign-in is written to the sessions table, and so into backups.
    assert.doesNotMatch(JSON.stringify(setup.database.prepare('SELECT * FROM sessions').all()), /plex-secret-token/);
    const restarted = await makeApp({ clock: setup.clock, database: setup.database });
    // Omitting current server time prevents expiry scheduling independent of the browser clock.
    for (const serverNow of [expiry - 60_000, expiry - 1]) {
      setup.clock.value = serverNow;
      const before = await restarted.app.request('/api/session', { headers: { Cookie: replacementSession } });
      assert.equal(before.status, 200);
      assert.deepEqual(await before.json(), { expiresAt: expiry, serverNow });
    }
    assert.equal((await restarted.app.request('/api/session', { headers: { Cookie: firstSession } })).status, 401);
    setup.clock.value = expiry;
    const expired = await restarted.app.request('/api/session', { headers: { Cookie: replacementSession } });
    assert.equal(expired.status, 401);
    assert.deepEqual(await expired.json(), { error: 'session_expired' });
    assert.match(responseCookies(expired).join('\n'), /Max-Age=0/i);
    assert.equal(setup.database.prepare('SELECT count(*) AS count FROM sessions').get().count, 0);
  });

  await t.test('logout revokes one browser while another owner session remains valid', async () => {
    const { app, clock, database } = await makeApp();
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
    const restarted = await makeApp({ clock, database });
    assert.equal((await restarted.app.request('/api/session', { headers: { Cookie: sessions[0].session } })).status, 401);
    assert.equal((await restarted.app.request('/api/session', { headers: { Cookie: sessions[1].session } })).status, 200);
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

  // One shared start limit lets anyone who can reach the sign-in page lock the owner out; trusting the address a browser
  // writes first in X-Forwarded-For, or the header at all without a proxy in front, lets one client escape its own limit.
  await t.test('the start limit counts each client on its own, by the address the proxy added, under a ten-times backstop', async () => {
    const from = (address) => ({ headers: { 'X-Forwarded-For': address } });
    const { app } = await makeApp();
    for (let index = 0; index < 10; index += 1) assert.equal((await startAuthentication(app, from(`10.0.0.${index}, 203.0.113.1`))).response.status, 201);
    assert.equal((await startAuthentication(app, from('10.9.9.9, 203.0.113.1'))).response.status, 429);
    assert.equal((await startAuthentication(app, from('203.0.113.2'))).response.status, 201);
    for (let client = 3; client <= 11; client += 1) {
      for (let index = 0; index < 10; index += 1) await startAuthentication(app, from(`203.0.113.${client}`));
    }
    assert.equal((await startAuthentication(app, from('203.0.113.12'))).response.status, 429);

    const exposed = await makeApp({ listeningHost: '0.0.0.0' });
    for (let index = 0; index < 10; index += 1) await startAuthentication(exposed.app, from(`203.0.113.${index}`));
    assert.equal((await startAuthentication(exposed.app, from('203.0.113.99'))).response.status, 429);
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

test('discover routes, rows and recipes never reach upstream', async () => {
  // A route or read-model file importing a client or the title store, or a route calling fetch, turns this red.
  for (const name of ['routes', 'rows', 'recipes']) {
    const source = await readFile(new URL(`../src/server/discover/${name}.ts`, import.meta.url), 'utf8');
    // Type-only imports never reach a client at runtime.
    const imports = source.split('\n').filter((line) => line.startsWith('import') && !line.startsWith('import type'));
    for (const banned of ['services/tmdb', 'services/trakt', 'titleStore']) {
      assert.equal(imports.some((line) => line.includes(banned)), false, `${name}.ts imports ${banned}`);
    }
    if (name === 'routes') assert.equal(source.includes('.fetch('), false);
  }
});

test('the timing log records API requests, upstream calls and browser metrics without query strings or keys', async (t) => {
  const { requestWithTimeout } = await import(connectionModuleUrl);
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTmdb } = await import(tmdbModuleUrl);
  const raw = [];
  setLogSink((line) => raw.push(line));
  t.after(() => setLogSink(discardLog));
  const logged = (kind) => raw.map((line) => JSON.parse(line)).filter((line) => line.kind === kind);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-timing-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const { app } = await makeApp();
  const { session } = await signIn(app);
  const postMetrics = (body, cookie = session) => app.request('/api/metrics', {
    method: 'POST',
    headers: { ...jsonHeaders(), ...(cookie === null ? {} : { Cookie: cookie }) },
    body: JSON.stringify(body),
  });

  // Logging context.req.url instead of the path, or dropping the method, status or time, turns this red.
  await t.test('an API request logs method, path, status and time but never its query', async () => {
    assert.equal((await app.request('/api/session?token=secret', { headers: { Cookie: session } })).status, 200);
    const [line] = logged('api').filter((entry) => entry.path === '/api/session');
    assert.deepEqual({ ...line, at: undefined, ms: undefined }, { at: undefined, kind: 'api', method: 'GET', path: '/api/session', status: 200, ms: undefined });
    assert.equal(typeof line.ms, 'number');
    assert.equal(raw.some((entry) => entry.includes('?') || entry.includes('secret')), false);
  });

  // Logging the full URL, which carries TMDB's api_key, turns this red.
  await t.test('an upstream call logs host and path and never the key', async () => {
    setSetting(database, 'credentials', 'tmdb.apiKey', 'tmdb-secret-key');
    const tmdb = createTmdb(database, { fetch: async () => new Response(JSON.stringify({ genres: [] })) });
    assert.equal((await tmdb.genres('movie')).kind, 'ok');
    const [line] = logged('upstream');
    assert.deepEqual([line.host, line.method, line.path, line.status], ['api.themoviedb.org', 'GET', '/3/genre/movie/list', 200]);
    assert.equal(raw.some((entry) => entry.includes('api_key') || entry.includes('tmdb-secret-key')), false);
  });

  // Swallowing the fetch error, or not logging it, turns this red.
  await t.test('a fetch that throws logs the error name and still throws', async () => {
    const failure = new TypeError('fetch failed');
    await assert.rejects(requestWithTimeout(async () => { throw failure; }, 'https://unreachable.example/api/v3/queue?apikey=k', {}), (error) => error === failure);
    const line = logged('upstream').at(-1);
    assert.deepEqual([line.host, line.path, line.error, line.status], ['unreachable.example', '/api/v3/queue', 'TypeError', undefined]);
  });

  // Loosening any check on the batch, or mounting /api/metrics outside the private guard, turns this red.
  await t.test('browser metrics log one line per valid item and refuse anything else', async () => {
    const batch = [
      { name: 'LCP', value: 1234.5, route: '/discover', rating: 'good' },
      { name: 'api', value: 80, route: '/', path: '/api/discover/home' },
      { name: 'api-failed', value: 12, route: '/discover', path: '/api/discover/home', status: 502 },
      { name: 'api-failed', value: 3, route: '/discover', path: '/api/discover/home', status: 0 },
    ];
    assert.equal((await postMetrics(batch)).status, 204);
    assert.deepEqual(logged('web').map(({ at, kind, ...item }) => item), batch);
    const item = { name: 'CLS', value: 0.1, route: '/library' };
    for (const invalid of [
      [{ ...item, name: 'FID' }], [{ ...item, value: 600_001 }], [{ ...item, value: -1 }], [{ ...item, route: 'https://elsewhere.example/' }],
      [{ ...item, route: '/search?q=x' }], [{ ...item, route: `/${'a'.repeat(200)}` }], [{ ...item, rating: 'great' }], [{ ...item, extra: 1 }],
      [{ ...item, name: 'api' }], [{ ...item, status: 500 }], [{ ...item, name: 'api-failed', path: '/api/x' }],
      [{ ...item, name: 'api-failed', path: '/api/x', status: 600 }], [{ ...item, name: 'api-failed', path: '/api/x', status: 1.5 }],
      [{ ...item, name: 'api-failed', status: 500 }], Array.from({ length: 51 }, () => item), item,
    ]) {
      const response = await postMetrics(invalid);
      assert.equal(response.status, 400, JSON.stringify(invalid).slice(0, 80));
      assert.deepEqual(await response.json(), { error: 'invalid_request' });
    }
    assert.equal((await postMetrics(batch, null)).status, 401);
    assert.equal(logged('web').length, 4);
  });
});

test('the Plex sign-in popup is used when it opens, skipped when blocked or on a phone, and noticed when closed early', async (t) => {
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../src/client/plexPopup.ts', import.meta.url), 'utf8');
  const { POLL_INTERVAL_MS, openPopup, sendToPlex, handoffState, isPopupMessage } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
  const handoff = `https://app.plex.tv/auth#?${new URLSearchParams({ clientID: 'c', code: 'k', 'context[device][product]': 'media-manager-2', forwardUrl: 'https://media.example/auth/callback?state=abc' })}`;
  const makePopup = () => ({ closed: false, closeCalls: 0, close() { this.closed = true; this.closeCalls += 1; }, location: { assigned: [], assign(url) { this.assigned.push(url); } } });
  const makeHost = ({ popup = null, narrow = false } = {}) => {
    const host = {
      opened: 0,
      assigned: [],
      timers: new Map(),
      nextId: 1,
      open: () => { host.opened += 1; return popup; },
      narrow: () => narrow,
      assign(url) { this.assigned.push(url); },
      setInterval(cb, ms) { const id = this.nextId++; this.timers.set(id, { cb, ms }); return id; },
      clearInterval(id) { this.timers.delete(id); },
      tick() { for (const { cb } of [...this.timers.values()]) cb(); },
    };
    return host;
  };
  const makeHandlers = () => {
    const calls = { ticks: 0, closed: 0 };
    return { calls, handlers: { onTick: () => { calls.ticks += 1; }, onClosed: () => { calls.closed += 1; } } };
  };

  // Navigating the page itself instead of the popup, or polling at another interval, turns this red.
  await t.test('an open popup is sent to Plex and polled until stopped', () => {
    const popup = makePopup();
    const host = makeHost({ popup });
    assert.equal(openPopup(host), popup);
    const { calls, handlers } = makeHandlers();
    const stop = sendToPlex(host, popup, handoff, handlers);
    assert.deepEqual(popup.location.assigned, [handoff]);
    assert.deepEqual(host.assigned, []);
    assert.equal(typeof stop, 'function');
    assert.equal(POLL_INTERVAL_MS, 2000);
    assert.deepEqual([...host.timers.values()].map(({ ms }) => ms), [POLL_INTERVAL_MS]);
    host.tick();
    assert.deepEqual(calls, { ticks: 1, closed: 0 });
    stop();
    assert.equal(host.timers.size, 0);
    host.tick();
    assert.deepEqual(calls, { ticks: 1, closed: 0 });
  });

  // Dropping the redirect fallback, or opening a popup on a phone-sized viewport, turns this red.
  await t.test('a blocked popup or a phone-sized viewport falls back to leaving the page', () => {
    const blocked = makeHost();
    assert.equal(openPopup(blocked), null);
    const { calls, handlers } = makeHandlers();
    assert.equal(sendToPlex(blocked, null, handoff, handlers), undefined);
    assert.deepEqual(blocked.assigned, [handoff]);
    assert.equal(blocked.timers.size, 0);
    assert.deepEqual(calls, { ticks: 0, closed: 0 });
    const phone = makeHost({ popup: makePopup(), narrow: true });
    assert.equal(openPopup(phone), null);
    assert.equal(phone.opened, 0);
  });

  // Not checking popup.closed on each tick, or leaving the timer running after it closes, turns this red.
  await t.test('a popup closed early is reported once and stops the polling', () => {
    const popup = makePopup();
    const host = makeHost({ popup });
    const { calls, handlers } = makeHandlers();
    sendToPlex(host, popup, handoff, handlers);
    popup.closed = true;
    host.tick();
    assert.deepEqual(calls, { ticks: 0, closed: 1 });
    assert.equal(host.timers.size, 0);
    host.tick();
    assert.deepEqual(calls, { ticks: 0, closed: 1 });
  });

  // Reading state from the wrong part of the handoff URL, or throwing on a malformed one, turns this red.
  await t.test('the sign-in state is read from the handoff forwardUrl', () => {
    assert.equal(handoffState(handoff), 'abc');
    assert.equal(handoffState('https://app.plex.tv/auth'), undefined);
    assert.equal(handoffState(`https://app.plex.tv/auth#?${new URLSearchParams({ forwardUrl: 'https://media.example/auth/callback' })}`), undefined);
    assert.equal(handoffState('nope'), undefined);
  });

  // Accepting a message with another type or an empty state turns this red.
  await t.test('only a popup message with a non-empty state is accepted', () => {
    assert.equal(isPopupMessage({ type: 'plex-sign-in', state: 'abc' }), true);
    for (const data of [{ type: 'plex-sign-in', state: '' }, { type: 'other', state: 'abc' }, null, 'string']) {
      assert.equal(isPopupMessage(data), false, JSON.stringify(data));
    }
  });
});

test('the sign-in screen re-checks an unfinished Plex sign-in a few times, holds on success, and shows one line per screen', async (t) => {
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../src/client/signInFlow.ts', import.meta.url), 'utf8');
  const { RECHECK_TRIES, SUCCESS_HOLD_MS, holdSuccess, recheckLater, signInScreen } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
  const makeTimers = () => ({
    queued: [],
    setTimeout(cb, ms) { this.queued.push({ cb, ms }); return this.queued.length; },
    runNext() { this.queued.shift().cb(); },
  });

  // Dropping the retriesLeft check, re-checking without lowering the count, or skipping the isCurrent guard turns this red.
  await t.test('an unfinished sign-in is asked again with one try fewer until the tries run out, and not at all once replaced', () => {
    const timers = makeTimers();
    const rechecks = [];
    assert.equal(recheckLater(timers, 3, 2000, () => true, (left) => rechecks.push(left)), true);
    assert.deepEqual(timers.queued.map(({ ms }) => ms), [2000]);
    assert.deepEqual(rechecks, []);
    timers.runNext();
    assert.deepEqual(rechecks, [2]);
    assert.equal(recheckLater(timers, 0, 2000, () => true, (left) => rechecks.push(left)), false);
    assert.equal(timers.queued.length, 0);
    assert.equal(recheckLater(timers, 3, 1000, () => false, (left) => rechecks.push(left)), true);
    timers.runNext();
    assert.deepEqual(rechecks, [2]);
  });

  // Giving the 202 pending and 409 in_progress answers separate budgets, or changing the five-try budget, turns this red.
  await t.test('pending and in-progress answers share one budget of five re-checks before the wait is shown', () => {
    const timers = makeTimers();
    const answers = [202, 409, 202, 202, 409, 202];
    const asked = [];
    let view = 'checking';
    const check = (retriesLeft) => {
      const status = answers.shift();
      asked.push(status);
      if (!recheckLater(timers, retriesLeft, status === 202 ? 2000 : 1000, () => true, check)) view = 'pending';
    };
    check(RECHECK_TRIES);
    for (let run = 0; run < 10 && timers.queued.length > 0; run += 1) timers.runNext();
    assert.equal(RECHECK_TRIES, 5);
    assert.deepEqual(asked, [202, 409, 202, 202, 409, 202]);
    assert.equal(view, 'pending');
    assert.deepEqual(signInScreen(view, false, false), { screen: 'error', line: 'Couldn\'t log you in. Try again.' });
  });

  // Calling onSignedIn before the hold, more than once, or waiting under reduced motion turns this red.
  await t.test('a successful sign-in hands over once, after the hold or at once under reduced motion', () => {
    const timers = makeTimers();
    let calls = 0;
    assert.equal(holdSuccess(timers, false, () => { calls += 1; }), 1);
    assert.equal(SUCCESS_HOLD_MS, 2200);
    assert.deepEqual(timers.queued.map(({ ms }) => ms), [SUCCESS_HOLD_MS]);
    assert.equal(calls, 0);
    timers.runNext();
    assert.equal(calls, 1);
    const still = makeTimers();
    assert.equal(holdSuccess(still, true, () => { calls += 1; }), undefined);
    assert.equal(calls, 2);
    assert.equal(still.queued.length, 0);
  });

  // Changing which screen or line any sign-in state shows, including splitting the one failure line by cause, turns this red.
  await t.test('each sign-in state maps to its screen and line', () => {
    const failed = { screen: 'error', line: 'Couldn\'t log you in. Try again.' };
    assert.deepEqual(signInScreen('unavailable', true, true), { screen: 'success' });
    assert.deepEqual(signInScreen('status', false, false), { screen: 'loading' });
    assert.deepEqual(signInScreen('initial', false, false), { screen: 'idle' });
    assert.deepEqual(signInScreen('session-expired', false, false), { screen: 'idle', line: 'Your session expired. Sign in again.' });
    assert.deepEqual(signInScreen('not-configured', false, false), { screen: 'idle', line: 'Sign-in isn’t configured.' });
    assert.deepEqual(signInScreen('preparing', false, false), { screen: 'waiting' });
    assert.deepEqual(signInScreen('checking', false, false), { screen: 'waiting' });
    assert.deepEqual(signInScreen('pending', true, false), { screen: 'waiting' });
    assert.deepEqual(signInScreen('pending', false, false), failed);
    for (const view of ['interrupted', 'wrong-owner', 'unavailable', 'expired', 'invalid']) {
      assert.deepEqual(signInScreen(view, false, false), failed, view);
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

  // Making stop wait on a hung run without a limit turns this red: deploy.sh gives the old server 30 seconds.
  await t.test('stop gives up on a run still going after 20 seconds', async () => {
    const { timers, runner } = setup();
    runner.register('hung', 1000, () => new Promise(() => {}));
    runner.start();
    timers.advance(1000);
    await drain();
    let stopped = false;
    const stopping = runner.stop().then(() => { stopped = true; });
    timers.advance(19_999);
    await drain();
    assert.equal(stopped, false);
    timers.advance(1);
    await drain();
    assert.equal(stopped, true);
  });

  // Silently accepting a duplicate or late registration turns this red.
  await t.test('duplicate names and registering after start throw', () => {
    const { runner } = setup();
    runner.register('a', 1000, () => {});
    assert.throws(() => runner.register('a', 1000, () => {}), { message: 'Duplicate job: a' });
    runner.start();
    assert.throws(() => runner.register('b', 1000, () => {}), { message: 'Register jobs before start.' });
  });

  // Dropping a trigger that lands mid-run, or running once per trigger instead of once for all of them, turns this red.
  await t.test('a trigger runs the job now, and triggers during a run add exactly one more run', async () => {
    const { runner } = setup();
    const blocked = gate();
    let runs = 0;
    runner.register('a', 60_000, async () => {
      runs += 1;
      if (runs === 1) await blocked.wait;
    });
    runner.trigger('a');
    assert.equal(runs, 0);
    runner.start();
    runner.trigger('missing');
    runner.trigger('a');
    assert.equal(runs, 1);
    runner.trigger('a');
    runner.trigger('a');
    blocked.open();
    await drain();
    assert.equal(runs, 2);
    await drain();
    assert.equal(runs, 2);
  });

  // Not recording a finished run's time or failure, or never marking a job late after three silent intervals, turns this red.
  await t.test('status reports each job\'s last run, its failure and lateness', async (t) => {
    t.mock.method(console, 'error', () => {});
    const clock = { value: 0 };
    const timers = createFakeTimers(clock);
    const runner = createJobRunner(timers, () => clock.value);
    let blocked = false;
    runner.register('ok', 1000, () => {});
    runner.register('risky', 1000, () => { throw new Error('boom'); });
    runner.register('slow', 1000, () => (blocked ? new Promise(() => {}) : undefined));
    assert.deepEqual(runner.status().map((job) => job.late), [false, false, false]);
    runner.start();
    timers.advance(1000);
    await drain();
    const byName = Object.fromEntries(runner.status().map((job) => [job.name, job]));
    assert.equal(byName.ok.lastFinishedAt, 1000);
    assert.equal(byName.ok.lastFailed, false);
    assert.equal(byName.risky.lastFailed, true);
    assert.equal(byName.risky.lastFinishedAt, 1000);
    blocked = true;
    timers.advance(3001);
    await drain();
    const late = Object.fromEntries(runner.status().map((job) => [job.name, job.late]));
    assert.deepEqual(late, { ok: false, risky: false, slow: true });
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
  // Dropping the journal pragmas from openDatabase turns this red: every commit would fsync the file four times again.
  assert.equal(second.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  assert.equal(second.prepare('PRAGMA synchronous').get().synchronous, 1);
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

// Changing a piece of the PrivateHD formula, the and/or combination, giving Blutopia a ratio side, letting the global
// ratio flip a torrent's result, matching indexer names by substring, shipping a built-in rule, or letting the
// TRACKER_RULES rule win over a saved one turns this red.
test('hit and run rules come from settings or TRACKER_RULES with an exact name match', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-tracker-rules-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { checkHitAndRun, findTrackerRule: find } = await import(trackerRulesModuleUrl);
  const database = openDatabase(join(root, 'database.sqlite'));
  t.after(() => database.close());

  // A new install knows no tracker.
  for (const name of ['blutopia.cc', 'PrivateHD', 'BeyondHD (Prowlarr)']) assert.equal(find(database, name, {}), undefined, name);
  const env = { TRACKER_RULES: JSON.stringify(ownerRules) };
  const findTrackerRule = (database, name) => find(database, name, env);

  const privatehd = findTrackerRule(database, 'PrivateHD').rule;
  for (const [gb, hours] of [[1, 72.0], [49.99, 171.98], [50, 172.0], [100, 241.31]]) {
    const { requiredHours } = checkHitAndRun(privatehd, { seedHours: 0, ratio: 0, sizeBytes: gb * 1000 ** 3, completedBytes: gb * 1000 ** 3 });
    assert.equal(Math.round(requiredHours * 100) / 100, hours, `${gb} GB`);
  }

  const torrent = (seedHours, ratio) => ({ seedHours, ratio, sizeBytes: 10 * 1000 ** 3, completedBytes: 10 * 1000 ** 3 });
  const blutopia = findTrackerRule(database, 'blutopia.cc').rule;
  const beyondhd = findTrackerRule(database, 'BeyondHD (Prowlarr)');
  assert.equal(beyondhd.host, 'beyond-hd.me');
  setSetting(database, 'trackerConfiguration', 'rules.example.org', JSON.stringify({ minHours: 10, minRatio: 2, logic: 'and' }));
  const andRule = findTrackerRule(database, 'Example').rule;
  assert.equal(findTrackerRule(database, 'Example').host, 'example.org');
  // Blutopia has no ratio side, so a high ratio never clears it.
  for (const [rule, seedHours, ratio, expected] of [
    [blutopia, 100, 5.0, [false, null, false]], [blutopia, 168, 0, [true, null, true]],
    [beyondhd.rule, 120, 0, [true, false, true]], [beyondhd.rule, 0, 1.0, [false, true, true]],
    [beyondhd.rule, 120, 1.0, [true, true, true]], [beyondhd.rule, 119, 0.99, [false, false, false]],
    [andRule, 10, 2, [true, true, true]], [andRule, 9, 2, [false, true, false]],
    [andRule, 10, 1.99, [true, false, false]], [andRule, 0, 0, [false, false, false]],
  ]) {
    const result = checkHitAndRun(rule, torrent(seedHours, ratio));
    assert.deepEqual([result.hours, result.ratio, result.met], expected, `${rule.logic} ${seedHours}h ${ratio}`);
  }
  const lowGlobal = checkHitAndRun(blutopia, torrent(168, 0), 0.1);
  assert.deepEqual([lowGlobal.met, lowGlobal.globalRatio], [true, false]);
  assert.deepEqual([checkHitAndRun(blutopia, torrent(0, 0), 5).met, checkHitAndRun(blutopia, torrent(0, 0), 5).globalRatio], [false, true]);
  assert.equal(checkHitAndRun(privatehd, torrent(0, 0), 20).globalRatio, 'unknown');
  assert.equal(checkHitAndRun(beyondhd.rule, torrent(0, 0)).globalRatio, 'unknown');

  assert.equal(findTrackerRule(database, 'hd'), undefined);
  assert.equal(findTrackerRule(database, 'Unknown (Prowlarr)'), undefined);

  // The saved rule wins over the TRACKER_RULES one for the same host.
  setSetting(database, 'trackerConfiguration', 'rules.blutopia.cc', JSON.stringify({ minHours: 200, minRatio: 1, minGlobalRatio: 0.5, logic: 'or' }));
  assert.deepEqual(findTrackerRule(database, 'Blutopia (API)').rule, {
    seedHours: [{ hours: 200 }], ratio: 1, logic: 'or', minGlobalRatio: 0.5, partial: { exemptBelow: null, ratio: null, maxHours: null },
  });
  for (const bad of [
    'not json', '{"minHours":10,"minRatio":1,"logic":"xor"}', '{"minHours":10,"minRatio":1}',
    '{"minRatio":1,"logic":"or"}', '{"minHours":-1}', '{"minHours":10,"minGlobalRatio":"high"}',
  ]) {
    setSetting(database, 'trackerConfiguration', 'rules.example.org', bad);
    assert.throws(() => findTrackerRule(database, 'example.org'), { message: 'The saved hit and run rule for example.org is not valid.' });
  }

  // Dropping a bad TRACKER_RULES quietly, or not naming the host and field at fault, turns this red.
  const { trackerRulesFromEnvironment } = await import(trackerRulesModuleUrl);
  for (const [value, message] of [
    ['not json', 'TRACKER_RULES is not valid JSON.'],
    ['[]', 'TRACKER_RULES must be a JSON object keyed by tracker hostname.'],
    ['{"blutopia":{"minHours":1}}', 'TRACKER_RULES: "blutopia" is not a tracker hostname.'],
    ['{"blutopia.cc":{"minHours":168,"minRatio":1}}', 'TRACKER_RULES: the rule for blutopia.cc is not valid: logic must be "and" or "or" when minRatio is set.'],
    ['{"blutopia.cc":{"minHours":"168"}}', 'TRACKER_RULES: the rule for blutopia.cc is not valid: minHours must be a number of 0 or more.'],
    ['{"Blutopia.cc":{"minHours":1},"blutopia.cc":{"minHours":2}}', 'TRACKER_RULES: blutopia.cc is listed twice.'],
  ]) assert.throws(() => trackerRulesFromEnvironment({ TRACKER_RULES: value }), { message }, value);
});

const privateHdTable = [{ upToGB: 1, hours: 72 }, { upToGB: 50, hours: 72, perGB: 2 }, { hours: -219.2023, lnGB: 100 }];
// The owner's rules (above) written in the seed-hour table shape.
const ownerRulesAsTables = {
  'blutopia.cc': { seedHours: [{ hours: 168 }], minGlobalRatio: 0.4 },
  'beyond-hd.me': { seedHours: [{ hours: 120 }], ratio: 1.0, logic: 'or', minGlobalRatio: 0.25 },
  'privatehd.to': { seedHours: privateHdTable, ratio: 0.9, logic: 'or', partial: { exemptBelow: 0.1, ratio: 0.9, maxHours: 1440 } },
};

// Converting the old shape to a different table or partial rule, picking a table row by `<` instead of `<=`, using the
// wrong row, or skipping any of the table checks (row order, final row, negative hours at either end or at the turning
// point inside a row) turns this red.
test('seed-hour tables: the old rule shape converts to the same hours and results, and bad tables are refused', async () => {
  const { checkHitAndRun, parseRule, trackerRulesFromEnvironment } = await import(trackerRulesModuleUrl);
  const gb = 1000 ** 3;

  // The old shape in TRACKER_RULES still loads, and reads back as the table shape.
  const fromEnv = trackerRulesFromEnvironment({ TRACKER_RULES: JSON.stringify(ownerRules) });
  for (const [host, table] of Object.entries(ownerRulesAsTables)) assert.deepEqual(fromEnv.get(host), parseRule(table), host);
  assert.deepEqual(fromEnv.get('privatehd.to'), {
    seedHours: privateHdTable, ratio: 0.9, logic: 'or', minGlobalRatio: null, partial: { exemptBelow: 0.1, ratio: 0.9, maxHours: 1440 },
  });

  // Old and new shapes give the same check over a grid of sizes, seed times, ratios and amounts downloaded.
  const pairs = [
    ...Object.keys(ownerRules).map((host) => [ownerRules[host], ownerRulesAsTables[host]]),
    [{ minHours: 10, minRatio: 2, logic: 'and' }, { seedHours: [{ hours: 10 }], ratio: 2, logic: 'and' }],
    [{ minHours: 50, partialRatio: 1, partialMaxHours: 24 }, { seedHours: [{ hours: 50 }], partial: { ratio: 1, maxHours: 24 } }],
  ];
  const sizes = [0.5, 1, 1.0001, 10, 47.99, 48, 48.01, 49.99, 50, 50.01, 100, 1000, 5000];
  for (const [oldShape, newShape] of pairs) {
    const [before, after] = [parseRule(oldShape), parseRule(newShape)];
    for (const size of sizes) {
      for (const done of [0.05, 0.1, 0.5, 1]) {
        for (const seedHours of [0, 9, 10, 24, 71.9, 72, 120, 168, 171.99, 172.01, 241.3, 241.32, 1439, 1440]) {
          for (const ratio of [0, 0.89, 0.9, 1, 2]) {
            const torrent = { seedHours, ratio, sizeBytes: size * gb, completedBytes: size * done * gb };
            assert.deepEqual(checkHitAndRun(after, torrent, 0.3), checkHitAndRun(before, torrent, 0.3), `${JSON.stringify(oldShape)} ${size} GB ${done} ${seedHours} h ${ratio}`);
          }
        }
      }
    }
  }

  // The table reproduces the PrivateHD formula the code used before tables. At exactly 50 GB the old formula switched
  // to its log branch (172.0000005 h) and the table keeps the straight line (172 h).
  const required = (rule, size) => checkHitAndRun(parseRule(rule), { seedHours: 0, ratio: 0, sizeBytes: size * gb, completedBytes: size * gb }).requiredHours;
  const oldFormula = (size) => (size <= 1 ? 72 : size < 50 ? 72 + 2 * size : 100 * Math.log(size) - 219.2023);
  for (const size of [...sizes, 0.001, 2, 25, 75, 500, 9999]) assert.ok(Math.abs(required(ownerRulesAsTables['privatehd.to'], size) - oldFormula(size)) < 1e-6, `${size} GB`);
  for (const [size, hours] of [[1, 72.0], [49.99, 171.98], [50, 172.0], [100, 241.31]]) {
    assert.equal(Math.round(required(ownerRulesAsTables['privatehd.to'], size) * 100) / 100, hours, `${size} GB`);
  }
  const tiers = { seedHours: [{ upToGB: 48, hours: 72 }, { hours: 168 }] };
  assert.deepEqual([47.99, 48, 48.01].map((size) => required(tiers, size)), [72, 72, 168]);

  // Each bad table names the field at fault.
  const row = (index, extra) => `seedHours[${index}]${extra ?? ''}`;
  for (const [rule, field] of [
    [{}, 'seedHours'],
    [{ seedHours: [] }, 'seedHours'],
    [{ seedHours: [5] }, row(0)],
    [{ seedHours: [{ hours: '72' }] }, row(0, '.hours')],
    [{ seedHours: [{ upto: 48, hours: 72 }, { hours: 168 }] }, row(0, '.upto')],
    [{ seedHours: [{ upToGB: 1, hours: 72 }, { hours: 72, perGB: '2' }] }, row(1, '.perGB')],
    [{ seedHours: [{ upToGB: -1, hours: 72 }, { hours: 168 }] }, row(0, '.upToGB')],
    [{ seedHours: [{ hours: 72 }, { hours: 168 }] }, row(0, '.upToGB')],
    [{ seedHours: [{ upToGB: 48, hours: 72 }] }, row(0, '.upToGB')],
    [{ seedHours: [{ upToGB: 48, hours: 72 }, { upToGB: 48, hours: 100 }, { hours: 168 }] }, row(1, '.upToGB')],
    [{ seedHours: [{ hours: -1 }] }, row(0)],
    [{ seedHours: [{ upToGB: 1, hours: 72 }, { hours: 72, perGB: -1 }] }, row(1)],
    [{ seedHours: [{ hours: -219.2023, lnGB: 100 }] }, row(0)],
    [{ seedHours: [{ upToGB: 1, hours: 72 }, { upToGB: 50, hours: 72, perGB: 2 }, { hours: -400, lnGB: 100 }] }, row(2)],
    // Above zero at 1 and 10 000 GB, but 10 + 100 - 100·ln(100) ≈ -350 at 100 GB.
    [{ seedHours: [{ upToGB: 1, hours: 72 }, { hours: 10, perGB: 1, lnGB: -100 }] }, row(1)],
    [{ seedHours: [{ hours: 1 }], ratio: 1 }, 'logic'],
    [{ seedHours: [{ hours: 1 }], ratio: -1, logic: 'or' }, 'ratio'],
    [{ seedHours: [{ hours: 1 }], partial: { exemptBelow: 2 } }, 'partial.exemptBelow'],
    [{ seedHours: [{ hours: 1 }], partial: { maxHours: 'a' } }, 'partial.maxHours'],
    [{ seedHours: [{ hours: 1 }], partial: { exempt: 0.1 } }, 'partial.exempt'],
    [{ seedHours: [{ hours: 1 }], partial: 3 }, 'partial'],
    [{ seedHours: [{ hours: 1 }], minHourz: 3 }, 'minHourz'],
    [{ seedHours: [{ hours: 1 }], minHours: 3 }, 'minHours'],
  ]) assert.equal(parseRule(rule).field, field, JSON.stringify(rule));
  // A row whose lowest point, inside its range, stays above zero is accepted: 500 + 100 - 100·ln(100) ≈ 139 at 100 GB.
  assert.equal(parseRule({ seedHours: [{ upToGB: 1, hours: 72 }, { hours: 500, perGB: 1, lnGB: -100 }] }).field, undefined);
});

// Dropping either margin, letting time since finishing prove a time rule, matching only the exact announce hostname
// (so "tracker.beyond-hd.me" finds no rule), or letting a low global ratio leave "safe" standing turns this red.
test('removal advice applies the hit and run rule with margins and proves time only from the seeding counter', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-advice-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { adviseRemoval } = await import(adviceModuleUrl);
  const database = openDatabase(join(root, 'database.sqlite'));
  t.after(() => database.close());
  await saveOwnerRules(database);
  setSetting(database, 'trackerConfiguration', 'trackers.example.net', 'added');

  const now = 1_800_000_000_000;
  const hour = 3600;
  const GB = 1000 ** 3;
  const finished = now / 1000 - 1000 * hour;
  let count = 0;
  // Each row is first seen before it finished (full seeding history) unless `firstSeenAt` says otherwise.
  const torrent = (input) => {
    const hash = (++count).toString(16).toUpperCase().padStart(40, '0');
    const row = { host: 'blutopia.cc', sizeBytes: 10 * GB, ratio: 0, seconds: 0, finishedAt: finished, firstSeenAt: (finished - hour) * 1000, goneAt: null, complete: 1, active: 1, ...input };
    database.prepare("INSERT INTO torrents VALUES (?, 'Some.Movie', ?, ?, 0, 0, 1, 1, ?, ?, '', ?, ?, 0, 0, ?, ?, ?, ?, ?, '')")
      .run(hash, row.sizeBytes, row.completedBytes ?? row.sizeBytes, row.active, row.complete, row.finishedAt, row.ratio, row.host, row.firstSeenAt, now, row.goneAt, row.seconds);
    return hash;
  };
  const ratios = { 'blutopia.cc': 1.0 };
  const account = (ratio, requiredRatio = null) => ({
    ratio, uploadedBytes: null, downloadedBytes: null, bufferBytes: null, seeding: null, leeching: null, bonus: null, hitAndRuns: null, requiredRatio,
  });
  const advise = (hash, accountRatios = ratios) => adviseRemoval(database, hash, {
    now, accountStats: async (host) => (Object.hasOwn(accountRatios, host) ? account(accountRatios[host]) : null),
  });
  const blutopiaNeeds = 184.8 * hour;
  const unknownRatio = (host) => `Global ratio unknown: your ${host} ratio can't be read`;
  const sentences = ({ recommendation, reason, globalRatio }) => ({ recommendation, reason, globalRatio });

  for (const [name, input, recommendation, reason, globalRatio = null] of [
    ['Blutopia 1 s short', { seconds: blutopiaNeeds - 1, ratio: 5000 }, 'keep', 'Keep seeding: 1 hour of seeding left'],
    ['Blutopia met', { seconds: blutopiaNeeds }, 'safe', 'Hit and run rule met: seeded 185 hours of 185 hours needed with margin'],
    ['Beyond-HD short on both', { host: 'tracker.beyond-hd.me', seconds: 132 * hour - 1, ratio: 1049 }, 'keep',
      'Keep seeding: 1 hour of seeding left, or ratio 1.04 of 1.05 needed', unknownRatio('beyond-hd.me')],
    ['Beyond-HD time met', { host: 'tracker.beyond-hd.me', seconds: 132 * hour }, 'safe',
      'Hit and run rule met: seeded 132 hours of 132 hours needed with margin', unknownRatio('beyond-hd.me')],
    ['Beyond-HD ratio met', { host: 'tracker.beyond-hd.me', ratio: 1050 }, 'safe', 'Hit and run rule met: ratio 1.05 of 1.05', unknownRatio('beyond-hd.me')],
    ['PrivateHD 40 GB 1 s short', { host: 'tracker.privatehd.to', sizeBytes: 40 * GB, seconds: 167.2 * hour - 1, ratio: 949 }, 'keep',
      'Keep seeding: 1 hour of seeding left, or ratio 0.94 of 0.95 needed'],
    ['PrivateHD 40 GB met', { host: 'tracker.privatehd.to', sizeBytes: 40 * GB, seconds: 167.2 * hour }, 'safe',
      'Hit and run rule met: seeded 168 hours of 168 hours needed with margin'],
    ['PrivateHD ratio met', { host: 'tracker.privatehd.to', ratio: 950 }, 'safe', 'Hit and run rule met: ratio 0.95 of 0.95'],
    ['no history, finished under the rule', { finishedAt: now / 1000 - 100 * hour, firstSeenAt: now - hour * 1000 }, 'keep',
      'Keep seeding: at least 85 hours of seeding left'],
    ['no history, finished long ago', { firstSeenAt: now - 10 * hour * 1000, seconds: 10 * hour }, 'unconfirmed',
      "Can't confirm yet; keep seeding: seeding time not confirmed: up to 1000 hours since it finished (upper estimate, includes time not seeding); confirmed in 175 hours if it keeps seeding"],
    ['no history, counter proves it', { firstSeenAt: now - 200 * hour * 1000, seconds: blutopiaNeeds }, 'safe',
      'Hit and run rule met: seeded 185 hours of 185 hours needed with margin'],
    ['no history, ratio proves it', { host: 'tracker.beyond-hd.me', firstSeenAt: now - hour * 1000, ratio: 1100 }, 'safe',
      'Hit and run rule met: ratio 1.10 of 1.05', unknownRatio('beyond-hd.me')],
    ['gone from rTorrent', { seconds: blutopiaNeeds, goneAt: now - 1000 }, 'keep', 'Seeding time unknown (torrent not in rTorrent)'],
    // Judging a size-0 torrent by its rule reads it as complete and finished in 1970.
    ['waiting for metadata', { sizeBytes: 0, completedBytes: 0, finishedAt: 0, firstSeenAt: now - hour * 1000 }, 'keep',
      "Waiting for the torrent's metadata; nothing downloaded yet"],
    ['no rule', { host: 'tracker.opentrackr.org', seconds: blutopiaNeeds }, 'unconfirmed', "Can't tell; keep seeding: no hit and run rule for tracker.opentrackr.org"],
    // An added tracker with no rule yet must not borrow one.
    ['added tracker, no rule', { host: 'tracker.example.net', seconds: blutopiaNeeds }, 'unconfirmed', "Can't tell; keep seeding: no hit and run rule for tracker.example.net"],
    ['no tracker', { host: null }, 'unconfirmed', "Can't tell; keep seeding: its tracker is not known"],
    // Incomplete torrents: judging them by the complete rule, letting the counter prove PrivateHD's 60 days, dropping the
    // ratio margin, or calling a running download under 10% safe turns these red.
    ['PrivateHD partial ratio met', { host: 'tracker.privatehd.to', sizeBytes: 40 * GB, completedBytes: 20 * GB, complete: 0, ratio: 950 }, 'safe',
      'Partly downloaded: ratio 0.95 of 0.95 on the data downloaded'],
    ['PrivateHD partial ratio short', { host: 'tracker.privatehd.to', sizeBytes: 40 * GB, completedBytes: 20 * GB, complete: 0, ratio: 949, seconds: 2000 * hour }, 'keep',
      "Partly downloaded: clears at ratio 0.95 of the data downloaded (now 0.94) or after 66 days seeding, which isn't measured yet"],
    ['PrivateHD under 10%, stopped', { host: 'tracker.privatehd.to', sizeBytes: 40 * GB, completedBytes: 3 * GB, complete: 0, active: 0 }, 'safe',
      'Under 10% downloaded; not a hit and run on privatehd.to'],
    ['PrivateHD under 10%, downloading', { host: 'tracker.privatehd.to', sizeBytes: 40 * GB, completedBytes: 3 * GB, complete: 0 }, 'keep', 'Still downloading'],
    ['Blutopia incomplete', { completedBytes: 5 * GB, complete: 0, seconds: blutopiaNeeds }, 'keep', 'Download not complete; blutopia.cc counts seed time only at 100%'],
  ]) {
    assert.deepEqual(sentences(await advise(torrent(input))), { recommendation, reason, globalRatio }, name);
  }

  // Leaving the margin out of requiredHours, letting hoursLeft reach 0 while seed time is still short, giving an
  // incomplete torrent hours left the counter can't measure, or keeping the verdict prefix in detail turns this red.
  const numbers = ({ host, requiredHours, seededHours, hoursLeft, detail }) => ({ host, requiredHours, seededHours, hoursLeft, detail });
  for (const [name, input, expected] of [
    ['1 s short', { seconds: blutopiaNeeds - 1 },
      { host: 'blutopia.cc', requiredHours: 184.8, seededHours: 184.8, hoursLeft: 0.01, detail: '1 hour of seeding left' }],
    ['met', { seconds: blutopiaNeeds + 10 * hour },
      { host: 'blutopia.cc', requiredHours: 184.8, seededHours: 194.8, hoursLeft: 0, detail: 'seeded 195 hours of 185 hours needed with margin' }],
    ['subdomain host', { host: 'tracker.beyond-hd.me', seconds: 100 * hour },
      { host: 'beyond-hd.me', requiredHours: 132, seededHours: 100, hoursLeft: 32, detail: '32 hours of seeding left, or ratio 0.00 of 1.05 needed' }],
    ['partial', { host: 'tracker.privatehd.to', sizeBytes: 40 * GB, completedBytes: 20 * GB, complete: 0, ratio: 949, seconds: 2000 * hour },
      { host: 'privatehd.to', requiredHours: 1584, seededHours: 2000, hoursLeft: null,
        detail: "Partly downloaded: clears at ratio 0.95 of the data downloaded (now 0.94) or after 66 days seeding, which isn't measured yet" }],
    ['no rule', { host: 'tracker.opentrackr.org', seconds: 7 * hour },
      { host: 'tracker.opentrackr.org', requiredHours: null, seededHours: 7, hoursLeft: null, detail: 'no hit and run rule for tracker.opentrackr.org' }],
    ['met on ratio alone', { host: 'tracker.beyond-hd.me', seconds: 100 * hour, ratio: 1050 },
      { host: 'beyond-hd.me', requiredHours: 132, seededHours: 100, hoursLeft: 0, detail: 'ratio 1.05 of 1.05' }],
    ['gone', { goneAt: now - 1000, seconds: 7 * hour },
      { host: 'blutopia.cc', requiredHours: null, seededHours: null, hoursLeft: null, detail: 'Seeding time unknown (torrent not in rTorrent)' }],
  ]) {
    assert.deepEqual(numbers(await advise(torrent(input))), expected, name);
  }
  // ruleHours is the tracker's own rule without the margin; taking it from requiredHours turns this red.
  assert.equal((await advise(torrent({ seconds: blutopiaNeeds - 1 }))).ruleHours, 168);
  assert.equal((await advise(torrent({ host: 'tracker.opentrackr.org', seconds: 7 * hour }))).ruleHours, null);
  assert.equal((await advise('F'.repeat(40))).reason, 'Seeding time unknown (torrent not in rTorrent)');

  // Blutopia's minimum is 0.4, so anything under 0.5 keeps the torrent even when its rule is met.
  const met = torrent({ seconds: blutopiaNeeds });
  assert.deepEqual(sentences(await advise(met, { 'blutopia.cc': 0.49 })), {
    recommendation: 'keep', reason: 'Hit and run rule met: seeded 185 hours of 185 hours needed with margin',
    globalRatio: 'Keep for ratio: your blutopia.cc ratio is 0.49, minimum 0.4',
  });
  assert.equal((await advise(met, { 'blutopia.cc': 0.5 })).recommendation, 'safe');
  assert.deepEqual(sentences(await advise(met, { 'blutopia.cc': null })), {
    recommendation: 'safe', reason: 'Hit and run rule met: seeded 185 hours of 185 hours needed with margin', globalRatio: unknownRatio('blutopia.cc'),
  });

  // A Gazelle account's own required ratio beats the rule's minGlobalRatio: 0.7 clears 0.4 with margin but not 0.6.
  setSetting(database, 'trackerConfiguration', 'rules.gazelle.example', JSON.stringify({ seedHours: [{ hours: 1 }], minGlobalRatio: 0.4 }));
  const gazelle = torrent({ host: 'gazelle.example', seconds: 10 * hour });
  const adviseGazelle = (ratio, requiredRatio) => adviseRemoval(database, gazelle, {
    now, accountStats: async (host) => (host === 'gazelle.example' ? account(ratio, requiredRatio) : null),
  });
  assert.deepEqual(sentences(await adviseGazelle(0.7, 0.6)), {
    recommendation: 'keep', reason: 'Hit and run rule met: seeded 10 hours of 7 hours needed with margin',
    globalRatio: 'Keep for ratio: your gazelle.example ratio is 0.70, minimum 0.6',
  });
  assert.deepEqual(sentences(await adviseGazelle(0.7, null)), {
    recommendation: 'safe', reason: 'Hit and run rule met: seeded 10 hours of 7 hours needed with margin', globalRatio: null,
  });
  assert.equal((await adviseGazelle(0.75, 0.6)).recommendation, 'safe');

  setSetting(database, 'trackerConfiguration', 'margins.blutopia.cc', JSON.stringify({ timeFactor: 1.2 }));
  assert.equal((await advise(met)).reason, 'Keep seeding: 17 hours of seeding left');
  for (const bad of ['not json', '{"timeFactor":0.9}', '{"extraHours":-1}', '{"ratioExtra":"0.05"}', '{"other":1}', '[]']) {
    setSetting(database, 'trackerConfiguration', 'margins.blutopia.cc', bad);
    await assert.rejects(advise(met), { message: 'The saved hit and run margins for blutopia.cc are not valid.' }, bad);
  }
});

// PrivateHD's rules for incomplete torrents (privatehd.to/rules/hit-run-rules). Each case names its defect.
test('incomplete torrents follow the tracker partial-download rules', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-partial-rules-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { checkHitAndRun, findTrackerRule } = await import(trackerRulesModuleUrl);
  const database = openDatabase(join(root, 'database.sqlite'));
  t.after(() => database.close());
  await saveOwnerRules(database);
  const privatehd = findTrackerRule(database, 'privatehd.to').rule;
  const blutopia = findTrackerRule(database, 'blutopia.cc').rule;
  const gb = 1000 ** 3;
  // 15 GB torrent; `ratio` is uploaded over downloaded, as rTorrent's d.ratio reports it.
  const stuck = (downloadedGb, uploadedGb, seedHours) => ({ seedHours, ratio: uploadedGb / downloadedGb, sizeBytes: 15 * gb, completedBytes: downloadedGb * gb });
  for (const [label, rule, torrent, expected] of [
    // Dividing the upload by the torrent's size instead of the data downloaded turns this red.
    ['4.5 of 5 GB uploaded', privatehd, stuck(5, 4.5, 0), ['partial', true]],
    // Lowering partialRatio below 0.9 turns this red.
    ['4.4 of 5 GB uploaded', privatehd, stuck(5, 4.4, 0), ['partial', false]],
    // Ignoring partialMaxHours, or applying the 15 GB complete seed time (102 h) to an incomplete torrent, turns these red.
    ['1440 h partial', privatehd, stuck(5, 0, 1440), ['partial', true]],
    ['1439 h partial', privatehd, stuck(5, 0, 1439), ['partial', false]],
    // Dropping the under-10% exemption turns this red.
    ['1.4 of 15 GB', privatehd, stuck(1.4, 0, 0), ['under_buffer', true]],
    // Using <= instead of < for the exemption turns this red.
    ['exactly 10%', privatehd, stuck(1.5, 0, 0), ['partial', false]],
    // Letting an incomplete torrent fall back to the complete rule, or giving Blutopia partial defaults, turns these red.
    ['Blutopia incomplete, long seed', blutopia, stuck(5, 5, 10000), ['partial', false]],
    ['Blutopia incomplete, tiny', blutopia, stuck(0.1, 0, 0), ['partial', false]],
  ]) {
    const result = checkHitAndRun(rule, torrent);
    assert.deepEqual([result.case, result.met], expected, label);
  }
  // Treating a finished torrent as incomplete turns this red.
  assert.equal(checkHitAndRun(privatehd, { seedHours: 0, ratio: 0.9, sizeBytes: 15 * gb, completedBytes: 15 * gb }).case, 'complete');

  // Accepting a non-numeric partialRatio, or a fraction above 1, turns this red.
  for (const bad of ['{"minHours":10,"partialRatio":"abc"}', '{"minHours":10,"partialExemptBelow":10}']) {
    setSetting(database, 'trackerConfiguration', 'rules.example.org', bad);
    assert.throws(() => findTrackerRule(database, 'example.org'), { message: 'The saved hit and run rule for example.org is not valid.' });
  }
});

// A startup storage failure, or a TRACKER_RULES that would otherwise be dropped, must exit unsuccessfully with one
// fixed message and never begin listening.
test('production startup stops when database initialization fails or TRACKER_RULES or PORT is invalid', async (t) => {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'media-manager-2-startup-failure-'));
  t.after(() => rm(workingDirectory, { recursive: true, force: true }));
  for (const [overrides, message] of [
    [{}, 'Database initialization failed.'],
    [{ TRACKER_RULES: '{"blutopia.cc":{"minHours":-1}}' }, 'TRACKER_RULES: the rule for blutopia.cc is not valid: minHours must be a number of 0 or more.'],
    // Passing a port that is not a whole number to the listener, which then fails with a stack trace or picks another port, turns these rows red.
    [{ PORT: '3000x' }, 'PORT must be a whole number from 0 to 65535.'],
    [{ PORT: '65536' }, 'PORT must be a whole number from 0 to 65535.'],
  ]) {
    const env = { ...process.env, DB_PATH: 'relative.sqlite', HOST: '127.0.0.1', NODE_NO_WARNINGS: '1', PORT: '0' };
    delete env.TRACKER_RULES;
    Object.assign(env, overrides);
    const child = spawn(process.execPath, [serverPath], { cwd: workingDirectory, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const [code, signal] = await once(child, 'exit');
    assert.equal(signal, null);
    assert.notEqual(code, 0);
    assert.equal(output.trim(), message);
    assert.doesNotMatch(output, /Listening on|relative\.sqlite/);
  }
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
  const { createJellyfin } = await import(jellyfinModuleUrl);
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
    {
      name: 'jellyfin',
      create: (fetch) => createJellyfin(database, { fetch }),
      url: 'http://127.0.0.1:65005',
      credentials: { 'jellyfin.apiKey': `jellyfin-key-${pid}-distinctive` },
      method: 'GET',
      // The public /System/Info/Public answers without a key, so probing it would pass a wrong key.
      probeUrl: 'http://127.0.0.1:65005/System/Info',
      headers: { authorization: `MediaBrowser Token="jellyfin-key-${pid}-distinctive"`, accept: 'application/json' },
      okBody: JSON.stringify({ Version: '10.11.0' }),
      version: '10.11.0',
      malformedBody: '{}',
      usePrimitive: (service) => service.findLibraryFor('/media', 'movie'),
      primitiveResult: undefined,
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

// Matching a library of the wrong type or by a name prefix, reading a refused library list as "no library", sending the scan
// anywhere but /Library/Media/Updated, keeping Plex once Jellyfin is set up, or naming Plex in a Jellyfin install's problem turns this red.
test('the Jellyfin version finds the library holding a folder, asks it to scan, and is used once Jellyfin is set up', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createMediaServer } = await import(mediaServerModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createProblems } = await import(problemsModuleUrl);
  const { createVersionImport, PLEX_PROBLEM_KIND } = await import(versionImportModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-jellyfin-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const key = `jellyfin-key-${process.pid}`;
  const calls = [];
  let libraries = [];
  let listStatus = 200;
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', headers: new Headers(init.headers), body: init.body });
    if (String(url).endsWith('/Library/VirtualFolders')) return new Response(JSON.stringify(libraries), { status: listStatus });
    return new Response(null, { status: 204 });
  };
  const mediaServer = createMediaServer(database, { fetch });
  setSetting(database, 'serviceAddresses', 'plex.url', 'http://plex.test');
  setSetting(database, 'credentials', 'plex.token', 'plex-token');
  assert.equal(mediaServer().name, 'plex');
  setSetting(database, 'serviceAddresses', 'jellyfin.url', 'http://jellyfin.test/');
  setSetting(database, 'credentials', 'jellyfin.apiKey', key);
  const jellyfin = mediaServer();
  assert.equal(jellyfin.name, 'jellyfin');

  libraries = [
    { Name: 'Shows', ItemId: 'tv1', CollectionType: 'tvshows', Locations: ['/media/versions'] },
    { Name: 'Films', ItemId: 'mv1', CollectionType: 'movies', Locations: ['/media/films', '/media/versions'] },
  ];
  assert.deepEqual(await jellyfin.findLibraryFor('/media/versions/movies', 'movie'), { id: 'mv1' });
  assert.deepEqual(await jellyfin.findLibraryFor('/media/versions/tv', 'show'), { id: 'tv1' });
  assert.equal(await jellyfin.findLibraryFor('/media/versions-old', 'movie'), undefined);
  assert.equal(calls[0].url, 'http://jellyfin.test/Library/VirtualFolders');
  assert.equal(calls[0].headers.get('authorization'), `MediaBrowser Token="${key}"`);
  listStatus = 401;
  await assert.rejects(jellyfin.findLibraryFor('/media/versions/movies', 'movie'));
  listStatus = 200;

  const folder = '/media/versions/movies/Dune - Part Two (2024)';
  await jellyfin.refresh({ id: 'mv1' }, folder);
  const scan = calls.at(-1);
  assert.deepEqual([scan.method, scan.url, scan.headers.get('content-type')], ['POST', 'http://jellyfin.test/Library/Media/Updated', 'application/json']);
  assert.deepEqual(JSON.parse(scan.body), { Updates: [{ Path: folder, UpdateType: 'Created' }] });

  const problems = createProblems({ database, events: createEventHub() });
  const versionImport = createVersionImport({ database, rtorrent: { call: async () => assert.fail('not asked') }, arr: {}, mediaServer, problems });
  libraries = [];
  await versionImport.scan('radarr', '/media/versions/movies', new Set([folder]));
  assert.deepEqual(database.prepare("SELECT summary FROM problems WHERE kind = ? AND state != 'resolved'").all(PLEX_PROBLEM_KIND).map((row) => row.summary),
    ['Add /media/versions/movies to the Jellyfin Movies library.']);
});

// Matching items by full path (Radarr and Jellyfin see different mounts), merging before both items exist, not narrowing
// episodes by season, counting an outage or a 503 as a try, retrying a rejected request forever, retrying a merged row or
// past MERGE_TRIES, not merging again after a rename of the tracked file, merging again after a same-path upgrade, or giving
// Plex installs a merge step turns this red.
test('an imported second version is merged with the tracked file in Jellyfin once both are scanned', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createMediaServer } = await import(mediaServerModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createProblems } = await import(problemsModuleUrl);
  const { createVersionImport, MERGE_TRIES } = await import(versionImportModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-jellyfin-merge-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const calls = [];
  let items = [];
  let refuse = null;
  const fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    calls.push({ path: parsed.pathname, query: parsed.searchParams, method: init.method ?? 'GET' });
    if (refuse !== null) return new Response(null, { status: refuse });
    if (parsed.pathname === '/Items') return new Response(JSON.stringify({ Items: items }), { status: 200 });
    return new Response(null, { status: 204 });
  };
  const mediaServer = createMediaServer(database, { fetch });
  setSetting(database, 'serviceAddresses', 'plex.url', 'http://plex.test');
  setSetting(database, 'credentials', 'plex.token', 'plex-token');
  assert.equal(mediaServer().mergeVersions, undefined);
  setSetting(database, 'serviceAddresses', 'jellyfin.url', 'http://jellyfin.test');
  setSetting(database, 'credentials', 'jellyfin.apiKey', 'jellyfin-key');

  let dune = { id: 10, path: '/radarr/movies/Dune (2024)/Dune (2024) Bluray-1080p.mkv' };
  const arr = {
    radarr: { movie: async (id) => ({ kind: 'ok', value: { file: id === 1 ? dune : { id: 20, path: '/radarr/movies/Gone (2001)/Gone (2001) Bluray-1080p.mkv' } } }) },
    sonarr: {
      episodes: async (seriesId, options) => {
        assert.deepEqual([seriesId, options], [5, { withFiles: true }]);
        return { kind: 'ok', value: [{ id: 7, seasonNumber: 1, file: { id: 30, path: '/sonarr/tv/Show/Season 01/Show - S01E01 - Pilot Bluray-1080p.mkv' } }] };
      },
    },
  };
  const insert = database.prepare(`INSERT INTO second_versions (service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, hash, state, file_path, merge_tries, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'release', 'guid', 'indexer', 'Bluray-2160p', 'HASH', 'imported', ?, ?, 0, 0)`);
  const movieRow = insert.run('radarr', 1, null, null, '/media/versions/movies/Dune (2024)/Dune (2024) - Bluray-2160p GRP.mkv', 0).lastInsertRowid;
  const episodeRow = insert.run('sonarr', null, 5, 7, '/media/versions/tv/Show/Season 01/Show - S01E01 - Bluray-2160p GRP.mkv', 0).lastInsertRowid;
  const lastTryRow = insert.run('radarr', 2, null, null, '/media/versions/movies/Gone (2001)/Gone (2001) - Bluray-2160p GRP.mkv', MERGE_TRIES - 1).lastInsertRowid;
  const tries = (id) => Number(database.prepare('SELECT merge_tries FROM second_versions WHERE id = ?').get(id).merge_tries);
  const problems = createProblems({ database, events: createEventHub() });
  const versionImport = createVersionImport({ database, rtorrent: { call: async () => assert.fail('not asked') }, arr, mediaServer, problems });

  // An outage spends no try.
  const reachable = fetch;
  let down = true;
  const outageFetch = async (url, init) => (down ? Promise.reject(new TypeError('fetch failed')) : reachable(url, init));
  const outage = createVersionImport({ database, rtorrent: { call: async () => assert.fail('not asked') }, arr, mediaServer: createMediaServer(database, { fetch: outageFetch }), problems });
  await outage.run();
  assert.deepEqual([tries(movieRow), tries(episodeRow), tries(lastTryRow)], [0, 0, MERGE_TRIES - 1]);
  down = false;

  // Radarr down spends no try on the movies; Sonarr answered, so the episode spends one.
  const radarrDown = createVersionImport({ database, rtorrent: { call: async () => assert.fail('not asked') }, arr: { ...arr, radarr: { movie: async () => ({ kind: 'unreachable' }) } }, mediaServer, problems });
  await radarrDown.run();
  assert.deepEqual([tries(movieRow), tries(episodeRow), tries(lastTryRow)], [0, 1, MERGE_TRIES - 1]);

  // Jellyfin has not scanned yet: nothing to merge, one try spent each.
  await versionImport.run();
  assert.equal(calls.some((call) => call.path === '/Videos/MergeVersions'), false);
  assert.deepEqual([tries(movieRow), tries(episodeRow), tries(lastTryRow)], [1, 2, MERGE_TRIES]);

  // A 503 while Jellyfin restarts spends none; a rejected request spends a try instead of being retried forever.
  refuse = 503;
  await versionImport.run();
  assert.deepEqual([tries(movieRow), tries(episodeRow), tries(lastTryRow)], [1, 2, MERGE_TRIES]);
  refuse = 400;
  await versionImport.run();
  refuse = null;
  assert.deepEqual([tries(movieRow), tries(episodeRow), tries(lastTryRow)], [2, 3, MERGE_TRIES]);

  items = [
    { Id: 'm-old', Path: '/data/movies/Dune (2024)/Dune (2024) Bluray-1080p.mkv' },
    { Id: 'm-new', Path: '/media/versions/movies/Dune (2024)/Dune (2024) - Bluray-2160p GRP.mkv' },
    { Id: 'e-old', Path: '/data/tv/Show/Season 01/Show - S01E01 - Pilot Bluray-1080p.mkv' },
    { Id: 'e-new', Path: '/media/versions/tv/Show/Season 01/Show - S01E01 - Bluray-2160p GRP.mkv' },
  ];
  calls.length = 0;
  await versionImport.run();
  const lists = calls.filter((call) => call.path === '/Items');
  assert.deepEqual(lists.map((call) => [call.query.get('IncludeItemTypes'), call.query.get('ParentIndexNumber'), call.query.get('Fields')]),
    [['Movie', null, 'Path'], ['Episode', '1', 'Path']]);
  assert.deepEqual(calls.filter((call) => call.path === '/Videos/MergeVersions').map((call) => [call.method, call.query.getAll('ids')]),
    [['POST', ['m-old', 'm-new']], ['POST', ['e-old', 'e-new']]]);
  assert.deepEqual([tries(movieRow), tries(episodeRow)], [MERGE_TRIES, MERGE_TRIES]);

  calls.length = 0;
  await versionImport.run();
  assert.deepEqual(calls, []);

  // Radarr renames the tracked file: the merge splits in Jellyfin, so the version is merged again with the new item.
  dune = { id: 10, path: '/radarr/movies/Dune (2024)/Dune (2024) Remux-2160p.mkv' };
  items = [...items.filter((item) => item.Id !== 'm-old'), { Id: 'm-renamed', Path: '/data/movies/Dune (2024)/Dune (2024) Remux-2160p.mkv' }];
  await versionImport.run();
  assert.deepEqual(calls.filter((call) => call.path === '/Videos/MergeVersions').map((call) => call.query.getAll('ids')), [['m-renamed', 'm-new']]);
  assert.deepEqual([tries(movieRow), tries(episodeRow), tries(lastTryRow)], [MERGE_TRIES, MERGE_TRIES, MERGE_TRIES]);

  // An upgrade under the same path keeps the Jellyfin item and its merge (slot test, 13 Oct 2026), so nothing is sent.
  calls.length = 0;
  dune = { id: 11, path: dune.path };
  await versionImport.run();
  assert.deepEqual(calls, []);
  assert.equal(tries(movieRow), MERGE_TRIES);
});

test('the TMDB client sends the key only to TMDB, parses partial replies and caches lists', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTmdb } = await import(tmdbModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-tmdb-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const key = `tmdb-key-${process.pid}-distinctive`;
  setSetting(database, 'credentials', 'tmdb.apiKey', key);
  let clock = 1_800_000_000_000;
  const connect = (respond) => {
    const calls = [];
    const tmdb = createTmdb(database, { now: () => clock, fetch: async (url, init) => {
      calls.push(new URL(String(url)));
      assert.equal(init.redirect, 'error');
      return respond(new URL(String(url)));
    } });
    return { tmdb, calls };
  };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

  // Reading a missing field as anything but null or an empty list, or confusing the movie and TV reply shapes, turns this red.
  await t.test('title details from a reply with most fields missing', async () => {
    const { tmdb, calls } = connect(() => json({ id: 7, name: 'Show', keywords: { results: [{ id: 1, name: 'heist' }, { id: 'x' }] }, aggregate_credits: { cast: [{ id: 3, name: 'Ann', roles: [{ character: 'Lead' }] }, { name: 'No id' }] } }));
    assert.deepEqual(await tmdb.details('tv', 7), { kind: 'ok', value: {
      id: 7, mediaType: 'tv', tvdbId: null, title: 'Show', overview: null, tagline: null, posterPath: null, backdropPath: null, date: null, runtime: null,
      status: null, voteAverage: null, genres: [], keywords: [{ id: 1, name: 'heist' }], recommendations: [], cast: [{ id: 3, name: 'Ann', character: 'Lead', profilePath: null }],
    } });
    assert.equal(calls[0].origin + calls[0].pathname, 'https://api.themoviedb.org/3/tv/7');
    assert.equal(calls[0].searchParams.get('append_to_response'), 'keywords,recommendations,aggregate_credits,external_ids');
    assert.equal(calls[0].searchParams.get('api_key'), key);
  });

  // Dropping the cache, keeping a list past five minutes, or caching a failure turns this red.
  await t.test('a list is served from memory for five minutes, then fetched again', async () => {
    let fail = true;
    const { tmdb, calls } = connect(() => (fail ? new Response('', { status: 500 }) : json({ page: 1, results: [{ id: 1, title: 'Film' }] })));
    assert.equal((await tmdb.trending('movie', 'week')).kind, 'refused');
    fail = false;
    const first = await tmdb.trending('movie', 'week');
    assert.equal(first.kind, 'ok');
    assert.equal(first.value.results[0].title, 'Film');
    clock += 5 * 60_000 - 1;
    assert.deepEqual(await tmdb.trending('movie', 'week'), first);
    assert.equal(calls.length, 2);
    clock += 1;
    await tmdb.trending('movie', 'week');
    assert.equal(calls.length, 3);
  });

  // Reading a 401 as anything but a rejected key, a network failure as anything but unreachable, or putting the key in a message turns this red.
  await t.test('the check maps 401 to rejected and a network failure to unreachable, and no message carries the key', async () => {
    assert.deepEqual(await connect(() => json({ success: true })).tmdb.check(), { kind: 'ok', version: '3' });
    assert.deepEqual(await connect(() => json({ status_message: 'Invalid API key' }, 401)).tmdb.check(), { kind: 'rejected' });
    const offline = connect(() => { throw new TypeError(`fetch failed for ${key}`); });
    assert.deepEqual(await offline.tmdb.check(), { kind: 'unreachable' });
    const failures = [
      await offline.tmdb.discover('movie', { with_genres: '18' }),
      await connect(() => json({ status_message: `bad ${key}` }, 401)).tmdb.genres('tv'),
      await connect(() => json({}, 500)).tmdb.details('movie', 1),
    ];
    for (const failure of failures) {
      assert.notEqual(failure.kind, 'ok');
      assert.equal(JSON.stringify(failure).includes(key), false, failure.kind);
    }
  });

  // Asking for appended parts, dropping genre ids, date or popularity, or accepting a body without an id turns this red.
  await t.test('a title summary parses one title and refuses a body without an id', async () => {
    const { tmdb, calls } = connect(() => json({ id: 7, name: 'Show', genres: [{ id: 18, name: 'Drama' }], first_air_date: '2022-02-17', popularity: 12.5, vote_average: 8.1 }));
    assert.deepEqual(await tmdb.summary('tv', 7), { kind: 'ok', value: {
      id: 7, mediaType: 'tv', title: 'Show', overview: null, posterPath: null, backdropPath: null, date: '2022-02-17', voteAverage: 8.1, genreIds: [18], popularity: 12.5,
    } });
    assert.equal(calls[0].origin + calls[0].pathname, 'https://api.themoviedb.org/3/tv/7');
    assert.equal(calls[0].searchParams.has('append_to_response'), false);
    const refused = await connect(() => json({ name: 'No id' })).tmdb.summary('movie', 1);
    assert.equal(refused.kind, 'refused');
  });

  // Removing the in-flight limit, or letting a waiting request jump the queue past it, turns this red.
  await t.test('no more than 20 requests are in flight at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const { tmdb, calls } = connect(async (url) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight -= 1;
      return json({ id: Number(url.pathname.split('/').at(-1)), title: 'Film' });
    });
    const results = await Promise.all(Array.from({ length: 50 }, (_, index) => tmdb.summary('movie', index + 1)));
    assert.ok(results.every((result) => result.kind === 'ok'));
    assert.equal(calls.length, 50);
    assert.equal(peak, 20);
  });

  // Giving up on the first 429, or retrying more than once, turns this red.
  await t.test('a 429 waits for Retry-After and retries once', async () => {
    let answers = 0;
    const { tmdb, calls } = connect(() => {
      answers += 1;
      return answers === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '0' } }) : json({ id: 5, title: 'Film' });
    });
    assert.equal((await tmdb.summary('movie', 5)).kind, 'ok');
    assert.equal(calls.length, 2);
    const limited = connect(() => new Response('', { status: 429, headers: { 'Retry-After': '0' } }));
    assert.equal((await limited.tmdb.summary('movie', 5)).kind, 'refused');
    assert.equal(limited.calls.length, 2);
  });

  // Waiting the full Retry-After, however long TMDB asks for, turns this red.
  await t.test('a 429 waits at most 10 seconds whatever Retry-After says', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let answers = 0;
    const { tmdb, calls } = connect(() => {
      answers += 1;
      return answers === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '86400' } }) : json({ id: 5, title: 'Film' });
    });
    const pending = tmdb.summary('movie', 5);
    for (let turn = 0; turn < 5; turn += 1) await drain();
    t.mock.timers.tick(9_999);
    await drain();
    assert.equal(calls.length, 1);
    t.mock.timers.tick(1);
    for (let turn = 0; turn < 5; turn += 1) await drain();
    assert.equal(calls.length, 2);
    assert.equal((await pending).kind, 'ok');
  });

  // Reading rent or buy entries as streaming, keeping a non-numeric id, or putting the key anywhere but the api_key parameter turns this red.
  await t.test('streaming availability keeps flatrate provider ids by country', async () => {
    const { tmdb, calls } = connect(() => json({ results: { US: { flatrate: [{ provider_id: 8 }, { provider_id: 'x' }], rent: [{ provider_id: 2 }] }, GB: {} } }));
    assert.deepEqual(await tmdb.watchProviders('movie', 550), { kind: 'ok', value: { US: [8], GB: [] } });
    assert.equal(calls[0].origin + calls[0].pathname, 'https://api.themoviedb.org/3/movie/550/watch/providers');
    assert.deepEqual([...calls[0].searchParams.keys()], ['api_key']);
    assert.equal(calls[0].href.replace(`api_key=${key}`, '').includes(key), false);
    for (const failure of [
      await connect(() => json({ status_message: `bad ${key}` }, 401)).tmdb.watchProviders('tv', 1),
      await connect(() => { throw new TypeError(`fetch failed for ${key}`); }).tmdb.watchProviders('movie', 1),
    ]) {
      assert.notEqual(failure.kind, 'ok');
      assert.equal(JSON.stringify(failure).includes(key), false, failure.kind);
    }
  });
});

test('the Trakt check sends the Client ID only to Trakt and classifies each answer', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTrakt } = await import(traktModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-trakt-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const clientId = `trakt-client-${process.pid}-distinctive`;
  const check = async (respond) => {
    const calls = [];
    const status = await createTrakt(database, { fetch: async (url, init) => {
      calls.push({ url: new URL(String(url)), init, headers: new Headers(init.headers) });
      return respond();
    } }).check();
    return { status, calls };
  };

  // Asking Trakt before a Client ID is saved turns this red.
  const unset = await check(() => assert.fail('unexpected request'));
  assert.deepEqual(unset, { status: { kind: 'not_configured' }, calls: [] });

  // Sending the Client ID anywhere but the trakt-api-key header to api.trakt.tv, or reading 403 as anything but rejected, turns this red.
  setSetting(database, 'credentials', 'trakt.clientId', clientId);
  const ok = await check(() => new Response('[]', { status: 200 }));
  assert.deepEqual(ok.status, { kind: 'ok', version: 'key accepted' });
  assert.equal(ok.calls[0].url.origin, 'https://api.trakt.tv');
  assert.equal(ok.calls[0].url.href.includes(clientId), false);
  assert.equal(ok.calls[0].headers.get('trakt-api-key'), clientId);
  assert.equal(ok.calls[0].headers.get('trakt-api-version'), '2');
  assert.equal(ok.calls[0].init.redirect, 'error');
  const cases = [
    [() => new Response('', { status: 403 }), 'rejected'],
    [() => new Response('', { status: 401 }), 'rejected'],
    [() => new Response('', { status: 500 }), 'unreachable'],
    [() => { throw new TypeError(`fetch failed for ${clientId}`); }, 'unreachable'],
  ];
  for (const [respond, kind] of cases) assert.deepEqual((await check(respond)).status, { kind });

  // Dropping a header, putting the Client ID in the URL, or parsing a wrapped title wrongly turns this red.
  await t.test('list asks for a section with the Trakt headers and parses wrapped titles', async () => {
    const calls = [];
    const trakt = createTrakt(database, { fetch: async (url, init) => {
      calls.push({ url: new URL(String(url)), headers: new Headers(init.headers) });
      return new Response(JSON.stringify([
        { watchers: 5, show: { title: 'Severance', year: 2022, rating: 8.7, first_aired: '2026-11-03T01:00:00.000Z', ids: { tmdb: 95396, tvdb: 371980 } } },
        { watchers: 1, show: { title: 'No ids', ids: {} } },
      ]), { status: 200 });
    } });
    const result = await trakt.list({ type: 'tv', kind: 'trending', limit: 20 });
    assert.equal(calls[0].url.href, 'https://api.trakt.tv/shows/trending?extended=full&limit=20');
    assert.equal(calls[0].url.href.includes(clientId), false);
    assert.equal(calls[0].headers.get('content-type'), 'application/json');
    assert.equal(calls[0].headers.get('trakt-api-version'), '2');
    assert.equal(calls[0].headers.get('trakt-api-key'), clientId);
    assert.equal(calls[0].headers.get('user-agent'), 'media-manager-2');
    assert.deepEqual(result, { kind: 'ok', value: [
      { type: 'tv', tmdbId: 95396, tvdbId: 371980, title: 'Severance', year: 2022, date: '2026-11-03', rating: 8.7 },
      { type: 'tv', tmdbId: null, tvdbId: null, title: 'No ids', year: null, date: null, rating: null },
    ] });
  });

  // Changing how a request maps to a Trakt path or filter query turns this red.
  await t.test('list maps each request to its path and filter query', async () => {
    const full = { genres: ['action', 'science-fiction'], years: [2020, 2026], ratings: [60, 100], tmdbRatings: [6.5, 10], languages: ['en'], countries: ['us'], runtimes: [30, 90], certifications: ['pg-13'] };
    const rows = [
      [{ type: 'movie', kind: 'trending' }, '/movies/trending', { extended: 'full', limit: '20' }],
      [{ type: 'movie', kind: 'popular' }, '/movies/popular', { extended: 'full', limit: '20' }],
      [{ type: 'movie', kind: 'watched' }, '/movies/watched/weekly', { extended: 'full', limit: '20' }],
      [{ type: 'tv', kind: 'collected', period: 'monthly' }, '/shows/collected/monthly', { extended: 'full', limit: '20' }],
      [{ type: 'tv', kind: 'played', period: 'all' }, '/shows/played/all', { extended: 'full', limit: '20' }],
      [{ type: 'movie', kind: 'favorited', period: 'daily' }, '/movies/favorited/daily', { extended: 'full', limit: '20' }],
      [{ type: 'tv', kind: 'anticipated' }, '/shows/anticipated', { extended: 'full', limit: '20' }],
      [{ type: 'movie', kind: 'boxoffice', filters: { genres: ['action'] } }, '/movies/boxoffice', { extended: 'full' }],
      [{ type: 'movie', kind: 'trending', filters: full }, '/movies/trending', { extended: 'full', limit: '20', genres: 'action,science-fiction', years: '2020-2026', ratings: '60-100', tmdb_ratings: '6.5-10', languages: 'en', countries: 'us', runtimes: '30-90', certifications: 'pg-13' }],
      [{ type: 'movie', kind: 'trending', filters: { years: [2024, 2024] } }, '/movies/trending', { extended: 'full', limit: '20', years: '2024' }],
      [{ type: 'tv', kind: 'trending', filters: { networkIds: [53], status: ['returning series', 'upcoming'] } }, '/shows/trending', { extended: 'full', limit: '20', network_ids: '53', status: 'returning series,upcoming' }],
    ];
    for (const [request, pathname, query] of rows) {
      const calls = [];
      const trakt = createTrakt(database, { fetch: async (url) => {
        calls.push(new URL(String(url)));
        return new Response('[]', { status: 200 });
      } });
      await trakt.list({ limit: 20, ...request });
      assert.equal(calls[0].pathname, pathname, JSON.stringify(request));
      assert.deepEqual(Object.fromEntries([...calls[0].searchParams.entries()].sort()), Object.fromEntries(Object.entries(query).sort()), JSON.stringify(request));
    }
    const popular = await createTrakt(database, { fetch: async () => new Response(JSON.stringify([{ title: 'Bare', year: 2026, ids: { tmdb: 7 }, released: '2026-10-30' }]), { status: 200 }) }).list({ type: 'movie', kind: 'popular', limit: 1 });
    assert.deepEqual(popular, { kind: 'ok', value: [{ type: 'movie', tmdbId: 7, tvdbId: null, title: 'Bare', year: 2026, date: '2026-10-30', rating: null }] });
  });

  // Asking for the wrong genre section, or keeping entries without a slug, turns this red.
  await t.test('genres reads the movie or show section and keeps only complete entries', async () => {
    const paths = [];
    const trakt = createTrakt(database, { fetch: async (url) => {
      paths.push(new URL(String(url)).pathname);
      return new Response(JSON.stringify([{ name: 'Action', slug: 'action' }, { name: 'x' }]), { status: 200 });
    } });
    assert.deepEqual(await trakt.genres('movie'), { kind: 'ok', value: [{ name: 'Action', slug: 'action' }] });
    await trakt.genres('tv');
    assert.deepEqual(paths, ['/genres/movies', '/genres/shows']);
  });

  // Ignoring Retry-After on a 429, or pausing check() with the lists, turns this red.
  await t.test('a 429 pauses list and genres until Retry-After has passed but not check', async () => {
    let clock = 1_000_000;
    let fetches = 0;
    let status = 429;
    const trakt = createTrakt(database, { now: () => clock, fetch: async () => {
      fetches += 1;
      return new Response('[]', { status, headers: status === 429 ? { 'Retry-After': '30' } : {} });
    } });
    const first = await trakt.list({ type: 'movie', kind: 'trending', limit: 5 });
    assert.equal(first.kind, 'refused');
    assert.equal(first.status, 429);
    clock += 29_000;
    const paused = await trakt.list({ type: 'movie', kind: 'trending', limit: 5 });
    assert.equal(paused.kind, 'refused');
    assert.equal(paused.status, 429);
    assert.equal((await trakt.genres('tv')).kind, 'refused');
    assert.equal(fetches, 1);
    status = 200;
    assert.equal((await trakt.check()).kind, 'ok');
    assert.equal(fetches, 2);
    clock += 1_000;
    assert.equal((await trakt.list({ type: 'movie', kind: 'trending', limit: 5 })).kind, 'ok');
    assert.equal(fetches, 3);
  });

  // Reading a 403 as anything but rejected, or letting a failure carry the Client ID, turns this red.
  await t.test('list failures are classified and never carry the Client ID', async () => {
    const cases = [
      [() => new Response('<html>Cloudflare challenge</html>', { status: 403, headers: { 'Content-Type': 'text/html' } }), 'rejected'],
      [() => new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } }), 'rejected'],
      [() => { throw new TypeError(`fetch failed for ${clientId}`); }, 'unreachable'],
    ];
    for (const [respond, kind] of cases) {
      const failure = await createTrakt(database, { fetch: async () => respond() }).list({ type: 'movie', kind: 'trending', limit: 5 });
      assert.equal(failure.kind, kind);
      assert.equal(JSON.stringify(failure).includes(clientId), false);
    }
  });

  // Calling Trakt before a Client ID is saved turns this red.
  await t.test('list and genres send nothing without a Client ID', async () => {
    setSetting(database, 'credentials', 'trakt.clientId', '');
    const trakt = createTrakt(database, { fetch: async () => assert.fail('unexpected request') });
    assert.equal((await trakt.list({ type: 'movie', kind: 'trending', limit: 5 })).kind, 'not_configured');
    assert.equal((await trakt.genres('movie')).kind, 'not_configured');
  });
});

test('MDBList ratings fill the show page by site, are saved for a week and never fail the page', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createLibrary, createLibraryRoutes } = await import(libraryModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const { createMdblist, ratingsBySite } = await import(mdblistModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-mdblist-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const key = `mdblist-key-${process.pid}-distinctive`;
  const { fake, ...services } = connectArr(database);
  fake.sonarr.state.series = [seriesRecord({ id: 7, title: 'Severance', tvdbId: 371980, tmdbId: 95396 })];
  fake.sonarr.state.lookup = [{ title: 'Severance', tvdbId: 371980, tmdbId: 95396, seasons: [] }];
  // The real MDBList reply for Severance (/tvdb/show/371980), 11 Oct 2026.
  const severance = {
    ids: { imdb: 'tt11280740', trakt: 154997, tmdb: 95396, tvdb: 371980, mal: null, mdblist: 'x' },
    ratings: [
      { source: 'imdb', value: 8.6, score: 86, votes: 410881, url: 63 },
      { source: 'metacritic', value: 85, score: 85, votes: 82, url: null },
      { source: 'metacriticuser', value: 8.3, score: 83, votes: 1048, url: null },
      { source: 'trakt', value: 86, score: 86, votes: 25373, url: null },
      { source: 'tomatoes', value: 95, score: 95, votes: 242, url: null, fresh: 1 },
      { source: 'popcorn', value: 80, score: 80, votes: null, url: null },
      { source: 'tmdb', value: 84, score: 84, votes: 3008, url: null },
      { source: 'letterboxd', value: null, score: null, votes: null, url: null },
      { source: 'rogerebert', value: null, score: null, votes: null, url: null },
      { source: 'myanimelist', value: null, score: null, votes: null, url: null },
    ],
  };
  const expected = {
    imdb: { value: 8.6, votes: 410881 },
    rottenTomatoes: { value: 95, votes: 242 },
    rottenTomatoesAudience: { value: 80, votes: null },
    metacritic: { value: 85, votes: 82 },
  };
  const none = { imdb: null, rottenTomatoes: null, rottenTomatoesAudience: null, metacritic: null };
  const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
  const clock = { value: 1_800_000_000_000 };
  const connect = (respond, tvdbIdOf = async () => ({ kind: 'ok', value: 371980 })) => {
    database.prepare("DELETE FROM title_store_parts WHERE part = 'mdblistRatings'").run();
    const calls = [];
    const mdblist = createMdblist(database, { now: () => clock.value, fetch: async (url, init) => {
      calls.push(new URL(String(url)));
      assert.equal(init.redirect, 'error');
      return respond(new URL(String(url)));
    } });
    const routes = createLibraryRoutes(createLibrary(services, () => [], createTitleStore(database, { now: () => clock.value }), mdblist, tvdbIdOf));
    const page = async (path = '/series/7') => {
      const response = await routes.request(path);
      return { status: response.status, text: await response.text() };
    };
    return { mdblist, calls, page };
  };

  // Reading score instead of value, mapping a source to the wrong site, or dropping the old rating field turns this red.
  await t.test('the Severance reply maps to each site, on the library page and the preview', async () => {
    setSetting(database, 'credentials', 'mdblist.apiKey', key);
    const { calls, page } = connect(() => json(severance));
    const body = JSON.parse((await page()).text);
    assert.deepEqual(body.ratingsBySite, expected);
    assert.equal('rating' in body, true);
    assert.equal(calls[0].origin + calls[0].pathname, 'https://api.mdblist.com/tvdb/show/371980');
    assert.equal(calls[0].searchParams.get('apikey'), key);
    assert.deepEqual(JSON.parse((await page('/preview/sonarr/371980')).text).ratingsBySite, expected);
  });

  // Previewing anything but the TVDB id TMDB names, answering a show TMDB has no TVDB id for with anything but 404, or answering a TMDB failure with 404, turns this red.
  await t.test('a show preview by TMDB id serves the TVDB preview, 404 when TMDB knows no TVDB id, and TMDB failures as themselves', async () => {
    const { page } = connect(() => json(severance));
    const byTmdb = await page('/preview/sonarr/tmdb/95396');
    assert.equal(byTmdb.status, 200);
    assert.equal(byTmdb.text, (await page('/preview/sonarr/371980')).text);
    assert.equal((await connect(() => json(severance), async () => ({ kind: 'ok', value: null })).page('/preview/sonarr/tmdb/95396')).status, 404);
    const failing = (kind) => connect(() => json(severance), async () => ({ kind, message: `TMDB ${kind}` })).page('/preview/sonarr/tmdb/95396');
    const down = await failing('unreachable');
    assert.equal(down.status, 502);
    assert.deepEqual(JSON.parse(down.text), { error: 'unreachable', reason: 'TMDB unreachable' });
    assert.equal((await failing('rejected')).status, 502);
    assert.equal((await failing('not_configured')).status, 503);
    // Answering a server with no TMDB at all with anything but 503 turns this red.
    const noTmdb = createLibraryRoutes(createLibrary(services, () => [], createTitleStore(database, { now: () => clock.value })));
    assert.equal((await noTmdb.request('/preview/sonarr/tmdb/95396')).status, 503);
  });

  // Not falling back to the TMDB id when MDBList has no such TVDB id turns this red.
  await t.test('a TVDB id MDBList does not know falls back to the TMDB id', async () => {
    const { calls, page } = connect((url) => (url.pathname.startsWith('/tvdb/') ? json({ error: 'not found' }, 404) : json(severance)));
    assert.deepEqual(JSON.parse((await page()).text).ratingsBySite, expected);
    assert.deepEqual(calls.map((url) => url.pathname), ['/tvdb/show/371980', '/tmdb/show/95396']);
  });

  // Turning a missing site or a site with a null value into anything but null turns this red.
  await t.test('a missing site and a site whose fields are all null both give null', () => {
    const ratings = severance.ratings
      .filter((rating) => rating.source !== 'metacritic')
      .map((rating) => (rating.source === 'imdb' ? { source: 'imdb', value: null, score: null, votes: null, url: null } : rating));
    assert.deepEqual(ratingsBySite(ratings), { ...expected, imdb: null, metacritic: null });
  });

  // Failing the page when MDBList fails, saving a failure, or putting the key in a message or log line turns this red.
  await t.test('an unset, rejected, rate-limited or unreachable MDBList leaves every site null and the page 200', async () => {
    const logged = [];
    const originals = { error: console.error, warn: console.warn, log: console.log };
    for (const name of Object.keys(originals)) console[name] = (...args) => { logged.push(args.map(String).join(' ')); };
    try {
      const cases = [
        { name: 'unset', set: '', respond: () => json(severance), status: { kind: 'not_configured' } },
        { name: 'rejected', set: key, respond: () => json({ error: `Invalid API key ${key}` }, 403), status: { kind: 'rejected' } },
        { name: 'rate-limited', set: key, respond: () => json({ error: 'limit' }, 429, { 'Retry-After': '3600' }), status: { kind: 'ok', version: 'daily request limit reached' } },
        { name: 'unreachable', set: key, respond: () => { throw new TypeError(`fetch failed for ${key}`); }, status: { kind: 'unreachable' } },
      ];
      for (const entry of cases) {
        setSetting(database, 'credentials', 'mdblist.apiKey', entry.set);
        const { mdblist, page } = connect(entry.respond);
        const answer = await page();
        assert.equal(answer.status, 200, entry.name);
        assert.deepEqual(JSON.parse(answer.text).ratingsBySite, none, entry.name);
        const status = await mdblist.check();
        assert.deepEqual(status, entry.status, entry.name);
        for (const text of [answer.text, JSON.stringify(status)]) assert.equal(text.includes(key), false, entry.name);
      }
      assert.equal(logged.some((line) => line.includes(key)), false);
    } finally {
      Object.assign(console, originals);
    }
  });

  // Asking MDBList again within seven days, or not refreshing a saved copy once it is a week old, turns this red.
  await t.test('a second request within seven days makes no MDBList call', async () => {
    setSetting(database, 'credentials', 'mdblist.apiKey', key);
    const { calls, page } = connect(() => json(severance));
    await page();
    clock.value += 7 * 86_400_000 - 1;
    assert.deepEqual(JSON.parse((await page()).text).ratingsBySite, expected);
    assert.equal(calls.length, 1);
    clock.value += 1;
    assert.deepEqual(JSON.parse((await page()).text).ratingsBySite, expected);
    assert.equal(calls.length, 2);
  });
});

test('a title page gets top cast, keywords and similar titles from TMDB, saved for seven days', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting, deleteSetting } = await import(settingsModuleUrl);
  const { createTmdb } = await import(tmdbModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const { createTmdbTitles, createTmdbTitleRoutes } = await import(tmdbTitlesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-tmdb-titles-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  setSetting(database, 'credentials', 'tmdb.apiKey', 'tmdb-key');
  database.prepare('INSERT INTO titles (service, id, title, year, detail, fingerprint, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('radarr', 5, 'Dune', 2021, JSON.stringify({ id: 5, tmdbId: 438631 }), 'x', 0);
  const clock = { value: 1_800_000_000_000 };
  let respond = () => { throw new TypeError('fetch failed'); };
  let calls = 0;
  const tmdb = createTmdb(database, { now: () => clock.value, fetch: async (url) => { calls += 1; return respond(new URL(String(url))); } });
  const store = createTitleStore(database, { now: () => clock.value });
  const titles = createTmdbTitles({ database, tmdb, store });
  const routes = createTmdbTitleRoutes(titles);
  const json = (body, status = 200) => () => new Response(JSON.stringify(body), { status });
  const page = async (path) => {
    const response = await routes.request(path);
    assert.equal(response.status, 200, path);
    return response.json();
  };
  const settle = async (done) => {
    for (let turn = 0; turn < 100 && !done(); turn += 1) await new Promise((resolve) => setImmediate(resolve));
  };

  // Ignoring TMDB's cast order or the top-10 cap, dropping the library id match, or building the poster URL other than the saved-image route turns this red.
  await t.test('fields map from a TMDB reply', async () => {
    const cast = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, name: `Actor ${index + 1}`, roles: [{ character: `Role ${index + 1}` }] }));
    const recommendations = [
      { id: 438631, media_type: 'movie', title: 'Dune', release_date: '2021-09-15', poster_path: '/dune.jpg' },
      { id: 99, name: 'Untitled poster', first_air_date: '' },
      { id: 98 },
      ...Array.from({ length: 25 }, (_, index) => ({ id: 1000 + index, name: `Show ${index}` })),
    ];
    respond = json({ id: 95396, name: 'Severance', external_ids: { tvdb_id: 371980 }, keywords: { results: [{ id: 1, name: 'office' }] }, aggregate_credits: { cast }, recommendations: { results: recommendations } });
    const show = await page('/tmdb/tv/95396');
    assert.deepEqual(show.cast.slice(0, 2), [{ name: 'Actor 1', character: 'Role 1' }, { name: 'Actor 2', character: 'Role 2' }]);
    assert.equal(show.cast.length, 10);
    assert.deepEqual(show.keywords, ['office']);
    assert.equal(show.similar.length, 20);
    assert.deepEqual(show.similar.slice(0, 2), [
      { tmdbId: 438631, type: 'movie', title: 'Dune', year: 2021, posterUrl: '/api/images/tmdb/w342/dune.jpg', libraryId: 5 },
      { tmdbId: 99, type: 'tv', title: 'Untitled poster', year: null, posterUrl: null, libraryId: null },
    ]);
    respond = json({ id: 1, title: 'Film', keywords: { keywords: [{ id: 1, name: 'heist' }] }, credits: { cast }, recommendations: { results: [{ id: 2, title: 'Other' }] } });
    assert.deepEqual(await page('/tmdb/movie/1'), { similar: [{ tmdbId: 2, type: 'movie', title: 'Other', year: null, posterUrl: null, libraryId: null }] });
    assert.equal((await routes.request('/tmdb/person/1')).status, 400);
  });

  // Reading the TVDB id from anywhere but TMDB's external_ids, answering a show without one with anything but null, or folding a TMDB outage into null, turns this red.
  await t.test('tvdbIdOf reads the TVDB id from external_ids, gives null without one, and passes a TMDB failure on', async () => {
    respond = json({ id: 95396, name: 'Severance', external_ids: { tvdb_id: 371980 } });
    assert.deepEqual(await titles.tvdbIdOf(95396), { kind: 'ok', value: 371980 });
    respond = json({ id: 50, name: 'Unknown to TVDB' });
    assert.deepEqual(await titles.tvdbIdOf(50), { kind: 'ok', value: null });
    respond = () => { throw new TypeError('fetch failed'); };
    assert.equal((await titles.tvdbIdOf(51)).kind, 'unreachable');
  });

  // Waiting for TMDB when no details are saved, skipping the save for the next visit, or folding a TMDB failure into anything but null turns this red.
  await t.test('backdropPath answers from the saved details and loads missing ones in the background', async () => {
    let release;
    respond = () => new Promise((resolve) => { release = resolve; });
    assert.equal(await titles.backdropPath('tv', 424242), null);
    await settle(() => release !== undefined);
    assert.notEqual(release, undefined);
    release(json({ id: 424242, name: 'Held show', external_ids: { tvdb_id: 515151 }, backdrop_path: '/held.jpg' })());
    await settle(() => store.get({ type: 'tv', tmdbId: 424242 }, 'tmdbDetails') !== undefined);
    assert.equal(await titles.backdropPath('tv', 424242), '/held.jpg');

    respond = () => { throw new TypeError('fetch failed'); };
    assert.equal(await titles.backdropPath('movie', 88888), null);
    await settle(() => store.get({ type: 'movie', tmdbId: 88888 }, 'tmdbDetails') !== undefined);
    assert.equal(store.get({ type: 'movie', tmdbId: 88888 }, 'tmdbDetails'), undefined);
    assert.equal(await titles.backdropPath('movie', 88888), null);
  });

  // Throwing or dropping a section when TMDB omits keywords, credits or recommendations turns this red.
  await t.test('a reply missing every field gives empty sections', async () => {
    respond = json({ id: 7 });
    assert.deepEqual(await page('/tmdb/tv/7'), { cast: [], keywords: [], similar: [] });
  });

  // Counting future-dated episodes as aired, appending seasons in another order, or throwing when TMDB fails turns this red.
  await t.test('airing counts episodes aired by today per season and gives the next air date', async () => {
    const show = { id: 9, seasons: [{ season_number: 0, episode_count: 2 }, { season_number: 1, episode_count: 3 }], next_episode_to_air: { air_date: '2027-01-05' } };
    const appended = [];
    respond = (url) => {
      if (!url.searchParams.has('append_to_response')) return json(show)();
      appended.push(url.searchParams.get('append_to_response'));
      return json({ ...show, 'season/1': { episodes: [{ air_date: '2020-01-01' }, { air_date: '2020-01-08' }, { air_date: '2999-01-01' }] } })();
    };
    assert.deepEqual(await page('/tmdb/tv/9/airing'), { seasons: [{ seasonNumber: 0, aired: 2 }, { seasonNumber: 1, aired: 2 }], nextAirDate: '2027-01-05' });
    assert.deepEqual(appended, ['season/1,season/0']);
    respond = () => { throw new TypeError('fetch failed'); };
    assert.deepEqual(await page('/tmdb/tv/8/airing'), { seasons: null, nextAirDate: null });
  });

  // Counting only released films, calling a collection with an undated film all released, or passing a bad id through turns this red.
  await t.test('collection gives the film count and whether every film is out', async () => {
    respond = json({ id: 10, parts: [{ id: 1, release_date: '2001-01-01' }, { id: 2, release_date: '2999-01-01' }, { id: 3 }] });
    assert.deepEqual(await page('/tmdb/collection/10'), { collection: { films: 3, allReleased: false } });
    respond = json({ id: 11, parts: [{ id: 1, release_date: '2001-01-01' }, { id: 2, release_date: '2020-01-01' }] });
    assert.deepEqual(await page('/tmdb/collection/11'), { collection: { films: 2, allReleased: true } });
    respond = () => { throw new TypeError('fetch failed'); };
    assert.deepEqual(await page('/tmdb/collection/12'), { collection: null });
    assert.equal((await routes.request('/tmdb/collection/abc')).status, 400);
  });

  // Answering anything but 200 with empty sections when TMDB is unset, rejects the key or is down turns this red.
  await t.test('TMDB unset, rejected or unreachable gives empty sections with 200', async () => {
    const before = calls;
    deleteSetting(database, 'credentials', 'tmdb.apiKey');
    assert.deepEqual(await page('/tmdb/tv/11'), { cast: [], keywords: [], similar: [] });
    assert.equal(calls, before);
    setSetting(database, 'credentials', 'tmdb.apiKey', 'tmdb-key');
    respond = json({ status_message: 'Invalid API key' }, 401);
    assert.deepEqual(await page('/tmdb/tv/12'), { cast: [], keywords: [], similar: [] });
    respond = () => { throw new TypeError('fetch failed'); };
    assert.deepEqual(await page('/tmdb/movie/13'), { similar: [] });
  });

  // Skipping the saved copy, refetching before seven days, or making the visitor wait on a stale refetch turns this red.
  await t.test('a second request within seven days makes no TMDB call, and a stale copy is served while it refetches', async () => {
    const before = calls;
    // The show saved by the first subtest is found again by its TMDB id though the store keeps shows under their TVDB id.
    assert.deepEqual((await page('/tmdb/tv/95396')).keywords, ['office']);
    assert.equal(calls, before);
    respond = json({ id: 20, title: 'First', recommendations: { results: [{ id: 21, title: 'Old' }] } });
    assert.equal((await page('/tmdb/movie/20')).similar[0].title, 'Old');
    clock.value += 7 * 86_400_000 - 1;
    respond = json({ id: 20, title: 'First', recommendations: { results: [{ id: 21, title: 'New' }] } });
    assert.equal((await page('/tmdb/movie/20')).similar[0].title, 'Old');
    assert.equal(calls, before + 1);
    clock.value += 1;
    assert.equal((await page('/tmdb/movie/20')).similar[0].title, 'Old');
    const savedAt = () => database.prepare("SELECT fetched_at FROM title_store_parts WHERE key = 'movie:20'").get().fetched_at;
    await settle(() => savedAt() === clock.value);
    assert.equal((await page('/tmdb/movie/20')).similar[0].title, 'New');
    assert.equal(calls, before + 2);
  });
});

// Serving a credential, overwriting one with a blank, saving tested values, or accepting a key no service reads turns this red.
test('the settings screen shows addresses, hides credentials, saves known keys and tests unsaved values', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { getSetting, listSettingKeys, setSetting } = await import(settingsModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const { createConnectionRoutes } = await import(connectionsModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-settings-screen-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const { fake } = connectArr(database, { sonarr: {} });
  const secrets = [`rtorrent-password-${process.pid}-distinctive`];
  setSetting(database, 'credentials', 'rtorrent.password', secrets[0]);
  setSetting(database, 'credentials', 'plex.token', '');
  // Only the fake Sonarr's port answers; every other address is unreachable.
  const fetch = async (url, init) => {
    if (new URL(String(url)).port === '65201') return fake.sonarr.fetch(url, init);
    throw new TypeError('fetch failed');
  };
  const { app } = await makeApp({ api: createConnectionRoutes(database, { fetch }) });
  const { session } = await signIn(app);
  const send = (method, path, body, headers = jsonHeaders('https://media.example')) => app.request(path, {
    method, headers: { ...headers, Cookie: session }, body: JSON.stringify(body),
  });

  // Serving any credential value, or reporting an empty one as set, turns this red.
  const read = await app.request('/api/settings', { headers: { Cookie: session } });
  assert.equal(read.status, 200);
  const text = await read.text();
  for (const secret of [...secrets, 'test-key']) assert.equal(text.includes(secret), false, secret);
  const { services } = JSON.parse(text);
  // Tracker accounts live with their trackers; listing the old Blutopia, PrivateHD or Beyond-HD sign-ins here turns this red.
  assert.deepEqual(services.map((entry) => entry.service), ['sonarr', 'radarr', 'rtorrent', 'plex', 'tmdb', 'mdblist', 'trakt']);
  assert.deepEqual(services[0], { service: 'sonarr', serviceAddresses: { 'sonarr.url': 'http://127.0.0.1:65201' }, credentials: { 'sonarr.apiKey': true } });
  assert.deepEqual(services[2].credentials, { 'rtorrent.username': false, 'rtorrent.password': true });
  assert.deepEqual(services[3].credentials, { 'plex.token': false });
  // Asking for a TMDB address, which is fixed, turns this red.
  assert.deepEqual(services[4], { service: 'tmdb', serviceAddresses: {}, credentials: { 'tmdb.apiKey': false } });
  // Asking for an MDBList address, which is fixed, turns this red.
  assert.deepEqual(services[5], { service: 'mdblist', serviceAddresses: {}, credentials: { 'mdblist.apiKey': false } });
  // Asking for a Trakt address, which is fixed, turns this red.
  assert.deepEqual(services[6], { service: 'trakt', serviceAddresses: {}, credentials: { 'trakt.clientId': false } });

  // Saving a blank credential over the stored one, or accepting a key no service reads, turns this red.
  const before = listSettingKeys(database);
  assert.equal((await send('PUT', '/api/settings/credentials/rtorrent.password', { value: '  ' })).status, 204);
  assert.equal(getSetting(database, 'credentials', 'rtorrent.password'), secrets[0]);
  for (const path of ['hostPaths/sonarr.url', 'credentials/webhook.secret', 'serviceAddresses/sonarr.apiKey', 'credentials/anything', 'credentials/blutopia.apiToken', 'serviceAddresses/beyondhd.url']) {
    assert.equal((await send('PUT', `/api/settings/${path}`, { value: 'x' })).status, 404, path);
  }
  assert.equal((await send('PUT', '/api/settings/serviceAddresses/radarr.url', { value: 1 })).status, 400);
  assert.equal((await send('PUT', '/api/settings/serviceAddresses/radarr.url', { value: 'x' }, { 'Content-Type': 'application/json' })).status, 403);
  assert.deepEqual(listSettingKeys(database), before);
  assert.equal((await send('PUT', '/api/settings/serviceAddresses/radarr.url', { value: 'http://radarr.example' })).status, 204);
  assert.equal((await send('PUT', '/api/settings/credentials/radarr.apiKey', { value: 'radarr-key' })).status, 204);
  assert.equal(getSetting(database, 'serviceAddresses', 'radarr.url'), 'http://radarr.example');
  assert.equal(getSetting(database, 'credentials', 'radarr.apiKey'), 'radarr-key');

  // Testing only saved values, saving the tested ones, or ignoring a blank credential's saved value turns this red.
  const check = async (service, body) => {
    const response = await send('POST', `/api/settings/test/${service}`, body);
    assert.equal(response.status, 200, service);
    return response.json();
  };
  assert.deepEqual(await check('sonarr', { credentials: { 'sonarr.apiKey': 'wrong-key' } }), { kind: 'rejected' });
  assert.deepEqual(await check('sonarr', { credentials: { 'sonarr.apiKey': '' } }), { kind: 'ok', version: '4.0.0.0' });
  assert.deepEqual(await check('sonarr', { serviceAddresses: { 'sonarr.url': 'http://127.0.0.1:65299' } }), { kind: 'unreachable' });
  assert.deepEqual(await check('sonarr', { serviceAddresses: { 'sonarr.url': '' } }), { kind: 'not_configured' });
  assert.equal(getSetting(database, 'credentials', 'sonarr.apiKey'), 'test-key');
  assert.equal(getSetting(database, 'serviceAddresses', 'sonarr.url'), 'http://127.0.0.1:65201');
  assert.equal((await send('POST', '/api/settings/test/sonarr', { credentials: { 'radarr.apiKey': 'x' } })).status, 400);
  assert.equal((await send('POST', '/api/settings/test/sonarr', { hostPaths: {} })).status, 400);
  for (const service of ['webhook', 'blutopia', 'privatehd', 'beyondhd']) assert.equal((await send('POST', `/api/settings/test/${service}`, {})).status, 404, service);

  // Leaving the routes out of the browser API turns this red.
  const mounted = await makeApp({ api: createApiRoutes(database) });
  const signedIn = await signIn(mounted.app);
  assert.equal((await mounted.app.request('/api/settings', { headers: { Cookie: signedIn.session } })).status, 200);
});

// Losing a tracker the owner added, letting TRACKER_RULES beat a saved rule, accepting a junk or duplicate host or an invalid
// rule, removing a tracker set in the env file, hiding the list behind one bad saved value, or skipping the browser write checks turns this red.
test('the settings screen adds trackers and saves, clears and removes their hit and run rules', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { getSetting, listSettingKeys, setSetting } = await import(settingsModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const { createTrackerRoutes } = await import(trackerSettingsModuleUrl);
  const { findTrackerRule } = await import(trackerRulesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-tracker-settings-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const env = { TRACKER_RULES: JSON.stringify({ 'blutopia.cc': ownerRules['blutopia.cc'] }) };
  const { app } = await makeApp({ api: createTrackerRoutes(database, env) });
  const { session } = await signIn(app);
  const send = (method, path, body, headers = jsonHeaders('https://media.example')) => app.request(path, {
    method, headers: { ...headers, Cookie: session }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const list = async () => {
    const response = await app.request('/api/settings/trackers', { headers: { Cookie: session } });
    assert.equal(response.status, 200);
    return response.json();
  };
  const trackerKeys = () => listSettingKeys(database).filter((entry) => entry.category === 'trackerConfiguration');
  const defaultMargins = { timeFactor: 1.1, extraHours: 6, ratioExtra: 0.05, globalRatioFactor: 1.25 };
  const unset = { ratio: null, logic: null, minGlobalRatio: null, partial: { exemptBelow: null, ratio: null, maxHours: null } };
  const blutopiaEnv = { ...unset, seedHours: [{ hours: 168 }], minGlobalRatio: 0.4 };
  const noAccount = { software: 'other', credentialSet: false, connection: { kind: 'unsupported' } };
  // envRule follows TRACKER_RULES alone: dropping it, or deriving it from ruleSource so a Settings rule hides it, turns this red.
  const blutopia = (fields) => ({ host: 'blutopia.cc', envRule: true, margins: defaultMargins, problem: null, ...noAccount, ...fields });
  const example = (fields) => ({ host: 'example.net', envRule: false, margins: defaultMargins, problem: null, ...noAccount, ...fields });

  assert.deepEqual(await list(), [blutopia({ status: 'configured_env', rule: blutopiaEnv, ruleSource: 'env' })]);

  // Adding cuts the input down to a bare hostname; junk and duplicates are refused and save nothing.
  assert.equal((await send('POST', '/api/settings/trackers', { host: ' HTTPS://Example.net:443/announce/abc ' })).status, 201);
  const before = trackerKeys();
  for (const [body, status, error] of [
    [{ host: 'example.net' }, 409, 'duplicate'], [{ host: 'EXAMPLE.NET' }, 409, 'duplicate'], [{ host: 'blutopia.cc' }, 409, 'duplicate'],
    [{ host: 'not a host' }, 400, 'invalid_host'], [{ host: 'localhost' }, 400, 'invalid_host'], [{ host: '127.0.0.1' }, 400, 'invalid_host'],
    [{ host: '' }, 400, 'invalid_host'], [{ host: 5 }, 400, 'invalid_request'], [{ host: 'a.example', extra: 1 }, 400, 'invalid_request'],
  ]) {
    const response = await send('POST', '/api/settings/trackers', body);
    assert.deepEqual([response.status, (await response.json()).error], [status, error], JSON.stringify(body));
  }
  assert.deepEqual(trackerKeys(), before);
  assert.deepEqual((await list())[1], example({ status: 'no_rule', rule: null, ruleSource: null }));
  assert.equal(findTrackerRule(database, 'tracker.example.net', env), undefined);

  // A bad rule or margin names its field and saves nothing.
  for (const [body, error, field, reason] of [
    [{ rule: { minHours: 100, minRatio: 1 } }, 'invalid_rule', 'logic', 'logic must be "and" or "or" when minRatio is set'],
    [{ rule: { minHours: -1 } }, 'invalid_rule', 'minHours', 'minHours must be a number of 0 or more'],
    [{ rule: { minHours: 1, partialExemptBelow: 2 } }, 'invalid_rule', 'partialExemptBelow', 'partialExemptBelow must be a fraction from 0 to 1'],
    [{ rule: [] }, 'invalid_rule', null, 'the rule must be a JSON object'],
    [{ rule: { seedHours: [{ upToGB: 1, hours: 72 }, { hours: 72, perGB: 'x' }] } }, 'invalid_rule', 'seedHours[1].perGB', 'perGB must be a number'],
    [{ rule: { seedHours: [{ upToGB: 1, hours: 72 }, { hours: 72, perGB: -1 }] } }, 'invalid_rule', 'seedHours[1]',
      'seedHours[1] gives -9928 hours at 10000 GB; seed time must come out at 0 or more from 1 to 10000 GB'],
    [{ rule: { seedHours: [{ hours: 1 }], partial: { exemptBelow: 2 } } }, 'invalid_rule', 'partial.exemptBelow', 'partial.exemptBelow must be a fraction from 0 to 1'],
    [{ rule: { minHours: 1 }, margins: { timeFactor: 0.9 } }, 'invalid_margins', 'timeFactor', 'timeFactor must be a number of 1 or more'],
  ]) {
    const response = await send('PUT', '/api/settings/trackers/example.net/rule', body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error, field, reason });
  }
  assert.equal((await send('PUT', '/api/settings/trackers/example.net/rule', { minHours: 1 })).status, 400);
  assert.equal((await send('PUT', '/api/settings/trackers/unknown.org/rule', { rule: { minHours: 1 } })).status, 404);
  assert.deepEqual(trackerKeys(), before);

  // The saved rule is found through an announce subdomain, and wins over the TRACKER_RULES one. A rule sent in the old
  // shape is saved in the table shape.
  const rule = { seedHours: [{ upToGB: 48, hours: 72 }, { hours: 100 }], ratio: 1.5, logic: 'and' };
  assert.equal((await send('PUT', '/api/settings/trackers/example.net/rule', { rule, margins: { timeFactor: 1.2 } })).status, 204);
  assert.equal((await send('PUT', '/api/settings/trackers/blutopia.cc/rule', { rule: { minHours: 200 } })).status, 204);
  assert.deepEqual(JSON.parse(getSetting(database, 'trackerConfiguration', 'rules.blutopia.cc')), { ...unset, seedHours: [{ hours: 200 }] });
  const exampleRule = { ...unset, ...rule };
  assert.deepEqual(findTrackerRule(database, 'tracker.example.net', env), { host: 'example.net', rule: exampleRule });
  assert.deepEqual(await list(), [
    blutopia({ status: 'configured', rule: { ...unset, seedHours: [{ hours: 200 }] }, ruleSource: 'settings' }),
    example({ status: 'configured', rule: exampleRule, ruleSource: 'settings', margins: { ...defaultMargins, timeFactor: 1.2 } }),
  ]);

  // One bad saved value is reported on its tracker without hiding the list.
  setSetting(database, 'trackerConfiguration', 'rules.example.net', 'not json');
  assert.deepEqual((await list())[1], example({
    status: 'configured', rule: null, ruleSource: 'settings', margins: { ...defaultMargins, timeFactor: 1.2 }, problem: 'The saved hit and run rule for example.net is not valid.',
  }));

  // Clearing a rule brings back the TRACKER_RULES one, or none, and keeps the tracker.
  assert.equal((await send('DELETE', '/api/settings/trackers/blutopia.cc/rule')).status, 204);
  assert.equal((await send('DELETE', '/api/settings/trackers/example.net/rule')).status, 204);
  assert.deepEqual(await list(), [
    blutopia({ status: 'configured_env', rule: blutopiaEnv, ruleSource: 'env' }),
    example({ status: 'no_rule', rule: null, ruleSource: null }),
  ]);

  // A tracker set in the env file is removed there, not here; removing an added one leaves nothing saved for it.
  const envOnly = await send('DELETE', '/api/settings/trackers/blutopia.cc');
  assert.deepEqual([envOnly.status, await envOnly.json()], [409, {
    error: 'in_environment', message: 'blutopia.cc is set in TRACKER_RULES in the env file; remove it there and restart the server.',
  }]);
  assert.equal((await send('PUT', '/api/settings/trackers/example.net/rule', { rule, margins: {} })).status, 204);
  assert.equal((await send('DELETE', '/api/settings/trackers/example.net')).status, 204);
  assert.equal((await send('DELETE', '/api/settings/trackers/example.net')).status, 404);
  assert.deepEqual(trackerKeys(), []);
  assert.deepEqual(await list(), [blutopia({ status: 'configured_env', rule: blutopiaEnv, ruleSource: 'env' })]);

  // Writes without the browser's own headers are refused before they reach the routes.
  for (const [method, path, body] of [['POST', '/api/settings/trackers', { host: 'other.org' }], ['PUT', '/api/settings/trackers/blutopia.cc/rule', { rule }], ['DELETE', '/api/settings/trackers/blutopia.cc/rule']]) {
    assert.equal((await send(method, path, body, { 'Content-Type': 'application/json' })).status, 403, `${method} ${path}`);
  }
  assert.deepEqual(trackerKeys(), []);

  // Leaving the routes out of the browser API turns this red.
  const mounted = await makeApp({ api: createApiRoutes(database) });
  const signedIn = await signIn(mounted.app);
  assert.equal((await mounted.app.request('/api/settings/trackers', { headers: { Cookie: signedIn.session } })).status, 200);
});

// Serving the account credential, saving a blank one over it, saving the values a test ran with, accepting an unknown software,
// or leaving the credential behind when the tracker is removed turns this red.
test('the settings screen sets a tracker\'s site software and account credential and tests them without saving', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { getSetting } = await import(settingsModuleUrl);
  const { createTrackerRoutes } = await import(trackerSettingsModuleUrl);
  const { createTrackerAccounts } = await import(trackerAccountsModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-tracker-accounts-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const secret = `account-token-${process.pid}-distinctive`;
  const calls = [];
  // The fake site runs UNIT3D at /api/user and NexusPHP at /api/profile, and knows only `secret`.
  const fetch = async (url, init) => {
    calls.push(String(url));
    if (init.headers.Authorization !== `Bearer ${secret}`) return new Response('{}', { status: 401 });
    if (String(url).endsWith('/api/user')) return new Response('{"ratio":1.5,"hit_and_runs":2}', { status: 200 });
    if (String(url).endsWith('/api/profile')) return new Response('{"ret":0,"data":{"data":{"uploaded":4,"downloaded":2}}}', { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const env = {};
  const { app } = await makeApp({ api: createTrackerRoutes(database, env, createTrackerAccounts(database, { env, fetch })) });
  const { session } = await signIn(app);
  const send = (method, path, body, headers = jsonHeaders('https://media.example')) => app.request(path, {
    method, headers: { ...headers, Cookie: session }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const row = async () => {
    const response = await app.request('/api/settings/trackers', { headers: { Cookie: session } });
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(text.includes(secret), false);
    const [{ software, credentialSet, connection }] = JSON.parse(text);
    return { software, credentialSet, connection };
  };
  const unit3dStats = {
    ratio: 1.5, uploadedBytes: null, downloadedBytes: null, bufferBytes: null, seeding: null, leeching: null, bonus: null, hitAndRuns: { count: 2, kind: 'lifetime' }, requiredRatio: null,
  };

  assert.equal((await send('POST', '/api/settings/trackers', { host: 'site.example' })).status, 201);
  assert.deepEqual(await row(), { software: 'other', credentialSet: false, connection: { kind: 'unsupported' } });

  for (const [path, body, status] of [
    ['site.example/software', { software: 'xbtit' }, 400], ['site.example/software', { software: 'unit3d', extra: 1 }, 400], ['unknown.org/software', { software: 'unit3d' }, 404],
    ['site.example/credential', { value: 5 }, 400], ['site.example/credential', { value: 'x', extra: 1 }, 400], ['unknown.org/credential', { value: 'x' }, 404],
  ]) assert.equal((await send('PUT', `/api/settings/trackers/${path}`, body)).status, status, `${path} ${JSON.stringify(body)}`);
  assert.equal((await send('PUT', '/api/settings/trackers/site.example/software', { software: 'unit3d' })).status, 204);
  assert.deepEqual(await row(), { software: 'unit3d', credentialSet: false, connection: { kind: 'not_configured' } });
  assert.equal((await send('PUT', '/api/settings/trackers/site.example/credential', { value: secret })).status, 204);
  assert.equal((await send('PUT', '/api/settings/trackers/site.example/credential', { value: '  ' })).status, 204);
  assert.equal(getSetting(database, 'credentials', 'trackers.site.example'), secret);
  assert.deepEqual(await row(), { software: 'unit3d', credentialSet: true, connection: { kind: 'ok', stats: unit3dStats } });

  // The test route lays the form over the saved values and saves neither.
  const tryForm = async (body) => {
    const response = await send('POST', '/api/settings/trackers/site.example/test', body);
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(text.includes(secret), false);
    return JSON.parse(text);
  };
  calls.length = 0;
  assert.deepEqual(await tryForm({ credential: 'wrong' }), { kind: 'rejected' });
  assert.deepEqual(await tryForm({ credential: '' }), { kind: 'ok', stats: unit3dStats });
  assert.deepEqual((await tryForm({ software: 'nexusphp' })).stats.ratio, 2);
  assert.deepEqual(await tryForm({ software: 'other' }), { kind: 'unsupported' });
  assert.deepEqual(calls, ['https://site.example/api/user', 'https://site.example/api/user', 'https://site.example/api/profile']);
  assert.equal(getSetting(database, 'credentials', 'trackers.site.example'), secret);
  assert.equal(getSetting(database, 'trackerConfiguration', 'software.site.example'), 'unit3d');
  for (const body of [{ software: 'xbtit' }, { credential: 5 }, { other: 1 }, []]) {
    assert.equal((await send('POST', '/api/settings/trackers/site.example/test', body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await send('POST', '/api/settings/trackers/unknown.org/test', {})).status, 404);

  // Writes without the browser's own headers are refused before they reach the routes.
  for (const [method, path, body] of [
    ['PUT', '/api/settings/trackers/site.example/software', { software: 'gazelle' }], ['PUT', '/api/settings/trackers/site.example/credential', { value: 'x' }],
    ['POST', '/api/settings/trackers/site.example/test', {}],
  ]) assert.equal((await send(method, path, body, { 'Content-Type': 'application/json' })).status, 403, path);
  assert.equal(getSetting(database, 'trackerConfiguration', 'software.site.example'), 'unit3d');

  assert.equal((await send('DELETE', '/api/settings/trackers/site.example')).status, 204);
  assert.equal(getSetting(database, 'credentials', 'trackers.site.example'), undefined);
  assert.equal(getSetting(database, 'trackerConfiguration', 'software.site.example'), undefined);
});

// Counting a part done before its last key is saved, losing a skip, saving folders, Plex or a tracker that failed its check, or
// serving the Plex token, a bucket secret or BACKUP_KEY turns a case red.
test('the setup wizard reports each part, keeps the owner\'s choices and saves what it checked', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { getSetting, listSettingKeys, setSetting } = await import(settingsModuleUrl);
  const { createRtorrent } = await import(rtorrentModuleUrl);
  const { createTrackerAccounts } = await import(trackerAccountsModuleUrl);
  const { listTrackerHosts } = await import(trackerRulesModuleUrl);
  const { backupsAreOff, setBackupsOff } = await import(backupModuleUrl);
  const { createSetupRoutes, folderProblems, folderWarnings, testHardlink } = await import(setupModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-setup-'));
  const databases = [];
  t.after(async () => {
    for (const database of databases) database.close();
    await rm(root, { recursive: true, force: true });
  });
  const wrap = (value) => `<methodResponse><params><param><value>${value}</value></param></params></methodResponse>`;
  const build = async ({ env = {}, which = {}, fetch, trackerFetch } = {}) => {
    const database = openDatabase(join(root, `setup-${databases.length}.sqlite`));
    databases.push(database);
    const { fake, ...arr } = connectArr(database, which);
    const rtorrent = createRtorrent(database, { fetch: async () => new Response(wrap('<string>/data/downloads</string>'), { status: 200 }) });
    const trackers = createTrackerAccounts(database, { env, fetch: trackerFetch });
    const { app } = await makeApp({ setup: createSetupRoutes({ database, arr, rtorrent, trackers, env, fetch }) });
    const { session } = await signIn(app);
    const send = (method, path, body) => app.request(`/api/setup${path}`, {
      method, headers: { ...jsonHeaders(), Cookie: session }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const statusText = async () => {
      const response = await send('GET', '');
      assert.equal(response.status, 200);
      return response.text();
    };
    const status = async () => JSON.parse(await statusText());
    return { app, database, fake, send, session, status, statusText };
  };
  const hostPaths = (database) => listSettingKeys(database).filter((entry) => entry.category === 'hostPaths');

  // Counting a service done while one of its keys is unset, or reporting BACKUP_KEY as set when it is missing or malformed, turns this red.
  await t.test('the status reports each part and BACKUP_KEY', async () => {
    const { database, status } = await build();
    const fresh = await status();
    assert.deepEqual(fresh.required, { sonarr: 'not_done', radarr: 'not_done', rtorrent: 'not_done', plex: 'not_done', folders: 'not_done' });
    assert.equal(fresh.requiredComplete, false);
    assert.deepEqual(fresh.optional, {
      trackers: { status: 'not_done', wanted: false }, metadata: { status: 'not_done', wanted: false }, backup: { status: 'not_done', wanted: false },
    });
    assert.deepEqual(fresh.backup, { destination: null, problem: null, key: 'missing', keyCreatedAt: null });
    assert.equal(fresh.plexSignInTokenAvailable, true);
    assert.equal((await (await build({ env: { BACKUP_KEY: 'ab'.repeat(32) } })).status()).backup.key, 'env');
    assert.equal((await (await build({ env: { BACKUP_KEY: 'nope' } })).status()).backup.key, 'invalid');

    for (const [category, key] of [
      ['serviceAddresses', 'sonarr.url'], ['credentials', 'sonarr.apiKey'], ['serviceAddresses', 'radarr.url'], ['credentials', 'radarr.apiKey'],
      ['serviceAddresses', 'rtorrent.url'], ['credentials', 'rtorrent.username'], ['serviceAddresses', 'plex.url'], ['credentials', 'plex.token'],
    ]) setSetting(database, category, key, 'value');
    for (const key of ['downloads.sonarr', 'downloads.radarr', 'library.sonarr', 'library.radarr', 'versions.sonarr']) {
      setSetting(database, 'hostPaths', key, '/data');
    }
    const partial = await status();
    assert.deepEqual(partial.required, { sonarr: 'done', radarr: 'done', rtorrent: 'not_done', plex: 'done', folders: 'not_done' });
    setSetting(database, 'credentials', 'rtorrent.password', 'value');
    setSetting(database, 'hostPaths', 'versions.radarr', '/data');
    const complete = await status();
    assert.deepEqual(complete.required, { sonarr: 'done', radarr: 'done', rtorrent: 'done', plex: 'done', folders: 'done' });
    assert.equal(complete.requiredComplete, true);
  });

  // Storing the private half of the backup key pair, or returning it from the status, turns this red.
  await t.test('a restore key is returned once and only its public half is stored', async () => {
    const { readBackupKeyPair } = await import(backupModuleUrl);
    const create = async (send) => {
      const response = await send('POST', '/backup/key');
      assert.equal(response.status, 201);
      const made = await response.json();
      assert.match(made.restoreKey, /^mm2-restore-[A-Za-z0-9_-]{43}$/);
      assert.equal(typeof made.createdAt, 'number');
      return made;
    };
    const { database, send, statusText } = await build();
    const first = await create(send);
    const second = await create(send);
    assert.notEqual(first.restoreKey, second.restoreKey);
    const text = await statusText();
    assert.equal(text.includes(first.restoreKey.slice(-43)) || text.includes(second.restoreKey.slice(-43)), false);
    assert.equal(JSON.parse(text).backup.key, 'pair');
    assert.equal(JSON.parse(text).backup.keyCreatedAt, second.createdAt);

    const withEnvironment = await build({ env: { BACKUP_KEY: 'ab'.repeat(32) } });
    const made = await create(withEnvironment.send);
    const { backup } = await withEnvironment.status();
    assert.equal(backup.key, 'pair');
    assert.equal(backup.keyCreatedAt, made.createdAt);

    database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const file = await readFile(join(root, `setup-${databases.indexOf(database)}.sqlite`));
    for (const { restoreKey } of [first, second]) {
      assert.equal(file.includes(restoreKey), false);
      assert.equal(file.includes(restoreKey.slice(-43)), false);
    }
    assert.equal(file.includes(readBackupKeyPair(database).publicKey), true);
  });

  // Dropping a stored choice, leaving backups on after the owner skipped them, or turning them on from a tick alone, turns this red.
  await t.test('the owner\'s choices round-trip and a skipped backup turns backups off', async () => {
    const { database, send, status } = await build();
    const choose = (trackers, metadata, backup) => send('PUT', '/choices', { trackers, metadata, backup });
    assert.equal((await choose({ wanted: false, skipped: false }, { wanted: false, skipped: false }, { wanted: true, skipped: true })).status, 204);
    assert.deepEqual((await status()).optional, {
      trackers: { status: 'skipped', wanted: false }, metadata: { status: 'skipped', wanted: false }, backup: { status: 'skipped', wanted: true },
    });
    assert.equal(backupsAreOff(database), true);
    assert.equal((await choose({ wanted: true, skipped: false }, { wanted: true, skipped: false }, { wanted: true, skipped: false })).status, 204);
    assert.deepEqual((await status()).optional, {
      trackers: { status: 'not_done', wanted: true }, metadata: { status: 'not_done', wanted: true }, backup: { status: 'not_done', wanted: true },
    });
    assert.equal(backupsAreOff(database), true);
    assert.equal((await send('PUT', '/choices', { trackers: { wanted: true }, metadata: { wanted: true, skipped: false }, backup: { wanted: true, skipped: false } })).status, 400);
    assert.equal((await send('PUT', '/choices', { trackers: { wanted: true, skipped: false }, backup: { wanted: true, skipped: false } })).status, 400);
    setSetting(database, 'credentials', 'mdblist.apiKey', 'value');
    assert.equal((await status()).optional.metadata.status, 'done');

    // Dropping the metadata default that readChoices lays under choices saved before the posters and ratings step turns this red.
    const older = await build();
    older.database.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)')
      .run('setup.choices', JSON.stringify({ trackers: { wanted: true, skipped: false }, backup: { wanted: false, skipped: true } }));
    assert.deepEqual((await older.status()).optional.metadata, { status: 'skipped', wanted: false });
  });

  // Returning the masked password, using a disabled or non-rTorrent client, or keeping a localhost host turns this red.
  await t.test('rTorrent is suggested from the first enabled rTorrent download client, never its password', async () => {
    const { database, fake, send } = await build({ which: { sonarr: {}, radarr: {} } });
    const client = (implementation, enable, values) => ({
      implementation, enable, fields: Object.entries(values).map(([name, value]) => ({ name, value })),
    });
    const clients = {
      sonarr: [
        client('QBittorrent', true, { host: 'qbit.example', port: 8080 }),
        client('RTorrent', false, { host: 'off.example', port: 80, username: 'off' }),
        client('RTorrent', true, { host: 'localhost', port: 443, useSsl: true, urlBase: 'xmlrpc', username: 'alec', password: '****' }),
      ],
      radarr: [client('RTorrent', true, { host: 'box.example', port: 8080, useSsl: false, urlBase: '/rtorrent/' })],
    };
    for (const service of ['sonarr', 'radarr']) {
      fake[service].routes.push((method, url) => (
        method === 'GET' && url.pathname === '/api/v3/downloadclient' ? { status: 200, body: clients[service] } : undefined
      ));
    }
    const suggestion = async () => {
      const response = await send('GET', '/rtorrent');
      assert.equal(response.status, 200);
      return response.text();
    };
    setSetting(database, 'serviceAddresses', 'sonarr.url', 'http://seedbox.example:8989');
    const remote = await suggestion();
    assert.deepEqual(JSON.parse(remote), { address: 'https://seedbox.example/xmlrpc', username: 'alec' });
    assert.equal(remote.includes('****') || remote.includes('password'), false);
    setSetting(database, 'serviceAddresses', 'sonarr.url', 'http://127.0.0.1:65201');
    assert.deepEqual(JSON.parse(await suggestion()), { address: null, username: 'alec' });
    fake.sonarr.state.down = true;
    assert.deepEqual(JSON.parse(await suggestion()), { address: 'http://box.example:8080/rtorrent', username: null });
    const unconfigured = await (await build()).send('GET', '/rtorrent');
    assert.equal(unconfigured.status, 200);
    assert.deepEqual(await unconfigured.json(), { address: null, username: null });
  });

  // Suggesting a blank root folder or a disabled download client's folder, failing the whole read when one service is down, mixing up
  // Sonarr's and Radarr's downloads folders, writing downloads.versions, or saving folders that failed a check turns this red.
  await t.test('folders are suggested from the services and saved only when every one checks out', async () => {
    const { database, fake, send } = await build({ which: { sonarr: {}, radarr: {} } });
    setSetting(database, 'serviceAddresses', 'rtorrent.url', 'http://127.0.0.1:65003/xmlrpc');
    setSetting(database, 'credentials', 'rtorrent.username', 'user');
    setSetting(database, 'credentials', 'rtorrent.password', 'password');
    const rootFolders = { sonarr: [{ path: '' }, { path: '/data/tv' }], radarr: [{ path: '/data/movies' }] };
    const clients = {
      sonarr: [
        { enable: false, fields: [{ name: 'tvDirectory', value: '/data/off' }] },
        { enable: true, fields: [{ name: 'host', value: 'x' }, { name: 'tvDirectory', value: '/data/sonarr-downloads' }] },
      ],
      radarr: [{ enable: true, fields: [{ name: 'movieDirectory', value: '' }] }],
    };
    for (const service of ['sonarr', 'radarr']) {
      fake[service].routes.push((method, url) => {
        if (method !== 'GET') return undefined;
        if (url.pathname === '/api/v3/rootfolder') return { status: 200, body: rootFolders[service] };
        if (url.pathname === '/api/v3/downloadclient') return { status: 200, body: clients[service] };
        return undefined;
      });
    }
    const nothing = { downloadsSonarr: null, downloadsRadarr: null, librarySonarr: null, libraryRadarr: null, versionsSonarr: null, versionsRadarr: null };
    const folders = async () => (await send('GET', '/folders')).json();
    assert.deepEqual(await folders(), {
      saved: nothing,
      suggested: {
        downloadsSonarr: '/data/sonarr-downloads', downloadsRadarr: '/data/downloads', librarySonarr: '/data/tv', libraryRadarr: '/data/movies',
        versionsSonarr: '/data/tv-versions', versionsRadarr: '/data/movies-versions',
      },
    });
    fake.radarr.state.down = true;
    assert.deepEqual((await folders()).suggested, {
      downloadsSonarr: '/data/sonarr-downloads', downloadsRadarr: '/data/downloads', librarySonarr: '/data/tv', libraryRadarr: null,
      versionsSonarr: '/data/tv-versions', versionsRadarr: null,
    });

    const values = {};
    for (const field of ['downloadsSonarr', 'downloadsRadarr', 'librarySonarr', 'libraryRadarr', 'versionsSonarr', 'versionsRadarr']) {
      values[field] = join(root, `folder-${field}`);
      await mkdir(values[field], { recursive: true });
    }
    const refused = await send('POST', '/folders', { ...values, downloadsRadarr: 'downloads', librarySonarr: join(root, 'missing') });
    assert.equal(refused.status, 400);
    assert.deepEqual(await refused.json(), {
      error: 'invalid_folders', fields: { downloadsRadarr: 'Must be an absolute path.', librarySonarr: 'This folder does not exist.' },
    });
    assert.deepEqual(hostPaths(database), []);
    const exists = () => ({ isDirectory: () => true });
    // Accepting a versions folder whose test hardlink fails with EXDEV, or losing the service name, turns this red.
    assert.deepEqual(folderProblems(values, exists, (from, to) => (to === values.versionsRadarr ? 'EXDEV' : 'ok')), {
      versionsRadarr: 'On a different drive from the Movies downloads folder, so imports can\'t hardlink.',
    });
    // Testing a folder against the other service's downloads folder turns this red.
    const radarrFails = (from) => (from === values.downloadsRadarr ? 'EXDEV' : 'ok');
    assert.deepEqual(Object.keys(folderProblems(values, exists, radarrFails)), ['versionsRadarr']);
    assert.deepEqual(Object.keys(folderWarnings(values, radarrFails)), ['libraryRadarr']);
    // Treating a non-EXDEV failure as success, or dropping its error code, turns this red.
    assert.deepEqual(folderProblems(values, exists, (from, to) => (to === values.versionsSonarr ? 'EACCES' : 'ok')), {
      versionsSonarr: 'A test hardlink from the TV downloads folder failed (EACCES), so imports can\'t hardlink here.',
    });
    assert.equal((await send('POST', '/folders', { ...values, extra: '/data' })).status, 400);

    // Refusing a library on another drive, or dropping its warning, turns this red.
    assert.deepEqual(folderWarnings(values, (from, to) => (to === values.libraryRadarr ? 'EXDEV' : 'ok')), {
      libraryRadarr: 'On a different drive from the Movies downloads folder, so a deleted download can\'t be re-linked from this library.',
    });
    const saved = await send('POST', '/folders', values);
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { warnings: {} });
    // Skipping the test hardlink's cleanup turns this red.
    for (const folder of Object.values(values)) {
      assert.deepEqual((await readdir(folder)).filter((name) => name.startsWith('.media-manager-2-link-test-')), []);
    }
    // Giving the test link the same name as the test file turns this red: a library or versions folder that is the downloads folder itself must pass.
    assert.equal(testHardlink(values.downloadsSonarr, values.downloadsSonarr), 'ok');
    assert.deepEqual(
      ['downloads.sonarr', 'downloads.radarr', 'library.sonarr', 'library.radarr', 'versions.sonarr', 'versions.radarr'].map((key) => getSetting(database, 'hostPaths', key)),
      [values.downloadsSonarr, values.downloadsRadarr, values.librarySonarr, values.libraryRadarr, values.versionsSonarr, values.versionsRadarr],
    );
    assert.equal(hostPaths(database).length, 6);
    assert.deepEqual((await folders()).saved, values);
  });

  // Saving Plex after a failed check, or sending the sign-in token back in any response, turns this red.
  await t.test('Plex connects with the sign-in token and saves only after the check passes', async () => {
    let plexAnswers = 'rejected';
    const fetch = async (url, init) => {
      if (plexAnswers === 'rejected') return responseJson({}, 401);
      const signedIn = new Headers(init.headers).get('X-Plex-Token') === 'plex-secret-token';
      return signedIn && new URL(url).pathname === '/' ? responseJson({ MediaContainer: { version: '1.0' } }) : responseJson({}, 401);
    };
    const { app, database, send, session, statusText } = await build({ fetch });
    const url = 'http://plex.example:32400';
    const rejected = await send('POST', '/plex', { url });
    assert.equal(rejected.status, 200);
    assert.deepEqual(await rejected.json(), { kind: 'rejected' });
    assert.equal(getSetting(database, 'serviceAddresses', 'plex.url'), undefined);
    assert.equal(getSetting(database, 'credentials', 'plex.token'), undefined);

    plexAnswers = 'ok';
    const connected = await send('POST', '/plex', { url });
    assert.equal(connected.status, 200);
    const connectedText = await connected.text();
    assert.equal(connectedText.includes('plex-secret-token'), false);
    assert.deepEqual(JSON.parse(connectedText), { kind: 'ok', version: '1.0' });
    assert.equal(getSetting(database, 'serviceAddresses', 'plex.url'), url);
    assert.equal(getSetting(database, 'credentials', 'plex.token'), 'plex-secret-token');
    const text = await statusText();
    assert.equal(text.includes('plex-secret-token'), false);
    assert.equal(JSON.parse(text).required.plex, 'done');

    // Fails if logout stops dropping the session, so the sign-in token stays usable.
    const loggedOut = await app.request('/auth/logout', {
      method: 'POST', headers: { ...jsonHeaders(), Cookie: session }, body: '{}',
    });
    assert.equal(loggedOut.status, 204);
    assert.equal((await send('POST', '/plex', { url })).status, 401);
    assert.equal(getSetting(database, 'credentials', 'plex.token'), 'plex-secret-token');
  });

  // Adding a tracker whose token was refused, testing an "other" tracker, or adding the same host twice turns this red.
  await t.test('a tracker is added in one call once its account connects', async () => {
    const secret = `setup-tracker-token-${process.pid}-distinctive`;
    const calls = [];
    const trackerFetch = async (url, init) => {
      calls.push(String(url));
      if (init.headers.Authorization !== `Bearer ${secret}`) return new Response('{}', { status: 401 });
      return new Response('{"ratio":1.5,"hit_and_runs":2}', { status: 200 });
    };
    const { database, send, status } = await build({ trackerFetch });
    const refused = await send('POST', '/trackers', { host: 'https://Site.Example/', software: 'unit3d', credential: 'wrong' });
    assert.equal(refused.status, 200);
    assert.deepEqual(await refused.json(), { host: 'site.example', connection: { kind: 'rejected' } });
    assert.deepEqual(listTrackerHosts(database, {}), []);
    assert.deepEqual(listSettingKeys(database), []);

    const added = await send('POST', '/trackers', { host: 'site.example', software: 'unit3d', credential: secret });
    assert.equal(added.status, 201);
    assert.equal((await added.json()).connection.kind, 'ok');
    assert.deepEqual(listTrackerHosts(database, {}), ['site.example']);
    assert.equal(getSetting(database, 'trackerConfiguration', 'software.site.example'), 'unit3d');
    assert.equal(getSetting(database, 'credentials', 'trackers.site.example'), secret);
    assert.equal((await status()).optional.trackers.status, 'done');

    const callsBefore = calls.length;
    const other = await send('POST', '/trackers', { host: 'other.example', software: 'other' });
    assert.equal(other.status, 201);
    assert.deepEqual(await other.json(), { host: 'other.example', connection: { kind: 'unsupported' } });
    assert.equal(calls.length, callsBefore);
    assert.equal(getSetting(database, 'trackerConfiguration', 'software.other.example'), 'other');

    assert.equal((await send('POST', '/trackers', { host: 'site.example', software: 'unit3d', credential: secret })).status, 409);
    assert.equal((await send('POST', '/trackers', { host: 'new.example', software: 'unit3d' })).status, 400);
  });

  // Saving a missing folder or a bucket with a blank field, keeping a folder and a bucket together, or serving the secret turns this red.
  await t.test('the backup destination is checked, saved as one kind only, and turns backups on', async () => {
    const { database, send, status, statusText } = await build();
    const secret = `setup-bucket-secret-${process.pid}-distinctive`;
    const missing = await send('POST', '/backup', { folder: join(root, 'no-such-folder') });
    assert.equal(missing.status, 400);
    assert.deepEqual(await missing.json(), { error: 'invalid_backup', field: 'folder', reason: 'This folder does not exist.' });
    const bucket = { endpoint: 'https://s3.example', bucket: 'backups', accessKeyId: 'access-id', secretAccessKey: secret };
    const blank = await send('POST', '/backup', { ...bucket, secretAccessKey: ' ' });
    assert.equal(blank.status, 400);
    assert.deepEqual(await blank.json(), { error: 'invalid_backup', field: 'secretAccessKey', reason: 'Required.' });
    assert.deepEqual(listSettingKeys(database), []);

    setBackupsOff(database, true);
    assert.equal((await send('POST', '/backup', bucket)).status, 204);
    assert.equal(backupsAreOff(database), false);
    const text = await statusText();
    assert.equal(text.includes(secret), false);
    assert.deepEqual(JSON.parse(text).backup.destination, { kind: 's3', endpoint: 'https://s3.example', bucket: 'backups', region: 'auto' });

    const folder = join(root, 'backups');
    await mkdir(folder);
    setBackupsOff(database, true);
    assert.equal((await send('POST', '/backup', { folder })).status, 204);
    assert.equal(backupsAreOff(database), false);
    assert.deepEqual(listSettingKeys(database).filter((entry) => entry.key.startsWith('backup.')), [{ category: 'hostPaths', key: 'backup.folder' }]);
    const saved = await status();
    assert.deepEqual(saved.backup.destination, { kind: 'folder', folder });
    assert.equal(saved.optional.backup.status, 'done');
  });
});

// Leaving Blutopia's token where nothing reads it, giving blutopia.cc no software, adding a tracker for an empty token, or keeping the
// Beyond-HD and PrivateHD sign-ins turns this red.
test('the Blutopia token moves to the blutopia.cc tracker and the Beyond-HD and PrivateHD sign-ins are dropped', async () => {
  const { applicationMigrations, migrateDatabase } = await import(databaseModuleUrl);
  const before = applicationMigrations.findIndex((migration) => migration.includes('trackers.blutopia.cc'));
  assert.ok(before > 0);
  const migrate = (rows) => {
    const database = new DatabaseSync(':memory:');
    migrateDatabase(database, applicationMigrations.slice(0, before));
    const insert = database.prepare('INSERT INTO settings (category, key, value) VALUES (?, ?, ?)');
    for (const row of rows) insert.run(...row);
    migrateDatabase(database, applicationMigrations);
    const settings = database.prepare('SELECT category, key, value FROM settings ORDER BY category, key').all().map((row) => [row.category, row.key, row.value]);
    database.close();
    return settings;
  };
  const old = [
    ['serviceAddresses', 'blutopia.url', 'https://blutopia.cc'], ['serviceAddresses', 'privatehd.url', 'https://privatehd.to'], ['serviceAddresses', 'beyondhd.url', 'https://beyond-hd.me'],
    ['credentials', 'privatehd.username', 'u'], ['credentials', 'privatehd.password', 'p'], ['credentials', 'privatehd.pid', 'i'],
    ['credentials', 'beyondhd.apiKey', 'k'], ['credentials', 'beyondhd.rssKey', 'r'], ['credentials', 'sonarr.apiKey', 'kept'],
  ];
  assert.deepEqual(migrate([...old, ['credentials', 'blutopia.apiToken', 'token']]), [
    ['credentials', 'sonarr.apiKey', 'kept'], ['credentials', 'trackers.blutopia.cc', 'token'],
    ['trackerConfiguration', 'software.blutopia.cc', 'unit3d'], ['trackerConfiguration', 'trackers.blutopia.cc', 'added'],
  ]);
  // A tracker added with no token gets its software; an empty token adds nothing.
  assert.deepEqual(migrate([['trackerConfiguration', 'rules.blutopia.cc', '{"seedHours":[{"hours":168}]}']]), [
    ['trackerConfiguration', 'rules.blutopia.cc', '{"seedHours":[{"hours":168}]}'], ['trackerConfiguration', 'software.blutopia.cc', 'unit3d'],
  ]);
  assert.deepEqual(migrate([['credentials', 'blutopia.apiToken', '']]), []);
});

// Classifying a status differently, dropping the service name from a message, or changing any operation's request turns a subtest red.
test('Sonarr and Radarr operations answer with one result shape and never throw', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createArr, valueOrThrow } = await import(arrModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-arr-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const { sonarr, radarr, fake } = connectArr(database, { sonarr: {} });
  const { state } = fake.sonarr;

  await t.test('the queue read walks every page and leaves out items matched to no title', async () => {
    // Stopping the page walk early, asking for unknown items again (they list the other service's torrents), or changing the queue parser turns this red.
    const hash = 'ab'.repeat(20);
    state.queue = Array.from({ length: 502 }, (_, index) => queueItem(
      index === 0
        ? { unknown: true, downloadId: hash, trackedDownloadStatus: 'warning', statusMessages: [{ title: 'Show.S01', messages: ["Download wasn't grabbed by Radarr and not in a category, Skipping."] }] }
        : index === 1 ? { downloadId: hash } : {},
    ));
    const result = await sonarr.queue();
    assert.equal(result.kind, 'ok');
    assert.equal(result.value.length, 501);
    assert.ok(!result.value.some((item) => item.queueId === state.queue[0].id));
    assert.equal(result.value.find((item) => item.queueId === state.queue[1].id).downloadId, hash.toUpperCase());
  });

  await t.test('the episode file list keeps each file\'s absolute path', async () => {
    // Dropping path from the file parser or asking for another series' files turns this red.
    state.episodeFiles = [
      { id: 3, seriesId: 9, path: '/tv/Show/Season 1/e1.mkv', relativePath: 'Season 1/e1.mkv', size: 10 },
      { id: 4, seriesId: 8, path: '/tv/Other/e1.mkv', relativePath: 'e1.mkv', size: 10 },
    ];
    const files = valueOrThrow(await sonarr.episodeFiles(9));
    assert.deepEqual(files.map((file) => [file.id, file.path]), [[3, '/tv/Show/Season 1/e1.mkv']]);
  });

  await t.test('queue removal maps each choice and is safe to repeat', async () => {
    // Mapping a removal choice to the wrong flags, counting an already-removed item, or telling rTorrent to erase on the wrong call turns this red.
    const hash = 'cd'.repeat(20);
    state.queue = [queueItem({ downloadId: hash }), queueItem({ downloadId: hash })];
    state.removals = [];
    state.erasedFromClient = [];
    assert.deepEqual(await sonarr.removeFromQueue({ downloadId: hash }, 'block_and_search'), { kind: 'ok', value: { removed: 2 } });
    assert.deepEqual(
      state.removals.map(({ queueId: _queueId, ...flags }) => flags),
      [
        { removeFromClient: false, blocklist: true, skipRedownload: false },
        { removeFromClient: false, blocklist: true, skipRedownload: false },
      ],
    );
    assert.deepEqual(state.erasedFromClient, []);
    assert.deepEqual(await sonarr.removeFromQueue({ downloadId: hash }, 'block_and_search'), { kind: 'ok', value: { removed: 0 } });

    const fresh = 'EF'.repeat(20);
    state.queue = [queueItem({ downloadId: fresh })];
    state.removals = [];
    assert.deepEqual(await sonarr.removeFromQueueAndClient(fresh), { kind: 'ok', value: { removed: 1 } });
    assert.equal(state.removals[0].removeFromClient, true);
    assert.equal(state.removals[0].blocklist, true);
    assert.deepEqual(state.erasedFromClient, [fresh]);
  });

  await t.test('a forced import copies, and only with hardlinks on and files that match the grab', async (t) => {
    // Sending importMode move or auto, skipping the hardlink setting read, or importing a file outside the grab turns this red.
    t.mock.method(console, 'error', () => {});
    const hash = '12'.repeat(20).toUpperCase();
    const grab = { hash, movieId: null, seriesId: 7, episodeIds: [31, 32] };
    state.commands = [];
    state.manualImport = { [hash]: [importFile({ episodes: [{ id: 31 }] }), importFile({ episodes: [{ id: 32 }] })] };

    state.copyUsingHardlinks = false;
    const refused = await sonarr.forceImport(grab);
    assert.equal(refused.kind, 'refused');
    assert.equal(refused.status, null);
    assert.deepEqual(state.commands, []);

    state.copyUsingHardlinks = true;
    assert.deepEqual(await sonarr.forceImport(grab), { kind: 'ok', value: undefined });
    assert.equal(state.commands.length, 1);
    assert.equal(state.commands[0].name, 'ManualImport');
    assert.equal(state.commands[0].importMode, 'copy');
    assert.deepEqual(state.commands[0].files.map((file) => file.episodeIds), [[31], [32]]);

    state.manualImport = { [hash]: [importFile({ episodes: [{ id: 99 }] })] };
    const mismatch = await sonarr.forceImport(grab);
    assert.equal(mismatch.kind, 'refused');
    assert.match(mismatch.message, /doesn't match the episodes/);

    state.copyUsingHardlinks = false;
    const byFiles = await sonarr.forceImport(hash, [{ path: '/downloads/file.mkv' }]);
    assert.equal(byFiles.kind, 'refused');
    assert.equal(byFiles.status, null);
    assert.equal(state.commands.length, 1);
    state.copyUsingHardlinks = true;
  });

  await t.test('history picks its route from the filter and walks every page', async () => {
    // Sending a since filter to the paged route, stopping the page walk early, or losing the total count turns this red.
    const since = Date.parse('2026-10-08T00:00:00Z');
    const after = historyRecord({ date: '2026-10-09T00:00:00Z' });
    state.history = [
      historyRecord({ date: '2026-10-07T00:00:00Z' }),
      after,
      historyRecord({ date: '2026-10-09T00:00:00Z', eventType: 'downloadFolderImported' }),
    ];
    fake.sonarr.requests.length = 0;
    const recent = await sonarr.history({ since, eventType: 'grabbed' });
    assert.equal(recent.kind, 'ok');
    assert.deepEqual(recent.value.map((record) => record.id), [after.id]);
    assert.deepEqual(fake.sonarr.requests.map((request) => request.path), ['/api/v3/history/since']);

    const downloadId = '34'.repeat(20);
    state.history = Array.from({ length: 250 }, () => historyRecord({ downloadId }));
    state.history.push(historyRecord({ downloadId: '56'.repeat(20), eventType: 'downloadFailed' }));
    fake.sonarr.requests.length = 0;
    const all = await sonarr.history({ downloadId });
    assert.equal(all.kind, 'ok');
    assert.equal(all.value.length, 250);
    assert.deepEqual(fake.sonarr.requests.map((request) => request.params.get('pageSize')), ['100', '100', '100']);

    const page = await sonarr.history({ eventType: 'grabbed', page: 1, pageSize: 50 });
    assert.equal(page.kind, 'ok');
    assert.equal(page.value.records.length, 50);
    assert.equal(page.value.total, 250);
  });

  await t.test('commands, queue grabs and marking a grab failed reach Sonarr', async () => {
    // Renaming a command or changing one of its body fields turns this red.
    state.commands = [];
    for (const target of [{ episodeIds: [1] }, { seriesId: 5 }, { seriesId: 5, seasonNumber: 2 }]) {
      assert.deepEqual(await sonarr.searchAutomatically(target), { kind: 'ok', value: undefined });
    }
    assert.deepEqual(await sonarr.refreshTitle(5), { kind: 'ok', value: undefined });
    assert.deepEqual(await sonarr.refreshMonitoredDownloads(), { kind: 'ok', value: undefined });
    assert.deepEqual(state.commands, [
      { name: 'EpisodeSearch', episodeIds: [1] },
      { name: 'SeriesSearch', seriesId: 5 },
      { name: 'SeasonSearch', seriesId: 5, seasonNumber: 2 },
      { name: 'RefreshSeries', seriesId: 5 },
      { name: 'RefreshMonitoredDownloads' },
    ]);

    const item = queueItem();
    state.queue = [item];
    state.grabbed = [];
    assert.deepEqual(await sonarr.grabFromQueue(item.id), { kind: 'ok', value: undefined });
    assert.deepEqual(state.grabbed, [item.id]);

    const record = historyRecord();
    state.history = [record];
    state.failed = [];
    assert.deepEqual(await sonarr.markFailed(record.id), { kind: 'ok', value: undefined });
    assert.deepEqual(state.failed, [record.id]);
  });

  await t.test('each failure has its own kind and a message naming the service', async () => {
    // Classifying a status as a different kind, or a message losing the service name or Sonarr's own reason, turns this red.
    assert.equal((await radarr.queue()).kind, 'not_configured');

    state.down = true;
    const down = await sonarr.queue();
    state.down = false;
    assert.equal(down.kind, 'unreachable');
    assert.match(down.message, /^Sonarr is unreachable/);

    const other = createArrFake({ apiKey: 'other' });
    assert.equal((await createArr('sonarr', database, { fetch: other.fetch }).queue()).kind, 'rejected');

    fake.sonarr.routes.push(() => ({ status: 500, body: { message: 'boom' } }));
    const refused = await sonarr.queue();
    fake.sonarr.routes.length = 0;
    assert.equal(refused.kind, 'refused');
    assert.equal(refused.status, 500);
    assert.ok(refused.message.startsWith('Sonarr '));
    assert.ok(refused.message.endsWith('with HTTP 500: boom.'));
    assert.throws(() => valueOrThrow(refused), (error) => error instanceof Error && error.message === refused.message);
    assert.equal(valueOrThrow({ kind: 'ok', value: 3 }), 3);
  });
});

// Reading the wrong response field, counting UNIT3D's "1.23 TiB" in 1000s, missing Redacted's bare-key form, putting the credential in a URL
// or a result, mis-classifying 401/403/404/5xx or a bad or oversized body, or checking a tracker on every call turns this red.
test('tracker account connectors read UNIT3D, Gazelle and NexusPHP accounts and classify each outcome', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTrackerAccounts, parseBytes, saveTrackerCredential, saveTrackerSoftware } = await import(trackerAccountsModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-trackers-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const token = `tracker-token-${process.pid}-distinctive`;
  const respond = (status, body) => () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  const timeout = () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); };
  const networkFailure = () => { throw new TypeError('fetch failed'); };
  const fakeFetch = (handler, calls) => async (url, init) => {
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.headers.Accept, 'application/json');
    calls.push({ url: String(url), authorization: init.headers.Authorization });
    return handler(String(url), init);
  };
  const run = async (software, handler, credential = token, accounts = undefined) => {
    const calls = [];
    const checker = accounts ?? createTrackerAccounts(database, { fetch: fakeFetch(handler, calls), env: {} });
    const result = await checker.test('site.example', software, credential);
    assert.equal(JSON.stringify(result).includes(token), false, `${software} result mentions the credential`);
    for (const call of calls) assert.equal(call.url.includes(token), false, `${software} URL carries the credential`);
    return { calls, result };
  };
  const stats = (fields) => ({
    ratio: null, uploadedBytes: null, downloadedBytes: null, bufferBytes: null, seeding: null, leeching: null, bonus: null, hitAndRuns: null, requiredRatio: null, ...fields,
  });

  for (const [input, expected] of [
    [1649267441664, 1649267441664], ['1649267441664', 1649267441664], ['1,234', 1234], ['1.23 TiB', Math.round(1.23 * 2 ** 40)], ['1.23 TiB', Math.round(1.23 * 2 ** 40)],
    ['512 KiB', 524288], ['1.5 GB', 1.5e9], ['2 TB', 2e12], ['-5.5 GiB', Math.round(-5.5 * 2 ** 30)], ['0 B', 0], ['∞', null], ['', null], [null, null], ['1.2 XB', null],
  ]) assert.equal(parseBytes(input), expected, String(input));

  // UNIT3D: Blutopia sends numbers, stock UNIT3D display text; both read the same.
  const blutopiaBody = '{"username":"alec","group":"User","uploaded":1649267441664,"downloaded":644245094400,"ratio":2.56,"buffer":966367641600,"seeding":12,"leeching":0,"seedbonus":"1234.50","hit_and_runs":1}';
  const numeric = await run('unit3d', respond(200, blutopiaBody));
  assert.deepEqual(numeric.calls, [{ url: 'https://site.example/api/user', authorization: `Bearer ${token}` }]);
  assert.deepEqual(numeric.result, { kind: 'ok', stats: stats({
    ratio: 2.56, uploadedBytes: 1649267441664, downloadedBytes: 644245094400, bufferBytes: 966367641600, seeding: 12, leeching: 0, bonus: 1234.5, hitAndRuns: { count: 1, kind: 'lifetime' },
  }) });
  const text = await run('unit3d', respond(200, { uploaded: '1.5 TiB', downloaded: '512 GiB', ratio: '3', buffer: '-5.5 GiB', seeding: 3, leeching: 1, seedbonus: '10.00', hit_and_runs: 0 }));
  assert.deepEqual(text.result, { kind: 'ok', stats: stats({
    ratio: 3, uploadedBytes: 1.5 * 2 ** 40, downloadedBytes: 512 * 2 ** 30, bufferBytes: Math.round(-5.5 * 2 ** 30), seeding: 3, leeching: 1, bonus: 10, hitAndRuns: { count: 0, kind: 'lifetime' },
  }) });
  assert.deepEqual((await run('unit3d', respond(200, { ratio: '∞', buffer: '∞' }))).result, { kind: 'ok', stats: stats({}) });
  assert.deepEqual((await run('unit3d', respond(404, '{"message":"Not Found"}'))).result, { kind: 'too_old' });

  // Gazelle: Orpheus's "token <key>" first; Redacted's bare key when that is refused, remembered for the next check.
  const passkey = `passkey-${process.pid}-distinctive`;
  const gazelleOk = { status: 'success', response: {
    username: 'alec', id: 7, authkey: `authkey-${process.pid}`, passkey,
    userstats: { uploaded: 2e12, downloaded: 1e12, ratio: 2, requiredratio: 0.6, bonusPoints: 500, bonusPointsPerHour: 1.5, class: 'Member' },
  } };
  const gazelleStats = stats({ ratio: 2, uploadedBytes: 2e12, downloadedBytes: 1e12, bonus: 500, requiredRatio: 0.6 });
  const orpheus = await run('gazelle', respond(200, gazelleOk));
  assert.deepEqual(orpheus.calls, [{ url: 'https://site.example/ajax.php?action=index', authorization: `token ${token}` }]);
  assert.deepEqual(orpheus.result, { kind: 'ok', stats: gazelleStats });
  assert.equal(JSON.stringify(orpheus.result).includes(passkey), false);
  const redactedCalls = [];
  const redacted = createTrackerAccounts(database, {
    env: {},
    fetch: fakeFetch((url, init) => (init.headers.Authorization === token
      ? respond(200, gazelleOk)()
      : respond(200, { status: 'failure', error: 'invalid token' })()), redactedCalls),
  });
  assert.deepEqual((await run('gazelle', undefined, token, redacted)).result, { kind: 'ok', stats: gazelleStats });
  assert.deepEqual(redactedCalls.map((call) => call.authorization), [`token ${token}`, token]);
  await run('gazelle', undefined, token, redacted);
  assert.deepEqual(redactedCalls.map((call) => call.authorization), [`token ${token}`, token, token]);
  const refused = await run('gazelle', respond(200, { status: 'failure', error: 'invalid token' }));
  assert.deepEqual([refused.result, refused.calls.length], [{ kind: 'rejected' }, 2]);
  assert.deepEqual((await run('gazelle', respond(200, { status: 'success', response: { userstats: { ratio: -1, uploaded: 5 } } }))).result,
    { kind: 'ok', stats: stats({ uploadedBytes: 5 }) });

  // NexusPHP: the user sits in data.data, and its share_ratio is HTML, so the ratio comes from the byte counts.
  const nexus = await run('nexusphp', respond(200, { ret: 0, msg: 'OK', data: { data: {
    id: 3, username: 'alec', uploaded: 3e12, downloaded: 1e12, bonus: 1234.5, seedtime: 3600, share_ratio: '<font color="#000">3.000</font>',
  } } }));
  assert.deepEqual(nexus.calls, [{ url: 'https://site.example/api/profile', authorization: `Bearer ${token}` }]);
  assert.deepEqual(nexus.result, { kind: 'ok', stats: stats({ ratio: 3, uploadedBytes: 3e12, downloadedBytes: 1e12, bonus: 1234.5 }) });
  assert.deepEqual((await run('nexusphp', respond(200, { ret: -1, msg: 'ERROR', data: [] }))).result, { kind: 'unreachable' });

  for (const software of ['unit3d', 'gazelle', 'nexusphp']) {
    for (const [handler, kind] of [
      [respond(401, '{}'), 'rejected'], [respond(403, '{}'), 'rejected'], [respond(500, '{}'), 'unreachable'], [respond(200, '[]'), 'unreachable'],
      [respond(200, 'not json'), 'unreachable'], [respond(200, `{"pad":"${'x'.repeat(1_000_001)}"}`), 'unreachable'], [networkFailure, 'unreachable'], [timeout, 'unreachable'],
    ]) assert.deepEqual((await run(software, handler)).result, { kind }, `${software} ${kind}`);
    for (const credential of ['', '  ']) {
      const nothing = await run(software, respond(200, '{}'), credential);
      assert.deepEqual([nothing.result, nothing.calls.length], [{ kind: 'not_configured' }, 0], software);
    }
    assert.deepEqual(await createTrackerAccounts(database, { fetch: networkFailure, env: {} }).test('site.example', software, undefined), { kind: 'not_configured' });
  }
  const other = await run('other', respond(200, '{}'));
  assert.deepEqual([other.result, other.calls.length], [{ kind: 'unsupported' }, 0]);

  // Saved values: one check per tracker every five minutes, and a new one as soon as the software or credential changes.
  let clock = 0;
  const savedCalls = [];
  const accounts = createTrackerAccounts(database, { env: {}, now: () => clock, fetch: fakeFetch(respond(200, blutopiaBody), savedCalls) });
  setSetting(database, 'trackerConfiguration', 'trackers.site.example', 'added');
  assert.deepEqual(await accounts.stats(), [{ host: 'site.example', software: 'other', connection: { kind: 'unsupported' } }]);
  saveTrackerSoftware(database, 'site.example', 'unit3d');
  assert.deepEqual(await accounts.connection('site.example'), { kind: 'not_configured' });
  saveTrackerCredential(database, 'site.example', token);
  assert.deepEqual(await accounts.connection('site.example'), numeric.result);
  await Promise.all([accounts.connection('site.example'), accounts.stats()]);
  clock += 5 * 60_000 - 1;
  await accounts.connection('site.example');
  assert.equal(savedCalls.length, 1);
  clock += 1;
  await accounts.connection('site.example');
  assert.equal(savedCalls.length, 2);
  saveTrackerCredential(database, 'site.example', `${token}-new`);
  await accounts.connection('site.example');
  assert.equal(savedCalls.length, 3);

  // The browser's tracker list is the shared checker's, and the advice route reads that tracker's account.
  const { app } = await makeApp({ api: createApiRoutes(database, { trackers: accounts }) });
  assert.equal((await app.request('/api/trackers')).status, 401);
  const { session } = await signIn(app);
  const listed = await app.request('/api/trackers', { headers: { Cookie: session } });
  assert.equal(listed.status, 200);
  const listedText = await listed.text();
  assert.equal(listedText.includes(token), false);
  assert.deepEqual(JSON.parse(listedText), [{ host: 'site.example', software: 'unit3d', connection: numeric.result }]);
  assert.equal(savedCalls.length, 3);
  // Dropping the hash check on the advice route turns this red.
  assert.equal((await app.request('/api/advice/not-a-hash', { headers: { Cookie: session } })).status, 400);
  const advice = await app.request(`/api/advice/${'a'.repeat(40)}`, { headers: { Cookie: session } });
  assert.deepEqual(await advice.json(), {
    recommendation: 'keep', reason: 'Seeding time unknown (torrent not in rTorrent)', globalRatio: null,
    host: null, requiredHours: null, ruleHours: null, seededHours: null, hoursLeft: null, detail: 'Seeding time unknown (torrent not in rTorrent)',
  });
  const posted = await app.request('/api/trackers', { method: 'POST', headers: { ...jsonHeaders('https://media.example'), Cookie: session }, body: '{}' });
  assert.notEqual(posted.status, 200);

  // Gazelle's "Rate limit exceeded" (HTTP 200) or a 429 says nothing about the key: reading it as rejected, trying the
  // other header form, or reusing it for five minutes turns this red.
  for (const handler of [respond(200, { status: 'failure', error: 'Rate limit exceeded' }), respond(429, '')]) {
    const limited = await run('gazelle', handler);
    assert.deepEqual([limited.result, limited.calls.length], [{ kind: 'unreachable' }, 1]);
  }
  let gazelleAnswer = { status: 'failure', error: 'Rate limit exceeded' };
  const limitedCalls = [];
  const limitedAccounts = createTrackerAccounts(database, { env: {}, now: () => clock, fetch: fakeFetch(() => respond(200, gazelleAnswer)(), limitedCalls) });
  setSetting(database, 'trackerConfiguration', 'trackers.limited.example', 'added');
  saveTrackerSoftware(database, 'limited.example', 'gazelle');
  saveTrackerCredential(database, 'limited.example', token);
  assert.deepEqual(await limitedAccounts.connection('limited.example'), { kind: 'unreachable' });
  gazelleAnswer = gazelleOk;
  assert.deepEqual(await limitedAccounts.connection('limited.example'), { kind: 'ok', stats: gazelleStats });
  assert.deepEqual(await limitedAccounts.connection('limited.example'), { kind: 'ok', stats: gazelleStats });
  assert.equal(limitedCalls.length, 2);
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
  await rtorrent.call('load.raw_start', ['', new Uint8Array([1, 2, 3])]);
  assert.match(requestBodies.pop(), /<param><value><base64>AQID<\/base64><\/value><\/param><\/params>/);

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
      state: 1, open: 1, active: 1, complete: 1, message: '', finished: 1_700_000_000, ratio: 1500, peers: 3, seeders: 1, directory: '/downloads',
      ...overrides,
    };
    return [torrent.hash, torrent.name, torrent.size, torrent.completed, torrent.down, torrent.up, torrent.state,
      torrent.open, torrent.active, torrent.complete, torrent.message, torrent.finished, torrent.ratio, torrent.peers, torrent.seeders, torrent.directory];
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
        if (method === 'f.multicall') return [[`${params[0]}.mkv`, 1000]];
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

  // Keeping gone rows forever, or pruning one a grab or second version still names, turns this red.
  await t.test('gone torrents are pruned after 30 days unless a grab or second version still names them', async () => {
    const { database, clock, fake, poller } = setup();
    const stored = () => database.prepare('SELECT hash FROM torrents ORDER BY hash').all().map((torrent) => torrent.hash);
    fake.rows = [row(hashA), row(hashB), row(hashC)];
    await poller.poll();
    clock.value += 30_000;
    fake.rows = [];
    await poller.poll();
    const goneAt = clock.value;
    database.prepare(`INSERT INTO torrent_grabs (hash, service, series_id, episode_ids, release_title, indexer, grabbed_at, by_hand, imported_at)
      VALUES (?, 'sonarr', 5, '[50]', 'Show.S01E02', 'Blutopia', 1, 0, 2)`).run(hashB);
    database.prepare(`INSERT INTO second_versions (service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, hash, state, created_at, updated_at)
      VALUES ('radarr', 7, NULL, NULL, 'Release', 'g', 'Blutopia', 'WEBDL-2160p', ?, 'downloading', 1, 1)`).run(hashC);
    const all = [hashA.toUpperCase(), hashB, hashC];
    clock.value = goneAt + 30 * 24 * 60 * 60_000 - 1;
    await poller.poll();
    assert.deepEqual(stored(), all);
    clock.value = goneAt + 30 * 24 * 60 * 60_000 + 1;
    await poller.poll();
    assert.deepEqual(stored(), [hashB, hashC]);
    assert.equal(listTorrents(database).every((torrent) => torrent.goneAt === goneAt), true);
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

  // Publishing unchanged rows, adding a torrent the full poll has not stored, moving lastSeenAt, crediting seeding time
  // from the one-second refresh, or calling rTorrent while it is marked down turns this red.
  await t.test('the one-second refresh updates and publishes only changed live values and leaves the seeding counter to the full poll', async () => {
    const { database, clock, published, fake, poller } = setup();
    // Live field order: the full row without name, size and directory.
    const live = (hash, overrides) => row(hash, overrides).filter((_cell, index) => index !== 1 && index !== 2 && index !== 15);
    fake.rows = [row(hashA), row(hashB, { complete: 0, completed: 0 })];
    await poller.poll();
    const startedAt = clock.value;
    const before = published.length;
    fake.rows = [live(hashA), live(hashB, { complete: 0, completed: 0 })];
    clock.value += 1_000;
    await poller.pollLive();
    assert.equal(published.length, before);

    fake.rows = [live(hashA, { up: 70 }), live(hashB, { complete: 0, completed: 400, down: 99 }), live(hashC)];
    for (let second = 0; second < 29; second += 1) {
      clock.value += 1_000;
      await poller.pollLive();
    }
    const liveEvents = published.slice(before);
    assert.equal(liveEvents.length, 1);
    assert.equal(liveEvents[0].data.live, true);
    assert.deepEqual(liveEvents[0].data.changed.map((torrent) => [torrent.hash, torrent.completedBytes, torrent.upRate]),
      [[hashA.toUpperCase(), 1000, 70], [hashB, 400, 50]]);
    const stored = listTorrents(database);
    assert.equal(stored.length, 2);
    assert.equal(stored.find((torrent) => torrent.hash === hashB).downRate, 99);
    assert.equal(stored.every((torrent) => torrent.lastSeenAt === startedAt && torrent.seedingSeconds === 0), true);

    fake.rows = [row(hashA, { up: 70 }), row(hashB, { complete: 0, completed: 400, down: 99 })];
    await poller.poll();
    assert.equal(listTorrents(database).find((torrent) => torrent.hash === hashA.toUpperCase()).seedingSeconds, 30);

    // While the full poll has rTorrent marked down, the refresh does not call it.
    fake.fail = 'unreachable';
    await poller.poll();
    const calls = fake.calls.length;
    await poller.pollLive();
    assert.equal(fake.calls.length, calls);
    database.close();
  });

  // Re-reading a stored file list, reading more than 20 per poll, or keeping the list of a gone torrent turns this red.
  await t.test('file lists are read once, 20 per poll, and dropped when the torrent is gone', async () => {
    const { database, fake, poller } = setup();
    const hashes = Array.from({ length: 25 }, (_, index) => index.toString(16).toUpperCase().padStart(40, '0'));
    fake.rows = hashes.map((hash) => row(hash));
    const listed = () => database.prepare('SELECT hash, path, size_bytes FROM torrent_files ORDER BY hash').all().map((file) => ({ ...file }));
    await poller.poll();
    assert.equal(listed().length, 20);
    assert.equal(listTorrents(database)[0].directory, '/downloads');
    await poller.poll();
    await poller.poll();
    assert.equal(listed().length, 25);
    assert.deepEqual(listed()[0], { hash: hashes[0], path: `${hashes[0]}.mkv`, size_bytes: 1000 });
    assert.equal(fake.calls.filter(([method]) => method === 'f.multicall').length, 25);
    fake.rows = hashes.slice(1).map((hash) => row(hash));
    await poller.poll();
    assert.equal(listed().length, 24);
    assert.equal(listed().some((file) => file.hash === hashes[0]), false);
    database.close();
  });

  // Spending list reads on torrents without metadata, or never reading one once it has metadata, turns this red.
  await t.test('torrents without metadata do not use up list reads and are read once they have metadata', async () => {
    const { database, fake, poller } = setup();
    const waiting = Array.from({ length: 25 }, (_, index) => (index + 1).toString(16).toUpperCase().padStart(40, '0'));
    fake.rows = [...waiting.map((hash) => row(hash, { size: 0 })), row(hashB)];
    const listed = () => database.prepare('SELECT DISTINCT hash FROM torrent_files').all().map((file) => file.hash);
    await poller.poll();
    assert.deepEqual(listed(), [hashB]);
    assert.deepEqual(fake.calls.filter(([method]) => method === 'f.multicall').map(([, params]) => params[0]), [hashB]);
    fake.rows[0] = row(waiting[0]);
    await poller.poll();
    assert.deepEqual(listed().sort(), [waiting[0], hashB].sort());
    database.close();
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
    const { fake, ...arr } = connectArr(database);
    const tracker = createGrabTracker({ database, arr, events, now: () => clock.value });
    const heard = [];
    tracker.onGrab((grab) => { heard.push(grab.hash); });
    return { database, clock, events, fake, tracker, heard };
  };

  // Skipping the read for a new torrent that already has the app's own grab record turns this red: a season grabbed
  // in the app has no episodes until Sonarr is read, so its episode rows wait for the five-minute check. Reading on the
  // one-second refresh's events turns it red too: that would read Sonarr every second for a new torrent's first 30 seconds.
  await t.test('a new torrent from a season grabbed in the app gets its episodes from Sonarr on the next rTorrent poll', async () => {
    const { database, clock, events, fake, tracker } = setup();
    tracker.readOnNewTorrents();
    tracker.recordGrab({
      hash: packHash.toUpperCase(), service: 'sonarr', movieId: null, seriesId: 4, episodeIds: [], releaseTitle: 'Show.S02.1080p',
      indexer: '', grabbedAt: clock.value, publishedAt: null, byHand: true,
    });
    fake.sonarr.state.history = [41, 42, 43].map((episodeId) => historyRecord({
      downloadId: packHash.toUpperCase(), seriesId: 4, episodeId, sourceTitle: 'Show.S02.1080p', date: '2026-10-08T11:59:59Z',
    }));
    clock.value += 30_000;
    events.publish('torrents', { changed: [{ hash: packHash.toUpperCase(), firstSeenAt: clock.value, lastSeenAt: clock.value }], gone: [], live: true });
    for (let turn = 0; turn < 20; turn += 1) await drain();
    assert.equal(fake.sonarr.requests.some((request) => request.path === '/api/v3/queue'), false);
    events.publish('torrents', { changed: [{ hash: packHash.toUpperCase(), firstSeenAt: clock.value, lastSeenAt: clock.value }], gone: [] });
    for (let turn = 0; turn < 100 && findGrab(database, packHash).episodeIds.length === 0; turn += 1) await drain();
    assert.deepEqual(findGrab(database, packHash).episodeIds, [41, 42, 43]);
    assert.ok(fake.sonarr.requests.some((request) => request.path === '/api/v3/queue'));
    database.close();
  });

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
    fake.sonarr.state.history = [
      historyRecord({ downloadId: episodeHash.toUpperCase(), seriesId: 3, episodeId: 32, sourceTitle: 'Show.S01E01E02.1080p', date: '2026-10-08T11:59:00Z', data: { indexer: 'BeyondHD' } }),
      ...[41, 42, 43].map((episodeId) => historyRecord({
        downloadId: packHash, seriesId: 4, episodeId, sourceTitle: 'Show.S02.1080p', date: '2026-10-08T11:55:00Z', data: { indexer: 'PrivateHD' },
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
    const firstSince = first.fake.radarr.requests.find((r) => r.path === '/api/v3/history/since');
    assert.equal(firstSince.params.get('date'), '2026-09-24T12:00:00.000Z');
    const stoppedAt = first.clock.value;
    first.database.close();

    const second = setup(databasePath);
    second.clock.value = stoppedAt + 3 * 60 * 60_000;
    second.fake.radarr.state.history = [
      historyRecord({ downloadId: missedHash, movieId: 9, sourceTitle: 'Missed.2025.1080p', date: new Date(stoppedAt + 60 * 60_000).toISOString(), data: { indexer: 'Blutopia' } }),
    ];
    await second.tracker.reconcile();
    const since = second.fake.radarr.requests.find((r) => r.path === '/api/v3/history/since');
    assert.equal(since.params.get('date'), new Date(stoppedAt - 10 * 60_000).toISOString());
    assert.equal(findGrab(second.database, missedHash).movieId, 9);
    second.database.close();
  });

  // Relying on the Download webhook alone leaves finished, seeding torrents showing as downloading on title pages forever.
  await t.test('the history check marks grabs imported or failed without webhooks', async () => {
    const { database, fake, tracker } = setup();
    fake.sonarr.state.history = [
      historyRecord({ downloadId: episodeHash, seriesId: 3, episodeId: 31, date: '2026-10-08T11:00:00Z' }),
      historyRecord({ downloadId: packHash, seriesId: 4, episodeId: 41, date: '2026-10-08T11:00:00Z' }),
      historyRecord({ downloadId: episodeHash, seriesId: 3, episodeId: 31, eventType: 'downloadFolderImported', date: '2026-10-08T11:30:00Z' }),
      historyRecord({ downloadId: packHash, seriesId: 4, episodeId: 41, eventType: 'downloadFailed', date: '2026-10-08T11:40:00Z' }),
    ];
    await tracker.reconcile();
    assert.equal(listGrabs(database).length, 2);
    assert.equal(findGrab(database, episodeHash).importedAt, Date.parse('2026-10-08T11:30:00Z'));
    assert.equal(findGrab(database, episodeHash).failedAt, null);
    assert.equal(findGrab(database, packHash).failedAt, Date.parse('2026-10-08T11:40:00Z'));
    assert.equal(findGrab(database, packHash).importedAt, null);
    database.close();
  });

  // Recording grabs from the backfill window would hand the stall fix grab records it never had, so a later stall would
  // search again instead of only being flagged; the backfill may only mark grabs already known.
  await t.test('the import backfill marks known grabs and never records grabs older than the grab bookmark', async () => {
    const { database, clock, fake, tracker } = setup();
    tracker.recordGrab({
      hash: episodeHash.toUpperCase(), service: 'sonarr', movieId: null, seriesId: 3, episodeIds: [31], releaseTitle: 'Show.S01E01.1080p',
      indexer: '', grabbedAt: clock.value - 2 * 60 * 60_000, publishedAt: null, byHand: false,
    });
    // A database from before outcomes were read: the grab bookmark is an hour old, the outcome bookmark is empty.
    database.prepare('INSERT INTO grab_checkpoints (service, history_checked_at) VALUES (?, ?)').run('sonarr', clock.value - 60 * 60_000);
    fake.sonarr.state.history = [
      historyRecord({ downloadId: missedHash, seriesId: 5, episodeId: 51, date: '2026-10-05T12:00:00Z' }),
      historyRecord({ downloadId: episodeHash, seriesId: 3, episodeId: 31, eventType: 'downloadFolderImported', date: '2026-10-05T13:00:00Z' }),
    ];
    await tracker.reconcile();
    assert.equal(findGrab(database, missedHash), undefined);
    assert.equal(findGrab(database, episodeHash).importedAt, Date.parse('2026-10-05T13:00:00Z'));
    database.close();
  });

  // Dropping delayed (pending) items, keeping a stale queue after a failed read, or not marking the service down turns this red.
  await t.test('the queue snapshot keeps delayed releases and survives a failed read', async () => {
    const { database, fake, tracker } = setup();
    fake.sonarr.state.queue = [
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

    fake.sonarr.state.down = true;
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

test('title details, episodes and images are cached from Sonarr and Radarr and kept current', async (t) => {
  const { openDatabase, applicationMigrations } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createJobRunner } = await import(jobsModuleUrl);
  const { createImageRoutes, createTitleCache, listEpisodes, listTitles, readTitle } = await import(titlesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-titles-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sonarrKey = `sonarr-key-${process.pid}-distinctive`;
  const radarrKey = `radarr-key-${process.pid}-distinctive`;
  const settle = async () => { for (let turn = 0; turn < 50; turn += 1) await drain(); };
  const cover = (id, kind, lastWrite = 1) => ({ coverType: kind, url: `/MediaCover/${id}/${kind}.jpg?lastWrite=${lastWrite}`, remoteUrl: `https://artworks.example/${id}-${kind}.jpg` });
  let setups = 0;

  const setup = () => {
    setups += 1;
    const directory = join(root, `case-${setups}`);
    const database = openDatabase(join(directory, 'media-manager.sqlite'));
    t.after(() => database.close());
    setSetting(database, 'serviceAddresses', 'sonarr.url', 'http://127.0.0.1:65031');
    setSetting(database, 'serviceAddresses', 'radarr.url', 'http://127.0.0.1:65032');
    setSetting(database, 'credentials', 'sonarr.apiKey', sonarrKey);
    setSetting(database, 'credentials', 'radarr.apiKey', radarrKey);
    const clock = { value: Date.parse('2026-10-11T12:00:00Z') };
    const fake = { sonarr: createArrFake({ apiKey: sonarrKey }), radarr: createArrFake({ apiKey: radarrKey }) };
    fake.sonarr.state.series = [
      { id: 1, title: 'Andor', year: 2022, overview: 'Rebels.', images: [cover(1, 'poster'), cover(1, 'fanart')] },
      { id: 2, title: 'Severance', year: 2022, overview: 'Work.', images: [cover(2, 'poster')] },
    ];
    fake.sonarr.state.episodes = [
      { id: 12, seriesId: 1, seasonNumber: 1, episodeNumber: 2, title: 'That Would Be Me', airDateUtc: '2022-09-21T02:00:00Z', overview: 'Two.', hasFile: true, monitored: true },
      { id: 11, seriesId: 1, seasonNumber: 1, episodeNumber: 1, title: 'Kassa', airDateUtc: '2022-09-21T01:00:00Z', overview: 'One.', hasFile: false, monitored: true },
      { id: 21, seriesId: 2, seasonNumber: 1, episodeNumber: 1, monitored: false },
    ];
    fake.radarr.state.movies = [
      { id: 7, title: 'Dune', year: 2021, overview: 'Spice.', hasFile: false, images: [cover(7, 'poster')] },
      { id: 8, title: 'Arrival', year: 2016, overview: 'Words.', hasFile: true, images: [cover(8, 'poster')] },
    ];
    const state = {
      images: {
        'sonarr/1/poster.jpg': new Uint8Array([1, 1, 1]),
        'sonarr/1/fanart.jpg': new Uint8Array([1, 1, 2]),
        'sonarr/2/poster.jpg': new Uint8Array([2, 2, 2]),
        'radarr/7/poster.jpg': new Uint8Array([7, 7, 7]),
        'radarr/8/poster.jpg': new Uint8Array([8, 8, 8]),
      },
      contentTypes: {},
      down: false,
      throws: false,
      gate: null,
    };
    const calls = [];
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    // Images, the failure flags and the gate stay here; everything else is the shared fake's.
    const answer = async (service, url, init) => {
      const image = /^\/api\/v3\/mediacover\/(\d+)\/([^/]+)$/.exec(new URL(String(url)).pathname);
      if (!image) return fake[service].fetch(url, init);
      const key = `${service}/${image[1]}/${image[2]}`;
      const bytes = state.images[key];
      return bytes === undefined ? json({}, 404) : new Response(bytes.slice(), { status: 200, headers: { 'Content-Type': state.contentTypes[key] ?? 'image/jpeg' } });
    };
    const wrap = (service) => async (url, init = {}) => {
      const parsed = new URL(String(url));
      calls.push({ service, path: parsed.pathname, key: new Headers(init.headers).get('x-api-key') });
      if (state.throws) throw new TypeError('fetch failed');
      if (state.down) return json({}, 500);
      const response = await answer(service, url, init);
      const gate = state.gate;
      if (gate !== null && gate.service === service && gate.path === parsed.pathname) {
        state.gate = null;
        await gate.promise;
      }
      return response;
    };
    const arr = { sonarr: createArr('sonarr', database, { fetch: wrap('sonarr') }), radarr: createArr('radarr', database, { fetch: wrap('radarr') }) };
    const events = createEventHub();
    const published = [];
    events.subscribe((event) => { if (event.type === 'title') published.push(event.data); });
    const imageDirectory = join(directory, 'images');
    const cache = createTitleCache({ database, arr, events, imageDirectory, now: () => clock.value });
    return { arr, cache, calls, clock, database, events, fake, imageDirectory, published, state };
  };
  const sorted = (items) => [...items].sort((a, b) => `${a.service}${a.id}`.localeCompare(`${b.service}${b.id}`));
  const gone = (path) => assert.rejects(stat(path), { code: 'ENOENT' });

  // Dropping the episode or image writes, the delete pass for titles missing from the list, or the unchanged-row skip turns this red.
  await t.test('fallback stores titles, episodes and images and removes deleted ones', async () => {
    const { cache, clock, database, fake, imageDirectory, published, state } = setup();
    await cache.reconcile();
    assert.deepEqual(listTitles(database, 'sonarr').map(({ id, title, year, detail }) => [id, title, year, detail.overview]), [
      [1, 'Andor', 2022, 'Rebels.'], [2, 'Severance', 2022, 'Work.'],
    ]);
    assert.deepEqual(listTitles(database, 'radarr').map(({ id, title, year, detail }) => [id, title, year, detail.overview]), [
      [7, 'Dune', 2021, 'Spice.'], [8, 'Arrival', 2016, 'Words.'],
    ]);
    assert.deepEqual(listEpisodes(database, 1).map(({ id, seasonNumber, episodeNumber, title, hasFile }) => [id, seasonNumber, episodeNumber, title, hasFile]), [
      [11, 1, 1, 'Kassa', false], [12, 1, 2, 'That Would Be Me', true],
    ]);
    assert.deepEqual(listEpisodes(database, 2), [{
      id: 21, seriesId: 2, seasonNumber: 1, episodeNumber: 1, title: null, airDateUtc: null, overview: '', hasFile: false, monitored: false,
    }]);
    const poster = cache.image('sonarr', 1, 'poster');
    assert.equal(poster.contentType, 'image/jpeg');
    assert.deepEqual(new Uint8Array(await readFile(poster.path)), state.images['sonarr/1/poster.jpg']);
    assert.equal((await stat(poster.path)).mode & 0o777, 0o600);
    assert.equal((await stat(imageDirectory)).mode & 0o777, 0o700);
    assert.ok(cache.image('sonarr', 1, 'fanart'));
    assert.equal(cache.image('sonarr', 2, 'fanart'), undefined);
    assert.deepEqual(sorted(published), [
      { service: 'radarr', id: 7, change: 'updated' }, { service: 'radarr', id: 8, change: 'updated' },
      { service: 'sonarr', id: 1, change: 'updated' }, { service: 'sonarr', id: 2, change: 'updated' },
    ]);

    const removedFiles = [cache.image('sonarr', 2, 'poster').path, cache.image('radarr', 8, 'poster').path];
    published.length = 0;
    fake.sonarr.state.series = fake.sonarr.state.series.filter((item) => item.id !== 2);
    fake.radarr.state.movies = fake.radarr.state.movies.filter((item) => item.id !== 8);
    clock.value += 60_000;
    await cache.reconcile();
    assert.deepEqual(listTitles(database, 'sonarr').map(({ id }) => id), [1]);
    assert.deepEqual(listTitles(database, 'radarr').map(({ id }) => id), [7]);
    assert.deepEqual(listEpisodes(database, 2), []);
    assert.equal(cache.image('sonarr', 2, 'poster'), undefined);
    assert.equal(cache.image('radarr', 8, 'poster'), undefined);
    for (const path of removedFiles) await gone(path);
    assert.deepEqual(sorted(published), [{ service: 'radarr', id: 8, change: 'deleted' }, { service: 'sonarr', id: 2, change: 'deleted' }]);

    published.length = 0;
    clock.value += 60_000;
    await cache.reconcile();
    assert.deepEqual(published, []);
  });

  // Writing or deleting anything when the list request fails or throws turns this red.
  await t.test('a failed fallback writes nothing', async () => {
    const { cache, clock, database, fake, published, state } = setup();
    await cache.reconcile();
    const snapshot = () => [listTitles(database, 'sonarr'), listTitles(database, 'radarr'), listEpisodes(database, 1)];
    const before = snapshot();
    published.length = 0;
    fake.sonarr.state.series[0].title = 'Andor (changed)';
    fake.sonarr.state.series.pop();
    fake.radarr.state.movies.pop();
    for (const failure of ['down', 'throws']) {
      state[failure] = true;
      clock.value += 60_000;
      await cache.reconcile();
      state[failure] = false;
      assert.deepEqual(snapshot(), before, failure);
    }
    assert.deepEqual(published, []);
  });

  // Not wiring the title cache into the shared receiver, refreshing on the wrong events, or leaving rows, episodes or files after a delete event turns this red.
  await t.test('webhooks refresh and delete single titles through the shared receiver', async () => {
    const { arr, cache, clock, database, events, fake } = setup();
    assert.equal(cache.receiveWebhook('sonarr', { eventType: 'SeriesAdd', series: { id: 1 } }), 'ok');
    assert.equal(cache.receiveWebhook('radarr', { eventType: 'MovieAdded', movie: { id: 7 } }), 'ok');
    await settle();
    assert.equal(readTitle(database, 'sonarr', 1).title, 'Andor');
    assert.equal(listEpisodes(database, 1).length, 2);
    assert.equal(readTitle(database, 'radarr', 7).detail.hasFile, false);

    fake.radarr.state.movies[0].hasFile = true;
    clock.value += 60_000;
    assert.equal(cache.receiveWebhook('radarr', { eventType: 'Download', movie: { id: 7 } }), 'ok');
    await settle();
    assert.equal(readTitle(database, 'radarr', 7).detail.hasFile, true);

    const files = [cache.image('sonarr', 1, 'poster').path, cache.image('sonarr', 1, 'fanart').path, cache.image('radarr', 7, 'poster').path];
    assert.equal(cache.receiveWebhook('sonarr', { eventType: 'SeriesDelete', series: { id: 1 } }), 'ok');
    assert.equal(cache.receiveWebhook('radarr', { eventType: 'MovieDelete', movie: { id: 7 } }), 'ok');
    assert.equal(readTitle(database, 'sonarr', 1), undefined);
    assert.equal(readTitle(database, 'radarr', 7), undefined);
    assert.deepEqual(listEpisodes(database, 1), []);
    assert.equal(cache.image('sonarr', 1, 'poster'), undefined);
    for (const path of files) await gone(path);

    assert.equal(cache.receiveWebhook('sonarr', { eventType: 'Health' }), 'ignored');
    assert.equal(cache.receiveWebhook('sonarr', 'nope'), 'invalid');
    assert.equal(cache.receiveWebhook('sonarr', { eventType: 'SeriesAdd' }), 'invalid');
    assert.equal(cache.receiveWebhook('radarr', { eventType: 'Download', series: { id: 1 } }), 'invalid');

    // The same composition index.ts uses for its one receiver.
    const torrentGrabs = createGrabTracker({ database, arr, events, now: () => clock.value });
    const receive = (service, payload) => {
      const grabs = torrentGrabs.receiveWebhook(service, payload);
      const title = cache.receiveWebhook(service, payload);
      if (grabs === 'invalid' || title === 'invalid') return 'invalid';
      return grabs === 'ok' || title === 'ok' ? 'ok' : 'ignored';
    };
    const secret = `webhook-secret-${process.pid}`;
    const { app } = await makeApp({ webhooks: { secret: () => secret, receive } });
    const post = (body) => app.request('/webhooks/sonarr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`sonarr:${secret}`).toString('base64')}` },
      body: JSON.stringify(body),
    });
    assert.equal((await post({ eventType: 'SeriesAdd', series: { id: 2 } })).status, 204);
    await settle();
    assert.equal(readTitle(database, 'sonarr', 2).title, 'Severance');
    const titlesBefore = listTitles(database, 'sonarr');
    assert.equal((await post({ eventType: 'Health' })).status, 204);
    await settle();
    assert.deepEqual(listTitles(database, 'sonarr'), titlesBefore);
  });

  // Writing a row without comparing fetch start times, or deleting rows newer than the list being reconciled, turns this red.
  await t.test('an older fetch never overwrites a newer row and a stale list never deletes a fresher row', async () => {
    const { cache, clock, database, fake, state } = setup();
    await cache.reconcile();
    clock.value += 60_000;
    fake.sonarr.state.series[0].overview = 'Listed.';
    let release;
    state.gate = { service: 'sonarr', path: '/api/v3/series', promise: new Promise((resolve) => { release = resolve; }) };
    const pending = cache.reconcile();
    await settle();
    assert.equal(state.gate, null, 'the list request is in flight');

    fake.sonarr.state.series[0].overview = 'Newest.';
    fake.sonarr.state.series.push(seriesRecord({ id: 3, title: 'Pluribus', year: 2025, overview: 'Joy.' }));
    clock.value += 60_000;
    const refreshedAt = clock.value;
    await cache.refresh('sonarr', 1);
    assert.equal(cache.receiveWebhook('sonarr', { eventType: 'SeriesAdd', series: { id: 3 } }), 'ok');
    await settle();
    release();
    await pending;
    const andor = readTitle(database, 'sonarr', 1);
    assert.equal(andor.detail.overview, 'Newest.');
    assert.equal(andor.fetchedAt, refreshedAt);
    assert.equal(readTitle(database, 'sonarr', 3).title, 'Pluribus');
  });

  // Skipping the episode re-read when a webhook refresh finds the series resource unchanged turns this red.
  await t.test('a webhook refresh picks up an episode-only change', async () => {
    const { cache, clock, database, fake, published } = setup();
    assert.equal(cache.receiveWebhook('sonarr', { eventType: 'SeriesAdd', series: { id: 1 } }), 'ok');
    await settle();
    published.length = 0;
    fake.sonarr.state.episodes.find(({ id }) => id === 11).title = 'Kassa (renamed)';
    clock.value += 60_000;
    assert.equal(cache.receiveWebhook('sonarr', { eventType: 'Download', series: { id: 1 } }), 'ok');
    await settle();
    assert.equal(listEpisodes(database, 1).find(({ id }) => id === 11).title, 'Kassa (renamed)');
    assert.deepEqual(published, [{ service: 'sonarr', id: 1, change: 'updated' }]);
  });

  // Writing the image file and row without checking the title still exists after the download turns this red.
  await t.test('a delete during an image download leaves no image behind', async () => {
    const { cache, imageDirectory, state } = setup();
    let release;
    state.gate = { service: 'radarr', path: '/api/v3/mediacover/7/poster.jpg', promise: new Promise((resolve) => { release = resolve; }) };
    const pending = cache.refresh('radarr', 7);
    await settle();
    assert.equal(state.gate, null, 'the image download is in flight');
    assert.equal(cache.receiveWebhook('radarr', { eventType: 'MovieDelete', movie: { id: 7 } }), 'ok');
    release();
    await pending;
    await settle();
    assert.equal(cache.image('radarr', 7, 'poster'), undefined);
    const files = await readdir(imageDirectory).catch(() => []);
    assert.deepEqual(files.filter((name) => name.startsWith('radarr-7-')), []);
  });

  // Skipping the download whenever the stored source matches, without checking the file is on disk, turns this red.
  await t.test('the fallback downloads an image again when its file is missing', async () => {
    const { cache, calls, clock, state } = setup();
    await cache.reconcile();
    await rm(cache.image('sonarr', 1, 'poster').path);
    calls.length = 0;
    clock.value += 60_000;
    await cache.reconcile();
    const poster = cache.image('sonarr', 1, 'poster');
    assert.ok(poster);
    assert.deepEqual(new Uint8Array(await readFile(poster.path)), state.images['sonarr/1/poster.jpg']);
    const downloads = () => calls.filter((call) => call.path.startsWith('/api/v3/mediacover/')).map(({ service, path }) => `${service}${path}`);
    assert.deepEqual(downloads(), ['sonarr/api/v3/mediacover/1/poster.jpg']);
    calls.length = 0;
    clock.value += 60_000;
    await cache.reconcile();
    assert.deepEqual(downloads(), []);
  });

  // Storing whatever Content-Type the service sent, instead of only an image type, turns this red.
  await t.test('a non-image Content-Type from the service is replaced by the type of the file extension', async () => {
    const { cache, database, fake, state } = setup();
    fake.sonarr.state.series[1].images = [{ coverType: 'poster', url: '/MediaCover/2/poster.png?lastWrite=1' }];
    state.images['sonarr/2/poster.png'] = new Uint8Array([2, 2, 3]);
    state.contentTypes['sonarr/1/poster.jpg'] = 'text/html; charset=utf-8';
    state.contentTypes['sonarr/2/poster.png'] = 'IMAGE/PNG; charset=binary';
    await cache.reconcile();
    const stored = (id) => database.prepare("SELECT content_type FROM title_images WHERE service = 'sonarr' AND id = ? AND kind = 'poster'").get(id)?.content_type;
    assert.equal(stored(1), 'image/jpeg');
    assert.equal(stored(2), 'IMAGE/PNG; charset=binary');
    const { app } = await makeApp({ images: createImageRoutes(cache) });
    const { session } = await signIn(app);
    const served = await app.request('/api/images/sonarr/1/poster', { headers: { Cookie: session } });
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/jpeg');
  });

  // Writing episodes without checking the series still exists, or publishing 'updated' for a deleted title, turns this red.
  await t.test('a delete during an episode fetch leaves no episodes and no later update', async () => {
    const { cache, database, published, state } = setup();
    let release;
    state.gate = { service: 'sonarr', path: '/api/v3/episode', promise: new Promise((resolve) => { release = resolve; }) };
    const pending = cache.refresh('sonarr', 1);
    await settle();
    assert.equal(state.gate, null, 'the episode request is in flight');
    assert.equal(cache.receiveWebhook('sonarr', { eventType: 'SeriesDelete', series: { id: 1 } }), 'ok');
    release();
    await pending;
    await settle();
    assert.deepEqual(listEpisodes(database, 1), []);
    assert.deepEqual(published, [{ service: 'sonarr', id: 1, change: 'deleted' }]);
  });

  // Registering the fallback on another interval, or not registering it, turns this red.
  await t.test('the five-minute fallback runs on the job runner', async () => {
    const { cache, calls, clock } = setup();
    const timers = createFakeTimers(clock);
    const runner = createJobRunner(timers);
    runner.register('title-refresh', cache.intervalMs, cache.reconcile);
    runner.start();
    t.after(() => runner.stop());
    const listRequests = () => calls.filter(({ path }) => path === '/api/v3/series' || path === '/api/v3/movie').map(({ service }) => service).sort();
    timers.advance(5 * 60_000 - 1);
    await settle();
    assert.deepEqual(listRequests(), []);
    timers.advance(1);
    await settle();
    assert.deepEqual(listRequests(), ['radarr', 'sonarr']);
    timers.advance(5 * 60_000);
    await settle();
    assert.deepEqual(listRequests(), ['radarr', 'radarr', 'sonarr', 'sonarr']);
  });

  // Serving images outside the owner guard, dropping the ETag or 304, re-downloading an unchanged source, or leaking a service key turns this red.
  await t.test('images are served to the owner with ETag, 304 and no service key', async () => {
    const { cache, calls, clock, database, fake, state } = setup();
    await cache.reconcile();
    const { app } = await makeApp({ images: createImageRoutes(cache) });
    const seen = [];
    const record = async (response) => {
      const body = Buffer.from(await response.clone().arrayBuffer()).toString('latin1');
      seen.push(`${[...response.headers].map(([name, value]) => `${name}: ${value}`).join('\n')}\n${body}`);
      return response;
    };
    const path = '/api/images/sonarr/1/poster';
    const anonymous = await record(await app.request(path));
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.headers.get('cache-control'), 'no-store');

    const { session } = await signIn(app);
    const get = async (target, headers = {}) => record(await app.request(target, { headers: { Cookie: session, ...headers } }));
    const first = await get(path);
    assert.equal(first.status, 200);
    assert.deepEqual(new Uint8Array(await first.arrayBuffer()), state.images['sonarr/1/poster.jpg']);
    const firstTag = first.headers.get('etag');
    assert.equal(firstTag, `"${createHash('sha256').update(state.images['sonarr/1/poster.jpg']).digest('hex')}"`);
    assert.equal(first.headers.get('cache-control'), 'private, max-age=300');
    assert.equal(first.headers.get('content-type'), 'image/jpeg');

    const notModified = await get(path, { 'If-None-Match': firstTag });
    assert.equal(notModified.status, 304);
    assert.equal(await notModified.text(), '');
    assert.equal(notModified.headers.get('cache-control'), 'private, max-age=300');

    state.images['sonarr/1/poster.jpg'] = new Uint8Array([9, 9, 9, 9]);
    fake.sonarr.state.series[0].images = [cover(1, 'poster', 2), cover(1, 'fanart')];
    clock.value += 60_000;
    await cache.refresh('sonarr', 1);
    const changed = await get(path, { 'If-None-Match': firstTag });
    assert.equal(changed.status, 200);
    assert.deepEqual(new Uint8Array(await changed.arrayBuffer()), new Uint8Array([9, 9, 9, 9]));
    assert.notEqual(changed.headers.get('etag'), firstTag);

    state.images['sonarr/1/poster.jpg'] = new Uint8Array([5, 5]);
    fake.sonarr.state.series[0].overview = 'Touched.';
    clock.value += 60_000;
    calls.length = 0;
    await cache.refresh('sonarr', 1);
    assert.equal(readTitle(database, 'sonarr', 1).detail.overview, 'Touched.');
    assert.deepEqual(calls.filter((call) => call.path.startsWith('/api/v3/mediacover/')), [], 'an unchanged source is not downloaded again');
    assert.deepEqual(new Uint8Array(await (await get(path)).arrayBuffer()), new Uint8Array([9, 9, 9, 9]));

    for (const target of ['/api/images/sonarr/999/poster', '/api/images/plex/1/poster', '/api/images/sonarr/1/banner']) {
      const missing = await get(target);
      assert.equal(missing.status, 404, target);
      assert.equal(missing.headers.get('cache-control'), 'no-store', target);
    }
    assert.match(JSON.stringify(readTitle(database, 'sonarr', 1).detail), /\/MediaCover\/1\/poster\.jpg/);
    const served = seen.join('\n');
    assert.equal(served.includes(sonarrKey), false);
    assert.equal(served.includes(radarrKey), false);
    assert.equal(served.includes('/MediaCover'), false);
  });

  // Leaving the cache tables out of the migration list, or numbering it out of order, turns this red.
  await t.test('the migration adds the cache tables', async () => {
    const { database } = setup();
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, applicationMigrations.length);
    const names = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map(({ name }) => name);
    for (const name of ['titles', 'episodes', 'title_images']) assert.ok(names.includes(name), name);
  });
});

test('TMDB posters and backdrops are copied to our server on first request', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createImageRoutes, createTmdbImages } = await import(titlesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-tmdb-images-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let setups = 0;
  const setup = async () => {
    setups += 1;
    const directory = join(root, `case-${setups}`);
    const database = openDatabase(join(directory, 'media-manager.sqlite'));
    t.after(() => database.close());
    const clock = { value: Date.parse('2026-10-11T12:00:00Z') };
    const fetched = [];
    const remote = { reachable: true, bytes: new Uint8Array([1, 2, 3]) };
    const fetchImpl = async (url) => {
      fetched.push(String(url));
      if (!remote.reachable) throw new TypeError('fetch failed');
      return new Response(remote.bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    };
    const tmdb = createTmdbImages({ database, imageDirectory: join(directory, 'images'), fetchImpl, now: () => clock.value });
    const { app } = await makeApp({ images: createImageRoutes({ image: () => undefined }, tmdb) });
    const { session } = await signIn(app);
    const get = (path) => app.request(path, { headers: { Cookie: session } });
    const rows = () => database.prepare('SELECT size, path FROM tmdb_images').all().map(({ size, path }) => `${size}/${path}`);
    return { app, clock, fetched, get, remote, rows, tmdb, images: join(directory, 'images') };
  };

  // Fetching from TMDB on every request instead of serving the saved copy, or not sharing one fetch between concurrent misses, turns this red.
  await t.test('the first request fetches from TMDB once and later requests serve the saved copy', async () => {
    const { app, fetched, get } = await setup();
    assert.equal((await app.request('/api/images/tmdb/w342/abc123.jpg')).status, 401);
    const [first, concurrent] = await Promise.all([get('/api/images/tmdb/w342/abc123.jpg'), get('/api/images/tmdb/w342/abc123.jpg')]);
    assert.equal(first.status, 200);
    assert.equal(concurrent.status, 200);
    assert.deepEqual(fetched, ['https://image.tmdb.org/t/p/w342/abc123.jpg']);
    const second = await get('/api/images/tmdb/w342/abc123.jpg');
    assert.equal(second.status, 200);
    assert.equal(second.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(new Uint8Array(await second.arrayBuffer()), new Uint8Array([1, 2, 3]));
    assert.deepEqual(fetched, ['https://image.tmdb.org/t/p/w342/abc123.jpg']);
    assert.equal((await get('/api/images/tmdb/w1920_and_h800_multi_faces/abc123.jpg')).status, 200);
    assert.equal(fetched.length, 2, 'each size is its own copy');
  });

  // Loosening the size or file check, so a caller can steer the fetch or reach outside the image folder, turns this red.
  await t.test('a size or file outside the allowed set is refused without a fetch', async () => {
    const { fetched, get, rows } = await setup();
    for (const path of [
      '/api/images/tmdb/original/abc123.jpg',
      '/api/images/tmdb/w500/abc123.jpg',
      '/api/images/tmdb/w342/abc123.gif',
      '/api/images/tmdb/w342/abc_123.jpg',
      '/api/images/tmdb/w342/..%2F..%2Fmedia-manager.sqlite',
      '/api/images/tmdb/w342/%2E%2E%2Fabc123.jpg',
      '/api/images/tmdb/w342/abc123.jpg%2F..%2F..%2Fx.jpg',
      '/api/images/tmdb/w342/evil.example%2Fabc123.jpg',
    ]) {
      assert.equal((await get(path)).status, 404, path);
    }
    assert.deepEqual(fetched, []);
    assert.deepEqual(rows(), []);
  });

  // Keeping a copy past six months, against TMDB's terms, turns this red.
  await t.test('a copy older than six months is fetched again', async () => {
    const { clock, fetched, get, remote } = await setup();
    await get('/api/images/tmdb/w342/abc123.jpg');
    clock.value += 179 * 24 * 60 * 60_000;
    await get('/api/images/tmdb/w342/abc123.jpg');
    assert.equal(fetched.length, 1);
    remote.bytes = new Uint8Array([7, 7]);
    clock.value += 2 * 24 * 60 * 60_000;
    const refreshed = await get('/api/images/tmdb/w342/abc123.jpg');
    assert.equal(fetched.length, 2);
    assert.deepEqual(new Uint8Array(await refreshed.arrayBuffer()), new Uint8Array([7, 7]));
  });

  // Saving a row when TMDB cannot be reached, or answering anything other than a 502 JSON error, turns this red.
  await t.test('TMDB unreachable on a miss answers 502 and saves nothing', async () => {
    const { get, remote, rows } = await setup();
    remote.reachable = false;
    const response = await get('/api/images/tmdb/w342/abc123.jpg');
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'tmdb_unreachable' });
    assert.deepEqual(rows(), []);
  });

  // Expiring a copy only when it is asked for again, or leaving the partial file a failed write made, grows the images folder forever.
  await t.test('the sweep removes copies past six months and partial files older than a day, and a failed save leaves no partial file', async () => {
    const { clock, get, rows, tmdb, images } = await setup();
    const day = 24 * 60 * 60_000;
    await get('/api/images/tmdb/w342/old.jpg');
    clock.value += 181 * day;
    await get('/api/images/tmdb/w342/fresh.jpg');
    const at = (ms) => new Date(ms);
    await writeFile(join(images, 'stale.jpg.1.tmp'), 'partial');
    await utimes(join(images, 'stale.jpg.1.tmp'), at(clock.value - 2 * day), at(clock.value - 2 * day));
    await writeFile(join(images, 'busy.jpg.2.tmp'), 'partial');
    await utimes(join(images, 'busy.jpg.2.tmp'), at(clock.value), at(clock.value));
    tmdb.sweep();
    assert.deepEqual(rows(), ['w342/fresh.jpg']);
    assert.deepEqual((await readdir(images)).sort(), ['busy.jpg.2.tmp', 'tmdb-w342-fresh.jpg']);

    await mkdir(join(images, 'tmdb-w342-blocked.jpg', 'inside'), { recursive: true });
    assert.equal((await get('/api/images/tmdb/w342/blocked.jpg')).status, 500);
    assert.deepEqual((await readdir(images)).filter((name) => name.startsWith('tmdb-w342-blocked.jpg.')), []);
  });
});

test('problems record each fix attempt and its result', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createProblems, findOpenProblem, listOpenProblems, subjectHistory, countReleaseAttempts } = await import(problemsModuleUrl);
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

  // Loading all listed problems' steps together and attaching a step to the wrong problem, or out of order, turns this red.
  await t.test('listed problems each carry their own steps in order, and a kind filter or single lookup finds the same', async () => {
    const database = openDatabase(join(root, 'listing', 'media-manager.sqlite'));
    const problems = createProblems({ database, events: createEventHub(), now: () => 7_000 });
    const torrent = { type: 'torrent', service: null, id: 'CD'.repeat(20) };
    const first = problems.open({ kind: 'stalled', subject: episode, summary: 'Stalled.' });
    const second = problems.open({ kind: 'unfinished', subject: torrent, summary: 'Unfinished.' });
    problems.step(first.id, 'fix', 'first fix');
    problems.step(second.id, 'fix', 'second fix');
    problems.setState(first.id, 'needs_you', 'first result');
    assert.deepEqual(listOpenProblems(database).map((problem) => [problem.kind, problem.steps.map((step) => step.text)]), [
      ['stalled', ['Stalled.', 'first fix', 'first result']],
      ['unfinished', ['Unfinished.', 'second fix']],
    ]);
    assert.deepEqual(listOpenProblems(database, ['unfinished']), [listOpenProblems(database)[1]]);
    assert.deepEqual(findOpenProblem(database, 'unfinished', torrent), listOpenProblems(database)[1]);
    assert.equal(findOpenProblem(database, 'unfinished', episode), undefined);
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

  // Sending every stored grab, or dropping an imported one whose torrent still seeds, turns this red.
  await t.test('the downloads route sends only grabs still downloading or still in rTorrent', async () => {
    const database = openDatabase(join(root, 'api-grabs', 'media-manager.sqlite'));
    const { app } = await makeApp({ api: createApiRoutes(database) });
    const insertGrab = database.prepare(`INSERT INTO torrent_grabs (hash, service, movie_id, episode_ids, release_title, indexer, grabbed_at, by_hand, imported_at, failed_at)
      VALUES (?, 'radarr', 7, '[]', 'Movie.2024', 'Blutopia', 1, 0, ?, ?)`);
    const insertTorrent = database.prepare(`INSERT INTO torrents VALUES (?, 'Movie.2024', 10, 10, 0, 0, 1, 1, 1, 1, '', 0, 1000, 0, 0, 'blutopia.cc', 1, 1, ?, 0, '')`);
    const downloading = 'AA'.repeat(20);
    const seeding = 'BB'.repeat(20);
    const removed = 'CC'.repeat(20);
    const failed = 'DD'.repeat(20);
    insertGrab.run(downloading, null, null);
    insertGrab.run(seeding, 2, null);
    insertGrab.run(removed, 2, null);
    insertGrab.run(failed, null, 3);
    insertTorrent.run(seeding, null);
    insertTorrent.run(removed, 5);
    const { session } = await signIn(app);
    const { grabs } = await (await app.request('/api/downloads', { headers: { Cookie: session } })).json();
    assert.deepEqual(grabs.map((grab) => grab.hash).sort(), [downloading, seeding]);
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
  const { fake, ...arr } = connectArr(database);
  const delayed = {
    id: -51234, status: 'delay', title: 'Andor.S02E09.2160p.WEB-DL', series: { title: 'Andor' }, episode: { seasonNumber: 2, episodeNumber: 9 },
  };
  fake.sonarr.state.queue = [{ ...delayed }];
  fake.radarr.state.queue = [{ id: 8, status: 'downloading', downloadId: 'ee'.repeat(20), title: 'Dune.Part.Two.2024', movie: { title: 'Dune: Part Two', year: 2024 } }];
  fake.radarr.routes.push((method, url) => (method === 'DELETE' && url.pathname === '/api/v3/queue/8' ? { status: 500, body: {} } : undefined));
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
  assert.deepEqual(fake.sonarr.state.grabbed, [-51234]);

  // Removing from rTorrent, or mapping a removal choice to the wrong blocklist and search flags, turns this red.
  assert.equal((await post('/api/queue/sonarr/-51234/remove', { release: 'everything' })).status, 400);
  const downloadMarks = () => database.prepare("SELECT COUNT(*) AS count FROM blocklist_marks WHERE origin = 'downloads'").get().count;
  for (const release of ['keep', 'blocklist', 'blocklist_search']) {
    // Each removal takes the item out of the fake's queue, so it goes back in before the next one.
    if (fake.sonarr.state.queue.length === 0) fake.sonarr.state.queue.push({ ...delayed });
    await tracker.refresh('sonarr');
    assert.equal((await post('/api/queue/sonarr/-51234/remove', { release })).status, 204);
    // Recording a blocklist mark for a kept release, or none for a blocklisted one, turns this red.
    assert.equal(downloadMarks() > 0, release !== 'keep');
  }
  // Mapping a 404 on the queueId removal to ok with removed 0 turns this red.
  fake.sonarr.state.queue.push({ ...delayed });
  await tracker.refresh('sonarr');
  fake.sonarr.state.queue = [];
  const marksBefore = downloadMarks();
  const gone = await post('/api/queue/sonarr/-51234/remove', { release: 'blocklist' });
  assert.equal(gone.status, 502);
  assert.deepEqual(await gone.json(), { error: 'service_refused' });
  assert.equal(downloadMarks(), marksBefore);
  assert.equal((await post('/api/queue/radarr/8/remove', { release: 'keep' })).status, 502);
  assert.deepEqual(fake.sonarr.state.removals, [
    { queueId: -51234, removeFromClient: false, blocklist: false, skipRedownload: true },
    { queueId: -51234, removeFromClient: false, blocklist: true, skipRedownload: true },
    { queueId: -51234, removeFromClient: false, blocklist: true, skipRedownload: false },
  ]);
  assert.deepEqual(fake.radarr.state.removals, []);
});

test('an import is finished by hand only with a complete, conflict-free assignment and hardlinks', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createProblems, listOpenProblems } = await import(problemsModuleUrl);
  const { createManualImport } = await import(manualImportModuleUrl);
  const { createImportFix } = await import(importsModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-manual-import-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(() => database.close());
  const hash = 'AB'.repeat(20);
  const events = createEventHub();
  const problems = createProblems({ database, events });
  const files = [
    { path: '/downloads/Pack/S01E01.mkv', relativePath: 'S01E01.mkv', size: 1, quality: { quality: { id: 3 }, revision: { version: 2, real: 0 } }, languages: [{ id: 1 }], episodes: [{ id: 101 }], rejections: [{ reason: 'Episode unexpected' }] },
    { path: '/downloads/Pack/S01E02.mkv', relativePath: 'S01E02.mkv', size: 1, quality: { quality: { id: 3 } }, languages: [], episodes: [] },
  ];
  const { fake, ...arr } = connectArr(database, { sonarr: {} });
  const { state } = fake.sonarr;
  state.manualImport[hash] = files;
  fake.sonarr.routes.push((method, url) => {
    if (method !== 'GET') return undefined;
    if (url.pathname === '/api/v3/qualitydefinition') return { status: 200, body: [{ quality: { id: 3, name: 'WEBDL-1080p' }, title: 'WEBDL-1080p' }] };
    if (url.pathname === '/api/v3/language') return { status: 200, body: [{ id: 1, name: 'English' }] };
    return undefined;
  });
  state.episodes = [episodeRecord({ id: 101, seriesId: 9, seasonNumber: 1, episodeNumber: 1 }), episodeRecord({ id: 102, seriesId: 9, seasonNumber: 1, episodeNumber: 2 })];
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
  state.copyUsingHardlinks = false;
  assert.equal((await submit([file(files[0].path, [101]), file(files[1].path, [102])])).status, 502);
  assert.deepEqual(state.commands, []);

  // Moving instead of hardlinking or dropping the chosen episode turns this red.
  state.copyUsingHardlinks = true;
  assert.equal((await submit([file(files[0].path, [101]), file(files[1].path, [102])])).status, 204);
  assert.equal(state.commands.length, 1);
  const [command] = state.commands;
  assert.equal(command.importMode, 'copy');
  assert.deepEqual(command.files.map((entry) => [entry.seriesId, entry.episodeIds, entry.quality.quality.id, entry.quality.revision.version]), [[9, [101], 3, 2], [9, [102], 3, 1]]);

  // Resolving on Sonarr's acceptance alone, or forcing an automatic import over the hand one, hides an import that then fails inside Sonarr.
  assert.equal(listOpenProblems(database).find((problem) => problem.id === flagged.id).state, 'handling');
  state.queue = [queueItem({ downloadId: hash, seriesId: 9, episodeId: 101, status: 'completed', trackedDownloadStatus: 'warning',
    trackedDownloadState: 'importBlocked', statusMessages: [{ title: 'S01E01.mkv', messages: ['Series title mismatch, automatic import is not possible.'] }] })];
  await tracker.reconcile();
  const clock = { value: Date.now() };
  const fix = createImportFix({ database, arr, problems, events, now: () => clock.value });
  clock.value += 29 * 60_000;
  await fix.check();
  assert.equal(listOpenProblems(database).find((problem) => problem.id === flagged.id).state, 'handling');
  clock.value += 60_000;
  await fix.check();
  const [stuck] = listOpenProblems(database);
  assert.equal(stuck.state, 'needs_you');
  assert.match(stuck.steps.at(-1).text, /still blocked/);
  assert.equal(state.commands.length, 1);
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
    return [h, value.name, value.size, value.completed, 0, 0, value.state, 1, value.active, value.complete, value.message, 0, 0, 0, 0, '/downloads'];
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
        if (method === 'f.multicall') return [];
        fake.calls.push([method, params[0]]);
        return 0;
      },
    };
    const now = () => clock.value;
    const poller = createTorrentPoller({ database, rtorrent, events, now });
    const problems = createProblems({ database, events, now });
    const watch = createTrackerWatch({ database, rtorrent, problems, events, now });
    // Every torrent here counts as a Sonarr grab unless listed in unowned; the watch ignores torrents nobody here grabbed.
    const unowned = new Set();
    const step = async (rows, elapsed = 60_000) => {
      clock.value += elapsed;
      fake.rows = rows;
      for (const [h] of rows) {
        if (unowned.has(h)) continue;
        database.prepare(`INSERT OR IGNORE INTO torrent_grabs (hash, service, series_id, episode_ids, release_title, indexer, grabbed_at, by_hand)
          VALUES (?, 'sonarr', 1, '[1]', 'Show.S01E01', 'Tracker', 0, 0)`).run(h);
      }
      await poller.poll();
      await watch.check();
    };
    return { database, clock, events, fake, watch, step, poller, unowned };
  };

  // Flagging a torrent that Sonarr, Radarr and media-manager-2 never grabbed (a music download, say) turns this red.
  await t.test('torrents nobody here grabbed are never flagged, and their old flags resolve', async () => {
    const { database, fake, watch, step, unowned } = setup();
    const music = row(hash(1), { state: 0, active: 0, message: 'Tracker: [Failure reason "Unregistered torrent"]' });
    const damaged = row(hash(2), { completed: 0, state: 0, active: 0, message: 'Hash check on download completion found bad chunks' });
    unowned.add(hash(1)).add(hash(2));
    // A flag opened before this rule existed must resolve on the next check.
    database.prepare(`INSERT INTO torrent_issues (hash, kind, since, replace) VALUES (?, 'unregistered', 0, 1)`).run(hash(1));
    database.prepare(`INSERT INTO problems (kind, subject_type, service, subject_id, hash, state, summary, opened_at, updated_at)
      VALUES ('unregistered', 'torrent', '', ?, ?, 'needs_you', 'old flag', 0, 0)`).run(hash(1), hash(1));
    await step([music, damaged]);
    await step([music, damaged], 31 * 60_000);
    assert.deepEqual(listOpenProblems(database), []);
    assert.deepEqual(listIssues(database), []);
    assert.deepEqual(watch.replacementRequests(), []);
    assert.deepEqual(fake.calls, []);
    database.close();
  });

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
    const { database, events, fake, watch, step } = setup();
    const replacements = [];
    events.subscribe((event) => { if (event.type === 'replacement') replacements.push(event.data.hash); });
    // Asking for a replacement on a finished torrent turns this red: the stall fix then grabs a release nobody asked for.
    const finished = row(hash(9), { complete: 1, completed: 1000, message: 'Tracker: [Failure reason "Unregistered torrent"]' });
    await step([row(hash(4), { message: 'Tracker: [Failure reason "Unregistered torrent"]' }), row(hash(5), { message: 'Hash check on download completion found bad chunks' }), finished]);
    assert.deepEqual(watch.replacementRequests().map((issue) => issue.hash), [hash(4)]);
    assert.deepEqual(replacements, [hash(4)]);
    // Opening the finished torrent's problem as handling turns this red: nothing handles it, so it waits on the owner unseen.
    const flagged = listOpenProblems(database).find((problem) => problem.kind === 'unregistered' && problem.hash === hash(9));
    assert.equal(flagged?.state, 'needs_you');
    assert.deepEqual(fake.calls, [['d.check_hash', hash(5)]]);
    await step([row(hash(4), { message: 'Tracker: [Failure reason "Unregistered torrent"]' }), row(hash(5), { message: 'Hash check on download completion found bad chunks' }), row(hash(9), { complete: 1, completed: 1000 })], 31 * 60_000);
    assert.equal(listOpenProblems(database).some((problem) => problem.id === flagged.id), false, 'a clean message ends the finished torrent\'s problem');
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

  // Rechecking a torrent that has no data turns this red.
  await t.test('damaged data on a torrent with nothing downloaded is flagged for the owner, never rechecked or replaced', async () => {
    const { database, fake, watch, step } = setup();
    const empty = row(hash(8), { completed: 0, state: 0, active: 0, message: 'Hash check on download completion found bad chunks' });
    await step([empty]);
    await step([empty], 31 * 60_000);
    assert.equal(fake.calls.some(([method]) => method === 'd.check_hash'), false);
    assert.deepEqual(listIssues(database), []);
    assert.deepEqual(watch.replacementRequests(), []);
    const [problem] = listOpenProblems(database);
    assert.equal(problem.kind, 'damaged');
    assert.equal(problem.state, 'needs_you');
    assert.equal(problem.steps.at(-1).text, 'The download files are gone; nothing to recheck.');
    assert.equal(problem.steps.length, 2);
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
  const { listSecondVersionRows } = await import(secondVersionRowsModuleUrl);
  const { createSecondVersions, infoHash } = await import(secondVersionsModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createProtection } = await import(protectionModuleUrl);
  const { createLabels } = await import(labelsModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-stalls-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let count = 0;
  const minute = 60_000;
  const hash = 'AB'.repeat(20);
  const start = Date.parse('2026-10-08T12:00:00Z');

  // versions: second_versions rows for the torrent, which then has no grab record. torrentHash replaces the fixed hash.
  const setup = async ({
    publishedAgoMs = 48 * 60 * minute, completed = 0, files = [[0]], releases, manual = false, message = '',
    versions = null, removal = { removed: true, deleted: [], left: [] }, torrentHash = hash,
  } = {}) => {
    count += 1;
    const database = openDatabase(join(root, `db-${count}`, 'media-manager.sqlite'));
    const clock = { value: start };
    const now = () => clock.value;
    const events = createEventHub();
    const torrent = { completed, down: 0, seeders: 0, scrape: 0, gone: false };
    const calls = [];
    const rtorrent = {
      call: async (method, params) => {
        if (method === 'd.multicall2') {
          if (torrent.gone) return [];
          return [[torrentHash, 'Movie.2024.1080p', 1000, torrent.completed, torrent.down, 0, 1, 1, 1, 0, message, 0, 0, torrent.seeders, torrent.seeders, '/downloads']];
        }
        if (method === 't.multicall') return params[2] === 't.url=' ? [['https://tracker.blutopia.cc/announce/key']] : [[torrent.scrape]];
        if (method === 'f.multicall') return files;
        calls.push([method, ...params]);
        return 0;
      },
    };
    const { fake, ...arr } = connectArr(database);
    const radarr = fake.radarr;
    radarr.state.movies = [movieRecord({ id: 7, title: 'Movie', year: 2024 })];
    fake.sonarr.state.series = [seriesRecord({ id: 3, title: 'Show' })];
    fake.sonarr.state.episodes = [31, 32, 33].map((id) => episodeRecord({ id, seriesId: 3, episodeNumber: id - 30 }));
    if (versions === null) {
      radarr.state.queue = [queueItem({ id: 55, downloadId: hash.toLowerCase(), movieId: 7, title: 'Movie.2024.1080p' })];
      radarr.state.history = [historyRecord({ downloadId: hash, movieId: 7, sourceTitle: 'Movie.2024.1080p', date: new Date(start - minute).toISOString(),
        data: { indexer: 'Blutopia (API)', publishedDate: new Date(start - publishedAgoMs).toISOString() } })];
    }
    for (const row of versions ?? []) {
      database.prepare(`
        INSERT INTO second_versions (service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, hash, state, failure, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Movie.2024.2160p', 'guid', 'Blutopia', 'Remux-2160p', ?, ?, ?, 0, 0)
      `).run(row.service, row.movieId ?? null, row.seriesId ?? null, row.episodeId ?? null, torrentHash, row.state ?? 'downloading', row.failure ?? null);
    }
    const removed = [];
    const removeTorrent = async (target) => {
      removed.push(target);
      return removal;
    };
    radarr.routes.push((method, url) => {
      if (url.pathname !== '/api/v3/release') return undefined;
      return method === 'GET' ? { status: 200, body: releases } : { status: 200, body: {} };
    });
    const poller = createTorrentPoller({ database, rtorrent, events, now });
    const grabs = createGrabTracker({ database, arr, events, now });
    const problems = createProblems({ database, events, now });
    const trackers = createTrackerWatch({ database, rtorrent, problems, events, now });
    if (manual) database.prepare("INSERT INTO protected_items (service, item_id, created_at) VALUES ('radarr', 7, 0)").run();
    const stalls = createStallFix({
      database, rtorrent, arr, problems, trackers, now, isManualDownload: createProtection(database, arr).isProtected, labels: createLabels(arr), removeTorrent,
    });
    await grabs.reconcile();
    const tick = async (minutes = 1) => {
      for (let i = 0; i < minutes; i += 1) {
        clock.value += minute;
        await poller.poll();
        await trackers.check();
        await stalls.check();
      }
    };
    return { database, torrent, calls, requests: radarr.requests, removals: radarr.state.removals, state: radarr.state, tick, problems, removed, now };
  };
  const release = (title, indexer, overrides = {}) => ({ guid: `guid-${title}`, indexerId: title.length, indexer, title, approved: true, ...overrides });
  const grabbedTitles = (requests) => requests.filter(({ method, path }) => method === 'POST' && path === '/api/v3/release').map(({ body }) => body.guid);

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
    assert.equal(old.removals.length, 0);
    await old.tick(1);
    assert.equal(old.removals.length, 1);
    old.database.close();

    const fresh = await setup({ publishedAgoMs: 2 * 60 * minute, releases: [] });
    await fresh.tick(180);
    assert.equal(fresh.removals.length, 0);
    await fresh.tick(1);
    assert.equal(fresh.removals.length, 1);
    fresh.database.close();
  });

  // Skipping the fresh-peers request, or calling it stalled before 30 minutes after it, turns this red.
  await t.test('seeders with zero speed ask for fresh peers, then stall 30 minutes later', async () => {
    const run = await setup({ releases: [] });
    run.torrent.seeders = 2;
    await run.tick(11);
    assert.deepEqual(run.calls.filter(([method]) => method === 'd.tracker_announce').length, 1);
    await run.tick(29);
    assert.equal(run.removals.length, 0);
    await run.tick(1);
    assert.equal(run.removals.length, 1);
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
    assert.deepEqual(run.removals, [{ queueId: 55, removeFromClient: false, blocklist: true, skipRedownload: true }]);
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

  // Ignoring removeFromQueue's removed count, or treating 0 as a block, turns this red.
  await t.test('a release the live queue no longer lists is not reported as blocked and nothing is replaced', async () => {
    const run = await setup({ releases: [release('Another', 'BeyondHD')] });
    run.state.queue = [];
    await run.tick(61);
    const problem = listOpenProblems(run.database).find((item) => item.kind === 'stalled');
    assert.equal(problem.state, 'needs_you');
    assert.match(problem.steps.at(-1).text, /was not blocked/);
    assert.deepEqual(run.removals, []);
    assert.deepEqual(grabbedTitles(run.requests), []);
    run.database.close();
  });

  // Second versions have no grab record, so an unknown release age gives them the three-hour wait.
  const stalledOnce = async (run) => {
    await run.tick(181);
    return run.database.prepare("SELECT * FROM problems WHERE kind = 'stalled'").all();
  };
  const versionRows = (run) => run.database.prepare('SELECT state, failure, failure_code FROM second_versions ORDER BY id').all().map((row) => ({ ...row }));
  const movieVersion = [{ service: 'radarr', movieId: 7 }];

  // Treating a second version as "no grab record", erasing it outside removeTorrent, or regrabbing it turns this red.
  await t.test('a stalled second version with nothing downloaded is removed through removeTorrent and flagged once', async () => {
    const run = await setup({ versions: movieVersion, releases: [release('Another', 'BeyondHD')] });
    const stalled = await stalledOnce(run);
    assert.equal(stalled.length, 1);
    assert.equal(stalled[0].state, 'needs_you');
    assert.match(stalled[0].summary, /Second version of Movie \(2024\) \(Movie\.2024\.2160p\)/);
    assert.deepEqual(run.removed, [hash]);
    // Dropping the failure code from the stall removal turns the code red.
    assert.deepEqual(versionRows(run), [{ state: 'failed', failure: 'Stalled with nothing downloaded; torrent removed.', failure_code: 'stalled_removed' }]);
    await run.tick(240);
    assert.equal(run.database.prepare("SELECT COUNT(*) AS count FROM problems WHERE kind = 'stalled'").get().count, 1);
    assert.deepEqual(run.removed, [hash]);
    assert.deepEqual(run.calls.filter(([method]) => method === 'd.erase'), []);
    assert.deepEqual(grabbedTitles(run.requests), []);
    assert.deepEqual(run.removals, []);
    run.database.close();
  });

  // Removing a partly downloaded second version, stopping its files, or opening a problem per episode turns this red.
  await t.test('a partly downloaded stalled second version pack stays active with one problem listing its episodes', async () => {
    const pack = [31, 32, 33].map((episodeId) => ({ service: 'sonarr', seriesId: 3, episodeId }));
    const run = await setup({ versions: pack, completed: 400, files: [[12], [0], [0]], releases: [] });
    const stalled = await stalledOnce(run);
    assert.equal(stalled.length, 1);
    assert.match(stalled[0].summary, /Show S01E01, Show S01E02, Show S01E03/);
    assert.deepEqual(run.removed, []);
    assert.deepEqual(run.calls.filter(([method]) => method === 'd.erase' || method === 'f.priority.set'), []);
    assert.deepEqual(versionRows(run).map((row) => row.state), ['downloading', 'downloading', 'downloading']);
    // Reading stalled from anything but the stall check's flag on a still-downloading row turns this red.
    assert.deepEqual(listSecondVersionRows(run.database, { service: 'sonarr', seriesId: 3 }).map((row) => row.stalled), [true, true, true]);
    run.database.close();
  });

  // Marking the rows failed when removeTorrent refuses, or hiding its reason, turns this red.
  await t.test('a refused removal keeps the second version downloading and the problem says why', async () => {
    const run = await setup({ versions: movieVersion, releases: [], removal: { removed: false, reason: 'A.mkv is also used by the torrent T7.' } });
    await stalledOnce(run);
    const [problem] = listOpenProblems(run.database).filter((item) => item.kind === 'stalled');
    assert.match(problem.steps.at(-1).text, /A\.mkv is also used by the torrent T7\./);
    assert.deepEqual(versionRows(run), [{ state: 'downloading', failure: null, failure_code: null }]);
    run.database.close();
  });

  // Leaving the problem open after the torrent downloads again, or never watching it again, turns this red.
  await t.test('a flagged second version that downloads again resolves its problem and is watched afresh', async () => {
    const run = await setup({ versions: movieVersion, completed: 400, releases: [] });
    await stalledOnce(run);
    const stalled = () => listSecondVersionRows(run.database, { service: 'radarr', movieId: 7 }).map((row) => row.stalled);
    assert.deepEqual(stalled(), [true]);
    run.torrent.seeders = 2;
    run.torrent.down = 500;
    await run.tick(1);
    assert.deepEqual(listOpenProblems(run.database).filter((item) => item.kind === 'stalled'), []);
    // Keeping stalled once the torrent downloads again turns this red.
    assert.deepEqual(stalled(), [false]);
    run.torrent.seeders = 0;
    run.torrent.down = 0;
    await run.tick(181);
    assert.equal(listOpenProblems(run.database).filter((item) => item.kind === 'stalled').length, 1);
    run.database.close();
  });

  // Leaving the stall record of a torrent the stall fix erased when it is grabbed again as a second version turns this
  // red: the stall check then skips that torrent for good and the new row never reads stalled.
  await t.test('a second version grabbed again after the stall fix erased it is watched and flagged again', async () => {
    const bytes = Buffer.from('d4:infod6:lengthi1000e4:name16:Movie.2024.2160pee');
    const again = infoHash(bytes);
    const run = await setup({ versions: movieVersion, releases: [], torrentHash: again });
    await stalledOnce(run);
    assert.deepEqual(versionRows(run).map((row) => row.failure_code), ['stalled_removed']);
    run.torrent.gone = true;
    await run.tick(1);

    setSetting(run.database, 'hostPaths', 'downloads.radarr', '/data/movie-downloads');
    setSetting(run.database, 'serviceAddresses', 'rtorrent.url', 'http://127.0.0.1:1');
    const secondVersions = createSecondVersions({
      database: run.database,
      releases: { find: () => ({ title: 'Movie.2024.2160p', downloadUrl: 'https://indexer.example/t', protocol: 'torrent', size: 1000, indexer: 'Blutopia', quality: 'Remux-2160p' }) },
      rtorrent: { call: async (method) => (method === 'd.custom1' ? 'mm2-second-version' : 0) },
      fetch: async () => new Response(bytes),
      now: run.now,
    });
    assert.equal((await secondVersions.grab({ service: 'radarr', kind: 'movie', movieId: 7 }, 'guid')).kind, 'sent');
    run.torrent.gone = false;
    run.torrent.completed = 400;
    await run.tick(1);
    await secondVersions.reconcile(run.now());
    assert.deepEqual(versionRows(run).map((row) => row.state), ['failed', 'downloading']);

    await run.tick(181);
    assert.deepEqual(listSecondVersionRows(run.database, { service: 'radarr', movieId: 7 }).map((row) => [row.state, row.stalled]), [
      ['failed', false], ['downloading', true],
    ]);
    run.database.close();
  });

  // Watching or flagging a torrent with no grab record and no second version row (a music download, say) turns this red.
  await t.test('a stalled torrent nobody here grabbed is left alone, and its old stall flag resolves', async () => {
    const other = 'CD'.repeat(20);
    const run = await setup({ versions: [], releases: [], torrentHash: other });
    run.database.prepare(`INSERT INTO problems (kind, subject_type, service, subject_id, hash, state, summary, opened_at, updated_at)
      VALUES ('stalled', 'torrent', '', ?, ?, 'needs_you', 'old flag', 0, 0)`).run(other, other);
    await run.tick(15 * 24 * 60);
    assert.deepEqual(listOpenProblems(run.database), []);
    assert.equal(run.database.prepare('SELECT COUNT(*) AS count FROM stall_watch').get().count, 0);
    assert.deepEqual(run.calls, []);
    run.database.close();
  });

  // Recognising a hash whose rows Sonarr or Radarr took over as a second version turns this red.
  await t.test('a stalled torrent with only failed second version rows is still flagged as having no grab record', async () => {
    const run = await setup({ versions: [{ service: 'radarr', movieId: 7, state: 'failed', failure: 'Sonarr or Radarr grabbed the same torrent.' }], releases: [] });
    const [problem] = await stalledOnce(run);
    assert.match(problem.summary, /can't be replaced automatically/);
    assert.deepEqual(run.removed, []);
    run.database.close();
  });
});

test('a stopped torrent whose download files were deleted is re-linked to its library copy', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTorrentPoller } = await import(torrentsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createProblems, getProblem } = await import(problemsModuleUrl);
  const { createProtection } = await import(protectionModuleUrl);
  const { createRelinkFix, HASH_WAIT_LIMIT_MS } = await import(relinkModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-relink-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let count = 0;
  const hash = 'AB'.repeat(20);
  const start = Date.parse('2026-10-08T12:00:00Z');
  const writeMethods = ['d.close', 'd.directory.set', 'd.open', 'd.check_hash', 'd.start', 'd.message.set'];

  const setup = async ({
    name = 'Movie.2024.mkv', files = [['Movie.2024.mkv', 1234]], library = [['Movie (2024).mkv', 1234]],
    multi = 0, hashing = 3, manual = false, present = false, complete = 1, linked = false, startFails = false, linkError,
  } = {}) => {
    count += 1;
    const base = join(root, `case-${count}`);
    const downloadRoot = join(base, 'downloads/Radarr');
    const libraryRoot = join(base, 'library/Movies');
    const movieFolder = join(libraryRoot, 'Movie (2024)');
    const directory = join(downloadRoot, 'Old.Folder');
    await mkdir(downloadRoot, { recursive: true });
    await mkdir(movieFolder, { recursive: true });
    for (const [file, size] of library) await writeFile(join(movieFolder, file), Buffer.alloc(size));
    if (present) {
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, files[0][0]), Buffer.alloc(files[0][1]));
    }
    if (linked) await link(join(movieFolder, library[0][0]), join(downloadRoot, files[0][0]));
    const database = openDatabase(join(base, 'db', 'media-manager.sqlite'));
    setSetting(database, 'hostPaths', 'downloads.radarr', downloadRoot);
    setSetting(database, 'hostPaths', 'library.radarr', libraryRoot);
    const clock = { value: start };
    const now = () => clock.value;
    const fake = { hashing, complete };
    const sleep = async (ms) => { clock.value += ms; fake.hashing -= 1; };
    const size = files.reduce((total, [, bytes]) => total + bytes, 0);
    const message = 'Download registered as completed, but hash check returned unfinished chunks.';
    const calls = [];
    const rtorrent = {
      call: async (method, params) => {
        if (method === 'd.multicall2') return [[hash, name, size, 0, 0, 0, 0, 0, 0, 0, message, 0, 0, 0, 0, directory]];
        if (method === 't.multicall') return [['https://tracker.example/announce/k']];
        if (method === 'f.multicall') return files;
        if (method === 'd.directory') return directory;
        if (method === 'd.is_multi_file') return multi;
        if (method === 'd.hashing') return fake.hashing > 0 ? 3 : 0;
        if (method === 'd.complete') return fake.complete;
        calls.push([method, ...params]);
        if (method === 'd.start' && startFails) throw new Error('rTorrent is unreachable.');
        return 0;
      },
    };
    const { fake: arrFake, ...arr } = connectArr(database);
    arrFake.radarr.state.history = [historyRecord({ downloadId: hash, movieId: 7, sourceTitle: 'Movie.2024.1080p', date: new Date(start - 60_000).toISOString() })];
    arrFake.radarr.state.movies.push(movieRecord({ id: 7, path: movieFolder }));
    const events = createEventHub();
    const poller = createTorrentPoller({ database, rtorrent, events, now });
    const grabs = createGrabTracker({ database, arr, events, now });
    const problems = createProblems({ database, events, now });
    if (manual) database.prepare("INSERT INTO protected_items (service, item_id, created_at) VALUES ('radarr', 7, 0)").run();
    const relink = createRelinkFix({ database, rtorrent, arr, problems, now, sleep, isManualDownload: createProtection(database, arr).isProtected });
    await grabs.reconcile();
    await poller.poll();
    const restoreLinks = linkError === undefined ? () => {} : failLinks(linkError);
    try {
      await relink.check();
    } finally {
      restoreLinks();
    }
    const writes = calls.filter(([method]) => writeMethods.includes(method));
    const found = database.prepare("SELECT id FROM problems WHERE kind = 'download_missing'").all().map((row) => getProblem(database, Number(row.id)));
    database.close();
    return { writes, found, problem: found[0], downloadRoot, movieFolder, clock };
  };

  // Linking before the size match, skipping the recheck, or starting without a complete recheck turns this red.
  await t.test('a single-file torrent is hardlinked from the library, rechecked and started', async () => {
    const run = await setup();
    assert.deepEqual(run.writes, [['d.close', hash], ['d.directory.set', hash, run.downloadRoot], ['d.open', hash], ['d.check_hash', hash],
      ['d.start', hash], ['d.message.set', hash, '']]);
    const linked = await stat(join(run.downloadRoot, 'Movie.2024.mkv'));
    assert.equal(linked.nlink, 2);
    assert.equal(linked.ino, (await stat(join(run.movieFolder, 'Movie (2024).mkv'))).ino);
    assert.equal(run.found.length, 1);
    assert.equal(run.problem.state, 'resolved');
  });

  // Matching by anything looser than the exact byte size turns this red.
  await t.test('a library file one byte off is not used and rTorrent is left alone', async () => {
    const run = await setup({ library: [['Movie (2024).mkv', 1235]] });
    assert.equal(run.problem.state, 'needs_you');
    assert.match(run.problem.steps.at(-1).text, /exactly 1234 bytes/);
    assert.deepEqual(run.writes, []);
    assert.deepEqual(await readdir(run.downloadRoot), []);
  });

  // Writing to rTorrent before every torrent file has a library match turns this red.
  await t.test('a multi-file torrent with one unmatched file is left alone', async () => {
    const run = await setup({ name: 'Movie.2024', multi: 1, files: [['a.mkv', 10], ['b.mkv', 20]], library: [['a.mkv', 10]] });
    assert.equal(run.problem.state, 'needs_you');
    assert.deepEqual(run.writes, []);
  });

  // Linking multi-file torrents straight under the download root instead of under the torrent's name turns this red.
  await t.test('a multi-file torrent is linked under its own name in the download root', async () => {
    const run = await setup({ name: 'Movie.2024', multi: 1, files: [['a.mkv', 10], ['b.mkv', 20]], library: [['a.mkv', 10], ['b.mkv', 20]] });
    assert.equal(run.problem.state, 'resolved');
    assert.deepEqual(run.writes.find(([method]) => method === 'd.directory.set'), ['d.directory.set', hash, run.downloadRoot]);
    assert.equal((await stat(join(run.downloadRoot, 'Movie.2024', 'a.mkv'))).nlink, 2);
    assert.equal((await stat(join(run.downloadRoot, 'Movie.2024', 'b.mkv'))).nlink, 2);
  });

  // Pre-checking device numbers instead of linking, or touching rTorrent before the links are made, turns this red.
  await t.test('a library on another drive is reported and rTorrent is left alone', async () => {
    const run = await setup({ linkError: 'EXDEV' });
    assert.equal(run.problem.state, 'needs_you');
    assert.equal(run.problem.steps.at(-1).text, 'The download folder and the library are on different drives.');
    assert.deepEqual(run.writes, []);
  });

  // Dropping the manual-download check turns this red.
  await t.test('a manual download is flagged and never re-linked', async () => {
    const run = await setup({ manual: true });
    assert.equal(run.problem.state, 'needs_you');
    assert.equal(run.problem.steps.at(-1).text, 'This is a manual download, so it is left alone.');
    assert.deepEqual(run.writes, []);
  });

  // Dropping the check that the download files are really gone turns this red.
  await t.test('a stopped torrent whose download files still exist is not touched', async () => {
    const run = await setup({ present: true });
    assert.deepEqual(run.found, []);
    assert.deepEqual(run.writes, []);
  });

  // Waiting on the recheck without a ceiling, or starting the torrent after giving up, turns this red.
  await t.test('a recheck that never finishes gives up after two hours without starting', async () => {
    const run = await setup({ hashing: Infinity });
    assert.equal(run.problem.state, 'needs_you');
    assert.equal(run.problem.steps.at(-1).text, 'Still rechecking after two hours.');
    assert.equal(run.writes.some(([method]) => method === 'd.start'), false);
    assert.equal(run.writes.some(([method]) => method === 'd.check_hash'), true);
    assert.ok(run.clock.value - start >= HASH_WAIT_LIMIT_MS);
    assert.deepEqual(await readdir(run.downloadRoot), []);
    assert.equal((await stat(join(run.movieFolder, 'Movie (2024).mkv'))).nlink, 1);
  });

  // Leaving the hardlinks in the download root after a failed recheck turns this red.
  await t.test('an incomplete recheck removes the hardlinks it made and leaves the library file alone', async () => {
    const run = await setup({ complete: 0 });
    assert.equal(run.problem.state, 'needs_you');
    assert.equal(run.problem.steps.at(-1).text, 'The recheck found the data incomplete, so the torrent stays stopped.');
    assert.equal(run.problem.steps.at(-2).text, 'Removed the 1 hardlink again.');
    assert.deepEqual(await readdir(run.downloadRoot), []);
    assert.equal((await stat(join(run.movieFolder, 'Movie (2024).mkv'))).nlink, 1);
    assert.equal(run.writes.some(([method]) => method === 'd.start'), false);
  });

  // Removing every link at the torrent's file paths, not only the ones this run made, turns this red.
  await t.test('a hardlink that was already in the download root survives an incomplete recheck', async () => {
    const run = await setup({ linked: true, complete: 0 });
    assert.equal(run.problem.state, 'needs_you');
    assert.equal((await stat(join(run.downloadRoot, 'Movie.2024.mkv'))).nlink, 2);
  });

  // Removing the links when the start call throws turns this red: rTorrent may have started the torrent and be seeding from them.
  await t.test('a start that throws after a complete recheck leaves the hardlinks in place', async () => {
    const run = await setup({ startFails: true });
    assert.equal(run.problem.state, 'needs_you');
    assert.equal(run.problem.steps.at(-1).text, 'rTorrent is unreachable.');
    assert.equal((await stat(join(run.downloadRoot, 'Movie.2024.mkv'))).nlink, 2);
    assert.equal(run.problem.steps.some((step) => step.text.startsWith('Removed the')), false);
  });
});

test('library files are traced to the torrents holding them, and a torrent is removed only when nothing kept uses its files', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTorrentPoller } = await import(torrentsModuleUrl);
  const { createTorrentFiles } = await import(torrentFilesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-torrent-files-'));
  const databases = [];
  t.after(async () => {
    for (const database of databases) database.close();
    await rm(root, { recursive: true, force: true });
  });
  let count = 0;
  const hashOf = (n) => String(n).repeat(40);
  const exists = async (path) => lstat(path).then(() => true, () => false);

  // Each torrent: n (hash digit), directory under the case folder, files [[path, bytes]], multi, unreadable, size (0 = no metadata yet).
  const setup = async (torrents) => {
    count += 1;
    const base = join(root, `case-${count}`);
    const at = (...parts) => join(base, ...parts);
    await mkdir(at('downloads'), { recursive: true });
    await mkdir(at('library', 'Show'), { recursive: true });
    for (const torrent of torrents) {
      for (const [path, size] of torrent.files) {
        await mkdir(dirname(at(torrent.directory, path)), { recursive: true });
        await writeFile(at(torrent.directory, path), Buffer.alloc(size));
      }
    }
    const database = openDatabase(at('db', 'media-manager.sqlite'));
    databases.push(database);
    setSetting(database, 'hostPaths', 'downloads.sonarr', at('downloads'));
    setSetting(database, 'hostPaths', 'library.sonarr', at('library'));
    const fake = { torrents, down: false, eraseFails: false, erased: [] };
    const rtorrent = {
      call: async (method, params) => {
        if (fake.down) throw new Error('rTorrent is unreachable.');
        if (method === 'd.multicall2' && params.length === 5) return fake.torrents.map((torrent) => [hashOf(torrent.n), `T${torrent.n}`, at(torrent.directory)]);
        if (method === 'd.multicall2') {
          return fake.torrents.map((torrent) => [hashOf(torrent.n), `T${torrent.n}`, torrent.size ?? 1, 1, 0, 0, 1, 1, 1, 1, '', 0, 0, 0, 0, at(torrent.directory)]);
        }
        if (method === 't.multicall') return [];
        const torrent = fake.torrents.find((candidate) => hashOf(candidate.n) === params[0]);
        if (torrent === undefined) throw new Error('rTorrent fault -501: Could not find info-hash.');
        if (method === 'f.multicall') {
          if (torrent.unreadable) throw new Error('rTorrent timed out.');
          return torrent.files;
        }
        if (method === 'd.directory') return at(torrent.directory);
        if (method === 'd.is_multi_file') return torrent.multi ? 1 : 0;
        if (method === 'd.erase') {
          if (fake.eraseFails) throw new Error('rTorrent fault -1: busy');
          fake.erased.push(params[0]);
          fake.torrents = fake.torrents.filter((candidate) => candidate !== torrent);
          return 0;
        }
        throw new Error(`Unexpected ${method}`);
      },
    };
    const { fake: arrFake, ...arr } = connectArr(database);
    const poller = createTorrentPoller({ database, rtorrent, events: createEventHub() });
    await poller.poll();
    return { database, fake, arrFake, poller, at, ...createTorrentFiles({ database, rtorrent, arr }) };
  };
  const imported = (hash, fileId) => historyRecord({ eventType: 'downloadFolderImported', downloadId: hash.toLowerCase(), seriesId: 5, data: { fileId: String(fileId) } });
  const states = (mapping) => mapping.files.map((file) => [file.state, file.hashes]);

  // Calling a file none while a file list is unread or rTorrent is down, or ignoring the import record, turns this red.
  await t.test('a hardlink is linked, a copy with an import record is copied, and an unexplained copy is none only when every list is read', async () => {
    const world = await setup([
      { n: 1, directory: 'downloads', files: [['A.mkv', 10]] },
      { n: 2, directory: 'downloads', files: [['B.mkv', 20]] },
    ]);
    await link(world.at('downloads', 'A.mkv'), world.at('library', 'Show', 'e1.mkv'));
    await writeFile(world.at('library', 'Show', 'e2.mkv'), Buffer.alloc(20));
    await writeFile(world.at('library', 'Show', 'e3.mkv'), Buffer.alloc(30));
    world.arrFake.sonarr.state.history.push(imported(hashOf(2), 2), historyRecord({ downloadId: hashOf(1), seriesId: 5, data: { fileId: '3' } }));
    const library = [1, 2, 3].map((n) => ({ path: world.at('library', 'Show', `e${n}.mkv`), fileId: n }));

    const mapping = await world.mapFiles(library, 'sonarr', 5);
    assert.deepEqual(states(mapping), [['linked', [hashOf(1)]], ['copied', [hashOf(2)]], ['none', []]]);
    assert.deepEqual(mapping.torrents.map((torrent) => [torrent.hash, torrent.files.map((file) => file.libraryPaths)]),
      [[hashOf(1), [[library[0].path]]], [hashOf(2), [[]]]]);

    world.fake.torrents.push({ n: 3, directory: 'downloads', files: [['C.mkv', 5]], unreadable: true });
    await world.poller.poll();
    const unread = await world.mapFiles(library, 'sonarr', 5);
    assert.deepEqual(states(unread), [['linked', [hashOf(1)]], ['copied', [hashOf(2)]], ['unknown', []]]);
    assert.match(unread.files[2].reason, /not all read/);

    world.fake.torrents.at(-1).unreadable = false;
    await world.poller.poll();
    assert.equal((await world.mapFiles(library, 'sonarr', 5)).files[2].state, 'none');
    world.fake.down = true;
    await world.poller.poll();
    assert.equal((await world.mapFiles(library, 'sonarr', 5)).files[2].state, 'unknown');
  });

  // Counting a torrent without metadata as unread, never reading its list once it has metadata, or skipping the live check before the erase turns this red.
  await t.test('a torrent without metadata holds nothing until it has some, and is read from rTorrent before an erase', async () => {
    const world = await setup([
      { n: 1, directory: 'downloads', files: [['A.mkv', 10]] },
      { n: 2, directory: 'downloads', files: [['B.mkv', 10]] },
      { n: 7, directory: 'downloads', files: [], size: 0 },
    ]);
    await link(world.at('downloads', 'A.mkv'), world.at('library', 'Show', 'e1.mkv'));
    await writeFile(world.at('library', 'Show', 'e3.mkv'), Buffer.alloc(30));
    const library = [1, 3].map((n) => ({ path: world.at('library', 'Show', `e${n}.mkv`), fileId: n }));
    assert.deepEqual(states(await world.mapFiles(library, 'sonarr', 5)), [['linked', [hashOf(1)]], ['none', []]]);
    assert.deepEqual(world.canRemoveTorrent(hashOf(2)), { allowed: true });

    Object.assign(world.fake.torrents[2], { size: 10, files: [['B.mkv', 10]] });
    const refused = await world.removeTorrent(hashOf(2));
    assert.equal(refused.removed, false);
    assert.match(refused.reason, /B\.mkv is also used by the torrent T7/);
    assert.deepEqual(world.fake.erased, []);
    assert.equal(await exists(world.at('downloads', 'B.mkv')), true);

    await world.poller.poll();
    assert.equal(world.database.prepare('SELECT COUNT(*) AS n FROM torrent_files WHERE hash = ?').get(hashOf(7)).n, 1);
    assert.match(world.canRemoveTorrent(hashOf(2)).reason, /B\.mkv is also used by the torrent T7/);
  });

  // Mapping a pack's files to separate torrents, or losing which library file shares each inode, turns this red.
  await t.test('a season pack is one torrent holding all three library files', async () => {
    const world = await setup([{ n: 4, directory: 'downloads/Pack', multi: true, files: [['e1.mkv', 1], ['Sub/e2.mkv', 2], ['e3.mkv', 3]] }]);
    const library = [];
    for (const [index, path] of ['e1.mkv', 'Sub/e2.mkv', 'e3.mkv'].entries()) {
      library.push({ path: world.at('library', 'Show', `S01E0${index + 1}.mkv`), fileId: index + 1 });
      await link(world.at('downloads/Pack', path), library[index].path);
    }
    const mapping = await world.mapFiles(library, 'sonarr', 5);
    assert.deepEqual(states(mapping), [1, 2, 3].map(() => ['linked', [hashOf(4)]]));
    assert.deepEqual(mapping.torrents.map((torrent) => torrent.files.map((file) => [file.path, file.libraryPaths])),
      [[[world.at('downloads/Pack/e1.mkv'), [library[0].path]], [world.at('downloads/Pack/Sub/e2.mkv'), [library[1].path]],
        [world.at('downloads/Pack/e3.mkv'), [library[2].path]]]]);
  });

  // Keeping a gone torrent's file list, or trusting an import record for a torrent rTorrent no longer has, turns this red.
  await t.test('a torrent gone from rTorrent holds nothing', async () => {
    const world = await setup([
      { n: 1, directory: 'downloads', files: [['A.mkv', 10]] },
      { n: 2, directory: 'downloads', files: [['B.mkv', 20]] },
    ]);
    await link(world.at('downloads', 'A.mkv'), world.at('library', 'Show', 'e1.mkv'));
    await writeFile(world.at('library', 'Show', 'e2.mkv'), Buffer.alloc(20));
    world.arrFake.sonarr.state.history.push(imported(hashOf(2), 2));
    world.fake.torrents = [];
    await world.poller.poll();
    const mapping = await world.mapFiles([1, 2].map((n) => ({ path: world.at('library', 'Show', `e${n}.mkv`), fileId: n })), 'sonarr', 5);
    assert.deepEqual(states(mapping), [['none', []], ['none', []]]);
    assert.equal(world.database.prepare('SELECT COUNT(*) AS n FROM torrent_files').get().n, 0);
  });

  // Dropping any of the three checks, or erasing in rTorrent after a refusal, turns this red.
  await t.test('removal is refused for a kept library or versions inode, a path another torrent lists, and a path outside downloads', async () => {
    const world = await setup([
      { n: 1, directory: 'downloads', files: [['A.mkv', 10]] },
      { n: 2, directory: 'downloads', files: [['Shared.mkv', 10]] },
      { n: 3, directory: 'downloads', files: [['Shared.mkv', 10]] },
      { n: 5, directory: 'elsewhere', files: [['E.mkv', 10]] },
    ]);
    const kept = world.at('library', 'Show', 'e1.mkv');
    await link(world.at('downloads', 'A.mkv'), kept);
    assert.match(world.canRemoveTorrent(hashOf(1)).reason, /A\.mkv shares its data with the library file .*e1\.mkv/);
    assert.deepEqual(world.canRemoveTorrent(hashOf(1), { after: [kept] }), { allowed: true });
    await mkdir(world.at('versions'));
    await link(kept, world.at('versions', 'e1.2160p.mkv'));
    setSetting(world.database, 'hostPaths', 'versions.sonarr', world.at('versions'));
    assert.match(world.canRemoveTorrent(hashOf(1), { after: [kept] }).reason, /shares its data with the library file .*e1\.2160p\.mkv/);
    assert.match(world.canRemoveTorrent(hashOf(2)).reason, /Shared\.mkv is also used by the torrent T3/);
    assert.match(world.canRemoveTorrent(hashOf(5)).reason, /E\.mkv is outside every hostPaths downloads folder/);

    for (const n of [1, 2, 5]) assert.equal((await world.removeTorrent(hashOf(n))).removed, false);
    assert.deepEqual(world.fake.erased, []);
    for (const path of ['downloads/A.mkv', 'downloads/Shared.mkv', 'elsewhere/E.mkv']) assert.equal(await exists(world.at(path)), true);
  });

  // Walking the library inside every removal check instead of using the read it was given turns this red.
  await t.test('a plan reads the library once and every removal check uses that read', async () => {
    const world = await setup([{ n: 1, directory: 'downloads', files: [['A.mkv', 10]] }]);
    const kept = world.at('library', 'Show', 'e1.mkv');
    await link(world.at('downloads', 'A.mkv'), kept);
    assert.deepEqual(world.canRemoveTorrent(hashOf(1), { after: [], library: { inodes: new Map(), blocked: null } }), { allowed: true });
    const blocked = 'x links to a folder, so the files under it cannot be checked.';
    assert.deepEqual(world.canRemoveTorrent(hashOf(1), { after: [], library: { inodes: new Map(), blocked } }), { allowed: false, reason: blocked });
    const library = world.readLibraryInodes([]);
    const stats = await stat(kept, { bigint: true });
    assert.equal(library.inodes.get(`${stats.dev}:${stats.ino}`), kept);
    assert.equal(library.blocked, null);
  });

  // Removing a single-file torrent's folder, or a file the torrent does not list, turns this red.
  await t.test('removing a single-file torrent deletes its file and leaves the shared folder and its other files', async () => {
    const world = await setup([
      { n: 1, directory: 'downloads', files: [['A.mkv', 10]] },
      { n: 2, directory: 'downloads', files: [['B.mkv', 10]] },
    ]);
    assert.deepEqual(await world.removeTorrent(hashOf(1)), { removed: true, deleted: [world.at('downloads', 'A.mkv')], left: [] });
    assert.deepEqual(await readdir(world.at('downloads')), ['B.mkv']);
    await world.poller.poll();
    assert.equal((await world.removeTorrent(hashOf(2))).removed, true);
    assert.deepEqual(await readdir(world.at('downloads')), []);
    assert.deepEqual(world.fake.erased, [hashOf(1), hashOf(2)]);
  });

  // Removing a folder above the torrent's own, or one still holding a file the torrent does not list, turns this red.
  await t.test('removing a multi-file torrent deletes its files and its own emptied folders only', async () => {
    const world = await setup([
      { n: 4, directory: 'downloads/Pack', multi: true, files: [['e1.mkv', 1], ['Sub/e2.mkv', 2]] },
      { n: 6, directory: 'downloads/Pack2', multi: true, files: [['Sub/x.mkv', 1]] },
      { n: 1, directory: 'downloads', files: [['A.mkv', 10]] },
    ]);
    await writeFile(world.at('downloads', 'Pack2', 'notes.nfo'), 'kept');
    assert.deepEqual((await world.removeTorrent(hashOf(4))).deleted, [world.at('downloads/Pack/e1.mkv'), world.at('downloads/Pack/Sub/e2.mkv')]);
    assert.equal((await world.removeTorrent(hashOf(6))).removed, true);
    assert.deepEqual((await readdir(world.at('downloads'))).sort(), ['A.mkv', 'Pack2']);
    assert.deepEqual(await readdir(world.at('downloads', 'Pack2')), ['notes.nfo']);
  });

  // Deleting files before rTorrent confirms the erase turns this red.
  await t.test('a failed erase in rTorrent deletes nothing', async () => {
    const world = await setup([{ n: 1, directory: 'downloads', files: [['A.mkv', 10]] }]);
    world.fake.eraseFails = true;
    const result = await world.removeTorrent(hashOf(1));
    assert.equal(result.removed, false);
    assert.match(result.reason, /did not remove the torrent .*busy.*no files were deleted/);
    assert.equal(await exists(world.at('downloads', 'A.mkv')), true);
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

  // Dropping the backlog filter, or seeding the backlog on every run, turns this red; so does a second search before Sonarr updates its last-search time, searching a queued or protected manual download, or searching while Sonarr is down.
  await t.test('the first run records the backlog without searching, then each new due item is searched once, skipping queued and manual ones and pausing with the service', async () => {
    const database = openDatabase(join(root, 'scheduler', 'media-manager.sqlite'));
    const events = createEventHub();
    const clock = { value: Date.parse('2026-10-08T20:00:00Z') };
    const now = () => clock.value;
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
    const { fake, ...arr } = connectArr(database);
    fake.sonarr.routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/wanted/missing'
      ? { status: 200, body: { totalRecords: episodes.length, records: episodes } } : undefined));
    fake.radarr.state.movies = movies;
    const commands = () => [...fake.sonarr.state.commands.map((c) => ['sonarr', c]), ...fake.radarr.state.commands.map((c) => ['radarr', c])];
    database.prepare(`INSERT INTO arr_queue (service, queue_id, download_id, movie_id, series_id, episode_id, title, status, tracked_status,
      tracked_state, status_messages, error_message, indexer, protocol, quality, formats, format_score, size_bytes, size_left_bytes)
      VALUES ('sonarr', 1, NULL, NULL, 1, 3, 'x', 'delay', 'ok', 'downloading', '[]', '', '', 'torrent', '', '[]', 0, 0, 0)`).run();
    const problems = createProblems({ database, events, now });
    database.prepare("INSERT INTO protected_items (service, item_id, series_id, season_number, episode_number, created_at) VALUES ('sonarr', 4, 1, 1, 4, 0)").run();
    const scheduler = createSearchScheduler({ database, arr, problems, now, isManualDownload: createProtection(database, arr).isProtected });

    const backlog = () => database.prepare('SELECT subject FROM search_backlog ORDER BY subject').all().map((entry) => entry.subject);

    await scheduler.check();
    assert.deepEqual(commands(), []);
    assert.deepEqual(backlog(), ['radarr:movie:7', 'sonarr:episode:1', 'sonarr:episode:2', 'sonarr:episode:3', 'sonarr:episode:4']);
    assert.equal(database.prepare("SELECT value FROM preferences WHERE key = 'searches.baselineAt'").get()?.value, String(clock.value));

    episodes.push({ id: 5, monitored: true, hasFile: false, airDateUtc: '2026-10-08T20:30:00Z', seasonNumber: 1, episodeNumber: 5, series: { title: 'Show', added: '2025-01-01T00:00:00Z' } });
    clock.value = Date.parse('2026-10-08T20:30:00Z');
    await scheduler.check();
    assert.deepEqual(commands(), [['sonarr', { name: 'EpisodeSearch', episodeIds: [5] }]]);
    assert.equal(subjectHistory(database, { type: 'episode', service: 'sonarr', id: '5' })[0].state, 'resolved');

    clock.value += 2 * minute;
    await scheduler.check();
    assert.equal(commands().length, 1);

    // The owner clearing backlog rows by hand still leaves queued (3) and protected manual (4) episodes alone.
    database.prepare("DELETE FROM search_backlog WHERE subject IN ('sonarr:episode:3', 'sonarr:episode:4')").run();
    clock.value = Date.parse('2026-10-09T02:30:00Z');
    await scheduler.check();
    assert.deepEqual(commands(), [['sonarr', { name: 'EpisodeSearch', episodeIds: [5] }], ['sonarr', { name: 'EpisodeSearch', episodeIds: [5] }]]);

    writeDependency(database, events, 'sonarr', 'down', 0, 'Sonarr is unreachable.');
    clock.value = Date.parse('2026-10-09T08:30:00Z');
    await scheduler.check();
    assert.equal(commands().length, 2);
    database.close();
  });

  // Sending an EpisodeSearch for a finished season with several missing episodes, a SeasonSearch for an airing season or a single missing episode, or two SeasonSearches in a row for the same season (including by comparing against Sonarr's later lastSearchTime) turns this red.
  await t.test('an aired season with several missing episodes gets a season search, then an episode search for what is left, then a season search again', async () => {
    const database = openDatabase(join(root, 'season-search', 'media-manager.sqlite'));
    const events = createEventHub();
    const clock = { value: Date.parse('2026-10-08T20:00:00Z') };
    const now = () => clock.value;
    const aired = (id, seriesId, seasonNumber, day) => ({ id, seriesId, seasonNumber, episodeNumber: id, monitored: true, hasFile: false, airDateUtc: `2026-09-0${day}T00:00:00Z`, series: { title: `Show ${seriesId}`, added: '2025-01-01T00:00:00Z', seriesType: 'standard' } });
    const episodes = [aired(11, 1, 1, 1), aired(12, 1, 1, 2), aired(13, 1, 1, 3), aired(21, 2, 1, 1), aired(22, 2, 1, 2), aired(31, 3, 2, 1)];
    const { fake, ...arr } = connectArr(database);
    fake.sonarr.routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/wanted/missing'
      ? { status: 200, body: { totalRecords: episodes.length, records: episodes } } : undefined));
    fake.sonarr.state.episodes = [
      ...episodes.map(({ id, seriesId, seasonNumber, airDateUtc }) => episodeRecord({ id, seriesId, seasonNumber, airDateUtc })),
      episodeRecord({ id: 23, seriesId: 2, seasonNumber: 1, airDateUtc: new Date(clock.value + 7 * 24 * hour).toISOString() }),
    ];
    const commands = () => fake.sonarr.state.commands.map((c) => ['sonarr', c]);
    database.prepare("INSERT INTO preferences (key, value) VALUES ('searches.baselineAt', '0')").run();
    const problems = createProblems({ database, events, now });
    const scheduler = createSearchScheduler({ database, arr, problems, now, isManualDownload: () => false });
    const seasonLog = () => database.prepare('SELECT series_id, season_number, searched_at FROM season_search_log').all().map((row) => [row.series_id, row.season_number, row.searched_at]);
    const season = ['sonarr', { name: 'SeasonSearch', seriesId: 1, seasonNumber: 1 }];
    // Sonarr stamps lastSearchTime a few seconds after our own record, when it runs the command.
    const sonarrStamps = (ids) => {
      for (const episode of episodes) if (ids.includes(episode.id)) episode.lastSearchTime = new Date(clock.value + 5000).toISOString();
    };

    await scheduler.check();
    const first = clock.value;
    assert.deepEqual(commands(), [season, ['sonarr', { name: 'EpisodeSearch', episodeIds: [21, 22, 31] }]]);
    for (const id of [11, 12, 13]) assert.equal(database.prepare('SELECT searched_at FROM search_log WHERE subject = ?').get(`sonarr:episode:${id}`)?.searched_at, first);
    assert.deepEqual(seasonLog(), [[1, 1, first]]);
    sonarrStamps([11, 12, 13, 21, 22, 31]);

    episodes.splice(episodes.findIndex((episode) => episode.id === 13), 1);
    clock.value += 6 * hour + minute;
    await scheduler.check();
    assert.deepEqual(commands().slice(2), [['sonarr', { name: 'EpisodeSearch', episodeIds: [11, 12, 21, 22, 31] }]]);
    assert.deepEqual(seasonLog(), [[1, 1, first]]);
    sonarrStamps([11, 12, 21, 22, 31]);

    clock.value += 6 * hour + minute;
    await scheduler.check();
    assert.deepEqual(commands().slice(3), [season, ['sonarr', { name: 'EpisodeSearch', episodeIds: [21, 22, 31] }]]);
    assert.deepEqual(seasonLog(), [[1, 1, clock.value]]);
    database.close();
  });

  // Grouping a season into a SeasonSearch even though one of its missing episodes was skipped for being queued or a manual download turns this red.
  await t.test('an aired season with a queued missing episode gets an episode search for the rest, not a season search', async () => {
    const database = openDatabase(join(root, 'season-search-queued', 'media-manager.sqlite'));
    const events = createEventHub();
    const clock = { value: Date.parse('2026-10-08T20:00:00Z') };
    const now = () => clock.value;
    const aired = (id, day) => ({ id, seriesId: 1, seasonNumber: 1, episodeNumber: id, monitored: true, hasFile: false, airDateUtc: `2026-09-0${day}T00:00:00Z`, series: { title: 'Show 1', added: '2025-01-01T00:00:00Z', seriesType: 'standard' } });
    const episodes = [aired(11, 1), aired(12, 2), aired(13, 3)];
    const { fake, ...arr } = connectArr(database);
    fake.sonarr.routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/wanted/missing'
      ? { status: 200, body: { totalRecords: episodes.length, records: episodes } } : undefined));
    fake.sonarr.state.episodes = episodes.map(({ id, seriesId, seasonNumber, airDateUtc }) => episodeRecord({ id, seriesId, seasonNumber, airDateUtc }));
    database.prepare(`INSERT INTO arr_queue (service, queue_id, download_id, movie_id, series_id, episode_id, title, status, tracked_status,
      tracked_state, status_messages, error_message, indexer, protocol, quality, formats, format_score, size_bytes, size_left_bytes)
      VALUES ('sonarr', 1, NULL, NULL, 1, 13, 'x', 'downloading', 'ok', 'downloading', '[]', '', '', 'torrent', '', '[]', 0, 0, 0)`).run();
    database.prepare("INSERT INTO preferences (key, value) VALUES ('searches.baselineAt', '0')").run();
    const problems = createProblems({ database, events, now });
    const scheduler = createSearchScheduler({ database, arr, problems, now, isManualDownload: () => false });

    await scheduler.check();
    assert.deepEqual(fake.sonarr.state.commands, [{ name: 'EpisodeSearch', episodeIds: [11, 12] }]);
    assert.deepEqual(database.prepare('SELECT * FROM season_search_log').all(), []);
    database.close();
  });

  // Searching newly monitored episodes before the rest of their season is due, or treating the season as not last searched whole once all are due, turns this red.
  await t.test('newly monitored episodes of a season searched whole an hour ago wait, then get one episode search with the rest', async () => {
    const database = openDatabase(join(root, 'season-search-new-episodes', 'media-manager.sqlite'));
    const events = createEventHub();
    const clock = { value: Date.parse('2026-10-08T20:00:00Z') };
    const now = () => clock.value;
    const aired = (id) => ({ id, seriesId: 1, seasonNumber: 1, episodeNumber: id, monitored: true, hasFile: false, airDateUtc: '2026-09-01T00:00:00Z', series: { title: 'Show 1', added: '2025-01-01T00:00:00Z', seriesType: 'standard' } });
    const episodes = [aired(13), aired(14)];
    const { fake, ...arr } = connectArr(database);
    fake.sonarr.routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/wanted/missing'
      ? { status: 200, body: { totalRecords: episodes.length, records: episodes } } : undefined));
    fake.sonarr.state.episodes = [11, 12, 13, 14].map((id) => episodeRecord({ id, seriesId: 1, seasonNumber: 1, airDateUtc: '2026-09-01T00:00:00Z' }));
    database.prepare("INSERT INTO preferences (key, value) VALUES ('searches.baselineAt', '0')").run();
    const problems = createProblems({ database, events, now });
    const scheduler = createSearchScheduler({ database, arr, problems, now, isManualDownload: () => false });

    await scheduler.check();
    const first = clock.value;
    assert.deepEqual(fake.sonarr.state.commands, [{ name: 'SeasonSearch', seriesId: 1, seasonNumber: 1 }]);
    episodes.unshift(aired(11), aired(12));
    const seasonLog = () => database.prepare('SELECT series_id, season_number, searched_at FROM season_search_log').all().map((row) => [row.series_id, row.season_number, row.searched_at]);
    clock.value += hour;
    await scheduler.check();
    assert.equal(fake.sonarr.state.commands.length, 1);
    assert.deepEqual(seasonLog(), [[1, 1, first]]);
    clock.value = first + 6 * hour + minute;
    await scheduler.check();
    assert.deepEqual(fake.sonarr.state.commands.slice(1), [{ name: 'EpisodeSearch', episodeIds: [11, 12, 13, 14] }]);
    assert.deepEqual(seasonLog(), [[1, 1, first]]);
    database.close();
  });

  // Searching a finished season's due episodes while another of its missing episodes is not yet due (by a season search or one by one) turns this red.
  await t.test('a season with one episode searched by hand an hour ago waits until that episode is due, then gets one season search', async () => {
    const database = openDatabase(join(root, 'season-search-by-hand', 'media-manager.sqlite'));
    const events = createEventHub();
    const clock = { value: Date.parse('2026-10-08T20:00:00Z') };
    const now = () => clock.value;
    const aired = (id, day) => ({ id, seriesId: 1, seasonNumber: 1, episodeNumber: id, monitored: true, hasFile: false, airDateUtc: `2026-09-0${day}T00:00:00Z`, series: { title: 'Show 1', added: '2025-01-01T00:00:00Z', seriesType: 'standard' } });
    const episodes = [aired(11, 1), aired(12, 2), aired(13, 3)];
    const { fake, ...arr } = connectArr(database);
    fake.sonarr.routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/wanted/missing'
      ? { status: 200, body: { totalRecords: episodes.length, records: episodes } } : undefined));
    fake.sonarr.state.episodes = episodes.map(({ id, seriesId, seasonNumber, airDateUtc }) => episodeRecord({ id, seriesId, seasonNumber, airDateUtc }));
    database.prepare('INSERT INTO search_log (subject, searched_at) VALUES (?, ?)').run('sonarr:episode:13', clock.value - hour);
    database.prepare("INSERT INTO preferences (key, value) VALUES ('searches.baselineAt', '0')").run();
    const problems = createProblems({ database, events, now });
    const scheduler = createSearchScheduler({ database, arr, problems, now, isManualDownload: () => false });

    await scheduler.check();
    assert.deepEqual(fake.sonarr.state.commands, []);
    clock.value += 5 * hour + minute;
    await scheduler.check();
    assert.deepEqual(fake.sonarr.state.commands, [{ name: 'SeasonSearch', seriesId: 1, seasonNumber: 1 }]);
    for (const id of [11, 12, 13]) assert.equal(database.prepare('SELECT searched_at FROM search_log WHERE subject = ?').get(`sonarr:episode:${id}`)?.searched_at, clock.value);
    database.close();
  });

  // Leaving a season with an episode skipped for being in search_backlog open to a SeasonSearch turns this red.
  await t.test('an aired season with a missing episode in the search backlog gets an episode search for the rest, not a season search', async () => {
    const database = openDatabase(join(root, 'season-search-backlog', 'media-manager.sqlite'));
    const events = createEventHub();
    const clock = { value: Date.parse('2026-10-08T20:00:00Z') };
    const now = () => clock.value;
    const aired = (id, day) => ({ id, seriesId: 1, seasonNumber: 1, episodeNumber: id, monitored: true, hasFile: false, airDateUtc: `2026-09-0${day}T00:00:00Z`, series: { title: 'Show 1', added: '2025-01-01T00:00:00Z', seriesType: 'standard' } });
    const episodes = [aired(11, 1), aired(12, 2), aired(13, 3)];
    const { fake, ...arr } = connectArr(database);
    fake.sonarr.routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/wanted/missing'
      ? { status: 200, body: { totalRecords: episodes.length, records: episodes } } : undefined));
    fake.sonarr.state.episodes = episodes.map(({ id, seriesId, seasonNumber, airDateUtc }) => episodeRecord({ id, seriesId, seasonNumber, airDateUtc }));
    database.prepare('INSERT INTO search_backlog (subject, seen_at) VALUES (?, ?)').run('sonarr:episode:13', 0);
    database.prepare("INSERT INTO preferences (key, value) VALUES ('searches.baselineAt', '0')").run();
    const problems = createProblems({ database, events, now });
    const scheduler = createSearchScheduler({ database, arr, problems, now, isManualDownload: () => false });

    await scheduler.check();
    assert.deepEqual(fake.sonarr.state.commands, [{ name: 'EpisodeSearch', episodeIds: [11, 12] }]);
    assert.deepEqual(database.prepare('SELECT * FROM season_search_log').all(), []);
    database.close();
  });

  // Grouping missing episodes into a SeasonSearch without checking that the series type is standard turns this red.
  await t.test('an aired anime season with three missing episodes gets one episode search, not a season search', async () => {
    const database = openDatabase(join(root, 'season-search-anime', 'media-manager.sqlite'));
    const events = createEventHub();
    const clock = { value: Date.parse('2026-10-08T20:00:00Z') };
    const now = () => clock.value;
    const aired = (id, day) => ({ id, seriesId: 1, seasonNumber: 1, episodeNumber: id, monitored: true, hasFile: false, airDateUtc: `2026-09-0${day}T00:00:00Z`, series: { title: 'Show 1', added: '2025-01-01T00:00:00Z', seriesType: 'anime' } });
    const episodes = [aired(11, 1), aired(12, 2), aired(13, 3)];
    const { fake, ...arr } = connectArr(database);
    fake.sonarr.routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/wanted/missing'
      ? { status: 200, body: { totalRecords: episodes.length, records: episodes } } : undefined));
    fake.sonarr.state.episodes = episodes.map(({ id, seriesId, seasonNumber, airDateUtc }) => episodeRecord({ id, seriesId, seasonNumber, airDateUtc }));
    database.prepare("INSERT INTO preferences (key, value) VALUES ('searches.baselineAt', '0')").run();
    const problems = createProblems({ database, events, now });
    const scheduler = createSearchScheduler({ database, arr, problems, now, isManualDownload: () => false });

    await scheduler.check();
    assert.deepEqual(fake.sonarr.state.commands, [{ name: 'EpisodeSearch', episodeIds: [11, 12, 13] }]);
    assert.deepEqual(database.prepare('SELECT * FROM season_search_log').all(), []);
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
    const queue = [{
      id: 9, downloadId: hash, ...(movie ? { movieId: 7 } : { seriesId: 3, episodeId: 31 }), title: 'Release.Title',
      status: 'completed', trackedDownloadStatus: 'warning', trackedDownloadState: 'importBlocked',
      statusMessages: [{ title: 'Release.Title.mkv', messages: [message] }],
    }];
    const { fake, ...arr } = connectArr(database);
    const { state } = fake[movie ? 'radarr' : 'sonarr'];
    state.queue = queue;
    state.manualImport[hash] = files;
    const grabs = createGrabTracker({ database, arr, events, now });
    grabs.recordGrab({ hash, service: movie ? 'radarr' : 'sonarr', movieId: movie ? 7 : null, seriesId: movie ? null : 3, episodeIds: movie ? [] : [31, 32],
      releaseTitle: 'Release.Title', indexer: 'Blutopia', grabbedAt: clock.value, publishedAt: null, byHand });
    await grabs.reconcile();
    const problems = createProblems({ database, events, now });
    const fix = createImportFix({ database, arr, problems, events, now });
    const writes = () => [...state.removals, ...state.commands];
    return { database, clock, fix, writes, fake, problems, queue, grabs };
  };

  // Touching rTorrent from the queue, importing a not-better automatic grab, or handling a replace's own import here turns this red.
  await t.test('leftovers and not-better automatic grabs leave the queue with rTorrent untouched; a replace is left alone', async () => {
    for (const message of ['Episode file already imported', 'Not an upgrade for existing episode file(s)']) {
      const run = await setup({ message });
      await run.fix.check();
      assert.deepEqual(run.fake.sonarr.state.removals, [{ queueId: 9, removeFromClient: false, blocklist: false, skipRedownload: true }]);
      assert.deepEqual(run.fake.sonarr.state.commands, []);
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

  // Importing a file onto an episode outside the grab record, or forcing in a file Sonarr rejected as a sample, turns this red.
  await t.test('matching doubts are forced only onto what was grabbed', async () => {
    const good = await setup({ message: 'Series title mismatch, automatic import is not possible.', files: [
      { path: '/files/Sonarr/a.mkv', quality: { quality: { id: 3 } }, languages: [], episodes: [{ id: 31 }] },
      { path: '/files/Sonarr/b.mkv', quality: { quality: { id: 3 } }, languages: [], episodes: [{ id: 32 }] },
      { path: '/files/Sonarr/a.sample.mkv', quality: { quality: { id: 3 } }, languages: [], episodes: [{ id: 31 }], rejections: [{ reason: 'Sample', type: 'permanent' }] },
    ] });
    await good.fix.check();
    const [command] = good.fake.sonarr.state.commands;
    assert.equal(command.name, 'ManualImport');
    assert.equal(command.importMode, 'copy');
    assert.deepEqual(command.files.map((file) => [file.path, file.episodeIds]), [['/files/Sonarr/a.mkv', [31]], ['/files/Sonarr/b.mkv', [32]]]);
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
    assert.deepEqual(first.writes(), [{ queueId: 9, removeFromClient: false, blocklist: true, skipRedownload: false }]);
    first.database.close();

    const third = await setup({ message: 'No audio tracks detected', movie: true });
    third.problems.recordReleaseAttempt({ type: 'movie', service: 'radarr', id: '7' }, 'one');
    third.problems.recordReleaseAttempt({ type: 'movie', service: 'radarr', id: '7' }, 'two');
    await third.fix.check();
    assert.deepEqual(third.writes(), [{ queueId: 9, removeFromClient: false, blocklist: true, skipRedownload: true }]);
    assert.equal(listOpenProblems(third.database)[0].state, 'needs_you');
    third.database.close();
  });

  // Ignoring removeFromQueue's removed count, or treating 0 as a block, turns this red.
  await t.test('a bad release the live queue no longer lists is flagged, not reported as blocked', async () => {
    const run = await setup({ message: 'No audio tracks detected', movie: true });
    run.fake.radarr.state.queue = [];
    await run.fix.check();
    const problem = listOpenProblems(run.database).find((item) => item.kind === 'import_fix_failed');
    assert.equal(problem.state, 'needs_you');
    assert.match(problem.steps.at(-1).text, /was not blocked/);
    assert.deepEqual(run.fake.radarr.state.removals, []);
    assert.deepEqual(run.fake.radarr.state.commands, []);
    // Leaving the failed fix out of the sweep keeps both problems open after the download has left the queue.
    await run.grabs.reconcile();
    await run.fix.check();
    assert.deepEqual(listOpenProblems(run.database), []);
    run.database.close();
  });

  // Sending the removal again on every check after Sonarr refuses it, instead of backing off, turns this red.
  await t.test('a queue removal Sonarr refuses is retried after 15 minutes, then after twice as long each time', async () => {
    const run = await setup({ message: 'Episode file already imported' });
    run.fake.sonarr.routes.push((method, url) => (method === 'DELETE' && url.pathname.startsWith('/api/v3/queue/')
      ? { status: 500, body: { message: 'Object reference not set to an instance of an object.' } }
      : undefined));
    const deletes = () => run.fake.sonarr.requests.filter((request) => request.method === 'DELETE').length;
    const tries = [];
    for (let elapsed = 0; elapsed <= 50; elapsed += 1) {
      const before = deletes();
      await run.fix.check();
      if (deletes() > before) tries.push(elapsed);
      run.clock.value += minute;
    }
    assert.deepEqual(tries, [0, 15, 45]);
    const problem = listOpenProblems(run.database).find((item) => item.kind === 'import_fix_failed');
    assert.equal(problem.state, 'needs_you');
    assert.match(problem.steps.at(-1).text, /^Tried again/);
    run.database.close();
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

  // Sweeping only unfinished rows leaves a problem handed to the owner open forever after its download leaves the queue;
  // closing it while the other service still lists the download hides a live block.
  await t.test('a problem handed to the owner resolves once neither queue lists its download', async () => {
    const run = await setup({ message: 'Something new' });
    await run.fix.check();
    const [handed] = listOpenProblems(run.database);
    assert.equal(handed.state, 'needs_you');
    run.fake.radarr.state.queue = [{ ...run.queue[0], movieId: 7 }];
    run.queue.length = 0;
    await run.grabs.reconcile();
    await run.fix.check();
    assert.deepEqual(listOpenProblems(run.database).map((problem) => problem.id), [handed.id]);
    run.fake.radarr.state.queue = [];
    await run.grabs.reconcile();
    await run.fix.check();
    assert.deepEqual(listOpenProblems(run.database), []);
    run.database.close();
  });

  // Resolving only the problem named by the latest block kind leaves the first one open when a locked file then fails to move;
  // matching on anything wider than this download's import problems closes another download's or a stall's.
  await t.test('a block that changes kind before clearing resolves every import problem on the download, and only those', async () => {
    const run = await setup({ message: 'File is locked by another process' });
    const other = 'FF'.repeat(20);
    run.problems.open({ kind: 'import_temporary', subject: { type: 'torrent', service: null, id: other }, hash: other, summary: 'Other.Release' });
    run.problems.open({ kind: 'stalled', subject: { type: 'torrent', service: null, id: hash }, hash, summary: 'Release.Title' });
    await run.fix.check();
    run.queue[0].statusMessages = [{ title: 'Release.Title.mkv', messages: ['Failed to move file'] }];
    await run.grabs.reconcile();
    run.clock.value += 5 * minute;
    await run.fix.check();
    assert.ok(listOpenProblems(run.database).length >= 3);
    run.queue.length = 0;
    await run.grabs.reconcile();
    await run.fix.check();
    assert.deepEqual(listOpenProblems(run.database).map((problem) => [problem.kind, problem.subject.id]), [['import_temporary', other], ['stalled', hash]]);
    run.database.close();
  });

  // Resolving only the problem of the latest block kind leaves the earlier one open forever once the download is finished with.
  await t.test('a fix that finishes a download resolves its earlier import problems, and a later working try resolves the failed fix', async () => {
    const run = await setup({ message: 'File is locked by another process' });
    run.fake.sonarr.state.down = true;
    await run.fix.check();
    assert.deepEqual(listOpenProblems(run.database).map((problem) => problem.kind).sort(), ['import_fix_failed', 'import_temporary']);
    run.fake.sonarr.state.down = false;
    run.clock.value += 15 * minute;
    await run.fix.check();
    assert.deepEqual(listOpenProblems(run.database).map((problem) => problem.kind), ['import_temporary']);
    run.queue[0].statusMessages = [{ title: 'Release.Title.mkv', messages: ['Episode file already imported'] }];
    await run.grabs.reconcile();
    await run.fix.check();
    assert.deepEqual(listOpenProblems(run.database), []);
    run.database.close();
  });

  // Resolving on Sonarr's acceptance alone, or sending the import again, hides an import that then fails inside Sonarr.
  await t.test('a forced import waits 30 minutes for the download to clear, then is flagged and never sent again', async () => {
    const files = [{ path: '/files/Sonarr/a.mkv', quality: { quality: { id: 3 } }, languages: [], episodes: [{ id: 31 }] }];
    const stuck = await setup({ message: 'Series title mismatch, automatic import is not possible.', files });
    await stuck.fix.check();
    assert.equal(listOpenProblems(stuck.database)[0].state, 'handling');
    stuck.clock.value += 29 * minute;
    await stuck.fix.check();
    assert.equal(listOpenProblems(stuck.database)[0].state, 'handling');
    stuck.clock.value += minute;
    await stuck.fix.check();
    const [flag] = listOpenProblems(stuck.database);
    assert.equal(flag.state, 'needs_you');
    assert.match(flag.steps.at(-1).text, /still blocked/);
    stuck.clock.value += 60 * minute;
    await stuck.fix.check();
    assert.equal(stuck.fake.sonarr.state.commands.length, 1);
    stuck.database.close();

    const cleared = await setup({ message: 'Series title mismatch, automatic import is not possible.', files });
    await cleared.fix.check();
    cleared.queue.length = 0;
    await cleared.grabs.reconcile();
    await cleared.fix.check();
    assert.deepEqual(listOpenProblems(cleared.database), []);
    cleared.database.close();
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
    'trackers.unreachable.invalid': `tracker-token-${pid}-distinctive`,
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

  // Switching to a source outside tmdb, trakt and fanart, or printing anything but the saved source, turns this red.
  assert.equal((await cli(['backdrop', 'source'])).stdout, 'backdrop source: tmdb\n');
  assert.equal((await cli(['backdrop', 'source', 'trakt'])).stdout, 'backdrop source: trakt\n');
  const unknownSource = await cli(['backdrop', 'source', 'nope']);
  assert.equal(unknownSource.code, 1);
  assert.match(unknownSource.stderr, /must be one of: tmdb, trakt, fanart/);
  assert.equal((await cli(['backdrop', 'source'])).stdout, 'backdrop source: trakt\n');
  assert.equal((await cli(['cache', 'clear'])).stdout, 'cache cleared\n');

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

  // One line per added tracker, by hostname: "other" software has no account connection, a tracker with no credential is
  // not configured, and a UNIT3D one at a name that never resolves (.invalid) is unreachable.
  for (const [category, key, value] of [
    ['trackerConfiguration', 'trackers.example.net', 'added'],
    ['trackerConfiguration', 'trackers.notset.example', 'added'], ['trackerConfiguration', 'software.notset.example', 'gazelle'],
    ['trackerConfiguration', 'trackers.unreachable.invalid', 'added'], ['trackerConfiguration', 'software.unreachable.invalid', 'unit3d'],
  ]) {
    const result = await cli(['settings', 'set', category, key], value);
    assert.equal(result.code, 0, result.stderr);
  }

  const rejected = await cli(['connections', 'check']);
  assert.equal(rejected.code, 1, rejected.stderr);
  assert.equal(rejected.stdout, 'sonarr: rejected\nradarr: rejected\nrtorrent: rejected\nplex: rejected\nexample.net: unsupported\nnotset.example: not_configured\nunreachable.invalid: unreachable\n');
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

// Routing an identifier to the wrong service, letting one failed service hide the other's results, sorting library matches after new ones, passing a service-local or full-size image URL to the browser, holding the faster service's results until the slower one answers, taking a library title's file count from its lookup record (Sonarr's says zero) or a stored answer, or caching a failed lookup or serving one past ten minutes breaks search.
test('one search routes to Sonarr and Radarr and reports each outcome', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { deleteSetting, setSetting } = await import(settingsModuleUrl);
  const { createSearch, LOOKUP_CACHE_MS, parseSearchQuery } = await import(searchModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
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
    { title: 'Dune: Prophecy', year: 2024, tvdbId: 1, network: 'HBO', status: 'continuing', ratings: { value: 7.4 }, overview: 'Sisters.', images: poster('https://artworks.thetvdb.com/banners/v4/series/1/posters/a.jpg') },
    { title: 'Dune', year: 2000, tvdbId: 2, id: 9, network: 'Sci Fi', status: 'ended', statistics: { episodeFileCount: 0 }, images: poster(`/MediaCover/2/poster.jpg?apikey=${sonarrKey}`) },
    { title: 'Dune', tvdbId: 2 },
    { title: '', tvdbId: 3 },
  ];
  const movies = [
    { title: 'Dune', year: 2021, tmdbId: 438631, imdbId: 'tt1160419', studio: 'Legendary', status: 'released', ratings: { imdb: { value: 8 }, tmdb: { value: 7.8 } }, images: poster('https://image.tmdb.org/t/p/original/dune.jpg') },
    { title: 'Dune', year: 1984, tmdbId: 841, id: 4, ratings: { tmdb: { value: 0 }, imdb: { value: 6.3 } } },
  ];
  const libraryCopy = database.prepare('INSERT OR REPLACE INTO titles (service, id, title, year, detail, fingerprint, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  libraryCopy.run('sonarr', 9, 'Dune', 2000, JSON.stringify({ id: 9, statistics: { episodeFileCount: 2 } }), 'x', 0);
  libraryCopy.run('radarr', 4, 'Dune', 1984, JSON.stringify({ id: 4, hasFile: false }), 'x', 0);
  const { fake, ...services } = connectArr(database, { sonarr: { apiKey: sonarrKey }, radarr: { apiKey: radarrKey } });
  const calls = () => ['sonarr', 'radarr'].flatMap((service) => fake[service].requests.map(({ path, params }) => [service, path, params.get('term')]));
  const clearCalls = () => {
    fake.sonarr.requests.length = 0;
    fake.radarr.requests.length = 0;
  };
  const clock = { value: 1_800_000_000_000 };
  const search = createSearch(database, services, createTitleStore(database, { now: () => clock.value }));
  const lookUp = async (text) => {
    clearCalls();
    return search.search(parseSearchQuery(text));
  };
  // Every run below starts past the lookup cache, so each one reaches the services.
  const run = async (text) => {
    clock.value += LOOKUP_CACHE_MS + 1;
    return lookUp(text);
  };

  fake.sonarr.state.lookup = shows;
  fake.radarr.state.lookup = movies;
  const both = await run('  Dune ');
  assert.deepEqual(calls(), [
    ['sonarr', '/api/v3/series/lookup', 'Dune'],
    ['radarr', '/api/v3/movie/lookup', 'Dune'],
  ]);
  assert.deepEqual(both.services, { sonarr: { kind: 'ok', count: 2 }, radarr: { kind: 'ok', count: 2 } });
  assert.deepEqual(both.results.map((result) => [result.key, result.inLibrary]), [
    ['tvdb:2', true], ['tmdb:841', true], ['tvdb:1', false], ['tmdb:438631', false],
  ]);
  const [libraryShow, libraryMovie, show, movie] = both.results;
  assert.deepEqual(show, {
    type: 'tv', service: 'sonarr', key: 'tvdb:1', title: 'Dune: Prophecy', year: 2024, network: 'HBO', status: 'continuing',
    rating: 7.4, overview: 'Sisters.', posterUrl: 'https://artworks.thetvdb.com/banners/v4/series/1/posters/a_t.jpg', inLibrary: false, libraryId: null,
    files: null, tvdbId: 1, tmdbId: null, imdbId: null,
  });
  assert.equal(libraryShow.libraryId, 9);
  assert.deepEqual([libraryShow.files, libraryMovie.files, movie.files], [2, 0, null]);
  assert.equal(libraryShow.posterUrl, null);
  assert.equal(movie.network, 'Legendary');
  assert.equal(movie.posterUrl, 'https://image.tmdb.org/t/p/w185/dune.jpg');
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
    assert.deepEqual(calls().map(([service, , term]) => [service, term]), expected, text);
    if (expected.length === 1) assert.deepEqual(result.services[expected[0][0] === 'sonarr' ? 'radarr' : 'sonarr'], { kind: 'skipped' }, text);
  }

  for (const [label, answer, kind] of [
    ['401', { status: 401, body: '' }, 'rejected'],
    ['network failure', undefined, 'unreachable'],
    ['500', { status: 500, body: '' }, 'unreachable'],
    ['not a list', { status: 200, body: { title: 'Dune' } }, 'unreachable'],
  ]) {
    if (answer === undefined) fake.sonarr.state.down = true;
    else fake.sonarr.routes.push(() => answer);
    const partial = await run('Dune');
    if (answer === undefined) fake.sonarr.state.down = false;
    else fake.sonarr.routes.pop();
    assert.deepEqual(partial.services, { sonarr: { kind }, radarr: { kind: 'ok', count: 2 } }, label);
    assert.deepEqual(partial.results.map((result) => result.service), ['radarr', 'radarr'], label);
  }

  // Radarr's results go out while Sonarr is still answering; the full answer follows. A partial with no results is not sent.
  for (const [label, movieLookup, expectedPartial] of [['radarr first', movies, [['tmdb:841', true], ['tmdb:438631', false]]], ['radarr empty', [], undefined]]) {
    fake.radarr.state.lookup = movieLookup;
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    fake.sonarr.routes.push(async (method, url) => (url.pathname === '/api/v3/series/lookup' ? held : undefined));
    clock.value += LOOKUP_CACHE_MS + 1;
    const partials = [];
    const answer = search.search(parseSearchQuery('Dune'), (partial) => partials.push(structuredClone(partial)));
    for (let turn = 0; turn < 100 && partials.length === 0; turn += 1) await drain();
    assert.deepEqual(partials.map((partial) => [partial.services.sonarr, partial.results.map((result) => [result.key, result.inLibrary])]),
      expectedPartial === undefined ? [] : [[{ kind: 'pending' }, expectedPartial]], label);
    fake.sonarr.routes.pop();
    release(undefined);
    const final = await answer;
    assert.deepEqual(final.services.sonarr, { kind: 'ok', count: 2 }, label);
    assert.equal(partials.length, expectedPartial === undefined ? 0 : 1, label);
    clearCalls();
  }

  fake.sonarr.state.lookup = [];
  fake.radarr.state.lookup = [];
  assert.deepEqual(await run('zzzz'), { results: [], services: { sonarr: { kind: 'ok', count: 0 }, radarr: { kind: 'ok', count: 0 } } });
  fake.sonarr.state.lookup = shows;
  fake.radarr.state.lookup = movies;

  deleteSetting(database, 'credentials', 'radarr.apiKey');
  assert.deepEqual((await run('Dune')).services.radarr, { kind: 'not_configured' });
  assert.equal(fake.radarr.requests.length, 0, 'unconfigured Radarr was called');
  configure();

  for (const text of ['', '   ', 'x'.repeat(201)]) assert.equal(parseSearchQuery(text), undefined, JSON.stringify(text));

  const first = await run('Dune');
  const cached = await lookUp('Dune');
  assert.equal(calls().length, 0);
  assert.deepEqual(cached, first);
  libraryCopy.run('radarr', 4, 'Dune', 1984, JSON.stringify({ id: 4, hasFile: true }), 'x', 0);
  assert.equal((await lookUp('Dune')).results.find((result) => result.key === 'tmdb:841').files, 1);
  assert.equal(calls().length, 0);
  clock.value += LOOKUP_CACHE_MS - 1;
  await lookUp('Dune');
  assert.equal(calls().length, 0);
  clock.value += 1;
  await lookUp('Dune');
  assert.deepEqual(calls().map(([service]) => service), ['sonarr', 'radarr']);
  // Making forget a no-op, or dropping the other service's entries too, turns this red.
  search.forget('sonarr');
  await lookUp('Dune');
  assert.deepEqual(calls().map(([service]) => service), ['sonarr']);

  fake.sonarr.routes.push(() => ({ status: 500, body: '' }));
  await run('Dune');
  const failedFirst = calls().map(([service]) => service);
  await lookUp('Dune');
  assert.deepEqual([...failedFirst, ...calls().map(([service]) => service)], ['sonarr', 'radarr', 'sonarr']);
});

// Sending the owner's choices under the wrong fields, dropping the lookup record, keeping a `none` show monitored when new seasons are off, losing the per-season flags, forgetting the last profile and folder after a successful add, remembering a refused one, or dropping the existing item's id from a duplicate refusal turns this red.
test('adding a title sends the monitor decision', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createAdd, parseMovieChoices, parseSeriesChoices } = await import(addModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-add-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const profiles = [{ id: 4, name: 'HD-1080p' }, { id: 6, name: 'Ultra-HD' }];
  const folders = [{ path: '/home/owner/TV', freeSpace: 10 }];
  const { fake, ...services } = connectArr(database);
  for (const service of ['sonarr', 'radarr']) {
    fake[service].routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/qualityprofile' ? { status: 200, body: profiles } : undefined));
    fake[service].routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/rootfolder' ? { status: 200, body: folders } : undefined));
  }
  fake.sonarr.state.lookup = [{ title: 'Other', tvdbId: 1 }, { title: 'Severance', tvdbId: 371980, seasons: [{ seasonNumber: 1 }] }];
  fake.radarr.state.lookup = [{ id: 7, title: 'Dune', tmdbId: 438631, images: [] }];
  const posts = (service) => fake[service].requests.filter((request) => request.method === 'POST').map(({ path, body }) => ({ path, body }));
  const add = createAdd(services, createTitleStore(database), database);
  const series = {
    monitor: 'skip', seasons: [1], monitorNewSeasons: true, qualityProfileId: 6, rootFolderPath: '/home/owner/TV',
    seasonFolder: true, seriesType: 'standard',
  };

  assert.deepEqual(await add.options('sonarr'), { kind: 'ok', qualityProfiles: profiles, rootFolders: folders, lastChoice: null });

  assert.deepEqual(await add.addSeries(371980, series), { kind: 'added', libraryId: fake.sonarr.state.series.at(-1).id });
  assert.deepEqual((await add.options('sonarr')).lastChoice, { qualityProfileId: 6, rootFolderPath: '/home/owner/TV' });
  assert.equal((await add.options('radarr')).lastChoice, null);
  assert.deepEqual(posts('sonarr').at(-1), {
    path: '/api/v3/series',
    body: {
      title: 'Severance', tvdbId: 371980, seasons: [{ seasonNumber: 1, monitored: true }],
      qualityProfileId: 6, rootFolderPath: '/home/owner/TV', seasonFolder: true, seriesType: 'standard',
      monitored: true, monitorNewItems: 'all',
      addOptions: { monitor: 'skip', searchForMissingEpisodes: true, searchForCutoffUnmetEpisodes: false },
    },
  });

  await add.addSeries(371980, { ...series, monitor: 'none', seasons: undefined });
  const noneWithNewSeasons = posts('sonarr').at(-1).body;
  assert.equal(noneWithNewSeasons.monitored, true);
  assert.deepEqual(noneWithNewSeasons.seasons, [{ seasonNumber: 1, monitored: false }]);
  assert.deepEqual(noneWithNewSeasons.addOptions, { monitor: 'skip', searchForMissingEpisodes: false, searchForCutoffUnmetEpisodes: false });

  await add.addSeries(371980, { ...series, monitor: 'none', seasons: undefined, monitorNewSeasons: false });
  const noneWithoutNewSeasons = posts('sonarr').at(-1).body;
  assert.equal(noneWithoutNewSeasons.monitored, false);
  assert.equal(noneWithoutNewSeasons.monitorNewItems, 'none');
  assert.equal(noneWithoutNewSeasons.addOptions.monitor, 'none');

  fake.sonarr.routes.push((method, url) => (method === 'POST' && url.pathname === '/api/v3/series'
    ? { status: 400, body: [{ propertyName: 'TvdbId', errorMessage: 'This series has already been added' }] }
    : undefined));
  assert.deepEqual(await add.addSeries(371980, { ...series, qualityProfileId: 4 }), {
    kind: 'refused', reason: 'Sonarr refused the series add with HTTP 400: This series has already been added.',
  });
  assert.equal((await add.options('sonarr')).lastChoice.qualityProfileId, 6);
  fake.sonarr.routes.pop();
  assert.deepEqual(await add.addSeries(5, series), { kind: 'not_found' });

  const movie = { monitor: 'none', minimumAvailability: 'inCinemas', qualityProfileId: 4, rootFolderPath: '/home/owner/TV' };
  assert.deepEqual(await add.addMovie(438631, movie), { kind: 'added', libraryId: fake.radarr.state.movies.at(-1).id });
  const { body } = posts('radarr').at(-1);
  assert.equal(posts('radarr').at(-1).path, '/api/v3/movie');
  assert.equal(body.title, 'Dune');
  assert.equal(body.monitored, false);
  assert.equal(body.minimumAvailability, 'inCinemas');
  assert.deepEqual(body.addOptions, { monitor: 'none', searchForMovie: false });
  fake.radarr.routes.push((method, url) => (method === 'POST' && url.pathname === '/api/v3/movie'
    ? { status: 400, body: [{ propertyName: 'TmdbId', errorMessage: 'This movie has already been added' }] }
    : undefined));
  assert.deepEqual(await add.addMovie(438631, movie), {
    kind: 'refused', reason: 'Radarr refused the movie add with HTTP 400: This movie has already been added.', libraryId: 7,
  });
  fake.radarr.routes.pop();

  assert.equal(parseSeriesChoices({ ...series, monitor: 'everything' }), undefined);
  assert.equal(parseSeriesChoices({ ...series, monitor: 'missing' }), undefined);
  assert.equal(parseSeriesChoices({ ...series, seasons: undefined }), undefined);
  assert.equal(parseSeriesChoices({ ...series, monitor: 'all', seasons: [1] }), undefined);
  assert.equal(parseSeriesChoices({ ...series, seasons: [1, 1] }), undefined);
  assert.equal(parseSeriesChoices({ ...series, qualityProfileId: '6' }), undefined);
  assert.equal(parseMovieChoices({ ...movie, minimumAvailability: 'tba' }), undefined);
});

// Making the title page or add ask Sonarr again instead of reading the saved lookup, or saving search results under a
// key the title page and add do not use, turns this red.
test('search, the title page and add for one title ask Sonarr for it once', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createSearch, parseSearchQuery } = await import(searchModuleUrl);
  const { createLibrary } = await import(libraryModuleUrl);
  const { createAdd } = await import(addModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-title-flow-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const { fake, ...services } = connectArr(database);
  fake.sonarr.state.lookup = [{ title: 'Severance', tvdbId: 371980, tmdbId: 95396, seasons: [{ seasonNumber: 1 }] }];
  const store = createTitleStore(database);
  const search = createSearch(database, services, store);
  const library = createLibrary(services, () => [], store);
  const add = createAdd(services, store, database);

  assert.deepEqual((await search.search(parseSearchQuery('Severance'))).results.map((result) => result.key), ['tvdb:371980']);
  assert.equal((await library.preview('sonarr', 371980)).value.title, 'Severance');
  const choices = {
    monitor: 'all', monitorNewSeasons: true, qualityProfileId: 1, rootFolderPath: '/tv', seasonFolder: true, seriesType: 'standard',
  };
  assert.equal((await add.addSeries(371980, choices)).kind, 'added');
  assert.equal(fake.sonarr.requests.filter((request) => request.path === '/api/v3/series/lookup').length, 1);
  assert.deepEqual(fake.sonarr.requests.find((request) => request.method === 'POST').body.seasons, [{ seasonNumber: 1 }]);
});

// Deleting the Sonarr and Radarr image rows (posters would then never download again), leaving a copied file behind,
// or clearing anything beyond the fetched-again data (the library, settings, preferences) turns this red.
test('clearing the cache drops saved details, Discover rows and image copies, and keeps everything else', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { setPreference } = await import(preferencesModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const { clearCache } = await import(clearCacheModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-clear-cache-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const images = join(root, 'images');
  await mkdir(images);
  for (const file of ['sonarr-7-poster.jpg', 'tmdb-w342-abc.jpg', 'unrelated.txt']) await writeFile(join(images, file), 'x');
  database.prepare('INSERT INTO titles (service, id, title, year, detail, fingerprint, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('sonarr', 7, 'Severance', 2022, '{}', 'f', 1);
  database.prepare('INSERT INTO title_images (service, id, kind, source, content_type, etag, file, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('sonarr', 7, 'poster', '/poster.jpg', 'image/jpeg', 'e', 'sonarr-7-poster.jpg', 1);
  database.prepare('INSERT INTO tmdb_images (size, path, content_type, etag, file, fetched_at) VALUES (?, ?, ?, ?, ?, ?)').run('w342', 'abc.jpg', 'image/jpeg', 'e', 'tmdb-w342-abc.jpg', 1);
  database.prepare('INSERT INTO discover_rows (key, json, fetched_at, read_at) VALUES (?, ?, ?, ?)').run('row', '{}', 1, 1);
  createTitleStore(database).put({ type: 'movie', tmdbId: 129 }, 'traktBackdrop', { url: 'https://media.trakt.tv/x.webp' });
  setSetting(database, 'credentials', 'tmdb.apiKey', 'key');
  setPreference(database, 'backdrop.source', 'trakt');

  clearCache(database, images);

  const count = (table) => Number(database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
  assert.deepEqual(['title_store_parts', 'title_store', 'discover_rows', 'tmdb_images'].map(count), [0, 0, 0, 0]);
  assert.deepEqual(['titles', 'title_images', 'settings', 'preferences'].map((table) => count(table) > 0), [true, true, true, true]);
  assert.deepEqual(await readdir(images), ['unrelated.txt']);
});

// Dropping the fanart fallback when the chosen source has no picture, ignoring the backdrop.source preference, asking fanart.tv for a show by anything
// but its TVDB id, waiting on Trakt or fanart.tv instead of loading in the background, or serving TMDB's backdrop at another size, turns this red.
test('title pages take the backdrop from the chosen source and fall back to the Sonarr or Radarr fanart', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createLibrary } = await import(libraryModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const { createBackdrops } = await import(backdropsModuleUrl);
  const { setPreference } = await import(preferencesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-backdrop-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const { fake, ...services } = connectArr(database);
  const fanart = (name) => [{ coverType: 'fanart', remoteUrl: `https://artworks.thetvdb.com/${name}.jpg` }];
  fake.sonarr.state.series = [
    seriesRecord({ id: 7, title: 'Severance', tvdbId: 371980, tmdbId: 95396, images: fanart('severance') }),
    seriesRecord({ id: 8, title: 'No TMDB id', tvdbId: 1, images: fanart('none') }),
  ];
  fake.sonarr.state.lookup = [{ title: 'Severance', tvdbId: 371980, tmdbId: 95396, seasons: [], images: fanart('severance') }];
  fake.radarr.state.movies = [movieRecord({ id: 3, title: 'Spirited Away', tmdbId: 129, images: fanart('spirited') })];
  let answers = {};
  const answer = (source) => async (type, id) => ({ kind: 'ok', value: answers[`${source}:${type}/${id}`] ?? null });
  const pages = createLibrary(services, () => [], createTitleStore(database), undefined, undefined, createBackdrops({
    database,
    store: createTitleStore(database),
    tmdbTitles: { backdropPath: async (type, id) => answers[`tmdb:${type}/${id}`] ?? null },
    trakt: { fanart: answer('trakt') },
    fanart: { background: answer('fanart') },
  }));
  const backdrops = async () => [(await pages.series(7)).value.backdropUrl, (await pages.series(8)).value.backdropUrl,
    (await pages.preview('sonarr', 371980)).value.backdropUrl, (await pages.movie(3)).value.backdropUrl];
  const fallbacks = ['https://artworks.thetvdb.com/severance.jpg', 'https://artworks.thetvdb.com/none.jpg', 'https://artworks.thetvdb.com/severance.jpg', 'https://artworks.thetvdb.com/spirited.jpg'];
  const settle = async () => { for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setImmediate(resolve)); };

  assert.deepEqual(await backdrops(), fallbacks);
  answers = { 'tmdb:tv/95396': '/sev.jpg', 'tmdb:movie/129': '/spirit.jpg', 'trakt:tv/95396': 'https://media.trakt.tv/sev.webp', 'trakt:movie/129': 'https://media.trakt.tv/spirit.webp', 'fanart:tv/371980': 'https://assets.fanart.tv/sev.jpg', 'fanart:tv/1': 'https://assets.fanart.tv/none.jpg' };
  assert.deepEqual(await backdrops(), [
    '/api/images/tmdb/w1920_and_h800_multi_faces/sev.jpg', fallbacks[1], '/api/images/tmdb/w1920_and_h800_multi_faces/sev.jpg', '/api/images/tmdb/w1920_and_h800_multi_faces/spirit.jpg',
  ]);
  setPreference(database, 'backdrop.source', 'trakt');
  assert.equal((await pages.series(7)).value.backdropUrl, fallbacks[0]);
  await backdrops();
  await settle();
  assert.deepEqual(await backdrops(), ['https://media.trakt.tv/sev.webp', fallbacks[1], 'https://media.trakt.tv/sev.webp', 'https://media.trakt.tv/spirit.webp']);
  setPreference(database, 'backdrop.source', 'fanart');
  await backdrops();
  await settle();
  assert.deepEqual(await backdrops(), ['https://assets.fanart.tv/sev.jpg', 'https://assets.fanart.tv/none.jpg', 'https://assets.fanart.tv/sev.jpg', fallbacks[3]]);
});

// Linking Trakt's 1280-wide copy instead of the 1920-wide one, passing on a link to another host, picking a fanart.tv background other than the
// most-liked, or treating fanart.tv's 404 for a title with no art as a failure turns this red.
test('Trakt and fanart.tv backdrop lookups read their replies', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTrakt } = await import(traktModuleUrl);
  const { createFanart } = await import(fanartModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-backdrop-sources-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  setSetting(database, 'credentials', 'trakt.clientId', 'trakt-id');
  setSetting(database, 'credentials', 'fanart.apiKey', 'fanart-key');
  const sent = [];
  const replying = (status, body) => ({ fetch: async (url, init) => { sent.push({ url: String(url), headers: init.headers }); return new Response(JSON.stringify(body), { status }); } });
  // The real Trakt reply shape for Severance (/search/tmdb/95396?type=show&extended=images), 13 Oct 2026.
  const traktReply = (fanart) => [{ type: 'show', show: { title: 'Severance', images: { fanart } } }];
  assert.deepEqual(await createTrakt(database, replying(200, traktReply(['media.trakt.tv/images/shows/000/154/997/fanarts/medium/9400ecb8e2.jpg.webp']))).fanart('tv', 95396),
    { kind: 'ok', value: 'https://media.trakt.tv/images/shows/000/154/997/fanarts/full/9400ecb8e2.jpg.webp' });
  assert.deepEqual(await createTrakt(database, replying(200, traktReply(['evil.example/x.webp']))).fanart('tv', 95396), { kind: 'ok', value: null });
  assert.deepEqual(await createTrakt(database, replying(200, [])).fanart('movie', 129), { kind: 'ok', value: null });

  const backgrounds = { showbackground: [
    { url: 'http://assets.fanart.tv/fanart/tv/371980/showbackground/a.jpg', likes: '2' },
    { url: 'https://assets.fanart.tv/fanart/tv/371980/showbackground/b.jpg', likes: '9' },
    { url: 'https://evil.example/c.jpg', likes: '99' },
  ] };
  assert.deepEqual(await createFanart(database, replying(200, backgrounds)).background('tv', 371980),
    { kind: 'ok', value: 'https://assets.fanart.tv/fanart/tv/371980/showbackground/b.jpg' });
  // Putting the fanart.tv key in the URL instead of its api-key header turns this red.
  assert.deepEqual(sent.at(-1), { url: 'https://webservice.fanart.tv/v3/tv/371980', headers: { Accept: 'application/json', 'api-key': 'fanart-key' } });
  assert.deepEqual(await createFanart(database, replying(404, { status: 'error', 'error message': 'Not found' })).background('movie', 129), { kind: 'ok', value: null });
  assert.equal((await createFanart(database, replying(401, {})).background('movie', 129)).kind, 'rejected');
});

// Using one max age for every part, saving a failed load, letting a second caller start its own load while one runs,
// finding a show only by its TVDB id, or keeping parts in memory instead of the database turns this red.
test('the title store refetches a part only once it is older than that part\'s max age', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-title-store-'));
  const databasePath = join(root, 'media-manager.sqlite');
  let database = openDatabase(databasePath);
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const clock = { value: 1_800_000_000_000 };
  const store = createTitleStore(database, { now: () => clock.value });
  const show = { type: 'tv', tvdbId: 371980, tmdbId: 95396 };

  for (const [part, maxAgeMs] of [['sonarr-lookup', 10 * 60_000], ['tmdb-details', 7 * 86_400_000]]) {
    let loads = 0;
    const load = async () => ({ kind: 'ok', value: { loads: (loads += 1) } });
    await store.fetch(show, part, maxAgeMs, load);
    clock.value += maxAgeMs - 1;
    assert.deepEqual(await store.fetch(show, part, maxAgeMs, load), { kind: 'ok', value: { loads: 1 } }, part);
    clock.value += 1;
    assert.deepEqual(await store.fetch(show, part, maxAgeMs, load), { kind: 'ok', value: { loads: 2 } }, part);
  }

  const movie = { type: 'movie', tmdbId: 438631 };
  assert.equal((await store.fetch(movie, 'radarr-lookup', 60_000, async () => ({ kind: 'unreachable', message: 'down' }))).kind, 'unreachable');
  assert.equal(store.get(movie, 'radarr-lookup'), undefined);

  let starts = 0;
  let finish;
  const slow = () => {
    starts += 1;
    return new Promise((resolve) => { finish = () => resolve({ kind: 'ok', value: 'Dune' }); });
  };
  const waiting = Promise.all([store.fetch(movie, 'radarr-lookup', 60_000, slow), store.fetch(movie, 'radarr-lookup', 60_000, slow)]);
  finish();
  assert.deepEqual(await waiting, [{ kind: 'ok', value: 'Dune' }, { kind: 'ok', value: 'Dune' }]);
  assert.equal(starts, 1);

  database.close();
  database = openDatabase(databasePath);
  const reopened = createTitleStore(database, { now: () => clock.value });
  assert.deepEqual(reopened.get({ type: 'tv', tmdbId: 95396 }, 'tmdb-details')?.value, { loads: 2 });
  assert.deepEqual(reopened.get(movie, 'radarr-lookup'), { value: 'Dune', fetchedAt: clock.value });
});

// Searching again when results are stored, losing stored results on a failed refresh, dropping rejected releases, dropping Sonarr's episodeRequested or Radarr's movieRequested, misreading either service's indexer flags, running two searches for one target at once, or sending a release's download link (it holds the indexer API key) to the browser breaks Pick a release.
test('interactive searches are kept with their age and refreshed only on request', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createReleaseRoutes, createReleases } = await import(releasesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-releases-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  await saveOwnerRules(database);
  for (const [service, port] of [['sonarr', 65031], ['radarr', 65032]]) {
    setSetting(database, 'serviceAddresses', `${service}.url`, `http://127.0.0.1:${port}`);
    setSetting(database, 'credentials', `${service}.apiKey`, `${service}-key`);
  }
  const sonarrReleases = [
    {
      guid: 'g1', indexerId: 3, indexer: 'Blutopia', title: 'Show.S01E02.1080p.WEB-DL', quality: { quality: { name: 'WEBDL-1080p' } },
      size: 2_000_000_000, ageHours: 5.5, seeders: 40, leechers: 2, approved: true, rejections: [], customFormatScore: 1200,
      customFormats: [{ name: 'HQ' }], indexerFlags: 1 | 32, protocol: 'torrent', qualityWeight: 304,
      downloadUrl: 'https://indexer.test/download/1?apikey=indexer-secret', mappedEpisodeInfo: [{ id: 50 }, { id: 51 }],
      episodeRequested: true,
    },
    {
      guid: 'g2', indexerId: 3, title: 'Show.S01E02.720p.HDTV', quality: { quality: { name: 'HDTV-720p' } }, approved: false,
      rejections: [{ reason: 'Not an upgrade for existing episode file(s)' }], indexerFlags: 0, seeders: 0, episodeRequested: true,
    },
    { guid: '', indexerId: 3, title: 'broken' },
    {
      guid: 'g3', indexerId: 4, indexer: 'PrivateHD', title: 'Show.S01E02.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR10', size: 4_250_000_000,
      approved: true, rejections: [], indexerFlags: 0,
    },
    {
      guid: 'pack', indexerId: 3, title: 'Show.S01.1080p.WEB-DL', approved: true, rejections: [],
      episodeRequested: true, mappedEpisodeInfo: [{ id: 50 }, { id: 51 }, { id: 52 }],
    },
    {
      guid: 'multi', indexerId: 3, title: 'Show.S01E02E03.1080p.WEB-DL', approved: true, rejections: [],
      episodeRequested: true, mappedEpisodeInfo: [{ id: 50 }, { id: 51 }],
    },
    {
      guid: 'boxset', indexerId: 3, title: 'Show.S01E07.DVD.1080p', approved: true, rejections: [],
      episodeRequested: false, mappedEpisodeInfo: [{ id: 57 }],
    },
    {
      guid: 'unmatched', indexerId: 3, title: 'Unknown.Thing.S01E02', approved: false,
      rejections: [{ reason: 'Unable to identify correct episode(s) using release name' }], episodeRequested: false, mappedEpisodeInfo: [],
    },
  ];
  database.prepare('INSERT INTO tracker_cooldowns VALUES (?, ?, ?, ?, ?)').run('blutopia.cc', 900, 'refused', 1, 'AB'.repeat(20));
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
        return new Response(JSON.stringify([
          { guid: 'm1', indexerId: 7, title: 'Movie.2021.2160p', approved: true, rejections: [], indexerFlags: ['G_Freeleech75', 'Nuked'], movieRequested: true },
          { guid: 'm2', indexerId: 7, title: 'Other.Movie.2019.1080p', approved: true, rejections: [], indexerFlags: 0, movieRequested: false },
        ]), { status: 200 });
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
    ['g3', true, [], []],
    ['pack', true, [], []],
    ['multi', true, [], []],
    ['boxset', true, [], []],
    ['unmatched', false, [], ['Unable to identify correct episode(s) using release name']],
  ]);
  // A release that never sent the flag (g3) stays unknown, so the client falls back to its episode ids instead of hiding it.
  assert.deepEqual(first.search.releases.map((item) => [item.guid, item.episodeRequested]), [
    ['g1', true], ['g2', true], ['g3', undefined], ['pack', true], ['multi', true], ['boxset', false], ['unmatched', false],
  ]);
  const storedJson = database.prepare('SELECT releases FROM release_searches WHERE target = ?').get('sonarr:episode:5:50').releases;
  assert.match(storedJson, /"episodeRequested":false/);
  assert.doesNotMatch(/\{[^{}]*"guid":"g3"[^{}]*\}/.exec(storedJson)[0], /"episodeRequested"/);
  // Reading PrivateHD's hours without the size, giving Blutopia a ratio side, or missing an active cooldown turns these red.
  assert.deepEqual(first.search.releases.map((item) => [item.guid, item.hitAndRun]), [
    ['g1', { host: 'blutopia.cc', hours: 168, ratio: null, logic: null, cooldown: true, cooldownSince: 900 }],
    ['g2', null],
    ['g3', { host: 'privatehd.to', hours: 81, ratio: 0.9, logic: 'or', cooldown: false, cooldownSince: null }],
    ['pack', null], ['multi', null], ['boxset', null], ['unmatched', null],
  ]);
  assert.deepEqual(first.search.releases.map((item) => [item.qualityWeight, item.compared, item.audio, item.hdr]), [
    [304, null, null, null], [null, null, null, null], [null, null, 'Atmos 5.1', 'DV HDR10'],
    [null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null],
  ]);
  // Sonarr answers nothing for the series here, so there is no owned file to compare with.
  assert.equal(first.search.owned, null);
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
  assert.deepEqual(refreshedA.search.releases.map((item) => item.guid), ['g1', 'g3', 'pack', 'multi', 'boxset', 'unmatched']);
  release = undefined;

  sonarr = () => new Response('', { status: 503 });
  const failed = await releases.refresh(episode);
  assert.equal(failed.kind, 'unreachable');
  assert.equal(failed.stored.fetchedAt, 5_000);
  assert.deepEqual((await releases.get(episode)).search.releases.map((item) => item.guid), ['g1', 'g3', 'pack', 'multi', 'boxset', 'unmatched']);

  const movie = await releases.get({ service: 'radarr', kind: 'movie', movieId: 9 });
  assert.deepEqual(movie.search.releases[0].flags, ['Freeleech 75%', 'Nuked']);
  assert.deepEqual(movie.search.releases.map((item) => item.movieRequested), [true, false]);
  assert.equal(releases.find({ service: 'radarr', kind: 'movie', movieId: 9 }, 'm1').title, 'Movie.2021.2160p');

  assert.equal(releases.find(episode, 'g1').downloadUrl, 'https://indexer.test/download/1?apikey=indexer-secret');
  assert.deepEqual(releases.find(episode, 'g1').episodeIds, [50, 51]);
  const routes = createReleaseRoutes(releases);
  const shown = await routes.request('/?kind=episode&seriesId=5&episodeId=50');
  const refused = await routes.request('/refresh', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'episode', seriesId: 5, episodeId: 50 }),
  });
  assert.deepEqual([shown.status, refused.status], [200, 502]);
  for (const text of [await shown.text(), await refused.text()]) {
    assert.match(text, /"guid":"g1"/);
    assert.equal(text.includes('indexer-secret'), false);
  }
});

test('pick a release hides releases Sonarr matched to another episode and reads each row from the release', async (t) => {
  // The client modules are bundled by Vite, not compiled to dist, so they are loaded from source with Node's type stripping.
  const { stripTypeScriptTypes } = await import('node:module');
  const load = async (path) => import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8')))}`);
  const { visibleReleases, splitReleaseName, qualityParts, fitKindOf, historyOf, releaseStateOf } = await load('../src/client/releaseView.ts');
  const listed = ({ shown, hidden }) => [shown.map((release) => release.guid), hidden.map((release) => release.guid)];
  const episode = { service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 50 };

  // Listing a release Sonarr matched to another episode, or hiding a single episode, multi-episode file, season pack or
  // scene-numbered release Sonarr matched to this one, turns this red.
  await t.test('an episode search lists only what Sonarr matched to the episode', () => {
    assert.deepEqual(listed(visibleReleases(episode, [
      { guid: 'single', title: 'Show.S01E02.1080p', episodeRequested: true, episodeIds: [50] },
      { guid: 'multi', title: 'Show.S01E02E03.1080p', episodeRequested: true, episodeIds: [50, 51] },
      { guid: 'pack', title: 'Show.S01.1080p', episodeRequested: true, episodeIds: [50, 51, 52] },
      { guid: 'scene', title: 'Show.S01E03.1080p', episodeRequested: true, episodeIds: [50] },
      { guid: 'boxset', title: 'Show.S01E07.DVD.1080p', episodeRequested: false, episodeIds: [57] },
      { guid: 'unmatched', title: 'Unknown.Thing.S01E02', episodeRequested: false, episodeIds: [] },
    ], [])), [['single', 'multi', 'pack', 'scene'], ['boxset', 'unmatched']]);
  });

  // Listing a release mapped only to another season, or hiding a single-episode release of the searched season, turns this red.
  await t.test('a season search lists releases of that season', () => {
    const season = { service: 'sonarr', kind: 'season', seriesId: 5, seasonNumber: 1 };
    const episodes = [{ id: 50, seasonNumber: 1 }, { id: 51, seasonNumber: 1 }, { id: 60, seasonNumber: 2 }];
    assert.deepEqual(listed(visibleReleases(season, [
      { guid: 'pack', episodeRequested: true, episodeIds: [50, 51] },
      { guid: 'single', episodeRequested: true, episodeIds: [51] },
      { guid: 'other season', episodeRequested: false, episodeIds: [60] },
      { guid: 'stored single', episodeIds: [51] },
      { guid: 'stored other season', episodeIds: [60] },
    ], episodes)), [['pack', 'single', 'stored single'], ['other season', 'stored other season']]);
  });

  // Listing a release Radarr matched to another movie turns this red.
  await t.test('a movie search hides releases Radarr matched to another movie', () => {
    const movie = { service: 'radarr', kind: 'movie', movieId: 9 };
    assert.deepEqual(listed(visibleReleases(movie, [{ guid: 'm1', movieRequested: true }, { guid: 'm2', movieRequested: false }, { guid: 'stored' }], [])),
      [['m1', 'stored'], ['m2']]);
  });

  // Hiding a release from a search stored before the flag was kept when its episodes cannot rule it out, or listing one
  // Sonarr mapped to another episode, turns this red.
  await t.test('a search stored before the flag was kept falls back to the mapped episodes', () => {
    assert.deepEqual(listed(visibleReleases(episode, [
      { guid: 'searched', episodeIds: [50] },
      { guid: 'elsewhere', episodeIds: [57] },
      { guid: 'unmapped', episodeIds: [] },
    ], [])), [['searched', 'unmapped'], ['elsewhere']]);
  });

  // Moving the group, its dash, the episode number or a movie's last year into the cut middle, or dropping characters
  // between the parts, turns this red.
  await t.test('a release name splits into its start, its middle and its group', () => {
    for (const [title, kind, parts] of [
      ['Severance.S02E08.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLOS', 'episode', { head: 'Severance.S02E08', middle: '.1080p.ATVP.WEB-DL.DDP5.1.H.264', group: '-FLOS' }],
      ['Show.S01.1080p.WEB-DL.DDP5.1-GRP', 'season', { head: 'Show.S01', middle: '.1080p.WEB-DL.DDP5.1', group: '-GRP' }],
      ['Dune.Part.Two.2024.2160p.UHD.BluRay-FraMeSToR', 'movie', { head: 'Dune.Part.Two.2024', middle: '.2160p.UHD.BluRay', group: '-FraMeSToR' }],
      ['Blade.Runner.2049.2017.1080p.WEB-DL-GRP', 'movie', { head: 'Blade.Runner.2049.2017', middle: '.1080p.WEB-DL', group: '-GRP' }],
      ['Some.Concert.Film.1080p-GRP', 'movie', { head: '', middle: 'Some.Concert.Film.1080p', group: '-GRP' }],
      ['Show.S01E02.720p.HDTV', 'episode', { head: 'Show.S01E02', middle: '.720p.HDTV', group: undefined }],
    ]) assert.deepEqual(splitReleaseName(title, kind), parts, title);
  });

  // Losing the source, keeping the joining dash, or leaving WEBDL unspelled turns this red.
  await t.test('a quality name splits into resolution and source', () => {
    for (const [name, parts] of [
      ['WEBDL-1080p', { resolution: '1080p', source: 'WEB-DL' }],
      ['Bluray-1080p Remux', { resolution: '1080p', source: 'Bluray Remux' }],
      ['HDTV-720p', { resolution: '720p', source: 'HDTV' }],
      ['SDTV', { resolution: 'SDTV' }],
      [null, { resolution: '–' }],
    ]) assert.deepEqual(qualityParts(name), parts, String(name));
  });

  // Showing a score when no scores exist, losing the best star, or writing a negative score with a hyphen turns this red.
  await t.test('the fit chip follows the profile and the scores', () => {
    for (const [approved, score, best, scores, chip] of [
      [false, 40, true, true, { kind: 'rejected' }],
      [true, 120, true, true, { kind: 'best', text: '+120' }],
      [true, 0, true, false, { kind: 'best-star' }],
      [true, 40, false, true, { kind: 'score', text: '+40' }],
      [true, 0, false, true, { kind: 'score', text: '0' }],
      [true, -50, false, true, { kind: 'negative', text: '−50' }],
      [true, 0, false, false, undefined],
    ]) assert.deepEqual(fitKindOf({ approved, customFormatScore: score }, best, scores), chip, JSON.stringify([approved, score, best, scores]));
  });

  // Showing grabbed before over a blocklisting or a failure turns this red.
  await t.test('the history mark shows the worst earlier event', () => {
    const event = (kind) => ({ kind, at: null });
    for (const [past, mark] of [
      [[], undefined],
      [[event('grabbed')], { kind: 'grabbed', tooltip: 'Grabbed before' }],
      [[event('grabbed'), event('failed')], { kind: 'failed', tooltip: 'Failed before' }],
      [[event('failed'), event('blocklisted'), event('grabbed')], { kind: 'blocklisted', tooltip: 'Blocklisted' }],
    ]) assert.deepEqual(historyOf(past), mark, JSON.stringify(past));
  });

  // Showing a stalled or blocked download as progress, or a finished one as still downloading, turns this red.
  await t.test('a grabbed release follows the live download', () => {
    const live = (word, percent = null) => ({ word, tone: 'normal', percent, downRate: 0 });
    for (const [progress, chip] of [
      [undefined, { state: 'grabbed' }],
      [live('queued'), { state: 'grabbed' }],
      [live('downloading', 18), { state: 'downloading', percent: 18 }],
      [live('stalled', 40), { state: 'stalled', percent: 40 }],
      [live('error'), { state: 'stalled', percent: 0 }],
      [live('import blocked', 100), { state: 'import-blocked' }],
      [live('waiting to import', 100), { state: 'importing' }],
      [live('seeding', 100), { state: 'importing' }],
    ]) assert.deepEqual(releaseStateOf(progress), chip, progress?.word ?? 'no download');
  });
});

// Reading the wrong codec, keeping the codec name beside Atmos, losing the channels, listing HDR beside HDR10, or ranking
// a quality inside a profile group by its own position instead of the group's turns this red.
test('releases read audio and HDR from their titles and compare with the owned file', async () => {
  const { audioHdrFromTitle, audioHdrFromMediaInfo, compareToOwned, qualityWeightOf } = await import(releaseDetailsModuleUrl);
  for (const [title, audio, hdr] of [
    ['Movie.2021.2160p.UHD.BluRay.DDP5.1.Atmos.DV.HDR10.x265-GRP', 'Atmos 5.1', 'DV HDR10'],
    ['Show.S01E02.1080p.WEB-DL.DDP5.1.H.264-GRP', 'DDP 5.1', null],
    ['Movie.2021.1080p.BluRay.TrueHD.x264-GRP', 'TrueHD', null],
    ['Movie.2021.2160p.WEB-DL.DTS-HD.MA.7.1.HDR10+.HEVC-GRP', 'DTS-HD 7.1', 'HDR10+'],
    ['Movie.2021.2160p.BluRay.TrueHD.Atmos.7.1.DoVi.x265', 'Atmos 7.1', 'DV'],
    ['Movie.2021.2160p.WEB-DL.AAC2.0.HDR.HLG.x265', 'AAC 2.0', 'HDR HLG'],
    ['Show.S01E02.720p.HDTV.x264', null, null],
  ]) assert.deepEqual(audioHdrFromTitle(title), { audio, hdr }, title);
  for (const [audioCodec, audioChannels, videoDynamicRangeType, audio, hdr] of [
    ['EAC3 Atmos', 5.1, 'DV HDR10', 'Atmos 5.1', 'DV HDR10'],
    ['DTS-HD MA', 7.1, 'HDR10Plus', 'DTS-HD 7.1', 'HDR10+'],
    ['AC3', 2, 'DV SDR', 'DD 2.0', 'DV'],
  ]) assert.deepEqual(audioHdrFromMediaInfo({ audioCodec, audioChannels, videoDynamicRangeType }), { audio, hdr }, audioCodec);

  const items = [
    { quality: { name: 'SDTV' }, items: [] },
    { name: 'WEB 720p', items: [{ quality: { name: 'WEBDL-720p' } }, { quality: { name: 'WEBRip-720p' } }] },
    { quality: { name: 'Bluray-1080p' }, items: [] },
  ];
  assert.equal(qualityWeightOf(items, 'WEBRip-720p', { real: 0, version: 1 }), 101);
  assert.equal(qualityWeightOf(items, 'Bluray-1080p', { real: 1, version: 2 }), 212);
  assert.equal(qualityWeightOf(items, 'Remux-2160p', { real: 0, version: 1 }), null);
  const owned = { qualityWeight: 101, customFormatScore: 500 };
  for (const [release, against, expected] of [
    [{ qualityWeight: 201, customFormatScore: 0 }, owned, 'better'],
    [{ qualityWeight: 101, customFormatScore: 600 }, owned, 'better'],
    [{ qualityWeight: 101, customFormatScore: 500 }, owned, 'same'],
    [{ qualityWeight: 1, customFormatScore: 9000 }, owned, 'worse'],
    [{ qualityWeight: 101, customFormatScore: -50 }, { qualityWeight: 101, customFormatScore: null }, 'same'],
    [{ qualityWeight: null, customFormatScore: 0 }, owned, null],
    [{ customFormatScore: 0 }, owned, null],
    [{ qualityWeight: 101, customFormatScore: 0 }, { qualityWeight: null, customFormatScore: 0 }, null],
  ]) assert.equal(compareToOwned(release, against), expected, JSON.stringify([release, against]));
});

// Comparing a search stored before quality weights were kept, matching the torrent by anything but the latest imported
// grab's hash, missing the announce host's subdomain, or letting a failed upstream call fail the search turns this red.
test('pick a release shows the owned file with its seeding and compares each release with it', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createReleases } = await import(releasesModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-owned-release-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  await saveOwnerRules(database);
  setSetting(database, 'serviceAddresses', 'sonarr.url', 'http://127.0.0.1:65033');
  setSetting(database, 'credentials', 'sonarr.apiKey', 'sonarr-key');
  const hash = 'CD'.repeat(20);
  const insertGrab = database.prepare(`INSERT INTO torrent_grabs (hash, service, series_id, episode_ids, release_title, indexer, grabbed_at, by_hand, imported_at)
    VALUES (?, 'sonarr', 5, '[50]', ?, 'PrivateHD', ?, 0, ?)`);
  insertGrab.run('EF'.repeat(20), 'Show.S01E02.720p.HDTV-OLD', 1, 2);
  insertGrab.run(hash, 'Show.S01E02.1080p.WEB-DL.DDP5.1-OWN', 3, 4);
  database.prepare(`INSERT INTO torrents VALUES (?, 'Show.S01E02', 10000000000, 10000000000, 0, 0, 1, 1, 1, 1, '', 0, 450, 0, 0,
    'tracker.privatehd.to', 1, 1, NULL, ?, '')`).run(hash, 31 * 3600 + 100);
  database.prepare('INSERT INTO release_searches (target, fetched_at, releases) VALUES (?, ?, ?)').run('sonarr:episode:5:50', 500, JSON.stringify([{
    guid: 'old', indexerId: 3, indexer: null, title: 'Show.S01E02.2160p', quality: null, size: null, ageHours: null, seeders: null, leechers: null,
    approved: true, rejections: [], customFormatScore: 0, customFormats: [], flags: [], protocol: null, past: [], qualityModel: null, languages: [],
  }]));
  let profileStatus = 200;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
  const fetch = async (url) => {
    const { pathname } = new URL(String(url));
    if (pathname === '/api/v3/series/5') return json({ id: 5, title: 'Show', qualityProfileId: 1 });
    if (pathname === '/api/v3/episode') {
      return json([{
        id: 50, seasonNumber: 1, episodeNumber: 2, hasFile: true,
        episodeFile: {
          id: 9, relativePath: 'Season 1/Show.S01E02.mkv', size: 10_000_000_000, releaseGroup: 'OWN', customFormatScore: 100, qualityCutoffNotMet: true,
          quality: { quality: { name: 'WEBDL-1080p' }, revision: { version: 1, real: 0 } },
          mediaInfo: { audioCodec: 'EAC3', audioChannels: 5.1, videoDynamicRangeType: '' },
        },
      }]);
    }
    if (pathname === '/api/v3/qualityprofile/1') {
      return json({ items: [
        { quality: { name: 'HDTV-720p' }, items: [] },
        { name: 'WEB 1080p', items: [{ quality: { name: 'WEBDL-1080p' } }] },
        { quality: { name: 'Bluray-2160p' }, items: [] },
      ] }, profileStatus);
    }
    if (pathname === '/api/v3/release') {
      return json([
        { guid: 'up', indexerId: 3, title: 'Show.S01E02.2160p.BluRay', approved: true, rejections: [], qualityWeight: 201, customFormatScore: 0 },
        { guid: 'same', indexerId: 3, title: 'Show.S01E02.1080p.WEB-DL', approved: true, rejections: [], qualityWeight: 101, customFormatScore: 100 },
        { guid: 'down', indexerId: 3, title: 'Show.S01E02.720p.HDTV', approved: true, rejections: [], qualityWeight: 1, customFormatScore: 2000 },
      ]);
    }
    return new Response('', { status: 500 });
  };
  const releases = createReleases(database, { sonarr: createArr('sonarr', database, { fetch }), radarr: createArr('radarr', database, { fetch }) }, () => 1_000);
  const episode = { service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 50 };

  const stored = await releases.get(episode);
  assert.deepEqual(stored.search.releases.map((item) => [item.guid, item.compared]), [['old', null]]);
  assert.deepEqual(stored.search.owned, {
    quality: 'WEBDL-1080p', releaseTitle: 'Show.S01E02.1080p.WEB-DL.DDP5.1-OWN', releaseGroup: 'OWN', size: 10_000_000_000,
    customFormatScore: 100, qualityCutoffNotMet: true, audio: 'DDP 5.1', hdr: null,
    hitAndRun: { host: 'privatehd.to', hours: 92, ratio: 0.9, logic: 'or', seededHours: 31, currentRatio: 0.45, met: false },
  });

  // Holding a half-downloaded torrent to the complete-torrent seed time turns this red.
  database.prepare('UPDATE torrents SET completed_bytes = 5000000000').run();
  assert.deepEqual((await releases.get(episode)).search.owned.hitAndRun,
    { host: 'privatehd.to', hours: 1440, ratio: 0.9, logic: 'or', seededHours: 31, currentRatio: 0.45, met: false });

  const fresh = await releases.refresh(episode);
  assert.deepEqual(fresh.search.releases.map((item) => [item.guid, item.compared]), [['up', 'better'], ['same', 'same'], ['down', 'worse']]);
  assert.equal(database.prepare('SELECT releases FROM release_searches').get().releases.includes('compared'), false);

  profileStatus = 500;
  const failed = await releases.refresh(episode);
  assert.equal(failed.kind, 'ok');
  assert.equal(failed.search.owned, null);
  assert.deepEqual(failed.search.releases.map((item) => item.compared), [null, null, null]);
});

// Grabbing through /release/push or without the stored release, reporting a refused grab as sent, losing the downloadId, or recording the searched target instead of an override breaks hand grabs and the replace that follows them.
test('a hand grab is recorded before it is sent and keeps what it is for', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createReleases } = await import(releasesModuleUrl);
  const { createGrabRoutes, createGrabs, parseOverrides } = await import(grabsModuleUrl);
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
  const grabbedHistory = [{ downloadId: 'OTHER', data: { guid: 'g-other' } }, { downloadId: 'ABC123HASH', data: { guid: 'g-rejected' } }];
  let history = grabbedHistory;
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
    if (pathname === '/api/v3/history') return new Response(JSON.stringify({ records: history }), { status: 200 });
    if (pathname === '/api/v3/qualitydefinition') {
      return new Response(JSON.stringify([{ quality: { id: 3, name: 'WEBDL-1080p' } }, { quality: { id: 4, name: 'HDTV-720p', resolution: 720 } }]), { status: 200 });
    }
    return new Response('[]', { status: 200 });
  };
  const sonarr = createArr('sonarr', database, { fetch });
  const releases = createReleases(database, { sonarr, radarr: sonarr });
  const changes = [];
  let clock = 1_000_000;
  const grabs = createGrabs(database, { sonarr, radarr: sonarr }, releases, { now: () => clock, onChange: (record) => changes.push(record) });
  const target = { service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 50 };

  assert.deepEqual(await grabs.grab(target, 'g-rejected', 'replace'), { kind: 'unknown_release' });
  await releases.get(target);

  const sent = await grabs.grab(target, 'g-rejected', 'replace');
  assert.equal(sent.kind, 'sent');
  assert.deepEqual(posts.at(-1), { pathname: '/api/v3/release', body: { guid: 'g-rejected', indexerId: 3, downloadAllowed: true } });
  assert.deepEqual(changes.map((record) => record.state), ['sending', 'sent', 'sent']);
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

  // Recording every thrown grab request alike turns a row red: a refused connection or failed name lookup means nothing was sent, so left sent it makes a replace wait forever, while any other failure may have reached Sonarr and the veto would remove it.
  const ownTitles = grabs.recentTitles('sonarr', 0).length;
  history = [];
  let unanswered;
  const systemError = (message, code) => Object.assign(new Error(message), { code });
  const doubt = "Sonarr didn't answer the grab, so it may still have gone through.";
  const unreached = "Sonarr didn't answer the grab.";
  for (const [error, state, failure] of [
    [new TypeError('fetch failed'), 'sent', doubt],
    [new TypeError('fetch failed', { cause: systemError('read ECONNRESET', 'ECONNRESET') }), 'sent', doubt],
    [new TypeError('fetch failed', { cause: systemError('connect ECONNREFUSED', 'ECONNREFUSED') }), 'failed', unreached],
    [new TypeError('fetch failed', { cause: Object.assign(new AggregateError([systemError('x', 'ECONNREFUSED')], 'aggregate'), { code: 'ECONNREFUSED' }) }), 'failed', unreached],
    [new TypeError('fetch failed', { cause: systemError('getaddrinfo ENOTFOUND', 'ENOTFOUND') }), 'failed', unreached],
    [new TypeError('fetch failed', { cause: systemError('getaddrinfo EAI_AGAIN', 'EAI_AGAIN') }), 'failed', unreached],
    [new TypeError('fetch failed', { cause: systemError('write EHOSTUNREACH', 'EHOSTUNREACH') }), 'sent', doubt],
    [new TypeError('fetch failed', { cause: systemError('Connect Timeout Error', 'UND_ERR_CONNECT_TIMEOUT') }), 'failed', unreached],
    [new DOMException('The operation was aborted due to timeout', 'TimeoutError'), 'sent', doubt],
  ]) {
    const row = `${error.name}:${error.cause?.code ?? 'none'}`;
    grabResponse = () => { throw error; };
    unanswered = await grabs.grab(target, 'g-rejected', 'replace');
    assert.deepEqual([unanswered.kind, unanswered.record.state, unanswered.record.failure], [state, state, failure], row);
    assert.equal(grabs.pending('replace').some((record) => record.id === unanswered.record.id), state === 'sent', row);
  }
  assert.equal(grabs.recentTitles('sonarr', 0).length, ownTitles + 4);
  history = grabbedHistory;
  const confirmed = await grabs.resolveDownloadId(unanswered.record);
  assert.deepEqual([confirmed.state, confirmed.downloadId, confirmed.failure], ['sent', 'ABC123HASH', null], 'history confirms the grab and clears the doubt');

  // Mapping a route outcome to the wrong status turns the matching row red, and the screen then shows the wrong message.
  const routes = createGrabRoutes(grabs);
  const call = async (path, init) => (await routes.request(path, init)).status;
  const post = (body) => call('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const cases = [
    ['bad JSON', () => post('{'), 400],
    ['unknown body key', () => post({ target, guid: 'g-rejected', intent: 'grab', extra: 1 }), 400],
    ['bad intent', () => post({ target, guid: 'g-rejected', intent: 'upgrade' }), 400],
    ['bad overrides', () => post({ target, guid: 'g-rejected', intent: 'grab', overrides: { movieId: 9 } }), 400],
    ['unknown release', () => post({ target, guid: 'g-missing', intent: 'grab' }), 404],
    ['refused grab', () => {
      grabResponse = () => new Response(JSON.stringify({ message: 'Release rejected' }), { status: 400 });
      return post({ target, guid: 'g-rejected', intent: 'grab' });
    }, 409],
    ['sent grab', () => {
      grabResponse = () => new Response('{}', { status: 200 });
      return post({ target, guid: 'g-rejected', intent: 'grab' });
    }, 201],
    ['not configured', async () => {
      setSetting(database, 'serviceAddresses', 'sonarr.url', '');
      const status = await post({ target, guid: 'g-rejected', intent: 'grab' });
      setSetting(database, 'serviceAddresses', 'sonarr.url', 'http://127.0.0.1:65041');
      return status;
    }, 503],
    ['list for a bad target', () => call('/?kind=episode&seriesId=5'), 400],
    ['list', () => call('/?kind=episode&seriesId=5&episodeId=50'), 200],
  ];
  for (const [name, run, status] of cases) assert.equal(await run(), status, name);

  // Leaving a never-reported grab sent past the hour, or failing one the service may still report, turns this red.
  await t.test('a sent grab Sonarr never reports fails after an hour', async () => {
    history = [];
    grabResponse = () => new Response('{}', { status: 200 });
    const old = [(await grabs.grab(target, 'g-rejected', 'replace')).record.id, (await grabs.grab(target, 'g-rejected', 'replace')).record.id];
    clock += 3_600_001;
    const young = (await grabs.grab(target, 'g-rejected', 'replace')).record.id;
    history = grabbedHistory;
    const before = changes.length;
    await grabs.resolvePending();
    for (const id of old) {
      const record = grabs.read(id);
      assert.deepEqual([record.state, record.failure, record.downloadId], ['failed', 'Sonarr or Radarr never reported this grab.', null], `grab ${id}`);
    }
    assert.deepEqual([grabs.read(young).state, grabs.read(young).downloadId], ['sent', 'ABC123HASH']);
    assert.equal(grabs.pending().some((record) => old.includes(record.id)), false);
    assert.deepEqual(changes.slice(before).filter((record) => old.includes(record.id)).map((record) => [record.id, record.state]), old.map((id) => [id, 'failed']));
  });

  assert.equal(parseOverrides({ seriesId: 5 }, 'sonarr'), undefined);
  assert.equal(parseOverrides({ movieId: 5 }, 'sonarr'), undefined);
  assert.deepEqual(parseOverrides(undefined, 'radarr'), {});
});

// Sending a second version through Sonarr or Radarr, moving it to downloading on rTorrent's 0 reply, sending before recording, hashing re-encoded info bytes instead of the file's own, sending a magnet, a web page, an oversized file or a refused download to rTorrent, one row for a whole pack, leaving a refused send pending, or settling a pending send by anything but the torrent list and this app's label breaks second versions.
test('a second version is recorded, then sent straight to rTorrent with its folder and label', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createArr } = await import(arrModuleUrl);
  const { createReleases } = await import(releasesModuleUrl);
  const { createSecondVersionRoutes, createSecondVersions, infoHash } = await import(secondVersionsModuleUrl);
  const { RtorrentFault } = await import(rtorrentModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-second-versions-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  for (const [service, port] of [['sonarr', 65061], ['radarr', 65062]]) {
    setSetting(database, 'serviceAddresses', `${service}.url`, `http://127.0.0.1:${port}`);
    setSetting(database, 'credentials', `${service}.apiKey`, `${service}-key`);
  }

  const bencode = (value) => {
    if (typeof value === 'number') return `i${value}e`;
    if (typeof value === 'string') return `${value.length}:${value}`;
    if (Array.isArray(value)) return `l${value.map(bencode).join('')}e`;
    return `d${Object.entries(value).map(([key, item]) => bencode(key) + bencode(item)).join('')}e`;
  };
  // Keys out of sorted order, so a reader that re-encodes the info dictionary gets a different hash.
  const torrentFile = (name) => {
    const info = bencode({ pieces: 'p'.repeat(20), name, 'piece length': 16384, files: [{ path: ['a.mkv'], length: 5 }], private: 1 });
    const file = `d8:announce${bencode('https://tracker.test/announce/passkey')}13:announce-listll3:a:eee7:comment${bencode('e:d4:info')}13:creation datei-7e4:info${info}8:url-listlee`;
    return { bytes: Buffer.from(file, 'latin1'), hash: createHash('sha1').update(info, 'latin1').digest('hex').toUpperCase() };
  };
  const files = Object.fromEntries(['/movie', '/pack', '/down', '/lost', '/sonarr', '/fault'].map((path) => [path, torrentFile(path.slice(1))]));
  assert.equal(infoHash(files['/movie'].bytes), files['/movie'].hash);
  for (const bad of ['<!DOCTYPE html>', 'd4:infod4:name', 'd4:name4:moviee', 'd4:info3:abce']) assert.equal(infoHash(Buffer.from(bad)), undefined, bad);

  let arrRequests = 0;
  const release = (guid, path) => ({
    guid, indexerId: 1, indexer: 'Blutopia', title: `Release ${guid}`, quality: { quality: { name: 'Bluray-2160p' } }, size: 50,
    approved: true, rejections: [], protocol: 'torrent', downloadUrl: `https://indexer.test${path}?apikey=indexer-secret`,
  });
  const fetch = async (url) => {
    arrRequests += 1;
    const parsed = new URL(String(url));
    if (parsed.pathname !== '/api/v3/release') return new Response('[]', { status: 200 });
    return new Response(JSON.stringify(parsed.port === '65062'
      ? ['/movie', '/magnet', '/html', '/big', '/loop', '/forbidden', '/fault', '/down', '/lost', '/sonarr'].map((path) => release(`m${path}`, path))
      : [{ ...release('s/pack', '/pack'), mappedEpisodeInfo: [{ id: 101 }, { id: 102 }, { id: 103 }] }]), { status: 200 });
  };
  const services = { sonarr: createArr('sonarr', database, { fetch }), radarr: createArr('radarr', database, { fetch }) };
  const releases = createReleases(database, services);
  const movie = { service: 'radarr', kind: 'movie', movieId: 9 };
  const season = { service: 'sonarr', kind: 'season', seriesId: 5, seasonNumber: 1 };
  await releases.get(movie);
  await releases.get(season);
  const arrRequestsBefore = arrRequests;

  const indexer = async (url, init) => {
    assert.equal(init.redirect, 'manual');
    const { pathname } = new URL(String(url));
    if (pathname === '/magnet') return new Response(null, { status: 302, headers: { Location: 'magnet:?xt=urn:btih:abc' } });
    if (pathname === '/html') return new Response('<!DOCTYPE html><html>Log in</html>', { status: 200 });
    if (pathname === '/big') return new Response(new Uint8Array(10 * 1024 * 1024 + 1), { status: 200 });
    if (pathname === '/loop') return new Response(null, { status: 302, headers: { Location: '/loop?apikey=indexer-secret' } });
    if (pathname === '/forbidden') return new Response('no', { status: 403 });
    return new Response(files[pathname].bytes, { status: 200 });
  };
  const calls = [];
  // A poll can start while load.raw_start is in flight, so each send moves the clock on.
  let rtorrentAnswer = () => { clock += 1; return 0; };
  const labels = new Map();
  let labelFails = false;
  const rtorrent = {
    call: async (method, params) => {
      if (method === 'd.custom1') {
        if (labelFails) throw new Error('rTorrent is unreachable.');
        return labels.get(params[0]) ?? '';
      }
      calls.push({ method, params, rows: database.prepare('SELECT hash, state FROM second_versions WHERE hash = ?').all(infoHash(params[1])).map((row) => ({ ...row })) });
      return rtorrentAnswer();
    },
  };
  let clock = 1_000;
  const secondVersions = createSecondVersions({ database, releases, rtorrent, fetch: indexer, now: () => clock });
  const routes = createSecondVersionRoutes(secondVersions);
  const post = async (target, guid) => {
    const response = await routes.request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target, guid }) });
    const text = await response.text();
    assert.equal(text.includes('indexer-secret'), false);
    return { status: response.status, body: JSON.parse(text) };
  };
  const rowCount = () => database.prepare('SELECT COUNT(*) AS n FROM second_versions').get().n;
  // Dropping or mixing up a failure code on any path below turns the matching line red.
  const states = (path) => secondVersions.byHash(files[path].hash).map((row) => [row.state, row.failure, row.failureCode]);
  const addTorrent = (path) => database.prepare("INSERT INTO torrents VALUES (?, 'down', 100, 0, 0, 0, 1, 1, 1, 0, '', 0, 0, 0, 0, NULL, 1, 1, NULL, 0, '')").run(files[path].hash);

  // Sending a second version anywhere but its own service's downloads folder, or refusing without naming that key, turns this red.
  setSetting(database, 'hostPaths', 'downloads.sonarr', '/data/tv-downloads');
  const unset = await post(movie, 'm/movie');
  assert.equal(unset.status, 409);
  assert.match(unset.body.reason, /hostPaths downloads\.radarr/);
  assert.equal(rowCount(), 0);
  setSetting(database, 'hostPaths', 'downloads.radarr', '/data/movie-downloads');
  setSetting(database, 'serviceAddresses', 'rtorrent.url', 'http://127.0.0.1:65063/RPC2');
  assert.equal((await post(movie, 'm/unknown')).status, 404);

  const sent = await post(movie, 'm/movie');
  assert.equal(sent.status, 201);
  assert.deepEqual(sent.body.secondVersions.map((row) => [row.service, row.movieId, row.hash, row.state, row.quality, row.indexer]), [
    ['radarr', 9, files['/movie'].hash, 'sending', 'Bluray-2160p', 'Blutopia'],
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'load.raw_start');
  assert.deepEqual([calls[0].params[0], ...calls[0].params.slice(2)], ['', 'd.directory.set="/data/movie-downloads"', 'd.custom1.set=mm2-second-version']);
  assert.equal(Buffer.compare(calls[0].params[1], files['/movie'].bytes), 0);
  assert.deepEqual(calls[0].rows, [{ hash: files['/movie'].hash, state: 'sending' }]);
  // rTorrent drops a hash it already has after answering 0, so only a poll that began after the reply may judge it.
  await secondVersions.reconcile(clock);
  assert.deepEqual(states('/movie'), [['sending', null, null]]);

  const again = await post(movie, 'm/movie');
  assert.deepEqual([again.status, again.body.reason, again.body.secondVersions[0].failureCode], [409, 'That torrent is already in rTorrent.', 'already_in_rtorrent']);
  for (const [guid, reason, code] of [
    ['m/magnet', /magnet link only/, 'download_link_failed'], ['m/html', /web page/, 'not_a_torrent'], ['m/big', /larger than 10 MB/, 'download_link_failed'],
    ['m/loop', /redirected too many times/, 'download_link_failed'], ['m/forbidden', /HTTP 403/, 'download_link_failed'],
  ]) {
    const failed = await post(movie, guid);
    assert.equal(failed.status, 409);
    assert.match(failed.body.reason, reason);
    assert.deepEqual(failed.body.secondVersions.map((row) => [row.state, row.hash, row.failureCode]), [['failed', null, code]], guid);
  }
  assert.equal(calls.length, 1);

  const pack = await post(season, 's/pack');
  assert.equal(pack.status, 201);
  assert.deepEqual(pack.body.secondVersions.map((row) => [row.seriesId, row.episodeId, row.hash, row.state]), [101, 102, 103].map((id) => [5, id, files['/pack'].hash, 'sending']));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].params[2], 'd.directory.set="/data/tv-downloads"');
  assert.equal(arrRequests, arrRequestsBefore);

  // Once the hash shows up, its label settles it; a failed label read leaves it for the next poll.
  addTorrent('/movie');
  addTorrent('/pack');
  labels.set(files['/movie'].hash, 'mm2-second-version');
  labels.set(files['/pack'].hash, 'sonarr');
  labelFails = true;
  clock += 1;
  await secondVersions.reconcile(clock);
  assert.deepEqual([...states('/movie'), ...states('/pack')], Array(4).fill(['sending', null, null]));
  labelFails = false;
  await secondVersions.reconcile(clock);
  assert.deepEqual(states('/movie'), [['downloading', null, null]]);
  assert.deepEqual(states('/pack'), Array(3).fill(['failed', 'Sonarr or Radarr grabbed the same torrent.', 'grabbed_by_arr']));

  rtorrentAnswer = () => { throw new RtorrentFault('rTorrent fault -503: Could not create download.'); };
  const fault = await post(movie, 'm/fault');
  assert.deepEqual([fault.status, fault.body.reason], [409, 'rTorrent fault -503: Could not create download.']);
  assert.deepEqual(states('/fault'), [['failed', 'rTorrent fault -503: Could not create download.', 'rtorrent_refused']]);
  assert.equal(calls.length, 3);

  // Sends rTorrent never confirmed stay sending until a poll that began after them, across a restart.
  rtorrentAnswer = () => { throw new Error('rTorrent is unreachable.'); };
  for (const guid of ['m/down', 'm/lost', 'm/sonarr']) assert.equal((await post(movie, guid)).status, 202);
  await secondVersions.reconcile(clock);
  assert.deepEqual(states('/down'), [['sending', 'rTorrent is unreachable.', 'send_unconfirmed']]);
  const restarted = createSecondVersions({ database, releases, rtorrent, fetch: indexer, now: () => clock });
  for (const path of ['/down', '/sonarr']) addTorrent(path);
  labels.set(files['/down'].hash, 'mm2-second-version');
  labels.set(files['/sonarr'].hash, 'radarr');
  clock += 1;
  await restarted.reconcile(clock);
  assert.deepEqual(states('/down'), [['downloading', null, null]]);
  assert.deepEqual(states('/lost'), [['failed', 'rTorrent never received it. rTorrent is unreachable.', 'never_received']]);
  assert.deepEqual(states('/sonarr'), [['failed', 'Sonarr or Radarr grabbed the same torrent.', 'grabbed_by_arr']]);
  assert.equal(calls.length, 6, 'a send a restart left behind is never sent again');
});

// Letting a stray character, a {edition-} tag or a Plex extras ending into a name, missing the 1x02 form, or reading only
// the first episode of a file holding several, turns this red.
test('second version file names are cleaned and episodes read from file names', async () => {
  const { cleanName, versionSuffix, episodeCodes } = await import(versionImportModuleUrl);
  for (const [input, expected] of [
    ['Mission: Impossible', 'Mission - Impossible'],
    ['AC/DC: Live? "Yes" <1> *|', 'ACDC - Live Yes 1'],
    ['Movie {edition-Director} (2020)', 'Movie edition-Director (2020)'],
    ['..hidden name. ', 'hidden name'],
  ]) assert.equal(cleanName(input), expected, input);
  for (const [quality, title, expected] of [
    ['Bluray-2160p', 'Dune.Part.Two.2024.2160p.UHD.BluRay.x265-FraMeSToR', 'Bluray-2160p FraMeSToR'],
    ['WEBDL-1080p', 'Show S01E02 1080p WEB-DL', 'WEBDL-1080p'],
    ['WEBDL-1080p', 'Show.S01E02.1080p.WEB.h264-Trailer', 'WEBDL-1080p'],
    ['Bluray-1080p', 'Movie.2020.1080p.BluRay-SAMPLE[rarbg]', 'Bluray-1080p'],
    ['Featurette', 'Movie.2020-OTHER', ''],
    ['{edition-x}', 'Movie.2020-GRP', 'edition-x GRP'],
    ['Bluray-1080p', 'Movie.2020.1080p.BluRay-CLIP', 'Bluray-1080p'],
    ['WEBDL-1080p', 'Movie.2020.1080p.WEB-DL-Extra', 'WEBDL-1080p'],
    ['Bluray-2160p', 'Movie.2020.2160p.BluRay-DeletedScene', 'Bluray-2160p'],
  ]) assert.equal(versionSuffix(quality, title), expected, title);
  for (const [name, season, episodes] of [
    ['Andor.S01E02.2160p.mkv', 1, [2]],
    ['andor_s1e10.mkv', 1, [10]],
    ['Andor - 1x03 - Reckoning.mkv', 1, [3]],
    ['Andor.S01E01E02.mkv', 1, [1, 2]],
    ['Andor.S02E01-E03.mkv', 2, [1, 2, 3]],
    ['andor.1x01x02.mkv', 1, [1, 2]],
    ['Andor.2022.1920x1080.mkv', 0, []],
    ['ShowS01E02.mkv', 0, []],
  ]) assert.deepEqual(episodeCodes(name), episodes.map((episode) => ({ season, episode })), name);
});

test('a finished second version is hardlinked into the versions folder and Plex is asked to scan it', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createProblems } = await import(problemsModuleUrl);
  const { createVersionImport, FOLDER_PROBLEM_KIND, IMPORT_PROBLEM_KIND, PLEX_PROBLEM_KIND } = await import(versionImportModuleUrl);
  const { createPlex } = await import(plexModuleUrl);
  const root = await realpath(await mkdtemp(join(tmpdir(), 'media-manager-2-version-import-')));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const downloads = join(root, 'downloads');
  const movies = join(root, 'versions', 'movies');
  const tv = join(root, 'versions', 'tv');
  await mkdir(movies, { recursive: true });
  await mkdir(tv, { recursive: true });
  setSetting(database, 'hostPaths', 'versions.radarr', movies);

  const { fake, ...arr } = connectArr(database);
  fake.radarr.state.movies = [
    movieRecord({ id: 9, title: 'Dune: Part Two', year: 2024 }),
    movieRecord({ id: 10, title: 'Arrival', year: 2016 }),
    movieRecord({ id: 11, title: 'Heat', year: 1995 }),
    movieRecord({ id: 12, title: 'Alien', year: 1979 }),
  ];
  fake.sonarr.state.series = [seriesRecord({ id: 5, title: 'Andor' })];
  fake.sonarr.state.episodes = [[101, 1, 1], [102, 1, 2], [103, 1, 3], [104, 2, 1], [105, 2, 2], [106, 2, 3], [107, 3, 1], [108, 3, 2], [109, 3, 3]]
    .map(([id, seasonNumber, episodeNumber]) => episodeRecord({ id, seriesId: 5, seasonNumber, episodeNumber }));

  const torrents = new Map();
  const rtorrent = {
    call: async (method, [hash]) => {
      const torrent = torrents.get(hash);
      if (method === 'f.multicall') return torrent.files.map((file) => [file]);
      if (method === 'd.directory') return torrent.directory;
      throw new Error(`Unexpected ${method}`);
    },
  };
  // A torrent in rTorrent's folder, already polled into the torrents table.
  const addTorrent = async (hash, files, { complete = 1 } = {}) => {
    const directory = join(downloads, hash);
    for (const file of files) {
      await mkdir(join(directory, file, '..'), { recursive: true });
      await writeFile(join(directory, file), `${hash} ${file}`);
    }
    torrents.set(hash, { directory, files });
    database.prepare("INSERT INTO torrents VALUES (?, ?, 100, 100, 0, 0, 1, 1, 1, ?, '', 0, 0, 0, 0, NULL, 1, 1, NULL, 0, '')").run(hash, hash, complete);
    return directory;
  };
  const addRows = (hash, subjects, { quality = 'Bluray-2160p', releaseTitle = 'Release.2160p-GRP', state = 'downloading' } = {}) => {
    for (const subject of subjects) {
      database.prepare(`
        INSERT INTO second_versions (service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, size_bytes, hash, state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'guid', 'Blutopia', ?, 100, ?, ?, 1, 1)
      `).run(subject.movieId === undefined ? 'sonarr' : 'radarr', subject.movieId ?? null, subject.movieId === undefined ? 5 : null,
        subject.episodeId ?? null, releaseTitle, quality, hash, state);
    }
  };
  const rows = (hash) => database.prepare('SELECT state, failure, file_path FROM second_versions WHERE hash = ? ORDER BY id').all(hash).map((row) => ({ ...row }));
  const failureCode = (hash) => database.prepare('SELECT failure_code FROM second_versions WHERE hash = ?').get(hash).failure_code;
  const eventCount = () => database.prepare('SELECT COUNT(*) AS n FROM version_events').get().n;
  const problemsFor = (kind) => database.prepare("SELECT subject_id, state, summary FROM problems WHERE kind = ? AND state != 'resolved' ORDER BY id")
    .all(kind).map((row) => ({ ...row }));

  const plexRequests = [];
  let sections = [{ key: '3', type: 'movie', Location: [{ path: join(root, 'versions') }] }];
  setSetting(database, 'serviceAddresses', 'plex.url', 'http://plex.test');
  setSetting(database, 'credentials', 'plex.token', 'plex-token');
  const plex = createPlex(database, {
    fetch: async (url) => {
      const path = String(url).slice('http://plex.test'.length);
      plexRequests.push(path);
      return new Response(path === '/library/sections' ? JSON.stringify({ MediaContainer: { Directory: sections } }) : '', { status: 200 });
    },
  });
  const problems = createProblems({ database, events: createEventHub() });
  const versionImport = createVersionImport({ database, rtorrent, arr, mediaServer: () => plex, problems });

  // Copying instead of linking, linking an extra or a sample, or recording the event twice on a rerun turns this red.
  const duneHash = 'A1'.repeat(20);
  const duneFolder = await addTorrent(duneHash, ['Dune.Part.Two.2160p-FraMeSToR.mkv', 'Sample/dune-sample.mkv', 'Dune.nfo']);
  addRows(duneHash, [{ movieId: 9 }], { releaseTitle: 'Dune.Part.Two.2024.2160p.UHD.BluRay.x265-FraMeSToR' });
  await versionImport.run();
  const dunePath = join(movies, 'Dune - Part Two (2024)', 'Dune - Part Two (2024) - Bluray-2160p FraMeSToR.mkv');
  assert.deepEqual(rows(duneHash), [{ state: 'imported', failure: null, file_path: dunePath }]);
  // Not recording the linked file's device and inode, which a delete checks before unlinking, turns this red.
  const duneInode = await stat(dunePath, { bigint: true });
  assert.equal(database.prepare('SELECT file_inode FROM second_versions WHERE hash = ?').get(duneHash).file_inode, `${duneInode.dev}:${duneInode.ino}`);
  const linked = await stat(dunePath);
  assert.equal(linked.ino, (await stat(join(duneFolder, 'Dune.Part.Two.2160p-FraMeSToR.mkv'))).ino);
  assert.equal(linked.nlink, 2);
  assert.deepEqual(await readdir(join(movies, 'Dune - Part Two (2024)')), ['Dune - Part Two (2024) - Bluray-2160p FraMeSToR.mkv']);
  assert.equal(eventCount(), 1);
  assert.deepEqual(plexRequests, ['/library/sections', `/library/sections/3/refresh?path=${encodeURIComponent(join(movies, 'Dune - Part Two (2024)'))}`]);
  await versionImport.run();
  assert.deepEqual([rows(duneHash)[0].state, eventCount(), plexRequests.length, (await stat(dunePath)).nlink], ['imported', 1, 2, 2]);

  // Linking again over an import a restart interrupted, or overwriting a different file already holding the name, turns this red.
  const arrivalHash = 'A2'.repeat(20);
  const arrivalFolder = await addTorrent(arrivalHash, ['Arrival.mkv']);
  addRows(arrivalHash, [{ movieId: 10 }], { quality: 'Remux-1080p', state: 'importing' });
  await mkdir(join(movies, 'Arrival (2016)'));
  await link(join(arrivalFolder, 'Arrival.mkv'), join(movies, 'Arrival (2016)', 'Arrival (2016) - Remux-1080p GRP.mkv'));
  const heatHash = 'A3'.repeat(20);
  await addTorrent(heatHash, ['Heat.mkv']);
  addRows(heatHash, [{ movieId: 11 }], { quality: 'Remux-1080p' });
  await mkdir(join(movies, 'Heat (1995)'));
  await writeFile(join(movies, 'Heat (1995)', 'Heat (1995) - Remux-1080p GRP.mkv'), 'someone else');
  await versionImport.run();
  assert.equal(rows(arrivalHash)[0].file_path, join(movies, 'Arrival (2016)', 'Arrival (2016) - Remux-1080p GRP.mkv'));
  assert.equal((await stat(join(arrivalFolder, 'Arrival.mkv'))).nlink, 2);
  assert.equal(rows(heatHash)[0].file_path, join(movies, 'Heat (1995)', 'Heat (1995) - Remux-1080p GRP (2).mkv'));
  assert.equal(await readFile(join(movies, 'Heat (1995)', 'Heat (1995) - Remux-1080p GRP.mkv'), 'utf8'), 'someone else');
  assert.equal(eventCount(), 3);

  // Picking one of two video files for a movie instead of stopping, or importing an unfinished torrent, turns this red.
  const twoHash = 'A4'.repeat(20);
  await addTorrent(twoHash, ['Alien.mkv', 'Alien.Extended.mkv']);
  addRows(twoHash, [{ movieId: 12 }]);
  const unfinishedHash = 'A5'.repeat(20);
  await addTorrent(unfinishedHash, ['Unfinished.mkv'], { complete: 0 });
  addRows(unfinishedHash, [{ movieId: 12 }]);
  await versionImport.run();
  assert.deepEqual(rows(twoHash), [{ state: 'failed', failure: 'The torrent has 2 video files; one was expected.', file_path: null }]);
  // Dropping the code from a failed match turns this red.
  assert.equal(failureCode(twoHash), 'import_no_match');
  assert.deepEqual(problemsFor(IMPORT_PROBLEM_KIND), [
    { subject_id: '12', state: 'needs_you', summary: 'Alien (1979) (second version): The torrent has 2 video files; one was expected.' },
  ]);
  assert.equal(rows(unfinishedHash)[0].state, 'downloading');
  database.prepare('DELETE FROM second_versions WHERE hash = ?').run(unfinishedHash);

  // Pre-checking device numbers instead of linking, or leaving the folder made for a link that failed, turns this red.
  const otherDrive = join(root, 'versions', 'other-drive');
  await mkdir(otherDrive);
  setSetting(database, 'hostPaths', 'versions.radarr', otherDrive);
  const otherDriveHash = 'A6'.repeat(20);
  await addTorrent(otherDriveHash, ['Heat.mkv']);
  addRows(otherDriveHash, [{ movieId: 11 }]);
  const restoreLinks = failLinks('EXDEV');
  try {
    await versionImport.run();
  } finally {
    restoreLinks();
  }
  assert.equal(rows(otherDriveHash)[0].state, 'failed');
  assert.match(rows(otherDriveHash)[0].failure, /different drives/);
  assert.match(problemsFor(IMPORT_PROBLEM_KIND).at(-1).summary, /^Heat \(1995\) \(second version\): .*different drives/);
  assert.deepEqual(await readdir(otherDrive), []);
  setSetting(database, 'hostPaths', 'versions.radarr', movies);

  // Importing TV before its versions folder is set, matching pack files by order instead of SxxEyy, or importing the extra episode turns this red.
  const packHash = 'B1'.repeat(20);
  await addTorrent(packHash, ['Andor.S01/Andor.S01E02.mkv', 'Andor.S01/Andor.S01E01.mkv', 'Andor.S01/andor.1x03.mkv', 'Andor.S01/Andor.S01E04.mkv']);
  addRows(packHash, [{ episodeId: 101 }, { episodeId: 102 }, { episodeId: 103 }], { quality: 'WEBDL-2160p' });
  await versionImport.run();
  assert.deepEqual(rows(packHash).map((row) => row.state), ['downloading', 'downloading', 'downloading']);
  // Waiting on an unset folder without telling the owner, or never clearing that once imports work, turns this red.
  const folderProblems = () => problemsFor(FOLDER_PROBLEM_KIND).map((problem) => [problem.subject_id, problem.summary]);
  assert.deepEqual(folderProblems(), [['versions.sonarr', 'Set hostPaths versions.sonarr to an absolute folder: finished second versions are waiting to import.']]);
  setSetting(database, 'hostPaths', 'versions.sonarr', tv);
  await versionImport.run();
  assert.deepEqual(folderProblems(), []);
  const season = join(tv, 'Andor', 'Season 01');
  assert.deepEqual(rows(packHash).map((row) => [row.state, row.file_path]), [1, 2, 3].map((episode) => ['imported', join(season, `Andor - S01E0${episode} - WEBDL-2160p GRP.mkv`)]));
  assert.equal((await stat(join(season, 'Andor - S01E01 - WEBDL-2160p GRP.mkv'))).ino, (await stat(join(downloads, packHash, 'Andor.S01/Andor.S01E01.mkv'))).ino);
  assert.equal((await readdir(season)).length, 3);
  // Importing without telling the owner that no Plex TV library reads the folder turns this red.
  assert.deepEqual(problemsFor(PLEX_PROBLEM_KIND), [{ subject_id: tv, state: 'needs_you', summary: `Add ${tv} to the Plex TV library.` }]);

  // Failing the whole pack for one missing episode, or picking one of two files for an episode, turns this red.
  const gapHash = 'B2'.repeat(20);
  await addTorrent(gapHash, ['Andor.S02E01.mkv', 'Andor.S02E03.mkv', 'Andor.S02E03.REPACK.mkv']);
  addRows(gapHash, [{ episodeId: 104 }, { episodeId: 105 }, { episodeId: 106 }], { quality: 'WEBDL-2160p' });
  sections = [...sections, { key: '4', type: 'show', Location: [{ path: tv }] }];
  await versionImport.run();
  assert.deepEqual(rows(gapHash).map((row) => [row.state, row.failure]), [
    ['imported', null],
    ['failed', 'No video file in the pack is S02E02.'],
    ['failed', '2 video files in the pack are S02E03.'],
  ]);
  assert.deepEqual(problemsFor(IMPORT_PROBLEM_KIND).map((problem) => problem.summary).slice(2), [
    'Andor S02E02 (second version): No video file in the pack is S02E02.',
    'Andor S02E03 (second version): 2 video files in the pack are S02E03.',
  ]);
  assert.deepEqual(problemsFor(PLEX_PROBLEM_KIND), [], 'a Plex TV library reading the folder resolves the problem');
  assert.equal(plexRequests.at(-1), `/library/sections/4/refresh?path=${encodeURIComponent(join(tv, 'Andor', 'Season 02'))}`);

  // Treating the last episode a restart left unimported in a pack as a single episode turns this red.
  const halfHash = 'B3'.repeat(20);
  await addTorrent(halfHash, ['Andor.S01E01.mkv', 'Andor.S01E02.mkv']);
  addRows(halfHash, [{ episodeId: 101 }], { quality: 'HDTV-720p', state: 'imported' });
  addRows(halfHash, [{ episodeId: 102 }], { quality: 'HDTV-720p', state: 'importing' });
  await versionImport.run();
  assert.deepEqual(rows(halfHash).map((row) => [row.state, row.file_path]), [['imported', null], ['imported', join(season, 'Andor - S01E02 - HDTV-720p GRP.mkv')]]);

  // Naming only the first episode of a file holding two, linking it twice, or failing the second row, turns this red.
  const doubleHash = 'B4'.repeat(20);
  await addTorrent(doubleHash, ['Andor.S03E01E02.mkv', 'Andor.S03E03.mkv']);
  addRows(doubleHash, [{ episodeId: 107 }, { episodeId: 108 }, { episodeId: 109 }], { quality: 'WEBDL-1080p' });
  await versionImport.run();
  const double = join(tv, 'Andor', 'Season 03', 'Andor - S03E01-E02 - WEBDL-1080p GRP.mkv');
  assert.deepEqual(rows(doubleHash).map((row) => [row.state, row.file_path]), [
    ['imported', double],
    ['imported', double],
    ['imported', join(tv, 'Andor', 'Season 03', 'Andor - S03E03 - WEBDL-1080p GRP.mkv')],
  ]);
  assert.equal((await stat(join(downloads, doubleHash, 'Andor.S03E01E02.mkv'))).nlink, 2);

  // Failing a row for a missing or read-only versions folder, instead of waiting for the owner to fix it, turns this red.
  const missing = join(root, 'versions', 'missing');
  setSetting(database, 'hostPaths', 'versions.radarr', missing);
  const waitHash = 'A7'.repeat(20);
  await addTorrent(waitHash, ['Dune.Remux.mkv']);
  addRows(waitHash, [{ movieId: 9 }], { quality: 'Remux-2160p' });
  await versionImport.run();
  assert.equal(rows(waitHash)[0].state, 'importing');
  assert.deepEqual(folderProblems().map(([subject]) => subject), ['versions.radarr']);
  assert.match(folderProblems()[0][1], new RegExp(`^Second versions cannot be imported into ${missing} \\(hostPaths versions\\.radarr\\): ENOENT`));
  await mkdir(missing);
  if (process.getuid?.() !== 0) {
    await chmod(missing, 0o555);
    await versionImport.run();
    assert.equal(rows(waitHash)[0].state, 'importing', 'a read-only folder waits too');
    await chmod(missing, 0o755);
  }
  await versionImport.run();
  assert.equal(rows(waitHash)[0].state, 'imported');
  assert.deepEqual(folderProblems(), []);

  // Leaving the "not imported" problem open after a later second version of the same movie imports turns this red.
  assert.equal(problemsFor(IMPORT_PROBLEM_KIND).some((problem) => problem.subject_id === '12'), true);
  const alienHash = 'A8'.repeat(20);
  await addTorrent(alienHash, ['Alien.mkv']);
  addRows(alienHash, [{ movieId: 12 }]);
  await versionImport.run();
  assert.equal(rows(alienHash)[0].state, 'imported');
  assert.equal(problemsFor(IMPORT_PROBLEM_KIND).some((problem) => problem.subject_id === '12'), false);

  // Clearing the folder problem only on a successful import, so a fixed folder stays flagged while its row fails for another reason, turns this red.
  const gone = join(root, 'versions', 'gone');
  setSetting(database, 'hostPaths', 'versions.radarr', gone);
  fake.radarr.state.movies.push(movieRecord({ id: 13, title: 'Ronin', year: 1998 }));
  const roninHash = 'A9'.repeat(20);
  await addTorrent(roninHash, ['Ronin.mkv']);
  addRows(roninHash, [{ movieId: 13 }]);
  await versionImport.run();
  assert.deepEqual(folderProblems().map(([subject]) => subject), ['versions.radarr']);
  await mkdir(gone);
  fake.radarr.state.movies = fake.radarr.state.movies.filter((movie) => movie.id !== 13);
  await versionImport.run();
  assert.deepEqual(rows(roninHash).map((row) => [row.state, row.failure]), [['failed', 'Radarr no longer has this movie.']]);
  assert.deepEqual(folderProblems(), []);

  // Leaving a row whose torrent left rTorrent as downloading, which no import ever moves on and a delete refuses, turns this red.
  const { createSecondVersionRoutes } = await import(secondVersionsModuleUrl);
  const { createSecondVersionDelete } = await import(secondVersionDeleteModuleUrl);
  const lostHash = 'B0'.repeat(20);
  await addTorrent(lostHash, ['Lost.mkv'], { complete: 0 });
  addRows(lostHash, [{ movieId: 10 }]);
  database.prepare('UPDATE torrents SET gone_at = 1 WHERE hash = ?').run(lostHash);
  await versionImport.run();
  assert.deepEqual([rows(lostHash)[0].state, failureCode(lostHash)], ['failed', 'torrent_gone']);
  const deletes = createSecondVersionRoutes({}, createSecondVersionDelete({ database, removeTorrent: async () => assert.fail('not asked'), scan: async () => {} }));
  const lostId = database.prepare('SELECT id FROM second_versions WHERE hash = ?').get(lostHash).id;
  const deleted = await deletes.request(`/${lostId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removeTorrent: false }) });
  assert.equal(deleted.status, 200);
});

test('deleting a second version removes only its own file, and its torrent only when asked and nothing else uses it', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createTorrentPoller } = await import(torrentsModuleUrl);
  const { createTorrentFiles } = await import(torrentFilesModuleUrl);
  const { createSecondVersionRoutes } = await import(secondVersionsModuleUrl);
  const { createSecondVersionDelete } = await import(secondVersionDeleteModuleUrl);
  const root = await realpath(await mkdtemp(join(tmpdir(), 'media-manager-2-version-delete-')));
  const database = openDatabase(join(root, 'db', 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const at = (...parts) => join(root, ...parts);
  const exists = async (path) => lstat(path).then(() => true, () => false);
  for (const folder of ['downloads', 'library', 'versions/movies', 'versions/tv', 'other']) await mkdir(at(folder), { recursive: true });
  setSetting(database, 'hostPaths', 'downloads.radarr', at('downloads'));
  setSetting(database, 'hostPaths', 'library.radarr', at('library'));
  setSetting(database, 'hostPaths', 'versions.radarr', at('versions/movies'));
  setSetting(database, 'hostPaths', 'versions.sonarr', at('versions/tv'));

  // Single-file torrents sit side by side in downloads; packs get their own folder.
  const fake = { torrents: [], calls: [], eraseFails: false, erased: [] };
  const rtorrent = {
    call: async (method, params) => {
      fake.calls.push(method);
      if (method === 'd.multicall2' && params.length === 5) return fake.torrents.map((torrent) => [torrent.hash, torrent.hash, at(torrent.directory)]);
      if (method === 'd.multicall2') return fake.torrents.map((torrent) => [torrent.hash, torrent.hash, 1, 1, 0, 0, 1, 1, 1, 1, '', 0, 0, 0, 0, at(torrent.directory)]);
      if (method === 't.multicall') return [];
      const torrent = fake.torrents.find((candidate) => candidate.hash === params[0]);
      if (torrent === undefined) throw new Error('rTorrent fault -501: Could not find info-hash.');
      if (method === 'f.multicall') return torrent.files.map((file) => [file, 1]);
      if (method === 'd.directory') return at(torrent.directory);
      if (method === 'd.is_multi_file') return torrent.files.length > 1 ? 1 : 0;
      if (method === 'd.erase') {
        if (fake.eraseFails) throw new Error('rTorrent fault -1: busy');
        fake.erased.push(params[0]);
        fake.torrents = fake.torrents.filter((candidate) => candidate !== torrent);
        return 0;
      }
      throw new Error(`Unexpected ${method}`);
    },
  };
  const { fake: _arrFake, ...arr } = connectArr(database);
  const poller = createTorrentPoller({ database, rtorrent, events: createEventHub() });
  const { removeTorrent } = createTorrentFiles({ database, rtorrent, arr });
  const scans = [];
  const routes = createSecondVersionRoutes({}, createSecondVersionDelete({
    database, removeTorrent, scan: async (service, folder, folders) => { scans.push([service, folder, [...folders]]); },
  }));
  const remove = async (id, body) => {
    const response = await routes.request(`/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  let nextId = 0;
  // A torrent holding the files, polled into the torrents table later.
  const addTorrent = async (hash, directory, files) => {
    for (const file of files) {
      await mkdir(dirname(at(directory, file)), { recursive: true });
      await writeFile(at(directory, file), `${hash} ${file}`);
    }
    fake.torrents.push({ hash, directory, files });
  };
  // A row whose file is a hardlink of `source`, its inode recorded as the import records it.
  const addVersion = async (hash, subject, source, destination, { state = 'imported', linkIt = true } = {}) => {
    nextId += 1;
    if (linkIt) {
      await mkdir(dirname(destination), { recursive: true });
      await link(source, destination);
    }
    const stats = linkIt ? await stat(destination, { bigint: true }) : undefined;
    database.prepare(`
      INSERT INTO second_versions (id, service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, hash, state, file_path, file_inode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Release-GRP', 'g', 'Blutopia', 'Bluray-2160p', ?, ?, ?, ?, 1, 1)
    `).run(nextId, subject.movieId === undefined ? 'sonarr' : 'radarr', subject.movieId ?? null, subject.movieId === undefined ? 5 : null,
      subject.episodeId ?? null, hash, state, state === 'imported' ? destination : null, stats === undefined ? null : `${stats.dev}:${stats.ino}`);
    return nextId;
  };
  const row = (id) => ({ ...database.prepare('SELECT state, deleted_at FROM second_versions WHERE id = ?').get(id) });
  const events = (id) => database.prepare('SELECT kind, detail FROM version_events WHERE second_version_id = ? ORDER BY id').all(id).map((event) => [event.kind, event.detail]);

  const [dune, arrival, heat, pack, double, busy, kept, sibling] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'].map((pair) => pair.repeat(20));
  await addTorrent(dune, 'downloads', ['Dune.mkv']);
  await addTorrent(arrival, 'downloads', ['Arrival.mkv']);
  await addTorrent(heat, 'downloads', ['Heat.mkv']);
  await addTorrent(pack, 'downloads/Andor.S01', ['Andor.S01E03.mkv', 'Andor.S01E04.mkv']);
  await addTorrent(double, 'downloads/Andor.S01E01E02', ['Andor.S01E01E02.mkv']);
  await addTorrent(busy, 'downloads', ['Busy.mkv']);
  await addTorrent(kept, 'downloads', ['Kept.mkv']);
  await addTorrent(sibling, 'downloads', ['Sibling.mkv']);
  await poller.poll();

  const duneFile = at('versions/movies/Dune (2021)/Dune (2021) - Bluray-2160p GRP.mkv');
  const duneId = await addVersion(dune, { movieId: 1 }, at('downloads/Dune.mkv'), duneFile);
  const arrivalId = await addVersion(arrival, { movieId: 2 }, at('downloads/Arrival.mkv'), at('versions/movies/Arrival (2016)/Arrival.mkv'));
  const heatFile = at('versions/movies/Heat (1995)/Heat.mkv');
  const heatId = await addVersion(heat, { movieId: 3 }, at('downloads/Heat.mkv'), heatFile);
  const outsideId = await addVersion(heat, { movieId: 4 }, at('downloads/Heat.mkv'), at('library/Heat.mkv'));
  const doubleFile = at('versions/tv/Andor/Season 01/Andor - S01E01-E02.mkv');
  const firstHalf = await addVersion(double, { episodeId: 101 }, at('downloads/Andor.S01E01E02/Andor.S01E01E02.mkv'), doubleFile);
  const secondHalf = await addVersion(double, { episodeId: 102 }, null, doubleFile, { linkIt: false });
  database.prepare('UPDATE second_versions SET file_path = ?, file_inode = (SELECT file_inode FROM second_versions WHERE id = ?) WHERE id = ?').run(doubleFile, firstHalf, secondHalf);
  const packE3 = await addVersion(pack, { episodeId: 103 }, at('downloads/Andor.S01/Andor.S01E03.mkv'), at('versions/tv/Andor/Season 01/Andor - S01E03.mkv'));
  const packE4 = await addVersion(pack, { episodeId: 104 }, at('downloads/Andor.S01/Andor.S01E04.mkv'), at('versions/tv/Andor/Season 01/Andor - S01E04.mkv'));
  const busyId = await addVersion(busy, { movieId: 5 }, at('downloads/Busy.mkv'), at('versions/movies/Busy (2000)/Busy.mkv'));
  const keptId = await addVersion(kept, { movieId: 6 }, at('downloads/Kept.mkv'), at('versions/movies/Kept (2000)/Kept.mkv'));
  await link(at('downloads/Kept.mkv'), at('library/Kept.mkv'));
  const downloadingId = await addVersion(sibling, { movieId: 7 }, null, null, { state: 'downloading', linkIt: false });
  await writeFile(at('other/Arrival.mkv'), 'not the torrent');
  fake.calls = [];

  // Accepting a body other than exactly { removeTorrent: boolean }, or an unknown id, turns this red.
  assert.equal((await remove(duneId, {})).status, 400);
  assert.equal((await remove(duneId, { removeTorrent: 'yes' })).status, 400);
  assert.equal((await remove(duneId, { removeTorrent: false, force: true })).status, 400);
  assert.equal((await remove(999, { removeTorrent: false })).status, 404);
  // Deleting a version an import or a send may still be writing turns this red.
  assert.equal((await remove(downloadingId, { removeTorrent: true })).status, 409);

  // Keep: touching rTorrent at all, leaving the file, removing the versions folder, or not marking the row turns this red.
  const keep = await remove(duneId, { removeTorrent: false });
  assert.equal(keep.status, 200);
  assert.deepEqual([keep.body.deleted, keep.body.torrent], [{ path: duneFile }, { removed: false, reason: 'Kept seeding, as chosen.' }]);
  assert.equal(Array.isArray(keep.body.secondVersions), true);
  assert.deepEqual(fake.calls, []);
  assert.deepEqual([await exists(duneFile), await exists(at('versions/movies/Dune (2021)')), await exists(at('versions/movies'))], [false, false, true]);
  assert.equal((await stat(at('downloads/Dune.mkv'))).nlink, 1);
  assert.equal(row(duneId).state, 'deleted');
  assert.equal(typeof row(duneId).deleted_at, 'number');
  assert.deepEqual(events(duneId), [['deleted', 'Dune (2021) - Bluray-2160p GRP.mkv'], ['torrent_kept', 'Kept seeding, as chosen.']]);
  assert.deepEqual(scans, [['radarr', at('versions/movies'), [at('versions/movies')]]]);
  assert.equal((await remove(duneId, { removeTorrent: false })).status, 404, 'a deleted version is gone');

  // Remove: erasing outside removeTorrent, deleting a same-named file outside the torrent, or the shared folder's other files turns this red.
  const removed = await remove(arrivalId, { removeTorrent: true });
  assert.deepEqual([removed.status, removed.body.torrent], [200, { removed: true }]);
  assert.deepEqual(fake.erased, [arrival]);
  assert.deepEqual([await exists(at('downloads/Arrival.mkv')), await exists(at('other/Arrival.mkv')), await exists(at('downloads/Sibling.mkv'))], [false, true, true]);
  assert.deepEqual(events(arrivalId).map(([kind]) => kind), ['deleted', 'torrent_removed']);

  // An inode mismatch, or a path outside the versions folder by name or through a folder link, deleting anything turns this red.
  await rm(heatFile);
  await writeFile(heatFile, 'someone else');
  fake.calls = [];
  const mismatch = await remove(heatId, { removeTorrent: false });
  assert.equal(mismatch.status, 409);
  assert.match(mismatch.body.reason, /no longer the file imported there/);
  assert.equal(await readFile(heatFile, 'utf8'), 'someone else');
  const outside = await remove(outsideId, { removeTorrent: false });
  assert.equal(outside.status, 409);
  assert.match(outside.body.reason, /outside hostPaths versions\.radarr/);
  await symlink(at('library'), at('versions/movies/Linked'));
  database.prepare('UPDATE second_versions SET file_path = ? WHERE id = ?').run(at('versions/movies/Linked/Heat.mkv'), outsideId);
  assert.match((await remove(outsideId, { removeTorrent: false })).body.reason, /outside hostPaths versions\.radarr/);
  assert.deepEqual([await exists(at('library/Heat.mkv')), row(heatId).state, row(outsideId).state, fake.calls], [true, 'imported', 'imported', []]);
  // canRemoveTorrent refuses while any folder link sits in a versions folder.
  await rm(at('versions/movies/Linked'));

  // Deleting a file another row still uses, or keeping it after the last one, turns this red.
  const first = await remove(firstHalf, { removeTorrent: false });
  assert.deepEqual([first.status, first.body.deleted, await exists(doubleFile)], [200, null, true]);
  assert.deepEqual(events(firstHalf)[0], ['deleted', 'The file stays: another second version uses it.']);
  const last = await remove(secondHalf, { removeTorrent: false });
  assert.deepEqual([last.body.deleted, await exists(doubleFile)], [{ path: doubleFile }, false]);
  assert.equal(await exists(at('versions/tv/Andor/Season 01')), true, 'the pack episodes still fill the season folder');

  // Removing a pack's torrent while another episode's version still uses it, or deleting that episode's file anyway, turns this red.
  fake.calls = [];
  const refusedPack = await remove(packE3, { removeTorrent: true });
  assert.equal(refusedPack.status, 409);
  assert.match(refusedPack.body.reason, /Another second version uses this torrent/);
  assert.deepEqual([await exists(at('versions/tv/Andor/Season 01/Andor - S01E03.mkv')), row(packE3).state, fake.calls], [true, 'imported', []]);
  assert.equal((await remove(packE3, { removeTorrent: false })).status, 200);
  assert.deepEqual((await remove(packE4, { removeTorrent: true })).body.torrent, { removed: true });
  assert.deepEqual([await exists(at('downloads/Andor.S01')), await exists(at('versions/tv/Andor')), await exists(at('versions/tv'))], [false, false, true]);

  // Undoing the file delete, or reporting the torrent removed, when d.erase fails turns this red.
  fake.eraseFails = true;
  const failedErase = await remove(busyId, { removeTorrent: true });
  assert.equal(failedErase.status, 200);
  assert.equal(failedErase.body.deleted.path, at('versions/movies/Busy (2000)/Busy.mkv'));
  assert.equal(failedErase.body.torrent.removed, false);
  assert.match(failedErase.body.torrent.reason, /did not remove the torrent .*busy/);
  assert.equal(await exists(at('downloads/Busy.mkv')), true);
  assert.equal(events(busyId).at(-1)[0], 'torrent_kept');
  fake.eraseFails = false;

  // Removing a torrent that still backs a kept library file, or hiding canRemoveTorrent's reason, turns this red.
  const refusedRemoval = await remove(keptId, { removeTorrent: true });
  assert.equal(refusedRemoval.body.torrent.removed, false);
  assert.match(refusedRemoval.body.torrent.reason, /shares its data with the library file .*Kept\.mkv/);
  assert.equal(await exists(at('downloads/Kept.mkv')), true);
});

// Reading tracked paths with a bare prefix match, resolving a problem after a failed Sonarr or Radarr read, or touching
// the file when a title disappears turns this red.
test('second versions are served under their movie and series, and a check flags ones that lose their title', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createProblems, listOpenProblems } = await import(problemsModuleUrl);
  const { createLibrary, createLibraryRoutes } = await import(libraryModuleUrl);
  const { createSecondVersionChecks, listSecondVersionRows } = await import(secondVersionRowsModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-version-rows-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  await saveOwnerRules(database);
  const versions = { radarr: join(root, 'versions', 'radarr'), sonarr: join(root, 'versions', 'sonarr') };
  const movieFile = join(versions.radarr, 'Dune (2021)', 'Dune (2021) - Remux-2160p FLUX.mkv');
  const episodeFile = join(versions.sonarr, 'Show', 'Season 01', 'Show - S01E01 - WEBDL-2160p NTb.mkv');
  for (const path of [movieFile, episodeFile]) {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, 'video');
  }
  const { fake, ...arr } = connectArr(database);
  const file = (relativePath) => ({ id: 1, relativePath, size: 5, quality: { quality: { name: 'Bluray-1080p' } } });
  fake.radarr.state.movies = [
    movieRecord({ id: 9, title: 'Dune', path: join(root, 'library', 'Dune (2021)'), hasFile: true, movieFile: file('Dune (2021) - Bluray-1080p.mkv') }),
    // Beside the versions folder, not inside it.
    movieRecord({ id: 10, path: `${versions.radarr}-old/Other`, hasFile: true, movieFile: file('Other.mkv') }),
  ];
  fake.sonarr.state.series = [seriesRecord({ id: 5, title: 'Show', path: join(root, 'library', 'Show') })];
  fake.sonarr.state.episodes = [101, 102].map((id) => episodeRecord({ id, seriesId: 5, episodeNumber: id - 100 }));

  const insert = (values) => {
    const row = { movie_id: null, series_id: null, episode_id: null, file_path: null, imported_at: null, failure: null, ...values };
    database.prepare(`
      INSERT INTO second_versions (service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, size_bytes, hash, state, failure, file_path, created_at, updated_at, imported_at)
      VALUES (?, ?, ?, ?, ?, 'guid', 'Blutopia', ?, 1000, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.service, row.movie_id, row.series_id, row.episode_id, row.title, row.quality, row.hash, row.state, row.failure, row.file_path, row.created_at, row.created_at, row.imported_at);
  };
  insert({ service: 'radarr', movie_id: 9, title: 'Dune.2021.2160p.Remux-FLUX', quality: 'Remux-2160p', hash: 'M'.repeat(40), state: 'imported', file_path: movieFile, created_at: 100, imported_at: 200 });
  insert({ service: 'radarr', movie_id: 9, title: 'Dune 2021 old', quality: 'WEBDL-720p', hash: 'D'.repeat(40), state: 'deleted', created_at: 50 });
  insert({ service: 'sonarr', series_id: 5, episode_id: 101, title: 'Show.S01E01.2160p-NTb', quality: 'WEBDL-2160p', hash: 'E'.repeat(40), state: 'imported', file_path: episodeFile, created_at: 300, imported_at: 400 });
  insert({ service: 'sonarr', series_id: 5, episode_id: 102, title: 'Show S01E02 [web]', quality: 'WEBDL-2160p', hash: 'F'.repeat(40), state: 'downloading', created_at: 500 });
  insert({ service: 'sonarr', series_id: 5, episode_id: 102, title: 'Show.S01E02-BAD', quality: 'WEBDL-2160p', hash: null, state: 'failed', failure: 'The download link returned a web page, not a torrent file.', created_at: 600 });
  const torrent = database.prepare("INSERT INTO torrents VALUES (?, ?, 1000, ?, ?, 7, 1, 1, 1, ?, '', 0, ?, 0, 0, 'blutopia.cc', 1, 1, NULL, ?, '')");
  torrent.run('M'.repeat(40), 'Dune', 1000, 0, 1, 1500, 7200);
  torrent.run('F'.repeat(40), 'Show S01E02', 400, 100, 0, 0, 0);
  database.prepare('INSERT INTO stall_watch (hash, replaced_at) VALUES (?, 550)').run('F'.repeat(40));

  const routes = createLibraryRoutes(createLibrary(arr, (title) => listSecondVersionRows(database, title)));
  const read = async (path) => (await routes.request(path)).json();

  // The tracked version and the second version come back in one answer; a deleted second version does not.
  const movie = await read('/movie/9');
  assert.equal(movie.file.relativePath, 'Dune (2021) - Bluray-1080p.mkv');
  assert.deepEqual(movie.secondVersions, [{
    id: 1, service: 'radarr', movieId: 9, seriesId: null, episodeId: null, state: 'imported', failure: null,
    releaseTitle: 'Dune.2021.2160p.Remux-FLUX', indexer: 'Blutopia', quality: 'Remux-2160p', group: 'FLUX', sizeBytes: 1000,
    addedAt: 100, importedAt: 200, hash: 'M'.repeat(40), path: movieFile, percent: null,
    seeding: { inRtorrent: true, complete: true, ratio: 1.5, seedingSeconds: 7200, upRate: 7, trackerHost: 'blutopia.cc' },
    failureCode: null, stalled: false, etaSeconds: null,
    hitAndRun: { host: 'blutopia.cc', requiredHours: 168, seededHours: 2, ratio: 1.5, requiredRatio: null, met: false },
  }]);
  const show = await read('/series/5');
  assert.deepEqual(show.secondVersions.map((row) => [row.episodeId, row.state, row.group, row.percent, row.seeding?.complete ?? null, row.failure]), [
    [101, 'imported', 'NTb', null, null, null],
    [102, 'downloading', null, 40, false, null],
    [102, 'failed', 'BAD', null, null, 'The download link returned a web page, not a torrent file.'],
  ]);
  // Judging an incomplete torrent by the complete seed time, an ETA from the whole size instead of the bytes left, or
  // calling a flagged downloading row anything but stalled turns this red.
  assert.deepEqual(show.secondVersions.map((row) => [row.hitAndRun, row.etaSeconds, row.stalled]), [
    [null, null, false],
    [{ host: 'blutopia.cc', requiredHours: null, seededHours: 0, ratio: 0, requiredRatio: null, met: false }, 6, true],
    [null, null, false],
  ]);
  // Counting a stall flag set before the row was created (an earlier use of the same torrent) turns this red.
  database.prepare('UPDATE stall_watch SET replaced_at = 499 WHERE hash = ?').run('F'.repeat(40));
  assert.equal((await read('/series/5')).secondVersions[1].stalled, false);

  // Not judging a met rule as met, or failing the whole page on an invalid saved rule, turns these red.
  setSetting(database, 'trackerConfiguration', 'rules.blutopia.cc', JSON.stringify({ seedHours: [{ hours: 2 }] }));
  assert.deepEqual((await read('/movie/9')).secondVersions[0].hitAndRun,
    { host: 'blutopia.cc', requiredHours: 2, seededHours: 2, ratio: 1.5, requiredRatio: null, met: true });
  setSetting(database, 'trackerConfiguration', 'rules.blutopia.cc', 'not json');
  const broken = await routes.request('/movie/9');
  assert.equal(broken.status, 200);
  assert.equal((await broken.json()).secondVersions[0].hitAndRun, null);

  const problems = createProblems({ database, events: createEventHub() });
  const checks = createSecondVersionChecks({ database, arr, problems });
  const open = () => listOpenProblems(database).map((problem) => `${problem.kind} ${problem.subject.service} ${problem.subject.id} ${problem.state}`).sort();
  const inode = async () => (await stat(movieFile)).ino;

  // No versions folders set: only the orphan and missing-file checks run, and nothing is wrong yet.
  await checks.check();
  assert.deepEqual(open(), []);
  setSetting(database, 'hostPaths', 'versions.radarr', versions.radarr);
  setSetting(database, 'hostPaths', 'versions.sonarr', versions.sonarr);

  // A Radarr upgrade, rename and refresh changes only the tracked file.
  const before = { rows: listSecondVersionRows(database, { service: 'radarr', movieId: 9 }), inode: await inode() };
  fake.radarr.state.movies[0].movieFile = { ...file('Dune (2021) - Remux-2160p.mkv'), id: 2 };
  assert.equal((await arr.radarr.refreshTitle(9)).kind, 'ok');
  await checks.check();
  assert.deepEqual(open(), []);
  assert.deepEqual(listSecondVersionRows(database, { service: 'radarr', movieId: 9 }), before.rows);
  assert.equal(await inode(), before.inode);

  // Tracked files inside a versions folder, a movie and an episode gone, and an imported file missing.
  fake.radarr.state.movies.push(movieRecord({ id: 11, path: join(versions.radarr, 'Stray'), hasFile: true, movieFile: file('Stray.mkv') }));
  fake.sonarr.state.series.push(seriesRecord({ id: 6, path: join(versions.sonarr, 'Wrong') }));
  fake.sonarr.state.episodes.push(episodeRecord({ id: 201, seriesId: 6, hasFile: true, episodeFile: file('Season 01/Wrong - S01E01.mkv') }));
  fake.radarr.state.movies = fake.radarr.state.movies.filter((record) => record.id !== 9);
  fake.sonarr.state.episodes = fake.sonarr.state.episodes.filter((record) => record.id !== 102);
  await rm(episodeFile);
  await checks.check();
  assert.deepEqual(open(), [
    'second_version_missing sonarr 101 needs_you',
    'second_version_orphaned radarr 9 needs_you',
    'second_version_orphaned sonarr 102 needs_you',
    'tracked_in_versions_folder radarr 11 needs_you',
    'tracked_in_versions_folder sonarr 201 needs_you',
  ]);
  const orphan = listOpenProblems(database).find((problem) => problem.kind === 'second_version_orphaned' && problem.subject.id === '9');
  assert.equal(orphan.summary, `Radarr no longer has this movie. Its second version (Dune.2021.2160p.Remux-FLUX) was left alone: ${movieFile}`);
  assert.equal(await inode(), before.inode, 'the orphaned file is kept');

  // Radarr down: its problems stay open although the cause is gone; the missing file coming back resolves at once.
  fake.radarr.state.movies = fake.radarr.state.movies.filter((record) => record.id !== 11);
  fake.radarr.state.down = true;
  await writeFile(episodeFile, 'video');
  await checks.check();
  assert.deepEqual(open(), [
    'second_version_orphaned radarr 9 needs_you',
    'second_version_orphaned sonarr 102 needs_you',
    'tracked_in_versions_folder radarr 11 needs_you',
    'tracked_in_versions_folder sonarr 201 needs_you',
  ]);
  fake.radarr.state.down = false;
  await checks.check();
  assert.deepEqual(open(), [
    'second_version_orphaned radarr 9 needs_you',
    'second_version_orphaned sonarr 102 needs_you',
    'tracked_in_versions_folder sonarr 201 needs_you',
  ]);
});

// Dropping the failure_code backfill, or matching a text it does not own, turns this red.
test('second versions that failed before failure codes get the code their text maps to', async () => {
  const { applicationMigrations, migrateDatabase } = await import(databaseModuleUrl);
  const database = new DatabaseSync(':memory:');
  migrateDatabase(database, applicationMigrations.slice(0, applicationMigrations.findIndex((migration) => migration.includes('ADD COLUMN failure_code'))));
  const insert = database.prepare(`
    INSERT INTO second_versions (service, movie_id, release_title, guid, indexer, quality, state, failure, created_at, updated_at)
    VALUES ('radarr', 1, 'x', 'g', 'i', 'q', ?, ?, 0, 0)
  `);
  const failures = [
    'Stalled with nothing downloaded; torrent removed.', 'Sonarr or Radarr grabbed the same torrent.',
    'rTorrent never received it. rTorrent is unreachable.', 'That torrent is already in rTorrent.',
    'The download link did not return a torrent file.', 'The torrent has 2 video files; one was expected.',
  ];
  for (const failure of failures) insert.run('failed', failure);
  insert.run('failed', null);
  migrateDatabase(database, applicationMigrations);
  assert.deepEqual(database.prepare('SELECT failure_code FROM second_versions ORDER BY id').all().map((row) => row.failure_code), [
    'stalled_removed', 'grabbed_by_arr', 'never_received', 'already_in_rtorrent', 'not_a_torrent', null, null,
  ]);
  database.close();
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
    if (parsed.pathname === '/api/v3/config/mediamanagement') return json({ copyUsingHardlinks: true });
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
  let onCompleted = async () => {};
  const replaces = createReplaces(services, grabs, { now: () => clock, onCompleted: (record) => onCompleted(record) });
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

  const hashEpisode = 'AB'.repeat(20);
  const hashDangerous = 'CD'.repeat(20);
  const hashMovie = 'EF'.repeat(20);
  const hashVanished = '12'.repeat(20);
  const episode = await start({ service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 50 }, hashEpisode);
  const dangerous = await start({ service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 51 }, hashDangerous);
  const movie = await start({ service: 'radarr', kind: 'movie', movieId: 9 }, hashMovie);
  const vanished = await start({ service: 'radarr', kind: 'movie', movieId: 10 }, hashVanished);

  queue.e = { ...blocked('sonarr', []), id: 1, downloadId: hashEpisode.toLowerCase(), trackedDownloadState: 'downloading', trackedDownloadStatus: 'ok' };
  queue.d = { ...blocked('sonarr', ['Dangerous file extension .exe']), id: 2, downloadId: hashDangerous };
  queue.m = { ...blocked('radarr', [notUpgrade.radarr]), id: 3, downloadId: hashMovie };
  queue.v = { ...blocked('radarr', []), id: 4, downloadId: hashVanished, trackedDownloadState: 'downloading', trackedDownloadStatus: 'ok' };
  manual[hashMovie] = [{ path: '/dl/Movie.mkv', quality: { quality: { id: 7 } }, languages: [], rejections: [{ reason: notUpgrade.radarr }] }];
  await replaces.run();
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0], {
    service: 'radarr',
    body: { name: 'ManualImport', importMode: 'copy', files: [{ path: '/dl/Movie.mkv', quality: { quality: { id: 7 } }, languages: [], downloadId: hashMovie, movieId: 9 }] },
  });
  assert.equal(grabs.read(episode).state, 'sent');
  assert.equal(grabs.read(dangerous).state, 'failed');
  assert.equal(grabs.read(dangerous).failure, 'Import blocked: Dangerous file extension .exe');
  assert.equal(grabs.read(movie).state, 'importing');

  queue.e = { ...blocked('sonarr', [notUpgrade.sonarr]), id: 1, downloadId: hashEpisode.toLowerCase() };
  manual[hashEpisode] = [
    episodeFile('/dl/Show.S01E02/ep.mkv', [notUpgrade.sonarr]),
    episodeFile('/dl/Show.S01E02/sample.mkv', ['Sample']),
    episodeFile('/dl/Show.S01E02/other.mkv', [], []),
  ];
  delete queue.v;
  await replaces.run();
  assert.equal(commands.length, 2, 'the movie already forced is not forced again');
  assert.equal(commands[1].service, 'sonarr');
  assert.equal(commands[1].body.importMode, 'copy');
  assert.deepEqual(commands[1].body.files.map((file) => [file.path, file.seriesId, file.episodeIds]), [
    ['/dl/Show.S01E02/ep.mkv', 5, [50]],
    ['/dl/Show.S01E02/other.mkv', 5, [50]],
  ]);
  assert.equal(grabs.read(vanished).state, 'sent', 'history can name a download before the queue shows it');

  delete queue.e;
  history[hashEpisode].push({ eventType: 'downloadFolderImported' });
  clock += 31 * 60_000;
  // Marking the replace completed before protecting it turns this red: one failed protect then leaves the manual download unprotected for good.
  const protectedIds = [];
  let protectFails = true;
  onCompleted = async (record) => {
    if (protectFails) {
      protectFails = false;
      throw new Error('Sonarr is unreachable.');
    }
    protectedIds.push(record.id);
  };
  await replaces.run();
  assert.equal(grabs.read(vanished).state, 'failed');
  assert.equal(grabs.read(vanished).failure, 'The download left the queue without being imported.');
  assert.equal(grabs.read(episode).state, 'importing', 'a replace whose protection failed is not completed yet');
  assert.equal(grabs.read(movie).state, 'failed', 'a forced import still blocked after the grace period has failed');
  assert.equal(commands.length, 2);
  await replaces.run();
  await replaces.run();
  assert.equal(grabs.read(episode).state, 'completed');
  assert.deepEqual(protectedIds, [episode], 'the next pass protects it once');

  // Overriding only "Not an upgrade" turns this red: a same-quality replace with a lower custom format score then fails.
  const notFormatUpgrade = 'Not a Custom Format upgrade for existing episode file(s). New: [] (0) do not improve on Existing: [x264] (10)';
  const hashFormat = '34'.repeat(20);
  const format = await start({ service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 52 }, hashFormat);
  queue.f = { ...blocked('sonarr', [notFormatUpgrade]), id: 5, downloadId: hashFormat };
  manual[hashFormat] = [episodeFile('/dl/Show.S01E03/ep.mkv', [notFormatUpgrade], [{ id: 52 }])];
  await replaces.run();
  assert.equal(grabs.read(format).state, 'importing');
  assert.deepEqual(commands[2].body.files.map((file) => [file.path, file.episodeIds]), [['/dl/Show.S01E03/ep.mkv', [52]]]);
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
      fakeState.deleted.push({ id: Number(path.split('/')[4]), removeFromClient: parsed.searchParams.get('removeFromClient'), blocklist: parsed.searchParams.get('blocklist') });
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

  state.sonarr.queue = [{ id: 31, downloadId: 'AB'.repeat(20) }];
  const grab = { eventType: 'Grab', series: { id: 5 }, episodes: [{ id: 49 }, { id: 50 }], downloadId: 'ab'.repeat(20), release: { releaseTitle: 'Show.S01.1080p' } };
  assert.equal(await protection.veto('sonarr', { ...grab, episodes: [{ id: 49 }] }), 'ignored');
  ownTitles = ['show.s01.1080p'];
  assert.equal(await protection.veto('sonarr', grab), 'allowed');
  ownTitles = [];
  assert.equal(await protection.veto('sonarr', grab), 'vetoed');
  assert.deepEqual(state.sonarr.deleted, [{ id: 31, removeFromClient: 'true', blocklist: 'true' }]);
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
  assert.equal(registered.onSeriesDelete, true);
  assert.equal(registered.onRename, true);
  assert.deepEqual(Object.fromEntries(registered.fields.map(({ name, value }) => [name, value])), {
    url: 'http://mm2.lan:8080/webhooks/sonarr', method: 1, username: 'media-manager-2', password: 'hook-secret',
  });
  registered.fields = registered.fields.map((field) => (field.name === 'password' ? { ...field, value: '********' } : field));
  await protection.ensureWebhook('sonarr');
  assert.equal(state.sonarr.notifications.length, 1, 'the webhook is registered once');
  assert.equal(state.sonarr.notifications[0].fields.find((field) => field.name === 'password').value, '********', 'an unchanged secret is not sent again');
  // Dropping the onRename check from the update condition turns this red: webhooks registered before the title cache never get its events.
  delete state.sonarr.notifications[0].onRename;
  await protection.ensureWebhook('sonarr');
  assert.equal(state.sonarr.notifications[0].onRename, true);
  assert.equal(state.sonarr.notifications[0].fields.find((field) => field.name === 'password').value, 'hook-secret', 'a webhook without the title-cache events is updated once');
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

// Reading only the first queue page, or stopping the walk before totalRecords, turns this red.
test('the veto and the replace find a queue item past the first 500', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createProtection } = await import(protectionModuleUrl);
  const { createReplaces } = await import(replaceModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-long-queue-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const { fake, ...services } = connectArr(database);
  const fillers = () => Array.from({ length: 500 }, () => queueItem());

  database.prepare("INSERT INTO protected_items (service, item_id, series_id, season_number, episode_number, created_at) VALUES ('sonarr', 50, 5, 1, 2, 0)").run();
  fake.sonarr.state.queue = [...fillers(), queueItem({ downloadId: 'AB'.repeat(20), seriesId: 5, episodeId: 50 })];
  const grab = { eventType: 'Grab', series: { id: 5 }, episodes: [{ id: 50 }], downloadId: 'ab'.repeat(20), release: { releaseTitle: 'Show.S01E02.1080p' } };
  assert.equal(await createProtection(database, services).veto('sonarr', grab), 'vetoed');
  assert.deepEqual(fake.sonarr.state.erasedFromClient, ['AB'.repeat(20)]);
  // Dropping skipRedownload from the veto's removal turns this red: Sonarr then searches again and the veto removes that grab too, round after round.
  assert.deepEqual(fake.sonarr.state.removals.map(({ removeFromClient, blocklist, skipRedownload }) => ({ removeFromClient, blocklist, skipRedownload })), [
    { removeFromClient: true, blocklist: true, skipRedownload: true },
  ]);

  fake.radarr.state.queue = [...fillers(), queueItem({ downloadId: 'CD'.repeat(20), movieId: 9, trackedDownloadState: 'downloading' })];
  const now = () => 10 * 60 * 60_000;
  const replaces = createReplaces(services, {}, { now });
  const target = { service: 'radarr', kind: 'movie', movieId: 9 };
  assert.deepEqual(await replaces.step({
    id: 1, service: 'radarr', target, searchedFor: target, guid: 'g', releaseTitle: 'x', intent: 'replace', state: 'sent', failure: null,
    downloadId: 'cd'.repeat(20), createdAt: 0, updatedAt: now() - 60 * 60_000,
  }), { kind: 'waiting' });
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
  const { fake, ...arr } = connectArr(database);
  fake.radarr.state.movies = [movieRecord({ id: 7, title: 'Dune', year: 2021 })];
  fake.sonarr.state.series = [seriesRecord({ id: 3, title: 'Andor' })];
  fake.sonarr.state.episodes = [
    episodeRecord({ id: 31, seriesId: 3, seasonNumber: 2, episodeNumber: 9 }),
    episodeRecord({ id: 32, seriesId: 3, seasonNumber: 2, episodeNumber: 10 }),
  ];
  const requests = () => ['radarr', 'sonarr'].flatMap((service) => fake[service].requests.map(({ path }) => `${service} ${path}`));
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
  assert.deepEqual(requests(), ['radarr /api/v3/movie/7', 'sonarr /api/v3/episode/31']);
  assert.equal(await labels.movie(8), 'Radarr movie 8');
  assert.equal(await labels.movie(8), 'Radarr movie 8');
  assert.equal(requests().filter((request) => request === 'radarr /api/v3/movie/8').length, 2);
  assert.equal(await labels.episode(99), 'Sonarr episode 99');
  assert.equal(await labels.subject({ type: 'torrent', service: null, id: 'ab'.repeat(20) }, database), 'Andor S02E09 + 1 more');
  assert.equal(await labels.subject({ type: 'torrent', service: null, id: 'CD'.repeat(20) }, database), 'CD'.repeat(20));
  const addVersion = (hash, movieId, seriesId, episodeId) => database.prepare(`
    INSERT INTO second_versions (service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, hash, state, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Release', 'g', 'Blutopia', 'WEBDL-2160p', ?, 'downloading', 1, 1)
  `).run(movieId === null ? 'sonarr' : 'radarr', movieId, seriesId, episodeId, hash);
  addVersion('EF'.repeat(20), 7, null, null);
  addVersion('12'.repeat(20), null, 3, 31);
  addVersion('12'.repeat(20), null, 3, 32);
  // Naming a second version's torrent by its raw name, or without saying it is a second version, turns this red.
  assert.equal(await labels.subject({ type: 'torrent', service: null, id: 'ef'.repeat(20) }, database), 'Dune (2021) (second version)');
  assert.equal(await labels.subject({ type: 'torrent', service: null, id: '12'.repeat(20) }, database), 'Andor S02E09 + 1 more (second version)');
  assert.equal(await labels.subject({ type: 'tracker', service: null, id: 'blutopia.cc' }, database), 'blutopia.cc');
});

test('health merges service, tracker, disk, job and backup checks and ranks the worst', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const { createHealth } = await import(new URL('../dist/server/health.js', import.meta.url).href);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-health-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const now = 1_800_000_000_000;
  const hour = 3_600_000;
  const ok = { kind: 'ok', version: '4.0.0' };
  const healthy = {
    '/api/v3/health': [],
    '/api/v3/diskspace': [{ path: '/data', label: 'data', freeSpace: 2_000_000_000_000, totalSpace: 4_000_000_000_000 }],
    '/api/v3/update': [],
    // Usenet clients remove completed downloads by default and seed nothing, so theirs never counts.
    '/api/v3/downloadclient': [
      { name: 'rTorrent', enable: true, protocol: 'torrent', removeCompletedDownloads: false, removeFailedDownloads: true },
      { name: 'SABnzbd', enable: true, protocol: 'usenet', removeCompletedDownloads: true, removeFailedDownloads: true },
    ],
    '/api/v3/config/mediamanagement': { copyUsingHardlinks: true },
  };
  const accountStats = (host, fields) => ({
    host,
    connection: { kind: 'ok', stats: {
      ratio: null, uploadedBytes: null, downloadedBytes: null, bufferBytes: null, seeding: null, leeching: null, bonus: null, hitAndRuns: null, requiredRatio: null, ...fields,
    } },
  });
  const blutopiaStats = (ratio, hitAndRuns) => accountStats('blutopia.cc', { ratio, hitAndRuns: { count: hitAndRuns, kind: 'lifetime' } });
  let caseNumber = 0;
  const run = async (input = {}) => {
    caseNumber += 1;
    const database = openDatabase(join(root, String(caseNumber), 'media-manager.sqlite'));
    t.after(() => database.close());
    // Blutopia's minimum ratio of 0.4 comes from its rule.
    await saveOwnerRules(database);
    // A recent ok backup row keeps the healthy baseline quiet; backupAt null leaves backup_runs empty.
    if (input.backupAt !== null) {
      database.prepare("INSERT INTO backup_runs (started_at, finished_at, outcome, detail) VALUES (?, ?, 'ok', '')").run(0, input.backupAt ?? now - hour);
    }
    if (input.backupFailed !== undefined) {
      database.prepare("INSERT INTO backup_runs (started_at, finished_at, outcome, detail) VALUES (?, ?, 'failed', ?)").run(now, now, input.backupFailed);
    }
    if (input.backupsOff) database.prepare("INSERT INTO preferences (key, value) VALUES ('backups', 'off')").run();
    if (input.cooldown !== undefined) {
      database.prepare('INSERT INTO tracker_cooldowns VALUES (?, ?, ?, ?, ?)').run('blutopia.cc', now - hour, input.cooldown.text, input.cooldown.known ? 1 : 0, 'AB'.repeat(20));
    }
    if (input.torrentHost !== undefined) {
      database.prepare("INSERT INTO torrents VALUES ('HASH1', 'Some.Movie', 100, 50, 0, 0, 1, 1, 1, 0, '', 0, 0, 0, 0, ?, 1, 1, NULL, 0, '')").run(input.torrentHost);
    }
    const fake = (service) => ({
      configured: () => true,
      check: async () => input.statuses?.[service] ?? ok,
      request: async (path) => ({ status: 200, body: { ...healthy, ...input.arr?.[service] }[path] }),
    });
    const notConfigured = [{ host: 'blutopia.cc', connection: { kind: 'not_configured' } }];
    const published = [];
    const health = createHealth({
      database,
      arr: { sonarr: fake('sonarr'), radarr: fake('radarr') },
      rtorrent: { check: async () => ok },
      mediaServer: () => ({ name: 'plex', check: async () => ok }),
      tmdb: { check: async () => input.statuses?.tmdb ?? ok },
      mdblist: { check: async () => input.statuses?.mdblist ?? ok },
      jobs: { status: () => input.jobs ?? [] },
      trackerAccounts: { stats: async () => input.accounts ?? notConfigured },
      events: { publish: (type, data) => { published.push({ type, data }); } },
      now: () => now,
    });
    const snapshot = await health.check();
    return { snapshot, badge: published.at(-1), health, database };
  };

  // Dropping a check, ranking a lower level above a higher one, or rewriting a service's own message turns this red.
  const cases = [
    { name: 'all ok', input: {}, level: 'ok', errors: 0, warnings: 0, message: undefined },
    { name: 'Sonarr unreachable', input: { statuses: { sonarr: { kind: 'unreachable' } } }, level: 'error', errors: 1, warnings: 0, message: 'Sonarr is unreachable.' },
    // Leaving TMDB out of the service checks turns this row red.
    { name: 'TMDB key rejected', input: { statuses: { tmdb: { kind: 'rejected' } } }, level: 'error', errors: 1, warnings: 0, message: 'TMDB refused the credentials.' },
    // Leaving MDBList out of the service checks turns this row red.
    { name: 'MDBList unreachable', input: { statuses: { mdblist: { kind: 'unreachable' } } }, level: 'error', errors: 1, warnings: 0, message: 'MDBList is unreachable.' },
    {
      name: 'arr warning row with a string wikiUrl',
      input: { arr: { radarr: { '/api/v3/health': [{ source: 'IndexerStatusCheck', type: 'warning', message: 'Indexers unavailable: Blutopia', wikiUrl: 'https://wiki.servarr.com/radarr/1' }] } } },
      level: 'warning', errors: 0, warnings: 1, message: 'Indexers unavailable: Blutopia', docsUrl: 'https://wiki.servarr.com/radarr/1',
    },
    {
      name: 'arr warning row with an object wikiUrl',
      input: { arr: { sonarr: { '/api/v3/health': [{ source: 'DownloadClientCheck', type: 'warning', message: 'No download client', wikiUrl: { fullUri: 'https://wiki.servarr.com/sonarr/2' } }] } } },
      level: 'warning', errors: 0, warnings: 1, message: 'No download client', docsUrl: 'https://wiki.servarr.com/sonarr/2',
    },
    {
      name: 'unknown cooldown', input: { cooldown: { text: 'Ratio too low, sorry', known: false } }, level: 'error', errors: 1, warnings: 0,
      message: 'blutopia.cc refused downloads with text media-manager-2 doesn\'t know: "Ratio too low, sorry"',
    },
    {
      name: 'known cooldown', input: { cooldown: { text: 'Your downloading privileges have been disabled.', known: true } }, level: 'warning', errors: 0, warnings: 1,
      message: `blutopia.cc refused downloads since ${new Date(now - hour).toISOString()}: "Your downloading privileges have been disabled."`,
    },
    {
      name: 'disk with 20 GB free',
      input: { arr: { sonarr: { '/api/v3/diskspace': [{ path: '/data', label: 'data', freeSpace: 20_000_000_000, totalSpace: 100_000_000_000 }] } } },
      level: 'warning', errors: 0, warnings: 1, message: 'Drive /data is 80% full · 20.0 GB free of 100 GB',
    },
    {
      name: 'late job',
      input: { jobs: [{ name: 'stall-fix', intervalMs: 60_000, lastStartedAt: now - hour, lastFinishedAt: now - hour, lastFailed: false, late: true }] },
      level: 'warning', errors: 0, warnings: 1, message: 'Background job stall-fix hasn\'t finished for 1h 0m; expected every 1m',
    },
    // Not reading the two Sonarr and Radarr settings that keep torrents seeding after import turns these rows red.
    {
      name: 'Remove Completed on and hardlinks off',
      input: { arr: { radarr: {
        '/api/v3/downloadclient': [{ name: 'rTorrent', enable: true, protocol: 'torrent', removeCompletedDownloads: true, removeFailedDownloads: true }],
        '/api/v3/config/mediamanagement': { copyUsingHardlinks: false },
      } } },
      level: 'error', errors: 1, warnings: 1,
      message: 'Radarr\'s download client rTorrent removes each torrent once it is imported, which ends its seeding. Turn off Remove Completed in Radarr\'s Settings > Download Clients.',
    },
    {
      name: 'hardlinks off', input: { arr: { sonarr: { '/api/v3/config/mediamanagement': { copyUsingHardlinks: false } } } }, level: 'warning', errors: 0, warnings: 1,
      message: 'Sonarr copies imports instead of hardlinking them, so each import uses the disk space twice and hand imports are refused. Turn on Use Hardlinks instead of Copy in Sonarr\'s Settings > Media Management.',
    },
    { name: 'no ok backup yet', input: { backupAt: null }, level: 'notice', errors: 0, warnings: 0, message: 'Backups are not set up' },
    { name: 'backup 30 h old', input: { backupAt: now - 30 * hour }, level: 'warning', errors: 0, warnings: 1, message: 'The last backup finished 30h 0m ago' },
    // Reporting a destination that never worked as "not set up", or nagging an owner who turned backups off, turns these rows red.
    {
      name: 'backups failing before any upload', input: { backupAt: null, backupFailed: 'BACKUP_KEY is not set.' },
      level: 'warning', errors: 0, warnings: 1, message: 'Backups are failing: BACKUP_KEY is not set.',
    },
    { name: 'backups turned off', input: { backupAt: null, backupsOff: true }, level: 'ok', errors: 0, warnings: 0, message: undefined },
    { name: 'stale backups turned off', input: { backupAt: now - 30 * hour, backupsOff: true }, level: 'ok', errors: 0, warnings: 0, message: undefined },
    // Mapping tracker account stats to the wrong account kind, or warning on a first look at a ratio above its minimum, turns these rows red.
    {
      name: 'tracker with no account stats', input: { torrentHost: 'blutopia.cc' }, level: 'ok', errors: 0, warnings: 0, message: undefined,
      host: 'blutopia.cc', account: { kind: 'not_set_up' },
    },
    {
      name: 'Blutopia account ok',
      input: { torrentHost: 'blutopia.cc', accounts: [blutopiaStats(1.5, 2)] },
      level: 'ok', errors: 0, warnings: 0, message: undefined,
      host: 'blutopia.cc', account: { kind: 'ok', ratio: 1.5, ratioMinimum: 0.4, hitAndRuns: 2, hitAndRunsIsLifetime: true },
    },
    {
      name: 'announce subdomain shows its tracker\'s account', input: { torrentHost: 'tracker.blutopia.cc', accounts: [blutopiaStats(1.5, 2)] },
      level: 'ok', errors: 0, warnings: 0, message: undefined,
      host: 'tracker.blutopia.cc', account: { kind: 'ok', ratio: 1.5, ratioMinimum: 0.4, hitAndRuns: 2, hitAndRunsIsLifetime: true },
    },
    {
      name: 'UNIT3D older than v8.3.4, no torrent yet', input: { accounts: [{ host: 'old.example', connection: { kind: 'too_old' } }] },
      level: 'ok', errors: 0, warnings: 0, message: undefined,
      host: 'old.example', account: { kind: 'unavailable', reason: 'unsupported' },
    },
    {
      name: 'Blutopia ratio below its minimum', input: { torrentHost: 'blutopia.cc', accounts: [blutopiaStats(0.3, 0)] },
      level: 'warning', errors: 0, warnings: 1, message: 'blutopia.cc ratio 0.30 is below its minimum 0.4',
    },
    // A Gazelle account's own required ratio beats its rule's minimum.
    {
      name: 'Gazelle ratio below its required ratio', input: { accounts: [accountStats('gazelle.example', { ratio: 0.5, requiredRatio: 0.6 })] },
      level: 'warning', errors: 0, warnings: 1, message: 'gazelle.example ratio 0.50 is below its minimum 0.6',
      host: 'gazelle.example', account: { kind: 'ok', ratio: 0.5, ratioMinimum: 0.6, hitAndRuns: null, hitAndRunsIsLifetime: false },
    },
  ];
  // A tracker on "other" software has no account connection, so it is listed only once it has torrents.
  const otherOnly = await run({ accounts: [{ host: 'other.example', connection: { kind: 'unsupported' } }] });
  assert.deepEqual(otherOnly.snapshot.trackers, []);
  for (const { name, input, level, errors, warnings, message, docsUrl, host, account } of cases) {
    const { snapshot, badge } = await run(input);
    if (host !== undefined) assert.deepEqual(snapshot.trackers.find((tracker) => tracker.host === host)?.account, account, name);
    assert.equal(snapshot.level, level, name);
    assert.deepEqual(badge, { type: 'health', data: { checkedAt: now, level, errors, warnings } }, name);
    if (message === undefined) {
      assert.deepEqual(snapshot.problems, [], name);
    } else {
      assert.equal(snapshot.problems[0].message, message, name);
      if (docsUrl !== undefined) assert.equal(snapshot.problems[0].docsUrl, docsUrl, name);
    }
  }

  // Dropping the remembered hit-and-run count, or warning on the first check after a start, turns this red.
  await t.test('a rise in a UNIT3D tracker\'s hit-and-run count warns on the next check', async () => {
    const input = { accounts: [blutopiaStats(1.5, 2)] };
    const { snapshot: first, health } = await run(input);
    assert.deepEqual(first.problems, []);
    input.accounts = [blutopiaStats(1.5, 3)];
    const second = await health.check();
    assert.deepEqual(second.problems.map(({ id, level, message }) => ({ id, level, message })), [
      { id: 'hnr:blutopia.cc', level: 'warning', message: 'blutopia.cc hit-and-run count rose from 2 to 3 (lifetime count)' },
    ]);
    // Moving the baseline to the latest count on every check, so the warning clears at the next check, turns this red.
    const third = await health.check();
    assert.deepEqual(third.problems.map(({ id, message }) => ({ id, message })), [
      { id: 'hnr:blutopia.cc', message: 'blutopia.cc hit-and-run count rose from 2 to 3 (lifetime count)' },
    ]);
  });

  // Leaving the health routes outside the sign-in guard, or not running the checks on demand, turns this red.
  await t.test('the health routes need the owner session and run the checks on demand', async () => {
    const { health, database } = await run();
    const { app } = await makeApp({ api: createApiRoutes(database, { arr: {}, refresh: async () => {}, manualImport: {}, health }) });
    assert.equal((await app.request('/api/health')).status, 401);
    const { session } = await signIn(app);
    const response = await app.request('/api/health/check', { method: 'POST', headers: { ...jsonHeaders(), Cookie: session }, body: '{}' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).checkedAt, now);
  });
});

test('flagged lists what automation gave up on with the right next step, and wanted lists with their search times', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createProblems } = await import(problemsModuleUrl);
  const { searchDueAt } = await import(searchesModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const { createLabels } = await import(new URL('../dist/server/labels.js', import.meta.url).href);
  const { createFlagged } = await import(new URL('../dist/server/flagged.js', import.meta.url).href);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-flagged-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(() => database.close());
  const day = 24 * 60 * 60_000;
  const clock = { value: Date.parse('2026-10-08T12:00:00Z') };
  const added = '2026-01-01T00:00:00Z';
  const bodies = {
    '/api/v3/wanted/missing?page=1&pageSize=500&monitored=true&includeSeries=true': { totalRecords: 2, records: [
      { id: 50, seriesId: 3, seasonNumber: 2, episodeNumber: 1, airDateUtc: '2026-10-01T00:00:00Z', series: { title: 'Andor', added } },
      { id: 51, seriesId: 3, seasonNumber: 2, episodeNumber: 2, airDateUtc: '2026-09-01T00:00:00Z', lastSearchTime: '2026-10-07T00:00:00Z', series: { title: 'Andor', added } },
    ] },
    '/api/v3/wanted/cutoff?page=1&pageSize=500&monitored=true&includeSeries=true': { totalRecords: 0, records: [] },
    '/api/v3/wanted/missing?page=1&pageSize=500&monitored=true': { totalRecords: 2, records: [
      { id: 8, title: 'Arrival', year: 2016, added },
      { id: 7, title: 'Dune', year: 2021, added },
    ] },
    '/api/v3/wanted/cutoff?page=1&pageSize=500&monitored=true': { totalRecords: 2, records: [
      { id: 7, title: 'Dune', year: 2021, added },
      { id: 9, title: 'Heat', year: 1995, added },
    ] },
  };
  const { fake, ...arr } = connectArr(database);
  for (const name of ['sonarr', 'radarr']) {
    fake[name].routes.push((method, url) => (method === 'GET' && url.pathname + url.search in bodies ? { status: 200, body: bodies[url.pathname + url.search] } : undefined));
  }
  fake.radarr.state.movies = [movieRecord({ id: 7, title: 'Dune', year: 2021 })];
  fake.sonarr.state.series = [seriesRecord({ id: 3, title: 'Andor' }), seriesRecord({ id: 5, title: 'Severance' })];
  fake.sonarr.state.episodes = [
    episodeRecord({ id: 31, seriesId: 3, seasonNumber: 2, episodeNumber: 9 }),
    episodeRecord({ id: 32, seriesId: 5, seasonNumber: 1, episodeNumber: 2 }),
  ];
  const commandCount = () => fake.sonarr.state.commands.length + fake.radarr.state.commands.length;
  const events = createEventHub();
  const problems = createProblems({ database, events, now: () => clock.value });
  const grabs = createGrabTracker({ database, arr, events });
  const grab = { publishedAt: null, byHand: false, indexer: 'Blutopia', grabbedAt: clock.value - 60 * 60_000 };
  grabs.recordGrab({ ...grab, hash: 'AA'.repeat(20), service: 'radarr', movieId: 7, seriesId: null, episodeIds: [], releaseTitle: 'Dune.2021' });
  grabs.recordGrab({ ...grab, hash: 'BB'.repeat(20), service: 'sonarr', movieId: null, seriesId: 3, episodeIds: [31], releaseTitle: 'Andor.S02E09' });
  grabs.recordGrab({ ...grab, hash: 'CC'.repeat(20), service: 'sonarr', movieId: null, seriesId: 3, episodeIds: [33, 34], releaseTitle: 'Andor.S02E11E12' });
  grabs.recordGrab({ ...grab, hash: 'DD'.repeat(20), service: 'sonarr', movieId: null, seriesId: 3, episodeIds: [51], releaseTitle: 'Andor.S02E02.2160p' });
  database.prepare('INSERT INTO availability_seen (subject, seen_at) VALUES (?, ?)').run('radarr:movie:7', clock.value - 3 * day);
  database.prepare(`
    INSERT INTO arr_queue (service, queue_id, movie_id, title, status, tracked_status, tracked_state, status_messages, error_message,
      indexer, protocol, quality, formats, format_score, size_bytes, size_left_bytes)
    VALUES ('radarr', 1, 8, 'Arrival.2016', 'downloading', 'ok', 'downloading', '[]', '', 'Blutopia', 'torrent', 'Bluray-1080p', '[]', 0, 1, 1)
  `).run();

  const torrent = (hash) => ({ type: 'torrent', service: null, id: hash });
  for (const ago of [8 * day, 2 * day]) {
    clock.value -= ago;
    const old = problems.open({ kind: 'missed_search', subject: { type: 'episode', service: 'sonarr', id: '40' }, summary: 'Out but never searched.' });
    problems.setState(old.id, 'resolved', 'Searched automatically.');
    clock.value += ago;
  }
  problems.open({ kind: 'stalled', subject: torrent('AA'.repeat(20)), hash: 'AA'.repeat(20), summary: 'No seeders.', state: 'needs_you' });
  problems.open({ kind: 'import_matching', subject: torrent('BB'.repeat(20)), hash: 'BB'.repeat(20), summary: 'No match.', state: 'needs_you' });
  problems.open({ kind: 'stalled', subject: torrent('CC'.repeat(20)), hash: 'CC'.repeat(20), summary: 'No seeders.', state: 'needs_you' });
  problems.open({ kind: 'stalled', subject: torrent('EE'.repeat(20)), hash: 'EE'.repeat(20), summary: 'No grab.', state: 'needs_you' });
  problems.open({ kind: 'tracker_cooldown', subject: { type: 'tracker', service: null, id: 'blutopia.cc' }, summary: 'Slow down.', state: 'needs_you' });
  problems.open({ kind: 'dependency_down', subject: { type: 'dependency', service: null, id: 'rtorrent' }, summary: 'rTorrent is unreachable.', state: 'needs_you' });
  problems.open({ kind: 'missed_search', subject: { type: 'episode', service: 'sonarr', id: '32' }, summary: 'Out but never searched.', state: 'needs_you' });
  problems.open({ kind: 'second_version_orphaned', subject: { type: 'movie', service: 'radarr', id: '7' }, summary: 'Radarr no longer has this movie.', state: 'needs_you' });
  problems.open({ kind: 'second_version_missing', subject: { type: 'episode', service: 'sonarr', id: '32' }, summary: 'File missing.', state: 'needs_you' });
  problems.open({ kind: 'tracked_in_versions_folder', subject: { type: 'movie', service: 'radarr', id: '7' }, summary: 'Inside the versions folder.', state: 'needs_you' });
  problems.open({ kind: 'unfinished', subject: torrent('FF'.repeat(20)), hash: 'FF'.repeat(20), summary: 'Still going.' });

  for (const [id, service, movieId, seriesId, episodeId, state] of [[1, 'radarr', 7, null, null, 'imported'], [2, 'radarr', 7, null, null, 'downloading'], [3, 'sonarr', null, 5, 32, 'imported']]) {
    database.prepare(`
      INSERT INTO second_versions (id, service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, hash, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Release', 'g', 'Blutopia', 'WEBDL-2160p', ?, ?, 1, 1)
    `).run(id, service, movieId, seriesId, episodeId, 'AB'.repeat(20), state);
  }
  const isManualDownload = (subject) => subject.type === 'movie' && subject.id === '7';
  const flagged = createFlagged({ database, arr, labels: createLabels(arr), isManualDownload, now: () => clock.value });

  // Mapping a problem to the wrong next step, offering a manual import for a non-import problem, a pick for several episodes,
  // or a pick or search for a second version whose title or file is gone turns this red.
  const needsYou = await flagged.needsYou();
  assert.deepEqual(needsYou.items.map((item) => [item.problem.kind, item.label, item.actions.map((action) => action.kind)]), [
    ['stalled', 'Dune (2021)', ['pick_release', 'search']],
    ['import_matching', 'Andor S02E09', ['manual_import', 'pick_release', 'search']],
    ['stalled', 'Sonarr episode 33 + 1 more', ['search']],
    ['stalled', 'EE'.repeat(20), []],
    ['tracker_cooldown', 'blutopia.cc', ['open_health']],
    ['dependency_down', 'rtorrent', ['open_health']],
    ['missed_search', 'Severance S01E02', ['pick_release', 'search']],
    ['second_version_orphaned', 'Dune (2021)', []],
    ['second_version_missing', 'Severance S01E02', []],
    ['tracked_in_versions_folder', 'Dune (2021)', ['pick_release', 'search']],
  ]);
  assert.equal(needsYou.items[1].kindWord, 'IMPORT MATCHING');
  assert.deepEqual(needsYou.items[1].actions[0], { kind: 'manual_import', service: 'sonarr', downloadId: 'BB'.repeat(20) });
  assert.deepEqual(needsYou.items[2].actions[0], { kind: 'search', service: 'sonarr', type: 'episode', ids: [33, 34] });
  assert.deepEqual(needsYou.items[6].actions[0].target, { service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 32 });
  // Offering no delete for an orphaned or missing second version, or one still downloading, turns this red.
  assert.deepEqual(needsYou.items.map((item) => item.deleteSecondVersionIds), [[], [], [], [], [], [], [], [1], [3], []]);
  // Counting resolutions older than a week, or counting open problems as handled, turns this red.
  assert.equal(needsYou.handledThisWeek, 1);
  assert.equal(needsYou.handlingCount, 1);

  database.prepare('INSERT INTO search_backlog (subject, seen_at) VALUES (?, ?)').run('sonarr:episode:51', clock.value);
  // Filtering manual downloads out of the missing list, keeping them in cutoff, or losing the search schedule turns this red.
  const { missing, cutoff } = await flagged.wanted();
  assert.deepEqual(missing.map((item) => `${item.service}:${item.id}`), ['sonarr:51', 'sonarr:50', 'radarr:7', 'radarr:8']);
  assert.deepEqual(cutoff.map((item) => `${item.service}:${item.id}`), ['radarr:9']);
  const never = missing.find((item) => item.id === 50);
  assert.equal(never.lastResult, 'never searched');
  assert.equal(never.nextSearchAt, searchDueAt({ availableAt: Date.parse('2026-10-01T00:00:00Z'), addedAt: Date.parse(added), lastSearchAt: null }));
  assert.equal(missing.find((item) => item.id === 51).lastResult, 'grabbed Andor.S02E02.2160p');
  // Showing a next search time for a subject in search_backlog, which the search scheduler skips, turns this red.
  assert.deepEqual([missing.find((item) => item.id === 51).nextSearchAt, missing.find((item) => item.id === 51).backlog, never.backlog], [null, true, false]);
  assert.equal(missing.find((item) => item.id === 7).availableAt, clock.value - 3 * day);
  assert.equal(missing.find((item) => item.id === 8).nextSearchAt, null);
  // Checking the search history before the download queue makes a queued, never-searched movie read "never searched".
  assert.deepEqual([missing.find((item) => item.id === 8).lastResult, missing.find((item) => item.id === 8).inQueue], ['in queue', true]);

  // Sending a search without recording it, sending it twice, or accepting an episode search aimed at Radarr turns this red.
  const { app } = await makeApp({ api: createApiRoutes(database, { arr, refresh: async () => {}, flagged }) });
  const { session } = await signIn(app);
  const post = (body) => app.request('/api/flagged/search', {
    method: 'POST', headers: { ...jsonHeaders('https://media.example'), Cookie: session }, body: JSON.stringify(body),
  });
  assert.equal((await post({ service: 'sonarr', type: 'episode', ids: [50] })).status, 204);
  assert.deepEqual(fake.sonarr.state.commands, [{ name: 'EpisodeSearch', episodeIds: [50] }]);
  assert.equal(database.prepare('SELECT searched_at FROM search_log WHERE subject = ?').get('sonarr:episode:50').searched_at, clock.value);
  for (const body of [{ service: 'radarr', type: 'episode', ids: [50] }, { service: 'sonarr', type: 'episode', ids: [] }, { service: 'sonarr', type: 'episode', ids: [50], extra: 1 }]) {
    assert.equal((await post(body)).status, 400);
  }
  assert.equal(commandCount(), 1);
});

test('history merges Sonarr, Radarr and media-manager-2 events newest first with their details', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createProblems } = await import(problemsModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const { createHistory, normalizeArrEvent } = await import(new URL('../dist/server/history.js', import.meta.url).href);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-history-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(() => database.close());
  const hash = 'AB'.repeat(20);
  const andor = { series: { title: 'Andor' }, episode: { seasonNumber: 2, episodeNumber: 9 }, episodeId: 31, seriesId: 3 };
  const grabbed = historyRecord({
    ...andor,
    id: 11,
    eventType: 'grabbed',
    date: '2026-10-10T10:00:00Z',
    sourceTitle: 'Andor.S02E09.2160p.WEB-DL-GRP',
    downloadId: hash,
    quality: { quality: { name: 'WEBDL-2160p' } },
    customFormats: [{ name: 'DV' }, { name: 'HDR10' }],
    customFormatScore: 1250,
    data: { indexer: 'Blutopia', releaseGroup: 'GRP', releaseSource: 'Rss', ageHours: '5.4', age: '0' },
  });
  const imported = historyRecord({
    ...andor,
    id: 12,
    eventType: 'downloadFolderImported',
    date: '2026-10-10T08:00:00Z',
    sourceTitle: 'Andor.S02E09.2160p.WEB-DL-GRP',
    data: { importedPath: '/tv/Andor/Season 2/Andor S02E09.mkv' },
  });
  // The same grab as Sonarr's history read hands it to normalizeArrEvent.
  const parsedGrab = {
    id: 11, eventType: 'grabbed', date: '2026-10-10T10:00:00Z', downloadId: hash, movieId: null, seriesId: 3, episodeId: 31,
    sourceTitle: 'Andor.S02E09.2160p.WEB-DL-GRP', quality: 'WEBDL-2160p', formats: ['DV', 'HDR10'], formatScore: 1250,
    movie: null, series: { title: 'Andor' }, episode: { seasonNumber: 2, episodeNumber: 9 },
    data: { indexer: 'Blutopia', releaseGroup: 'GRP', releaseSource: 'Rss', ageHours: '5.4', age: '0' },
  };

  // Dropping a data field, the "picked by you" mark or the episode code from the words turns this red.
  assert.deepEqual(normalizeArrEvent('sonarr', parsedGrab, (id) => id === hash), {
    id: 'sonarr:11',
    at: Date.parse('2026-10-10T10:00:00Z'),
    service: 'sonarr',
    source: 'Sonarr',
    subject: { type: 'episode', service: 'sonarr', id: '31' },
    title: 'Andor S02E09',
    event: 'Grabbed',
    detail: 'Blutopia · RSS · picked by you',
    release: 'Andor.S02E09.2160p.WEB-DL-GRP',
    quality: 'WEBDL-2160p',
    byHand: true,
    eventType: 'grabbed',
    details: {
      tracker: 'Blutopia',
      releaseGroup: 'GRP',
      formats: ['DV', 'HDR10'],
      score: 1250,
      howFound: 'RSS',
      ageWhenGrabbed: '5 hours',
      deletionReason: null,
      droppedPath: null,
      importedPath: null,
      message: null,
    },
    markFailed: { service: 'sonarr', historyId: 11, movieId: null, episodeIds: [31], releaseTitle: 'Andor.S02E09.2160p.WEB-DL-GRP' },
  });
  const deleted = normalizeArrEvent('radarr', {
    id: 21, eventType: 'movieFileDeleted', date: '2026-10-09T08:00:00Z', downloadId: null, movieId: 7, seriesId: null, episodeId: null,
    sourceTitle: 'Dune.2021.1080p', quality: 'Bluray-1080p', formats: [], formatScore: null,
    movie: { title: 'Dune', year: 2021 }, series: null, episode: null, data: { reason: 'Upgrade' },
  }, () => true);
  // Offering Mark as failed on anything but a grab, or losing the deletion reason, turns this red.
  assert.deepEqual(
    [deleted.title, deleted.event, deleted.detail, deleted.byHand, deleted.markFailed, deleted.subject],
    ['Dune (2021)', 'File deleted', 'Upgrade', false, null, { type: 'movie', service: 'radarr', id: '7' }],
  );
  assert.equal(normalizeArrEvent('sonarr', { ...parsedGrab, eventType: 'unknown' }, () => false), null);

  const clock = { value: Date.parse('2026-10-10T09:00:00Z') };
  const problems = createProblems({ database, events: createEventHub(), now: () => clock.value });
  problems.open({ kind: 'stalled', subject: { type: 'torrent', service: null, id: hash }, summary: 'Stalled at 40%', hash });
  clock.value = Date.parse('2026-10-10T07:00:00Z');
  problems.open({ kind: 'missed_search', subject: { type: 'movie', service: 'radarr', id: '7' }, summary: 'Nothing found' });
  const { fake, ...arr } = connectArr(database, { sonarr: {} });
  const { requests } = fake.sonarr;
  fake.sonarr.state.history = [grabbed, imported];
  fake.sonarr.state.episodes = [episodeRecord({ id: 31, seriesId: 3 })];
  const grabs = createGrabTracker({ database, arr, events: createEventHub() });
  grabs.recordGrab({ hash, service: 'sonarr', movieId: null, seriesId: 3, episodeIds: [31], releaseTitle: 'Andor.S02', indexer: 'Blutopia', grabbedAt: 1_000, publishedAt: null, byHand: false });
  const history = createHistory({ database, arr, labels: { subject: async (subject) => `label ${subject.id}` } });

  // Sorting per source instead of by time, or letting an unconfigured Radarr throw, turns this red.
  const all = await history.list({ filter: 'all', service: 'all', page: 1 });
  assert.deepEqual(all.events.map((event) => event.id), ['sonarr:11', 'mm2:1', 'sonarr:12', 'mm2:2']);
  assert.equal(all.hasMore, false);
  assert.deepEqual(
    [all.events[1].title, all.events[1].event, all.events[1].release, all.events[2].detail],
    [`label ${hash}`, 'Problem', 'Andor.S02', 'Andor S02E09.mkv'],
  );
  // Letting Sonarr or Radarr events through the Automatic fixes filter turns this red.
  assert.deepEqual((await history.list({ filter: 'fixes', service: 'all', page: 1 })).events.map((event) => event.id), ['mm2:1', 'mm2:2']);
  // Not forwarding the series id, or keeping problems on other titles in a title's history, turns this red.
  const series = await history.list({ filter: 'all', service: 'sonarr', page: 1, seriesId: 3 });
  assert.equal(series.events[0].title, 'Andor S02E09');
  assert.deepEqual(series.events.map((event) => event.id), ['sonarr:11', 'mm2:1', 'sonarr:12']);
  // Letting a Radarr problem through the Sonarr service filter turns this red.
  assert.deepEqual((await history.list({ filter: 'all', service: 'sonarr', page: 1 })).events.map((event) => event.id), ['sonarr:11', 'mm2:1', 'sonarr:12']);
  assert.deepEqual((await history.list({ filter: 'all', service: 'radarr', page: 1 })).events.map((event) => event.id), ['mm2:1', 'mm2:2']);

  database.prepare(`
    INSERT INTO second_versions (id, service, series_id, episode_id, release_title, guid, indexer, quality, hash, state, created_at, updated_at)
    VALUES (1, 'sonarr', 3, 31, 'Andor.S02E09.2160p-GRP2', 'g', 'Blutopia', 'WEBDL-2160p', ?, 'imported', 1, 1)
  `).run('EF'.repeat(20));
  database.prepare("INSERT INTO version_events (second_version_id, at, kind, detail) VALUES (1, ?, 'added', 'Andor - S02E09 - WEBDL-2160p GRP2.mkv')")
    .run(Date.parse('2026-10-10T09:30:00Z'));
  // Leaving second version events out of All or out of the title's history, or listing them as automatic fixes, turns this red.
  const withVersion = await history.list({ filter: 'all', service: 'all', page: 1 });
  assert.deepEqual(withVersion.events.map((event) => event.id), ['sonarr:11', 'mm2-version:1', 'mm2:1', 'sonarr:12', 'mm2:2']);
  const added = withVersion.events[1];
  assert.deepEqual(
    [added.title, added.event, added.detail, added.release, added.quality, added.subject, added.source],
    ['label 31', 'Second version added', 'Andor - S02E09 - WEBDL-2160p GRP2.mkv', 'Andor.S02E09.2160p-GRP2', 'WEBDL-2160p', { type: 'episode', service: 'sonarr', id: '31' }, 'media-manager-2'],
  );
  assert.deepEqual((await history.list({ filter: 'fixes', service: 'all', page: 1 })).events.map((event) => event.id), ['mm2:1', 'mm2:2']);
  assert.deepEqual((await history.list({ filter: 'all', service: 'sonarr', page: 1, seriesId: 3 })).events.map((event) => event.id), ['sonarr:11', 'mm2-version:1', 'mm2:1', 'sonarr:12']);
  // Leaving a second version's deletion out of Deletions, or listing its addition there, turns this red.
  database.prepare(`
    INSERT INTO version_events (second_version_id, at, kind, detail) VALUES (1, ?, 'deleted', 'Andor - S02E09 - WEBDL-2160p GRP2.mkv'), (1, ?, 'torrent_kept', 'Kept seeding, as chosen.')
  `).run(Date.parse('2026-10-10T09:40:00Z'), Date.parse('2026-10-10T09:41:00Z'));
  const deletions = await history.list({ filter: 'deletions', service: 'all', page: 1 });
  assert.deepEqual(deletions.events.filter((event) => event.source === 'media-manager-2').map((event) => [event.event, event.detail]), [
    ['Torrent kept', 'Kept seeding, as chosen.'],
    ['Second version deleted', 'Andor - S02E09 - WEBDL-2160p GRP2.mkv'],
  ]);
  database.exec('DELETE FROM version_events; DELETE FROM second_versions;');

  // A full Sonarr page of 100 grabs, one a minute from 10:00 back to 08:21, leaves the 07:00 step for a later page.
  const fullPage = Array.from({ length: 100 }, (_, index) => ({ ...grabbed, id: 100 + index, date: new Date(Date.parse('2026-10-10T10:00:00Z') - index * 60_000).toISOString() }));
  fake.sonarr.state.history = fullPage;
  const full = await history.list({ filter: 'all', service: 'all', page: 1 });
  // Reading steps from the start of time instead of from the oldest record on a full Sonarr page turns this red.
  assert.deepEqual(full.events.filter((event) => event.source === 'media-manager-2').map((event) => event.id), ['mm2:1']);
  assert.equal(full.hasMore, true);
  // Page 2 is Sonarr's last, with one grab at 08:10; the 07:00 step is older than everything on page 1.
  fake.sonarr.state.history = [...fullPage, { ...grabbed, id: 300, date: '2026-10-10T08:10:00Z' }];
  const fullOldest = Math.min(...full.events.map((event) => event.at));
  const afterFull = await history.list({ filter: 'all', service: 'all', page: 2, before: fullOldest });
  // Paging steps by offset on Sonarr's last page, instead of from the oldest event already shown, turns this red.
  assert.deepEqual(afterFull.events.filter((event) => event.source === 'media-manager-2').map((event) => event.id), ['mm2:2']);
  assert.equal(afterFull.hasMore, false);
  fake.sonarr.state.history = [grabbed, imported];

  const missed = problems.open({ kind: 'missed_search', subject: { type: 'movie', service: 'radarr', id: '7' }, summary: 'Nothing found' });
  for (let index = 0; index < 100; index += 1) {
    clock.value = Date.parse('2026-10-10T06:00:00Z') - index * 60_000;
    problems.step(missed.id, 'fix', `Searched again ${index}`);
  }
  // Returning every step on one page when no Sonarr or Radarr page is full, or ignoring before, turns this red.
  const firstFixes = await history.list({ filter: 'fixes', service: 'all', page: 1 });
  assert.deepEqual([firstFixes.events.length, firstFixes.hasMore], [100, true]);
  const secondFixes = await history.list({ filter: 'fixes', service: 'all', page: 2, before: Math.min(...firstFixes.events.map((event) => event.at)) });
  assert.deepEqual([secondFixes.events.map((event) => event.detail), secondFixes.hasMore], [['Searched again 97', 'Searched again 98', 'Searched again 99'], false]);

  // A full Sonarr page reaching back to 08:21 plus 150 steps from 09:30, all newer than its oldest record.
  for (let index = 0; index < 150; index += 1) {
    clock.value = Date.parse('2026-10-10T09:30:00Z') + index * 1_000;
    problems.step(missed.id, 'fix', `Newer step ${index}`);
  }
  fake.sonarr.state.history = fullPage;
  const newer = (events) => events.filter((event) => event.detail.startsWith('Newer step ')).map((event) => event.detail);
  const crowded = await history.list({ filter: 'all', service: 'all', page: 1 });
  // Returning every step newer than the oldest Sonarr record on one page, instead of the newest 100, turns this red.
  assert.deepEqual([newer(crowded.events), crowded.hasMore], [Array.from({ length: 100 }, (_, index) => `Newer step ${149 - index}`), true]);
  fake.sonarr.state.history = [];
  const crowdedOldestStep = Math.min(...crowded.events.filter((event) => event.source === 'media-manager-2').map((event) => event.at));
  const afterCrowded = await history.list({ filter: 'all', service: 'all', page: 2, before: crowdedOldestStep });
  // Ignoring before on page 2, or cutting the newest steps instead of the oldest, turns this red.
  assert.deepEqual(newer(afterCrowded.events), Array.from({ length: 51 }, (_, index) => `Newer step ${50 - index}`));
  // A full Sonarr page whose every grab is newer than every step.
  fake.sonarr.state.history = Array.from({ length: 100 }, (_, index) => ({ ...grabbed, id: 400 + index, date: new Date(Date.parse('2026-10-11T10:00:00Z') - index * 60_000).toISOString() }));
  const requestsBeforeFixes = requests.length;
  const fixesPastFull = await history.list({ filter: 'fixes', service: 'all', page: 1 });
  // Reading Sonarr pages under the Automatic fixes filter, and so starting steps at its oldest record, turns this red.
  assert.deepEqual([fixesPastFull.events[0]?.detail, fixesPastFull.events.length, requests.length], ['Newer step 149', 100, requestsBeforeFixes]);
  fake.sonarr.state.history = [grabbed, imported];

  const { app } = await makeApp({ api: createApiRoutes(database, { arr, refresh: async () => {}, history }) });
  const { session } = await signIn(app);
  // Serving history without a session, or accepting a filter name it doesn't know, turns this red.
  assert.equal((await app.request('/api/history')).status, 401);
  assert.equal((await app.request('/api/history?filter=nope', { headers: { Cookie: session } })).status, 400);
  assert.equal((await app.request('/api/history?before=soon', { headers: { Cookie: session } })).status, 400);
  assert.equal((await app.request('/api/history?filter=fixes', { headers: { Cookie: session } })).status, 200);
});

test('marking a grab failed keeps the file and the torrent, blocklists and searches again; the blocklist says why and by whom', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createGrabTracker } = await import(torrentGrabsModuleUrl);
  const { createProblems } = await import(problemsModuleUrl);
  const { createApiRoutes } = await import(apiModuleUrl);
  const { createBlocklist } = await import(new URL('../dist/server/blocklist.js', import.meta.url).href);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-blocklist-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(() => database.close());
  const andor = { series: { title: 'Andor' }, quality: { quality: { name: 'WEBDL-2160p' } }, indexer: 'Blutopia' };
  const state = {
    removeFailed: true,
    autoRedownload: false,
    refuseSearch: false,
    blocklist: {
      sonarr: [
        { ...andor, id: 3, date: '2026-10-10T10:00:00Z', sourceTitle: 'andor.s02e09.2160p.web-dl-grp', episodeIds: [31], message: 'Manually marked as failed' },
        { ...andor, id: 4, date: '2026-10-10T08:00:00Z', sourceTitle: 'Andor.S02E10.STALLED', episodeIds: [32, 33], message: 'Download failed' },
      ],
      radarr: [{ id: 5, date: '2026-10-10T09:00:00Z', sourceTitle: 'Dune.2021.1080p', movie: { title: 'Dune', year: 2021 }, message: 'Release was not wanted' }],
    },
  };
  const { fake, ...arr } = connectArr(database);
  for (const name of ['sonarr', 'radarr']) {
    fake[name].state.blocklist = state.blocklist[name];
    fake[name].routes.push((method, url) => {
      if (method === 'GET' && url.pathname === '/api/v3/downloadclient') return { status: 200, body: [{ enable: true, removeFailedDownloads: state.removeFailed }] };
      if (method === 'GET' && url.pathname === '/api/v3/config/downloadclient') return { status: 200, body: { autoRedownloadFailed: state.autoRedownload } };
      if (method === 'POST' && url.pathname === '/api/v3/command' && state.refuseSearch) return { status: 500, body: {} };
      return undefined;
    });
  }
  // Sonarr only marks a grab failed when its history holds that record.
  fake.sonarr.state.history = [7, 8, 9, 10].map((id) => historyRecord({ id }));
  const calls = () => fake.sonarr.requests.map((r) => `${r.method} ${r.path}`);
  const blocklist = createBlocklist({ database, arr, isManualDownload: (subject) => subject.type === 'episode' && subject.id === '40', now: () => 5_000 });
  const { app } = await makeApp({ api: createApiRoutes(database, { arr, refresh: async () => {}, blocklist }) });
  const { session } = await signIn(app);
  const mark = (id, body) => app.request(`/api/history/sonarr/${id}/failed`, {
    method: 'POST', headers: { ...jsonHeaders(), Cookie: session }, body: JSON.stringify(body),
  });
  const grab = { movieId: null, episodeIds: [31], releaseTitle: 'Andor.S02E09.2160p.WEB-DL-GRP' };

  // Marking it failed while the download client would remove the seeding torrent turns this red.
  let response = await mark(7, grab);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'remove_failed_on' });
  assert.deepEqual(calls(), ['GET /api/v3/downloadclient']);
  assert.deepEqual(fake.sonarr.state.failed, []);

  // Touching the library file or the queue, or skipping the search media-manager-2 owes, turns this red.
  state.removeFailed = false;
  fake.sonarr.requests.length = 0;
  response = await mark(7, grab);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { searched: 'media-manager-2' });
  assert.deepEqual(fake.sonarr.state.failed, [7]);
  assert.deepEqual(fake.sonarr.state.commands, [{ name: 'EpisodeSearch', episodeIds: [31] }]);
  assert.deepEqual(calls(), [
    'GET /api/v3/downloadclient',
    'POST /api/v3/history/failed/7',
    'GET /api/v3/config/downloadclient',
    'POST /api/v3/command',
  ]);
  assert.equal(calls().some((call) => /episodefile|moviefile|queue/.test(call)), false);
  assert.equal(database.prepare('SELECT origin FROM blocklist_marks WHERE release_title = ?').get(grab.releaseTitle).origin, 'history');

  // Searching on top of the service's own automatic redownload, or searching for a manual download, turns this red.
  state.autoRedownload = true;
  fake.sonarr.requests.length = 0;
  assert.deepEqual(await (await mark(8, grab)).json(), { searched: 'service' });
  assert.equal(calls().includes('POST /api/v3/command'), false);
  state.autoRedownload = false;
  assert.deepEqual(await (await mark(9, { ...grab, episodeIds: [40], releaseTitle: 'Protected.Release' })).json(), { searched: 'manual_download' });
  // Reporting a refused search as a failed mark, when the grab is already marked failed, turns this red.
  state.refuseSearch = true;
  const refused = await mark(10, grab);
  assert.deepEqual([refused.status, await refused.json()], [200, { searched: 'search_failed' }]);
  state.refuseSearch = false;
  assert.equal((await mark(7, { ...grab, extra: true })).status, 400);
  assert.equal((await mark(7, { ...grab, releaseTitle: '' })).status, 400);

  const hash = 'CD'.repeat(20);
  createGrabTracker({ database, arr, events: createEventHub() }).recordGrab({
    hash, service: 'sonarr', movieId: null, seriesId: 3, episodeIds: [32, 33], releaseTitle: 'Andor.S02E10.STALLED', indexer: 'Blutopia', grabbedAt: 1_000, publishedAt: null, byHand: false,
  });
  createProblems({ database, events: createEventHub() })
    .open({ kind: 'stalled', subject: { type: 'torrent', service: null, id: hash }, summary: 'Stalled at 40% for 6 hours', hash });
  // Losing the case-insensitive match on the owner's mark, the problem summary, or the service's own message turns this red.
  const listed = await blocklist.list(1, 'all');
  assert.deepEqual(listed.entries.map((entry) => [entry.id, entry.title, entry.by, entry.reason]), [
    [3, 'Andor · 1 episode', 'you', "from the title's history"],
    [5, 'Dune (2021)', 'Radarr', 'Release was not wanted'],
    [4, 'Andor · 2 episodes', 'media-manager-2', 'Stalled at 40% for 6 hours'],
  ]);
  assert.equal(listed.hasMore, false);

  // Unblocking through anything but the service's blocklist delete turns this red.
  fake.sonarr.requests.length = 0;
  const commandsBefore = fake.sonarr.state.commands.length;
  const unblocked = await app.request('/api/blocklist/sonarr/3', { method: 'DELETE', headers: { ...jsonHeaders(), Cookie: session } });
  assert.equal(unblocked.status, 204);
  assert.deepEqual(calls(), ['DELETE /api/v3/blocklist/3']);
  assert.equal(fake.sonarr.state.commands.length, commandsBefore);
});

test('the library reads Sonarr and Radarr, orders titles newest first and forwards monitoring changes', async (t) => {
  const { createLibrary, createLibraryRoutes, newestFirst, imageUrl } = await import(libraryModuleUrl);
  const { openDatabase } = await import(databaseModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-library-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const window = 'start=2026-10-01T00%3A00%3A00.000Z&end=2026-10-08T00%3A00%3A00.000Z&unmonitored=false';
  const bodies = {
    sonarr: {
      '/api/v3/qualityprofile': [{
        id: 4, name: 'HD', cutoff: 1002, items: [{ id: 1001, name: 'HD group', items: [{ quality: { id: 3, name: 'WEBDL-1080p' } }] }, { id: 1002, name: 'Remux group', quality: null, items: [] }],
      }],
      '/api/v3/tag': [{ id: 9, label: 'kids' }],
      [`/api/v3/calendar?${window}&includeSeries=true&includeEpisodeFile=true`]: [],
    },
    radarr: {
      [`/api/v3/calendar?${window}`]: [
        { id: 5, title: 'Dune', year: 2024, monitored: true, inCinemas: '2026-10-02T00:00:00Z', digitalRelease: '2026-10-05T00:00:00Z', physicalRelease: '2026-12-01T00:00:00Z' },
      ],
      '/api/v3/qualityprofile': [],
      // Radarr points a credit's url at its own proxy and keeps TMDB's address in remoteUrl.
      '/api/v3/credit?movieId=5': [
        {
          personName: 'Zendaya', character: 'Chani', order: 2, type: 'cast', personTmdbId: 505710,
          images: [{ coverType: 'headshot', url: '/MediaCoverProxy/abc/z.jpg?apikey=test-key', remoteUrl: 'https://image.tmdb.org/t/p/original/z.jpg' }],
        },
        { personName: 'Timothée Chalamet', character: 'Paul', order: 0, type: 'cast', images: [{ coverType: 'headshot', url: '/MediaCoverProxy/def/t.jpg' }] },
        { personName: 'Denis Villeneuve', job: 'Director', department: 'Directing', type: 'crew', order: 0, images: [] },
        { personName: '', type: 'cast' },
        { personName: 'Nobody', type: 'guest' },
      ],
      '/api/v3/credit?movieId=6': { message: 'not a list' },
    },
  };
  const { fake, ...services } = connectArr(database);
  fake.sonarr.state.series = [seriesRecord({
    id: 3, title: 'Andor', monitored: true, qualityProfileId: 4, tags: [9],
    images: [{ coverType: 'poster', remoteUrl: 'ftp://nope/p.jpg' }, { coverType: 'poster', remoteUrl: 'https://img/p.jpg' }],
    seasons: [{ seasonNumber: 1, monitored: true }, { seasonNumber: 2, monitored: true }],
    airTime: '21:00', firstAired: '2022-09-21T00:00:00Z', lastAired: '2025-05-13T00:00:00Z',
    nextAiring: '2026-11-01T01:00:00Z', previousAiring: '2025-05-13T01:00:00Z',
    alternateTitles: [{ title: 'Star Wars: Andor', seasonNumber: -1 }, { title: 'Star Wars: Andor', sceneSeasonNumber: 1 }, { title: 'Andor' }],
    ratings: { votes: 1234, value: 8.4 },
    statistics: { episodeFileCount: 1, episodeCount: 2, releaseGroups: ['NTb', 'FLUX'], percentOfEpisodes: 50 },
  })];
  fake.radarr.state.movies = [
    movieRecord({
      id: 5, title: 'Dune', originalTitle: 'Dune: Part Two', originalLanguage: { id: 1, name: 'English' },
      alternateTitles: [{ sourceType: 'tmdb', title: 'Dune 2' }, { sourceType: 'tmdb', title: 'Dune' }],
      ratings: {
        imdb: { votes: 600000, value: 8.5, type: 'user' }, tmdb: { votes: 7000, value: 8.2, type: 'user' },
        metacritic: { votes: 0, value: 79, type: 'user' }, rottenTomatoes: { votes: 0, value: 92, type: 'user' }, trakt: { votes: 0, value: 0, type: 'user' },
      },
      keywords: ['desert', 'prophecy'], youTubeTrailerId: 'Way9Dexny3w', website: 'https://www.dunemovie.com/',
      releaseDate: '2024-05-14T00:00:00Z', statistics: { movieFileCount: 1, sizeOnDisk: 10, releaseGroups: ['FLUX'] },
    }),
    movieRecord({ id: 6, title: 'Bare', website: 'javascript:alert(1)', ratings: { imdb: 'nope' } }),
  ];
  fake.sonarr.state.episodes = [
    {
      id: 32, seriesId: 3, seasonNumber: 1, episodeNumber: 2, title: 'Two', hasFile: false, monitored: true,
    },
    {
      id: 31, seriesId: 3, seasonNumber: 1, episodeNumber: 1, title: 'One', hasFile: true, monitored: true, finaleType: 'season',
      sceneSeasonNumber: 2, sceneEpisodeNumber: 5, unverifiedSceneNumbering: true, airDateUtc: '2022-09-21T00:00:00Z',
      images: [{ coverType: 'screenshot', remoteUrl: 'javascript:alert(1)' }],
      episodeFile: {
        id: 7, size: 100, qualityCutoffNotMet: true, releaseGroup: 'GRP',
        quality: { quality: { name: 'WEBDL-1080p' }, revision: { version: 2, real: 0, isRepack: true } },
        languages: [{ id: 1, name: 'English' }], customFormats: [{ id: 2, name: 'HDR' }, { id: 3, name: 'Atmos' }],
      },
    },
  ];
  for (const name of ['sonarr', 'radarr']) {
    fake[name].routes.push((method, url) => {
      const key = url.pathname + url.search;
      if (method === 'GET') return key in bodies[name] ? { status: 200, body: bodies[name][key] } : undefined;
    });
  }
  const calls = () => ['sonarr', 'radarr'].flatMap((name) => fake[name].requests.map(({ method, path, body }) => ({ name, method, path, body })));
  const library = createLibrary(services, () => [], createTitleStore(database));
  const routes = createLibraryRoutes(library);
  const post = (path, body) => routes.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  await t.test('newestFirst orders by added descending, missing last, ties by title', () => {
    // Sorting by title or service instead of the added date turns this red.
    const order = newestFirst([
      { title: 'B', added: '2024-01-01T00:00:00Z' }, { title: 'Z', added: null }, { title: 'A', added: '2024-01-01T00:00:00Z' },
      { title: 'New', added: '2025-05-05T00:00:00Z' }, { title: 'Bad', added: 'nope' },
    ]).map((entry) => entry.title);
    assert.deepEqual(order, ['New', 'A', 'B', 'Bad', 'Z']);
  });

  await t.test('series keeps the raw facts the title page marks from', async () => {
    // Resolving the cutoff by quality id only, or dropping a raw field the markers read, turns this red.
    const result = await library.series(3);
    assert.equal(result.kind, 'ok');
    const detail = result.value;
    assert.deepEqual(detail.qualityProfile, { id: 4, name: 'HD', cutoff: 'Remux group' });
    assert.deepEqual(detail.tags, ['kids']);
    assert.equal(detail.posterUrl, 'https://img/p.jpg');
    assert.deepEqual(detail.episodes.map((episode) => episode.id), [31, 32]);
    const [first] = detail.episodes;
    assert.equal(first.finaleType, 'season');
    assert.deepEqual([first.sceneSeasonNumber, first.sceneEpisodeNumber, first.unverifiedSceneNumbering], [2, 5, true]);
    assert.equal(first.imageUrl, null);
    assert.equal(first.airDate, '2022-09-21T00:00:00Z');
    assert.equal(first.file.qualityCutoffNotMet, true);
    assert.deepEqual(first.file.revision, { version: 2, real: 0, isRepack: true });
    assert.deepEqual([first.file.languages, first.file.customFormats], [['English'], ['HDR', 'Atmos']]);
    assert.equal(imageUrl([{ coverType: 'poster', remoteUrl: '/local/p.jpg' }], 'poster'), null);
  });

  await t.test('monitor forwards each change to the right write and the routes reject bad bodies', async () => {
    // Flipping a different season, sending the wrong endpoint, or loosening the body checks turns this red.
    for (const name of ['sonarr', 'radarr']) fake[name].requests.length = 0;
    await library.monitor({ service: 'sonarr', kind: 'season', seriesId: 3, seasonNumber: 2, monitored: false });
    await library.monitor({ service: 'sonarr', kind: 'episodes', episodeIds: [31, 32], monitored: true });
    await library.monitor({ service: 'sonarr', kind: 'series', seriesId: 3, monitored: false });
    await library.monitor({ service: 'radarr', kind: 'movie', movieId: 5, monitored: true });
    const writes = calls().filter((call) => call.method !== 'GET');
    assert.deepEqual(writes.map((call) => `${call.name} ${call.method} ${call.path}`), [
      'sonarr PUT /api/v3/series/3', 'sonarr PUT /api/v3/episode/monitor', 'sonarr PUT /api/v3/series/editor', 'radarr PUT /api/v3/movie/editor',
    ]);
    assert.deepEqual(fake.sonarr.state.series[0].seasons, [{ seasonNumber: 1, monitored: true }, { seasonNumber: 2, monitored: false }]);
    assert.equal(writes[0].body.id, 3);
    assert.deepEqual(writes[1].body, { episodeIds: [31, 32], monitored: true });
    assert.deepEqual(writes[2].body, { seriesIds: [3], monitored: false });
    assert.deepEqual(writes[3].body, { movieIds: [5], monitored: true });
    assert.equal((await post('/monitor', { service: 'sonarr', kind: 'series', seriesId: 3, monitored: true })).status, 204);
    const tooMany = Array.from({ length: 101 }, (_, index) => index + 1);
    assert.equal((await post('/monitor', { service: 'sonarr', kind: 'episodes', episodeIds: tooMany, monitored: true })).status, 400);
    assert.equal((await post('/monitor', { service: 'sonarr', kind: 'series', seriesId: 3, monitored: true, extra: 1 })).status, 400);
    assert.equal((await post('/refresh', { service: 'sonarr', kind: 'episodes', episodeIds: [1] })).status, 400);
    assert.equal((await post('/search', { service: 'radarr', kind: 'movie', movieId: 5 })).status, 204);
  });

  await t.test('calendar emits one movie entry per release date in range and refuses long windows', async () => {
    // Emitting one entry per movie, or dropping the 45-day cap, turns this red.
    const result = await library.calendar('2026-10-01T00:00:00.000Z', '2026-10-08T00:00:00.000Z');
    assert.deepEqual(result.entries.map((entry) => [entry.kind, entry.release, entry.at]), [
      ['movie', 'cinema', '2026-10-02T00:00:00Z'], ['movie', 'digital', '2026-10-05T00:00:00Z'],
    ]);
    assert.equal((await routes.request('/calendar?start=2026-10-01T00:00:00Z&end=2026-11-16T00:00:00Z')).status, 400);
    assert.equal((await routes.request('/calendar?start=2026-10-01T00:00:00Z&end=2026-10-08T00:00:00Z')).status, 200);
  });

  await t.test('title pages carry the facts the redesigned overview binds, and missing ones read as empty', async () => {
    // Dropping or renaming a field, or reading the wrong Sonarr or Radarr key, turns this red.
    const series = (await library.series(3)).value;
    assert.deepEqual(
      [series.airTime, series.firstAired, series.lastAired, series.nextAiring, series.previousAiring],
      ['21:00', '2022-09-21T00:00:00Z', '2025-05-13T00:00:00Z', '2026-11-01T01:00:00Z', '2025-05-13T01:00:00Z'],
    );
    assert.deepEqual(series.alternateTitles, ['Star Wars: Andor']);
    assert.deepEqual([series.rating, series.ratingVotes], [8.4, 1234]);
    assert.deepEqual([series.releaseGroups, series.statistics.percentOfEpisodes], [['NTb', 'FLUX'], 50]);
    const movie = (await library.movie(5)).value;
    assert.deepEqual(movie.ratings, {
      imdb: { value: 8.5, votes: 600000 }, tmdb: { value: 8.2, votes: 7000 }, metacritic: { value: 79, votes: 0 }, rottenTomatoes: { value: 92, votes: 0 }, trakt: null,
    });
    assert.equal(movie.rating, 8.2);
    assert.deepEqual(
      [movie.originalTitle, movie.originalLanguage, movie.alternateTitles, movie.keywords, movie.youTubeTrailerId, movie.website, movie.releaseDate, movie.releaseGroups],
      ['Dune: Part Two', 'English', ['Dune 2'], ['desert', 'prophecy'], 'Way9Dexny3w', 'https://www.dunemovie.com/', '2024-05-14T00:00:00Z', ['FLUX']],
    );
    const bare = (await library.movie(6)).value;
    assert.deepEqual(
      [bare.originalTitle, bare.originalLanguage, bare.alternateTitles, bare.keywords, bare.youTubeTrailerId, bare.website, bare.releaseDate, bare.releaseGroups, bare.rating],
      [null, null, [], [], null, null, null, [], null],
    );
    assert.deepEqual(Object.values(bare.ratings), [null, null, null, null, null]);
    fake.sonarr.state.series.push(seriesRecord({ id: 4, title: 'Bare show' }));
    const bareShow = (await library.series(4)).value;
    assert.deepEqual(
      [bareShow.airTime, bareShow.firstAired, bareShow.lastAired, bareShow.nextAiring, bareShow.previousAiring, bareShow.alternateTitles, bareShow.ratingVotes, bareShow.releaseGroups, bareShow.statistics.percentOfEpisodes],
      [null, null, null, null, null, [], null, [], null],
    );
  });

  await t.test('cast and crew come only with the movie page, with public photos and no Radarr key', async () => {
    // Asking for credits on the library list, sending Radarr's proxy url, or failing the page on a bad credit reply turns this red.
    fake.radarr.requests.length = 0;
    await library.titles();
    await library.preview('radarr', 438631);
    assert.equal(fake.radarr.requests.some(({ path }) => path === '/api/v3/credit'), false);
    const { credits } = (await library.movie(5)).value;
    assert.deepEqual(fake.radarr.requests.filter(({ path }) => path === '/api/v3/credit').map(({ params }) => params.get('movieId')), ['5']);
    assert.deepEqual(credits, {
      cast: [
        { name: 'Timothée Chalamet', character: 'Paul', order: 0, photoUrl: null, tmdbId: null },
        { name: 'Zendaya', character: 'Chani', order: 2, photoUrl: 'https://image.tmdb.org/t/p/original/z.jpg', tmdbId: 505710 },
      ],
      crew: [{ name: 'Denis Villeneuve', job: 'Director', department: 'Directing', photoUrl: null, tmdbId: null }],
    });
    assert.doesNotMatch(JSON.stringify(credits), /test-key|MediaCoverProxy|127\.0\.0\.1/);
    const bare = await library.movie(6);
    assert.equal(bare.kind, 'ok');
    assert.deepEqual(bare.value.credits, { cast: [], crew: [] });
  });

  await t.test('the library routes need a session', async () => {
    // Mounting /api/library outside the private guard turns this red.
    const { app } = await makeApp({ library });
    assert.equal((await app.request('/api/library/titles')).status, 401);
    const { session } = await signIn(app);
    assert.equal((await app.request('/api/library/titles', { headers: { Cookie: session } })).status, 200);
  });
});

test('library posters and title pages derive progress and totals from the live downloads snapshot', async (t) => {
  // The client modules are bundled by Vite, not compiled to dist, so they are loaded from source with Node's type stripping.
  const { stripTypeScriptTypes } = await import('node:module');
  const load = async (path) => import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8')))}`);
  const { buildRows } = await load('../src/client/downloads/model.ts');
  const { progressText, totals } = await load('../src/client/library/grid.ts');
  const { subjectProgress, seedingFacts } = await load('../src/client/library/progress.ts');
  const hash = 'EF'.repeat(20);
  const torrent = (overrides = {}) => ({ hash, name: 'Show.S01', sizeBytes: 1000, completedBytes: 400, downRate: 2000, upRate: 0, started: true, active: true,
    complete: false, message: '', ratioThousandths: 1500, seedersConnected: 3, trackerHost: 'tracker.example', seedingSeconds: 90, goneAt: null, ...overrides });
  const grab = (overrides = {}) => ({ hash, service: 'sonarr', movieId: null, episodeIds: [11, 12], seriesId: 5, importedAt: null, failedAt: null,
    releaseTitle: 'Show.S01', indexer: 'Blutopia', byHand: false, ...overrides });
  const queue = (overrides = {}) => ({ service: 'sonarr', queueId: 3, downloadId: null, movieId: null, episodeId: 13, seriesId: 5, title: 'Show.S01E03', label: 'Show',
    status: 'delay', trackedStatus: 'ok', trackedState: 'downloading', statusMessages: [], errorMessage: '', indexer: '', quality: 'WEBDL-1080p', formats: [],
    formatScore: 0, estimatedCompletion: null, ...overrides });
  const snapshot = (overrides = {}) => ({ torrents: [], queue: [], grabs: [], problems: [], ...overrides });
  const progressFor = (shot) => subjectProgress(shot, buildRows(shot));

  // Printing "8 + 2 / 10" when nothing downloads, or "8 / 10" while something does, turns this red.
  await t.test('progress text separates files from downloading episodes', () => {
    assert.equal(progressText(8, 2, 10), '8 + 2 / 10');
    assert.equal(progressText(8, 0, 10), '8 / 10');
    assert.equal(progressText(0, 0, 0), '0 / 0');
  });

  // Counting every title's totals the same way (or ignoring a movie's file) turns this red.
  await t.test('totals count shows, movies, episodes, files and size', () => {
    const show = (episodeFileCount, episodeCount, sizeOnDisk) => ({ type: 'tv', sizeOnDisk, tv: { episodeFileCount, episodeCount, totalEpisodeCount: episodeCount, seasonCount: 1 }, movie: null });
    const movie = (hasFile, sizeOnDisk) => ({ type: 'movie', sizeOnDisk, tv: null, movie: { hasFile, isAvailable: true } });
    assert.deepEqual(totals([show(8, 10, 100), show(2, 4, 50), movie(true, 30), movie(false, 0)]),
      { shows: 2, movies: 2, episodes: 14, files: 11, sizeBytes: 180 });
  });

  // Mapping only the first episode of a grab, or keeping imported grabs, turns this red.
  await t.test('a grab gives each of its episodes the torrent row word and percent; imported grabs and delayed queue items behave', () => {
    const live = progressFor(snapshot({ torrents: [torrent()], grabs: [grab()] }));
    for (const id of [11, 12]) assert.deepEqual(live.get(`episode:${id}`), { word: 'downloading', tone: 'normal', percent: 40, downRate: 2000 });
    assert.equal(progressFor(snapshot({ torrents: [torrent()], grabs: [grab({ importedAt: 1 })] })).size, 0, 'an imported grab is not live');
    const delayed = progressFor(snapshot({ queue: [queue()] })).get('episode:13');
    assert.deepEqual([delayed.word, delayed.percent], ['delayed', null]);
  });

  // Reading a gone torrent, or a grab that has not imported yet, as seeding turns this red.
  await t.test('seeding facts come from the imported grab\'s live torrent', () => {
    const imported = grab({ importedAt: 1 });
    assert.deepEqual(seedingFacts(snapshot({ torrents: [torrent()], grabs: [imported] }), { episodeId: 11 }),
      [{ trackerHost: 'tracker.example', seedingSeconds: 90, ratio: 1.5, complete: false }]);
    assert.deepEqual(seedingFacts(snapshot({ torrents: [torrent({ goneAt: 5 })], grabs: [imported] }), { episodeId: 11 }), []);
    assert.deepEqual(seedingFacts(snapshot({ torrents: [torrent()], grabs: [grab()] }), { episodeId: 11 }), []);
  });
});

test('title pages mark episodes and select ranges of episodes only', async (t) => {
  // The client modules are bundled by Vite, not compiled to dist, so they are loaded from source with Node's type stripping.
  const { stripTypeScriptTypes } = await import('node:module');
  const load = async (path) => import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8')))}`);
  const { episodeMarks, seasonMonitoredState, movieWord } = await load('../src/client/title/rows.ts');
  const { rangeBetween } = await load('../src/client/title/selection.ts');

  // Letting a season header or version row into a range, or depending on which end the range starts from, turns this red.
  await t.test('a range takes episode rows only, in either direction', () => {
    const rows = [
      { kind: 'season', key: 'season:1', episodeId: null },
      { kind: 'episode', key: 'episode:1', episodeId: 1 },
      { kind: 'episode', key: 'episode:2', episodeId: 2 },
      { kind: 'version', key: 'version:2', episodeId: 2 },
      { kind: 'episode', key: 'episode:3', episodeId: 3 },
      { kind: 'season', key: 'season:2', episodeId: null },
      { kind: 'episode', key: 'episode:4', episodeId: 4 },
    ];
    assert.deepEqual(rangeBetween(rows, 1, 6), [1, 2, 3, 4]);
    assert.deepEqual(rangeBetween(rows, 6, 1), [1, 2, 3, 4]);
  });

  // Mislabelling a premiere, finale or revision, or flagging scene numbers that match, turns this red.
  await t.test('episode marks follow Sonarr\'s numbering, finale type, revision and scene fields', () => {
    const file = (revision) => ({ revision: { version: 1, real: 0, isRepack: false, ...revision } });
    const episode = (overrides = {}) => ({ seasonNumber: 2, episodeNumber: 5, finaleType: null, sceneSeasonNumber: null, sceneEpisodeNumber: null,
      unverifiedSceneNumbering: false, file: null, ...overrides });
    const cases = [
      [episode(), []],
      [episode({ seasonNumber: 1, episodeNumber: 1 }), ['Series premiere']],
      [episode({ episodeNumber: 1 }), ['Premiere']],
      [episode({ seasonNumber: 0, episodeNumber: 1 }), []],
      [episode({ finaleType: 'series' }), ['Series finale']],
      [episode({ finaleType: 'season' }), ['Season finale']],
      [episode({ finaleType: 'midseason' }), ['Midseason finale']],
      [episode({ file: file({ version: 2, isRepack: true }) }), ['Repack']],
      [episode({ file: file({ version: 2 }) }), ['Proper']],
      [episode({ file: file({ real: 1 }) }), ['Real']],
      [episode({ sceneSeasonNumber: 2, sceneEpisodeNumber: 5 }), []],
      [episode({ sceneSeasonNumber: 3, sceneEpisodeNumber: 1 }), ['Scene S03E01']],
      [episode({ unverifiedSceneNumbering: true }), ['Scene numbering unverified']],
    ];
    for (const [input, marks] of cases) assert.deepEqual(episodeMarks(input), marks, JSON.stringify(input));
  });

  // Reading a partly monitored season as fully monitored or not monitored turns this red.
  await t.test('a season is monitored, not monitored or partly monitored', () => {
    assert.equal(seasonMonitoredState([{ monitored: true }, { monitored: true }]), 'all');
    assert.equal(seasonMonitoredState([{ monitored: false }, { monitored: false }]), 'none');
    assert.equal(seasonMonitoredState([{ monitored: true }, { monitored: false }]), 'mixed');
  });

  // Printing a word for a downloaded movie, or a different word from the Downloads screen's, turns this red.
  await t.test('a movie prints one status word only for exceptions', () => {
    const movie = (overrides = {}) => ({ status: 'released', hasFile: true, isAvailable: true, file: { qualityCutoffNotMet: false }, ...overrides });
    const live = (word, percent) => ({ word, tone: 'normal', percent, downRate: 0 });
    const cases = [
      [movie(), undefined, null],
      [movie({ status: 'deleted' }), live('downloading', 40), 'deleted'],
      [movie({ hasFile: false, file: null }), live('downloading', 64), 'downloading 64%'],
      [movie({ hasFile: false, file: null }), live('queued', null), 'queued'],
      [movie({ hasFile: false, file: null }), undefined, 'missing'],
      [movie({ hasFile: false, isAvailable: false, file: null }), undefined, 'not available'],
      [movie({ file: { qualityCutoffNotMet: true } }), undefined, 'below cutoff'],
    ];
    for (const [input, progress, word] of cases) assert.equal(movieWord(input, progress), word, JSON.stringify([input, progress]));
  });
});

test('discover helpers turn dates, filters and rows into what the screen shows', async (t) => {
  const { stripTypeScriptTypes } = await import('node:module');
  const load = async (path) => import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8')))}`);
  const { countdown, dateTab, homeQuery, gridPath, readState, readGridState, titlePath, extraRowsView, visibleCards, filterTags,
    readStoredState, writeStoredState, readRememberedState, clearSessionState, withoutFilters, readServices, writeServices } = await load('../src/client/discover/model.ts');
  const empty = { genres: [], providers: [], yearFrom: null, yearTo: null, minRating: null };
  const fakeStorage = () => {
    const map = new Map();
    return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => { map.set(key, String(value)); }, removeItem: (key) => { map.delete(key); }, clear: () => map.clear() };
  };
  const sessionStorage = fakeStorage();
  const localStorage = fakeStorage();
  globalThis.window = { sessionStorage, localStorage };
  t.after(() => { delete globalThis.window; });

  // Counting calendar days with local time, or moving a boundary (14 days, 84 days) by one, turns this red.
  await t.test('a countdown says today, tomorrow, days, weeks or months', () => {
    const cases = [[null, 'No date yet'], ['2026-10-11', 'Today'], ['2026-10-10', 'Today'], ['2026-10-12', 'Tomorrow'], ['2026-10-24', 'In 13 days'],
      ['2026-10-25', 'In 2 weeks'], ['2027-01-02', 'In 12 weeks'], ['2027-01-03', 'In 3 months'], ['2026-11-07', 'In 4 weeks']];
    for (const [date, word] of cases) assert.equal(countdown(date, '2026-10-11'), word, String(date));
  });

  // Padding the day with a zero, or a mixed-case month, turns this red.
  await t.test('a date tab is a three-letter upper-case month and a plain day', () => {
    assert.deepEqual(dateTab('2026-10-04'), { month: 'OCT', day: '4' });
    assert.deepEqual(dateTab('2027-01-22'), { month: 'JAN', day: '22' });
  });

  // Sending window or region to the server, or keeping an empty value, turns this red.
  await t.test('the home query uses the API names and drops empty values and the client-only window', () => {
    assert.equal(homeQuery({ ...empty, type: 'all', window: 90 }, []), '');
    const state = { type: 'tv', window: 30, genres: [18, 10765], providers: [8], yearFrom: 2006, yearTo: null, minRating: 7 };
    const query = homeQuery(state, [8, 337]);
    assert.equal(query, 'type=tv&genres=18%2C10765&providers=8&yearFrom=2006&minRating=7&services=8%2C337');
    assert.ok(!query.includes('window') && !query.includes('region'));
    assert.deepEqual(readState(`?${query}`), { ...state, window: 90 });
    assert.equal(readState('?window=30').window, 30);
  });

  // Letting a bad value through to the screen (and then to the server as a 400) turns this red.
  await t.test('page addresses read back, and bad values fall to the defaults', () => {
    assert.equal(gridPath('movies', empty, { sort: 'popular' }), '/discover/movies');
    const path = gridPath('trending', { ...empty, genres: [18], minRating: 8 }, { type: 'tv' });
    assert.equal(path, '/discover/trending?type=tv&genres=18&minRating=8');
    assert.deepEqual(readGridState(path.slice(path.indexOf('?'))), { ...empty, genres: [18], minRating: 8, type: 'tv', sort: 'popular' });
    assert.equal(gridPath('tv', empty, { sort: 'rating' }), '/discover/tv?sort=rating');
    assert.equal(readGridState('?sort=rating').sort, 'rating');
    assert.deepEqual(readState('?type=film&genres=x,5&yearFrom=2020&yearTo=2019&minRating=11&window=7'),
      { ...empty, genres: [5], type: 'all', window: 90 });
    assert.equal(readGridState('?sort=title').sort, 'popular');
    // Dropping the 1870–2200 bounds from yearOf turns this red: the server answers those years with a 400.
    assert.deepEqual([readState('?yearFrom=1869&yearTo=2201'), readState('?yearFrom=1870&yearTo=2200')].map(({ yearFrom, yearTo }) => [yearFrom, yearTo]),
      [[null, null], [1870, 2200]]);
  });

  // Sending a library title to the preview page, or a show to the movie preview, turns this red.
  await t.test('a card opens the library page, or the preview page for its type', () => {
    const result = (type, libraryId) => ({ tmdbId: 95396, type, libraryId });
    assert.equal(titlePath(result('tv', 7)), '/series/7');
    assert.equal(titlePath(result('movie', 7)), '/movie/7');
    assert.equal(titlePath(result('tv', null)), '/title/tmdb-tv/95396');
    assert.equal(titlePath(result('movie', null)), '/title/tmdb/95396');
  });

  // Hiding a row that is still loading, or showing the Trakt note when only some rows failed, turns this red.
  await t.test('extra rows hide when empty and the Trakt note needs every row to be not configured', () => {
    const row = (overrides) => ({ id: 'x', label: 'X', results: [{}], pending: false, failed: false, failure: null, ...overrides });
    const missing = { results: [], failed: true, failure: 'not_configured' };
    const view = extraRowsView([row(), row({ results: [] }), row({ results: [], pending: true })]);
    assert.equal(view.shown.length, 2);
    assert.equal(view.traktMissing, false);
    assert.equal(extraRowsView([row(missing), row(missing)]).traktMissing, true);
    assert.equal(extraRowsView([row(missing), row({ results: [], failed: true, failure: 'unreachable' })]).traktMissing, false);
    assert.equal(extraRowsView([]).traktMissing, false);
    // Hiding a row whose source is down, so it loses its Try again, turns this red.
    assert.deepEqual(extraRowsView([row(missing), row({ id: 'down', results: [], failed: true, failure: 'unreachable' })]).shown.map((shown) => shown.id), ['down']);
  });

  // Counting a card's gap twice, or returning zero cards for a narrow strip, turns this red.
  await t.test('a strip shows as many whole cards as fit, and at least one', () => {
    assert.equal(visibleCards(1360), 5);
    assert.equal(visibleCards(220), 1);
    assert.equal(visibleCards(100), 1);
  });

  // Dropping a tag, or removing more than the one the tag names, turns this red.
  await t.test('filter tags name each active filter and clear only their own', () => {
    const filters = { genres: [18, 99], providers: [8], yearFrom: 2006, yearTo: 2024, minRating: 7 };
    const tags = filterTags(filters, [{ id: 18, name: 'Drama' }], [{ id: 8, name: 'Netflix' }]);
    assert.deepEqual(tags.map((tag) => tag.label), ['Drama', 'Netflix', '2006–2024', 'Rating 7 and above']);
    assert.deepEqual(tags[0].remove, { ...filters, genres: [99] });
    assert.deepEqual(tags[2].remove, { ...filters, yearFrom: null, yearTo: null });
    assert.equal(filterTags({ ...empty, yearFrom: 2006 }, [], [])[0].label, 'From 2006');
    assert.equal(filterTags({ ...empty, yearTo: 2024 }, [], [])[0].label, 'Up to 2024');
  });

  const filtered = { type: 'tv', window: 30, genres: [18, 10765], providers: [8], yearFrom: 2006, yearTo: null, minRating: 7 };

  // Writing the filters to localStorage again, or reading the remembered set back as the current state, turns this red.
  await t.test('filters are saved for the tab session only and the last non-empty set is remembered', () => {
    writeStoredState(filtered);
    assert.deepEqual(readStoredState(), filtered);
    assert.equal(localStorage.getItem('mm2.discover.filters'), null);
    assert.deepEqual(readRememberedState(), filtered);
    sessionStorage.clear();
    assert.equal(readStoredState(), undefined);
    assert.deepEqual(readRememberedState(), filtered);
  });

  // Remembering a state with no filters, or treating a type-only state as a filter set, turns this red.
  await t.test('an empty filter set does not overwrite the remembered set, and nothing remembered reads as undefined', () => {
    localStorage.clear();
    assert.equal(readRememberedState(), undefined);
    writeStoredState(filtered);
    const typeOnly = { ...empty, type: 'tv', window: 30 };
    writeStoredState(typeOnly);
    assert.deepEqual(readStoredState(), typeOnly);
    assert.deepEqual(readRememberedState(), filtered);
  });

  // Clearing the remembered set on sign-out, or leaving a filter key, the media type or the Upcoming window in the address, turns this red.
  await t.test('sign-out clears the session filters but not the remembered set or the services, and strips filters from an address', () => {
    writeStoredState(filtered);
    writeServices([8]);
    clearSessionState();
    assert.equal(readStoredState(), undefined);
    assert.deepEqual(readRememberedState(), filtered);
    assert.deepEqual(readServices(), [8]);
    assert.equal(withoutFilters('?type=tv&genres=36&providers=8&yearFrom=2000&yearTo=2010&minRating=7&window=30'), '');
    assert.equal(withoutFilters('?sort=rating&genres=36'), '?sort=rating');
    assert.equal(withoutFilters('?type=movie&window=90&sort=rating'), '?sort=rating');
    assert.equal(withoutFilters('?genres=36'), '');
    assert.equal(withoutFilters(''), '');
  });
});

test('the calendar groups one show\'s same-day episodes and frames week, month and forecast windows', async (t) => {
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../src/client/calendar/model.ts', import.meta.url), 'utf8');
  const { windowFor, groupByDay, entryWord, shiftAnchor } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
  const ymd = (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

  // Starting the week on Sunday, or ending the month grid on the last day instead of the following Sunday, turns this red.
  await t.test('week runs Monday to Sunday, the month grid pads to whole weeks and the forecast is five days', () => {
    const week = windowFor('week', new Date(2026, 9, 7, 15));
    assert.deepEqual([ymd(week.start), week.days.length, ymd(week.days[6])], [[2026, 10, 5], 7, [2026, 10, 11]]);
    const month = windowFor('month', new Date(2026, 9, 14));
    assert.deepEqual([ymd(month.start), ymd(month.days[month.days.length - 1]), month.days.length], [[2026, 9, 28], [2026, 11, 1], 35]);
    assert.equal(windowFor('month', new Date(2026, 7, 14)).days.length, 42, 'August 2026 needs six weeks');
    const forecast = windowFor('forecast', new Date(2026, 9, 8));
    assert.deepEqual([forecast.days.length, ymd(forecast.lookback)], [5, [2026, 10, 1]]);
    assert.deepEqual(ymd(shiftAnchor('month', new Date(2026, 0, 31), 1)), [2026, 2, 1]);
  });

  // Listing each episode separately, or merging two different shows, turns this red.
  await t.test('two episodes of one show on one day collapse into one group; another show stays separate', () => {
    const episode = (id, seriesId, episodeNumber, title, hasFile = false) => ({ service: 'sonarr', kind: 'episode', id, seriesId, seriesTitle: `Show ${seriesId}`,
      seasonNumber: 2, episodeNumber, title, at: new Date(2026, 9, 7, 20).toISOString(), hasFile, monitored: true, quality: null, finaleType: null });
    const [groups] = groupByDay([episode(1, 5, 3, 'Sweet Vitriol'), episode(2, 5, 4, 'Next'), episode(3, 6, 1, 'Pilot')], [new Date(2026, 9, 7)]);
    assert.deepEqual(groups.map((group) => [group.title, group.subtitle, group.count]), [['Show 5', 'S02E03–E04', 2], ['Show 6', 'S02E01 Pilot', 1]]);
  });

  // Calling a downloaded or not-yet-aired episode missing, or a downloading one missing, turns this red.
  await t.test('only aired, monitored, file-less, idle entries say missing; live progress wins', () => {
    const now = new Date(2026, 9, 7, 22).getTime();
    const group = (overrides = {}) => ({ entries: [{ service: 'sonarr', kind: 'episode', id: 1, seriesId: 5, seasonNumber: 2, episodeNumber: 3, title: 't',
      at: new Date(2026, 9, 7, 20).toISOString(), hasFile: false, monitored: true, ...overrides }] });
    const idle = new Map();
    assert.equal(entryWord(group(), idle, now), 'missing');
    assert.equal(entryWord(group({ hasFile: true }), idle, now), null);
    assert.equal(entryWord(group({ at: new Date(2026, 9, 8).toISOString() }), idle, now), null);
    assert.equal(entryWord(group(), new Map([['episode:1', { word: 'downloading', tone: 'normal', percent: 40.2, downRate: 1 }]]), now), 'downloading 40%');
    assert.equal(entryWord(group(), new Map([['episode:1', { word: 'queued', tone: 'normal', percent: null, downRate: 0 }]]), now), 'queued');
  });
});

const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');

// An S3-compatible bucket in memory: path-style PUT, GET, DELETE and ListObjectsV2, with a switch that answers every request with one status.
const startFakeS3 = async (t) => {
  const { createServer } = await import('node:http');
  const objects = new Map();
  const requests = [];
  const state = { failWith: undefined };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    requests.push({ method: request.method, url: request.url, headers: request.headers, body });
    if (state.failWith !== undefined) {
      response.writeHead(state.failWith).end();
      return;
    }
    const url = new URL(request.url, 'http://fake');
    const [, bucket, ...rest] = url.pathname.split('/');
    const key = rest.map(decodeURIComponent).join('/');
    if (request.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const prefix = url.searchParams.get('prefix') ?? '';
      const contents = [...objects]
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, value]) => `<Contents><Key>${name}</Key><Size>${value.length}</Size></Contents>`)
        .join('');
      response.writeHead(200, { 'content-type': 'application/xml' })
        .end(`<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${bucket}</Name>${contents}</ListBucketResult>`);
    } else if (request.method === 'PUT') {
      objects.set(key, body);
      response.writeHead(200).end();
    } else if (request.method === 'GET') {
      if (objects.has(key)) response.writeHead(200).end(objects.get(key));
      else response.writeHead(404).end();
    } else if (request.method === 'DELETE') {
      objects.delete(key);
      response.writeHead(204).end();
    } else {
      response.writeHead(405).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const close = () => {
    if (!server.listening) return;
    server.closeAllConnections();
    server.close();
  };
  t.after(close);
  return { endpoint: `http://127.0.0.1:${server.address().port}`, objects, requests, state, close };
};

// Encoding the secret's "+" wrongly, sorting query parameters by original order, hashing a body other than the one sent, signing with a region other than the configured one, or naming the endpoint or key id in an error turns this red.
// Going back to "now minus 24 hours" turns this red: in London, half past midnight after the 23-hour spring-forward day lands 24 hours back on the day before.
test('history calls the calendar day before today Yesterday across a daylight-saving change', async () => {
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../src/client/history/when.ts', import.meta.url), 'utf8');
  const zone = process.env.TZ;
  process.env.TZ = 'Europe/London';
  try {
    const { dayTitle } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
    const now = new Date(2026, 2, 30, 0, 30).getTime();
    assert.equal(dayTitle(new Date(2026, 2, 29, 12, 0).getTime(), now), 'Yesterday');
    assert.equal(dayTitle(new Date(2026, 2, 28, 12, 0).getTime(), now), '28 Mar');
  } finally {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
});

test('S3 requests are signed with AWS Signature V4 and stored path-style', async (t) => {
  const { createS3Store, signRequest } = await import(s3ModuleUrl);

  const vector = {
    method: 'GET',
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    service: 'service',
    date: '20150830T123600Z',
  };
  for (const [path, signature] of [
    ['/', '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31'],
    ['/?Param2=value2&Param1=value1', 'b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500'],
  ]) {
    assert.equal(
      signRequest({
        ...vector,
        url: new URL(`https://example.amazonaws.com${path}`),
        headers: { host: 'example.amazonaws.com', 'x-amz-date': vector.date },
      }),
      `AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=${signature}`,
      path,
    );
  }

  const s3 = await startFakeS3(t);
  const config = {
    endpoint: s3.endpoint,
    bucket: 'mm2-backups',
    region: 'us-west-004',
    accessKeyId: `key-id-${process.pid}-distinctive`,
    secretAccessKey: `secret-${process.pid}-distinctive`,
  };
  const store = createS3Store(config, { now: () => Date.UTC(2026, 9, 11, 4, 7, 33) });
  const body = new Uint8Array([1, 2, 3]);
  await store.put('backups/a.sqlite.gz', body, 'application/gzip');
  await store.put('other/b', new Uint8Array([4]), 'text/plain');
  assert.equal(s3.requests[0].method, 'PUT');
  assert.equal(s3.requests[0].url, '/mm2-backups/backups/a.sqlite.gz');
  assert.deepEqual(new Uint8Array(await store.get('backups/a.sqlite.gz')), body);
  assert.equal(await store.get('backups/missing.sqlite.gz'), undefined);
  assert.deepEqual(await store.list('backups/'), [{ key: 'backups/a.sqlite.gz', size: 3 }]);
  await store.delete('backups/a.sqlite.gz');
  assert.deepEqual(await store.list('backups/'), []);
  assert.equal(s3.requests.length, 7);
  for (const request of s3.requests) {
    assert.ok(request.headers.authorization.startsWith(`AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/20261011/us-west-004/s3/aws4_request, SignedHeaders=`));
    assert.equal(request.headers['x-amz-content-sha256'], sha256Hex(request.body));
  }

  s3.state.failWith = 503;
  const answered = await store.put('backups/c.sqlite.gz', body, 'application/gzip').catch((error) => error);
  assert.equal(answered.message, 'Backup storage answered 503.');
  s3.close();
  const unreachable = await store.get('backups/c.sqlite.gz').catch((error) => error);
  assert.equal(unreachable.message, 'Backup storage is unreachable.');
  for (const error of [answered, unreachable]) {
    for (const secret of [config.secretAccessKey, config.accessKeyId, config.endpoint]) assert.equal(error.message.includes(secret), false);
  }

});

// Accepting half an S3 setup, accepting a folder and a bucket together, losing settings saved under the old r2.* keys,
// creating a missing backup folder, or letting a key escape the folder turns this red.
test('backups go to a folder or an S3-compatible bucket, chosen by settings or environment', async (t) => {
  const { applicationMigrations, migrateDatabase, openDatabase } = await import(databaseModuleUrl);
  const { listSettingKeys, setSetting } = await import(settingsModuleUrl);
  const { backupDestinationFromEnvironment, createFolderStore, readBackupDestination } = await import(backupDestinationModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-destination-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const s3 = { endpoint: 'https://s3.example', bucket: 'backups', region: 'auto', accessKeyId: 'key-id', secretAccessKey: 'secret' };
  const env = { BACKUP_ENDPOINT: s3.endpoint, BACKUP_BUCKET: s3.bucket, BACKUP_ACCESS_KEY_ID: s3.accessKeyId, BACKUP_SECRET_ACCESS_KEY: s3.secretAccessKey };
  for (const name of Object.keys(env)) {
    const partial = { ...env };
    delete partial[name];
    assert.equal(backupDestinationFromEnvironment(partial), undefined, `without ${name}`);
  }
  assert.deepEqual(backupDestinationFromEnvironment(env), { kind: 's3', config: s3 });
  assert.deepEqual(backupDestinationFromEnvironment({ ...env, BACKUP_REGION: 'us-west-004' }), { kind: 's3', config: { ...s3, region: 'us-west-004' } });
  assert.deepEqual(backupDestinationFromEnvironment({ BACKUP_FOLDER: root }), { kind: 'folder', folder: root });
  assert.throws(() => backupDestinationFromEnvironment({ ...env, BACKUP_FOLDER: root }), /either a backup folder or a backup bucket/);
  assert.throws(() => backupDestinationFromEnvironment({ BACKUP_FOLDER: 'backups' }), /absolute path/);

  // A database saved before the rename keeps its bucket.
  const databasePath = join(root, 'data', 'media-manager.sqlite');
  await mkdir(join(root, 'data'), { mode: 0o700 });
  const old = new DatabaseSync(databasePath);
  await chmod(databasePath, 0o600);
  migrateDatabase(old, applicationMigrations.slice(0, applicationMigrations.findIndex((migration) => migration.includes("'r2.endpoint'"))));
  for (const [category, key, value] of [
    ['serviceAddresses', 'r2.endpoint', s3.endpoint],
    ['serviceAddresses', 'r2.bucket', s3.bucket],
    ['credentials', 'r2.accessKeyId', s3.accessKeyId],
    ['credentials', 'r2.secretAccessKey', s3.secretAccessKey],
  ]) setSetting(old, category, key, value);
  old.close();
  const database = openDatabase(databasePath);
  t.after(() => database.close());
  assert.deepEqual(listSettingKeys(database).map(({ key }) => key), ['backup.accessKeyId', 'backup.secretAccessKey', 'backup.bucket', 'backup.endpoint']);
  assert.deepEqual(readBackupDestination(database), { kind: 's3', config: s3 });
  setSetting(database, 'hostPaths', 'backup.folder', root);
  assert.throws(() => readBackupDestination(database), /not both/);

  const missing = createFolderStore(join(root, 'unmounted'));
  await assert.rejects(missing.put('backups/a', new Uint8Array([1]), 'application/octet-stream'), /does not exist/);
  assert.equal(existsSync(join(root, 'unmounted')), false);
  const folder = join(root, 'store');
  await mkdir(folder);
  const store = createFolderStore(folder);
  assert.deepEqual(await store.list('backups/'), []);
  await store.put('backups/a.enc', new Uint8Array([1, 2, 3]), 'application/octet-stream');
  await store.put('backups/latest.json', new Uint8Array([4]), 'application/json');
  await writeFile(join(folder, 'backups', 'b.enc.partial'), 'half');
  assert.deepEqual((await store.list('backups/')).sort((a, b) => a.key.localeCompare(b.key)), [
    { key: 'backups/a.enc', size: 3 },
    { key: 'backups/latest.json', size: 1 },
  ]);
  assert.deepEqual(await store.list('backups/a'), [{ key: 'backups/a.enc', size: 3 }]);
  assert.deepEqual(new Uint8Array(await store.get('backups/a.enc')), new Uint8Array([1, 2, 3]));
  assert.equal(await store.get('backups/missing'), undefined);
  assert.equal((await stat(join(folder, 'backups', 'a.enc'))).mode & 0o777, 0o600);
  await store.delete('backups/a.enc');
  assert.equal(await store.get('backups/a.enc'), undefined);
  await assert.rejects(store.get('../outside'), /outside the backup folder/);
  // Leaving the partial file behind when the save fails fills the backup folder with dead copies.
  await mkdir(join(folder, 'backups', 'blocked.enc', 'inside'), { recursive: true });
  await assert.rejects(store.put('backups/blocked.enc', new Uint8Array([1]), 'application/octet-stream'));
  assert.equal(existsSync(join(folder, 'backups', 'blocked.enc.partial')), false);
});

// Snapshotting with a plain file copy during a write, letting an unfinished transaction on the app's connection into the snapshot, uploading an unencrypted snapshot, skipping after a failed upload, pruning by the wrong day, restoring a snapshot without checking its key, hash or schema version, sealing with BACKUP_KEY after a key pair exists, or opening a snapshot with the wrong kind of key turns this red.
test('backups snapshot a changing database and restore it consistently', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { createBackup, createBackupKeyPair, listBackupRuns, restoreBackup } = await import(backupModuleUrl);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-backup-'));
  const databasePath = join(root, 'live', 'media-manager.sqlite');
  const database = openDatabase(databasePath);
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const events = createEventHub();
  const published = [];
  events.subscribe((event) => published.push(event));
  const objects = new Map();
  const calls = [];
  let failPut = false;
  const store = {
    async put(key, body) {
      calls.push(['put', key]);
      if (failPut) throw new Error('Backup storage answered 503.');
      objects.set(key, Uint8Array.from(body));
    },
    async get(key) {
      calls.push(['get', key]);
      return objects.get(key);
    },
    async list(prefix) {
      calls.push(['list', prefix]);
      return [...objects].filter(([key]) => key.startsWith(prefix)).map(([key, body]) => ({ key, size: body.byteLength }));
    },
    async delete(key) {
      calls.push(['delete', key]);
      objects.delete(key);
    },
  };
  let configured = false;
  let clock = Date.UTC(2026, 9, 11, 12, 0, 0);
  const backupKey = randomBytes(32);
  // Same layout as the server writes: 12-byte nonce, ciphertext, 16-byte tag.
  const seal = (plain) => {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', backupKey, nonce);
    return Buffer.concat([nonce, cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  };
  const backup = createBackup({ database, events, store: () => (configured ? store : undefined), key: () => backupKey, now: () => clock });
  const outcome = (run) => [run.outcome, run.detail];

  assert.deepEqual(outcome(await backup.run()), ['skipped', 'not_configured']);
  assert.deepEqual(calls, []);
  assert.deepEqual(published.map((event) => event.type), ['backup']);

  for (const [key, value] of [['sonarr.url', 'http://127.0.0.1:8989'], ['radarr.url', 'http://127.0.0.1:7878']]) {
    setSetting(database, 'serviceAddresses', key, value);
  }
  setSetting(database, 'credentials', 'sonarr.apiKey', 'sonarr-key');
  database.exec(`INSERT INTO torrents VALUES ('HASH1', 'Some.Movie', 100, 50, 0, 0, 1, 1, 1, 0, '', 0, 0, 0, 0, NULL, 1, 1, NULL, 0, '');
    INSERT INTO grabs VALUES (1, 'radarr', 'movie:1', 'movie:1', 'movie:1', 'movie:1', 'guid-1', 'Some.Movie', 'grab', 'sent', NULL, NULL, 1, 1);`);

  const stopPath = join(root, 'stop-writer');
  const writer = runNode(`
    import { existsSync } from 'node:fs';
    import { DatabaseSync } from 'node:sqlite';
    const database = new DatabaseSync(${JSON.stringify(databasePath)}, { timeout: 5_000 });
    const write = database.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)');
    for (let count = 1; !existsSync(${JSON.stringify(stopPath)}); count += 1) {
      database.exec('BEGIN IMMEDIATE');
      write.run('counter', String(count));
      write.run('counter-copy', String(count));
      database.exec('COMMIT');
      // A writer that retakes the lock at once starves every other connection's busy wait.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2);
    }
    database.close();
  `);
  const counter = () => database.prepare("SELECT value FROM preferences WHERE key = 'counter'").get()?.value;
  for (const deadline = Date.now() + 10_000; counter() === undefined;) {
    assert.ok(Date.now() < deadline, 'writer never wrote');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  configured = true;
  clock += 60_000;
  const written = await backup.run();
  await writeFile(stopPath, '');
  const writerResult = await writer;
  assert.equal(writerResult.code, 0, writerResult.stderr);
  assert.deepEqual(outcome(written), ['ok', '']);
  assert.match(written.objectKey, /^backups\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z-[0-9a-f]{12}\.sqlite\.gz\.enc$/);
  assert.throws(() => gunzipSync(objects.get(written.objectKey)));
  assert.equal(written.bytes, objects.get(written.objectKey).byteLength);
  assert.equal(JSON.parse(Buffer.from(objects.get('backups/latest.json')).toString()).key, written.objectKey);

  const restoredPath = join(root, 'restored', 'media-manager.sqlite');
  const restoredResult = await restoreBackup({ store, target: restoredPath, key: backupKey });
  assert.equal(restoredResult.key, written.objectKey);
  const restored = new DatabaseSync(restoredPath, { readOnly: true });
  t.after(() => restored.close());
  assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  for (const table of ['settings', 'torrents', 'grabs']) {
    const rows = (source) => source.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all();
    assert.deepEqual(rows(restored), rows(database), table);
  }
  const preferences = Object.fromEntries(restored.prepare('SELECT key, value FROM preferences').all().map((row) => [row.key, row.value]));
  assert.ok(Number(preferences.counter) >= 1);
  assert.equal(preferences['counter-copy'], preferences.counter);
  assert.deepEqual(restoredResult.counts.find(({ table }) => table === 'settings'), { table: 'settings', count: 3 });

  database.exec('BEGIN IMMEDIATE');
  database.prepare("INSERT INTO preferences (key, value) VALUES ('unfinished', 'yes')").run();
  clock += 60_000;
  const duringTransaction = await backup.run({ force: true });
  database.exec('COMMIT');
  assert.deepEqual(outcome(duringTransaction), ['ok', '']);
  const isolatedPath = join(root, 'isolated', 'media-manager.sqlite');
  await restoreBackup({ store, target: isolatedPath, key: backupKey });
  const isolated = new DatabaseSync(isolatedPath, { readOnly: true });
  t.after(() => isolated.close());
  assert.equal(isolated.prepare("SELECT value FROM preferences WHERE key = 'unfinished'").get(), undefined);

  clock += 5 * 60_000;
  assert.deepEqual(outcome(await backup.run({ force: true })), ['ok', '']);
  clock += 5 * 60_000;
  assert.deepEqual(outcome(await backup.run()), ['skipped', 'unchanged']);
  const otherProcess = await runNode(`
    import { DatabaseSync } from 'node:sqlite';
    const database = new DatabaseSync(${JSON.stringify(databasePath)}, { timeout: 5_000 });
    database.prepare("INSERT OR REPLACE INTO preferences (key, value) VALUES ('theme', 'dark')").run();
    database.close();
  `);
  assert.equal(otherProcess.code, 0, otherProcess.stderr);
  clock += 5 * 60_000;
  assert.deepEqual(outcome(await backup.run()), ['ok', '']);

  failPut = true;
  clock += 5 * 60_000;
  assert.deepEqual(outcome(await backup.run({ force: true })), ['failed', 'Backup storage answered 503.']);
  failPut = false;
  clock += 5 * 60_000;
  assert.deepEqual(outcome(await backup.run()), ['ok', '']);
  assert.deepEqual(listBackupRuns(database).slice(0, 3).map((run) => run.outcome), ['ok', 'failed', 'ok']);
  assert.equal(published.length, listBackupRuns(database).length);

  clock += 5 * 60_000;
  const keyAt = (offset) => `backups/${new Date(clock + offset).toISOString().replace(/:/g, '-')}-aaaaaaaaaaaa.sqlite.gz.enc`;
  const hour = 3_600_000;
  const aged = { kept: [keyAt(-2 * hour), keyAt(-30 * hour), keyAt(-72 * hour)], dropped: [keyAt(-31 * hour), keyAt(-216 * hour)] };
  for (const key of [...aged.kept, ...aged.dropped]) objects.set(key, new Uint8Array([0]));
  const pruned = await backup.run({ force: true });
  assert.deepEqual(outcome(pruned), ['ok', '']);
  for (const key of [...aged.kept, pruned.objectKey, written.objectKey, 'backups/latest.json']) assert.ok(objects.has(key), key);
  for (const key of aged.dropped) assert.equal(objects.has(key), false, key);

  const { restoreKey } = createBackupKeyPair(database, () => clock);
  const sealedToPair = await backup.run({ force: true });
  assert.deepEqual(outcome(sealedToPair), ['ok', '']);
  assert.equal(Buffer.from(objects.get(sealedToPair.objectKey).subarray(0, 9)).toString('ascii'), 'mm2x25519');
  assert.equal((await restoreBackup({ store, target: join(root, 'from-pair.sqlite'), restoreKey })).key, sealedToPair.objectKey);
  const bothKeys = await restoreBackup({ store, target: join(root, 'from-env.sqlite'), objectKey: written.objectKey, key: backupKey, restoreKey });
  assert.equal(bothKeys.key, written.objectKey);
  await assert.rejects(
    restoreBackup({ store, target: join(root, 'pair-with-env-key.sqlite'), objectKey: sealedToPair.objectKey, key: backupKey }),
    { message: 'This backup needs the restore key; set BACKUP_RESTORE_KEY.' },
  );
  const otherRestoreKey = `mm2-restore-${generateKeyPairSync('x25519').privateKey.export({ format: 'jwk' }).d}`;
  await assert.rejects(
    restoreBackup({ store, target: join(root, 'pair-with-other-key.sqlite'), objectKey: sealedToPair.objectKey, restoreKey: otherRestoreKey }),
    { message: 'Downloaded snapshot could not be decrypted with the restore key.' },
  );
  await assert.rejects(
    restoreBackup({ store, target: join(root, 'env-with-restore-key.sqlite'), objectKey: written.objectKey, restoreKey }),
    { message: 'This backup needs BACKUP_KEY.' },
  );

  const refusal = (options) => restoreBackup({ store, key: backupKey, ...options }).then(() => 'restored', (error) => error.message);
  assert.equal(await refusal({ target: restoredPath }), 'Restore target already exists.');
  assert.equal(await refusal({ target: join(projectDirectory, 'restored.sqlite') }), 'Database path must be an absolute file path outside the application directory.');
  assert.equal(
    await refusal({ target: join(root, 'wrong-key.sqlite'), objectKey: written.objectKey, key: randomBytes(32) }),
    'Downloaded snapshot could not be decrypted with BACKUP_KEY.',
  );
  objects.set(written.objectKey, seal(gzipSync(Buffer.from('not the snapshot'))));
  assert.equal(await refusal({ target: join(root, 'tampered.sqlite'), objectKey: written.objectKey }), 'Downloaded snapshot does not match its name.');
  const futurePath = join(root, 'future.sqlite');
  const future = new DatabaseSync(futurePath);
  future.exec('PRAGMA user_version = 99;');
  future.close();
  const futureBytes = await readFile(futurePath);
  const futureKey = `backups/2026-10-11T00-00-00.000Z-${sha256Hex(futureBytes).slice(0, 12)}.sqlite.gz.enc`;
  objects.set(futureKey, seal(gzipSync(futureBytes)));
  assert.equal(await refusal({ target: join(root, 'future-restored.sqlite'), objectKey: futureKey }), 'Database schema version is newer than this application.');
});

// Opening the database before listing or restoring, printing a secret, running without a valid BACKUP_KEY, backing up with both a folder
// and a bucket set, backing up while turned off, or restoring over an existing file turns this red.
test('backup commands upload, list and restore through a bucket or a folder from the command line', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-backup-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const s3 = await startFakeS3(t);
  const base = { ...process.env, NODE_NO_WARNINGS: '1' };
  for (const name of ['BACKUP_FOLDER', 'BACKUP_ENDPOINT', 'BACKUP_BUCKET', 'BACKUP_REGION', 'BACKUP_ACCESS_KEY_ID', 'BACKUP_SECRET_ACCESS_KEY', 'BACKUP_KEY', 'BACKUP_RESTORE_KEY']) delete base[name];
  const backupKey = randomBytes(32).toString('hex');
  const withoutKey = { ...base, DB_PATH: join(root, 'live', 'media-manager.sqlite') };
  const withDatabase = { ...withoutKey, BACKUP_KEY: backupKey };
  const secret = `secret-${process.pid}-distinctive`;
  const keyId = `key-id-${process.pid}-distinctive`;
  const withR2 = { ...base, BACKUP_ENDPOINT: s3.endpoint, BACKUP_BUCKET: 'mm2-backups', BACKUP_ACCESS_KEY_ID: keyId, BACKUP_SECRET_ACCESS_KEY: secret, BACKUP_KEY: backupKey };
  const outputs = [];
  const cli = async (args, env, stdin) => {
    const result = await runCli(args, { env, stdin });
    outputs.push(result.stdout, result.stderr);
    return result;
  };

  const notConfigured = await cli(['backup', 'now'], withDatabase);
  assert.equal(notConfigured.code, 0, notConfigured.stderr);
  assert.equal(notConfigured.stdout, 'backup: skipped not_configured\n');

  for (const [category, key, value] of [
    ['serviceAddresses', 'backup.endpoint', s3.endpoint],
    ['serviceAddresses', 'backup.bucket', 'mm2-backups'],
    ['credentials', 'backup.accessKeyId', keyId],
    ['credentials', 'backup.secretAccessKey', secret],
  ]) {
    const saved = await cli(['settings', 'set', category, key], withDatabase, value);
    assert.equal(saved.code, 0, saved.stderr);
  }
  const keyless = await cli(['backup', 'now'], withoutKey);
  assert.equal(keyless.code, 1);
  assert.equal(keyless.stdout, 'backup: failed No backup key: create one in the app or set BACKUP_KEY.\n');
  const off = await cli(['backup', 'off'], withoutKey);
  assert.equal(off.stdout, 'backups: off\n');
  assert.equal((await cli(['backup', 'now'], withDatabase)).stdout, 'backup: skipped off\n');
  assert.equal((await cli(['backup', 'on'], withoutKey)).stdout, 'backups: on\n');
  const malformed = await cli(['backup', 'now'], { ...withoutKey, BACKUP_KEY: 'not-hex' });
  assert.equal(malformed.code, 1);
  assert.equal(malformed.stdout, 'backup: failed BACKUP_KEY must be 64 hex characters.\n');
  const uploaded = await cli(['backup', 'now'], withDatabase);
  assert.equal(uploaded.code, 0, uploaded.stderr);
  const key = uploaded.stdout.match(/^backup: ok (backups\/\S+\.sqlite\.gz\.enc) \d+ bytes\n$/)?.[1];
  assert.ok(key, uploaded.stdout);

  const listed = await cli(['backup', 'list'], withR2);
  assert.equal(listed.code, 0, listed.stderr);
  assert.equal(listed.stdout, `${key} ${s3.objects.get(key).length} bytes (latest)\n`);

  const target = join(root, 'restored', 'media-manager.sqlite');
  const restored = await cli(['backup', 'restore', '--to', target], withR2);
  assert.equal(restored.code, 0, restored.stderr);
  assert.equal(
    restored.stdout,
    `restored ${key} to ${target}\nsettings 4\ntorrents 0\ntorrent_grabs 0\ngrabs 0\nproblems 0\nprotected_items 0\npreferences 1\nsecond_versions 0\nversion_events 0\n`,
  );

  const { BACKUP_KEY: _, ...r2Only } = withR2;
  const unkeyed = await cli(['backup', 'restore', '--to', join(root, 'unkeyed.sqlite')], r2Only);
  assert.equal(unkeyed.code, 1);
  assert.equal(unkeyed.stderr, 'Set BACKUP_RESTORE_KEY or BACKUP_KEY.\n');
  const badRestoreKey = await cli(['backup', 'restore', '--to', join(root, 'bad-restore-key.sqlite')], { ...withR2, BACKUP_RESTORE_KEY: 'nope' });
  assert.equal(badRestoreKey.code, 1);
  assert.equal(badRestoreKey.stderr, 'BACKUP_RESTORE_KEY must be mm2-restore- followed by 43 characters.\n');
  const again = await cli(['backup', 'restore', '--to', target, '--object', key], withR2);
  assert.equal(again.code, 1);
  assert.equal(again.stderr, 'Restore target already exists.\n');
  const inside = await cli(['backup', 'restore', '--to', join(projectDirectory, 'restored.sqlite')], withR2);
  assert.equal(inside.code, 1);
  assert.equal(inside.stderr, 'Database path must be an absolute file path outside the application directory.\n');
  const relative = await cli(['backup', 'restore', '--to', 'restored.sqlite'], withR2);
  assert.equal(relative.code, 2);
  assert.match(relative.stderr, /usage:/);
  for (const args of [['backup', 'list'], ['backup', 'restore', '--to', join(root, 'other.sqlite')]]) {
    const missing = await cli(args, base);
    assert.equal(missing.code, 1);
    assert.equal(missing.stderr, 'Set BACKUP_FOLDER, or BACKUP_ENDPOINT, BACKUP_BUCKET, BACKUP_ACCESS_KEY_ID and BACKUP_SECRET_ACCESS_KEY.\n');
  }

  // The same commands against a folder: switch the saved destination, upload, then restore from the folder alone.
  const folder = join(root, 'folder');
  await mkdir(folder, { mode: 0o700 });
  assert.equal((await cli(['settings', 'set', 'hostPaths', 'backup.folder'], withDatabase, folder)).code, 0);
  const both = await cli(['backup', 'now'], withDatabase);
  assert.equal(both.code, 1);
  assert.equal(both.stdout, 'backup: failed Set either a backup folder or a backup bucket, not both.\n');
  for (const key of ['backup.endpoint', 'backup.bucket']) {
    assert.equal((await cli(['settings', 'delete', 'serviceAddresses', key], withDatabase)).code, 0);
  }
  const toFolder = await cli(['backup', 'now'], withDatabase);
  assert.equal(toFolder.code, 0, toFolder.stderr);
  const folderKey = toFolder.stdout.match(/^backup: ok (backups\/\S+\.sqlite\.gz\.enc) \d+ bytes\n$/)?.[1];
  assert.ok(existsSync(join(folder, folderKey)), toFolder.stdout);
  const withFolder = { ...base, BACKUP_FOLDER: folder, BACKUP_KEY: backupKey };
  const folderTarget = join(root, 'from-folder', 'media-manager.sqlite');
  const fromFolder = await cli(['backup', 'restore', '--to', folderTarget], withFolder);
  assert.equal(fromFolder.code, 0, fromFolder.stderr);
  assert.match(fromFolder.stdout, new RegExp(`^restored ${folderKey} to `));

  // Sealing with BACKUP_KEY once the app has made a key pair, or restoring that backup without the restore key, turns this red.
  const made = await runNode(`
    const { createBackupKeyPair } = await import(${JSON.stringify(backupModuleUrl)});
    const { openDatabase } = await import(${JSON.stringify(databaseModuleUrl)});
    const database = openDatabase(${JSON.stringify(withoutKey.DB_PATH)});
    process.stdout.write(createBackupKeyPair(database).restoreKey);
    database.close();
  `, { env: base });
  assert.equal(made.code, 0, made.stderr);
  const restoreKey = made.stdout;
  const toPair = await cli(['backup', 'now'], withDatabase);
  assert.equal(toPair.code, 0, toPair.stderr);
  const pairKey = toPair.stdout.match(/^backup: ok (backups\/\S+\.sqlite\.gz\.enc) \d+ bytes\n$/)?.[1];
  assert.ok(pairKey, toPair.stdout);
  const { BACKUP_KEY: __, ...folderOnly } = withFolder;
  const fromPair = await cli(['backup', 'restore', '--to', join(root, 'from-pair', 'media-manager.sqlite')], { ...folderOnly, BACKUP_RESTORE_KEY: restoreKey });
  assert.equal(fromPair.code, 0, fromPair.stderr);
  assert.match(fromPair.stdout, new RegExp(`^restored ${pairKey} to `));
  const pairWithEnvKey = await cli(['backup', 'restore', '--to', join(root, 'pair-with-env-key.sqlite')], withFolder);
  assert.equal(pairWithEnvKey.code, 1);
  assert.equal(pairWithEnvKey.stderr, 'This backup needs the restore key; set BACKUP_RESTORE_KEY.\n');
  for (const output of outputs) assert.ok(!output.includes(secret) && !output.includes(backupKey) && !output.includes(restoreKey));
});

test('the settings screen sends only changed fields and ranks each service state', async (t) => {
  // The client model is bundled by Vite, not compiled to dist, so it is loaded from source with Node's type stripping.
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../src/client/settings/model.ts', import.meta.url), 'utf8');
  const { changes, pillFor, linkTone, services } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
  const saved = { service: 'sonarr', serviceAddresses: { 'sonarr.url': 'http://localhost:8989' }, credentials: { 'sonarr.apiKey': true } };

  // Sending an unchanged address or a blank secret turns this red: Save would rewrite fields the owner never touched.
  await t.test('only a changed address and typed secrets are sent', () => {
    const cases = [
      [{ address: ' http://localhost:8989 ', secrets: { 'sonarr.apiKey': '  ' } }, {}],
      [{ address: 'http://localhost:8990', secrets: {} }, { serviceAddresses: { 'sonarr.url': 'http://localhost:8990' } }],
      [{ address: 'http://localhost:8989', secrets: { 'sonarr.apiKey': 'new' } }, { credentials: { 'sonarr.apiKey': 'new' } }],
      // Sending a pasted key with its stray spaces turns this red: the service refuses it.
      [{ address: 'http://localhost:8989', secrets: { 'sonarr.apiKey': ' new ' } }, { credentials: { 'sonarr.apiKey': 'new' } }],
    ];
    for (const [draft, expected] of cases) assert.deepEqual(changes('sonarr', saved, draft), expected);
  });

  // Showing an Address field for TMDB, MDBList or Trakt, or sending an address for one, turns this red: the server refuses any key it does not expect.
  await t.test('a service with a fixed address has no Address field and a save sends only its key', () => {
    assert.deepEqual(services.filter((info) => info.addressPlaceholder === undefined).map((info) => info.name), ['tmdb', 'mdblist', 'trakt']);
    const tmdb = { service: 'tmdb', serviceAddresses: {}, credentials: { 'tmdb.apiKey': false } };
    assert.deepEqual(changes('tmdb', tmdb, { address: 'https://api.themoviedb.org', secrets: { 'tmdb.apiKey': 'new' } }), { credentials: { 'tmdb.apiKey': 'new' } });
    assert.deepEqual(changes('trakt', undefined, { address: '', secrets: {} }), {});
  });

  // Letting unsaved edits hide a running test or a failure turns this red.
  await t.test('a running test, then a failure, then unsaved edits win the pill', () => {
    const sonarr = services.find((info) => info.name === 'sonarr');
    const connected = { kind: 'ok', version: '4.0.10.2544', at: 0, ofSaved: true };
    const cases = [
      [{ kind: 'testing' }, 2, 'testing'],
      [{ kind: 'rejected', at: 0, ofSaved: false }, 2, 'failed'],
      [connected, 1, 'unsaved'],
      [connected, 0, 'connected'],
      [{ kind: 'idle' }, 0, 'not-set-up'],
    ];
    for (const [check, edited, state] of cases) assert.equal(pillFor(sonarr, check, edited).state, state);
    assert.equal(pillFor(sonarr, connected, 0).text, 'Connected · 4.0.10');
  });

  // Drawing a link red while one side has never answered, or grey while a whole side is failing, turns this red.
  await t.test('a link is faint until both sides answered, and red when a side has nothing working', () => {
    const ok = { kind: 'ok', at: 0, ofSaved: true };
    const down = { kind: 'unreachable', at: 0, ofSaved: true };
    assert.equal(linkTone([ok, { kind: 'idle' }], [{ kind: 'idle' }]), 'idle');
    assert.equal(linkTone([ok, down], [down]), 'risk');
    assert.equal(linkTone([ok, down], [ok]), 'ok');
  });

  const setupSource = await readFile(new URL('../src/client/settings/setup.ts', import.meta.url), 'utf8');
  const {
    folderDraft, backupBody, backupEdited, backupPill, clearSentKeys, usesSignInToken, wantedParts, nextStep, firstStep,
  } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(setupSource))}`);

  // Opening on a done step, visiting an unwanted or skipped optional part, skipping the posters and ratings step between trackers and backup, or reaching Done with a required part missing turns this red.
  await t.test('the wizard moves to the next open step and reaches Done only once every required part is saved', () => {
    const status = (done, optional = {}) => ({
      required: Object.fromEntries(['sonarr', 'radarr', 'rtorrent', 'plex', 'folders'].map((part) => [part, done.includes(part) ? 'done' : 'not_done'])),
      optional: { trackers: { status: 'not_done', wanted: false }, metadata: { status: 'not_done', wanted: false }, backup: { status: 'not_done', wanted: false }, ...optional },
    });
    const fresh = status([]);
    assert.deepEqual(wantedParts(fresh), { trackers: true, metadata: true, backup: true });
    assert.equal(firstStep(fresh, wantedParts(fresh)), 'what');
    assert.equal(nextStep('what', fresh, wantedParts(fresh)), 'sonarr');
    // Radarr saved in Settings earlier is passed over.
    assert.equal(nextStep('sonarr', status(['sonarr', 'radarr']), { trackers: true, backup: true }), 'rtorrent');
    assert.equal(firstStep(status(['sonarr']), { trackers: true, backup: true }), 'radarr');
    const required = ['sonarr', 'radarr', 'rtorrent', 'plex', 'folders'];
    const chosen = status(required, { trackers: { status: 'skipped', wanted: false }, backup: { status: 'not_done', wanted: true } });
    assert.deepEqual(wantedParts(chosen), { trackers: false, metadata: false, backup: true });
    assert.equal(nextStep('folders', chosen, wantedParts(chosen)), 'backup');
    assert.equal(nextStep('backup', chosen, wantedParts(chosen)), 'done');
    const all = { trackers: true, metadata: true, backup: true };
    assert.equal(nextStep('trackers', status(required), all), 'metadata');
    assert.equal(nextStep('metadata', status(required), all), 'backup');
    assert.equal(nextStep('trackers', status(required, { metadata: { status: 'skipped', wanted: true } }), all), 'backup');
    const skipped = status(required, { trackers: { status: 'skipped', wanted: true }, backup: { status: 'skipped', wanted: true } });
    assert.equal(nextStep('folders', skipped, wantedParts(skipped)), 'done');
    // Past the end with Plex missing goes back to Plex, not to Done.
    assert.equal(nextStep('backup', status(['sonarr', 'radarr', 'rtorrent', 'folders']), { trackers: true, backup: true }), 'plex');
  });

  // Letting a suggestion replace a saved folder, or leaving a field null when nothing is known, turns this red.
  await t.test('a saved folder beats a suggestion, a suggestion fills a gap, and nothing known is blank', () => {
    const none = { downloadsSonarr: null, downloadsRadarr: null, librarySonarr: null, libraryRadarr: null, versionsSonarr: null, versionsRadarr: null };
    const draft = folderDraft({
      saved: { ...none, downloadsSonarr: '/data/tv-saved' },
      suggested: { ...none, downloadsSonarr: '/data/tv-suggested', downloadsRadarr: '/data/movies-suggested' },
    });
    assert.deepEqual(draft, {
      downloadsSonarr: '/data/tv-saved', downloadsRadarr: '/data/movies-suggested', librarySonarr: '', libraryRadarr: '', versionsSonarr: '', versionsRadarr: '',
    });
  });

  // Sending bucket fields with a folder, an empty region, or untrimmed values turns this red: the server refuses any field it does not expect, and an empty region is needless.
  await t.test('the backup body holds only the chosen destination, trimmed, with the region only when typed', () => {
    const draft = { kind: 'folder', folder: ' /backups ', endpoint: 'https://s3.example', bucket: 'b', region: 'r', accessKeyId: 'a', secretAccessKey: 's' };
    assert.deepEqual(backupBody(draft), { folder: '/backups' });
    const bucket = { ...draft, kind: 's3', endpoint: ' https://s3.example ', bucket: ' media ', region: ' ', accessKeyId: ' id ', secretAccessKey: ' secret ' };
    assert.deepEqual(backupBody(bucket), { endpoint: 'https://s3.example', bucket: 'media', accessKeyId: 'id', secretAccessKey: 'secret' });
    assert.equal(backupBody({ ...bucket, region: ' us-west-004 ' }).region, 'us-west-004');
  });

  // Ignoring a switched kind or a key typed over a saved bucket turns this red: Confirm would stay off for a real change.
  await t.test('backup edits count a switched kind and a typed key, not an unchanged folder', () => {
    const blank = { endpoint: '', bucket: '', region: '', accessKeyId: '', secretAccessKey: '' };
    assert.equal(backupEdited({ ...blank, kind: 'folder', folder: '/backups ' }, { kind: 'folder', folder: '/backups' }), false);
    assert.equal(backupEdited({ ...blank, kind: 's3', folder: '/backups' }, { kind: 'folder', folder: '/backups' }), true);
    const savedBucket = { kind: 's3', endpoint: 'https://s3.example', bucket: 'media', region: 'auto' };
    assert.equal(backupEdited({ ...blank, ...savedBucket, folder: '', accessKeyId: 'new' }, savedBucket), true);
    assert.equal(backupEdited({ ...blank, ...savedBucket, folder: '' }, savedBucket), false);
    // Comparing a blank region to the saved 'auto' without the server's 'auto' default turns this red.
    assert.equal(backupEdited({ ...blank, ...savedBucket, folder: '', region: '' }, savedBucket), false);
  });

  // Keeping the sent keys in the form after a save turns this red: the same bucket would still read as unsaved edits.
  await t.test('a saved bucket reads as unedited once its sent keys are cleared', () => {
    const savedBucket = { kind: 's3', endpoint: 'https://s3.example', bucket: 'media', region: 'auto' };
    const sent = { ...savedBucket, folder: '', accessKeyId: 'id', secretAccessKey: 'secret' };
    assert.equal(backupEdited(clearSentKeys(sent), savedBucket), false);
  });

  // Ignoring the owner's pick, or defaulting to the sign-in token when a Plex token is already saved, turns this red.
  await t.test('Plex uses the sign-in token by the owner\'s pick, else only while no token is saved', () => {
    assert.equal(usesSignInToken(false, true, false), false);
    assert.equal(usesSignInToken(true, undefined, false), true);
    assert.equal(usesSignInToken(true, undefined, true), false);
    assert.equal(usesSignInToken(true, false, false), false);
    assert.equal(usesSignInToken(true, true, true), true);
  });

  // Reading a key pair or BACKUP_KEY as missing, or letting a missing key outrank a bad destination, turns this red.
  await t.test('the backup pill ranks a bad destination, then no destination, then a missing key', () => {
    const folder = { kind: 'folder', folder: '/backups' };
    const cases = [
      [{ destination: null, problem: null, key: 'missing', keyCreatedAt: null }, 'not-set-up'],
      // The server reports no destination when the saved one is bad, so checking the destination first turns this row red.
      [{ destination: null, problem: 'A folder and a bucket are both set.', key: 'missing', keyCreatedAt: null }, 'failed'],
      [{ destination: folder, problem: 'The folder is gone.', key: 'missing', keyCreatedAt: null }, 'failed'],
      [{ destination: folder, problem: null, key: 'missing', keyCreatedAt: null }, 'failed'],
      [{ destination: folder, problem: null, key: 'env', keyCreatedAt: null }, 'connected'],
      [{ destination: folder, problem: null, key: 'pair', keyCreatedAt: 0 }, 'connected'],
    ];
    for (const [backup, state] of cases) assert.equal(backupPill(backup).state, state);
    assert.equal(backupPill(cases[2][0]).text, 'Can\'t run: bad destination');
    assert.equal(backupPill(cases[3][0]).text, 'Can\'t run: no key yet');
  });
});

test('the tracker rule form sends the saved rule back unchanged and converts percentages and days', async () => {
  // Sending percentages or days as typed, dropping the kept curve row, writing margins nobody changed, or sending
  // typed text as a blank turns this red.
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../src/client/settings/trackers.ts', import.meta.url), 'utf8');
  const { draftFromRow, ruleBody, notANumber, statFacts } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
  const rule = {
    seedHours: [{ upToGB: 1, hours: 72 }, { upToGB: 50, hours: 72, perGB: 2 }, { hours: -219.2023, lnGB: 100 }],
    ratio: 0.9, logic: 'or', minGlobalRatio: null, partial: { exemptBelow: 0.1, ratio: 0.9, maxHours: 1440 },
  };
  const row = { host: 'privatehd.to', status: 'configured', rule, ruleSource: 'settings', margins: { timeFactor: 1.1, extraHours: 6, ratioExtra: 0.05, globalRatioFactor: 1.25 } };
  const draft = draftFromRow(row);
  assert.deepEqual(ruleBody(draft, draft), { rule });
  const wider = ruleBody({ ...draft, timePercent: '20' }, draft);
  assert.deepEqual(wider.margins, { timeFactor: 1.2, extraHours: 6, ratioExtra: 0.05, globalRatioFactor: 1.25 });
  assert.deepEqual(notANumber({ ...draft, ratio: '0.9x' }), { field: 'ratio', reason: 'Enter a number, such as 0.9 or 72.' });
  // Letting a number too large for JSON through turns this red: it goes as null and quietly clears the ratio.
  assert.equal(notANumber({ ...draft, ratio: '1e999' })?.field, 'ratio');
  // Scaling only positive byte counts turns this red: a negative buffer shows as raw bytes.
  const none = { ratio: null, uploadedBytes: null, downloadedBytes: null, seeding: null, leeching: null, bonus: null, hitAndRuns: null, requiredRatio: null };
  assert.deepEqual(statFacts({ ...none, bufferBytes: -5_120_000_000_000 }), [{ label: 'Buffer', value: '-5.12 TB' }]);
});

test('deleting a movie or a show maps its files first, keeps seeding unless chosen, and stops when Sonarr or Radarr refuses', async (t) => {
  const { rmSync } = await import('node:fs');
  const { openDatabase } = await import(databaseModuleUrl);
  const { createEventHub } = await import(eventsModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTorrentPoller } = await import(torrentsModuleUrl);
  const { createTorrentFiles } = await import(torrentFilesModuleUrl);
  const { createSecondVersionDelete } = await import(secondVersionDeleteModuleUrl);
  const { createTitleDelete, createTitleDeleteRoutes, UNLINKED_FILE, KEPT_FILES, KEPT_EPISODES } = await import(titleDeleteModuleUrl);
  const { createBlocklist } = await import(new URL('../dist/server/blocklist.js', import.meta.url).href);
  const { createHistory } = await import(historyModuleUrl);
  const { createSearch, parseSearchQuery } = await import(searchModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const roots = [];
  const databases = [];
  t.after(async () => {
    for (const database of databases) database.close();
    for (const root of roots) await rm(root, { recursive: true, force: true });
  });
  const exists = async (path) => lstat(path).then(() => true, () => false);
  const [CUR, OLD, SHARED, V1, V2, PACK, SINGLE, OTHER] = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3'].map((pair) => pair.repeat(20));

  const world = async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'media-manager-2-title-delete-')));
    roots.push(root);
    const at = (...parts) => join(root, ...parts);
    for (const folder of ['downloads', 'library/movies', 'library/tv', 'versions/movies', 'versions/tv']) await mkdir(at(folder), { recursive: true });
    const database = openDatabase(at('db', 'media-manager.sqlite'));
    databases.push(database);
    for (const service of ['radarr', 'sonarr']) setSetting(database, 'hostPaths', `downloads.${service}`, at('downloads'));
    setSetting(database, 'hostPaths', 'library.radarr', at('library/movies'));
    setSetting(database, 'hostPaths', 'library.sonarr', at('library/tv'));
    setSetting(database, 'hostPaths', 'versions.radarr', at('versions/movies'));
    setSetting(database, 'hostPaths', 'versions.sonarr', at('versions/tv'));
    const fake = { torrents: [], calls: [] };
    const rtorrent = {
      call: async (method, params) => {
        fake.calls.push(method);
        if (method === 'd.multicall2' && params.length === 5) return fake.torrents.map((torrent) => [torrent.hash, torrent.hash, at(torrent.directory)]);
        if (method === 'd.multicall2') return fake.torrents.map((torrent) => [torrent.hash, torrent.hash, 1, 1, 0, 0, 1, 1, 1, 1, '', 0, 0, 0, 0, at(torrent.directory)]);
        if (method === 't.multicall') return [];
        const torrent = fake.torrents.find((candidate) => candidate.hash === params[0]);
        if (torrent === undefined) throw new Error('rTorrent fault -501: Could not find info-hash.');
        if (method === 'f.multicall') return torrent.files.map((file) => [file, 1]);
        if (method === 'd.directory') return at(torrent.directory);
        if (method === 'd.is_multi_file') return torrent.files.length > 1 ? 1 : 0;
        if (method === 'd.erase') {
          fake.torrents = fake.torrents.filter((candidate) => candidate !== torrent);
          return 0;
        }
        throw new Error(`Unexpected ${method}`);
      },
    };
    const { fake: arrFake, ...arr } = connectArr(database);
    const poller = createTorrentPoller({ database, rtorrent, events: createEventHub() });
    const torrentFiles = createTorrentFiles({ database, rtorrent, arr });
    const deleteVersion = createSecondVersionDelete({ database, removeTorrent: torrentFiles.removeTorrent, scan: async () => {} });
    const clock = { value: 1_800_000_000_000, sleeps: 0 };
    const search = createSearch(database, arr, createTitleStore(database, { now: () => clock.value }));
    // The owner's manual downloads; lifting one records it, as protection.ts would before syncing Sonarr or Radarr.
    const protection = { items: [], lifted: [] };
    // Neither download client removes failed downloads, so marking a grab failed keeps its torrent seeding.
    for (const service of ['radarr', 'sonarr']) {
      arrFake[service].routes.push((method, url) => (method === 'GET' && url.pathname === '/api/v3/downloadclient' ? { status: 200, body: [] } : undefined));
    }
    const routes = createTitleDeleteRoutes(createTitleDelete({
      database,
      arr,
      torrentFiles,
      deleteVersion,
      protection: {
        list: () => protection.items,
        unprotect: async (item) => {
          protection.lifted.push(item);
          protection.failedBeforeLift = arrFake.radarr.state.failed.length + arrFake.sonarr.state.failed.length;
          protection.items = protection.items.filter((other) => other !== item);
        },
      },
      blocklist: createBlocklist({ database, arr, isManualDownload: () => false, now: () => clock.value }),
      advise: async (hash) => ({ recommendation: 'safe', reason: `advice for ${hash.slice(0, 2)}`, globalRatio: null }),
      forget: search.forget,
      now: () => clock.value,
      sleep: async (ms) => {
        clock.value += ms;
        clock.sleeps += 1;
      },
    }));
    const addTorrent = async (hash, directory, files) => {
      for (const file of files) {
        await mkdir(dirname(at(directory, file)), { recursive: true });
        await writeFile(at(directory, file), `${hash} ${file}`);
      }
      fake.torrents.push({ hash, directory, files });
    };
    const hardlink = async (source, destination) => {
      await mkdir(dirname(destination), { recursive: true });
      await link(source, destination);
      return destination;
    };
    let nextVersion = 0;
    const addVersion = async (hash, subject, source, destination) => {
      nextVersion += 1;
      await hardlink(source, destination);
      const stats = await stat(destination, { bigint: true });
      database.prepare(`
        INSERT INTO second_versions (id, service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, hash, state, file_path, file_inode, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'Release-GRP', 'g', 'Blutopia', 'Bluray-2160p', ?, 'imported', ?, ?, 1, 1)
      `).run(nextVersion, subject.movieId === undefined ? 'sonarr' : 'radarr', subject.movieId ?? null, subject.movieId === undefined ? 5 : null,
        subject.episodeId ?? null, hash, destination, `${stats.dev}:${stats.ino}`);
      return nextVersion;
    };
    // Sonarr's or Radarr's answer to one DELETE; on success it deletes `removes` from disk, as it does in the background.
    const onDelete = (service, path, { status = 200, removes = [] } = {}) => arrFake[service].routes.push((method, url) => {
      if (method !== 'DELETE' || url.pathname !== path) return undefined;
      if (status === 200) for (const file of removes) rmSync(file, { force: true });
      return status === 200 ? { status, body: {} } : { status, body: { message: 'Root folder does not exist' } };
    });
    const plan = async (path) => {
      const response = await routes.request(`${path}/delete-plan`);
      return { status: response.status, body: await response.json() };
    };
    const routesPlan = async (path, query) => {
      const response = await routes.request(`${path}/delete-plan?${query}`);
      return { status: response.status, body: await response.json() };
    };
    const remove = async (path, body) => {
      const response = await routes.request(`${path}/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const requests = (service) => arrFake[service].requests.map((request) => `${request.method} ${request.path}${request.params.size > 0 ? `?${request.params}` : ''}`);
    const versionState = (id) => database.prepare('SELECT state FROM second_versions WHERE id = ?').get(id).state;
    const deletions = async (service = 'all') => (await createHistory({ database, arr, labels: { subject: async () => 'label' } })
      .list({ filter: 'deletions', service, page: 1 })).events.filter((event) => event.eventType.startsWith('mm2_title_'));
    const steps = (body) => body.steps.map((step) => `${step.step}:${step.outcome}`);
    // Searching for the title, as its Sonarr or Radarr lookup answers now: whether search offers it as in the library.
    const inLibrary = async (service, record) => {
      arrFake[service].state.lookup = [record];
      const { results } = await search.search(parseSearchQuery('Title'));
      return results.find((result) => result.service === service).inLibrary;
    };
    const savedLookups = (service) => Number(database.prepare('SELECT COUNT(*) AS n FROM search_lookups WHERE service = ?').get(service).n);
    return { at, database, fake, arrFake, poller, clock, protection, routesPlan, addTorrent, hardlink, addVersion, onDelete, plan, remove, requests, versionState, deletions, steps, inLibrary, savedLookups };
  };

  // Dune: its file is a hardlink of CUR; OLD and SHARED were imported before an upgrade, and SHARED's data also backs another movie's file.
  const dune = async () => {
    const w = await world();
    await w.addTorrent(CUR, 'downloads', ['Dune.2160p.mkv']);
    await w.addTorrent(OLD, 'downloads', ['Dune.720p.mkv']);
    await w.addTorrent(SHARED, 'downloads', ['Dune.1080p.mkv']);
    await w.addTorrent(V1, 'downloads', ['Dune.Remux.mkv']);
    const file = await w.hardlink(w.at('downloads/Dune.2160p.mkv'), w.at('library/movies/Dune (2021)/Dune.mkv'));
    await w.hardlink(w.at('downloads/Dune.1080p.mkv'), w.at('library/movies/Other (2020)/Other.mkv'));
    const version = await w.addVersion(V1, { movieId: 1 }, w.at('downloads/Dune.Remux.mkv'), w.at('versions/movies/Dune (2021)/Dune.Remux.mkv'));
    w.arrFake.radarr.state.movies.push(movieRecord({ id: 1, title: 'Dune', year: 2021, hasFile: true, movieFile: { id: 11, path: file, size: 10 } }));
    for (const hash of [OLD, SHARED]) {
      w.arrFake.radarr.state.history.push(historyRecord({ eventType: 'downloadFolderImported', downloadId: hash.toLowerCase(), movieId: 1, data: { fileId: '9' } }));
    }
    await w.poller.poll();
    return { ...w, file, version };
  };

  // Listing an upgraded-away torrent ticked or not at all, offering one that still backs a kept file, or dropping the recycle bin turns this red.
  await t.test('the movie plan lists its torrents unticked with advice, refuses one that backs a kept file, and ticks its second versions', async () => {
    const w = await dune();
    w.arrFake.radarr.routes.push((method, url) => (url.pathname === '/api/v3/config/mediamanagement' ? { status: 200, body: { recycleBin: '/data/recycle' } } : undefined));
    const { status, body } = await w.plan('/movie/1');
    assert.equal(status, 200);
    assert.equal(body.title, 'Dune (2021)');
    assert.equal(body.recycleBin, '/data/recycle');
    assert.deepEqual(body.modes, ['remove', 'keepUnmonitored', 'searchAgain']);
    assert.deepEqual(body.files.map((file) => [file.fileId, file.state, file.hashes, file.note]), [[11, 'linked', [CUR], null]]);
    assert.deepEqual(body.torrents.map((torrent) => [torrent.hash, torrent.upgradedAway, torrent.ticked, torrent.removal.allowed, torrent.advice.reason]),
      [[CUR, false, false, true, 'advice for A1'], [OLD, true, false, true, 'advice for A2'], [SHARED, true, false, false, 'advice for A3']]);
    assert.match(body.torrents[2].removal.reason, /shares its data with the library file .*Other\.mkv/);
    assert.deepEqual(body.secondVersions.map((row) => [row.id, row.ticked, row.torrent.hash, row.torrent.removal.allowed]), [[w.version, true, V1, true]]);
  });

  // Deleting before mapping, adding an import list exclusion, or removing a torrent or second version that was not chosen turns this red.
  await t.test('removing the movie maps first, deletes it in Radarr without an exclusion, then removes only the chosen torrent', async () => {
    const w = await dune();
    w.onDelete('radarr', '/api/v3/movie/1', { removes: [w.file] });
    assert.equal(await w.inLibrary('radarr', { title: 'Dune', year: 2021, tmdbId: 438631, id: 1 }), true);
    const { status, body } = await w.remove('/movie/1', { mode: 'remove', removeTorrents: [CUR.toLowerCase()], secondVersions: [] });
    // Not forgetting search's saved lookups after the delete turns this red: search keeps offering Dune as in the library.
    assert.equal(await w.inLibrary('radarr', { title: 'Dune', year: 2021, tmdbId: 438631 }), false);
    assert.equal(status, 200);
    assert.equal(body.deleted, true);
    assert.deepEqual(w.steps(body), ['map:done', 'delete:done', 'wait:done', 'torrents:done', 'secondVersions:skipped', 'history:done']);
    const radarr = w.requests('radarr');
    const mappedAt = radarr.indexOf('GET /api/v3/history/movie?movieId=1');
    assert.ok(mappedAt !== -1 && mappedAt < radarr.indexOf('DELETE /api/v3/movie/1?deleteFiles=true&addImportExclusion=false'));
    assert.deepEqual(radarr.filter((request) => request.startsWith('DELETE') || request.includes('xclusion')), ['DELETE /api/v3/movie/1?deleteFiles=true&addImportExclusion=false']);
    assert.deepEqual(body.steps[3].torrents, [{ hash: CUR, name: CUR, removed: true, reason: null }]);
    assert.deepEqual(w.fake.torrents.map((torrent) => torrent.hash), [OLD, SHARED, V1]);
    assert.equal(await exists(w.at('downloads/Dune.2160p.mkv')), false);
    assert.equal(w.versionState(w.version), 'imported');
    assert.equal(await exists(w.at('versions/movies/Dune (2021)/Dune.Remux.mkv')), true);
    const [event] = await w.deletions();
    assert.deepEqual([event.title, event.event, event.source], ['Dune (2021)', 'Movie deleted', 'media-manager-2']);
    assert.match(event.detail, /1 torrent removed, 2 kept seeding/);
  });

  // Deleting the file before unmonitoring, or deleting the movie record in this mode, turns this red.
  await t.test('keeping the record unmonitors the movie before deleting its file, and deletes a ticked second version with its torrent', async () => {
    const w = await dune();
    w.onDelete('radarr', '/api/v3/moviefile/11', { removes: [w.file] });
    // The dialog already sends excludeFromImportLists, keepFollowing and queue; refusing their neutral values breaks every delete it sends.
    const { body } = await w.remove('/movie/1', {
      mode: 'keepUnmonitored', excludeFromImportLists: false, keepFollowing: {}, queue: [], removeTorrents: [], secondVersions: [{ id: w.version, removeTorrent: true }],
    });
    assert.deepEqual(w.steps(body), ['map:done', 'unmonitor:done', 'delete:done', 'wait:done', 'torrents:skipped', 'secondVersions:done', 'monitoring:done', 'history:done']);
    const radarr = w.requests('radarr');
    const unmonitoredAt = radarr.indexOf('PUT /api/v3/movie/editor');
    assert.ok(unmonitoredAt !== -1 && unmonitoredAt < radarr.indexOf('DELETE /api/v3/moviefile/11'));
    assert.equal(radarr.some((request) => request.startsWith('DELETE /api/v3/movie/')), false);
    assert.equal(w.arrFake.radarr.state.movies[0].monitored, false);
    assert.deepEqual(body.steps[5].secondVersions, [{ id: w.version, deleted: true, torrentRemoved: true, reason: null }]);
    assert.deepEqual(w.fake.torrents.map((torrent) => torrent.hash), [CUR, OLD, SHARED]);
    assert.equal((await w.deletions())[0].event, 'Movie file deleted');
  });

  // Recording "Movie file deleted" when the movie had no file turns this red.
  await t.test('keeping the record of a movie with no file records it as unmonitored, not as a file deletion', async () => {
    const w = await world();
    w.arrFake.radarr.state.movies.push(movieRecord({ id: 2, title: 'Arrival', year: 2016 }));
    const { body } = await w.remove('/movie/2', { mode: 'keepUnmonitored', removeTorrents: [], secondVersions: [] });
    assert.deepEqual(w.steps(body), ['map:done', 'unmonitor:done', 'delete:skipped', 'wait:done', 'torrents:skipped', 'secondVersions:skipped', 'monitoring:done', 'history:done']);
    const [event] = await w.deletions();
    assert.deepEqual([event.title, event.event], ['Arrival (2016)', 'Movie unmonitored']);
  });

  // Carrying on after Radarr refuses (removing a torrent, a second version, or writing history) turns this red.
  await t.test('a Radarr refusal stops everything else', async () => {
    const w = await dune();
    w.onDelete('radarr', '/api/v3/movie/1', { status: 500 });
    await w.inLibrary('radarr', { title: 'Dune', year: 2021, tmdbId: 438631, id: 1 });
    const callsBefore = w.fake.calls.length;
    const { status, body } = await w.remove('/movie/1', { mode: 'remove', removeTorrents: [CUR], secondVersions: [{ id: w.version, removeTorrent: true }] });
    assert.equal(status, 200);
    assert.equal(body.deleted, false);
    assert.deepEqual(w.steps(body), ['map:done', 'delete:failed']);
    assert.match(body.steps[1].message, /Radarr refused the movie delete with HTTP 500: Root folder does not exist/);
    assert.equal(w.requests('radarr').at(-1), 'DELETE /api/v3/movie/1?deleteFiles=true&addImportExclusion=false');
    assert.deepEqual(w.fake.calls.slice(callsBefore), []);
    assert.equal(w.versionState(w.version), 'imported');
    assert.equal(w.clock.sleeps, 0);
    assert.deepEqual(await w.deletions(), []);
    // Forgetting search's saved lookups before checking Radarr's answer turns this red.
    assert.equal(w.savedLookups('radarr'), 1);
  });

  // Removing a torrent while the library file is still there, or waiting without a ceiling, turns this red.
  await t.test('files still there after 2 minutes keep every torrent and say so', async () => {
    const w = await dune();
    w.onDelete('radarr', '/api/v3/movie/1');
    const started = w.clock.value;
    const { body } = await w.remove('/movie/1', { mode: 'remove', removeTorrents: [CUR], secondVersions: [{ id: w.version, removeTorrent: true }] });
    assert.deepEqual(w.steps(body), ['map:done', 'delete:done', 'wait:failed', 'torrents:failed', 'secondVersions:done', 'history:done']);
    assert.ok(w.clock.value - started >= 120_000 && w.clock.value - started < 125_000);
    assert.match(body.steps[2].message, /still had 1 library file after 2 minutes, so every torrent was kept/);
    assert.deepEqual(body.steps[3].torrents.map((torrent) => [torrent.removed, /every torrent was kept/.test(torrent.reason)]), [[false, true]]);
    assert.deepEqual(body.steps[4].secondVersions.map((row) => [row.deleted, row.torrentRemoved]), [[true, false]]);
    assert.equal(w.fake.calls.includes('d.erase'), false);
    assert.equal(w.fake.torrents.length, 4);
  });

  // Calling an unproven file linked, dropping its text, offering a torrent for it, or losing the copy label turns this red.
  await t.test('an unlinked file says so and offers no torrent, and a copy traced through Radarr history is labelled', async () => {
    const w = await world();
    await w.addTorrent(CUR, 'downloads', ['Heat.mkv']);
    const file = w.at('library/movies/Heat (1995)/Heat.mkv');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, 'a copy');
    w.arrFake.radarr.state.movies.push(movieRecord({ id: 2, title: 'Heat', year: 1995, hasFile: true, movieFile: { id: 12, path: file, size: 6 } }));
    await w.poller.poll();
    const unlinked = (await w.plan('/movie/2')).body;
    assert.deepEqual(unlinked.files.map((entry) => [entry.state, entry.note]), [['none', UNLINKED_FILE]]);
    assert.equal(UNLINKED_FILE, "Can't link this file to a torrent. Its torrent, if any, keeps seeding.");
    assert.deepEqual(unlinked.torrents, []);
    const stale = await w.remove('/movie/2', { mode: 'remove', removeTorrents: [CUR], secondVersions: [] });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'plan_changed');
    assert.equal(w.requests('radarr').some((request) => request.startsWith('DELETE')), false);

    w.arrFake.radarr.state.history.push(historyRecord({ eventType: 'downloadFolderImported', downloadId: CUR, movieId: 2, data: { fileId: '12' } }));
    const copied = (await w.plan('/movie/2')).body;
    assert.deepEqual(copied.files.map((entry) => [entry.state, entry.note]), [['copied', null]]);
    assert.deepEqual(copied.torrents.map((torrent) => [torrent.hash, torrent.label, torrent.upgradedAway, torrent.removal.allowed]), [[CUR, 'imported by copy', false, true]]);
  });

  // Accepting a choice the server never offered, a movie delete without its mode, a season delete that would remove its show,
  // or a blocklist without a search again turns this red.
  await t.test('a delete request names a mode its target offers, and well-formed choices the plan still offers', async () => {
    const w = await dune();
    const bad = [
      ['/movie/1', { removeTorrents: [], secondVersions: [] }],
      ['/movie/1', { mode: 'archive', removeTorrents: [], secondVersions: [] }],
      ['/series/1/season/1', { mode: 'remove', removeTorrents: [], secondVersions: [] }],
      ['/movie/1', { mode: 'keepUnmonitored', blocklistCurrent: true, removeTorrents: [], secondVersions: [] }],
      ['/movie/1', { mode: 'searchAgain', blocklistCurrent: 'yes', removeTorrents: [], secondVersions: [] }],
      ['/movie/1', { mode: 'remove', removeTorrents: [], secondVersions: [], purge: true }],
      ['/movie/1', { mode: 'remove', removeTorrents: ['xyz'], secondVersions: [] }],
      ['/movie/1', { mode: 'remove', removeTorrents: [CUR, CUR.toLowerCase()], secondVersions: [] }],
      ['/movie/1', { mode: 'remove', removeTorrents: [], secondVersions: [{ id: 1 }] }],
      ['/movie/0', { mode: 'remove', removeTorrents: [], secondVersions: [] }],
    ];
    for (const [path, body] of bad) assert.equal((await w.remove(path, body)).status, 400, JSON.stringify(body));
    assert.equal((await w.remove('/movie/1', { mode: 'remove', removeTorrents: [SHARED], secondVersions: [] })).status, 409);
    assert.equal((await w.remove('/movie/1', { mode: 'remove', removeTorrents: [], secondVersions: [{ id: 99, removeTorrent: false }] })).status, 409);
    assert.equal(w.requests('radarr').some((request) => request.startsWith('DELETE')), false);
  });

  // The grab Dune's library file came from, as Radarr's history records it.
  const duneGrab = (w) => w.arrFake.radarr.state.history.push(
    historyRecord({ id: 501, eventType: 'grabbed', downloadId: CUR.toLowerCase(), movieId: 1, sourceTitle: 'Dune.2021.2160p-GRP' }),
    historyRecord({ eventType: 'downloadFolderImported', downloadId: CUR.toLowerCase(), movieId: 1, data: { fileId: '11' } }),
  );

  // Deleting the file before the movie is monitored, leaving its manual-download protection, blocklisting or searching before the file
  // is gone, or removing the movie record turns this red.
  await t.test('searching again monitors the movie and lifts its protection, deletes the file, blocklists its grab, then searches', async () => {
    const w = await dune();
    w.arrFake.radarr.state.movies[0].monitored = false;
    w.protection.items.push({ service: 'radarr', kind: 'movie', movieId: 1 }, { service: 'radarr', kind: 'movie', movieId: 2 });
    duneGrab(w);
    w.onDelete('radarr', '/api/v3/moviefile/11', { removes: [w.file] });
    const { status, body } = await w.remove('/movie/1', { mode: 'searchAgain', blocklistCurrent: true, removeTorrents: [], secondVersions: [] });
    assert.equal(status, 200);
    assert.deepEqual(w.steps(body), ['map:done', 'monitor:done', 'delete:done', 'wait:done', 'blocklist:done', 'search:done', 'torrents:skipped', 'secondVersions:skipped', 'monitoring:done', 'history:done']);
    const radarr = w.requests('radarr');
    const at = (request) => radarr.indexOf(request);
    assert.ok(at('PUT /api/v3/movie/editor') !== -1 && at('PUT /api/v3/movie/editor') < at('DELETE /api/v3/moviefile/11'));
    assert.ok(at('DELETE /api/v3/moviefile/11') < at('POST /api/v3/history/failed/501') && at('POST /api/v3/history/failed/501') < at('POST /api/v3/command'));
    assert.equal(radarr.some((request) => request.startsWith('DELETE /api/v3/movie/')), false);
    assert.equal(w.arrFake.radarr.state.movies[0].monitored, true);
    assert.deepEqual([w.protection.lifted, w.protection.failedBeforeLift], [[{ service: 'radarr', kind: 'movie', movieId: 1 }], 0]);
    assert.deepEqual(w.arrFake.radarr.state.failed, [501]);
    assert.deepEqual(w.arrFake.radarr.state.commands, [{ name: 'MoviesSearch', movieIds: [1] }]);
    assert.deepEqual(w.fake.torrents.map((torrent) => torrent.hash), [CUR, OLD, SHARED, V1]);
    assert.equal(w.versionState(w.version), 'imported');
    assert.equal((await w.deletions())[0].event, 'Movie file deleted, searching again');
  });

  // Lifting the manual-download protection, blocklisting or searching when Radarr refused to delete the file turns this red.
  await t.test('a refused file delete stops a search again with the movie still protected', async () => {
    const w = await dune();
    w.protection.items.push({ service: 'radarr', kind: 'movie', movieId: 1 });
    duneGrab(w);
    w.onDelete('radarr', '/api/v3/moviefile/11', { status: 500 });
    const { body } = await w.remove('/movie/1', { mode: 'searchAgain', blocklistCurrent: true, removeTorrents: [CUR], secondVersions: [] });
    assert.deepEqual([body.deleted, w.steps(body)], [false, ['map:done', 'monitor:done', 'delete:failed']]);
    assert.match(body.steps[2].message, /The movie stays monitored\.$/);
    assert.deepEqual(w.protection.lifted, []);
    assert.deepEqual([w.arrFake.radarr.state.failed, w.arrFake.radarr.state.commands], [[], []]);
    assert.equal(w.fake.calls.includes('d.erase'), false);
  });

  // Reporting the read-back as done when Radarr kept the movie monitored, or as done when the read failed, turns this red.
  await t.test('the monitoring read-back fails when Radarr disagrees and is skipped when Radarr cannot be read', async () => {
    const w = await dune();
    w.onDelete('radarr', '/api/v3/moviefile/11', { removes: [w.file] });
    w.arrFake.radarr.routes.unshift((method, url) => (method === 'PUT' && url.pathname === '/api/v3/movie/editor' ? { status: 202, body: [] } : undefined));
    const { body } = await w.remove('/movie/1', { mode: 'keepUnmonitored', removeTorrents: [], secondVersions: [] });
    const readBack = body.steps.find((step) => step.step === 'monitoring');
    assert.equal(readBack.outcome, 'failed');
    assert.match(readBack.message, /^Not as intended: The movie is monitored\. Radarr: the movie is monitored\.$/);
    assert.deepEqual(readBack.monitoring, { kind: 'movie', monitored: true });
    assert.equal(body.deleted, true);

    const w2 = await dune();
    let gone = false;
    w2.arrFake.radarr.routes.unshift((method, url) => {
      if (method === 'DELETE' && url.pathname === '/api/v3/moviefile/11') {
        gone = true;
        rmSync(w2.file, { force: true });
        return { status: 200, body: {} };
      }
      return method === 'GET' && url.pathname === '/api/v3/movie/1' && gone ? { status: 503, body: {} } : undefined;
    });
    const skipped = (await w2.remove('/movie/1', { mode: 'keepUnmonitored', removeTorrents: [], secondVersions: [] })).body.steps.find((step) => step.step === 'monitoring');
    assert.deepEqual([skipped.outcome, skipped.monitoring], ['skipped', null]);
    assert.match(skipped.message, /^Couldn't read the movie back from Radarr/);
  });

  // Offering the exclusion when no list adds titles by itself, offering it blindly when the lists cannot be read, or sending the flag when
  // the owner did not ask turns this red.
  await t.test('removing a movie can exclude it from import lists, offered only when a list adds titles by itself', async () => {
    const w = await dune();
    assert.equal((await w.plan('/movie/1')).body.importLists, false);
    w.arrFake.radarr.state.importLists = [{ enabled: true, enableAuto: false }];
    assert.equal((await w.plan('/movie/1')).body.importLists, false);
    w.arrFake.radarr.state.importLists.push({ enabled: true, enableAuto: true });
    assert.equal((await w.plan('/movie/1')).body.importLists, true);
    w.arrFake.radarr.routes.unshift((method, url) => (url.pathname === '/api/v3/importlist' ? { status: 500, body: {} } : undefined));
    assert.equal((await w.plan('/movie/1')).body.importLists, false);

    for (const body of [
      { mode: 'keepUnmonitored', excludeFromImportLists: true, removeTorrents: [], secondVersions: [] },
      { mode: 'remove', excludeFromImportLists: 'yes', removeTorrents: [], secondVersions: [] },
    ]) assert.equal((await w.remove('/movie/1', body)).status, 400, JSON.stringify(body));

    w.onDelete('radarr', '/api/v3/movie/1', { removes: [w.file] });
    const { body } = await w.remove('/movie/1', { mode: 'remove', excludeFromImportLists: true, removeTorrents: [], secondVersions: [] });
    assert.deepEqual(w.steps(body).slice(0, 2), ['map:done', 'delete:done']);
    assert.equal(body.steps[1].message, 'Removed from Radarr with its file, and excluded from its import lists.');
    assert.deepEqual(w.requests('radarr').filter((request) => request.startsWith('DELETE')), ['DELETE /api/v3/movie/1?deleteFiles=true&addImportExclusion=true']);
  });

  // A REPACK of Dune still downloading (60%), and another movie's download that must never be listed.
  const REPACK = 'F1'.repeat(20);
  const downloading = async (w) => {
    await w.addTorrent(REPACK, 'downloads', ['Dune.2021.2160p.REPACK.mkv']);
    await w.poller.poll();
    w.arrFake.radarr.state.queue.push(
      queueItem({ movieId: 1, downloadId: REPACK.toLowerCase(), title: 'Dune.2021.2160p.REPACK-GRP', size: 100, sizeleft: 40 }),
      queueItem({ movieId: 2, downloadId: 'f2'.repeat(20), title: 'Arrival.2016.1080p-GRP', size: 100, sizeleft: 100 }),
    );
  };

  // Listing another movie's download, leaving the download in the queue to import after the delete, letting Radarr search or remove it from
  // rTorrent itself, or deleting before the queue is cleared turns this red.
  await t.test('removing a movie lists its download, takes it out of the queue without a search, then removes its torrent through the shared-data check', async () => {
    const w = await dune();
    await downloading(w);
    const planned = (await w.plan('/movie/1')).body;
    assert.deepEqual(planned.queue.map((item) => [item.downloadId, item.title, item.progress, item.removable.allowed, item.advice?.reason ?? null]),
      [[REPACK, 'Dune.2021.2160p.REPACK-GRP', 0.6, true, 'advice for F1']]);
    w.onDelete('radarr', '/api/v3/movie/1', { removes: [w.file] });
    const { body } = await w.remove('/movie/1', { mode: 'remove', queue: [{ downloadId: REPACK, action: 'removeWithTorrent' }], removeTorrents: [], secondVersions: [] });
    assert.deepEqual(w.steps(body).slice(0, 3), ['map:done', 'queue:done', 'delete:done']);
    assert.deepEqual(body.steps[1].queue, [{ downloadId: REPACK, title: 'Dune.2021.2160p.REPACK-GRP', removed: true, torrentRemoved: true, reason: null }]);
    assert.deepEqual(w.arrFake.radarr.state.removals.map(({ removeFromClient, blocklist, skipRedownload }) => [removeFromClient, blocklist, skipRedownload]), [[false, false, true]]);
    const radarr = w.requests('radarr');
    assert.ok(radarr.findIndex((request) => request.startsWith('DELETE /api/v3/queue/')) < radarr.indexOf('DELETE /api/v3/movie/1?deleteFiles=true&addImportExclusion=false'));
    assert.equal(w.fake.torrents.some((torrent) => torrent.hash === REPACK), false);
    assert.deepEqual(w.arrFake.radarr.state.queue.map((item) => item.movieId), [2]);
  });

  // Deleting anything when the chosen download already left the queue, or accepting an action the server does not know, turns this red.
  await t.test('a download that left the queue since the plan stops the delete, and a queue choice must be well formed', async () => {
    const w = await dune();
    await downloading(w);
    const gone = await w.remove('/movie/1', { mode: 'remove', queue: [{ downloadId: 'ab'.repeat(20), action: 'remove' }], removeTorrents: [], secondVersions: [] });
    assert.deepEqual([gone.status, gone.body.error], [409, 'plan_changed']);
    for (const queue of [[{ downloadId: REPACK, action: 'purge' }], [{ downloadId: REPACK }], [{ downloadId: REPACK, action: 'remove' }, { downloadId: REPACK, action: 'leave' }]]) {
      assert.equal((await w.remove('/movie/1', { mode: 'remove', queue, removeTorrents: [], secondVersions: [] })).status, 400, JSON.stringify(queue));
    }
    assert.equal(w.requests('radarr').some((request) => request.startsWith('DELETE')), false);
  });

  // Marking the grab failed while the download client would erase its seeding torrent, or dropping the search because the blocklist failed, turns this red.
  await t.test('searching again does not blocklist when the download client removes failed downloads, and still searches', async () => {
    const w = await dune();
    w.arrFake.radarr.routes.unshift((method, url) => (method === 'GET' && url.pathname === '/api/v3/downloadclient'
      ? { status: 200, body: [{ enable: true, removeFailedDownloads: true }] } : undefined));
    duneGrab(w);
    w.onDelete('radarr', '/api/v3/moviefile/11', { removes: [w.file] });
    const { body } = await w.remove('/movie/1', { mode: 'searchAgain', blocklistCurrent: true, removeTorrents: [], secondVersions: [] });
    assert.deepEqual(w.steps(body).slice(4, 6), ['blocklist:failed', 'search:done']);
    assert.match(body.steps[4].message, /Blocklisted 0 releases\. Dune\.2021\.2160p-GRP: not blocklisted, because Radarr's download client removes failed downloads/);
    assert.deepEqual(w.arrFake.radarr.state.failed, []);
    assert.deepEqual(w.arrFake.radarr.state.commands, [{ name: 'MoviesSearch', movieIds: [1] }]);
  });

  // Andor: a season pack backs three episode files; SINGLE backs one episode and also a file of another show.
  const andor = async () => {
    const w = await world();
    await w.addTorrent(PACK, 'downloads/Andor.S01', ['e1.mkv', 'e2.mkv', 'e3.mkv']);
    await w.addTorrent(SINGLE, 'downloads', ['Andor.S02E01.mkv']);
    await w.addTorrent(V1, 'downloads', ['Andor.S01E01.2160p.mkv']);
    await w.addTorrent(V2, 'downloads', ['Andor.S01E02.2160p.mkv']);
    await w.addTorrent(OTHER, 'downloads', ['Unrelated.mkv']);
    const files = [];
    for (const n of [1, 2, 3]) files.push(await w.hardlink(w.at(`downloads/Andor.S01/e${n}.mkv`), w.at(`library/tv/Andor/Season 01/Andor - S01E0${n}.mkv`)));
    files.push(await w.hardlink(w.at('downloads/Andor.S02E01.mkv'), w.at('library/tv/Andor/Season 02/Andor - S02E01.mkv')));
    await w.hardlink(w.at('downloads/Andor.S02E01.mkv'), w.at('library/tv/Other Show/Season 01/Other - S01E01.mkv'));
    const versions = [
      await w.addVersion(V1, { episodeId: 101 }, w.at('downloads/Andor.S01E01.2160p.mkv'), w.at('versions/tv/Andor/Andor - S01E01.2160p.mkv')),
      await w.addVersion(V2, { episodeId: 102 }, w.at('downloads/Andor.S01E02.2160p.mkv'), w.at('versions/tv/Andor/Andor - S01E02.2160p.mkv')),
    ];
    w.arrFake.sonarr.state.series.push(seriesRecord({ id: 5, title: 'Andor' }));
    w.arrFake.sonarr.state.episodeFiles.push(...files.map((path, index) => ({ id: 21 + index, seriesId: 5, path, size: 1 })));
    await w.poller.poll();
    return { ...w, files, versions };
  };

  // Splitting a pack into one choice per file, or offering a torrent another show still uses, turns this red.
  await t.test('the show plan gives a pack one choice and refuses a torrent another show still uses', async () => {
    const w = await andor();
    const { body } = await w.plan('/series/5');
    assert.equal(body.recycleBin, null);
    assert.deepEqual(body.files.map((file) => [file.state, file.hashes]), [...[1, 2, 3].map(() => ['linked', [PACK]]), ['linked', [SINGLE]]]);
    assert.deepEqual(body.torrents.map((torrent) => [torrent.hash, torrent.libraryPaths.length, torrent.ticked, torrent.removal.allowed]),
      [[PACK, 3, false, true], [SINGLE, 1, false, false]]);
    assert.match(body.torrents[1].removal.reason, /shares its data with the library file .*Other Show/);
    assert.deepEqual(body.secondVersions.map((row) => [row.id, row.ticked]), w.versions.map((id) => [id, true]));
    const refused = await w.remove('/series/5', { removeTorrents: [SINGLE], secondVersions: [] });
    assert.equal(refused.status, 409);
    assert.match(refused.body.reason, /shares its data with the library file .*Other Show/);
    assert.equal(w.requests('sonarr').some((request) => request.startsWith('DELETE')), false);
  });

  // Deleting before mapping, adding an import list exclusion, touching an unticked second version or skipping history turns this red.
  await t.test('deleting the show removes the chosen pack, deletes only ticked second versions and writes history', async () => {
    const w = await andor();
    w.onDelete('sonarr', '/api/v3/series/5', { removes: w.files });
    assert.equal(await w.inLibrary('sonarr', { title: 'Andor', tvdbId: 393189, id: 5 }), true);
    const { body } = await w.remove('/series/5', { removeTorrents: [PACK], secondVersions: [{ id: w.versions[0], removeTorrent: false }] });
    // Not forgetting search's saved lookups after the delete turns this red: search keeps offering Andor as in the library.
    assert.equal(await w.inLibrary('sonarr', { title: 'Andor', tvdbId: 393189 }), false);
    assert.deepEqual(w.steps(body), ['map:done', 'delete:done', 'wait:done', 'torrents:done', 'secondVersions:done', 'history:done']);
    const sonarr = w.requests('sonarr');
    const mappedAt = sonarr.indexOf('GET /api/v3/history/series?seriesId=5');
    assert.ok(mappedAt !== -1 && mappedAt < sonarr.indexOf('DELETE /api/v3/series/5?deleteFiles=true&addImportListExclusion=false'));
    assert.deepEqual(w.fake.torrents.map((torrent) => torrent.hash), [SINGLE, V1, V2, OTHER]);
    assert.deepEqual([w.versionState(w.versions[0]), w.versionState(w.versions[1])], ['deleted', 'imported']);
    assert.deepEqual(body.steps[4].secondVersions, [{ id: w.versions[0], deleted: true, torrentRemoved: false, reason: null }]);
    const [event] = await w.deletions();
    assert.deepEqual([event.title, event.event, event.subject], ['Andor', 'Show deleted', null]);
    assert.deepEqual(await w.deletions('radarr'), []);
  });

  // Refusing the whole delete as stale when an unticked second version still uses the chosen torrent turns this red.
  await t.test('a ticked second version whose pack an unticked one still uses is deleted and its torrent kept with the reason', async () => {
    const w = await andor();
    const PACKV = 'D1'.repeat(20);
    await w.addTorrent(PACKV, 'downloads/Andor.S01.2160p', ['e3.mkv', 'e4.mkv']);
    await w.poller.poll();
    const [third, fourth] = [
      await w.addVersion(PACKV, { episodeId: 103 }, w.at('downloads/Andor.S01.2160p/e3.mkv'), w.at('versions/tv/Andor/Andor - S01E03.2160p.mkv')),
      await w.addVersion(PACKV, { episodeId: 104 }, w.at('downloads/Andor.S01.2160p/e4.mkv'), w.at('versions/tv/Andor/Andor - S01E04.2160p.mkv')),
    ];
    w.onDelete('sonarr', '/api/v3/series/5', { removes: w.files });
    const { status, body } = await w.remove('/series/5', { removeTorrents: [], secondVersions: [{ id: third, removeTorrent: true }] });
    assert.equal(status, 200);
    assert.deepEqual(body.steps[4].secondVersions.map((row) => [row.id, row.deleted, row.torrentRemoved]), [[third, true, false]]);
    assert.match(body.steps[4].secondVersions[0].reason, /Another second version uses this torrent/);
    assert.deepEqual([w.versionState(third), w.versionState(fourth)], ['deleted', 'imported']);
    assert.equal(w.fake.torrents.some((torrent) => torrent.hash === PACKV), true);
  });

  // Carrying on after Sonarr refuses turns this red.
  await t.test('a Sonarr refusal means no other call is made', async () => {
    const w = await andor();
    w.onDelete('sonarr', '/api/v3/series/5', { status: 500 });
    await w.inLibrary('sonarr', { title: 'Andor', tvdbId: 393189, id: 5 });
    const callsBefore = w.fake.calls.length;
    const { body } = await w.remove('/series/5', { removeTorrents: [PACK], secondVersions: [{ id: w.versions[0], removeTorrent: true }] });
    assert.deepEqual(w.steps(body), ['map:done', 'delete:failed']);
    assert.equal(w.requests('sonarr').at(-1), 'DELETE /api/v3/series/5?deleteFiles=true&addImportListExclusion=false');
    assert.deepEqual(w.fake.calls.slice(callsBefore), []);
    assert.deepEqual(w.versions.map(w.versionState), ['imported', 'imported']);
    assert.deepEqual(await w.deletions(), []);
    // Forgetting search's saved lookups before checking Sonarr's answer turns this red.
    assert.equal(w.savedLookups('sonarr'), 1);
  });

  // Removing the pack while Sonarr has silently kept the show's files turns this red.
  await t.test('show files that never disappear keep the torrents and the result says so', async () => {
    const w = await andor();
    w.onDelete('sonarr', '/api/v3/series/5');
    const { body } = await w.remove('/series/5', { removeTorrents: [PACK], secondVersions: [] });
    assert.deepEqual(w.steps(body), ['map:done', 'delete:done', 'wait:failed', 'torrents:failed', 'secondVersions:skipped', 'history:done']);
    assert.match(body.steps[2].message, /Sonarr still had 4 library files after 2 minutes, so every torrent was kept/);
    assert.equal(body.steps[3].torrents[0].removed, false);
    assert.equal(w.fake.calls.includes('d.erase'), false);
    for (const file of w.files) assert.equal(await exists(file), true);
  });

  // Andor, two seasons: PACK backs S01E01-E03; FULL (a full-series pack) was imported by copy into S01E04 and S02E01.
  const seasons = async () => {
    const w = await world();
    const FULL = 'E1'.repeat(20);
    await w.addTorrent(PACK, 'downloads/Andor.S01', ['e1.mkv', 'e2.mkv', 'e3.mkv']);
    await w.addTorrent(FULL, 'downloads/Andor.Complete', ['s01e04.mkv', 's02e01.mkv']);
    await w.addTorrent(V1, 'downloads', ['Andor.S01E01.2160p.mkv']);
    await w.addTorrent(V2, 'downloads', ['Andor.S02E01.2160p.mkv']);
    const files = [];
    for (const n of [1, 2, 3]) files.push(await w.hardlink(w.at(`downloads/Andor.S01/e${n}.mkv`), w.at(`library/tv/Andor/Season 01/Andor - S01E0${n}.mkv`)));
    for (const [season, episode] of [[1, 4], [2, 1]]) {
      const file = w.at(`library/tv/Andor/Season 0${season}/Andor - S0${season}E0${episode}.mkv`);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, 'a copy');
      files.push(file);
    }
    const versions = [
      await w.addVersion(V1, { episodeId: 101 }, w.at('downloads/Andor.S01E01.2160p.mkv'), w.at('versions/tv/Andor/Andor - S01E01.2160p.mkv')),
      await w.addVersion(V2, { episodeId: 201 }, w.at('downloads/Andor.S02E01.2160p.mkv'), w.at('versions/tv/Andor/Andor - S02E01.2160p.mkv')),
    ];
    const sonarr = w.arrFake.sonarr.state;
    sonarr.series.push(seriesRecord({ id: 5, title: 'Andor', seasons: [1, 2].map((seasonNumber) => ({ seasonNumber, monitored: true })) }));
    sonarr.episodeFiles.push(...files.map((path, index) => ({ id: 21 + index, seriesId: 5, path, size: 1 })));
    sonarr.episodes.push(...[[101, 1, 1], [102, 1, 2], [103, 1, 3], [104, 1, 4], [201, 2, 1]].map(([id, seasonNumber, episodeNumber], index) => episodeRecord({
      id, seriesId: 5, seasonNumber, episodeNumber, hasFile: true, airDateUtc: '2022-09-21T01:00:00Z', episodeFile: { id: 21 + index, path: files[index], size: 1 },
    })));
    for (const [fileId, seasonNumber, episodeNumber] of [[24, 1, 4], [25, 2, 1]]) {
      sonarr.history.push(historyRecord({ eventType: 'downloadFolderImported', downloadId: FULL, seriesId: 5, episode: { seasonNumber, episodeNumber }, data: { fileId: String(fileId) } }));
    }
    await w.poller.poll();
    // Sonarr deletes each episode file at once and answers 200, unless told otherwise.
    for (const [index, file] of files.entries()) w.onDelete('sonarr', `/api/v3/episodefile/${21 + index}`, { removes: [file] });
    return { ...w, FULL, files, versions };
  };

  // Sending Sonarr's exclusion flag under Radarr's name, or reading import lists for a season that can never be removed, turns this red.
  await t.test('removing a show can exclude it from import lists; a season plan never asks', async () => {
    const w = await seasons();
    w.arrFake.sonarr.state.importLists = [{ enableAutomaticAdd: true }];
    assert.equal((await w.plan('/series/5')).body.importLists, true);
    const season = await w.plan('/series/5/season/1');
    assert.equal(season.body.importLists, false);
    assert.equal(w.requests('sonarr').filter((request) => request === 'GET /api/v3/importlist').length, 1);
    w.onDelete('sonarr', '/api/v3/series/5', { removes: w.files });
    const { body } = await w.remove('/series/5', { mode: 'remove', excludeFromImportLists: true, removeTorrents: [], secondVersions: [] });
    assert.equal(body.steps[1].message, 'Removed from Sonarr with its files, and excluded from its import lists.');
    assert.deepEqual(w.requests('sonarr').filter((request) => request.startsWith('DELETE')), ['DELETE /api/v3/series/5?deleteFiles=true&addImportListExclusion=true']);
  });

  // Offering the full-series pack (a copy, so no link check sees it), listing another season's file or second version, dropping willUnmonitor,
  // or offering to remove the show from a season delete turns this red.
  await t.test('the season plan lists only its own files and second versions and never offers a full-series pack', async () => {
    const w = await seasons();
    const { status, body } = await w.plan('/series/5/season/1');
    assert.equal(status, 200);
    assert.deepEqual([body.title, body.seasonNumber, body.selection, body.willUnmonitor, body.modes], ['Andor', 1, null, true, ['keepUnmonitored', 'searchAgain']]);
    assert.deepEqual(body.monitoring, { followsNewSeasons: false, airingSeasons: [], leavesShowEmpty: false });
    assert.deepEqual(body.files.map((file) => [file.fileId, file.state]), [[21, 'linked'], [22, 'linked'], [23, 'linked'], [24, 'copied']]);
    assert.deepEqual(body.torrents.map((torrent) => [torrent.hash, torrent.ticked, torrent.removal.allowed, torrent.removal.reason ?? null]),
      [[PACK, false, true, null], [w.FULL, false, false, KEPT_FILES]]);
    assert.deepEqual(body.secondVersions.map((row) => row.id), [w.versions[0]]);
    const refused = await w.remove('/series/5/season/1', { removeTorrents: [w.FULL], secondVersions: [] });
    assert.deepEqual([refused.status, refused.body.reason], [409, `${w.FULL} can no longer be removed: ${KEPT_FILES}`]);
    assert.equal(w.requests('sonarr').some((request) => !request.startsWith('GET')), false);
    assert.equal((await w.plan('/series/5/season/3')).status, 404);
  });

  // Deleting a file before unmonitoring, a bulk or show delete, or touching another season turns this red.
  await t.test('deleting a season unmonitors it first, sends one delete per file, and keeps the show and its other seasons', async () => {
    const w = await seasons();
    const { status, body } = await w.remove('/series/5/season/1', { removeTorrents: [PACK], secondVersions: [{ id: w.versions[0], removeTorrent: true }] });
    assert.equal(status, 200);
    assert.equal(body.deleted, true);
    assert.deepEqual(w.steps(body), ['map:done', 'unmonitor:done', 'delete:done', 'wait:done', 'torrents:done', 'secondVersions:done', 'monitoring:done', 'history:done']);
    const sonarr = w.requests('sonarr');
    const firstDelete = sonarr.findIndex((request) => request.startsWith('DELETE'));
    assert.ok(sonarr.indexOf('PUT /api/v3/episode/monitor') < sonarr.indexOf('PUT /api/v3/series/5') && sonarr.indexOf('PUT /api/v3/series/5') < firstDelete);
    assert.deepEqual(sonarr.filter((request) => request.startsWith('DELETE')), [21, 22, 23, 24].map((id) => `DELETE /api/v3/episodefile/${id}`));
    const state = w.arrFake.sonarr.state;
    assert.deepEqual(state.episodes.map((episode) => [episode.id, episode.monitored]), [[101, false], [102, false], [103, false], [104, false], [201, true]]);
    assert.deepEqual(state.series[0].seasons.map((season) => [season.seasonNumber, season.monitored]), [[1, false], [2, true]]);
    assert.deepEqual(w.fake.torrents.map((torrent) => torrent.hash), [w.FULL, V2]);
    assert.deepEqual(w.versions.map(w.versionState), ['deleted', 'imported']);
    assert.equal(await exists(w.files[4]), true);
    const [event] = await w.deletions();
    assert.deepEqual([event.title, event.event], ['Andor Season 1', 'Season deleted']);
  });

  // Stopping at the first refused file, removing the torrent of a file Sonarr kept, or hiding the per-file answers turns this red.
  await t.test('a 409 on one file still tries the others, lists every answer and keeps that file\'s torrent', async () => {
    const w = await seasons();
    w.arrFake.sonarr.routes.unshift((method, url) => (method === 'DELETE' && url.pathname === '/api/v3/episodefile/22' ? { status: 409, body: { message: 'Root folder does not exist' } } : undefined));
    const { body } = await w.remove('/series/5/season/1', { removeTorrents: [PACK], secondVersions: [] });
    assert.equal(body.deleted, true);
    assert.deepEqual(w.steps(body), ['map:done', 'unmonitor:done', 'delete:failed', 'wait:done', 'torrents:failed', 'secondVersions:skipped', 'monitoring:done', 'history:done']);
    assert.deepEqual(body.steps[2].files.map((file) => [file.fileId, file.deleted]), [[21, true], [22, false], [23, true], [24, true]]);
    assert.match(body.steps[2].files[1].reason, /HTTP 409: Root folder does not exist/);
    assert.equal(w.requests('sonarr').filter((request) => request.startsWith('DELETE')).length, 4);
    assert.deepEqual(body.steps[4].torrents.map((torrent) => [torrent.hash, torrent.removed]), [[PACK, false]]);
    assert.match(body.steps[4].torrents[0].reason, /Sonarr did not delete .*S01E02/);
    assert.equal(w.fake.calls.includes('d.erase'), false);
    assert.equal(await exists(w.files[1]), true);
  });

  // Deleting a file before the show, its seasons, episodes and new seasons are unmonitored, or removing the show from Sonarr, turns this red.
  await t.test('keeping a show unmonitored stops every season, episode and new season before deleting each file, and keeps the show', async () => {
    const w = await seasons();
    const { status, body } = await w.remove('/series/5', { mode: 'keepUnmonitored', removeTorrents: [PACK], secondVersions: [] });
    assert.equal(status, 200);
    assert.deepEqual(w.steps(body), ['map:done', 'unmonitor:done', 'delete:done', 'wait:done', 'torrents:done', 'secondVersions:skipped', 'monitoring:done', 'history:done']);
    const sonarr = w.requests('sonarr');
    const firstDelete = sonarr.findIndex((request) => request.startsWith('DELETE'));
    assert.ok(sonarr.indexOf('PUT /api/v3/episode/monitor') < firstDelete && sonarr.indexOf('PUT /api/v3/series/5') < firstDelete);
    assert.deepEqual(sonarr.filter((request) => request.startsWith('DELETE')), [21, 22, 23, 24, 25].map((id) => `DELETE /api/v3/episodefile/${id}`));
    const [series] = w.arrFake.sonarr.state.series;
    assert.deepEqual([series.monitored, series.monitorNewItems, series.seasons.map((season) => season.monitored)], [false, 'none', [false, false]]);
    // Reporting what the delete meant instead of what Sonarr holds, or dropping a season, turns this red.
    assert.deepEqual(body.steps.find((step) => step.step === 'monitoring').monitoring, { kind: 'series', monitored: false, monitorNewItems: 'none', seasons: [
      { seasonNumber: 1, monitored: false, monitoredEpisodes: 0, episodes: 4 },
      { seasonNumber: 2, monitored: false, monitoredEpisodes: 0, episodes: 1 },
    ] });
    assert.equal(w.arrFake.sonarr.state.episodes.every((episode) => episode.monitored === false), true);
    assert.deepEqual(w.fake.torrents.map((torrent) => torrent.hash), [w.FULL, V1, V2]);
    assert.equal((await w.deletions())[0].event, 'Show files deleted, unmonitored');
  });

  // Searching the whole show instead of the deleted episodes, searching before their files are gone, leaving them unmonitored,
  // monitoring an episode of the season the owner left off (Sonarr turns a season's episodes on with it), lifting another season's
  // protection, or blocklisting when not asked turns this red.
  await t.test('searching a season again monitors its episodes and the season, deletes each file, then searches only those episodes', async () => {
    const w = await seasons();
    const state = w.arrFake.sonarr.state;
    state.series[0].seasons[0].monitored = false;
    for (const episode of state.episodes) episode.monitored = false;
    state.episodes.push(episodeRecord({ id: 105, seriesId: 5, seasonNumber: 1, episodeNumber: 5, monitored: false }));
    w.protection.items.push(
      { service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 102, seasonNumber: 1, episodeNumber: 2 },
      { service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 201, seasonNumber: 2, episodeNumber: 1 },
    );
    const { body } = await w.remove('/series/5/season/1', { mode: 'searchAgain', removeTorrents: [], secondVersions: [] });
    assert.deepEqual(w.steps(body), ['map:done', 'monitor:done', 'delete:done', 'wait:done', 'search:done', 'torrents:skipped', 'secondVersions:skipped', 'monitoring:done', 'history:done']);
    const sonarr = w.requests('sonarr');
    assert.ok(sonarr.findLastIndex((request) => request.startsWith('DELETE')) < sonarr.indexOf('POST /api/v3/command'));
    assert.deepEqual(state.episodes.map((episode) => [episode.id, episode.monitored]), [[101, true], [102, true], [103, true], [104, true], [201, false], [105, false]]);
    assert.deepEqual(state.series[0].seasons.map((season) => [season.seasonNumber, season.monitored]), [[1, true], [2, true]]);
    assert.deepEqual(w.protection.lifted.map((item) => item.episodeId), [102]);
    assert.deepEqual(state.commands, [{ name: 'EpisodeSearch', episodeIds: [101, 102, 103, 104] }]);
    assert.deepEqual(state.failed, []);
    assert.deepEqual(w.fake.torrents.map((torrent) => torrent.hash), [PACK, w.FULL, V1, V2]);
    const [event] = await w.deletions();
    assert.deepEqual([event.title, event.event], ['Andor Season 1', 'Season files deleted, searching again']);
  });

  // Searching only one season, monitoring a season the owner left off without a deleted file, blocklisting before lifting the protection,
  // or recording it as anything but a show search turns this red.
  await t.test('searching a whole show again monitors each season that lost a file, blocklists the grab it can trace, and searches every deleted episode', async () => {
    const w = await seasons();
    const state = w.arrFake.sonarr.state;
    state.series[0].seasons.push({ seasonNumber: 3, monitored: false });
    state.episodes.push(episodeRecord({ id: 301, seriesId: 5, seasonNumber: 3, episodeNumber: 1, monitored: false }));
    state.history.push(historyRecord({ id: 601, eventType: 'grabbed', downloadId: w.FULL, seriesId: 5, sourceTitle: 'Andor.Complete-GRP' }));
    w.protection.items.push({ service: 'sonarr', kind: 'episode', seriesId: 5, episodeId: 201, seasonNumber: 2, episodeNumber: 1 });
    const { body } = await w.remove('/series/5', { mode: 'searchAgain', blocklistCurrent: true, removeTorrents: [], secondVersions: [] });
    assert.deepEqual(w.steps(body), ['map:done', 'monitor:done', 'delete:done', 'wait:done', 'blocklist:failed', 'search:done', 'torrents:skipped', 'secondVersions:skipped', 'monitoring:done', 'history:done']);
    assert.match(body.steps[4].message, /^Blocklisted 1 release\. No grab in Sonarr's history for 3 files/);
    assert.deepEqual(state.failed, [601]);
    assert.deepEqual(state.series[0].seasons.map((season) => [season.seasonNumber, season.monitored]), [[1, true], [2, true], [3, false]]);
    assert.equal(state.episodes.find((episode) => episode.id === 301).monitored, false);
    assert.deepEqual([w.protection.lifted.map((item) => item.episodeId), w.protection.failedBeforeLift], [[201], 0]);
    assert.deepEqual(state.commands, [{ name: 'EpisodeSearch', episodeIds: [101, 102, 103, 104, 201] }]);
    assert.equal(w.requests('sonarr').some((request) => request.startsWith('DELETE /api/v3/series/')), false);
    const [event] = await w.deletions();
    assert.deepEqual([event.title, event.event], ['Andor', 'Show files deleted, searching again']);
  });

  // A chosen episode, an unaired one in season 2 (no air date counts as still to air), and the requests for them.
  const pick = (w, body) => w.remove('/series/5/selection', body);
  const unaired = (w) => w.arrFake.sonarr.state.episodes.push(episodeRecord({ id: 202, seriesId: 5, seasonNumber: 2, episodeNumber: 2, airDateUtc: '2099-01-01T00:00:00Z' }));

  // Offering a pack that still backs kept episodes, listing another episode's file or second version, or dropping the selection turns this red.
  await t.test('a selection plan lists only the chosen episodes and never offers a pack that backs episodes it keeps', async () => {
    const w = await seasons();
    const { status, body } = await w.plan('/series/5/selection');
    assert.equal(status, 400);
    const planned = await w.routesPlan('/series/5/selection', 'episodes=101');
    assert.equal(planned.status, 200);
    assert.deepEqual([planned.body.seasonNumber, planned.body.selection, planned.body.willUnmonitor, planned.body.modes],
      [null, { seasons: [], episodeIds: [101] }, true, ['keepUnmonitored', 'searchAgain']]);
    assert.deepEqual(planned.body.files.map((file) => file.fileId), [21]);
    assert.deepEqual(planned.body.torrents.map((torrent) => [torrent.hash, torrent.removal.allowed, torrent.removal.reason ?? null]), [[PACK, false, KEPT_FILES]]);
    assert.deepEqual(planned.body.secondVersions.map((row) => row.id), [w.versions[0]]);
    assert.equal((await w.routesPlan('/series/5/selection', 'episodes=999')).status, 404);
    assert.equal((await w.routesPlan('/series/5/selection', 'seasons=9')).status, 404);
    assert.equal((await w.routesPlan('/series/5/selection', 'episodes=1,x')).status, 400);
  });

  // Unmonitoring the episode's season, deleting another episode's file, removing a pack that backs kept episodes, or naming it badly in History turns this red.
  await t.test('deleting one episode unmonitors only that episode, deletes its file, and keeps its season monitored', async () => {
    const w = await seasons();
    const refused = await pick(w, { mode: 'keepUnmonitored', seasons: [], episodeIds: [102], removeTorrents: [PACK], secondVersions: [] });
    assert.deepEqual([refused.status, refused.body.reason], [409, `${PACK} can no longer be removed: ${KEPT_FILES}`]);
    const { status, body } = await pick(w, { mode: 'keepUnmonitored', seasons: [], episodeIds: [102], removeTorrents: [], secondVersions: [] });
    assert.equal(status, 200);
    assert.deepEqual(w.steps(body), ['map:done', 'unmonitor:done', 'delete:done', 'wait:done', 'torrents:skipped', 'secondVersions:skipped', 'monitoring:done', 'history:done']);
    const sonarr = w.requests('sonarr');
    assert.deepEqual(sonarr.filter((request) => !request.startsWith('GET')), ['PUT /api/v3/episode/monitor', 'DELETE /api/v3/episodefile/22']);
    const state = w.arrFake.sonarr.state;
    assert.deepEqual(state.episodes.map((episode) => [episode.id, episode.monitored]), [[101, true], [102, false], [103, true], [104, true], [201, true]]);
    assert.deepEqual(state.series[0].seasons.map((season) => season.monitored), [true, true]);
    assert.equal(await exists(w.files[0]), true);
    const [event] = await w.deletions();
    assert.deepEqual([event.title, event.event], ['Andor S01E02', 'Episodes deleted']);
  });

  // Guessing an answer for a season still airing, changing anything before refusing, unmonitoring an unaired episode the owner keeps following,
  // or keeping a season the owner stopped following turns this red.
  await t.test('keeping an airing season unmonitored needs an answer: keep following leaves the season and its unaired episodes on, stop turns all off', async () => {
    const w = await seasons();
    unaired(w);
    const planned = await w.routesPlan('/series/5/selection', 'seasons=2');
    assert.deepEqual(planned.body.monitoring, { followsNewSeasons: false, airingSeasons: [2], leavesShowEmpty: false });
    const unanswered = await pick(w, { mode: 'keepUnmonitored', seasons: [2], episodeIds: [], removeTorrents: [], secondVersions: [] });
    assert.deepEqual([unanswered.status, unanswered.body.error], [400, 'invalid_request']);
    assert.match(unanswered.body.reason, /keep following season 2, which still has episodes to air/);
    assert.equal(w.requests('sonarr').some((request) => !request.startsWith('GET')), false);

    const kept = await pick(w, { mode: 'keepUnmonitored', keepFollowing: { 2: true }, seasons: [2], episodeIds: [], removeTorrents: [], secondVersions: [] });
    assert.deepEqual(w.steps(kept.body).slice(0, 3), ['map:done', 'unmonitor:done', 'delete:done']);
    assert.match(kept.body.steps[1].message, /Unmonitored 1 episode in Sonarr\. Still following season 2 for episodes still to air\./);
    const state = w.arrFake.sonarr.state;
    assert.deepEqual(state.episodes.filter((episode) => episode.seasonNumber === 2).map((episode) => [episode.id, episode.monitored]), [[201, false], [202, true]]);
    assert.deepEqual(state.series[0].seasons.map((season) => season.monitored), [true, true]);

    const w2 = await seasons();
    unaired(w2);
    await pick(w2, { mode: 'keepUnmonitored', keepFollowing: { 2: false }, seasons: [2], episodeIds: [], removeTorrents: [], secondVersions: [] });
    const after = w2.arrFake.sonarr.state;
    assert.deepEqual(after.episodes.filter((episode) => episode.seasonNumber === 2).map((episode) => episode.monitored), [false, false]);
    assert.deepEqual(after.series[0].seasons.map((season) => season.monitored), [true, false]);
    assert.equal((await w2.deletions())[0].title, 'Andor Season 2');
  });

  // Calling a show empty while it keeps files, monitored episodes or new seasons, or never calling it empty, turns this red.
  await t.test('a selection that would leave the show with no files and nothing monitored says so, unless Sonarr follows new seasons', async () => {
    const w = await seasons();
    assert.equal((await w.routesPlan('/series/5/selection', 'seasons=1,2')).body.monitoring.leavesShowEmpty, true);
    assert.equal((await w.routesPlan('/series/5/selection', 'seasons=1')).body.monitoring.leavesShowEmpty, false);
    w.arrFake.sonarr.state.series[0].monitorNewItems = 'all';
    assert.deepEqual((await w.routesPlan('/series/5/selection', 'seasons=1,2')).body.monitoring, { followsNewSeasons: true, airingSeasons: [], leavesShowEmpty: false });
  });

  // Accepting a selection without its mode, one that would remove the show, an empty one, or the selection keys on another route turns this red.
  await t.test('a selection request names its mode and its seasons or episodes', async () => {
    const w = await seasons();
    const base = { removeTorrents: [], secondVersions: [] };
    const bad = [
      ['/series/5/selection', { ...base, seasons: [1], episodeIds: [] }],
      ['/series/5/selection', { ...base, mode: 'remove', seasons: [1], episodeIds: [] }],
      ['/series/5/selection', { ...base, mode: 'keepUnmonitored', seasons: [], episodeIds: [] }],
      ['/series/5/selection', { ...base, mode: 'keepUnmonitored', seasons: [1, 1], episodeIds: [] }],
      ['/series/5/selection', { ...base, mode: 'keepUnmonitored', episodeIds: [101] }],
      ['/series/5/selection', { ...base, mode: 'keepUnmonitored', seasons: [], episodeIds: [101], keepFollowing: { 1: 'yes' } }],
      ['/series/5/season/1', { ...base, mode: 'keepUnmonitored', seasons: [1], episodeIds: [] }],
    ];
    for (const [path, body] of bad) assert.equal((await w.remove(path, body)).status, 400, `${path} ${JSON.stringify(body)}`);
    assert.equal(w.requests('sonarr').some((request) => !request.startsWith('GET')), false);
  });

  // Offering to remove a pack that also downloads episodes the delete keeps, or listing another season's download, turns this red.
  await t.test('a season delete lists a pack that also holds other seasons as one it can only leave', async () => {
    const w = await seasons();
    const SEASONS = 'F3'.repeat(20);
    w.arrFake.sonarr.state.queue.push(
      ...[101, 201].map((episodeId) => queueItem({ seriesId: 5, episodeId, downloadId: SEASONS.toLowerCase(), title: 'Andor.S01-S02.2160p-GRP', size: 10, sizeleft: 10 })),
      queueItem({ seriesId: 5, episodeId: 201, downloadId: 'f4'.repeat(20), title: 'Andor.S02E01.2160p-GRP', size: 10, sizeleft: 10 }),
    );
    const planned = (await w.plan('/series/5/season/1')).body;
    assert.deepEqual(planned.queue.map((item) => [item.downloadId, item.episodeIds, item.removable.allowed, item.removable.reason ?? null, item.advice]),
      [[SEASONS, [101, 201], false, KEPT_EPISODES, null]]);
    const refused = await w.remove('/series/5/season/1', { queue: [{ downloadId: SEASONS, action: 'remove' }], removeTorrents: [], secondVersions: [] });
    assert.deepEqual([refused.status, refused.body.error], [400, 'invalid_request']);
    assert.equal(w.requests('sonarr').some((request) => !request.startsWith('GET')), false);
  });

  // Deleting files after an unmonitor call fails turns this red.
  await t.test('a failed unmonitor stops the season delete before any file is touched', async () => {
    const w = await seasons();
    w.arrFake.sonarr.routes.unshift((method, url) => (method === 'PUT' && url.pathname === '/api/v3/series/5' ? { status: 500, body: { message: 'Database is locked' } } : undefined));
    const callsBefore = w.fake.calls.length;
    const { body } = await w.remove('/series/5/season/1', { removeTorrents: [PACK], secondVersions: [{ id: w.versions[0], removeTorrent: true }] });
    assert.deepEqual([body.deleted, w.steps(body)], [false, ['map:done', 'unmonitor:failed']]);
    assert.equal(w.requests('sonarr').some((request) => request.startsWith('DELETE')), false);
    assert.deepEqual(w.fake.calls.slice(callsBefore), []);
    assert.deepEqual(w.versions.map(w.versionState), ['imported', 'imported']);
    assert.deepEqual(await w.deletions(), []);
  });
});

// Leaving the routes unmounted, or the 1 KB body limit on a long show's choices, turns this red.
test('the delete routes sit under the owner guard at /api/library and take a long list of choices', async () => {
  const calls = [];
  const { app } = await makeApp({
    titleDelete: {
      plan: async (target) => ({ kind: 'ok', value: { target } }),
      run: async (target, choices, mode) => {
        calls.push([target, choices.removeTorrents.length, mode]);
        return { kind: 'ran', deleted: true, steps: [] };
      },
    },
  });
  assert.equal((await app.request('/api/library/movie/1/delete-plan')).status, 401);
  const { session } = await signIn(app);
  const planned = await app.request('/api/library/series/7/delete-plan', { headers: { Cookie: session } });
  assert.deepEqual(await planned.json(), { target: { service: 'sonarr', seriesId: 7 } });
  // Dropping the season routes, or refusing season 0 (specials), turns this red.
  const seasonPlan = await app.request('/api/library/series/7/season/0/delete-plan', { headers: { Cookie: session } });
  assert.deepEqual(await seasonPlan.json(), { target: { service: 'sonarr', seriesId: 7, seasonNumber: 0 } });
  // Dropping the selection route turns this red.
  const selectionPlan = await app.request('/api/library/series/7/selection/delete-plan?seasons=0&episodes=12', { headers: { Cookie: session } });
  assert.deepEqual(await selectionPlan.json(), { target: { service: 'sonarr', seriesId: 7, selection: { seasons: [0], episodeIds: [12] } } });
  const removeTorrents = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0').repeat(20));
  const response = await app.request('/api/library/movie/3/delete', {
    method: 'POST',
    headers: { ...jsonHeaders(), Cookie: session },
    body: JSON.stringify({ mode: 'keepUnmonitored', removeTorrents, secondVersions: [] }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [[{ service: 'radarr', movieId: 3 }, 60, 'keepUnmonitored']]);
});

test('the discover routes check every value, mark library titles and turn a missing TMDB key into a readable error', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTmdb } = await import(tmdbModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const { createDiscover } = await import(new URL('../dist/server/discover/index.js', import.meta.url).href);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-discover-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const clock = { value: 1_800_000_000_000 };
  const now = () => clock.value;
  const calls = [];
  const json = (body) => new Response(JSON.stringify(body));
  const tmdb = createTmdb(database, { now, fetch: async (url) => {
    const target = new URL(String(url));
    calls.push(target);
    if (target.pathname === '/3/genre/movie/list') return json({ genres: [{ id: 878, name: 'Science Fiction' }, { id: 18, name: 'Drama' }] });
    if (target.pathname === '/3/genre/tv/list') return json({ genres: [{ id: 18, name: 'Drama' }] });
    return json({ page: 2, total_pages: 3, results: [
      { id: 438631, title: 'Dune', release_date: '2021-09-15', poster_path: '/d5NX.jpg', backdrop_path: null, vote_average: 7.8, overview: 'Paul travels. Then more.', genre_ids: [878, 18], popularity: 90.5 },
      { id: 999, name: 'Severance', media_type: 'tv', first_air_date: '2022-02-17', poster_path: null, backdrop_path: '/bg.jpg' },
    ] });
  } });
  const store = createTitleStore(database, { now });
  database.prepare('INSERT INTO titles (service, id, title, year, detail, fingerprint, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('radarr', 7, 'Dune', 2021, '{"tmdbId":438631}', 'fp', 0);
  const { app } = await makeApp({ clock, discover: createDiscover({ tmdb, store, database, trakt: undefined, now }) });
  const { session } = await signIn(app);
  const get = async (path) => {
    const response = await app.request(path, { headers: { Cookie: session } });
    return { status: response.status, body: await response.json() };
  };

  // Mounting /api/discover outside the private guard turns this red.
  assert.equal((await app.request('/api/discover/movie')).status, 401);

  // Answering a missing TMDB key with a 500 or without its reason turns this red.
  const unconfigured = await get('/api/discover/movie');
  assert.equal(unconfigured.status, 503);
  assert.equal(unconfigured.body.error, 'not_configured');
  assert.match(unconfigured.body.reason, /TMDB is not configured/);

  // Letting any one of these values through to TMDB turns its row red.
  setSetting(database, 'credentials', 'tmdb.apiKey', 'tmdb-key');
  for (const path of [
    'movie?sort=trending', 'movie?region=usa', 'movie?region=us', 'movie?yearFrom=2020&yearTo=2019', 'movie?genres=18,abc',
    'movie?providers=8|9', 'movie?page=0', 'movie?page=501', 'movie?minRating=11', 'person', 'providers/tv?region=GBR',
    // Dropping the type or year check on the trending grid turns these two red.
    'trending?type=film', 'trending?yearFrom=2020&yearTo=2019',
  ]) {
    assert.equal((await get(`/api/discover/${path}`)).status, 400, path);
  }
  assert.equal(calls.length, 0);

  // Matching the library by anything but the saved title's TMDB id, building image URLs other than the agreed route, cutting the overview,
  // dropping genre names or the date, or not saving the summary with its date and popularity turns this red.
  const path = '/api/discover/movie?genres=18,878&providers=8,9&region=GB&yearFrom=2020&minRating=6.5&page=2';
  const page = await get(path);
  assert.equal(page.status, 200);
  assert.deepEqual({ page: page.body.page, totalPages: page.body.totalPages, pending: page.body.pending }, { page: 2, totalPages: 3, pending: false });
  assert.deepEqual(page.body.results[0], {
    tmdbId: 438631, type: 'movie', title: 'Dune', year: 2021, date: '2021-09-15', posterUrl: '/api/images/tmdb/w342/d5NX.jpg', backdropUrl: null,
    rating: 7.8, genres: ['Science Fiction', 'Drama'], overview: 'Paul travels. Then more.', libraryId: 7,
  });
  assert.equal(page.body.results[1].backdropUrl, '/api/images/tmdb/w1920_and_h800_multi_faces/bg.jpg');
  assert.equal(page.body.results[1].libraryId, null);
  assert.deepEqual([page.body.results[1].genres, page.body.results[1].date], [[], '2022-02-17']);
  const saved = store.get({ type: 'movie', tmdbId: 438631 }, 'tmdbSummary').value;
  assert.deepEqual([saved.title, saved.date, saved.popularity], ['Dune', '2021-09-15', 90.5]);
  assert.equal(store.get({ type: 'tv', tmdbId: 999 }, 'tmdbSummary').value.title, 'Severance');
  const sent = calls.find((call) => call.pathname === '/3/discover/movie').searchParams;
  assert.deepEqual(
    ['sort_by', 'with_genres', 'with_watch_providers', 'watch_region', 'primary_release_date.gte', 'vote_average.gte', 'page'].map((name) => sent.get(name)),
    ['popularity.desc', '18,878', '8|9', 'GB', '2020-01-01', '6.5', '2'],
  );

  // Asking TMDB again for a grid saved under five minutes ago, or never refilling it after that, turns this red.
  const before = calls.length;
  assert.deepEqual((await get(path)).body, page.body);
  assert.equal(calls.length, before);
  clock.value += 5 * 60_000 + 1;
  assert.equal((await get(path)).status, 200);
  assert.equal(calls.slice(before).filter((call) => call.pathname === '/3/discover/movie').length, 1);

  // Asking TMDB for the mixed trending list on a TV grid, or not applying the genre filter to the trending page, turns this red.
  const trending = await get('/api/discover/trending?type=tv&genres=18');
  assert.equal(trending.status, 200);
  assert.ok(calls.some((call) => call.pathname === '/3/trending/tv/week'));
  assert.deepEqual(trending.body.results.map((item) => item.title), ['Dune']);
  assert.ok(trending.body.results.every((item) => item.genres.includes('Drama')));

  // Reporting a Trakt-only row with no Trakt as an empty row instead of failed, or marking a TMDB-filled row failed, turns this red.
  const home = await get('/api/discover/home');
  assert.ok(home.body.extraRows.length > 0);
  assert.ok(home.body.extraRows.every((row) => row.failed === true && row.failure === 'not_configured'));
  assert.equal(home.body.trending.all.failed, false);
});

test('the discover home serves recipe rows from saved results, blends sources by weighted rank, applies the filter bar and never leaks a key', async (t) => {
  const { openDatabase } = await import(databaseModuleUrl);
  const { setSetting } = await import(settingsModuleUrl);
  const { createTmdb } = await import(tmdbModuleUrl);
  const { createTitleStore } = await import(titleStoreModuleUrl);
  const { createDiscover } = await import(new URL('../dist/server/discover/index.js', import.meta.url).href);
  const { rowKey } = await import(new URL('../dist/server/discover/rows.js', import.meta.url).href);
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-discover-home-'));
  const database = openDatabase(join(root, 'media-manager.sqlite'));
  t.after(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const key = `tmdb-key-${process.pid}-home`;
  setSetting(database, 'credentials', 'tmdb.apiKey', key);
  const clock = { value: 1_800_000_000_000 };
  const now = () => clock.value;
  const day = (offset) => new Date(clock.value + offset * 86_400_000).toISOString().slice(0, 10);
  const genreNames = { 18: 'Drama', 878: 'Science Fiction' };

  // Every title the fakes know. `in` dates a title that many days after the current clock; a title without a date has none.
  const movie = (id, title, extra) => [`movie:${id}`, { type: 'movie', id, title, genres: [18], rating: 7, date: '2024-01-01', ...extra }];
  const show = (id, title, extra) => [`tv:${id}`, { type: 'tv', id, title, genres: [18], rating: 7, date: '2024-01-01', ...extra }];
  const catalogue = new Map([
    movie(101, 'Arrival', { genres: [878, 18], rating: 7.5, date: '2025-03-01' }),
    movie(102, 'Yesterday', { date: '2024-05-01' }),
    movie(103, 'Xanadu', { rating: 7.2, date: '2023-01-01' }),
    movie(201, 'Babel', { genres: [878], rating: 6.9, date: '2022-01-01' }),
    movie(401, 'Service film'),
    movie(501, 'Soon', { genres: [878], rating: 6, in: 5 }),
    movie(502, 'Later', { in: 20 }),
    movie(503, 'Much later', { in: 60 }),
    movie(601, 'Popular film', { rating: 8, date: '2020-06-01' }),
    movie(901, 'Awaited film', { genres: [878], in: 100 }),
    movie(1101, 'Watched film'),
    movie(1301, 'Collected film'),
    movie(1501, 'Favourite film'),
    ...Array.from({ length: 10 }, (_, index) => movie(1701 + index, `Box office ${index + 1}`, { date: '2026-12-01' })),
    show(301, 'Severance', { rating: 8, date: '2024-02-01' }),
    show(302, 'Slow Horses', { rating: 7.5, date: '2023-02-01' }),
    show(402, 'Service show'),
    show(701, 'New show', { in: 10 }),
    show(702, 'Newer show', { in: 40 }),
    show(801, 'Popular show'),
    show(1001, 'Coming show', { in: 30 }),
    show(1002, 'Undated show', { date: undefined }),
    show(1003, 'Far show', { in: 120 }),
    show(1201, 'Watched show'),
    show(1401, 'Collected show'),
    show(1601, 'Favourite show'),
  ]);
  const dateOf = (entry) => (entry.in === undefined ? entry.date ?? null : day(entry.in));
  const overviewOf = (entry) => `${entry.title} begins. Then it continues.`;
  const listItem = (type, id, withType = false) => {
    const entry = catalogue.get(`${type}:${id}`);
    return {
      id, ...(withType ? { media_type: type } : {}), [type === 'movie' ? 'title' : 'name']: entry.title, [type === 'movie' ? 'release_date' : 'first_air_date']: dateOf(entry),
      genre_ids: entry.genres, vote_average: entry.rating, overview: overviewOf(entry), poster_path: `/p${id}.jpg`, popularity: 10,
    };
  };
  // Availability: Xanadu and Severance stream on service 9, everything else on service 8.
  const flatrate = (id) => ([103, 301].includes(id) ? [9] : [8]);

  const tmdbCalls = [];
  const unexpected = [];
  let tmdbDown = false;
  let trendingMovies = [102, 101, 103];
  let providersDown = false;
  let failingSummary;
  let missingSummary;
  let genresDown = false;
  const json = (body) => new Response(JSON.stringify(body));
  const page = (type, ids, withType = false) => json({ page: 1, total_pages: 1, results: ids.map((id) => listItem(type, id, withType)) });
  const tmdb = createTmdb(database, { now, fetch: async (url) => {
    const target = new URL(String(url));
    tmdbCalls.push(target);
    if (tmdbDown) return new Response('', { status: 500 });
    const path = target.pathname.replace(/^\/3/, '');
    const params = target.searchParams;
    if (path === '/trending/movie/week') return page('movie', trendingMovies);
    if (path === '/trending/tv/week') return page('tv', [301, 302]);
    // Trending no longer asks for TMDB's mixed list; it answers here so a recipe that asked again would count Yesterday twice.
    if (path === '/trending/all/week') return json({ results: [listItem('movie', 102, true), listItem('tv', 301, true)] });
    if (path === '/discover/movie') {
      if (params.get('with_watch_monetization_types') === 'flatrate') return page('movie', [401]);
      if (params.get('primary_release_date.lte') === day(30)) return page('movie', [502, 501]);
      if (params.get('primary_release_date.lte') === day(90)) return page('movie', [503, 502, 501]);
      return page('movie', [601]);
    }
    if (path === '/discover/tv') {
      if (params.get('with_watch_monetization_types') === 'flatrate') return page('tv', [402]);
      if (params.has('first_air_date.lte')) return page('tv', [702, 701]);
      return page('tv', [801]);
    }
    if (genresDown && path.startsWith('/genre/')) return new Response('', { status: 500 });
    if (path === '/genre/movie/list') return json({ genres: [{ id: 878, name: 'Science Fiction' }, { id: 18, name: 'Drama' }] });
    if (path === '/genre/tv/list') return json({ genres: [{ id: 18, name: 'Drama' }] });
    if (path === '/watch/providers/movie') return json({ results: [{ provider_id: 8, provider_name: 'Netflix' }] });
    let match = path.match(/^\/(movie|tv)\/(\d+)\/watch\/providers$/);
    if (match && providersDown) return new Response('', { status: 500 });
    if (match) return json({ id: Number(match[2]), results: { US: { flatrate: flatrate(Number(match[2])).map((id) => ({ provider_id: id })) } } });
    match = path.match(/^\/(movie|tv)\/(\d+)$/);
    if (match && path === failingSummary) return new Response('', { status: 500 });
    if (match && path === missingSummary) return new Response('', { status: 404 });
    if (match && catalogue.has(`${match[1]}:${match[2]}`)) {
      const { genre_ids: ids, ...item } = listItem(match[1], Number(match[2]));
      return json({ ...item, genres: ids.map((id) => ({ id, name: genreNames[id] })) });
    }
    unexpected.push(path);
    return new Response('', { status: 404 });
  } });

  // A Trakt title as the Trakt client returns it; F has neither a TMDB nor a TVDB id.
  const trakt = (type, id, tvdbId = null) => ({ type, tmdbId: id, tvdbId, title: catalogue.get(`${type}:${id}`).title, year: null, date: null, rating: null });
  const traktLists = {
    'movie:trending': [trakt('movie', 201), trakt('movie', 101), trakt('movie', 103)],
    'tv:trending': [trakt('tv', 301, 9301)],
    'movie:popular': [trakt('movie', 601)],
    'tv:popular': [trakt('tv', 801, 9801)],
    'movie:anticipated': [trakt('movie', 901)],
    'tv:anticipated': [trakt('tv', 1001, 91001), trakt('tv', 1002, 91002), trakt('tv', 1003, 91003), { type: 'tv', tmdbId: null, tvdbId: null, title: 'F', year: null, date: null, rating: null }],
    'movie:watched': [trakt('movie', 1101)],
    'tv:watched': [trakt('tv', 1201, 91201)],
    'movie:collected': [trakt('movie', 1301)],
    'tv:collected': [trakt('tv', 1401, 91401)],
    'movie:favorited': [trakt('movie', 1501)],
    'tv:favorited': [trakt('tv', 1601, 91601)],
    'movie:boxoffice': Array.from({ length: 10 }, (_, index) => trakt('movie', 1701 + index)),
  };
  const traktCalls = [];
  const traktGenreCalls = [];
  let traktHold;
  const traktFake = {
    list: async (request) => {
      traktCalls.push(request);
      if (traktHold !== undefined && request.type === 'movie' && request.kind === 'trending') return traktHold.promise;
      return { kind: 'ok', value: traktLists[`${request.type}:${request.kind}`] };
    },
    genres: async (type) => {
      traktGenreCalls.push(type);
      return { kind: 'ok', value: [{ name: 'Science Fiction', slug: 'science-fiction' }, { name: 'Drama', slug: 'drama' }] };
    },
  };

  const store = createTitleStore(database, { now });
  // A long fill cap, so no subtest but the one about the cap depends on the real timer.
  const discover = createDiscover({ tmdb, trakt: traktFake, store, database, now, fillTimeoutMs: 10_000 });
  database.prepare('INSERT INTO titles (service, id, title, year, detail, fingerprint, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('radarr', 7, 'Arrival', 2025, '{"tmdbId":101}', 'fp', 0);
  database.prepare('INSERT INTO titles (service, id, title, year, detail, fingerprint, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('sonarr', 9, 'Severance', 2024, '{"tmdbId":301}', 'fp', 0);
  const { app } = await makeApp({ clock, discover });
  let { session } = await signIn(app);
  // The sign-in lapses when the clock jumps days ahead, so those subtests sign in again.
  const signInAgain = async () => { ({ session } = await signIn(app)); };
  const get = async (path, target = app, cookie = session) => {
    const response = await target.request(path, { headers: { Cookie: cookie } });
    return { status: response.status, body: await response.json() };
  };
  const home = async (query = '') => {
    const response = await get(`/api/discover/home${query}`);
    assert.equal(JSON.stringify(response.body).includes(key), false);
    return response;
  };
  const ids = (row) => row.results.map((item) => item.tmdbId);
  const rowsOf = (body) => [
    body.trending.all, body.trending.movie, body.trending.tv, body.popularMovies, body.popularTv,
    body.upcomingMovies?.days30, body.upcomingMovies?.days90, body.upcomingTv, ...body.services, ...body.extraRows,
  ].filter((row) => row !== null && row !== undefined);
  const mark = () => ({ tmdb: tmdbCalls.length, trakt: traktCalls.length });
  const since = (at) => ({ tmdb: tmdbCalls.slice(at.tmdb), trakt: traktCalls.slice(at.trakt) });

  // Mounting the home outside the private guard, or letting an unchecked value reach TMDB or Trakt, turns this red.
  await t.test('the home refuses a signed-out caller and every invalid value before any upstream call', async () => {
    assert.equal((await app.request('/api/discover/home')).status, 401);
    for (const query of ['?type=person', '?services=a', '?providers=8|9']) {
      const response = await home(query);
      assert.equal(response.status, 400, query);
      assert.deepEqual(response.body, { error: 'invalid_request' });
    }
    assert.deepEqual(mark(), { tmdb: 0, trakt: 0 });
  });

  let first;
  // Dropping a row, reordering the extra rows, sending box office filters, calling a weekly list without its period, cutting an overview,
  // losing genre names, dates or library ids, or fetching one missing summary twice turns this red.
  await t.test('the default home carries every row filled, with full cards', async () => {
    const response = await home();
    assert.equal(response.status, 200);
    first = response.body;
    assert.deepEqual(Object.keys(first), ['trending', 'popularMovies', 'popularTv', 'upcomingMovies', 'upcomingTv', 'services', 'extraRows']);
    assert.deepEqual(Object.keys(first.trending), ['all', 'movie', 'tv']);
    assert.deepEqual(Object.keys(first.upcomingMovies), ['days30', 'days90']);
    assert.deepEqual(first.services, []);
    assert.deepEqual(first.extraRows.map(({ id, label }) => [id, label]), [
      ['most-anticipated', 'Most anticipated'], ['most-watched', 'Most watched'], ['most-collected', 'Most collected'],
      ['box-office', 'Weekend box office'], ['most-favorited', 'Most favorited'],
    ]);
    for (const row of rowsOf(first)) {
      assert.equal(row.pending, false);
      assert.ok(row.results.length > 0);
      for (const item of row.results) {
        const entry = catalogue.get(`${item.type}:${item.tmdbId}`);
        assert.equal(item.title, entry.title);
        assert.equal(item.date, dateOf(entry));
        assert.equal(item.overview, overviewOf(entry));
        assert.deepEqual(item.genres, entry.genres.filter((id) => item.type === 'movie' || id === 18).map((id) => genreNames[id]));
        assert.equal(item.posterUrl, `/api/images/tmdb/w342/p${item.tmdbId}.jpg`);
        assert.equal(item.libraryId, { 'movie:101': 7, 'tv:301': 9 }[`${item.type}:${item.tmdbId}`] ?? null);
      }
    }
    const boxOffice = first.extraRows.find((row) => row.id === 'box-office');
    assert.equal(boxOffice.results.length, 10);
    const boxCall = traktCalls.find((call) => call.kind === 'boxoffice');
    assert.deepEqual([boxCall.type, boxCall.kind, 'filters' in boxCall], ['movie', 'boxoffice', false]);
    assert.deepEqual(traktCalls.filter((call) => call.kind === 'watched').map((call) => [call.type, call.period]).sort(), [['movie', 'weekly'], ['tv', 'weekly']]);
    assert.equal(tmdbCalls.filter((call) => call.pathname === '/3/movie/201').length, 1);
    assert.equal(store.get({ type: 'movie', tmdbId: 201 }, 'tmdbSummary').value.title, 'Babel');
    assert.deepEqual(unexpected, []);
  });

  // Ranking by anything but the weighted reciprocal rank (Trakt 0.65, TMDB 0.35, K 10), listing a title twice,
  // or adding TMDB's mixed trending list back to the All tab turns this red.
  await t.test('trending blends Trakt and TMDB by weighted rank', async () => {
    // Arrival is second in both lists and Xanadu third in both; Babel is first on Trakt only; Yesterday is first on TMDB only.
    // Titles in both lists outrank both single-list leaders, and Trakt-only Babel outranks TMDB-only Yesterday at the same rank.
    assert.deepEqual(ids(first.trending.movie), [101, 103, 201, 102]);
    const all = ids(first.trending.all);
    assert.ok(all.indexOf(201) < all.indexOf(102), all.join());
  });

  // Asking TMDB or Trakt again for a row already saved turns this red.
  await t.test('the same request again is served from saved rows', async () => {
    const at = mark();
    assert.deepEqual((await home()).body, first);
    assert.deepEqual(mark(), at);
  });

  // Showing movie rows on the TV filter, or a movie in a TV row, turns this red.
  await t.test('the TV filter hides movie rows and keeps shows only', async () => {
    const { body } = await home('?type=tv');
    assert.deepEqual([body.popularMovies, body.upcomingMovies], [null, null]);
    assert.deepEqual(body.trending.movie, { results: [], pending: false, failed: false, failure: null });
    assert.equal(body.extraRows.some((row) => row.id === 'box-office'), false);
    const watched = body.extraRows.find((row) => row.id === 'most-watched');
    assert.ok(watched.results.length > 0);
    assert.ok(watched.results.every((item) => item.type === 'tv'));
  });

  // Not passing the filter bar to TMDB or Trakt, mapping a genre to the wrong Trakt slug, asking Trakt for its genres per row,
  // or keeping a Trakt title whose saved genres miss the filter turns this red.
  await t.test('the filter bar reaches TMDB, Trakt and the saved summaries', async () => {
    const at = mark();
    const { status, body } = await home('?genres=18&yearFrom=2020&minRating=6.5');
    assert.equal(status, 200);
    const { tmdb: tmdbSent, trakt: traktSent } = since(at);
    const discoverCalls = tmdbSent.filter((call) => call.pathname.startsWith('/3/discover/'));
    assert.ok(discoverCalls.length > 0);
    for (const call of discoverCalls) {
      const field = call.pathname.endsWith('/movie') ? 'primary_release_date' : 'first_air_date';
      assert.equal(call.searchParams.get('with_genres'), '18');
      assert.ok(call.searchParams.get(`${field}.gte`) >= '2020-01-01', call.href);
      assert.equal(call.searchParams.get('vote_average.gte'), '6.5');
    }
    assert.ok(traktSent.length > 0);
    for (const call of traktSent) {
      if (call.kind === 'boxoffice') assert.equal('filters' in call, false);
      else assert.deepEqual(call.filters, { genres: ['drama'], years: [2020, 2200], tmdbRatings: [6.5, 10] });
    }
    assert.equal(traktGenreCalls.filter((type) => type === 'movie').length, 1);
    assert.deepEqual(ids(body.trending.movie), [101, 103, 102]);
  });

  // Filtering Trakt titles out by streaming service, looking up a title twice, dropping a TMDB-only show unchecked,
  // or keeping a title not on the chosen service turns this red.
  await t.test('the services filter checks each title once and keeps Trakt-only titles on that service', async () => {
    const at = mark();
    const { body } = await home('?providers=8');
    const lookups = since(at).tmdb.filter((call) => call.pathname.endsWith('/watch/providers')).map((call) => call.pathname);
    assert.ok(lookups.length > 0 && lookups.length <= 40 * rowsOf(body).length);
    assert.equal(new Set(lookups).size, lookups.length, lookups.filter((path, index) => lookups.indexOf(path) !== index).join());
    assert.deepEqual(ids(body.trending.movie), [101, 201, 102]);
    assert.deepEqual(ids(body.trending.tv), [302]);
    assert.deepEqual(store.get({ type: 'movie', tmdbId: 201 }, 'tmdbProviders').value, { US: [8] });
    assert.deepEqual(store.get({ type: 'tv', tmdbId: 302 }, 'tmdbProviders').value, { US: [8] });
    const again = mark();
    await home('?providers=8');
    database.prepare('DELETE FROM discover_rows').run();
    await home('?providers=8');
    assert.equal(since(again).tmdb.some((call) => call.pathname.endsWith('/watch/providers')), false);
  });

  // Asking TMDB for a service row without flatrate, the region or the service id, naming it wrongly, or showing a service the providers filter excludes turns this red.
  await t.test('a chosen service gets its own row of streaming titles', async () => {
    const at = mark();
    const { body } = await home('?services=8');
    assert.equal(body.services.length, 1);
    const [service] = body.services;
    assert.deepEqual([service.providerId, service.name, service.pending, ids(service)], [8, 'Netflix', false, [401, 402]]);
    const serviceCalls = since(at).tmdb.filter((call) => call.searchParams.get('with_watch_monetization_types') === 'flatrate');
    assert.deepEqual(serviceCalls.map((call) => call.pathname).sort(), ['/3/discover/movie', '/3/discover/tv']);
    for (const call of serviceCalls) {
      assert.deepEqual(['with_watch_providers', 'watch_region', 'sort_by'].map((name) => call.searchParams.get(name)), ['8', 'US', 'popularity.desc']);
    }
    assert.deepEqual((await home('?services=8&providers=9')).body.services, []);
  });

  // Windowing upcoming titles on anything but today's date, ordering them by anything but date, or keeping a show dated past 90 days turns this red.
  await t.test('upcoming rows run from today and ascend by date', async () => {
    const days30 = tmdbCalls.find((call) => call.searchParams.get('primary_release_date.lte') === day(30));
    const days90 = tmdbCalls.find((call) => call.searchParams.get('primary_release_date.lte') === day(90));
    assert.equal(days30.searchParams.get('primary_release_date.gte'), day(0));
    assert.equal(days90.searchParams.get('primary_release_date.gte'), day(0));
    assert.deepEqual(ids(first.upcomingMovies.days30), [501, 502]);
    assert.deepEqual(ids(first.upcomingMovies.days90), [501, 502, 503]);
    assert.deepEqual(ids(first.upcomingTv), [701, 1001, 702, 1002]);
  });

  // Refreshing a row before its time, skipping a stale row someone reads, refreshing a row nobody reads, or never deleting an abandoned row turns this red.
  await t.test('the refresh job renews stale rows people read and deletes abandoned ones', async () => {
    clock.value += 30 * 60_000 + 1;
    let at = mark();
    await home();
    assert.deepEqual(mark(), at);
    at = mark();
    await discover.refresh();
    let sent = since(at);
    assert.ok(sent.tmdb.length > 0 && sent.tmdb.every((call) => call.pathname.startsWith('/3/trending/')), sent.tmdb.map((call) => call.pathname).join());
    assert.ok(sent.trakt.length > 0 && sent.trakt.every((call) => call.kind === 'trending'));
    clock.value += 6 * 60 * 60_000;
    at = mark();
    await discover.refresh();
    sent = since(at);
    assert.ok(sent.tmdb.some((call) => call.pathname === '/3/discover/movie'));
    assert.ok(sent.trakt.some((call) => call.kind === 'watched'));
    clock.value += 24 * 60 * 60_000 + 1;
    at = mark();
    await discover.refresh();
    assert.deepEqual(mark(), at);
    clock.value += 7 * 24 * 60 * 60_000;
    await discover.refresh();
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM discover_rows').get().count, 0);
  });

  // Waiting on a slow source past the cap, building one key twice at once, or never saving the late result turns this red.
  await t.test('a missing row waits only up to the cap, then fills in the background', async () => {
    await signInAgain();
    // Every other row is built first on the long cap, so only movie trending depends on the real timer.
    await home('?type=movie');
    discover.rows.remove(rowKey({ kind: 'row', recipe: 'trending', type: 'movie', filters: { genres: [], providers: [], region: 'US', yearFrom: null, yearTo: null, minRating: null } }));
    const capped = createDiscover({ tmdb, trakt: traktFake, store, database, now, fillTimeoutMs: 20 });
    const { app: cappedApp } = await makeApp({ clock, discover: capped });
    const { session: cappedSession } = await signIn(cappedApp);
    let release;
    traktHold = { promise: new Promise((resolve) => { release = resolve; }) };
    const before = traktCalls.filter((call) => call.type === 'movie' && call.kind === 'trending').length;
    const waiting = await get('/api/discover/home?type=movie', cappedApp, cappedSession); // real-time-ok: the fill cap is the behaviour under test
    assert.deepEqual(waiting.body.trending.movie, { results: [], pending: true, failed: false, failure: null });
    for (const row of [waiting.body.popularMovies, waiting.body.upcomingMovies.days30, waiting.body.upcomingMovies.days90, ...waiting.body.extraRows]) {
      assert.equal(row.pending, false);
      assert.ok(row.results.length > 0);
    }
    assert.deepEqual((await get('/api/discover/home?type=movie', cappedApp, cappedSession)).body.trending.movie, { results: [], pending: true, failed: false, failure: null });
    release({ kind: 'ok', value: traktLists['movie:trending'] });
    traktHold = undefined;
    await capped.idle();
    const filled = await get('/api/discover/home?type=movie', cappedApp, cappedSession);
    assert.equal(filled.body.trending.movie.pending, false);
    assert.deepEqual(ids(filled.body.trending.movie), [101, 103, 201, 102]);
    assert.equal(traktCalls.filter((call) => call.type === 'movie' && call.kind === 'trending').length - before, 1);
  });

  // Answering a missing TMDB key with anything but a readable 503, or replacing saved rows with a failed or partial refresh, turns this red.
  await t.test('a missing key is a readable error and a failing TMDB keeps the saved rows', async () => {
    clock.value += 8 * 24 * 60 * 60_000;
    await signInAgain();
    setSetting(database, 'credentials', 'tmdb.apiKey', '');
    database.prepare('DELETE FROM discover_rows').run();
    const unconfigured = await home();
    assert.equal(unconfigured.status, 503);
    assert.equal(unconfigured.body.error, 'not_configured');
    setSetting(database, 'credentials', 'tmdb.apiKey', key);
    await discover.idle();
    database.prepare('DELETE FROM discover_rows').run();
    await home();
    await discover.idle();
    const saved = (await home()).body;
    assert.ok(saved.upcomingMovies.days30.results.length > 0);
    tmdbDown = true;
    clock.value += 6 * 60 * 60_000 + 1;
    assert.deepEqual((await home()).body, saved);
    const at = mark();
    await discover.refresh();
    assert.ok(since(at).tmdb.length > 0);
    const after = (await home()).body;
    assert.deepEqual(after, saved);
    assert.ok(ids(after.trending.movie).includes(102));
    tmdbDown = false;
  });

  // Saving a row without genre names as fresh, or never rebuilding it once the genre list works, turns this red.
  await t.test('a row built while the genre list fails shows now and is rebuilt by the next refresh', async () => {
    clock.value += 25 * 60 * 60_000;
    await signInAgain();
    database.prepare('DELETE FROM discover_rows').run();
    genresDown = true;
    await home('?type=movie');
    await discover.idle();
    const stale = (await home('?type=movie')).body.popularMovies;
    assert.ok(stale.results.length > 0);
    assert.ok(stale.results.every((item) => item.genres.length === 0));
    genresDown = false;
    await discover.refresh();
    const fixed = (await home('?type=movie')).body.popularMovies;
    assert.ok(fixed.results.length > 0 && fixed.results.every((item) => item.genres.length > 0));
  });

  // Saving a service-filtered rebuild whose availability lookups failed, which empties the row, turns this red.
  await t.test('a refresh whose availability lookups fail keeps the saved service rows', async () => {
    await signInAgain();
    database.prepare('DELETE FROM discover_rows').run();
    const query = '?services=8&providers=8';
    await home(query);
    // Read again just before the lookups go stale, so the refresh renews these rows and has to ask TMDB.
    clock.value += 23 * 60 * 60_000;
    await signInAgain();
    const saved = (await home(query)).body;
    assert.ok(saved.services[0].results.length > 0);
    clock.value += 60 * 60_000 + 1;
    providersDown = true;
    const at = mark();
    await discover.refresh();
    assert.ok(since(at).tmdb.some((call) => call.pathname.endsWith('/watch/providers')));
    providersDown = false;
    assert.deepEqual((await home(query)).body, saved);
  });

  // Saving a Trakt list thinned by a failed summary as a complete row turns this red.
  await t.test('a refresh where one Trakt summary fails keeps the saved blended row', async () => {
    await signInAgain();
    database.prepare('DELETE FROM discover_rows').run();
    const saved = (await home()).body;
    assert.ok(ids(saved.trending.movie).includes(201));
    database.prepare("DELETE FROM title_store_parts WHERE key = 'movie:201' AND part = 'tmdbSummary'").run();
    failingSummary = '/movie/201';
    clock.value += 30 * 60_000 + 1;
    const at = mark();
    await discover.refresh();
    assert.ok(since(at).tmdb.some((call) => call.pathname === '/3/movie/201'));
    failingSummary = undefined;
    assert.deepEqual((await home()).body.trending, saved.trending);
  });

  // Counting a summary TMDB answers 404 for as a failed source, which leaves the row partial for good, turns this red.
  await t.test('a Trakt title TMDB no longer has is dropped and the row saves fresh', async () => {
    await signInAgain();
    database.prepare('DELETE FROM discover_rows').run();
    database.prepare("DELETE FROM title_store_parts WHERE key = 'movie:201' AND part = 'tmdbSummary'").run();
    const trendingKey = rowKey({ kind: 'row', recipe: 'trending', type: 'movie', filters: { genres: [], providers: [], region: 'US', yearFrom: null, yearTo: null, minRating: null } });
    missingSummary = '/movie/201';
    const without = (await home()).body;
    await discover.idle();
    assert.equal(ids(without.trending.movie).includes(201), false);
    assert.equal(database.prepare('SELECT fetched_at FROM discover_rows WHERE key = ?').get(trendingKey).fetched_at, clock.value);
    missingSummary = undefined;
    clock.value += 30 * 60_000 + 1;
    await discover.refresh();
    assert.equal(database.prepare('SELECT fetched_at FROM discover_rows WHERE key = ?').get(trendingKey).fetched_at, clock.value);
    assert.ok(ids((await home()).body.trending.movie).includes(201));
  });

  // Requiring Trakt for a TMDB row, failing the home when Trakt alone is missing, saving a Trakt-only row empty,
  // or answering anything but a readable 503 when neither service is set up turns this red.
  await t.test('without Trakt every row builds from TMDB alone', async () => {
    database.prepare('DELETE FROM discover_rows').run();
    const withoutTrakt = createDiscover({ tmdb, store, database, now, fillTimeoutMs: 10_000 });
    const { app: bare } = await makeApp({ clock, discover: withoutTrakt });
    const { session: bareSession } = await signIn(bare);
    const at = mark();
    const { status, body } = await get('/api/discover/home', bare, bareSession);
    assert.equal(status, 200);
    assert.deepEqual(ids(body.trending.movie), [102, 101, 103]);
    for (const row of body.extraRows) assert.deepEqual([row.results, row.pending], [[], false]);
    assert.equal(traktCalls.length, at.trakt);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM discover_rows WHERE key LIKE '%most-watched%'").get().count, 0);
    await withoutTrakt.idle();
    // Past the TMDB client's five-minute memory of lists, so every row has to ask TMDB.
    clock.value += 5 * 60_000 + 1;
    setSetting(database, 'credentials', 'tmdb.apiKey', '');
    database.prepare('DELETE FROM discover_rows').run();
    const unconfigured = await get('/api/discover/home', bare, bareSession);
    assert.deepEqual([unconfigured.status, unconfigured.body.error], [503, 'not_configured']);
    setSetting(database, 'credentials', 'tmdb.apiKey', key);
  });

  // Counting a Trakt list with no Client ID as a failed source (which freezes blended rows), or saving a Trakt-only row empty, turns this red.
  await t.test('Trakt without a Client ID leaves blended rows fresh and Trakt-only rows unsaved', async () => {
    const unset = { kind: 'not_configured', message: 'Trakt is not configured.' };
    const noClientId = createDiscover({ tmdb, trakt: { list: async () => unset, genres: async () => unset }, store, database, now, fillTimeoutMs: 10_000 });
    const { app: plain } = await makeApp({ clock, discover: noClientId });
    const { session: plainSession } = await signIn(plain);
    database.prepare('DELETE FROM discover_rows').run();
    const trendingKey = rowKey({ kind: 'row', recipe: 'trending', type: 'movie', filters: { genres: [], providers: [], region: 'US', yearFrom: null, yearTo: null, minRating: null } });
    const before = await get('/api/discover/home', plain, plainSession);
    assert.equal(before.status, 200);
    assert.deepEqual(ids(before.body.trending.movie), [102, 101, 103]);
    assert.equal(database.prepare('SELECT fetched_at FROM discover_rows WHERE key = ?').get(trendingKey).fetched_at, clock.value);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM discover_rows WHERE key LIKE '%most-watched%'").get().count, 0);
    trendingMovies = [103, 102];
    clock.value += 30 * 60_000 + 1;
    await noClientId.refresh();
    assert.deepEqual(ids((await get('/api/discover/home', plain, plainSession)).body.trending.movie), [103, 102]);
    trendingMovies = [102, 101, 103];
  });

  // Logging a fresh build for a row served from the saved rows, or logging the whole key or the TMDB key, turns this red.
  await t.test('home requests log each row as built, then as saved on the same request again', async (t) => {
    const lines = [];
    setLogSink((line) => lines.push(line));
    t.after(() => setLogSink(discardLog));
    const { app: timed } = await makeApp({ clock, discover });
    const { session: timedSession } = await signIn(timed);
    database.prepare('DELETE FROM discover_rows').run();
    const outcomes = () => lines.splice(0).map((line) => JSON.parse(line)).filter((line) => line.kind === 'discover');
    assert.equal((await get('/api/discover/home?type=movie', timed, timedSession)).status, 200);
    await discover.idle();
    const first = outcomes();
    assert.ok(first.some((line) => line.row === 'row:trending:movie' && line.outcome === 'built'));
    assert.equal((await get('/api/discover/home?type=movie', timed, timedSession)).status, 200);
    const second = outcomes();
    assert.deepEqual(second.map((line) => line.row).sort(), first.map((line) => line.row).sort());
    assert.ok(second.every((line) => line.outcome === 'saved'));
    assert.equal(JSON.stringify([...first, ...second]).includes(key), false);
  });
});

test('second-version rows and hit and run advice word themselves from the structured fields', async (t) => {
  // The client modules are bundled by Vite, not compiled to dist, so they are loaded from source with Node's type stripping.
  const { stripTypeScriptTypes } = await import('node:module');
  const load = async (path) => import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8')))}`);
  const { versionSeedingText, timeLeftText, keepChoiceText, removeChoiceText, downloadsAdviceText } = await load('../src/client/title/secondVersionText.ts');
  const seeding = { inRtorrent: true, complete: true, ratio: 0.41, seedingSeconds: 41 * 3600, upRate: 0, trackerHost: 'privatehd.to' };
  const rule = (overrides = {}) => ({ host: 'privatehd.to', requiredHours: 72, seededHours: 41.6, ratio: 0.41, requiredRatio: 0.9, met: false, ...overrides });
  const advice = (overrides = {}) => ({ recommendation: 'keep', reason: 'Keep seeding: 39 hours of seeding left', globalRatio: null, host: 'privatehd.to',
    requiredHours: 79.2, seededHours: 41.6, hoursLeft: 37.6, detail: '39 hours of seeding left', ...overrides });

  // Rounding seeded hours up, or dropping the fallback when no rule applies, turns this red.
  await t.test('the Seeding column shows rule progress, rule met, or the plain seeding text', () => {
    assert.equal(versionSeedingText({ seeding, hitAndRun: rule() }), 'seeding 41 h of 72 h');
    assert.equal(versionSeedingText({ seeding, hitAndRun: rule({ seededHours: 1950.2, met: true }) }), 'seeding 1,950 h · rule met');
    assert.equal(versionSeedingText({ seeding, hitAndRun: null }), 'seeding 41 h · ratio 0.41');
    assert.equal(versionSeedingText({ seeding, hitAndRun: rule({ requiredHours: null }) }), 'seeding 41 h · ratio 0.41');
    assert.equal(versionSeedingText({ seeding: null, hitAndRun: null }), '');
  });

  await t.test('time left reads in minutes, hours or days', () => {
    assert.equal(timeLeftText(330), '6 min left');
    assert.equal(timeLeftText(5), '1 min left');
    assert.equal(timeLeftText(5 * 3600 + 1), '6 h left');
    assert.equal(timeLeftText(3 * 86400), '3 days left');
    assert.equal(timeLeftText(null), '');
  });

  // Matching on the reason's text instead of the fields, or showing the margin as the tracker's ask, turns this red.
  await t.test('the delete dialog choices use the tracker, hours and detail', () => {
    assert.equal(keepChoiceText(advice(), 'PrivateHD', 72), 'Recommended: PrivateHD asks 72 h, seeded 41 h');
    assert.equal(keepChoiceText(advice(), 'PrivateHD', null), 'Recommended: PrivateHD asks 80 h, seeded 41 h');
    assert.equal(keepChoiceText(advice({ hoursLeft: null, seededHours: null, detail: 'no hit and run rule for x.example' }), 'x.example', null),
      'Recommended: No hit and run rule for x.example');
    assert.equal(keepChoiceText(advice({ recommendation: 'safe', hoursLeft: 0 }), 'PrivateHD', 72), 'The torrent keeps seeding in rTorrent');
    assert.equal(removeChoiceText(advice(), 'PrivateHD'), 'Breaks the PrivateHD rule');
    assert.equal(removeChoiceText(advice({ hoursLeft: 0, globalRatio: 'Keep for ratio: your privatehd.to ratio is 0.90, minimum 1' }), 'PrivateHD'),
      'Keep for ratio: your privatehd.to ratio is 0.90, minimum 1.');
    assert.equal(removeChoiceText(advice({ recommendation: 'safe', hoursLeft: 0, detail: 'seeded 168 hours of 80 hours needed with margin' }), 'PrivateHD'),
      'Recommended: PrivateHD rule met, seeded 168 hours of 80 hours needed with margin');
    assert.equal(removeChoiceText(advice({ recommendation: 'unconfirmed' }), 'PrivateHD'), "The hit and run rule can't be confirmed.");
  });

  await t.test('the Downloads advice line names the hours left or falls back to the detail', () => {
    assert.equal(downloadsAdviceText(advice(), 'PrivateHD'), 'PrivateHD needs 38 more hours to avoid a hit and run');
    assert.equal(downloadsAdviceText(advice({ hoursLeft: 0.5 }), 'PrivateHD'), 'PrivateHD needs 1 more hour to avoid a hit and run');
    assert.equal(downloadsAdviceText(advice({ recommendation: 'safe', hoursLeft: 0, detail: 'seeded 168 hours of 80 hours needed with margin', globalRatio: 'Global ratio unknown' }), 'PrivateHD'),
      'Seeded 168 hours of 80 hours needed with margin. Global ratio unknown');
  });
});

test('the movie, show and season delete dialog words its rows, builds its request and reads the steps back', async (t) => {
  const { stripTypeScriptTypes } = await import('node:module');
  const load = async (path) => import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8')))}`);
  const text = await load('../src/client/title/secondVersionText.ts');
  const movie = { kind: 'movie', id: 1 };
  const show = { kind: 'series', id: 7 };
  const season = { kind: 'season', seriesId: 7, seasonNumber: 1 };
  const advice = (overrides = {}) => ({ recommendation: 'keep', reason: 'Keep seeding: 38 hours left', globalRatio: null, host: 'privatehd.to',
    requiredHours: 79.2, seededHours: 41.6, hoursLeft: 37.6, detail: '38 hours left', ...overrides });
  const safe = advice({ recommendation: 'safe', seededHours: 1180.4, hoursLeft: 0 });
  const torrent = (hash, overrides = {}) => ({ hash, name: `Torrent.${hash[0]}`, sizeBytes: 4e9, upgradedAway: false, label: null,
    libraryPaths: ['/tv/Severance/Season 01/Severance.S01E05.mkv'], advice: advice(), removal: { allowed: true }, ticked: false, ...overrides });
  const version = (id, hash, overrides = {}) => ({ id, quality: '1080p WEB-DL', releaseTitle: `Release.${id}`, sizeBytes: 1e9, episodeId: id, hitAndRun: null,
    ticked: true, torrent: hash === null ? null : { hash, advice: advice(), removal: { allowed: true } }, ...overrides });
  const plan = (overrides = {}) => ({ service: 'sonarr', id: 7, title: 'Severance', recycleBin: null, files: [], torrents: [], secondVersions: [], ...overrides });
  const gb = (bytes) => `${(bytes / 1e9).toFixed(1)} GB`;

  // Showing the advice's margin as the tracker's ask, or numbers for an unconfirmed torrent, turns this red.
  await t.test('advice lines name seeded hours against the ask, or fall back to the detail', () => {
    assert.deepEqual(text.adviceLine(advice(), 'PrivateHD', 72), { verdict: 'Keep seeding', reason: 'seeded 41 h of 72 h; 38 h left' });
    assert.equal(text.adviceLine(safe, 'PrivateHD', 72).reason, 'seeded 1,180 h; PrivateHD asks 72 h');
    assert.equal(text.adviceLine(safe, 'PrivateHD').reason, 'seeded 1,180 h; PrivateHD asks 80 h');
    assert.deepEqual(text.adviceLine(advice({ recommendation: 'unconfirmed', detail: 'first seen after it finished' }), 'PrivateHD'),
      { verdict: "Can't confirm yet", reason: 'first seen after it finished' });
  });

  // Reading episode codes from the folder instead of the file name, or dropping the season for a season delete, turns this red.
  await t.test('torrent rows say what they hold', () => {
    assert.equal(text.torrentHoldsText(show, torrent('A')), 'Holds S01E05');
    assert.equal(text.torrentHoldsText(season, torrent('A')), 'Holds E05');
    assert.equal(text.torrentHoldsText(season, torrent('A', { libraryPaths: ['/x/Show.S01E02.mkv', '/x/Show.S01E01.mkv'] })), 'Season pack · holds E01, E02');
    assert.equal(text.torrentHoldsText(show, torrent('A', { libraryPaths: ['/x/Show.S01E02.mkv', '/x/Show.S02E01.mkv'] })), 'Holds S01E02, S02E01');
    assert.equal(text.torrentHoldsText(movie, torrent('A', { libraryPaths: ['/m/Dune Part Two (2024).mkv'] })), 'Holds the library file');
    assert.equal(text.torrentHoldsText(movie, torrent('A', { upgradedAway: true, libraryPaths: [] })), 'Upgraded away; backs no library file');
  });

  // Asking one pack member to remove the shared torrent but not the others, sending a removal the server forbids, or a mode for a show turns this red.
  await t.test('the request keeps every torrent unless chosen and asks about a pack once', () => {
    const shared = plan({ secondVersions: [version(1, 'P'), version(2, 'P'), version(3, null), version(4, 'Q', { torrent: { hash: 'Q', advice: advice(), removal: { allowed: false, reason: 'held' } } })] });
    const groups = text.versionGroups(shared);
    assert.deepEqual(groups.map((group) => group.rows.map((row) => row.id)), [[1, 2], [3], [4]]);
    assert.deepEqual(text.deleteChoices(show, 'remove', new Set(), groups, new Map()),
      { removeTorrents: [], secondVersions: [1, 2, 3, 4].map((id) => ({ id, removeTorrent: false })) });
    const picks = new Map([['P', { ticked: true, remove: true }], ['version:3', { ticked: false, remove: false }], ['Q', { ticked: true, remove: true }]]);
    const choices = text.deleteChoices(movie, 'keepUnmonitored', new Set(['A']), groups, picks);
    assert.deepEqual(choices, { mode: 'keepUnmonitored', removeTorrents: ['A'], secondVersions: [
      { id: 1, removeTorrent: true }, { id: 2, removeTorrent: true }, { id: 4, removeTorrent: false }] });
    assert.equal(text.deleteActionText(movie, 'keepUnmonitored', choices, groups), 'Delete file and 2 torrents');
    assert.equal(text.deleteActionText(show, 'remove', text.deleteChoices(show, 'remove', new Set(), groups, new Map()), groups), 'Delete show, keep seeding');
    assert.equal(text.versionHoldsText(show, groups[0], (id) => `S01E0${id}`), 'Season pack · second versions of S01E01 to S01E02');
    assert.equal(text.versionHoldsText(season, groups[1], (id) => `S01E0${id}`), 'Second version of E03');
    assert.equal(text.versionHoldsText(movie, groups[1], () => null), 'Second version · 1080p WEB-DL');
  });

  // Counting second versions as library files, or leaving the movie mode out of the line, turns this red.
  await t.test('the line under the title says what goes and how big it is', () => {
    const movieOne = plan({ service: 'radarr', title: 'Dune: Part Two (2024)', files: [{ sizeBytes: 9.6e9 }], secondVersions: [version(1, 'P', { sizeBytes: 4.4e9 })] });
    assert.equal(text.deleteSubjectText(movie, movieOne, 'remove', gb),
      'Removes the movie from Radarr and deletes its library file, 9.6 GB, and its 1080p second version, 4.4 GB. Torrents keep seeding unless you choose otherwise.');
    assert.equal(text.deleteSubjectText(movie, plan({ service: 'radarr' }), 'keepUnmonitored', gb),
      'Keeps the movie in Radarr, unmonitored. Torrents keep seeding unless you choose otherwise.');
    assert.equal(text.deleteSubjectText(season, plan({ files: [{ sizeBytes: 1e9 }, { sizeBytes: 2e9 }] }), 'remove', gb),
      'Deletes 2 library files, 3.0 GB. Each torrent is asked about once. Torrents keep seeding unless you choose otherwise.');
    assert.equal(text.deleteTitleText(season, plan()), 'Delete Season 1 of Severance?');
    assert.equal(text.deleteTitleText(show, plan()), 'Delete Severance from Sonarr?');
  });

  // Dropping kept torrents, unlinked files or a pack's outcome from the results, or hiding the files still there, turns this red.
  await t.test('the results list every step and every torrent outcome', () => {
    const shown = plan({
      files: [{ fileId: 1, path: '/tv/S01E09.mkv', sizeBytes: 1, state: 'none', hashes: [], note: 'unlinked', reason: null }],
      torrents: [torrent('A'), torrent('B', { name: 'Kept.One', advice: advice({ host: 'beyond-hd.me' }) }), torrent('C', { name: 'Held', removal: { allowed: false, reason: 'Another torrent uses the same files' } })],
      secondVersions: [version(1, 'P'), version(2, 'P'), version(3, 'R')],
    });
    const choices = { removeTorrents: ['A'], secondVersions: [{ id: 1, removeTorrent: true }, { id: 2, removeTorrent: true }, { id: 3, removeTorrent: false }] };
    const ran = { deleted: true, steps: [
      { step: 'map', outcome: 'done', message: 'Checked which torrents hold 1 file.' },
      { step: 'delete', outcome: 'done', message: 'Removed from Sonarr with its files.' },
      { step: 'wait', outcome: 'done', message: 'Sonarr deleted 1 library file.' },
      { step: 'torrents', outcome: 'failed', message: '0 torrents removed, 3 kept seeding.', torrents: [{ hash: 'A', name: 'Torrent.A', removed: false, reason: "rTorrent didn't answer." }] },
      { step: 'secondVersions', outcome: 'done', message: '3 second versions deleted, 0 kept.', secondVersions: [
        { id: 1, deleted: true, torrentRemoved: true, reason: null }, { id: 2, deleted: true, torrentRemoved: true, reason: null }, { id: 3, deleted: true, torrentRemoved: false, reason: null }] },
      { step: 'history', outcome: 'done', message: 'Written to History under Deletions.' },
    ] };
    const tracker = (host) => (host === 'beyond-hd.me' ? 'Beyond-HD' : 'PrivateHD');
    assert.deepEqual(text.deleteResultRows(shown, choices, ran, tracker).map((row) => [row.look, row.text, row.why]), [
      ['done', 'Removed from Sonarr with its files.', null],
      ['done', 'Sonarr deleted 1 library file.', null],
      ['failed', "Couldn't remove Torrent.A", "rTorrent didn't answer."],
      ['kept', 'Kept Kept.One seeding', 'You chose to keep it. Beyond-HD needs 38 more hours.'],
      ['kept', 'Kept Held seeding', 'Another torrent uses the same files'],
      ['kept', 'Left the torrent for S01E09.mkv alone', "The file couldn't be linked to a torrent."],
      ['done', '3 second versions deleted, 0 kept.', null],
      ['done', 'Removed Release.1 and its data', 'Torrent of the 2 second versions. You chose to remove it.'],
      ['kept', 'Kept Release.3 seeding', 'You chose to keep it. PrivateHD needs 38 more hours.'],
      ['done', 'Written to History under Deletions.', null],
    ]);
    const stillThere = { deleted: true, steps: [{ step: 'wait', outcome: 'failed', message: 'Sonarr still had 1 library file after 2 minutes, so every torrent was kept. Still there: /tv/a.mkv' }] };
    assert.deepEqual(text.deleteResultRows(shown, choices, stillThere, tracker),
      [{ look: 'failed', text: 'Sonarr still had 1 library file after 2 minutes, so every torrent was kept.', why: 'Still there: /tv/a.mkv' }]);
    const refused = { deleted: false, steps: [{ step: 'map', outcome: 'done', message: 'x' }, { step: 'delete', outcome: 'failed', message: 'Sonarr refused the delete.' }] };
    assert.deepEqual(text.deleteResultRows(shown, choices, refused, tracker), [{ look: 'failed', text: 'Sonarr refused the delete.', why: null }]);
    assert.equal(text.deleteResultTitle(season, shown, true), 'Season 1 of Severance deleted');
    assert.equal(text.deleteResultTitle(show, shown, false), 'Severance was not deleted');
  });

  const selection = { kind: 'selection', seriesId: 7, seasons: [2], episodeIds: [101] };
  const download = (downloadId, overrides = {}) => ({ downloadId, title: `Download.${downloadId}`, progress: 0.42, status: 'downloading', episodeIds: [208],
    removable: { allowed: true }, advice: null, ...overrides });
  const intent = (planned, overrides = {}) => ({ plan: planned, excludeFromImportLists: true, blocklistCurrent: true, keepFollowing: new Map(), queue: new Map(), ...overrides });

  // Sending the new keys to a server whose plan has no modes (it rejects them), sending an exclusion or blocklist outside its mode, asking to remove
  // a download the server locked, or dropping a selection's seasons and episodes turns this red.
  await t.test('the request carries the intent only once the plan has modes, and never asks for what the plan forbids', () => {
    const older = plan({ service: 'radarr' });
    assert.deepEqual(text.deleteChoices(movie, 'remove', new Set(), [], new Map(), intent(older)), { mode: 'remove', removeTorrents: [], secondVersions: [] });
    assert.deepEqual(text.deleteChoices(show, 'remove', new Set(), [], new Map(), intent(plan())), { removeTorrents: [], secondVersions: [] });

    const current = plan({
      modes: ['keepUnmonitored', 'searchAgain'],
      importLists: true,
      monitoring: { followsNewSeasons: false, airingSeasons: [2, 3], leavesShowEmpty: false },
      queue: [download('D1'), download('D2', { removable: { allowed: false, reason: 'held' } })],
      secondVersions: [version(1, 'P')],
    });
    const groups = text.versionGroups(current);
    const answers = intent(current, { keepFollowing: new Map([[2, true]]), queue: new Map([['D1', 'removeWithTorrent'], ['D2', 'remove']]) });
    assert.deepEqual(text.deleteChoices(selection, 'keepUnmonitored', new Set(), groups, new Map(), answers), {
      mode: 'keepUnmonitored',
      excludeFromImportLists: false,
      blocklistCurrent: false,
      keepFollowing: { 2: true },
      queue: [{ downloadId: 'D1', action: 'removeWithTorrent' }, { downloadId: 'D2', action: 'leave' }],
      removeTorrents: [],
      secondVersions: [{ id: 1, removeTorrent: false }],
      seasons: [2],
      episodeIds: [101],
    });

    // Search again leaves downloads (one may be the replacement) and starts with second versions unticked.
    const again = text.deleteChoices(selection, 'searchAgain', new Set(), groups, new Map(), intent(current));
    assert.deepEqual([again.blocklistCurrent, again.excludeFromImportLists, again.queue, again.secondVersions],
      [true, false, [{ downloadId: 'D1', action: 'leave' }, { downloadId: 'D2', action: 'leave' }], []]);

    const removing = text.deleteChoices(show, 'remove', new Set(), [], new Map(), intent({ ...current, modes: ['remove', 'keepUnmonitored', 'searchAgain'] }));
    assert.deepEqual([removing.excludeFromImportLists, removing.blocklistCurrent, removing.queue.map((row) => row.action), 'seasons' in removing], [true, false, ['remove', 'leave'], false]);
    assert.equal(text.deleteChoices(show, 'remove', new Set(), [], new Map(), intent({ ...current, importLists: false })).excludeFromImportLists, false);
  });

  // Letting the delete through with an airing season unanswered, or holding it for a season that isn't airing, turns this red.
  await t.test('the delete waits for an answer on every airing season', () => {
    const airing = plan({ monitoring: { followsNewSeasons: false, airingSeasons: [2, 3], leavesShowEmpty: false } });
    assert.equal(text.followingUnanswered(airing, new Map([[2, true]])), true);
    assert.equal(text.followingUnanswered(airing, new Map([[2, true], [3, false]])), false);
    assert.equal(text.followingUnanswered(plan(), new Map()), false);
  });

  // Showing an unmonitored show's seasons as followed, naming season 0 as a season, or a missing new-seasons setting as "not followed" turns this red.
  await t.test('the monitoring block says what Sonarr or Radarr will do next', () => {
    assert.deepEqual(text.monitoringLines({ kind: 'movie', monitored: false }), ['Movie not monitored']);
    assert.deepEqual(text.monitoringLines({ kind: 'series', monitored: false, monitorNewItems: 'all', seasons: [{ seasonNumber: 1, monitored: true, monitoredEpisodes: 3, episodes: 8 }] }),
      ['Show not monitored']);
    assert.deepEqual(text.monitoringLines({ kind: 'series', monitored: true, monitorNewItems: 'none', seasons: [
      { seasonNumber: 2, monitored: true, monitoredEpisodes: 1, episodes: 1 },
      { seasonNumber: 0, monitored: false, monitoredEpisodes: 0, episodes: 4 },
      { seasonNumber: 1, monitored: false, monitoredEpisodes: 0, episodes: 8 },
    ] }), ['Specials not monitored', 'Season 1 not monitored', 'Season 2 monitored · 1 of 1 episode', 'New seasons not followed']);
    assert.deepEqual(text.monitoringLines({ kind: 'series', monitored: true, monitorNewItems: null, seasons: [] }), []);
  });

  // Rounding progress up, repeating a pack's episodes, or listing every episode of a long pack turns this red.
  await t.test('download rows say how far they are and what they hold', () => {
    const codeOf = (id) => `S02E${String(id - 200).padStart(2, '0')}`;
    assert.equal(text.downloadHoldsText(download('D1', { progress: 0.429 }), codeOf), 'Downloading 42% · for S02E08');
    assert.equal(text.downloadHoldsText(download('D1', { episodeIds: [209, 201, 209] }), codeOf), 'Downloading 42% · for S02E01, S02E09');
    assert.equal(text.downloadHoldsText(download('D1', { episodeIds: [201, 202, 203, 204, 205, 206, 207, 208] }), codeOf),
      'Downloading 42% · for S02E01, S02E02, S02E03, S02E04, S02E05, S02E06 and 2 more');
    assert.equal(text.downloadHoldsText(download('D1', { status: 'queued', progress: 0, episodeIds: [] }), () => null), 'Queued 0%');
  });

  // Dropping a download that was left, hiding why a removal failed, or saying a torrent left rTorrent when it stayed turns this red.
  await t.test('the results list every download, removed, failed or left', () => {
    const queued = plan({ queue: [download('D1'), download('D2'), download('D3'), download('D4', { removable: { allowed: false, reason: 'Also holds episodes this delete keeps.' } })] });
    const ran = { deleted: true, steps: [{ step: 'queue', outcome: 'failed', message: 'x', queue: [
      { downloadId: 'D1', title: 'Download.D1', removed: true, torrentRemoved: true, reason: null },
      { downloadId: 'D2', title: 'Download.D2', removed: true, torrentRemoved: false, reason: null },
    ] }, { step: 'monitoring', outcome: 'done', message: 'read back', monitoring: { kind: 'movie', monitored: false } }] };
    assert.deepEqual(text.deleteResultRows(queued, { removeTorrents: [], secondVersions: [] }, ran, () => 'PrivateHD').map((row) => [row.look, row.text, row.why]), [
      ['done', 'Removed Download.D1 from the queue', 'You chose to remove it with its torrent.'],
      ['done', 'Removed Download.D2 from the queue', 'You chose to remove it. Its torrent stays in rTorrent.'],
      ['kept', 'Left Download.D3 downloading', 'You chose to leave it.'],
      ['kept', 'Left Download.D4 downloading', 'Also holds episodes this delete keeps.'],
    ]);
    const stuck = { deleted: false, steps: [{ step: 'queue', outcome: 'failed', message: 'x', queue: [{ downloadId: 'D1', title: 'Download.D1', removed: false, torrentRemoved: false, reason: 'Radarr refused.' }] }] };
    assert.deepEqual(text.deleteResultRows(plan({ queue: [download('D1')] }), { removeTorrents: [], secondVersions: [] }, stuck, () => '')[0],
      { look: 'failed', text: "Couldn't remove Download.D1 from the queue", why: 'Radarr refused.' });
  });
});

test('the added toast words the search from the sentence fact', async () => {
  // Changing the toast wording for any search fact, or dropping the number the toast highlights, turns this red.
  const { stripTypeScriptTypes } = await import('node:module');
  const load = async (path) => import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8')))}`);
  const { addedToast } = await load('../src/client/title/addText.ts');
  const cases = [
    ['Sonarr', { kind: 'aired', count: 18 }, 'Sonarr is searching 18 aired episodes.', '18'],
    ['Sonarr', { kind: 'aired', count: 1 }, 'Sonarr is searching 1 aired episode.', '1'],
    ['Sonarr', { kind: 'nothingAired', firstAirDate: '2027-01-05' }, 'Sonarr will search once episodes air.', null],
    ['Sonarr', { kind: 'future', nextAirDate: null }, 'Sonarr will search once episodes air.', null],
    ['Sonarr', { kind: 'none' }, 'Nothing is monitored.', null],
    ['Sonarr', { kind: 'unknown' }, 'Sonarr is searching for the monitored episodes that have aired.', null],
    ['Radarr', { kind: 'now' }, 'Radarr is searching now.', null],
    ['Radarr', { kind: 'expected', availability: 'available', date: '2027-03-26' }, "Radarr will search once it's available, expected on 26 Mar 2027.", '26 Mar 2027'],
    ['Radarr', { kind: 'expected', availability: 'in cinemas', date: null }, "Radarr will search once it's in cinemas.", null],
    ['Radarr', { kind: 'collection', movies: 3, allReleased: false, availability: 'available' }, 'Radarr is searching up to 3 movies.', '3'],
    ['Radarr', { kind: 'collection', movies: null, allReleased: false, availability: 'available' }, "Radarr is searching the collection's movies.", null],
  ];
  assert.equal(addedToast('Sonarr', 'Dune', { kind: 'none' }).title, 'Added Dune to your library');
  for (const [service, fact, line, number] of cases) {
    const toast = addedToast(service, 'Dune', fact);
    assert.equal(`${toast.before}${toast.number ?? ''}${toast.after}`, line, fact.kind);
    assert.equal(toast.number, number, fact.kind);
  }
});

test('the add sentence picks the search fact from the choices and the title', async () => {
  // Changing which fact searchFact returns for a monitor choice, aired count or movie status turns this red.
  const { stripTypeScriptTypes } = await import('node:module');
  const load = async (path) => import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8')))}`);
  const { searchFact } = await load('../src/client/title/addText.ts');
  const nextAirDate = '2099-01-05';
  const show = (seasons) => ({ tv: true, airing: { seasons, nextAirDate }, collection: undefined, movie: null });
  const aired18 = show([{ seasonNumber: 0, aired: 2 }, { seasonNumber: 1, aired: 10 }, { seasonNumber: 2, aired: 8 }]);
  const newSeason = show([{ seasonNumber: 1, aired: 0 }, { seasonNumber: 2, aired: 0 }]);
  const movie = (status, digital = null) => ({ tv: false, airing: undefined, collection: { films: 3, allReleased: false }, movie: { status, releaseDates: { inCinemas: null, digital, physical: null } } });
  const tv = (monitor, seasons = []) => ({ monitor, seasons, minimumAvailability: 'released' });
  const film = (monitor, minimumAvailability) => ({ monitor, seasons: [], minimumAvailability });
  const cases = [
    [tv('all'), aired18, { kind: 'aired', count: 18 }],
    [tv('all'), newSeason, { kind: 'nothingAired', firstAirDate: nextAirDate }],
    [tv('lastSeason'), newSeason, { kind: 'future', nextAirDate }],
    [tv('skip'), aired18, { kind: 'unknown' }],
    [tv('skip', [1, 2]), aired18, { kind: 'aired', count: 18 }],
    [tv('future'), aired18, { kind: 'future', nextAirDate }],
    [tv('none'), aired18, { kind: 'none' }],
    [film('movieOnly', 'released'), movie('released'), { kind: 'now' }],
    [film('movieOnly', 'inCinemas'), movie('inCinemas'), { kind: 'now' }],
    [film('movieOnly', 'released'), movie('announced', '2099-03-26'), { kind: 'expected', availability: 'available', date: '2099-03-26' }],
    [film('movieAndCollection', 'released'), movie('released'), { kind: 'collection', movies: 3, allReleased: false, availability: 'available' }],
  ];
  for (const [choices, title, fact] of cases) assert.deepEqual(searchFact(choices, title), fact, `${choices.monitor} ${JSON.stringify(title.movie?.status ?? title.airing?.seasons)}`);
});
