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

const liveWord = (live: SubjectProgress) => (live.percent === null ? live.word : `${live.word} ${live.percent}%`);

// The one state an episode row prints; null when the episode is normal.
export const episodeWord = (episode: EpisodeDetail, live: SubjectProgress | undefined, protectedIds: Set<number>, now: number): string | null => {
  if (live !== undefined) return liveWord(live);
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

// "Fri 21:00" or "3 days ago" when near, else "7 Mar".
export const relativeAirDate = (iso: string | null, now: number): string => {
  const time = iso === null ? Number.NaN : Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const date = new Date(time);
  const diff = time - now;
  if (diff >= 0 && diff < 7 * DAY) {
    const day = date.toLocaleDateString('en-GB', { weekday: 'short' });
    const clock = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} ${clock}`;
  }
  if (diff < 0 && -diff < 7 * DAY) {
    const hours = Math.floor(-diff / 3_600_000);
    if (hours < 24) return hours === 0 ? 'just now' : `${hours} h ago`;
    const days = Math.floor(-diff / DAY);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-GB', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};

export const cutoffLine = (profile: SeriesDetail['qualityProfile']): string | null => {
  if (profile === null) return null;
  return profile.cutoff === null ? `Profile: ${profile.name}` : `Profile: ${profile.name}, cutoff ${profile.cutoff}`;
};
