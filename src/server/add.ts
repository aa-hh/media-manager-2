import { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import { getPreference, setPreference } from './preferences.js';
import { lookupTitle } from './search.js';
import type { ArrServices, Result } from './services/arr.js';
import type { TitleStore } from './titleStore.js';

type Service = 'sonarr' | 'radarr';

// The Sonarr v4 add-time monitor values this app offers; `skip` monitors the seasons listed in `seasons[]`.
export const seriesMonitorOptions = ['all', 'future', 'lastSeason', 'skip', 'none'] as const;
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
  seasons?: number[];
};

export type MovieAddChoices = {
  monitor: typeof movieMonitorOptions[number];
  minimumAvailability: typeof minimumAvailabilityOptions[number];
  qualityProfileId: number;
  rootFolderPath: string;
};

type Failure = { kind: 'not_configured' | 'unreachable' | 'rejected' | 'not_found' } | { kind: 'refused'; reason: string; libraryId?: number };

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

// A refusal for a title already in the library carries that item's id, taken from the lookup record when it has one.
const added = (result: Result<{ id: number }>, existingId?: unknown): { kind: 'added'; libraryId: number } | Failure => {
  if (result.kind === 'ok') return { kind: 'added', libraryId: result.value.id };
  if (result.kind === 'refused') {
    return positiveInteger(existingId)
      ? { kind: 'refused', reason: result.message, libraryId: existingId }
      : { kind: 'refused', reason: result.message };
  }
  return { kind: result.kind };
};

export const parseSeriesChoices = (value: unknown): SeriesAddChoices | undefined => {
  if (!isRecord(value)) return undefined;
  const { monitor, monitorNewSeasons, qualityProfileId, rootFolderPath, seasonFolder, seriesType, seasons } = value;
  if (
    !oneOf(seriesMonitorOptions, monitor) || typeof monitorNewSeasons !== 'boolean' || !positiveInteger(qualityProfileId)
    || !nonblank(rootFolderPath) || typeof seasonFolder !== 'boolean' || !oneOf(seriesTypes, seriesType)
  ) return undefined;
  const choices = { monitor, monitorNewSeasons, qualityProfileId, rootFolderPath, seasonFolder, seriesType };
  if (monitor !== 'skip') return seasons === undefined ? choices : undefined;
  if (
    !Array.isArray(seasons) || seasons.length < 1 || seasons.length > 200 || new Set(seasons).size !== seasons.length
    || !seasons.every((season) => Number.isInteger(season) && season >= 0 && season <= 999)
  ) return undefined;
  return { ...choices, seasons: seasons as number[] };
};

export const parseMovieChoices = (value: unknown): MovieAddChoices | undefined => {
  if (!isRecord(value)) return undefined;
  const { monitor, minimumAvailability, qualityProfileId, rootFolderPath } = value;
  if (
    !oneOf(movieMonitorOptions, monitor) || !oneOf(minimumAvailabilityOptions, minimumAvailability)
    || !positiveInteger(qualityProfileId) || !nonblank(rootFolderPath)
  ) return undefined;
  return { monitor, minimumAvailability, qualityProfileId, rootFolderPath };
};

const lastChoiceKey = (service: Service) => `add.lastChoice.${service}`;

export const createAdd = (services: ArrServices, store: TitleStore, database: DatabaseSync) => {
  const lastChoice = (service: Service): { qualityProfileId: number; rootFolderPath: string } | null => {
    const stored = getPreference(database, lastChoiceKey(service));
    if (stored === undefined) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return null;
    }
    return isRecord(parsed) && positiveInteger(parsed.qualityProfileId) && nonblank(parsed.rootFolderPath)
      ? { qualityProfileId: parsed.qualityProfileId, rootFolderPath: parsed.rootFolderPath }
      : null;
  };
  const remember = (service: Service, choices: { qualityProfileId: number; rootFolderPath: string }) => {
    setPreference(database, lastChoiceKey(service), JSON.stringify({
      qualityProfileId: choices.qualityProfileId,
      rootFolderPath: choices.rootFolderPath,
    }));
  };

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
    return { kind: 'ok', qualityProfiles, rootFolders, lastChoice: lastChoice(service) } as const;
  };

  return {
    options,
    async addSeries(tvdbId: number, choices: SeriesAddChoices) {
      if (!services.sonarr.configured()) return { kind: 'not_configured' } as const;
      const record = await lookupTitle(services, store, 'sonarr', tvdbId);
      if (record.kind !== 'ok') return added(record);
      // Sonarr's AddSeriesService sets Monitored=false for `none`, and `skip` keeps the per-season flags sent in `seasons`.
      const unmonitoredNone = choices.monitor === 'none' && !choices.monitorNewSeasons;
      const monitor = choices.monitor === 'none' && choices.monitorNewSeasons ? 'skip' : choices.monitor;
      const picked = choices.monitor === 'skip' ? choices.seasons ?? [] : [];
      const seasons = monitor === 'skip' && Array.isArray(record.value.seasons)
        ? { seasons: record.value.seasons.map((season) => (
          isRecord(season) ? { ...season, monitored: typeof season.seasonNumber === 'number' && picked.includes(season.seasonNumber) } : season
        )) }
        : {};
      const outcome = added(await services.sonarr.addSeries(record.value, {
        qualityProfileId: choices.qualityProfileId,
        rootFolderPath: choices.rootFolderPath,
        seasonFolder: choices.seasonFolder,
        seriesType: choices.seriesType,
        ...seasons,
        monitored: !unmonitoredNone,
        monitorNewItems: choices.monitorNewSeasons ? 'all' : 'none',
        addOptions: {
          monitor,
          searchForMissingEpisodes: choices.monitor !== 'none',
          searchForCutoffUnmetEpisodes: false,
        },
      }), record.value.id);
      if (outcome.kind === 'added') remember('sonarr', choices);
      return outcome;
    },
    async addMovie(tmdbId: number, choices: MovieAddChoices) {
      if (!services.radarr.configured()) return { kind: 'not_configured' } as const;
      const record = await lookupTitle(services, store, 'radarr', tmdbId);
      if (record.kind !== 'ok') return added(record);
      const outcome = added(await services.radarr.addMovie(record.value, {
        qualityProfileId: choices.qualityProfileId,
        rootFolderPath: choices.rootFolderPath,
        minimumAvailability: choices.minimumAvailability,
        monitored: choices.monitor !== 'none',
        addOptions: { monitor: choices.monitor, searchForMovie: choices.monitor !== 'none' },
      }), record.value.id);
      if (outcome.kind === 'added') remember('radarr', choices);
      return outcome;
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
    if (result.kind === 'refused') {
      return context.json({
        error: 'refused',
        reason: result.reason,
        ...(result.libraryId === undefined ? {} : { libraryId: result.libraryId }),
      }, 409);
    }
    return context.json({ error: result.kind }, statusFor(result.kind));
  });
  return routes;
};
