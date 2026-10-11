import type { DatabaseSync } from 'node:sqlite';
import { listQueue, type Service } from './torrentGrabs.js';
import type { createProblems, Subject } from './problems.js';

type Problems = ReturnType<typeof createProblems>;
type ArrRequest = (path: string, init?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }) => Promise<{ status: number; body: unknown }>;

export const NEVER_SEARCHED_GRACE_MS = 15 * 60_000;
export const REPEAT_SEARCH_MS = 6 * 60 * 60_000;
const PAGE_SIZE = 500;

type Candidate = { subject: Subject; availableAt: number; addedAt: number; lastSearchAt: number | null; title: string };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const time = (value: unknown) => {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? null : parsed;
};

// When a search is due, by AA-13: never before availability; at availability (but 15 minutes after adding, so search-on-add runs first);
// then every six hours while nothing is found.
export const searchDueAt = (candidate: Pick<Candidate, 'availableAt' | 'addedAt' | 'lastSearchAt'>) => {
  const { availableAt, addedAt, lastSearchAt } = candidate;
  if (lastSearchAt === null || lastSearchAt < availableAt) return Math.max(availableAt, addedAt + NEVER_SEARCHED_GRACE_MS);
  return lastSearchAt + REPEAT_SEARCH_MS;
};

export const createSearchScheduler = (options: {
  database: DatabaseSync;
  arr: Record<Service, { request: ArrRequest }>;
  problems: Problems;
  now?: () => number;
  isManualDownload: (subject: Subject) => boolean;
}) => {
  const { database, arr, problems, isManualDownload } = options;
  const now = options.now ?? Date.now;
  const key = (subject: Subject) => `${subject.service}:${subject.type}:${subject.id}`;

  const ourLastSearch = (subject: Subject) => {
    const row = database.prepare('SELECT searched_at FROM search_log WHERE subject = ?').get(key(subject));
    return row === undefined ? null : Number(row.searched_at);
  };

  // Radarr reports isAvailable but not since when, so a movie's availability is the first check that saw it available.
  const availableSince = (subject: Subject, at: number) => {
    database.prepare('INSERT INTO availability_seen (subject, seen_at) VALUES (?, ?) ON CONFLICT DO NOTHING').run(key(subject), at);
    return Number(database.prepare('SELECT seen_at FROM availability_seen WHERE subject = ?').get(key(subject))?.seen_at);
  };

  const missingEpisodes = async (): Promise<Candidate[]> => {
    const candidates: Candidate[] = [];
    for (let page = 1; ; page += 1) {
      const { status, body } = await arr.sonarr.request(
        `/api/v3/wanted/missing?page=${page}&pageSize=${PAGE_SIZE}&monitored=true&includeSeries=true`,
      );
      if (status < 200 || status > 299 || !isRecord(body) || !Array.isArray(body.records)) throw new Error('Sonarr missing list could not be read.');
      for (const record of body.records) {
        if (!isRecord(record) || typeof record.id !== 'number' || record.monitored !== true || record.hasFile === true) continue;
        const availableAt = time(record.airDateUtc);
        if (availableAt === null) continue;
        const series = isRecord(record.series) ? record.series : {};
        candidates.push({
          subject: { type: 'episode', service: 'sonarr', id: String(record.id) },
          availableAt,
          addedAt: time(series.added) ?? 0,
          lastSearchAt: time(record.lastSearchTime),
          title: `${typeof series.title === 'string' ? series.title : 'Episode'} S${String(record.seasonNumber).padStart(2, '0')}E${String(record.episodeNumber).padStart(2, '0')}`,
        });
      }
      const total = typeof body.totalRecords === 'number' ? body.totalRecords : 0;
      if (body.records.length < PAGE_SIZE || page * PAGE_SIZE >= total) return candidates;
    }
  };

  const missingMovies = async (at: number): Promise<Candidate[]> => {
    const { status, body } = await arr.radarr.request('/api/v3/movie');
    if (status < 200 || status > 299 || !Array.isArray(body)) throw new Error('Radarr movies could not be read.');
    return body.flatMap((movie) => {
      if (!isRecord(movie) || typeof movie.id !== 'number' || movie.monitored !== true || movie.hasFile === true || movie.isAvailable !== true) return [];
      const subject: Subject = { type: 'movie', service: 'radarr', id: String(movie.id) };
      return [{
        subject,
        availableAt: availableSince(subject, at),
        addedAt: time(movie.added) ?? 0,
        lastSearchAt: time(movie.lastSearchTime),
        title: typeof movie.title === 'string' ? movie.title : 'Movie',
      }];
    });
  };

  const inQueue = (service: Service) => {
    const queue = listQueue(database).filter((item) => item.service === service);
    return new Set(queue.map((item) => String(service === 'radarr' ? item.movieId : item.episodeId)));
  };

  const search = async (service: Service, due: Candidate[], at: number) => {
    if (due.length === 0) return;
    const body = service === 'sonarr'
      ? { name: 'EpisodeSearch', episodeIds: due.map((candidate) => Number(candidate.subject.id)) }
      : { name: 'MoviesSearch', movieIds: due.map((candidate) => Number(candidate.subject.id)) };
    const { status } = await arr[service].request('/api/v3/command', { method: 'POST', body });
    if (status < 200 || status > 299) throw new Error(`${service === 'sonarr' ? 'Sonarr' : 'Radarr'} refused the search.`);
    for (const candidate of due) {
      database.prepare(`
        INSERT INTO search_log (subject, searched_at) VALUES (?, ?) ON CONFLICT (subject) DO UPDATE SET searched_at = excluded.searched_at
      `).run(key(candidate.subject), at);
      if (candidate.lastSearchAt === null) {
        const problem = problems.open({ kind: 'missed_search', subject: candidate.subject, summary: `${candidate.title} was out but had never been searched for.` });
        problems.setState(problem.id, 'resolved', 'Searched automatically.');
      }
    }
  };

  const checkService = async (service: Service, at: number) => {
    const candidates = service === 'sonarr' ? await missingEpisodes() : await missingMovies(at);
    const queued = inQueue(service);
    const due = candidates.flatMap((candidate) => {
      if (isManualDownload(candidate.subject) || queued.has(candidate.subject.id)) return [];
      // Our own record covers the gap before Sonarr or Radarr update lastSearchTime, so a search is never sent twice.
      const ours = ourLastSearch(candidate.subject);
      const known = [candidate.lastSearchAt, ours].filter((value): value is number => value !== null);
      const lastSearchAt = known.length === 0 ? null : Math.max(...known);
      return at >= searchDueAt({ ...candidate, lastSearchAt }) ? [{ ...candidate, lastSearchAt }] : [];
    });
    await search(service, due, at);
  };

  const check = async () => {
    const at = now();
    for (const service of ['sonarr', 'radarr'] as const) {
      if (problems.pausedBy([service]).length > 0) continue;
      try {
        await checkService(service, at);
      } catch {
        console.error(`Search schedule failed for ${service}.`);
      }
    }
  };

  return { check };
};
