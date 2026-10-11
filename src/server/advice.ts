import type { DatabaseSync } from 'node:sqlite';
import { getSetting } from './settings.js';
import type { Tracker } from './services/trackerAccounts.js';
import { checkHitAndRun, findTrackerRule, type HitAndRunRule, trackerOf } from './trackerRules.js';
import { listTorrents } from './torrents.js';

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

// "Safe" is only ever proven by media-manager-2's own seeding counter (which can only undercount) or by the ratio;
// time since the download finished can only overcount, so it can rule removal out but never in.
export const adviseRemoval = async (
  database: DatabaseSync,
  hash: string,
  options: { now: number; accountRatio(tracker: Tracker): Promise<number | null> },
): Promise<RemovalAdvice> => {
  const torrent = listTorrents(database).find((row) => row.hash === hash);
  if (torrent === undefined || torrent.goneAt !== null) {
    return { recommendation: 'keep', reason: 'Seeding time unknown (torrent not in rTorrent)', globalRatio: null };
  }
  if (!torrent.complete) return { recommendation: 'keep', reason: 'Download not complete in rTorrent', globalRatio: null };
  const found = torrent.trackerHost === null || torrent.trackerHost === '' ? undefined : findTrackerRule(database, torrent.trackerHost);
  if (found === undefined) {
    const why = torrent.trackerHost ? `no hit and run rule for ${torrent.trackerHost}` : 'its tracker is not known';
    return { recommendation: 'unconfirmed', reason: `Can't tell; keep seeding: ${why}`, globalRatio: null };
  }

  const { host, rule } = found;
  const margins = readMargins(database, host);
  // Both checkHitAndRun calls below take these facts; completedBytes is for PrivateHD's partial-download rules.
  const facts = {
    seedHours: torrent.seedingSeconds / 3600,
    ratio: torrent.ratioThousandths / 1000,
    sizeBytes: torrent.sizeBytes,
    completedBytes: torrent.completedBytes,
  };
  const { requiredHours } = checkHitAndRun(rule, facts);
  // Rounded to whole seconds and to rTorrent's thousandths, so 0.9 + 0.05 is 0.95 and not 0.9500000000000001.
  const neededHours = Math.round(Math.max(requiredHours * margins.timeFactor, requiredHours + margins.extraHours) * 3600) / 3600;
  const neededRatio = rule.minRatio === null ? null : Math.round((rule.minRatio + margins.ratioExtra) * 1000) / 1000;
  const strict: HitAndRunRule = neededRatio === null
    ? { ...rule, minHours: neededHours, minHoursFormula: null, minRatio: null, logic: null }
    : { ...rule, minHours: neededHours, minHoursFormula: null, minRatio: neededRatio, logic: rule.logic ?? 'or' };
  const result = checkHitAndRun(strict, facts);
  const ratioPart = neededRatio === null ? null : `ratio ${ratioText(facts.ratio)} of ${ratioText(neededRatio)}`;

  let recommendation: Recommendation;
  let reason: string;
  if (result.met) {
    recommendation = 'safe';
    const metParts = [
      result.hours ? `seeded ${hours(facts.seedHours)} of ${hours(neededHours)} needed with margin` : null,
      result.ratio === true ? ratioPart : null,
    ].filter((part) => part !== null);
    reason = `Hit and run rule met: ${metParts.join(rule.logic === 'and' ? ' and ' : ', ')}`;
  } else {
    const hoursLeft = neededHours - facts.seedHours;
    // A torrent first seen after it finished has seeding the counter never saw.
    const counted = torrent.firstSeenAt <= torrent.finishedAtSeconds * 1000;
    const sinceFinished = (options.now - torrent.finishedAtSeconds * 1000) / 3_600_000;
    const ratioBlocks = rule.logic === 'and' && result.ratio === false;
    const timeUnproven = !result.hours && !counted && sinceFinished >= requiredHours;
    let timePart: string | null = null;
    if (!result.hours) {
      if (counted) timePart = `${hours(hoursLeft)} of seeding left`;
      else if (!timeUnproven) timePart = `at least ${hours(neededHours - sinceFinished)} of seeding left`;
      else timePart = `seeding time not confirmed: up to ${hours(sinceFinished)} since it finished (upper estimate, includes time not seeding); confirmed in ${hours(hoursLeft)} if it keeps seeding`;
    }
    const leftParts = [timePart, result.ratio === false ? `${ratioPart} needed` : null].filter((part) => part !== null);
    recommendation = timeUnproven && !ratioBlocks ? 'unconfirmed' : 'keep';
    reason = `${recommendation === 'keep' ? 'Keep seeding' : "Can't confirm yet; keep seeding"}: ${leftParts.join(rule.logic === 'and' ? ' and ' : ', or ')}`;
  }

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
