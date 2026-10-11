import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const applicationDirectory = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const databasePathMessage = 'Database path must be an absolute file path outside the application directory.';
const directoryMessage = 'Database directory must be private and owned by the current user.';
const fileMessage = 'Database file must be a private regular file owned by the current user.';

const applicationMigrations = [
  `CREATE TABLE settings (
    category TEXT NOT NULL CHECK (category IN ('hostPaths', 'serviceAddresses', 'trackerConfiguration', 'credentials')),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (category, key)
  ) STRICT;`,
  `CREATE TABLE torrents (
    hash TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    completed_bytes INTEGER NOT NULL,
    down_rate INTEGER NOT NULL,
    up_rate INTEGER NOT NULL,
    started INTEGER NOT NULL CHECK (started IN (0, 1)),
    open INTEGER NOT NULL CHECK (open IN (0, 1)),
    active INTEGER NOT NULL CHECK (active IN (0, 1)),
    complete INTEGER NOT NULL CHECK (complete IN (0, 1)),
    message TEXT NOT NULL,
    finished_at INTEGER NOT NULL,
    ratio_thousandths INTEGER NOT NULL,
    peers_connected INTEGER NOT NULL,
    seeders_connected INTEGER NOT NULL,
    tracker_host TEXT,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    gone_at INTEGER,
    seeding_seconds INTEGER NOT NULL CHECK (seeding_seconds >= 0)
  ) STRICT;
  CREATE TABLE dependency_status (
    name TEXT PRIMARY KEY,
    state TEXT NOT NULL CHECK (state IN ('ok', 'down')),
    since INTEGER NOT NULL,
    detail TEXT NOT NULL
  ) STRICT;`,
  `CREATE TABLE torrent_grabs (
    hash TEXT PRIMARY KEY,
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    movie_id INTEGER,
    series_id INTEGER,
    episode_ids TEXT NOT NULL,
    release_title TEXT NOT NULL,
    indexer TEXT NOT NULL,
    grabbed_at INTEGER NOT NULL,
    by_hand INTEGER NOT NULL CHECK (by_hand IN (0, 1)),
    imported_at INTEGER,
    failed_at INTEGER
  ) STRICT;
  CREATE TABLE arr_queue (
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    queue_id INTEGER NOT NULL,
    download_id TEXT,
    movie_id INTEGER,
    series_id INTEGER,
    episode_id INTEGER,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    tracked_status TEXT NOT NULL,
    tracked_state TEXT NOT NULL,
    status_messages TEXT NOT NULL,
    error_message TEXT NOT NULL,
    indexer TEXT NOT NULL,
    protocol TEXT NOT NULL,
    quality TEXT NOT NULL,
    formats TEXT NOT NULL,
    format_score INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    size_left_bytes INTEGER NOT NULL,
    estimated_completion TEXT,
    added TEXT,
    PRIMARY KEY (service, queue_id)
  ) STRICT;
  CREATE TABLE grab_checkpoints (
    service TEXT PRIMARY KEY CHECK (service IN ('sonarr', 'radarr')),
    history_checked_at INTEGER NOT NULL
  ) STRICT;`,
  `CREATE TABLE problems (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    subject_type TEXT NOT NULL CHECK (subject_type IN ('movie', 'episode', 'torrent', 'tracker', 'dependency')),
    service TEXT NOT NULL CHECK (service IN ('', 'sonarr', 'radarr')),
    subject_id TEXT NOT NULL,
    hash TEXT,
    state TEXT NOT NULL CHECK (state IN ('handling', 'needs_you', 'resolved')),
    summary TEXT NOT NULL,
    opened_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    resolved_at INTEGER
  ) STRICT;
  CREATE UNIQUE INDEX problems_one_open ON problems (kind, subject_type, service, subject_id) WHERE state != 'resolved';
  CREATE INDEX problems_subject ON problems (subject_type, service, subject_id);
  CREATE TABLE problem_steps (
    id INTEGER PRIMARY KEY,
    problem_id INTEGER NOT NULL REFERENCES problems (id),
    at INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('problem', 'fix', 'result')),
    text TEXT NOT NULL
  ) STRICT;
  CREATE INDEX problem_steps_problem ON problem_steps (problem_id);
  CREATE TABLE release_attempts (
    subject_type TEXT NOT NULL,
    service TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    release_key TEXT NOT NULL,
    tried_at INTEGER NOT NULL,
    PRIMARY KEY (subject_type, service, subject_id, release_key)
  ) STRICT;`,
  `CREATE TABLE tracker_cooldowns (
    host TEXT PRIMARY KEY,
    since INTEGER NOT NULL,
    text TEXT NOT NULL,
    known INTEGER NOT NULL CHECK (known IN (0, 1)),
    trigger_hash TEXT NOT NULL
  ) STRICT;
  CREATE TABLE torrent_issues (
    hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('unregistered', 'tracker_down', 'damaged')),
    since INTEGER NOT NULL,
    last_retry_at INTEGER,
    rechecked_at INTEGER,
    replace INTEGER NOT NULL CHECK (replace IN (0, 1))
  ) STRICT;`,
  `ALTER TABLE torrent_grabs ADD COLUMN published_at INTEGER;
  CREATE TABLE stall_watch (
    hash TEXT PRIMARY KEY,
    no_seeders_since INTEGER,
    zero_speed_since INTEGER,
    announced_at INTEGER,
    replaced_at INTEGER
  ) STRICT;`,
  `CREATE TABLE search_log (
    subject TEXT PRIMARY KEY,
    searched_at INTEGER NOT NULL
  ) STRICT;
  CREATE TABLE availability_seen (
    subject TEXT PRIMARY KEY,
    seen_at INTEGER NOT NULL
  ) STRICT;`,
  `CREATE TABLE import_handling (
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    download_id TEXT NOT NULL,
    category TEXT NOT NULL,
    first_seen_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL,
    last_attempt_at INTEGER,
    done INTEGER NOT NULL CHECK (done IN (0, 1)),
    PRIMARY KEY (service, download_id)
  ) STRICT;`,
  `ALTER TABLE arr_queue ADD COLUMN label TEXT NOT NULL DEFAULT '';`,
] as const;

class DatabaseError extends Error {}

const canonicalize = (path: string): string => {
  const missingParts: string[] = [];
  let existingPath = path;
  while (!existsSync(existingPath)) {
    missingParts.unshift(basename(existingPath));
    const parent = dirname(existingPath);
    if (parent === existingPath) {
      throw new DatabaseError(databasePathMessage);
    }
    existingPath = parent;
  }
  return resolve(realpathSync(existingPath), ...missingParts);
};

const isInsideApplication = (path: string): boolean => {
  const pathFromApplication = relative(applicationDirectory, path);
  return pathFromApplication === ''
    || (!pathFromApplication.startsWith(`..${sep}`)
      && pathFromApplication !== '..'
      && !isAbsolute(pathFromApplication));
};

const currentUserOwns = (uid: number): boolean => {
  const currentUid = process.getuid?.();
  return currentUid !== undefined && uid === currentUid;
};

const validateDirectory = (path: string): void => {
  const details = statSync(path);
  if (!details.isDirectory() || !currentUserOwns(details.uid) || (details.mode & 0o077) !== 0) {
    throw new DatabaseError(directoryMessage);
  }
};

const validateFile = (path: string): void => {
  const details = lstatSync(path);
  if (!details.isFile() || details.isSymbolicLink() || !currentUserOwns(details.uid) || (details.mode & 0o077) !== 0) {
    throw new DatabaseError(fileMessage);
  }
};

const prepareDatabaseFile = (path: string): void => {
  const directory = dirname(path);
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    validateDirectory(directory);
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(directoryMessage);
  }

  try {
    const descriptor = openSync(path, 'wx', 0o600);
    closeSync(descriptor);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw new DatabaseError(fileMessage);
    }
  }

  try {
    validateFile(path);
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(fileMessage);
  }
};

export const migrateDatabase = (database: DatabaseSync, migrations: readonly string[]): void => {
  let transactionStarted = false;
  try {
    database.exec('BEGIN IMMEDIATE;');
    transactionStarted = true;
    const version = database.prepare('PRAGMA user_version').get()?.user_version;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
      throw new DatabaseError('Database migration failed.');
    }
    if (version > migrations.length) {
      throw new DatabaseError('Database schema version is newer than this application.');
    }
    if (version === 0) {
      const existingObject = database.prepare(
        "SELECT 1 AS found FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' LIMIT 1",
      ).get();
      if (existingObject !== undefined) {
        throw new DatabaseError('Database is not empty and cannot be initialized.');
      }
    }

    for (let index = version; index < migrations.length; index += 1) {
      database.exec(migrations[index]);
      database.exec(`PRAGMA user_version = ${index + 1};`);
    }
    database.exec('COMMIT;');
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) database.exec('ROLLBACK;');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Database migration failed.');
  }
};

export const openDatabase = (path?: string): DatabaseSync => {
  const selectedPath = path ?? process.env.DB_PATH ?? join(
    homedir(),
    '.local',
    'share',
    'media-manager-2',
    'media-manager.sqlite',
  );
  if (!selectedPath || !isAbsolute(selectedPath) || selectedPath === ':memory:') {
    throw new DatabaseError(databasePathMessage);
  }

  let canonicalPath: string;
  try {
    canonicalPath = canonicalize(selectedPath);
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(databasePathMessage);
  }
  if (isInsideApplication(canonicalPath)) {
    throw new DatabaseError(databasePathMessage);
  }

  prepareDatabaseFile(selectedPath);
  let database: DatabaseSync;
  try {
    // The rTorrent poll writes every 30 seconds; without a busy timeout a CLI run landing inside it fails at once.
    database = new DatabaseSync(selectedPath, { timeout: 5_000 });
  } catch {
    throw new DatabaseError('Database could not be opened.');
  }
  try {
    migrateDatabase(database, applicationMigrations);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
};
