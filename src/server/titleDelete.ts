import { lstatSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { type Context, Hono } from 'hono';
import type { RemovalAdvice } from './advice.js';
import type { Blocklist } from './blocklist.js';
import type { Protection } from './protection.js';
import type { SecondVersionDelete } from './secondVersionDelete.js';
import { listSecondVersionRows, type SecondVersionRow } from './secondVersionRows.js';
import type { ArrServices, FileDetail, HistoryRecord, QueueItem, Result } from './services/arr.js';
import type { createTorrentFiles, LibraryFileState, RemovalCheck } from './torrentFiles.js';

type Library = ReturnType<ReturnType<typeof createTorrentFiles>['readLibraryInodes']>;
type TorrentFiles = Pick<ReturnType<typeof createTorrentFiles>, 'mapFiles' | 'readLibraryInodes' | 'canRemoveTorrent' | 'removeTorrent'>;
const fraction = (item: QueueItem) => (item.sizeBytes <= 0 ? 0 : Math.min(1, Math.max(0, (item.sizeBytes - item.sizeLeftBytes) / item.sizeBytes)));
type Failure = Exclude<Result<never>, { kind: 'ok' }>;

// Whole seasons and single episodes of one show, in any mix.
export type Selection = { seasons: number[]; episodeIds: number[] };
// A Sonarr target with a seasonNumber or a selection deletes those files and keeps the show.
export type DeleteTarget =
  | { service: 'radarr'; movieId: number }
  | { service: 'sonarr'; seriesId: number; seasonNumber?: number; selection?: Selection };
// What Sonarr or Radarr does afterwards: forget the title, keep it listed without searching, or search for another copy.
export type Mode = 'remove' | 'keepUnmonitored' | 'searchAgain';
// blocklistCurrent: with searchAgain, blocklist the releases the deleted files came from.
// excludeFromImportLists: with remove, stop the service's import lists adding the title back.
// keepFollowing: per selected season with episodes still to air, whether Sonarr keeps grabbing them.
export type Choices = {
  removeTorrents: string[];
  secondVersions: { id: number; removeTorrent: boolean }[];
  blocklistCurrent: boolean;
  excludeFromImportLists: boolean;
  keepFollowing: Record<number, boolean>;
  // Downloads in the queue to take out before the delete; any not listed are left.
  queue: { downloadId: string; action: QueueAction }[];
};
export type QueueAction = 'leave' | 'remove' | 'removeWithTorrent';

// The part of a show a season or selection target covers; null for a whole title.
const partOf = (target: DeleteTarget): Selection | null => (target.service !== 'sonarr' ? null
  : target.selection ?? (target.seasonNumber === undefined ? null : { seasons: [target.seasonNumber], episodeIds: [] }));
// Removing the record is for a whole title only; part of a show always keeps its show.
export const modesOf = (target: DeleteTarget): Mode[] => (
  partOf(target) !== null ? ['keepUnmonitored', 'searchAgain'] : ['remove', 'keepUnmonitored', 'searchAgain']
);
// What a show or season delete did before it asked: a client that sends no mode keeps getting that.
const defaultMode = (target: DeleteTarget): Mode => (partOf(target) !== null ? 'keepUnmonitored' : 'remove');

export const UNLINKED_FILE = "Can't link this file to a torrent. Its torrent, if any, keeps seeding.";
export const IMPORTED_BY_COPY = 'imported by copy';
export const KEPT_FILES = 'This torrent also holds files of this show that this delete keeps.';
export const KEPT_EPISODES = 'This download also holds episodes this delete keeps, so it stays.';
export const NO_DOWNLOAD_ID = 'Sonarr or Radarr gives this item no download id, so it can only be left.';
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
// One download in the queue for what is being deleted; Sonarr lists a pack once per episode, here it is one row.
export type PlanQueueItem = {
  downloadId: string;
  title: string;
  progress: number;
  status: string;
  episodeIds: number[];
  removable: RemovalCheck;
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
  // Set for a selection delete only: the seasons and episodes it was read for.
  selection: Selection | null;
  // True for part of a show, whose default mode unmonitors what it deletes before any file goes.
  willUnmonitor: boolean;
  monitoring: {
    // Whether Sonarr adds and monitors seasons it learns of later; null for a movie.
    followsNewSeasons: boolean | null;
    // Selected seasons with episodes still to air: keeping them unmonitored needs the owner's answer on each.
    airingSeasons: number[];
    // Keeping this part unmonitored would leave the show with no files and nothing monitored.
    leavesShowEmpty: boolean;
  };
  // What may happen afterwards, in the order the dialog offers it.
  modes: Mode[];
  // A removed title could come back from an import list; false when the lists could not be read, so the choice is hidden.
  importLists: boolean;
  // Set when Sonarr or Radarr moves deleted files to a recycle bin, so no space is freed until it is emptied.
  recycleBin: string | null;
  files: PlanFile[];
  torrents: PlanTorrent[];
  secondVersions: PlanSecondVersion[];
  // Hit and run advice only once something has downloaded; a removal before that costs the tracker nothing.
  queue: (PlanQueueItem & { advice: RemovalAdvice | null })[];
};

type Outcome = 'done' | 'failed' | 'skipped';
export type FileOutcome = { fileId: number; path: string; deleted: boolean; reason: string | null };
export type TorrentOutcome = { hash: string; name: string; removed: boolean; reason: string | null };
export type QueueOutcome = { downloadId: string; title: string; removed: boolean; torrentRemoved: boolean; reason: string | null };
export type VersionOutcome = { id: number; deleted: boolean; torrentRemoved: boolean; reason: string | null };
export type StepResult =
  | { step: 'map' | 'unmonitor' | 'monitor' | 'delete' | 'wait' | 'blocklist' | 'search' | 'history'; outcome: Outcome; message: string }
  // A season delete sends one file delete per file and lists each answer.
  | { step: 'delete'; outcome: Outcome; message: string; files: FileOutcome[] }
  | { step: 'torrents'; outcome: Outcome; message: string; torrents: TorrentOutcome[] }
  | { step: 'queue'; outcome: Outcome; message: string; queue: QueueOutcome[] }
  | { step: 'secondVersions'; outcome: Outcome; message: string; secondVersions: VersionOutcome[] }
  // Read back from Sonarr or Radarr after a delete that keeps the title; null when the read failed.
  | { step: 'monitoring'; outcome: Outcome; message: string; monitoring: Monitoring | null };

export type Monitoring =
  | { kind: 'movie'; monitored: boolean }
  | { kind: 'series'; monitored: boolean; monitorNewItems: string | null; seasons: { seasonNumber: number; monitored: boolean; monitoredEpisodes: number; episodes: number }[] };
// What a delete meant Sonarr or Radarr to hold afterwards; anything left out was not its to set.
type Intent = { movie?: boolean; series?: boolean; newSeasons?: 'none'; allSeasons?: boolean; seasons: Map<number, boolean>; episodes: Map<number, boolean> };
type Prepared = { kind: 'ok'; value: string; intent: Intent } | { kind: 'failed'; message: string };
const intent = (fields: Partial<Intent> = {}): Intent => ({ seasons: new Map(), episodes: new Map(), ...fields });

export type DeleteRun =
  | Failure
  | { kind: 'plan_changed'; reason: string }
  | { kind: 'in_progress' }
  // A request the plan never allowed, such as a missing answer for an airing season; nothing was changed.
  | { kind: 'invalid'; reason: string }
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
type Episodic = { id: number; seasonNumber: number; episodeNumber: number; monitored: boolean; aired: boolean; fileId: number | null };
const code = (episode: Episodic) => `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;
const seasonWords = (seasons: number[]) => `${seasons.length === 1 ? 'season' : 'seasons'} ${seasons.join(', ')}`;
// How History names a selection: its whole seasons, then its other episodes by code, or their count when there are many.
const describe = (part: Selection, scope: Episodic[]) => {
  const loose = scope.filter((episode) => !part.seasons.includes(episode.seasonNumber));
  const seasons = part.seasons.length === 0 ? [] : [`${part.seasons.length === 1 ? 'Season' : 'Seasons'} ${part.seasons.join(', ')}`];
  const episodes = loose.length === 0 ? [] : [loose.length <= 3 ? loose.map(code).join(', ') : plural(loose.length, 'episode')];
  return [...seasons, ...episodes].join(' and ');
};

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
    // The episodes in scope (the whole show's, or a part's plus any sharing a file with them), all of the show's, and a part's files.
    let episodes: Episodic[] = [];
    let allEpisodes: Episodic[] = [];
    let seasonFiles: Set<number> | null = null;
    let followsNewSeasons: boolean | null = null;
    const part = partOf(target);
    if (target.service === 'radarr') {
      const movie = await arr.radarr.movie(target.movieId);
      if (movie.kind !== 'ok') return movie;
      title = movie.value.year === null ? movie.value.title : `${movie.value.title} (${movie.value.year})`;
      details = movie.value.file === null ? [] : [movie.value.file];
    } else {
      const [series, episodeFiles, episodeList] = await Promise.all([
        arr.sonarr.series(target.seriesId),
        arr.sonarr.episodeFiles(target.seriesId),
        arr.sonarr.episodes(target.seriesId, { withFiles: true }),
      ]);
      if (series.kind !== 'ok') return series;
      if (episodeFiles.kind !== 'ok') return episodeFiles;
      if (episodeList.kind !== 'ok') return episodeList;
      for (const season of part?.seasons ?? []) {
        if (!series.value.seasons.some((entry) => entry.seasonNumber === season)) {
          return { kind: 'not_found' as const, message: `Sonarr has no season ${season} for ${series.value.title}.` };
        }
      }
      title = series.value.title;
      details = episodeFiles.value;
      followsNewSeasons = series.value.monitorNewItems === 'all';
      allEpisodes = episodeList.value.map((episode) => {
        const airs = episode.airDateUtc === null ? Number.NaN : Date.parse(episode.airDateUtc);
        return {
          id: episode.id,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          monitored: episode.monitored,
          // No air date counts as still to air: Sonarr lists announced episodes before they are dated.
          aired: !Number.isNaN(airs) && airs <= now(),
          fileId: episode.file?.id ?? null,
        };
      });
      const missing = (part?.episodeIds ?? []).find((id) => !allEpisodes.some((episode) => episode.id === id));
      if (missing !== undefined) return { kind: 'not_found' as const, message: `Sonarr has no episode ${missing} in ${series.value.title}.` };
      if (part === null) episodes = allEpisodes;
      else {
        const chosen = allEpisodes.filter((episode) => part.seasons.includes(episode.seasonNumber) || part.episodeIds.includes(episode.id));
        // An episode sharing a file with a chosen one loses that file too, so it joins the scope.
        const chosenFiles = new Set(chosen.flatMap((episode) => episode.fileId ?? []));
        episodes = allEpisodes.filter((episode) => chosen.includes(episode) || (episode.fileId !== null && chosenFiles.has(episode.fileId)));
        seasonFiles = new Set(episodes.flatMap((episode) => episode.fileId ?? []));
      }
    }
    const files = details.flatMap((file) => (file.id === null || file.path === null ? [] : [{ path: file.path, fileId: file.id, sizeBytes: file.size }]));
    // A season maps every file of the show, so a torrent that also holds another season's file (a full-series pack) is known.
    const mapping = await torrentFiles.mapFiles(files.map(({ path, fileId }) => ({ path, fileId })), target.service, titleId(target));
    const inScope = (fileId: number) => seasonFiles === null || seasonFiles.has(fileId);
    const mapped = mapping.files.filter((file) => inScope(file.fileId));
    const keptHashes = new Set(mapping.files.filter((file) => !inScope(file.fileId)).flatMap((file) => file.hashes));
    const allVersions = listSecondVersionRows(database, target);
    const episodeSet = new Set(episodes.map((episode) => episode.id));
    const secondVersions = seasonFiles === null ? allVersions : allVersions.filter((row) => row.episodeId !== null && episodeSet.has(row.episodeId));

    const live = new Map(database.prepare('SELECT hash, name, size_bytes FROM torrents WHERE gone_at IS NULL').all()
      .map((row) => [String(row.hash), { name: String(row.name), sizeBytes: Number(row.size_bytes) }]));
    const holding = new Set(mapped.flatMap((file) => file.hashes));
    const versionHashes = new Set(allVersions.flatMap((row) => row.hash?.toUpperCase() ?? []));
    const history = target.service === 'radarr' ? await arr.radarr.history({ movieId: target.movieId })
      : await arr.sonarr.history(target.seasonNumber === undefined ? { seriesId: target.seriesId } : { seriesId: target.seriesId, seasonNumber: target.seasonNumber });
    // A selection reads the whole show's history, so only imports for its own episodes count as its earlier downloads.
    const ownImport = (record: HistoryRecord) => target.service === 'radarr' || target.selection === undefined
      || (record.episodeId !== null && episodeSet.has(record.episodeId));
    const upgradedAway = new Set(history.kind !== 'ok' ? [] : history.value.flatMap((record) => {
      const hash = record.downloadId?.toUpperCase();
      return record.eventType === 'downloadFolderImported' && ownImport(record) && hash !== undefined && live.has(hash) && !holding.has(hash) && !versionHashes.has(hash)
        ? [hash] : [];
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
    const scope = new Set(episodes.map((episode) => episode.id));
    // Read live, so a download that finished importing since the plan no longer shows.
    const queueRead = await arr[target.service].queue();
    if (queueRead.kind !== 'ok') return queueRead;
    const ours = (item: QueueItem) => (target.service === 'radarr' ? item.movieId === target.movieId : item.seriesId === target.seriesId);
    const downloads = new Map<string, QueueItem[]>();
    for (const item of queueRead.value.filter(ours)) {
      const key = item.downloadId ?? `queue:${item.queueId}`;
      downloads.set(key, [...(downloads.get(key) ?? []), item]);
    }
    const queue: PlanQueueItem[] = [...downloads.entries()].flatMap(([key, items]) => {
      const episodeIds = items.flatMap((item) => item.episodeId ?? []);
      // Part of a show lists only downloads for its own episodes; one that also holds others can only be left.
      if (part !== null && !episodeIds.some((id) => scope.has(id))) return [];
      const first = items[0];
      const removable: RemovalCheck = first.downloadId === null ? { allowed: false, reason: NO_DOWNLOAD_ID }
        : part !== null && episodeIds.some((id) => !scope.has(id)) ? { allowed: false, reason: KEPT_EPISODES } : { allowed: true };
      return [{ downloadId: first.downloadId ?? key, title: first.title, progress: fraction(first), status: first.trackedState || first.status, episodeIds, removable }];
    });
    const airingSeasons = (part?.seasons ?? []).filter((season) => allEpisodes.some((episode) => episode.seasonNumber === season && !episode.aired));
    const leavesShowEmpty = part !== null && followsNewSeasons === false
      && files.every((file) => seasonFiles?.has(file.fileId) === true)
      && allEpisodes.every((episode) => scope.has(episode.id) || !episode.monitored);
    return {
      kind: 'ok' as const,
      value: {
        title, files: planFiles, torrents, secondVersions, episodes, allEpisodes, keptHashes, part, queue,
        monitoring: { followsNewSeasons, airingSeasons, leavesShowEmpty },
        history: history.kind === 'ok' ? history.value : [],
      },
    };
  };

  // A torrent that still holds a file this delete keeps is never offered, even when that file is a copy no link check would see.
  const removalOf = (hash: string, after: string[], library: Library, keptHashes: Set<string>): RemovalCheck => (
    keptHashes.has(hash.toUpperCase()) ? { allowed: false, reason: KEPT_FILES } : torrentFiles.canRemoveTorrent(hash, { after, library })
  );

  const plan = async (target: DeleteTarget): Promise<Result<DeletePlan>> => {
    const gathered = await gather(target);
    if (gathered.kind !== 'ok') return gathered;
    const { title, files, torrents, secondVersions, keptHashes, part, monitoring, queue } = gathered.value;
    const seasonNumber = target.service === 'sonarr' ? target.seasonNumber ?? null : null;
    // Second versions start ticked, so their files count as gone when checking whether a torrent is still needed.
    const after = [...files.map((file) => file.path), ...secondVersions.flatMap((row) => row.path ?? [])];
    const library = torrentFiles.readLibraryInodes(after);
    const [recycleBin, importLists] = await Promise.all([
      arr[target.service].recycleBin(),
      // Only a removed title can come back: one kept unmonitored is still listed, so no list adds it again.
      modesOf(target).includes('remove') ? arr[target.service].importLists() : null,
    ]);
    return {
      kind: 'ok',
      value: {
        service: target.service,
        id: titleId(target),
        title,
        seasonNumber,
        selection: target.service === 'sonarr' ? target.selection ?? null : null,
        willUnmonitor: part !== null,
        monitoring,
        modes: modesOf(target),
        importLists: importLists?.kind === 'ok' && importLists.value,
        recycleBin: recycleBin.kind === 'ok' ? recycleBin.value : null,
        files,
        torrents: await Promise.all(torrents.map(async (torrent) => ({
          ...torrent,
          advice: await advise(torrent.hash),
          removal: removalOf(torrent.hash, after, library, keptHashes),
          ticked: false as const,
        }))),
        queue: await Promise.all(queue.map(async (item) => ({
          ...item,
          advice: item.removable.allowed && item.progress > 0 ? await advise(item.downloadId) : null,
        }))),
        secondVersions: await Promise.all(secondVersions.map(async (row) => {
          const hash = row.hash?.toUpperCase();
          return {
            ...row,
            ticked: true as const,
            torrent: hash === undefined ? null : { hash, advice: await advise(hash), removal: removalOf(hash, after, library, keptHashes) },
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

  type Scoped = Episodic;
  const fail = (result: Failure | { message: string }): { kind: 'failed'; message: string } => ({ kind: 'failed', message: result.message });

  // Keep, unmonitored: nothing in scope is searched for again. A whole show also stops taking seasons Sonarr adds later. Part of a show
  // unmonitors its episodes and its whole seasons, except a season the owner keeps following: that keeps its flag and the episodes still to air.
  const unmonitor = async (
    target: DeleteTarget,
    scope: Episodic[],
    part: Selection | null,
    following: Set<number>,
  ): Promise<Prepared> => {
    if (target.service === 'radarr') {
      const result = await arr.radarr.monitorMovie(target.movieId, false);
      return result.kind === 'ok' ? { kind: 'ok', value: 'Unmonitored in Radarr.', intent: intent({ movie: false }) } : fail(result);
    }
    const off = scope.filter((episode) => !(following.has(episode.seasonNumber) && !episode.aired)).map((episode) => episode.id);
    const episodesOff = new Map(off.map((id) => [id, false]));
    if (off.length > 0) {
      const result = await arr.sonarr.monitorEpisodes(off, false);
      if (result.kind !== 'ok') return fail(result);
    }
    if (part === null) {
      const result = await arr.sonarr.setSeriesMonitoring(target.seriesId, { monitored: false, seasons: 'all', monitorNewItems: 'none' });
      return result.kind === 'ok'
        ? { kind: 'ok', value: 'Unmonitored the show, every season and episode, and new seasons in Sonarr.', intent: intent({ series: false, newSeasons: 'none', allSeasons: false, episodes: episodesOff }) }
        : fail(result);
    }
    const seasonsOff = part.seasons.filter((season) => !following.has(season));
    const planned = intent({ seasons: new Map(seasonsOff.map((season) => [season, false])), episodes: episodesOff });
    for (const season of seasonsOff) {
      const result = await arr.sonarr.monitorSeason(target.seriesId, season, false);
      if (result.kind !== 'ok') return fail(result);
    }
    if (target.selection === undefined && seasonsOff.length === 1) return { kind: 'ok', value: `Unmonitored season ${seasonsOff[0]} and its episodes in Sonarr.`, intent: planned };
    const kept = part.seasons.filter((season) => following.has(season));
    return {
      kind: 'ok',
      value: `Unmonitored ${plural(off.length, 'episode')}${seasonsOff.length === 0 ? '' : ` and ${seasonWords(seasonsOff)}`} in Sonarr.`
        + (kept.length === 0 ? '' : ` Still following ${seasonWords(kept)} for episodes still to air.`),
      intent: planned,
    };
  };

  // Search again: monitor what the files held, so the search that follows wants it. Sonarr monitors every episode of a season
  // whose flag a PUT turns on, so the seasons go first, then the held episodes, then the season's other episodes go back off.
  const monitorAgain = async (target: DeleteTarget, held: Scoped[], all: Scoped[]): Promise<Prepared> => {
    const planned = intent();
    if (target.service === 'radarr') {
      const result = await arr.radarr.monitorMovie(target.movieId, true);
      if (result.kind !== 'ok') return fail(result);
      planned.movie = true;
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
      planned.series = true;
      for (const season of seasons) planned.seasons.set(season, true);
      for (const id of ids) planned.episodes.set(id, true);
      for (const id of leftOff) planned.episodes.set(id, false);
    }
    return { kind: 'ok', value: target.service === 'radarr' ? 'Monitored in Radarr.' : `Monitored ${plural(held.length, 'episode')} and their seasons in Sonarr.`, intent: planned };
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

  // Proof of what Sonarr or Radarr will do next: the title read back, and every way it differs from what the delete set.
  const readBack = async (target: DeleteTarget, planned: Intent, all: Episodic[]): Promise<StepResult> => {
    const differs: string[] = [];
    const check = (wanted: boolean | undefined, actual: boolean, what: string) => {
      if (wanted !== undefined && wanted !== actual) differs.push(`${what} is ${actual ? 'monitored' : 'not monitored'}`);
    };
    let monitoring: Monitoring;
    let message: string;
    if (target.service === 'radarr') {
      const movie = await arr.radarr.movie(target.movieId);
      if (movie.kind !== 'ok') return { step: 'monitoring', outcome: 'skipped', message: `Couldn't read the movie back from Radarr: ${movie.message}`, monitoring: null };
      monitoring = { kind: 'movie', monitored: movie.value.monitored };
      check(planned.movie, movie.value.monitored, 'The movie');
      message = `Radarr: the movie is ${movie.value.monitored ? 'monitored' : 'not monitored'}.`;
    } else {
      const [series, episodes] = await Promise.all([arr.sonarr.series(target.seriesId), arr.sonarr.episodes(target.seriesId)]);
      const unread = (result: Failure): StepResult => ({ step: 'monitoring', outcome: 'skipped', message: `Couldn't read the show back from Sonarr: ${result.message}`, monitoring: null });
      if (series.kind !== 'ok') return unread(series);
      if (episodes.kind !== 'ok') return unread(episodes);
      const seasons = series.value.seasons.map((season) => {
        const own = episodes.value.filter((episode) => episode.seasonNumber === season.seasonNumber);
        return { seasonNumber: season.seasonNumber, monitored: season.monitored, monitoredEpisodes: own.filter((episode) => episode.monitored).length, episodes: own.length };
      });
      monitoring = { kind: 'series', monitored: series.value.monitored, monitorNewItems: series.value.monitorNewItems, seasons };
      check(planned.series, series.value.monitored, 'The show');
      if (planned.newSeasons !== undefined && series.value.monitorNewItems !== planned.newSeasons) differs.push(`new seasons are set to ${series.value.monitorNewItems ?? 'unknown'}`);
      for (const season of seasons) check(planned.seasons.get(season.seasonNumber) ?? planned.allSeasons, season.monitored, `Season ${season.seasonNumber}`);
      for (const episode of episodes.value) {
        const known = all.find((other) => other.id === episode.id);
        check(planned.episodes.get(episode.id), episode.monitored, known === undefined ? `Episode ${episode.id}` : code(known));
      }
      message = `Sonarr: ${seasons.map((season) => `season ${season.seasonNumber} ${season.monitored ? 'monitored' : 'not monitored'} `
        + `(${season.monitoredEpisodes} of ${plural(season.episodes, 'episode')})`).join('; ')}; new seasons ${series.value.monitorNewItems === 'all' ? 'followed' : 'not followed'}.`;
    }
    return differs.length === 0
      ? { step: 'monitoring', outcome: 'done', message, monitoring }
      : { step: 'monitoring', outcome: 'failed', message: `Not as intended: ${differs.join('; ')}. ${message}`, monitoring };
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
      const { title, files, torrents, secondVersions, episodes, allEpisodes, keptHashes, part, monitoring, history, queue } = gathered.value;
      const changed = (reason: string) => ({ kind: 'plan_changed', reason }) as const;
      // A selection must answer for every season still airing; the season route predates the question and stops following, as it did.
      const unanswered = monitoring.airingSeasons.filter((season) => choices.keepFollowing[season] === undefined);
      if (mode === 'keepUnmonitored' && target.service === 'sonarr' && target.selection !== undefined && unanswered.length > 0) {
        return { kind: 'invalid', reason: `Say whether to keep following ${seasonWords(unanswered)}, which still ${unanswered.length === 1 ? 'has' : 'have'} episodes to air.` };
      }
      const following = new Set(monitoring.airingSeasons.filter((season) => choices.keepFollowing[season] === true));
      const queued: { action: QueueAction; item: PlanQueueItem }[] = [];
      for (const choice of choices.queue) {
        if (choice.action === 'leave') continue;
        const item = queue.find((entry) => entry.downloadId === choice.downloadId);
        if (item === undefined) return changed(`The download ${choice.downloadId} is no longer in the queue for ${title}.`);
        if (!item.removable.allowed) return { kind: 'invalid', reason: `${item.title} can't be removed: ${item.removable.reason}` };
        queued.push({ action: choice.action, item });
      }

      const rows = new Map(secondVersions.map((row) => [row.id, row]));
      for (const choice of choices.secondVersions) if (!rows.has(choice.id)) return changed(`Second version ${choice.id} is no longer listed for ${title}.`);
      const ticked = choices.secondVersions.map((choice) => ({ choice, row: rows.get(choice.id) as SecondVersionRow }));
      const after = [...files.map((file) => file.path), ...ticked.flatMap(({ row }) => row.path ?? [])];
      const library = torrentFiles.readLibraryInodes(after);
      for (const hash of choices.removeTorrents) {
        const torrent = torrents.find((candidate) => candidate.hash === hash);
        if (torrent === undefined) return changed(`The torrent ${hash} is no longer listed for ${title}.`);
        const check = removalOf(hash, after, library, keptHashes);
        if (!check.allowed) return changed(`${torrent.name} can no longer be removed: ${check.reason}`);
      }
      for (const { choice, row } of ticked) {
        if (!choice.removeTorrent) continue;
        if (row.hash === null) return changed(`The second version ${row.releaseTitle} has no torrent to remove.`);
        // An unticked second version still uses this torrent: the delete keeps it and says why, so the request is not stale.
        if (secondVersions.some((other) => other.hash === row.hash && !choices.secondVersions.some((picked) => picked.id === other.id))) continue;
        const check = removalOf(row.hash, after, library, keptHashes);
        if (!check.allowed) return changed(`The torrent of ${row.releaseTitle} can no longer be removed: ${check.reason}`);
      }

      const steps: StepResult[] = [{ step: 'map', outcome: 'done', message: `Checked which torrents hold ${plural(files.length, 'file')}.` }];
      // Downloads go first, and never with the service's own client removal, so the shared-data check guards the torrent.
      if (queued.length > 0) {
        const outcomes: QueueOutcome[] = [];
        for (const { action, item } of queued) {
          const taken = await arr[target.service].removeFromQueue({ downloadId: item.downloadId }, 'nothing');
          if (taken.kind !== 'ok') {
            outcomes.push({ downloadId: item.downloadId, title: item.title, removed: false, torrentRemoved: false, reason: taken.message });
            return { kind: 'ran', deleted: false, steps: [...steps, { step: 'queue', outcome: 'failed', message: `${item.title} could not be taken out of the queue. Nothing was deleted.`, queue: outcomes }] };
          }
          const torrent = action === 'removeWithTorrent' ? await torrentFiles.removeTorrent(item.downloadId) : null;
          outcomes.push({
            downloadId: item.downloadId,
            title: item.title,
            removed: true,
            torrentRemoved: torrent?.removed === true,
            reason: torrent === null || torrent.removed ? null : torrent.reason,
          });
        }
        const torrentsLeft = outcomes.filter((outcome, index) => queued[index].action === 'removeWithTorrent' && !outcome.torrentRemoved).length;
        steps.push({
          step: 'queue',
          outcome: torrentsLeft === 0 ? 'done' : 'failed',
          message: `Took ${plural(outcomes.length, 'download')} out of the queue without a new search.${torrentsLeft === 0 ? '' : ` ${plural(torrentsLeft, 'torrent')} could not be removed.`}`,
          queue: outcomes,
        });
      }
      const label = target.service === 'radarr' ? 'Radarr' : 'Sonarr';
      let summary: string;
      let gonePaths = files.map((file) => file.path);
      // Torrents holding a file Sonarr would not delete stay, with the reason.
      const keptFor = new Map<string, string>();
      const season = target.service === 'sonarr' && target.selection === undefined ? target.seasonNumber : undefined;
      const selected = target.service === 'sonarr' && target.selection !== undefined;
      const stop = (step: 'unmonitor' | 'monitor' | 'delete', message: string): DeleteRun => ({ kind: 'ran', deleted: false, steps: [...steps, { step, outcome: 'failed', message }] });
      // The episodes whose files this delete removes: what a search again monitors, blocklists and searches for.
      const fileIds = new Set(files.map((file) => file.fileId));
      const deletedEpisodes = (ids: Set<number>) => episodes.filter((episode) => episode.fileId !== null && ids.has(episode.fileId));
      let deletedFileIds = fileIds;
      // What the (un)monitor step set; a removed title has nothing left to read back.
      let planned: Intent | null = null;

      if (mode === 'remove' && target.service === 'sonarr') {
        const result = await arr.sonarr.deleteSeries(target.seriesId, choices.excludeFromImportLists);
        if (result.kind !== 'ok') return stop('delete', result.message);
        summary = `Removed from Sonarr with its files${choices.excludeFromImportLists ? ', and excluded from its import lists' : ''}.`;
        steps.push({ step: 'delete', outcome: 'done', message: summary });
      } else if (mode === 'remove' && target.service === 'radarr') {
        const result = await arr.radarr.deleteMovie(target.movieId, choices.excludeFromImportLists);
        if (result.kind !== 'ok') return stop('delete', result.message);
        summary = `Removed from Radarr with its file${choices.excludeFromImportLists ? ', and excluded from its import lists' : ''}.`;
        steps.push({ step: 'delete', outcome: 'done', message: summary });
      } else {
        // Unmonitored first, so nothing searches for the files once they are gone; or monitored first, so the search that follows wants them.
        const keep = mode === 'keepUnmonitored';
        if (keep) {
          const unmonitored = await unmonitor(target, episodes, part, following);
          if (unmonitored.kind !== 'ok') return stop('unmonitor', unmonitored.message);
          steps.push({ step: 'unmonitor', outcome: 'done', message: unmonitored.value });
          planned = unmonitored.intent;
        } else {
          const monitored = await monitorAgain(target, deletedEpisodes(fileIds), allEpisodes);
          if (monitored.kind !== 'ok') return stop('monitor', monitored.message);
          steps.push({ step: 'monitor', outcome: 'done', message: monitored.value });
          planned = monitored.intent;
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
          const owner = season !== undefined ? "the season's" : selected ? "the chosen episodes'" : "the show's";
          if (files.length > 0 && failed.length === files.length) {
            const subject = season !== undefined ? 'The season' : selected ? 'The chosen episodes' : 'The show';
            const message = `Sonarr deleted none of ${owner} ${plural(files.length, 'file')}. ${subject} ${selected ? 'stay' : 'stays'} ${stays}.`;
            return { kind: 'ran', deleted: false, steps: [...steps, { step: 'delete', outcome: 'failed', message, files: results }] };
          }
          const verb = keep ? 'Unmonitored' : 'Monitored';
          const where = season !== undefined ? `season ${season}` : selected ? 'the chosen episodes' : 'the show';
          const its = selected ? 'their' : 'its';
          summary = failed.length === 0 ? `${verb} ${where} in Sonarr and deleted ${its} files.`
            : `${verb} ${where} in Sonarr; deleted ${results.length - failed.length} of ${its} ${plural(files.length, 'file')}.`;
          steps.push(files.length === 0
            ? { step: 'delete', outcome: 'skipped', message: `Sonarr has no files for ${season !== undefined ? 'this season' : selected ? 'the chosen episodes' : 'this show'}.`, files: results }
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

      const kind = mode === 'searchAgain' ? `${season !== undefined ? 'season' : selected ? 'episodes' : target.service === 'sonarr' ? 'series' : 'movie'}_search_again`
        : season !== undefined ? 'season_deleted'
          : selected ? 'episodes_deleted'
          : target.service === 'sonarr' ? (mode === 'remove' ? 'series_deleted' : 'series_files_deleted')
            : mode === 'remove' ? 'movie_deleted' : files.length === 0 ? 'movie_unmonitored' : 'movie_file_deleted';
      const detail = [summary, keepAll, torrentsMessage, versionsMessage].filter((part) => part !== null).join(' ');
      database.prepare('INSERT INTO title_events (service, title_id, title, at, kind, detail) VALUES (?, ?, ?, ?, ?, ?)')
        .run(target.service, titleId(target), season !== undefined ? `${title} Season ${season}` : part !== null ? `${title} ${describe(part, episodes)}` : title, now(), kind, detail);
      if (planned !== null) steps.push(await readBack(target, planned, allEpisodes));
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

const MAX_SEASONS = 100;
const MAX_EPISODES = 5_000;

// Seasons and episode ids of one selection: whole numbers, no repeats, at least one of either.
const parseSelection = (seasons: unknown, episodeIds: unknown): Selection | undefined => {
  if (!Array.isArray(seasons) || !Array.isArray(episodeIds) || seasons.length > MAX_SEASONS || episodeIds.length > MAX_EPISODES) return undefined;
  if (seasons.length + episodeIds.length === 0) return undefined;
  // Season 0 holds a show's specials.
  if (seasons.some((season) => !Number.isSafeInteger(season) || season < 0 || season > 9_999)) return undefined;
  if (episodeIds.some((id) => !Number.isSafeInteger(id) || id < 1)) return undefined;
  if (new Set(seasons).size !== seasons.length || new Set(episodeIds).size !== episodeIds.length) return undefined;
  return { seasons: [...seasons as number[]].sort((a, b) => a - b), episodeIds: episodeIds as number[] };
};

const parseKeepFollowing = (value: unknown): Record<number, boolean> | undefined => {
  if (value === undefined) return {};
  if (!isRecord(value) || Object.keys(value).length > MAX_SEASONS) return undefined;
  const answers: Record<number, boolean> = {};
  for (const [season, keep] of Object.entries(value)) {
    if (!/^\d{1,4}$/.test(season) || typeof keep !== 'boolean') return undefined;
    answers[Number(season)] = keep;
  }
  return answers;
};

const parseQueue = (value: unknown): Choices['queue'] | undefined => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CHOICES) return undefined;
  const choices: Choices['queue'] = [];
  for (const item of value) {
    if (!isRecord(item) || !hasKeys(item, ['downloadId', 'action']) || typeof item.downloadId !== 'string' || item.downloadId === '' || item.downloadId.length > 200) return undefined;
    if (item.action !== 'leave' && item.action !== 'remove' && item.action !== 'removeWithTorrent') return undefined;
    choices.push({ downloadId: item.downloadId, action: item.action });
  }
  return new Set(choices.map((choice) => choice.downloadId)).size === choices.length ? choices : undefined;
};

// A movie delete has always named its mode; a show or season delete that leaves it out gets what it did before the choice existed.
// A selection is new, so it names its mode and carries the seasons and episodes it was planned for.
const parseChoices = (body: unknown, target: DeleteTarget): (Choices & { mode: Mode }) | undefined => {
  if (!isRecord(body) || !('removeTorrents' in body) || !('secondVersions' in body)) return undefined;
  const selected = target.service === 'sonarr' && target.selection !== undefined;
  const allowed = ['mode', 'blocklistCurrent', 'excludeFromImportLists', 'keepFollowing', 'queue', 'removeTorrents', 'secondVersions', ...(selected ? ['seasons', 'episodeIds'] : [])];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return undefined;
  const { removeTorrents, secondVersions } = body;
  const mode = body.mode ?? (target.service === 'radarr' || selected ? undefined : defaultMode(target));
  if (!modesOf(target).includes(mode as Mode)) return undefined;
  const blocklistCurrent = body.blocklistCurrent ?? false;
  if (typeof blocklistCurrent !== 'boolean' || (blocklistCurrent && mode !== 'searchAgain')) return undefined;
  const excludeFromImportLists = body.excludeFromImportLists ?? false;
  if (typeof excludeFromImportLists !== 'boolean' || (excludeFromImportLists && mode !== 'remove')) return undefined;
  const keepFollowing = parseKeepFollowing(body.keepFollowing);
  if (keepFollowing === undefined) return undefined;
  const queue = parseQueue(body.queue);
  if (queue === undefined) return undefined;
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
  return { removeTorrents: hashes, secondVersions: versions, blocklistCurrent, excludeFromImportLists, keepFollowing, queue, mode: mode as Mode };
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
  // A selection's target is read from the request body, the others' from the path.
  const deleteRoute = (targetOf: (context: Context, body: unknown) => DeleteTarget | null) => async (context: Context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json(invalid, 400);
    }
    const target = targetOf(context, body);
    const choices = target === null ? undefined : parseChoices(body, target);
    if (target === null || choices === undefined) return context.json(invalid, 400);
    const { mode, ...chosen } = choices;
    const result = await titleDelete.run(target, chosen, mode);
    if (result.kind === 'ran') return context.json({ deleted: result.deleted, steps: result.steps });
    if (result.kind === 'plan_changed') return context.json({ error: 'plan_changed', reason: result.reason }, 409);
    if (result.kind === 'in_progress') return context.json({ error: 'in_progress' }, 409);
    if (result.kind === 'invalid') return context.json({ ...invalid, reason: result.reason }, 400);
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
  // The plan reads ?seasons=1,2&episodes=101,102; the delete carries the same lists as seasons and episodeIds.
  const list = (text: string | undefined) => (text === undefined || text === '' ? [] : text.split(',').map((item) => (/^\d{1,15}$/.test(item) ? Number(item) : Number.NaN)));
  const selectionOf = (seriesText: string | undefined, selection: Selection | undefined): DeleteTarget | null => {
    const id = idOf(seriesText ?? '');
    return id === null || selection === undefined ? null : { service: 'sonarr', seriesId: id, selection };
  };
  routes.get('/series/:id/selection/delete-plan', planRoute((context) => selectionOf(
    context.req.param('id'),
    parseSelection(list(context.req.query('seasons')), list(context.req.query('episodes'))),
  )));
  routes.post('/series/:id/selection/delete', deleteRoute((context, body) => selectionOf(
    context.req.param('id'),
    isRecord(body) ? parseSelection(body.seasons, body.episodeIds) : undefined,
  )));
  return routes;
};
