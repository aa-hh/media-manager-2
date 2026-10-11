// Words for second-version rows, the delete dialog and the Downloads advice line. No React, so tests load it from source.
import type { RemovalAdvice, SecondVersion } from '../library/api';
import type { SeedingFact } from '../library/progress';

const whole = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
// Seeded hours round down and required hours up, so a row never looks closer to the rule than it is.
const seededText = (hours: number) => whole(Math.floor(hours));
const neededText = (hours: number) => whole(Math.ceil(hours));

export const seedingText = (fact: SeedingFact) =>
  `${fact.complete ? 'seeding' : 'downloading'} ${Math.floor(fact.seedingSeconds / 3600)} h · ratio ${fact.ratio.toFixed(2)}`;

/** The Seeding column for a second version that is not downloading: rule progress when its tracker has a rule. */
export const versionSeedingText = (version: Pick<SecondVersion, 'seeding' | 'hitAndRun'>) => {
  const rule = version.hitAndRun;
  if (rule?.met) return `seeding ${seededText(rule.seededHours)} h · rule met`;
  if (rule !== null && rule.requiredHours !== null) return `seeding ${seededText(rule.seededHours)} h of ${neededText(rule.requiredHours)} h`;
  if (version.seeding === null) return '';
  return seedingText({ ...version.seeding, trackerHost: version.seeding.trackerHost ?? '' });
};

/** "6 min left", from the server's estimate at the last download rate. */
export const timeLeftText = (seconds: number | null) => {
  if (seconds === null) return '';
  if (seconds < 3600) return `${Math.max(1, Math.ceil(seconds / 60))} min left`;
  if (seconds < 48 * 3600) return `${Math.ceil(seconds / 3600)} h left`;
  return `${Math.ceil(seconds / 86400)} days left`;
};

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const hoursWord = (hours: number) => (Math.ceil(hours) === 1 ? '1 more hour' : `${whole(Math.ceil(hours))} more hours`);

// True when the advice carries the numbers its seed-time wording needs.
const timed = (advice: RemovalAdvice): advice is RemovalAdvice & { seededHours: number; hoursLeft: number } => (
  advice.host !== null && advice.seededHours !== null && advice.hoursLeft !== null && advice.hoursLeft > 0
);

// `tracker` below is the tracker's display name ("PrivateHD"), not the advice's host.
/** "Keep seeding the torrent" choice in the delete dialog. `askedHours` is the tracker's own rule, without the advice's margin. */
export const keepChoiceText = (advice: RemovalAdvice, tracker: string, askedHours: number | null) => {
  if (advice.recommendation === 'safe') return withGlobalRatio('The torrent keeps seeding in rTorrent', advice);
  const asked = askedHours ?? advice.requiredHours;
  const text = timed(advice) && asked !== null
    ? `Recommended: ${tracker} asks ${neededText(asked)} h, seeded ${seededText(advice.seededHours)} h`
    : `Recommended: ${sentence(advice.detail)}`;
  return withGlobalRatio(text, advice);
};

/** "Remove the torrent too" choice in the delete dialog. */
export const removeChoiceText = (advice: RemovalAdvice, tracker: string) => {
  if (advice.recommendation === 'safe') return `Recommended: ${tracker} rule met, ${advice.detail}`;
  if (advice.recommendation === 'unconfirmed') return "The hit and run rule can't be confirmed.";
  // Kept only for the account's global ratio once the rule itself is met.
  if (advice.hoursLeft === 0 && advice.globalRatio !== null) return `${advice.globalRatio}.`;
  return `Breaks the ${tracker} rule`;
};

/** The Downloads remove dialog's hit and run line. */
export const downloadsAdviceText = (advice: RemovalAdvice, tracker: string) => {
  const text = advice.recommendation !== 'safe' && timed(advice)
    ? `${tracker} needs ${hoursWord(advice.hoursLeft)} to avoid a hit and run`
    : sentence(advice.detail);
  return [text, advice.globalRatio].filter((part) => part !== null).join('. ');
};

const withGlobalRatio = (text: string, advice: RemovalAdvice) => (advice.globalRatio === null ? text : `${text}. ${advice.globalRatio}.`);
