import type { DatabaseSync } from 'node:sqlite';
import { type ArrServices, valueOrThrow } from './services/arr.js';
import type { HistoryRecord } from './services/arr/history.js';
import { listQueue, type Service } from './torrentGrabs.js';
import type { createProblems, Subject } from './problems.js';
import { getPreference, setPreference } from './preferences.js';

type Problems = ReturnType<typeof createProblems>;

export const NEVER_SEARCHED_GRACE_MS = 15 * 60_000;
export const REPEAT_SEARCH_MS = 6 * 60 * 60_000;
// More gaps than this opening at once in titles already in the library looks like lost or deleted files, not new releases.
export const BURST_LIMIT = 10;
const PAGE_SIZE = 500;
const MONITOR_BATCH = 200;

const labels = { sonarr: 'Sonarr', radarr: 'Radarr' } as const;
const unmonitorDeleted = {
  sonarr: { field: 'autoUnmonitorPreviouslyDownloadedEpisodes', name: 'Unmonitor Deleted Episodes', event: 'episodeFileDeleted' },
  radarr: { field: 'autoUnmonitorPreviouslyDownloadedMovies', name: 'Unmonitor Deleted Movies', event: 'movieFileDeleted' },
} as const;
// Upgrade, ManualOverride and NoLinkedEpisodes deletes are Sonarr's or Radarr's own housekeeping, not the owner removing a file.
const OWNER_DELETES = new Set(['Manual', 'MissingFromDisk']);

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

  // A file the owner deleted stays deleted, wherever it was deleted. With Unmonitor Deleted on, Sonarr and Radarr unmonitor what a
  // deleted file held, so neither they nor this scheduler search for it again. Found off, it is turned back on, and anything still
  // monitored whose file was deleted meanwhile is unmonitored; the same sweep runs once on the first check after this upgrade.
  // An unreadable setting throws, so nothing is searched until the setting is known.
  const keepDeletedUnmonitored = async (service: Service, at: number) => {
    const { field, name, event } = unmonitorDeleted[service];
    const label = labels[service];
    const read = await arr[service].request('/api/v3/config/mediamanagement');
    if (read.status < 200 || read.status > 299 || !isRecord(read.body) || typeof read.body.id !== 'number') {
      throw new Error(`${label} media management settings could not be read.`);
    }
    const sweptKey = `searches.deletedSweptAt.${service}`;
    const wasOn = read.body[field] === true;
    if (wasOn && getPreference(database, sweptKey) !== undefined) return;
    if (!wasOn) {
      const written = await arr[service].request(`/api/v3/config/mediamanagement/${read.body.id}`, { method: 'PUT', body: { ...read.body, [field]: true } });
      if (written.status < 200 || written.status > 299) throw new Error(`${label} refused turning on ${name}.`);
    }
    const deletions = valueOrThrow(service === 'sonarr'
      ? await arr.sonarr.history({ eventType: event })
      : await arr.radarr.history({ eventType: event })) as HistoryRecord[];
    const deleted = new Set(deletions.filter((record) => OWNER_DELETES.has(record.data.reason ?? ''))
      .map((record) => (service === 'sonarr' ? record.episodeId : record.movieId)).filter((id): id is number => id !== null));
    const queued = inQueue(service);
    // Every monitored item without a file, released or not: Radarr's list is read directly, since missingMovies records availability.
    const missing = service === 'sonarr'
      ? (await missingEpisodes()).map((candidate) => ({ id: Number(candidate.subject.id), title: candidate.title }))
      : valueOrThrow(await arr.radarr.listMovies()).flatMap((movie) => (movie.id !== null && movie.monitored && !movie.hasFile ? [{ id: movie.id, title: movie.title }] : []));
    const gone = missing.filter((item) => deleted.has(item.id) && !queued.has(String(item.id)));
    const ids = gone.map((item) => item.id);
    if (service === 'sonarr') {
      for (let start = 0; start < ids.length; start += MONITOR_BATCH) valueOrThrow(await arr.sonarr.monitorEpisodes(ids.slice(start, start + MONITOR_BATCH), false));
    } else {
      for (const id of ids) valueOrThrow(await arr.radarr.monitorMovie(id, false));
    }
    setPreference(database, sweptKey, String(at));
    if (wasOn && gone.length === 0) return;
    const examples = gone.slice(0, 3).map((item) => item.title).join(', ');
    const summary = `${wasOn ? '' : `${label}'s ${name} was off, so it was turned back on. `}`
      + `Unmonitored ${gone.length} ${service === 'sonarr' ? 'episode' : 'movie'}${gone.length === 1 ? '' : 's'} whose files were deleted, so they are not downloaded again`
      + `${examples === '' ? '' : `: ${examples}${gone.length > 3 ? ' and more' : ''}`}.`;
    const problem = problems.open({ kind: 'deleted_kept_unmonitored', subject: { type: 'dependency', service, id: service }, summary });
    problems.setState(problem.id, 'resolved', 'Done automatically.');
  };

  // A burst of gaps in titles already in the library (a lost disk, a mass delete with Unmonitor Deleted off, a re-monitored backlog)
  // is never searched by itself: the gaps join the search backlog and the owner is told. New releases never count: an episode that
  // aired, or a movie first seen available, since the last check, and titles added since then.
  const holdBurst = (service: Service, candidates: Candidate[], at: number) => {
    const lastKey = `searches.lastCheckAt.${service}`;
    const last = getPreference(database, lastKey);
    const before = new Set(database.prepare('SELECT subject FROM missing_seen WHERE subject LIKE ?').all(`${service}:%`).map((row) => String(row.subject)));
    database.prepare('DELETE FROM missing_seen WHERE subject LIKE ?').run(`${service}:%`);
    const insert = database.prepare('INSERT INTO missing_seen (subject, seen_at) VALUES (?, ?) ON CONFLICT DO NOTHING');
    for (const candidate of candidates) insert.run(key(candidate.subject), at);
    setPreference(database, lastKey, String(at));
    if (last === undefined) return;
    const since = Number(last);
    const inBacklog = database.prepare('SELECT 1 FROM search_backlog WHERE subject = ?');
    const fresh = candidates.filter((candidate) => !before.has(key(candidate.subject)) && candidate.availableAt < since
      && candidate.addedAt < since && inBacklog.get(key(candidate.subject)) === undefined);
    if (fresh.length <= BURST_LIMIT) return;
    const backlog = database.prepare('INSERT INTO search_backlog (subject, seen_at) VALUES (?, ?) ON CONFLICT DO NOTHING');
    for (const candidate of fresh) backlog.run(key(candidate.subject), at);
    const things = service === 'sonarr' ? 'episodes' : 'movies';
    const examples = fresh.slice(0, 3).map((candidate) => candidate.title).join(', ');
    const summary = `${fresh.length} ${things} already in ${labels[service]} went missing at once, so none of them is searched for: `
      + `${examples}${fresh.length > 3 ? ' and more' : ''}. Files that were deleted or lost look like this. Search from a title's page for any you want back.`;
    // A burst while the last one is still open adds to it, since open() returns the open problem unchanged.
    const problem = problems.open({ kind: 'search_burst', subject: { type: 'dependency', service, id: service }, state: 'needs_you', summary });
    if (problem.summary !== summary) problems.step(problem.id, 'result', summary);
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
    await keepDeletedUnmonitored(service, at);
    const candidates = service === 'sonarr' ? await missingEpisodes() : await missingMovies(at);
    holdBurst(service, candidates, at);
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
