import type { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import type { Subject } from './problems.js';
import { seasonHeldBack } from './seasonSearch.js';
import { type ArrServices, type Episode, type HistoryRecord, type Result, valueOrThrow } from './services/arr.js';
import { isRecord, labels, refusal } from './services/arr/result.js';

export type SearchTarget =
  | { service: 'sonarr'; kind: 'series'; seriesId: number }
  | { service: 'sonarr'; kind: 'season'; seriesId: number; seasonNumber: number }
  | { service: 'sonarr'; kind: 'episodes'; episodeIds: number[] }
  | { service: 'radarr'; kind: 'movie'; movieId: number };

export type SearchRun = {
  id: number;
  target: SearchTarget;
  trigger: 'search' | 'monitor';
  state: 'running' | 'finished' | 'failed';
  phase: 'season' | 'episodes' | 'movie';
  startedAt: number;
  endedAt: number | null;
  grabbed: { title: string; indexer: string | null }[];
  message: string | null;
};

type Row = SearchRun & { commandId: number; historyMark: number };

const KEEP_MS = 7 * 24 * 60 * 60_000;
const TIMEOUT_MS = 10 * 60_000;
const FAILED_STATUSES = new Set(['failed', 'aborted', 'cancelled', 'orphaned']);

const aired = (episode: Episode, at: number) => {
  const airedAt = episode.airDateUtc === null ? Number.NaN : Date.parse(episode.airDateUtc);
  return !Number.isNaN(airedAt) && airedAt <= at;
};
const wanted = (episode: Episode, at: number) => episode.monitored && !episode.hasFile && aired(episode, at);

export const createSearchRuns = (options: {
  database: DatabaseSync;
  arr: ArrServices;
  isManualDownload: (subject: Subject) => boolean;
  now?: () => number;
  pollMs?: number;
}) => {
  const { database, arr, isManualDownload } = options;
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? 2000;
  // A missing episode the scheduler leaves alone: queued, a manual download or in the search backlog.
  const heldBack = (episodeId: number) => seasonHeldBack({ database, isManualDownload }, [episodeId]);

  const toRow = (row: Record<string, unknown>): Row => ({
    id: Number(row.id),
    target: JSON.parse(String(row.target)) as SearchTarget,
    trigger: row.started_by as SearchRun['trigger'],
    state: row.state as SearchRun['state'],
    phase: row.phase as SearchRun['phase'],
    startedAt: Number(row.started_at),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
    grabbed: JSON.parse(String(row.grabbed)) as SearchRun['grabbed'],
    message: row.message === null ? null : String(row.message),
    commandId: Number(row.command_id),
    historyMark: Number(row.history_mark),
  });
  const readRow = (id: number): Row | undefined => {
    const row = database.prepare('SELECT * FROM search_runs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row === undefined ? undefined : toRow(row);
  };

  const logSearch = (subject: string, at: number) => database.prepare(`
    INSERT INTO search_log (subject, searched_at) VALUES (?, ?) ON CONFLICT (subject) DO UPDATE SET searched_at = excluded.searched_at
  `).run(subject, at);
  const logSeasonSearch = (seriesId: number, seasonNumber: number, at: number) => database.prepare(`
    INSERT INTO season_search_log (series_id, season_number, searched_at) VALUES (?, ?, ?)
    ON CONFLICT (series_id, season_number) DO UPDATE SET searched_at = excluded.searched_at
  `).run(seriesId, seasonNumber, at);

  const readHistory = async (target: SearchTarget): Promise<Result<HistoryRecord[]>> => {
    if (target.kind === 'movie') return arr.radarr.history({ movieId: target.movieId });
    if (target.kind === 'season') return arr.sonarr.history({ seriesId: target.seriesId, seasonNumber: target.seasonNumber });
    if (target.kind === 'series') return arr.sonarr.history({ seriesId: target.seriesId });
    const episode = await arr.sonarr.episode(target.episodeIds[0]);
    if (episode.kind !== 'ok') return episode;
    if (episode.value.seriesId === null) return refusal('Sonarr sent no series for the episode read.');
    return arr.sonarr.history({ seriesId: episode.value.seriesId });
  };

  const readEpisodes = (target: Extract<SearchTarget, { kind: 'series' | 'season' }>) => (target.kind === 'season'
    ? arr.sonarr.episodes(target.seriesId, { seasonNumber: target.seasonNumber })
    : arr.sonarr.episodes(target.seriesId));

  const sendFirst = (target: SearchTarget) => {
    if (target.kind === 'series') return arr.sonarr.searchAutomatically({ seriesId: target.seriesId });
    if (target.kind === 'season') return arr.sonarr.searchAutomatically({ seriesId: target.seriesId, seasonNumber: target.seasonNumber });
    if (target.kind === 'episodes') return arr.sonarr.searchAutomatically({ episodeIds: target.episodeIds });
    return arr.radarr.searchAutomatically({ movieIds: [target.movieId] });
  };

  const fail = (id: number, message: string) => {
    database.prepare("UPDATE search_runs SET state = 'failed', message = ?, ended_at = ? WHERE id = ?").run(message, now(), id);
  };

  // Answers null once the command ended, or why the search failed. A poll that throws or answers an error is retried until the ceiling.
  const waitForEnd = async (service: SearchTarget['service'], commandId: number): Promise<string | null> => {
    const label = labels[service];
    const startedAt = now();
    for (;;) {
      if (now() - startedAt >= TIMEOUT_MS) return `${label} did not finish the search in 10 minutes.`;
      await delay(pollMs);
      let answer: { status: number; body: unknown };
      try {
        answer = await arr[service].request(`/api/v3/command/${commandId}`);
      } catch {
        continue;
      }
      // Sonarr and Radarr forget a command a day after it ended, so a 404 means it ended; its grabs are in history.
      if (answer.status === 404) return null;
      if (answer.status < 200 || answer.status > 299) continue;
      const status = isRecord(answer.body) && typeof answer.body.status === 'string' ? answer.body.status.toLowerCase() : '';
      if (status === 'completed') return null;
      if (FAILED_STATUSES.has(status)) return `${label} reported the search as ${status}.`;
    }
  };

  // A read after the command ended that throws or answers an error is retried until 10 minutes pass, then throws.
  const readAfterEnd = async <T>(read: () => Promise<Result<T>>): Promise<T> => {
    const startedAt = now();
    for (;;) {
      try {
        return valueOrThrow(await read());
      } catch (error) {
        if (now() - startedAt >= TIMEOUT_MS) throw error;
      }
      await delay(pollMs);
    }
  };

  // Adds the grabs history shows above the run's mark, one per download, and answers the episodes they cover.
  const recordGrabs = async (id: number, row: Row) => {
    const history = await readAfterEnd(() => readHistory(row.target));
    const fresh = history.filter((record) => record.eventType === 'grabbed' && record.id !== null && record.id > row.historyMark);
    const grabbed = [...row.grabbed];
    const downloads = new Set<string>();
    for (const record of fresh) {
      const download = record.downloadId ?? `id:${record.id}`;
      if (downloads.has(download)) continue;
      downloads.add(download);
      grabbed.push({ title: record.sourceTitle ?? '', indexer: record.data.indexer ?? null });
    }
    const mark = Math.max(row.historyMark, ...history.map((record) => record.id ?? 0));
    database.prepare('UPDATE search_runs SET grabbed = ?, history_mark = ? WHERE id = ?').run(JSON.stringify(grabbed), mark, id);
    return new Set(fresh.flatMap((record) => (record.episodeId === null ? [] : [record.episodeId])));
  };

  const follow = async (id: number) => {
    for (;;) {
      const row = readRow(id);
      if (row === undefined || row.state !== 'running') return;
      const { target } = row;
      const failure = await waitForEnd(target.service, row.commandId);
      if (failure !== null) {
        // A failed or timed-out search may still have grabbed; a history read that fails here leaves the failure as it is.
        await recordGrabs(id, row).catch(() => undefined);
        fail(id, failure);
        return;
      }
      const grabbedEpisodes = await recordGrabs(id, row);
      if (row.phase === 'season' && target.service === 'sonarr' && (target.kind === 'series' || target.kind === 'season')) {
        const episodes = await readAfterEnd(() => readEpisodes(target));
        const at = now();
        const remaining = episodes
          .filter((episode) => wanted(episode, at) && !grabbedEpisodes.has(episode.id) && !heldBack(episode.id))
          .map((episode) => episode.id);
        if (remaining.length > 0) {
          const commandId = valueOrThrow(await arr.sonarr.searchAutomatically({ episodeIds: remaining }));
          const searchedAt = now();
          for (const episodeId of remaining) logSearch(`sonarr:episode:${episodeId}`, searchedAt);
          database.prepare("UPDATE search_runs SET phase = 'episodes', command_id = ? WHERE id = ?").run(commandId, id);
          continue;
        }
      }
      database.prepare("UPDATE search_runs SET state = 'finished', ended_at = ? WHERE id = ?").run(now(), id);
      return;
    }
  };

  const followInBackground = (id: number) => {
    follow(id).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      try {
        fail(id, message);
      } catch (failError) {
        console.error(`Search run ${id} could not be marked failed. Follow-up error: ${message}. Marking error: ${failError instanceof Error ? failError.message : String(failError)}.`);
      }
    });
  };

  const start = async (target: SearchTarget, trigger: SearchRun['trigger']): Promise<Result<number>> => {
    database.prepare("DELETE FROM search_runs WHERE state <> 'running' AND ended_at < ?").run(now() - KEEP_MS);
    const history = await readHistory(target);
    if (history.kind !== 'ok') return history;
    let phase: SearchRun['phase'] = target.kind === 'movie' ? 'movie' : target.kind === 'episodes' ? 'episodes' : 'season';
    let wantedEpisodes: Episode[] = [];
    // Set when an EpisodeSearch for these episodes replaces the target's own SeasonSearch or SeriesSearch.
    let episodeSearch: number[] | null = null;
    if (target.kind === 'series' || target.kind === 'season') {
      const read = await readEpisodes(target);
      if (read.kind !== 'ok') return read;
      const series = await arr.sonarr.series(target.seriesId);
      if (series.kind !== 'ok') return series;
      const at = now();
      wantedEpisodes = read.value.filter((episode) => wanted(episode, at));
      const eligible = wantedEpisodes.filter((episode) => !heldBack(episode.id)).map((episode) => episode.id);
      const someHeld = eligible.length < wantedEpisodes.length;
      if (eligible.length === 0 && someHeld) {
        const word = target.kind === 'season' ? 'season' : 'show';
        return refusal(`Sonarr already has a download, a hand-picked release or a backlog entry for every missing episode of this ${word}.`);
      }
      // Sonarr searches anime and daily series episode by episode whatever the command, and a SeasonSearch or SeriesSearch
      // would also search an episode held back, so both get one EpisodeSearch and no season-pack phase.
      if (series.value.seriesType !== 'standard') {
        phase = 'episodes';
        if (eligible.length > 0) episodeSearch = eligible;
      } else if (someHeld) {
        phase = 'episodes';
        episodeSearch = eligible;
      }
    }
    const command = episodeSearch === null ? await sendFirst(target) : await arr.sonarr.searchAutomatically({ episodeIds: episodeSearch });
    if (command.kind !== 'ok') return command;
    const at = now();
    if (target.kind === 'movie') logSearch(`radarr:movie:${target.movieId}`, at);
    else if (target.kind === 'episodes') for (const episodeId of target.episodeIds) logSearch(`sonarr:episode:${episodeId}`, at);
    else if (episodeSearch !== null) for (const episodeId of episodeSearch) logSearch(`sonarr:episode:${episodeId}`, at);
    else {
      for (const episode of wantedEpisodes) logSearch(`sonarr:episode:${episode.id}`, at);
      for (const seasonNumber of new Set(wantedEpisodes.map((episode) => episode.seasonNumber))) logSeasonSearch(target.seriesId, seasonNumber, at);
    }
    const mark = Math.max(0, ...history.value.map((record) => record.id ?? 0));
    const inserted = database.prepare(`
      INSERT INTO search_runs (service, target, started_by, state, phase, command_id, history_mark, grabbed, started_at)
      VALUES (?, ?, ?, 'running', ?, ?, ?, '[]', ?)
    `).run(target.service, JSON.stringify(target), trigger, phase, command.value, mark, at);
    const id = Number(inserted.lastInsertRowid);
    followInBackground(id);
    return { kind: 'ok', value: id };
  };

  const list = (): SearchRun[] => database.prepare('SELECT * FROM search_runs ORDER BY id DESC LIMIT 50').all().map((row) => {
    const { commandId: _commandId, historyMark: _historyMark, ...run } = toRow(row as Record<string, unknown>);
    return run;
  });

  const resume = () => {
    for (const row of database.prepare("SELECT id FROM search_runs WHERE state = 'running'").all()) followInBackground(Number(row.id));
  };

  return { start, list, resume };
};

export type SearchRuns = ReturnType<typeof createSearchRuns>;
