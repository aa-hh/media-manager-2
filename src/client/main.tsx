import { type ComponentProps, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SignIn } from './SignIn';
import { Home } from './Home';
import { lazyScreen, preloadScreens } from './lazyScreen';
import { navigate, replace, useLocation } from './navigation';
import { clearSessionState, withoutFilters } from './discover/model';
import { Button } from './components/ui/button';
import { Callout } from './components/ui/callout';
import { DownloadsLiveBar } from './components/ui/downloads-live-bar';
import { LabelGroup } from './components/ui/label-group';
import { PanelInline } from './components/ui/panel-inline';
import { RowDownload } from './components/ui/row-download';
import { StatusInline } from './components/ui/status-inline';
import { ToastProvider } from './components/ui/toast';
import { DownloadsScreen } from './downloads/Downloads';
import { useFlagged } from './flagged/useFlagged';
import { buildRows, formatSpeed, groupRows } from './downloads/model';
import { useDownloads } from './downloads/useDownloads';
import { useHealth } from './health/useHealth';
import { HistoryScreen } from './history/History';
import { useBlocklist, useHistory } from './history/useHistory';
import { MediaServerContext } from './mediaServer';
import type { SetupStatus } from './settings/setup';
import './globals.css';

const SetupWizard = lazyScreen(() => import('./settings/SetupWizard').then((module) => module.SetupWizard));
const FlaggedScreen = lazyScreen(() => import('./flagged/Flagged').then((module) => module.FlaggedScreen));
const HealthScreen = lazyScreen(() => import('./health/Health').then((module) => module.HealthScreen));
const BlocklistScreen = lazyScreen(() => import('./history/Blocklist').then((module) => module.BlocklistScreen));

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
  const [mediaServer, setMediaServer] = useState<'plex' | 'jellyfin'>('plex');
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
    // No 'checking' here: it unmounts the signed-in app, losing typed settings and open dialogs on every focus.
    // The first check and signedIn() start from 'checking' already.
    const request = beginRequest();
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
        if (body.mediaServer === 'plex' || body.mediaServer === 'jellyfin') setMediaServer(body.mediaServer);
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

  const clearsDiscoverFilters = session.kind === 'signed-out' && session.reason !== 'session-unavailable';
  // A sign-out or expiry starts the next sign-in's Discover without the old session's filters; a session check that fails does not.
  useEffect(() => {
    if (!clearsDiscoverFilters) return;
    clearSessionState();
    const { pathname, search } = window.location;
    if (pathname.startsWith('/discover') && withoutFilters(search) !== search) replace(pathname + withoutFilters(search));
  }, [clearsDiscoverFilters]);

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

  // The heading exists only once SetupGate has read /api/setup and drawn the app or the wizard, so SetupGate says when to focus it.
  const focusHeadingAfterSignIn = useCallback(() => {
    if (!focusAfterSignInRef.current) return;
    focusAfterSignInRef.current = false;
    headingRef.current?.focus();
  }, []);

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
  const mediaServerValue = useMemo(() => ({ name: mediaServer, refresh: recheckSession }), [mediaServer, recheckSession]);

  // The Plex popup of a media-server switch lands here while the owner is signed in; SignIn relays the state to the opener and closes.
  if (window.location.pathname === '/auth/callback') {
    return <SignIn onSignedIn={signedIn} />;
  }

  if (session.kind === 'checking') {
    return (
      <main className="min-h-screen bg-background">
        <p className="sr-only" aria-live="polite">Checking session…</p>
      </main>
    );
  }

  if (session.kind === 'signed-out') {
    return <SignIn entryReason={session.reason} onSignedIn={signedIn} />;
  }

  return (
    <MediaServerContext value={mediaServerValue}>
      <SetupGate
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
              <StatusInline status="failed" role="alert">
                Sign-out failed. Your session may still be active.
              </StatusInline>
            )}
            <p className="sr-only" aria-live="polite">
              {session.kind === 'signing-out' ? 'Signing out…' : ''}
            </p>
          </>
        )}
        onSignOut={() => void signOut(session.expiresAt)}
        onUnauthenticated={recheckSession}
        onShown={focusHeadingAfterSignIn}
      />
    </MediaServerContext>
  );
}

type SignedInProps = Omit<ComponentProps<typeof Home>, 'downloadsState' | 'needsYou' | 'downloading' | 'healthProblems' | 'healthRisk'>;

// The setup wizard blocks the app until every required part is set up; once open, it stays until the owner leaves Done.
// Its effect runs only when everything in its Suspense boundary has drawn, so it fires after a lazy sibling has loaded.
function WhenDrawn({ run }: { run: () => void }) {
  useEffect(run, [run]);
  return null;
}

function SetupGate({ onShown, ...props }: SignedInProps & { onShown: () => void }) {
  const [gate, setGate] = useState<{ kind: 'checking' | 'failed' | 'app' } | { kind: 'setup'; status: SetupStatus }>({ kind: 'checking' });
  const unauthorizedRef = useRef(props.onUnauthenticated);
  unauthorizedRef.current = props.onUnauthenticated;

  const check = useCallback(async () => {
    setGate({ kind: 'checking' });
    try {
      const response = await fetch('/api/setup', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (response.status === 401) {
        unauthorizedRef.current();
        return;
      }
      if (!response.ok) throw new Error('Setup status could not be read.');
      const status = await response.json() as SetupStatus;
      setGate(status.requiredComplete ? { kind: 'app' } : { kind: 'setup', status });
    } catch {
      setGate({ kind: 'failed' });
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  const app = gate.kind === 'app';
  useEffect(() => {
    if (app) onShown();
  }, [app, onShown]);

  if (gate.kind === 'app') return <SignedIn {...props} />;
  if (gate.kind === 'setup') {
    return (
      <Suspense fallback={<main className="min-h-screen bg-background" />}>
        <SetupWizard {...props} status={gate.status} onFinished={() => setGate({ kind: 'app' })} />
        <WhenDrawn run={onShown} />
      </Suspense>
    );
  }
  return (
    <main className="min-h-screen bg-background px-(--page-margin) pt-10">
      {gate.kind === 'failed'
        ? <Callout title="media-manager-2 could not be read" action={<Button variant="outline" onClick={() => void check()}>Retry</Button>}>Check that it is running, then retry.</Callout>
        : <p className="sr-only" aria-live="polite">Checking setup…</p>}
    </main>
  );
}

// Home routes by address: the Library is home, search results, title pages, the calendar and Discover (/discover and its grids) come from Home, and the Downloads, Flagged, History, Blocklist, Health and Settings screens live at /downloads, /flagged, /history, /blocklist, /health and /settings.
function SignedIn(props: SignedInProps) {
  const { state, reload } = useDownloads(props.onUnauthenticated);
  const { pathname } = useLocation();
  const history = useHistory(props.onUnauthenticated, pathname === '/history');
  const blocklist = useBlocklist(props.onUnauthenticated, pathname === '/blocklist');
  const downloadsHeadingRef = useRef<HTMLHeadingElement>(null);
  const flagged = useFlagged(props.onUnauthenticated, pathname === '/flagged');
  const flaggedHeadingRef = useRef<HTMLDivElement>(null);
  const health = useHealth(props.onUnauthenticated);
  const healthHeadingRef = useRef<HTMLDivElement>(null);
  const healthProblems = health.state.kind === 'ready' ? health.state.snapshot.problems : [];
  const rows = useMemo(() => (state.kind === 'ready' ? buildRows(state.snapshot) : []), [state]);
  const needsYou = useMemo(() => groupRows(rows).find((group) => group.key === 'needs_you')?.rows.length ?? 0, [rows]);
  const downloadingRows = rows.filter((row) => row.downloading);
  const speeds = `${formatSpeed(rows.reduce((total, row) => total + row.downRate, 0))} down · ${formatSpeed(rows.reduce((total, row) => total + row.upRate, 0))} up`;
  const [barOpen, setBarOpen] = useState(false);

  useEffect(() => {
    if (typeof window.requestIdleCallback !== 'function') {
      const timeout = window.setTimeout(preloadScreens, 2_000);
      return () => window.clearTimeout(timeout);
    }
    const idle = window.requestIdleCallback(preloadScreens, { timeout: 5_000 });
    return () => window.cancelIdleCallback(idle);
  }, []);

  useEffect(() => {
    if (!barOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setBarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [barOpen]);

  return (
    <Home
      {...props}
      downloadsState={state}
      needsYou={needsYou}
      downloading={downloadingRows.length}
      healthProblems={healthProblems.filter((problem) => problem.level !== 'notice').length}
      healthRisk={healthProblems.some((problem) => problem.level === 'error')}
      downloads={<DownloadsScreen state={state} reload={reload} headingRef={downloadsHeadingRef} onUnauthenticated={props.onUnauthenticated} />}
      flagged={(
        <FlaggedScreen
          state={flagged}
          reload={flagged.reload}
          headingRef={flaggedHeadingRef}
          onUnauthenticated={props.onUnauthenticated}
          onOpenHealth={() => navigate('/health')}
        />
      )}
      history={<HistoryScreen history={history} onNavigate={navigate} />}
      blocklist={<BlocklistScreen blocklist={blocklist} />}
      health={<HealthScreen state={health.state} runChecks={health.runChecks} headingRef={healthHeadingRef} />}
      renderBar={(showDownloads) => {
        const onOpen = () => {
          setBarOpen(false);
          showDownloads();
          window.requestAnimationFrame(() => downloadsHeadingRef.current?.focus());
        };
        return (
          <DownloadsLiveBar
            count={state.kind === 'ready' ? (downloadingRows.length === 0 ? 'Nothing downloading' : `${downloadingRows.length} downloading`) : 'downloads'}
            idle={downloadingRows.length === 0}
            speeds={speeds}
            items={downloadingRows.map((row) => ({ key: row.key, name: row.label, percent: row.progress ?? 0 }))}
            problem={needsYou > 0 ? `${needsYou} ${needsYou === 1 ? 'needs' : 'need'} you` : undefined}
            expanded={barOpen}
            onExpandedChange={setBarOpen}
            panel={(
              <PanelInline
                open
                title="Downloads"
                onClose={() => setBarOpen(false)}
                primary={<Button size="large" onClick={onOpen}>Open Downloads</Button>}
                secondary={<Button variant="outline" kbd="Esc" onClick={() => setBarOpen(false)}>Collapse</Button>}
                hint={speeds}
              >
                <div className="px-5">
                  <LabelGroup count={downloadingRows.length}>Downloading</LabelGroup>
                  <div role="table" aria-label="Downloading" className="border-t border-border">
                    {downloadingRows.map((row) => (
                      <RowDownload
                        key={row.key}
                        title={row.label}
                        release={row.releaseName}
                        progress={row.progress ?? 0}
                        speed={formatSpeed(row.downRate)}
                        eta={row.timeLeft}
                        tracker={row.tracker}
                        state={row.status.tone === 'risk' ? 'stalled' : 'downloading'}
                        stateLabel={row.seeders === null ? row.status.word : `${row.status.word} · ${row.seeders} seeders`}
                        quality={row.qualityName}
                      />
                    ))}
                  </div>
                </div>
              </PanelInline>
            )}
          />
        );
      }}
    />
  );
}

createRoot(document.getElementById('root')!).render(<ToastProvider><App /></ToastProvider>);
// After the first render and out of the main chunk; web-vitals reads buffered entries, so starting late loses nothing.
void import('./metrics').then(({ startMetrics }) => startMetrics(), () => undefined);
