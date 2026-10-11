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
export type OwnedMovieDetail = MovieDetail & { credits: Credits; secondVersions: SecondVersion[] };

/** A version media-manager-2 grabbed next to the tracked one; src/server/secondVersionRows.ts is the source of truth. */
export type SecondVersion = {
  id: number;
  service: Service;
  movieId: number | null;
  seriesId: number | null;
  episodeId: number | null;
  state: 'sending' | 'downloading' | 'importing' | 'imported' | 'failed';
  failure: string | null;
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
};

/** GET /api/advice/:hash; src/server/advice.ts is the source of truth. */
export type RemovalAdvice = { recommendation: 'safe' | 'keep' | 'unconfirmed'; reason: string; globalRatio: string | null };

/** DELETE /api/second-versions/:id reply; src/server/secondVersionDelete.ts is the source of truth. */
export type SecondVersionDeleted = {
  deleted: { path: string } | null;
  torrent: { removed: true } | { removed: false; reason: string };
  secondVersions: SecondVersion[];
};

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
