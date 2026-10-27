// The desktop app's bridge, `window.mediaManagerDesktop`, set by its preload script through Electron's contextBridge.
// The work order's C1.2 list is the contract; desktop/ implements the other side to the same shape.
// Every command is asynchronous because every call into mpv is. A plain browser has no bridge.

/** How Plex may deliver the file; the same flags POST /api/playback/start takes. */
export type PlaybackFlags = {
  directPlay: boolean;
  directStream: boolean;
  directStreamAudio: boolean;
  /** Kbps, set only when a quality step below Original is picked. */
  maxVideoBitrate?: number;
};

export type LoadRequest = {
  ratingKey: string;
  mediaIndex: number;
  partIndex: number;
  offsetSeconds: number;
  flags: PlaybackFlags;
};

/**
 * POST /api/playback/start's reply as the page sees it: the desktop's main process keeps the stream addresses,
 * so this is that reply with them removed (src/server/playback.ts is the source of truth for the rest).
 */
export type LoadReply = Record<string, unknown> & { startPositionSeconds: number };

/** The picture's place inside the window, in CSS pixels. */
export type Rect = { x: number; y: number; width: number; height: number };

export type DesktopEvents = {
  position: number;
  duration: number;
  paused: boolean;
  /** mpv's paused-for-cache. */
  buffering: boolean;
  /** mpv's demuxer-cache-duration, in seconds. */
  loadedAhead: number;
  endOfFile: undefined;
  error: { message: string };
  /** mpv's track-list property as mpv reports it. */
  tracks: Array<Record<string, unknown>>;
};

export type DesktopBridge = {
  /** The only call that touches the token: the main process starts playback itself and keeps the stream address. */
  load(request: LoadRequest): Promise<LoadReply>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setAudio(index: number): Promise<void>;
  setSubtitle(track: { index: number; url: string | null; ffIndex: number | null }): Promise<void>;
  setSubtitleDelay(seconds: number): Promise<void>;
  setLoadAhead(bytes: number): Promise<void>;
  /** Places the picture inside mpv's window; never moves a window. */
  setLayout(layout: 'full' | 'mini' | Rect): Promise<void>;
  setFullscreen(on: boolean): Promise<void>;
  stop(): Promise<void>;
  /** Subscribes to one event; the returned function unsubscribes. */
  on<E extends keyof DesktopEvents>(event: E, listener: (value: DesktopEvents[E]) => void): () => void;
};

declare global {
  interface Window {
    mediaManagerDesktop?: DesktopBridge;
  }
}

/** The bridge when the page runs inside the desktop app, otherwise undefined. */
export const desktopBridge = (): DesktopBridge | undefined => (typeof window === 'undefined' ? undefined : window.mediaManagerDesktop);

export const inDesktopApp = () => desktopBridge() !== undefined;
