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
export type LoadReply = Record<string, unknown> & {
  startPositionSeconds: number;
  /** The desktop install's player ids; the page's calls to Plex during playback carry the same ones. */
  clientId: string;
  sessionIdentifier: string;
};

/** The picture's place inside the window, in the page's CSS pixels. */
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
  /** Every way of playing failed; `tried` lists them in order, for the player's error screen. */
  error: { message: string; tried: string[] };
  /** mpv's track-list property as mpv reports it. */
  tracks: Array<Record<string, unknown>>;
  /** After an automatic retry: a fresh copy of the start reply, with a new `session`. */
  started: LoadReply;
  /** mpv's volume, 0 to 100. */
  volume: number;
  muted: boolean;
};

export type DesktopBridge = {
  /**
   * The only call that touches the token: the main process starts playback itself and keeps the stream address.
   * Playback unpauses by itself once the tracks are picked.
   */
  load(request: LoadRequest): Promise<LoadReply>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setAudio(index: number): Promise<void>;
  /** Pass the reply track's `url` (its stream key, null when embedded) and `ffIndex` unchanged; Off is index -1 with both null. */
  setSubtitle(track: { index: number; url: string | null; ffIndex: number | null }): Promise<void>;
  setSubtitleDelay(seconds: number): Promise<void>;
  /** 16 MiB to 8 GiB. */
  setLoadAhead(bytes: number): Promise<void>;
  /** Bytes; 512 MiB until changed. */
  getLoadAhead(): Promise<number>;
  /** Places the picture inside mpv's window; never moves a window. */
  setLayout(layout: 'full' | 'mini' | Rect): Promise<void>;
  setFullscreen(on: boolean): Promise<void>;
  /** 0 to 100; kept by the desktop app and applied to every file, like mute. */
  setVolume(percent: number): Promise<void>;
  setMuted(on: boolean): Promise<void>;
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
