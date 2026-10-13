import { isRecord, refusal, type Result, type Send, type Service } from './result.js';

export type QueueItem = {
  service: Service;
  queueId: number;
  downloadId: string | null;
  movieId: number | null;
  seriesId: number | null;
  episodeId: number | null;
  title: string;
  // The movie or episode in words, such as "Andor S02E09" or "Dune: Part Two (2024)".
  label: string;
  status: string;
  trackedStatus: string;
  trackedState: string;
  statusMessages: { title: string; messages: string[] }[];
  errorMessage: string;
  indexer: string;
  protocol: string;
  quality: string;
  formats: string[];
  formatScore: number;
  sizeBytes: number;
  sizeLeftBytes: number;
  estimatedCompletion: string | null;
  added: string | null;
};

const QUEUE_PAGE_SIZE = 200;

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const integer = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) ? value : null);
const normalizeHash = (value: unknown) => {
  const hash = text(value).trim().toUpperCase();
  return /^[0-9A-F]{40}$/.test(hash) ? hash : null;
};

const episodeCode = (season: unknown, episode: unknown) => (
  typeof season === 'number' && typeof episode === 'number'
    ? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
    : ''
);

const queueLabel = (value: Record<string, unknown>) => {
  if (isRecord(value.movie)) {
    const year = integer(value.movie.year);
    return `${text(value.movie.title)}${year === null || year === 0 ? '' : ` (${year})`}`.trim();
  }
  if (isRecord(value.series)) {
    const episode = isRecord(value.episode) ? episodeCode(value.episode.seasonNumber, value.episode.episodeNumber) : '';
    return `${text(value.series.title)} ${episode}`.trim();
  }
  return '';
};

const parseQueueItem = (service: Service, value: unknown): QueueItem | null => {
  if (!isRecord(value)) return null;
  const queueId = integer(value.id);
  if (queueId === null) return null;
  const quality = isRecord(value.quality) && isRecord(value.quality.quality) ? text(value.quality.quality.name) : '';
  const formats = Array.isArray(value.customFormats)
    ? value.customFormats.flatMap((format) => (isRecord(format) && typeof format.name === 'string' ? [format.name] : []))
    : [];
  const statusMessages = Array.isArray(value.statusMessages)
    ? value.statusMessages.flatMap((message) => (isRecord(message)
      ? [{
        title: text(message.title),
        messages: Array.isArray(message.messages) ? message.messages.filter((line): line is string => typeof line === 'string') : [],
      }]
      : []))
    : [];
  return {
    service,
    queueId,
    label: queueLabel(value),
    downloadId: normalizeHash(value.downloadId),
    movieId: integer(value.movieId),
    seriesId: integer(value.seriesId),
    episodeId: integer(value.episodeId),
    title: text(value.title),
    status: text(value.status),
    trackedStatus: text(value.trackedDownloadStatus),
    trackedState: text(value.trackedDownloadState),
    statusMessages,
    errorMessage: text(value.errorMessage),
    indexer: text(value.indexer),
    protocol: text(value.protocol),
    quality,
    formats,
    formatScore: integer(value.customFormatScore) ?? 0,
    sizeBytes: integer(value.size) ?? 0,
    sizeLeftBytes: integer(value.sizeleft) ?? 0,
    estimatedCompletion: typeof value.estimatedCompletionTime === 'string' ? value.estimatedCompletionTime : null,
    added: typeof value.added === 'string' ? value.added : null,
  };
};

const removalQueries = {
  nothing: 'removeFromClient=false&blocklist=false&skipRedownload=true',
  block: 'removeFromClient=false&blocklist=true&skipRedownload=true',
  block_and_search: 'removeFromClient=false&blocklist=true&skipRedownload=false',
} as const;

export const createQueue = ({ service, label, send }: { service: Service; label: string; send: Send }) => {
  // Unknown items stay out: with no category on the download client, they are the other service's torrents and anything else in rTorrent.
  const queue = async (): Promise<Result<QueueItem[]>> => {
    const items: QueueItem[] = [];
    let count = 0;
    for (let page = 1; ; page += 1) {
      const answer = await send(
        'the queue read',
        `/api/v3/queue?page=${page}&pageSize=${QUEUE_PAGE_SIZE}&includeUnknownSeriesItems=false&includeUnknownMovieItems=false&includeSeries=true&includeEpisode=true&includeMovie=true`,
      );
      if (answer.kind !== 'ok') return answer;
      const { body } = answer.value;
      if (!isRecord(body) || !Array.isArray(body.records)) return refusal(`${label} sent no list of records for the queue read.`);
      for (const record of body.records) {
        const item = parseQueueItem(service, record);
        if (item !== null) items.push(item);
      }
      count += body.records.length;
      const total = integer(body.totalRecords);
      if (body.records.length !== QUEUE_PAGE_SIZE || total === null || count >= total) return { kind: 'ok', value: items };
    }
  };

  const deleteItem = (queueId: number, query: string) => send('the queue removal', `/api/v3/queue/${queueId}?${query}`, { method: 'DELETE' });

  // A queue item Sonarr or Radarr no longer has counts as already removed, so a repeat call removes nothing.
  const removeMatching = async (downloadId: string, query: string): Promise<Result<{ removed: number }>> => {
    const items = await queue();
    if (items.kind !== 'ok') return items;
    const wanted = downloadId.toUpperCase();
    let removed = 0;
    for (const item of items.value.filter((entry) => entry.downloadId === wanted)) {
      const answer = await deleteItem(item.queueId, query);
      if (answer.kind === 'ok') removed += 1;
      else if (answer.kind !== 'not_found') return answer;
    }
    return { kind: 'ok', value: { removed } };
  };

  const removeFromQueue = async (
    target: { downloadId: string } | { queueId: number },
    choice: 'block' | 'block_and_search' | 'nothing',
  ): Promise<Result<{ removed: number }>> => {
    const query = removalQueries[choice];
    if ('downloadId' in target) return removeMatching(target.downloadId, query);
    const answer = await deleteItem(target.queueId, query);
    if (answer.kind === 'ok') return { kind: 'ok', value: { removed: 1 } };
    return answer;
  };

  // Without skipRedownload the service searches again at once, and on a protected item the veto removes that grab too.
  const removeFromQueueAndClient = (downloadId: string) => removeMatching(downloadId, 'removeFromClient=true&blocklist=true&skipRedownload=true');

  const grabFromQueue = async (queueId: number): Promise<Result<void>> => {
    const answer = await send('the queue grab', `/api/v3/queue/grab/${queueId}`, { method: 'POST' });
    return answer.kind === 'ok' ? { kind: 'ok', value: undefined } : answer;
  };

  return { queue, removeFromQueue, removeFromQueueAndClient, grabFromQueue };
};
