import { lstatSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { RemovalAdvice } from './advice.js';
import type { SecondVersionDelete } from './secondVersionDelete.js';
import { listSecondVersionRows, type SecondVersionRow } from './secondVersionRows.js';
import type { ArrServices, FileDetail, Result } from './services/arr.js';
import type { createTorrentFiles, LibraryFileState, RemovalCheck } from './torrentFiles.js';

type TorrentFiles = Pick<ReturnType<typeof createTorrentFiles>, 'mapFiles' | 'canRemoveTorrent' | 'removeTorrent'>;
type Failure = Exclude<Result<never>, { kind: 'ok' }>;

export type DeleteTarget = { service: 'radarr'; movieId: number } | { service: 'sonarr'; seriesId: number };
export type MovieMode = 'remove' | 'keepUnmonitored';
export type Choices = { removeTorrents: string[]; secondVersions: { id: number; removeTorrent: boolean }[] };

export const UNLINKED_FILE = "Can't link this file to a torrent. Its torrent, if any, keeps seeding.";
export const IMPORTED_BY_COPY = 'imported by copy';
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
  // Set when Sonarr or Radarr moves deleted files to a recycle bin, so no space is freed until it is emptied.
  recycleBin: string | null;
  files: PlanFile[];
  torrents: PlanTorrent[];
  secondVersions: PlanSecondVersion[];
};

type Outcome = 'done' | 'failed' | 'skipped';
export type TorrentOutcome = { hash: string; name: string; removed: boolean; reason: string | null };
export type VersionOutcome = { id: number; deleted: boolean; torrentRemoved: boolean; reason: string | null };
export type StepResult =
  | { step: 'map' | 'unmonitor' | 'delete' | 'wait' | 'history'; outcome: Outcome; message: string }
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
  // Drops search's stored lookups for a service, which would still offer a deleted title as in the library.
  forget: (service: DeleteTarget['service']) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}) => {
  const { database, arr, torrentFiles, deleteVersion, advise, forget } = options;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
  const running = new Set<string>();

  const titleId = (target: DeleteTarget) => (target.service === 'radarr' ? target.movieId : target.seriesId);

  // Everything the plan and the delete need, read before any delete: deleting a title wipes its Sonarr or Radarr history.
  const gather = async (target: DeleteTarget) => {
    let title: string;
    let details: FileDetail[];
    if (target.service === 'radarr') {
      const movie = await arr.radarr.movie(target.movieId);
      if (movie.kind !== 'ok') return movie;
      title = movie.value.year === null ? movie.value.title : `${movie.value.title} (${movie.value.year})`;
      details = movie.value.file === null ? [] : [movie.value.file];
    } else {
      const [series, episodeFiles] = await Promise.all([arr.sonarr.series(target.seriesId), arr.sonarr.episodeFiles(target.seriesId)]);
      if (series.kind !== 'ok') return series;
      if (episodeFiles.kind !== 'ok') return episodeFiles;
      title = series.value.title;
      details = episodeFiles.value;
    }
    const files = details.flatMap((file) => (file.id === null || file.path === null ? [] : [{ path: file.path, fileId: file.id, sizeBytes: file.size }]));
    const mapping = await torrentFiles.mapFiles(files.map(({ path, fileId }) => ({ path, fileId })), target.service, titleId(target));
    const secondVersions = listSecondVersionRows(database, target);

    const live = new Map(database.prepare('SELECT hash, name, size_bytes FROM torrents WHERE gone_at IS NULL').all()
      .map((row) => [String(row.hash), { name: String(row.name), sizeBytes: Number(row.size_bytes) }]));
    const holding = new Set(mapping.torrents.map((torrent) => torrent.hash));
    const versionHashes = new Set(secondVersions.flatMap((row) => row.hash?.toUpperCase() ?? []));
    const history = target.service === 'radarr' ? await arr.radarr.history({ movieId: target.movieId }) : await arr.sonarr.history({ seriesId: target.seriesId });
    const upgradedAway = new Set(history.kind !== 'ok' ? [] : history.value.flatMap((record) => {
      const hash = record.downloadId?.toUpperCase();
      return record.eventType === 'downloadFolderImported' && hash !== undefined && live.has(hash) && !holding.has(hash) && !versionHashes.has(hash) ? [hash] : [];
    }));

    const torrents = [...holding, ...upgradedAway].map((hash) => {
      const held = mapping.files.filter((file) => file.hashes.includes(hash));
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
    const planFiles: PlanFile[] = mapping.files.map((file) => ({
      fileId: file.fileId,
      path: file.path,
      sizeBytes: sizes.get(file.fileId) ?? 0,
      state: file.state,
      hashes: file.hashes,
      note: file.state === 'none' || file.state === 'unknown' ? UNLINKED_FILE : null,
      reason: file.reason,
    }));
    return { kind: 'ok' as const, value: { title, files: planFiles, torrents, secondVersions } };
  };

  const plan = async (target: DeleteTarget): Promise<Result<DeletePlan>> => {
    const gathered = await gather(target);
    if (gathered.kind !== 'ok') return gathered;
    const { title, files, torrents, secondVersions } = gathered.value;
    // Second versions start ticked, so their files count as gone when checking whether a torrent is still needed.
    const after = [...files.map((file) => file.path), ...secondVersions.flatMap((row) => row.path ?? [])];
    const recycleBin = await arr[target.service].recycleBin();
    return {
      kind: 'ok',
      value: {
        service: target.service,
        id: titleId(target),
        title,
        recycleBin: recycleBin.kind === 'ok' ? recycleBin.value : null,
        files,
        torrents: await Promise.all(torrents.map(async (torrent) => ({
          ...torrent,
          advice: await advise(torrent.hash),
          removal: torrentFiles.canRemoveTorrent(torrent.hash, { after }),
          ticked: false as const,
        }))),
        secondVersions: await Promise.all(secondVersions.map(async (row) => {
          const hash = row.hash?.toUpperCase();
          return {
            ...row,
            ticked: true as const,
            torrent: hash === undefined ? null : { hash, advice: await advise(hash), removal: torrentFiles.canRemoveTorrent(hash, { after }) },
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

  // Map → delete in Sonarr or Radarr (a refusal stops everything) → wait for the files → torrents → second versions → history.
  // Every choice is checked against a fresh mapping before anything is deleted, so a stale dialog changes nothing.
  const run = async (target: DeleteTarget, choices: Choices, mode: MovieMode = 'remove'): Promise<DeleteRun> => {
    const key = `${target.service}:${titleId(target)}`;
    if (running.has(key)) return { kind: 'in_progress' };
    running.add(key);
    try {
      const gathered = await gather(target);
      if (gathered.kind !== 'ok') return gathered;
      const { title, files, torrents, secondVersions } = gathered.value;
      const changed = (reason: string) => ({ kind: 'plan_changed', reason }) as const;

      const rows = new Map(secondVersions.map((row) => [row.id, row]));
      for (const choice of choices.secondVersions) if (!rows.has(choice.id)) return changed(`Second version ${choice.id} is no longer listed for ${title}.`);
      const ticked = choices.secondVersions.map((choice) => ({ choice, row: rows.get(choice.id) as SecondVersionRow }));
      const after = [...files.map((file) => file.path), ...ticked.flatMap(({ row }) => row.path ?? [])];
      for (const hash of choices.removeTorrents) {
        const torrent = torrents.find((candidate) => candidate.hash === hash);
        if (torrent === undefined) return changed(`The torrent ${hash} is no longer listed for ${title}.`);
        const check = torrentFiles.canRemoveTorrent(hash, { after });
        if (!check.allowed) return changed(`${torrent.name} can no longer be removed: ${check.reason}`);
      }
      for (const { choice, row } of ticked) {
        if (!choice.removeTorrent) continue;
        if (row.hash === null) return changed(`The second version ${row.releaseTitle} has no torrent to remove.`);
        // An unticked second version still uses this torrent: the delete keeps it and says why, so the request is not stale.
        if (secondVersions.some((other) => other.hash === row.hash && !choices.secondVersions.some((picked) => picked.id === other.id))) continue;
        const check = torrentFiles.canRemoveTorrent(row.hash, { after });
        if (!check.allowed) return changed(`The torrent of ${row.releaseTitle} can no longer be removed: ${check.reason}`);
      }

      const steps: StepResult[] = [{ step: 'map', outcome: 'done', message: `Checked which torrents hold ${plural(files.length, 'file')}.` }];
      const label = target.service === 'radarr' ? 'Radarr' : 'Sonarr';
      let summary: string;
      if (target.service === 'sonarr') {
        const result = await arr.sonarr.deleteSeries(target.seriesId);
        if (result.kind !== 'ok') return { kind: 'ran', deleted: false, steps: [...steps, { step: 'delete', outcome: 'failed', message: result.message }] };
        summary = 'Removed from Sonarr with its files.';
        steps.push({ step: 'delete', outcome: 'done', message: summary });
      } else if (mode === 'remove') {
        const result = await arr.radarr.deleteMovie(target.movieId);
        if (result.kind !== 'ok') return { kind: 'ran', deleted: false, steps: [...steps, { step: 'delete', outcome: 'failed', message: result.message }] };
        summary = 'Removed from Radarr with its file.';
        steps.push({ step: 'delete', outcome: 'done', message: summary });
      } else {
        // Unmonitored first, so Radarr does not search for the movie again once its file is gone.
        const unmonitored = await arr.radarr.monitorMovie(target.movieId, false);
        if (unmonitored.kind !== 'ok') return { kind: 'ran', deleted: false, steps: [...steps, { step: 'unmonitor', outcome: 'failed', message: unmonitored.message }] };
        steps.push({ step: 'unmonitor', outcome: 'done', message: 'Unmonitored in Radarr.' });
        summary = 'Kept in Radarr, unmonitored.';
        if (files.length === 0) {
          steps.push({ step: 'delete', outcome: 'skipped', message: 'Radarr has no file for this movie.' });
        } else {
          const results = await Promise.all(files.map((file) => arr.radarr.deleteMovieFile(file.fileId)));
          const failed = results.find((result) => result.kind !== 'ok');
          if (failed !== undefined) {
            return { kind: 'ran', deleted: false, steps: [...steps, { step: 'delete', outcome: 'failed', message: `${failed.message} The movie stays unmonitored.` }] };
          }
          summary = 'Kept in Radarr, unmonitored, with its file deleted.';
          steps.push({ step: 'delete', outcome: 'done', message: 'Deleted the movie file in Radarr.' });
        }
      }
      forget(target.service);

      const left = await waitUntilGone(files.map((file) => file.path));
      const keepAll = left.length > 0 ? `${label} still had ${plural(left.length, 'library file')} after 2 minutes, so every torrent was kept.` : null;
      steps.push(keepAll === null
        ? { step: 'wait', outcome: 'done', message: `${label} deleted ${plural(files.length, 'library file')}.` }
        : { step: 'wait', outcome: 'failed', message: `${keepAll} Still there: ${left.join(', ')}` });

      const torrentResults: TorrentOutcome[] = [];
      for (const hash of choices.removeTorrents) {
        const name = torrents.find((candidate) => candidate.hash === hash)?.name ?? hash;
        if (keepAll !== null) {
          torrentResults.push({ hash, name, removed: false, reason: keepAll });
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

      const kind = target.service === 'sonarr' ? 'series_deleted' : mode === 'remove' ? 'movie_deleted'
        : files.length === 0 ? 'movie_unmonitored' : 'movie_file_deleted';
      const detail = [summary, keepAll, torrentsMessage, versionsMessage].filter((part) => part !== null).join(' ');
      database.prepare('INSERT INTO title_events (service, title_id, title, at, kind, detail) VALUES (?, ?, ?, ?, ?, ?)')
        .run(target.service, titleId(target), title, now(), kind, detail);
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

const parseChoices = (body: unknown, withMode: boolean): (Choices & { mode?: MovieMode }) | undefined => {
  if (!isRecord(body) || !hasKeys(body, withMode ? ['mode', 'removeTorrents', 'secondVersions'] : ['removeTorrents', 'secondVersions'])) return undefined;
  const { mode, removeTorrents, secondVersions } = body;
  if (withMode && mode !== 'remove' && mode !== 'keepUnmonitored') return undefined;
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
  return { removeTorrents: hashes, secondVersions: versions, ...(withMode ? { mode: mode as MovieMode } : {}) };
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

  for (const [path, service] of [['movie', 'radarr'], ['series', 'sonarr']] as const) {
    const target = (id: number): DeleteTarget => (service === 'radarr' ? { service, movieId: id } : { service, seriesId: id });

    routes.get(`/${path}/:id/delete-plan`, async (context) => {
      const id = idOf(context.req.param('id'));
      if (id === null) return context.json(invalid, 400);
      const result = await titleDelete.plan(target(id));
      return result.kind === 'ok' ? context.json(result.value) : failed(context, result);
    });

    routes.post(`/${path}/:id/delete`, async (context) => {
      const id = idOf(context.req.param('id'));
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json(invalid, 400);
      }
      const choices = parseChoices(body, service === 'radarr');
      if (id === null || choices === undefined) return context.json(invalid, 400);
      const result = await titleDelete.run(target(id), choices, choices.mode);
      if (result.kind === 'ran') return context.json({ deleted: result.deleted, steps: result.steps });
      if (result.kind === 'plan_changed') return context.json({ error: 'plan_changed', reason: result.reason }, 409);
      if (result.kind === 'in_progress') return context.json({ error: 'in_progress' }, 409);
      return failed(context, result);
    });
  }
  return routes;
};
