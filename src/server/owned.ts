import { Hono } from 'hono';
import type { ArrServices, Result } from './services/arr.js';

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

export const createOwned = (services: ArrServices) => ({
  async episodes(seriesId: number): Promise<Result<OwnedEpisode[]>> {
    const result = await services.sonarr.episodes(seriesId);
    if (result.kind !== 'ok') return result;
    const episodes = result.value.map((episode): OwnedEpisode => ({
      id: episode.id,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      airDate: episode.airDateUtc,
      monitored: episode.monitored,
      hasFile: episode.hasFile,
    }));
    episodes.sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
    return { kind: 'ok', value: episodes };
  },
  async movie(movieId: number): Promise<Result<{ id: number; title: string | null; hasFile: boolean }>> {
    const result = await services.radarr.movie(movieId);
    if (result.kind !== 'ok') return result;
    return { kind: 'ok', value: { id: movieId, title: result.value.title, hasFile: result.value.hasFile } };
  },
});

export type Owned = ReturnType<typeof createOwned>;

export const createOwnedRoutes = (owned: Owned) => {
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
  return routes;
};
