import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog } from '@/components/ui/dialog';
import { Logo } from '@/components/ui/logo';
import { JellyfinLogin } from '../FirstRun';
import { handoffState, isPopupMessage, openPopup, sendToPlex } from '../plexPopup';
import { browserPost, popupHost } from '../SignIn';

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

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const value: unknown = await response.json();
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

const UNAVAILABLE = 'Plex sign-in is unavailable. Try again.';

/** The row under the not-in-use media server's facts: what switching does, and the button that opens the log-in dialog. */
export function SwitchMediaServer({ target, pinned, ready, currentServerName, jellyfin, onSwitched }: SwitchMediaServerProps) {
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

  const plex = target === 'plex';
  const label = plex ? 'Plex' : 'Jellyfin';
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
          fail('Plex sign-in was interrupted. Jellyfin is still the media server.');
        },
      });
    } catch (error) {
      if (!isAbort(error)) fail(UNAVAILABLE);
    }
  };

  const cancel = () => {
    if (runRef.current !== undefined) void browserPost('/auth/cancel', {}, new AbortController().signal).catch(() => undefined);
    endRun(true);
    setBusy(false);
    setLine(undefined);
    setOpen(false);
  };

  const serverWords = jellyfin?.serverName === undefined ? jellyfin?.url : `“${jellyfin.serverName}” (${jellyfin.url})`;

  return (
    <div className="flex items-start gap-6 border-t border-border pt-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-ui text-sm font-semibold text-foreground">{title}</h3>
        <p className="font-ui text-sm text-muted-foreground">{body}</p>
      </div>
      {!pinned && ready && (
        <Button variant={target} onClick={() => setOpen(true)} className="shrink-0">
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
              Next you log in with Plex, and that Plex account becomes the owner. Plex then needs its address here in Settings. The Jellyfin address and key stay saved in case you switch back.
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
          onOpenChange={setOpen}
          title="Switch the media server to Jellyfin?"
          subject={`You’re the owner through Plex. Log in with a Jellyfin administrator account on ${serverWords ?? ''} to switch.`}
          callout={(
            <Callout look="warning" title="Plex log-in stops working">
              The Jellyfin administrator who logs in next becomes the owner. The Plex address and token stay saved in case you switch back.
            </Callout>
          )}
          actions={<Button variant="outline" size="large" onClick={() => setOpen(false)}>Cancel</Button>}
        >
          <p className="font-data text-sm text-muted-foreground">
            Jellyfin {jellyfin?.serverName === undefined ? '' : `“${jellyfin.serverName}” `}answered{jellyfin?.version === undefined ? '' : ` · ${jellyfin.version}`}
          </p>
          <JellyfinLogin
            look="light"
            stillLine="Plex is still the media server."
            onSignedIn={(expiresAt) => {
              setOpen(false);
              onSwitched(expiresAt);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
