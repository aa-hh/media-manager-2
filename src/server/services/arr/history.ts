import { isRecord, refusal, type Result, type Send, type Service } from './result.js';

export type HistoryRecord = {
  id: number | null;
  eventType: string;
  date: string | null;
  downloadId: string | null;
  movieId: number | null;
  seriesId: number | null;
  episodeId: number | null;
  sourceTitle: string | null;
  quality: string | null;
  formats: string[];
  formatScore: number | null;
  movie: { title: string; year: number | null } | null;
  series: { title: string } | null;
  episode: { seasonNumber: number; episodeNumber: number } | null;
  data: Record<string, string>;
};

export type HistoryFilterBase = { since?: number; downloadId?: string; eventType?: 'grabbed'; page?: number; pageSize?: number };
export type SonarrHistoryFilter = HistoryFilterBase & { seriesId?: number; episodeId?: number; seasonNumber?: number; movieId?: never };
export type RadarrHistoryFilter = HistoryFilterBase & { movieId?: number; seriesId?: never; episodeId?: never; seasonNumber?: never };
export type HistoryFilter<S extends Service> = S extends 'sonarr' ? SonarrHistoryFilter : RadarrHistoryFilter;
export type HistoryPage = { records: HistoryRecord[]; total: number };

export type HistoryRead<S extends Service> = {
  (filter: HistoryFilter<S> & { page: number; pageSize: number }): Promise<Result<HistoryPage>>;
  (filter?: HistoryFilter<S> & { page?: undefined; pageSize?: undefined }): Promise<Result<HistoryRecord[]>>;
};

const WALK_PAGE_SIZE = 100;

const integer = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) ? value : null);

const parseHistoryRecord = (value: Record<string, unknown>): HistoryRecord => {
  const downloadId = typeof value.downloadId === 'string' ? value.downloadId.trim() : '';
  const { movie, series, episode, quality, data } = value;
  return {
    id: integer(value.id),
    eventType: typeof value.eventType === 'string' ? value.eventType : '',
    date: typeof value.date === 'string' ? value.date : null,
    downloadId: downloadId === '' ? null : downloadId,
    movieId: integer(value.movieId),
    seriesId: integer(value.seriesId),
    episodeId: integer(value.episodeId),
    sourceTitle: typeof value.sourceTitle === 'string' && value.sourceTitle !== '' ? value.sourceTitle : null,
    quality: isRecord(quality) && isRecord(quality.quality) && typeof quality.quality.name === 'string' ? quality.quality.name : null,
    formats: Array.isArray(value.customFormats)
      ? value.customFormats.flatMap((format) => (isRecord(format) && typeof format.name === 'string' ? [format.name] : []))
      : [],
    formatScore: integer(value.customFormatScore),
    movie: isRecord(movie) && typeof movie.title === 'string' ? { title: movie.title, year: integer(movie.year) } : null,
    series: isRecord(series) && typeof series.title === 'string' ? { title: series.title } : null,
    episode: isRecord(episode) && typeof episode.seasonNumber === 'number' && typeof episode.episodeNumber === 'number'
      ? { seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber }
      : null,
    data: isRecord(data)
      ? Object.fromEntries(Object.entries(data).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {},
  };
};

const parseRecords = (values: unknown[]) => values.filter(isRecord).map(parseHistoryRecord);

type AnyFilter = HistoryFilterBase & { seriesId?: number; episodeId?: number; seasonNumber?: number; movieId?: number };

export const createHistory = <S extends Service>({ service, label, send }: { service: S; label: string; send: Send }) => {
  const operation = 'the history read';

  const pagedPath = (filter: AnyFilter, page: number, pageSize: number) => {
    const query = [`page=${page}`, `pageSize=${pageSize}`, 'sortKey=date', 'sortDirection=descending'];
    query.push(...(service === 'sonarr' ? ['includeSeries=true', 'includeEpisode=true'] : ['includeMovie=true']));
    if (filter.downloadId !== undefined) query.push(`downloadId=${encodeURIComponent(filter.downloadId)}`);
    if (filter.episodeId !== undefined) query.push(`episodeId=${filter.episodeId}`);
    if (filter.seriesId !== undefined) query.push(`seriesIds=${filter.seriesId}`);
    if (filter.movieId !== undefined) query.push(`movieIds=${filter.movieId}`);
    if (filter.eventType !== undefined) query.push('eventType=1');
    return `/api/v3/history?${query.join('&')}`;
  };

  const readHistoryPage = async (filter: AnyFilter, page: number, pageSize: number) => {
    const answer = await send(operation, pagedPath(filter, page, pageSize));
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!isRecord(body) || !Array.isArray(body.records)) return refusal(`${label} sent no list of records for the history read.`);
    return { kind: 'ok' as const, value: { records: parseRecords(body.records), length: body.records.length, totalRecords: integer(body.totalRecords) } };
  };

  const readBare = async (path: string): Promise<Result<HistoryRecord[]>> => {
    const answer = await send(operation, path);
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!Array.isArray(body)) return refusal(`${label} sent no list of records for the history read.`);
    return { kind: 'ok', value: parseRecords(body) };
  };

  const walk = async (filter: AnyFilter): Promise<Result<HistoryRecord[]>> => {
    const records: HistoryRecord[] = [];
    let count = 0;
    for (let page = 1; ; page += 1) {
      const answer = await readHistoryPage(filter, page, WALK_PAGE_SIZE);
      if (answer.kind !== 'ok') return answer;
      const { length, totalRecords } = answer.value;
      records.push(...answer.value.records);
      count += length;
      if (length !== WALK_PAGE_SIZE || totalRecords === null || count >= totalRecords) return { kind: 'ok', value: records };
    }
  };

  const history = async (filter: AnyFilter = {}): Promise<Result<HistoryPage> | Result<HistoryRecord[]>> => {
    if (filter.page !== undefined && filter.pageSize !== undefined) {
      const answer = await readHistoryPage(filter, filter.page, filter.pageSize);
      if (answer.kind !== 'ok') return answer;
      const { records, length, totalRecords } = answer.value;
      return { kind: 'ok', value: { records, total: totalRecords ?? length } };
    }
    if (filter.since !== undefined) {
      const date = encodeURIComponent(new Date(filter.since).toISOString());
      return readBare(`/api/v3/history/since?date=${date}${filter.eventType === undefined ? '' : `&eventType=${filter.eventType}`}`);
    }
    if (service === 'sonarr' && filter.seriesId !== undefined) {
      return readBare(`/api/v3/history/series?seriesId=${filter.seriesId}${filter.seasonNumber === undefined ? '' : `&seasonNumber=${filter.seasonNumber}`}`);
    }
    if (service === 'radarr' && filter.movieId !== undefined) return readBare(`/api/v3/history/movie?movieId=${filter.movieId}`);
    return walk(filter);
  };

  const markFailed = async (historyId: number): Promise<Result<void>> => {
    const answer = await send('marking the grab failed', `/api/v3/history/failed/${historyId}`, { method: 'POST' });
    return answer.kind === 'ok' ? { kind: 'ok', value: undefined } : answer;
  };

  return { history: history as HistoryRead<S>, markFailed };
};
