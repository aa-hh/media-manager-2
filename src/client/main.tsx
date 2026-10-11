import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SignIn } from './SignIn';
import { Home } from './Home';
import { Nav } from './Nav';
import { navigate, useRoute } from './route';
import { DownloadsScreen, LiveBar } from './downloads/Downloads';
import { FlaggedScreen } from './flagged/Flagged';
import { useFlagged } from './flagged/useFlagged';
import { buildRows, groupRows } from './downloads/model';
import { useDownloads } from './downloads/useDownloads';
import { HealthScreen } from './health/Health';
import { useHealth } from './health/useHealth';
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

  const recheckSession = useCallback(() => void checkSession(), [checkSession]);

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
      signOutLabel={session.kind === 'signing-out'
        ? 'Signing out…'
        : session.kind === 'sign-out-failed'
          ? 'Try sign out again'
          : 'Sign out'}
      signOutDisabled={session.kind === 'signing-out'}
      signOutProblem={(
        <>
          {session.kind === 'sign-out-failed' && (
            <p role="alert" className="text-sm text-[var(--secondary-ink)]">
              Sign-out failed. Your session may still be active.
            </p>
          )}
          <p className="sr-only" aria-live="polite">
            {session.kind === 'signing-out' ? 'Signing out…' : ''}
          </p>
        </>
      )}
      onSignOut={() => void signOut(session.expiresAt)}
      onUnauthenticated={recheckSession}
    />
  );
}

// Search and the title view come from Home; the Downloads screen fills Home while the search box is empty.
function SignedIn(props: ComponentProps<typeof Home>) {
  const { state, reload } = useDownloads(props.onUnauthenticated);
  const downloadsHeadingRef = useRef<HTMLHeadingElement>(null);
  const flagged = useFlagged(props.onUnauthenticated);
  const flaggedHeadingRef = useRef<HTMLDivElement>(null);
  const screen = useRoute();
  const health = useHealth(props.onUnauthenticated);
  const healthHeadingRef = useRef<HTMLDivElement>(null);
  const healthBadge = (() => {
    if (health.state.kind !== 'ready') return null;
    const { problems } = health.state.snapshot;
    const errors = problems.filter((problem) => problem.level === 'error').length;
    const warnings = problems.filter((problem) => problem.level === 'warning').length;
    if (errors > 0) return `${errors} ${errors === 1 ? 'RISK' : 'RISKS'}`;
    if (warnings > 0) return `${warnings} ${warnings === 1 ? 'WARNING' : 'WARNINGS'}`;
    return null;
  })();
  const needsYou = useMemo(() => {
    const rows = state.kind === 'ready' ? buildRows(state.snapshot) : [];
    return groupRows(rows).find((group) => group.key === 'needs_you')?.rows.length ?? 0;
  }, [state]);
  const content = (() => {
    switch (screen) {
      case 'downloads':
        return (
          <div className="bg-[var(--mm-ground)] text-[var(--mm-ink)]">
            <DownloadsScreen state={state} reload={reload} headingRef={downloadsHeadingRef} />
          </div>
        );
      case 'health':
        return (
          <div className="bg-[var(--mm-ground)] text-[var(--mm-ink)]">
            <HealthScreen state={health.state} runChecks={health.runChecks} headingRef={healthHeadingRef} />
          </div>
        );
      case 'flagged':
        return (
          <div className="bg-[var(--mm-ground)] text-[var(--mm-ink)]">
            <FlaggedScreen
              state={flagged}
              reload={flagged.reload}
              headingRef={flaggedHeadingRef}
              onUnauthenticated={props.onUnauthenticated}
              onOpenHealth={() => navigate('/health')}
            />
          </div>
        );
      default:
        return null;
    }
  })();
  return (
    <div className="pb-8">
      <Home
        {...props}
        downloads={content}
        nav={(showDownloads) => (
          <Nav
            screen={screen}
            needsYou={needsYou}
            healthBadge={healthBadge}
            onNavigate={(path) => {
              showDownloads();
              navigate(path);
            }}
          />
        )}
        renderBar={(showDownloads) => (
          <LiveBar
            state={state}
            onOpen={() => {
              navigate('/');
              showDownloads();
              window.requestAnimationFrame(() => downloadsHeadingRef.current?.focus());
            }}
          />
        )}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
