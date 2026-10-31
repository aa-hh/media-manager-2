import type { EventHub } from './events.js';
import type { Episode, Movie, Series } from './services/arr.js';
import { isInsideFolder } from './services/connection.js';
import type { createPlex } from './services/plex.js';

type Item = Record<string, unknown>;
type Service = 'sonarr' | 'radarr';
type Off = { kind: 'unavailable' } | { kind: 'off' };

export type TitleWatch =
  | { kind: 'movie'; ratingKey: string; viewOffsetMs: number | null; durationMs: number | null; viewCount: number; lastViewedAt: number | null }
  | { kind: 'show'; ratingKey: string; leafCount: number; viewedLeafCount: number; lastViewedAt: number | null }
  | null;

export type ContinueWatchingItem = {
  service: Service;
  id: number;
  viewOffsetMs: number | null;
  durationMs: number | null;
  lastViewedAt: number | null;
  episode: { seasonNumber: number; episodeNumber: number; title: string | null } | null;
};

export type LibraryWatch = { kind: 'ok'; machineIdentifier: string; continueWatching: ContinueWatchingItem[] } | Off;

type Playable = {
  ratingKey: string;
  mediaIndex: number;
  partId: number;
  versions: Array<{ mediaIndex: number; partId: number; file: string }>;
  viewOffsetMs: number | null;
  durationMs: number | null;
  viewCount: number;
  lastViewedAt: number | null;
};

export type SeriesWatch = {
  kind: 'ok';
  machineIdentifier: string;
  ratingKey: string;
  leafCount: number;
  viewedLeafCount: number;
  nextEpisode: { seasonNumber: number; episodeNumber: number } | null;
  episodes: Record<string, Playable>;
} | null | Off;

export type MovieWatch = ({ kind: 'ok'; machineIdentifier: string } & Playable) | null | Off;

export type WatchStatus = ReturnType<typeof createWatchStatus>;

type Snapshot = {
  machineIdentifier: string;
  maxUploadBitrate: number | null;
  moviesByFile: Map<string, Item>;
  moviesByGuid: Map<string, Item>;
  showsByKey: Map<string, Item>;
  showsByGuid: Map<string, Item>;
  // A file holding several episodes lists one Plex item per episode.
  episodesByFile: Map<string, Item[]>;
  episodesByNumber: Map<string, Item>;
  // Each folder holding a Plex episode file, to its show's ratingKey.
  episodeFolders: Map<string, string>;
  continueWatching: Item[];
};

const CACHE_MS = 60_000;
// Plex webhook events that change what the app shows: a saved position (pause, stop), a watched mark (scrobble), and the
// top of Continue Watching (play). Resume changes nothing a pause did not.
const WATCH_EVENTS = new Set(['media.play', 'media.pause', 'media.stop', 'media.scrobble']);
// A listing this old no longer answers at once, and a failed rebuild no longer keeps it.
const OLD_LISTING_MS = 300_000;
// With no listing, or one OLD_LISTING_MS old, a load holds a page up to this long for the rebuild before falling back to
// the old listing or none; forSeries also waits up to this long for Plex's On Deck episode.
const WATCH_WAIT_MS = 1500;

const isRecord = (value: unknown): value is Item => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const key = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : null);
const media = (item: Item) => (Array.isArray(item.Media) ? item.Media.filter(isRecord) : []);
const partFiles = (item: Item) => media(item).flatMap((entry) => (Array.isArray(entry.Part) ? entry.Part : [])
  .flatMap((part) => (isRecord(part) && typeof part.file === 'string' ? [part.file] : [])));
const guids = (item: Item) => (Array.isArray(item.Guid) ? item.Guid : []).flatMap((guid) => (isRecord(guid) && typeof guid.id === 'string' ? [guid.id] : []));
const episodeNumberKey = (showKey: string, season: unknown, episode: unknown) => `${showKey}/${key(season)}/${key(episode)}`;
const progress = (item: Item) => ({ viewOffsetMs: num(item.viewOffset), durationMs: num(item.duration), lastViewedAt: num(item.lastViewedAt) });

// The tallest version plays by default, the higher bitrate breaking a tie; every version stays listed.
const playable = (item: Item): Playable | null => {
  const ratingKey = key(item.ratingKey);
  const versions = (Array.isArray(item.Media) ? item.Media : []).flatMap((entry, mediaIndex) => {
    const part = isRecord(entry) && Array.isArray(entry.Part) ? entry.Part[0] : undefined;
    return isRecord(entry) && isRecord(part) && typeof part.id === 'number' && typeof part.file === 'string'
      ? [{ mediaIndex, partId: part.id, file: part.file, height: num(entry.height) ?? 0, bitrate: num(entry.bitrate) ?? 0 }]
      : [];
  });
  const best = versions.reduce<(typeof versions)[number] | undefined>((top, version) => (
    top === undefined || version.height > top.height || (version.height === top.height && version.bitrate > top.bitrate) ? version : top
  ), undefined);
  if (ratingKey === null || best === undefined) return null;
  return {
    ratingKey,
    mediaIndex: best.mediaIndex,
    partId: best.partId,
    versions: versions.map(({ mediaIndex, partId, file }) => ({ mediaIndex, partId, file })),
    ...progress(item),
    viewCount: num(item.viewCount) ?? 0,
  };
};

// Plex watch marks for library titles, from one in-memory listing of every Plex movie and show library, kept 60 seconds
// or until Plex's webhook says something was played, paused, stopped or watched.
// Its reads never throw: a Plex that fails with no listing under 5 minutes old reads as unavailable, a Jellyfin owner or
// unset Plex as off. ensureWebhook throws when plex.tv refuses.
export const createWatchStatus = ({ plex, enabled, now, events, webhookUrl, sleep = (ms) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }) }: {
  plex: ReturnType<typeof createPlex>;
  enabled: () => boolean;
  now: () => number;
  events: Pick<EventHub, 'publish'>;
  /** This server's Plex webhook address, secret included; undefined until the address and secret are saved. */
  webhookUrl: () => string | undefined;
  sleep?: (ms: number) => Promise<void>;
}) => {
  const capped = <T>(work: Promise<T>) => Promise.race([work, sleep(WATCH_WAIT_MS).then(() => undefined)]);
  const build = async (): Promise<Snapshot> => {
    const [identity, sections, continueWatching] = await Promise.all([plex.identity(), plex.sections(), plex.continueWatching()]);
    const lists = await Promise.all(sections.flatMap((section) => (section.type === 'movie'
      ? [plex.listItems(section.id, 1).then((items) => ({ type: 1, items }))]
      : [plex.listItems(section.id, 2).then((items) => ({ type: 2, items })), plex.listItems(section.id, 4).then((items) => ({ type: 4, items }))])));
    const snapshot: Snapshot = {
      ...identity,
      moviesByFile: new Map(),
      moviesByGuid: new Map(),
      showsByKey: new Map(),
      showsByGuid: new Map(),
      episodesByFile: new Map(),
      episodesByNumber: new Map(),
      episodeFolders: new Map(),
      continueWatching,
    };
    for (const { type, items } of lists) {
      for (const item of items) {
        if (type === 1) {
          for (const file of partFiles(item)) snapshot.moviesByFile.set(file, item);
          for (const guid of guids(item)) snapshot.moviesByGuid.set(guid, item);
        } else if (type === 2) {
          const showKey = key(item.ratingKey);
          if (showKey !== null) snapshot.showsByKey.set(showKey, item);
          for (const guid of guids(item)) snapshot.showsByGuid.set(guid, item);
        } else {
          const showKey = key(item.grandparentRatingKey);
          for (const file of partFiles(item)) {
            snapshot.episodesByFile.set(file, [...(snapshot.episodesByFile.get(file) ?? []), item]);
            const folder = file.slice(0, Math.max(file.lastIndexOf('/'), 0));
            if (showKey !== null && !snapshot.episodeFolders.has(folder)) snapshot.episodeFolders.set(folder, showKey);
          }
          if (showKey !== null) snapshot.episodesByNumber.set(episodeNumberKey(showKey, item.parentIndex, item.index), item);
        }
      }
    }
    return snapshot;
  };

  // One rebuild at a time, and every attempt, failed or not, restarts the 60 seconds, so Plex is asked at most once per
  // CACHE_MS besides the rebuilds Plex's webhook asks for. A listing under OLD_LISTING_MS old, counted from when it was built, answers at once while the next one
  // builds in the background; on purpose, a Resume or the first title page after an import within 5 minutes of the last
  // listing can still use that listing. With no listing, or one OLD_LISTING_MS old, a load waits up to WATCH_WAIT_MS for
  // the rebuild and falls back to the old listing only when that wait runs out, which is not cached as a failure. A
  // failed rebuild keeps the old listing only while it is under OLD_LISTING_MS old; after that Plex reads as unavailable.
  let cached: { at: number; builtAt: number; value: Snapshot | undefined } | undefined;
  let building: Promise<Snapshot | undefined> | undefined;
  const recent = () => (cached !== undefined && now() - cached.builtAt < OLD_LISTING_MS ? cached.value : undefined);
  const rebuild = () => (building ??= build().catch(() => undefined).then((value) => {
    const at = now();
    cached = value === undefined ? { at, builtAt: cached?.builtAt ?? at, value: recent() } : { at, builtAt: at, value };
    building = undefined;
    return value;
  }));
  const snapshot = async (): Promise<Snapshot | undefined> => {
    if (cached !== undefined && now() - cached.at < CACHE_MS) return recent();
    const pending = rebuild();
    return recent() ?? (await capped(pending)) ?? cached?.value;
  };

  const matchMovie = (found: Snapshot, movie: Movie) => (
    (movie.file?.path == null ? undefined : found.moviesByFile.get(movie.file.path))
      ?? (movie.tmdbId === null ? undefined : found.moviesByGuid.get(`tmdb://${movie.tmdbId}`))
      ?? (movie.imdbId === null ? undefined : found.moviesByGuid.get(`imdb://${movie.imdbId}`))
  );

  const matchShow = (found: Snapshot, series: Series) => {
    let showKey: string | undefined;
    if (series.path !== null) {
      const root = series.path.replace(/\/+$/, '');
      for (const [folder, candidate] of found.episodeFolders) {
        if (folder.startsWith(root) && isInsideFolder(series.path, folder)) {
          showKey = candidate;
          break;
        }
      }
    }
    return (showKey === undefined ? undefined : found.showsByKey.get(showKey))
      ?? (series.tvdbId === null ? undefined : found.showsByGuid.get(`tvdb://${series.tvdbId}`));
  };

  const start = async (): Promise<Off | Snapshot> => {
    if (!enabled()) return { kind: 'off' };
    return (await snapshot()) ?? { kind: 'unavailable' };
  };
  const isOff = (value: Off | Snapshot): value is Off => 'kind' in value;

  return {
    /**
     * Plex's webhook, from any device. For an event in WATCH_EVENTS the listing is read again, then open pages hear the
     * show's or movie's ratingKey in a 'watch' event and read their watch status again.
     */
    receiveWebhook(payload: unknown): 'ok' | 'ignored' | 'invalid' {
      if (!isRecord(payload) || typeof payload.event !== 'string') return 'invalid';
      if (!WATCH_EVENTS.has(payload.event)) return 'ignored';
      const item = isRecord(payload.Metadata) ? payload.Metadata : undefined;
      const ratingKey = key(item?.type === 'episode' ? item.grandparentRatingKey : item?.type === 'movie' ? item.ratingKey : undefined);
      if (ratingKey === null || !enabled()) return 'ignored';
      // A listing already under way may predate the change, so a new one follows it, uncapped: pages read only once it is
      // in. A failed listing tells no page, so none swaps its marks for the failure.
      void Promise.resolve(building).then(rebuild).then((value) => {
        if (value !== undefined) events.publish('watch', { ratingKey });
      });
      return 'ok';
    },

    /**
     * Keeps this server's webhook on the owner's plex.tv list, replacing an older one of ours at the same address (a new
     * secret); webhooks other apps added stay. False while the address or secret is unsaved, or Plex is off.
     */
    async ensureWebhook() {
      const url = webhookUrl();
      if (url === undefined || !enabled()) return false;
      const ours = url.slice(0, url.lastIndexOf('/') + 1);
      const listed = await plex.webhooks();
      const mine = listed.filter((entry) => entry.startsWith(ours));
      if (mine.length !== 1 || mine[0] !== url) await plex.setWebhooks([...listed.filter((entry) => !entry.startsWith(ours)), url]);
      return true;
    },

    async forLibrary(records: Array<{ service: Service; record: Series | Movie }>): Promise<{ watch: LibraryWatch; byTitle: Map<string, TitleWatch> }> {
      const byTitle = new Map<string, TitleWatch>();
      const found = await start();
      if (isOff(found)) return { watch: found, byTitle };
      const movies = new Map<string, number>();
      const shows = new Map<string, number>();
      for (const { service, record } of records) {
        if (record.id === null) continue;
        const item = service === 'sonarr' ? matchShow(found, record as Series) : matchMovie(found, record as Movie);
        const ratingKey = item === undefined ? null : key(item.ratingKey);
        if (item === undefined || ratingKey === null) continue;
        if (service === 'sonarr') {
          shows.set(ratingKey, record.id);
          byTitle.set(`sonarr:${record.id}`, {
            kind: 'show',
            ratingKey,
            leafCount: num(item.leafCount) ?? 0,
            viewedLeafCount: num(item.viewedLeafCount) ?? 0,
            lastViewedAt: num(item.lastViewedAt),
          });
        } else {
          movies.set(ratingKey, record.id);
          byTitle.set(`radarr:${record.id}`, { kind: 'movie', ratingKey, ...progress(item), viewCount: num(item.viewCount) ?? 0 });
        }
      }
      const continueWatching = found.continueWatching.flatMap((item): ContinueWatchingItem[] => {
        const episode = item.type === 'episode';
        const id = episode ? shows.get(key(item.grandparentRatingKey) ?? '') : movies.get(key(item.ratingKey) ?? '');
        if (id === undefined) return [];
        const season = num(item.parentIndex);
        const number = num(item.index);
        return [{
          service: episode ? 'sonarr' : 'radarr',
          id,
          ...progress(item),
          episode: episode && season !== null && number !== null
            ? { seasonNumber: season, episodeNumber: number, title: typeof item.title === 'string' ? item.title : null }
            : null,
        }];
      });
      return { watch: { kind: 'ok', machineIdentifier: found.machineIdentifier, continueWatching }, byTitle };
    },

    async forSeries(record: Series, episodes: Episode[]): Promise<SeriesWatch> {
      const found = await start();
      if (isOff(found)) return found;
      const show = matchShow(found, record);
      const showKey = show === undefined ? null : key(show.ratingKey);
      if (show === undefined || showKey === null) return null;
      const next = await capped(plex.onDeck(showKey).catch(() => undefined));
      const nextSeason = next === undefined ? null : num(next.parentIndex);
      const nextEpisode = next === undefined ? null : num(next.index);
      return {
        kind: 'ok',
        machineIdentifier: found.machineIdentifier,
        ratingKey: showKey,
        leafCount: num(show.leafCount) ?? 0,
        viewedLeafCount: num(show.viewedLeafCount) ?? 0,
        nextEpisode: nextSeason === null || nextEpisode === null ? null : { seasonNumber: nextSeason, episodeNumber: nextEpisode },
        episodes: Object.fromEntries(episodes.flatMap((episode) => {
          const shared = episode.file?.path == null ? undefined : found.episodesByFile.get(episode.file.path);
          const item = shared?.find((entry) => entry.parentIndex === episode.seasonNumber && entry.index === episode.episodeNumber)
            ?? shared?.[0]
            ?? found.episodesByNumber.get(episodeNumberKey(showKey, episode.seasonNumber, episode.episodeNumber));
          const value = item === undefined ? null : playable(item);
          return value === null ? [] : [[String(episode.id), value]];
        })),
      };
    },

    async forMovie(record: Movie): Promise<MovieWatch> {
      const found = await start();
      if (isOff(found)) return found;
      const item = matchMovie(found, record);
      const value = item === undefined ? null : playable(item);
      return value === null ? null : { kind: 'ok', machineIdentifier: found.machineIdentifier, ...value };
    },
  };
};
