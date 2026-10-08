import { useCallback, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Button } from './components/ui/button';
import { readSearchQuery, SearchBox, SearchResults, useDebouncedSearch, useSearch, type SearchResult } from './Search';
import { TitleView } from './Title';

type HomeProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  signOutLabel: string;
  signOutDisabled: boolean;
  signOutProblem: ReactNode;
  onSignOut: () => void;
  onUnauthenticated: () => void;
};

const writeSearchQuery = (query: string) => {
  const url = new URL(window.location.href);
  const trimmed = query.trim();
  if (trimmed === '') url.searchParams.delete('q');
  else url.searchParams.set('q', trimmed);
  url.pathname = trimmed === '' ? '/' : '/search';
  if (url.href !== window.location.href) window.history.replaceState(null, '', url);
};

export function Home({ headingRef, signOutLabel, signOutDisabled, signOutProblem, onSignOut, onUnauthenticated }: HomeProps) {
  const [query, setQuery] = useState(readSearchQuery);
  const [opened, setOpened] = useState<SearchResult | undefined>(undefined);
  const { state, run } = useSearch(onUnauthenticated);

  const search = useCallback((value: string) => {
    writeSearchQuery(value);
    void run(value);
  }, [run]);
  useDebouncedSearch(query, search);

  useEffect(() => {
    const onPopState = () => setQuery(readSearchQuery());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-[var(--border)] bg-[var(--ground)] px-4 sm:px-6">
        <h1 ref={headingRef} tabIndex={-1} className="shrink-0 text-base font-semibold tracking-[-0.01em] text-[var(--ink)] max-sm:sr-only">
          media-manager-2
        </h1>
        <SearchBox
          value={query}
          onChange={(value) => {
            setOpened(undefined);
            setQuery(value);
          }}
          onSubmit={(value) => {
            setOpened(undefined);
            search(value);
          }}
        />
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {signOutProblem}
          <Button variant="quiet" className="min-h-9 px-3 text-sm" onClick={onSignOut} disabled={signOutDisabled}>
            {signOutLabel}
          </Button>
        </div>
      </header>
      <main>
        {opened === undefined
          ? <SearchResults state={state} onOpen={setOpened} onRetry={() => search(query)} />
          : (
            <TitleView
              result={opened}
              onBack={() => setOpened(undefined)}
              onAdded={(libraryId) => setOpened({ ...opened, inLibrary: true, libraryId })}
              onUnauthenticated={onUnauthenticated}
            />
          )}
      </main>
    </div>
  );
}
