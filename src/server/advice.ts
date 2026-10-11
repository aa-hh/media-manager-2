import type { DatabaseSync } from 'node:sqlite';
import { getSetting } from './settings.js';
import type { Tracker } from './services/trackerAccounts.js';
import { checkHitAndRun, findTrackerRule, type HitAndRunRule, trackerOf } from './trackerRules.js';
import { listTorrents, type Torrent } from './torrents.js';

export type Recommendation = 'safe' | 'keep' | 'unconfirmed';
export type RemovalAdvice = { recommendation: Recommendation; reason: string; globalRatio: string | null };
type Margins = { timeFactor: number; extraHours: number; ratioExtra: number; globalRatioFactor: number };

// The margins the owner accepted in AA-24 (How the delete recommendation judges hit and run).
const DEFAULT_MARGINS: Margins = { timeFactor: 1.1, extraHours: 6, ratioExtra: 0.05, globalRatioFactor: 1.25 };

// A saved margin may only tighten the rule: a factor below 1 or a negative extra would recommend removal too early,
// so an invalid saved margin throws rather than falling back.
const readMargins = (database: DatabaseSync, host: string): Margins => {
  const stored = getSetting(database, 'trackerConfiguration', `margins.${host}`);
  if (stored === undefined) return DEFAULT_MARGINS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    parsed = undefined;
  }
  const margins = { ...DEFAULT_MARGINS, ...(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : { invalid: true }) };
  const valid = !('invalid' in margins) && Object.entries(margins).every(([key, value]) => key in DEFAULT_MARGINS
    && typeof value === 'number' && Number.isFinite(value) && value >= (key.endsWith('Factor') ? 1 : 0));
  if (!valid) throw new Error(`The saved hit and run margins for ${host} are not valid.`);
  return margins;
};

const hours = (value: number) => (Math.ceil(value) === 1 ? '1 hour' : `${Math.ceil(value)} hours`);
// Rounded down, so a ratio of 1.049 reads 1.04 and never looks like it meets 1.05.
const ratioText = (value: number) => (Math.floor(value * 100 + 1e-9) / 100).toFixed(2);


type Verdict = { recommendation: Recommendation; reason: string };

// "Safe" is only ever proven by media-manager-2's own seeding counter (which can only undercount), by the ratio, or by
// the tracker's exemption for a torrent stopped under its partial-download line; time since the download finished can only overcount, so it can rule removal out but never in.
const judge = (torrent: Torrent, rule: HitAndRunRule, host: string, margins: Margins, now: number): Verdict => {
  const facts = {
    seedHours: torrent.seedingSeconds / 3600,
    ratio: torrent.ratioThousandths / 1000,
    sizeBytes: torrent.sizeBytes,
    completedBytes: torrent.completedBytes,
  };
  // Rounded to whole seconds and to rTorrent's thousandths, so 0.9 + 0.05 is 0.95 and not 0.9500000000000001.
  const withMarginHours = (required: number) => Math.round(Math.max(required * margins.timeFactor, required + margins.extraHours) * 3600) / 3600;
  const withMarginRatio = (required: number) => Math.round((required + margins.ratioExtra) * 1000) / 1000;
  const base = checkHitAndRun(rule, facts);

  if (base.case === 'under_buffer') {
    // A running download may still cross the exemption line.
    if (torrent.started && torrent.active) return { recommendation: 'keep', reason: 'Still downloading' };
    return { recommendation: 'safe', reason: `Under ${Math.round((rule.partialExemptBelow ?? 0) * 100)}% downloaded; not a hit and run on ${host}` };
  }

  if (base.case === 'partial') {
    if (rule.partialRatio === null && rule.partialMaxHours === null) {
      return { recommendation: 'keep', reason: `Download not complete; ${host} counts seed time only at 100%` };
    }
    const neededRatio = rule.partialRatio === null ? null : withMarginRatio(rule.partialRatio);
    // The seeding counter never runs for an incomplete torrent, so only the ratio can make it safe.
    if (neededRatio !== null && checkHitAndRun({ ...rule, partialRatio: neededRatio }, facts).ratio === true) {
      return { recommendation: 'safe', reason: `Partly downloaded: ratio ${ratioText(facts.ratio)} of ${ratioText(neededRatio)} on the data downloaded` };
    }
    const ways = [
      neededRatio === null ? null : `at ratio ${ratioText(neededRatio)} of the data downloaded (now ${ratioText(facts.ratio)})`,
      rule.partialMaxHours === null ? null : `after ${Math.ceil(withMarginHours(rule.partialMaxHours) / 24)} days seeding, which isn't measured yet`,
    ].filter((way) => way !== null);
    return { recommendation: 'keep', reason: `Partly downloaded: clears ${ways.join(' or ')}` };
  }

  const { requiredHours } = base;
  if (requiredHours === null) return { recommendation: 'unconfirmed', reason: `Can't tell; keep seeding: the rule for ${host} sets no seed time` };
  const neededHours = withMarginHours(requiredHours);
  const neededRatio = rule.minRatio === null ? null : withMarginRatio(rule.minRatio);
  const strict: HitAndRunRule = neededRatio === null
    ? { ...rule, minHours: neededHours, minHoursFormula: null, minRatio: null, logic: null }
    : { ...rule, minHours: neededHours, minHoursFormula: null, minRatio: neededRatio, logic: rule.logic ?? 'or' };
  const result = checkHitAndRun(strict, facts);
  const ratioPart = neededRatio === null ? null : `ratio ${ratioText(facts.ratio)} of ${ratioText(neededRatio)}`;

  if (result.met) {
    const metParts = [
      result.hours ? `seeded ${hours(facts.seedHours)} of ${hours(neededHours)} needed with margin` : null,
      result.ratio === true ? ratioPart : null,
    ].filter((part) => part !== null);
    return { recommendation: 'safe', reason: `Hit and run rule met: ${metParts.join(rule.logic === 'and' ? ' and ' : ', ')}` };
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
  return {
    recommendation,
    reason: `${recommendation === 'keep' ? 'Keep seeding' : "Can't confirm yet; keep seeding"}: ${leftParts.join(rule.logic === 'and' ? ' and ' : ', or ')}`,
  };
};

export const adviseRemoval = async (
  database: DatabaseSync,
  hash: string,
  options: { now: number; accountRatio(tracker: Tracker): Promise<number | null> },
): Promise<RemovalAdvice> => {
  const torrent = listTorrents(database).find((row) => row.hash === hash);
  if (torrent === undefined || torrent.goneAt !== null) {
    return { recommendation: 'keep', reason: 'Seeding time unknown (torrent not in rTorrent)', globalRatio: null };
  }
  // A magnet still fetching its metadata reports size 0, which every rule would read as complete.
  if (torrent.sizeBytes === 0) {
    return { recommendation: 'keep', reason: "Waiting for the torrent's metadata; nothing downloaded yet", globalRatio: null };
  }
  const found = torrent.trackerHost === null || torrent.trackerHost === '' ? undefined : findTrackerRule(database, torrent.trackerHost);
  if (found === undefined) {
    const why = torrent.trackerHost ? `no hit and run rule for ${torrent.trackerHost}` : 'its tracker is not known';
    return { recommendation: 'unconfirmed', reason: `Can't tell; keep seeding: ${why}`, globalRatio: null };
  }

  const { host, rule } = found;
  const margins = readMargins(database, host);
  let { recommendation, reason } = judge(torrent, rule, host, margins, options.now);
  let globalRatio: string | null = null;
  if (rule.minGlobalRatio !== null) {
    const tracker = trackerOf(host);
    const ratio = tracker === undefined ? null : await options.accountRatio(tracker);
    if (ratio === null) globalRatio = `Global ratio unknown: your ${host} ratio can't be read`;
    else if (ratio < rule.minGlobalRatio * margins.globalRatioFactor) {
      globalRatio = `Keep for ratio: your ${host} ratio is ${ratioText(ratio)}, minimum ${rule.minGlobalRatio}`;
      recommendation = 'keep';
    }
  }
  return { recommendation, reason, globalRatio };
};
