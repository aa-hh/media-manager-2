import type { DatabaseSync } from 'node:sqlite';
import { deleteSetting, getSetting, listSettingKeys, setSetting } from './settings.js';

// A null minRatio means the tracker has no ratio side; logic then has nothing to combine and is null.
// A null minGlobalRatio means the tracker does not state one.
type Ratios = { minGlobalRatio: number | null } & ({ minRatio: number; logic: 'and' | 'or' } | { minRatio: null; logic: null });
type Hours = { minHours: number; minHoursFormula: null } | { minHours: number | null; minHoursFormula: 'privatehd' };
// Rules for a torrent left incomplete, each null when the tracker states none: below partialExemptBelow (a fraction of
// the size) downloaded it owes nothing; otherwise seed time is ignored and it clears at partialRatio or after partialMaxHours.
type Incomplete = { partialExemptBelow: number | null; partialRatio: number | null; partialMaxHours: number | null };
export type HitAndRunRule = Ratios & Hours & Incomplete;
export type RuleProblem = { field: keyof HitAndRunRule | null; reason: string };

// No tracker or rule ships in code: the owner adds trackers (`trackers.<host>`), saves rules (`rules.<host>`), or sets
// TRACKER_RULES in the env file. A host with a saved rule or a TRACKER_RULES entry counts as added too.
const CATEGORY = 'trackerConfiguration';
const PREFIX = 'rules.';
const ADDED = 'trackers.';

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
// Absent and null both mean "not set"; anything else must be a valid amount.
const optionalAmount = (value: unknown): number | null | undefined => (value === undefined || value === null ? null : amount(value) ? value : undefined);
const amounts = ['minHours', 'minRatio', 'minGlobalRatio', 'partialExemptBelow', 'partialRatio', 'partialMaxHours'] as const;

export const parseRule = (value: unknown): HitAndRunRule | RuleProblem => {
  if (!isRecord(value)) return { field: null, reason: 'the rule must be a JSON object' };
  const bad = amounts.find((field) => optionalAmount(value[field]) === undefined);
  if (bad !== undefined) return { field: bad, reason: `${bad} must be a number of 0 or more` };
  const [minHours, minRatio, minGlobalRatio, partialExemptBelow, partialRatio, partialMaxHours] = amounts.map((field) => optionalAmount(value[field]) ?? null);
  const minHoursFormula = value.minHoursFormula ?? null;
  const logic = value.logic ?? null;
  // A fraction above 1 would exempt every incomplete torrent.
  if (partialExemptBelow !== null && partialExemptBelow > 1) return { field: 'partialExemptBelow', reason: 'partialExemptBelow must be a fraction from 0 to 1' };
  const incomplete = { partialExemptBelow, partialRatio, partialMaxHours };
  let ratios: Ratios & Incomplete;
  if (minRatio === null) ratios = { minRatio, minGlobalRatio, logic: null, ...incomplete };
  else if (logic === 'and' || logic === 'or') ratios = { minRatio, minGlobalRatio, logic, ...incomplete };
  else return { field: 'logic', reason: 'logic must be "and" or "or" when minRatio is set' };
  if (minHoursFormula === 'privatehd') return { ...ratios, minHours, minHoursFormula };
  if (minHoursFormula !== null) return { field: 'minHoursFormula', reason: 'minHoursFormula must be "privatehd" or left out' };
  if (minHours === null) return { field: 'minHours', reason: 'minHours is needed unless minHoursFormula is "privatehd"' };
  return { ...ratios, minHours, minHoursFormula };
};
const isProblem = (rule: HitAndRunRule | RuleProblem): rule is RuleProblem => 'reason' in rule;

// A bare lower-case hostname from a hostname or URL, or undefined for anything else, including IP addresses and single labels.
export const bareHost = (input: string): string | undefined => {
  const trimmed = input.trim().toLowerCase();
  let host: string;
  try {
    host = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`).hostname;
  } catch {
    return undefined;
  }
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ? host : undefined;
};

// Any fault throws, so startup stops on it: a rule dropped quietly would leave its tracker with no rule.
export const trackerRulesFromEnvironment = (env: NodeJS.ProcessEnv = process.env): Map<string, HitAndRunRule> => {
  const rules = new Map<string, HitAndRunRule>();
  const raw = env.TRACKER_RULES;
  if (raw === undefined || raw.trim() === '') return rules;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('TRACKER_RULES is not valid JSON.');
  }
  if (!isRecord(parsed)) throw new Error('TRACKER_RULES must be a JSON object keyed by tracker hostname.');
  for (const [key, value] of Object.entries(parsed)) {
    const host = bareHost(key);
    if (host === undefined) throw new Error(`TRACKER_RULES: "${key}" is not a tracker hostname.`);
    if (rules.has(host)) throw new Error(`TRACKER_RULES: ${host} is listed twice.`);
    const rule = parseRule(value);
    if (isProblem(rule)) throw new Error(`TRACKER_RULES: the rule for ${host} is not valid: ${rule.reason}.`);
    rules.set(host, rule);
  }
  return rules;
};

// A saved rule that fails validation throws rather than falling back to the TRACKER_RULES one: a silently laxer rule
// would recommend deleting a torrent that still owes seed time.
const savedRule = (database: DatabaseSync, host: string): HitAndRunRule | undefined => {
  const stored = getSetting(database, CATEGORY, `${PREFIX}${host}`);
  if (stored === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    parsed = undefined;
  }
  const rule = parseRule(parsed);
  if (isProblem(rule)) throw new Error(`The saved hit and run rule for ${host} is not valid.`);
  return rule;
};

// The rule for an added tracker's exact hostname and where it came from; a saved rule wins over TRACKER_RULES.
export const trackerRule = (
  database: DatabaseSync,
  host: string,
  env: NodeJS.ProcessEnv = process.env,
): { rule: HitAndRunRule; source: 'settings' | 'env' } | undefined => {
  const saved = savedRule(database, host);
  if (saved !== undefined) return { rule: saved, source: 'settings' };
  const fromEnv = trackerRulesFromEnvironment(env).get(host);
  return fromEnv === undefined ? undefined : { rule: fromEnv, source: 'env' };
};

const savedHosts = (database: DatabaseSync, prefix: string) => listSettingKeys(database)
  .filter((entry) => entry.category === CATEGORY && entry.key.startsWith(prefix))
  .map((entry) => entry.key.slice(prefix.length));

export const listTrackerHosts = (database: DatabaseSync, env: NodeJS.ProcessEnv = process.env): string[] => [...new Set([
  ...savedHosts(database, ADDED),
  ...savedHosts(database, PREFIX),
  ...trackerRulesFromEnvironment(env).keys(),
])].sort();

export const addTracker = (database: DatabaseSync, host: string) => setSetting(database, CATEGORY, `${ADDED}${host}`, 'added');
export const saveTrackerRule = (database: DatabaseSync, host: string, rule: HitAndRunRule | null) => (rule === null
  ? deleteSetting(database, CATEGORY, `${PREFIX}${host}`)
  : setSetting(database, CATEGORY, `${PREFIX}${host}`, JSON.stringify(rule)));
export const removeTracker = (database: DatabaseSync, host: string) => {
  deleteSetting(database, CATEGORY, `${ADDED}${host}`);
  deleteSetting(database, CATEGORY, `${PREFIX}${host}`);
};

// "BeyondHD (Prowlarr)" and "beyond-hd.me" both become "beyondhd"; the hostname loses its last label.
const normalise = (name: string) => name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
const hostName = (host: string) => normalise(host.replace(/\.[^.]*$/, ''));

// Matches an added tracker's hostname (or one of its parent domains) exactly, or a Sonarr/Radarr indexer name whose normalised form
// equals exactly one hostname's normalised form. Substring matches never count, so "hd" matches nothing.
export const findTrackerRule = (
  database: DatabaseSync,
  hostOrIndexer: string,
  env: NodeJS.ProcessEnv = process.env,
): { host: string; rule: HitAndRunRule } | undefined => {
  const hosts = listTrackerHosts(database, env);
  const lowered = hostOrIndexer.trim().toLowerCase();
  const name = normalise(hostOrIndexer);
  // Announce hostnames can carry a subdomain ("tracker.beyond-hd.me"), so parent domains of two or more labels match too, longest first.
  const labels = lowered.split('.');
  const candidates = [lowered, ...labels.slice(1, -1).map((_, index) => labels.slice(index + 1).join('.'))];
  const exact = candidates.map((candidate) => hosts.find((host) => host === candidate)).find((host) => host !== undefined);
  const byName = hosts.filter((host) => name !== '' && hostName(host) === name);
  const host = exact ?? (byName.length === 1 ? byName[0] : undefined);
  if (host === undefined) return undefined;
  const found = trackerRule(database, host, env);
  return found === undefined ? undefined : { host, rule: found.rule };
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
