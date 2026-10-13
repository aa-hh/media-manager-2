import { statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { listOpenProblems, type createProblems, type Subject } from './problems.js';
import type { FailureCode, SecondVersionState } from './secondVersions.js';
import type { ArrServices } from './services/arr.js';
import { readSetting } from './services/connection.js';
import { checkHitAndRun, findTrackerRule } from './trackerRules.js';

type Problems = ReturnType<typeof createProblems>;
type Service = 'sonarr' | 'radarr';

// The tracker's bare rule against this torrent, without the margins the removal advice adds. Hours are rounded to 0.01.
export type HitAndRunProgress = {
  host: string;
  requiredHours: number | null;
  seededHours: number;
  ratio: number;
  requiredRatio: number | null;
  met: boolean;
};

export type SecondVersionRow = {
  id: number;
  service: Service;
  movieId: number | null;
  seriesId: number | null;
  episodeId: number | null;
  state: SecondVersionState;
  failure: string | null;
  failureCode: FailureCode | null;
  releaseTitle: string;
  indexer: string;
  quality: string;
  group: string | null;
  sizeBytes: number | null;
  addedAt: number;
  importedAt: number | null;
  hash: string | null;
  path: string | null;
  // Only while the torrent is downloading and rTorrent has been seen holding it.
  percent: number | null;
  // From the last rTorrent poll; null when this app has never seen the torrent.
  seeding: {
    inRtorrent: boolean;
    complete: boolean;
    ratio: number;
    seedingSeconds: number;
    upRate: number;
    trackerHost: string | null;
  } | null;
  // Null when the torrent is not in rTorrent, its size is not known yet, or its tracker has no rule.
  hitAndRun: HitAndRunProgress | null;
  // The stall check flagged it and kept it in rTorrent; cleared once it downloads again.
  stalled: boolean;
  // Remaining bytes over the last poll's download rate; null unless downloading at a rate above 0.
  etaSeconds: number | null;
};

export const VERSION_CHECK_INTERVAL_MS = 15 * 60_000;
export const TRACKED_IN_VERSIONS = 'tracked_in_versions_folder';
export const ORPHANED = 'second_version_orphaned';
export const FILE_MISSING = 'second_version_missing';
const KINDS = [TRACKED_IN_VERSIONS, ORPHANED, FILE_MISSING];

// razor: scene titles end in "-GROUP"; anything else reads as no group until the import records the real one.
const groupOf = (title: string) => /-([A-Za-z0-9]+)$/.exec(title.trim())?.[1] ?? null;

// A saved rule that fails validation throws in findTrackerRule; here it leaves the row without rule progress
// instead of failing the whole title page.
const hitAndRunOf = (database: DatabaseSync, row: Record<string, unknown>): HitAndRunProgress | null => {
  const size = Number(row.t_size ?? 0);
  if (row.t_hash === null || row.t_gone !== null || size === 0 || typeof row.t_tracker !== 'string' || row.t_tracker === '') return null;
  let found: ReturnType<typeof findTrackerRule>;
  try {
    found = findTrackerRule(database, row.t_tracker);
  } catch {
    return null;
  }
  if (found === undefined) return null;
  const { host, rule } = found;
  const seededHours = Number(row.t_seeding) / 3600;
  const ratio = Number(row.t_ratio) / 1000;
  const result = checkHitAndRun(rule, { seedHours: seededHours, ratio, sizeBytes: size, completedBytes: Number(row.t_completed) });
  const requiredRatio = result.case === 'complete' ? rule.ratio : result.case === 'partial' ? rule.partial.ratio : null;
  const twoPlaces = (value: number) => Math.round(value * 100) / 100;
  return {
    host, requiredHours: result.requiredHours === null ? null : twoPlaces(result.requiredHours), seededHours: twoPlaces(seededHours), ratio, requiredRatio, met: result.met,
  };
};

const toRow = (database: DatabaseSync, row: Record<string, unknown>): SecondVersionRow => {
  const state = row.state as SecondVersionState;
  const seen = row.t_hash !== null;
  const size = Number(row.t_size ?? 0);
  const downloading = state === 'downloading' && seen && row.t_gone === null && size > 0;
  const downRate = Number(row.t_down ?? 0);
  return {
    id: Number(row.id),
    service: row.service as Service,
    movieId: (row.movie_id as number | null) ?? null,
    seriesId: (row.series_id as number | null) ?? null,
    episodeId: (row.episode_id as number | null) ?? null,
    state,
    failure: (row.failure as string | null) ?? null,
    failureCode: (row.failure_code as FailureCode | null) ?? null,
    releaseTitle: String(row.release_title),
    indexer: String(row.indexer),
    quality: String(row.quality),
    group: groupOf(String(row.release_title)),
    sizeBytes: (row.size_bytes as number | null) ?? null,
    addedAt: Number(row.created_at),
    importedAt: (row.imported_at as number | null) ?? null,
    hash: (row.hash as string | null) ?? null,
    path: (row.file_path as string | null) ?? null,
    percent: state === 'downloading' && seen && size > 0 ? Math.floor((Number(row.t_completed) / size) * 100) : null,
    seeding: seen ? {
      inRtorrent: row.t_gone === null,
      complete: row.t_complete === 1,
      ratio: Number(row.t_ratio) / 1000,
      seedingSeconds: Number(row.t_seeding),
      upRate: Number(row.t_up),
      trackerHost: (row.t_tracker as string | null) ?? null,
    } : null,
    hitAndRun: hitAndRunOf(database, row),
    // A flag from before the row was created belongs to an earlier use of the same torrent.
    stalled: state === 'downloading' && row.w_replaced !== null && Number(row.w_replaced) >= Number(row.created_at),
    etaSeconds: downloading && downRate > 0 ? Math.ceil(Math.max(0, size - Number(row.t_completed)) / downRate) : null,
  };
};

// Deleted second versions are history, not rows; failed ones stay so their reason shows.
export const listSecondVersionRows = (database: DatabaseSync, title: { service: 'radarr'; movieId: number } | { service: 'sonarr'; seriesId: number }) => database
  .prepare(`
    SELECT v.*, t.hash AS t_hash, t.size_bytes AS t_size, t.completed_bytes AS t_completed, t.complete AS t_complete,
      t.ratio_thousandths AS t_ratio, t.seeding_seconds AS t_seeding, t.up_rate AS t_up, t.tracker_host AS t_tracker, t.gone_at AS t_gone,
      t.down_rate AS t_down, w.replaced_at AS w_replaced
    FROM second_versions v LEFT JOIN torrents t ON t.hash = v.hash LEFT JOIN stall_watch w ON w.hash = v.hash
    WHERE v.state != 'deleted' AND v.service = ? AND ${title.service === 'radarr' ? 'v.movie_id' : 'v.series_id'} = ?
    ORDER BY v.created_at, v.id
  `)
  .all(title.service, title.service === 'radarr' ? title.movieId : title.seriesId)
  .map((row) => toRow(database, row as Record<string, unknown>));

// The tracker rule against the torrent behind each imported grab of the title, newest import first, so the first match
// for an episode or the movie is the file Sonarr or Radarr tracks now. Grabs with no live torrent or no rule are left out.
export type TrackedHitAndRun = { episodeIds: number[]; hitAndRun: HitAndRunProgress };

export const listTrackedHitAndRun = (database: DatabaseSync, title: { service: 'radarr'; movieId: number } | { service: 'sonarr'; seriesId: number }): TrackedHitAndRun[] => database
  .prepare(`
    SELECT g.episode_ids, t.hash AS t_hash, t.size_bytes AS t_size, t.completed_bytes AS t_completed, t.ratio_thousandths AS t_ratio,
      t.seeding_seconds AS t_seeding, t.tracker_host AS t_tracker, t.gone_at AS t_gone
    FROM torrent_grabs g JOIN torrents t ON t.hash = g.hash
    WHERE g.imported_at IS NOT NULL AND g.service = ? AND ${title.service === 'radarr' ? 'g.movie_id' : 'g.series_id'} = ?
    ORDER BY g.imported_at DESC
  `)
  .all(title.service, title.service === 'radarr' ? title.movieId : title.seriesId)
  .flatMap((row) => {
    const hitAndRun = hitAndRunOf(database, row as Record<string, unknown>);
    return hitAndRun === null ? [] : [{ episodeIds: JSON.parse(String(row.episode_ids)) as number[], hitAndRun }];
  });

const inside = (folder: string, path: string) => {
  const rest = relative(folder, path);
  return rest === '' || (rest !== '..' && !rest.startsWith(`..${sep}`) && !isAbsolute(rest));
};

const isMissing = (path: string) => {
  try {
    statSync(path);
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR';
  }
};

type Live = {
  service: Service;
  movie_id: number | null;
  series_id: number | null;
  episode_id: number | null;
  release_title: string;
  hash: string | null;
  state: SecondVersionState;
  file_path: string | null;
};

// Opens a needs-you problem for each case below, and resolves its own open ones once a check that could see them
// finds them gone. A check whose Sonarr or Radarr read failed resolves nothing, so an outage never clears a problem.
// Never touches a file or a torrent.
export const createSecondVersionChecks = (options: { database: DatabaseSync; arr: ArrServices; problems: Problems }) => {
  const { database, arr, problems } = options;

  const check = async () => {
    const found = new Map<string, { kind: string; subject: Subject; summary: string; hash: string | null }>();
    const checked = new Set<string>();
    const flag = (kind: string, subject: Subject, summary: string, hash: string | null = null) => {
      const key = `${kind}|${subject.type}|${subject.service}|${subject.id}`;
      if (!found.has(key)) found.set(key, { kind, subject, summary, hash });
    };
    const movieSubject = (id: number): Subject => ({ type: 'movie', service: 'radarr', id: String(id) });
    const episodeSubject = (id: number): Subject => ({ type: 'episode', service: 'sonarr', id: String(id) });
    const left = (row: Live) => `Its second version (${row.release_title}) was left alone${row.file_path === null ? '.' : `: ${row.file_path}`}`;

    const live = database.prepare("SELECT * FROM second_versions WHERE state NOT IN ('failed', 'deleted') ORDER BY id").all() as Live[];
    const radarrFolder = readSetting(database, 'hostPaths', 'versions.radarr');
    const sonarrFolder = readSetting(database, 'hostPaths', 'versions.sonarr');
    const [movies, series] = await Promise.all([arr.radarr.listMovies(), arr.sonarr.listSeries()]);

    if (movies.kind === 'ok') {
      if (radarrFolder !== undefined) {
        checked.add(`${TRACKED_IN_VERSIONS}|radarr`);
        for (const movie of movies.value) {
          const path = movie.id !== null && movie.path !== null && movie.file?.relativePath ? join(movie.path, movie.file.relativePath) : null;
          if (movie.id !== null && path !== null && inside(radarrFolder, path)) {
            flag(TRACKED_IN_VERSIONS, movieSubject(movie.id), `Radarr tracks ${path}, which is inside the versions folder ${radarrFolder}.`);
          }
        }
      }
      checked.add(`${ORPHANED}|radarr`);
      const ids = new Set(movies.value.map((movie) => movie.id));
      for (const row of live) {
        if (row.service === 'radarr' && !ids.has(row.movie_id)) {
          flag(ORPHANED, movieSubject(row.movie_id as number), `Radarr no longer has this movie. ${left(row)}`, row.hash);
        }
      }
    }

    if (series.kind === 'ok') {
      const seriesIds = new Set(series.value.map((show) => show.id));
      const rows = live.filter((row) => row.service === 'sonarr');
      // Episodes are read only for shows that hold a second version or overlap the versions folder: usually none.
      const toRead = new Map<number, string | null>();
      for (const row of rows) if (seriesIds.has(row.series_id)) toRead.set(row.series_id as number, null);
      for (const show of series.value) {
        if (sonarrFolder !== undefined && show.id !== null && show.path !== null
          && (inside(sonarrFolder, show.path) || inside(show.path, sonarrFolder))) toRead.set(show.id, show.path);
      }
      const episodes = new Map<number, Set<number>>();
      let complete = true;
      for (const [seriesId, showPath] of toRead) {
        const result = await arr.sonarr.episodes(seriesId, { withFiles: showPath !== null });
        if (result.kind !== 'ok') {
          complete = false;
          continue;
        }
        episodes.set(seriesId, new Set(result.value.map((episode) => episode.id)));
        if (showPath === null || sonarrFolder === undefined) continue;
        for (const episode of result.value) {
          const path = episode.file?.relativePath ? join(showPath, episode.file.relativePath) : null;
          if (path !== null && inside(sonarrFolder, path)) {
            flag(TRACKED_IN_VERSIONS, episodeSubject(episode.id), `Sonarr tracks ${path}, which is inside the versions folder ${sonarrFolder}.`);
          }
        }
      }
      if (complete) {
        checked.add(`${ORPHANED}|sonarr`);
        if (sonarrFolder !== undefined) checked.add(`${TRACKED_IN_VERSIONS}|sonarr`);
      }
      for (const row of rows) {
        const subject = episodeSubject(row.episode_id as number);
        if (!seriesIds.has(row.series_id)) flag(ORPHANED, subject, `Sonarr no longer has this show. ${left(row)}`, row.hash);
        else if (episodes.get(row.series_id as number)?.has(row.episode_id as number) === false) {
          flag(ORPHANED, subject, `Sonarr no longer has this episode. ${left(row)}`, row.hash);
        }
      }
    }

    checked.add(`${FILE_MISSING}|radarr`).add(`${FILE_MISSING}|sonarr`);
    for (const row of live) {
      if (row.state !== 'imported' || row.file_path === null || !isMissing(row.file_path)) continue;
      const subject = row.service === 'radarr' ? movieSubject(row.movie_id as number) : episodeSubject(row.episode_id as number);
      flag(FILE_MISSING, subject, `The second version file is missing from disk: ${row.file_path}`, row.hash);
    }

    for (const problem of listOpenProblems(database, KINDS)) {
      if (!checked.has(`${problem.kind}|${problem.subject.service}`)) continue;
      const key = `${problem.kind}|${problem.subject.type}|${problem.subject.service}|${problem.subject.id}`;
      if (!found.has(key)) problems.setState(problem.id, 'resolved', 'Checked again and no longer the case.');
    }
    for (const { kind, subject, summary, hash } of found.values()) {
      problems.open({ kind, subject, summary, hash: hash ?? undefined, state: 'needs_you' });
    }
  };

  return { check };
};
