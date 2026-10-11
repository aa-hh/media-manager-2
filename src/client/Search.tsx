import { ArrowDown, ArrowUp, CornerDownLeft, Plus, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderResults } from '@/components/ui/header-results';
import { Kbd } from '@/components/ui/kbd';
import { LabelGroup } from '@/components/ui/label-group';
import { RowSearchResult } from '@/components/ui/row-search-result';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export type SearchResult = {
  type: 'tv' | 'movie';
  service: 'sonarr' | 'radarr';
  key: string;
  title: string;
  year: number | null;
  network: string | null;
  status: string | null;
  rating: number | null;
  overview: string | null;
  posterUrl: string | null;
  inLibrary: boolean;
  libraryId: number | null;
  tvdbId: number | null;
  tmdbId: number | null;
  imdbId: string | null;
};

type ServiceOutcome = { kind: 'ok'; count: number } | { kind: 'skipped' | 'not_configured' | 'unreachable' | 'rejected' };
type SearchResponse = { results: SearchResult[]; services: { sonarr: ServiceOutcome; radarr: ServiceOutcome } };

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; query: string; previous?: SearchResponse }
  | { kind: 'done'; query: string; response: SearchResponse }
  | { kind: 'failed'; query: string };

type Filter = 'all' | 'tv' | 'movie';

const SEARCH_DELAY_MS = 450;

const statusLabels: Record<string, string> = {
  continuing: 'Continuing',
  ended: 'Ended',
  upcoming: 'Upcoming',
  tba: 'TBA',
  announced: 'Announced',
  inCinemas: 'In cinemas',
  released: 'Released',
};

const serviceProblem = (name: 'Sonarr' | 'Radarr', outcome: ServiceOutcome) => {
  const missing = name === 'Sonarr' ? 'TV results' : 'Movie results';
  if (outcome.kind === 'not_configured') return `${name} isn't connected yet, so ${missing.toLowerCase()} are missing.`;
  if (outcome.kind === 'rejected') return `${name} refused the API key, so ${missing.toLowerCase()} are missing.`;
  if (outcome.kind === 'unreachable') return `${name} didn't answer, so ${missing.toLowerCase()} are missing.`;
  return undefined;
};

export const readSearchQuery = () => new URLSearchParams(window.location.search).get('q') ?? '';

export function useSearch(onUnauthenticated: () => void) {
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;

  const run = useCallback(async (query: string) => {
    controllerRef.current?.abort();
    const trimmed = query.trim();
    if (trimmed === '') {
      setState({ kind: 'idle' });
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const current = stateRef.current;
    setState({
      kind: 'searching',
      query: trimmed,
      previous: current.kind === 'done' ? current.response : current.kind === 'searching' ? current.previous : undefined,
    });
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 401) {
        onUnauthenticated();
        return;
      }
      if (!response.ok) throw new Error();
      const body = await response.json() as SearchResponse;
      if (!Array.isArray(body.results)) throw new Error();
      setState({ kind: 'done', query: trimmed, response: body });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState({ kind: 'failed', query: trimmed });
    }
  }, [onUnauthenticated]);

  useEffect(() => () => controllerRef.current?.abort(), []);
  return { state, run };
}

export function useDebouncedSearch(query: string, run: (query: string) => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (query.trim() !== '') run(query);
      return;
    }
    const timeout = window.setTimeout(() => run(query), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [query, run]);
}

export function Poster({ url, className }: { url: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (url === null || failed) {
    return <div aria-hidden="true" className={cn('shrink-0 bg-muted', className)} />;
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('shrink-0 bg-muted object-cover', className)}
    />
  );
}

export const statusLabel = (status: string | null) => (status === null ? null : statusLabels[status] ?? null);

function ResultRow({ result, onOpen, onKeyDown }: {
  result: SearchResult;
  onOpen: (result: SearchResult) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const status = statusLabel(result.status);
  const meta = [
    result.type === 'tv' ? 'TV' : 'Movie',
    result.network,
    status,
    result.rating === null ? null : `★ ${result.rating.toFixed(1)}`,
  ].filter((part) => part !== null).join(' · ');
  return (
    <li>
      <RowSearchResult
        data-result-row
        role="link"
        tabIndex={0}
        onClick={() => onOpen(result)}
        onKeyDown={onKeyDown}
        poster={result.posterUrl ?? undefined}
        title={result.title}
        year={result.year ?? undefined}
        meta={meta}
        overview={result.overview ?? undefined}
        status={result.inLibrary ? <Badge variant="strong">In library</Badge> : undefined}
        // The row already opens the title page, where adding happens; the button only shows the way and passes its click to the row.
        action={result.inLibrary ? undefined : <Button variant="outline" icon={<Plus aria-hidden="true" />} tabIndex={-1} aria-hidden="true">Add</Button>}
      />
    </li>
  );
}

function ResultGroup({ label, results, onOpen, onKeyDown }: {
  label: string;
  results: SearchResult[];
  onOpen: (result: SearchResult) => void;
  onKeyDown: (result: SearchResult) => (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  if (results.length === 0) return null;
  return (
    <>
      <LabelGroup count={results.length}>{label}</LabelGroup>
      <ul>
        {results.map((result) => <ResultRow key={result.key} result={result} onOpen={onOpen} onKeyDown={onKeyDown(result)} />)}
      </ul>
    </>
  );
}

export function SearchResults({ state, onOpen, onRetry }: {
  state: SearchState;
  onOpen: (result: SearchResult) => void;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const listRef = useRef<HTMLDivElement>(null);
  const response = state.kind === 'done' ? state.response : state.kind === 'searching' ? state.previous : undefined;
  const results = useMemo(() => response?.results ?? [], [response]);
  const counts = useMemo(() => ({
    all: results.length,
    tv: results.filter((result) => result.type === 'tv').length,
    movie: results.filter((result) => result.type === 'movie').length,
  }), [results]);
  const visible = filter === 'all' ? results : results.filter((result) => result.type === filter);

  const rowKeys = (result: SearchResult) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onOpen(result);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-result-row]') ?? [])];
    const index = rows.indexOf(event.currentTarget);
    rows[Math.min(rows.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  if (state.kind === 'idle') {
    return (
      <div className="pt-12 pl-41">
        <p className="w-220 max-w-full font-ui text-base text-muted-foreground">
          Search by name, or paste an IMDb id (tt…), tmdb:… or tvdb:…
        </p>
      </div>
    );
  }

  const problems = response === undefined ? [] : [
    serviceProblem('Sonarr', response.services.sonarr),
    serviceProblem('Radarr', response.services.radarr),
  ].filter((problem): problem is string => problem !== undefined);
  const bothFailed = response !== undefined && problems.length === 2;
  const retry = <Button variant="outline" onClick={onRetry}>Try again</Button>;

  return (
    <section aria-label="Search results" className="pt-2 pb-6 pl-41">
      <div className="flex w-220 max-w-full flex-col">
        <HeaderResults
          count={state.kind === 'searching'
            ? <span className="flex items-center gap-2"><Spinner className="size-4.5" />Searching Sonarr and Radarr…</span>
            : response === undefined ? 'Results for' : `${results.length} ${results.length === 1 ? 'result' : 'results'} for`}
          query={`“${state.query}”`}
          filter={(
            <ToggleGroup aria-label="Show" value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <ToggleGroupItem value="all" count={counts.all}>All</ToggleGroupItem>
              <ToggleGroupItem value="tv" count={counts.tv}>TV</ToggleGroupItem>
              <ToggleGroupItem value="movie" count={counts.movie}>Movies</ToggleGroupItem>
            </ToggleGroup>
          )}
        />
        <p className="sr-only" aria-live="polite">
          {state.kind === 'searching' ? 'Searching…' : state.kind === 'done' ? `${results.length} results` : ''}
        </p>
        {(state.kind === 'failed' || problems.length > 0) && (
          <div className="flex flex-col gap-2 pt-1 pb-3">
            {state.kind === 'failed' && <Callout title="The search didn't reach media-manager-2's server." action={retry} />}
            {problems.map((problem) => <Callout key={problem} title={problem} action={retry} />)}
          </div>
        )}
        {state.kind === 'done' && results.length === 0 && !bothFailed && (
          <div className="flex justify-center pt-16">
            <EmptyState icon={<SearchX aria-hidden="true" />} title={`Nothing matches “${state.query}” in Sonarr or Radarr.`} className="w-130" />
          </div>
        )}
        {visible.length > 0 && (
          <>
            <div
              ref={listRef}
              className={cn('transition-opacity duration-(--duration-base) ease-out', state.kind === 'searching' && 'opacity-60')}
            >
              <ResultGroup label="In your library" results={visible.filter((result) => result.inLibrary)} onOpen={onOpen} onKeyDown={rowKeys} />
              <ResultGroup label="From Sonarr and Radarr" results={visible.filter((result) => !result.inLibrary)} onOpen={onOpen} onKeyDown={rowKeys} />
            </div>
            <div className="flex items-center gap-5 px-4 pt-4 text-label font-normal text-subtle-foreground">
              <span className="flex items-center gap-1">
                <Kbd icon={<ArrowUp aria-hidden="true" />} aria-label="Up arrow" />
                <Kbd icon={<ArrowDown aria-hidden="true" />} aria-label="Down arrow" />
                Move
              </span>
              <span className="flex items-center gap-1">
                <Kbd icon={<CornerDownLeft aria-hidden="true" />} aria-label="Enter" />
                Open
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
