import type { DatabaseSync } from 'node:sqlite';
import type { Subject } from './problems.js';
import { findGrab, type Service } from './torrentGrabs.js';
import { listTorrents } from './torrents.js';

type ArrRequest = (path: string) => Promise<{ status: number; body: unknown }>;

const record = (body: unknown): Record<string, unknown> | undefined =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : undefined;

const code = (season: unknown, episode: unknown) => `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;

// Titles in words for subjects that only carry ids; a lookup that fails falls back to the id and is tried again next time.
export const createLabels = (arr: Record<Service, { request: ArrRequest }>) => {
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
    const { status, body } = await arr.radarr.request(`/api/v3/movie/${movieId}`);
    const value = record(body);
    if (status < 200 || status > 299 || typeof value?.title !== 'string') return undefined;
    return `${value.title} (${String(value.year)})`;
  });

  const episode = (episodeId: number) => lookup(`sonarr:episode:${episodeId}`, `Sonarr episode ${episodeId}`, async () => {
    const { status, body } = await arr.sonarr.request(`/api/v3/episode/${episodeId}`);
    const value = record(body);
    const series = record(value?.series);
    if (status < 200 || status > 299 || value === undefined || typeof series?.title !== 'string') return undefined;
    return `${series.title} ${code(value.seasonNumber, value.episodeNumber)}`;
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
    return listTorrents(database).find((torrent) => torrent.hash.toUpperCase() === hash)?.name ?? target.id;
  };

  return { movie, episode, subject };
};
