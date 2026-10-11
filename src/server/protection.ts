import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { GrabRecord } from './grabs.js';
import type { Subject } from './problems.js';
import { getPreference, setPreference } from './preferences.js';
import type { createArr } from './services/arr.js';
import { readSetting } from './services/connection.js';

type Arr = Pick<ReturnType<typeof createArr>, 'request' | 'configured'>;
type Service = 'sonarr' | 'radarr';

export type ProtectedItem =
  | { service: 'radarr'; kind: 'movie'; movieId: number }
  | { service: 'sonarr'; kind: 'episode'; seriesId: number; episodeId: number; seasonNumber: number; episodeNumber: number };

// Names media-manager-2 owns inside Sonarr and Radarr. Changing one strands the old object there.
const RADARR_TAG = 'mm2-manual';
const RADARR_PROFILE = 'mm2 manual downloads';
const seriesTag = (seriesId: number) => `mm2-manual-${seriesId}`;
const seriesProfile = (seriesId: number) => `mm2 manual downloads: series ${seriesId}`;
const WEBHOOK_NAME = 'media-manager-2 grab veto';
// A grab of a protected item counts as the owner's own when media-manager-2 sent a grab
// with the same release title this recently; the webhook fires within seconds of the grab.
const OWN_GRAB_WINDOW_MS = 10 * 60_000;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const positiveInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value > 0
);

// Regex alternation matching every whole number from min to max (0 <= min <= max), the
// way release names write them: any number of leading zeros, no other digit either side.
export const numberRange = (min: number, max: number): string => {
  const stops = new Set<number>();
  for (let nines = 1; ; nines += 1) {
    const stop = Number(String(min).slice(0, -nines) + '9'.repeat(nines));
    if (!(stop >= min && stop <= max)) break;
    stops.add(stop);
  }
  for (let zeros = 1; ; zeros += 1) {
    const stop = (max + 1) - ((max + 1) % 10 ** zeros) - 1;
    if (!(stop >= min && stop < max)) break;
    stops.add(stop);
  }
  stops.add(max);
  const patterns: string[] = [];
  let start = min;
  for (const stop of [...stops].sort((a, b) => a - b)) {
    const low = String(start);
    const high = String(stop);
    let pattern = '';
    let anyDigits = 0;
    for (let index = 0; index < low.length; index += 1) {
      if (low[index] === high[index]) pattern += low[index];
      else if (low[index] === '0' && high[index] === '9') anyDigits += 1;
      else pattern += `[${low[index]}-${high[index]}]`;
    }
    if (anyDigits > 0) pattern += anyDigits === 1 ? '\\d' : `\\d{${anyDigits}}`;
    patterns.push(pattern);
    start = stop + 1;
  }
  return `0*(?:${patterns.join('|')})`;
};

// The ignored terms that refuse every naming of one episode (AA-20): single and
// multi-episode names, ranges that cover it, 1x02, and its season's packs.
export const episodePatterns = (seasonNumber: number, episodeNumber: number) => {
  const season = `0*${seasonNumber}`;
  const episode = `0*${episodeNumber}`;
  return [
    `/\\bS${season}(?:[ ._-]?E\\d{1,3})*[ ._-]?E${episode}(?!\\d)/i`,
    `/\\bS${season}[ ._-]?E${numberRange(Math.min(1, episodeNumber), episodeNumber)}[ ._-]*-[ ._-]*E?${numberRange(episodeNumber, Math.max(episodeNumber, 999))}(?!\\d)/i`,
    `/\\b${season}x${episode}\\b/i`,
    `/\\bS${season}\\b(?![ ._-]?E\\d)/i`,
    `/\\bSeason[ ._-]?${season}\\b/i`,
  ];
};

const rowToItem = (row: Record<string, unknown>): ProtectedItem => (
  row.service === 'radarr'
    ? { service: 'radarr', kind: 'movie', movieId: row.item_id as number }
    : {
      service: 'sonarr',
      kind: 'episode',
      seriesId: row.series_id as number,
      episodeId: row.item_id as number,
      seasonNumber: row.season_number as number,
      episodeNumber: row.episode_number as number,
    }
);

export const createProtection = (
  database: DatabaseSync,
  services: Record<Service, Arr>,
  options: { now?: () => number; recentGrabTitles?: (service: Service, since: number) => string[] } = {},
) => {
  const now = options.now ?? Date.now;

  const call = async (service: Service, path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown) => {
    const response = await services[service].request(path, { method, body });
    if (response.status < 200 || response.status > 299) throw new Error(`${service} ${method} ${path}: HTTP ${response.status}`);
    return response.body;
  };

  const list = (service?: Service, seriesId?: number) => database.prepare(`
    SELECT * FROM protected_items
    WHERE (? IS NULL OR service = ?) AND (? IS NULL OR series_id = ?)
    ORDER BY service, series_id, season_number, episode_number, item_id
  `).all(service ?? null, service ?? null, seriesId ?? null, seriesId ?? null).map((row) => rowToItem(row as Record<string, unknown>));

  const ensureTag = async (service: Service, label: string) => {
    const tags = await call(service, '/api/v3/tag');
    const found = Array.isArray(tags) ? tags.find((tag) => isRecord(tag) && tag.label === label) : undefined;
    if (isRecord(found) && positiveInteger(found.id)) return found.id;
    const created = await call(service, '/api/v3/tag', 'POST', { label });
    if (!isRecord(created) || !positiveInteger(created.id)) throw new Error('tag was not created');
    return created.id;
  };

  const findTag = async (service: Service, label: string) => {
    const tags = await call(service, '/api/v3/tag');
    const found = Array.isArray(tags) ? tags.find((tag) => isRecord(tag) && tag.label === label) : undefined;
    return isRecord(found) && positiveInteger(found.id) ? found.id : undefined;
  };

  const setTagged = async (service: Service, path: string, tagId: number, tagged: boolean) => {
    const record = await call(service, path);
    if (!isRecord(record)) throw new Error(`${path} is not a record`);
    const tags = Array.isArray(record.tags) ? record.tags.filter(positiveInteger) : [];
    if (tags.includes(tagId) === tagged) return;
    await call(service, path, 'PUT', { ...record, tags: tagged ? [...tags, tagId] : tags.filter((id) => id !== tagId) });
  };

  const ensureProfile = async (service: Service, name: string, ignored: string[] | undefined, tagId: number) => {
    const profiles = await call(service, '/api/v3/releaseprofile');
    const existing = Array.isArray(profiles) ? profiles.find((profile) => isRecord(profile) && profile.name === name) : undefined;
    if (ignored === undefined) {
      if (isRecord(existing)) await call(service, `/api/v3/releaseprofile/${existing.id}`, 'DELETE');
      return;
    }
    const wanted = { name, enabled: true, required: [], ignored, indexerId: 0, tags: [tagId] };
    if (!isRecord(existing)) {
      await call(service, '/api/v3/releaseprofile', 'POST', wanted);
      return;
    }
    const same = existing.enabled === true
      && JSON.stringify(existing.ignored) === JSON.stringify(ignored)
      && JSON.stringify(existing.tags) === JSON.stringify([tagId])
      && Array.isArray(existing.required) && existing.required.length === 0;
    if (!same) await call(service, `/api/v3/releaseprofile/${existing.id}`, 'PUT', { ...existing, ...wanted });
  };

  // Makes Radarr match the protected list: one tag, one profile ignoring every release for
  // it, and the tag on exactly the protected movies. Missing pieces are re-created.
  const syncRadarr = async () => {
    const movies = list('radarr');
    const tagId = await ensureTag('radarr', RADARR_TAG);
    await ensureProfile('radarr', RADARR_PROFILE, ['/./'], tagId);
    const wanted = new Set(movies.map((item) => (item.kind === 'movie' ? item.movieId : 0)));
    for (const movieId of wanted) await setTagged('radarr', `/api/v3/movie/${movieId}`, tagId, true);
    const all = await call('radarr', '/api/v3/movie');
    for (const movie of Array.isArray(all) ? all : []) {
      if (!isRecord(movie) || !positiveInteger(movie.id) || wanted.has(movie.id)) continue;
      if (Array.isArray(movie.tags) && movie.tags.includes(tagId)) await setTagged('radarr', `/api/v3/movie/${movie.id}`, tagId, false);
    }
  };

  const syncSeries = async (seriesId: number) => {
    const episodes = list('sonarr', seriesId).filter((item) => item.kind === 'episode');
    if (episodes.length === 0) {
      const tagId = await findTag('sonarr', seriesTag(seriesId));
      if (tagId === undefined) return;
      await ensureProfile('sonarr', seriesProfile(seriesId), undefined, tagId);
      await setTagged('sonarr', `/api/v3/series/${seriesId}`, tagId, false);
      return;
    }
    const tagId = await ensureTag('sonarr', seriesTag(seriesId));
    const ignored = [...new Set(episodes.flatMap((item) => (
      item.kind === 'episode' ? episodePatterns(item.seasonNumber, item.episodeNumber) : []
    )))];
    await ensureProfile('sonarr', seriesProfile(seriesId), ignored, tagId);
    await setTagged('sonarr', `/api/v3/series/${seriesId}`, tagId, true);
  };

  const remove = (item: ProtectedItem) => {
    database.prepare('DELETE FROM protected_items WHERE service = ? AND item_id = ?')
      .run(item.service, item.kind === 'movie' ? item.movieId : item.episodeId);
  };

  const hookToken = () => {
    const existing = getPreference(database, 'hooks.token');
    if (existing !== undefined) return existing;
    const token = randomBytes(32).toString('base64url');
    setPreference(database, 'hooks.token', token);
    return token;
  };

  return {
    list: () => list(),
    hookToken,
    // Radarr items are always movies and Sonarr items always episodes, so service plus id identifies one.
    isProtected: (subject: Subject) => (subject.type === 'movie' || subject.type === 'episode')
      && database.prepare('SELECT 1 FROM protected_items WHERE service = ? AND item_id = ?').get(subject.service, Number(subject.id)) !== undefined,

    // A completed replace protects whatever it put in place.
    async protect(record: GrabRecord) {
      const insert = database.prepare(`
        INSERT INTO protected_items (service, item_id, series_id, season_number, episode_number, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (service, item_id) DO NOTHING
      `);
      const target = record.target;
      if (target.kind === 'movie') {
        insert.run('radarr', target.movieId, null, null, null, now());
        await syncRadarr();
        return;
      }
      let episodeIds: number[];
      if (target.kind === 'episode') episodeIds = [target.episodeId];
      else if (target.kind === 'episodes') episodeIds = target.episodeIds;
      else {
        const all = await call('sonarr', `/api/v3/episode?seriesId=${target.seriesId}`);
        episodeIds = (Array.isArray(all) ? all : []).flatMap((episode) => (
          isRecord(episode) && episode.seasonNumber === target.seasonNumber && episode.hasFile === true && positiveInteger(episode.id) ? [episode.id] : []
        ));
      }
      for (const episodeId of episodeIds) {
        const episode = await call('sonarr', `/api/v3/episode/${episodeId}`);
        if (!isRecord(episode) || typeof episode.seasonNumber !== 'number' || typeof episode.episodeNumber !== 'number') continue;
        insert.run('sonarr', episodeId, target.seriesId, episode.seasonNumber, episode.episodeNumber, now());
      }
      await syncSeries(target.seriesId);
    },

    async unprotect(item: ProtectedItem) {
      remove(item);
      if (item.kind === 'movie') await syncRadarr();
      else await syncSeries(item.seriesId);
    },

    // Drops protection from items whose file is gone, then re-applies everything, so a
    // tag or profile removed by hand in Sonarr or Radarr comes back.
    async reconcile() {
      const items = list();
      for (const item of items) {
        try {
          const path = item.kind === 'movie' ? `/api/v3/movie/${item.movieId}` : `/api/v3/episode/${item.episodeId}`;
          const response = await services[item.service].request(path);
          if (response.status === 404 || (isRecord(response.body) && response.body.hasFile === false)) remove(item);
        } catch {
          continue;
        }
      }
      if (services.radarr.configured() && items.some((item) => item.service === 'radarr')) await syncRadarr();
      const seriesIds = new Set(items.flatMap((item) => (item.kind === 'episode' ? [item.seriesId] : [])));
      for (const seriesId of seriesIds) await syncSeries(seriesId);
    },

    // Points Sonarr's and Radarr's On Grab webhook at media-manager-2, when the operator has
    // saved the address those services can reach it at.
    async ensureWebhook(service: Service) {
      const base = readSetting(database, 'serviceAddresses', 'mediaManager.hookUrl');
      if (base === undefined || !services[service].configured()) return false;
      const url = `${base.replace(/\/+$/, '')}/hooks/grab/${service}?token=${encodeURIComponent(hookToken())}`;
      const notifications = await call(service, '/api/v3/notification');
      const existing = Array.isArray(notifications) ? notifications.find((item) => isRecord(item) && item.name === WEBHOOK_NAME) : undefined;
      const wanted = {
        name: WEBHOOK_NAME,
        implementation: 'Webhook',
        configContract: 'WebhookSettings',
        onGrab: true,
        tags: [],
        fields: [{ name: 'url', value: url }, { name: 'method', value: 1 }],
      };
      if (!isRecord(existing)) await call(service, '/api/v3/notification', 'POST', wanted);
      else {
        const fields = Array.isArray(existing.fields) ? existing.fields : [];
        const current = fields.find((field) => isRecord(field) && field.name === 'url');
        if (existing.onGrab !== true || !isRecord(current) || current.value !== url) {
          await call(service, `/api/v3/notification/${existing.id}`, 'PUT', { ...existing, ...wanted });
        }
      }
      return true;
    },

    // The safety net for names the patterns miss: a grab that touches a protected item and
    // was not media-manager-2's own is removed from rTorrent and blocklisted.
    async veto(service: Service, payload: unknown): Promise<'ignored' | 'allowed' | 'vetoed' | 'not_found'> {
      if (!isRecord(payload) || payload.eventType !== 'Grab') return 'ignored';
      const protectedIds = new Set(list(service).map((item) => (item.kind === 'movie' ? item.movieId : item.episodeId)));
      const touched = service === 'radarr'
        ? isRecord(payload.movie) && positiveInteger(payload.movie.id) && protectedIds.has(payload.movie.id)
        : Array.isArray(payload.episodes) && payload.episodes.some((episode) => isRecord(episode) && protectedIds.has(episode.id as number));
      if (!touched) return 'ignored';
      const title = isRecord(payload.release) && typeof payload.release.releaseTitle === 'string' ? payload.release.releaseTitle.toLowerCase() : undefined;
      const own = options.recentGrabTitles?.(service, now() - OWN_GRAB_WINDOW_MS) ?? [];
      if (title !== undefined && own.some((ownTitle) => ownTitle.toLowerCase() === title)) return 'allowed';
      const downloadId = typeof payload.downloadId === 'string' ? payload.downloadId.toLowerCase() : undefined;
      if (downloadId === undefined) return 'not_found';
      const queue = await call(service, '/api/v3/queue?page=1&pageSize=500&includeUnknownSeriesItems=true&includeUnknownMovieItems=true');
      const records = isRecord(queue) && Array.isArray(queue.records) ? queue.records : [];
      const item = records.find((entry) => isRecord(entry) && typeof entry.downloadId === 'string' && entry.downloadId.toLowerCase() === downloadId);
      if (!isRecord(item) || !positiveInteger(item.id)) return 'not_found';
      await call(service, `/api/v3/queue/${item.id}?removeFromClient=true&blocklist=true`, 'DELETE');
      return 'vetoed';
    },
  };
};

export type Protection = ReturnType<typeof createProtection>;

const sameToken = (given: string | undefined, expected: string) => {
  if (given === undefined) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

// The queue entry can lag the On Grab webhook by a moment, so a veto retries briefly.
const VETO_ATTEMPTS = 4;
const VETO_RETRY_MS = 5_000;

export const createHookRoutes = (protection: Protection, wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))) => {
  const routes = new Hono();
  routes.post(
    '/grab/:service',
    bodyLimit({ maxSize: 512 * 1024, onError: (context) => context.json({ error: 'request_too_large' }, 413) }),
    async (context) => {
      const service = context.req.param('service');
      if (service !== 'sonarr' && service !== 'radarr') return context.json({ error: 'not_found' }, 404);
      if (!sameToken(context.req.query('token'), protection.hookToken())) return context.json({ error: 'unauthenticated' }, 401);
      let payload: unknown;
      try {
        payload = await context.req.json();
      } catch {
        return context.json({ error: 'invalid_request' }, 400);
      }
      void (async () => {
        for (let attempt = 0; attempt < VETO_ATTEMPTS; attempt += 1) {
          try {
            if (await protection.veto(service, payload) !== 'not_found') return;
          } catch {
            // Retried below; a failure to reach the service is the same as not finding the entry yet.
          }
          await wait(VETO_RETRY_MS);
        }
        console.error(`Grab veto could not find the ${service} queue entry.`);
      })();
      return context.body(null, 204);
    },
  );
  return routes;
};

export const createProtectionRoutes = (protection: Protection) => {
  const routes = new Hono();
  routes.get('/', (context) => context.json({ items: protection.list() }));
  return routes;
};
