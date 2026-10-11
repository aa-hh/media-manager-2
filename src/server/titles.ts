import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { type Context, Hono } from 'hono';
import { etag } from 'hono/etag';
import type { EventHub } from './events.js';
import { requestWithTimeout } from './services/connection.js';
import type { ArrServices, Image, Movie, Series } from './services/arr.js';

export type Service = 'sonarr' | 'radarr';
export type ImageKind = 'poster' | 'fanart';
export const TITLE_REFRESH_INTERVAL_MS = 5 * 60_000;

const imageContentType = (header: string, extension: string) =>
  header.split(';')[0].trim().toLowerCase().startsWith('image/') ? header : `image/${extension === 'jpg' ? 'jpeg' : extension}`;

export type CachedTitle = {
  service: Service;
  id: number;
  title: string;
  year: number | null;
  detail: Record<string, unknown>;
  fetchedAt: number;
};

export type CachedEpisode = {
  id: number;
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  airDateUtc: string | null;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
};

type TitleRow = { service: Service; id: number; title: string; year: number | null; detail: string; fetched_at: number };
type EpisodeRow = {
  id: number;
  series_id: number;
  season_number: number;
  episode_number: number;
  title: string | null;
  air_date_utc: string | null;
  overview: string;
  has_file: number;
  monitored: number;
};

const SERVICES: Service[] = ['sonarr', 'radarr'];
const KINDS: ImageKind[] = ['poster', 'fanart'];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const positiveInteger = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
);
const isSuccess = (status: number) => status >= 200 && status <= 299;
const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

// Written beside the target and renamed over it, so a reader never sees half a file; a failure removes the partial copy.
const saveImage = (directory: string, file: string, bytes: Uint8Array) => {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `${file}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, bytes, { mode: 0o600 });
    renameSync(temporary, join(directory, file));
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
};

const toTitle = (row: TitleRow): CachedTitle => ({
  service: row.service,
  id: row.id,
  title: row.title,
  year: row.year,
  detail: JSON.parse(row.detail) as Record<string, unknown>,
  fetchedAt: row.fetched_at,
});

export const readTitle = (database: DatabaseSync, service: Service, id: number): CachedTitle | undefined => {
  const row = database.prepare('SELECT service, id, title, year, detail, fetched_at FROM titles WHERE service = ? AND id = ?')
    .get(service, id) as TitleRow | undefined;
  return row === undefined ? undefined : toTitle(row);
};

export const listTitles = (database: DatabaseSync, service: Service): CachedTitle[] => (
  (database.prepare('SELECT service, id, title, year, detail, fetched_at FROM titles WHERE service = ? ORDER BY id')
    .all(service) as TitleRow[]).map(toTitle)
);

// Library ids keyed by the TMDB id Sonarr or Radarr records on each title.
export const libraryIdsByTmdbId = (database: DatabaseSync, service: Service, tmdbIds: number[]): Map<number, number> => {
  if (tmdbIds.length === 0) return new Map();
  const rows = database.prepare(`SELECT id, json_extract(detail, '$.tmdbId') AS tmdb_id FROM titles
    WHERE service = ? AND json_extract(detail, '$.tmdbId') IN (${tmdbIds.map(() => '?').join(', ')})`).all(service, ...tmdbIds);
  return new Map(rows.map((row) => [Number(row.tmdb_id), Number(row.id)]));
};

export const listEpisodes = (database: DatabaseSync, seriesId: number): CachedEpisode[] => (
  (database.prepare(`SELECT id, series_id, season_number, episode_number, title, air_date_utc, overview, has_file, monitored
    FROM episodes WHERE series_id = ? ORDER BY season_number, episode_number`).all(seriesId) as EpisodeRow[]).map((row) => ({
    id: row.id,
    seriesId: row.series_id,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    title: row.title,
    airDateUtc: row.air_date_utc,
    overview: row.overview,
    hasFile: row.has_file === 1,
    monitored: row.monitored === 1,
  }))
);

export const createTitleCache = (options: {
  database: DatabaseSync;
  arr: ArrServices;
  events: EventHub;
  imageDirectory: string;
  now?: () => number;
}) => {
  const { database, arr, events, imageDirectory } = options;
  const now = options.now ?? Date.now;

  const removeImageFile = (file: string) => rmSync(join(imageDirectory, file), { force: true });
  const titleExists = (service: Service, id: number) => (
    database.prepare('SELECT 1 FROM titles WHERE service = ? AND id = ?').get(service, id) !== undefined
  );

  const syncEpisodes = async (seriesId: number, startedAt: number) => {
    const result = await arr.sonarr.episodes(seriesId);
    if (result.kind !== 'ok') return;
    const insert = database.prepare(`INSERT OR REPLACE INTO episodes
      (id, series_id, season_number, episode_number, title, air_date_utc, overview, has_file, monitored, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    database.exec('BEGIN IMMEDIATE;');
    try {
      // A delete that landed while the episode list was in flight leaves no series to attach episodes to.
      if (!titleExists('sonarr', seriesId)) {
        database.exec('ROLLBACK;');
        return;
      }
      database.prepare('DELETE FROM episodes WHERE series_id = ?').run(seriesId);
      for (const episode of result.value) {
        insert.run(
          episode.id,
          seriesId,
          episode.seasonNumber,
          episode.episodeNumber,
          episode.title,
          episode.airDateUtc,
          episode.overview ?? '',
          episode.hasFile === true ? 1 : 0,
          episode.monitored === true ? 1 : 0,
          startedAt,
        );
      }
      database.exec('COMMIT;');
    } catch {
      database.exec('ROLLBACK;');
    }
  };

  // razor: a failed image download is retried on the next change of its source url, not on a timer.
  // Upgrade path: a retry timestamp on title_images checked by the fallback run.
  const syncImages = async (service: Service, id: number, images: Image[], startedAt: number) => {
    for (const kind of KINDS) {
      const entry = images.find((image) => image.coverType === kind && image.url !== null);
      const stored = database.prepare('SELECT source, file FROM title_images WHERE service = ? AND id = ? AND kind = ?')
        .get(service, id, kind) as { source: string; file: string } | undefined;
      if (entry === undefined || entry.url === null) {
        if (stored !== undefined) {
          database.prepare('DELETE FROM title_images WHERE service = ? AND id = ? AND kind = ?').run(service, id, kind);
          removeImageFile(stored.file);
        }
        continue;
      }
      const source = entry.url;
      if (stored?.source === source && existsSync(join(imageDirectory, stored.file))) continue;
      let name: string;
      try {
        name = posix.basename(new URL(source, 'http://localhost').pathname);
      } catch {
        continue;
      }
      const match = /^[a-z0-9_-]+\.(jpg|png|gif)$/i.exec(name);
      if (match === null) continue;
      try {
        const response = await arr[service].download(`/api/v3/mediacover/${id}/${name}`);
        if (!isSuccess(response.status)) continue;
        // A delete that landed while the download was in flight leaves nothing to attach the image to.
        if (!titleExists(service, id)) return;
        const extension = match[1].toLowerCase();
        const file = `${service}-${id}-${kind}.${extension}`;
        saveImage(imageDirectory, file, response.bytes);
        if (stored !== undefined && stored.file !== file) removeImageFile(stored.file);
        database.prepare(`INSERT INTO title_images (service, id, kind, source, content_type, etag, file, fetched_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (service, id, kind) DO UPDATE SET source = excluded.source, content_type = excluded.content_type,
            etag = excluded.etag, file = excluded.file, fetched_at = excluded.fetched_at`)
          .run(service, id, kind, source, imageContentType(response.contentType, extension),
            sha256(response.bytes), file, startedAt);
      } catch {
        continue;
      }
    }
  };

  // razor: every write is stamped with the time its fetch started and only replaces an older row, so a delete
  // webhook racing a fallback list that started earlier can re-insert the row until the next fallback run.
  // Upgrade path: keep deleted ids with their deletion time and refuse older inserts for them.
  const upsertTitle = async (service: Service, record: Series | Movie, startedAt: number) => {
    const { id } = record;
    if (id === null || record.title === '') return 'skipped';
    const detail = JSON.stringify(record);
    const fingerprint = sha256(detail);
    const stored = database.prepare('SELECT fingerprint FROM titles WHERE service = ? AND id = ?')
      .get(service, id) as { fingerprint: string } | undefined;
    if (stored?.fingerprint === fingerprint) {
      // A restored database or a wiped images folder keeps rows whose files are gone; fetch those again.
      const files = database.prepare('SELECT file FROM title_images WHERE service = ? AND id = ?').all(service, id) as { file: string }[];
      if (files.some(({ file }) => !existsSync(join(imageDirectory, file)))) await syncImages(service, id, record.images, startedAt);
      return 'unchanged';
    }
    const { changes } = database.prepare(`INSERT INTO titles (service, id, title, year, detail, fingerprint, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (service, id) DO UPDATE SET title = excluded.title, year = excluded.year, detail = excluded.detail,
        fingerprint = excluded.fingerprint, fetched_at = excluded.fetched_at
      WHERE titles.fetched_at < excluded.fetched_at`)
      .run(service, id, record.title, Number.isInteger(record.year) ? record.year : null, detail, fingerprint, startedAt);
    if (Number(changes) === 0) return 'stale';
    if (service === 'sonarr') await syncEpisodes(id, startedAt);
    await syncImages(service, id, record.images, startedAt);
    if (titleExists(service, id)) events.publish('title', { service, id, change: 'updated' });
    return 'written';
  };

  const deleteTitle = (service: Service, id: number) => {
    const { changes } = database.prepare('DELETE FROM titles WHERE service = ? AND id = ?').run(service, id);
    if (service === 'sonarr') database.prepare('DELETE FROM episodes WHERE series_id = ?').run(id);
    const images = database.prepare('SELECT file FROM title_images WHERE service = ? AND id = ?').all(service, id) as { file: string }[];
    database.prepare('DELETE FROM title_images WHERE service = ? AND id = ?').run(service, id);
    for (const image of images) removeImageFile(image.file);
    if (Number(changes) > 0) events.publish('title', { service, id, change: 'deleted' });
  };

  const refresh = async (service: Service, id: number) => {
    try {
      const startedAt = now();
      const response = service === 'sonarr' ? await arr.sonarr.series(id) : await arr.radarr.movie(id);
      if (response.kind === 'not_found') deleteTitle(service, id);
      else if (response.kind === 'ok') {
        const result = await upsertTitle(service, response.value, startedAt);
        if (result === 'unchanged' && service === 'sonarr') {
          const before = JSON.stringify(listEpisodes(database, id));
          await syncEpisodes(id, startedAt);
          if (titleExists(service, id) && JSON.stringify(listEpisodes(database, id)) !== before) events.publish('title', { service, id, change: 'updated' });
        }
      }
    } catch {
      // An unreachable or unconfigured service leaves the cached row as it is.
    }
  };

  const reconcileService = async (service: Service) => {
    try {
      const startedAt = now();
      const response = service === 'sonarr' ? await arr.sonarr.listSeries() : await arr.radarr.listMovies();
      if (response.kind !== 'ok') return;
      const listed = new Set<number>();
      for (const item of response.value) {
        if (item.id !== null) listed.add(item.id);
        // razor: episode-only changes are picked up when Sonarr's metadata refresh changes the series resource or on the next webhook refresh; upgrade path is a per-series episode check in the fallback.
        await upsertTitle(service, item, startedAt);
      }
      const older = database.prepare('SELECT id FROM titles WHERE service = ? AND fetched_at < ?')
        .all(service, startedAt) as { id: number }[];
      for (const row of older) if (!listed.has(row.id)) deleteTitle(service, row.id);
    } catch {
      // A failed fallback run writes nothing more; the next run tries again.
    }
  };

  const idOf = (value: unknown) => (isRecord(value) ? positiveInteger(value.id) : null);

  const receiveWebhook = (service: Service, payload: unknown): 'ok' | 'ignored' | 'invalid' => {
    if (!isRecord(payload) || typeof payload.eventType !== 'string') return 'invalid';
    if (payload.eventType === 'Test') return 'ok';
    const id = idOf(service === 'sonarr' ? payload.series : payload.movie);
    const refreshes = service === 'sonarr'
      ? ['SeriesAdd', 'Download', 'EpisodeFileDelete', 'Rename']
      : ['MovieAdded', 'Download', 'MovieFileDelete', 'Rename'];
    const deletes = service === 'sonarr' ? 'SeriesDelete' : 'MovieDelete';
    if (refreshes.includes(payload.eventType)) {
      if (id === null) return 'invalid';
      void refresh(service, id);
      return 'ok';
    }
    if (payload.eventType === deletes) {
      if (id === null) return 'invalid';
      deleteTitle(service, id);
      return 'ok';
    }
    return 'ignored';
  };

  const image = (service: Service, id: number, kind: ImageKind) => {
    const row = database.prepare('SELECT file, content_type, etag FROM title_images WHERE service = ? AND id = ? AND kind = ?')
      .get(service, id, kind) as { file: string; content_type: string; etag: string } | undefined;
    return row === undefined ? undefined : { path: join(imageDirectory, row.file), contentType: row.content_type, etag: row.etag };
  };

  return {
    intervalMs: TITLE_REFRESH_INTERVAL_MS,
    async reconcile() {
      await Promise.all(SERVICES.map(reconcileService));
    },
    refresh,
    receiveWebhook,
    image,
  };
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';
const TMDB_IMAGE_SIZES = new Set(['w342', 'w1920_and_h800_multi_faces']);
const TMDB_IMAGE_FILE = /^[A-Za-z0-9]+\.(jpg|png)$/;
// TMDB's terms cap how long a copy may be kept at six months; 180 days stays inside that.
const TMDB_IMAGE_MAX_AGE_MS = 180 * 24 * 60 * 60_000;
// A partial file this old belongs to no write still running.
const PARTIAL_IMAGE_MAX_AGE_MS = 24 * 60 * 60_000;
export const IMAGE_SWEEP_INTERVAL_MS = 24 * 60 * 60_000;

type StoredImage = { path: string; contentType: string; etag: string };

// Our copies of TMDB posters and backdrops, fetched on first request. Cast photos stay TMDB links.
export const createTmdbImages = (options: {
  database: DatabaseSync;
  imageDirectory: string;
  fetchImpl?: typeof globalThis.fetch;
  now?: () => number;
}) => {
  const { database, imageDirectory } = options;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const pending = new Map<string, Promise<StoredImage | 'not_found' | 'unreachable'>>();

  const download = async (size: string, file: string): Promise<StoredImage | 'not_found' | 'unreachable'> => {
    let bytes: Uint8Array;
    try {
      const response = await requestWithTimeout(fetchImpl, `${TMDB_IMAGE_BASE}${size}/${file}`, { method: 'GET' });
      if (response.status === 404) return 'not_found';
      if (!isSuccess(response.status)) return 'unreachable';
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      return 'unreachable';
    }
    const stored = `tmdb-${size}-${file}`;
    saveImage(imageDirectory, stored, bytes);
    const contentType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const tag = sha256(bytes);
    database.prepare(`INSERT INTO tmdb_images (size, path, content_type, etag, file, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (size, path) DO UPDATE SET content_type = excluded.content_type, etag = excluded.etag,
        file = excluded.file, fetched_at = excluded.fetched_at`)
      .run(size, file, contentType, tag, stored, now());
    return { path: join(imageDirectory, stored), contentType, etag: tag };
  };

  // Returns undefined for a size or file outside the allowed set, before any fetch.
  const image = async (size: string, file: string) => {
    if (!TMDB_IMAGE_SIZES.has(size) || !TMDB_IMAGE_FILE.test(file)) return undefined;
    const row = database.prepare('SELECT content_type, etag, file, fetched_at FROM tmdb_images WHERE size = ? AND path = ?')
      .get(size, file) as { content_type: string; etag: string; file: string; fetched_at: number } | undefined;
    if (row !== undefined) {
      const path = join(imageDirectory, row.file);
      if (now() - row.fetched_at < TMDB_IMAGE_MAX_AGE_MS && existsSync(path)) {
        return { path, contentType: row.content_type, etag: row.etag };
      }
      database.prepare('DELETE FROM tmdb_images WHERE size = ? AND path = ?').run(size, file);
      rmSync(path, { force: true });
    }
    const key = `${size}/${file}`;
    let fetching = pending.get(key);
    if (fetching === undefined) {
      fetching = download(size, file).finally(() => pending.delete(key));
      pending.set(key, fetching);
    }
    return fetching;
  };

  // A copy nobody asks for again would otherwise outlive TMDB's limit, and partial files from a crash would never go.
  const sweep = () => {
    const cutoff = now() - TMDB_IMAGE_MAX_AGE_MS;
    const expired = database.prepare('SELECT file FROM tmdb_images WHERE fetched_at <= ?').all(cutoff) as { file: string }[];
    database.prepare('DELETE FROM tmdb_images WHERE fetched_at <= ?').run(cutoff);
    for (const { file } of expired) rmSync(join(imageDirectory, file), { force: true });
    if (!existsSync(imageDirectory)) return;
    for (const name of readdirSync(imageDirectory)) {
      if (!name.endsWith('.tmp')) continue;
      const path = join(imageDirectory, name);
      const modified = statSync(path, { throwIfNoEntry: false })?.mtimeMs;
      if (modified !== undefined && now() - modified > PARTIAL_IMAGE_MAX_AGE_MS) rmSync(path, { force: true });
    }
  };

  return { image, sweep };
};

const serveImage = (context: Context, found: StoredImage) => {
  let bytes: Buffer;
  try {
    bytes = readFileSync(found.path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return context.json({ error: 'not_found' }, 404);
    throw error;
  }
  return context.body(new Uint8Array(bytes), 200, {
    'Content-Type': found.contentType,
    ETag: `"${found.etag}"`,
    'Cache-Control': 'private, max-age=300',
  });
};

export const createImageRoutes = (
  cache: Pick<ReturnType<typeof createTitleCache>, 'image'>,
  tmdb?: ReturnType<typeof createTmdbImages>,
) => {
  const routes = new Hono();
  routes.use('*', etag());
  routes.get('/:service{sonarr|radarr}/:id{[0-9]{1,18}}/:kind{poster|fanart}', (context) => {
    const found = cache.image(
      context.req.param('service') as Service,
      Number(context.req.param('id')),
      context.req.param('kind') as ImageKind,
    );
    if (found === undefined) return context.json({ error: 'not_found' }, 404);
    return serveImage(context, found);
  });
  if (tmdb !== undefined) {
    routes.get('/tmdb/:size/:file', async (context) => {
      const found = await tmdb.image(context.req.param('size'), context.req.param('file'));
      if (found === 'unreachable') return context.json({ error: 'tmdb_unreachable' }, 502);
      if (found === undefined || found === 'not_found') return context.json({ error: 'not_found' }, 404);
      return serveImage(context, found);
    });
  }
  routes.all('/*', (context) => context.json({ error: 'not_found' }, 404));
  return routes;
};
