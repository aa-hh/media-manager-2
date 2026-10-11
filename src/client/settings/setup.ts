// Rules for the Folders and Backup panes. No runtime imports, so tests can load it from source.
import type { ServiceState } from '../components/ui/status-service-pill';

// Shapes served by /api/setup; src/server/setup.ts is the source of truth.
export type FolderField = 'downloadsSonarr' | 'downloadsRadarr' | 'librarySonarr' | 'libraryRadarr' | 'versionsSonarr' | 'versionsRadarr';
export type FolderValues = Record<FolderField, string>;
export type FoldersRead = { saved: Record<FolderField, string | null>; suggested: Record<FolderField, string | null> };

export type BackupDestination = { kind: 'folder'; folder: string } | { kind: 's3'; endpoint: string; bucket: string; region: string } | null;
export type SetupStatus = {
  required: { folders: 'done' | 'not_done' };
  plexSignInTokenAvailable: boolean;
  backup: { destination: BackupDestination; problem: string | null; key: 'pair' | 'env' | 'missing' | 'invalid'; keyCreatedAt: number | null };
};

export const folderFields: { field: FolderField; label: string; help: string }[] = [
  { field: 'downloadsSonarr', label: 'TV downloads', help: 'Where Sonarr\'s download client puts TV. Read from Sonarr.' },
  { field: 'downloadsRadarr', label: 'Movies downloads', help: 'Where Radarr\'s download client puts movies. Read from Radarr.' },
  { field: 'librarySonarr', label: 'TV library', help: 'Read from Sonarr\'s root folders.' },
  { field: 'libraryRadarr', label: 'Movies library', help: 'Read from Radarr\'s root folders.' },
  { field: 'versionsSonarr', label: 'TV second versions', help: 'Second versions of episodes. Must be on the same drive as the TV downloads folder.' },
  { field: 'versionsRadarr', label: 'Movies second versions', help: 'Second versions of movies. Must be on the same drive as the Movies downloads folder.' },
];

/** Each folder as saved, else as suggested, else blank. */
export const folderDraft = (read: FoldersRead): FolderValues => Object.fromEntries(
  folderFields.map(({ field }) => [field, read.saved[field] ?? read.suggested[field] ?? '']),
) as FolderValues;

export const foldersEdited = (draft: FolderValues, saved: FoldersRead['saved']) => (
  folderFields.some(({ field }) => draft[field].trim() !== (saved[field] ?? ''))
);

export const folderBody = (draft: FolderValues): FolderValues => Object.fromEntries(
  folderFields.map(({ field }) => [field, draft[field].trim()]),
) as FolderValues;

/** The Backup form. Blank keys mean "not typed"; a saved bucket's keys never come back from the server. */
export type BackupDraft = { kind: 'folder' | 's3'; folder: string; endpoint: string; bucket: string; region: string; accessKeyId: string; secretAccessKey: string };

export const emptyBackupDraft = (destination: BackupDestination): BackupDraft => ({
  kind: destination?.kind ?? 'folder',
  folder: destination?.kind === 'folder' ? destination.folder : '',
  endpoint: destination?.kind === 's3' ? destination.endpoint : '',
  bucket: destination?.kind === 's3' ? destination.bucket : '',
  region: destination?.kind === 's3' ? destination.region : '',
  accessKeyId: '',
  secretAccessKey: '',
});

/** The body POST /api/setup/backup takes: a folder alone, or a bucket with both keys and the region only when typed. */
export const backupBody = (draft: BackupDraft) => {
  if (draft.kind === 'folder') return { folder: draft.folder.trim() };
  const region = draft.region.trim();
  return {
    endpoint: draft.endpoint.trim(),
    bucket: draft.bucket.trim(),
    accessKeyId: draft.accessKeyId.trim(),
    secretAccessKey: draft.secretAccessKey.trim(),
    ...(region === '' ? {} : { region }),
  };
};

export const backupComplete = (draft: BackupDraft) => (draft.kind === 'folder'
  ? draft.folder.trim() !== ''
  : [draft.endpoint, draft.bucket, draft.accessKeyId, draft.secretAccessKey].every((value) => value.trim() !== ''));

export const backupEdited = (draft: BackupDraft, destination: BackupDestination) => {
  if (destination === null || draft.kind !== destination.kind) return true;
  if (destination.kind === 'folder') return draft.folder.trim() !== destination.folder;
  return draft.endpoint.trim() !== destination.endpoint || draft.bucket.trim() !== destination.bucket || draft.region.trim() !== destination.region
    || draft.accessKeyId.trim() !== '' || draft.secretAccessKey.trim() !== '';
};

/** Where backups go, in words for the list row. */
export const backupWords = (destination: BackupDestination) => (destination === null ? undefined
  : destination.kind === 'folder' ? destination.folder : `${destination.bucket} at ${destination.endpoint}`);

/** No destination, then a bad destination, then a missing restore key or a bad BACKUP_KEY. */
export const backupPill = (backup: SetupStatus['backup']): { state: ServiceState; text: string } => {
  if (backup.destination === null) return { state: 'not-set-up', text: 'Not set up' };
  if (backup.problem !== null) return { state: 'failed', text: 'Can\'t run: bad destination' };
  if (backup.key === 'missing') return { state: 'failed', text: 'Can\'t run: no key yet' };
  if (backup.key === 'invalid') return { state: 'failed', text: 'Can\'t run: BACKUP_KEY invalid' };
  return { state: 'connected', text: 'On · every 5 min' };
};
