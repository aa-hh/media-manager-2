// Shapes served by /api/library; src/server/library.ts is the source of truth.
export type Service = 'sonarr' | 'radarr';

export type Outcome = { kind: 'ok'; count: number } | { kind: 'not_configured' | 'unreachable' | 'rejected' };

export type LibraryTitle = {
  type: 'tv' | 'movie';
  service: Service;
  id: number;
  title: string;
  year: number | null;
  added: string | null;
  monitored: boolean;
  status: string | null;
  posterUrl: string | null;
  qualityProfile: string | null;
  sizeOnDisk: number;
  tv: { episodeFileCount: number; episodeCount: number; totalEpisodeCount: number; seasonCount: number } | null;
  movie: { hasFile: boolean; isAvailable: boolean } | null;
};

export type FileDetail = {
  id: number;
  relativePath: string | null;
  size: number;
  dateAdded: string | null;
  quality: string | null;
  revision: { version: number; real: number; isRepack: boolean };
  releaseGroup: string | null;
  languages: string[];
  customFormats: string[];
  customFormatScore: number;
  qualityCutoffNotMet: boolean;
  mediaInfo: {
    videoCodec: string | null;
    videoDynamicRangeType: string | null;
    resolution: string | null;
    audioCodec: string | null;
    audioChannels: number | null;
    audioLanguages: string | null;
    subtitles: string | null;
  } | null;
};

export type EpisodeDetail = {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string | null;
  monitored: boolean;
  hasFile: boolean;
  overview: string | null;
  runtime: number | null;
  finaleType: string | null;
  absoluteEpisodeNumber: number | null;
  sceneSeasonNumber: number | null;
  sceneEpisodeNumber: number | null;
  unverifiedSceneNumbering: boolean;
  lastSearchTime: string | null;
  imageUrl: string | null;
  file: FileDetail | null;
};

type Profile = { id: number; name: string; cutoff: string | null } | null;

/** One rating site's score as the site gives it, or null when the site has none. */
type SiteRating = { value: number; votes: number } | null;

export type SeriesDetail = {
  id: number;
  title: string;
  alternateTitles: string[];
  year: number | null;
  status: string | null;
  ended: boolean;
  airTime: string | null;
  firstAired: string | null;
  lastAired: string | null;
  nextAiring: string | null;
  previousAiring: string | null;
  network: string | null;
  language: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  /** Sonarr's one rating, out of 10; the server does not say which site it comes from. */
  rating: number | null;
  ratingVotes: number | null;
  certification: string | null;
  genres: string[];
  runtime: number | null;
  path: string | null;
  tags: string[];
  links: { imdbId: string | null; tvdbId: number | null; tmdbId: number | null };
  monitored: boolean;
  monitorNewItems: string | null;
  qualityProfile: Profile;
  added: string | null;
  statistics: { seasonCount: number; episodeFileCount: number; episodeCount: number; totalEpisodeCount: number; sizeOnDisk: number };
  seasons: Array<{
    seasonNumber: number;
    monitored: boolean;
    posterUrl: string | null;
    statistics: { episodeFileCount: number; episodeCount: number; totalEpisodeCount: number; sizeOnDisk: number; nextAiring: string | null; previousAiring: string | null };
  }>;
  episodes: EpisodeDetail[];
  /** Only on a series already in the library. */
  secondVersions?: SecondVersion[];
  /** Only on a series already in the library. */
  trackedHitAndRun?: TrackedHitAndRun[];
};

export type MovieDetail = {
  id: number;
  title: string;
  originalLanguage: string | null;
  alternateTitles: string[];
  year: number | null;
  status: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  /** IMDb, TMDB and Trakt score out of 10; Rotten Tomatoes and Metacritic out of 100. */
  ratings: Record<'imdb' | 'tmdb' | 'metacritic' | 'rottenTomatoes' | 'trakt', SiteRating>;
  keywords: string[];
  youTubeTrailerId: string | null;
  certification: string | null;
  genres: string[];
  runtime: number | null;
  studio: string | null;
  collection: string | null;
  collectionTmdbId: number | null;
  path: string | null;
  tags: string[];
  links: { imdbId: string | null; tmdbId: number | null };
  monitored: boolean;
  hasFile: boolean;
  isAvailable: boolean;
  minimumAvailability: string | null;
  qualityProfile: Profile;
  added: string | null;
  lastSearchTime: string | null;
  sizeOnDisk: number;
  releaseDates: { inCinemas: string | null; digital: string | null; physical: string | null };
  file: FileDetail | null;
};

/** Only a movie already in the library comes with credits; crew jobs use TMDB names, such as Director, Screenplay, Novel, Producer. */
export type Credits = {
  cast: Array<{ name: string; character: string | null; order: number | null; photoUrl: string | null; tmdbId: number | null }>;
  crew: Array<{ name: string; job: string | null; department: string | null; photoUrl: string | null; tmdbId: number | null }>;
};
export type OwnedMovieDetail = MovieDetail & { credits: Credits; secondVersions: SecondVersion[]; trackedHitAndRun: TrackedHitAndRun[] };

/** The tracker rule against each imported grab's torrent, newest import first; src/server/secondVersionRows.ts is the source of truth. */
export type TrackedHitAndRun = { episodeIds: number[]; hitAndRun: NonNullable<SecondVersion['hitAndRun']> };

/** A version media-manager-2 grabbed next to the tracked one; src/server/secondVersionRows.ts is the source of truth. */
export type SecondVersion = {
  id: number;
  service: Service;
  movieId: number | null;
  seriesId: number | null;
  episodeId: number | null;
  state: 'sending' | 'downloading' | 'importing' | 'imported' | 'failed';
  failure: string | null;
  failureCode: 'download_link_failed' | 'not_a_torrent' | 'already_in_rtorrent' | 'rtorrent_refused' | 'send_unconfirmed'
    | 'grabbed_by_arr' | 'never_received' | 'stalled_removed' | 'import_no_name' | 'import_no_match' | 'import_link_failed' | 'torrent_gone' | null;
  releaseTitle: string;
  indexer: string;
  quality: string;
  group: string | null;
  sizeBytes: number | null;
  /** Milliseconds since 1970. */
  addedAt: number;
  importedAt: number | null;
  hash: string | null;
  path: string | null;
  percent: number | null;
  /** From the last rTorrent poll; null when media-manager-2 has never seen the torrent. */
  seeding: { inRtorrent: boolean; complete: boolean; ratio: number; seedingSeconds: number; upRate: number; trackerHost: string | null } | null;
  /** The tracker's bare rule, without the removal advice's margins; null when the torrent is gone, unsized or its tracker has no rule. */
  hitAndRun: { host: string; requiredHours: number | null; seededHours: number; ratio: number; requiredRatio: number | null; met: boolean } | null;
  /** The stall check flagged it while downloading and kept it in rTorrent. */
  stalled: boolean;
  /** Seconds left at the last download rate; null unless downloading. */
  etaSeconds: number | null;
};

/** GET /api/advice/:hash; src/server/advice.ts is the source of truth. */
export type RemovalAdvice = {
  recommendation: 'safe' | 'keep' | 'unconfirmed';
  reason: string;
  globalRatio: string | null;
  host: string | null;
  /** Includes the advice's margin; null when no seed time applies. */
  requiredHours: number | null;
  /** The tracker's own seed-time rule, without the margin; null whenever `requiredHours` is. */
  ruleHours: number | null;
  /** Null when the torrent is not in rTorrent. */
  seededHours: number | null;
  /** 0 once the rule is met; null when no seed time applies or the torrent is incomplete. */
  hoursLeft: number | null;
  /** `reason` without its verdict prefix. */
  detail: string;
};

/** DELETE /api/second-versions/:id reply; src/server/secondVersionDelete.ts is the source of truth. */
export type SecondVersionDeleted = {
  deleted: { path: string } | null;
  torrent: { removed: true } | { removed: false; reason: string };
  secondVersions: SecondVersion[];
};

/** GET /api/library/{movie|series}/:id/delete-plan; src/server/titleDelete.ts is the source of truth. */
export type RemovalCheck = { allowed: true } | { allowed: false; reason: string };
export type DeletePlan = {
  service: Service;
  id: number;
  title: string;
  /** Set when Sonarr or Radarr moves deleted files to a recycle bin, so no space is freed until it is emptied. */
  recycleBin: string | null;
  files: Array<{
    fileId: number;
    path: string;
    sizeBytes: number;
    state: 'linked' | 'copied' | 'none' | 'unknown';
    hashes: string[];
    /** The "Can't link this file to a torrent" line, when no torrent is proven to hold it. */
    note: string | null;
    reason: string | null;
  }>;
  torrents: Array<{
    hash: string;
    name: string;
    sizeBytes: number;
    /** Imported for this title once, but no longer holding any of its files. */
    upgradedAway: boolean;
    label: 'imported by copy' | null;
    libraryPaths: string[];
    advice: RemovalAdvice;
    removal: RemovalCheck;
    ticked: false;
  }>;
  secondVersions: Array<SecondVersion & { ticked: true; torrent: { hash: string; advice: RemovalAdvice; removal: RemovalCheck } | null }>;
  // The fields below arrive one server ticket at a time (AA-125 to AA-129); absent until then, so read them defensively.
  /** What this target allows; `remove` only for a whole movie or show. Absent means the server still takes the older request. */
  modes?: DeleteMode[];
  /** The service has an enabled import list. */
  importLists?: boolean;
  /** Selection target only. */
  selection?: { seasons: number[]; episodeIds: number[] } | null;
  monitoring?: {
    /** Null for a movie. */
    followsNewSeasons: boolean | null;
    /** Selected seasons with episodes not yet aired; the owner must answer for each. */
    airingSeasons: number[];
    leavesShowEmpty: boolean;
  };
  /** Downloads in the queue for what is being deleted. */
  queue?: Array<{
    downloadId: string;
    title: string;
    /** 0 to 1. */
    progress: number;
    status: string;
    episodeIds: number[];
    /** Null when nothing has downloaded yet. */
    advice: RemovalAdvice | null;
    removable: RemovalCheck;
  }>;
};
export type DeletePlanTorrent = DeletePlan['torrents'][number];
export type DeletePlanVersion = DeletePlan['secondVersions'][number];
export type DeletePlanDownload = NonNullable<DeletePlan['queue']>[number];
export type DeleteMode = 'remove' | 'keepUnmonitored' | 'searchAgain';
export type QueueAction = 'leave' | 'remove' | 'removeWithTorrent';

/**
 * POST .../delete body. Before the server sends `modes`, only `mode` (a movie only), `removeTorrents` and `secondVersions` are sent.
 * Once it does, every key but the selection's is required and an unknown or missing key is a 400.
 */
export type DeleteChoices = {
  mode?: DeleteMode;
  excludeFromImportLists?: boolean;
  blocklistCurrent?: boolean;
  /** One entry per airing season, keyed by season number. */
  keepFollowing?: Record<string, boolean>;
  queue?: Array<{ downloadId: string; action: QueueAction }>;
  removeTorrents: string[];
  secondVersions: Array<{ id: number; removeTorrent: boolean }>;
  /** Selection target only: the same seasons and episodes the plan was read with. */
  seasons?: number[];
  episodeIds?: number[];
};

type StepOutcome = 'done' | 'failed' | 'skipped';
export type DeleteStep =
  | { step: 'map' | 'unmonitor' | 'delete' | 'wait' | 'history'; outcome: StepOutcome; message: string }
  | { step: 'torrents'; outcome: StepOutcome; message: string; torrents: Array<{ hash: string; name: string; removed: boolean; reason: string | null }> }
  | { step: 'secondVersions'; outcome: StepOutcome; message: string; secondVersions: Array<{ id: number; deleted: boolean; torrentRemoved: boolean; reason: string | null }> }
  | { step: 'queue'; outcome: StepOutcome; message: string; queue: Array<{ downloadId: string; title: string; removed: boolean; torrentRemoved: boolean; reason: string | null }> }
  | { step: 'blocklist' | 'search' | 'exclusion'; outcome: StepOutcome; message: string }
  | { step: 'monitoring'; outcome: StepOutcome; message: string; monitoring: DeleteMonitoring };
/** What Sonarr or Radarr monitors after the delete, read back from it. */
export type DeleteMonitoring =
  | { kind: 'movie'; monitored: boolean }
  | { kind: 'series'; monitored: boolean; monitorNewItems: string | null;
      seasons: Array<{ seasonNumber: number; monitored: boolean; monitoredEpisodes: number; episodes: number }> };
/** The 200 reply of the delete; `deleted` is false when Sonarr or Radarr refused and nothing else ran. */
export type DeleteRan = { deleted: boolean; steps: DeleteStep[] };

export type HistoryEntry = {
  at: string | null;
  eventType: string;
  sourceTitle: string | null;
  quality: string | null;
  detail: string;
};

export type CalendarEntry =
  | {
    service: 'sonarr';
    kind: 'episode';
    id: number;
    seriesId: number;
    seriesTitle: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    at: string;
    hasFile: boolean;
    monitored: boolean;
    quality: string | null;
    finaleType: string | null;
  }
  | {
    service: 'radarr';
    kind: 'movie';
    id: number;
    title: string;
    year: number | null;
    at: string;
    release: 'cinema' | 'digital' | 'physical';
    hasFile: boolean;
    monitored: boolean;
    isAvailable: boolean;
  };

export async function getJson<T>(path: string, onUnauthenticated: () => void, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
  if (response.status === 401) {
    onUnauthenticated();
    throw new Error('Signed out.');
  }
  if (!response.ok) {
    let reason = 'The request failed.';
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === 'string') reason = body.error;
    } catch { /* keep the generic reason */ }
    throw new Error(reason);
  }
  return await response.json() as T;
}

export const postJson = (path: string, body: unknown) => fetch(path, {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2', Accept: 'application/json' },
  body: JSON.stringify(body),
});
