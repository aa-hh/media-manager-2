import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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

export function SearchBox({ value, onChange, onSubmit }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <form
      role="search"
      className="relative w-full max-w-[26rem]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <label htmlFor="global-search" className="sr-only">Search library, Sonarr and Radarr</label>
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search library, Sonarr and Radarr"
        className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--control)] pl-3 pr-9 text-sm text-[var(--ink)] placeholder:text-[var(--secondary-ink)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]"
      />
      <kbd aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--border)] px-1.5 text-xs text-[var(--secondary-ink)]">/</kbd>
    </form>
  );
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

export function Chip({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'filled' }) {
  return (
    <span className={cn(
      'inline-flex h-5 items-center whitespace-nowrap rounded px-1.5 text-xs font-medium leading-none',
      tone === 'filled'
        ? 'bg-[var(--quiet-hover)] text-[var(--ink)]'
        : 'border border-[var(--border)] text-[var(--secondary-ink)]',
    )}
    >
      {children}
    </span>
  );
}

export function Poster({ url, className }: { url: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (url === null || failed) {
    return <div aria-hidden="true" className={cn('shrink-0 bg-[var(--quiet-hover)]', className)} />;
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('shrink-0 bg-[var(--quiet-hover)] object-cover', className)}
    />
  );
}

export const statusLabel = (status: string | null) => (status === null ? null : statusLabels[status] ?? null);

function ResultRow({ result, onOpen, onKeyDown }: {
  result: SearchResult;
  onOpen: (result: SearchResult) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const status = statusLabel(result.status);
  return (
    <li>
      <button
        type="button"
        data-result-row
        onClick={() => onOpen(result)}
        onKeyDown={onKeyDown}
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--control-hover)] focus-visible:bg-[var(--control-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)] sm:px-6"
      >
        <Poster url={result.posterUrl} className="h-[4.5rem] w-12 rounded-sm" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-[var(--ink)]">{result.title}</span>
            {result.year !== null && <span className="tabular-nums text-[var(--secondary-ink)]">{result.year}</span>}
            <Chip>{result.type === 'tv' ? 'TV' : 'Movie'}</Chip>
            {result.network !== null && <span className="text-sm text-[var(--secondary-ink)]">{result.network}</span>}
            {status !== null && <Chip>{status}</Chip>}
            {result.rating !== null && <Chip>{`${result.rating.toFixed(1)} ★`}</Chip>}
          </span>
          {result.overview !== null && (
            <span className="mt-1 block truncate text-sm text-[var(--secondary-ink)]">{result.overview}</span>
          )}
        </span>
        {result.inLibrary && (
          <span className="shrink-0 self-center">
            <Chip tone="filled">✓ In library</Chip>
          </span>
        )}
      </button>
    </li>
  );
}

export function SearchResults({ state, onOpen, onRetry }: {
  state: SearchState;
  onOpen: (result: SearchResult) => void;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const listRef = useRef<HTMLUListElement>(null);
  const response = state.kind === 'done' ? state.response : state.kind === 'searching' ? state.previous : undefined;
  const results = useMemo(() => response?.results ?? [], [response]);
  const counts = useMemo(() => ({
    all: results.length,
    tv: results.filter((result) => result.type === 'tv').length,
    movie: results.filter((result) => result.type === 'movie').length,
  }), [results]);
  const visible = filter === 'all' ? results : results.filter((result) => result.type === filter);

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const rows = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-result-row]') ?? [])];
    const index = rows.indexOf(event.currentTarget);
    rows[Math.min(rows.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  if (state.kind === 'idle') {
    return (
      <p className="px-4 py-10 text-[var(--secondary-ink)] sm:px-6">
        Search by name, or paste an IMDb id (tt…), tmdb:… or tvdb:…
      </p>
    );
  }

  const problems = response === undefined ? [] : [
    serviceProblem('Sonarr', response.services.sonarr),
    serviceProblem('Radarr', response.services.radarr),
  ].filter((problem): problem is string => problem !== undefined);
  const bothFailed = response !== undefined && problems.length === 2;

  return (
    <section aria-labelledby="search-heading" className="pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-6 sm:px-6">
        <h2 id="search-heading" className="text-lg font-semibold text-[var(--ink)]">
          Results for “{state.query}”
        </h2>
        <div role="group" aria-label="Show" className="flex rounded-md border border-[var(--border)] p-0.5">
          {(['all', 'tv', 'movie'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                'h-7 rounded px-2.5 text-sm font-medium tabular-nums',
                filter === value ? 'bg-[var(--ink)] text-[var(--control)]' : 'text-[var(--secondary-ink)] hover:text-[var(--ink)]',
              )}
            >
              {value === 'all' ? 'All' : value === 'tv' ? 'TV' : 'Movies'} {counts[value]}
            </button>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {state.kind === 'searching' ? 'Searching…' : state.kind === 'done' ? `${results.length} results` : ''}
      </p>
      {state.kind === 'searching' && (
        <p className="px-4 pb-2 text-sm text-[var(--secondary-ink)] sm:px-6">Searching Sonarr and Radarr…</p>
      )}
      {state.kind === 'failed' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3 text-[#b42318] sm:px-6">
          The search didn't reach media-manager-2's server.
          <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">Try again</button>
        </div>
      )}
      {problems.map((problem) => (
        <p key={problem} role="alert" className="px-4 py-1 text-sm text-[#b42318] sm:px-6">{problem}</p>
      ))}
      {state.kind === 'done' && results.length === 0 && !bothFailed && (
        <p className="px-4 py-6 text-[var(--secondary-ink)] sm:px-6">Nothing matches “{state.query}” in Sonarr or Radarr.</p>
      )}
      {visible.length > 0 && (
        <ul ref={listRef} className={cn('divide-y divide-[var(--border)] border-y border-[var(--border)]', state.kind === 'searching' && 'opacity-60')}>
          {visible.map((result) => (
            <ResultRow key={result.key} result={result} onOpen={onOpen} onKeyDown={moveFocus} />
          ))}
        </ul>
      )}
    </section>
  );
}
