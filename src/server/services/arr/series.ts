import { count, finiteNumber, idList, type Image, otherTitles, parseImages, positiveInteger, records, stringList, text } from './files.js';
import { isRecord, refusal, type Result, type Send } from './result.js';

export type Series = {
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
  images: Image[];
  rating: number | null;
  ratingVotes: number | null;
  certification: string | null;
  genres: string[];
  runtime: number | null;
  path: string | null;
  tags: number[];
  imdbId: string | null;
  tvdbId: number | null;
  tmdbId: number | null;
  monitored: boolean;
  monitorNewItems: string | null;
  qualityProfileId: number | null;
  added: string | null;
  statistics: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number | null;
  };
  releaseGroups: string[];
  seasons: {
    seasonNumber: number;
    monitored: boolean;
    images: Image[];
    statistics: {
      episodeFileCount: number;
      episodeCount: number;
      totalEpisodeCount: number;
      sizeOnDisk: number;
      nextAiring: string | null;
      previousAiring: string | null;
    };
  }[];
};

export const parseSeries = (value: unknown): Series | null => {
  if (!isRecord(value)) return null;
  const statistics = isRecord(value.statistics) ? value.statistics : {};
  const ratings = isRecord(value.ratings) ? value.ratings : {};
  const title = text(value.title) ?? '';
  return {
    id: positiveInteger(value.id),
    title,
    alternateTitles: otherTitles(value.alternateTitles, title),
    year: finiteNumber(value.year),
    status: text(value.status),
    ended: value.ended === true,
    airTime: text(value.airTime),
    firstAired: text(value.firstAired),
    lastAired: text(value.lastAired),
    nextAiring: text(value.nextAiring),
    previousAiring: text(value.previousAiring),
    network: text(value.network),
    language: isRecord(value.originalLanguage) ? text(value.originalLanguage.name) : null,
    overview: text(value.overview),
    images: parseImages(value.images),
    rating: finiteNumber(ratings.value),
    ratingVotes: finiteNumber(ratings.votes),
    certification: text(value.certification),
    genres: stringList(value.genres),
    runtime: finiteNumber(value.runtime),
    path: text(value.path),
    tags: idList(value.tags),
    imdbId: text(value.imdbId),
    tvdbId: positiveInteger(value.tvdbId),
    tmdbId: positiveInteger(value.tmdbId),
    monitored: value.monitored === true,
    monitorNewItems: text(value.monitorNewItems),
    qualityProfileId: positiveInteger(value.qualityProfileId),
    added: text(value.added),
    statistics: {
      seasonCount: count(statistics.seasonCount),
      episodeFileCount: count(statistics.episodeFileCount),
      episodeCount: count(statistics.episodeCount),
      totalEpisodeCount: count(statistics.totalEpisodeCount),
      sizeOnDisk: count(statistics.sizeOnDisk),
      percentOfEpisodes: finiteNumber(statistics.percentOfEpisodes),
    },
    releaseGroups: stringList(statistics.releaseGroups),
    seasons: records(value.seasons).flatMap((season) => {
      const seasonNumber = finiteNumber(season.seasonNumber);
      if (seasonNumber === null) return [];
      const stats = isRecord(season.statistics) ? season.statistics : {};
      return [{
        seasonNumber,
        monitored: season.monitored === true,
        images: parseImages(season.images),
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
  };
};

const done = (answer: Result<unknown>): Result<void> => (answer.kind === 'ok' ? { kind: 'ok', value: undefined } : answer);

export const createSeries = ({ label, send }: { label: string; send: Send }) => {
  const list = async (operation: string, path: string): Promise<Result<Series[]>> => {
    const answer = await send(operation, path);
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!Array.isArray(body)) return refusal(`${label} sent no list of records for ${operation}.`);
    return { kind: 'ok', value: body.flatMap((item) => parseSeries(item) ?? []) };
  };

  // The raw record goes back to Sonarr whole, so fields this app does not parse survive the PUT.
  const raw = async (operation: string, seriesId: number): Promise<Result<Record<string, unknown>>> => {
    const answer = await send(operation, `/api/v3/series/${seriesId}`);
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    return isRecord(body) ? { kind: 'ok', value: body } : refusal(`${label} sent no record for ${operation}.`);
  };

  const listSeries = () => list('the series list', '/api/v3/series');

  const series = async (seriesId: number): Promise<Result<Series>> => {
    const operation = 'the series read';
    const answer = await send(operation, `/api/v3/series/${seriesId}?includeSeasonImages=true`);
    if (answer.kind !== 'ok') return answer;
    const parsed = parseSeries(answer.value.body);
    return parsed === null ? refusal(`${label} sent no record for ${operation}.`) : { kind: 'ok', value: parsed };
  };

  const lookupSeries = (term: string) => list('the series lookup', `/api/v3/series/lookup?term=${encodeURIComponent(term)}`);

  // The add body must be the lookup's own record: Sonarr takes the title, images and seasons from it.
  const addSeries = async (tvdbId: number, fields: Record<string, unknown>): Promise<Result<{ id: number }>> => {
    const operation = 'the series add';
    const found = await send(operation, `/api/v3/series/lookup?term=${encodeURIComponent(`tvdb:${tvdbId}`)}`);
    if (found.kind !== 'ok') return found;
    if (!Array.isArray(found.value.body)) return refusal(`${label} sent no list of records for ${operation}.`);
    const match = found.value.body.find((item) => isRecord(item) && item.tvdbId === tvdbId);
    if (match === undefined) return { kind: 'not_found', message: `${label} has no such item for ${operation}.` };
    const added = await send(operation, '/api/v3/series', { method: 'POST', body: { ...match, ...fields } });
    if (added.kind !== 'ok') return added;
    const id = isRecord(added.value.body) ? positiveInteger(added.value.body.id) : null;
    return id === null ? refusal(`${label} sent no id for ${operation}.`) : { kind: 'ok', value: { id } };
  };

  const monitorSeries = async (seriesId: number, monitored: boolean): Promise<Result<void>> => done(
    await send('the series monitor change', '/api/v3/series/editor', { method: 'PUT', body: { seriesIds: [seriesId], monitored } }),
  );

  const monitorSeason = async (seriesId: number, seasonNumber: number, monitored: boolean): Promise<Result<void>> => {
    const operation = 'the season monitor change';
    const record = await raw(operation, seriesId);
    if (record.kind !== 'ok') return record;
    const seasons = Array.isArray(record.value.seasons) ? record.value.seasons : [];
    const index = seasons.findIndex((season) => isRecord(season) && season.seasonNumber === seasonNumber);
    if (index === -1) return { kind: 'not_found', message: `${label} has no such item for ${operation}.` };
    const updated = { ...record.value, seasons: seasons.map((season, position) => (position === index ? { ...(season as Record<string, unknown>), monitored } : season)) };
    return done(await send(operation, `/api/v3/series/${seriesId}`, { method: 'PUT', body: updated }));
  };

  const setTag = async (seriesId: number, tagId: number, tagged: boolean): Promise<Result<void>> => {
    const operation = 'the tag change';
    const record = await raw(operation, seriesId);
    if (record.kind !== 'ok') return record;
    const tags = idList(record.value.tags);
    if (tags.includes(tagId) === tagged) return { kind: 'ok', value: undefined };
    const body = { ...record.value, tags: tagged ? [...tags, tagId] : tags.filter((id) => id !== tagId) };
    return done(await send(operation, `/api/v3/series/${seriesId}`, { method: 'PUT', body }));
  };

  // Sonarr deletes the files in the background after it answers, and never adds an import list exclusion here.
  const deleteSeries = async (seriesId: number): Promise<Result<void>> => done(
    await send('the series delete', `/api/v3/series/${seriesId}?deleteFiles=true&addImportListExclusion=false`, { method: 'DELETE' }),
  );

  return { listSeries, series, lookupSeries, addSeries, monitorSeries, monitorSeason, setTag, deleteSeries };
};
