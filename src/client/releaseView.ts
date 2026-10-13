// Pure helpers for Pick a release: which releases to list and how each row reads. No runtime imports, so the tests
// can load this file from source.
import type { ChipFitKind } from './components/ui/chip-fit';
import type { ReleaseState } from './components/ui/chip-release-state';
import type { SubjectProgress } from './library/progress';
import type { ReleaseTarget } from './PickRelease';

type PastEvent = { kind: 'grabbed' | 'failed' | 'blocklisted'; at: string | null };

/**
 * Splits a search into the releases to list and those Sonarr or Radarr matched to something else. Their own flag decides;
 * a search stored before the flag was kept falls back to the episodes Sonarr mapped, and a release with neither is listed.
 */
export const visibleReleases = <T extends { episodeRequested?: boolean; movieRequested?: boolean; episodeIds?: number[] }>(
  target: ReleaseTarget,
  releases: T[],
  episodes: Array<{ id: number; seasonNumber: number }>,
) => {
  const listed = (release: T) => {
    if (target.kind === 'movie') return release.movieRequested !== false;
    if (release.episodeRequested !== undefined) return release.episodeRequested;
    const ids = release.episodeIds ?? [];
    if (ids.length === 0) return true;
    return target.kind === 'episode'
      ? ids.includes(target.episodeId)
      : ids.some((id) => episodes.find((episode) => episode.id === id)?.seasonNumber === target.seasonNumber);
  };
  return { shown: releases.filter(listed), hidden: releases.filter((release) => !listed(release)) };
};

/**
 * The release name in three parts for the release cell: the start up to SxxExx (a movie's up to its year), the middle,
 * which is the part cut when the name does not fit, and the group from the last dash on, the dash included.
 */
export const splitReleaseName = (title: string, kind: ReleaseTarget['kind']): { head: string; middle: string; group?: string } => {
  const dash = title.lastIndexOf('-');
  const grouped = dash > 0 && dash < title.length - 1;
  const name = grouped ? title.slice(0, dash) : title;
  // A movie's head runs to the last year, so a year in the title (Blade.Runner.2049.2017) stays in it.
  const head = (kind === 'movie' ? /^.*\(?(?:19|20)\d{2}\)?/ : /^.*?S\d{1,2}(?:E\d{1,3})*/i).exec(name)?.[0] ?? '';
  return { head, middle: name.slice(head.length), group: grouped ? title.slice(dash) : undefined };
};

/** A Sonarr or Radarr quality name as the quality cell shows it: the resolution, then the source, such as 1080p and WEB-DL. */
export const qualityParts = (name: string | null): { resolution: string; source?: string } => {
  if (name === null) return { resolution: '–' };
  const match = /\d{3,4}[pi]/.exec(name);
  if (match === null) return { resolution: name };
  const before = name.slice(0, match.index).replace(/[-\s]+$/, '');
  const after = name.slice(match.index + match[0].length).replace(/^[-\s]+/, '');
  const source = [before, after].filter((part) => part !== '').join(' ').replace(/WEBDL/i, 'WEB-DL');
  return source === '' ? { resolution: match[0] } : { resolution: match[0], source };
};

/** The format tags for a release or file: the audio first, then each picture format. */
export const formatsOf = (audio: string | null | undefined, hdr: string | null | undefined) => [
  ...(audio == null || audio === '' ? [] : [audio]),
  ...(hdr == null ? [] : hdr.split(' ').filter((part) => part !== '')),
];

const pastText = (event: PastEvent) => {
  const when = event.at === null ? '' : ` on ${new Date(event.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  return event.kind === 'grabbed' ? `Grabbed before${when}` : event.kind === 'failed' ? `Failed before${when}` : `Blocklisted${when}`;
};

/** The worst earlier event for the history mark: blocklisted beats failed beats grabbed. */
export const historyOf = (past: PastEvent[]) => {
  const worst = (['blocklisted', 'failed', 'grabbed'] as const)
    .map((kind) => past.find((event) => event.kind === kind))
    .find((event) => event !== undefined);
  return worst === undefined ? undefined : { kind: worst.kind, tooltip: pastText(worst) };
};

const scoreText = (score: number) => (score > 0 ? `+${score}` : score < 0 ? `−${Math.abs(score)}` : '0');

/** The fit chip for a release: rejected, the best (with its score, or a star when no scores exist), or its score; nothing when no scores exist. */
export const fitKindOf = (
  release: { approved: boolean; customFormatScore: number },
  best: boolean,
  scores: boolean,
): { kind: ChipFitKind; text?: string } | undefined => {
  if (!release.approved) return { kind: 'rejected' };
  if (best) return scores ? { kind: 'best', text: scoreText(release.customFormatScore) } : { kind: 'best-star' };
  if (!scores) return undefined;
  return { kind: release.customFormatScore < 0 ? 'negative' : 'score', text: scoreText(release.customFormatScore) };
};

// razor: the client has no profile flag, so a list where every release has no formats and a zero score reads as "no
// scores"; a flag the server sends from the quality profile's formatItems would say it for certain.
/** Whether the list has custom format scores to show at all. */
export const scoresExist = (releases: Array<{ customFormats: string[]; customFormatScore: number }>) => (
  releases.some((release) => release.customFormats.length > 0 || release.customFormatScore !== 0)
);

/** A grabbed release's chip from the subject's live progress; without any, it stays Grabbed. */
export const releaseStateOf = (live: SubjectProgress | undefined): { state: ReleaseState; percent?: number } => {
  if (live === undefined) return { state: 'grabbed' };
  if (live.word === 'import blocked') return { state: 'import-blocked' };
  if (live.word === 'stalled' || live.word === 'error') return { state: 'stalled', percent: live.percent ?? 0 };
  if (live.word === 'importing' || live.word === 'waiting to import' || live.word === 'seeding') return { state: 'importing' };
  if (live.percent !== null) return { state: 'downloading', percent: live.percent };
  return { state: 'grabbed' };
};

/** Bytes as the size column writes them: 4.1 GB, or 850 MB under a gigabyte. */
export const formatSize = (bytes: number | null) => {
  if (bytes === null) return '';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.round(bytes / 1e6)} MB`;
};

/** "Season 2", or "Specials" for season 0. */
export const seasonName = (number: number) => (number === 0 ? 'Specials' : `Season ${number}`);
