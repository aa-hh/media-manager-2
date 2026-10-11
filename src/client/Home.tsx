import { useCallback, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Button } from './components/ui/button';
import { Calendar } from './calendar/Calendar';
import type { DownloadsState } from './downloads/useDownloads';
import { Library } from './library/Library';
import { navigate, replace, routeFor, useLocation } from './navigation';
import { readSearchQuery, SearchBox, SearchResults, useDebouncedSearch, useSearch } from './Search';
import { Overview } from './title/Overview';

type HomeProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  signOutLabel: string;
  signOutDisabled: boolean;
  signOutProblem: ReactNode;
  onSignOut: () => void;
  onUnauthenticated: () => void;
  downloadsState: DownloadsState;
  downloads?: ReactNode;
  renderBar?: (showDownloads: () => void) => ReactNode;
};

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

const navItems = [{ label: 'Library', path: '/' }, { label: 'Calendar', path: '/calendar' }, { label: 'Downloads', path: '/downloads' }];

export function Home({ headingRef, signOutLabel, signOutDisabled, signOutProblem, onSignOut, onUnauthenticated, downloadsState, downloads, renderBar }: HomeProps) {
  const [query, setQuery] = useState(readSearchQuery);
  const { pathname } = useLocation();
  const { state, run } = useSearch(onUnauthenticated);

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

  const view = pathname === '/search' || query.trim() !== '' ? 'search'
    : pathname === '/downloads' ? 'downloads'
      : pathname === '/calendar' ? 'calendar'
        : /^\/(series|movie|title)\//.test(pathname) ? 'title'
          : 'library';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-[var(--border)] bg-[var(--ground)] px-4 sm:px-6">
        <h1 ref={headingRef} tabIndex={-1} className="shrink-0 text-base font-semibold tracking-[-0.01em] text-[var(--ink)] max-sm:sr-only">
          media-manager-2
        </h1>
        <SearchBox
          value={query}
          onChange={setQuery}
          onSubmit={search}
        />
        <nav aria-label="Main" className="flex shrink-0 items-center gap-4">
          {navItems.map((item) => {
            const current = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
            return (
              <a
                key={item.path}
                href={item.path}
                aria-current={current ? 'page' : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  setQuery('');
                  navigate(item.path);
                }}
                className={current ? 'text-sm font-semibold text-[var(--ink)]' : 'text-sm text-[var(--secondary-ink)] hover:text-[var(--ink)]'}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {signOutProblem}
          <Button variant="quiet" className="min-h-9 px-3 text-sm" onClick={onSignOut} disabled={signOutDisabled}>
            {signOutLabel}
          </Button>
        </div>
      </header>
      <main>
        {view === 'search'
          ? <SearchResults state={state} onOpen={(result) => navigate(routeFor(result), result)} onRetry={() => search(query)} />
          : view === 'downloads'
            ? downloads
            : view === 'calendar'
              ? <Calendar downloads={downloadsState} onUnauthenticated={onUnauthenticated} />
              : view === 'title'
                ? <Overview downloads={downloadsState} onUnauthenticated={onUnauthenticated} />
                : <Library downloads={downloadsState} onUnauthenticated={onUnauthenticated} />}
      </main>
      {renderBar?.(() => {
        setQuery('');
        navigate('/downloads');
      })}
    </div>
  );
}
