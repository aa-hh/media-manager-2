// Tracker rules for the settings screen. No runtime imports, so tests can load it from source.
import type { LogoName } from '../components/ui/logo';

// Shapes served by /api/settings/trackers; src/server/trackerSettings.ts and trackerRules.ts are the source of truth.
export type Software = 'unit3d' | 'gazelle' | 'nexusphp' | 'other';
export type SeedRow = { upToGB?: number; hours: number; perGB?: number; lnGB?: number };
export type Rule = {
  seedHours: SeedRow[];
  ratio: number | null;
  logic: 'and' | 'or' | null;
  minGlobalRatio: number | null;
  partial: { exemptBelow: number | null; ratio: number | null; maxHours: number | null };
};
export type Margins = { timeFactor: number; extraHours: number; ratioExtra: number; globalRatioFactor: number };
export type Stats = {
  ratio: number | null;
  uploadedBytes: number | null;
  downloadedBytes: number | null;
  bufferBytes: number | null;
  seeding: number | null;
  leeching: number | null;
  bonus: number | null;
  hitAndRuns: { count: number; kind: 'lifetime' } | null;
  requiredRatio: number | null;
};
export type Connection = { kind: 'ok'; stats: Stats } | { kind: 'not_configured' | 'rejected' | 'unreachable' | 'too_old' | 'unsupported' };
export type TrackerRow = {
  host: string;
  status: 'configured' | 'configured_env' | 'no_rule';
  rule: Rule | null;
  ruleSource: 'settings' | 'env' | null;
  margins: Margins | null;
  problem: string | null;
  software: Software;
  credentialSet: boolean;
  connection: Connection;
  /** Whether TRACKER_RULES in the env file also has a rule for this host; absent means no. */
  envRule?: boolean;
};

export const softwareLabels: Record<Software, string> = { unit3d: 'UNIT3D', gazelle: 'Gazelle', nexusphp: 'NexusPHP', other: 'Other' };

/** The site software choices when adding a tracker. Each line names only what the server reads for that software. */
export const softwareChoices: { software: Software; description: string }[] = [
  { software: 'unit3d', description: 'API token. Reads ratio, upload, download, buffer, seeding, bonus and hit and runs.' },
  { software: 'gazelle', description: 'API key. Reads ratio, required ratio, upload, download and bonus.' },
  { software: 'nexusphp', description: 'API token. Reads ratio, upload, download and bonus.' },
  { software: 'other', description: 'No account connection. Only the hit and run rule is used.' },
];

const known: Record<string, { name: string; logo: LogoName }> = {
  'beyond-hd.me': { name: 'Beyond-HD', logo: 'beyond-hd' },
  'privatehd.to': { name: 'PrivateHD', logo: 'privatehd' },
  'blutopia.cc': { name: 'Blutopia', logo: 'blutopia' },
};

/** The tracker's name and logo as the design shows them; a tracker without a logo goes by its hostname. */
export const trackerInfo = (host: string): { name: string; logo: LogoName | undefined; named: boolean } => {
  const found = known[host];
  return found === undefined ? { name: host, logo: undefined, named: false } : { ...found, named: true };
};

/** "a Beyond-HD torrent" or "a torrent from gazelle.example". */
export const aTorrentOf = (host: string) => {
  const { name, named } = trackerInfo(host);
  return named ? `a ${name} torrent` : `a torrent from ${host}`;
};

/** "every Beyond-HD torrent" or "every torrent from gazelle.example". */
export const everyTorrentOf = (host: string) => {
  const { name, named } = trackerInfo(host);
  return named ? `every ${name} torrent` : `every torrent from ${host}`;
};

export const credentialName = (software: Software) => (software === 'gazelle' ? 'API key' : 'API token');
export const credentialSource = (software: Software) => (software === 'unit3d' ? 'From your profile\'s API key page.' : 'From your account settings on the site.');

// One editable size band, or one kept as it is because the form can't edit a size-based curve.
export type Band = { kind: 'edit'; upToGB: string; hours: string; perGB: string } | { kind: 'locked'; row: SeedRow };

/** The rule form, as typed. Percentages and days are shown as people say them and converted on save. */
export type RuleDraft = {
  bands: Band[];
  ratio: string;
  logic: 'or' | 'and';
  minGlobalRatio: string;
  exemptBelowPercent: string;
  partialRatio: string;
  maxDays: string;
  timePercent: string;
  extraHours: string;
  ratioExtra: string;
  globalPercent: string;
};

// The server's defaults, which it returns for a tracker with no saved margins.
const DEFAULT_MARGINS: Margins = { timeFactor: 1.1, extraHours: 6, ratioExtra: 0.05, globalRatioFactor: 1.25 };

/** A number as typed: no float noise, blank for none. */
export const shown = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(Number(value.toFixed(6))));

/** A ratio keeps one decimal when whole, as the design writes it: 1.0, 0.25. */
const ratioShown = (value: number | null | undefined) => (value !== null && value !== undefined && Number.isInteger(value) ? value.toFixed(1) : shown(value));

const emptyBand: Band = { kind: 'edit', upToGB: '', hours: '', perGB: '' };

export const draftFromRow = (row: TrackerRow): RuleDraft => {
  const rule = row.rule;
  const margins = row.margins ?? DEFAULT_MARGINS;
  return {
    bands: rule === null ? [emptyBand] : rule.seedHours.map((seed): Band => (seed.lnGB !== undefined
      ? { kind: 'locked', row: seed }
      : { kind: 'edit', upToGB: shown(seed.upToGB), hours: shown(seed.hours), perGB: shown(seed.perGB ?? 0) })),
    ratio: ratioShown(rule?.ratio),
    logic: rule?.logic ?? 'or',
    minGlobalRatio: ratioShown(rule?.minGlobalRatio),
    exemptBelowPercent: rule?.partial.exemptBelow == null ? '' : shown(rule.partial.exemptBelow * 100),
    partialRatio: ratioShown(rule?.partial.ratio),
    maxDays: rule?.partial.maxHours == null ? '' : shown(rule.partial.maxHours / 24),
    timePercent: shown((margins.timeFactor - 1) * 100),
    extraHours: shown(margins.extraHours),
    ratioExtra: shown(margins.ratioExtra),
    globalPercent: shown((margins.globalRatioFactor - 1) * 100),
  };
};

/** Adds an empty band at the end, before a kept size-based curve if there is one. */
export const addBand = (bands: Band[]): Band[] => {
  const at = bands.at(-1)?.kind === 'locked' ? bands.length - 1 : bands.length;
  return [...bands.slice(0, at), emptyBand, ...bands.slice(at)];
};

// Blank is null; text that isn't a number is NaN, which notANumber catches before anything is sent. So is a number too
// large to send: JSON writes Infinity as null, which would quietly clear an optional field.
const num = (text: string) => {
  if (text.trim() === '') return null;
  const value = Number(text.trim());
  return Math.abs(value) <= Number.MAX_SAFE_INTEGER ? value : NaN;
};

/** The first typed value that isn't a number, as { field, reason } with the server's field paths; undefined when all are numbers. */
export const notANumber = (draft: RuleDraft): { field: string; reason: string } | undefined => {
  const typed: [string, string][] = [
    ...draft.bands.flatMap((band, index): [string, string][] => (band.kind === 'locked' ? [] : [
      [`seedHours[${index}].upToGB`, band.upToGB], [`seedHours[${index}].hours`, band.hours], [`seedHours[${index}].perGB`, band.perGB],
    ])),
    ['ratio', draft.ratio], ['minGlobalRatio', draft.minGlobalRatio],
    ['partial.exemptBelow', draft.exemptBelowPercent], ['partial.ratio', draft.partialRatio], ['partial.maxHours', draft.maxDays],
    ['margins.timePercent', draft.timePercent], ['margins.extraHours', draft.extraHours], ['margins.ratioExtra', draft.ratioExtra], ['margins.globalPercent', draft.globalPercent],
  ];
  const bad = typed.find(([, text]) => Number.isNaN(num(text)));
  return bad === undefined ? undefined : { field: bad[0], reason: 'Enter a number, such as 0.9 or 72.' };
};

/**
 * The body for PUT /rule, once notANumber passes. A blank required number goes as null so the server's check names
 * its field. A kept curve row goes back unchanged. Margins are left out unless changed, so a save never writes the
 * defaults over nothing.
 */
export const ruleBody = (draft: RuleDraft, original: RuleDraft, keptMinGlobalRatio?: number | null) => {
  const last = draft.bands.length - 1;
  const seedHours = draft.bands.map((band, index) => {
    if (band.kind === 'locked') return band.row;
    const row: Record<string, number | null> = { hours: num(band.hours) };
    if (index !== last) row.upToGB = num(band.upToGB);
    const perGB = num(band.perGB);
    if (perGB !== null && perGB !== 0) row.perGB = perGB;
    return row;
  });
  const ratio = num(draft.ratio);
  const percent = (text: string) => { const value = num(text); return value === null ? null : value / 100; };
  const days = num(draft.maxDays);
  const rule = {
    seedHours,
    ratio,
    logic: ratio === null ? null : draft.logic,
    minGlobalRatio: keptMinGlobalRatio === undefined ? num(draft.minGlobalRatio) : keptMinGlobalRatio,
    partial: { exemptBelow: percent(draft.exemptBelowPercent), ratio: num(draft.partialRatio), maxHours: days === null ? null : days * 24 },
  };
  const marginKeys = ['timePercent', 'extraHours', 'ratioExtra', 'globalPercent'] as const;
  if (marginKeys.every((key) => draft[key].trim() === original[key].trim())) return { rule };
  // A blank margin goes as null, which the server refuses on its field.
  const factor = (text: string) => { const value = num(text); return value === null ? null : 1 + value / 100; };
  return {
    rule,
    margins: { timeFactor: factor(draft.timePercent), extraHours: num(draft.extraHours), ratioExtra: num(draft.ratioExtra), globalRatioFactor: factor(draft.globalPercent) },
  };
};

// The server reports margin problems by their own key; these are the form fields that hold them.
const marginFields: Record<string, keyof RuleDraft> = { timeFactor: 'timePercent', extraHours: 'extraHours', ratioExtra: 'ratioExtra', globalRatioFactor: 'globalPercent' };
/** The form field path a 400 names: rule paths as the server sends them, margins as "margins.<form field>". */
export const problemField = (error: string, field: string | null) => (error === 'invalid_margins' && field !== null && marginFields[field] !== undefined
  ? `margins.${marginFields[field]}`
  : field);

const isDraftEqual = (a: RuleDraft, b: RuleDraft) => JSON.stringify(a) === JSON.stringify(b);
export const isEdited = (draft: RuleDraft, row: TrackerRow) => !isDraftEqual(draft, draftFromRow(row));

/** Whether a no-rule form has anything to save: a seed time or a ratio. */
export const hasAnyRule = (draft: RuleDraft) => draft.bands.some((band) => band.kind === 'locked' || band.hours.trim() !== '') || draft.ratio.trim() !== '';

/** The More line while closed: what the partly downloaded rules and the margins are. */
export const moreSummary = (draft: RuleDraft) => {
  const partial = [
    draft.exemptBelowPercent.trim() !== '' ? `below ${draft.exemptBelowPercent.trim()} %` : '',
    draft.partialRatio.trim() !== '' ? `ratio ${draft.partialRatio.trim()}` : '',
    draft.maxDays.trim() !== '' ? `${draft.maxDays.trim()} days` : '',
  ].filter(Boolean);
  return `Partly downloaded torrents: ${partial.length === 0 ? 'none set' : partial.join(', ')} · Removal advice margin: ${draft.timePercent.trim() || '0'} % seed time, at least ${draft.extraHours.trim() || '0'} h, ratio ${draft.ratioExtra.trim() || '0'}`;
};

export const rulePill = (row: TrackerRow): { text: string; warning: boolean } => (row.status === 'no_rule'
  ? { text: 'No rule', warning: true }
  : { text: row.status === 'configured_env' ? 'Configured (env file)' : 'Configured', warning: false });

/** Whether this tracker has an account connection to check: only some software does. */
export const hasConnection = (row: TrackerRow) => row.software !== 'other';
export const connectionFailed = (row: TrackerRow) => row.connection.kind === 'rejected' || row.connection.kind === 'unreachable';

/** What the trackers add to the Settings header, as model.ts headerSummary takes it. */
export const trackerSummary = (rows: TrackerRow[], adding: boolean) => {
  const counted = rows.filter(hasConnection);
  const name = (row: TrackerRow) => trackerInfo(row.host).name;
  const notes: string[] = [];
  if (adding) notes.push('adding a tracker');
  else if (rows.length === 0) notes.push('no trackers added');
  for (const row of counted) if (row.connection.kind === 'too_old') notes.push(`${name(row)} can't share account stats`);
  const noRule = rows.filter((row) => row.status === 'no_rule');
  if (noRule.length === 1) notes.push(`${name(noRule[0])} has no hit and run rule`);
  if (noRule.length > 1) notes.push(`${noRule.length} trackers have no hit and run rule`);
  // One note at most, the first in this order, so the header stays one line.
  return { failed: counted.filter(connectionFailed).map(name), notes: notes.slice(0, 1) };
};

/** The failure words a pill shows, as for services. */
export const connectionFailure = (row: TrackerRow) => (row.connection.kind === 'rejected'
  ? `Failed: ${credentialName(row.software)} refused`
  : 'Failed: no answer in 10 s');

const bytes = (value: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = value;
  let unit = 0;
  // A buffer below zero is scaled by its size too.
  while (Math.abs(size) >= 1000 && unit < units.length - 1) { size /= 1000; unit += 1; }
  return `${unit === 0 ? size : size.toPrecision(3)} ${units[unit]}`;
};

/** The account's numbers the software reported, in display order; a number the software doesn't report is left out. */
export const statFacts = (stats: Stats): { label: string; value: string }[] => [
  { label: 'Ratio', value: stats.ratio === null ? null : stats.ratio.toFixed(2) },
  { label: 'Required ratio', value: stats.requiredRatio === null ? null : stats.requiredRatio.toFixed(2) },
  { label: 'Upload', value: stats.uploadedBytes === null ? null : bytes(stats.uploadedBytes) },
  { label: 'Download', value: stats.downloadedBytes === null ? null : bytes(stats.downloadedBytes) },
  { label: 'Buffer', value: stats.bufferBytes === null ? null : bytes(stats.bufferBytes) },
  { label: 'Seeding', value: stats.seeding === null ? null : stats.seeding.toLocaleString('en-US') },
  { label: 'Bonus', value: stats.bonus === null ? null : Math.round(stats.bonus).toLocaleString('en-US') },
  { label: 'Hit and runs, lifetime', value: stats.hitAndRuns === null ? null : stats.hitAndRuns.count.toLocaleString('en-US') },
].filter((fact): fact is { label: string; value: string } => fact.value !== null);
