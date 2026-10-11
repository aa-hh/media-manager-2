import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { SearchResult } from './Search';

const announce = () => window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));

// A new screen opens at the top; back and forward keep the browser's own scroll restore.
export const navigate = (path: string, state?: unknown) => {
  window.history.pushState(state ?? null, '', path);
  window.scrollTo({ top: 0, behavior: 'instant' });
  announce();
};

/** Waits until these images are downloaded and decoded, or the wait runs out, whichever comes first. */
export const preloadImages = (urls: Array<string | null | undefined>, maxWaitMs: number) => Promise.race([
  Promise.all(urls.flatMap((url) => {
    if (url === null || url === undefined) return [];
    const image = new Image();
    image.src = url;
    return [image.decode().catch(() => undefined)];
  })),
  new Promise((resolve) => setTimeout(resolve, maxWaitMs)),
]);

// The large poster on a title page and the card poster it grew from share this name, so the browser morphs one into the other.
export const TITLE_POSTER = 'title-poster';

let pending: Promise<unknown> = Promise.resolve();

/**
 * Runs a screen update inside a view transition: the page crossfades and named elements morph (globals.css sets the timing).
 * Transitions queue so a fast data load never cuts a running morph short. Without browser support, or under reduced motion,
 * the update runs at once.
 */
export const withViewTransition = (update: () => void) => {
  if (typeof document.startViewTransition !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  pending = pending
    .then(() => document.startViewTransition(() => flushSync(update)).finished)
    .catch(() => undefined);
};

/**
 * Follows a link; when the link holds a poster card's poster ([data-poster]), that poster morphs into the title page's
 * large poster, and its image address rides along in the history entry so the loading page can show it at once.
 */
export const navigateFrom = (path: string, link: Element) => {
  const poster = link.querySelector<HTMLElement>('[data-poster]');
  if (poster === null) {
    navigate(path);
    return;
  }
  const image = poster.querySelector('img');
  const posterUrl = image !== null && image.complete && image.naturalWidth > 0 ? image.currentSrc : undefined;
  poster.style.viewTransitionName = TITLE_POSTER;
  withViewTransition(() => {
    // The old page was already captured; only the new page may carry the name now.
    poster.style.viewTransitionName = '';
    navigate(path, posterUrl === undefined ? undefined : { posterUrl });
  });
};

/** The poster address a poster card passed along, if this history entry came from one. */
export const passedPosterUrl = (state: unknown): string | undefined => (
  typeof state === 'object' && state !== null && 'posterUrl' in state && typeof state.posterUrl === 'string' ? state.posterUrl : undefined
);

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
