import type { DatabaseSync } from 'node:sqlite';
import { type ArrServices, valueOrThrow } from './services/arr.js';
import { listQueue, type Service } from './torrentGrabs.js';
import type { createProblems, Subject } from './problems.js';
import { getPreference, setPreference } from './preferences.js';

type Problems = ReturnType<typeof createProblems>;

export const NEVER_SEARCHED_GRACE_MS = 15 * 60_000;
export const REPEAT_SEARCH_MS = 6 * 60 * 60_000;
const PAGE_SIZE = 500;

type Candidate = {
  subject: Subject;
  availableAt: number;
  addedAt: number;
  lastSearchAt: number | null;
  title: string;
  seriesId: number | null;
  seasonNumber: number | null;
};

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
  arr: ArrServices;
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
          seriesId: series.seriesType === 'standard' && typeof record.seriesId === 'number' ? record.seriesId : null,
          seasonNumber: series.seriesType === 'standard' && typeof record.seasonNumber === 'number' ? record.seasonNumber : null,
          title: `${typeof series.title === 'string' ? series.title : 'Episode'} S${String(record.seasonNumber).padStart(2, '0')}E${String(record.episodeNumber).padStart(2, '0')}`,
        });
      }
      const total = typeof body.totalRecords === 'number' ? body.totalRecords : 0;
      if (body.records.length < PAGE_SIZE || page * PAGE_SIZE >= total) return candidates;
    }
  };

  const missingMovies = async (at: number): Promise<Candidate[]> => {
    return valueOrThrow(await arr.radarr.listMovies()).flatMap((movie) => {
      if (movie.id === null || !movie.monitored || movie.hasFile || !movie.isAvailable) return [];
      const subject: Subject = { type: 'movie', service: 'radarr', id: String(movie.id) };
      return [{
        subject,
        availableAt: availableSince(subject, at),
        addedAt: time(movie.added) ?? 0,
        lastSearchAt: time(movie.lastSearchTime),
        title: movie.title === '' ? 'Movie' : movie.title,
        seriesId: null,
        seasonNumber: null,
      }];
    });
  };

  const inQueue = (service: Service) => {
    const queue = listQueue(database).filter((item) => item.service === service);
    return new Set(queue.map((item) => String(service === 'radarr' ? item.movieId : item.episodeId)));
  };

  const record = (candidate: Candidate, at: number) => {
    database.prepare(`
      INSERT INTO search_log (subject, searched_at) VALUES (?, ?) ON CONFLICT (subject) DO UPDATE SET searched_at = excluded.searched_at
    `).run(key(candidate.subject), at);
    if (candidate.lastSearchAt === null) {
      const problem = problems.open({ kind: 'missed_search', subject: candidate.subject, summary: `${candidate.title} was out but had never been searched for.` });
      problems.setState(problem.id, 'resolved', 'Searched automatically.');
    }
  };

  const fullyAired = async (seriesId: number, seasonNumber: number, at: number) => {
    const result = await arr.sonarr.episodes(seriesId, { seasonNumber });
    if (result.kind !== 'ok') return false;
    return result.value.every((episode) => {
      const airedAt = time(episode.airDateUtc);
      return airedAt !== null && airedAt <= at;
    });
  };

  // Splits due Sonarr episodes into seasons to search whole (standard series only) and episodes to search one by one.
  // A finished season with several missing episodes gets a SeasonSearch so packs are not rejected, alternating with an EpisodeSearch for what is left.
  // A season with a missing episode skipped as queued, a manual download or in the search backlog is never searched whole, since a SeasonSearch would search that episode too.
  // A finished season waits until all its missing episodes are due, then searches them together, so none is searched before its six-hour repeat.
  const planSonarr = async (due: Candidate[], waiting: Candidate[], skippedSeasons: Set<string>, at: number) => {
    const groups = new Map<string, Candidate[]>();
    for (const candidate of [...due, ...waiting]) {
      if (candidate.seriesId === null || candidate.seasonNumber === null || candidate.seasonNumber <= 0) continue;
      const groupKey = `${candidate.seriesId}:${candidate.seasonNumber}`;
      if (skippedSeasons.has(groupKey)) continue;
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), candidate]);
    }
    const seasons: { seriesId: number; seasonNumber: number; candidates: Candidate[] }[] = [];
    const held = new Set<Candidate>();
    for (const members of groups.values()) {
      if (members.length < 2 || !members.some((member) => due.includes(member))) continue;
      const { seriesId, seasonNumber } = members[0];
      if (seriesId === null || seasonNumber === null || !await fullyAired(seriesId, seasonNumber, at)) continue;
      if (members.some((member) => waiting.includes(member))) {
        for (const member of members) held.add(member);
        continue;
      }
      // Only our own search records count here: Sonarr stamps lastSearchTime after it runs the SeasonSearch, later than our record of it.
      const known = members.map((member) => ourLastSearch(member.subject)).filter((value): value is number => value !== null);
      const logged = database.prepare('SELECT searched_at FROM season_search_log WHERE series_id = ? AND season_number = ?').get(seriesId, seasonNumber);
      if (logged !== undefined && (known.length === 0 || Number(logged.searched_at) >= Math.max(...known))) continue;
      seasons.push({ seriesId, seasonNumber, candidates: members });
    }
    seasons.sort((a, b) => a.seriesId - b.seriesId || a.seasonNumber - b.seasonNumber);
    const inSeason = new Set(seasons.flatMap((season) => season.candidates));
    return { seasons, episodes: due.filter((candidate) => !inSeason.has(candidate) && !held.has(candidate)) };
  };

  const search = async (service: Service, due: Candidate[], waiting: Candidate[], skippedSeasons: Set<string>, at: number) => {
    if (due.length === 0) return;
    let rest = due;
    if (service === 'sonarr') {
      const plan = await planSonarr(due, waiting, skippedSeasons, at);
      rest = plan.episodes;
      for (const { seriesId, seasonNumber, candidates } of plan.seasons) {
        valueOrThrow(await arr.sonarr.searchAutomatically({ seriesId, seasonNumber }));
        database.prepare(`
          INSERT INTO season_search_log (series_id, season_number, searched_at) VALUES (?, ?, ?)
          ON CONFLICT (series_id, season_number) DO UPDATE SET searched_at = excluded.searched_at
        `).run(seriesId, seasonNumber, at);
        for (const candidate of candidates) record(candidate, at);
      }
    }
    if (rest.length === 0) return;
    const ids = rest.map((candidate) => Number(candidate.subject.id));
    valueOrThrow(service === 'sonarr'
      ? await arr.sonarr.searchAutomatically({ episodeIds: ids })
      : await arr.radarr.searchAutomatically({ movieIds: ids }));
    for (const candidate of rest) record(candidate, at);
  };

  const checkService = async (service: Service, at: number) => {
    const candidates = service === 'sonarr' ? await missingEpisodes() : await missingMovies(at);
    const queued = inQueue(service);
    const inBacklog = database.prepare('SELECT 1 FROM search_backlog WHERE subject = ?');
    const skippedSeasons = new Set<string>();
    const waiting: Candidate[] = [];
    const due = candidates.flatMap((candidate) => {
      if (isManualDownload(candidate.subject) || queued.has(candidate.subject.id) || inBacklog.get(key(candidate.subject)) !== undefined) {
        if (candidate.seriesId !== null && candidate.seasonNumber !== null) skippedSeasons.add(`${candidate.seriesId}:${candidate.seasonNumber}`);
        return [];
      }
      // Our own record covers the gap before Sonarr or Radarr update lastSearchTime, so a search is never sent twice.
      const ours = ourLastSearch(candidate.subject);
      const known = [candidate.lastSearchAt, ours].filter((value): value is number => value !== null);
      const lastSearchAt = known.length === 0 ? null : Math.max(...known);
      if (at >= searchDueAt({ ...candidate, lastSearchAt })) return [{ ...candidate, lastSearchAt }];
      waiting.push(candidate);
      return [];
    });
    await search(service, due, waiting, skippedSeasons, at);
  };

  // razor: backlog rows never expire; DELETE FROM search_backlog by hand to let the scheduler chase the old gaps. A UI control is the upgrade path.
  // A fresh install accepts the library as it finds it: the first run records every gap it sees and searches nothing.
  const seedBacklog = async (at: number) => {
    const insert = database.prepare('INSERT INTO search_backlog (subject, seen_at) VALUES (?, ?) ON CONFLICT DO NOTHING');
    let complete = true;
    for (const service of ['sonarr', 'radarr'] as const) {
      if (problems.pausedBy([service]).length > 0) {
        complete = false;
        continue;
      }
      try {
        const candidates = service === 'sonarr' ? await missingEpisodes() : await missingMovies(at);
        for (const candidate of candidates) insert.run(key(candidate.subject), at);
      } catch {
        complete = false;
        console.error(`Search backlog could not be recorded for ${service}.`);
      }
    }
    if (complete) setPreference(database, 'searches.baselineAt', String(at));
  };

  const check = async () => {
    const at = now();
    if (getPreference(database, 'searches.baselineAt') === undefined) {
      await seedBacklog(at);
      return;
    }
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
