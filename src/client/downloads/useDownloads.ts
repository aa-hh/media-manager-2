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
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;
  const versionRef = useRef(0);

  const load = useCallback(async () => {
    const version = ++versionRef.current;
    try {
      const response = await fetch('/api/downloads', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (version !== versionRef.current) return;
      if (response.status === 401) {
        unauthorizedRef.current();
        return;
      }
      if (!response.ok) throw new Error('Downloads could not be read.');
      const snapshot = await response.json() as Snapshot;
      if (version !== versionRef.current) return;
      setState((current) => ({ kind: 'ready', snapshot, live: current.kind === 'ready' ? current.live : false }));
    } catch {
      if (version === versionRef.current) setState((current) => (current.kind === 'ready' ? current : { kind: 'failed' }));
    }
  }, []);

  useEffect(() => {
    const source = new EventSource('/api/events', { withCredentials: true });
    const setLive = (live: boolean) => setState((current) => (current.kind === 'ready' ? { ...current, live } : current));
    source.addEventListener('open', () => {
      void load().then(() => setLive(true));
    });
    source.addEventListener('error', () => {
      setLive(false);
      // A closed stream is usually an expired session; reading the snapshot tells the app.
      if (source.readyState === EventSource.CLOSED) void load();
    });
    for (const type of liveTypes) {
      source.addEventListener(type, (event) => {
        let data: unknown;
        try {
          data = JSON.parse((event as MessageEvent<string>).data);
        } catch {
          return;
        }
        setState((current) => (current.kind === 'ready' ? { ...current, snapshot: applyEvent(current.snapshot, type, data) } : current));
      });
    }
    return () => {
      source.close();
      versionRef.current += 1;
    };
  }, [load]);

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
