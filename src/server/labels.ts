import type { DatabaseSync } from 'node:sqlite';
import type { Subject } from './problems.js';
import type { ArrServices } from './services/arr.js';
import { findGrab } from './torrentGrabs.js';
import { listTorrents } from './torrents.js';

const code = (season: unknown, episode: unknown) => `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;

// Titles in words for subjects that only carry ids; a lookup that fails falls back to the id and is tried again next time.
export const createLabels = (arr: ArrServices) => {
  const cache = new Map<string, string>();

  const lookup = async (key: string, fallback: string, read: () => Promise<string | undefined>) => {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let label: string | undefined;
    try {
      label = await read();
    } catch {
      label = undefined;
    }
    if (label === undefined) return fallback;
    cache.set(key, label);
    return label;
  };

  const movie = (movieId: number) => lookup(`radarr:movie:${movieId}`, `Radarr movie ${movieId}`, async () => {
    const result = await arr.radarr.movie(movieId);
    if (result.kind !== 'ok' || result.value.title === '') return undefined;
    const { title, year } = result.value;
    return year === null ? title : `${title} (${year})`;
  });

  const episode = (episodeId: number) => lookup(`sonarr:episode:${episodeId}`, `Sonarr episode ${episodeId}`, async () => {
    const result = await arr.sonarr.episode(episodeId);
    if (result.kind !== 'ok' || result.value.seriesTitle === null) return undefined;
    return `${result.value.seriesTitle} ${code(result.value.seasonNumber, result.value.episodeNumber)}`;
  });

  const subject = async (target: Subject, database: DatabaseSync): Promise<string> => {
    if (target.type === 'movie') return movie(Number(target.id));
    if (target.type === 'episode') return episode(Number(target.id));
    if (target.type !== 'torrent') return target.id;
    const grab = findGrab(database, target.id);
    if (grab?.movieId != null) return movie(grab.movieId);
    if (grab !== undefined && grab.episodeIds.length === 1) return episode(grab.episodeIds[0]);
    if (grab !== undefined && grab.episodeIds.length > 1) return `${await episode(grab.episodeIds[0])} + ${grab.episodeIds.length - 1} more`;
    const hash = target.id.toUpperCase();
    const versions = database.prepare('SELECT movie_id, episode_id FROM second_versions WHERE hash = ? ORDER BY id').all(hash);
    if (versions.length > 0) {
      const first = versions[0].movie_id === null ? await episode(Number(versions[0].episode_id)) : await movie(Number(versions[0].movie_id));
      return `${first}${versions.length > 1 ? ` + ${versions.length - 1} more` : ''} (second version)`;
    }
    return listTorrents(database).find((torrent) => torrent.hash.toUpperCase() === hash)?.name ?? target.id;
  };

  return { movie, episode, subject };
};
