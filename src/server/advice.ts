import type { DatabaseSync } from 'node:sqlite';
import { deleteSetting, getSetting, setSetting } from './settings.js';
import type { TrackerAccountStats } from './services/trackerAccounts.js';
import { checkHitAndRun, findTrackerRule, type HitAndRunRule, isRecord } from './trackerRules.js';
import { listTorrents, type Torrent } from './torrents.js';

export type Recommendation = 'safe' | 'keep' | 'unconfirmed';
// `reason` is the full sentence; `detail` is the same text without its verdict prefix ("Keep seeding: " and the like).
// requiredHours includes the margin and is null when no seed time applies. hoursLeft is requiredHours less seededHours,
// never below 0; it is 0 once the rule is met, even on ratio alone with seed time still short, and null when no seed
// time applies or the seeding counter does not run (an incomplete torrent).
// seededHours is null when the torrent is not in rTorrent. All three are rounded to 0.01 hours, hoursLeft upwards.
export type RemovalAdvice = {
  recommendation: Recommendation;
  reason: string;
  globalRatio: string | null;
  host: string | null;
  requiredHours: number | null;
  // The tracker's own seed-time rule, without the margin; null whenever requiredHours is.
  ruleHours: number | null;
  seededHours: number | null;
  hoursLeft: number | null;
  detail: string;
};
type Margins = { timeFactor: number; extraHours: number; ratioExtra: number; globalRatioFactor: number };

// The margins the owner accepted in AA-24 (How the delete recommendation judges hit and run).
const DEFAULT_MARGINS: Margins = { timeFactor: 1.1, extraHours: 6, ratioExtra: 0.05, globalRatioFactor: 1.25 };

// A margin may only tighten the rule: a factor below 1 or a negative extra would recommend removal too early.
// Margins left out keep their default.
export const parseMargins = (value: unknown): Margins | { field: string | null; reason: string } => {
  if (!isRecord(value)) return { field: null, reason: 'the margins must be a JSON object' };
  for (const [key, number] of Object.entries(value)) {
    if (!Object.hasOwn(DEFAULT_MARGINS, key)) return { field: key, reason: `${key} is not a margin` };
    const least = key.endsWith('Factor') ? 1 : 0;
    if (typeof number !== 'number' || !Number.isFinite(number) || number < least) return { field: key, reason: `${key} must be a number of ${least} or more` };
  }
  return { ...DEFAULT_MARGINS, ...value } as Margins;
};

// An invalid saved margin throws rather than falling back to the defaults.
export const readMargins = (database: DatabaseSync, host: string): Margins => {
  const stored = getSetting(database, 'trackerConfiguration', `margins.${host}`);
  if (stored === undefined) return DEFAULT_MARGINS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    parsed = undefined;
  }
  const margins = parseMargins(parsed);
  if ('reason' in margins) throw new Error(`The saved hit and run margins for ${host} are not valid.`);
  return margins;
};

export const saveMargins = (database: DatabaseSync, host: string, margins: Margins | null) => (margins === null
  ? deleteSetting(database, 'trackerConfiguration', `margins.${host}`)
  : setSetting(database, 'trackerConfiguration', `margins.${host}`, JSON.stringify(margins)));

const hours = (value: number) => (Math.ceil(value) === 1 ? '1 hour' : `${Math.ceil(value)} hours`);
// Rounded down, so a ratio of 1.049 reads 1.04 and never looks like it meets 1.05.
const ratioText = (value: number) => (Math.floor(value * 100 + 1e-9) / 100).toFixed(2);
const twoPlaces = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);


type Verdict = { recommendation: Recommendation; reason: string; detail: string; requiredHours: number | null; hoursLeft: number | null };

const plain = (recommendation: Recommendation, reason: string, requiredHours: number | null = null): Verdict => (
  { recommendation, reason, detail: reason, requiredHours, hoursLeft: null }
);
const prefixed = (recommendation: Recommendation, prefix: string, detail: string, hoursLeft: number | null = null, requiredHours: number | null = null): Verdict => (
  { recommendation, reason: `${prefix}: ${detail}`, detail, requiredHours, hoursLeft }
);

// "Safe" is only ever proven by media-manager-2's own seeding counter (which can only undercount), by the ratio, or by
// the tracker's exemption for a torrent stopped under its partial-download line; time since the download finished can only overcount, so it can rule removal out but never in.
const factsOf = (torrent: Torrent) => ({
  seedHours: torrent.seedingSeconds / 3600,
  ratio: torrent.ratioThousandths / 1000,
  sizeBytes: torrent.sizeBytes,
  completedBytes: torrent.completedBytes,
});

const judge = (torrent: Torrent, rule: HitAndRunRule, host: string, margins: Margins, now: number): Verdict => {
  const facts = factsOf(torrent);
  // Rounded to whole seconds and to rTorrent's thousandths, so 0.9 + 0.05 is 0.95 and not 0.9500000000000001.
  const withMarginHours = (required: number) => Math.round(Math.max(required * margins.timeFactor, required + margins.extraHours) * 3600) / 3600;
  const withMarginRatio = (required: number) => Math.round((required + margins.ratioExtra) * 1000) / 1000;
  const base = checkHitAndRun(rule, facts);

  if (base.case === 'under_buffer') {
    // A running download may still cross the exemption line.
    if (torrent.started && torrent.active) return plain('keep', 'Still downloading');
    return plain('safe', `Under ${Math.round((rule.partial.exemptBelow ?? 0) * 100)}% downloaded; not a hit and run on ${host}`);
  }

  if (base.case === 'partial') {
    if (rule.partial.ratio === null && rule.partial.maxHours === null) {
      return plain('keep', `Download not complete; ${host} counts seed time only at 100%`);
    }
    const partialHours = rule.partial.maxHours === null ? null : withMarginHours(rule.partial.maxHours);
    const neededRatio = rule.partial.ratio === null ? null : withMarginRatio(rule.partial.ratio);
    // The seeding counter never runs for an incomplete torrent, so only the ratio can make it safe.
    if (neededRatio !== null && checkHitAndRun({ ...rule, partial: { ...rule.partial, ratio: neededRatio } }, facts).ratio === true) {
      return plain('safe', `Partly downloaded: ratio ${ratioText(facts.ratio)} of ${ratioText(neededRatio)} on the data downloaded`, partialHours);
    }
    const ways = [
      neededRatio === null ? null : `at ratio ${ratioText(neededRatio)} of the data downloaded (now ${ratioText(facts.ratio)})`,
      partialHours === null ? null : `after ${Math.ceil(partialHours / 24)} days seeding, which isn't measured yet`,
    ].filter((way) => way !== null);
    return plain('keep', `Partly downloaded: clears ${ways.join(' or ')}`, partialHours);
  }

  const { requiredHours } = base;
  if (requiredHours === null) return prefixed('unconfirmed', "Can't tell; keep seeding", `the rule for ${host} sets no seed time`);
  const neededHours = withMarginHours(requiredHours);
  const neededRatio = rule.ratio === null ? null : withMarginRatio(rule.ratio);
  const strict: HitAndRunRule = neededRatio === null
    ? { ...rule, seedHours: [{ hours: neededHours }], ratio: null, logic: null }
    : { ...rule, seedHours: [{ hours: neededHours }], ratio: neededRatio, logic: rule.logic ?? 'or' };
  const result = checkHitAndRun(strict, facts);
  const ratioPart = neededRatio === null ? null : `ratio ${ratioText(facts.ratio)} of ${ratioText(neededRatio)}`;

  if (result.met) {
    const metParts = [
      result.hours ? `seeded ${hours(facts.seedHours)} of ${hours(neededHours)} needed with margin` : null,
      result.ratio === true ? ratioPart : null,
    ].filter((part) => part !== null);
    return prefixed('safe', 'Hit and run rule met', metParts.join(rule.logic === 'and' ? ' and ' : ', '), 0, neededHours);
  }
  const hoursLeft = neededHours - facts.seedHours;
  // A torrent first seen after it finished has seeding the counter never saw.
  const counted = torrent.firstSeenAt <= torrent.finishedAtSeconds * 1000;
  const sinceFinished = (now - torrent.finishedAtSeconds * 1000) / 3_600_000;
  const ratioBlocks = rule.logic === 'and' && result.ratio === false;
  const timeUnproven = !result.hours && !counted && sinceFinished >= requiredHours;
  let timePart: string | null = null;
  if (!result.hours) {
    if (counted) timePart = `${hours(hoursLeft)} of seeding left`;
    else if (!timeUnproven) timePart = `at least ${hours(neededHours - sinceFinished)} of seeding left`;
    else timePart = `seeding time not confirmed: up to ${hours(sinceFinished)} since it finished (upper estimate, includes time not seeding); confirmed in ${hours(hoursLeft)} if it keeps seeding`;
  }
  const leftParts = [timePart, result.ratio === false ? `${ratioPart} needed` : null].filter((part) => part !== null);
  const recommendation = timeUnproven && !ratioBlocks ? 'unconfirmed' : 'keep';
  return prefixed(recommendation, recommendation === 'keep' ? 'Keep seeding' : "Can't confirm yet; keep seeding", leftParts.join(rule.logic === 'and' ? ' and ' : ', or '), Math.ceil(Math.max(0, hoursLeft) * 100 - 1e-9) / 100, neededHours);
};

export const adviseRemoval = async (
  database: DatabaseSync,
  hash: string,
  options: { now: number; accountStats(host: string): Promise<TrackerAccountStats | null> },
): Promise<RemovalAdvice> => {
  const torrent = listTorrents(database).find((row) => row.hash === hash);
  const unjudged = (verdict: Verdict, seededHours: number | null): RemovalAdvice => ({
    recommendation: verdict.recommendation, reason: verdict.reason, globalRatio: null,
    host: torrent?.trackerHost || null, requiredHours: null, ruleHours: null, seededHours, hoursLeft: null, detail: verdict.detail,
  });
  if (torrent === undefined || torrent.goneAt !== null) return unjudged(plain('keep', 'Seeding time unknown (torrent not in rTorrent)'), null);
  const seededHours = twoPlaces(torrent.seedingSeconds / 3600);
  // A magnet still fetching its metadata reports size 0, which every rule would read as complete.
  if (torrent.sizeBytes === 0) return unjudged(plain('keep', "Waiting for the torrent's metadata; nothing downloaded yet"), seededHours);
  const found = torrent.trackerHost === null || torrent.trackerHost === '' ? undefined : findTrackerRule(database, torrent.trackerHost);
  if (found === undefined) {
    const why = torrent.trackerHost ? `no hit and run rule for ${torrent.trackerHost}` : 'its tracker is not known';
    return unjudged(prefixed('unconfirmed', "Can't tell; keep seeding", why), seededHours);
  }

  const { host, rule } = found;
  const margins = readMargins(database, host);
  const verdict = judge(torrent, rule, host, margins, options.now);
  const { reason, detail, requiredHours, hoursLeft } = verdict;
  let { recommendation } = verdict;
  let globalRatio: string | null = null;
  const account = await options.accountStats(host);
  // A Gazelle site reports the account's own required ratio, which beats the rule's.
  const minimum = account?.requiredRatio ?? rule.minGlobalRatio;
  if (minimum !== null) {
    const ratio = account?.ratio ?? null;
    if (ratio === null) globalRatio = `Global ratio unknown: your ${host} ratio can't be read`;
    else if (ratio < minimum * margins.globalRatioFactor) {
      globalRatio = `Keep for ratio: your ${host} ratio is ${ratioText(ratio)}, minimum ${minimum}`;
      recommendation = 'keep';
    }
  }
  const asked = checkHitAndRun(rule, factsOf(torrent)).requiredHours;
  const ruleHours = requiredHours === null || asked === null ? null : twoPlaces(asked);
  return { recommendation, reason, globalRatio, host, requiredHours: twoPlaces(requiredHours), ruleHours, seededHours, hoursLeft, detail };
};
