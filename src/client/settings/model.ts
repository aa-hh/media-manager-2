// Settings screen rules. No runtime imports, so tests can load it from source.
import type { LogoName } from '../components/ui/logo';
import type { ServiceState } from '../components/ui/status-service-pill';

export type ServiceName = 'sonarr' | 'radarr' | 'rtorrent' | 'plex' | 'tmdb' | 'mdblist' | 'trakt';

// Shapes served by /api/settings; src/server/connections.ts is the source of truth.
export type SavedService = { service: ServiceName; serviceAddresses: Record<string, string>; credentials: Record<string, boolean> };
export type TestResult = { kind: 'ok'; version?: string } | { kind: 'not_configured' | 'rejected' | 'unreachable' };

/** The form for one service. A blank secret means "keep the saved one". */
export type Draft = { address: string; secrets: Record<string, string> };

/** The last test of one service; ofSaved is false when it tested values still in the form. */
export type Check = { kind: 'idle' } | { kind: 'testing' } | (TestResult & { at: number; ofSaved: boolean });

type Credential = { key: string; label: string; short: string; placeholder: string; help: string; secret: boolean };

export type ServiceInfo = {
  name: ServiceName;
  label: string;
  /** Null when the logo set has none; the screen shows a globe instead. */
  logo: LogoName | null;
  /** Absent for a service with one fixed address: the owner enters only its key. */
  addressPlaceholder?: string;
  /** Services make up the "How the pieces connect" strip; Metadata feeds titles and ratings only. */
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
    name: 'tmdb', label: 'TMDB', logo: null, group: 'Metadata', usedFor: 'Discover rows, title details and posters', refused: 'API key',
    credentials: [apiKey('TMDB', 'On themoviedb.org: Settings > API > API Key.')],
  },
  {
    name: 'mdblist', label: 'MDBList', logo: null, group: 'Metadata', usedFor: 'Ratings by site on show pages', refused: 'API key',
    credentials: [apiKey('MDBList', 'On mdblist.com: Preferences > API Access.')],
  },
  {
    name: 'trakt', label: 'Trakt', logo: null, group: 'Metadata', usedFor: 'Discover lists beyond TMDB', refused: 'Client ID',
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
  if (secrets.length > 0) result.credentials = Object.fromEntries(secrets);
  return result;
};

export const changedCount = (service: ServiceName, saved: SavedService | undefined, draft: Draft) => {
  const changed = changes(service, saved, draft);
  return Object.keys(changed.serviceAddresses ?? {}).length + Object.keys(changed.credentials ?? {}).length;
};

const shortVersion = (version: string) => version.split('.').slice(0, 3).join('.');

/** The pill for a row, the strip or the editor. A running test, then a failure, then unsaved edits win. */
export const pillFor = (info: ServiceInfo, check: Check, edited: number, full = false): { state: ServiceState; text: string } => {
  if (check.kind === 'testing') return { state: 'testing', text: 'Testing' };
  if (check.kind === 'unreachable') return { state: 'failed', text: 'Failed: no answer in 10 s' };
  if (check.kind === 'rejected') return { state: 'failed', text: `Failed: ${info.refused} refused` };
  if (edited > 0) return { state: 'unsaved', text: full ? `Unsaved edits · ${edited} ${edited === 1 ? 'field' : 'fields'}` : 'Unsaved edits' };
  if (check.kind === 'ok') {
    const version = check.version === undefined ? '' : ` · ${full ? check.version : shortVersion(check.version)}`;
    return { state: 'connected', text: `Connected${version}` };
  }
  return { state: 'not-set-up', text: 'Not set up' };
};

const failed = (check: Check) => check.kind === 'unreachable' || check.kind === 'rejected';

const list = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** What the trackers add to the header: account connections that answer, of those that exist, and their own words. */
export type TrackerSummary = { ok: number; total: number; failed: string[]; notes: string[] };

/** Header words, such as "5 of 7 connected · 2 failed · Radarr has unsaved edits · Beyond-HD has no hit and run rule". */
export const headerSummary = (
  checks: Record<ServiceName, Check>,
  edited: ServiceName[],
  lastChecked: string | undefined,
  trackers: TrackerSummary = { ok: 0, total: 0, failed: [], notes: [] },
) => {
  const named = (name: ServiceName) => services.find((info) => info.name === name)!.label;
  const ok = services.filter((info) => checks[info.name].kind === 'ok').length + trackers.ok;
  const failures = [...services.filter((info) => failed(checks[info.name])).map((info) => info.label), ...trackers.failed];
  const testing = services.filter((info) => checks[info.name].kind === 'testing');
  const parts = [`${ok} of ${services.length + trackers.total} connected`];
  if (failures.length === 1) parts.push(`${failures[0]} failed`);
  if (failures.length > 1) parts.push(`${failures.length} failed`);
  // As in the pills, a running test or a failure outranks unsaved edits.
  const unsaved = edited.filter((name) => !failed(checks[name]) && checks[name].kind !== 'testing');
  if (unsaved.length === 1) parts.push(`${named(unsaved[0])} has unsaved edits`);
  if (unsaved.length > 1) parts.push(`${unsaved.length} services have unsaved edits`);
  if (testing.length === 1) parts.push(`testing ${testing[0].label}`);
  if (testing.length > 1) parts.push(`testing ${testing.length} services`);
  parts.push(...trackers.notes);
  if (parts.length === 1 && ok > 0 && lastChecked !== undefined) parts.push(`last checked ${lastChecked}`);
  return parts.join(' · ');
};

/** The service columns of the "How the pieces connect" strip, left to right, after the Trackers column, which feeds nothing and has no link. */
export const chain: { caption: string; names: ServiceName[]; linked: boolean }[] = [
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

const consequences: Partial<Record<ServiceName, string>> = {
  sonarr: 'no TV shows can be found or grabbed',
  radarr: 'no movies can be found or grabbed',
  rtorrent: 'nothing new downloads',
};

// Metadata services are not in the strip.
const chainServices = services.filter((info) => info.group === 'Services');

/** The strip's sentence about what works and what does not. */
export const stripSummary = (checks: Record<ServiceName, Check>) => {
  // Several tests at once is the check every saved connection gets when the screen opens; a single Connect keeps the usual sentence.
  if (chainServices.filter((info) => checks[info.name].kind === 'testing').length > 1) return 'Checking each connection.';
  if (chainServices.every((info) => checks[info.name].kind === 'ok')) return 'Every link answers. Trackers don\'t feed Sonarr or Radarr: their hit and run rules decide when a torrent can be removed.';
  if (!chainServices.some((info) => checks[info.name].kind === 'ok')) {
    const next = chainServices.find((info) => checks[info.name].kind !== 'ok') ?? chainServices[0];
    return `Nothing answers yet, so nothing can be found, downloaded or watched. Start with ${next.label}.`;
  }
  const sentences = chainServices.flatMap((info) => {
    const check = checks[info.name];
    if (check.kind === 'rejected') return [`${info.label} refused its ${info.refused}.`];
    if (check.kind !== 'unreachable') return [];
    const consequence = consequences[info.name];
    return [`${info.label} is not answering${consequence === undefined ? '' : `, so ${consequence}`}.`];
  });
  const unset = chainServices.filter((info) => checks[info.name].kind !== 'ok' && !failed(checks[info.name])).map((info) => info.label);
  if (unset.length > 0) sentences.push(`${list(unset)} ${unset.length === 1 ? 'is' : 'are'} not set up yet.`);
  return sentences.join(' ');
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
