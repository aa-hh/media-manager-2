import { useCallback, useEffect, useRef, useState } from 'react';
import { AppBarDesktop } from './components/ui/app-bar';
import { Button } from './components/ui/button';
import { Logo } from './components/ui/logo';
import { SignInBlock } from './components/ui/sign-in-block';
import { StatusInline } from './components/ui/status-inline';

type SignInView =
  | 'status'
  | 'initial'
  | 'preparing'
  | 'checking'
  | 'pending'
  | 'interrupted'
  | 'wrong-owner'
  | 'unavailable'
  | 'not-configured'
  | 'expired'
  | 'invalid'
  | 'session-expired'
  | 'cancel-failed';

type SignInProps = {
  entryReason?: 'session-expired' | 'signed-out' | 'session-unavailable';
  onSignedIn: (expiresAt: number) => void;
};

type ErrorBody = { error?: unknown };

const browserPost = (path: string, body: object, signal: AbortSignal) => fetch(path, {
  method: 'POST',
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'media-manager-2',
  },
  body: JSON.stringify(body),
  signal,
});

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const value: unknown = await response.json();
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

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

export function SignIn({ entryReason, onSignedIn }: SignInProps) {
  const [view, setView] = useState<SignInView>('status');
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const cancellationVersionRef = useRef<number | undefined>(undefined);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [announcement, setAnnouncement] = useState(entryReason === 'signed-out' ? 'Signed out.' : '');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const callbackStateRef = useRef<string | undefined>(undefined);
  const activeRequestRef = useRef<{ controller: AbortController; version: number } | undefined>(undefined);
  const requestVersionRef = useRef(0);
  const firstViewRef = useRef(true);

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

  const completeSignIn = useCallback(async (state: string) => {
    if (cancellationVersionRef.current !== undefined) return;
    const request = beginRequest();
    setAnnouncement('Checking your Plex account…');
    setView('checking');
    try {
      const response = await browserPost('/auth/complete', { state }, request.controller.signal);
      const body = await readJson(response);
      if (!isCurrent(request.version)) return;
      if (response.status === 200 && typeof body.expiresAt === 'number' && Number.isFinite(body.expiresAt)) {
        callbackStateRef.current = undefined;
        window.history.replaceState(window.history.state, '', '/');
        onSignedIn(body.expiresAt);
        return;
      }
      if (response.status === 202 && body.status === 'pending') {
        setAnnouncement('Plex sign-in isn’t finished.');
        setView('pending');
        return;
      }
      const error = (body as ErrorBody).error;
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
      callbackStateRef.current = undefined;
      setAnnouncement('Plex sign-in is unavailable. Try again.');
      setView('unavailable');
    }
  }, [beginRequest, isCurrent, onSignedIn]);

  const startSignIn = useCallback(async () => {
    if (cancellationVersionRef.current !== undefined) return;
    const request = beginRequest();
    callbackStateRef.current = undefined;
    setAnnouncement('Opening Plex…');
    setView('preparing');
    try {
      const response = await browserPost('/auth/start', {}, request.controller.signal);
      const body = await readJson(response);
      if (!isCurrent(request.version)) return;
      if (response.status === 201 && isPlexHandoff(body.url)) {
        try {
          window.location.assign(body.url);
        } catch {
          setAnnouncement('Plex sign-in was interrupted.');
          setView('interrupted');
        }
        return;
      }
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
      setAnnouncement('Plex sign-in is unavailable. Try again.');
      setView('unavailable');
    }
  }, [beginRequest, isCurrent]);

  const cancelSignIn = useCallback(async () => {
    if (cancellationVersionRef.current !== undefined) return;
    const request = beginRequest();
    cancellationVersionRef.current = request.version;
    setCancellationBusy(true);
    setAnnouncement('Cancelling sign-in…');
    try {
      const response = await browserPost('/auth/cancel', {}, request.controller.signal);
      if (!isCurrent(request.version)) return;
      if (response.status === 204) {
        callbackStateRef.current = undefined;
        setAnnouncement('Plex sign-in cancelled.');
        setView('initial');
      } else {
        setAnnouncement('Plex sign-in couldn’t be cancelled.');
        setView('cancel-failed');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!isCurrent(request.version)) return;
      setAnnouncement('Plex sign-in couldn’t be cancelled.');
      setView('cancel-failed');
    } finally {
      if (isCurrent(request.version) && cancellationVersionRef.current === request.version) {
        cancellationVersionRef.current = undefined;
        setCancellationBusy(false);
      }
    }
  }, [beginRequest, isCurrent]);

  const refreshStatus = useCallback(async (restored = false) => {
    const request = beginRequest();
    cancellationVersionRef.current = undefined;
    setCancellationBusy(false);
    try {
      const response = await fetch('/auth/status', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: request.controller.signal,
      });
      const body = await readJson(response);
      if (!isCurrent(request.version)) return;
      if (response.status !== 200) {
        setAnnouncement('Plex sign-in is unavailable. Try again.');
        setView('unavailable');
      } else if (body.configured !== true) {
        setAnnouncement('Sign-in isn’t configured.');
        setView('not-configured');
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
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || viewRef.current !== 'preparing' || callbackStateRef.current !== undefined) return;
      void refreshStatus(true);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refreshStatus]);

  useEffect(() => {
    if (view === 'status') return;
    if (firstViewRef.current) firstViewRef.current = false;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

  useEffect(() => () => {
    activeRequestRef.current?.controller.abort();
    requestVersionRef.current += 1;
    cancellationVersionRef.current = undefined;
  }, []);

  const checkAgain = () => {
    if (cancellationVersionRef.current !== undefined) return;
    const state = callbackStateRef.current;
    if (state === undefined) {
      setAnnouncement('Plex sign-in couldn’t be verified.');
      setView('invalid');
      return;
    }
    void completeSignIn(state);
  };

  const heading = {
    status: 'Sign in',
    initial: 'Sign in',
    preparing: 'Opening Plex…',
    checking: 'Checking your Plex account…',
    pending: 'Plex sign-in isn’t finished.',
    interrupted: 'Plex sign-in was interrupted.',
    'wrong-owner': 'This Plex account can’t open this app.',
    unavailable: 'Plex sign-in is unavailable.',
    'not-configured': 'Sign-in isn’t configured.',
    expired: 'This sign-in attempt expired.',
    invalid: 'Plex sign-in couldn’t be verified.',
    'session-expired': 'Your session expired.',
    'cancel-failed': 'Plex sign-in couldn’t be cancelled.',
  }[view];

  const body = {
    status: ['Only the owner’s Plex account can open this app.', 'You’ll sign in on Plex, then return here. This app never receives your Plex password.'],
    initial: ['Only the owner’s Plex account can open this app.', 'You’ll sign in on Plex, then return here. This app never receives your Plex password.'],
    preparing: ['You’ll continue on Plex in this tab.'],
    checking: ['Please wait while the server verifies the account with Plex.'],
    pending: ['Finish signing in on Plex, then check again.'],
    interrupted: ['Start again to return to Plex, or cancel this attempt.'],
    'wrong-owner': ['Sign in with the owner’s account.'],
    unavailable: ['Try again.'],
    'not-configured': [
      'The server needs an owner Plex ID and public app address before sign-in can start.',
      <span className="font-data text-sm text-foreground">PLEX_OWNER_ID · APP_ORIGIN</span>,
    ],
    expired: ['Sign in again to create a new attempt.'],
    invalid: ['The return from Plex was missing or no longer matched this browser. Try again.'],
    'session-expired': ['Sign in again.'],
    'cancel-failed': ['Try cancelling again, or start a new sign-in attempt.'],
  }[view];

  const buttons = (
    <>
      {view === 'initial' && (
        <Button size="large" icon={<Logo name="plex-gold" alt="" />} onClick={() => void startSignIn()}>
          Sign in with Plex
        </Button>
      )}
      {view === 'status' && <Button size="large" disabled>Loading…</Button>}
      {view === 'preparing' && <Button size="large" aria-disabled loading icon={<Logo name="plex-gold" alt="" />}>Opening Plex…</Button>}
      {view === 'checking' && <Button size="large" aria-disabled>Checking…</Button>}
      {view === 'pending' && (
        <>
          <Button size="large" disabled={cancellationBusy} onClick={checkAgain}>Check again</Button>
          <Button size="large" disabled={cancellationBusy} variant="ghost" onClick={() => void startSignIn()}>Try again</Button>
          <Button size="large" disabled={cancellationBusy} variant="ghost" onClick={() => void cancelSignIn()}>{cancellationBusy ? 'Cancelling…' : 'Cancel'}</Button>
        </>
      )}
      {view === 'interrupted' && (
        <>
          <Button size="large" disabled={cancellationBusy} onClick={() => void startSignIn()}>Try again</Button>
          <Button size="large" disabled={cancellationBusy} variant="ghost" onClick={() => void cancelSignIn()}>{cancellationBusy ? 'Cancelling…' : 'Cancel'}</Button>
        </>
      )}
      {view === 'cancel-failed' && (
        <>
          <Button size="large" disabled={cancellationBusy} onClick={() => void cancelSignIn()}>{cancellationBusy ? 'Cancelling…' : 'Try cancelling again'}</Button>
          <Button size="large" disabled={cancellationBusy} variant="ghost" onClick={() => void startSignIn()}>Try again</Button>
        </>
      )}
      {(view === 'wrong-owner' || view === 'unavailable' || view === 'expired' || view === 'invalid' || view === 'session-expired') && (
        <Button size="large" disabled={cancellationBusy} onClick={() => void startSignIn()}>Try again</Button>
      )}
    </>
  );

  return (
    <main className="min-h-screen bg-background">
      <AppBarDesktop signedOut productName="media-manager-2" />
      <section className="px-(--page-margin) pt-24" aria-busy={cancellationBusy || view === 'status' || view === 'preparing' || view === 'checking'}>
        <SignInBlock
          heading={heading}
          headingRef={headingRef}
          body={body}
          status={announcement === 'Signed out.' && (view === 'status' || view === 'initial') ? (
            // The live region below already announces it, so this copy is not a status region too.
            <div className="h-8"><StatusInline status="sent" role={undefined}>Signed out.</StatusInline></div>
          ) : undefined}
          buttons={view === 'not-configured' ? undefined : buttons}
          attribution="Plex and the Plex chevron are trademarks of Plex, Inc. media-manager-2 is not an official Plex product and is not endorsed by Plex."
        />
      </section>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </main>
  );
}
