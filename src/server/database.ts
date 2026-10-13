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

export const applicationMigrations = [
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
  `CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;`,
  `CREATE TABLE release_searches (
    target TEXT PRIMARY KEY,
    fetched_at INTEGER NOT NULL,
    releases TEXT NOT NULL
  ) STRICT;`,
  `CREATE TABLE grabs (
    id INTEGER PRIMARY KEY,
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    target TEXT NOT NULL,
    target_key TEXT NOT NULL,
    searched_for TEXT NOT NULL,
    searched_for_key TEXT NOT NULL,
    guid TEXT NOT NULL,
    release_title TEXT NOT NULL,
    intent TEXT NOT NULL CHECK (intent IN ('grab', 'replace')),
    state TEXT NOT NULL CHECK (state IN ('sending', 'sent', 'importing', 'failed', 'completed')),
    failure TEXT,
    download_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX grabs_target ON grabs (target_key);
  CREATE INDEX grabs_searched_for ON grabs (searched_for_key);
  CREATE INDEX grabs_state ON grabs (state);`,
  `CREATE TABLE protected_items (
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    item_id INTEGER NOT NULL,
    series_id INTEGER,
    season_number INTEGER,
    episode_number INTEGER,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (service, item_id)
  ) STRICT;`,
  `CREATE TABLE backup_runs (
    id INTEGER PRIMARY KEY,
    started_at INTEGER NOT NULL,
    finished_at INTEGER NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('ok', 'failed', 'skipped')),
    detail TEXT NOT NULL,
    object_key TEXT,
    bytes INTEGER,
    sha256 TEXT
  ) STRICT;`,
  `CREATE TABLE titles (
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    id INTEGER NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    detail TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (service, id)
  ) STRICT;
  CREATE TABLE episodes (
    id INTEGER PRIMARY KEY,
    series_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT,
    air_date_utc TEXT,
    overview TEXT NOT NULL,
    has_file INTEGER NOT NULL CHECK (has_file IN (0, 1)),
    monitored INTEGER NOT NULL CHECK (monitored IN (0, 1)),
    fetched_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX episodes_series ON episodes (series_id);
  CREATE TABLE title_images (
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('poster', 'fanart')),
    source TEXT NOT NULL,
    content_type TEXT NOT NULL,
    etag TEXT NOT NULL,
    file TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (service, id, kind)
  ) STRICT;`,
  `CREATE TABLE search_backlog (
    subject TEXT PRIMARY KEY,
    seen_at INTEGER NOT NULL
  ) STRICT;`,
  `CREATE TABLE blocklist_marks (
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    release_title TEXT NOT NULL,
    at INTEGER NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('history', 'downloads')),
    PRIMARY KEY (service, release_title, at)
  ) STRICT;`,
  // Backups once went only to Cloudflare R2; the same four settings now describe any S3-compatible bucket.
  `UPDATE OR IGNORE settings SET key = 'backup.' || substr(key, 4)
    WHERE key IN ('r2.endpoint', 'r2.bucket', 'r2.accessKeyId', 'r2.secretAccessKey');`,
  // One row per movie or episode: a pack's rows share one hash. Second versions never enter grabs, which Sonarr and Radarr drive.
  `CREATE TABLE second_versions (
    id INTEGER PRIMARY KEY,
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    movie_id INTEGER,
    series_id INTEGER,
    episode_id INTEGER,
    release_title TEXT NOT NULL,
    guid TEXT NOT NULL,
    indexer TEXT NOT NULL,
    quality TEXT NOT NULL,
    size_bytes INTEGER,
    hash TEXT,
    state TEXT NOT NULL CHECK (state IN ('sending', 'downloading', 'importing', 'imported', 'failed', 'deleted')),
    failure TEXT,
    file_path TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    imported_at INTEGER,
    deleted_at INTEGER,
    CHECK (
      (service = 'radarr' AND movie_id IS NOT NULL AND series_id IS NULL AND episode_id IS NULL)
      OR (service = 'sonarr' AND movie_id IS NULL AND series_id IS NOT NULL AND episode_id IS NOT NULL)
    ),
    CHECK (hash IS NOT NULL OR state = 'failed')
  ) STRICT;
  CREATE INDEX second_versions_hash ON second_versions (hash);
  CREATE INDEX second_versions_state ON second_versions (state);`,
  // A hash's file list never changes, so it is read from rTorrent once and dropped when the torrent is gone.
  `ALTER TABLE torrents ADD COLUMN directory TEXT NOT NULL DEFAULT '';
  CREATE TABLE torrent_files (
    hash TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    PRIMARY KEY (hash, "index")
  ) STRICT;`,
  // What happened to each second version, for history. Kind has no CHECK so later kinds need no table rebuild.
  `CREATE TABLE version_events (
    id INTEGER PRIMARY KEY,
    second_version_id INTEGER NOT NULL REFERENCES second_versions (id),
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT NOT NULL
  ) STRICT;
  CREATE INDEX version_events_at ON version_events (at);`,
  // The imported file's device and inode, so a delete removes only the file this app linked there.
  'ALTER TABLE second_versions ADD COLUMN file_inode TEXT;',
  // Tracker accounts moved from one fixed set of keys per tracker to one credential and software per added tracker.
  // Blutopia's token becomes blutopia.cc's credential (adding the tracker); blutopia.cc runs UNIT3D whenever it is
  // added or had a token. The Beyond-HD and PrivateHD sign-ins and blutopia.url are gone: the address is now https://<host>.
  `INSERT OR IGNORE INTO settings (category, key, value)
    SELECT 'credentials', 'trackers.blutopia.cc', value FROM settings WHERE category = 'credentials' AND key = 'blutopia.apiToken' AND value <> '';
  INSERT OR IGNORE INTO settings (category, key, value)
    SELECT 'trackerConfiguration', 'trackers.blutopia.cc', 'added' FROM settings WHERE category = 'credentials' AND key = 'trackers.blutopia.cc';
  INSERT OR IGNORE INTO settings (category, key, value)
    SELECT 'trackerConfiguration', 'software.blutopia.cc', 'unit3d' WHERE EXISTS (
      SELECT 1 FROM settings WHERE category = 'trackerConfiguration' AND key IN ('trackers.blutopia.cc', 'rules.blutopia.cc'));
  DELETE FROM settings
    WHERE (category = 'serviceAddresses' AND key IN ('blutopia.url', 'privatehd.url', 'beyondhd.url'))
      OR (category = 'credentials' AND key IN ('blutopia.apiToken', 'privatehd.username', 'privatehd.password', 'privatehd.pid', 'beyondhd.apiKey', 'beyondhd.rssKey'));`,
  // What each source said about a title outside the library. Each source's reply is its own part row with its own
  // fetch time, so a new source is a new part name, not a new column. A show's key is its TVDB id; its TMDB id sits
  // beside it so either finds the row. search_lookups keeps which titles a search term returned.
  `CREATE TABLE title_store (
    key TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('movie', 'tv')),
    tmdb_id INTEGER,
    tvdb_id INTEGER
  ) STRICT;
  CREATE INDEX title_store_tmdb ON title_store (type, tmdb_id);
  CREATE TABLE title_store_parts (
    key TEXT NOT NULL REFERENCES title_store (key),
    part TEXT NOT NULL,
    json TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (key, part)
  ) STRICT;
  CREATE TABLE search_lookups (
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    term TEXT NOT NULL,
    ids TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (service, term)
  ) STRICT;`,
  // Deleting a movie or show, for history. The title is kept as text because Sonarr and Radarr forget it.
  `CREATE TABLE title_events (
    id INTEGER PRIMARY KEY,
    service TEXT NOT NULL CHECK (service IN ('sonarr', 'radarr')),
    title_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT NOT NULL
  ) STRICT;
  CREATE INDEX title_events_at ON title_events (at);`,
  // Our copies of TMDB posters and backdrops; title_images' CHECK constraints only allow Sonarr and Radarr rows.
  `CREATE TABLE tmdb_images (
    size TEXT NOT NULL,
    path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    etag TEXT NOT NULL,
    file TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (size, path)
  ) STRICT;`,
  // A fixed code beside each second version's failure text, so the client never matches the text. Rows failed before
  // this get the code their exact text maps to; other texts keep a null code.
  `ALTER TABLE second_versions ADD COLUMN failure_code TEXT;
  UPDATE second_versions SET failure_code = CASE
    WHEN failure = 'Stalled with nothing downloaded; torrent removed.' THEN 'stalled_removed'
    WHEN failure = 'Sonarr or Radarr grabbed the same torrent.' THEN 'grabbed_by_arr'
    WHEN failure LIKE 'rTorrent never received it.%' THEN 'never_received'
    WHEN failure = 'That torrent is already in rTorrent.' THEN 'already_in_rtorrent'
    WHEN failure IN ('The download link returned a web page, not a torrent file.', 'The download link did not return a torrent file.') THEN 'not_a_torrent'
  END WHERE failure IS NOT NULL;`,
  // Where the history check last read imports and failures; null makes the next check backfill the full lookback.
  `ALTER TABLE grab_checkpoints ADD COLUMN outcomes_checked_at INTEGER;`,
  // Saved Discover rows, so the home screen reads results and never waits on TMDB or Trakt.
  `CREATE TABLE discover_rows (key TEXT PRIMARY KEY, json TEXT NOT NULL, fetched_at INTEGER NOT NULL, read_at INTEGER NOT NULL) STRICT;`,
  // Sign-in sessions, so a restart keeps the owner signed in. token_hash is the SHA-256 of the cookie value, never the value.
  `CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;`,
  // When a season search was last sent for each season, so the six-hour repeats alternate season and episode searches.
  `CREATE TABLE season_search_log (series_id INTEGER NOT NULL, season_number INTEGER NOT NULL, searched_at INTEGER NOT NULL, PRIMARY KEY (series_id, season_number)) STRICT;`,
  // How many times an imported second version was offered to Jellyfin to merge with the tracked file; a merge sets the cap.
  `ALTER TABLE second_versions ADD COLUMN merge_tries INTEGER NOT NULL DEFAULT 0;`,
  // The tracked file's path as Radarr or Sonarr last reported it; a change means a rename or upgrade, which splits a Jellyfin merge.
  `ALTER TABLE second_versions ADD COLUMN tracked_path TEXT;`,
  // When Radarr or Sonarr was last asked for the tracked path; NULL while a merged row owes a check after a rename or download event.
  `ALTER TABLE second_versions ADD COLUMN merge_checked_at INTEGER;`,
  // The install's owner: one row, written by the first sign-in on the first-run page or replaced by a media-server switch.
  `CREATE TABLE owner (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    provider TEXT NOT NULL CHECK (provider IN ('plex', 'jellyfin')),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    server_name TEXT
  ) STRICT;`,
  // owner_id is text because a Jellyfin user ID is a GUID. Existing rows are copied with their Plex ID as text, which
  // matches String(PLEX_OWNER_ID), so an upgrade keeps the owner signed in.
  `CREATE TABLE sessions_rebuilt (
    token_hash TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;
  INSERT INTO sessions_rebuilt (token_hash, owner_id, expires_at) SELECT token_hash, CAST(owner_id AS TEXT), expires_at FROM sessions;
  DROP TABLE sessions;
  ALTER TABLE sessions_rebuilt RENAME TO sessions;`,
  // The Jellyfin server's Id from /System/Info/Public, so an address change can be held to the same server.
  `ALTER TABLE owner ADD COLUMN server_id TEXT;`,
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

export const defaultDatabasePath = join(homedir(), '.local', 'share', 'media-manager-2', 'media-manager.sqlite');

export const assertDatabasePath = (path: string): void => {
  if (!path || !isAbsolute(path) || path === ':memory:') {
    throw new DatabaseError(databasePathMessage);
  }

  let canonicalPath: string;
  try {
    canonicalPath = canonicalize(path);
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(databasePathMessage);
  }
  if (isInsideApplication(canonicalPath)) {
    throw new DatabaseError(databasePathMessage);
  }
};

export const openDatabase = (path?: string): DatabaseSync => {
  const selectedPath = path ?? process.env.DB_PATH ?? defaultDatabasePath;
  assertDatabasePath(selectedPath);
  prepareDatabaseFile(selectedPath);
  let database: DatabaseSync;
  try {
    // The rTorrent poll writes every 30 seconds; without a busy timeout a CLI run landing inside it fails at once.
    database = new DatabaseSync(selectedPath, { timeout: 5_000 });
  } catch {
    throw new DatabaseError('Database could not be opened.');
  }
  try {
    // Most writers commit one statement at a time. In the default rollback journal each commit fsyncs four times
    // (about 200 ms on the Whatbox disk) and locks readers out; WAL with NORMAL fsyncs only at checkpoints, and a
    // power cut can lose the last commits but never corrupt the file.
    migrateDatabase(database, applicationMigrations);
    database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
};
