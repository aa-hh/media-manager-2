import type { DatabaseSync } from 'node:sqlite';
import { createCommands, type ForceImport, type SearchTarget } from './arr/commands.js';
import { createEpisodes, type Episode } from './arr/episodes.js';
import { type FileDetail, type Image, parseFile } from './arr/files.js';
import { createHistory, type HistoryRead, type HistoryRecord } from './arr/history.js';
import { type Credit, createMovies, type Movie, parseMovie, type Ratings } from './arr/movies.js';
import { createQueue, type QueueItem } from './arr/queue.js';
import { classify, labels, notConfigured, type Result, type Send, type Service, unreachable, valueOrThrow } from './arr/result.js';
import { createSeries, parseSeries, type Series } from './arr/series.js';
import { type ConnectionStatus, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

export { parseFile, parseMovie, parseSeries, valueOrThrow };
export type { Credit, Episode, FileDetail, HistoryRecord, Image, Movie, QueueItem, Ratings, Result, Series, Service };

export type SonarrTitles = {
  listSeries: () => Promise<Result<Series[]>>;
  series: (seriesId: number) => Promise<Result<Series>>;
  lookupSeries: (term: string) => Promise<Result<Record<string, unknown>[]>>;
  addSeries: (record: Record<string, unknown>, fields: Record<string, unknown>) => Promise<Result<{ id: number }>>;
  monitorSeries: (seriesId: number, monitored: boolean) => Promise<Result<void>>;
  monitorSeason: (seriesId: number, seasonNumber: number, monitored: boolean) => Promise<Result<void>>;
  setSeriesMonitoring: (seriesId: number, change: { monitored: boolean; seasons: number[] | 'all'; monitorNewItems?: 'all' | 'none' }) => Promise<Result<void>>;
  setTag: (seriesId: number, tagId: number, tagged: boolean) => Promise<Result<void>>;
  episodes: (seriesId: number, options?: { seasonNumber?: number; withFiles?: boolean }) => Promise<Result<Episode[]>>;
  episode: (episodeId: number) => Promise<Result<Episode>>;
  episodeFiles: (seriesId: number) => Promise<Result<FileDetail[]>>;
  monitorEpisodes: (episodeIds: number[], monitored: boolean) => Promise<Result<void>>;
  deleteEpisodeFile: (fileId: number) => Promise<Result<void>>;
  deleteSeries: (seriesId: number, excludeFromImportLists?: boolean) => Promise<Result<void>>;
};

export type RadarrTitles = {
  listMovies: () => Promise<Result<Movie[]>>;
  movie: (movieId: number) => Promise<Result<Movie>>;
  lookupMovies: (term: string) => Promise<Result<Record<string, unknown>[]>>;
  addMovie: (record: Record<string, unknown>, fields: Record<string, unknown>) => Promise<Result<{ id: number }>>;
  monitorMovie: (movieId: number, monitored: boolean) => Promise<Result<void>>;
  setTag: (movieId: number, tagId: number, tagged: boolean) => Promise<Result<void>>;
  credits: (movieId: number) => Promise<Result<Credit[]>>;
  deleteMovie: (movieId: number, excludeFromImportLists?: boolean) => Promise<Result<void>>;
  deleteMovieFile: (fileId: number) => Promise<Result<void>>;
};

export type Arr<S extends Service> = {
  check: () => Promise<ConnectionStatus>;
  request: (
    path: string,
    init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; timeoutMs?: number },
  ) => Promise<{ status: number; body: unknown }>;
  download: (path: string) => Promise<{ status: number; contentType: string; bytes: Uint8Array }>;
  configured: () => boolean;
  queue: () => Promise<Result<QueueItem[]>>;
  removeFromQueue: (
    target: { downloadId: string } | { queueId: number },
    choice: 'block' | 'block_and_search' | 'nothing',
  ) => Promise<Result<{ removed: number }>>;
  removeFromQueueAndClient: (downloadId: string) => Promise<Result<{ removed: number }>>;
  grabFromQueue: (queueId: number) => Promise<Result<void>>;
  history: HistoryRead<S>;
  markFailed: (historyId: number) => Promise<Result<void>>;
  searchAutomatically: (target: SearchTarget<S>) => Promise<Result<void>>;
  refreshTitle: (id: number) => Promise<Result<void>>;
  refreshMonitoredDownloads: () => Promise<Result<void>>;
  forceImport: ForceImport;
  recycleBin: () => Promise<Result<string | null>>;
  importLists: () => Promise<Result<boolean>>;
} & (S extends 'sonarr' ? SonarrTitles : RadarrTitles);

export type ArrServices = { sonarr: Arr<'sonarr'>; radarr: Arr<'radarr'> };

export const createArr = <S extends Service>(service: S, database: DatabaseSync, options: ServiceOptions = {}): Arr<S> => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const label = labels[service];

  const readConfiguration = () => {
    const url = readSetting(database, 'serviceAddresses', `${service}.url`);
    const apiKey = readSetting(database, 'credentials', `${service}.apiKey`);
    return url === undefined || apiKey === undefined ? undefined : { url, apiKey };
  };

  const request = async (
    path: string,
    init: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; timeoutMs?: number } = {},
  ): Promise<{ status: number; body: unknown }> => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error(`${label} is not configured.`);
    const method = init.method ?? 'GET';
    const headers: Record<string, string> = { 'X-Api-Key': configuration.apiKey, Accept: 'application/json' };
    const sendsBody = method === 'POST' || method === 'PUT';
    if (sendsBody) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, configuration.url.replace(/\/+$/, '') + path, {
        method,
        headers,
        body: sendsBody ? JSON.stringify(init.body) : undefined,
      }, init.timeoutMs);
    } catch (error) {
      // The cause lets a caller tell a timeout, which the service may still have acted on, from a refused connection.
      throw new Error(`${label} is unreachable.`, { cause: error });
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { status: response.status, body };
  };

  const download = async (path: string): Promise<{ status: number; contentType: string; bytes: Uint8Array }> => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error(`${label} is not configured.`);
    try {
      const response = await requestWithTimeout(fetchImpl, configuration.url.replace(/\/+$/, '') + path, {
        method: 'GET',
        headers: { 'X-Api-Key': configuration.apiKey, Accept: 'image/*' },
      }, 30_000);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { status: response.status, contentType: response.headers.get('Content-Type') ?? '', bytes };
    } catch {
      throw new Error(`${label} is unreachable.`);
    }
  };

  const check = async (): Promise<ConnectionStatus> => {
    if (readConfiguration() === undefined) return { kind: 'not_configured' };
    let result: { status: number; body: unknown };
    try {
      result = await request('/api/v3/system/status');
    } catch {
      return { kind: 'unreachable' };
    }
    if (result.status === 401 || result.status === 403) return { kind: 'rejected' };
    if (result.status < 200 || result.status > 299) return { kind: 'unreachable' };
    const { body } = result;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return { kind: 'unreachable' };
    const { version } = body as Record<string, unknown>;
    if (typeof version !== 'string' || version === '') return { kind: 'unreachable' };
    return { kind: 'ok', version };
  };

  const configured = () => readConfiguration() !== undefined;

  // Every named operation answers with a Result; the two throws from request become not_configured and unreachable.
  const send: Send = async (operation, path, init) => {
    if (!configured()) return notConfigured(label, operation);
    let answer: { status: number; body: unknown };
    try {
      answer = await request(path, init);
    } catch {
      return configured() ? unreachable(label, operation) : notConfigured(label, operation);
    }
    return classify(label, operation, answer);
  };

  const parts = { service, label, send };
  return {
    check,
    request,
    download,
    configured,
    ...createQueue(parts),
    ...createHistory(parts),
    ...createCommands(parts),
    ...(service === 'sonarr' ? { ...createSeries(parts), ...createEpisodes(parts) } : createMovies(parts)),
  } as unknown as Arr<S>;
};
