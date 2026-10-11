import { closeSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { BackupStore } from './backup.js';
import { readSetting } from './services/connection.js';
import { createS3Store, type S3Config } from './services/s3.js';

export type BackupDestination = { kind: 'folder'; folder: string } | { kind: 's3'; config: S3Config };

type DestinationValues = {
  folder?: string;
  endpoint?: string;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
};

const destinationFrom = (values: DestinationValues): BackupDestination | undefined => {
  const { folder, endpoint, bucket, region, accessKeyId, secretAccessKey } = values;
  const s3 = endpoint && bucket && accessKeyId && secretAccessKey
    ? { endpoint, bucket, region: region || 'auto', accessKeyId, secretAccessKey }
    : undefined;
  if (folder && s3) throw new Error('Set either a backup folder or a backup bucket, not both.');
  if (folder) {
    if (!isAbsolute(folder)) throw new Error('The backup folder must be an absolute path.');
    return { kind: 'folder', folder };
  }
  return s3 === undefined ? undefined : { kind: 's3', config: s3 };
};

export const readBackupDestination = (database: DatabaseSync): BackupDestination | undefined => destinationFrom({
  folder: readSetting(database, 'hostPaths', 'backup.folder'),
  endpoint: readSetting(database, 'serviceAddresses', 'backup.endpoint'),
  bucket: readSetting(database, 'serviceAddresses', 'backup.bucket'),
  region: readSetting(database, 'serviceAddresses', 'backup.region'),
  accessKeyId: readSetting(database, 'credentials', 'backup.accessKeyId'),
  secretAccessKey: readSetting(database, 'credentials', 'backup.secretAccessKey'),
});

export const backupDestinationFromEnvironment = (env: NodeJS.ProcessEnv = process.env): BackupDestination | undefined => destinationFrom({
  folder: env.BACKUP_FOLDER,
  endpoint: env.BACKUP_ENDPOINT,
  bucket: env.BACKUP_BUCKET,
  region: env.BACKUP_REGION,
  accessKeyId: env.BACKUP_ACCESS_KEY_ID,
  secretAccessKey: env.BACKUP_SECRET_ACCESS_KEY,
});

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';

// The folder itself is never created, so a folder inside an unmounted drive fails the run instead of filling the local disk.
// The mount point itself would not: it stays behind as an empty folder.
export const createFolderStore = (folder: string): BackupStore => {
  const root = resolve(folder);
  const pathOf = (key: string) => {
    const path = resolve(root, key);
    if (!path.startsWith(`${root}${sep}`)) throw new Error('Backup key is outside the backup folder.');
    return path;
  };
  const requireRoot = () => {
    if (statSync(root, { throwIfNoEntry: false })?.isDirectory() !== true) throw new Error('The backup folder does not exist.');
  };

  return {
    async put(key: string, body: Uint8Array): Promise<void> {
      requireRoot();
      const path = pathOf(key);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      // Writing beside the target and renaming means a crash never leaves a half-written snapshot under its final name.
      // Flushing before the rename keeps a power cut from leaving an empty file under the final name.
      const partial = `${path}.partial`;
      try {
        const handle = openSync(partial, 'w', 0o600);
        try {
          writeFileSync(handle, body);
          fsyncSync(handle);
        } finally {
          closeSync(handle);
        }
        renameSync(partial, path);
      } catch (error) {
        rmSync(partial, { force: true });
        throw error;
      }
    },
    async get(key: string): Promise<Uint8Array | undefined> {
      requireRoot();
      try {
        return readFileSync(pathOf(key));
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
    },
    async list(prefix: string): Promise<Array<{ key: string; size: number }>> {
      requireRoot();
      const slash = prefix.lastIndexOf('/');
      const directory = prefix.slice(0, slash + 1);
      const namePrefix = prefix.slice(slash + 1);
      let names: string[];
      try {
        names = readdirSync(directory === '' ? root : pathOf(directory));
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
      return names
        .filter((name) => name.startsWith(namePrefix) && !name.endsWith('.partial'))
        .flatMap((name) => {
          const stats = statSync(join(root, directory, name), { throwIfNoEntry: false });
          return stats?.isFile() ? [{ key: `${directory}${name}`, size: stats.size }] : [];
        });
    },
    async delete(key: string): Promise<void> {
      requireRoot();
      rmSync(pathOf(key), { force: true });
    },
  };
};

export const createBackupStore = (destination: BackupDestination): BackupStore => (
  destination.kind === 'folder' ? createFolderStore(destination.folder) : createS3Store(destination.config)
);
