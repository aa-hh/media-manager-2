import type { DatabaseSync } from 'node:sqlite';
import type { Release, ReleaseTarget, StoredSearch } from './releases.js';
import { type ArrServices, type FileDetail, valueOrThrow } from './services/arr.js';
import { listGrabs } from './torrentGrabs.js';
import { listTorrents } from './torrents.js';
import { listCooldowns } from './trackers.js';
import { checkHitAndRun, findTrackerRule, type HitAndRunRule } from './trackerRules.js';

export type Compared = 'better' | 'same' | 'worse';
export type AudioHdr = { audio: string | null; hdr: string | null };
type Rule = { host: string; hours: number | null; ratio: number | null; logic: 'and' | 'or' | null };

export type OwnedFile = {
  quality: string | null;
  releaseTitle: string | null;
  releaseGroup: string | null;
  size: number;
  customFormatScore: number | null;
  qualityCutoffNotMet: boolean;
  audio: string | null;
  hdr: string | null;
  hitAndRun: (Rule & {
    // media-manager-2's own seeding counter, which only ever undercounts; rTorrent keeps no seed time.
    seededHours: number;
    currentRatio: number;
    met: boolean;
  }) | null;
};

export type DescribedRelease = Release & AudioHdr & {
  compared: Compared | null;
  hitAndRun: (Rule & { cooldown: boolean; cooldownSince: number | null }) | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const qualityName = (value: unknown) => (isRecord(value) && isRecord(value.quality) ? value.quality.name : undefined);

// Sonarr and Radarr both weigh a release as its quality's top-level position in the profile × 100 + revision.real × 10
// + revision.version; a quality inside a group takes the group's position.
export const qualityWeightOf = (
  profileItems: unknown,
  name: string | null,
  revision: { real: number | null; version: number | null },
): number | null => {
  if (!Array.isArray(profileItems) || name === null || revision.real === null || revision.version === null) return null;
  const index = profileItems.findIndex((item) => (
    qualityName(item) === name || (isRecord(item) && Array.isArray(item.items) && item.items.some((inner) => qualityName(inner) === name))
  ));
  return index === -1 ? null : index * 100 + revision.real * 10 + revision.version;
};

// Weight decides first; equal weights fall back to custom format score, unless the owned file has none.
export const compareToOwned = (
  release: { qualityWeight?: number | null; customFormatScore: number },
  owned: { qualityWeight: number | null; customFormatScore: number | null },
): Compared | null => {
  const weight = release.qualityWeight ?? null;
  if (weight === null || owned.qualityWeight === null) return null;
  const difference = weight - owned.qualityWeight || (owned.customFormatScore === null ? 0 : release.customFormatScore - owned.customFormatScore);
  return difference > 0 ? 'better' : difference < 0 ? 'worse' : 'same';
};

// Checked in this order, so DTS-HD wins over DTS and DDP over DD.
const codecs: Array<[RegExp, string]> = [
  [/truehd(?![a-z])/i, 'TrueHD'],
  [/dts[-. ]?hd(?:[-. ]?(?:ma|hra))?(?![a-z])/i, 'DTS-HD'],
  [/dts[-.: ]?x(?![a-z0-9])/i, 'DTS-X'],
  [/(?:ddp|dd\+|e-?ac-?3)(?![a-z])/i, 'DDP'],
  [/(?:dd|ac-?3)(?![a-z+])/i, 'DD'],
  [/dts(?![a-z])/i, 'DTS'],
  [/aac(?![a-z])/i, 'AAC'],
  [/flac(?![a-z])/i, 'FLAC'],
  [/opus(?![a-z])/i, 'Opus'],
  [/l?pcm(?![a-z])/i, 'LPCM'],
];
const at = (pattern: RegExp, title: string) => new RegExp(`(?<![a-z0-9])(?:${pattern.source})`, 'i').exec(title);
const channelsAfter = (title: string, match: RegExpExecArray | null) => (
  match === null ? null : /^[-. ]?(\d\.\d)(?!\d)/.exec(title.slice(match.index + match[0].length))?.[1] ?? null
);

export const audioHdrFromTitle = (title: string): AudioHdr => {
  let codec: { name: string; match: RegExpExecArray } | undefined;
  for (const [pattern, name] of codecs) {
    const match = at(pattern, title);
    if (match !== null) {
      codec = { name, match };
      break;
    }
  }
  const atmos = at(/atmos(?![a-z])/, title);
  const channels = channelsAfter(title, codec?.match ?? null) ?? channelsAfter(title, atmos);
  const name = atmos !== null ? 'Atmos' : codec?.name;
  const hdr10 = at(/hdr10(?![+0-9a-z])/, title) !== null;
  const hdr10Plus = at(/hdr10(?:\+|plus)/, title) !== null;
  const hdr = [
    at(/(?:dv|dovi|dolby[-. ]?vision)(?![a-z0-9])/, title) !== null && 'DV',
    hdr10Plus && 'HDR10+',
    hdr10 && 'HDR10',
    !hdr10 && !hdr10Plus && at(/hdr(?![a-z0-9+])/, title) !== null && 'HDR',
    at(/hlg(?![a-z0-9])/, title) !== null && 'HLG',
  ].filter((part): part is string => part !== false);
  return {
    audio: name === undefined ? null : channels === null ? name : `${name} ${channels}`,
    hdr: hdr.length === 0 ? null : hdr.join(' '),
  };
};

// Sonarr and Radarr describe a file in the same words a release title uses ("EAC3 Atmos", "DTS-HD MA", "DV HDR10",
// "HDR10Plus"), so the file's media info goes through the title reader; an unrecognised codec is shown as given.
export const audioHdrFromMediaInfo = (info: FileDetail['mediaInfo']): AudioHdr => {
  if (info === null) return { audio: null, hdr: null };
  const parsed = audioHdrFromTitle([info.audioCodec, info.audioChannels?.toFixed(1), info.videoDynamicRangeType].filter((part) => part != null).join(' '));
  return { audio: parsed.audio ?? info.audioCodec, hdr: parsed.hdr };
};

// A seed-time table's ln term can land a hair above a whole hour (PrivateHD's log row starts at 172.0000005 h), so round off float noise before rounding up.
const roundUp = (hours: number | null) => (hours === null ? null : Math.ceil(Math.round(hours * 1000) / 1000));
// A release is not downloaded yet, so it is judged as a complete torrent. With no size, only a one-row table without
// per-GB or ln terms gives its hours.
const describeRule = (found: { host: string; rule: HitAndRunRule }, sizeBytes: number | null): Rule => {
  const [first, ...more] = found.rule.seedHours;
  const fixed = more.length === 0 && !first.perGB && !first.lnGB;
  return {
    host: found.host,
    hours: sizeBytes === null && !fixed ? null : roundUp(checkHitAndRun(
      found.rule,
      { seedHours: 0, ratio: 0, sizeBytes: sizeBytes ?? 0, completedBytes: sizeBytes ?? 0 },
    ).requiredHours),
    ratio: found.rule.ratio,
    logic: found.rule.logic,
  };
};

type Owned = OwnedFile & { qualityWeight: number | null };
type RuleLookup = (name: string) => { host: string; rule: HitAndRunRule } | undefined;

const readOwned = async (database: DatabaseSync, services: ArrServices, target: ReleaseTarget, ruleFor: RuleLookup): Promise<Owned | null> => {
  if (target.kind === 'season') return null;
  let file: FileDetail | null;
  let profileId: number | null;
  if (target.kind === 'movie') {
    const movie = valueOrThrow(await services.radarr.movie(target.movieId));
    file = movie.file;
    profileId = movie.qualityProfileId;
  } else {
    const [series, episodes] = await Promise.all([
      services.sonarr.series(target.seriesId),
      services.sonarr.episodes(target.seriesId, { withFiles: true }),
    ]);
    file = valueOrThrow(episodes).find((episode) => episode.id === target.episodeId)?.file ?? null;
    profileId = valueOrThrow(series).qualityProfileId;
  }
  if (file === null) return null;
  if (profileId === null) throw new Error('No quality profile.');
  const profile = await services[target.service].request(`/api/v3/qualityprofile/${profileId}`);
  if (profile.status < 200 || profile.status > 299 || !isRecord(profile.body)) throw new Error('No quality profile.');

  const grab = listGrabs(database)
    .filter((entry) => entry.importedAt !== null && (target.kind === 'movie'
      ? entry.service === 'radarr' && entry.movieId === target.movieId
      : entry.service === 'sonarr' && entry.episodeIds.includes(target.episodeId)))
    .sort((a, b) => b.importedAt! - a.importedAt!)[0];
  const torrent = grab === undefined ? undefined : listTorrents(database).find((entry) => entry.hash.toUpperCase() === grab.hash);
  const found = torrent === undefined ? undefined : ruleFor(torrent.trackerHost || grab!.indexer);
  let hitAndRun: OwnedFile['hitAndRun'] = null;
  if (torrent !== undefined && found !== undefined) {
    const check = checkHitAndRun(found.rule, {
      seedHours: torrent.seedingSeconds / 3600,
      ratio: torrent.ratioThousandths / 1000,
      sizeBytes: torrent.sizeBytes,
      completedBytes: torrent.completedBytes,
    });
    // An incomplete torrent is held to the tracker's incomplete-torrent rule, which clears at either side.
    const ratio = check.case === 'complete' ? found.rule.ratio : check.case === 'partial' ? found.rule.partial.ratio : null;
    const hours = roundUp(check.requiredHours);
    hitAndRun = {
      host: found.host,
      hours,
      ratio,
      logic: check.case === 'complete' ? found.rule.logic : hours !== null && ratio !== null ? 'or' : null,
      seededHours: Math.floor(torrent.seedingSeconds / 3600),
      currentRatio: torrent.ratioThousandths / 1000,
      met: check.met,
    };
  }
  return {
    quality: file.quality,
    releaseTitle: grab?.releaseTitle ?? file.relativePath?.split('/').pop() ?? null,
    releaseGroup: file.releaseGroup,
    size: file.size,
    customFormatScore: file.customFormatScore,
    qualityCutoffNotMet: file.qualityCutoffNotMet,
    ...audioHdrFromMediaInfo(file.mediaInfo),
    hitAndRun,
    qualityWeight: qualityWeightOf(profile.body.items, file.quality, file.revision),
  };
};

// Worked out on every read and never stored, so a comparison or cooldown is never stale. Nothing here may fail the
// response: an upstream failure leaves owned null, and a tracker whose saved rule is invalid shows no rule.
export const describeSearch = async (
  database: DatabaseSync,
  services: ArrServices,
  target: ReleaseTarget,
  search: StoredSearch,
): Promise<StoredSearch & { releases: DescribedRelease[]; owned: OwnedFile | null }> => {
  const rules = new Map<string, ReturnType<RuleLookup>>();
  const ruleFor: RuleLookup = (name) => {
    if (!rules.has(name)) {
      try {
        rules.set(name, findTrackerRule(database, name));
      } catch {
        rules.set(name, undefined);
      }
    }
    return rules.get(name);
  };
  const owned = await readOwned(database, services, target, ruleFor).catch(() => null);
  const cooldowns = listCooldowns(database);
  const releases = search.releases.map((release): DescribedRelease => {
    const found = release.indexer === null ? undefined : ruleFor(release.indexer);
    const cooldown = found === undefined ? undefined : cooldowns.find((entry) => ruleFor(entry.host)?.host === found.host);
    return {
      ...release,
      ...audioHdrFromTitle(release.title),
      compared: owned === null ? null : compareToOwned(release, owned),
      hitAndRun: found === undefined ? null : {
        ...describeRule(found, release.size),
        cooldown: cooldown !== undefined,
        cooldownSince: cooldown?.since ?? null,
      },
    };
  });
  if (owned === null) return { ...search, releases, owned: null };
  const { qualityWeight: _weight, ...shown } = owned;
  return { ...search, releases, owned: shown };
};
