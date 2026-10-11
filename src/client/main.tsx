import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SignIn } from './SignIn';
import { DownloadsScreen, LiveBar } from './downloads/Downloads';
import { useDownloads } from './downloads/useDownloads';
import './globals.css';

type SessionState =
  | { kind: 'checking' }
  | { kind: 'signed-out'; reason?: 'session-expired' | 'signed-out' | 'session-unavailable' }
  | { kind: 'signed-in'; expiresAt: number }
  | { kind: 'signing-out'; expiresAt: number }
  | { kind: 'sign-out-failed'; expiresAt: number };

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

function App() {
  const [session, setSession] = useState<SessionState>({ kind: 'checking' });
  const sessionRef = useRef(session);
  const verifiedExpiryRef = useRef<number | undefined>(undefined);
  const verifiedDeadlineRef = useRef<number | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterSignInRef = useRef(false);
  const requestRef = useRef<AbortController | undefined>(undefined);
  const requestVersionRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | undefined>(undefined);
  sessionRef.current = session;

  const beginRequest = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = new AbortController();
    return {
      controller: requestRef.current,
      version: ++requestVersionRef.current,
    };
  }, []);

  const checkSession = useCallback(async (completedSignIn = false) => {
    if (sessionRef.current.kind === 'signing-out') return;
    const previous = sessionRef.current;
    const request = beginRequest();
    if (completedSignIn || previous.kind !== 'signed-out') setSession({ kind: 'checking' });
    try {
      const requestStartedAt = performance.now();
      const response = await fetch('/api/session', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: request.controller.signal,
      });
      const body = await readJson(response);
      if (request.version !== requestVersionRef.current) return;
      if (response.status === 200) {
        const deadline = typeof body.expiresAt === 'number' && Number.isFinite(body.expiresAt)
          && typeof body.serverNow === 'number' && Number.isFinite(body.serverNow)
          ? requestStartedAt + (body.expiresAt - body.serverNow)
          : undefined;
        if (deadline === undefined || deadline <= performance.now()) {
          verifiedExpiryRef.current = undefined;
          verifiedDeadlineRef.current = undefined;
          focusAfterSignInRef.current = false;
          setSession({ kind: 'signed-out', reason: 'session-unavailable' });
          return;
        }
        verifiedExpiryRef.current = body.expiresAt as number;
        verifiedDeadlineRef.current = deadline;
        setSession({ kind: 'signed-in', expiresAt: body.expiresAt as number });
      } else if (completedSignIn || previous.kind !== 'signed-out') {
        const hadVerifiedSession = verifiedExpiryRef.current !== undefined;
        const expired = response.status === 401 && (body.error === 'session_expired'
          || (verifiedDeadlineRef.current !== undefined && verifiedDeadlineRef.current <= performance.now()));
        verifiedExpiryRef.current = undefined;
        verifiedDeadlineRef.current = undefined;
        focusAfterSignInRef.current = false;
        setSession({ kind: 'signed-out', reason: completedSignIn ? 'session-unavailable' : expired ? 'session-expired' : hadVerifiedSession ? 'session-unavailable' : undefined });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (request.version !== requestVersionRef.current) return;
      if (completedSignIn || previous.kind !== 'signed-out') {
        const hadVerifiedSession = verifiedExpiryRef.current !== undefined;
        verifiedExpiryRef.current = undefined;
        verifiedDeadlineRef.current = undefined;
        focusAfterSignInRef.current = false;
        setSession({ kind: 'signed-out', reason: completedSignIn || hadVerifiedSession ? 'session-unavailable' : undefined });
      }
    }
  }, [beginRequest]);

  useEffect(() => {
    void checkSession();
    const onPageShow = () => void checkSession();
    const onFocus = () => void checkSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkSession();
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      requestRef.current?.abort();
      requestVersionRef.current += 1;
    };
  }, [checkSession]);

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('media-manager-2-session');
    channelRef.current = channel;
    channel.addEventListener('message', (event) => {
      if (event.data !== 'signed-out') return;
      requestRef.current?.abort();
      requestVersionRef.current += 1;
      verifiedExpiryRef.current = undefined;
      verifiedDeadlineRef.current = undefined;
      focusAfterSignInRef.current = false;
      setSession({ kind: 'signed-out', reason: 'signed-out' });
    });
    return () => {
      channel.close();
      channelRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (session.kind !== 'signed-in' && session.kind !== 'sign-out-failed') return;
    if (verifiedDeadlineRef.current === undefined) return;
    const delay = Math.max(0, Math.min(verifiedDeadlineRef.current - performance.now(), 2_147_483_647));
    const timeout = window.setTimeout(() => void checkSession(), delay);
    return () => window.clearTimeout(timeout);
  }, [checkSession, session]);

  const signedIn = useCallback((expiresAt: number) => {
    requestRef.current?.abort();
    requestVersionRef.current += 1;
    verifiedExpiryRef.current = expiresAt;
    focusAfterSignInRef.current = true;
    verifiedDeadlineRef.current = undefined;
    setSession({ kind: 'checking' });
    void checkSession(true);
  }, [checkSession]);

  useEffect(() => {
    if (session.kind !== 'signed-in' || !focusAfterSignInRef.current) return;
    focusAfterSignInRef.current = false;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [session]);

  const signOut = useCallback(async (expiresAt: number) => {
    if (sessionRef.current.kind === 'signing-out') return;
    focusAfterSignInRef.current = false;
    const request = beginRequest();
    setSession({ kind: 'signing-out', expiresAt });
    try {
      const response = await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'media-manager-2',
        },
        body: '{}',
        signal: request.controller.signal,
      });
      if (request.version !== requestVersionRef.current) return;
      if (response.status === 204) {
        verifiedExpiryRef.current = undefined;
        verifiedDeadlineRef.current = undefined;
        channelRef.current?.postMessage('signed-out');
        setSession({ kind: 'signed-out', reason: 'signed-out' });
      } else {
        setSession({ kind: 'sign-out-failed', expiresAt });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (request.version !== requestVersionRef.current) return;
      setSession({ kind: 'sign-out-failed', expiresAt });
    }
  }, [beginRequest]);

  if (session.kind === 'checking') {
    return (
      <main className="min-h-screen bg-[var(--ground)]">
        <p className="sr-only" aria-live="polite">Checking session…</p>
      </main>
    );
  }

  if (session.kind === 'signed-out') {
    return <SignIn entryReason={session.reason} onSignedIn={signedIn} />;
  }

  return (
    <SignedIn
      headingRef={headingRef}
      signOutState={session.kind}
      onSignOut={() => void signOut(session.expiresAt)}
      onUnauthorized={() => void checkSession()}
    />
  );
}

function SignedIn({ headingRef, signOutState, onSignOut, onUnauthorized }: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  signOutState: 'signed-in' | 'signing-out' | 'sign-out-failed';
  onSignOut: () => void;
  onUnauthorized: () => void;
}) {
  const { state, reload } = useDownloads(onUnauthorized);
  return (
    <div className="min-h-screen bg-[var(--mm-ground)] pb-8 text-[var(--mm-ink)]">
      <header className="flex h-12 items-center gap-6 border-b border-[var(--mm-seam)] bg-[var(--mm-row)] px-5 font-ui">
        <span className="text-[14px] font-semibold">media-manager-2</span>
        <nav aria-label="Main">
          <a href="#downloads" aria-current="page" className="text-[13px] font-semibold text-[var(--mm-ink)]">Downloads</a>
        </nav>
        <span className="flex-1" />
        {signOutState === 'sign-out-failed' && (
          <p role="alert" className="text-[13px] text-[var(--mm-risk)]">Sign-out failed. Your session may still be active.</p>
        )}
        <button
          type="button"
          onClick={onSignOut}
          disabled={signOutState === 'signing-out'}
          className="h-8 px-3 text-[14px] font-semibold text-[var(--mm-ink)] hover:bg-[var(--mm-row-hover)] focus-visible:outline-1 focus-visible:outline-[var(--mm-ink)] disabled:opacity-50"
        >
          {signOutState === 'signing-out' ? 'Signing out…' : signOutState === 'sign-out-failed' ? 'Try sign out again' : 'Sign out'}
        </button>
        <p className="sr-only" aria-live="polite">{signOutState === 'signing-out' ? 'Signing out…' : ''}</p>
      </header>
      <main id="downloads">
        <DownloadsScreen state={state} reload={reload} headingRef={headingRef} />
      </main>
      <LiveBar state={state} onOpen={() => headingRef.current?.focus()} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
