import { useEffect, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { SearchResult } from './Search';

/*
 * Screen changes. Every change of screen goes through changeScreen: link clicks (navigate, navigateFrom) and the browser's
 * back and forward buttons. It runs as one view transition: the old screen stays frozen on screen while the new one renders
 * and, if the new screen loads data (useScreenReady), until that data is in or HOLD_MS passes; then the two crossfade and a
 * poster card's poster morphs into the title page's poster (timing in globals.css). A fast load therefore never shows a
 * skeleton, and there is never a second whole-page transition when data arrives: content that comes later fades in by
 * itself (useLateArrival). Reduced motion, a hidden tab or a browser without view transitions get an instant change.
 */

// razor: one fixed wait for every screen; the new screen shows its skeleton after it. Upgrade path is a per-screen budget.
const HOLD_MS = 350;

// The large poster on a title page and the card poster it grew from share this name, so the browser morphs one into the other.
export const TITLE_POSTER = 'title-poster';

// Screens own their scroll position: a new screen opens at the top, back and forward return to where that address was left.
window.history.scrollRestoration = 'manual';
const scrollByAddress = new Map<string, number>();
const address = () => `${window.location.pathname}${window.location.search}`;

let announcing = false;
const announce = () => {
  announcing = true;
  try {
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  } finally {
    announcing = false;
  }
};

type Hold = { claimed: boolean; release: () => void };
// The screen change waiting for its new screen to be ready, if any.
let hold: Hold | undefined;
// Where the new screen should scroll to once it is drawn; a screen still loading is too short to scroll yet.
let pendingScroll: number | undefined;
const applyScroll = () => {
  if (pendingScroll === undefined) return;
  window.scrollTo({ top: pendingScroll, behavior: 'instant' });
  pendingScroll = undefined;
};

const animate = () => typeof document.startViewTransition === 'function'
  && document.visibilityState === 'visible'
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const changeScreen = (update: () => void, scrollTop: number, morph?: HTMLElement) => {
  pendingScroll = scrollTop;
  if (!animate()) {
    update();
    // Applied again by useScreenReady if the screen is still loading and too short.
    window.scrollTo({ top: scrollTop, behavior: 'instant' });
    return;
  }
  if (morph !== undefined) morph.style.viewTransitionName = TITLE_POSTER;
  document.startViewTransition(async () => {
    // The old screen is captured; only the new screen may carry the poster's name now.
    if (morph !== undefined) morph.style.viewTransitionName = '';
    let release = () => {};
    const ready = new Promise<void>((resolve) => { release = resolve; });
    const current: Hold = { claimed: false, release };
    hold = current;
    flushSync(update);
    // A screen that loads data claimed the hold while it rendered; any other screen is ready now.
    if (!current.claimed) release();
    await Promise.race([ready, new Promise((resolve) => setTimeout(resolve, HOLD_MS))]);
    if (hold === current) hold = undefined;
    applyScroll();
  });
};

// The browser's back and forward buttons: stop the raw event, then replay it inside a screen change.
window.addEventListener('popstate', (event) => {
  if (announcing) return;
  event.stopImmediatePropagation();
  changeScreen(announce, scrollByAddress.get(address()) ?? 0);
});

const push = (path: string, state?: unknown) => {
  scrollByAddress.set(address(), window.scrollY);
  window.history.pushState(state ?? null, '', path);
};

export const navigate = (path: string, state?: unknown) => {
  push(path, state);
  changeScreen(announce, 0);
};

/**
 * Follows a link; when the link holds a poster card's poster ([data-poster]), that poster morphs into the title page's
 * large poster, and its image address rides along in the history entry so a title page that is still loading can show it.
 */
export const navigateFrom = (path: string, link: Element) => {
  const poster = link.querySelector<HTMLElement>('[data-poster]') ?? undefined;
  const image = poster?.querySelector('img');
  const posterUrl = image !== null && image !== undefined && image.complete && image.naturalWidth > 0 ? image.currentSrc : undefined;
  push(path, posterUrl === undefined ? undefined : { posterUrl });
  changeScreen(announce, 0, poster);
};

/** The poster address a poster card passed along, if this history entry came from one. */
export const passedPosterUrl = (state: unknown): string | undefined => (
  typeof state === 'object' && state !== null && 'posterUrl' in state && typeof state.posterUrl === 'string' ? state.posterUrl : undefined
);

/**
 * Content that may arrive after its screen is already showing. Returns true once it arrived late, so the caller fades it in
 * (animate-content-in); content that was ready while its screen change was still holding returns false and simply appears
 * in the crossfade.
 */
export function useLateArrival(ready: boolean): boolean {
  const [startedEmpty] = useState(!ready);
  const [late, setLate] = useState(false);
  useLayoutEffect(() => {
    // Under reduced motion nothing fades, so late content simply appears.
    if (ready && startedEmpty && hold === undefined && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setLate(true);
  }, [ready, startedEmpty]);
  return late;
}

/**
 * A screen that loads data before it can draw: the screen change holds the old screen until ready is true (or HOLD_MS
 * passes), so the new screen arrives drawn. Returns whether the content arrived late, as useLateArrival.
 */
export function useScreenReady(ready: boolean): boolean {
  const [entry] = useState(() => hold);
  useLayoutEffect(() => {
    if (entry !== undefined) entry.claimed = true;
  }, [entry]);
  useLayoutEffect(() => {
    if (!ready) return;
    if (entry !== undefined && hold === entry) entry.release();
    // Without a screen change in flight (no view transitions) the screen is drawn now, so its scroll can apply.
    else applyScroll();
  }, [ready, entry]);
  return useLateArrival(ready);
}

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
