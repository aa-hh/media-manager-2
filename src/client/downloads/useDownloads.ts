import { useCallback, useEffect, useRef, useState } from 'react';
import { applyEvent, type Snapshot } from './model';

const liveTypes = ['torrents', 'queue', 'grab', 'problem'] as const;

// Pages listening for Plex's 'watch' event, which names the show or movie (its Plex ratingKey) just played, paused, stopped
// or watched. Null means any title may have changed: the stream reopened, and events sent while it was closed are lost.
const watchListeners = new Set<(ratingKey: string | null) => void>();
const watchChanged = (ratingKey: string | null) => {
  for (const listener of watchListeners) listener(ratingKey);
};

/**
 * Calls `reread` after a 'watch' event that `matches`. An event while `ready` is false waits until it turns true, since
 * the read under way may predate it.
 */
export const useWatchChange = (ready: boolean, matches: (ratingKey: string | null) => boolean, reread: () => void) => {
  const latest = useRef({ ready, matches, reread });
  latest.current = { ready, matches, reread };
  const missed = useRef(false);
  useEffect(() => {
    const listener = (ratingKey: string | null) => {
      const current = latest.current;
      if (!current.matches(ratingKey)) return;
      if (current.ready) current.reread();
      else missed.current = true;
    };
    watchListeners.add(listener);
    return () => { watchListeners.delete(listener); };
  }, []);
  useEffect(() => {
    if (!ready || !missed.current) return;
    missed.current = false;
    latest.current.reread();
  }, [ready]);
};

export type DownloadsState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; snapshot: Snapshot; live: boolean };

// Reads the snapshot once, then follows the event stream. The stream has no replay, so every (re)connect reads the snapshot again.
export const useDownloads = (onUnauthorized: () => void) => {
  const [state, setState] = useState<DownloadsState>({ kind: 'loading' });
  const [generation, setGeneration] = useState(0);
  const reopenDelayRef = useRef(2_000);
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;
  const versionRef = useRef(0);
  const openRef = useRef(false);
  const eventDuringLoadRef = useRef(false);
  const openedRef = useRef(false);

  // An event that lands while the snapshot is in flight is applied to the old state, which the snapshot then
  // replaces, and the snapshot may predate it; so a read that saw one runs again.
  const load = useCallback(async function read(): Promise<'stored' | 'unauthorized' | 'failed' | 'stale'> {
    const version = ++versionRef.current;
    eventDuringLoadRef.current = false;
    try {
      const response = await fetch('/api/downloads', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (version !== versionRef.current) return 'stale';
      if (response.status === 401) {
        unauthorizedRef.current();
        return 'unauthorized';
      }
      if (!response.ok) throw new Error('Downloads could not be read.');
      const snapshot = await response.json() as Snapshot;
      if (version !== versionRef.current) return 'stale';
      // Live only once a snapshot read after the stream opened is in place.
      setState({ kind: 'ready', snapshot, live: openRef.current });
    } catch {
      if (version !== versionRef.current) return 'stale';
      setState((current) => (current.kind === 'ready' ? current : { kind: 'failed' }));
      return 'failed';
    }
    return eventDuringLoadRef.current ? read() : 'stored';
  }, []);

  useEffect(() => {
    const source = new EventSource('/api/events', { withCredentials: true });
    let disposed = false;
    let reopen: number | undefined;
    const setLive = (live: boolean) => setState((current) => (current.kind === 'ready' ? { ...current, live } : current));
    source.addEventListener('open', () => {
      if (openedRef.current) watchChanged(null);
      openedRef.current = true;
      openRef.current = true;
      reopenDelayRef.current = 2_000;
      void load();
    });
    source.addEventListener('error', () => {
      openRef.current = false;
      setLive(false);
      // The browser never reopens a closed stream, as after a proxy's 502 mid-deploy or the server's stream limit.
      // Reading the snapshot reports an expired session to the app; otherwise the stream reopens after a growing wait.
      if (source.readyState !== EventSource.CLOSED) return;
      void load().then((result) => {
        if (disposed || result === 'unauthorized') return;
        reopen = window.setTimeout(() => setGeneration((current) => current + 1), reopenDelayRef.current);
        reopenDelayRef.current = Math.min(reopenDelayRef.current * 2, 30_000);
      });
    });
    source.addEventListener('watch', (event) => {
      try {
        const { ratingKey } = JSON.parse((event as MessageEvent<string>).data) as { ratingKey: string };
        watchChanged(ratingKey);
      } catch {
        // An unreadable event changes nothing.
      }
    });
    for (const type of liveTypes) {
      source.addEventListener(type, (event) => {
        let data: unknown;
        try {
          data = JSON.parse((event as MessageEvent<string>).data);
        } catch {
          return;
        }
        eventDuringLoadRef.current = true;
        setState((current) => (current.kind === 'ready' ? { ...current, snapshot: applyEvent(current.snapshot, type, data) } : current));
      });
    }
    return () => {
      disposed = true;
      window.clearTimeout(reopen);
      source.close();
      openRef.current = false;
      versionRef.current += 1;
    };
  }, [load, generation]);

  return { state, reload: load };
};

export const postAction = async (path: string, body: unknown = {}) => {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2' },
    body: JSON.stringify(body),
  });
  return response.status;
};
