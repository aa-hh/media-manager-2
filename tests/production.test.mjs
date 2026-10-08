import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
const settingsModuleUrl = new URL('../dist/server/settings.js', import.meta.url).href;
const projectDirectory = fileURLToPath(new URL('../', import.meta.url));

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
});

// Removing initialization or deriving the default from the working directory loses durable storage.
test('database initialization is repeatable and its default path is stable', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'media-manager-2-database-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const explicitPath = join(root, 'explicit', 'media-manager.sqlite');
  const { openDatabase } = await import(databaseModuleUrl);

  const first = openDatabase(explicitPath);
  assert.equal(readUserVersion(first), 1);
  first.close();
  const second = openDatabase(explicitPath);
  assert.equal(readUserVersion(second), 1);
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
  migrateDatabase(database, ['SELECT 1;', 'CREATE TABLE later_record (id INTEGER PRIMARY KEY);']);
  assert.equal(readUserVersion(database), 2);
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
  assert.throws(
    () => migrateDatabase(database, [
      'SELECT 1;',
      "UPDATE settings SET value = 'changed'; CREATE TABLE partial_record (id INTEGER); INSERT INTO missing_table VALUES (1);",
    ]),
    { message: 'Database migration failed.' },
  );
  database.close();

  const reopened = openDatabase(databasePath);
  assert.equal(readUserVersion(reopened), 1);
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
  initialized.close();
  const lock = new DatabaseSync(lockedPath);
  lock.exec('BEGIN IMMEDIATE;');
  assert.throws(() => openDatabase(lockedPath), { message: 'Database migration failed.' });
  lock.exec('ROLLBACK;');
  lock.close();
  const afterRelease = openDatabase(lockedPath);
  assert.equal(readUserVersion(afterRelease), 1);
  afterRelease.close();
});

// Weak, relative, in-memory, symlinked, and application-owned locations must be rejected without changing permissions.
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
