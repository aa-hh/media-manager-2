import { logEvent } from '../log.js';
import { type Failure, notConfigured, type Result } from '../services/arr/result.js';
import type { createTmdb, TmdbDiscoverParams, TmdbGenre, TmdbListItem, TmdbMediaType } from '../services/tmdb.js';
import type { Trakt, TraktFilters, TraktGenre } from '../services/trakt.js';
import type { TitleRef, TitleStore } from '../titleStore.js';
import { CAP, FUSION_K, GRID_TTL_MS, REFERENCE_TTL_MS, recipeById, type Source } from './recipes.js';
import { type Filters, parseKey, type RowSpec, type Rows, rowKey, sorts, type StoredItem, type StoredRow } from './rows.js';

type Tmdb = Pick<ReturnType<typeof createTmdb>, 'discover' | 'trending' | 'genres' | 'providers' | 'summary' | 'watchProviders'>;

const DAY_MS = 24 * 60 * 60_000;
// Saved TMDB summaries follow the title store's week; availability changes faster.
const SUMMARY_MAX_AGE_MS = 7 * DAY_MS;
const PROVIDERS_MAX_AGE_MS = DAY_MS;
// The refresh job renews only rows read in the last day and deletes rows nobody read for a week.
const READ_WINDOW_MS = DAY_MS;
const ABANDONED_MS = 7 * DAY_MS;
const PROVIDER_LOOKUPS = 40;
// Genres are the same in every region, so their reference rows carry none.
const NO_REGION = '';

// The saved tmdbSummary part. Summaries saved before date and popularity were added read them as null.
type Summary = {
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  overview: string | null;
  genreIds: number[];
  date?: string | null;
  popularity?: number | null;
};
type Entry = { item: StoredItem; tvdbId: number | null; rank: number };
type Built = { result: Result<StoredRow>; partial: boolean };
// `thinned`: a Trakt list whose titles were partly dropped because their summaries failed.
type Ran = Result<Entry[]> & { thinned?: boolean };
type Candidate = { item: StoredItem; tvdbId: number | null; score: number; heaviest: { weight: number; rank: number }; order: number };

const elapsed = (started: number) => Math.round((performance.now() - started) * 10) / 10;

// A short name for a row in the timing log, such as row:trending:movie, instead of the whole key.
const rowLabel = (key: string) => {
  const spec = parseKey(key);
  const name = spec.kind === 'row' ? spec.recipe : spec.kind === 'reference' ? spec.name : spec.sort;
  return `${spec.kind}:${name}:${spec.type}`;
};

const today = (at: number) => new Date(at).toISOString().slice(0, 10);
const daysAfter = (at: number, days: number) => today(at + days * DAY_MS);

const toSummary = (item: TmdbListItem & { title: string }): Summary => ({
  title: item.title,
  year: item.date === null ? null : Number(item.date.slice(0, 4)) || null,
  posterPath: item.posterPath,
  backdropPath: item.backdropPath,
  rating: item.voteAverage,
  overview: item.overview,
  genreIds: item.genreIds,
  date: item.date,
  popularity: item.popularity,
});

const toItem = (type: TmdbMediaType, tmdbId: number, summary: Summary): StoredItem => ({
  tmdbId,
  type,
  title: summary.title,
  year: summary.year,
  date: summary.date ?? null,
  posterPath: summary.posterPath,
  backdropPath: summary.backdropPath,
  rating: summary.rating,
  genreIds: summary.genreIds,
  genres: [],
  overview: summary.overview,
  popularity: summary.popularity ?? null,
});

// The filter bar as TMDB discover parameters; `from` and `to` narrow the year bounds to a date window.
const filterParams = (type: TmdbMediaType, filters: Filters, from?: string, to?: string): TmdbDiscoverParams => {
  const field = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const yearFrom = filters.yearFrom === null ? undefined : `${filters.yearFrom}-01-01`;
  const yearTo = filters.yearTo === null ? undefined : `${filters.yearTo}-12-31`;
  return {
    with_genres: filters.genres.length === 0 ? undefined : filters.genres.join(','),
    // Any one of the chosen services is enough, so they are joined with TMDB's "or".
    with_watch_providers: filters.providers.length === 0 ? undefined : filters.providers.join('|'),
    watch_region: filters.region,
    [`${field}.gte`]: from !== undefined && (yearFrom === undefined || yearFrom < from) ? from : yearFrom,
    [`${field}.lte`]: to !== undefined && (yearTo === undefined || yearTo > to) ? to : yearTo,
    'vote_average.gte': filters.minRating ?? undefined,
  };
};

// A title passes when it has every chosen genre, a date inside the year bounds and a rating at the floor.
const passes = (item: StoredItem, filters: Filters) => {
  const year = item.date === null ? null : Number(item.date.slice(0, 4));
  return filters.genres.every((genre) => item.genreIds.includes(genre))
    && (filters.yearFrom === null || (year !== null && year >= filters.yearFrom))
    && (filters.yearTo === null || (year !== null && year <= filters.yearTo))
    && (filters.minRating === null || (item.rating !== null && item.rating >= filters.minRating));
};

// Weighted reciprocal-rank fusion: each source adds weight / (K + rank) for every title it lists.
const fuse = (ranked: Array<{ weight: number; entries: Entry[] }>): Candidate[] => {
  const byTitle = new Map<string, Candidate>();
  for (const { weight, entries } of ranked) {
    for (const { item, tvdbId, rank } of entries) {
      const id = `${item.type}:${item.tmdbId}`;
      const found = byTitle.get(id);
      const score = weight / (FUSION_K + rank);
      if (found === undefined) {
        byTitle.set(id, { item, tvdbId, score, heaviest: { weight, rank }, order: byTitle.size });
        continue;
      }
      found.score += score;
      found.tvdbId ??= tvdbId;
      if (weight > found.heaviest.weight) found.heaviest = { weight, rank };
    }
  }
  return [...byTitle.values()].sort((a, b) => b.score - a.score || a.heaviest.rank - b.heaviest.rank || a.order - b.order);
};

export const createOrchestrator = (options: {
  tmdb: Tmdb;
  trakt?: Pick<Trakt, 'list' | 'genres'>;
  store: TitleStore;
  rows: Rows;
  now: () => number;
  fillTimeoutMs?: number;
}) => {
  const { tmdb, trakt, store, rows, now } = options;
  const fillTimeoutMs = options.fillTimeoutMs ?? 8000;
  const inFlight = new Map<string, Promise<Result<StoredRow>>>();
  const tmdbOnlyLoads = new Map<string, Promise<Result<unknown>>>();

  // A show without a TVDB id has no Title for the store's fetch, so its part is read and saved by TMDB id directly.
  const savedPart = async <T>(type: TmdbMediaType, tmdbId: number, tvdbId: number | null, part: string, maxAgeMs: number, load: () => Promise<Result<T>>): Promise<Result<T>> => {
    if (type === 'movie') return store.fetch({ type: 'movie', tmdbId }, part, maxAgeMs, load);
    if (tvdbId !== null) return store.fetch({ type: 'tv', tvdbId, tmdbId }, part, maxAgeMs, load);
    const ref: TitleRef = { type: 'tv', tmdbId };
    const saved = store.get<T>(ref, part);
    if (saved !== undefined && store.now() - saved.fetchedAt < maxAgeMs) return { kind: 'ok', value: saved.value };
    // Two rows listing the same show share one load, as the store's fetch does for titles it can key.
    const flight = `${tmdbId}\n${part}`;
    const running = tmdbOnlyLoads.get(flight);
    if (running !== undefined) return running as Promise<Result<T>>;
    const loading = load()
      .then((result) => {
        if (result.kind === 'ok') store.put(ref, part, result.value);
        return result;
      })
      .finally(() => tmdbOnlyLoads.delete(flight));
    tmdbOnlyLoads.set(flight, loading);
    return loading;
  };

  const loadSummary = async (type: TmdbMediaType, tmdbId: number): Promise<Result<Summary>> => {
    const result = await tmdb.summary(type, tmdbId);
    if (result.kind !== 'ok') return result;
    const { title } = result.value;
    return title === null ? { kind: 'refused', status: null, message: 'TMDB sent a title summary without a title.' } : { kind: 'ok', value: toSummary({ ...result.value, title }) };
  };

  // TMDB list items carry their own summary, which is saved for the title pages.
  const fromTmdb = (items: TmdbListItem[]): Entry[] => items.flatMap((item, index) => {
    const { mediaType, title } = item;
    if (mediaType === null || title === null) return [];
    const summary = toSummary({ ...item, title });
    store.put(mediaType === 'movie' ? { type: 'movie', tmdbId: item.id } : { type: 'tv', tmdbId: item.id }, 'tmdbSummary', summary);
    return [{ item: toItem(mediaType, item.id, summary), tvdbId: null, rank: index + 1 }];
  });

  // A reference list for a build, waiting for its first fill without the cap: the outer request already carries it.
  const reference = async <T>(name: 'genres' | 'providers' | 'trakt-genres', type: TmdbMediaType, region = NO_REGION): Promise<T[]> => {
    const key = rowKey({ kind: 'reference', name, type, region });
    if (rows.read(key) === undefined) await fill(key);
    return (rows.read(key)?.row.reference as T[] | undefined) ?? [];
  };

  // `complete` is false when a type's genre list came back empty although its titles carry genre ids, so names are missing.
  const withGenreNames = async (items: StoredItem[]): Promise<{ items: StoredItem[]; complete: boolean }> => {
    const types = [...new Set(items.map((item) => item.type))];
    const lists = await Promise.all(types.map((type) => reference<TmdbGenre>('genres', type)));
    const names = new Map(types.flatMap((type, index) => lists[index].map((genre) => [`${type}:${genre.id}`, genre.name] as const)));
    const complete = types.every((type, index) => lists[index].length > 0 || items.every((item) => item.type !== type || item.genreIds.length === 0));
    return { items: items.map((item) => ({ ...item, genres: item.genreIds.flatMap((id) => names.get(`${item.type}:${id}`) ?? []) })), complete };
  };

  // Trakt matches genres by its own slugs; a TMDB genre with no Trakt genre of the same name is left out.
  const traktFilters = async (type: TmdbMediaType, filters: Filters): Promise<TraktFilters | undefined> => {
    const mapped: TraktFilters = {};
    if (filters.genres.length > 0) {
      const [tmdbGenres, traktGenres] = await Promise.all([reference<TmdbGenre>('genres', type), reference<TraktGenre>('trakt-genres', type)]);
      const slugs = filters.genres.flatMap((id) => {
        const name = tmdbGenres.find((genre) => genre.id === id)?.name.toLowerCase();
        return traktGenres.find((genre) => genre.name.toLowerCase() === name)?.slug ?? [];
      });
      if (slugs.length > 0) mapped.genres = slugs;
    }
    if (filters.yearFrom !== null || filters.yearTo !== null) mapped.years = [filters.yearFrom ?? 1870, filters.yearTo ?? 2200];
    if (filters.minRating !== null) mapped.tmdbRatings = [filters.minRating, 10];
    return Object.keys(mapped).length === 0 ? undefined : mapped;
  };

  // Undefined means a Trakt source with no client or no Client ID saved: the row treats it as absent, not as failed.
  const run = async (source: Source, filters: Filters, at: number): Promise<Ran | undefined> => {
    if (source.kind === 'trakt') {
      if (trakt === undefined) return undefined;
      // Box office takes no filters: it is always last weekend's top ten.
      const mapped = source.list.kind === 'boxoffice' ? undefined : await traktFilters(source.mediaType, filters);
      const result = await trakt.list({ ...source.list, limit: CAP, ...(mapped === undefined ? {} : { filters: mapped }) });
      if (result.kind === 'not_configured') return undefined;
      if (result.kind !== 'ok') return result;
      const resolved = await Promise.all(result.value.map(async (title, index): Promise<Result<Entry> | undefined> => {
        const { tmdbId } = title;
        // razor: a Trakt title without a TMDB id has no summary to show and is skipped; upgrade path is a TMDB find by its TVDB or IMDb id.
        if (tmdbId === null) return undefined;
        const summary = await savedPart(title.type, tmdbId, title.tvdbId, 'tmdbSummary', SUMMARY_MAX_AGE_MS, () => loadSummary(title.type, tmdbId));
        return summary.kind === 'ok' ? { kind: 'ok', value: { item: toItem(title.type, tmdbId, summary.value), tvdbId: title.tvdbId, rank: index + 1 } } : summary;
      }));
      const entries = resolved.flatMap((entry) => (entry?.kind === 'ok' ? [entry.value] : []));
      // A title TMDB no longer has is dropped, not counted as a failure, or the row would stay partial for good.
      const failure = resolved.find((entry): entry is Failure => entry !== undefined && entry.kind !== 'ok' && entry.kind !== 'not_found');
      // Every summary failing means TMDB is down or not set up, which fails this source like any other upstream failure.
      return entries.length === 0 && failure !== undefined ? failure : { kind: 'ok', value: entries, thinned: failure !== undefined };
    }
    if (source.kind === 'tmdb-trending') {
      const result = await tmdb.trending(source.mediaType, 'week');
      return result.kind === 'ok' ? { kind: 'ok', value: fromTmdb(result.value.results) } : result;
    }
    const window = source.windowDays === undefined ? [] : [today(at), daysAfter(at, source.windowDays)];
    const params = { ...filterParams(source.mediaType, filters, window[0], window[1]), ...source.params };
    const field = source.mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
    const [from, to] = [params[`${field}.gte`], params[`${field}.lte`]];
    // A window entirely outside the year bounds has nothing to ask TMDB for.
    if (from !== undefined && to !== undefined && String(from) > String(to)) return { kind: 'ok', value: [] };
    const result = await tmdb.discover(source.mediaType, params);
    return result.kind === 'ok' ? { kind: 'ok', value: fromTmdb(result.value.results) } : result;
  };

  const availableOn = async <T extends { item: StoredItem; tvdbId: number | null }>(entries: T[], filters: Filters) => {
    // razor: the first load of a service filter makes up to 40 availability lookups per row; upgrade path is a bulk provider cache.
    const looked = entries.slice(0, PROVIDER_LOOKUPS);
    const available = await Promise.all(looked.map(({ item, tvdbId }) => savedPart(
      item.type, item.tmdbId, tvdbId, 'tmdbProviders', PROVIDERS_MAX_AGE_MS, () => tmdb.watchProviders(item.type, item.tmdbId),
    )));
    // A failed lookup drops its title, so the row is partial rather than complete without it. A title TMDB no longer has is simply dropped.
    const lookupsFailed = available.some((result) => result.kind !== 'ok' && result.kind !== 'not_found');
    const kept = looked.filter((_, index) => {
      const result = available[index];
      return result.kind === 'ok' && (result.value[filters.region] ?? []).some((id) => filters.providers.includes(id));
    });
    return { kept, lookupsFailed };
  };

  const buildRow = async (spec: Extract<RowSpec, { kind: 'row' }>): Promise<Built> => {
    const recipe = recipeById(spec.recipe);
    if (recipe === undefined) return { result: { kind: 'not_found', message: `Discover has no row called ${spec.recipe}.` }, partial: false };
    const at = now();
    const { filters } = spec;
    const forType = recipe.sources.filter((source) => spec.type === 'all' || source.mediaType === spec.type);
    const ran = await Promise.all(forType.map((source) => run(source, filters, at)));
    const live = forType.flatMap((source, index) => {
      const result = ran[index];
      return result === undefined ? [] : [{ source, result }];
    });
    // A row made only of Trakt lists has nothing to show without Trakt, and is never saved empty.
    if (forType.length > 0 && live.length === 0) return { result: notConfigured('Trakt', `the ${recipe.label} row`), partial: false };
    const failures = live.flatMap(({ result }) => (result.kind === 'ok' ? [] : [result]));
    if (live.length > 0 && failures.length === live.length) return { result: failures[0], partial: false };
    const thinned = live.some(({ result }) => result.thinned === true);
    let candidates = fuse(live.map(({ source, result }) => ({ weight: source.weight, entries: result.kind === 'ok' ? result.value : [] })))
      .filter((candidate) => passes(candidate.item, filters));
    let lookupsFailed = false;
    if (filters.providers.length > 0) ({ kept: candidates, lookupsFailed } = await availableOn(candidates, filters));
    if (recipe.order === 'date') {
      const from = today(at);
      const to = recipe.dropOutsideWindowDays === undefined ? undefined : daysAfter(at, recipe.dropOutsideWindowDays);
      const kept = candidates.filter(({ item }) => item.date === null || (item.date >= from && (to === undefined || item.date <= to)));
      const dated = kept.filter(({ item }) => item.date !== null).sort((a, b) => String(a.item.date).localeCompare(String(b.item.date)));
      candidates = [...dated, ...kept.filter(({ item }) => item.date === null)];
    }
    // razor: filters applied after fusion can leave fewer than 20 titles; upgrade path is asking each source for more pages.
    const named = await withGenreNames(candidates.slice(0, CAP).map(({ item }) => item));
    return { result: { kind: 'ok', value: { items: named.items, totalPages: null } }, partial: failures.length > 0 || thinned || lookupsFailed || !named.complete };
  };

  const build = async (spec: RowSpec): Promise<Built> => {
    if (spec.kind === 'reference') {
      const result = spec.name === 'genres' ? await tmdb.genres(spec.type)
        : spec.name === 'providers' ? await tmdb.providers(spec.type, spec.region)
          : trakt === undefined ? notConfigured('Trakt', 'the genre list') : await trakt.genres(spec.type);
      return { result: result.kind === 'ok' ? { kind: 'ok', value: { items: [], totalPages: null, reference: result.value } } : result, partial: false };
    }
    if (spec.kind === 'row') return buildRow(spec);
    if (spec.sort === 'trending') {
      // razor: filters are applied after fetching because TMDB's trending endpoint takes none; this keeps TMDB's trending order and
      // works for the mixed movie and TV list, at the cost of pages holding fewer than 20 titles (the client stops after
      // 5 empty pages in a row, EMPTY_PAGE_LIMIT in Grid.tsx); upgrade path is a server-side merged page.
      const trending = await tmdb.trending(spec.type, 'week', spec.page);
      if (trending.kind !== 'ok') return { result: trending, partial: false };
      let entries = fromTmdb(trending.value.results).filter(({ item }) => passes(item, spec.filters));
      let lookupsFailed = false;
      if (spec.filters.providers.length > 0) ({ kept: entries, lookupsFailed } = await availableOn(entries, spec.filters));
      const named = await withGenreNames(entries.map(({ item }) => item));
      return { result: { kind: 'ok', value: { items: named.items, totalPages: trending.value.totalPages } }, partial: lookupsFailed || !named.complete };
    }
    const result = await tmdb.discover(spec.type, {
      ...filterParams(spec.type, spec.filters, spec.sort === 'upcoming' ? today(now()) : undefined),
      page: spec.page,
      sort_by: sorts[spec.sort][spec.type],
      // A rating sort without a vote floor fills the page with titles rated by one person.
      'vote_count.gte': spec.sort === 'rating' ? 200 : undefined,
    });
    if (result.kind !== 'ok') return { result, partial: false };
    const named = await withGenreNames(fromTmdb(result.value.results).map(({ item }) => item));
    return { result: { kind: 'ok', value: { items: named.items, totalPages: result.value.totalPages } }, partial: !named.complete };
  };

  // One build per key at a time. A failure keeps the old row. A partial build (a source or the genre list failed) never
  // replaces a saved row; with nothing saved it is saved already past its age limit, so the next refresh rebuilds it (a grid page, on its next read).
  const fill = (key: string) => {
    const running = inFlight.get(key);
    if (running !== undefined) return running;
    const spec = parseKey(key);
    const started = performance.now();
    const building = build(spec)
      .then(({ result, partial }) => {
        logEvent('discover-build', { row: rowLabel(key), ms: elapsed(started), partial, ok: result.kind === 'ok' });
        if (result.kind !== 'ok') return result;
        if (!partial) rows.save(key, result.value, now());
        else if (!rows.has(key)) {
          const ttl = spec.kind === 'row' ? recipeById(spec.recipe)?.ttlMs ?? 0 : GRID_TTL_MS;
          rows.save(key, result.value, now() - ttl - 1);
        }
        return result;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, building);
    return building;
  };

  // A saved recipe or reference row is served at any age (the refresh job renews it); a grid page refills once five minutes old.
  // A missing row waits for its build up to the cap, then comes back pending while the build carries on and saves.
  const request = async (key: string): Promise<{ pending: boolean; failure?: Failure }> => {
    const started = performance.now();
    const saved = rows.read(key);
    if (saved !== undefined && (parseKey(key).kind !== 'grid' || now() - saved.fetchedAt < GRID_TTL_MS)) {
      logEvent('discover', { row: rowLabel(key), outcome: 'saved', ms: elapsed(started) });
      return { pending: false };
    }
    let timer: NodeJS.Timeout | undefined;
    const cap = new Promise<{ pending: boolean }>((resolve) => {
      timer = setTimeout(() => resolve({ pending: true }), fillTimeoutMs);
    });
    const answer = await Promise.race([fill(key).then((result) => (result.kind === 'ok' ? { pending: false } : { pending: false, failure: result })), cap]);
    clearTimeout(timer);
    const outcome = answer.pending ? 'pending' : 'failure' in answer ? 'failed' : 'built';
    logEvent('discover', { row: rowLabel(key), outcome, ms: elapsed(started) });
    return answer;
  };

  const refresh = async () => {
    const at = now();
    await Promise.all(rows.list().map(async ({ key, fetchedAt, readAt }) => {
      if (at - readAt >= ABANDONED_MS) {
        rows.remove(key);
        return;
      }
      const spec = parseKey(key);
      const ttl = spec.kind === 'row' ? recipeById(spec.recipe)?.ttlMs : spec.kind === 'reference' ? REFERENCE_TTL_MS : undefined;
      if (ttl === undefined || at - fetchedAt <= ttl || at - readAt >= READ_WINDOW_MS) return;
      await fill(key);
    }));
  };

  // Resolves once no build is running; tests use it to wait for a build that outlived the cap.
  const idle = async () => {
    while (inFlight.size > 0) await Promise.allSettled(inFlight.values());
  };

  return { build, request, refresh, idle };
};

export type Orchestrator = ReturnType<typeof createOrchestrator>;
