import { linkSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { findOpenProblem, type createProblems, type Subject } from './problems.js';
import type { FailureCode } from './secondVersions.js';
import type { ArrServices } from './services/arr.js';
import { readSetting } from './services/connection.js';
import { JellyfinKeyRefused } from './services/jellyfin.js';
import type { Library, MediaServer } from './services/mediaServer.js';
import type { XmlRpcParam } from './services/rtorrent.js';
import { listTorrents } from './torrents.js';

type Problems = ReturnType<typeof createProblems>;
type XmlRpcCall = (method: string, params: readonly XmlRpcParam[]) => Promise<unknown>;
type Service = 'sonarr' | 'radarr';

type Row = {
  id: number;
  service: Service;
  movieId: number | null;
  seriesId: number | null;
  episodeId: number | null;
  releaseTitle: string;
  quality: string;
  hash: string;
};

// Where a row's file goes, relative to the versions folder, the title its problems are reported under, and an episode's
// numbers. A file holding several episodes is named from the first to the last episode it holds.
type Place = { folder: string; stem: (lastEpisode?: number) => string; title: string; season?: number; episode?: number };

export const IMPORT_PROBLEM_KIND = 'second_version_import';
export const PLEX_PROBLEM_KIND = 'second_version_plex';
export const FOLDER_PROBLEM_KIND = 'second_version_folder';
// Errors on the versions folder side that the owner can fix; the rows wait for the next poll instead of failing.
const RETRYABLE_CODES = new Set(['EACCES', 'EPERM', 'ENOENT', 'EROFS']);
class FolderError extends Error {}

// Jellyfin scans after a delay and confirms nothing, so a merge is retried on later runs (30 seconds apart) up to this many times.
export const MERGE_TRIES = 20;
const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.m2ts', '.ts']);
// Plex or Jellyfin files a name ending in one of these after a separator as an extra, never as a version.
const EXTRAS_WORDS = ['behindthescenes', 'deleted', 'featurette', 'interview', 'scene', 'short', 'trailer', 'other', 'sample', 'clip', 'extra', 'deletedscene'];
const EXTRAS_ENDING = new RegExp(`(?:^|[-_. ]+)(?:${EXTRAS_WORDS.join('|')})$`, 'i');
const serviceWords: Record<Service, string> = { sonarr: 'Sonarr', radarr: 'Radarr' };
const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const positiveInteger = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
);
const idOf = (value: unknown) => (isRecord(value) ? positiveInteger(value.id) : null);

// Removes what file systems or Plex would misread: path and wildcard characters, and braces, so no {edition-…} tag appears.
export const cleanName = (text: string) => text
  .replace(/:\s+/g, ' - ')
  .replace(/[<>:"/\\|?*{}\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ')
  .replace(/^[\s.]+|[\s.]+$/g, '');

// razor: scene names end in -GROUP; anything else gets no group rather than a guess. Sonarr's own parser is the upgrade.
export const releaseGroup = (releaseTitle: string) => {
  const match = /-([A-Za-z0-9]+)(?:\[[^\]]*\])?$/.exec(releaseTitle.trim().replace(/\.(?:mkv|mp4|avi|m2ts|ts)$/i, ''));
  return match === null || /^(?:dl|rip)$/i.test(match[1]) ? undefined : match[1];
};

export const versionSuffix = (quality: string, releaseTitle: string) => {
  let suffix = cleanName(`${quality} ${releaseGroup(releaseTitle) ?? ''}`);
  while (EXTRAS_ENDING.test(suffix)) suffix = cleanName(suffix.replace(EXTRAS_ENDING, ''));
  return suffix;
};

// Every episode the first SxxEyy in a file name holds (S01E01E02 and S01E01-E03 hold several), or the 1x02 form's
// (1x01x02) when there is none. A dash means a range, as Sonarr reads it.
export const episodeCodes = (fileName: string) => {
  const match = /(?<![a-z0-9])s(\d{1,2})((?:-?e\d{1,3})+)(?!\d)/i.exec(fileName) ?? /(?<![a-z0-9])(\d{1,2})((?:x\d{2,3})+)(?!\d)/i.exec(fileName);
  if (match === null) return [];
  const episodes: number[] = [];
  for (const [, dash, digits] of match[2].matchAll(/(-?)[ex](\d+)/gi)) {
    const episode = Number(digits);
    const last = episodes.at(-1);
    if (dash === '-' && last !== undefined) for (let between = last + 1; between < episode; between += 1) episodes.push(between);
    episodes.push(episode);
  }
  return episodes.map((episode) => ({ season: Number(match[1]), episode }));
};

const pad = (value: number) => String(value).padStart(2, '0');
const isVideo = (path: string) => VIDEO_EXTENSIONS.has(extname(path).toLowerCase()) && !basename(path).toLowerCase().includes('sample');

// A finished second-version torrent becomes hardlinks in the versions folder, so it keeps seeding and uses no more disk.
export const createVersionImport = (options: {
  database: DatabaseSync;
  rtorrent: { call: XmlRpcCall };
  arr: ArrServices;
  mediaServer: () => MediaServer;
  problems: Problems;
  now?: () => number;
}) => {
  const { database, rtorrent, arr, mediaServer, problems } = options;
  const now = options.now ?? Date.now;

  const versionsFolder = (service: Service) => {
    const folder = readSetting(database, 'hostPaths', `versions.${service}`);
    return folder !== undefined && isAbsolute(folder) ? folder : undefined;
  };

  const subjectOf = (row: Row): Subject => (row.service === 'radarr'
    ? { type: 'movie', service: 'radarr', id: String(row.movieId) }
    : { type: 'episode', service: 'sonarr', id: String(row.episodeId) });

  const resolveOpen = (kind: string, subject: Subject, text: string) => {
    const open = findOpenProblem(database, kind, subject);
    if (open !== undefined) problems.setState(open.id, 'resolved', text);
  };

  const folderSubject = (service: Service): Subject => ({ type: 'dependency', service, id: `versions.${service}` });

  const fail = (row: Row, title: string, reason: string, code: FailureCode) => {
    const changed = database.prepare("UPDATE second_versions SET state = 'failed', failure = ?, failure_code = ?, updated_at = ? WHERE id = ? AND state IN ('downloading', 'importing')")
      .run(reason, code, now(), row.id).changes;
    if (changed === 1) problems.open({ kind: IMPORT_PROBLEM_KIND, subject: subjectOf(row), hash: row.hash, state: 'needs_you', summary: `${title} (second version): ${reason}` });
  };

  const markImported = (row: Row, destination: string) => {
    const { dev, ino } = statSync(destination, { bigint: true });
    const inode = `${dev}:${ino}`;
    const at = now();
    database.exec('BEGIN IMMEDIATE;');
    try {
      const changed = database.prepare(`
        UPDATE second_versions SET state = 'imported', file_path = ?, file_inode = ?, failure = NULL, failure_code = NULL, imported_at = ?, updated_at = ? WHERE id = ? AND state = 'importing'
      `).run(destination, inode, at, at, row.id).changes;
      if (changed === 1) {
        database.prepare("INSERT INTO version_events (second_version_id, at, kind, detail) VALUES (?, ?, 'added', ?)").run(row.id, at, basename(destination));
      }
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
    resolveOpen(IMPORT_PROBLEM_KIND, subjectOf(row), 'A later second version imported.');
  };

  const torrentFiles = async (hash: string) => {
    const [rows, directory] = await Promise.all([rtorrent.call('f.multicall', [hash, '', 'f.path=']), rtorrent.call('d.directory', [hash])]);
    if (!Array.isArray(rows) || typeof directory !== 'string') throw new Error('Unexpected rTorrent response.');
    return rows.map((row) => {
      if (!Array.isArray(row) || typeof row[0] !== 'string') throw new Error('Unexpected rTorrent response.');
      return join(directory, row[0]);
    });
  };

  // Undefined when Radarr or Sonarr cannot answer now, so the rows wait for the next run.
  const placesFor = async (rows: Row[]): Promise<Map<number, Place | string> | undefined> => {
    const places = new Map<number, Place | string>();
    const first = rows[0];
    const suffix = versionSuffix(first.quality, first.releaseTitle);
    const ending = suffix === '' ? '' : ` - ${suffix}`;
    if (first.service === 'radarr') {
      const result = await arr.radarr.movie(Number(first.movieId));
      if (result.kind === 'not_found') {
        for (const row of rows) places.set(row.id, 'Radarr no longer has this movie.');
        return places;
      }
      if (result.kind !== 'ok') return undefined;
      const { title, year } = result.value;
      const name = cleanName(year === null ? title : `${title} (${year})`);
      for (const row of rows) places.set(row.id, { folder: name, stem: () => `${name}${ending}`, title: name });
      return places;
    }
    const [series, episodes] = await Promise.all([arr.sonarr.series(Number(first.seriesId)), arr.sonarr.episodes(Number(first.seriesId))]);
    if (series.kind === 'not_found') {
      for (const row of rows) places.set(row.id, 'Sonarr no longer has this series.');
      return places;
    }
    if (series.kind !== 'ok' || episodes.kind !== 'ok') return undefined;
    const name = cleanName(series.value.title);
    for (const row of rows) {
      const episode = episodes.value.find((item) => item.id === row.episodeId);
      if (episode === undefined) {
        places.set(row.id, 'Sonarr no longer has this episode.');
        continue;
      }
      const { seasonNumber: season, episodeNumber } = episode;
      const code = `S${pad(season)}E${pad(episodeNumber)}`;
      places.set(row.id, {
        folder: join(name, `Season ${pad(season)}`),
        stem: (last = episodeNumber) => `${name} - ${code}${last === episodeNumber ? '' : `-E${pad(last)}`}${ending}`,
        title: `${name} ${code}`,
        season,
        episode: episodeNumber,
      });
    }
    return places;
  };

  // Which video file each row gets, or why it gets none.
  const matchFiles = (rows: Row[], videos: string[], places: Map<number, Place | string>) => {
    const matched = new Map<number, string>();
    const reasons = new Map<number, string>();
    // Counted over the whole torrent, so a pack a restart left half imported is still matched as a pack.
    const live = database.prepare("SELECT COUNT(*) AS n FROM second_versions WHERE hash = ? AND state NOT IN ('failed', 'deleted')").get(rows[0].hash);
    if (rows[0].service === 'radarr' || Number(live?.n) === 1) {
      if (videos.length === 1) matched.set(rows[0].id, videos[0]);
      else reasons.set(rows[0].id, `The torrent has ${videos.length} video files; one was expected.`);
      return { matched, reasons };
    }
    for (const row of rows) {
      const place = places.get(row.id);
      if (typeof place !== 'object') continue;
      const code = `S${pad(Number(place.season))}E${pad(Number(place.episode))}`;
      // A file holding several episodes satisfies every row it names.
      const files = videos.filter((path) => episodeCodes(basename(path)).some((found) => found.season === place.season && found.episode === place.episode));
      if (files.length === 1) matched.set(row.id, files[0]);
      else reasons.set(row.id, files.length === 0 ? `No video file in the pack is ${code}.` : `${files.length} video files in the pack are ${code}.`);
    }
    return { matched, reasons };
  };

  // Returns the hardlink's path; a destination that already is this file (an import a restart interrupted) is kept as it is.
  // Errors on the versions folder side become a FolderError; errors on the download side stay permanent.
  const link = (source: string, root: string, folderName: string, stem: string, service: Service) => {
    const original = statSync(source);
    const onFolder = <T>(step: () => T): T => {
      try {
        return step();
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        throw code !== undefined && RETRYABLE_CODES.has(code) ? new FolderError((error as Error).message) : error;
      }
    };
    // A missing versions folder (an unmounted drive) is reported, never created by the mkdir below.
    onFolder(() => statSync(root));
    const folder = join(root, folderName);
    const made = onFolder(() => mkdirSync(folder, { recursive: true }));
    for (let copy = 1; ; copy += 1) {
      const destination = join(folder, `${stem}${copy === 1 ? '' : ` (${copy})`}${extname(source)}`);
      const existing = onFolder(() => statSync(destination, { throwIfNoEntry: false }));
      if (existing !== undefined) {
        if (existing.dev === original.dev && existing.ino === original.ino) return destination;
        continue;
      }
      // The link itself is the drive check: matching device numbers miss bind mounts and container volumes.
      try {
        onFolder(() => linkSync(source, destination));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
        if (made !== undefined) rmSync(made, { recursive: true });
        throw new Error(`The download and hostPaths versions.${service} are on different drives, so no hardlink can be made.`);
      }
      if (statSync(destination).ino !== original.ino) throw new Error(`${destination} is not a hardlink of the download.`);
      return destination;
    }
  };

  // A media server unset or unreachable skips the scan: its own scheduled scan finds the file later.
  const scan = async (service: Service, root: string, folders: Set<string>) => {
    const server = mediaServer();
    let library: Library | undefined;
    try {
      library = await server.findLibraryFor(root, service === 'radarr' ? 'movie' : 'show');
    } catch {
      return;
    }
    const subject: Subject = { type: 'dependency', service, id: root };
    if (library === undefined) {
      problems.open({ kind: PLEX_PROBLEM_KIND, subject, state: 'needs_you', summary: `Add ${root} to the ${server.label} ${service === 'radarr' ? 'Movies' : 'TV'} library.` });
      return;
    }
    resolveOpen(PLEX_PROBLEM_KIND, subject, `${server.label} reads ${root} now.`);
    for (const folder of folders) {
      try {
        await server.refresh(library, folder);
      } catch {
        return;
      }
    }
  };

  // 'skipped' when Sonarr, Radarr or rTorrent did not answer, so the versions folder was not tried.
  const importTorrent = async (rows: Row[]): Promise<'done' | 'skipped' | 'folder_error'> => {
    const { service, hash } = rows[0];
    const root = versionsFolder(service);
    if (root === undefined) return 'skipped';
    let files: string[];
    let places: Map<number, Place | string> | undefined;
    try {
      [files, places] = await Promise.all([torrentFiles(hash), placesFor(rows)]);
    } catch {
      return 'skipped';
    }
    if (places === undefined) return 'skipped';
    const videos = files.filter(isVideo);
    const { matched, reasons } = matchFiles(rows, videos, places);
    // Rows sharing one file (a file holding several episodes) get one hardlink between them.
    const bySource = new Map<string, Array<{ row: Row; place: Place }>>();
    for (const row of rows) {
      const place = places.get(row.id);
      const fallbackTitle = `${serviceWords[service]} ${service === 'radarr' ? 'movie' : 'episode'} ${service === 'radarr' ? row.movieId : row.episodeId}`;
      if (typeof place !== 'object') {
        fail(row, fallbackTitle, place ?? 'No name was found for it.', 'import_no_name');
        continue;
      }
      const source = matched.get(row.id);
      if (source === undefined) {
        fail(row, place.title, reasons.get(row.id) ?? 'No video file matched it.', 'import_no_match');
        continue;
      }
      bySource.set(source, [...bySource.get(source) ?? [], { row, place }]);
    }
    const folders = new Set<string>();
    let outcome: 'done' | 'folder_error' = 'done';
    for (const [source, sharing] of bySource) {
      sharing.sort((a, b) => Number(a.place.episode) - Number(b.place.episode));
      const { place } = sharing[0];
      try {
        const destination = link(source, root, place.folder, place.stem(sharing.at(-1)?.place.episode), service);
        for (const { row } of sharing) markImported(row, destination);
        folders.add(dirname(destination));
      } catch (error) {
        if (error instanceof FolderError) {
          problems.open({
            kind: FOLDER_PROBLEM_KIND,
            subject: folderSubject(service),
            state: 'needs_you',
            summary: `Second versions cannot be imported into ${root} (hostPaths versions.${service}): ${error.message}`,
          });
          outcome = 'folder_error';
          break;
        }
        for (const { row } of sharing) fail(row, place.title, error instanceof Error ? error.message : 'The hardlink failed.', 'import_link_failed');
      }
    }
    if (folders.size > 0) await scan(service, root, folders);
    return outcome;
  };

  const readRows = (states: string): Row[] => database.prepare(`
    SELECT id, service, movie_id, series_id, episode_id, release_title, quality, hash FROM second_versions WHERE state IN (${states}) ORDER BY id
  `).all().map((row): Row => ({
    id: Number(row.id),
    service: row.service as Service,
    movieId: row.movie_id === null ? null : Number(row.movie_id),
    seriesId: row.series_id === null ? null : Number(row.series_id),
    episodeId: row.episode_id === null ? null : Number(row.episode_id),
    releaseTitle: String(row.release_title),
    quality: String(row.quality),
    hash: String(row.hash),
  }));

  // Jellyfin groups versions only within one folder, so each imported version is merged with the tracked file by hand.
  // A try counts only when Radarr or Sonarr and Jellyfin answered, so an outage spends none; a rejected request or a version
  // Jellyfin never finds spends one, and stops being tried after MERGE_TRIES. A rename or upgrade of the tracked file splits
  // the merge, so a tracked path that differs from the one stored on the row resets the tries and the version is merged
  // again. A file replaced under the same path keeps its Jellyfin item and its merge, so the path alone is enough.
  // razor: a scan that runs while the tracked file is gone, before its replacement lands under the same path, hides the
  // version until the next rename; looking the version up by its stored Jellyfin item id is the upgrade if that shows up.
  // Rows at MERGE_TRIES are checked again only once a Radarr or Sonarr rename or download event clears merge_checked_at
  // (trackedFileChanged), and a series' episodes are fetched once per run. merge_checked_at holds when a capped row was
  // last checked, or NULL while a check is owed.
  // razor: an event sent while this app is down is not replayed, so that rename stays split until the next event for the
  // title; a daily check of capped rows is the upgrade if that shows up.
  // Counts trackedFileChanged calls, so a run that awaited Radarr or Sonarr while an event arrived does not record a check
  // whose answer may predate the rename.
  let changes = 0;
  const mergeVersions = async () => {
    const server = mediaServer();
    if (server.mergeVersions === undefined) return;
    const at = now();
    const changesAtStart = changes;
    const imported = database.prepare("SELECT id, service, movie_id, series_id, episode_id, file_path, merge_tries, tracked_path, merge_checked_at FROM second_versions WHERE state = 'imported' ORDER BY id").all();
    const episodesBySeries = new Map<number, ReturnType<typeof arr.sonarr.episodes>>();
    for (const row of imported) {
      let tries = Number(row.merge_tries);
      if (tries >= MERGE_TRIES && row.merge_checked_at !== null) continue;
      try {
        let tracked: string | null | undefined;
        let season: number | undefined;
        if (row.service === 'radarr') {
          const movie = await arr.radarr.movie(Number(row.movie_id));
          if (movie.kind !== 'ok' && movie.kind !== 'not_found') continue;
          tracked = movie.kind === 'ok' ? movie.value.file?.path : undefined;
        } else {
          const seriesId = Number(row.series_id);
          if (!episodesBySeries.has(seriesId)) episodesBySeries.set(seriesId, arr.sonarr.episodes(seriesId, { withFiles: true }));
          const episodes = await episodesBySeries.get(seriesId)!;
          if (episodes.kind !== 'ok' && episodes.kind !== 'not_found') continue;
          const episode = episodes.kind === 'ok' ? episodes.value.find((item) => item.id === Number(row.episode_id)) : undefined;
          tracked = episode?.file?.path;
          season = episode?.seasonNumber;
        }
        if (changes === changesAtStart) database.prepare('UPDATE second_versions SET merge_checked_at = ? WHERE id = ?').run(at, row.id);
        if (typeof tracked === 'string' && tracked !== row.tracked_path) {
          // The first path seen is only recorded, so rows imported before this column existed are not merged again.
          if (row.tracked_path !== null) tries = 0;
          database.prepare('UPDATE second_versions SET tracked_path = ?, merge_tries = ? WHERE id = ?').run(tracked, tries, row.id);
        }
        if (tries >= MERGE_TRIES) continue;
        const merged = typeof tracked === 'string' && await server.mergeVersions(row.service === 'radarr' ? 'movie' : 'show', tracked, String(row.file_path), season);
        database.prepare('UPDATE second_versions SET merge_tries = ? WHERE id = ?').run(merged ? MERGE_TRIES : tries + 1, row.id);
      } catch (error) {
        // A refused key refuses every row, so the rest wait for the next run; the health check reports the key.
        if (error instanceof JellyfinKeyRefused) return;
        // Jellyfin or Radarr/Sonarr unreachable, or Jellyfin answering 5xx: no try spent.
      }
    }
  };

  const run = async () => {
    const torrents = listTorrents(database);
    const complete = new Set(torrents.filter((torrent) => torrent.goneAt === null && torrent.complete).map((torrent) => torrent.hash));
    // Nothing else moves a row on once its torrent leaves rTorrent, and a delete refuses a row still downloading or importing.
    const gone = new Set(torrents.filter((torrent) => torrent.goneAt !== null).map((torrent) => torrent.hash));
    for (const row of readRows("'downloading', 'importing'")) {
      if (gone.has(row.hash)) fail(row, row.releaseTitle, 'Its torrent left rTorrent before it was imported.', 'torrent_gone');
    }
    const at = now();
    // TV and movies each wait for their versions folder to be set before importing, and say so once something is waiting.
    for (const service of ['radarr', 'sonarr'] as const) {
      const finished = database.prepare("SELECT id, hash, state FROM second_versions WHERE state IN ('downloading', 'importing') AND service = ?").all(service)
        .filter((row) => row.state === 'importing' || complete.has(String(row.hash)));
      if (versionsFolder(service) === undefined) {
        if (finished.length > 0) {
          problems.open({
            kind: FOLDER_PROBLEM_KIND,
            subject: folderSubject(service),
            state: 'needs_you',
            summary: `Set hostPaths versions.${service} to an absolute folder: finished second versions are waiting to import.`,
          });
        }
        continue;
      }
      for (const row of finished) {
        database.prepare("UPDATE second_versions SET state = 'importing', updated_at = ? WHERE id = ? AND state = 'downloading'").run(at, row.id);
      }
    }
    const rows = readRows("'importing'");
    const byHash = new Map<string, Row[]>();
    for (const row of rows) byHash.set(row.hash, [...byHash.get(row.hash) ?? [], row]);
    const unsettled = new Set<Service>();
    for (const group of byHash.values()) if (await importTorrent(group) !== 'done') unsettled.add(group[0].service);
    // A run with no folder error clears the folder problem, also when it had nothing to import or every row failed
    // for another reason before the folder was tried.
    for (const service of ['radarr', 'sonarr'] as const) {
      if (versionsFolder(service) !== undefined && !unsettled.has(service)) {
        resolveOpen(FOLDER_PROBLEM_KIND, folderSubject(service), `An import run for hostPaths versions.${service} hit no folder error.`);
      }
    }
    await mergeVersions();
  };

  // A Radarr or Sonarr rename or download (a download over an existing file is an upgrade) may move the tracked file, so
  // the title's imported rows are checked on the next run. Sonarr's Rename lists file ids, not episode ids, so it marks
  // every row of the series. The payload comes from outside: anything malformed marks nothing, and nothing is thrown.
  const trackedFileChanged = (service: Service, payload: unknown) => {
    if (!isRecord(payload) || (payload.eventType !== 'Rename' && payload.eventType !== 'Download')) return;
    changes += 1;
    try {
      if (service === 'radarr') {
        const movieId = idOf(payload.movie);
        if (movieId !== null) database.prepare("UPDATE second_versions SET merge_checked_at = NULL WHERE state = 'imported' AND service = 'radarr' AND movie_id = ?").run(movieId);
        return;
      }
      const seriesId = idOf(payload.series);
      if (seriesId === null) return;
      const update = "UPDATE second_versions SET merge_checked_at = NULL WHERE state = 'imported' AND service = 'sonarr' AND series_id = ?";
      if (payload.episodes === undefined) {
        database.prepare(update).run(seriesId);
        return;
      }
      if (!Array.isArray(payload.episodes)) return;
      const episodeIds = payload.episodes.map(idOf).filter((id) => id !== null);
      if (episodeIds.length > 0) database.prepare(`${update} AND episode_id IN (${episodeIds.map(() => '?').join(', ')})`).run(seriesId, ...episodeIds);
    } catch (error) {
      console.error(`Marking second versions for a merge check failed: ${(error as Error).message}`);
    }
  };

  return { run, scan, trackedFileChanged };
};
