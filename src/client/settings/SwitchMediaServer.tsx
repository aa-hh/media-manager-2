import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog } from '@/components/ui/dialog';
import { FieldLabelled } from '@/components/ui/field-labelled';
import { InputSearch } from '@/components/ui/input-search';
import { Logo } from '@/components/ui/logo';
import { StatusInline } from '@/components/ui/status-inline';
import { useToastManager } from '@/components/ui/toast';
import { useJellyfinLogin } from '../FirstRun';
import { handoffState, isPopupMessage, openPopup, sendToPlex } from '../plexPopup';
import { browserPost, isAbort, popupHost, readJson } from '../SignIn';

type SwitchMediaServerProps = {
  /** The media server not in use, which the owner can switch to. */
  target: 'plex' | 'jellyfin';
  /** PLEX_OWNER_ID is set, so the owner cannot change. */
  pinned: boolean;
  /** The target's address and key or token are saved and its last check answered. */
  ready: boolean;
  /** The Jellyfin owner's server name; null for a Plex owner. */
  currentServerName: string | null;
  /** For a switch to Jellyfin: the saved address and what its last check reported. */
  jellyfin?: { url: string; serverName?: string; version?: string };
  onSwitched: (expiresAt: number) => void;
};

const UNAVAILABLE = 'Plex sign-in is unavailable. Try again.';
const textLink = 'self-start font-ui text-sm font-semibold text-foreground underline underline-offset-2 focus-ring';

/** "9:42" from milliseconds. */
const minutesSeconds = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** The row under the not-in-use media server's facts: what switching does, and the button that opens the log-in dialog. */
export function SwitchMediaServer({ target, pinned, ready, currentServerName, jellyfin, onSwitched }: SwitchMediaServerProps) {
  const toasts = useToastManager();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | undefined>(undefined);
  // The running Plex sign-in: its requests' controller and what stops its ticker, message listener and popup.
  const runRef = useRef<{ controller: AbortController; stop: () => void } | undefined>(undefined);

  const endRun = (abort: boolean) => {
    const run = runRef.current;
    runRef.current = undefined;
    if (run === undefined) return;
    run.stop();
    if (abort) run.controller.abort();
  };

  useEffect(() => () => endRun(true), []);

  const login = useJellyfinLogin({
    stillLine: 'Plex is still the media server.',
    onSignedIn: (expiresAt) => {
      setOpen(false);
      onSwitched(expiresAt);
    },
  });
  const code = login.quickConnect;
  const [now, setNow] = useState(Date.now);
  // Ticks the Quick Connect expiry once a second while the dialog shows a code.
  useEffect(() => {
    if (code === undefined || !open) return undefined;
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, [code, open]);
  // Opening starts a fresh log-in; closing stops any request or Quick Connect wait.
  const openJellyfin = () => {
    login.reset();
    setOpen(true);
  };
  const closeJellyfin = () => {
    login.stop();
    setOpen(false);
    if (login.quickConnect !== undefined) cancelled();
  };

  const plex = target === 'plex';
  const label = plex ? 'Plex' : 'Jellyfin';
  const cancelled = () =>
    toasts.add({
      type: 'info',
      title: `Switch to ${label} cancelled`,
      description: plex
        ? 'Plex sign-in closed before it finished. Jellyfin is still in use.'
        : 'Quick Connect was cancelled before the code was approved. Plex is still in use.',
    });
  const title = plex ? 'Jellyfin is the media server' : 'Plex is the media server';
  const body = pinned
    ? 'PLEX_OWNER_ID in the server’s settings pins the owner to one Plex account, so the media server can’t be switched here. Remove it and restart media-manager-2 to switch.'
    : !ready
      ? (plex
        ? 'Connect Plex first: add its address and token above, then Connect. Switch to Plex appears once Plex answers.'
        : 'Connect Jellyfin first: add its address and key above, then Connect. Switch to Jellyfin appears once Jellyfin answers.')
      : (plex
        ? 'Switch to Plex to log in with Plex instead. That Plex account becomes the owner, and Jellyfin log-in stops working.'
        : 'Switch to Jellyfin to log in with a Jellyfin administrator account instead. That account becomes the owner, and Plex log-in stops working.');

  const startPlex = async () => {
    endRun(true);
    setLine(undefined);
    // Opened before any await, while the click still counts as the user's.
    const popup = openPopup(popupHost);
    const controller = new AbortController();
    let stopTicker: (() => void) | undefined;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || popup === null || event.source !== popup || !isPopupMessage(event.data)) return;
      // The popup closes itself after sending the state; stop the ticker so that close does not read as an interruption.
      stopTicker?.();
      stopTicker = undefined;
      void complete(event.data.state);
    };
    const run = {
      controller,
      stop: () => {
        stopTicker?.();
        stopTicker = undefined;
        window.removeEventListener('message', onMessage);
        if (popup !== null && !popup.closed) {
          try {
            popup.close();
          } catch {
            // Closing can throw in odd browser states; the popup is abandoned either way.
          }
        }
      },
    };
    const fail = (message: string) => {
      if (runRef.current !== run) return;
      endRun(false);
      setBusy(false);
      setLine(message);
    };
    const complete = async (state: string) => {
      try {
        const response = await browserPost('/auth/complete', { state }, controller.signal);
        const answer = await readJson(response);
        if (runRef.current !== run) return;
        if (response.status === 200 && typeof answer.expiresAt === 'number') {
          endRun(false);
          setBusy(false);
          setOpen(false);
          onSwitched(answer.expiresAt);
          return;
        }
        if (response.status === 202 || (response.status === 409 && answer.error === 'in_progress')) return;
        if (response.status === 403 && answer.error === 'owner_only') fail('That Plex account can’t open media-manager-2. Jellyfin is still the media server.');
        else if (response.status === 401) fail('The Plex sign-in expired or couldn’t be verified. Jellyfin is still the media server.');
        else fail(UNAVAILABLE);
      } catch (error) {
        if (!isAbort(error)) fail(UNAVAILABLE);
      }
    };
    runRef.current = run;
    window.addEventListener('message', onMessage);
    setBusy(true);
    try {
      const response = await browserPost('/auth/start', {}, controller.signal);
      const answer = await readJson(response);
      if (runRef.current !== run) return;
      const state = response.status === 201 && typeof answer.url === 'string' ? handoffState(answer.url) : undefined;
      if (state === undefined) {
        fail(UNAVAILABLE);
        return;
      }
      stopTicker = sendToPlex(popupHost, popup, answer.url as string, {
        onTick: () => void complete(state),
        onClosed: () => {
          stopTicker = undefined;
          if (runRef.current !== run) return;
          endRun(false);
          setBusy(false);
          setLine(undefined);
          setOpen(false);
          cancelled();
        },
      });
    } catch (error) {
      if (!isAbort(error)) fail(UNAVAILABLE);
    }
  };

  const cancel = () => {
    const running = runRef.current !== undefined;
    if (running) void browserPost('/auth/cancel', {}, new AbortController().signal).catch(() => undefined);
    endRun(true);
    setBusy(false);
    setLine(undefined);
    setOpen(false);
    if (running) cancelled();
  };

  const serverWords = jellyfin?.serverName === undefined ? jellyfin?.url : `“${jellyfin.serverName}” (${jellyfin.url})`;

  return (
    <div className="flex items-start gap-6 border-t border-border pt-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-ui text-sm font-semibold text-foreground">{title}</h3>
        <p className="font-ui text-sm text-muted-foreground">{body}</p>
      </div>
      {!pinned && ready && (
        <Button variant={target} onClick={plex ? () => setOpen(true) : openJellyfin} className="shrink-0">
          <span className="inline-flex items-center gap-2">
            <Logo name={plex ? 'plex' : 'jellyfin-black'} alt="" className="size-4" />
            Switch to {label}
          </span>
        </Button>
      )}

      {plex ? (
        <Dialog
          open={open}
          onOpenChange={(next) => (next ? setOpen(true) : cancel())}
          title="Switch the media server to Plex?"
          subject={`You’re the owner through Jellyfin “${currentServerName ?? ''}”. Switching changes whose account can open media-manager-2.`}
          callout={(
            <Callout look="warning" title="Jellyfin log-in stops working">
              Next you log in with Plex, and that Plex account becomes the owner. The Jellyfin address and key stay saved in case you switch back.
            </Callout>
          )}
          actions={(
            <div className="flex w-full flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="large" onClick={cancel}>Cancel</Button>
                <Button variant="plex" size="large" loading={busy} onClick={() => void startPlex()}>
                  <span className="inline-flex items-center gap-2">
                    <Logo name="plex" alt="" className="size-4" />
                    Log in with Plex
                  </span>
                </Button>
              </div>
              {line !== undefined && <p role="alert" className="font-ui text-sm text-destructive">{line}</p>}
            </div>
          )}
        />
      ) : (
        <Dialog
          open={open}
          onOpenChange={(next) => (next ? setOpen(true) : closeJellyfin())}
          title="Switch the media server to Jellyfin?"
          subject={code === undefined
            ? `You’re the owner through Plex. Log in with a Jellyfin administrator account on ${serverWords ?? ''} to switch.`
            : 'You’re the owner through Plex. Approve the code in Jellyfin to switch.'}
          callout={code === undefined ? (
            <Callout look="warning" title="Plex log-in stops working">
              The Jellyfin administrator who logs in next becomes the owner. The Plex address and token stay saved in case you switch back.
            </Callout>
          ) : undefined}
          actions={(
            <>
              <Button variant="outline" onClick={closeJellyfin}>Cancel</Button>
              {code === undefined && (
                <Button variant="jellyfin" size="large" loading={login.quickConnectBusy} onClick={() => void login.startQuickConnect()}>
                  <span className="inline-flex items-center gap-2">
                    <Logo name="jellyfin-black" alt="" />
                    Log in with Jellyfin
                  </span>
                </Button>
              )}
            </>
          )}
        >
          {code === undefined ? (
            <>
              <StatusInline status="sent" className="self-start">
                Jellyfin {jellyfin?.serverName === undefined ? '' : `“${jellyfin.serverName}” `}answered{jellyfin?.version === undefined ? '' : ` · ${jellyfin.version}`}
              </StatusInline>
              {login.usePassword ? (
                <form className="flex flex-col gap-4" onSubmit={(event) => void login.passwordLogin(event)}>
                  <FieldLabelled label="Username">
                    <InputSearch variant="field" type="text" required autoComplete="username" value={login.username} onValueChange={login.setUsername} />
                  </FieldLabelled>
                  <FieldLabelled label="Password">
                    <InputSearch variant="field" type="password" required autoComplete="current-password" value={login.password} onValueChange={login.setPassword} />
                  </FieldLabelled>
                  <Button type="submit" variant="jellyfin" size="large" loading={login.passwordBusy} className="self-start">Log in</Button>
                </form>
              ) : (
                <button type="button" onClick={() => login.setUsePassword(true)} className={textLink}>Log in with username and password</button>
              )}
              {login.error !== undefined && <p role="alert" className="font-ui text-[13px] text-destructive">{login.error}</p>}
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="font-ui text-sm text-foreground">In any Jellyfin app where you’re signed in as an administrator, open your user menu &gt; Quick Connect and enter:</p>
              <p aria-label={code.code.split('').join(' ')} className="font-data text-[48px] leading-[1.2] font-semibold tracking-[6px] text-foreground">
                {code.code.length === 6 ? `${code.code.slice(0, 3)} ${code.code.slice(3)}` : code.code}
              </p>
              <p className="font-ui text-[13px] text-muted-foreground">Expires in {minutesSeconds(code.expiresAt - now)} · Waiting for you to approve it</p>
              <button
                type="button"
                onClick={() => {
                  login.reset();
                  login.setUsePassword(true);
                }}
                className={textLink}
              >
                Use username and password instead
              </button>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
