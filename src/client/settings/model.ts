// Settings screen rules. No runtime imports, so tests can load it from source.
import type { LogoName } from '../components/ui/logo';
import type { ServiceState } from '../components/ui/status-service-pill';

export type ServiceName = 'sonarr' | 'radarr' | 'rtorrent' | 'plex' | 'jellyfin' | 'tmdb' | 'mdblist' | 'trakt';

// Shapes served by /api/settings; src/server/connections.ts is the source of truth.
export type SavedService = { service: ServiceName; serviceAddresses: Record<string, string>; credentials: Record<string, boolean> };
export type TestResult =
  | { kind: 'ok'; version?: string; serverName?: string }
  | { kind: 'not_configured' | 'rejected' | 'unreachable' | 'not_jellyfin' }
  | { kind: 'different_server'; serverName: string };

/** The form for one service. A blank secret means "keep the saved one". */
export type Draft = { address: string; secrets: Record<string, string> };

/** The last test of one service; ofSaved is false when it tested values still in the form. A different-server answer is never a check (see afterTest). */
export type Check = { kind: 'idle' } | { kind: 'testing' } | (Exclude<TestResult, { kind: 'different_server' }> & { at: number; ofSaved: boolean });

/**
 * A test's answer as the service's check. A different-server answer leaves the previous check in place, since the saved server
 * still answers, and comes back separately as the name of the server that answered, for the address field's error.
 */
export const afterTest = (previous: Check, result: TestResult, at: number, ofSaved: boolean): { check: Check; differentServer?: string } => (
  result.kind === 'different_server' ? { check: previous, differentServer: result.serverName } : { check: { ...result, at, ofSaved } }
);

type Credential = { key: string; label: string; short: string; placeholder: string; help: string; secret: boolean };

export type ServiceInfo = {
  name: ServiceName;
  label: string;
  /** Null when the logo set has none; the screen shows a globe instead. */
  logo: LogoName | null;
  /** Absent for a service with one fixed address: the owner enters only its key. */
  addressPlaceholder?: string;
  /** Both groups sit in the "How the pieces connect" strip; Metadata feeds titles and ratings only. */
  group: 'Services' | 'Metadata';
  usedFor: string;
  /** What a refusal refused, such as "API key" or "login". */
  refused: string;
  credentials: Credential[];
};

const apiKey = (app: string, help = `In ${app}: Settings > General > API Key.`): Credential => ({
  key: `${app.toLowerCase()}.apiKey`, label: 'API key', short: 'key', placeholder: 'Paste the API key', help, secret: true,
});
const login = (service: string, help: string): Credential[] => [
  { key: `${service}.username`, label: 'Username', short: 'username', placeholder: 'Username', help, secret: false },
  { key: `${service}.password`, label: 'Password', short: 'password', placeholder: 'Password', help, secret: true },
];

// The screen's services, in list order. Trackers come from /api/settings/trackers instead (trackers.ts).
export const services: ServiceInfo[] = [
  { name: 'sonarr', label: 'Sonarr', logo: 'sonarr', group: 'Services', addressPlaceholder: 'e.g. http://localhost:8989', usedFor: 'TV searches, grabs and imports', refused: 'API key', credentials: [apiKey('Sonarr')] },
  { name: 'radarr', label: 'Radarr', logo: 'radarr', group: 'Services', addressPlaceholder: 'e.g. http://localhost:7878', usedFor: 'Movie searches, grabs and imports', refused: 'API key', credentials: [apiKey('Radarr')] },
  {
    name: 'rtorrent', label: 'rTorrent', logo: 'rtorrent', group: 'Services', addressPlaceholder: 'e.g. https://seedbox.example/xmlrpc', usedFor: 'Live torrent status, stall and re-link fixes, second versions', refused: 'login',
    credentials: login('rtorrent', 'The login for the rTorrent address.'),
  },
  {
    name: 'plex', label: 'Plex', logo: 'plex', group: 'Services', addressPlaceholder: 'e.g. http://localhost:32400', usedFor: 'Health check, and library scans after a second version imports', refused: 'token',
    credentials: [{ key: 'plex.token', label: 'Plex token', short: 'token', placeholder: 'Paste the Plex token', help: 'The X-Plex-Token of your Plex server.', secret: true }],
  },
  {
    name: 'jellyfin', label: 'Jellyfin', logo: 'jellyfin', group: 'Services', addressPlaceholder: 'e.g. http://localhost:8096', usedFor: 'Health check, and library scans and version merges after a second version imports', refused: 'API key',
    credentials: [apiKey('Jellyfin', 'In Jellyfin: Dashboard > API Keys.')],
  },
  {
    name: 'tmdb', label: 'TMDB', logo: 'tmdb', group: 'Metadata', usedFor: 'Discover rows, title details and posters', refused: 'API key',
    credentials: [apiKey('TMDB', 'On themoviedb.org: Settings > API > API Key.')],
  },
  {
    name: 'mdblist', label: 'MDBList', logo: 'mdblist', group: 'Metadata', usedFor: 'Ratings by site on show pages', refused: 'API key',
    credentials: [apiKey('MDBList', 'On mdblist.com: Preferences > API Access.')],
  },
  {
    name: 'trakt', label: 'Trakt', logo: 'trakt', group: 'Metadata', usedFor: 'Discover lists beyond TMDB', refused: 'Client ID',
    credentials: [{ key: 'trakt.clientId', label: 'Client ID', short: 'Client ID', placeholder: 'Paste the Client ID', help: 'On trakt.tv: Settings > Your API Apps, then the app\'s Client ID.', secret: true }],
  },
];

const hasAddress = (service: ServiceName) => services.find((info) => info.name === service)?.addressPlaceholder !== undefined;

/** What the form asks for, in words: "address and API key", or "API key" for a service with a fixed address. */
export const fieldWords = (info: ServiceInfo) => (hasAddress(info.name) ? `address and ${info.refused}` : info.refused);

export const addressKey = (service: ServiceName) => `${service}.url`;

export const savedAddress = (saved: SavedService | undefined) => (saved === undefined ? '' : saved.serviceAddresses[addressKey(saved.service)] ?? '');

export const isConfigured = (saved: SavedService | undefined) => (
  saved !== undefined && (savedAddress(saved) !== '' || Object.values(saved.credentials).some(Boolean))
);

export const emptyDraft = (saved: SavedService | undefined): Draft => ({ address: savedAddress(saved), secrets: {} });

/**
 * The fields that differ from what is saved, shaped as the test and save routes take them.
 * An unchanged address and a blank secret are left out, so a save never rewrites them.
 */
export const changes = (service: ServiceName, saved: SavedService | undefined, draft: Draft) => {
  const result: { serviceAddresses?: Record<string, string>; credentials?: Record<string, string> } = {};
  const address = draft.address.trim();
  if (hasAddress(service) && address !== savedAddress(saved)) result.serviceAddresses = { [addressKey(service)]: address };
  const secrets = Object.entries(draft.secrets).filter(([, value]) => value.trim() !== '');
  // A pasted key often carries a stray space, which the service then refuses; a password goes as typed, since its spaces can be real.
  if (secrets.length > 0) result.credentials = Object.fromEntries(secrets.map(([key, value]) => [key, key.endsWith('.password') ? value : value.trim()]));
  return result;
};

export const changedCount = (service: ServiceName, saved: SavedService | undefined, draft: Draft) => {
  const changed = changes(service, saved, draft);
  return Object.keys(changed.serviceAddresses ?? {}).length + Object.keys(changed.credentials ?? {}).length;
};

const shortVersion = (version: string) => version.split('.').slice(0, 3).join('.');

/**
 * The pill for a row, the strip or the editor. A running test, then a failure, then unsaved edits win.
 * `notInUse` marks the media server the owner did not sign in with, which answers but serves nothing.
 */
export const pillFor = (info: ServiceInfo, check: Check, edited: number, full = false, notInUse = false): { state: ServiceState; text: string } => {
  if (check.kind === 'testing') return { state: 'testing', text: 'Testing' };
  if (check.kind === 'unreachable') return { state: 'failed', text: 'Failed: no answer in 10 s' };
  if (check.kind === 'rejected') return { state: 'failed', text: `Failed: ${info.refused} refused` };
  if (check.kind === 'not_jellyfin') return { state: 'failed', text: 'Not Jellyfin' };
  if (edited > 0) return { state: 'unsaved', text: full ? `Unsaved edits · ${edited} ${edited === 1 ? 'field' : 'fields'}` : 'Unsaved edits' };
  if (check.kind === 'ok' && notInUse) return { state: 'connected', text: 'Connected · not in use' };
  if (check.kind === 'ok') {
    const version = check.version === undefined ? '' : ` · ${full ? check.version : shortVersion(check.version)}`;
    return { state: 'connected', text: `Connected${version}` };
  }
  return { state: 'not-set-up', text: 'Not set up' };
};

const failed = (check: Check) => check.kind === 'unreachable' || check.kind === 'rejected' || check.kind === 'not_jellyfin';

export const list = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** What the trackers add to the header: the ones whose account connection failed, and their own words. */
export type TrackerSummary = { failed: string[]; notes: string[] };

/** Header words, such as "2 failed · Radarr has unsaved edits · Beyond-HD has no hit and run rule". */
export const headerSummary = (
  checks: Record<ServiceName, Check>,
  edited: ServiceName[],
  lastChecked: string | undefined,
  trackers: TrackerSummary = { failed: [], notes: [] },
) => {
  const named = (name: ServiceName) => services.find((info) => info.name === name)!.label;
  const ok = services.filter((info) => checks[info.name].kind === 'ok').length;
  const failures = [...services.filter((info) => failed(checks[info.name])).map((info) => info.label), ...trackers.failed];
  const testing = services.filter((info) => checks[info.name].kind === 'testing');
  const parts: string[] = [];
  if (failures.length === 1) parts.push(`${failures[0]} failed`);
  if (failures.length > 1) parts.push(`${failures.length} failed`);
  // As in the pills, a running test or a failure outranks unsaved edits.
  const unsaved = edited.filter((name) => !failed(checks[name]) && checks[name].kind !== 'testing');
  if (unsaved.length === 1) parts.push(`${named(unsaved[0])} has unsaved edits`);
  if (unsaved.length > 1) parts.push(`${unsaved.length} services have unsaved edits`);
  if (testing.length === 1) parts.push(`testing ${testing[0].label}`);
  if (testing.length > 1) parts.push(`testing ${testing.length} services`);
  parts.push(...trackers.notes);
  if (parts.length === 0 && ok > 0 && lastChecked !== undefined) parts.push(`last checked ${lastChecked}`);
  return parts.join(' · ');
};

/** The four columns of the "How the pieces connect" strip, left to right; a linked column has a link to the next one. */
export const chain: { caption: string; names: ServiceName[]; linked: boolean }[] = [
  { caption: 'Discover', names: ['tmdb', 'trakt', 'mdblist'], linked: true },
  { caption: 'Find and grab', names: ['sonarr', 'radarr'], linked: true },
  { caption: 'Download and seed', names: ['rtorrent'], linked: true },
  { caption: 'Watch', names: ['plex'], linked: false },
];

/** A link is faint while a side has no answer either way, red when a side has nothing working, otherwise grey. */
export const linkTone = (left: Check[], right: Check[]): 'idle' | 'risk' | 'ok' => {
  const tested = (side: Check[]) => side.some((check) => check.kind === 'ok' || failed(check));
  if (!tested(left) || !tested(right)) return 'idle';
  if (!left.some((check) => check.kind === 'ok') || !right.some((check) => check.kind === 'ok')) return 'risk';
  return 'ok';
};

/** Why a test failed, in the words the failure callouts use. */
export const failureTitle = (info: ServiceInfo, check: Check, address: string) => {
  if (check.kind === 'unreachable') return address === '' ? `${info.label} did not answer within 10 seconds` : `${info.label} did not answer at ${address}`;
  if (check.kind === 'rejected') return `${info.label} refused the ${info.refused}`;
  return `${info.label} needs its ${fieldWords(info)} first`;
};

/** "2 min ago" from a time in milliseconds. */
export const ago = (at: number, now: number) => {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
};
