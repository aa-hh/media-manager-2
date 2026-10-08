import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { parseTarget, targetKey, type Releases, type ReleaseTarget } from './releases.js';
import type { createArr } from './services/arr.js';

type Arr = Pick<ReturnType<typeof createArr>, 'request' | 'configured'>;

export type GrabIntent = 'grab' | 'replace';
export type GrabState = 'sending' | 'sent' | 'importing' | 'failed' | 'completed';

export type Overrides = {
  movieId?: number;
  seriesId?: number;
  episodeIds?: number[];
  qualityId?: number;
};

// A grab's target is what the release counts as: the search's target, or the movie or
// episodes an override names, which may be several episodes for a multi-episode release.
export type GrabTarget =
  | ReleaseTarget
  | { service: 'sonarr'; kind: 'episodes'; seriesId: number; episodeIds: number[] };

const grabTargetKey = (target: GrabTarget) => (
  target.kind === 'episodes' ? `sonarr:episodes:${target.seriesId}:${target.episodeIds.join(',')}` : targetKey(target)
);

export type GrabRecord = {
  id: number;
  service: 'sonarr' | 'radarr';
  target: GrabTarget;
  searchedFor: ReleaseTarget;
  guid: string;
  releaseTitle: string;
  intent: GrabIntent;
  state: GrabState;
  failure: string | null;
  downloadId: string | null;
  createdAt: number;
  updatedAt: number;
};

const GRAB_TIMEOUT_MS = 60_000;
// Sonarr and Radarr keep their grab history paged newest first; a grab media-manager-2
// just sent is on the first page unless dozens of grabs landed in between.
const HISTORY_PAGE = '/api/v3/history?page=1&pageSize=50&sortKey=date&sortDirection=descending&eventType=1';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const positiveInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value > 0
);

const refusal = (body: unknown): string | undefined => {
  const messages = (Array.isArray(body) ? body : [body]).flatMap((item) => {
    if (typeof item === 'string' && item.trim() !== '') return [item.trim()];
    if (!isRecord(item)) return [];
    const message = item.errorMessage ?? item.message ?? item.title;
    return typeof message === 'string' && message.trim() !== '' ? [message.trim()] : [];
  });
  return messages.length === 0 ? undefined : [...new Set(messages)].join(' ');
};

const rowToRecord = (row: Record<string, unknown>): GrabRecord => ({
  id: row.id as number,
  service: row.service as GrabRecord['service'],
  target: JSON.parse(row.target as string) as GrabTarget,
  searchedFor: JSON.parse(row.searched_for as string) as ReleaseTarget,
  guid: row.guid as string,
  releaseTitle: row.release_title as string,
  intent: row.intent as GrabIntent,
  state: row.state as GrabState,
  failure: (row.failure as string | null) ?? null,
  downloadId: (row.download_id as string | null) ?? null,
  createdAt: row.created_at as number,
  updatedAt: row.updated_at as number,
});

export const parseOverrides = (value: unknown, service: 'sonarr' | 'radarr'): Overrides | undefined => {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return undefined;
  const overrides: Overrides = {};
  for (const [key, field] of Object.entries(value)) {
    if (key === 'qualityId' && positiveInteger(field)) overrides.qualityId = field;
    else if (key === 'movieId' && service === 'radarr' && positiveInteger(field)) overrides.movieId = field;
    else if (key === 'seriesId' && service === 'sonarr' && positiveInteger(field)) overrides.seriesId = field;
    else if (
      key === 'episodeIds' && service === 'sonarr' && Array.isArray(field) && field.length > 0 && field.length <= 50
      && field.every(positiveInteger)
    ) overrides.episodeIds = [...new Set(field as number[])];
    else return undefined;
  }
  if ((overrides.seriesId === undefined) !== (overrides.episodeIds === undefined)) return undefined;
  return overrides;
};

// What the grab is for after overrides: the record keeps this, not the search's target,
// so a replace completes against the movie or episode the owner said the release is.
const overriddenTarget = (searched: ReleaseTarget, overrides: Overrides): GrabTarget => {
  if (searched.kind === 'movie') return overrides.movieId === undefined ? searched : { ...searched, movieId: overrides.movieId };
  if (overrides.seriesId === undefined || overrides.episodeIds === undefined) return searched;
  return overrides.episodeIds.length === 1
    ? { service: 'sonarr', kind: 'episode', seriesId: overrides.seriesId, episodeId: overrides.episodeIds[0] }
    : { service: 'sonarr', kind: 'episodes', seriesId: overrides.seriesId, episodeIds: overrides.episodeIds };
};

export const createGrabs = (
  database: DatabaseSync,
  services: { sonarr: Arr; radarr: Arr },
  releases: Releases,
  options: { now?: () => number; onChange?: (record: GrabRecord) => void } = {},
) => {
  const now = options.now ?? Date.now;

  const read = (id: number) => {
    const row = database.prepare('SELECT * FROM grabs WHERE id = ?').get(id);
    return row === undefined ? undefined : rowToRecord(row as Record<string, unknown>);
  };

  const update = (id: number, fields: { state?: GrabState; failure?: string | null; downloadId?: string }) => {
    database.prepare(`
      UPDATE grabs SET
        state = COALESCE(?, state),
        failure = CASE WHEN ? THEN ? ELSE failure END,
        download_id = COALESCE(?, download_id),
        updated_at = ?
      WHERE id = ?
    `).run(
      fields.state ?? null,
      fields.failure !== undefined ? 1 : 0,
      fields.failure ?? null,
      fields.downloadId ?? null,
      now(),
      id,
    );
    const record = read(id)!;
    options.onChange?.(record);
    return record;
  };

  const resolveDownloadId = async (record: GrabRecord) => {
    let response: { status: number; body: unknown };
    try {
      response = await services[record.service].request(HISTORY_PAGE);
    } catch {
      return record;
    }
    if (response.status < 200 || response.status > 299 || !isRecord(response.body) || !Array.isArray(response.body.records)) return record;
    for (const event of response.body.records) {
      if (!isRecord(event) || !isRecord(event.data)) continue;
      if (event.data.guid !== record.guid || typeof event.downloadId !== 'string' || event.downloadId === '') continue;
      return update(record.id, { downloadId: event.downloadId });
    }
    return record;
  };

  const seasonEpisodeIds = async (seriesId: number, seasonNumber: number) => {
    try {
      const response = await services.sonarr.request(`/api/v3/episode?seriesId=${seriesId}&seasonNumber=${seasonNumber}`);
      if (response.status < 200 || response.status > 299 || !Array.isArray(response.body)) return undefined;
      return response.body.flatMap((episode) => (
        isRecord(episode) && episode.seasonNumber === seasonNumber && positiveInteger(episode.id) ? [episode.id] : []
      ));
    } catch {
      return undefined;
    }
  };

  const qualities = async (service: 'sonarr' | 'radarr') => {
    try {
      const response = await services[service].request('/api/v3/qualitydefinition');
      if (response.status < 200 || response.status > 299 || !Array.isArray(response.body)) return undefined;
      return response.body.flatMap((definition) => (
        isRecord(definition) && isRecord(definition.quality) && positiveInteger(definition.quality.id) ? [definition.quality] : []
      ));
    } catch {
      return undefined;
    }
  };

  const qualityFor = async (service: 'sonarr' | 'radarr', qualityId: number, original: unknown) => {
    const quality = (await qualities(service))?.find((item) => item.id === qualityId);
    if (quality === undefined) return undefined;
    const revision = isRecord(original) && isRecord(original.revision) ? original.revision : { version: 1, real: 0, isRepack: false };
    return { quality, revision };
  };

  return {
    read,
    qualities,
    list(target: ReleaseTarget) {
      return database.prepare('SELECT * FROM grabs WHERE searched_for_key = ? OR target_key = ? ORDER BY id DESC LIMIT 20')
        .all(targetKey(target), targetKey(target))
        .map((row) => rowToRecord(row as Record<string, unknown>));
    },
    pending(intent?: GrabIntent) {
      return database.prepare("SELECT * FROM grabs WHERE state = 'sent' AND (? IS NULL OR intent = ?) ORDER BY id")
        .all(intent ?? null, intent ?? null)
        .map((row) => rowToRecord(row as Record<string, unknown>));
    },
    recentTitles(service: 'sonarr' | 'radarr', since: number) {
      return database.prepare("SELECT release_title FROM grabs WHERE service = ? AND created_at >= ? AND state != 'failed'")
        .all(service, since)
        .map((row) => row.release_title as string);
    },
    importing() {
      return database.prepare("SELECT * FROM grabs WHERE state = 'importing' ORDER BY id")
        .all()
        .map((row) => rowToRecord(row as Record<string, unknown>));
    },
    update,
    resolveDownloadId,

    async grab(searchedFor: ReleaseTarget, guid: string, intent: GrabIntent, overrides: Overrides = {}) {
      const release = releases.find(searchedFor, guid);
      if (release === undefined) return { kind: 'unknown_release' } as const;
      const service = services[searchedFor.service];
      if (!service.configured()) return { kind: 'not_configured' } as const;
      const target = overriddenTarget(searchedFor, overrides);
      const createdAt = now();
      // Recorded before sending, so a crash between the two leaves a record to explain the torrent.
      const inserted = database.prepare(`
        INSERT INTO grabs (service, target, target_key, searched_for, searched_for_key, guid, release_title, intent, state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sending', ?, ?)
      `).run(
        searchedFor.service,
        JSON.stringify(target),
        grabTargetKey(target),
        JSON.stringify(searchedFor),
        targetKey(searchedFor),
        guid,
        release.title,
        intent,
        createdAt,
        createdAt,
      );
      const id = Number(inserted.lastInsertRowid);
      options.onChange?.(read(id)!);

      const body: Record<string, unknown> = { guid, indexerId: release.indexerId, downloadAllowed: true };
      if (Object.keys(overrides).length > 0) {
        // An override must carry quality and languages; unchanged ones are the release's own.
        const quality = overrides.qualityId === undefined ? release.qualityModel : await qualityFor(searchedFor.service, overrides.qualityId, release.qualityModel);
        if (quality === undefined) return { kind: 'failed', record: update(id, { state: 'failed', failure: 'That quality is not one this service knows.' }) } as const;
        Object.assign(body, { shouldOverride: true, quality, languages: release.languages });
        // The services require the title with every override, so a quality-only one names the searched target.
        if (target.kind === 'movie') body.movieId = target.movieId;
        else {
          const episodeIds = target.kind === 'episode' ? [target.episodeId]
            : target.kind === 'episodes' ? target.episodeIds
              : await seasonEpisodeIds(target.seriesId, target.seasonNumber);
          if (episodeIds === undefined || episodeIds.length === 0) {
            return { kind: 'failed', record: update(id, { state: 'failed', failure: "Sonarr didn't list this season's episodes." }) } as const;
          }
          Object.assign(body, { seriesId: target.seriesId, episodeIds });
        }
      }

      let response: { status: number; body: unknown };
      try {
        // POST /release ignores the search's rejections; /release/push would drop rejected releases.
        response = await service.request('/api/v3/release', { method: 'POST', body, timeoutMs: GRAB_TIMEOUT_MS });
      } catch {
        return { kind: 'failed', record: update(id, { state: 'failed', failure: `${searchedFor.service === 'sonarr' ? 'Sonarr' : 'Radarr'} didn't answer the grab.` }) } as const;
      }
      if (response.status < 200 || response.status > 299) {
        const label = searchedFor.service === 'sonarr' ? 'Sonarr' : 'Radarr';
        const reason = response.status === 401 || response.status === 403
          ? `${label} refused the API key.`
          : refusal(response.body) ?? `${label} refused the grab (HTTP ${response.status}).`;
        return { kind: 'failed', record: update(id, { state: 'failed', failure: reason }) } as const;
      }
      const sent = update(id, { state: 'sent', failure: null });
      return { kind: 'sent', record: await resolveDownloadId(sent) } as const;
    },
  };
};

export type Grabs = ReturnType<typeof createGrabs>;

export const createGrabRoutes = (grabs: Grabs) => {
  const routes = new Hono();
  routes.get('/', (context) => {
    const query = context.req.query();
    const target = parseTarget({
      kind: query.kind,
      movieId: Number(query.movieId),
      seriesId: Number(query.seriesId),
      episodeId: Number(query.episodeId),
      seasonNumber: query.seasonNumber === undefined ? undefined : Number(query.seasonNumber),
    });
    if (target === undefined) return context.json({ error: 'invalid_request' }, 400);
    return context.json({ grabs: grabs.list(target) });
  });
  routes.post('/', async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    if (!isRecord(body) || Object.keys(body).some((key) => !['target', 'guid', 'intent', 'overrides'].includes(key))) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const target = parseTarget(body.target);
    const { guid, intent } = body;
    if (target === undefined || typeof guid !== 'string' || guid === '' || (intent !== 'grab' && intent !== 'replace')) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const overrides = parseOverrides(body.overrides, target.service);
    if (overrides === undefined) return context.json({ error: 'invalid_request' }, 400);
    const result = await grabs.grab(target, guid, intent, overrides);
    if (result.kind === 'unknown_release') return context.json({ error: 'unknown_release' }, 404);
    if (result.kind === 'not_configured') return context.json({ error: 'not_configured' }, 503);
    if (result.kind === 'failed') return context.json({ error: 'refused', reason: result.record.failure, grab: result.record }, 409);
    return context.json({ grab: result.record }, 201);
  });
  return routes;
};
