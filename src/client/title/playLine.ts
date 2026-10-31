// Pure helpers for Play on the movie and show pages (title.pen NIjoo, p6VuR, OJb8g). The only runtime import is
// library/watch.ts, which has none itself, so the tests can load this file from source with that one import swapped.
import type { EpisodeDetail, MovieWatch, OwnedMovieDetail, Playable, SeriesWatch, TitleWatch } from '../library/api';
import { clockText, minutesText, playMode, watchMarks, type PlayMode } from '../library/watch';

/** The page's Plex watch in the library card's shape, so the card's helpers apply; null unless Plex matched the title. */
export const titleWatch = (watch: SeriesWatch | MovieWatch): TitleWatch => {
  if (watch === null || watch.kind !== 'ok') return null;
  if ('episodes' in watch) return { kind: 'show', ratingKey: watch.ratingKey, leafCount: watch.leafCount, viewedLeafCount: watch.viewedLeafCount, lastViewedAt: null };
  return { kind: 'movie', ratingKey: watch.ratingKey, viewOffsetMs: watch.viewOffsetMs, durationMs: watch.durationMs, viewCount: watch.viewCount, lastViewedAt: watch.lastViewedAt };
};

/** Which Play the page shows: the library card's rule, and none when nothing on the page can play (OJb8g). */
export const titlePlayMode = (mediaServer: 'plex' | 'jellyfin', desktop: boolean, watch: SeriesWatch | MovieWatch, canPlay: boolean): PlayMode => (
  canPlay ? playMode({ mediaServer, desktop, libraryWatch: watch === null ? 'ok' : watch.kind, watch: titleWatch(watch) }) : 'none'
);

/** An episode Plex can play: Sonarr has its file and Plex matched it. */
export const playableEpisode = (episode: EpisodeDetail, watch: SeriesWatch): Playable | undefined => (
  episode.hasFile && watch !== null && watch.kind === 'ok' ? watch.episodes[String(episode.id)] : undefined
);

/** The episode the header plays and whose still glows: Plex's next episode, else the earliest one Plex can play, specials last. */
export const nextEpisode = (episodes: EpisodeDetail[], watch: SeriesWatch): EpisodeDetail | undefined => {
  if (watch === null || watch.kind !== 'ok') return undefined;
  const inPlex = episodes.filter((episode) => playableEpisode(episode, watch) !== undefined);
  const target = watch.nextEpisode;
  if (target !== null) return inPlex.find((episode) => episode.seasonNumber === target.seasonNumber && episode.episodeNumber === target.episodeNumber);
  return [...inPlex].sort((a, b) => (a.seasonNumber === 0 ? 1 : 0) - (b.seasonNumber === 0 ? 1 : 0) || a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)[0];
};

/** Plex's marks for one playable item, by the library card's rules: the watch bar when stopped partway, else a tick when played. */
export const itemMarks = (playable: Playable) => watchMarks({ kind: 'movie', ...playable }, undefined);

const durationOf = (playable: Playable, runtimeMinutes: number | null) => (
  playable.durationMs ?? (runtimeMinutes !== null && runtimeMinutes > 0 ? runtimeMinutes * 60_000 : null)
);

/** The episode row's second line: "31 min left" when stopped partway, "Played", or the runtime. */
export const rowSecondLine = (episode: EpisodeDetail, playable: Playable | undefined): string | null => {
  if (playable !== undefined) {
    const marks = itemMarks(playable);
    if (marks.watched !== undefined) return `${minutesText(playable.durationMs! - playable.viewOffsetMs!)} left`;
    if (marks.watchMark === 'played') return 'Played';
  }
  const ms = playable === undefined ? (episode.runtime !== null && episode.runtime > 0 ? episode.runtime * 60_000 : null) : durationOf(playable, episode.runtime);
  return ms === null ? null : minutesText(ms);
};

/** The header's Play line: the button's words, the two lines beside it, and the saved position the resume menu offers. */
export type HeaderPlay = { label: string; line1: string; line2?: string; resumeAtMs: number | null };

const resumed = (playable: Playable, runtimeMinutes: number | null) => {
  if (itemMarks(playable).watched === undefined) return null;
  const at = playable.viewOffsetMs!;
  const total = durationOf(playable, runtimeMinutes)!;
  return { at, line2: `${minutesText(total - at)} left of ${minutesText(total)}` };
};

/** "Resume S2 E4" / "Stopped at 21:00 · S2 E4 · Woe's Hollow" / "31 min left of 52 min", or "Play S3 E5" with the episode and its length. */
export const seriesPlayLine = (episode: EpisodeDetail, playable: Playable): HeaderPlay => {
  const code = `S${episode.seasonNumber} E${episode.episodeNumber}`;
  const resume = resumed(playable, episode.runtime);
  if (resume !== null) return { label: `Resume ${code}`, line1: `Stopped at ${clockText(resume.at)} · ${code} · ${episode.title}`, line2: resume.line2, resumeAtMs: resume.at };
  const total = durationOf(playable, episode.runtime);
  return { label: `Play ${code}`, line1: `${code} · ${episode.title}`, line2: total === null ? undefined : minutesText(total), resumeAtMs: null };
};

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** The quality of the version Plex plays by default (its highest), matched to Radarr's files by file name. */
export const defaultQuality = (detail: Pick<OwnedMovieDetail, 'file' | 'secondVersions'>, playable: Playable): string | null => {
  const file = playable.versions.find((version) => version.mediaIndex === playable.mediaIndex)?.file;
  const files = [
    ...(detail.file === null || detail.file.relativePath === null ? [] : [{ name: baseName(detail.file.relativePath), quality: detail.file.quality }]),
    ...detail.secondVersions.flatMap((version) => (version.state === 'imported' && version.path !== null ? [{ name: baseName(version.path), quality: version.quality }] : [])),
  ];
  const match = file === undefined ? undefined : files.find((candidate) => candidate.name === baseName(file));
  return match?.quality ?? (playable.versions.length === 1 ? detail.file?.quality ?? null : null);
};

/** "Play" / "2 h 46 min · plays 2160p WEB-DL", or "Resume" / "Stopped at 1:05:09" / "1 h 15 min left of 2 h 46 min". */
export const moviePlayLine = (playable: Playable, runtimeMinutes: number | null, quality: string | null): HeaderPlay => {
  const resume = resumed(playable, runtimeMinutes);
  if (resume !== null) return { label: 'Resume', line1: `Stopped at ${clockText(resume.at)}`, line2: resume.line2, resumeAtMs: resume.at };
  const total = durationOf(playable, runtimeMinutes);
  const count = playable.versions.length;
  return {
    label: 'Play',
    line1: [total === null ? null : minutesText(total), quality === null ? null : `plays ${quality}`].filter((part) => part !== null).join(' · '),
    line2: count > 1 ? `Highest quality of ${count} versions` : undefined,
    resumeAtMs: null,
  };
};
