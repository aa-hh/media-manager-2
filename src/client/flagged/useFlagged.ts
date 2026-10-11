import { useCallback, useEffect, useRef, useState } from 'react';
import type { Problem, Service } from '../downloads/model';
import type { ReleaseTarget } from '../PickRelease';

// The server types in src/server/flagged.ts are the source of truth; these mirror them for the browser.
export type FlaggedAction =
  | { kind: 'pick_release'; target: ReleaseTarget; title: string }
  | { kind: 'search'; service: Service; type: 'movie' | 'episode'; ids: number[] }
  | { kind: 'manual_import'; service: Service; downloadId: string }
  | { kind: 'open_health' };

export type FlaggedItem = { problem: Problem; kindWord: string; label: string; detail: string; actions: FlaggedAction[] };

export type NeedsYou = { items: FlaggedItem[]; handlingCount: number; handledThisWeek: number };

export type Wanted = {
  service: Service;
  type: 'movie' | 'episode';
  id: number;
  seriesId: number | null;
  title: string;
  availableAt: number | null;
  lastSearchAt: number | null;
  nextSearchAt: number | null;
  lastResult: string;
  inQueue: boolean;
};

export type WantedLists = { missing: Wanted[]; cutoff: Wanted[] };

export type Load<T> = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; value: T };

export type FlaggedState = { needsYou: Load<NeedsYou>; wanted: Load<WantedLists> };

// Reads both lists on open and whenever the window comes back into focus; a failed re-read keeps what was shown.
export const useFlagged = (onUnauthorized: () => void) => {
  const [needsYou, setNeedsYou] = useState<Load<NeedsYou>>({ kind: 'loading' });
  const [wanted, setWanted] = useState<Load<WantedLists>>({ kind: 'loading' });
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;

  const read = useCallback(async <T,>(path: string, set: (update: (current: Load<T>) => Load<T>) => void) => {
    try {
      const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (response.status === 401) {
        unauthorizedRef.current();
        return;
      }
      if (!response.ok) throw new Error('unreadable');
      const value = await response.json() as T;
      set(() => ({ kind: 'ready', value }));
    } catch {
      set((current) => (current.kind === 'ready' ? current : { kind: 'failed' }));
    }
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([read<NeedsYou>('/api/flagged', setNeedsYou), read<WantedLists>('/api/flagged/wanted', setWanted)]);
  }, [read]);

  useEffect(() => {
    void reload();
    const onFocus = () => { void reload(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  return { needsYou, wanted, reload };
};
