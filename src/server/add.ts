import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { getPreference, setPreference } from './preferences.js';
import { lookupTitle } from './search.js';
import type { ArrServices, Result } from './services/arr.js';
import type { TitleStore } from './titleStore.js';

type Service = 'sonarr' | 'radarr';

// Sonarr's and Radarr's own monitor values, in the order their add screens list them.
export const seriesMonitorOptions = [
  'all', 'future', 'missing', 'existing', 'recent', 'pilot', 'firstSeason', 'lastSeason',
  'monitorSpecials', 'unmonitorSpecials', 'none',
] as const;
export const movieMonitorOptions = ['movieOnly', 'movieAndCollection', 'none'] as const;
export const minimumAvailabilityOptions = ['announced', 'inCinemas', 'released'] as const;
const seriesTypes = ['standard', 'daily', 'anime'] as const;

export type SeriesAddChoices = {
  monitor: typeof seriesMonitorOptions[number];
  monitorNewSeasons: boolean;
  qualityProfileId: number;
  rootFolderPath: string;
  seasonFolder: boolean;
  seriesType: typeof seriesTypes[number];
  searchOnAdd: boolean;
};

export type MovieAddChoices = {
  monitor: typeof movieMonitorOptions[number];
  minimumAvailability: typeof minimumAvailabilityOptions[number];
  qualityProfileId: number;
  rootFolderPath: string;
  searchOnAdd: boolean;
};

type Failure = { kind: 'not_configured' | 'unreachable' | 'rejected' | 'not_found' } | { kind: 'refused'; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const positiveInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value > 0
);
const oneOf = <T extends string>(options: readonly T[], value: unknown): value is T => (
  typeof value === 'string' && (options as readonly string[]).includes(value)
);
const nonblank = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && value.length <= 4096;

const failureFor = (status: number): Failure => (
  status === 401 || status === 403 ? { kind: 'rejected' } : { kind: 'unreachable' }
);

const added = (result: Result<{ id: number }>): { kind: 'added'; libraryId: number } | Failure => {
  if (result.kind === 'ok') return { kind: 'added', libraryId: result.value.id };
  if (result.kind === 'refused') return { kind: 'refused', reason: result.message };
  return { kind: result.kind };
};

export const parseSeriesChoices = (value: unknown): SeriesAddChoices | undefined => {
  if (!isRecord(value)) return undefined;
  const { monitor, monitorNewSeasons, qualityProfileId, rootFolderPath, seasonFolder, seriesType, searchOnAdd } = value;
  if (
    !oneOf(seriesMonitorOptions, monitor) || typeof monitorNewSeasons !== 'boolean' || !positiveInteger(qualityProfileId)
    || !nonblank(rootFolderPath) || typeof seasonFolder !== 'boolean' || !oneOf(seriesTypes, seriesType)
    || typeof searchOnAdd !== 'boolean'
  ) return undefined;
  return { monitor, monitorNewSeasons, qualityProfileId, rootFolderPath, seasonFolder, seriesType, searchOnAdd };
};

export const parseMovieChoices = (value: unknown): MovieAddChoices | undefined => {
  if (!isRecord(value)) return undefined;
  const { monitor, minimumAvailability, qualityProfileId, rootFolderPath, searchOnAdd } = value;
  if (
    !oneOf(movieMonitorOptions, monitor) || !oneOf(minimumAvailabilityOptions, minimumAvailability)
    || !positiveInteger(qualityProfileId) || !nonblank(rootFolderPath) || typeof searchOnAdd !== 'boolean'
  ) return undefined;
  return { monitor, minimumAvailability, qualityProfileId, rootFolderPath, searchOnAdd };
};

const readDefaults = (database: DatabaseSync, service: Service) => {
  const stored = getPreference(database, `add.${service}`);
  if (stored === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(stored);
    return service === 'sonarr' ? parseSeriesChoices(parsed) : parseMovieChoices(parsed);
  } catch {
    return undefined;
  }
};

export const createAdd = (database: DatabaseSync, services: ArrServices, store: TitleStore) => {
  const get = async (service: Service, path: string): Promise<{ kind: 'ok'; body: unknown } | Failure> => {
    let response: { status: number; body: unknown };
    try {
      response = await services[service].request(path);
    } catch {
      return { kind: 'unreachable' };
    }
    if (response.status < 200 || response.status > 299) return failureFor(response.status);
    return { kind: 'ok', body: response.body };
  };

  const options = async (service: Service) => {
    if (!services[service].configured()) return { kind: 'not_configured' } as const;
    const [profiles, folders] = await Promise.all([get(service, '/api/v3/qualityprofile'), get(service, '/api/v3/rootfolder')]);
    if (profiles.kind !== 'ok') return profiles;
    if (folders.kind !== 'ok') return folders;
    if (!Array.isArray(profiles.body) || !Array.isArray(folders.body)) return { kind: 'unreachable' } as const;
    const qualityProfiles = profiles.body.flatMap((profile) => (
      isRecord(profile) && positiveInteger(profile.id) && nonblank(profile.name) ? [{ id: profile.id, name: profile.name }] : []
    ));
    const rootFolders = folders.body.flatMap((folder) => (
      isRecord(folder) && nonblank(folder.path)
        ? [{ path: folder.path, freeSpace: typeof folder.freeSpace === 'number' ? folder.freeSpace : null }]
        : []
    ));
    const saved = readDefaults(database, service);
    const usable = saved !== undefined
      && qualityProfiles.some((profile) => profile.id === saved.qualityProfileId)
      && rootFolders.some((folder) => folder.path === saved.rootFolderPath);
    return { kind: 'ok', qualityProfiles, rootFolders, defaults: usable ? saved : null } as const;
  };

  return {
    options,
    async addSeries(tvdbId: number, choices: SeriesAddChoices) {
      if (!services.sonarr.configured()) return { kind: 'not_configured' } as const;
      const record = await lookupTitle(services, store, 'sonarr', tvdbId);
      if (record.kind !== 'ok') return added(record);
      const result = added(await services.sonarr.addSeries(record.value, {
        qualityProfileId: choices.qualityProfileId,
        rootFolderPath: choices.rootFolderPath,
        seasonFolder: choices.seasonFolder,
        seriesType: choices.seriesType,
        // Sonarr keeps the show monitored even for "none", so new seasons can still be picked up.
        monitored: true,
        monitorNewItems: choices.monitorNewSeasons ? 'all' : 'none',
        addOptions: {
          monitor: choices.monitor,
          searchForMissingEpisodes: choices.searchOnAdd,
          searchForCutoffUnmetEpisodes: false,
        },
      }));
      if (result.kind === 'added') setPreference(database, 'add.sonarr', JSON.stringify(choices));
      return result;
    },
    async addMovie(tmdbId: number, choices: MovieAddChoices) {
      if (!services.radarr.configured()) return { kind: 'not_configured' } as const;
      const record = await lookupTitle(services, store, 'radarr', tmdbId);
      if (record.kind !== 'ok') return added(record);
      const result = added(await services.radarr.addMovie(record.value, {
        qualityProfileId: choices.qualityProfileId,
        rootFolderPath: choices.rootFolderPath,
        minimumAvailability: choices.minimumAvailability,
        monitored: choices.monitor !== 'none',
        addOptions: { monitor: choices.monitor, searchForMovie: choices.searchOnAdd },
      }));
      if (result.kind === 'added') setPreference(database, 'add.radarr', JSON.stringify(choices));
      return result;
    },
  };
};

export type Add = ReturnType<typeof createAdd>;

const statusFor = (kind: string) => (
  kind === 'not_configured' ? 503 : kind === 'not_found' ? 404 : kind === 'refused' ? 409 : 502
);

export const createAddRoutes = (add: Add) => {
  const routes = new Hono();
  routes.get('/options/:service', async (context) => {
    const service = context.req.param('service');
    if (service !== 'sonarr' && service !== 'radarr') return context.json({ error: 'not_found' }, 404);
    const result = await add.options(service);
    if (result.kind !== 'ok') return context.json({ error: result.kind }, statusFor(result.kind));
    const { kind: _kind, ...body } = result;
    return context.json(body);
  });
  routes.post('/', async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    if (!isRecord(body) || Object.keys(body).sort().join() !== 'choices,id,service') {
      return context.json({ error: 'invalid_request' }, 400);
    }
    let result;
    if (body.service === 'sonarr' && positiveInteger(body.id)) {
      const choices = parseSeriesChoices(body.choices);
      if (choices === undefined) return context.json({ error: 'invalid_request' }, 400);
      result = await add.addSeries(body.id, choices);
    } else if (body.service === 'radarr' && positiveInteger(body.id)) {
      const choices = parseMovieChoices(body.choices);
      if (choices === undefined) return context.json({ error: 'invalid_request' }, 400);
      result = await add.addMovie(body.id, choices);
    } else {
      return context.json({ error: 'invalid_request' }, 400);
    }
    if (result.kind === 'added') return context.json({ libraryId: result.libraryId }, 201);
    if (result.kind === 'refused') return context.json({ error: 'refused', reason: result.reason }, 409);
    return context.json({ error: result.kind }, statusFor(result.kind));
  });
  return routes;
};
