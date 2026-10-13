import { Check, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { Button } from './components/ui/button';
import { Logo } from './components/ui/logo';
import { cn } from './lib/utils';
import { POLL_INTERVAL_MS } from './plexPopup';
import { PRODUCT_NAME } from './productName';
import { browserPost } from './SignIn';

type FirstRunProps = {
  headingRef?: Ref<HTMLHeadingElement>;
  plexBusy: boolean;
  plexLine?: string;
  onPlexSignIn: () => void;
  onSignedIn: (expiresAt: number) => void;
  className?: string;
};

type Step = 'pick' | 'plex' | 'jellyfin-address' | 'jellyfin-login';

const readBody = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const value: unknown = await response.json();
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

const JELLYFIN_NO_ANSWER = 'Jellyfin didn’t answer. Try again.';
const TOO_MANY_TRIES = 'Too many tries. Wait a minute, then try again.';
const ONLY_OWNER = 'Only the owner’s Jellyfin account can open this app.';

/** The sentence for a failed Jellyfin login, or 'reload' when an owner now exists. */
const loginFailure = (status: number, body: Record<string, unknown>, password: boolean, stillLine: string): string => {
  if (password && status === 401) return 'Jellyfin refused that username and password.';
  if (status === 403 && body.error === 'not_administrator') {
    return `You logged in as ${String(body.userName)}, who isn’t an administrator on “${String(body.serverName)}”. Log in with an administrator account. ${stillLine}`;
  }
  if (status === 403 && body.error === 'owner_only') return ONLY_OWNER;
  if (status === 409) return 'reload';
  if (status === 429) return TOO_MANY_TRIES;
  return JELLYFIN_NO_ANSWER;
};

const heading = 'font-ui text-2xl leading-[1.2] font-extrabold tracking-[-0.3px] text-[#ece9e1]';
const body = 'font-ui text-[15px] leading-[22px] text-[#b8b9b6]';
const errorText = 'font-ui text-sm leading-[21px] text-[#f2a097]';
const input = 'h-10 w-full rounded-xl border border-[#3a3b40] bg-[#121317] px-3 font-ui text-[15px] text-[#ece9e1] placeholder:text-[#6f716e] focus-ring-on-dark';
const label = 'flex flex-col gap-1.5 font-ui text-sm font-semibold text-[#ece9e1]';
const link = 'self-start font-ui text-sm font-semibold text-[#ece9e1] underline underline-offset-2 focus-ring-on-dark';

function DoneRow({ children, onChange }: { children: ReactNode; onChange: () => void }) {
  return (
    <p className="flex items-center gap-2 font-ui text-sm text-[#b8b9b6]">
      <Check aria-hidden="true" className="size-4 shrink-0 text-[#ece9e1]" />
      <span>{children}</span>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={onChange} className={link}>Change</button>
    </p>
  );
}

function PickRow({ logo, title, line, onClick }: { logo: 'plex' | 'jellyfin'; title: string; line: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-[#2a2b30] bg-[#ffffff08] p-4 text-left transition-colors duration-(--duration-fast) hover:bg-[#ffffff12] focus-ring-on-dark">
      <Logo name={logo} alt="" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-ui text-[15px] font-semibold text-[#ece9e1]">{title}</span>
        <span className="font-ui text-sm text-[#b8b9b6]">{line}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[#b8b9b6]" />
    </button>
  );
}

/**
 * A Jellyfin log-in, by Quick Connect or by username and password, shared by the dark log-in pages and the media-server switch
 * dialog in Settings. With no url the server uses the owner's saved, locked address.
 */
export function useJellyfinLogin({ url, stillLine = 'You’re still signed out.', onSignedIn }: {
  url?: string;
  /** The sentence after a refusal that says nothing changed. */
  stillLine?: string;
  onSignedIn: (expiresAt: number) => void;
}) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [quickConnect, setQuickConnect] = useState<{ code: string; expiresAt: number } | undefined>(undefined);
  const [usePassword, setUsePassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [quickConnectBusy, setQuickConnectBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const pollRef = useRef<number | undefined>(undefined);

  const post = (path: string, payload: object) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return browserPost(path, payload, controller.signal);
  };

  const stop = () => {
    controllerRef.current?.abort();
    window.clearTimeout(pollRef.current);
    pollRef.current = undefined;
  };

  useEffect(() => stop, []);

  /** Stops any request or Quick Connect wait and empties the form. */
  const reset = () => {
    stop();
    setError(undefined);
    setQuickConnect(undefined);
    setQuickConnectBusy(false);
    setPasswordBusy(false);
    setUsePassword(false);
    setUsername('');
    setPassword('');
  };

  const showFailure = (message: string) => {
    if (message === 'reload') {
      window.location.reload();
      return;
    }
    setError(message);
  };

  // The server's flow_expired answer ends polling; a browser clock can drift from the server's.
  const pollQuickConnect = () => {
    pollRef.current = window.setTimeout(async () => {
      pollRef.current = undefined;
      try {
        const response = await post('/auth/jellyfin/quick-connect/complete', {});
        const answer = await readBody(response);
        if (response.status === 202 || (response.status === 409 && answer.error === 'in_progress')) {
          pollQuickConnect();
          return;
        }
        setQuickConnect(undefined);
        setQuickConnectBusy(false);
        if (response.status === 200 && typeof answer.expiresAt === 'number') {
          onSignedIn(answer.expiresAt);
          return;
        }
        showFailure(loginFailure(response.status, answer, false, stillLine));
      } catch (failure) {
        if (isAbort(failure)) return;
        setQuickConnect(undefined);
        setQuickConnectBusy(false);
        setError(JELLYFIN_NO_ANSWER);
      }
    }, POLL_INTERVAL_MS);
  };

  const startQuickConnect = async () => {
    window.clearTimeout(pollRef.current);
    setError(undefined);
    setQuickConnect(undefined);
    setQuickConnectBusy(true);
    setPasswordBusy(false);
    try {
      const response = await post('/auth/jellyfin/quick-connect', url === undefined ? {} : { url });
      const answer = await readBody(response);
      if (response.status === 201 && typeof answer.code === 'string' && typeof answer.expiresAt === 'number') {
        setQuickConnect({ code: answer.code, expiresAt: answer.expiresAt });
        pollQuickConnect();
        return;
      }
      setQuickConnectBusy(false);
      if (response.status === 409 && answer.error === 'quick_connect_off') {
        setError('Quick Connect is off on this server. Log in with username and password.');
      } else {
        showFailure(loginFailure(response.status, answer, false, stillLine));
      }
    } catch (failure) {
      if (isAbort(failure)) return;
      setQuickConnectBusy(false);
      setError(JELLYFIN_NO_ANSWER);
    }
  };

  const passwordLogin = async (event: FormEvent) => {
    event.preventDefault();
    window.clearTimeout(pollRef.current);
    setQuickConnect(undefined);
    setQuickConnectBusy(false);
    setError(undefined);
    setPasswordBusy(true);
    try {
      const response = await post('/auth/jellyfin/password', url === undefined ? { username, password } : { url, username, password });
      const answer = await readBody(response);
      setPasswordBusy(false);
      if (response.status === 200 && typeof answer.expiresAt === 'number') {
        onSignedIn(answer.expiresAt);
        return;
      }
      showFailure(loginFailure(response.status, answer, true, stillLine));
    } catch (failure) {
      if (isAbort(failure)) return;
      setPasswordBusy(false);
      setError(JELLYFIN_NO_ANSWER);
    }
  };

  return {
    error, quickConnect, usePassword, setUsePassword, username, setUsername, password, setPassword, quickConnectBusy, passwordBusy,
    startQuickConnect, passwordLogin, stop, reset,
  };
}

/** The Quick Connect button and the username-and-password form on the dark log-in pages. */
function JellyfinLogin({ url, onSignedIn }: { url?: string; onSignedIn: (expiresAt: number) => void }) {
  const {
    error, quickConnect, usePassword, setUsePassword, username, setUsername, password, setPassword, quickConnectBusy, passwordBusy, startQuickConnect, passwordLogin,
  } = useJellyfinLogin({ url, onSignedIn });
  return (
    <>
      <div className="flex flex-col gap-3">
        <Button variant="jellyfin" size="large" loading={quickConnectBusy} onClick={() => void startQuickConnect()} className="self-start">
          <span className="inline-flex items-center gap-2">
            <Logo name="jellyfin-black" alt="" className="size-4" />
            Log in with Jellyfin
          </span>
        </Button>
        {quickConnect !== undefined && (
          <p className={body}>Enter code <strong className="font-semibold text-[#ece9e1]">{quickConnect.code}</strong> in Jellyfin, under your user menu &gt; Quick Connect.</p>
        )}
      </div>
      {usePassword ? (
        <form className="flex flex-col gap-4" onSubmit={(event) => void passwordLogin(event)}>
          <label className={label}>
            Username
            <input type="text" required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className={input} />
          </label>
          <label className={label}>
            Password
            <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={input} />
          </label>
          <Button type="submit" variant="jellyfin" size="large" loading={passwordBusy} className="self-start">Log in</Button>
        </form>
      ) : (
        <button type="button" onClick={() => setUsePassword(true)} className={link}>Log in with username and password</button>
      )}
      {error !== undefined && <p className={errorText}>{error}</p>}
    </>
  );
}

/** The sign-in page once a Jellyfin owner exists: the owner logs in again against the saved server. */
export function JellyfinSignIn({ headingRef, onSignedIn, className }: { headingRef?: Ref<HTMLHeadingElement>; onSignedIn: (expiresAt: number) => void; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <h1 ref={headingRef} tabIndex={-1} className="outline-none font-ui text-4xl leading-[1.15] font-extrabold tracking-[-0.5px] text-[#ece9e1]">{PRODUCT_NAME}</h1>
      <div className="flex flex-col gap-2">
        <p className={body}>{ONLY_OWNER}</p>
        <p className={body}>You’ll approve the sign-in from a Jellyfin app where you’re already signed in.</p>
      </div>
      <JellyfinLogin onSignedIn={onSignedIn} />
    </div>
  );
}

/** The page shown while the install has no owner: pick Plex or Jellyfin, then log in. */
export function FirstRun({ headingRef, plexBusy, plexLine, onPlexSignIn, onSignedIn, className }: FirstRunProps) {
  const [step, setStep] = useState<Step>('pick');
  const [address, setAddress] = useState('');
  const [checked, setChecked] = useState<{ url: string; serverName: string } | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const backTo = (target: Step) => {
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    setChecking(false);
    setStep(target);
    setChecked(undefined);
    setError(undefined);
    if (target === 'pick') setAddress('');
  };

  const checkAddress = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setChecking(true);
    try {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const response = await browserPost('/auth/jellyfin/check', { url: address.trim() }, controller.signal);
      const answer = await readBody(response);
      setChecking(false);
      if (response.status === 200 && answer.kind === 'ok' && typeof answer.url === 'string' && typeof answer.serverName === 'string') {
        setChecked({ url: answer.url, serverName: answer.serverName });
        setStep('jellyfin-login');
      } else if (response.status === 200 && answer.kind === 'no_answer') {
        setError('Nothing answered at this address within 10 seconds. Check the address and port, and that Jellyfin is running.');
      } else if (response.status === 200 && answer.kind === 'not_jellyfin') {
        setError('Something answered at this address, but it isn’t a Jellyfin server. Check the port: Jellyfin uses 8096 unless you changed it.');
      } else if (response.status === 409) {
        window.location.reload();
      } else if (response.status === 429) {
        setError(TOO_MANY_TRIES);
      } else {
        setError(`${PRODUCT_NAME} didn’t answer. Try again.`);
      }
    } catch (failure) {
      if (isAbort(failure)) return;
      setChecking(false);
      setError(`${PRODUCT_NAME} didn’t answer. Try again.`);
    }
  };

  const jellyfin = step === 'jellyfin-address' || step === 'jellyfin-login';

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <h1 ref={headingRef} tabIndex={-1} className="outline-none font-ui text-4xl leading-[1.15] font-extrabold tracking-[-0.5px] text-[#ece9e1]">Getting started {PRODUCT_NAME}</h1>

      {step === 'pick' && (
        <>
          <p className={body}>No one owns this install yet. Pick the media server you’ll log in with. The first person to log in becomes the owner.</p>
          <div className="flex flex-col gap-2">
            <PickRow logo="plex" title="Plex" line="Log in with your Plex account, through plex.tv." onClick={() => setStep('plex')} />
            <PickRow logo="jellyfin" title="Jellyfin" line="Log in with an administrator account on your own Jellyfin server." onClick={() => setStep('jellyfin-address')} />
          </div>
          <p className="font-ui text-sm text-[#b8b9b6]">The owner can switch media server later in Settings.</p>
        </>
      )}

      {step !== 'pick' && (
        <div className="flex flex-col gap-2">
          <DoneRow onChange={() => backTo('pick')}>{jellyfin ? 'Media server: Jellyfin' : 'Media server: Plex'}</DoneRow>
          {step === 'jellyfin-login' && checked !== undefined && (
            <DoneRow onChange={() => backTo('jellyfin-address')}>Jellyfin “{checked.serverName}” at {new URL(checked.url).host}</DoneRow>
          )}
        </div>
      )}

      {step === 'plex' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className={heading}>Log in with Plex</h2>
            <p className={body}>The first Plex account to log in becomes the owner of {PRODUCT_NAME}.</p>
            <p className={body}>You’ll sign in on Plex, then return here. {PRODUCT_NAME} never receives your Plex password.</p>
          </div>
          <div className="relative">
            <Button variant="plex" size="large" loading={plexBusy} onClick={onPlexSignIn}>
              <span className="inline-flex items-center gap-2">
                <Logo name="plex" alt="" className="size-4" />
                Log in with Plex
              </span>
            </Button>
            {plexLine !== undefined && (
              <p className="absolute left-0 top-[calc(100%+12px)] font-ui text-sm leading-[21px] text-[#cdb08e] sm:whitespace-nowrap">{plexLine}</p>
            )}
          </div>
        </div>
      )}

      {step === 'jellyfin-address' && (
        <form className="flex flex-col gap-6" onSubmit={(event) => void checkAddress(event)}>
          <div className="flex flex-col gap-2">
            <h2 className={heading}>Where is your Jellyfin server?</h2>
            <p className={body}>The address {PRODUCT_NAME} uses to reach Jellyfin, with the port. Sign-in goes through this server.</p>
          </div>
          <label className={label}>
            Jellyfin server address
            <input
              type="url"
              required
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="http://192.168.1.20:8096"
              className={input}
            />
          </label>
          <div className="flex items-center gap-4">
            <Button type="submit" size="large" loading={checking}>Check address</Button>
            <span className="font-ui text-sm text-[#b8b9b6]">Step 2 of 3</span>
          </div>
          {error !== undefined && <p className={errorText}>{error}</p>}
        </form>
      )}

      {step === 'jellyfin-login' && checked !== undefined && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className={heading}>Log in with Jellyfin</h2>
            <p className={body}>Use a Jellyfin administrator account. The first administrator to log in becomes this app’s owner.</p>
            <p className={body}>Then the server address locks: only the owner can change it.</p>
          </div>
          <JellyfinLogin url={checked.url} onSignedIn={onSignedIn} />
        </div>
      )}
    </div>
  );
}
