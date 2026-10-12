import { ArrowDown, ArrowUp, Check, CornerDownLeft, Plus, SearchX } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderResults } from '@/components/ui/header-results';
import { Kbd } from '@/components/ui/kbd';
import { LabelGroup } from '@/components/ui/label-group';
import { RowSearchResult } from '@/components/ui/row-search-result';
import { SkeletonSearchResult } from '@/components/ui/skeleton';
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
  files: number | null;
  tvdbId: number | null;
  tmdbId: number | null;
  imdbId: string | null;
};

type ServiceOutcome = { kind: 'ok'; count: number } | { kind: 'pending' | 'skipped' | 'not_configured' | 'unreachable' | 'rejected' };
type SearchResponse = { results: SearchResult[]; services: { sonarr: ServiceOutcome; radarr: ServiceOutcome } };

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; query: string; previous?: SearchResponse }
  | { kind: 'done'; query: string; response: SearchResponse }
  | { kind: 'failed'; query: string };

type Filter = 'all' | 'tv' | 'movie';

const SEARCH_DELAY_MS = 250;

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

// Only the first of the server's two answers can have a service still pending.
const pendingService = ({ services }: SearchResponse) => (
  services.sonarr.kind === 'pending' ? 'Sonarr' : services.radarr.kind === 'pending' ? 'Radarr' : undefined
);

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
      if (!response.ok || response.body === null) throw new Error();
      // A line of JSON arrives when the first service answers with results, and a last one once both have.
      let last: SearchResponse | undefined;
      let buffered = '';
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        const lines = (buffered + chunk.value).split('\n');
        buffered = lines.pop() ?? '';
        for (const line of lines) {
          last = JSON.parse(line) as SearchResponse;
          if (!Array.isArray(last.results)) throw new Error();
          setState({ kind: 'done', query: trimmed, response: last });
        }
      }
      if (last === undefined || pendingService(last) !== undefined) throw new Error();
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

// Each service's results land on their own, Radarr's usually a second before Sonarr's, and the second batch is
// merged in between the first. Rows that stay glide from their old place to the new one and arriving rows fade in
// and rise one after another, so the reshuffle reads as the list making room instead of jumping under the pointer.
// Under reduced motion nothing glides and arriving rows only fade.
// It reads every row's layout, so it runs only when the shown results change, not on each keystroke or downloads event.
function useRowMotion(listRef: RefObject<HTMLElement | null>, visible: SearchResult[]) {
  const placed = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const list = listRef.current;
    const before = placed.current;
    if (list === null) {
      placed.current = new Map();
      return;
    }
    const style = getComputedStyle(list);
    const token = (name: string) => style.getPropertyValue(name).trim();
    // The built stylesheet may write 160ms as .16s.
    const milliseconds = (name: string) => parseFloat(token(name)) * (token(name).endsWith('ms') ? 1 : 1000);
    const easing = token('--ease-out');
    const glide = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rows = [...list.querySelectorAll<HTMLElement>('[data-motion-key]')].map((element) => ({
      element,
      key: element.dataset.motionKey ?? '',
      top: element.offsetTop,
      // A row still gliding from the last change starts from where it is drawn, not from where it was laid out.
      drawn: new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
    }));
    placed.current = new Map(rows.map(({ key, top }) => [key, top]));
    let arriving = 0;
    for (const { element, key, top, drawn } of rows) {
      const was = before.get(key);
      if (was === undefined) {
        element.animate(
          { opacity: [0, 1], transform: [`translateY(${token('--motion-rise-6')})`, 'none'] },
          { duration: milliseconds('--duration-base'), easing, delay: Math.min(arriving++, 6) * 25, fill: 'backwards' },
        );
      } else if (glide && was !== top) {
        for (const animation of element.getAnimations()) animation.cancel();
        element.animate({ transform: [`translateY(${was + drawn - top}px)`, 'none'] }, { duration: milliseconds('--duration-slow'), easing });
      }
    }
  }, [listRef, visible]);
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
    <li data-motion-key={result.key}>
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
        status={result.inLibrary ? <Badge variant="plain" icon={<Check aria-hidden="true" />}>In library</Badge> : undefined}
        files={result.files === null ? undefined : result.files === 0 ? 'No file yet' : `${result.files} file${result.files === 1 ? '' : 's'}`}
        // The row already opens the title page, where adding happens; this only looks like the outline Add button, so it is
        // neither a button nor focusable, and its click falls through to the row.
        action={result.inLibrary ? undefined : (
          <span
            aria-hidden="true"
            className="inline-flex h-(--control-h-row) shrink-0 items-center justify-center gap-1.5 rounded-(--control-radius-row) border border-input bg-card px-(--control-px-row) font-ui text-(length:--control-text-row) font-semibold whitespace-nowrap text-foreground [&>svg]:size-(--control-icon-row)"
          >
            <Plus />
            Add
          </span>
        )}
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
      <LabelGroup data-motion-key={`group:${label}`} count={results.length}>{label}</LabelGroup>
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
  const visible = useMemo(() => (filter === 'all' ? results : results.filter((result) => result.type === filter)), [results, filter]);
  const waiting = state.kind === 'done' ? pendingService(state.response) : undefined;
  const loading = state.kind === 'searching' || waiting !== undefined;
  useRowMotion(listRef, visible);

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
      <div className="pt-12 sm:pl-41">
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
    <section aria-label="Search results" className="pt-2 pb-6 sm:pl-41">
      <div className="flex w-220 max-w-full flex-col">
        <HeaderResults
          count={state.kind === 'searching'
            ? <span className="flex items-center gap-2"><Spinner className="size-4.5" />Searching Sonarr and Radarr…</span>
            : response === undefined ? 'Results for' : `${results.length} ${results.length === 1 ? 'result' : 'results'} for`}
          query={`“${state.query}”`}
          filter={(
            <ToggleGroup aria-label="Show" value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <ToggleGroupItem value="all" count={counts.all}>All</ToggleGroupItem>
              <ToggleGroupItem value="tv" count={waiting === 'Sonarr' ? <Spinner className="size-3" /> : counts.tv}>TV</ToggleGroupItem>
              <ToggleGroupItem value="movie" count={waiting === 'Radarr' ? <Spinner className="size-3" /> : counts.movie}>Movies</ToggleGroupItem>
            </ToggleGroup>
          )}
        />
        <p className="sr-only" aria-live="polite">
          {state.kind === 'searching'
            ? 'Searching…'
            : waiting !== undefined ? `${results.length} results so far, still searching ${waiting}` : state.kind === 'done' ? `${results.length} results` : ''}
        </p>
        {(state.kind === 'failed' || problems.length > 0) && (
          <div className="flex flex-col gap-2 pt-1 pb-3">
            {state.kind === 'failed' && <Callout title="The search didn't reach media-manager-2's server." action={retry} />}
            {problems.map((problem) => <Callout key={problem} title={problem} action={retry} />)}
          </div>
        )}
        {loading && visible.length === 0 && Array.from({ length: 4 }, (_, index) => <SkeletonSearchResult key={index} />)}
        {state.kind === 'done' && waiting === undefined && results.length === 0 && !bothFailed && (
          <div className="flex justify-center pt-16">
            <EmptyState icon={<SearchX aria-hidden="true" />} title={`Nothing matches “${state.query}” in Sonarr or Radarr.`} className="w-130" />
          </div>
        )}
        {visible.length > 0 && (
          <>
            <div
              ref={listRef}
              className={cn('relative transition-opacity duration-(--duration-base) ease-out', state.kind === 'searching' && 'opacity-60')}
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
