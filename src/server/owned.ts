import { Hono } from 'hono';
import type { createArr } from './services/arr.js';

type Arr = Pick<ReturnType<typeof createArr>, 'request' | 'configured'>;

// What Pick a release needs to know about a title already in Sonarr or Radarr: which
// episodes exist (for picking and overrides) and whether each target already has a file,
// which decides whether a grab asks Replace or Second version.
export type OwnedEpisode = {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  airDate: string | null;
  monitored: boolean;
  hasFile: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const wholeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

type Result<T> = { kind: 'ok'; value: T } | { kind: 'not_configured' | 'unreachable' | 'rejected' | 'not_found' };

const read = async (service: Arr, path: string): Promise<Result<unknown>> => {
  if (!service.configured()) return { kind: 'not_configured' };
  let response: { status: number; body: unknown };
  try {
    response = await service.request(path);
  } catch {
    return { kind: 'unreachable' };
  }
  if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
  if (response.status === 404) return { kind: 'not_found' };
  if (response.status < 200 || response.status > 299) return { kind: 'unreachable' };
  return { kind: 'ok', value: response.body };
};

export const createOwned = (services: { sonarr: Arr; radarr: Arr }) => ({
  async episodes(seriesId: number): Promise<Result<OwnedEpisode[]>> {
    const result = await read(services.sonarr, `/api/v3/episode?seriesId=${seriesId}`);
    if (result.kind !== 'ok') return result;
    if (!Array.isArray(result.value)) return { kind: 'unreachable' };
    const episodes = result.value.flatMap((episode): OwnedEpisode[] => {
      if (!isRecord(episode) || !wholeNumber(episode.id) || !wholeNumber(episode.seasonNumber) || !wholeNumber(episode.episodeNumber)) return [];
      return [{
        id: episode.id,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        title: typeof episode.title === 'string' ? episode.title : null,
        airDate: typeof episode.airDateUtc === 'string' ? episode.airDateUtc : null,
        monitored: episode.monitored === true,
        hasFile: episode.hasFile === true,
      }];
    });
    episodes.sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
    return { kind: 'ok', value: episodes };
  },
  async movie(movieId: number): Promise<Result<{ id: number; title: string | null; hasFile: boolean }>> {
    const result = await read(services.radarr, `/api/v3/movie/${movieId}`);
    if (result.kind !== 'ok') return result;
    if (!isRecord(result.value)) return { kind: 'unreachable' };
    return {
      kind: 'ok',
      value: { id: movieId, title: typeof result.value.title === 'string' ? result.value.title : null, hasFile: result.value.hasFile === true },
    };
  },
});

export type Owned = ReturnType<typeof createOwned>;

export const createOwnedRoutes = (owned: Owned, qualities: (service: 'sonarr' | 'radarr') => Promise<unknown[] | undefined>) => {
  const routes = new Hono();
  const statusFor = (kind: string) => (kind === 'not_configured' ? 503 : kind === 'not_found' ? 404 : 502);
  routes.get('/series/:id/episodes', async (context) => {
    const id = Number(context.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return context.json({ error: 'invalid_request' }, 400);
    const result = await owned.episodes(id);
    return result.kind === 'ok' ? context.json(result.value) : context.json({ error: result.kind }, statusFor(result.kind));
  });
  routes.get('/movie/:id', async (context) => {
    const id = Number(context.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return context.json({ error: 'invalid_request' }, 400);
    const result = await owned.movie(id);
    return result.kind === 'ok' ? context.json(result.value) : context.json({ error: result.kind }, statusFor(result.kind));
  });
  routes.get('/qualities/:service', async (context) => {
    const service = context.req.param('service');
    if (service !== 'sonarr' && service !== 'radarr') return context.json({ error: 'not_found' }, 404);
    const list = await qualities(service);
    return list === undefined ? context.json({ error: 'unreachable' }, 502) : context.json(list);
  });
  return routes;
};
