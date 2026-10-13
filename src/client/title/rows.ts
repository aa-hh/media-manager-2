// Pure helpers for the title pages. No runtime imports so the tests can load this file from source.
import type { EpisodeDetail, MovieDetail, SeriesDetail } from '../library/api';
import type { SubjectProgress } from '../library/progress';

const finales: Record<string, string> = { series: 'Series finale', season: 'Season finale', midseason: 'Midseason finale' };
const pad = (value: number) => String(value).padStart(2, '0');

export const episodeMarks = (episode: EpisodeDetail): string[] => {
  const marks: string[] = [];
  if (episode.episodeNumber === 1 && episode.seasonNumber > 0) marks.push(episode.seasonNumber === 1 ? 'Series premiere' : 'Premiere');
  const finale = episode.finaleType === null ? undefined : finales[episode.finaleType];
  if (finale !== undefined) marks.push(finale);
  const revision = episode.file?.revision;
  if (revision !== undefined) {
    if (revision.isRepack) marks.push('Repack');
    else if (revision.version > 1) marks.push('Proper');
    if (revision.real > 0) marks.push('Real');
  }
  const { sceneSeasonNumber, sceneEpisodeNumber } = episode;
  if (sceneSeasonNumber !== null && sceneEpisodeNumber !== null
    && (sceneSeasonNumber !== episode.seasonNumber || sceneEpisodeNumber !== episode.episodeNumber)) {
    marks.push(`Scene S${pad(sceneSeasonNumber)}E${pad(sceneEpisodeNumber)}`);
  }
  if (episode.unverifiedSceneNumbering) marks.push('Scene numbering unverified');
  return marks;
};

const aired = (episode: { airDate: string | null }, now: number) => {
  const time = episode.airDate === null ? Number.NaN : Date.parse(episode.airDate);
  return !Number.isNaN(time) && time <= now;
};

export const seasonAiredState = (episodes: EpisodeDetail[], now: number): 'aired' | 'airing' | 'upcoming' => {
  const count = episodes.filter((episode) => aired(episode, now)).length;
  if (count === 0) return 'upcoming';
  return count === episodes.length ? 'aired' : 'airing';
};

export const seasonMonitoredState = (episodes: Array<{ monitored: boolean }>): 'all' | 'none' | 'mixed' => {
  const count = episodes.filter((episode) => episode.monitored).length;
  if (count === 0) return 'none';
  return count === episodes.length ? 'all' : 'mixed';
};

const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });
const month = new Intl.DateTimeFormat('en-GB', { month: 'short' });

// First to last air date in the season, short enough for its 104 px column: "22 Aug – 24 Oct" this year,
// "Jan – Mar 2024" in another year, "Dec 2025 – Jan 2026" across years.
export const seasonAirDates = (episodes: Array<{ airDate: string | null }>, now: number): string => {
  const times = episodes.map((episode) => (episode.airDate === null ? Number.NaN : Date.parse(episode.airDate))).filter((time) => !Number.isNaN(time));
  if (times.length === 0) return '';
  const first = new Date(Math.min(...times));
  const last = new Date(Math.max(...times));
  const span = (a: string, b: string) => (a === b ? a : `${a} – ${b}`);
  if (first.getFullYear() !== last.getFullYear()) return span(monthYear.format(first), monthYear.format(last));
  if (first.getFullYear() === new Date(now).getFullYear()) return span(dayMonth.format(first), dayMonth.format(last));
  return first.getMonth() === last.getMonth() ? monthYear.format(first) : `${month.format(first)} – ${monthYear.format(last)}`;
};

// The one quality every file in the season shares, "Mixed" when they differ, empty with no files.
export const seasonQuality = (episodes: EpisodeDetail[]): string => {
  const qualities = new Set(episodes.flatMap((episode) => (episode.file?.quality == null ? [] : [episode.file.quality])));
  if (qualities.size === 0) return '';
  return qualities.size === 1 ? [...qualities][0] : 'Mixed';
};

// `live` is the download the chip's circle follows.
export type SeasonStatus = { label: string; look: 'risk' | 'warning' | 'live' | 'plain'; live?: SubjectProgress };

// One chip for the season: the worst state first with its count, then the files on disk out of the episodes.
export const seasonStatus = (
  episodes: EpisodeDetail[],
  live: (episode: EpisodeDetail) => SubjectProgress | undefined,
  counts: { onDisk: number; total: number },
  now: number,
): SeasonStatus => {
  const of = counts.total === 0 ? '' : ` · ${counts.onDisk} of ${counts.total}`;
  const lives = episodes.flatMap((episode) => { const found = live(episode); return found === undefined ? [] : [found]; });
  const risky = lives.filter((found) => found.tone === 'risk');
  if (risky.length > 0) return { label: `${risky.length} ${risky[0].word}${of}`, look: 'risk', live: risky[0] };
  const missing = episodes.filter((episode) => aired(episode, now) && episode.monitored && !episode.hasFile && live(episode) === undefined).length;
  if (missing > 0) return { label: `${missing} missing${of}`, look: 'warning' };
  if (lives.length > 0) return { label: `${lives.length} ${lives.length === 1 ? lives[0].word : 'downloading'}${of}`, look: 'live', live: lives[0] };
  return { label: `${airedLabels[seasonAiredState(episodes, now)]}${of}`, look: 'plain' };
};

const airedLabels = { aired: 'Aired', airing: 'Airing', upcoming: 'Upcoming' } as const;

const liveWord = (live: SubjectProgress) => (live.percent === null ? live.word : `${live.word} ${live.percent}%`);

// The one state an episode row prints; null when the episode is normal.
export const episodeWord = (episode: EpisodeDetail, live: SubjectProgress | undefined, protectedIds: Set<number>, now: number): string | null => {
  // Sentence case, as the row's status chip reads.
  if (live !== undefined) return liveWord(live).replace(/^./, (first) => first.toUpperCase());
  if (aired(episode, now) && episode.monitored && !episode.hasFile) return 'Missing';
  if (episode.file?.qualityCutoffNotMet === true) return 'Below cutoff';
  if (protectedIds.has(episode.id)) return 'Manual download';
  return null;
};

// Only exceptions are printed; a downloaded movie gets null.
export const movieWord = (movie: Pick<MovieDetail, 'status' | 'hasFile' | 'isAvailable' | 'file'>, live: SubjectProgress | undefined): string | null => {
  if (movie.status === 'deleted') return 'deleted';
  if (live !== undefined) return liveWord(live);
  if (!movie.hasFile) return movie.isAvailable ? 'missing' : 'not available';
  if (movie.file?.qualityCutoffNotMet === true) return 'below cutoff';
  return null;
};

const DAY = 24 * 60 * 60_000;
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// "Fri 21:00" or "3 days ago" when near, else "7 Mar".
export const relativeAirDate = (iso: string | null, now: number): string => {
  const time = iso === null ? Number.NaN : Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const date = new Date(time);
  const diff = time - now;
  if (diff >= 0 && diff < 7 * DAY) {
    return `${weekday.format(date)} ${clock.format(date)}`;
  }
  if (diff < 0 && -diff < 7 * DAY) {
    const hours = Math.floor(-diff / 3_600_000);
    if (hours < 24) return hours === 0 ? 'just now' : `${hours} h ago`;
    const days = Math.floor(-diff / DAY);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dayMonth : dayMonthYear).format(date);
};

export const cutoffLine = (profile: SeriesDetail['qualityProfile']): string | null => {
  if (profile === null) return null;
  return profile.cutoff === null ? `Profile: ${profile.name}` : `Profile: ${profile.name}, cutoff ${profile.cutoff}`;
};
