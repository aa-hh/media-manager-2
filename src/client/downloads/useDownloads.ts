import { useCallback, useEffect, useRef, useState } from 'react';
import { applyEvent, type Snapshot } from './model';

const liveTypes = ['torrents', 'queue', 'grab', 'problem'] as const;

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
