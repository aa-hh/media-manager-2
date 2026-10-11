import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { etag } from 'hono/etag';
import type { EventHub } from './events.js';
import type { createArr } from './services/arr.js';

export type Service = 'sonarr' | 'radarr';
export type ImageKind = 'poster' | 'fanart';
export const TITLE_REFRESH_INTERVAL_MS = 5 * 60_000;

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

type Arr = Pick<ReturnType<typeof createArr>, 'request' | 'download'>;
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
const resourcePath = { sonarr: '/api/v3/series', radarr: '/api/v3/movie' } as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const positiveInteger = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
);
const isSuccess = (status: number) => status >= 200 && status <= 299;
const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

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
  arr: Record<Service, Arr>;
  events: EventHub;
  imageDirectory: string;
  now?: () => number;
}) => {
  const { database, arr, events, imageDirectory } = options;
  const now = options.now ?? Date.now;

  const removeImageFile = (file: string) => rmSync(join(imageDirectory, file), { force: true });

  const syncEpisodes = async (seriesId: number, startedAt: number) => {
    let response: { status: number; body: unknown };
    try {
      response = await arr.sonarr.request(`/api/v3/episode?seriesId=${seriesId}`);
    } catch {
      return;
    }
    if (!isSuccess(response.status) || !Array.isArray(response.body)) return;
    const insert = database.prepare(`INSERT OR REPLACE INTO episodes
      (id, series_id, season_number, episode_number, title, air_date_utc, overview, has_file, monitored, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.prepare('DELETE FROM episodes WHERE series_id = ?').run(seriesId);
      for (const episode of response.body) {
        if (!isRecord(episode)) continue;
        const id = positiveInteger(episode.id);
        const { seasonNumber, episodeNumber } = episode;
        if (id === null || !Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) continue;
        insert.run(
          id,
          seriesId,
          seasonNumber as number,
          episodeNumber as number,
          typeof episode.title === 'string' ? episode.title : null,
          typeof episode.airDateUtc === 'string' ? episode.airDateUtc : null,
          typeof episode.overview === 'string' ? episode.overview : '',
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
  const syncImages = async (service: Service, id: number, resource: Record<string, unknown>, startedAt: number) => {
    const images = Array.isArray(resource.images) ? resource.images : [];
    for (const kind of KINDS) {
      const entry = images.find((image) => isRecord(image) && image.coverType === kind && typeof image.url === 'string');
      const stored = database.prepare('SELECT source, file FROM title_images WHERE service = ? AND id = ? AND kind = ?')
        .get(service, id, kind) as { source: string; file: string } | undefined;
      if (!isRecord(entry)) {
        if (stored !== undefined) {
          database.prepare('DELETE FROM title_images WHERE service = ? AND id = ? AND kind = ?').run(service, id, kind);
          removeImageFile(stored.file);
        }
        continue;
      }
      const source = entry.url as string;
      if (stored?.source === source) continue;
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
        if (database.prepare('SELECT 1 FROM titles WHERE service = ? AND id = ?').get(service, id) === undefined) return;
        const extension = match[1].toLowerCase();
        const file = `${service}-${id}-${kind}.${extension}`;
        mkdirSync(imageDirectory, { recursive: true, mode: 0o700 });
        const temporary = join(imageDirectory, `${file}.${randomUUID()}.tmp`);
        writeFileSync(temporary, response.bytes, { mode: 0o600 });
        renameSync(temporary, join(imageDirectory, file));
        if (stored !== undefined && stored.file !== file) removeImageFile(stored.file);
        database.prepare(`INSERT INTO title_images (service, id, kind, source, content_type, etag, file, fetched_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (service, id, kind) DO UPDATE SET source = excluded.source, content_type = excluded.content_type,
            etag = excluded.etag, file = excluded.file, fetched_at = excluded.fetched_at`)
          .run(service, id, kind, source, response.contentType || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
            sha256(response.bytes), file, startedAt);
      } catch {
        continue;
      }
    }
  };

  // razor: every write is stamped with the time its fetch started and only replaces an older row, so a delete
  // webhook racing a fallback list that started earlier can re-insert the row until the next fallback run.
  // Upgrade path: keep deleted ids with their deletion time and refuse older inserts for them.
  const upsertTitle = async (service: Service, resource: unknown, startedAt: number) => {
    if (!isRecord(resource)) return 'skipped';
    const id = positiveInteger(resource.id);
    if (id === null || typeof resource.title !== 'string' || resource.title === '') return 'skipped';
    const detail = JSON.stringify(resource);
    const fingerprint = sha256(detail);
    const stored = database.prepare('SELECT fingerprint FROM titles WHERE service = ? AND id = ?')
      .get(service, id) as { fingerprint: string } | undefined;
    if (stored?.fingerprint === fingerprint) return 'unchanged';
    const { changes } = database.prepare(`INSERT INTO titles (service, id, title, year, detail, fingerprint, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (service, id) DO UPDATE SET title = excluded.title, year = excluded.year, detail = excluded.detail,
        fingerprint = excluded.fingerprint, fetched_at = excluded.fetched_at
      WHERE titles.fetched_at < excluded.fetched_at`)
      .run(service, id, resource.title, Number.isInteger(resource.year) ? resource.year as number : null, detail, fingerprint, startedAt);
    if (Number(changes) === 0) return 'stale';
    if (service === 'sonarr') await syncEpisodes(id, startedAt);
    await syncImages(service, id, resource, startedAt);
    events.publish('title', { service, id, change: 'updated' });
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
      const response = await arr[service].request(`${resourcePath[service]}/${id}`);
      if (response.status === 404) deleteTitle(service, id);
      else if (isSuccess(response.status) && isRecord(response.body)) {
        const result = await upsertTitle(service, response.body, startedAt);
        if (result === 'unchanged' && service === 'sonarr') {
          const before = JSON.stringify(listEpisodes(database, id));
          await syncEpisodes(id, startedAt);
          if (JSON.stringify(listEpisodes(database, id)) !== before) events.publish('title', { service, id, change: 'updated' });
        }
      }
    } catch {
      // An unreachable or unconfigured service leaves the cached row as it is.
    }
  };

  const reconcileService = async (service: Service) => {
    try {
      const startedAt = now();
      const response = await arr[service].request(resourcePath[service]);
      if (!isSuccess(response.status) || !Array.isArray(response.body)) return;
      const listed = new Set<number>();
      for (const item of response.body) {
        const id = isRecord(item) ? positiveInteger(item.id) : null;
        if (id !== null) listed.add(id);
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

export const createImageRoutes = (cache: Pick<ReturnType<typeof createTitleCache>, 'image'>) => {
  const routes = new Hono();
  routes.use('*', etag());
  routes.get('/:service{sonarr|radarr}/:id{[0-9]{1,18}}/:kind{poster|fanart}', (context) => {
    const found = cache.image(
      context.req.param('service') as Service,
      Number(context.req.param('id')),
      context.req.param('kind') as ImageKind,
    );
    if (found === undefined) return context.json({ error: 'not_found' }, 404);
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
  });
  routes.all('/*', (context) => context.json({ error: 'not_found' }, 404));
  return routes;
};
