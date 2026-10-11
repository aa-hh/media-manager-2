import { linkSync, mkdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { listOpenProblems, type createProblems, type Subject } from './problems.js';
import type { ArrServices } from './services/arr.js';
import { readSetting } from './services/connection.js';
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

// Where a row's file goes, relative to the versions folder, the title its problems are reported under, and an episode's SxxEyy.
type Place = { folder: string; stem: string; title: string; code?: string };

export const IMPORT_PROBLEM_KIND = 'second_version_import';
export const PLEX_PROBLEM_KIND = 'second_version_plex';

const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.m2ts', '.ts']);
// Plex files a name ending in one of these after a separator as an extra, never as a version.
const EXTRAS_WORDS = ['behindthescenes', 'deleted', 'featurette', 'interview', 'scene', 'short', 'trailer', 'other', 'sample'];
const EXTRAS_ENDING = new RegExp(`(?:^|[-_. ]+)(?:${EXTRAS_WORDS.join('|')})$`, 'i');
const serviceWords: Record<Service, string> = { sonarr: 'Sonarr', radarr: 'Radarr' };

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

// The first SxxEyy in a file name, or the 1x02 form when there is none.
export const episodeCode = (fileName: string) => {
  const match = /(?<![a-z0-9])s(\d{1,2})e(\d{1,3})(?!\d)/i.exec(fileName) ?? /(?<![a-z0-9])(\d{1,2})x(\d{2,3})(?!\d)/i.exec(fileName);
  return match === null ? undefined : { season: Number(match[1]), episode: Number(match[2]) };
};

const pad = (value: number) => String(value).padStart(2, '0');
const isVideo = (path: string) => VIDEO_EXTENSIONS.has(extname(path).toLowerCase()) && !basename(path).toLowerCase().includes('sample');
const isInside = (folder: string, path: string) => {
  const inside = relative(folder, path);
  return !inside.startsWith('..') && !isAbsolute(inside);
};

// A finished second-version torrent becomes hardlinks in the versions folder, so it keeps seeding and uses no more disk.
export const createVersionImport = (options: {
  database: DatabaseSync;
  rtorrent: { call: XmlRpcCall };
  arr: ArrServices;
  plex: { request: (path: string) => Promise<{ status: number; body: unknown }> };
  problems: Problems;
  now?: () => number;
}) => {
  const { database, rtorrent, arr, plex, problems } = options;
  const now = options.now ?? Date.now;

  const versionsFolder = (service: Service) => {
    const folder = readSetting(database, 'hostPaths', `versions.${service}`);
    return folder !== undefined && isAbsolute(folder) ? folder : undefined;
  };

  const subjectOf = (row: Row): Subject => (row.service === 'radarr'
    ? { type: 'movie', service: 'radarr', id: String(row.movieId) }
    : { type: 'episode', service: 'sonarr', id: String(row.episodeId) });

  const fail = (row: Row, title: string, reason: string) => {
    const changed = database.prepare("UPDATE second_versions SET state = 'failed', failure = ?, updated_at = ? WHERE id = ? AND state = 'importing'")
      .run(reason, now(), row.id).changes;
    if (changed === 1) problems.open({ kind: IMPORT_PROBLEM_KIND, subject: subjectOf(row), hash: row.hash, state: 'needs_you', summary: `${title} (second version): ${reason}` });
  };

  const markImported = (row: Row, destination: string) => {
    const at = now();
    database.exec('BEGIN IMMEDIATE;');
    try {
      const changed = database.prepare(`
        UPDATE second_versions SET state = 'imported', file_path = ?, failure = NULL, imported_at = ?, updated_at = ? WHERE id = ? AND state = 'importing'
      `).run(destination, at, at, row.id).changes;
      if (changed === 1) {
        database.prepare("INSERT INTO version_events (second_version_id, at, kind, detail) VALUES (?, ?, 'added', ?)").run(row.id, at, basename(destination));
      }
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
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
      for (const row of rows) places.set(row.id, { folder: name, stem: `${name}${ending}`, title: name });
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
      const code = `S${pad(episode.seasonNumber)}E${pad(episode.episodeNumber)}`;
      places.set(row.id, { folder: join(name, `Season ${pad(episode.seasonNumber)}`), stem: `${name} - ${code}${ending}`, title: `${name} ${code}`, code });
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
      const { code } = place;
      const files = videos.filter((path) => {
        const found = episodeCode(basename(path));
        return found !== undefined && `S${pad(found.season)}E${pad(found.episode)}` === code;
      });
      if (files.length === 1) matched.set(row.id, files[0]);
      else reasons.set(row.id, files.length === 0 ? `No video file in the pack is ${code}.` : `${files.length} video files in the pack are ${code}.`);
    }
    return { matched, reasons };
  };

  // Returns the hardlink's path; a destination that already is this file (an import a restart interrupted) is kept as it is.
  const link = (source: string, root: string, place: Place, service: Service) => {
    const original = statSync(source);
    if (statSync(root).dev !== original.dev) {
      throw new Error(`The download and hostPaths versions.${service} are on different drives, so no hardlink can be made.`);
    }
    const folder = join(root, place.folder);
    mkdirSync(folder, { recursive: true });
    for (let copy = 1; ; copy += 1) {
      const destination = join(folder, `${place.stem}${copy === 1 ? '' : ` (${copy})`}${extname(source)}`);
      const existing = statSync(destination, { throwIfNoEntry: false });
      if (existing !== undefined) {
        if (existing.dev === original.dev && existing.ino === original.ino) return destination;
        continue;
      }
      linkSync(source, destination);
      if (statSync(destination).ino !== original.ino) throw new Error(`${destination} is not a hardlink of the download.`);
      return destination;
    }
  };

  // Plex unset or unreachable skips the scan: its own scheduled scan finds the file later.
  const scan = async (service: Service, root: string, folders: Set<string>) => {
    let body: unknown;
    try {
      const result = await plex.request('/library/sections');
      if (result.status < 200 || result.status > 299) return;
      body = result.body;
    } catch {
      return;
    }
    const container = (body as { MediaContainer?: { Directory?: unknown } } | undefined)?.MediaContainer;
    const sections = Array.isArray(container?.Directory) ? container.Directory as Array<Record<string, unknown>> : [];
    const type = service === 'radarr' ? 'movie' : 'show';
    const section = sections.find((item) => item.type === type && Array.isArray(item.Location)
      && (item.Location as Array<Record<string, unknown>>).some((location) => typeof location.path === 'string' && isInside(location.path, root)));
    const subject: Subject = { type: 'dependency', service, id: root };
    const open = listOpenProblems(database).find((problem) => problem.kind === PLEX_PROBLEM_KIND && problem.subject.id === root);
    if (section === undefined || (typeof section.key !== 'string' && typeof section.key !== 'number')) {
      problems.open({ kind: PLEX_PROBLEM_KIND, subject, state: 'needs_you', summary: `Add ${root} to the Plex ${service === 'radarr' ? 'Movies' : 'TV'} library.` });
      return;
    }
    if (open !== undefined) problems.setState(open.id, 'resolved', `Plex reads ${root} now.`);
    for (const folder of folders) {
      try {
        await plex.request(`/library/sections/${encodeURIComponent(String(section.key))}/refresh?path=${encodeURIComponent(folder)}`);
      } catch {
        return;
      }
    }
  };

  const importTorrent = async (rows: Row[]) => {
    const { service, hash } = rows[0];
    const root = versionsFolder(service);
    if (root === undefined) return;
    let files: string[];
    let places: Map<number, Place | string> | undefined;
    try {
      [files, places] = await Promise.all([torrentFiles(hash), placesFor(rows)]);
    } catch {
      return;
    }
    if (places === undefined) return;
    const videos = files.filter(isVideo);
    const { matched, reasons } = matchFiles(rows, videos, places);
    const folders = new Set<string>();
    for (const row of rows) {
      const place = places.get(row.id);
      const fallbackTitle = `${serviceWords[service]} ${service === 'radarr' ? 'movie' : 'episode'} ${service === 'radarr' ? row.movieId : row.episodeId}`;
      if (typeof place !== 'object') {
        fail(row, fallbackTitle, place ?? 'No name was found for it.');
        continue;
      }
      const source = matched.get(row.id);
      if (source === undefined) {
        fail(row, place.title, reasons.get(row.id) ?? 'No video file matched it.');
        continue;
      }
      try {
        const destination = link(source, root, place, service);
        markImported(row, destination);
        folders.add(dirname(destination));
      } catch (error) {
        fail(row, place.title, error instanceof Error ? error.message : 'The hardlink failed.');
      }
    }
    if (folders.size > 0) await scan(service, root, folders);
  };

  const run = async () => {
    const complete = new Set(listTorrents(database).filter((torrent) => torrent.goneAt === null && torrent.complete).map((torrent) => torrent.hash));
    const at = now();
    // TV and movies each wait for their versions folder to be set before importing.
    for (const service of ['radarr', 'sonarr'] as const) {
      if (versionsFolder(service) === undefined) continue;
      for (const row of database.prepare("SELECT id, hash FROM second_versions WHERE state = 'downloading' AND service = ?").all(service)) {
        if (complete.has(String(row.hash))) {
          database.prepare("UPDATE second_versions SET state = 'importing', updated_at = ? WHERE id = ? AND state = 'downloading'").run(at, row.id);
        }
      }
    }
    const rows = database.prepare(`
      SELECT id, service, movie_id, series_id, episode_id, release_title, quality, hash FROM second_versions WHERE state = 'importing' ORDER BY id
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
    const byHash = new Map<string, Row[]>();
    for (const row of rows) byHash.set(row.hash, [...byHash.get(row.hash) ?? [], row]);
    for (const group of byHash.values()) await importTorrent(group);
  };

  return { run };
};
