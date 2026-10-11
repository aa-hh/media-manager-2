import { Hono } from 'hono';
import type { createArr } from './services/arr.js';

type Arr = Pick<ReturnType<typeof createArr>, 'request' | 'configured'>;
type Service = 'sonarr' | 'radarr';

export type Outcome =
  | { kind: 'ok'; count: number }
  | { kind: 'not_configured' | 'unreachable' | 'rejected' };

type Failure = { kind: 'not_configured' | 'unreachable' | 'rejected' | 'not_found'; reason?: string };
export type Result<T> = { kind: 'ok'; value: T } | Failure;

export type LibraryTitle = {
  type: 'tv' | 'movie';
  service: Service;
  id: number;
  title: string;
  year: number | null;
  added: string | null;
  monitored: boolean;
  status: string | null;
  posterUrl: string | null;
  qualityProfile: string | null;
  sizeOnDisk: number;
  tv: { episodeFileCount: number; episodeCount: number; totalEpisodeCount: number; seasonCount: number } | null;
  movie: { hasFile: boolean; isAvailable: boolean } | null;
};

export type FileDetail = {
  id: number | null;
  relativePath: string | null;
  size: number;
  dateAdded: string | null;
  quality: string | null;
  revision: { version: number | null; real: number | null; isRepack: boolean };
  releaseGroup: string | null;
  languages: string[];
  customFormats: string[];
  customFormatScore: number | null;
  qualityCutoffNotMet: boolean;
  mediaInfo: {
    videoCodec: string | null;
    videoDynamicRangeType: string | null;
    resolution: string | null;
    audioCodec: string | null;
    audioChannels: number | null;
    audioLanguages: string | null;
    subtitles: string | null;
  } | null;
};

// A strict superset of OwnedEpisode in the client's PickRelease.
export type EpisodeDetail = {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  airDate: string | null;
  monitored: boolean;
  hasFile: boolean;
  overview: string | null;
  runtime: number | null;
  finaleType: string | null;
  absoluteEpisodeNumber: number | null;
  sceneSeasonNumber: number | null;
  sceneEpisodeNumber: number | null;
  unverifiedSceneNumbering: boolean;
  lastSearchTime: string | null;
  imageUrl: string | null;
  file: FileDetail | null;
};

type ProfileDetail = { id: number; name: string; cutoff: string | null };

export type SeriesDetail = {
  id: number | null;
  title: string;
  year: number | null;
  status: string | null;
  ended: boolean;
  network: string | null;
  language: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  certification: string | null;
  genres: string[];
  runtime: number | null;
  path: string | null;
  tags: string[];
  links: { imdbId: string | null; tvdbId: number | null; tmdbId: number | null };
  monitored: boolean;
  monitorNewItems: string | null;
  qualityProfile: ProfileDetail | null;
  added: string | null;
  statistics: { seasonCount: number; episodeFileCount: number; episodeCount: number; totalEpisodeCount: number; sizeOnDisk: number };
  seasons: Array<{
    seasonNumber: number;
    monitored: boolean;
    posterUrl: string | null;
    statistics: {
      episodeFileCount: number;
      episodeCount: number;
      totalEpisodeCount: number;
      sizeOnDisk: number;
      nextAiring: string | null;
      previousAiring: string | null;
    };
  }>;
  episodes: EpisodeDetail[];
};

export type MovieDetail = {
  id: number | null;
  title: string;
  year: number | null;
  status: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  certification: string | null;
  genres: string[];
  runtime: number | null;
  studio: string | null;
  collection: string | null;
  path: string | null;
  tags: string[];
  links: { imdbId: string | null; tmdbId: number | null };
  monitored: boolean;
  hasFile: boolean;
  isAvailable: boolean;
  minimumAvailability: string | null;
  qualityProfile: ProfileDetail | null;
  added: string | null;
  lastSearchTime: string | null;
  sizeOnDisk: number;
  releaseDates: { inCinemas: string | null; digital: string | null; physical: string | null };
  file: FileDetail | null;
};

export type HistoryEntry = {
  at: string | null;
  eventType: string;
  sourceTitle: string | null;
  quality: string | null;
  detail: string;
};

export type CalendarEntry =
  | {
    service: 'sonarr';
    kind: 'episode';
    id: number;
    seriesId: number;
    seriesTitle: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    at: string;
    hasFile: boolean;
    monitored: boolean;
    quality: string | null;
    finaleType: string | null;
  }
  | {
    service: 'radarr';
    kind: 'movie';
    id: number;
    title: string;
    year: number | null;
    at: string;
    release: 'cinema' | 'digital' | 'physical';
    hasFile: boolean;
    monitored: boolean;
    isAvailable: boolean;
  };

export type HistorySubject =
  | { service: 'sonarr'; episodeId: number }
  | { service: 'sonarr'; seriesId: number }
  | { service: 'radarr'; movieId: number };

type Target =
  | { service: 'sonarr'; kind: 'series'; seriesId: number }
  | { service: 'sonarr'; kind: 'season'; seriesId: number; seasonNumber: number }
  | { service: 'sonarr'; kind: 'episodes'; episodeIds: number[] }
  | { service: 'radarr'; kind: 'movie'; movieId: number };
export type MonitorChange = Target & { monitored: boolean };
export type RefreshRequest = Extract<Target, { kind: 'series' | 'movie' }>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const finiteNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const count = (value: unknown) => finiteNumber(value) ?? 0;
const positiveInteger = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
);
const records = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isRecord) : []);
const names = (value: unknown): string[] => records(value).flatMap((item) => {
  const name = text(item.name);
  return name === null ? [] : [name];
});
const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.flatMap((item) => {
  const entry = text(item);
  return entry === null ? [] : [entry];
}) : []);

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

// Sonarr and Radarr explain a refused write as { message } or as a list of { errorMessage }.
const serviceMessage = (body: unknown): string | undefined => {
  if (isRecord(body)) return text(body.message) ?? text(body.errorMessage) ?? undefined;
  if (Array.isArray(body)) return records(body).map((item) => text(item.errorMessage)).find((message) => message !== null) ?? undefined;
  return undefined;
};

const write = async (service: Arr, path: string, method: 'PUT' | 'POST', body: unknown): Promise<Result<void>> => {
  if (!service.configured()) return { kind: 'not_configured' };
  let response: { status: number; body: unknown };
  try {
    response = await service.request(path, { method, body });
  } catch {
    return { kind: 'unreachable' };
  }
  if (response.status >= 200 && response.status <= 299) return { kind: 'ok', value: undefined };
  return { kind: 'unreachable', reason: serviceMessage(response.body) ?? `The service answered ${response.status}.` };
};

// Only an absolute http(s) remoteUrl may reach the browser: the local url is served by the service and needs its key.
export const imageUrl = (images: unknown, coverType: string): string | null => {
  for (const image of records(images)) {
    if (image.coverType !== coverType) continue;
    const url = text(image.remoteUrl);
    if (url === null) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    } catch {
      continue;
    }
  }
  return null;
};

export const newestFirst = <T extends { added: string | null; title: string }>(titles: T[]): T[] => {
  const time = (added: string | null) => {
    const parsed = added === null ? Number.NaN : Date.parse(added);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return [...titles].sort((a, b) => time(b.added) - time(a.added) || a.title.localeCompare(b.title));
};

const cutoffName = (items: unknown, cutoff: number): string | null => {
  for (const item of records(items)) {
    const quality = isRecord(item.quality) ? item.quality : undefined;
    if (quality !== undefined && quality.id === cutoff) return text(quality.name);
    if (quality === undefined && item.id === cutoff) return text(item.name);
    const inner = cutoffName(item.items, cutoff);
    if (inner !== null) return inner;
  }
  return null;
};

const profileById = (profiles: unknown, id: unknown): ProfileDetail | null => {
  const profile = records(profiles).find((candidate) => candidate.id === id);
  if (profile === undefined || positiveInteger(profile.id) === null) return null;
  const cutoff = finiteNumber(profile.cutoff);
  return {
    id: profile.id as number,
    name: text(profile.name) ?? '',
    cutoff: cutoff === null ? null : cutoffName(profile.items, cutoff),
  };
};

const tagNames = (tags: unknown, ids: unknown): string[] => {
  const wanted = Array.isArray(ids) ? ids : [];
  return records(tags).flatMap((tag) => (wanted.includes(tag.id) && text(tag.label) !== null ? [text(tag.label) as string] : []));
};

const movieRating = (ratings: unknown): number | null => {
  if (!isRecord(ratings)) return null;
  for (const key of ['tmdb', 'imdb', 'trakt']) {
    const rating = ratings[key];
    if (isRecord(rating) && finiteNumber(rating.value) !== null && (rating.value as number) > 0) return rating.value as number;
  }
  return null;
};

const fileDetail = (value: unknown): FileDetail | null => {
  if (!isRecord(value)) return null;
  const quality = isRecord(value.quality) ? value.quality : {};
  const revision = isRecord(quality.revision) ? quality.revision : {};
  const info = isRecord(value.mediaInfo) ? value.mediaInfo : undefined;
  return {
    id: positiveInteger(value.id),
    relativePath: text(value.relativePath),
    size: count(value.size),
    dateAdded: text(value.dateAdded),
    quality: isRecord(quality.quality) ? text(quality.quality.name) : null,
    revision: { version: finiteNumber(revision.version), real: finiteNumber(revision.real), isRepack: revision.isRepack === true },
    releaseGroup: text(value.releaseGroup),
    languages: names(value.languages),
    customFormats: names(value.customFormats),
    customFormatScore: finiteNumber(value.customFormatScore),
    qualityCutoffNotMet: value.qualityCutoffNotMet === true,
    mediaInfo: info === undefined ? null : {
      videoCodec: text(info.videoCodec),
      videoDynamicRangeType: text(info.videoDynamicRangeType),
      resolution: text(info.resolution),
      audioCodec: text(info.audioCodec),
      audioChannels: finiteNumber(info.audioChannels),
      audioLanguages: text(info.audioLanguages),
      subtitles: text(info.subtitles),
    },
  };
};

const episodeDetails = (value: unknown): EpisodeDetail[] => {
  const episodes = records(value).flatMap((episode): EpisodeDetail[] => {
    const id = positiveInteger(episode.id);
    const seasonNumber = finiteNumber(episode.seasonNumber);
    const episodeNumber = finiteNumber(episode.episodeNumber);
    if (id === null || seasonNumber === null || episodeNumber === null) return [];
    return [{
      id,
      seasonNumber,
      episodeNumber,
      title: text(episode.title),
      airDate: text(episode.airDateUtc),
      monitored: episode.monitored === true,
      hasFile: episode.hasFile === true,
      overview: text(episode.overview),
      runtime: finiteNumber(episode.runtime),
      finaleType: text(episode.finaleType),
      absoluteEpisodeNumber: finiteNumber(episode.absoluteEpisodeNumber),
      sceneSeasonNumber: finiteNumber(episode.sceneSeasonNumber),
      sceneEpisodeNumber: finiteNumber(episode.sceneEpisodeNumber),
      unverifiedSceneNumbering: episode.unverifiedSceneNumbering === true,
      lastSearchTime: text(episode.lastSearchTime),
      imageUrl: imageUrl(episode.images, 'screenshot'),
      file: fileDetail(episode.episodeFile),
    }];
  });
  return episodes.sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
};

const seriesDetail = (raw: Record<string, unknown>, extras: { profiles?: unknown; tags?: unknown; episodes?: unknown; owned: boolean }): SeriesDetail => {
  const statistics = isRecord(raw.statistics) ? raw.statistics : {};
  return {
    id: extras.owned ? positiveInteger(raw.id) : null,
    title: text(raw.title) ?? '',
    year: finiteNumber(raw.year),
    status: text(raw.status),
    ended: raw.ended === true,
    network: text(raw.network),
    language: isRecord(raw.originalLanguage) ? text(raw.originalLanguage.name) : null,
    overview: text(raw.overview),
    posterUrl: imageUrl(raw.images, 'poster'),
    backdropUrl: imageUrl(raw.images, 'fanart'),
    rating: isRecord(raw.ratings) ? finiteNumber(raw.ratings.value) : null,
    certification: text(raw.certification),
    genres: stringList(raw.genres),
    runtime: finiteNumber(raw.runtime),
    path: extras.owned ? text(raw.path) : null,
    tags: extras.owned ? tagNames(extras.tags, raw.tags) : [],
    links: { imdbId: text(raw.imdbId), tvdbId: positiveInteger(raw.tvdbId), tmdbId: positiveInteger(raw.tmdbId) },
    monitored: raw.monitored === true,
    monitorNewItems: text(raw.monitorNewItems),
    qualityProfile: extras.owned ? profileById(extras.profiles, raw.qualityProfileId) : null,
    added: text(raw.added),
    statistics: {
      seasonCount: count(statistics.seasonCount),
      episodeFileCount: count(statistics.episodeFileCount),
      episodeCount: count(statistics.episodeCount),
      totalEpisodeCount: count(statistics.totalEpisodeCount),
      sizeOnDisk: count(statistics.sizeOnDisk),
    },
    seasons: records(raw.seasons).flatMap((season) => {
      const seasonNumber = finiteNumber(season.seasonNumber);
      if (seasonNumber === null) return [];
      const stats = isRecord(season.statistics) ? season.statistics : {};
      return [{
        seasonNumber,
        monitored: season.monitored === true,
        posterUrl: imageUrl(season.images, 'poster'),
        statistics: {
          episodeFileCount: count(stats.episodeFileCount),
          episodeCount: count(stats.episodeCount),
          totalEpisodeCount: count(stats.totalEpisodeCount),
          sizeOnDisk: count(stats.sizeOnDisk),
          nextAiring: text(stats.nextAiring),
          previousAiring: text(stats.previousAiring),
        },
      }];
    }),
    episodes: episodeDetails(extras.episodes),
  };
};

const movieDetail = (raw: Record<string, unknown>, extras: { profiles?: unknown; tags?: unknown; owned: boolean }): MovieDetail => ({
  id: extras.owned ? positiveInteger(raw.id) : null,
  title: text(raw.title) ?? '',
  year: finiteNumber(raw.year),
  status: text(raw.status),
  overview: text(raw.overview),
  posterUrl: imageUrl(raw.images, 'poster'),
  backdropUrl: imageUrl(raw.images, 'fanart'),
  rating: movieRating(raw.ratings),
  certification: text(raw.certification),
  genres: stringList(raw.genres),
  runtime: finiteNumber(raw.runtime),
  studio: text(raw.studio),
  collection: isRecord(raw.collection) ? text(raw.collection.title) : null,
  path: extras.owned ? text(raw.path) : null,
  tags: extras.owned ? tagNames(extras.tags, raw.tags) : [],
  links: { imdbId: text(raw.imdbId), tmdbId: positiveInteger(raw.tmdbId) },
  monitored: raw.monitored === true,
  hasFile: raw.hasFile === true,
  isAvailable: raw.isAvailable === true,
  minimumAvailability: text(raw.minimumAvailability),
  qualityProfile: extras.owned ? profileById(extras.profiles, raw.qualityProfileId) : null,
  added: text(raw.added),
  lastSearchTime: text(raw.lastSearchTime),
  sizeOnDisk: count(raw.sizeOnDisk),
  releaseDates: { inCinemas: text(raw.inCinemas), digital: text(raw.digitalRelease), physical: text(raw.physicalRelease) },
  file: extras.owned ? fileDetail(raw.movieFile) : null,
});

const toTitle = (service: Service, raw: Record<string, unknown>, profiles: unknown): LibraryTitle[] => {
  const id = positiveInteger(raw.id);
  const title = text(raw.title);
  if (id === null || title === null) return [];
  const profile = profileById(profiles, raw.qualityProfileId);
  const base = {
    service,
    id,
    title,
    year: finiteNumber(raw.year),
    added: text(raw.added),
    monitored: raw.monitored === true,
    status: text(raw.status),
    posterUrl: imageUrl(raw.images, 'poster'),
    qualityProfile: profile?.name ?? null,
  };
  if (service === 'sonarr') {
    const statistics = isRecord(raw.statistics) ? raw.statistics : {};
    return [{
      ...base,
      type: 'tv',
      sizeOnDisk: count(statistics.sizeOnDisk),
      tv: {
        episodeFileCount: count(statistics.episodeFileCount),
        episodeCount: count(statistics.episodeCount),
        totalEpisodeCount: count(statistics.totalEpisodeCount),
        seasonCount: count(statistics.seasonCount),
      },
      movie: null,
    }];
  }
  return [{
    ...base,
    type: 'movie',
    sizeOnDisk: count(raw.sizeOnDisk),
    tv: null,
    movie: { hasFile: raw.hasFile === true, isAvailable: raw.isAvailable === true },
  }];
};

const historyEntries = (value: unknown): HistoryEntry[] => {
  const list = isRecord(value) ? value.records : value;
  const entries = records(list).map((record): HistoryEntry => {
    const quality = isRecord(record.quality) && isRecord(record.quality.quality) ? text(record.quality.quality.name) : null;
    const data = isRecord(record.data) ? record.data : {};
    return {
      at: text(record.date),
      eventType: text(record.eventType) ?? 'unknown',
      sourceTitle: text(record.sourceTitle),
      quality,
      detail: text(data.message) ?? text(data.reason) ?? text(data.indexer) ?? '',
    };
  });
  const time = (at: string | null) => {
    const parsed = at === null ? Number.NaN : Date.parse(at);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return entries.sort((a, b) => time(b.at) - time(a.at)).slice(0, 50);
};

export const createLibrary = (services: { sonarr: Arr; radarr: Arr }) => {
  const outcome = <T>(result: Result<T[]>): Outcome => (
    result.kind === 'ok' ? { kind: 'ok', count: result.value.length } : { kind: result.kind === 'not_found' ? 'unreachable' : result.kind }
  );
  const list = async (service: Service, path: string): Promise<Result<unknown[]>> => {
    const result = await read(services[service], path);
    if (result.kind !== 'ok') return result;
    return Array.isArray(result.value) ? { kind: 'ok', value: result.value } : { kind: 'unreachable' };
  };
  // Profile and tag names are decoration: a failed read leaves them empty instead of failing the page.
  const optional = async (service: Service, path: string): Promise<unknown> => {
    const result = await read(services[service], path);
    return result.kind === 'ok' ? result.value : undefined;
  };

  const owned = async (service: Service, path: string): Promise<Result<Record<string, unknown>>> => {
    const result = await read(services[service], path);
    if (result.kind !== 'ok') return result;
    return isRecord(result.value) ? { kind: 'ok', value: result.value } : { kind: 'unreachable' };
  };

  return {
    async titles(): Promise<{ titles: LibraryTitle[]; services: { sonarr: Outcome; radarr: Outcome } }> {
      const fetchService = async (service: Service) => {
        const [items, profiles] = await Promise.all([
          list(service, service === 'sonarr' ? '/api/v3/series' : '/api/v3/movie'),
          optional(service, '/api/v3/qualityprofile'),
        ]);
        const titles = items.kind === 'ok' ? items.value.flatMap((raw) => (isRecord(raw) ? toTitle(service, raw, profiles) : [])) : [];
        return { titles, outcome: outcome(items) };
      };
      const [sonarr, radarr] = await Promise.all([fetchService('sonarr'), fetchService('radarr')]);
      return { titles: newestFirst([...sonarr.titles, ...radarr.titles]), services: { sonarr: sonarr.outcome, radarr: radarr.outcome } };
    },

    async series(id: number): Promise<Result<SeriesDetail>> {
      const [raw, episodes, profiles, tags] = await Promise.all([
        owned('sonarr', `/api/v3/series/${id}?includeSeasonImages=true`),
        list('sonarr', `/api/v3/episode?seriesId=${id}&includeEpisodeFile=true&includeImages=true`),
        optional('sonarr', '/api/v3/qualityprofile'),
        optional('sonarr', '/api/v3/tag'),
      ]);
      if (raw.kind !== 'ok') return raw;
      if (episodes.kind !== 'ok') return episodes;
      return { kind: 'ok', value: seriesDetail(raw.value, { profiles, tags, episodes: episodes.value, owned: true }) };
    },

    async movie(id: number): Promise<Result<MovieDetail>> {
      const [raw, profiles, tags] = await Promise.all([
        owned('radarr', `/api/v3/movie/${id}`),
        optional('radarr', '/api/v3/qualityprofile'),
        optional('radarr', '/api/v3/tag'),
      ]);
      if (raw.kind !== 'ok') return raw;
      return { kind: 'ok', value: movieDetail(raw.value, { profiles, tags, owned: true }) };
    },

    async preview(service: Service, id: number): Promise<Result<SeriesDetail | MovieDetail>> {
      const found = await list(service, service === 'sonarr' ? `/api/v3/series/lookup?term=tvdb:${id}` : `/api/v3/movie/lookup?term=tmdb:${id}`);
      if (found.kind !== 'ok') return found;
      const first = found.value[0];
      if (!isRecord(first)) return { kind: 'not_found' };
      return {
        kind: 'ok',
        value: service === 'sonarr' ? seriesDetail(first, { owned: false }) : movieDetail(first, { owned: false }),
      };
    },

    async history(subject: HistorySubject): Promise<Result<HistoryEntry[]>> {
      const path = 'episodeId' in subject
        ? `/api/v3/history?episodeId=${subject.episodeId}&page=1&pageSize=50&sortKey=date&sortDirection=descending`
        : 'seriesId' in subject
          ? `/api/v3/history/series?seriesId=${subject.seriesId}`
          : `/api/v3/history/movie?movieId=${subject.movieId}`;
      const result = await read(services[subject.service], path);
      return result.kind === 'ok' ? { kind: 'ok', value: historyEntries(result.value) } : result;
    },

    async monitor(change: MonitorChange): Promise<Result<void>> {
      const { monitored } = change;
      if (change.kind === 'series') return write(services.sonarr, '/api/v3/series/editor', 'PUT', { seriesIds: [change.seriesId], monitored });
      if (change.kind === 'episodes') return write(services.sonarr, '/api/v3/episode/monitor', 'PUT', { episodeIds: change.episodeIds, monitored });
      if (change.kind === 'movie') return write(services.radarr, '/api/v3/movie/editor', 'PUT', { movieIds: [change.movieId], monitored });
      const raw = await owned('sonarr', `/api/v3/series/${change.seriesId}`);
      if (raw.kind !== 'ok') return raw;
      const seasons = Array.isArray(raw.value.seasons) ? raw.value.seasons : [];
      const index = seasons.findIndex((season) => isRecord(season) && season.seasonNumber === change.seasonNumber);
      if (index === -1) return { kind: 'not_found' };
      const updated = { ...raw.value, seasons: seasons.map((season, position) => (position === index ? { ...(season as Record<string, unknown>), monitored } : season)) };
      return write(services.sonarr, `/api/v3/series/${change.seriesId}`, 'PUT', updated);
    },

    async search(request: Target): Promise<Result<void>> {
      if (request.kind === 'series') return write(services.sonarr, '/api/v3/command', 'POST', { name: 'SeriesSearch', seriesId: request.seriesId });
      if (request.kind === 'season') {
        return write(services.sonarr, '/api/v3/command', 'POST', { name: 'SeasonSearch', seriesId: request.seriesId, seasonNumber: request.seasonNumber });
      }
      if (request.kind === 'episodes') return write(services.sonarr, '/api/v3/command', 'POST', { name: 'EpisodeSearch', episodeIds: request.episodeIds });
      return write(services.radarr, '/api/v3/command', 'POST', { name: 'MoviesSearch', movieIds: [request.movieId] });
    },

    async refresh(request: RefreshRequest): Promise<Result<void>> {
      if (request.kind === 'series') return write(services.sonarr, '/api/v3/command', 'POST', { name: 'RefreshSeries', seriesId: request.seriesId });
      return write(services.radarr, '/api/v3/command', 'POST', { name: 'RefreshMovie', movieIds: [request.movieId] });
    },

    async calendar(start: string, end: string): Promise<{ entries: CalendarEntry[]; services: { sonarr: Outcome; radarr: Outcome } }> {
      const window = `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&unmonitored=false`;
      const [episodes, movies] = await Promise.all([
        list('sonarr', `/api/v3/calendar?${window}&includeSeries=true&includeEpisodeFile=true`),
        list('radarr', `/api/v3/calendar?${window}`),
      ]);
      const from = Date.parse(start);
      const until = Date.parse(end);
      const entries: CalendarEntry[] = [];
      if (episodes.kind === 'ok') {
        for (const episode of records(episodes.value)) {
          const id = positiveInteger(episode.id);
          const seriesId = positiveInteger(episode.seriesId);
          const seasonNumber = finiteNumber(episode.seasonNumber);
          const episodeNumber = finiteNumber(episode.episodeNumber);
          const at = text(episode.airDateUtc);
          const series = isRecord(episode.series) ? episode.series : {};
          if (id === null || seriesId === null || seasonNumber === null || episodeNumber === null || at === null) continue;
          const file = fileDetail(episode.episodeFile);
          entries.push({
            service: 'sonarr',
            kind: 'episode',
            id,
            seriesId,
            seriesTitle: text(series.title) ?? '',
            seasonNumber,
            episodeNumber,
            title: text(episode.title),
            at,
            hasFile: episode.hasFile === true,
            monitored: episode.monitored === true,
            quality: file?.quality ?? null,
            finaleType: text(episode.finaleType),
          });
        }
      }
      if (movies.kind === 'ok') {
        for (const movie of records(movies.value)) {
          const id = positiveInteger(movie.id);
          const title = text(movie.title);
          if (id === null || title === null) continue;
          const releases = [['cinema', movie.inCinemas], ['digital', movie.digitalRelease], ['physical', movie.physicalRelease]] as const;
          for (const [release, value] of releases) {
            const at = text(value);
            const time = at === null ? Number.NaN : Date.parse(at);
            if (at === null || !(time >= from && time < until)) continue;
            entries.push({
              service: 'radarr',
              kind: 'movie',
              id,
              title,
              year: finiteNumber(movie.year),
              at,
              release,
              hasFile: movie.hasFile === true,
              monitored: movie.monitored === true,
              isAvailable: movie.isAvailable === true,
            });
          }
        }
      }
      entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      return { entries, services: { sonarr: outcome(episodes), radarr: outcome(movies) } };
    },
  };
};

export type Library = ReturnType<typeof createLibrary>;

const MAX_WINDOW_MS = 45 * 24 * 60 * 60 * 1_000;
const MAX_EPISODE_IDS = 100;

// The fields each kind of request carries besides service and kind.
const targetFields = {
  'sonarr/series': ['seriesId'],
  'sonarr/season': ['seriesId', 'seasonNumber'],
  'sonarr/episodes': ['episodeIds'],
  'radarr/movie': ['movieId'],
} as const;

const parseTarget = (body: unknown, extra: 'monitored' | undefined, only?: string[]): (Target & { monitored?: boolean }) | undefined => {
  if (!isRecord(body)) return undefined;
  const key = `${String(body.service)}/${String(body.kind)}` as keyof typeof targetFields;
  if (!Object.hasOwn(targetFields, key)) return undefined;
  if (only !== undefined && !only.includes(key)) return undefined;
  const fields: readonly string[] = targetFields[key];
  const allowed = new Set(['service', 'kind', ...fields, ...(extra === undefined ? [] : [extra])]);
  if (Object.keys(body).some((name) => !allowed.has(name))) return undefined;
  for (const field of fields) {
    const value = body[field];
    if (field === 'episodeIds') {
      if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EPISODE_IDS || value.some((id) => positiveInteger(id) === null)) return undefined;
    } else if (field === 'seasonNumber') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return undefined;
    } else if (positiveInteger(value) === null) return undefined;
  }
  if (extra !== undefined && typeof body[extra] !== 'boolean') return undefined;
  return body as Target & { monitored?: boolean };
};

export const createLibraryRoutes = (library: Library) => {
  const routes = new Hono();
  const statusFor = (kind: string) => (kind === 'not_configured' ? 503 : kind === 'not_found' ? 404 : 502);
  const invalid = { error: 'invalid_request' };
  const failure = (context: { json: (body: unknown, status: 400 | 404 | 502 | 503) => Response }, result: Failure) => (
    context.json(result.reason === undefined ? { error: result.kind } : { error: result.kind, reason: result.reason }, statusFor(result.kind))
  );

  routes.get('/titles', async (context) => context.json(await library.titles()));

  routes.get('/series/:id', async (context) => {
    const id = positiveInteger(Number(context.req.param('id')));
    if (id === null) return context.json(invalid, 400);
    const result = await library.series(id);
    return result.kind === 'ok' ? context.json(result.value) : failure(context, result);
  });
  routes.get('/movie/:id', async (context) => {
    const id = positiveInteger(Number(context.req.param('id')));
    if (id === null) return context.json(invalid, 400);
    const result = await library.movie(id);
    return result.kind === 'ok' ? context.json(result.value) : failure(context, result);
  });
  routes.get('/preview/:service/:id', async (context) => {
    const service = context.req.param('service');
    const id = positiveInteger(Number(context.req.param('id')));
    if ((service !== 'sonarr' && service !== 'radarr') || id === null) return context.json(invalid, 400);
    const result = await library.preview(service, id);
    return result.kind === 'ok' ? context.json(result.value) : failure(context, result);
  });

  routes.get('/history', async (context) => {
    const { service, episodeId, seriesId, movieId } = context.req.query();
    const id = (value: string | undefined) => (value === undefined ? null : positiveInteger(Number(value)));
    let subject: HistorySubject | undefined;
    if (service === 'sonarr' && movieId === undefined && (episodeId === undefined) !== (seriesId === undefined)) {
      const episode = id(episodeId);
      const series = id(seriesId);
      if (episode !== null) subject = { service, episodeId: episode };
      else if (series !== null) subject = { service, seriesId: series };
    } else if (service === 'radarr' && episodeId === undefined && seriesId === undefined) {
      const movie = id(movieId);
      if (movie !== null) subject = { service, movieId: movie };
    }
    if (subject === undefined) return context.json(invalid, 400);
    const result = await library.history(subject);
    return result.kind === 'ok' ? context.json(result.value) : failure(context, result);
  });

  routes.get('/calendar', async (context) => {
    const { start, end } = context.req.query();
    const from = start === undefined ? Number.NaN : Date.parse(start);
    const until = end === undefined ? Number.NaN : Date.parse(end);
    if (Number.isNaN(from) || Number.isNaN(until) || until <= from || until - from > MAX_WINDOW_MS) return context.json(invalid, 400);
    return context.json(await library.calendar(new Date(from).toISOString(), new Date(until).toISOString()));
  });

  const writeRoute = (path: string, withMonitored: boolean, only: string[] | undefined, run: (target: never) => Promise<Result<void>>) => {
    routes.post(path, async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json(invalid, 400);
      }
      const target = parseTarget(body, withMonitored ? 'monitored' : undefined, only);
      if (target === undefined) return context.json(invalid, 400);
      const result = await run(target as never);
      return result.kind === 'ok' ? context.body(null, 204) : failure(context, result);
    });
  };
  writeRoute('/monitor', true, undefined, (change) => library.monitor(change));
  writeRoute('/search', false, undefined, (request) => library.search(request));
  writeRoute('/refresh', false, ['sonarr/series', 'radarr/movie'], (request) => library.refresh(request));
  return routes;
};
