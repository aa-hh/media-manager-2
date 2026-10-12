// A Sonarr or Radarr stand-in that keeps its Queue, History, Blocklist, series, movies and episodes in memory, so tests assert on what the state became.
import { createArr } from '../../dist/server/services/arr.js';
import { setSetting } from '../../dist/server/settings.js';

let nextId = 0;
const newId = () => {
  nextId += 1;
  return nextId;
};

export const queueItem = (overrides = {}) => {
  const id = newId();
  return {
    id,
    downloadId: null,
    movieId: null,
    seriesId: null,
    episodeId: null,
    title: `Item ${id}`,
    status: 'downloading',
    trackedDownloadStatus: 'ok',
    trackedDownloadState: 'downloading',
    statusMessages: [],
    protocol: 'torrent',
    ...overrides,
  };
};

export const historyRecord = (overrides = {}) => ({
  id: newId(),
  eventType: 'grabbed',
  date: '2026-10-08T12:00:00Z',
  downloadId: null,
  movieId: null,
  seriesId: null,
  episodeId: null,
  sourceTitle: '',
  data: {},
  ...overrides,
});

export const blocklistRecord = (overrides = {}) => ({ id: newId(), date: '2026-10-08T12:00:00Z', sourceTitle: '', ...overrides });

export const importFile = (overrides = {}) => ({
  path: `/downloads/file-${newId()}.mkv`,
  quality: { quality: { id: 3, name: 'WEBDL-1080p' } },
  languages: [],
  episodes: [],
  rejections: [],
  ...overrides,
});

export const seriesRecord = (overrides = {}) => {
  const id = overrides.id ?? newId();
  return { id, title: `Series ${id}`, year: 2024, monitored: true, tags: [], images: [], seasons: [], ...overrides };
};

export const movieRecord = (overrides = {}) => {
  const id = overrides.id ?? newId();
  return { id, title: `Movie ${id}`, year: 2024, monitored: true, hasFile: false, tags: [], images: [], ...overrides };
};

export const episodeRecord = (overrides = {}) => {
  const id = overrides.id ?? newId();
  return { id, seriesId: null, seasonNumber: 1, episodeNumber: id, title: `Episode ${id}`, monitored: true, hasFile: false, ...overrides };
};

const eventTypes = { 1: 'grabbed', 3: 'downloadFolderImported', 4: 'downloadFailed' };

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const idList = (params, name) => (params.has(name) ? params.get(name).split(',').map(Number) : undefined);

export const createArrFake = ({ apiKey = 'test-key', pageSize = 10 } = {}) => {
  const state = {
    queue: [],
    history: [],
    blocklist: [],
    commands: [],
    grabbed: [],
    removals: [],
    failed: [],
    // Import lists as Sonarr and Radarr return them; the delete routes read whether any adds titles by itself.
    importLists: [],
    erasedFromClient: [],
    manualImport: {},
    series: [],
    movies: [],
    episodes: [],
    episodeFiles: [],
    lookup: [],
    copyUsingHardlinks: true,
    down: false,
  };
  const routes = [];
  const requests = [];

  const paged = (params, records) => {
    const page = Number(params.get('page') ?? 1);
    const size = Number(params.get('pageSize') ?? pageSize);
    return {
      status: 200,
      body: { page, pageSize: size, totalRecords: records.length, records: records.slice((page - 1) * size, page * size) },
    };
  };

  // Series and movies share one shape: a list, a lookup, a record by id, an add, a whole-record PUT and an editor PUT.
  const titleRoute = (method, path, body, resource, records, idsKey) => {
    const base = `/api/v3/${resource}`;
    const id = Number(path.split('/').at(-1));
    if (method === 'GET' && path === base) return { status: 200, body: records() };
    if (method === 'GET' && path === `${base}/lookup`) return { status: 200, body: state.lookup };
    if (method === 'POST' && path === base) {
      const added = { ...body, id: newId() };
      records().push(added);
      return { status: 201, body: added };
    }
    if (method === 'PUT' && path === `${base}/editor`) {
      const changed = records().filter((record) => body[idsKey].includes(record.id));
      for (const record of changed) record.monitored = body.monitored;
      return { status: 202, body: changed };
    }
    if (!new RegExp(`^${base}/-?\\d+$`).test(path)) return undefined;
    const index = records().findIndex((record) => record.id === id);
    if (index === -1) return undefined;
    if (method === 'GET') return { status: 200, body: records()[index] };
    if (method === 'PUT') {
      // Sonarr sets every episode of a season whose monitored flag the PUT changes to match it.
      for (const season of resource === 'series' ? body.seasons ?? [] : []) {
        const before = (records()[index].seasons ?? []).find((old) => old.seasonNumber === season.seasonNumber);
        if (before === undefined || before.monitored === season.monitored) continue;
        for (const episode of state.episodes) if (episode.seriesId === id && episode.seasonNumber === season.seasonNumber) episode.monitored = season.monitored;
      }
      records()[index] = body;
      return { status: 202, body };
    }
    return undefined;
  };

  const builtIn = (method, url, body) => {
    const { pathname: path, searchParams: params } = url;
    const id = Number(path.split('/').at(-1));
    if (method === 'GET' && path === '/api/v3/system/status') return { status: 200, body: { version: '4.0.0.0' } };
    if (path.startsWith('/api/v3/series')) return titleRoute(method, path, body, 'series', () => state.series, 'seriesIds');
    if (path.startsWith('/api/v3/movie')) return titleRoute(method, path, body, 'movie', () => state.movies, 'movieIds');
    if (method === 'GET' && path === '/api/v3/episode') {
      const seriesId = Number(params.get('seriesId'));
      const season = params.has('seasonNumber') ? Number(params.get('seasonNumber')) : undefined;
      return {
        status: 200,
        body: state.episodes.filter((episode) => episode.seriesId === seriesId && (season === undefined || episode.seasonNumber === season)),
      };
    }
    if (method === 'GET' && path === '/api/v3/episodefile') {
      return { status: 200, body: state.episodeFiles.filter((file) => file.seriesId === Number(params.get('seriesId'))) };
    }
    if (method === 'GET' && /^\/api\/v3\/episode\/-?\d+$/.test(path)) {
      const episode = state.episodes.find((record) => record.id === id);
      if (episode === undefined) return undefined;
      const series = state.series.find((record) => record.id === episode.seriesId);
      return { status: 200, body: series === undefined ? episode : { ...episode, series } };
    }
    if (method === 'PUT' && path === '/api/v3/episode/monitor') {
      const changed = state.episodes.filter((episode) => body.episodeIds.includes(episode.id));
      for (const episode of changed) episode.monitored = body.monitored;
      return { status: 202, body: changed };
    }
    if (method === 'GET' && path === '/api/v3/queue') {
      const unknown = params.get('includeUnknownSeriesItems') === 'true' || params.get('includeUnknownMovieItems') === 'true';
      const items = state.queue
        .filter((item) => unknown || item.unknown !== true)
        .map(({ unknown: _unknown, ...item }) => ({ ...item, downloadId: typeof item.downloadId === 'string' ? item.downloadId.toUpperCase() : item.downloadId }));
      return paged(params, items);
    }
    if (method === 'DELETE' && /^\/api\/v3\/queue\/-?\d+$/.test(path)) {
      const index = state.queue.findIndex((item) => item.id === id);
      if (index === -1) return undefined;
      const [item] = state.queue.splice(index, 1);
      const removal = {
        queueId: id,
        removeFromClient: params.get('removeFromClient') === 'true',
        blocklist: params.get('blocklist') === 'true',
        skipRedownload: params.get('skipRedownload') === 'true',
      };
      state.removals.push(removal);
      if (removal.blocklist) state.blocklist.push({ id: newId(), date: new Date().toISOString(), sourceTitle: item.title });
      if (removal.removeFromClient) state.erasedFromClient.push(item.downloadId);
      return { status: 200, body: {} };
    }
    if (method === 'POST' && /^\/api\/v3\/queue\/grab\/-?\d+$/.test(path)) {
      if (!state.queue.some((item) => item.id === id)) return undefined;
      state.grabbed.push(id);
      return { status: 200, body: {} };
    }
    if (method === 'GET' && path === '/api/v3/history') {
      const downloadId = params.get('downloadId')?.toUpperCase();
      const eventType = params.has('eventType') ? eventTypes[params.get('eventType')] : undefined;
      const episodeId = params.has('episodeId') ? Number(params.get('episodeId')) : undefined;
      const seriesIds = idList(params, 'seriesIds');
      const movieIds = idList(params, 'movieIds');
      const records = state.history
        .filter((record) => downloadId === undefined || record.downloadId?.toUpperCase() === downloadId)
        .filter((record) => eventType === undefined || record.eventType === eventType)
        .filter((record) => episodeId === undefined || record.episodeId === episodeId)
        .filter((record) => seriesIds === undefined || seriesIds.includes(record.seriesId))
        .filter((record) => movieIds === undefined || movieIds.includes(record.movieId))
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .map(({ series, episode, movie, ...record }) => ({
          ...record,
          ...(params.get('includeSeries') === 'true' && series !== undefined ? { series } : {}),
          ...(params.get('includeEpisode') === 'true' && episode !== undefined ? { episode } : {}),
          ...(params.get('includeMovie') === 'true' && movie !== undefined ? { movie } : {}),
        }));
      return paged(params, records);
    }
    if (method === 'GET' && path === '/api/v3/history/since') {
      const since = Date.parse(params.get('date'));
      const eventType = params.get('eventType');
      return {
        status: 200,
        body: state.history.filter((record) => Date.parse(record.date) >= since && (eventType === null || record.eventType === eventType)),
      };
    }
    if (method === 'GET' && path === '/api/v3/history/series') {
      const seriesId = Number(params.get('seriesId'));
      const season = params.has('seasonNumber') ? Number(params.get('seasonNumber')) : undefined;
      return {
        status: 200,
        body: state.history.filter((record) => record.seriesId === seriesId && (season === undefined || record.episode?.seasonNumber === season)),
      };
    }
    if (method === 'GET' && path === '/api/v3/history/movie') {
      const movieId = Number(params.get('movieId'));
      return { status: 200, body: state.history.filter((record) => record.movieId === movieId) };
    }
    if (method === 'POST' && /^\/api\/v3\/history\/failed\/\d+$/.test(path)) {
      if (!state.history.some((record) => record.id === id)) return undefined;
      state.failed.push(id);
      return { status: 200, body: {} };
    }
    if (method === 'GET' && path === '/api/v3/importlist') return { status: 200, body: state.importLists };
    if (method === 'POST' && path === '/api/v3/command') {
      state.commands.push(body);
      return { status: 201, body: { id: state.commands.length, name: body.name } };
    }
    if (method === 'GET' && path === '/api/v3/manualimport') {
      return { status: 200, body: state.manualImport[(params.get('downloadId') ?? '').toUpperCase()] ?? [] };
    }
    if (method === 'GET' && path === '/api/v3/config/mediamanagement') {
      return { status: 200, body: { copyUsingHardlinks: state.copyUsingHardlinks } };
    }
    if (method === 'GET' && path === '/api/v3/blocklist') {
      const seriesIds = idList(params, 'seriesIds');
      return paged(params, state.blocklist.filter((record) => seriesIds === undefined || seriesIds.includes(record.seriesId)));
    }
    if (method === 'GET' && path === '/api/v3/blocklist/movie') {
      const movieId = Number(params.get('movieId'));
      return { status: 200, body: state.blocklist.filter((record) => record.movieId === movieId) };
    }
    if (method === 'DELETE' && /^\/api\/v3\/blocklist\/\d+$/.test(path)) {
      const index = state.blocklist.findIndex((record) => record.id === id);
      if (index !== -1) state.blocklist.splice(index, 1);
      return { status: 200, body: {} };
    }
    return undefined;
  };

  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, path: url.pathname, params: url.searchParams, body });
    if (state.down) throw new TypeError('fetch failed');
    if (new Headers(init.headers).get('X-Api-Key') !== apiKey) return json(401, { message: 'Unauthorized' });
    for (const route of routes) {
      const answer = await route(method, url, body);
      if (answer !== undefined) return json(answer.status, answer.body);
    }
    const answer = builtIn(method, url, body);
    return answer === undefined ? json(404, { message: 'NotFound' }) : json(answer.status, answer.body);
  };

  return { state, routes, requests, fetch };
};

export const connectArr = (database, which = { sonarr: {}, radarr: {} }) => {
  const fake = {};
  for (const [service, port] of [['sonarr', 65201], ['radarr', 65202]]) {
    const options = which[service] ?? {};
    fake[service] = createArrFake(options);
    if (which[service] !== undefined) {
      setSetting(database, 'serviceAddresses', `${service}.url`, `http://127.0.0.1:${port}`);
      setSetting(database, 'credentials', `${service}.apiKey`, options.apiKey ?? 'test-key');
    }
  }
  return {
    sonarr: createArr('sonarr', database, { fetch: fake.sonarr.fetch }),
    radarr: createArr('radarr', database, { fetch: fake.radarr.fetch }),
    fake,
  };
};
