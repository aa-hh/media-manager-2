import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SignIn } from './SignIn';
import { Button } from './components/ui/button';
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

  const checkSession = useCallback(async () => {
    if (sessionRef.current.kind === 'signing-out') return;
    const previous = sessionRef.current;
    const request = beginRequest();
    if (previous.kind !== 'signed-out') setSession({ kind: 'checking' });
    try {
      const response = await fetch('/api/session', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: request.controller.signal,
      });
      const body = await readJson(response);
      if (request.version !== requestVersionRef.current) return;
      if (response.status === 200 && typeof body.expiresAt === 'number' && Number.isFinite(body.expiresAt)) {
        verifiedExpiryRef.current = body.expiresAt;
        setSession({ kind: 'signed-in', expiresAt: body.expiresAt });
      } else if (previous.kind !== 'signed-out') {
        const hadVerifiedSession = verifiedExpiryRef.current !== undefined;
        const expired = response.status === 401 && (body.error === 'session_expired'
          || (verifiedExpiryRef.current !== undefined && verifiedExpiryRef.current <= Date.now()));
        verifiedExpiryRef.current = undefined;
        setSession({ kind: 'signed-out', reason: expired ? 'session-expired' : hadVerifiedSession ? 'session-unavailable' : undefined });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (request.version !== requestVersionRef.current) return;
      if (previous.kind !== 'signed-out') {
        const hadVerifiedSession = verifiedExpiryRef.current !== undefined;
        verifiedExpiryRef.current = undefined;
        setSession({ kind: 'signed-out', reason: hadVerifiedSession ? 'session-unavailable' : undefined });
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
    const delay = Math.max(0, Math.min(session.expiresAt - Date.now(), 2_147_483_647));
    const timeout = window.setTimeout(() => void checkSession(), delay);
    return () => window.clearTimeout(timeout);
  }, [checkSession, session]);

  const signedIn = useCallback((expiresAt: number) => {
    requestRef.current?.abort();
    requestVersionRef.current += 1;
    verifiedExpiryRef.current = expiresAt;
    focusAfterSignInRef.current = true;
    setSession({ kind: 'signed-in', expiresAt });
  }, []);

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
    <main className="flex min-h-screen items-center px-6 py-16 sm:px-12 lg:px-24">
      <section className="w-full max-w-[25rem] text-left">
        <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] font-semibold leading-[1.15] tracking-[-0.035em] text-[var(--ink)] sm:text-[2.25rem]">
          media-manager-2
        </h1>
        <div className="mt-8">
          {session.kind === 'sign-out-failed' && (
            <p role="alert" className="mb-5 text-base leading-7 text-[var(--secondary-ink)]">
              Sign-out failed. Your session may still be active.
            </p>
          )}
          <Button onClick={() => void signOut(session.expiresAt)} disabled={session.kind === 'signing-out'}>
            {session.kind === 'signing-out'
              ? 'Signing out…'
              : session.kind === 'sign-out-failed'
                ? 'Try sign out again'
                : 'Sign out'}
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">
          {session.kind === 'signing-out' ? 'Signing out…' : ''}
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
