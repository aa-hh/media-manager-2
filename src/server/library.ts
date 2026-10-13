import { Hono } from 'hono';
import {
  type ArrServices,
  type Credit,
  type Episode,
  type FileDetail,
  type HistoryRecord,
  type Movie,
  parseFile,
  parseMovie,
  parseSeries,
  type Ratings,
  type Result as ArrResult,
  type Series,
} from './services/arr.js';
import { lookupTitle } from './search.js';
import { notConfigured } from './services/arr/result.js';
import type { SecondVersionRow, TrackedHitAndRun } from './secondVersionRows.js';
import { type Mdblist, noRatings, type RatingsBySite } from './services/mdblist.js';
import type { TitleStore } from './titleStore.js';

export type { FileDetail };

type Arr = ArrServices[keyof ArrServices];
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
  tmdbId: number | null;
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
  alternateTitles: string[];
  year: number | null;
  status: string | null;
  ended: boolean;
  airTime: string | null;
  firstAired: string | null;
  lastAired: string | null;
  nextAiring: string | null;
  previousAiring: string | null;
  network: string | null;
  language: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  ratingVotes: number | null;
  ratingsBySite: RatingsBySite;
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
  statistics: Series['statistics'];
  releaseGroups: string[];
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
  originalTitle: string | null;
  originalLanguage: string | null;
  alternateTitles: string[];
  year: number | null;
  status: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  // Kept until the client reads ratings instead.
  rating: number | null;
  ratings: Ratings;
  keywords: string[];
  youTubeTrailerId: string | null;
  website: string | null;
  certification: string | null;
  genres: string[];
  runtime: number | null;
  studio: string | null;
  collection: string | null;
  collectionTmdbId: number | null;
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
  releaseDate: string | null;
  releaseGroups: string[];
  file: FileDetail | null;
};

export type Credits = {
  cast: Array<{ name: string; character: string | null; order: number | null; photoUrl: string | null; tmdbId: number | null }>;
  crew: Array<{ name: string; job: string | null; department: string | null; photoUrl: string | null; tmdbId: number | null }>;
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

const webUrl = (value: unknown): string | null => {
  const url = text(value);
  if (url === null) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
};

// Only an absolute http(s) remoteUrl may reach the browser: the local url is served by the service and needs its key.
export const imageUrl = (images: unknown, coverType: string): string | null => {
  for (const image of records(images)) {
    if (image.coverType !== coverType) continue;
    const url = webUrl(image.remoteUrl);
    if (url !== null) return url;
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

const episodeDetails = (episodes: Episode[]): EpisodeDetail[] => episodes
  .map((episode): EpisodeDetail => ({
    id: episode.id,
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    airDate: episode.airDateUtc,
    monitored: episode.monitored,
    hasFile: episode.hasFile,
    overview: episode.overview,
    runtime: episode.runtime,
    finaleType: episode.finaleType,
    absoluteEpisodeNumber: episode.absoluteEpisodeNumber,
    sceneSeasonNumber: episode.sceneSeasonNumber,
    sceneEpisodeNumber: episode.sceneEpisodeNumber,
    unverifiedSceneNumbering: episode.unverifiedSceneNumbering,
    lastSearchTime: episode.lastSearchTime,
    imageUrl: imageUrl(episode.images, 'screenshot'),
    file: episode.file,
  }))
  .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);

const seriesDetail = (record: Series, extras: { profiles?: unknown; tags?: unknown; episodes?: Episode[]; owned: boolean; ratingsBySite: RatingsBySite }): SeriesDetail => ({
  id: extras.owned ? record.id : null,
  title: record.title,
  alternateTitles: record.alternateTitles,
  year: record.year,
  status: record.status,
  ended: record.ended,
  airTime: record.airTime,
  firstAired: record.firstAired,
  lastAired: record.lastAired,
  nextAiring: record.nextAiring,
  previousAiring: record.previousAiring,
  network: record.network,
  language: record.language,
  overview: record.overview,
  posterUrl: imageUrl(record.images, 'poster'),
  backdropUrl: imageUrl(record.images, 'fanart'),
  rating: record.rating,
  ratingVotes: record.ratingVotes,
  ratingsBySite: extras.ratingsBySite,
  certification: record.certification,
  genres: record.genres,
  runtime: record.runtime,
  path: extras.owned ? record.path : null,
  tags: extras.owned ? tagNames(extras.tags, record.tags) : [],
  links: { imdbId: record.imdbId, tvdbId: record.tvdbId, tmdbId: record.tmdbId },
  monitored: record.monitored,
  monitorNewItems: record.monitorNewItems,
  qualityProfile: extras.owned ? profileById(extras.profiles, record.qualityProfileId) : null,
  added: record.added,
  statistics: record.statistics,
  releaseGroups: record.releaseGroups,
  seasons: record.seasons.map((season) => ({
    seasonNumber: season.seasonNumber,
    monitored: season.monitored,
    posterUrl: imageUrl(season.images, 'poster'),
    statistics: season.statistics,
  })),
  episodes: episodeDetails(extras.episodes ?? []),
});

const movieDetail = (record: Movie, extras: { profiles?: unknown; tags?: unknown; owned: boolean }): MovieDetail => ({
  id: extras.owned ? record.id : null,
  title: record.title,
  originalTitle: record.originalTitle,
  originalLanguage: record.originalLanguage,
  alternateTitles: record.alternateTitles,
  year: record.year,
  status: record.status,
  overview: record.overview,
  posterUrl: imageUrl(record.images, 'poster'),
  backdropUrl: imageUrl(record.images, 'fanart'),
  rating: record.rating,
  ratings: record.ratings,
  keywords: record.keywords,
  youTubeTrailerId: record.youTubeTrailerId,
  website: webUrl(record.website),
  certification: record.certification,
  genres: record.genres,
  runtime: record.runtime,
  studio: record.studio,
  collection: record.collection,
  collectionTmdbId: record.collectionTmdbId,
  path: extras.owned ? record.path : null,
  tags: extras.owned ? tagNames(extras.tags, record.tags) : [],
  links: { imdbId: record.imdbId, tmdbId: record.tmdbId },
  monitored: record.monitored,
  hasFile: record.hasFile,
  isAvailable: record.isAvailable,
  minimumAvailability: record.minimumAvailability,
  qualityProfile: extras.owned ? profileById(extras.profiles, record.qualityProfileId) : null,
  added: record.added,
  lastSearchTime: record.lastSearchTime,
  sizeOnDisk: record.sizeOnDisk,
  releaseDates: { inCinemas: record.inCinemas, digital: record.digitalRelease, physical: record.physicalRelease },
  releaseDate: record.releaseDate,
  releaseGroups: record.releaseGroups,
  file: extras.owned ? record.file : null,
});

// A headshot's url is Radarr's own proxy path, so only its public remoteUrl may reach the browser.
const creditList = (credits: Credit[]): Credits => ({
  cast: credits.filter((credit) => credit.type === 'cast')
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map(({ name, character, order, images, tmdbId }) => ({ name, character, order, photoUrl: imageUrl(images, 'headshot'), tmdbId })),
  crew: credits.filter((credit) => credit.type === 'crew')
    .map(({ name, job, department, images, tmdbId }) => ({ name, job, department, photoUrl: imageUrl(images, 'headshot'), tmdbId })),
});

const toTitle = (service: Service, record: Series | Movie, profiles: unknown): LibraryTitle[] => {
  const { id, title } = record;
  if (id === null || title === '') return [];
  const profile = profileById(profiles, record.qualityProfileId);
  const base = {
    service,
    id,
    tmdbId: record.tmdbId,
    title,
    year: record.year,
    added: record.added,
    monitored: record.monitored,
    status: record.status,
    posterUrl: imageUrl(record.images, 'poster'),
    qualityProfile: profile?.name ?? null,
  };
  if (service === 'sonarr') {
    const { statistics } = record as Series;
    return [{
      ...base,
      type: 'tv',
      sizeOnDisk: statistics.sizeOnDisk,
      tv: {
        episodeFileCount: statistics.episodeFileCount,
        episodeCount: statistics.episodeCount,
        totalEpisodeCount: statistics.totalEpisodeCount,
        seasonCount: statistics.seasonCount,
      },
      movie: null,
    }];
  }
  const movie = record as Movie;
  return [{
    ...base,
    type: 'movie',
    sizeOnDisk: movie.sizeOnDisk,
    tv: null,
    movie: { hasFile: movie.hasFile, isAvailable: movie.isAvailable },
  }];
};

const historyEntries = (list: HistoryRecord[]): HistoryEntry[] => {
  const entries = list.map((record): HistoryEntry => ({
    at: record.date,
    eventType: record.eventType === '' ? 'unknown' : record.eventType,
    sourceTitle: record.sourceTitle,
    quality: record.quality,
    detail: [record.data.message, record.data.reason, record.data.indexer].find((part) => part !== undefined && part !== '') ?? '',
  }));
  const time = (at: string | null) => {
    const parsed = at === null ? Number.NaN : Date.parse(at);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return entries.sort((a, b) => time(b.at) - time(a.at)).slice(0, 50);
};

// A Sonarr or Radarr refusal reads as unreachable here, with its message as the reason.
const fromArr = <T>(result: ArrResult<T>): Result<T> => {
  if (result.kind === 'ok') return result;
  if (result.kind === 'refused') return { kind: 'unreachable', reason: result.message };
  return { kind: result.kind };
};

type VersionRows = {
  (title: { service: 'radarr'; movieId: number }): SecondVersionRow[];
  (title: { service: 'sonarr'; seriesId: number }): SecondVersionRow[];
};

type TrackedRows = {
  (title: { service: 'radarr'; movieId: number }): TrackedHitAndRun[];
  (title: { service: 'sonarr'; seriesId: number }): TrackedHitAndRun[];
};

// The tracked version comes from Sonarr or Radarr; second versions come from this app's own records, beside it.
export const createLibrary = (
  services: ArrServices,
  versionRows: VersionRows,
  store: TitleStore,
  mdblist?: Pick<Mdblist, 'showRatings'>,
  tvdbIdOf?: (tmdbId: number) => Promise<ArrResult<number | null>>,
  backdropOf?: (type: 'tv' | 'movie', ids: { tmdbId: number | null; tvdbId: number | null }) => Promise<string | null>,
  trackedHitAndRun: TrackedRows = () => [],
) => {
  // The chosen backdrop source (TMDB unless set) beats Sonarr's TVDB fanart and Radarr's older copy; fanart stays the fallback.
  const backdropUrl = async (type: 'tv' | 'movie', record: Series | Movie) => (
    (backdropOf === undefined ? null : await backdropOf(type, { tmdbId: record.tmdbId, tvdbId: 'tvdbId' in record ? record.tvdbId : null }))
      ?? imageUrl(record.images, 'fanart')
  );
  const showRatings = (record: Series) => (
    mdblist === undefined ? Promise.resolve(noRatings) : mdblist.showRatings(store, { tvdbId: record.tvdbId, tmdbId: record.tmdbId })
  );
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

  return {
    async titles(): Promise<{ titles: LibraryTitle[]; services: { sonarr: Outcome; radarr: Outcome } }> {
      const fetchService = async (service: Service) => {
        const [items, profiles] = await Promise.all([
          (service === 'sonarr' ? services.sonarr.listSeries() : services.radarr.listMovies()).then((result) => fromArr<Array<Series | Movie>>(result)),
          optional(service, '/api/v3/qualityprofile'),
        ]);
        const titles = items.kind === 'ok' ? items.value.flatMap((record) => toTitle(service, record, profiles)) : [];
        return { titles, outcome: outcome(items) };
      };
      const [sonarr, radarr] = await Promise.all([fetchService('sonarr'), fetchService('radarr')]);
      return { titles: newestFirst([...sonarr.titles, ...radarr.titles]), services: { sonarr: sonarr.outcome, radarr: radarr.outcome } };
    },

    async series(id: number): Promise<Result<SeriesDetail & { secondVersions: SecondVersionRow[]; trackedHitAndRun: TrackedHitAndRun[] }>> {
      const read = services.sonarr.series(id).then(fromArr);
      const [record, episodes, profiles, tags, backdrop] = await Promise.all([
        read,
        services.sonarr.episodes(id, { withFiles: true }).then(fromArr),
        optional('sonarr', '/api/v3/qualityprofile'),
        optional('sonarr', '/api/v3/tag'),
        read.then((found) => (found.kind === 'ok' ? backdropUrl('tv', found.value) : null)),
      ]);
      if (record.kind !== 'ok') return record;
      if (episodes.kind !== 'ok') return episodes;
      const ratingsBySite = await showRatings(record.value);
      return {
        kind: 'ok',
        value: {
          ...seriesDetail(record.value, { profiles, tags, episodes: episodes.value, owned: true, ratingsBySite }),
          backdropUrl: backdrop,
          secondVersions: versionRows({ service: 'sonarr', seriesId: id }),
          trackedHitAndRun: trackedHitAndRun({ service: 'sonarr', seriesId: id }),
        },
      };
    },

    // Credits cost one more Radarr call, so only this route asks for them; a failed read leaves them empty.
    async movie(id: number): Promise<Result<MovieDetail & { credits: Credits; secondVersions: SecondVersionRow[]; trackedHitAndRun: TrackedHitAndRun[] }>> {
      const read = services.radarr.movie(id).then(fromArr);
      const [record, profiles, tags, credits, backdrop] = await Promise.all([
        read,
        optional('radarr', '/api/v3/qualityprofile'),
        optional('radarr', '/api/v3/tag'),
        services.radarr.credits(id),
        read.then((found) => (found.kind === 'ok' ? backdropUrl('movie', found.value) : null)),
      ]);
      if (record.kind !== 'ok') return record;
      return {
        kind: 'ok',
        value: {
          ...movieDetail(record.value, { profiles, tags, owned: true }),
          backdropUrl: backdrop,
          credits: creditList(credits.kind === 'ok' ? credits.value : []),
          secondVersions: versionRows({ service: 'radarr', movieId: id }),
          trackedHitAndRun: trackedHitAndRun({ service: 'radarr', movieId: id }),
        },
      };
    },

    // Titles outside the library read the saved lookup record; library titles above always ask Sonarr or Radarr.
    async preview(service: Service, id: number): Promise<Result<SeriesDetail | MovieDetail>> {
      const found = fromArr(await lookupTitle(services, store, service, id));
      if (found.kind !== 'ok') return found;
      const show = service === 'sonarr' ? parseSeries(found.value) : null;
      const movie = service === 'radarr' ? parseMovie(found.value) : null;
      if (show !== null) {
        const [ratingsBySite, backdrop] = await Promise.all([showRatings(show), backdropUrl('tv', show)]);
        return { kind: 'ok', value: { ...seriesDetail(show, { owned: false, ratingsBySite }), backdropUrl: backdrop } };
      }
      return movie === null ? { kind: 'not_found' } : { kind: 'ok', value: { ...movieDetail(movie, { owned: false }), backdropUrl: await backdropUrl('movie', movie) } };
    },

    // Discover cards know a show only by its TMDB id; Sonarr looks shows up by TVDB id.
    async previewShowByTmdbId(tmdbId: number): Promise<Result<SeriesDetail | MovieDetail>> {
      if (tvdbIdOf === undefined) return { kind: 'not_configured', reason: notConfigured('TMDB', 'the show preview').message };
      const found = await tvdbIdOf(tmdbId);
      if (found.kind !== 'ok') return { kind: found.kind === 'refused' ? 'unreachable' : found.kind, reason: found.message };
      if (found.value === null) return { kind: 'not_found', reason: 'TMDB knows no TVDB id for this show.' };
      return this.preview('sonarr', found.value);
    },

    async history(subject: HistorySubject): Promise<Result<HistoryEntry[]>> {
      const result = fromArr('episodeId' in subject
        ? await services.sonarr.history({ episodeId: subject.episodeId })
        : 'seriesId' in subject
          ? await services.sonarr.history({ seriesId: subject.seriesId })
          : await services.radarr.history({ movieId: subject.movieId }));
      return result.kind === 'ok' ? { kind: 'ok', value: historyEntries(result.value) } : result;
    },

    async monitor(change: MonitorChange): Promise<Result<void>> {
      const { monitored } = change;
      if (change.kind === 'series') return fromArr(await services.sonarr.monitorSeries(change.seriesId, monitored));
      if (change.kind === 'episodes') return fromArr(await services.sonarr.monitorEpisodes(change.episodeIds, monitored));
      if (change.kind === 'movie') return fromArr(await services.radarr.monitorMovie(change.movieId, monitored));
      return fromArr(await services.sonarr.monitorSeason(change.seriesId, change.seasonNumber, monitored));
    },

    async search(request: Target): Promise<Result<void>> {
      if (request.kind === 'series') return fromArr(await services.sonarr.searchAutomatically({ seriesId: request.seriesId }));
      if (request.kind === 'season') {
        return fromArr(await services.sonarr.searchAutomatically({ seriesId: request.seriesId, seasonNumber: request.seasonNumber }));
      }
      if (request.kind === 'episodes') return fromArr(await services.sonarr.searchAutomatically({ episodeIds: request.episodeIds }));
      return fromArr(await services.radarr.searchAutomatically({ movieIds: [request.movieId] }));
    },

    async refresh(request: RefreshRequest): Promise<Result<void>> {
      if (request.kind === 'series') return fromArr(await services.sonarr.refreshTitle(request.seriesId));
      return fromArr(await services.radarr.refreshTitle(request.movieId));
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
          const file = parseFile(episode.episodeFile);
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
  routes.get('/preview/sonarr/tmdb/:tmdbId', async (context) => {
    const tmdbId = positiveInteger(Number(context.req.param('tmdbId')));
    if (tmdbId === null) return context.json(invalid, 400);
    const result = await library.previewShowByTmdbId(tmdbId);
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
