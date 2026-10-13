// Rules for the Folders and Backup panes and the setup wizard's steps. No runtime imports, so tests can load it from source.
import type { ServiceState } from '../components/ui/status-service-pill';

// Shapes served by /api/setup; src/server/setup.ts is the source of truth.
export type FolderField = 'downloadsSonarr' | 'downloadsRadarr' | 'librarySonarr' | 'libraryRadarr' | 'versionsSonarr' | 'versionsRadarr';
export type FolderValues = Record<FolderField, string>;
export type FoldersRead = { saved: Record<FolderField, string | null>; suggested: Record<FolderField, string | null> };

export type BackupDestination = { kind: 'folder'; folder: string } | { kind: 's3'; endpoint: string; bucket: string; region: string } | null;
export type RequiredPart = 'sonarr' | 'radarr' | 'rtorrent' | 'mediaServer' | 'folders';
export type OptionalPart = 'trackers' | 'metadata' | 'backup';
export type SetupStatus = {
  required: Record<RequiredPart, 'done' | 'not_done'>;
  optional: Record<OptionalPart, { status: 'done' | 'not_done' | 'skipped'; wanted: boolean }>;
  requiredComplete: boolean;
  plexSignInTokenAvailable: boolean;
  /** The owner's current media server: picked on the first-run page, changed by a switch in Settings. */
  mediaServer: { kind: 'plex'; ownerName: string } | { kind: 'jellyfin'; url: string; serverName: string; ownerName: string };
  /** PLEX_OWNER_ID pins the owner, which blocks the media-server switch. */
  ownerPinned: boolean;
  backup: { destination: BackupDestination; problem: string | null; key: 'pair' | 'env' | 'missing' | 'invalid'; keyCreatedAt: number | null };
};
/** What GET /api/setup/rtorrent suggests from Sonarr's (else Radarr's) rTorrent download client; never the password. */
export type RtorrentSuggestion = { address: string | null; username: string | null };

/** The wizard's steps in order: the choices, the five required parts, the three optional parts, then Done. */
export type WizardStep = 'what' | RequiredPart | OptionalPart | 'done';
export const requiredParts: RequiredPart[] = ['sonarr', 'radarr', 'rtorrent', 'mediaServer', 'folders'];
const optionalParts: OptionalPart[] = ['trackers', 'metadata', 'backup'];
const order: WizardStep[] = ['what', ...requiredParts, ...optionalParts, 'done'];

/** Which optional parts the owner wants: ticked by default until a choice is saved, since an unticked part reads as skipped. */
export const wantedParts = (status: SetupStatus): Record<OptionalPart, boolean> => {
  const chosen = optionalParts.some((part) => status.optional[part].wanted || status.optional[part].status === 'skipped');
  return Object.fromEntries(optionalParts.map((part) => [part, !chosen || status.optional[part].wanted])) as Record<OptionalPart, boolean>;
};

/**
 * The step after `current`: the next required part not done, or the next optional part wanted and not skipped. Done waits
 * for every required part, so past the end it goes back to the first required part still missing.
 */
export const nextStep = (current: WizardStep, status: SetupStatus, wanted: Record<OptionalPart, boolean>): WizardStep => {
  const open = (step: WizardStep) => (step === 'what' || step === 'done' ? false
    : step === 'trackers' || step === 'metadata' || step === 'backup' ? wanted[step] && status.optional[step].status !== 'skipped'
      : status.required[step] === 'not_done');
  const later = order.slice(order.indexOf(current) + 1).find(open);
  if (later !== undefined) return later;
  return requiredParts.find((part) => status.required[part] === 'not_done') ?? 'done';
};

/** Where the wizard opens: the choices on a fresh install, else the first step still open. */
export const firstStep = (status: SetupStatus, wanted: Record<OptionalPart, boolean>): WizardStep => (
  requiredParts.every((part) => status.required[part] === 'not_done') ? 'what' : nextStep('what', status, wanted)
);

/** The step before `current`, for Back. */
export const previousStep = (current: WizardStep): WizardStep => order[Math.max(0, order.indexOf(current) - 1)];

const optionalNames: Record<OptionalPart, string> = { trackers: 'trackers', metadata: 'posters and ratings', backup: 'backup' };

/** The header words, such as "2 of 5 required steps done", "5 of 5 required steps done · backup left" or "… · 2 optional steps left". */
export const wizardSummary = (status: SetupStatus, wanted: Record<OptionalPart, boolean>, finished: boolean) => {
  const done = requiredParts.filter((part) => status.required[part] === 'done').length;
  if (finished) return `Done · ${done} of 5 required`;
  if (done < 5) return `${done} of 5 required steps done`;
  const left = optionalParts.filter((part) => wanted[part] && status.optional[part].status === 'not_done');
  return `5 of 5 required steps done${left.length === 0 ? '' : left.length === 1 ? ` · ${optionalNames[left[0]]} left` : ` · ${left.length} optional steps left`}`;
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

/** After a save the typed keys are sent and gone, so the same bucket reads back as unedited. */
export const clearSentKeys = (draft: BackupDraft): BackupDraft => ({ ...draft, accessKeyId: '', secretAccessKey: '' });

/** Plex uses the sign-in token when the session has one and the owner picked it, or by default while no Plex token is saved. */
export const usesSignInToken = (available: boolean, choice: boolean | undefined, tokenSaved: boolean) => available && (choice ?? !tokenSaved);

export const backupEdited = (draft: BackupDraft, destination: BackupDestination) => {
  if (destination === null || draft.kind !== destination.kind) return true;
  if (destination.kind === 'folder') return draft.folder.trim() !== destination.folder;
  return draft.endpoint.trim() !== destination.endpoint || draft.bucket.trim() !== destination.bucket || (draft.region.trim() || 'auto') !== destination.region
    || draft.accessKeyId.trim() !== '' || draft.secretAccessKey.trim() !== '';
};

/** Where backups go, in words for the list row. */
export const backupWords = (destination: BackupDestination) => (destination === null ? undefined
  : destination.kind === 'folder' ? destination.folder : `${destination.bucket} at ${destination.endpoint}`);

/** A bad destination (the server then reports none), then no destination, then a missing restore key or a bad BACKUP_KEY. */
export const backupPill = (backup: SetupStatus['backup']): { state: ServiceState; text: string } => {
  if (backup.problem !== null) return { state: 'failed', text: 'Can\'t run: bad destination' };
  if (backup.destination === null) return { state: 'not-set-up', text: 'Not set up' };
  if (backup.key === 'missing') return { state: 'failed', text: 'Can\'t run: no key yet' };
  if (backup.key === 'invalid') return { state: 'failed', text: 'Can\'t run: BACKUP_KEY invalid' };
  return { state: 'connected', text: 'On · every 5 min' };
};
