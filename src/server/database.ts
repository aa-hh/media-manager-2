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
    database = new DatabaseSync(selectedPath);
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
