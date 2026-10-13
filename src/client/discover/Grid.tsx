import { Plug, RotateCw, SearchX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderPage } from '@/components/ui/header-page';
import { SkeletonPosterCard } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StatusInline } from '@/components/ui/status-inline';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getJson } from '../library/api';
import { Arrival } from '../Arrival';
import { navigate, replace, useLocation, useScreenReady } from '../navigation';
import { Attribution } from './Attribution';
import { Card, openLink } from './Card';
import { FilterBar } from './FilterBar';
import { gridPath, readGridState, type DiscoverResult, type Filters, type GridReply, type GridState, type MediaType } from './model';

type Kind = 'movies' | 'tv' | 'trending';
type Option = { id: number; name: string };
type Got = { base: string; results: DiscoverResult[]; loadedPage: number; totalPages: number; emptyRun: number; status: 'ok' | 'not_configured' | 'failed' };

const POLL_MS = 3000;
const POLL_LIMIT = 10;
const SKELETONS = 8;
// TMDB serves at most 500 pages, and the server refuses a higher page.
const MAX_PAGE = 500;
// razor: paging stops after 5 pages in a row add no titles, so a narrow trending filter never chains through hundreds of fetches; upgrade path is a server-side merged page.
const EMPTY_PAGE_LIMIT = 5;
const keyOf = (result: DiscoverResult) => `${result.type}:${result.tmdbId}`;

const titles: Record<Kind, string> = { movies: 'Movies', tv: 'TV', trending: 'Trending' };
const cleared: Filters = { genres: [], providers: [], yearFrom: null, yearTo: null, minRating: null };

// Genre and service lists barely change, so each screen visit reuses the last good reply instead of asking again.
const optionReplies = new Map<string, unknown>();
const getOptions = <T,>(path: string, onUnauthenticated: () => void, signal: AbortSignal): Promise<T> => {
  if (optionReplies.has(path)) return Promise.resolve(optionReplies.get(path) as T);
  return getJson<T>(path, onUnauthenticated, signal).then((reply) => {
    optionReplies.set(path, reply);
    return reply;
  });
};

/** Genre and streaming-service names for the filter menus; a failed read leaves a menu empty. */
export function useOptions(genres: 'movie' | 'tv' | 'both', providers: 'movie' | 'tv', onUnauthenticated: () => void) {
  const [options, setOptions] = useState<{ genres: Option[]; providers: Option[] }>({ genres: [], providers: [] });
  useEffect(() => {
    const controller = new AbortController();
    const types = genres === 'both' ? ['movie', 'tv'] : [genres];
    Promise.all(types.map((type) => getOptions<{ genres: Option[] }>(`/api/discover/genres/${type}`, onUnauthenticated, controller.signal)))
      .then((lists) => {
        if (controller.signal.aborted) return;
        const merged = lists.flatMap((list) => list.genres).filter((genre, index, all) => all.findIndex((other) => other.name === genre.name) === index);
        setOptions((current) => ({ ...current, genres: merged.sort((a, b) => a.name.localeCompare(b.name)) }));
      })
      .catch(() => { /* the Genres menu stays empty */ });
    getOptions<{ providers: Option[] }>(`/api/discover/providers/${providers}?region=US`, onUnauthenticated, controller.signal)
      .then((body) => {
        if (!controller.signal.aborted) setOptions((current) => ({ ...current, providers: body.providers.map(({ id, name }) => ({ id, name })) }));
      })
      .catch(() => { /* the services menu stays empty */ });
    return () => controller.abort();
  }, [genres, providers, onUnauthenticated]);
  return options;
}

/** Shown instead of the page when TMDB has no key. */
export function TmdbNudge() {
  return (
    <EmptyState
      icon={<Plug />}
      title="Discover needs a TMDB key"
      className="mt-16"
      action={<Button variant="outline" onClick={() => navigate('/settings')}>Open Settings</Button>}
    >
      Trending, popular and upcoming titles come from TMDB. It is optional: add a key under Settings › Metadata and this screen fills in.
    </EmptyState>
  );
}

/** One Discover grid: every title for a source, loading more pages as the end scrolls into view. */
export function Grid({ kind, onUnauthenticated }: { kind: Kind; onUnauthenticated: () => void }) {
  const { search } = useLocation();
  const state = useMemo(() => readGridState(search), [search]);
  const address = (next: GridState, nextKind: Kind) => gridPath(nextKind, next, nextKind === 'trending' ? { type: next.type } : { sort: next.sort });
  const change = (next: GridState, nextKind: Kind = kind) => replace(address(next, nextKind));

  const path = address(state, kind);
  const query = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
  const base = `/api/discover/${kind === 'movies' ? 'movie' : kind}?${query === '' ? '' : `${query}&`}`;

  const [want, setWant] = useState({ base, page: 1 });
  const page = want.base === base ? want.page : 1;
  const [got, setGot] = useState<Got>();
  const current = got?.base === base ? got : undefined;
  const loading = current === undefined || (current.status === 'ok' && current.loadedPage < page);
  // The screen change holds for the first page; cards from later pages fade in as they append.
  const firstPage = current !== undefined && (current.status !== 'ok' || current.loadedPage >= 1);
  useScreenReady(firstPage);
  const firstCount = useRef<number | undefined>(undefined);
  if (firstPage && firstCount.current === undefined) firstCount.current = current?.results.length ?? 0;
  const [attempt, setAttempt] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const options = useOptions(kind === 'trending' ? 'both' : kind === 'movies' ? 'movie' : 'tv', kind === 'tv' ? 'tv' : 'movie', onUnauthenticated);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let polls = 0;
    setGot((previous) => (previous !== undefined && previous.base === base && previous.status !== 'ok' ? { ...previous, status: 'ok' } : previous));
    const fail = (status: Got['status']) => setGot((previous) => ({
      base,
      results: previous?.base === base ? previous.results : [],
      loadedPage: previous?.base === base ? previous.loadedPage : 0,
      totalPages: previous?.base === base ? previous.totalPages : 0,
      emptyRun: previous?.base === base ? previous.emptyRun : 0,
      status,
    }));
    const fetchPage = () => {
      getJson<GridReply>(`${base}page=${page}`, onUnauthenticated, controller.signal)
        .then((reply) => {
          if (controller.signal.aborted) return;
          if (reply.pending) {
            if (polls >= POLL_LIMIT) {
              fail('failed');
              return;
            }
            polls += 1;
            timer = window.setTimeout(fetchPage, POLL_MS);
            return;
          }
          setGot((previous) => {
            const first = page === 1 || previous?.base !== base;
            // A title can move between pages while paging; a second copy would repeat a React key.
            const seen = new Set(first ? [] : previous.results.map(keyOf));
            const added = reply.results.filter((result) => !seen.has(keyOf(result)));
            return {
              base,
              results: first ? added : [...previous.results, ...added],
              loadedPage: page,
              totalPages: Math.min(reply.totalPages ?? page, MAX_PAGE),
              emptyRun: added.length > 0 ? 0 : (first ? 0 : previous.emptyRun) + 1,
              status: 'ok',
            };
          });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) fail(error instanceof Error && error.message === 'not_configured' ? 'not_configured' : 'failed');
        });
    };
    fetchPage();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [base, page, attempt, onUnauthenticated]);

  const more = current !== undefined && current.status === 'ok' && !loading && current.emptyRun < EMPTY_PAGE_LIMIT && current.loadedPage < current.totalPages;
  const nextPage = (current?.loadedPage ?? 0) + 1;
  useEffect(() => {
    const element = sentinel.current;
    if (!more || element === null) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setWant({ base, page: nextPage });
    }, { rootMargin: '400px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [more, base, nextPage]);

  if (current?.status === 'not_configured') return <TmdbNudge />;

  const empty = current !== undefined && current.status === 'ok' && !loading && current.loadedPage >= 1 && current.results.length === 0
    && (current.loadedPage >= current.totalPages || current.emptyRun >= EMPTY_PAGE_LIMIT);
  const typeToggle = kind === 'trending' ? (
    <ToggleGroup aria-label="Media type" value={state.type} onValueChange={(value) => change({ ...state, type: value as MediaType })}>
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      <ToggleGroupItem value="movie">Movies</ToggleGroupItem>
      <ToggleGroupItem value="tv">TV</ToggleGroupItem>
    </ToggleGroup>
  ) : (
    <ToggleGroup aria-label="Media type" value={kind} onValueChange={(value) => change(state, value as Kind)}>
      <ToggleGroupItem value="movies">Movies</ToggleGroupItem>
      <ToggleGroupItem value="tv">TV</ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <div className="flex flex-col pb-10">
      <HeaderPage
        breadcrumb={<Breadcrumb links={[{ label: 'Discover', href: '/discover', onClick: openLink('/discover') }]} current={titles[kind]} />}
        title={titles[kind]}
        summary={kind === 'trending' ? 'This week · Movies and TV · United States' : 'From TMDB · United States'}
        action={typeToggle}
      />
      <FilterBar
        state={state}
        onChange={(next) => change(next)}
        genres={options.genres}
        providers={options.providers}
        sort={kind !== 'trending'}
        trending={kind === 'trending'}
      />
      {empty ? (
        <EmptyState
          icon={<SearchX />}
          title="No titles match these filters"
          className="mt-10"
          action={<Button variant="outline" onClick={() => change({ ...state, ...cleared })}>Clear filters</Button>}
        >
          Try fewer genres, a wider year range or a lower rating.
        </EmptyState>
      ) : (
        <Arrival
          ready={firstPage}
          skeleton={(
            <ul className="grid grid-cols-[repeat(auto-fill,var(--poster-width))] justify-between gap-x-(--poster-gutter) gap-y-8 pt-6">
              {Array.from({ length: SKELETONS }, (_, index) => <li key={index}><SkeletonPosterCard /></li>)}
            </ul>
          )}
        >
        <ul className="grid grid-cols-[repeat(auto-fill,var(--poster-width))] justify-between gap-x-(--poster-gutter) gap-y-8 pt-6">
          {current?.results.map((result, index) => (
            <li
              key={`${result.type}:${result.tmdbId}`}
              className={cn(
                '[contain-intrinsic-size:auto_var(--poster-width)_auto_420px] [content-visibility:auto]',
                index >= (firstCount.current ?? Infinity) && 'animate-content-in',
              )}
            >
              <Card result={result} upcoming={state.sort === 'upcoming' && kind !== 'trending'} />
            </li>
          ))}
          {loading && Array.from({ length: SKELETONS }, (_, index) => (
            <li key={`skeleton:${index}`}>
              <SkeletonPosterCard />
            </li>
          ))}
        </ul>
        </Arrival>
      )}
      {loading && page > 1 && (
        <div className="flex justify-center pt-6">
          <StatusInline status="busy">Loading more titles</StatusInline>
        </div>
      )}
      {current?.status === 'failed' && (
        <Callout
          title="Discover couldn't reach TMDB."
          className="mt-6"
          action={<Button variant="outline" icon={<RotateCw />} onClick={() => setAttempt((count) => count + 1)}>Retry</Button>}
        />
      )}
      <div ref={sentinel} aria-hidden="true" />
      <div className="pt-10">
        <Attribution />
      </div>
    </div>
  );
}
