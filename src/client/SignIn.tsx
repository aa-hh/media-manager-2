import { useCallback, useEffect, useRef, useState } from 'react';
import { SignInBlock } from './components/ui/sign-in-block';
import { FirstRun, JellyfinSignIn } from './FirstRun';
import {
  POLL_INTERVAL_MS,
  POPUP_FEATURES,
  POPUP_MESSAGE,
  POPUP_NAME,
  handoffState,
  isPopupMessage,
  openPopup,
  sendToPlex,
  type PopupHost,
  type PopupMessage,
  type PopupWindow,
} from './plexPopup';
import { RECHECK_TRIES, holdSuccess, recheckLater, signInScreen, type SignInView } from './signInFlow';
import { createPlanet } from './signInPlanet';

type SignInProps = {
  entryReason?: 'session-expired' | 'signed-out' | 'session-unavailable';
  onSignedIn: (expiresAt: number) => void;
};

type ErrorBody = { error?: unknown };

export const browserPost = (path: string, body: object, signal: AbortSignal) => fetch(path, {
  method: 'POST',
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'media-manager-2',
  },
  body: JSON.stringify(body),
  signal,
});

export const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const value: unknown = await response.json();
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

const isPlexHandoff = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'app.plex.tv'
      && url.port === ''
      && url.pathname === '/auth'
      && url.search === ''
      && url.username === ''
      && url.password === ''
      && url.hash.startsWith('#?');
  } catch {
    return false;
  }
};

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const popupHost: PopupHost = {
  open: () => window.open('about:blank', POPUP_NAME, POPUP_FEATURES),
  narrow: () => window.matchMedia('(max-width: 639px)').matches,
  assign: (url) => window.location.assign(url),
  setInterval: (cb, ms) => window.setInterval(cb, ms),
  clearInterval: (id) => window.clearInterval(id),
};

export function SignIn({ entryReason, onSignedIn }: SignInProps) {
  const [view, setView] = useState<SignInView>('status');
  const [plexInWindow, setPlexInWindow] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const [jellyfinOwner, setJellyfinOwner] = useState(false);
  const successTimerRef = useRef<number | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planetRef = useRef<ReturnType<typeof createPlanet>>(undefined);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [announcement, setAnnouncement] = useState(entryReason === 'signed-out' ? 'Signed out.' : '');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const callbackStateRef = useRef<string | undefined>(undefined);
  const activeRequestRef = useRef<{ controller: AbortController; version: number } | undefined>(undefined);
  const requestVersionRef = useRef(0);
  const firstViewRef = useRef(true);
  const popupRef = useRef<PopupWindow | null>(null);
  const stopPopupRef = useRef<(() => void) | undefined>(undefined);

  const closePopup = () => {
    stopPopupRef.current?.();
    stopPopupRef.current = undefined;
    setPlexInWindow(false);
    const popup = popupRef.current;
    popupRef.current = null;
    if (popup !== null && !popup.closed) {
      try {
        popup.close();
      } catch {
        // Closing can throw in odd browser states; the popup is abandoned either way.
      }
    }
  };

  const beginRequest = useCallback(() => {
    activeRequestRef.current?.controller.abort();
    const request = {
      controller: new AbortController(),
      version: ++requestVersionRef.current,
    };
    activeRequestRef.current = request;
    return request;
  }, []);

  const isCurrent = useCallback((version: number) => requestVersionRef.current === version, []);

  const succeed = useCallback((expiresAt: number) => {
    callbackStateRef.current = undefined;
    setSucceeded(true);
    setAnnouncement('Signed in.');
    successTimerRef.current = holdSuccess(window, REDUCED_MOTION, () => onSignedIn(expiresAt));
  }, [onSignedIn]);

  const completeSignIn = useCallback(async (state: string, quiet = false, retriesLeft = RECHECK_TRIES): Promise<void> => {
    const request = beginRequest();
    if (!quiet) {
      setAnnouncement('Checking your Plex account…');
      setView('checking');
    }
    try {
      const response = await browserPost('/auth/complete', { state }, request.controller.signal);
      const body = await readJson(response);
      if (!isCurrent(request.version)) return;
      if (response.status === 200 && typeof body.expiresAt === 'number' && Number.isFinite(body.expiresAt)) {
        closePopup();
        window.history.replaceState(window.history.state, '', '/');
        succeed(body.expiresAt);
        return;
      }
      if (response.status === 202 && body.status === 'pending') {
        if (quiet) return;
        // Back from Plex on a phone, the PIN can take a moment to register; ask again before showing an error.
        if (recheckLater(window, retriesLeft, POLL_INTERVAL_MS, () => isCurrent(request.version), (left) => void completeSignIn(state, false, left))) return;
        setAnnouncement('Plex sign-in isn’t finished.');
        setView('pending');
        return;
      }
      const error = (body as ErrorBody).error;
      if (quiet && response.status === 409 && error === 'in_progress') return;
      if (!(response.status === 409 && error === 'in_progress')) closePopup();
      if (response.status === 403 && error === 'owner_only') {
        callbackStateRef.current = undefined;
        setAnnouncement('This Plex account can’t open this app.');
        setView('wrong-owner');
      } else if (response.status === 401 && error === 'flow_expired') {
        callbackStateRef.current = undefined;
        setAnnouncement('The sign-in attempt expired.');
        setView('expired');
      } else if (response.status === 401 || response.status === 400) {
        callbackStateRef.current = undefined;
        setAnnouncement('Plex sign-in couldn’t be verified.');
        setView('invalid');
      } else if (response.status === 409 && error === 'in_progress') {
        // A check the server already started (a timed poll, or another tab) finishes within a few seconds; ask again before handing the wait to the user.
        if (recheckLater(window, retriesLeft, 1_000, () => isCurrent(request.version), (left) => void completeSignIn(state, false, left))) return;
        setAnnouncement('Plex sign-in is still being checked.');
        setView('pending');
      } else {
        callbackStateRef.current = undefined;
        setAnnouncement('Plex sign-in is unavailable. Try again.');
        setView('unavailable');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!isCurrent(request.version)) return;
      closePopup();
      callbackStateRef.current = undefined;
      setAnnouncement('Plex sign-in is unavailable. Try again.');
      setView('unavailable');
    }
  }, [beginRequest, isCurrent, succeed]);

  const startSignIn = useCallback(async () => {
    closePopup();
    const popup = openPopup(popupHost);
    popupRef.current = popup;
    const request = beginRequest();
    callbackStateRef.current = undefined;
    setAnnouncement('Opening Plex…');
    setView('preparing');
    try {
      const response = await browserPost('/auth/start', {}, request.controller.signal);
      const body = await readJson(response);
      if (!isCurrent(request.version)) return;
      if (response.status === 201 && isPlexHandoff(body.url)) {
        const state = handoffState(body.url);
        try {
          stopPopupRef.current = sendToPlex(popupHost, popupRef.current, body.url, {
            // A tick while a user-started check is running would abort that check and leave the page on "checking".
            onTick: () => { if (state !== undefined && viewRef.current === 'pending') void completeSignIn(state, true); },
            onClosed: () => {
              stopPopupRef.current = undefined;
              setPlexInWindow(false);
              if (viewRef.current !== 'pending') return;
              setAnnouncement('Plex sign-in was interrupted.');
              setView('interrupted');
            },
          });
        } catch {
          closePopup();
          setAnnouncement('Plex sign-in was interrupted.');
          setView('interrupted');
          return;
        }
        if (stopPopupRef.current !== undefined) {
          callbackStateRef.current = state;
          setPlexInWindow(true);
          setAnnouncement('Plex is open in a new window.');
          setView('pending');
        }
        return;
      }
      closePopup();
      if (response.status === 503 && body.error === 'not_configured') {
        setAnnouncement('Sign-in isn’t configured.');
        setView('not-configured');
      } else {
        setAnnouncement('Plex sign-in is unavailable. Try again.');
        setView('unavailable');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!isCurrent(request.version)) return;
      closePopup();
      setAnnouncement('Plex sign-in is unavailable. Try again.');
      setView('unavailable');
    }
  }, [beginRequest, completeSignIn, isCurrent]);

  const refreshStatus = useCallback(async (restored = false) => {
    const request = beginRequest();
    try {
      const response = await fetch('/auth/status', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: request.controller.signal,
      });
      const body = await readJson(response);
      if (!isCurrent(request.version)) return;
      setFirstRun(body.firstRun === true);
      setJellyfinOwner(body.provider === 'jellyfin');
      if (response.status !== 200) {
        setAnnouncement('Plex sign-in is unavailable. Try again.');
        setView('unavailable');
      } else if (body.configured !== true) {
        setAnnouncement('Sign-in isn’t configured.');
        setView('not-configured');
      } else if (body.firstRun === true) {
        setAnnouncement('');
        setView('initial');
      } else if (body.pending === true) {
        setAnnouncement('Plex sign-in was interrupted.');
        setView('interrupted');
      } else if (!restored && entryReason === 'session-expired') {
        setAnnouncement('Your session expired. Sign in again.');
        setView('session-expired');
      } else {
        setAnnouncement(!restored && entryReason === 'signed-out' ? 'Signed out.' : '');
        setView('initial');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!isCurrent(request.version)) return;
      setAnnouncement('Plex sign-in is unavailable. Try again.');
      setView('unavailable');
    }
  }, [beginRequest, entryReason, isCurrent]);

  useEffect(() => {
    const pathIsCallback = window.location.pathname === '/auth/callback';
    if (pathIsCallback && entryReason === undefined) {
      const parameters = new URLSearchParams(window.location.search);
      const states = parameters.getAll('state');
      const entries = [...parameters.entries()];
      const state = states.length === 1 && states[0].length > 0 && entries.length === 1
        ? states[0]
        : undefined;
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`);
      const opener: Window | null = window.opener;
      let openerIsSameOrigin = false;
      try {
        openerIsSameOrigin = opener !== null && opener !== window && opener.location.origin === window.location.origin;
      } catch {
        openerIsSameOrigin = false;
      }
      if (state !== undefined && openerIsSameOrigin && opener !== null) {
        opener.postMessage({ type: POPUP_MESSAGE, state } satisfies PopupMessage, window.location.origin);
        setAnnouncement('Checking your Plex account…');
        setView('checking');
        window.close();
        return;
      }
      if (state === undefined) {
        setAnnouncement('Plex sign-in couldn’t be verified.');
        setView('invalid');
      } else {
        callbackStateRef.current = state;
        void completeSignIn(state);
      }
      return;
    }

    void refreshStatus();
  }, [completeSignIn, entryReason, refreshStatus]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (popupRef.current === null || event.source !== popupRef.current) return;
      if (!isPopupMessage(event.data)) return;
      closePopup();
      callbackStateRef.current = event.data.state;
      void completeSignIn(event.data.state);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [completeSignIn]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || viewRef.current !== 'preparing' || callbackStateRef.current !== undefined) return;
      void refreshStatus(true);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refreshStatus]);

  useEffect(() => {
    if (view === 'status' || !firstViewRef.current) return;
    firstViewRef.current = false;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

  useEffect(() => () => {
    activeRequestRef.current?.controller.abort();
    stopPopupRef.current?.();
    requestVersionRef.current += 1;
    window.clearTimeout(successTimerRef.current);
  }, []);

  useEffect(() => {
    if (canvasRef.current === null) return;
    const planet = createPlanet(canvasRef.current, REDUCED_MOTION);
    planetRef.current = planet;
    return () => {
      planet?.destroy();
      planetRef.current = undefined;
    };
  }, []);

  const { screen, line } = signInScreen(view, plexInWindow, succeeded);
  const busy = screen === 'loading' || screen === 'waiting' || screen === 'success';
  const planetState = screen === 'waiting' ? 'checking' : screen === 'success' ? 'success' : 'idle';

  useEffect(() => {
    planetRef.current?.setState(planetState);
  }, [planetState]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07080b]" aria-busy={view === 'status' || view === 'preparing' || view === 'checking'}>
      <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 size-full" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgb(7_8_11/0)_45%,#07080b_100%)] sm:bg-[linear-gradient(90deg,#07080b_0%,rgb(7_8_11/0)_55%)]" />
      {firstRun ? (
        <FirstRun
          headingRef={headingRef}
          plexBusy={busy}
          plexLine={line}
          onPlexSignIn={() => void startSignIn()}
          onSignedIn={succeed}
          className="fixed right-6 bottom-[83px] left-6 sm:right-auto sm:bottom-[120px] sm:left-[120px] sm:w-100"
        />
      ) : jellyfinOwner ? (
        <JellyfinSignIn
          headingRef={headingRef}
          onSignedIn={succeed}
          className="fixed right-6 bottom-[83px] left-6 sm:right-auto sm:bottom-[120px] sm:left-[120px] sm:w-100"
        />
      ) : (
        <SignInBlock
          busy={busy}
          line={line}
          onSignIn={() => void startSignIn()}
          headingRef={headingRef}
          className="fixed right-6 bottom-[83px] left-6 sm:right-auto sm:bottom-[120px] sm:left-[120px] sm:w-100"
        />
      )}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </main>
  );
}
