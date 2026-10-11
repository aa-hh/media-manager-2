import type { TmdbDiscoverParams } from '../services/tmdb.js';
import type { TraktListRequest } from '../services/trakt.js';

// Omit applied to each variant, so a box office request stays movie-only.
type TraktList<T> = T extends unknown ? Omit<T, 'limit' | 'filters'> : never;

export type Source =
  | { kind: 'trakt'; weight: number; mediaType: 'movie' | 'tv'; list: TraktList<TraktListRequest> }
  | { kind: 'tmdb-trending'; weight: number; mediaType: 'movie' | 'tv' | 'all' }
  | { kind: 'tmdb-discover'; weight: number; mediaType: 'movie' | 'tv'; params: TmdbDiscoverParams; windowDays?: number };

export type Recipe = { id: string; label: string; ttlMs: number; order: 'score' | 'date'; dropOutsideWindowDays?: number; sources: Source[] };

// Damps the lead of the very top ranks in reciprocal-rank fusion.
export const FUSION_K = 10;
// Trending leans on Trakt's watchers and lets TMDB fill in.
export const TRENDING_TRAKT_WEIGHT = 0.65;
export const TRENDING_TMDB_WEIGHT = 0.35;
// The same split for other rows that blend both services.
export const TRAKT_HEAVY = 0.65;
export const TMDB_LIGHT = 0.35;
// Trending moves within the hour; other rows within the day.
export const TRENDING_TTL_MS = 30 * 60_000;
export const ROW_TTL_MS = 6 * 60 * 60_000;
// Genre and streaming service lists barely change.
export const REFERENCE_TTL_MS = 24 * 60 * 60_000;
// A grid page is refilled on read once it is this old.
export const GRID_TTL_MS = 5 * 60_000;
// Titles per home row, and titles asked of each Trakt list.
export const CAP = 20;

const trakt = (weight: number, list: TraktList<TraktListRequest>): Source => ({ kind: 'trakt', weight, mediaType: list.type, list });
const both = (kind: 'anticipated' | 'watched' | 'collected' | 'favorited', period?: 'weekly') => [
  trakt(1, { type: 'movie', kind, ...(period === undefined ? {} : { period }) }),
  trakt(1, { type: 'tv', kind, ...(period === undefined ? {} : { period }) }),
];
const popularity = { sort_by: 'popularity.desc' };

export const recipes: Recipe[] = [
  {
    id: 'trending', label: 'Trending', ttlMs: TRENDING_TTL_MS, order: 'score', sources: [
      trakt(TRENDING_TRAKT_WEIGHT, { type: 'movie', kind: 'trending' }),
      trakt(TRENDING_TRAKT_WEIGHT, { type: 'tv', kind: 'trending' }),
      { kind: 'tmdb-trending', weight: TRENDING_TMDB_WEIGHT, mediaType: 'movie' },
      { kind: 'tmdb-trending', weight: TRENDING_TMDB_WEIGHT, mediaType: 'tv' },
    ],
  },
  {
    id: 'popular', label: 'Popular', ttlMs: ROW_TTL_MS, order: 'score', sources: [
      trakt(TRAKT_HEAVY, { type: 'movie', kind: 'popular' }),
      trakt(TRAKT_HEAVY, { type: 'tv', kind: 'popular' }),
      { kind: 'tmdb-discover', weight: TMDB_LIGHT, mediaType: 'movie', params: popularity },
      { kind: 'tmdb-discover', weight: TMDB_LIGHT, mediaType: 'tv', params: popularity },
    ],
  },
  {
    id: 'upcoming-movies-30', label: 'Upcoming movies', ttlMs: ROW_TTL_MS, order: 'date', sources: [
      { kind: 'tmdb-discover', weight: 1, mediaType: 'movie', params: popularity, windowDays: 30 },
    ],
  },
  {
    id: 'upcoming-movies-90', label: 'Upcoming movies', ttlMs: ROW_TTL_MS, order: 'date', sources: [
      { kind: 'tmdb-discover', weight: 1, mediaType: 'movie', params: popularity, windowDays: 90 },
    ],
  },
  {
    id: 'upcoming-tv', label: 'Upcoming TV', ttlMs: ROW_TTL_MS, order: 'date', dropOutsideWindowDays: 90, sources: [
      { kind: 'tmdb-discover', weight: TMDB_LIGHT, mediaType: 'tv', params: popularity, windowDays: 90 },
      trakt(TRAKT_HEAVY, { type: 'tv', kind: 'anticipated' }),
    ],
  },
  { id: 'most-anticipated', label: 'Most anticipated', ttlMs: ROW_TTL_MS, order: 'score', sources: both('anticipated') },
  { id: 'most-watched', label: 'Most watched', ttlMs: ROW_TTL_MS, order: 'score', sources: both('watched', 'weekly') },
  { id: 'most-collected', label: 'Most collected', ttlMs: ROW_TTL_MS, order: 'score', sources: both('collected', 'weekly') },
  { id: 'box-office', label: 'Weekend box office', ttlMs: ROW_TTL_MS, order: 'score', sources: [trakt(1, { type: 'movie', kind: 'boxoffice' })] },
  { id: 'most-favorited', label: 'Most favorited', ttlMs: ROW_TTL_MS, order: 'score', sources: both('favorited', 'weekly') },
];

// A chosen streaming service's row: what it streams on subscription, most popular first.
export const serviceRecipe = (providerId: number): Recipe => {
  const params = { with_watch_providers: providerId, with_watch_monetization_types: 'flatrate', sort_by: 'popularity.desc' };
  return {
    id: `service:${providerId}`, label: 'Streaming service', ttlMs: ROW_TTL_MS, order: 'score', sources: [
      { kind: 'tmdb-discover', weight: 1, mediaType: 'movie', params },
      { kind: 'tmdb-discover', weight: 1, mediaType: 'tv', params },
    ],
  };
};

export const EXTRA_ROWS = ['most-anticipated', 'most-watched', 'most-collected', 'box-office', 'most-favorited'];

export const recipeById = (id: string): Recipe | undefined => {
  const service = /^service:(\d+)$/.exec(id);
  return service === null ? recipes.find((recipe) => recipe.id === id) : serviceRecipe(Number(service[1]));
};
