import type { DatabaseSync } from 'node:sqlite';
import { deleteSetting, getSetting, listSettingKeys, setSetting } from './settings.js';

// One row of a seed-time table: the first row whose upToGB covers the size (the boundary belongs to the row) gives
// hours + perGB·GB + lnGB·ln(GB), with GB as 1000^3 bytes. The last row has no upToGB and covers every larger size.
export type SeedRow = { upToGB?: number; hours: number; perGB?: number; lnGB?: number };
// A null ratio means the tracker has no ratio side; logic then has nothing to combine and is null.
// A null minGlobalRatio means the tracker does not state one.
// Rules for a torrent left incomplete, each null when the tracker states none: below exemptBelow (a fraction of the
// size) downloaded it owes nothing; otherwise seed time is ignored and it clears at partial.ratio or after maxHours.
export type HitAndRunRule = ({ ratio: number; logic: 'and' | 'or' } | { ratio: null; logic: null }) & {
  seedHours: SeedRow[];
  minGlobalRatio: number | null;
  partial: { exemptBelow: number | null; ratio: number | null; maxHours: number | null };
};
// `field` is a path into the rule as sent, such as "seedHours[1].perGB" or "partial.ratio".
export type RuleProblem = { field: string | null; reason: string };

// No tracker or rule ships in code: the owner adds trackers (`trackers.<host>`), saves rules (`rules.<host>`), or sets
// TRACKER_RULES in the env file. A host with a saved rule or a TRACKER_RULES entry counts as added too.
const CATEGORY = 'trackerConfiguration';
const PREFIX = 'rules.';
const ADDED = 'trackers.';

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const amount = (value: unknown): value is number => finite(value) && value >= 0;
// Absent and null both mean "not set"; anything else must be a valid amount.
const optionalAmount = (value: unknown): number | null | undefined => (value === undefined || value === null ? null : amount(value) ? value : undefined);
const unknownKey = (value: Record<string, unknown>, known: readonly string[]) => Object.keys(value).find((key) => !known.includes(key));

// Tables are checked for negative seed time up to this size; a torrent above it is judged by the last row unchecked.
const CHECKED_UP_TO_GB = 10_000;
const rowHours = (row: SeedRow, gb: number) => row.hours + (row.perGB ? row.perGB * gb : 0) + (row.lnGB ? row.lnGB * Math.log(gb) : 0);

const parseSeedHours = (value: unknown): SeedRow[] | RuleProblem => {
  if (!Array.isArray(value) || value.length === 0) return { field: 'seedHours', reason: 'seedHours must be a list of one or more rows' };
  const rows: SeedRow[] = [];
  for (const [index, raw] of value.entries()) {
    const at = `seedHours[${index}]`;
    if (!isRecord(raw)) return { field: at, reason: `${at} must be a JSON object` };
    const stray = unknownKey(raw, ['upToGB', 'hours', 'perGB', 'lnGB']);
    if (stray !== undefined) return { field: `${at}.${stray}`, reason: `${stray} is not a seedHours field` };
    if (!finite(raw.hours)) return { field: `${at}.hours`, reason: 'hours must be a number' };
    const row: SeedRow = { hours: raw.hours };
    for (const key of ['upToGB', 'perGB', 'lnGB'] as const) {
      const given = raw[key];
      if (given === undefined || given === null) continue;
      if (!finite(given) || (key === 'upToGB' && given < 0)) return { field: `${at}.${key}`, reason: `${key} must be a number${key === 'upToGB' ? ' of 0 or more' : ''}` };
      row[key] = given;
    }
    const last = index === value.length - 1;
    const previous = rows.at(-1)?.upToGB;
    if (last && row.upToGB !== undefined) return { field: `${at}.upToGB`, reason: 'the last row must leave out upToGB so it covers every larger size' };
    if (!last && row.upToGB === undefined) return { field: `${at}.upToGB`, reason: 'every row but the last needs upToGB' };
    if (previous !== undefined && row.upToGB !== undefined && row.upToGB <= previous) {
      return { field: `${at}.upToGB`, reason: `upToGB must be larger than the row before's ${previous}` };
    }
    // hours + perGB·GB + lnGB·ln(GB) has at most one turning point, at -lnGB/perGB, so its lowest value over the row's
    // range is at an end or there. The lower end is checked too, though the row itself starts just above it.
    const from = previous ?? 0;
    const to = row.upToGB ?? Math.max(CHECKED_UP_TO_GB, from);
    const turn = row.perGB && row.lnGB ? -row.lnGB / row.perGB : undefined;
    for (const gb of [from, to, ...(turn !== undefined && turn > from && turn < to ? [turn] : [])]) {
      const hours = rowHours(row, gb);
      if (!amount(hours)) {
        const shown = Number.isFinite(hours) ? Math.round(hours) : hours;
        return { field: at, reason: `${at} gives ${shown} hours at ${gb} GB; seed time must come out at 0 or more from ${from} to ${to} GB` };
      }
    }
    rows.push(row);
  }
  return rows;
};

const parseTableRule = (value: Record<string, unknown>): HitAndRunRule | RuleProblem => {
  const stray = unknownKey(value, ['seedHours', 'ratio', 'logic', 'minGlobalRatio', 'partial']);
  if (stray !== undefined) return { field: stray, reason: `${stray} is not a rule field` };
  const seedHours = parseSeedHours(value.seedHours);
  if ('reason' in seedHours) return seedHours;
  const ratio = optionalAmount(value.ratio);
  if (ratio === undefined) return { field: 'ratio', reason: 'ratio must be a number of 0 or more' };
  const minGlobalRatio = optionalAmount(value.minGlobalRatio);
  if (minGlobalRatio === undefined) return { field: 'minGlobalRatio', reason: 'minGlobalRatio must be a number of 0 or more' };
  const given = value.partial ?? {};
  if (!isRecord(given)) return { field: 'partial', reason: 'partial must be a JSON object' };
  const strayPartial = unknownKey(given, ['exemptBelow', 'ratio', 'maxHours']);
  if (strayPartial !== undefined) return { field: `partial.${strayPartial}`, reason: `${strayPartial} is not a partial field` };
  const partial = { exemptBelow: optionalAmount(given.exemptBelow), ratio: optionalAmount(given.ratio), maxHours: optionalAmount(given.maxHours) };
  const bad = (['exemptBelow', 'ratio', 'maxHours'] as const).find((key) => partial[key] === undefined);
  if (bad !== undefined) return { field: `partial.${bad}`, reason: `partial.${bad} must be a number of 0 or more` };
  const { exemptBelow = null, ratio: partialRatio = null, maxHours = null } = partial;
  // A fraction above 1 would exempt every incomplete torrent.
  if (exemptBelow !== null && exemptBelow > 1) return { field: 'partial.exemptBelow', reason: 'partial.exemptBelow must be a fraction from 0 to 1' };
  const rest = { seedHours, minGlobalRatio, partial: { exemptBelow, ratio: partialRatio, maxHours } };
  if (ratio === null) return { ratio, logic: null, ...rest };
  if (value.logic === 'and' || value.logic === 'or') return { ratio, logic: value.logic, ...rest };
  return { field: 'logic', reason: 'logic must be "and" or "or" when ratio is set' };
};

// The rule shape from before seed-time tables. Still read from settings and TRACKER_RULES, reporting its own field
// names, and converted field for field; saving writes the table shape.
const OLD_FIELDS = ['minHours', 'minHoursFormula', 'minRatio', 'partialExemptBelow', 'partialRatio', 'partialMaxHours'];
const OLD_AMOUNTS = ['minHours', 'minRatio', 'minGlobalRatio', 'partialExemptBelow', 'partialRatio', 'partialMaxHours'];
const PRIVATEHD_SEED_HOURS: SeedRow[] = [{ upToGB: 1, hours: 72 }, { upToGB: 50, hours: 72, perGB: 2 }, { hours: -219.2023, lnGB: 100 }];
const fromOldShape = (value: Record<string, unknown>): HitAndRunRule | RuleProblem => {
  const bad = OLD_AMOUNTS.find((field) => optionalAmount(value[field]) === undefined);
  if (bad !== undefined) return { field: bad, reason: `${bad} must be a number of 0 or more` };
  if (amount(value.partialExemptBelow) && value.partialExemptBelow > 1) return { field: 'partialExemptBelow', reason: 'partialExemptBelow must be a fraction from 0 to 1' };
  const minRatio = value.minRatio ?? null;
  if (minRatio !== null && value.logic !== 'and' && value.logic !== 'or') return { field: 'logic', reason: 'logic must be "and" or "or" when minRatio is set' };
  const formula = value.minHoursFormula ?? null;
  if (formula !== null && formula !== 'privatehd') return { field: 'minHoursFormula', reason: 'minHoursFormula must be "privatehd" or left out' };
  if (formula === null && (value.minHours ?? null) === null) return { field: 'minHours', reason: 'minHours is needed unless minHoursFormula is "privatehd"' };
  return parseTableRule({
    // minHours was ignored when the formula was set.
    seedHours: formula === 'privatehd' ? PRIVATEHD_SEED_HOURS : [{ hours: value.minHours }],
    ratio: minRatio,
    logic: minRatio === null ? null : value.logic,
    minGlobalRatio: value.minGlobalRatio,
    partial: { exemptBelow: value.partialExemptBelow, ratio: value.partialRatio, maxHours: value.partialMaxHours },
  });
};

export const parseRule = (value: unknown): HitAndRunRule | RuleProblem => {
  if (!isRecord(value)) return { field: null, reason: 'the rule must be a JSON object' };
  const old = OLD_FIELDS.find((field) => Object.hasOwn(value, field));
  if (old === undefined) return parseTableRule(value);
  const table = ['seedHours', 'ratio', 'partial'].find((field) => Object.hasOwn(value, field));
  if (table !== undefined) return { field: old, reason: `${old} is from the old rule shape and can't be mixed with ${table}` };
  return fromOldShape(value);
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
    const gb = torrent.sizeBytes / 1000 ** 3;
    const requiredHours = rowHours(rule.seedHours.find((row) => row.upToGB === undefined || gb <= row.upToGB)!, gb);
    const hours = torrent.seedHours >= requiredHours;
    const ratio = rule.ratio === null ? null : torrent.ratio >= rule.ratio;
    const met = ratio === null ? hours : rule.logic === 'and' ? hours && ratio : hours || ratio;
    return { case: 'complete', requiredHours, hours, ratio, met, globalRatio: global };
  }
  const { partial } = rule;
  if (partial.exemptBelow !== null && torrent.completedBytes / torrent.sizeBytes < partial.exemptBelow) {
    return { case: 'under_buffer', requiredHours: 0, hours: true, ratio: null, met: true, globalRatio: global };
  }
  // The complete-torrent seed time does not apply to an incomplete torrent; only partial.maxHours does.
  const hours = partial.maxHours !== null && torrent.seedHours >= partial.maxHours;
  const ratio = partial.ratio === null ? null : torrent.ratio >= partial.ratio;
  return { case: 'partial', requiredHours: partial.maxHours, hours, ratio, met: hours || ratio === true, globalRatio: global };
};
