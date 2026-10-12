import { lstatSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { type Context, Hono } from 'hono';
import type { RemovalAdvice } from './advice.js';
import type { Blocklist } from './blocklist.js';
import type { Protection } from './protection.js';
import type { SecondVersionDelete } from './secondVersionDelete.js';
import { listSecondVersionRows, type SecondVersionRow } from './secondVersionRows.js';
import type { ArrServices, FileDetail, HistoryRecord, Result } from './services/arr.js';
import type { createTorrentFiles, LibraryFileState, RemovalCheck } from './torrentFiles.js';

type Library = ReturnType<ReturnType<typeof createTorrentFiles>['readLibraryInodes']>;
type TorrentFiles = Pick<ReturnType<typeof createTorrentFiles>, 'mapFiles' | 'readLibraryInodes' | 'canRemoveTorrent' | 'removeTorrent'>;
type Failure = Exclude<Result<never>, { kind: 'ok' }>;

// A Sonarr target with a seasonNumber deletes that season's files and keeps the show.
export type DeleteTarget = { service: 'radarr'; movieId: number } | { service: 'sonarr'; seriesId: number; seasonNumber?: number };
// What Sonarr or Radarr does afterwards: forget the title, keep it listed without searching, or search for another copy.
export type Mode = 'remove' | 'keepUnmonitored' | 'searchAgain';
// blocklistCurrent: with searchAgain, blocklist the releases the deleted files came from.
export type Choices = { removeTorrents: string[]; secondVersions: { id: number; removeTorrent: boolean }[]; blocklistCurrent: boolean };

// Removing the record is for a whole title only; a season always keeps its show.
export const modesOf = (target: DeleteTarget): Mode[] => (
  target.service === 'sonarr' && target.seasonNumber !== undefined ? ['keepUnmonitored', 'searchAgain'] : ['remove', 'keepUnmonitored', 'searchAgain']
);
// What a show or season delete did before it asked: a client that sends no mode keeps getting that.
const defaultMode = (target: DeleteTarget): Mode => (target.service === 'sonarr' && target.seasonNumber !== undefined ? 'keepUnmonitored' : 'remove');

export const UNLINKED_FILE = "Can't link this file to a torrent. Its torrent, if any, keeps seeding.";
export const IMPORTED_BY_COPY = 'imported by copy';
export const OTHER_SEASONS = 'This torrent also holds files of other seasons of this show, which are kept.';
// Sonarr and Radarr delete a title's files in the background after they answer.
const WAIT_CEILING_MS = 2 * 60_000;
const WAIT_STEP_MS = 2_000;

export type PlanFile = { fileId: number; path: string; sizeBytes: number; state: LibraryFileState; hashes: string[]; note: string | null; reason: string | null };
export type PlanTorrent = {
  hash: string;
  name: string;
  sizeBytes: number;
  // Imported for this title once, but no longer holding any of its files.
  upgradedAway: boolean;
  label: typeof IMPORTED_BY_COPY | null;
  libraryPaths: string[];
  advice: RemovalAdvice;
  removal: RemovalCheck;
  // Every torrent starts unticked: deleting keeps seeding unless the owner chooses otherwise.
  ticked: false;
};
export type PlanSecondVersion = SecondVersionRow & {
  ticked: true;
  torrent: { hash: string; advice: RemovalAdvice; removal: RemovalCheck } | null;
};
export type DeletePlan = {
  service: 'sonarr' | 'radarr';
  id: number;
  title: string;
  // Set for a season delete only; the show itself stays in Sonarr.
  seasonNumber: number | null;
  // True for a season target, whose default mode unmonitors its episodes and the season before any file is deleted.
  willUnmonitor: boolean;
  // What may happen afterwards, in the order the dialog offers it.
  modes: Mode[];
  // Set when Sonarr or Radarr moves deleted files to a recycle bin, so no space is freed until it is emptied.
  recycleBin: string | null;
  files: PlanFile[];
  torrents: PlanTorrent[];
  secondVersions: PlanSecondVersion[];
};

type Outcome = 'done' | 'failed' | 'skipped';
export type FileOutcome = { fileId: number; path: string; deleted: boolean; reason: string | null };
export type TorrentOutcome = { hash: string; name: string; removed: boolean; reason: string | null };
export type VersionOutcome = { id: number; deleted: boolean; torrentRemoved: boolean; reason: string | null };
export type StepResult =
  | { step: 'map' | 'unmonitor' | 'monitor' | 'delete' | 'wait' | 'blocklist' | 'search' | 'history'; outcome: Outcome; message: string }
  // A season delete sends one file delete per file and lists each answer.
  | { step: 'delete'; outcome: Outcome; message: string; files: FileOutcome[] }
  | { step: 'torrents'; outcome: Outcome; message: string; torrents: TorrentOutcome[] }
  | { step: 'secondVersions'; outcome: Outcome; message: string; secondVersions: VersionOutcome[] };

export type DeleteRun =
  | Failure
  | { kind: 'plan_changed'; reason: string }
  | { kind: 'in_progress' }
  | { kind: 'ran'; deleted: boolean; steps: StepResult[] };

const isMissing = (error: unknown) => error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
// Anything but a clear "not there" counts as still there, so an unreadable file keeps its torrent.
const present = (path: string) => {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    return !isMissing(error);
  }
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const createTitleDelete = (options: {
  database: DatabaseSync;
  arr: ArrServices;
  torrentFiles: TorrentFiles;
  deleteVersion: SecondVersionDelete;
  advise: (hash: string) => Promise<RemovalAdvice>;
  // A search again clears the owner's manual-download protection, which would otherwise veto the search's own grab.
  protection: Pick<Protection, 'list' | 'unprotect'>;
  blocklist: Pick<Blocklist, 'markFailed'>;
  // Drops search's stored lookups for a service, which would still offer a deleted title as in the library.
  forget: (service: DeleteTarget['service']) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}) => {
  const { database, arr, torrentFiles, deleteVersion, advise, protection, blocklist, forget } = options;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
  const running = new Set<string>();

  const titleId = (target: DeleteTarget) => (target.service === 'radarr' ? target.movieId : target.seriesId);

  // Everything the plan and the delete need, read before any delete: deleting a title wipes its Sonarr or Radarr history.
  const gather = async (target: DeleteTarget) => {
    let title: string;
    let details: FileDetail[];
    // A show's or season's episodes, and for a season the files they use.
    let episodes: { id: number; seasonNumber: number; monitored: boolean; fileId: number | null }[] = [];
    let seasonFiles: Set<number> | null = null;
    if (target.service === 'radarr') {
      const movie = await arr.radarr.movie(target.movieId);
      if (movie.kind !== 'ok') return movie;
      title = movie.value.year === null ? movie.value.title : `${movie.value.title} (${movie.value.year})`;
      details = movie.value.file === null ? [] : [movie.value.file];
    } else {
      const season = target.seasonNumber;
      const [series, episodeFiles, episodeList] = await Promise.all([
        arr.sonarr.series(target.seriesId),
        arr.sonarr.episodeFiles(target.seriesId),
        arr.sonarr.episodes(target.seriesId, season === undefined ? { withFiles: true } : { seasonNumber: season, withFiles: true }),
      ]);
      if (series.kind !== 'ok') return series;
      if (episodeFiles.kind !== 'ok') return episodeFiles;
      if (episodeList.kind !== 'ok') return episodeList;
      if (season !== undefined && !series.value.seasons.some((entry) => entry.seasonNumber === season)) {
        return { kind: 'not_found' as const, message: `Sonarr has no season ${season} for ${series.value.title}.` };
      }
      title = series.value.title;
      details = episodeFiles.value;
      episodes = episodeList.value.map((episode) => ({ id: episode.id, seasonNumber: episode.seasonNumber, monitored: episode.monitored, fileId: episode.file?.id ?? null }));
      if (season !== undefined) seasonFiles = new Set(episodes.flatMap((episode) => episode.fileId ?? []));
    }
    const files = details.flatMap((file) => (file.id === null || file.path === null ? [] : [{ path: file.path, fileId: file.id, sizeBytes: file.size }]));
    // A season maps every file of the show, so a torrent that also holds another season's file (a full-series pack) is known.
    const mapping = await torrentFiles.mapFiles(files.map(({ path, fileId }) => ({ path, fileId })), target.service, titleId(target));
    const inScope = (fileId: number) => seasonFiles === null || seasonFiles.has(fileId);
    const mapped = mapping.files.filter((file) => inScope(file.fileId));
    const otherSeasons = new Set(mapping.files.filter((file) => !inScope(file.fileId)).flatMap((file) => file.hashes));
    const allVersions = listSecondVersionRows(database, target);
    const episodeSet = new Set(episodes.map((episode) => episode.id));
    const secondVersions = seasonFiles === null ? allVersions : allVersions.filter((row) => row.episodeId !== null && episodeSet.has(row.episodeId));

    const live = new Map(database.prepare('SELECT hash, name, size_bytes FROM torrents WHERE gone_at IS NULL').all()
      .map((row) => [String(row.hash), { name: String(row.name), sizeBytes: Number(row.size_bytes) }]));
    const holding = new Set(mapped.flatMap((file) => file.hashes));
    const versionHashes = new Set(allVersions.flatMap((row) => row.hash?.toUpperCase() ?? []));
    const history = target.service === 'radarr' ? await arr.radarr.history({ movieId: target.movieId })
      : await arr.sonarr.history(target.seasonNumber === undefined ? { seriesId: target.seriesId } : { seriesId: target.seriesId, seasonNumber: target.seasonNumber });
    const upgradedAway = new Set(history.kind !== 'ok' ? [] : history.value.flatMap((record) => {
      const hash = record.downloadId?.toUpperCase();
      return record.eventType === 'downloadFolderImported' && hash !== undefined && live.has(hash) && !holding.has(hash) && !versionHashes.has(hash) ? [hash] : [];
    }));

    const torrents = [...holding, ...upgradedAway].map((hash) => {
      const held = mapped.filter((file) => file.hashes.includes(hash));
      return {
        hash,
        name: live.get(hash)?.name ?? hash,
        sizeBytes: live.get(hash)?.sizeBytes ?? 0,
        upgradedAway: upgradedAway.has(hash),
        label: held.length > 0 && held.every((file) => file.state === 'copied') ? IMPORTED_BY_COPY : null as typeof IMPORTED_BY_COPY | null,
        libraryPaths: held.map((file) => file.path),
      };
    });
    const sizes = new Map(files.map((file) => [file.fileId, file.sizeBytes]));
    const planFiles: PlanFile[] = mapped.map((file) => ({
      fileId: file.fileId,
      path: file.path,
      sizeBytes: sizes.get(file.fileId) ?? 0,
      state: file.state,
      hashes: file.hashes,
      note: file.state === 'none' || file.state === 'unknown' ? UNLINKED_FILE : null,
      reason: file.reason,
    }));
    return { kind: 'ok' as const, value: { title, files: planFiles, torrents, secondVersions, episodes, otherSeasons, history: history.kind === 'ok' ? history.value : [] } };
  };

  // A torrent that still holds another season's file is never offered, even when that file is a copy no link check would see.
  const removalOf = (hash: string, after: string[], library: Library, otherSeasons: Set<string>): RemovalCheck => (
    otherSeasons.has(hash.toUpperCase()) ? { allowed: false, reason: OTHER_SEASONS } : torrentFiles.canRemoveTorrent(hash, { after, library })
  );

  const plan = async (target: DeleteTarget): Promise<Result<DeletePlan>> => {
    const gathered = await gather(target);
    if (gathered.kind !== 'ok') return gathered;
    const { title, files, torrents, secondVersions, otherSeasons } = gathered.value;
    const seasonNumber = target.service === 'sonarr' ? target.seasonNumber ?? null : null;
    // Second versions start ticked, so their files count as gone when checking whether a torrent is still needed.
    const after = [...files.map((file) => file.path), ...secondVersions.flatMap((row) => row.path ?? [])];
    const library = torrentFiles.readLibraryInodes(after);
    const recycleBin = await arr[target.service].recycleBin();
    return {
      kind: 'ok',
      value: {
        service: target.service,
        id: titleId(target),
        title,
        seasonNumber,
        willUnmonitor: seasonNumber !== null,
        modes: modesOf(target),
        recycleBin: recycleBin.kind === 'ok' ? recycleBin.value : null,
        files,
        torrents: await Promise.all(torrents.map(async (torrent) => ({
          ...torrent,
          advice: await advise(torrent.hash),
          removal: removalOf(torrent.hash, after, library, otherSeasons),
          ticked: false as const,
        }))),
        secondVersions: await Promise.all(secondVersions.map(async (row) => {
          const hash = row.hash?.toUpperCase();
          return {
            ...row,
            ticked: true as const,
            torrent: hash === undefined ? null : { hash, advice: await advise(hash), removal: removalOf(hash, after, library, otherSeasons) },
          };
        })),
      },
    };
  };

  const waitUntilGone = async (paths: string[]) => {
    const started = now();
    for (;;) {
      const left = paths.filter(present);
      if (left.length === 0 || now() - started >= WAIT_CEILING_MS) return left;
      await sleep(WAIT_STEP_MS);
    }
  };

  type Scoped = { id: number; seasonNumber: number; monitored: boolean; fileId: number | null };
  const fail = (result: Failure | { message: string }): { kind: 'failed'; message: string } => ({ kind: 'failed', message: result.message });

  // Keep, unmonitored: nothing in scope is searched for again. A whole show also stops taking seasons Sonarr adds later.
  const unmonitor = async (target: DeleteTarget, episodeIds: number[]): Promise<{ kind: 'ok'; value: string } | { kind: 'failed'; message: string }> => {
    if (target.service === 'radarr') {
      const result = await arr.radarr.monitorMovie(target.movieId, false);
      return result.kind === 'ok' ? { kind: 'ok', value: 'Unmonitored in Radarr.' } : fail(result);
    }
    if (episodeIds.length > 0) {
      const result = await arr.sonarr.monitorEpisodes(episodeIds, false);
      if (result.kind !== 'ok') return fail(result);
    }
    if (target.seasonNumber !== undefined) {
      const result = await arr.sonarr.monitorSeason(target.seriesId, target.seasonNumber, false);
      return result.kind === 'ok' ? { kind: 'ok', value: `Unmonitored season ${target.seasonNumber} and its episodes in Sonarr.` } : fail(result);
    }
    const result = await arr.sonarr.setSeriesMonitoring(target.seriesId, { monitored: false, seasons: 'all', monitorNewItems: 'none' });
    return result.kind === 'ok' ? { kind: 'ok', value: 'Unmonitored the show, every season and episode, and new seasons in Sonarr.' } : fail(result);
  };

  // Search again: monitor what the files held, so the search that follows wants it. Sonarr monitors every episode of a season
  // whose flag a PUT turns on, so the seasons go first, then the held episodes, then the season's other episodes go back off.
  const monitorAgain = async (target: DeleteTarget, held: Scoped[], all: Scoped[]): Promise<{ kind: 'ok'; value: string } | { kind: 'failed'; message: string }> => {
    if (target.service === 'radarr') {
      const result = await arr.radarr.monitorMovie(target.movieId, true);
      if (result.kind !== 'ok') return fail(result);
    } else if (held.length > 0) {
      const seasons = [...new Set(held.map((episode) => episode.seasonNumber))];
      const result = await arr.sonarr.setSeriesMonitoring(target.seriesId, { monitored: true, seasons });
      if (result.kind !== 'ok') return fail(result);
      const ids = new Set(held.map((episode) => episode.id));
      const episodesMonitored = await arr.sonarr.monitorEpisodes([...ids], true);
      if (episodesMonitored.kind !== 'ok') return fail(episodesMonitored);
      const leftOff = all.filter((episode) => !ids.has(episode.id) && !episode.monitored && seasons.includes(episode.seasonNumber)).map((episode) => episode.id);
      if (leftOff.length > 0) {
        const restored = await arr.sonarr.monitorEpisodes(leftOff, false);
        if (restored.kind !== 'ok') return fail(restored);
      }
    }
    return { kind: 'ok', value: target.service === 'radarr' ? 'Monitored in Radarr.' : `Monitored ${plural(held.length, 'episode')} and their seasons in Sonarr.` };
  };

  // Lifted once the files are gone, before the blocklist: mark-failed can start the service's own search (autoRedownloadFailed),
  // and the protection would veto that grab as well as ours. Lifting it before the delete would leave a file that failed to delete unprotected.
  const liftProtection = async (target: DeleteTarget, held: Scoped[]): Promise<{ kind: 'ok'; value: string } | { kind: 'failed'; message: string }> => {
    const ids = new Set(held.map((episode) => episode.id));
    const lifted = protection.list().filter((item) => (target.service === 'radarr'
      ? item.kind === 'movie' && item.movieId === target.movieId
      : item.kind === 'episode' && ids.has(item.episodeId)));
    try {
      for (const item of lifted) await protection.unprotect(item);
    } catch (error) {
      return { kind: 'failed', message: `Couldn't lift the manual-download protection: ${error instanceof Error ? error.message : String(error)}` };
    }
    return { kind: 'ok', value: lifted.length === 0 ? '' : ` Lifted the manual-download protection from ${plural(lifted.length, target.service === 'radarr' ? 'movie' : 'episode')}.` };
  };

  // The grab each deleted file came from, one per download: Sonarr records a pack's grab once per episode, and failing any one fails the download.
  const grabsOf = (history: HistoryRecord[], fileIds: Set<number>) => {
    const downloads = new Map<string, number[]>();
    let untraced = 0;
    for (const fileId of fileIds) {
      const imported = history.find((record) => record.eventType === 'downloadFolderImported' && record.data.fileId === String(fileId) && record.downloadId !== null);
      if (imported === undefined) {
        untraced += 1;
        continue;
      }
      const downloadId = (imported.downloadId as string).toUpperCase();
      downloads.set(downloadId, [...(downloads.get(downloadId) ?? []), fileId]);
    }
    const grabs: { record: HistoryRecord & { id: number; sourceTitle: string }; fileIds: number[] }[] = [];
    for (const [downloadId, ids] of downloads) {
      const grab = history.find((record) => record.eventType === 'grabbed' && record.downloadId?.toUpperCase() === downloadId && record.id !== null && record.sourceTitle !== null);
      if (grab === undefined) untraced += ids.length;
      else grabs.push({ record: grab as HistoryRecord & { id: number; sourceTitle: string }, fileIds: ids });
    }
    return { grabs, untraced };
  };

  // Mark-failed blocklists without touching the library file; it refuses when the download client would remove failed downloads, which ends seeding.
  const blocklistGrabs = async (target: DeleteTarget, history: HistoryRecord[], fileIds: Set<number>, held: Scoped[]): Promise<StepResult> => {
    const { grabs, untraced } = grabsOf(history, fileIds);
    const label = target.service === 'radarr' ? 'Radarr' : 'Sonarr';
    const problems: string[] = [];
    let blocked = 0;
    for (const { record, fileIds: grabbedFiles } of grabs) {
      const result = await blocklist.markFailed(target.service, record.id, {
        movieId: target.service === 'radarr' ? target.movieId : null,
        episodeIds: held.filter((episode) => episode.fileId !== null && grabbedFiles.includes(episode.fileId)).map((episode) => episode.id),
        releaseTitle: record.sourceTitle,
      }, { search: false });
      if (result.kind === 'ok') blocked += 1;
      else if (result.kind === 'remove_failed_on') problems.push(`${record.sourceTitle}: not blocklisted, because ${label}'s download client removes failed downloads, which would end seeding.`);
      else problems.push(`${record.sourceTitle}: ${label} ${result.kind === 'refused' ? 'refused' : "couldn't be reached"}.`);
    }
    if (untraced > 0) problems.push(`No grab in ${label}'s history for ${plural(untraced, 'file')}, so ${untraced === 1 ? 'its release was' : 'their releases were'} not blocklisted.`);
    const message = [`Blocklisted ${plural(blocked, 'release')}.`, ...problems].join(' ');
    return { step: 'blocklist', outcome: problems.length === 0 ? 'done' : 'failed', message };
  };

  // Map → (un)monitor → delete in Sonarr or Radarr (a refusal stops everything) → wait for the files → blocklist and search
  // (search again only) → torrents → second versions → history.
  // Every choice is checked against a fresh mapping before anything is deleted, so a stale dialog changes nothing.
  const run = async (target: DeleteTarget, choices: Choices, mode: Mode = defaultMode(target)): Promise<DeleteRun> => {
    // A season delete must never fall through to removing its show.
    if (!modesOf(target).includes(mode)) return { kind: 'rejected', message: `A ${mode} delete is not offered for this target.` };
    const key = `${target.service}:${titleId(target)}`;
    if (running.has(key)) return { kind: 'in_progress' };
    running.add(key);
    try {
      const gathered = await gather(target);
      if (gathered.kind !== 'ok') return gathered;
      const { title, files, torrents, secondVersions, episodes, otherSeasons, history } = gathered.value;
      const changed = (reason: string) => ({ kind: 'plan_changed', reason }) as const;

      const rows = new Map(secondVersions.map((row) => [row.id, row]));
      for (const choice of choices.secondVersions) if (!rows.has(choice.id)) return changed(`Second version ${choice.id} is no longer listed for ${title}.`);
      const ticked = choices.secondVersions.map((choice) => ({ choice, row: rows.get(choice.id) as SecondVersionRow }));
      const after = [...files.map((file) => file.path), ...ticked.flatMap(({ row }) => row.path ?? [])];
      const library = torrentFiles.readLibraryInodes(after);
      for (const hash of choices.removeTorrents) {
        const torrent = torrents.find((candidate) => candidate.hash === hash);
        if (torrent === undefined) return changed(`The torrent ${hash} is no longer listed for ${title}.`);
        const check = removalOf(hash, after, library, otherSeasons);
        if (!check.allowed) return changed(`${torrent.name} can no longer be removed: ${check.reason}`);
      }
      for (const { choice, row } of ticked) {
        if (!choice.removeTorrent) continue;
        if (row.hash === null) return changed(`The second version ${row.releaseTitle} has no torrent to remove.`);
        // An unticked second version still uses this torrent: the delete keeps it and says why, so the request is not stale.
        if (secondVersions.some((other) => other.hash === row.hash && !choices.secondVersions.some((picked) => picked.id === other.id))) continue;
        const check = removalOf(row.hash, after, library, otherSeasons);
        if (!check.allowed) return changed(`The torrent of ${row.releaseTitle} can no longer be removed: ${check.reason}`);
      }

      const steps: StepResult[] = [{ step: 'map', outcome: 'done', message: `Checked which torrents hold ${plural(files.length, 'file')}.` }];
      const label = target.service === 'radarr' ? 'Radarr' : 'Sonarr';
      let summary: string;
      let gonePaths = files.map((file) => file.path);
      // Torrents holding a file Sonarr would not delete stay, with the reason.
      const keptFor = new Map<string, string>();
      const season = target.service === 'sonarr' ? target.seasonNumber : undefined;
      const stop = (step: 'unmonitor' | 'monitor' | 'delete', message: string): DeleteRun => ({ kind: 'ran', deleted: false, steps: [...steps, { step, outcome: 'failed', message }] });
      // The episodes whose files this delete removes: what a search again monitors, blocklists and searches for.
      const fileIds = new Set(files.map((file) => file.fileId));
      const deletedEpisodes = (ids: Set<number>) => episodes.filter((episode) => episode.fileId !== null && ids.has(episode.fileId));
      let deletedFileIds = fileIds;

      if (mode === 'remove' && target.service === 'sonarr') {
        const result = await arr.sonarr.deleteSeries(target.seriesId);
        if (result.kind !== 'ok') return stop('delete', result.message);
        summary = 'Removed from Sonarr with its files.';
        steps.push({ step: 'delete', outcome: 'done', message: summary });
      } else if (mode === 'remove' && target.service === 'radarr') {
        const result = await arr.radarr.deleteMovie(target.movieId);
        if (result.kind !== 'ok') return stop('delete', result.message);
        summary = 'Removed from Radarr with its file.';
        steps.push({ step: 'delete', outcome: 'done', message: summary });
      } else {
        // Unmonitored first, so nothing searches for the files once they are gone; or monitored first, so the search that follows wants them.
        const keep = mode === 'keepUnmonitored';
        if (keep) {
          const unmonitored = await unmonitor(target, episodes.map((episode) => episode.id));
          if (unmonitored.kind !== 'ok') return stop('unmonitor', unmonitored.message);
          steps.push({ step: 'unmonitor', outcome: 'done', message: unmonitored.value });
        } else {
          const monitored = await monitorAgain(target, deletedEpisodes(fileIds), episodes);
          if (monitored.kind !== 'ok') return stop('monitor', monitored.message);
          steps.push({ step: 'monitor', outcome: 'done', message: monitored.value });
        }
        const stays = keep ? 'unmonitored' : 'monitored';
        if (target.service === 'radarr') {
          summary = keep ? 'Kept in Radarr, unmonitored.' : 'Kept in Radarr, monitored.';
          if (files.length === 0) {
            steps.push({ step: 'delete', outcome: 'skipped', message: 'Radarr has no file for this movie.' });
          } else {
            const results = await Promise.all(files.map((file) => arr.radarr.deleteMovieFile(file.fileId)));
            const failed = results.find((result) => result.kind !== 'ok');
            if (failed !== undefined) return stop('delete', `${failed.message} The movie stays ${stays}.`);
            summary = keep ? 'Kept in Radarr, unmonitored, with its file deleted.' : 'Kept in Radarr, monitored, with its file deleted.';
            steps.push({ step: 'delete', outcome: 'done', message: 'Deleted the movie file in Radarr.' });
          }
        } else {
          // One at a time, and every file is tried even after a refusal (409 when the root folder is missing).
          const results: FileOutcome[] = [];
          for (const file of files) {
            const result = await arr.sonarr.deleteEpisodeFile(file.fileId);
            results.push({ fileId: file.fileId, path: file.path, deleted: result.kind === 'ok', reason: result.kind === 'ok' ? null : result.message });
          }
          const failed = results.filter((result) => !result.deleted);
          for (const result of failed) {
            for (const hash of files.find((file) => file.fileId === result.fileId)?.hashes ?? []) keptFor.set(hash, `Kept: Sonarr did not delete ${result.path}.`);
          }
          gonePaths = results.filter((result) => result.deleted).map((result) => result.path);
          deletedFileIds = new Set(results.filter((result) => result.deleted).map((result) => result.fileId));
          const owner = season !== undefined ? "the season's" : "the show's";
          if (files.length > 0 && failed.length === files.length) {
            const message = `Sonarr deleted none of ${owner} ${plural(files.length, 'file')}. ${season !== undefined ? 'The season' : 'The show'} stays ${stays}.`;
            return { kind: 'ran', deleted: false, steps: [...steps, { step: 'delete', outcome: 'failed', message, files: results }] };
          }
          const verb = keep ? 'Unmonitored' : 'Monitored';
          const where = season !== undefined ? `season ${season}` : 'the show';
          summary = failed.length === 0 ? `${verb} ${where} in Sonarr and deleted its files.`
            : `${verb} ${where} in Sonarr; deleted ${results.length - failed.length} of its ${plural(files.length, 'file')}.`;
          steps.push(files.length === 0
            ? { step: 'delete', outcome: 'skipped', message: `Sonarr has no files for ${season !== undefined ? 'this season' : 'this show'}.`, files: results }
            : { step: 'delete', outcome: failed.length === 0 ? 'done' : 'failed', message: `Deleted ${results.length - failed.length} of ${plural(files.length, 'file')} in Sonarr.`, files: results });
        }
      }
      forget(target.service);

      const left = await waitUntilGone(gonePaths);
      const keepAll = left.length > 0 ? `${label} still had ${plural(left.length, 'library file')} after 2 minutes, so every torrent was kept.` : null;
      steps.push(keepAll === null
        ? { step: 'wait', outcome: 'done', message: `${label} deleted ${plural(gonePaths.length, 'library file')}.` }
        : { step: 'wait', outcome: 'failed', message: `${keepAll} Still there: ${left.join(', ')}` });

      if (mode === 'searchAgain') {
        const held = deletedEpisodes(deletedFileIds);
        if (keepAll !== null) {
          steps.push({ step: 'search', outcome: 'skipped', message: `Not searched: ${label} still had files after 2 minutes, so a search could not replace them.` });
        } else if (target.service === 'sonarr' && held.length === 0) {
          steps.push({ step: 'search', outcome: 'skipped', message: 'Not searched: no episode file was deleted.' });
        } else {
          const words = target.service === 'radarr' ? 'the movie' : plural(held.length, 'episode');
          const lifted = await liftProtection(target, held);
          if (choices.blocklistCurrent && lifted.kind === 'ok') steps.push(await blocklistGrabs(target, history, deletedFileIds, held));
          const searched = lifted.kind !== 'ok' ? lifted
            : target.service === 'radarr' ? await arr.radarr.searchAutomatically({ movieIds: [target.movieId] })
              : await arr.sonarr.searchAutomatically({ episodeIds: held.map((episode) => episode.id) });
          steps.push(searched.kind === 'ok'
            ? { step: 'search', outcome: 'done', message: `${label} is searching for ${words}.${lifted.kind === 'ok' ? lifted.value : ''}` }
            : { step: 'search', outcome: 'failed', message: `${label} did not start the search for ${words}: ${searched.message}` });
          summary = `${summary} ${searched.kind === 'ok' ? 'Searching again.' : 'The search did not start.'}`;
        }
      }

      const torrentResults: TorrentOutcome[] = [];
      for (const hash of choices.removeTorrents) {
        const name = torrents.find((candidate) => candidate.hash === hash)?.name ?? hash;
        const kept = keepAll ?? keptFor.get(hash);
        if (kept !== undefined) {
          torrentResults.push({ hash, name, removed: false, reason: kept });
          continue;
        }
        const removal = await torrentFiles.removeTorrent(hash);
        torrentResults.push({ hash, name, removed: removal.removed, reason: removal.removed ? null : removal.reason });
      }
      const removedCount = torrentResults.filter((result) => result.removed).length;
      const torrentsMessage = `${plural(removedCount, 'torrent')} removed, ${torrents.length - removedCount} kept seeding.`;
      steps.push({
        step: 'torrents',
        outcome: choices.removeTorrents.length === 0 ? 'skipped' : removedCount === choices.removeTorrents.length ? 'done' : 'failed',
        message: torrentsMessage,
        torrents: torrentResults,
      });

      // A torrent shared by several second versions (a pack) is removed with the last of them, and only when every ticked one asks.
      const wanted = new Map<string, boolean>();
      const last = new Map<string, number>();
      for (const { choice, row } of ticked) {
        if (row.hash === null) continue;
        wanted.set(row.hash, (wanted.get(row.hash) ?? true) && choice.removeTorrent);
        last.set(row.hash, row.id);
      }
      const versionResults = new Map<number, VersionOutcome>();
      for (const { choice, row } of ticked) {
        const remove = keepAll === null && row.hash !== null && wanted.get(row.hash) === true && last.get(row.hash) === row.id;
        let reason = !choice.removeTorrent || remove ? null
          : keepAll ?? 'Kept: another ticked second version using this torrent was set to keep it.';
        let asked = remove;
        let result = await deleteVersion(row.id, asked);
        if (result.kind === 'refused' && asked) {
          // Refused only for the torrent (another second version uses it): delete the file anyway and keep the torrent.
          reason = result.reason;
          asked = false;
          result = await deleteVersion(row.id, asked);
        }
        if (result.kind !== 'deleted') {
          versionResults.set(row.id, { id: row.id, deleted: false, torrentRemoved: false, reason: result.kind === 'refused' ? result.reason : 'This second version was already deleted.' });
          continue;
        }
        if (asked && !result.torrent.removed) reason = result.torrent.reason;
        versionResults.set(row.id, { id: row.id, deleted: true, torrentRemoved: asked && result.torrent.removed, reason });
      }
      // The other second versions of a removed pack report the torrent as the last one did.
      for (const { row } of ticked) {
        const lastResult = row.hash === null ? undefined : versionResults.get(last.get(row.hash) as number);
        const own = versionResults.get(row.id) as VersionOutcome;
        if (own.deleted && lastResult !== undefined && lastResult !== own && wanted.get(row.hash as string) === true && keepAll === null) {
          versionResults.set(row.id, { ...own, torrentRemoved: lastResult.torrentRemoved, reason: lastResult.reason });
        }
      }
      const deletedVersions = [...versionResults.values()].filter((result) => result.deleted).length;
      const versionsMessage = `${plural(deletedVersions, 'second version')} deleted, ${secondVersions.length - deletedVersions} kept.`;
      steps.push({
        step: 'secondVersions',
        outcome: ticked.length === 0 ? 'skipped' : deletedVersions === ticked.length ? 'done' : 'failed',
        message: versionsMessage,
        secondVersions: [...versionResults.values()],
      });

      const kind = mode === 'searchAgain' ? `${season !== undefined ? 'season' : target.service === 'sonarr' ? 'series' : 'movie'}_search_again`
        : season !== undefined ? 'season_deleted'
          : target.service === 'sonarr' ? (mode === 'remove' ? 'series_deleted' : 'series_files_deleted')
            : mode === 'remove' ? 'movie_deleted' : files.length === 0 ? 'movie_unmonitored' : 'movie_file_deleted';
      const detail = [summary, keepAll, torrentsMessage, versionsMessage].filter((part) => part !== null).join(' ');
      database.prepare('INSERT INTO title_events (service, title_id, title, at, kind, detail) VALUES (?, ?, ?, ?, ?, ?)')
        .run(target.service, titleId(target), season === undefined ? title : `${title} Season ${season}`, now(), kind, detail);
      steps.push({ step: 'history', outcome: 'done', message: 'Written to History under Deletions.' });
      return { kind: 'ran', deleted: true, steps };
    } finally {
      running.delete(key);
    }
  };

  return { plan, run };
};

export type TitleDelete = ReturnType<typeof createTitleDelete>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const MAX_CHOICES = 1_000;

// A movie delete has always named its mode; a show or season delete that leaves it out gets what it did before the choice existed.
const parseChoices = (body: unknown, target: DeleteTarget): (Choices & { mode: Mode }) | undefined => {
  if (!isRecord(body) || !('removeTorrents' in body) || !('secondVersions' in body)) return undefined;
  if (Object.keys(body).some((key) => !['mode', 'blocklistCurrent', 'removeTorrents', 'secondVersions'].includes(key))) return undefined;
  const { removeTorrents, secondVersions } = body;
  const mode = body.mode ?? (target.service === 'radarr' ? undefined : defaultMode(target));
  if (!modesOf(target).includes(mode as Mode)) return undefined;
  const blocklistCurrent = body.blocklistCurrent ?? false;
  if (typeof blocklistCurrent !== 'boolean' || (blocklistCurrent && mode !== 'searchAgain')) return undefined;
  if (!Array.isArray(removeTorrents) || removeTorrents.length > MAX_CHOICES || !Array.isArray(secondVersions) || secondVersions.length > MAX_CHOICES) return undefined;
  if (removeTorrents.some((hash) => typeof hash !== 'string' || !/^[0-9A-Fa-f]{40}$/.test(hash))) return undefined;
  const hashes = (removeTorrents as string[]).map((hash) => hash.toUpperCase());
  if (new Set(hashes).size !== hashes.length) return undefined;
  const versions: Choices['secondVersions'] = [];
  for (const item of secondVersions) {
    if (!isRecord(item) || !hasKeys(item, ['id', 'removeTorrent']) || !Number.isSafeInteger(item.id) || (item.id as number) < 1 || typeof item.removeTorrent !== 'boolean') return undefined;
    versions.push({ id: item.id as number, removeTorrent: item.removeTorrent });
  }
  if (new Set(versions.map((version) => version.id)).size !== versions.length) return undefined;
  return { removeTorrents: hashes, secondVersions: versions, blocklistCurrent, mode: mode as Mode };
};

// Mounted under /api/library next to the library routes.
export const createTitleDeleteRoutes = (titleDelete: TitleDelete) => {
  const routes = new Hono();
  const invalid = { error: 'invalid_request' };
  const idOf = (text: string) => (/^\d{1,15}$/.test(text) && Number(text) > 0 ? Number(text) : null);
  const failed = (context: { json: (body: unknown, status: 404 | 502 | 503) => Response }, result: Failure) => context.json(
    { error: result.kind, reason: result.message },
    result.kind === 'not_found' ? 404 : result.kind === 'not_configured' ? 503 : 502,
  );

  const planRoute = (targetOf: (context: Context) => DeleteTarget | null) => async (context: Context) => {
    const target = targetOf(context);
    if (target === null) return context.json(invalid, 400);
    const result = await titleDelete.plan(target);
    return result.kind === 'ok' ? context.json(result.value) : failed(context, result);
  };
  const deleteRoute = (targetOf: (context: Context) => DeleteTarget | null) => async (context: Context) => {
    const target = targetOf(context);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json(invalid, 400);
    }
    const choices = target === null ? undefined : parseChoices(body, target);
    if (target === null || choices === undefined) return context.json(invalid, 400);
    const { mode, ...chosen } = choices;
    const result = await titleDelete.run(target, chosen, mode);
    if (result.kind === 'ran') return context.json({ deleted: result.deleted, steps: result.steps });
    if (result.kind === 'plan_changed') return context.json({ error: 'plan_changed', reason: result.reason }, 409);
    if (result.kind === 'in_progress') return context.json({ error: 'in_progress' }, 409);
    return failed(context, result);
  };

  const movie = (context: Context): DeleteTarget | null => {
    const id = idOf(context.req.param('id') ?? '');
    return id === null ? null : { service: 'radarr', movieId: id };
  };
  const series = (context: Context): DeleteTarget | null => {
    const id = idOf(context.req.param('id') ?? '');
    return id === null ? null : { service: 'sonarr', seriesId: id };
  };
  // Season 0 holds a show's specials.
  const season = (context: Context): DeleteTarget | null => {
    const id = idOf(context.req.param('id') ?? '');
    const text = context.req.param('n') ?? '';
    return id === null || !/^\d{1,4}$/.test(text) ? null : { service: 'sonarr', seriesId: id, seasonNumber: Number(text) };
  };
  for (const [path, targetOf] of [['/movie/:id', movie], ['/series/:id', series], ['/series/:id/season/:n', season]] as const) {
    routes.get(`${path}/delete-plan`, planRoute(targetOf));
    routes.post(`${path}/delete`, deleteRoute(targetOf));
  }
  return routes;
};
