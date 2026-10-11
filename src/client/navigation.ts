import { useEffect, useState } from 'react';
import type { SearchResult } from './Search';

const announce = () => window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));

export const navigate = (path: string, state?: unknown) => {
  window.history.pushState(state ?? null, '', path);
  announce();
};

export const replace = (path: string, state?: unknown) => {
  window.history.replaceState(state ?? null, '', path);
  announce();
};

type Location = { pathname: string; search: string; state: unknown };

const read = (): Location => ({ pathname: window.location.pathname, search: window.location.search, state: window.history.state });

export function useLocation(): Location {
  const [location, setLocation] = useState(read);
  useEffect(() => {
    const onChange = () => setLocation(read());
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return location;
}

export const routeFor = (result: SearchResult) => {
  if (result.inLibrary && result.libraryId !== null) return `/${result.type === 'tv' ? 'series' : 'movie'}/${result.libraryId}`;
  return result.type === 'tv' ? `/title/tvdb/${result.tvdbId}` : `/title/tmdb/${result.tmdbId}`;
};
