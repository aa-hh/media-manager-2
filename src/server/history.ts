import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { createLabels } from './labels.js';
import type { StepKind, Subject, SubjectType } from './problems.js';
import type { ArrServices, HistoryRecord } from './services/arr.js';
import { findGrab, type Service } from './torrentGrabs.js';

export type HistoryEvent = {
  id: string;
  at: number;
  service: Service | null;
  source: 'Sonarr' | 'Radarr' | 'media-manager-2';
  subject: Subject | null;
  title: string;
  event: string;
  detail: string;
  release: string | null;
  quality: string | null;
  byHand: boolean;
  eventType: string;
  details: {
    tracker: string | null;
    releaseGroup: string | null;
    formats: string[];
    score: number | null;
    howFound: string | null;
    ageWhenGrabbed: string | null;
    deletionReason: string | null;
    droppedPath: string | null;
    importedPath: string | null;
    message: string | null;
  };
  markFailed: { service: Service; historyId: number; movieId: number | null; episodeIds: number[]; releaseTitle: string } | null;
};

export type HistoryFilter = 'all' | 'grabs' | 'imports' | 'failures' | 'fixes' | 'deletions';

export type HistoryQuery = {
  filter: HistoryFilter;
  service: Service | 'all';
  page: number;
  before?: number;
  movieId?: number;
  seriesId?: number;
  episodeId?: number;
};

const PAGE_SIZE = 100;

const eventWords: Record<string, string> = {
  grabbed: 'Grabbed',
  downloadFolderImported: 'Imported',
  seriesFolderImported: 'Imported',
  movieFolderImported: 'Imported',
  downloadFailed: 'Download failed',
  downloadIgnored: 'Ignored',
  episodeFileDeleted: 'File deleted',
  movieFileDeleted: 'File deleted',
  episodeFileRenamed: 'Renamed',
  movieFileRenamed: 'Renamed',
};

// Renames have no filter of their own, so they show under All only.
const filterTypes: Record<Exclude<HistoryFilter, 'all' | 'fixes'>, ReadonlySet<string>> = {
  grabs: new Set(['grabbed']),
  imports: new Set(['downloadFolderImported', 'seriesFolderImported', 'movieFolderImported']),
  failures: new Set(['downloadFailed', 'downloadIgnored']),
  deletions: new Set(['episodeFileDeleted', 'movieFileDeleted']),
};

const howFoundWords: Record<string, string> = {
  Rss: 'RSS',
  Search: 'automatic search',
  UserInvokedSearch: 'automatic search',
  InteractiveSearch: 'picked by hand',
};

const stepWords: Record<StepKind, string> = { problem: 'Problem', fix: 'Fix', result: 'Result' };

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
const integer = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) ? value : null);
const code = (season: unknown, episode: unknown) => `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;

const age = (data: Record<string, unknown>) => {
  const hours = Number(text(data.ageHours) ?? Number.NaN);
  if (Number.isFinite(hours) && hours < 24) return `${Math.round(hours)} hours`;
  const days = text(data.age);
  return days === null ? null : `${days} days`;
};

// One Sonarr or Radarr history record in words; record types media-manager-2 has no words for are left out.
export const normalizeArrEvent = (service: Service, entry: HistoryRecord, byHand: (downloadId: string) => boolean): HistoryEvent | null => {
  const { eventType, id: historyId, data, movie, series, episode, movieId, episodeId } = entry;
  const at = Date.parse(entry.date ?? '');
  if (historyId === null || eventWords[eventType] === undefined || Number.isNaN(at)) return null;
  const release = entry.sourceTitle;
  const title = movie !== null ? (movie.year === null ? movie.title : `${movie.title} (${movie.year})`)
    : series !== null && episode !== null ? `${series.title} ${code(episode.seasonNumber, episode.episodeNumber)}`
      : release ?? '';
  const subject: Subject | null = service === 'radarr'
    ? (movieId === null ? null : { type: 'movie', service, id: String(movieId) })
    : (episodeId === null ? null : { type: 'episode', service, id: String(episodeId) });
  const releaseSource = text(data.releaseSource);
  const scoreText = text(data.customFormatScore);
  const details: HistoryEvent['details'] = {
    tracker: text(data.indexer),
    releaseGroup: text(data.releaseGroup),
    formats: entry.formats,
    score: entry.formatScore ?? (scoreText === null ? null : integer(Number(scoreText))),
    howFound: releaseSource === null ? null : howFoundWords[releaseSource] ?? releaseSource,
    ageWhenGrabbed: age(data),
    deletionReason: text(data.reason),
    droppedPath: text(data.droppedPath),
    importedPath: text(data.importedPath),
    message: text(data.message),
  };
  const { downloadId } = entry;
  const pickedByHand = downloadId !== null && byHand(downloadId);
  const event = eventWords[eventType];
  const detail = event === 'Grabbed'
    ? [details.tracker, details.howFound, pickedByHand ? 'picked by you' : null].filter((part) => part !== null).join(' · ')
    : event === 'File deleted' ? details.deletionReason ?? ''
      : event === 'Imported' ? details.importedPath?.split(/[\\/]/).pop() ?? ''
        : details.message ?? '';
  return {
    id: `${service}:${historyId}`,
    at,
    service,
    source: service === 'sonarr' ? 'Sonarr' : 'Radarr',
    subject,
    title,
    event,
    detail,
    release,
    quality: entry.quality,
    byHand: pickedByHand,
    eventType,
    details,
    markFailed: eventType === 'grabbed'
      ? { service, historyId, movieId, episodeIds: episodeId === null ? [] : [episodeId], releaseTitle: release ?? '' }
      : null,
  };
};

const emptyDetails: HistoryEvent['details'] = {
  tracker: null,
  releaseGroup: null,
  formats: [],
  score: null,
  howFound: null,
  ageWhenGrabbed: null,
  deletionReason: null,
  droppedPath: null,
  importedPath: null,
  message: null,
};

export const createHistory = (options: {
  database: DatabaseSync;
  arr: ArrServices;
  labels: Pick<ReturnType<typeof createLabels>, 'subject'>;
}) => {
  const { database, arr, labels } = options;
  const byHand = (downloadId: string) => findGrab(database, downloadId)?.byHand ?? false;

  // Episode ids of one series, so problems on single episodes can join that series' history.
  const seriesEpisodes = async (seriesId: number) => {
    const result = await arr.sonarr.episodes(seriesId);
    return result.kind === 'ok' ? new Set(result.value.map((episode) => String(episode.id))) : new Set<string>();
  };

  const titleMatcher = async (query: HistoryQuery) => {
    const { movieId, seriesId, episodeId } = query;
    if (movieId === undefined && seriesId === undefined && episodeId === undefined) return () => true;
    const inSeries = seriesId === undefined ? new Set<string>() : await seriesEpisodes(seriesId);
    return (subject: Subject) => {
      if (subject.type === 'movie') return movieId !== undefined && subject.id === String(movieId);
      if (subject.type === 'episode') return (episodeId !== undefined && subject.id === String(episodeId)) || inSeries.has(subject.id);
      if (subject.type !== 'torrent') return false;
      const grab = findGrab(database, subject.id);
      if (grab === undefined) return false;
      return (movieId !== undefined && grab.movieId === movieId)
        || (seriesId !== undefined && grab.seriesId === seriesId)
        || (episodeId !== undefined && grab.episodeIds.includes(episodeId));
    };
  };

  const readSteps = (since: number) => database.prepare(`
    SELECT s.id AS step_id, s.at, s.kind AS step_kind, s.text, p.subject_type, p.service, p.subject_id, p.hash
    FROM problem_steps s JOIN problems p ON p.id = s.problem_id
    WHERE s.at >= ? ORDER BY s.at DESC, s.id DESC
  `).all(since).map((row) => ({
    stepId: Number(row.step_id),
    at: Number(row.at),
    kind: row.step_kind as StepKind,
    text: String(row.text),
    subject: {
      type: row.subject_type as SubjectType,
      service: row.service === '' ? null : row.service as Service,
      id: String(row.subject_id),
    } satisfies Subject,
    hash: row.hash === null ? null : String(row.hash),
  }));

  const list = async (query: HistoryQuery): Promise<{ events: HistoryEvent[]; hasMore: boolean }> => {
    const { filter, page, movieId, seriesId, episodeId } = query;
    // A title filter belongs to one service, so the other one's whole history is never mixed in.
    // Automatic fixes show no Sonarr or Radarr events, so their pages are not read and steps page by before alone.
    const services = filter === 'fixes' ? [] : (query.service === 'all' ? ['sonarr', 'radarr'] as const : [query.service]).filter((service) => (
      service === 'sonarr' ? movieId === undefined : seriesId === undefined && episodeId === undefined
    ));
    // A service that is not set up, unreachable or refusing contributes nothing, so the other half still shows.
    const pages = await Promise.all(services.map(async (service) => {
      const result = service === 'sonarr'
        ? await arr.sonarr.history({ episodeId, seriesId, page, pageSize: PAGE_SIZE })
        : await arr.radarr.history({ movieId, page, pageSize: PAGE_SIZE });
      return { service, records: result.kind === 'ok' ? result.value.records : [] };
    }));
    const hasMore = pages.some((result) => result.records.length >= PAGE_SIZE);
    const arrEvents = pages.flatMap(({ service, records }) => records.map((raw) => normalizeArrEvent(service, raw, byHand)));
    const kept = filter === 'fixes' ? []
      : arrEvents.filter((event): event is HistoryEvent => event !== null && (filter === 'all' || filterTypes[filter].has(event.eventType)));

    let ownEvents: HistoryEvent[] = [];
    let moreSteps = false;
    if (filter === 'all' || filter === 'fixes') {
      // Older steps belong to a later page while Sonarr or Radarr still has more; a later page starts at the oldest event already shown.
      const times = arrEvents.flatMap((event) => event?.at ?? []);
      const since = hasMore && times.length > 0 ? Math.min(...times) : 0;
      const matches = await titleMatcher(query);
      const matched = readSteps(since).filter((step) => (query.before === undefined || step.at <= query.before) && matches(step.subject));
      const steps = matched.slice(0, PAGE_SIZE);
      moreSteps = matched.length > PAGE_SIZE;
      ownEvents = await Promise.all(steps.map(async (step): Promise<HistoryEvent> => ({
        id: `mm2:${step.stepId}`,
        at: step.at,
        service: step.subject.service,
        source: 'media-manager-2',
        subject: step.subject,
        title: await labels.subject(step.subject, database),
        event: stepWords[step.kind],
        detail: step.text,
        release: step.hash === null ? null : findGrab(database, step.hash)?.releaseTitle ?? null,
        quality: null,
        byHand: false,
        eventType: `mm2_${step.kind}`,
        details: emptyDetails,
        markFailed: null,
      })));
    }
    return { events: [...kept, ...ownEvents].sort((a, b) => b.at - a.at), hasMore: hasMore || moreSteps };
  };

  return { list };
};

export type History = ReturnType<typeof createHistory>;

const filters = new Set<string>(['all', 'grabs', 'imports', 'failures', 'fixes', 'deletions']);
const serviceChoices = new Set<string>(['all', 'sonarr', 'radarr']);

const optionalId = (value: string | undefined) => {
  if (value === undefined) return { ok: true as const, id: undefined };
  const id = Number(value);
  return /^\d{1,16}$/.test(value) && Number.isSafeInteger(id) ? { ok: true as const, id } : { ok: false as const };
};

export const createHistoryRoutes = (history: History) => {
  const routes = new Hono();
  routes.get('/', async (context) => {
    const filter = context.req.query('filter') ?? 'all';
    const service = context.req.query('service') ?? 'all';
    const pageText = context.req.query('page') ?? '1';
    const page = Number(pageText);
    const movieId = optionalId(context.req.query('movieId'));
    const seriesId = optionalId(context.req.query('seriesId'));
    const episodeId = optionalId(context.req.query('episodeId'));
    const before = optionalId(context.req.query('before'));
    if (!filters.has(filter) || !serviceChoices.has(service) || !/^\d{1,2}$/.test(pageText) || page < 1 || page > 50
      || !movieId.ok || !seriesId.ok || !episodeId.ok || !before.ok) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    return context.json(await history.list({
      filter: filter as HistoryFilter,
      service: service as HistoryQuery['service'],
      page,
      before: before.id,
      movieId: movieId.id,
      seriesId: seriesId.id,
      episodeId: episodeId.id,
    }));
  });
  return routes;
};
