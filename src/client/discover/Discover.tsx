import { RotateCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { HeaderPage } from '@/components/ui/header-page';
import { StatusInline } from '@/components/ui/status-inline';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getJson } from '../library/api';
import { replace, useLocation, useScreenReady } from '../navigation';
import { Attribution } from './Attribution';
import { openLink } from './Card';
import { FilterBar } from './FilterBar';
import { Grid, TmdbNudge, useOptions } from './Grid';
import {
  extraRowsView,
  gridPath,
  homeQuery,
  readServices,
  readState,
  readStoredState,
  trendingIntro,
  writeServices,
  writeStoredState,
  type HomeReply,
  type HomeState,
  type Row as RowData,
} from './model';
import { Row } from './Row';
import { ServicesDialog } from './ServicesDialog';

const POLL_MS = 3000;
const POLL_LIMIT = 10;

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; url: string; reply: HomeReply; exhausted: boolean }
  | { kind: 'not_configured' }
  | { kind: 'failed' };

// `window` lives only in the page address; the server never sees it.
const homeAddress = (state: HomeState) => {
  const params = new URLSearchParams(homeQuery(state, []));
  if (state.window === 30) params.set('window', '30');
  return params.size === 0 ? '/discover' : `/discover?${params}`;
};

const homeRows = (reply: HomeReply): RowData[] => [
  reply.trending.all, reply.trending.movie, reply.trending.tv,
  ...[reply.popularMovies, reply.popularTv, reply.upcomingMovies?.days30 ?? null, reply.upcomingMovies?.days90 ?? null, reply.upcomingTv]
    .filter((row): row is RowData => row !== null),
  ...reply.services, ...reply.extraRows,
];

/** Discover: the home at /discover, the grids at /discover/movies, /discover/tv and /discover/trending. */
export function Discover({ onUnauthenticated }: { onUnauthenticated: () => void }) {
  const { pathname } = useLocation();
  if (pathname === '/discover/movies') return <Grid key="movies" kind="movies" onUnauthenticated={onUnauthenticated} />;
  if (pathname === '/discover/tv') return <Grid key="tv" kind="tv" onUnauthenticated={onUnauthenticated} />;
  if (pathname === '/discover/trending') return <Grid key="trending" kind="trending" onUnauthenticated={onUnauthenticated} />;
  return <DiscoverHome onUnauthenticated={onUnauthenticated} />;
}

function DiscoverHome({ onUnauthenticated }: { onUnauthenticated: () => void }) {
  const { search } = useLocation();
  // A bare address, including the nav item clicked while already here, starts from the last filters used.
  const state = useMemo(() => (search === '' ? readStoredState() : undefined) ?? readState(search), [search]);
  const [services, setServices] = useState(readServices);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const options = useOptions('both', 'movie', onUnauthenticated);
  // The screen change holds until the rows are in; each row fades its own titles in if they come later.
  useScreenReady(load.kind !== 'loading');

  // The address catches up right after the render; stored defaults give a bare address again, so the check stops a loop.
  useEffect(() => {
    if (search !== '' || homeAddress(state) === '/discover') return;
    replace(homeAddress(state));
  }, [search, state]);

  const change = (next: HomeState) => {
    // Stored first: a bare address re-reads the stored filters.
    writeStoredState(next);
    replace(homeAddress(next));
  };

  const query = homeQuery(state, services);
  const url = query === '' ? '/api/discover/home' : `/api/discover/home?${query}`;

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let polls = 0;
    // A retry of the same address keeps the rows on screen while it runs.
    setLoad((current) => (current.kind === 'ready' && current.url === url ? current : { kind: 'loading' }));
    const fetchHome = () => {
      getJson<HomeReply>(url, onUnauthenticated, controller.signal)
        .then((reply) => {
          if (controller.signal.aborted) return;
          const pending = homeRows(reply).some((row) => row.pending);
          const exhausted = pending && polls >= POLL_LIMIT;
          setLoad({ kind: 'ready', url, reply, exhausted });
          if (pending && !exhausted) {
            polls += 1;
            timer = window.setTimeout(fetchHome, POLL_MS);
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setLoad(error instanceof Error && error.message === 'not_configured' ? { kind: 'not_configured' } : { kind: 'failed' });
        });
    };
    fetchHome();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [url, attempt, onUnauthenticated]);

  if (load.kind === 'not_configured') return <TmdbNudge />;

  const reply = load.kind === 'ready' ? load.reply : undefined;
  // Rows still building after the last re-request show the failed block.
  const settle = (row: RowData | null | undefined): RowData | undefined => (
    row != null && load.kind === 'ready' && load.exhausted && row.pending ? { ...row, failed: true } : row ?? undefined
  );
  const shows = (type: 'movie' | 'tv') => state.type === 'all' || state.type === type;
  const retry = () => setAttempt((count) => count + 1);
  const upcomingMovies = reply?.upcomingMovies;
  const upcomingMoviesRow = upcomingMovies == null ? null : state.window === 30 ? upcomingMovies.days30 : upcomingMovies.days90;
  const serviceRows = reply?.services ?? services
    .filter((id) => state.providers.length === 0 || state.providers.includes(id))
    .map((providerId) => ({ providerId, name: options.providers.find((provider) => provider.id === providerId)?.name ?? null, row: undefined }));
  const extras = reply === undefined ? undefined : extraRowsView(reply.extraRows);

  return (
    <div className="flex flex-col pb-12">
      <HeaderPage
        title="Discover"
        summary="United States"
        action={(
          <Button variant="menu" onClick={() => setDialogOpen(true)}>
            {services.length === 0 ? 'Streaming services' : `Streaming services · ${services.length}`}
          </Button>
        )}
      />
      <FilterBar
        state={state}
        onChange={change}
        genres={options.genres}
        providers={options.providers}
        type={{ value: state.type, options: ['all', 'movie', 'tv'] }}
        window
      />
      {load.kind === 'failed' ? (
        <Callout title="Discover couldn't reach TMDB." className="mt-14" action={<Button variant="outline" icon={<RotateCw />} onClick={retry}>Retry</Button>} />
      ) : (
        <div className="flex flex-col gap-14 pt-14">
          <Row
            heading="Trending"
            intro={trendingIntro(state.type)}
            row={settle(reply?.trending[state.type])}
            ranked
            seeAll={{ label: 'Trending', path: gridPath('trending', state, { type: state.type }) }}
            onRetry={retry}
          />
          {(reply === undefined ? shows('movie') : reply.popularMovies !== null) && (
            <Row
              heading="Popular movies"
              intro="The movies drawing the most attention on TMDB right now."
              row={settle(reply?.popularMovies)}
              seeAll={{ label: 'Popular movies', path: gridPath('movies', state, { sort: 'popular' }) }}
              onRetry={retry}
            />
          )}
          {(reply === undefined ? shows('tv') : reply.popularTv !== null) && (
            <Row
              heading="Popular TV"
              intro="The shows drawing the most attention on TMDB right now."
              row={settle(reply?.popularTv)}
              seeAll={{ label: 'Popular TV', path: gridPath('tv', state, { sort: 'popular' }) }}
              onRetry={retry}
            />
          )}
          {(reply === undefined ? shows('movie') : upcomingMoviesRow !== null) && (
            <Row
              heading="Upcoming movies"
              intro="Soonest first. No ratings until people have seen them."
              control={(
                <ToggleGroup aria-label="Release window" value={String(state.window)} onValueChange={(value) => change({ ...state, window: value === '30' ? 30 : 90 })}>
                  <ToggleGroupItem value="30">Next month</ToggleGroupItem>
                  <ToggleGroupItem value="90">Next 3 months</ToggleGroupItem>
                </ToggleGroup>
              )}
              row={settle(upcomingMoviesRow)}
              upcoming
              seeAll={{ label: 'Upcoming movies', path: gridPath('movies', state, { sort: 'upcoming' }) }}
              onRetry={retry}
            />
          )}
          {(reply === undefined ? shows('tv') : reply.upcomingTv !== null) && (
            <Row
              heading="Upcoming TV"
              intro="Premieres in date order. Shows without a date wait at the end."
              row={settle(reply?.upcomingTv)}
              upcoming
              seeAll={{ label: 'Upcoming TV', path: gridPath('tv', state, { sort: 'upcoming' }) }}
              onRetry={retry}
            />
          )}
          {serviceRows.map((service) => {
            const name = service.name ?? 'Streaming service';
            return (
              <Row
                key={`service:${service.providerId}`}
                heading={name}
                intro={`Streaming on ${name} in the United States.`}
                row={settle('row' in service ? service.row : service)}
                seeAll={{ label: name, path: gridPath(state.type !== 'tv' ? 'movies' : 'tv', { ...state, providers: [service.providerId] }, {}) }}
                onRetry={retry}
              />
            );
          })}
          {extras?.shown.map((row) => <Row key={`extra:${row.id}`} heading={row.label} row={settle(row)} onRetry={retry} />)}
          {extras?.traktMissing === true && (
            <StatusInline status="failed" role="status" className="text-muted-foreground">
              More lists appear once Trakt is added under{' '}
              <a href="/settings" onClick={openLink('/settings')} className="rounded-xs text-foreground focus-ring">Settings › Metadata</a>
            </StatusInline>
          )}
        </div>
      )}
      <div className="pt-14">
        <Attribution />
      </div>
      <ServicesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        providers={options.providers}
        selected={services}
        onSave={(ids) => {
          writeServices(ids);
          setServices(ids);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
