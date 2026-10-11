import type { DatabaseSync } from 'node:sqlite';
import { getSetting, listSettingKeys } from './settings.js';
import type { Tracker } from './services/trackerAccounts.js';

// A null minRatio means the tracker has no ratio side; logic then has nothing to combine and is null.
// A null minGlobalRatio means the tracker does not state one.
type Ratios = { minGlobalRatio: number | null } & ({ minRatio: number; logic: 'and' | 'or' } | { minRatio: null; logic: null });
type Hours = { minHours: number; minHoursFormula: null } | { minHours: number | null; minHoursFormula: 'privatehd' };
// Rules for a torrent left incomplete, each null when the tracker states none: below partialExemptBelow (a fraction of
// the size) downloaded it owes nothing; otherwise seed time is ignored and it clears at partialRatio or after partialMaxHours.
type Incomplete = { partialExemptBelow: number | null; partialRatio: number | null; partialMaxHours: number | null };
export type HitAndRunRule = Ratios & Hours & Incomplete;

const CATEGORY = 'trackerConfiguration';
const PREFIX = 'rules.';

// Each tracker's rule as the owner confirmed it while signed in (AA-23), used until a rule is saved for that hostname.
// PrivateHD's incomplete-torrent rules come from privatehd.to/rules/hit-run-rules.
const NO_INCOMPLETE = { partialExemptBelow: null, partialRatio: null, partialMaxHours: null };
const DEFAULTS: Record<Tracker, { host: string; rule: HitAndRunRule }> = {
  privatehd: { host: 'privatehd.to', rule: { minHours: null, minHoursFormula: 'privatehd', minRatio: 0.9, minGlobalRatio: null, logic: 'or', partialExemptBelow: 0.1, partialRatio: 0.9, partialMaxHours: 1440 } },
  blutopia: { host: 'blutopia.cc', rule: { minHours: 168, minHoursFormula: null, minRatio: null, minGlobalRatio: 0.4, logic: null, ...NO_INCOMPLETE } },
  beyondhd: { host: 'beyond-hd.me', rule: { minHours: 120, minHoursFormula: null, minRatio: 1.0, minGlobalRatio: 0.25, logic: 'or', ...NO_INCOMPLETE } },
};
const defaultFor = (host: string) => Object.values(DEFAULTS).find((entry) => entry.host === host)?.rule;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
// Absent and null both mean "not set"; anything else must be a valid amount.
const optionalAmount = (value: unknown): number | null | undefined => (value === undefined || value === null ? null : amount(value) ? value : undefined);

const parseRule = (value: unknown): HitAndRunRule | undefined => {
  if (!isRecord(value)) return undefined;
  const minHours = optionalAmount(value.minHours);
  const minRatio = optionalAmount(value.minRatio);
  const minGlobalRatio = optionalAmount(value.minGlobalRatio);
  const partialExemptBelow = optionalAmount(value.partialExemptBelow);
  const partialRatio = optionalAmount(value.partialRatio);
  const partialMaxHours = optionalAmount(value.partialMaxHours);
  const minHoursFormula = value.minHoursFormula ?? null;
  const logic = value.logic ?? null;
  if (minHours === undefined || minRatio === undefined || minGlobalRatio === undefined) return undefined;
  if (partialExemptBelow === undefined || partialRatio === undefined || partialMaxHours === undefined) return undefined;
  // A fraction above 1 would exempt every incomplete torrent.
  if (partialExemptBelow !== null && partialExemptBelow > 1) return undefined;
  const incomplete = { partialExemptBelow, partialRatio, partialMaxHours };
  let ratios: Ratios & Incomplete;
  if (minRatio === null) ratios = { minRatio, minGlobalRatio, logic: null, ...incomplete };
  else if (logic === 'and' || logic === 'or') ratios = { minRatio, minGlobalRatio, logic, ...incomplete };
  else return undefined;
  if (minHoursFormula === 'privatehd') return { ...ratios, minHours, minHoursFormula };
  if (minHoursFormula !== null || minHours === null) return undefined;
  return { ...ratios, minHours, minHoursFormula };
};

// A saved rule that fails validation throws rather than falling back to the default: a silently laxer rule
// would recommend deleting a torrent that still owes seed time.
const readRule = (database: DatabaseSync, host: string): HitAndRunRule | undefined => {
  const stored = getSetting(database, CATEGORY, `${PREFIX}${host}`);
  if (stored === undefined) return defaultFor(host);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    parsed = undefined;
  }
  const rule = parseRule(parsed);
  if (rule === undefined) throw new Error(`The saved hit and run rule for ${host} is not valid.`);
  return rule;
};

// "BeyondHD (Prowlarr)" and "beyond-hd.me" both become "beyondhd"; the hostname loses its last label.
const normalise = (name: string) => name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
const hostName = (host: string) => normalise(host.replace(/\.[^.]*$/, ''));

const knownHosts = (database: DatabaseSync) => new Set([
  ...Object.values(DEFAULTS).map((entry) => entry.host),
  ...listSettingKeys(database)
    .filter((entry) => entry.category === CATEGORY && entry.key.startsWith(PREFIX))
    .map((entry) => entry.key.slice(PREFIX.length)),
]);

// Matches a tracker hostname exactly, or a Sonarr/Radarr indexer name whose normalised form equals exactly one
// hostname's normalised form. Substring matches never count, so "hd" matches nothing.
export const findTrackerRule = (database: DatabaseSync, hostOrIndexer: string): { host: string; rule: HitAndRunRule } | undefined => {
  const hosts = [...knownHosts(database)];
  const lowered = hostOrIndexer.trim().toLowerCase();
  const name = normalise(hostOrIndexer);
  const exact = hosts.find((host) => host === lowered);
  const byName = hosts.filter((host) => name !== '' && hostName(host) === name);
  const host = exact ?? (byName.length === 1 ? byName[0] : undefined);
  if (host === undefined) return undefined;
  const rule = readRule(database, host);
  return rule === undefined ? undefined : { host, rule };
};

// PrivateHD's seed time from size, with GB as 1000^3 bytes.
const privateHdHours = (sizeBytes: number) => {
  const gb = sizeBytes / 1000 ** 3;
  if (gb <= 1) return 72;
  if (gb < 50) return 72 + 2 * gb;
  return 100 * Math.log(gb) - 219.2023;
};

// `torrent.ratio` is rTorrent's d.ratio over 1000: uploaded bytes divided by bytes downloaded so far, not by the
// torrent's size, so it is the ratio an incomplete torrent is judged on too.
// `ratio` is null when the case has no ratio side; `requiredHours` is null when no seed time clears the torrent.
// The global ratio is reported on its own, as "unknown" when the tracker states no minimum or the account's ratio
// isn't given, and never changes `met`, which judges only this torrent.
export const checkHitAndRun = (
  rule: HitAndRunRule,
  torrent: { seedHours: number; ratio: number; sizeBytes: number; completedBytes: number },
  globalRatio?: number,
): {
  case: 'complete' | 'partial' | 'under_buffer';
  requiredHours: number | null;
  hours: boolean;
  ratio: boolean | null;
  met: boolean;
  globalRatio: boolean | 'unknown';
} => {
  const global = globalRatio === undefined || rule.minGlobalRatio === null ? 'unknown' : globalRatio >= rule.minGlobalRatio;
  if (torrent.completedBytes >= torrent.sizeBytes) {
    const requiredHours = rule.minHoursFormula === 'privatehd' ? privateHdHours(torrent.sizeBytes) : rule.minHours;
    const hours = torrent.seedHours >= requiredHours;
    const ratio = rule.minRatio === null ? null : torrent.ratio >= rule.minRatio;
    const met = ratio === null ? hours : rule.logic === 'and' ? hours && ratio : hours || ratio;
    return { case: 'complete', requiredHours, hours, ratio, met, globalRatio: global };
  }
  if (rule.partialExemptBelow !== null && torrent.completedBytes / torrent.sizeBytes < rule.partialExemptBelow) {
    return { case: 'under_buffer', requiredHours: 0, hours: true, ratio: null, met: true, globalRatio: global };
  }
  // The complete-torrent seed time does not apply to an incomplete torrent; only partialMaxHours does.
  const hours = rule.partialMaxHours !== null && torrent.seedHours >= rule.partialMaxHours;
  const ratio = rule.partialRatio === null ? null : torrent.ratio >= rule.partialRatio;
  return { case: 'partial', requiredHours: rule.partialMaxHours, hours, ratio, met: hours || ratio === true, globalRatio: global };
};
