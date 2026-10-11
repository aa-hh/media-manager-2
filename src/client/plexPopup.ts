export const POLL_INTERVAL_MS = 2_000;
export const POPUP_NAME = 'plex-sign-in';
export const POPUP_FEATURES = 'popup,width=520,height=680';

export type PopupWindow = { closed: boolean; close(): void; location: { assign(url: string): void } };

export type PopupHost = {
  open(): PopupWindow | null;
  narrow(): boolean;
  assign(url: string): void;
  setInterval(callback: () => void, ms: number): number;
  clearInterval(id: number): void;
};

/** Opens the popup while the click's user activation is still fresh. Null when the browser blocked it or the viewport is phone-sized. */
export const openPopup = (host: PopupHost): PopupWindow | null => (host.narrow() ? null : host.open());

/**
 * Sends the browser to Plex: into the popup when one is open, otherwise by leaving the page.
 * With a popup, ticks every POLL_INTERVAL_MS until stopped: onClosed once the popup is gone (and stops), onTick otherwise.
 * Returns the stop function, or undefined when the page left instead.
 */
export const sendToPlex = (
  host: PopupHost,
  popup: PopupWindow | null,
  url: string,
  handlers: { onTick(): void; onClosed(): void },
): (() => void) | undefined => {
  if (popup === null || popup.closed) {
    host.assign(url);
    return undefined;
  }
  popup.location.assign(url);
  const id = host.setInterval(() => {
    if (popup.closed) {
      host.clearInterval(id);
      handlers.onClosed();
    } else {
      handlers.onTick();
    }
  }, POLL_INTERVAL_MS);
  return () => host.clearInterval(id);
};

/** The sign-in state Plex will send back, read from the handoff URL's forwardUrl. */
export const handoffState = (handoffUrl: string): string | undefined => {
  try {
    const forwardUrl = new URLSearchParams(new URL(handoffUrl).hash.slice(2)).get('forwardUrl');
    if (typeof forwardUrl !== 'string' || forwardUrl === '') return undefined;
    const state = new URL(forwardUrl).searchParams.get('state');
    return typeof state === 'string' && state !== '' ? state : undefined;
  } catch {
    return undefined;
  }
};

export const POPUP_MESSAGE = 'plex-sign-in';
export type PopupMessage = { type: typeof POPUP_MESSAGE; state: string };

export const isPopupMessage = (data: unknown): data is PopupMessage =>
  typeof data === 'object'
  && data !== null
  && (data as { type?: unknown }).type === POPUP_MESSAGE
  && typeof (data as { state?: unknown }).state === 'string'
  && (data as { state: string }).state !== '';
