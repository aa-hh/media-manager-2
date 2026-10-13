// Discover's reply shapes and the small pure helpers its screens share. No imports: tests load this file straight from source.

/** Same shape as `DiscoverResult` in src/server/discover/rows.ts. */
export type DiscoverResult = {
  tmdbId: number;
  type: 'movie' | 'tv';
  title: string;
  year: number | null;
  date: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  genres: string[];
  overview: string | null;
  libraryId: number | null;
};

export type Row = {
  results: DiscoverResult[];
  pending: boolean;
  /** True only when the build failed and nothing is saved. */
  failed: boolean;
  failure: 'not_configured' | 'unreachable' | 'rejected' | 'not_found' | 'refused' | null;
};

/** Rows the chosen media type hides come back `null`. */
export type HomeReply = {
  trending: { all: Row; movie: Row; tv: Row };
  popularMovies: Row | null;
  popularTv: Row | null;
  upcomingMovies: { days30: Row | null; days90: Row | null } | null;
  upcomingTv: Row | null;
  services: Array<Row & { providerId: number; name: string | null }>;
  extraRows: Array<Row & { id: string; label: string }>;
};

export type GridReply = { page: number; totalPages: number; results: DiscoverResult[]; pending: boolean };

export type MediaType = 'all' | 'movie' | 'tv';
export type Sort = 'popular' | 'rating' | 'newest' | 'upcoming';
export type Filters = { genres: number[]; providers: number[]; yearFrom: number | null; yearTo: number | null; minRating: number | null };
export type HomeState = Filters & { type: MediaType; window: 30 | 90 };
export type GridState = Filters & { type: MediaType; sort: Sort };

const sorts: Sort[] = ['popular', 'rating', 'newest', 'upcoming'];

const idList = (value: string | null): number[] => (value ?? '').split(',').filter((part) => /^\d{1,9}$/.test(part)).map(Number);
// The server refuses years outside 1870–2200, so the page never sends one.
const yearOf = (value: string | null) => (value !== null && /^\d{4}$/.test(value) && Number(value) >= 1870 && Number(value) <= 2200 ? Number(value) : null);
const ratingOf = (value: string | null) => (value !== null && /^\d{1,2}(\.\d)?$/.test(value) && Number(value) <= 10 ? Number(value) : null);

const readFilters = (params: URLSearchParams): Filters => {
  const yearFrom = yearOf(params.get('yearFrom'));
  const yearTo = yearOf(params.get('yearTo'));
  const reversed = yearFrom !== null && yearTo !== null && yearFrom > yearTo;
  return {
    genres: idList(params.get('genres')),
    providers: idList(params.get('providers')),
    yearFrom: reversed ? null : yearFrom,
    yearTo: reversed ? null : yearTo,
    minRating: ratingOf(params.get('minRating')),
  };
};
const readType = (params: URLSearchParams): MediaType => {
  const type = params.get('type');
  return type === 'movie' || type === 'tv' ? type : 'all';
};

// Defaults (type all, sort popular, empty lists, null values) are left out, so an unfiltered page has a bare address.
const filterParams = (filters: Filters, type: MediaType | undefined) => {
  const params = new URLSearchParams();
  if (type !== undefined && type !== 'all') params.set('type', type);
  if (filters.genres.length > 0) params.set('genres', filters.genres.join(','));
  if (filters.providers.length > 0) params.set('providers', filters.providers.join(','));
  if (filters.yearFrom !== null) params.set('yearFrom', String(filters.yearFrom));
  if (filters.yearTo !== null) params.set('yearTo', String(filters.yearTo));
  if (filters.minRating !== null) params.set('minRating', String(filters.minRating));
  return params;
};

const withQuery = (path: string, params: URLSearchParams) => (params.size === 0 ? path : `${path}?${params}`);

/** The /home query string. `window` is client-only and the region is always US, so neither is sent. */
export const homeQuery = (state: HomeState, services: number[]): string => {
  const params = filterParams(state, state.type);
  if (services.length > 0) params.set('services', services.join(','));
  return params.toString();
};

export const gridPath = (kind: 'movies' | 'tv' | 'trending', filters: Filters, extra: { type?: MediaType; sort?: Sort }): string => {
  const params = filterParams(filters, extra.type);
  if (extra.sort !== undefined && extra.sort !== 'popular') params.set('sort', extra.sort);
  return withQuery(`/discover/${kind}`, params);
};

export const readState = (search: string): HomeState => {
  const params = new URLSearchParams(search);
  return { ...readFilters(params), type: readType(params), window: params.get('window') === '30' ? 30 : 90 };
};

export const readGridState = (search: string): GridState => {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  return { ...readFilters(params), type: readType(params), sort: sorts.find((known) => known === sort) ?? 'popular' };
};

const STATE_KEY = 'mm2.discover.filters';
const REMEMBERED_KEY = 'mm2.discover.lastFilters';
const SERVICES_KEY = 'mm2.discover.services';

// The saved filters are the same text the page address carries, read back through readState, so a bad value falls to a default.
// They are kept for the tab session in sessionStorage; the last non-empty set is also kept in localStorage.
const stateText = (state: HomeState) => {
  const params = filterParams(state, state.type);
  if (state.window === 30) params.set('window', '30');
  return params.toString();
};

const hasFilters = (filters: Filters) =>
  filters.genres.length > 0 || filters.providers.length > 0 || filters.yearFrom !== null || filters.yearTo !== null || filters.minRating !== null;

export const readStoredState = (): HomeState | undefined => {
  try {
    const value = window.sessionStorage.getItem(STATE_KEY);
    if (value !== null) return readState(value);
  } catch { /* storage unavailable or unreadable: start from the defaults */ }
  return undefined;
};

export const writeStoredState = (state: HomeState) => {
  try {
    window.sessionStorage.setItem(STATE_KEY, stateText(state));
    if (hasFilters(state)) window.localStorage.setItem(REMEMBERED_KEY, stateText(state));
  } catch { /* the choice just won't persist */ }
};

export const readRememberedState = (): HomeState | undefined => {
  try {
    const value = window.localStorage.getItem(REMEMBERED_KEY);
    if (value !== null) {
      const state = readState(value);
      if (hasFilters(state)) return state;
    }
  } catch { /* storage unavailable or unreadable: nothing remembered */ }
  return undefined;
};

export const clearSessionState = () => {
  try {
    window.sessionStorage.removeItem(STATE_KEY);
  } catch { /* nothing to clear */ }
};

export const withoutFilters = (search: string) => {
  const params = new URLSearchParams(search);
  for (const key of ['type', 'genres', 'providers', 'yearFrom', 'yearTo', 'minRating', 'window']) params.delete(key);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
};

export const readServices = (): number[] => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SERVICES_KEY) ?? 'null');
    if (Array.isArray(value)) return value.filter((id): id is number => Number.isInteger(id) && id > 0);
  } catch { /* storage unavailable or unreadable: no services */ }
  return [];
};

export const writeServices = (ids: number[]) => {
  try {
    window.localStorage.setItem(SERVICES_KEY, JSON.stringify(ids));
  } catch { /* the choice just won't persist */ }
};

const dayNumber = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
};

/** A release date as a phrase. `today` and `date` are `YYYY-MM-DD`. */
export const countdown = (date: string | null, today: string): string => {
  if (date === null) return 'No date yet';
  const days = dayNumber(date) - dayNumber(today);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `In ${days} days`;
  if (days < 84) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const dateTab = (date: string): { month: string; day: string } => {
  const [, month, day] = date.split('-').map(Number);
  return { month: MONTHS[month - 1], day: String(day) };
};

/** Where a card goes: the library page when the title is in the library, else the page that previews it. */
export const titlePath = (result: DiscoverResult): string => {
  if (result.libraryId !== null) return `/${result.type === 'tv' ? 'series' : 'movie'}/${result.libraryId}`;
  return result.type === 'tv' ? `/title/tmdb-tv/${result.tmdbId}` : `/title/tmdb/${result.tmdbId}`;
};

export const trendingIntro = (type: MediaType): string => {
  if (type === 'movie') return 'Movies people are watching this week.';
  if (type === 'tv') return 'TV shows people are watching this week.';
  return 'What people are watching this week, movies and TV together.';
};

export const hiddenRowsNote = (type: MediaType): string | undefined => {
  if (type === 'movie') return 'Movies only, so Popular TV and Upcoming TV are hidden.';
  if (type === 'tv') return 'TV only, so Popular movies and Upcoming movies are hidden.';
  return undefined;
};

/**
 * Rows with nothing to show are hidden, except a row whose source failed for a reason other than missing setup, which shows its retry.
 * `traktMissing` is true when every extra row failed only because Trakt is not set up.
 */
export const extraRowsView = (rows: HomeReply['extraRows']) => ({
  shown: rows.filter((row) => row.results.length > 0 || row.pending || (row.failed && row.failure !== 'not_configured')),
  traktMissing: rows.length > 0 && rows.every((row) => row.failed && row.failure === 'not_configured'),
});

/** How many whole cards fit in a strip of this width. */
export const visibleCards = (stripWidth: number, cardWidth = 210, gap = 32): number =>
  Math.max(1, Math.floor((stripWidth + gap) / (cardWidth + gap)));

/** One removable tag per active filter, in a fixed order; `remove` is the filters with that one cleared. */
export const filterTags = (
  filters: Filters,
  genres: Array<{ id: number; name: string }>,
  providers: Array<{ id: number; name: string }>,
): Array<{ label: string; remove: Filters }> => {
  const tags: Array<{ label: string; remove: Filters }> = [];
  // An id whose name has not loaded yet gets no tag until the list arrives.
  for (const id of filters.genres) {
    const name = genres.find((genre) => genre.id === id)?.name;
    if (name !== undefined) tags.push({ label: name, remove: { ...filters, genres: filters.genres.filter((other) => other !== id) } });
  }
  for (const id of filters.providers) {
    const name = providers.find((provider) => provider.id === id)?.name;
    if (name !== undefined) tags.push({ label: name, remove: { ...filters, providers: filters.providers.filter((other) => other !== id) } });
  }
  const { yearFrom, yearTo, minRating } = filters;
  if (yearFrom !== null || yearTo !== null) {
    const label = yearFrom !== null && yearTo !== null ? `${yearFrom}–${yearTo}` : yearFrom !== null ? `From ${yearFrom}` : `Up to ${yearTo}`;
    tags.push({ label, remove: { ...filters, yearFrom: null, yearTo: null } });
  }
  if (minRating !== null) tags.push({ label: `Rating ${minRating} and above`, remove: { ...filters, minRating: null } });
  return tags;
};
