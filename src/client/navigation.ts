import { useEffect, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { SearchResult } from './Search';

/*
 * Screen changes. Every change of screen goes through changeScreen: link clicks (navigate, navigateFrom) and the browser's
 * back and forward buttons; replace() only rewrites the address within a screen, such as the search box. A screen change is
 * one view transition: the old screen stays frozen on screen while the new one renders and, if the new screen loads data
 * (useScreenReady), until that data is in or HOLD_MS passes; then the two crossfade and a poster card's poster morphs into
 * the title page's poster (timing in globals.css). A fast load therefore never shows a skeleton, and there is never a second
 * whole-page transition when data arrives: content that comes later crossfades over its skeleton (Arrival). Reduced motion,
 * a hidden tab or a browser without view transitions change at once but keep the same hold and scroll rules.
 */

// razor: one fixed wait for every screen; the new screen shows its skeleton after it. Upgrade path is a per-screen budget.
const HOLD_MS = 350;

// The large poster on a title page and the card poster it grew from share this name, so the browser morphs one into the other.
export const TITLE_POSTER = 'title-poster';

// Screens own their scroll position: a new screen opens at the top, back and forward return to where that address was left.
window.history.scrollRestoration = 'manual';
const scrollByAddress = new Map<string, number>();
const address = () => `${window.location.pathname}${window.location.search}`;
// The address of the screen on show; on back and forward the address has already changed when the event arrives.
let shownAddress = address();

let announcing = false;
const announce = () => {
  announcing = true;
  try {
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  } finally {
    announcing = false;
    shownAddress = address();
  }
};

type Hold = { claimed: boolean; release: () => void };
// The screen change waiting for its new screen to be ready, if any.
let hold: Hold | undefined;
// The screen change's crossfade while it plays; content arriving then waits for it (afterScreenChange).
let playing: Promise<unknown> | undefined;
// Where the new screen should scroll to once it is drawn; a screen still loading is too short to scroll yet.
let pendingScroll: number | undefined;
/**
 * Applies the new screen's scroll. final: the screen's content is drawn now (Arrival, or a screen with no data), so it applies
 * whatever the page height; otherwise it waits while the page is still too short to reach it, such as a skeleton.
 */
export const restoreScroll = (final: boolean) => {
  if (pendingScroll === undefined) return;
  if (!final && document.documentElement.scrollHeight - window.innerHeight < pendingScroll) return;
  window.scrollTo({ top: pendingScroll, behavior: 'instant' });
  pendingScroll = undefined;
};

const animate = () => typeof document.startViewTransition === 'function'
  && document.visibilityState === 'visible'
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const loadImagesInView = (maxWaitMs: number) => {
  const waiting = Array.from(document.images).filter((image) => {
    if (image.complete) return false;
    const box = image.getBoundingClientRect();
    return box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth;
  });
  // A lazy image would not start loading until the browser draws again, which it does not do during the hold.
  for (const image of waiting) image.loading = 'eager';
  return Promise.race([
    Promise.all(waiting.map((image) => image.decode().catch(() => undefined))),
    new Promise((resolve) => setTimeout(resolve, Math.max(0, maxWaitMs))),
  ]);
};

const changeScreen = (update: () => void, scrollTop: number, morph?: HTMLElement) => {
  pendingScroll = scrollTop;
  const run = async () => {
    // The old screen is captured; only the new screen may carry the poster's name now.
    if (morph !== undefined) morph.style.viewTransitionName = '';
    let release = () => {};
    const ready = new Promise<boolean>((resolve) => { release = () => resolve(true); });
    const current: Hold = { claimed: false, release };
    hold = current;
    flushSync(update);
    // A screen that loads data claimed the hold while it rendered; any other screen is ready now.
    if (!current.claimed) release();
    const started = performance.now();
    const drawn = await Promise.race([ready, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), HOLD_MS))]);
    // A newer screen change owns the hold and the scroll now.
    if (hold !== current) return;
    // A drawn screen with no data takes its scroll whatever its height. A screen still loading takes it now if its skeleton
    // can reach it (a new screen's top always can), else keeps it until its content is drawn (useScreenReady, Arrival).
    restoreScroll(drawn && !current.claimed);
    // The images in view load within what is left of the hold, so the screen arrives with its posters, not empty cards.
    if (drawn) await loadImagesInView(HOLD_MS - (performance.now() - started));
    if (hold !== current) return;
    hold = undefined;
  };
  if (!animate()) {
    void run();
    return;
  }
  if (morph !== undefined) morph.style.viewTransitionName = TITLE_POSTER;
  const transition = document.startViewTransition(run);
  const finished = transition.finished.catch(() => undefined);
  void transition.updateCallbackDone.then(() => {
    playing = finished;
    void finished.then(() => {
      if (playing === finished) playing = undefined;
    });
  }, () => undefined);
};

/** Runs now, or once the screen change's crossfade has finished, so new content never replaces an element mid-morph. */
export const afterScreenChange = (run: () => void) => {
  if (playing === undefined) run();
  else void playing.then(run);
};

/** Whether a screen change is holding or playing; a view swap outside one (the search box) fades by itself. */
export const inScreenChange = () => hold !== undefined || playing !== undefined;

// The browser's back and forward buttons: stop the raw event, then replay it inside a screen change.
window.addEventListener('popstate', (event) => {
  if (announcing) return;
  event.stopImmediatePropagation();
  scrollByAddress.set(shownAddress, window.scrollY);
  changeScreen(announce, scrollByAddress.get(address()) ?? 0);
});

const push = (path: string, state?: unknown) => {
  scrollByAddress.set(shownAddress, window.scrollY);
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
    // Within the hold the screen change applies the scroll; after it, the screen is drawn now, so its scroll applies here.
    if (entry !== undefined && hold === entry) entry.release();
    else if (entry === undefined || hold === undefined) restoreScroll(false);
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

// Rewrites the address within a screen (the search box, filters); it is not a screen change and keeps the scroll.
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
