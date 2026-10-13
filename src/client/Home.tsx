import { Settings as SettingsIcon } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AppBarDesktop, AppBarNavItem } from './components/ui/app-bar';
import { Button } from './components/ui/button';
import { InputSearch } from './components/ui/input-search';
import { Discover } from './discover/Discover';
import type { DownloadsState } from './downloads/useDownloads';
import { Library } from './library/Library';
import { inScreenChange, navigate, replace, routeFor, useLocation } from './navigation';
import { readSearchQuery, SearchResults, useDebouncedSearch, useSearch } from './Search';
import { lazyScreen, ScreenLoading } from './lazyScreen';
import { cn } from './lib/utils';
import { Overview } from './title/Overview';

const Settings = lazyScreen(() => import('./settings/Settings').then((module) => module.Settings));
const Calendar = lazyScreen(() => import('./calendar/Calendar').then((module) => module.Calendar));

type HomeProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  signOutLabel: string;
  signOutDisabled: boolean;
  signOutProblem: ReactNode;
  onSignOut: () => void;
  onUnauthenticated: () => void;
  downloadsState: DownloadsState;
  downloads?: ReactNode;
  flagged?: ReactNode;
  history?: ReactNode;
  blocklist?: ReactNode;
  health?: ReactNode;
  needsYou: number;
  downloading: number;
  healthProblems: number;
  healthRisk: boolean;
  renderBar?: (showDownloads: () => void) => ReactNode;
};

// The same limit /api/search checks; a longer query comes back invalid and would read as the server being unreachable.
const MAX_QUERY_LENGTH = 200;

const writeSearchQuery = (query: string) => {
  const url = new URL(window.location.href);
  const trimmed = query.trim();
  if (trimmed === '') url.searchParams.delete('q');
  else url.searchParams.set('q', trimmed);
  // Emptying the box leaves other screens (calendar, downloads, a title) where they are; only the search page goes home.
  if (trimmed !== '') url.pathname = '/search';
  else if (url.pathname === '/search') url.pathname = '/';
  if (url.href !== window.location.href) replace(`${url.pathname}${url.search}`);
};

const navItems = [
  { label: 'Library', path: '/' },
  { label: 'Discover', path: '/discover' },
  { label: 'Calendar', path: '/calendar' },
  { label: 'Downloads', path: '/downloads' },
  { label: 'Flagged', path: '/flagged' },
  { label: 'History', path: '/history' },
  { label: 'Health', path: '/health' },
];

export function Home({ headingRef, signOutLabel, signOutDisabled, signOutProblem, onSignOut, onUnauthenticated, downloadsState, downloads, flagged, history, blocklist, health, needsYou, downloading, healthProblems, healthRisk, renderBar }: HomeProps) {
  const [query, setQuery] = useState(readSearchQuery);
  const { pathname } = useLocation();
  const { state, run } = useSearch(onUnauthenticated);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback((value: string) => {
    writeSearchQuery(value);
    void run(value);
  }, [run]);
  useDebouncedSearch(query, search);

  useEffect(() => {
    // Replacing the address while typing also fires this; keep the typed text unless the address differs from it.
    const onPopState = () => setQuery((current) => (current.trim() === readSearchQuery() ? current : readSearchQuery()));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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

  const view = pathname === '/search' || query.trim() !== '' ? 'search'
    : pathname === '/downloads' ? 'downloads'
      : pathname === '/flagged' ? 'flagged'
      : pathname === '/history' ? 'history'
      : pathname === '/blocklist' ? 'blocklist'
      : pathname === '/health' ? 'health'
      : pathname === '/settings' ? 'settings'
      : pathname === '/calendar' ? 'calendar'
      : pathname === '/discover' || pathname.startsWith('/discover/') ? 'discover'
        : /^\/(series|movie|title)\//.test(pathname) ? 'title'
          : 'library';

  const counts: Record<string, { count: number; risk: boolean }> = {
    '/downloads': { count: downloading, risk: false },
    '/flagged': { count: needsYou, risk: true },
    '/health': { count: healthProblems, risk: healthRisk },
  };

  return (
    <div className="min-h-screen">
      <AppBarDesktop
        className="sticky top-0 z-10"
        productName={<h1 ref={headingRef} tabIndex={-1}>media-manager-2</h1>}
        search={(
          <form
            role="search"
            className="flex min-w-0"
            onSubmit={(event) => {
              event.preventDefault();
              search(query);
            }}
          >
            <InputSearch
              ref={inputRef}
              type="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search library, Sonarr and Radarr"
              placeholder="Search movies and TV shows"
              maxLength={MAX_QUERY_LENGTH}
              value={query}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown' || view !== 'search') return;
                const first = document.querySelector<HTMLElement>('[data-result-row]');
                if (first === null) return;
                event.preventDefault();
                first.focus();
              }}
              onValueChange={(value) => setQuery(value)}
              onClear={() => setQuery('')}
              kbd="/"
              wrapperClassName="w-160 min-w-0"
            />
          </form>
        )}
        nav={navItems.map((item) => {
          const current = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
          return (
            <AppBarNavItem
              key={item.path}
              href={item.path}
              current={current}
              count={counts[item.path]?.count}
              countRisk={counts[item.path]?.risk}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                setQuery('');
                navigate(item.path);
              }}
            >
              {item.label}
            </AppBarNavItem>
          );
        })}
        actions={(
          <>
            <Button
              variant="ghost"
              iconOnly
              icon={<SettingsIcon />}
              aria-label="Settings"
              aria-current={view === 'settings' ? 'page' : undefined}
              className={cn('[&>svg]:size-4.5', view === 'settings' ? 'bg-selected text-foreground' : 'text-muted-foreground')}
              onClick={() => {
                setQuery('');
                navigate('/settings');
              }}
            />
            {signOutProblem}
            <Button variant="ghost" onClick={onSignOut} disabled={signOutDisabled}>
              {signOutLabel}
            </Button>
          </>
        )}
      />
      <main className="isolate px-(--page-margin) pb-(--livebar)">
        {/* Each title page counts as its own screen. Screen changes crossfade in navigation.ts; a view swap outside one, such
            as typing in the search box, fades in here instead. */}
        <div key={view === 'title' ? pathname : view} className={cn(!inScreenChange() && 'transition-opacity duration-(--duration-fast) ease-out starting:opacity-0')}>
        {/* Inside the keyed view, so a screen still loading its chunk blanks only itself, never the bar or a mounted screen. */}
        <Suspense fallback={<ScreenLoading />}>
        {view === 'search'
          ? <SearchResults state={state} onOpen={(result) => navigate(routeFor(result), result)} onRetry={() => search(query)} />
          : view === 'downloads'
            ? downloads
            : view === 'flagged' ? flagged
            : view === 'history' ? history
            : view === 'blocklist' ? blocklist
            : view === 'health' ? health
            : view === 'settings' ? <Settings onUnauthenticated={onUnauthenticated} />
            : view === 'calendar'
              ? <Calendar downloads={downloadsState} onUnauthenticated={onUnauthenticated} />
              : view === 'discover'
                ? <Discover onUnauthenticated={onUnauthenticated} />
              : view === 'title'
                ? <Overview downloads={downloadsState} onUnauthenticated={onUnauthenticated} />
                : <Library downloads={downloadsState} onUnauthenticated={onUnauthenticated} />}
        </Suspense>
        </div>
      </main>
      {renderBar?.(() => {
        setQuery('');
        navigate('/downloads');
      })}
    </div>
  );
}
